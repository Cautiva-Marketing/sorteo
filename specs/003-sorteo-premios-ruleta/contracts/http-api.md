# Contract: HTTP API y páginas (cambios de la feature 003)

Delta sobre [001 contracts/http-api.md](../../001-registro-sorteo/contracts/http-api.md) y
[002 contracts/http-api.md](../../002-rediseno-minimalista/contracts/http-api.md). Los endpoints públicos
(`/api/registrations`, `/api/status`) y la sesión (`/api/admin/session`), las inscripciones
(`/api/admin/registration`) y el listado de participantes **no cambian**. Cuerpos JSON en
`application/json; charset=utf-8`; mensajes de error en español (es-PE); formato de error común
`{ code, message, fieldErrors? }`; esquemas Zod en `src/lib/validation/schemas.ts`.

**Todos los endpoints de esta feature** exigen sesión de administrador (`requireAdminApi`: 401 sin sesión,
403 sin el claim `admin`) y, los que modifican (POST/PUT/DELETE), `assertSameOrigin` (403 `FORBIDDEN` si
`Origin` es de otro sitio).

## Códigos de error

Se **retiran** el uso de `CONFIRMATION_REQUIRED` por «ya hay sorteos» y de `DRAW_CONFLICT` en la cantidad de
ganadores; se **reutilizan** con el significado nuevo indicado abajo. Se **agregan**:

| Código | Estado | Significado |
|---|---|---|
| `PRIZE_EXHAUSTED` | 409 | el premio no tiene unidades pendientes |
| `NO_ELIGIBLE` | 409 | no hay participantes elegibles (todos ganaron/descartados o se borraron los datos) |
| `PRIZE_HAS_HISTORY` | 409 | el premio tiene ganadores (activos o descartados) y no se puede eliminar |
| `SPIN_NOT_ACTIVE` | 409 | el giro ya estaba descartado |
| `NOT_FOUND` | 404 | el premio o el giro no existe |

Se mantienen `VALIDATION_ERROR` (400), `UNAUTHORIZED`, `FORBIDDEN`, `CONFIRMATION_REQUIRED` (409: giro real con
inscripciones abiertas sin confirmación), `DRAW_CONFLICT` (409: tras 3 reintentos otro giro simultáneo se llevó
al participante elegido) e `INTERNAL_ERROR` (500, sin datos personales en logs).

---

## Eliminado

### `POST /api/admin/draws` — ejecutar un sorteo de N ganadores (001, FR-019 a FR-023)

Se elimina junto con `drawRequestSchema` (FR-091). Cualquier cliente que lo invoque recibe 404.

---

## Premios

### `POST /api/admin/prizes` — Crear premio (FR-060)

Cuerpo: `{ "name": string, "quantity"?: number }` (`prizeSchema`: nombre 2–60, cantidad entera 1–100,
por defecto 1). Respuesta `201`:

```json
{
  "id": "p1",
  "name": "Alexa",
  "quantity": 2,
  "order": 3,
  "delivered": 0,
  "spinCount": 0,
  "pending": 2,
  "exhausted": false
}
```

Errores: `400 VALIDATION_ERROR` (campos inválidos o `fieldErrors.name` = «Ya existe un premio con ese
nombre.»).

### `PUT /api/admin/prizes/{id}` — Editar premio (FR-060, FR-061)

Cuerpo: igual que el alta (ambos campos obligatorios). Respuesta `200` con el premio actualizado.

Errores: `400 VALIDATION_ERROR` (nombre repetido o `fieldErrors.quantity` = «No puede ser menor que las
unidades ya entregadas (N).»), `404 NOT_FOUND`.

### `DELETE /api/admin/prizes/{id}` — Eliminar premio (FR-061)

Respuesta `204` sin cuerpo. Errores: `404 NOT_FOUND`; `409 PRIZE_HAS_HISTORY` con el mensaje «Este premio ya
tiene ganadores y no se puede eliminar.».

### `PUT /api/admin/prizes/order` — Reordenar (FR-063)

Cuerpo: `{ "ids": ["p2", "p1", "p3"] }` con **todos** los premios existentes, sin repetidos. Respuesta `204`.
Error: `400 VALIDATION_ERROR` si la lista no coincide con los premios existentes.

Los parámetros dinámicos (`{id}`) se leen con `await params` (Next.js 16; ver research D-218).

---

## Giros

### `POST /api/admin/spins` — Girar la ruleta por un premio (FR-064, FR-065, FR-072, FR-089)

Cuerpo: `{ "prizeId": string, "confirmCloseRegistration"?: boolean }` (`spinRequestSchema`).

Efectos (una sola transacción, ver research D-204): elige un ganador al azar entre los elegibles, lo guarda
con el siguiente número, lo marca en `participants.drawId`, suma una unidad entregada al premio y, si las
inscripciones estaban abiertas y vino `confirmCloseRegistration: true`, las cierra. El ganador queda
registrado **antes** de responder. Tras cerrar las inscripciones el handler invalida la memoria del estado
público.

Respuesta `201`:

```json
{
  "id": "s-8f2a",
  "number": 4,
  "status": "active",
  "createdAt": "2026-10-22T20:15:03.120Z",
  "prize": { "id": "p1", "name": "Alexa" },
  "winner": { "ref": "9f2c41aa07b3d5e1", "fullName": "María Pérez Soto" }
}
```

`winner.ref` identifica al segmento de la ruleta (ver data-model, `WheelParticipant`). **La respuesta no
incluye celular ni empresa** (clarificación Q1 / principio IV).

| Estado | `code` | Cuándo |
|---|---|---|
| 400 | `VALIDATION_ERROR` | cuerpo inválido |
| 404 | `NOT_FOUND` | el premio no existe |
| 409 | `CONFIRMATION_REQUIRED` | las inscripciones están abiertas y no vino `confirmCloseRegistration: true`; no se gira ni se cierra nada |
| 409 | `PRIZE_EXHAUSTED` | el premio ya entregó todas sus unidades (también si otro giro simultáneo se llevó la última) |
| 409 | `NO_ELIGIBLE` | no quedan participantes elegibles |
| 409 | `DRAW_CONFLICT` | otro giro simultáneo se llevó al participante elegido 3 veces seguidas |
| 500 | `INTERNAL_ERROR` | fallo inesperado |

Idempotencia: **no** es idempotente; cada petición exitosa consume una unidad. El panel bloquea el botón
mientras hay una petición o un giro en curso.

### `POST /api/admin/spins/practice` — Giro de práctica (FR-090)

Sin cuerpo (o `{}`). **No escribe nada**: no guarda ganador ni número, no cambia premios, participantes ni
inscripciones y no exige premio. Respuesta `200`:

```json
{ "practice": true, "winner": { "ref": "9f2c41aa07b3d5e1", "fullName": "María Pérez Soto" } }
```

Errores: `409 NO_ELIGIBLE`.

### `POST /api/admin/spins/{id}/discard` — Descartar a un ganador (FR-078)

Sin cuerpo. Marca el giro como `discarded` (con quién y cuándo), devuelve la unidad al premio y mantiene al
participante fuera de la ruleta. «Volver a girar» es este endpoint seguido de `POST /api/admin/spins`.
Respuesta `200`:

```json
{ "id": "s-8f2a", "number": 4, "status": "discarded", "discardedAt": "2026-10-22T20:16:40.002Z" }
```

Errores: `404 NOT_FOUND`; `409 SPIN_NOT_ACTIVE` (ya estaba descartado).

---

## Participantes

### `GET /api/admin/participants/export` — CSV (FR-084; cambia el de la 001)

Mismo endpoint y protecciones (BOM UTF-8, coma, hora de Lima, neutralización de fórmulas). Columnas:

| # | Encabezado | Contenido |
|---|---|---|
| 1 | `Nombres` | |
| 2 | `Celular` | 9 dígitos |
| 3 | `Empresa u ocupación` | |
| 4 | `Fecha de registro` | |
| 5 | `Premio` | nombre del premio del giro; `Sin premio` para rondas antiguas; vacío si no ganó |
| 6 | `N.º de ganador` | número del giro; vacío si no ganó |
| 7 | `Estado` | `Ganador`, `Descartado` o vacío |

---

## Páginas

### `/admin/premios` (configuración de premios e historial)

Server Component protegido por `requireAdmin()`. Muestra **Premios** (alta, edición, orden y baja) e
**Historial de ganadores**. Es la pestaña «Premios» de la navegación (Participantes · Premios · Sorteo ·
Campaña). Nombres accesibles que usan las pruebas E2E:

| Elemento | Rol / nombre accesible |
|---|---|
| Título de la página | `heading` nivel 1 «Premios» |
| Lista de premios | `region` «Premios»; cada premio `listitem` con «{nombre}», «{entregadas} de {cantidad} entregadas» |
| Alta de premio | campos «Nombre del premio» y «Cantidad», botón «Agregar premio» |
| Historial | `region` «Historial de ganadores»; `listitem` por ganador con número, premio, nombre, celular, empresa, fecha y estado; botón «Descartar» en los activos |

### `/admin/sorteo` (solo la ruleta, lista para proyectar)

Server Component protegido por `requireAdmin()`. Muestra únicamente la **Ruleta**; los premios y el
historial viven en `/admin/premios`. Nombres accesibles que usan las pruebas E2E:

| Elemento | Rol / nombre accesible |
|---|---|
| Título de la página | `heading` nivel 1 «Sorteo» |
| Premio en juego | `radiogroup` «Premio en juego» con un `radio` por premio con unidades pendientes; sin premios, enlace «Configurar premios» a `/admin/premios` |
| Girar | botón «Girar para: {premio}»; deshabilitado con el motivo asociado (`aria-describedby`) |
| Modo de práctica | `checkbox` «Modo de práctica» y aviso visible «Práctica: no se guarda» |
| Pantalla completa | botón «Pantalla completa» / «Salir de pantalla completa» |
| Silenciar | botón con `aria-pressed` «Silenciar sonido» |
| Letrero del nombre | región `aria-live="polite"` «Nombre bajo el puntero» (solo anuncia el resultado final) |
| Ventana del ganador | `dialog` «¡Ganador #{n}!» con botones «Continuar» y «Volver a girar» (en práctica: «Cerrar» y distintivo «Práctica») |
| Confirmación de cierre | `dialog` «Se cerrarán las inscripciones» con «Cancelar» y «Sí, girar» |

Estados vacíos: sin premios «Aún no hay premios. Agrega el primero.» (en Premios); sin elegibles «No hay
participantes elegibles para sortear.»; sin ganadores «Aún no hay ganadores.» (en Premios).
