# Data Model: Sorteo por premios con ruleta

Delta sobre [001 data-model.md](../001-registro-sorteo/data-model.md) y
[002 data-model.md](../002-rediseno-minimalista/data-model.md). Todo lo no mencionado aquí **no cambia**:
`participants` (ID = celular E.164, campos, unicidad), `settings/registration`, borrado definitivo y reglas
`deny all`. Almacén y acceso: Cloud Firestore solo vía Admin SDK.

## Colecciones nuevas

### `prizes/{prizeId}` — Premio

| Campo | Tipo | Notas |
|---|---|---|
| `name` | string | 2–60 caracteres, NFC, espacios colapsados, sin caracteres de control (FR-060) |
| `nameKey` | string | `name` en minúsculas; garantiza nombre único sin distinguir mayúsculas |
| `quantity` | integer | 1–100, por defecto 1 |
| `order` | integer | posición en la lista; define el siguiente «premio en juego» (FR-063) |
| `delivered` | integer ≥ 0 | unidades con ganador **activo**; mantenido en las transacciones de giro y descarte |
| `spinCount` | integer ≥ 0 | giros que alguna vez se hicieron por el premio (activos + descartados) |
| `createdAt` · `updatedAt` | timestamp | `serverTimestamp()` |

Invariantes: `0 ≤ delivered ≤ quantity`; `delivered` = nº de giros `active` con ese `prizeId`;
`spinCount` = nº de giros con ese `prizeId`. Un premio con `delivered == quantity` está «sorteado» (FR-062).
Se elimina solo con `spinCount == 0` (FR-061); `quantity` no puede quedar por debajo de `delivered`.

### `spins/{spinId}` — Giro / Ganador

| Campo | Tipo | Notas |
|---|---|---|
| `number` | integer ≥ 1 | número de ganador, consecutivo en todo el evento; un giro = un número nuevo (FR-082) |
| `prizeId` | string | referencia a `prizes/{id}`; el nombre se lee del premio, no se copia |
| `winner.fullName` | string | copia del nombre al ganar |
| `winner.company` | string | copia; **se elimina** al borrar los datos de la campaña |
| `winner.phone` | string (9 dígitos) | copia; **se elimina** al borrar los datos de la campaña |
| `status` | `"active"` \| `"discarded"` | |
| `createdAt` | timestamp | |
| `createdBy` | `{ uid, email }` | administrador que giró |
| `discardedAt` | timestamp \| null | |
| `discardedBy` | `{ uid, email }` \| null | |
| `purgedAt` | timestamp \| null | fijado por el borrado definitivo |

- El giro **no guarda el id del participante** (que es su celular): solo el snapshot `winner`. Así el
  borrado definitivo deja únicamente `winner: { fullName }` (FR-086) y no queda ningún celular en `spins`.
- El vínculo participante → giro es `participants/{phone}.drawId = spinId`.

### `settings/draw` — Contador del evento

| Campo | Tipo | Notas |
|---|---|---|
| `nextNumber` | integer ≥ 1 | próximo número de ganador; se lee e incrementa en cada giro |
| `updatedAt` | timestamp | |

Se crea de forma perezosa en el primer giro o alta de premio. Si no existe, `nextNumber` vale
**(ganadores de `draws` antiguos) + 1**. Además sirve de punto de serialización de giros, altas y
renombres de premios (ver research D-204 y D-214).

## Colecciones sin cambios de campos

- **`participants/{phoneE164}`**: `drawId` conserva su significado: `null` = elegible; distinto de `null` =
  ya ganó (giro activo o descartado, o ronda antigua). Ningún código nuevo vuelve a poner `drawId` en `null`.
- **`draws/{drawId}`** (001): **solo lectura** a partir de esta feature. Se usa para mostrar las rondas
  antiguas («Sin premio»), sembrar el contador y mantener excluidos a sus ganadores. El borrado definitivo
  sigue reduciendo sus ganadores a `{ fullName }`.
- **`settings/registration`**: los giros reales lo leen y, si estaba abierta, lo cierran (`open=false`,
  `updatedAt`, `updatedBy`) dentro de su transacción.

## Modelos de lectura (no se persisten)

### `WheelParticipant` — datos de la ruleta

| Campo | Tipo | Origen |
|---|---|---|
| `ref` | string (16 hex) | `SHA-256(id del documento).slice(0, 16)`; no revela el celular |
| `fullName` | string | `participants.fullName` |

Solo participantes con `drawId == null`, ordenados por `ref`. Nunca incluye celular ni empresa (principio IV).

### `WinnerRecord` — fila del historial

| Campo | Tipo | Origen |
|---|---|---|
| `key` | string | `spins/{id}` o `draws/{id}#posición` |
| `number` | integer | `spins.number`, o la posición calculada de las rondas antiguas |
| `prizeId` · `prizeName` | string \| null | del premio; `null` = «Sin premio» |
| `fullName` | string | `winner.fullName` |
| `company` · `phone` | string \| undefined | ausentes tras el borrado definitivo |
| `createdAt` | Date | |
| `status` | `"active"` \| `"discarded"` | las rondas antiguas son siempre `active` |
| `createdByEmail` · `discardedAt` · `discardedByEmail` | | del giro (las rondas antiguas solo traen el primero) |
| `legacy` | boolean | `true` si viene de `draws` (no se puede descartar) |

Las rondas antiguas no se pueden descartar desde la interfaz (`legacy`): no están ligadas a un premio y no
hay unidad que liberar.

### `PrizeView` — fila de la lista de premios

`Prize` + `pending = quantity − delivered` + `exhausted = pending == 0`.

## Validación (Zod, compartida entre formulario y Route Handlers)

```text
prizeSchema       : name     NFC, colapsa espacios, 2–60, sin caracteres de control
                    quantity entero 1–100 (acepta número escrito como texto en el formulario)
prizeOrderSchema  : ids      arreglo de strings no vacío, sin repetidos
spinRequestSchema : prizeId  string no vacío
                    confirmCloseRegistration  boolean opcional
(se elimina drawRequestSchema)
```

El servidor además comprueba: nombre no repetido (sin distinguir mayúsculas), `quantity ≥ delivered`, que
`prizeOrder.ids` sea exactamente el conjunto de premios existentes, y premio con unidades pendientes.

## Estados y transiciones

```text
Premio:        (inexistente) ──alta──► disponible ──giro──► delivered+1 ──(delivered==quantity)──► sorteado
                                            ▲                     │ descarte: delivered-1
                                            └─────────────────────┘
               baja solo con spinCount == 0

Giro:          (inexistente) ──giro real──► active ──descartar──► discarded   (terminal; sin reactivación)

Participante:  elegible (drawId = null) ──giro real──► ya ganó (drawId = spinId) ──descartar──► sigue fuera de la ruleta
               práctica: sin cambios
```

## Operaciones transaccionales

| Operación | Lee | Escribe |
|---|---|---|
| **Girar** (real) | `prizes/{id}`, `settings/draw`, `settings/registration`, `participants/{elegido}` | `spins/{nuevo}`; `participants/{elegido}.drawId`; `prizes/{id}.delivered+1`, `.spinCount+1`; `settings/draw.nextNumber+1`; `settings/registration.open=false` si estaba abierta (con confirmación) |
| **Descartar** | `spins/{id}`, `prizes/{prizeId}` | `spins/{id}.status/discardedAt/discardedBy`; `prizes/{prizeId}.delivered-1` |
| **Alta de premio** | `settings/draw`, premios por `nameKey` y por `order` máximo | `prizes/{nuevo}`; `settings/draw.updatedAt` |
| **Editar premio** | `prizes/{id}`, `settings/draw`, premios por `nameKey` | `prizes/{id}`; `settings/draw.updatedAt` |
| **Baja de premio** | `prizes/{id}` | borra `prizes/{id}` solo si `spinCount == 0` |
| **Reordenar** | todos los `prizes` | `order` de cada premio (lote) |
| **Práctica** | solo consulta de elegibles | **nada** |
| **Borrado definitivo** | (como en la 001) | + reduce `spins.winner` a `{ fullName }` y fija `purgedAt` |

Consultas e índices: `participants where drawId == null` (ya existente), `spins orderBy number desc`,
`prizes orderBy order asc`, `prizes where nameKey == x`. Todas de un solo campo: **no se requieren índices
compuestos nuevos** (`firestore.indexes.json` no cambia).

## Reglas de seguridad (`firestore.rules`)

Sin cambios: `allow read, write: if false` para todo el árbol, que ya cubre `prizes`, `spins` y
`settings/draw`. La prueba de `tests/rules` se amplía para exigir que `prizes`, `spins` y `settings/draw`
estén denegados (lectura, listado, escritura y borrado) para un contexto anónimo y para uno autenticado con
claim `admin`.

## Cambios en tipos (`src/types/index.ts`)

- Se eliminan `Draw`, `DrawResult` y `Winner` (de la 001); `Participant.drawId` pasa a documentarse como
  «ID del giro o de la ronda antigua en que ganó».
- Se agregan `Prize`, `PrizeView`, `Spin`, `WinnerRecord`, `WheelParticipant`, `SpinResult`
  (`{ id, number, prize: { id, name }, status, createdAt, winner: { ref, fullName } }`) y `PracticeResult`
  (`{ practice: true, winner: { ref, fullName } }`).
- `ApiErrorCode` agrega `PRIZE_EXHAUSTED`, `NO_ELIGIBLE`, `PRIZE_HAS_HISTORY`, `SPIN_NOT_ACTIVE` y
  `NOT_FOUND`. `CONFIRMATION_REQUIRED` y `DRAW_CONFLICT` se reutilizan.
