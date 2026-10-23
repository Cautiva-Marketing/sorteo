# Data Model: Preguntas del registro en dos pasos

Delta sobre [001](../001-registro-sorteo/data-model.md), [002](../002-rediseno-minimalista/data-model.md),
[003](../003-sorteo-premios-ruleta/data-model.md) y [004](../004-ajustes-registro-ruleta/data-model.md). Todo
lo no mencionado aquí **no cambia**: colecciones `prizes`, `spins`, `draws`, `settings/registration` y
`settings/draw`, ganadores y descartes, borrado definitivo y reglas `deny all`. Almacén y acceso: Cloud
Firestore solo vía Admin SDK. **No hay colecciones nuevas, índices nuevos ni migración de datos.**

## `participants/{phoneE164}` — Participante

| Campo | Cambio | Detalle |
|---|---|---|
| ID del documento y `phone` | — | Celular E.164 con el prefijo del país (feature 004). Sin cambios. |
| `fullName`, `company` | — | Sin cambios. |
| `trainingArea` | **nuevo** | `string`, 2–100 caracteres, espacios colapsados. «¿En qué área te gustaría capacitarte?». Documentos anteriores: ausente ⇒ `""` en toda lectura. |
| `guestSuggestion` | **nuevo** | `string`, 2–100 caracteres, espacios colapsados. «¿Qué invitado te gustaría que trajéramos a Creando Valor?». Documentos anteriores: ausente ⇒ `""`. |
| `crmInterest` | **cambia de tipo** | Antes `boolean`. Ahora `"yes" \| "maybe" \| "no"`: interés en el CRM con Agente IA de Cautiva. Documentos anteriores: `true` ⇒ `"yes"`; `false` o ausente ⇒ `"no"` (se normaliza al leer). |
| `gpsInterest` | **nuevo** | `"yes" \| "maybe" \| "no"`: interés en un GPS satelital o cámara vehicular de Satelcom. Documentos anteriores: ausente ⇒ `null` («Sin respuesta»). |
| `createdAt`, `drawId` | — | Sin cambios. |

### Reglas de validación (esquema compartido cliente/servidor)

Entrada del formulario y de `POST /api/registrations`:
`{ fullName, country, phone, company, trainingArea, guestSuggestion, crmInterest, gpsInterest }`.

1. `fullName`, `country`, `phone`, `company`: reglas de la 004, sin cambios.
2. `trainingArea` y `guestSuggestion` son **obligatorios**: se normalizan a NFC, cualquier espacio en blanco
   (incluidos saltos de línea y tabulaciones) pasa a un espacio simple y se recorta; después no puede quedar
   ningún carácter de control y el largo debe estar entre **2 y 100** (research D-404).
3. `crmInterest` y `gpsInterest` son **obligatorios** y deben ser exactamente `"yes"`, `"maybe"` o `"no"`;
   no hay valor por defecto (ninguna opción preseleccionada) y un valor ausente o distinto da error de
   validación.
4. Salida: igual que en la 004 (`phone` en E.164) más las cuatro respuestas normalizadas.

Comprobación del paso 1 (`registrationCheckSchema`): `{ country, phone }` con la misma regla de celular.

### Unicidad y concurrencia

Sin cambios: el ID del documento es el E.164 completo y `transaction.create` falla con `ALREADY_EXISTS` ante
el mismo número, **sin modificar ningún campo** del registro existente (incluidas las cuatro respuestas). La
comprobación del paso 1 solo lee; si el número se registra después de ella, el envío del paso 2 recibe el
`409` de siempre.

### Lectura

| Función | Cambio |
|---|---|
| `registerParticipant(input)` | escribe `trainingArea`, `guestSuggestion`, `crmInterest` y `gpsInterest`. |
| `checkRegistrationAvailable(phone)` | **nueva**: lee `settings/registration` y `participants/{phone}` con un `getAll`; lanza `RegistrationClosedError` o `AlreadyRegisteredError`. No escribe. |
| `listParticipants()` | devuelve `crmInterest: Interest` (normalizado) y `gpsInterest: Interest \| null`; **no** devuelve los textos libres. |
| `listParticipantsForExport()` | **nueva**: lo mismo que `listParticipants()` más `trainingArea` y `guestSuggestion`; solo la usa el CSV. |

## Tipos (`src/types/index.ts`)

- `Interest = "yes" | "maybe" | "no"` (nuevo).
- `Participant`: `crmInterest: Interest` (antes `boolean`), `gpsInterest: Interest | null`, `trainingArea:
  string`, `guestSuggestion: string`.
- `ParticipantListItem`: `crmInterest: Interest`, `gpsInterest: Interest | null`; **sin** los textos libres.
- `ParticipantExportRow` (nuevo): `ParticipantListItem` + `trainingArea: string` + `guestSuggestion: string`.
- `WheelParticipant`, `SpinResult`, `PracticeResult`, `WinnerRecord`: **sin cambios**; ninguna respuesta viaja
  en ellos (FR-132).

## Entidad nueva en código (no persistida): filtro de interés

```text
InterestFilter = "all" | "yes" | "maybe" | "no" | "none"   // "none" = sin respuesta (null)
matchesInterestFilter(value: Interest | null, filter: InterestFilter): boolean
```

Vive en `src/lib/interest.ts` (datos y funciones puras, sin Firebase ni React) junto con
`INTEREST_VALUES` y las etiquetas. Es la única fuente de textos de interés para el esquema, el formulario, la
tabla y el CSV.

## Transiciones de estado

Sin cambios en el ciclo de vida del participante (registrado → elegible → ganador/descartado). El formulario
añade un estado **solo de interfaz**: `paso 1 → paso 2 → enviado`, que no se persiste; abandonarlo o recargar
no deja ningún dato en el servidor.

## Borrado definitivo

Sin cambios de código: `purgeAllParticipantData` elimina los documentos de `participants` completos (las
cuatro respuestas incluidas) y reduce `spins`/`draws` a `{ fullName }`, de modo que ningún celular ni
respuesta queda tras la limpieza.
