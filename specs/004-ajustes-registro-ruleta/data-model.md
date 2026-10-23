# Data Model: Ajustes de registro, pantalla del QR y ruleta

Delta sobre [001](../001-registro-sorteo/data-model.md), [002](../002-rediseno-minimalista/data-model.md) y
[003](../003-sorteo-premios-ruleta/data-model.md). Todo lo no mencionado aquí **no cambia**: colecciones
`prizes`, `spins`, `draws`, `settings/registration` y `settings/draw`, ganadores y descartes, borrado
definitivo y reglas `deny all`. Almacén y acceso: Cloud Firestore solo vía Admin SDK. **No hay colecciones
nuevas ni migración de datos.**

## `participants/{phoneE164}` — Participante

| Campo | Cambio | Detalle |
|---|---|---|
| ID del documento y `phone` | **amplía** | Celular en E.164 con el prefijo del país: `+{prefijo}{número local}`. Prefijos admitidos: `51` PE, `54` AR, `55` BR, `56` CL, `57` CO, `58` VE, `591` BO, `592` GY, `593` EC, `595` PY, `597` SR, `598` UY. Antes: solo `+51…`. |
| `fullName` | regla | Uno o más términos de solo letras, mínimo 2 letras en total, máx. 100 (antes: ≥ 2 términos). |
| `company` | — | Sin cambios. |
| `crmInterest` | **nuevo** | `boolean`. `true` si marcó «¿Deseas adquirir el CRM con Agente IA?». Documentos anteriores: campo ausente ⇒ se trata como `false` en toda lectura. |
| `createdAt`, `drawId` | — | Sin cambios. |

### Reglas de validación (esquema compartido cliente/servidor)

Entrada del formulario: `{ fullName, country, phone, company, crmInterest }`, con `country` = código ISO
(por defecto `PE`) y `phone` = número **local** tal como lo escribe la persona.

1. `country` ∈ {`PE`,`AR`,`BO`,`BR`,`CL`,`CO`,`EC`,`GY`,`PY`,`SR`,`UY`,`VE`}.
2. Normalización del número (research D-302): quitar separadores → prefijo explícito `+` debe ser el del
   país → prefijo pelado solo con el largo total exacto → quitar `0` troncal (AR, BR, EC, PY, UY, VE) → en AR,
   quitar el `9` móvil si quedan 11 dígitos.
3. Regla del país: **PE y CL** exactamente 9 dígitos y el primero `9`; **resto** cantidad de dígitos dentro
   del rango de la tabla de [research.md](research.md#d-301-tabla-de-países-propia-sin-libphonenumber).
4. Salida: `phone = "+" + prefijo + número local` (E.164). Error de validación en `fieldErrors.phone` con el
   nombre del país y el formato esperado.
5. `crmInterest` es booleano; si no llega, `false`.

### Unicidad

El ID del documento es el E.164 completo: `+56912345678` y `+51912345678` son participantes distintos aunque
compartan los dígitos locales; `transaction.create` falla con `ALREADY_EXISTS` ante el mismo número completo,
**sin modificar ningún campo** del registro existente (incluida `crmInterest`).

### Lectura

| Función | Cambio |
|---|---|
| `listParticipants()` | `phone` pasa de 9 dígitos a **E.164 completo**; añade `crmInterest` (`data.crmInterest === true`). |
| `registerParticipant(input)` | escribe `crmInterest: input.crmInterest`. |
| `filterParticipants(rows, query)` | compara dígitos de la consulta con los dígitos del E.164. |
| CSV (`toCsv`) | columna «Celular (con código de país)» = `{prefijo} {local}`; nueva «Interesado en CRM» = `Sí`/`No`. |

## Tipos (`src/types/index.ts`)

- `Participant`: `phone` documentado como E.164 de cualquiera de los 12 prefijos; añade
  `crmInterest: boolean`.
- `ParticipantListItem`: `phone` = E.164; añade `crmInterest: boolean`.
- `ApiErrorCode`: se **elimina** `CONFIRMATION_REQUIRED`.
- `WinnerRecord.phone`: puede ser E.164 (giros nuevos) o 9 dígitos (giros y rondas anteriores, Perú); se
  muestra siempre con `formatPhoneDisplay`.
- `WheelParticipant`, `SpinResult`, `PracticeResult`: **sin cambios**; `crmInterest` nunca viaja en ellos
  (FR-105).

## Entidad nueva en código (no persistida): `Country`

```text
Country {
  code: "PE" | "AR" | "BO" | "BR" | "CL" | "CO" | "EC" | "GY" | "PY" | "SR" | "UY" | "VE"
  name: string          // «Perú», «Chile»… (es-PE)
  dial: string          // «51», «56», «591»…
  rule: { kind: "mobile9"; } | { kind: "length"; min: number; max: number }
  trunkZero: boolean    // admite un 0 inicial que se descarta
  example: string       // placeholder del campo
}
```

Vive en `src/lib/validation/countries.ts` (datos puros, sin Firebase ni React). Es la única fuente de
países para el selector, la validación y el formateo.

## Transiciones de estado

Sin cambios, salvo una: el **primer giro real** ya no pide confirmación. Sigue cerrando
`settings/registration.open` dentro de la misma transacción que crea el giro (research D-308); el modo de
práctica no escribe nada.

## Borrado definitivo

Sin cambios de código: `purgeAllParticipantData` elimina los documentos de `participants` completos
(`crmInterest` incluido) y reduce `spins`/`draws` a `{ fullName }`, de modo que ningún celular ni respuesta
del CRM queda tras la limpieza.
