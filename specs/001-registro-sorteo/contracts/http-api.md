# Contract: HTTP API (Route Handlers)

Base: mismo origen que la aplicación. Cuerpos y respuestas en JSON (`application/json; charset=utf-8`),
salvo la exportación CSV. Mensajes de error en español (es-PE). Los esquemas de entrada son los esquemas Zod
de `src/lib/validation/schemas.ts`, compartidos con el formulario.

## Formato de error común

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Revisa los campos marcados.",
  "fieldErrors": { "phone": ["Ingresa un celular peruano de 9 dígitos que empiece con 9."] }
}
```

`fieldErrors` solo aparece en `VALIDATION_ERROR`. Códigos usados: `VALIDATION_ERROR` (400),
`APP_CHECK_FAILED` (401), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `REGISTRATION_CLOSED` (403),
`ALREADY_REGISTERED` (409), `CONSENT_VERSION_MISMATCH` (409), `CONFIRMATION_REQUIRED` (409),
`REGISTRATION_OPEN` (409), `DRAW_CONFLICT` (409), `INTERNAL_ERROR` (500).

---

## Público

### `POST /api/registrations` — Registrar participante (FR-002 a FR-014, FR-028)

Encabezados: `X-Firebase-AppCheck: <token de un solo uso>` (obligatorio), `Content-Type: application/json`.

Cuerpo:

| Campo | Tipo | Regla |
|---|---|---|
| `fullName` | string | ≥ 2 términos de solo letras (con tildes), ≤ 100 caracteres |
| `phone` | string | celular peruano; acepta espacios, guiones, `+51`/`51`; se normaliza a `+51XXXXXXXXX` |
| `company` | string | 2–100 caracteres |
| `consent` | `true` | literal; cualquier otro valor es inválido |
| `consentVersion` | string | debe coincidir con la versión vigente |

Respuestas:

| Estado | `code` | Cuándo | Cuerpo |
|---|---|---|---|
| 201 | — | registro creado | `{ "status": "registered" }` |
| 400 | `VALIDATION_ERROR` | datos inválidos o consentimiento ausente | error común con `fieldErrors` |
| 401 | `APP_CHECK_FAILED` | token ausente, inválido o ya consumido | error común |
| 403 | `REGISTRATION_CLOSED` | inscripciones cerradas | error común |
| 409 | `ALREADY_REGISTERED` | el celular ya existe (cualquier formato) | error común; no devuelve datos del registro existente |
| 409 | `CONSENT_VERSION_MISMATCH` | la versión del texto no es la vigente | error común (el cliente recarga) |

Idempotencia: reenviar los mismos datos devuelve 409 `ALREADY_REGISTERED`; nunca crea un segundo documento.

---

## Administrador

Todos requieren cookie de sesión válida y claim `admin`. Sin sesión: 401 `UNAUTHORIZED`; con sesión sin claim:
403 `FORBIDDEN`. Los métodos que modifican datos además exigen `Origin` igual al host de la aplicación.

### `POST /api/admin/session` — Iniciar sesión (FR-015)

Cuerpo: `{ "idToken": "<ID token de Firebase Auth>" }`. No requiere cookie previa.
Verifica el token (`auth_time` ≤ 5 min, claim `admin === true`) y responde `204` con `Set-Cookie`
(`httpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`).
Errores: 401 `UNAUTHORIZED` (token inválido/antiguo), 403 `FORBIDDEN` (sin claim `admin`).

### `DELETE /api/admin/session` — Cerrar sesión

Responde `204` y expira la cookie.

### `PUT /api/admin/registration` — Abrir/cerrar inscripciones (FR-029)

Cuerpo: `{ "open": boolean }`. Respuesta `200`: `{ "open": boolean, "updatedAt": "<ISO-8601>" }`.

### `POST /api/admin/draws` — Ejecutar sorteo (FR-019 a FR-023)

Cuerpo:

| Campo | Tipo | Regla |
|---|---|---|
| `count` | integer | ≥ 1 y ≤ participantes elegibles |
| `confirmExisting` | boolean (opcional) | obligatorio `true` si ya existe algún sorteo |

Respuestas: `201`

```json
{
  "id": "…",
  "createdAt": "2026-10-21T20:15:00.000Z",
  "requestedCount": 3,
  "winners": [{ "fullName": "…", "company": "…", "phone": "987654321" }]
}
```

`400 VALIDATION_ERROR` (conteo fuera de rango; el mensaje indica el máximo elegible),
`409 CONFIRMATION_REQUIRED` (falta `confirmExisting`), `409 DRAW_CONFLICT` (otro sorteo simultáneo no permitió
completar tras reintentos). El resultado se persiste antes de responder; la animación del cliente es solo visual.

### `GET /api/admin/participants/export` — Exportar CSV (FR-018)

Respuesta `200`, `Content-Type: text/csv; charset=utf-8`,
`Content-Disposition: attachment; filename="participantes-AAAAMMDD.csv"`. Siempre exporta la lista completa.
Formato: BOM UTF-8, separador coma, columnas `Nombres,Celular,Empresa u ocupación,Fecha de registro`
(celular de 9 dígitos; fecha en hora de Lima `YYYY-MM-DD HH:mm:ss`); celdas de texto que empiezan con
`=`, `+`, `-`, `@`, tab o retorno se prefijan con `'`. Con 0 participantes responde igualmente el CSV con
solo la fila de encabezados (la interfaz avisa que no hay datos antes de pedirlo, US5-5).

### `DELETE /api/admin/participants` — Borrado definitivo de datos (FR-030, FR-031)

Cuerpo: `{ "confirm": "BORRAR" }` (frase literal escrita por el administrador).
Respuestas: `200 { "deletedParticipants": number }`; `409 REGISTRATION_OPEN` si las inscripciones siguen
abiertas; `400 VALIDATION_ERROR` si la frase no coincide. Operación reintentable (ver
[data-model.md](../data-model.md#transiciones-de-estado)).

---

## Páginas (contrato de interfaz)

| Ruta | Acceso | Contenido |
|---|---|---|
| `/` | público | logo + formulario, o aviso de "inscripciones cerradas"; confirmación y "ya estás participando" se muestran en la misma página sin recargar |
| `/privacidad` | público | texto completo de finalidad y política (versión = `CONSENT_VERSION`) |
| `/admin/login` | público | formulario de correo y contraseña |
| `/admin` | admin | conteo total, búsqueda, tabla paginada (50), botón exportar y actualizar |
| `/admin/sorteo` | admin | cantidad de ganadores, ejecutar con animación, historial de sorteos |
| `/admin/campana` | admin | estado de inscripciones (abrir/cerrar) y borrado de datos |

Las rutas `/admin/*` (excepto `login`) redirigen a `/admin/login` sin sesión válida; los datos nunca se envían
al navegador sin pasar por `requireAdmin()`.
