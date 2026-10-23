# Data Model: Rediseño minimalista y simplificación del registro

Delta sobre [001 data-model.md](../001-registro-sorteo/data-model.md). Todo lo no mencionado aquí **no
cambia**: colecciones `participants`, `draws` y `settings`, ID de participante = celular E.164, operaciones
transaccionales, borrado definitivo y reglas `deny all`. Almacén y acceso: Cloud Firestore solo vía Admin SDK.

## Cambios en colecciones

### `participants/{phoneE164}` — Participante

| Campo | Cambio | Notas |
|---|---|---|
| `fullName`, `phone`, `company`, `createdAt`, `drawId` | sin cambios | mismas reglas de validación (FR-003 a FR-005 de la 001) |
| `consent.acceptedAt`, `consent.version` | **se eliminan del modelo** | los documentos nuevos no los llevan (FR-033, FR-034) |

- **Documentos anteriores**: los que ya tengan el mapa `consent` siguen siendo válidos. Ningún código lo lee
  ni lo expone (el listado, el CSV y el sorteo nunca lo usaron); el borrado definitivo elimina el documento
  completo. No hay migración ni limpieza (no existen datos reales, ver Assumptions del spec).
- Ganador = `drawId != null` (sin cambios). Minimización (constitución IV): sigue habiendo solo los tres
  campos de datos personales.

### `draws/{drawId}` y `settings/registration`

Sin cambios de campos. `settings/registration.open` ahora lo consulta además el endpoint público de estado
(ver abajo); el documento sigue interpretándose como `open: true` si no existe.

## Modelos de lectura nuevos (no se persisten)

### Estado público (`PublicStatus`)

| Campo | Tipo | Origen |
|---|---|---|
| `open` | boolean | `settings/registration.open` (`true` si el documento no existe) |
| `count` | integer ≥ 0 | agregación `count()` sobre `participants` |

- Es el único dato que sale a un visitante anónimo además del formulario: un booleano y un total, **sin
  ningún dato de participantes** (FR-044).
- Lo produce `public-status.service.ts` combinando `getRegistrationStatus()` y `countParticipants()`.
- **Memoria de 1 s por instancia**: se guarda `{ value, expiresAt }` y la promesa en curso para que varias
  peticiones simultáneas compartan una sola lectura a Firestore. No es estado de negocio: si la instancia se
  reinicia, se vuelve a leer. Los Route Handlers de administrador llaman a `invalidatePublicStatus()` tras abrir o
  cerrar las inscripciones y tras el borrado definitivo, así que en esa instancia el cambio se refleja de
  inmediato; en otras instancias puede tardar hasta 1 s (dentro del límite de 5 s de SC-015). Los servicios
  `participants.service` y `registration-status.service` **no** importan `public-status.service`: la
  dependencia va solo en un sentido para evitar ciclos.

### Datos de la ventana de bienvenida (`WelcomeData`, solo en el cliente)

| Campo | Tipo | Origen |
|---|---|---|
| `fullName` | string | valor ya validado y normalizado (salida de `registrationSchema`) |
| `phone` | string (9 dígitos) | `toNational(phoneE164)` del mismo valor, mostrado con formato `987 654 321` |

No se vuelve a pedir al servidor ni se guarda: vive en el estado del formulario mientras la ventana está
abierta y desaparece al cerrarla o al elegir «Registrar a otra persona».

## Cambios en tipos (`src/types/index.ts`)

- `Participant`: se quita `consent`.
- `ApiErrorCode`: se quitan `APP_CHECK_FAILED` y `CONSENT_VERSION_MISMATCH`.
- Se agrega `PublicStatus` (`{ open: boolean; count: number }`).

## Validación (`registrationSchema`)

```text
fullName : (sin cambios)  ≥ 2 términos de solo letras, ≤ 100
phone    : (sin cambios)  celular peruano → E.164
company  : (sin cambios)  2–100 caracteres
consent / consentVersion : ELIMINADOS
```

Un cuerpo que todavía incluya `consent` o `consentVersion` (por ejemplo, un cliente en caché con el
formulario antiguo) se valida igual: Zod ignora las claves desconocidas y el servidor no las guarda.

## Relaciones y transiciones

Igual que la 001, sin el requisito de consentimiento ni de App Check para registrarse:

```text
Participante: (inexistente) ──registro──► registrado ──sorteo──► ganador ──borrado──► (eliminado)
                              requiere: inscripciones abiertas + validación
                              └─ si el celular ya existe → ALREADY_EXISTS (409), sin cambios
```

Estados de la interfaz del formulario (no persistidos): ver [research.md D-110](research.md#d-110-estados-del-formulario).

## Operaciones transaccionales

| Operación | Cambio |
|---|---|
| Registrar | la transacción sigue leyendo `settings/registration` y haciendo `create` de `participants/{phone}`; ya no valida versión de consentimiento ni escribe `consent` |
| Ejecutar sorteo · Cambiar estado · Borrado | sin cambios |
| Leer estado público | lectura simple (sin transacción) de `settings/registration` + `count()`; con memoria de 1 s |

## Reglas de seguridad (`firestore.rules`)

Sin cambios: `allow read, write: if false` para todo. La prueba de `tests/rules` sigue exigiendo que
`participants`, `draws` y `settings` estén denegados para un contexto anónimo y para uno autenticado con claim
`admin`. El endpoint público de estado no abre ninguna regla: lee con Admin SDK en el servidor.
