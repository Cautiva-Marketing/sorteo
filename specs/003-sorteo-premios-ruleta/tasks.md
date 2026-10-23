---

description: "Task list for Sorteo por premios con ruleta"
---

# Tasks: Sorteo por premios con ruleta

**Input**: Design documents from `/specs/003-sorteo-premios-ruleta/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/http-api.md, quickstart.md

**Tests**: INCLUIDAS. La constitución v2.0.0 (principio VI y puertas de calidad) exige pruebas unitarias de la
lógica del sorteo (selección criptográfica, sin repetir ganadores, solo entre registros válidos), pruebas de
reglas de Firestore y E2E. Dentro de cada historia, las pruebas se escriben primero y deben fallar antes de
implementar.

**Organization**: Tareas agrupadas por historia de usuario del spec para implementar y probar cada una por
separado. Es un cambio sobre una aplicación ya construida (features 001 y 002): muchas tareas **editan** o
**eliminan** archivos existentes. **Cero dependencias nuevas** (no se ejecuta `npm install`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia de usuario a la que pertenece (US1…US5)
- Todas las rutas son relativas a la raíz del repo (`D:\Trabajos\Cautiva Marketing\sorteo`)

## Path Conventions

Aplicación Next.js única en la raíz: `src/app`, `src/components`, `src/lib`, `src/services`, `src/types`,
`tests/{unit,integration,rules,e2e}`. Solo `src/services/**` importa `firebase` o `firebase-admin`;
`src/lib/**` es lógica pura sin Firebase ni React. **Antes de escribir código de Next.js** (`AGENTS.md`):
en los Route Handlers dinámicos `params` es una **promesa** (`const { id } = await params`; ver
`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`). Mensajes de interfaz y de
error en español (es-PE). **Sin colores literales** (`#rrggbb`, `rgb(`, `hsl(`, `oklch(`) fuera de
`src/app/globals.css`: usar clases de token (`bg-paper`, `text-ink-900`, `border-line`, `text-accent-600`…) y,
en el canvas, leer los tokens con `getComputedStyle` (transparencia con `globalAlpha`, no `rgba()`).

## Contratos de módulos (referencia para todas las tareas)

Firmas que comparten varias tareas; no cambiarlas sin actualizar las demás.

- **`src/lib/draw.ts`** (ya existe): `pickWinners(ids, count, randomInt?)`. Se agrega
  `participantRef(participantId: string): string` = `createHash("sha256").update(participantId).digest("hex").slice(0, 16)`.
- **`src/lib/wheel.ts`** (nuevo, puro, sin React ni DOM):
  - `type ColorToken = "ink-900" | "paper" | "accent-600" | "ink-600"` y
    `PALETTE: ReadonlyArray<{ background: ColorToken; text: ColorToken }>` de **6** entradas, en este orden:
    `ink-900→paper`, `paper→ink-900`, `accent-600→paper`, `paper→ink-900`, `ink-600→paper`, `paper→ink-900`.
  - `segmentColorIndexes(count: number): number[]` — `i % 6`; si `count > 2` y el último índice coincide con el
    primero, el último se reasigna a un índice distinto del anterior y del primero (nunca hay dos segmentos
    contiguos iguales, incluida la unión último-primero). `count = 1` → `[0]`; `count = 2` → `[0, 1]`.
  - Convención de ángulos (radianes): la rueda gira en sentido horario; con rotación `θ`, el punto de la rueda
    bajo el puntero (12 en punto) está en el ángulo de rueda `φ = (−θ) mod 2π`, medido en sentido horario desde
    el inicio del segmento 0; el segmento `i` ocupa `[i·arc, (i+1)·arc)` con `arc = 2π / count`.
  - `indexAtPointer(rotation: number, count: number): number` = `floor(mod(−rotation, 2π) / arc)` (en `0..count−1`).
  - `targetRotation(p: { winnerIndex: number; count: number; startRotation: number; extraTurns: number; offsetFraction: number }): number`
    — devuelve la menor rotación `θ ≥ startRotation + extraTurns·2π` tal que `−θ ≡ (winnerIndex + 0.5 + offsetFraction)·arc (mod 2π)`;
    con `offsetFraction ∈ [−0.25, 0.25]` el puntero queda **siempre dentro** del segmento ganador.
  - `labelLayout(count: number, radius: number): { fontSize: number; showLabel: boolean; firstNameOnly: boolean }` —
    `arcLength = (2π / count) · radius · 0.6`; `fontSize = min(14, arcLength · 0.7)`; `showLabel = fontSize ≥ 7`;
    `firstNameOnly = count > 20`.
  - `abbreviate(name: string, maxChars: number, firstNameOnly: boolean): string` — con `firstNameOnly` usa el
    primer término; si excede `maxChars` corta y agrega `…` (el resultado nunca supera `maxChars` caracteres).
  - `pinStep(count: number): number` — `1` si `count ≤ 50`, `2` si `≤ 100`, `5` si `> 100`.
- **`src/services/spins.service.ts`** (nuevo): `spin(input: SpinRequestInput, admin: AdminIdentity, options?: { randomInt?: RandomInt }): Promise<SpinResult>`,
  `practiceSpin(options?): Promise<PracticeResult>`, `discardSpin(spinId, admin): Promise<{ id; number; status: "discarded"; discardedAt: Date }>`,
  `listWheelParticipants(): Promise<WheelParticipant[]>`, `listWinnerRecords(): Promise<WinnerRecord[]>`,
  `getWinnerLookup(): Promise<{ bySpinId: Map<string, WinnerInfo>; byLegacyPhone: Map<string, WinnerInfo> }>` con
  `WinnerInfo = { prizeName: string | null; number: number; status: "active" | "discarded" }` (`bySpinId`: clave =
  `participants.drawId` de un giro; `byLegacyPhone`: clave = celular de 9 dígitos de un ganador de una ronda antigua,
  porque varios ganadores comparten el mismo `drawId` de la ronda). Errores de dominio exportados: `ConfirmationRequiredError`,
  `PrizeExhaustedError`, `NoEligibleError`, `DrawConflictError`, `PrizeNotFoundError`, `SpinNotFoundError`,
  `SpinNotActiveError`.
- **`src/services/prizes.service.ts`** (nuevo): `listPrizes(): Promise<PrizeView[]>`, `createPrize`, `updatePrize`,
  `deletePrize`, `reorderPrizes`. Errores: `DuplicatePrizeNameError`, `QuantityBelowDeliveredError(delivered)`,
  `PrizeHasHistoryError`, `PrizeNotFoundError` (reexportado desde un solo módulo: definirlo en
  `prizes.service.ts` y que `spins.service.ts` lo importe), `PrizeOrderMismatchError`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Punto de partida verificado. No hay dependencias ni recursos de marca nuevos.

- [X] T001 Registrar la línea base: ejecutar `npm run typecheck`, `npm run lint`, `npm run format:check` y `npm run test:unit` y anotar si algo ya falla antes de tocar código (para no atribuir esos fallos a esta feature)
- [X] T002 [P] Leer `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` (sección de parámetros dinámicos: `params` es `Promise`, `RouteContext`) y confirmar cómo tipan `params` los Route Handlers existentes en `src/app/api/**` antes de crear `[id]` en US1 y US3

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tipos, helper de referencia, esqueleto del servicio de giros y utilidades de prueba que usan varias historias.

**⚠️ CRITICAL**: Ninguna historia puede empezar hasta terminar esta fase.

- [X] T003 Agregar tipos nuevos a `src/types/index.ts` **sin quitar aún** `Draw`, `DrawResult` ni `Winner` (se retiran en T039): `Prize` (`id`, `name`, `nameKey`, `quantity`, `order`, `delivered`, `spinCount`, `createdAt: Date`, `updatedAt: Date`); `PrizeView` = `{ id, name, quantity, order, delivered, spinCount, pending, exhausted }` con `pending = quantity − delivered` y `exhausted = pending == 0`; `WheelParticipant` = `{ ref: string; fullName: string }`; `SpinResult` = `{ id, number, status: "active", createdAt: string, prize: { id, name }, winner: { ref, fullName } }`; `PracticeResult` = `{ practice: true; winner: { ref, fullName } }`; `WinnerRecord` = `{ key, number, prizeId: string | null, prizeName: string | null, fullName, company?: string, phone?: string, createdAt: Date, status: "active" | "discarded", createdByEmail: string, discardedAt: Date | null, discardedByEmail: string | null, legacy: boolean }` (`prizeName: null` = «Sin premio»; `phone` = 9 dígitos); y agregar a `ApiErrorCode` los códigos `PRIZE_EXHAUSTED`, `NO_ELIGIBLE`, `PRIZE_HAS_HISTORY`, `SPIN_NOT_ACTIVE`, `NOT_FOUND`. Actualizar el comentario de `Participant.drawId` a «`null` = elegible; ID del giro (`spins`) o de la ronda antigua (`draws`) en que ganó o fue descartado»
- [X] T004 [P] Agregar `participantRef(participantId: string): string` a `src/lib/draw.ts` (SHA-256 del id del documento, primeros 16 caracteres hexadecimales, con `createHash` de `node:crypto`) con un comentario de que oculta el celular en la lista de la ruleta (research D-207). No cambiar `pickWinners`
- [X] T005 [P] Agregar pruebas a `tests/unit/draw.test.ts`: `participantRef` devuelve 16 caracteres `[0-9a-f]`, es determinista, no contiene el celular de entrada y difiere entre dos celulares distintos
- [X] T006 Crear `src/services/spins.service.ts` (con `import "server-only"`) como esqueleto compartido: constantes `PARTICIPANTS_COLLECTION = "participants"`, `PRIZES_COLLECTION = "prizes"`, `SPINS_COLLECTION = "spins"`, `DRAWS_COLLECTION = "draws"`, `SETTINGS_COLLECTION = "settings"`, `DRAW_COUNTER_DOC = "draw"`, `REGISTRATION_DOC = "registration"`; las clases de error listadas en «Contratos de módulos» (mensajes en español: `ConfirmationRequiredError` «Se cerrarán las inscripciones al girar. Confirma para continuar.», `PrizeExhaustedError` «El premio ya no tiene unidades pendientes.», `NoEligibleError` «No hay participantes elegibles para sortear.», `DrawConflictError` «Otro giro se estaba ejecutando al mismo tiempo. Inténtalo de nuevo.», `SpinNotFoundError` «El giro no existe.», `SpinNotActiveError` «Este ganador ya estaba descartado.»); y `readLegacyWinners(): Promise<WinnerRecord[]>` que lee `draws` ordenado por `createdAt` ascendente y devuelve un `WinnerRecord` por cada elemento de `winners` con `legacy: true`, `prizeId: null`, `prizeName: null`, `status: "active"`, `key = \`${drawId}#${posición}\``, `createdByEmail` del documento, `discardedAt/By: null`, y `number` asignado **1…k en orden** (por `createdAt` y posición en el arreglo; research D-203). `company` y `phone` solo si existen en el documento (tras el borrado definitivo faltan). `PrizeNotFoundError` se importa desde `prizes.service.ts` cuando exista (hasta US1, declararlo aquí y moverlo en T014)
- [X] T007 [P] Ampliar `tests/integration/helpers.ts` con: `seedPrize(overrides?: Partial<{ name: string; quantity: number; order: number; delivered: number; spinCount: number }>): Promise<string>` (crea `prizes/{id}` con `nameKey` en minúsculas, `delivered: 0`, `spinCount: 0`, `createdAt`/`updatedAt`; devuelve el id); `seedLegacyDraw(winnerPhones: string[], options?: { createdAt?: Date }): Promise<string>` (crea `draws/{id}` con `requestedCount`, `createdBy`, `winners` con `{ fullName, company, phone }` en 9 dígitos tomados de `participants`, `purgedAt: null`, y pone `drawId` en esos participantes); y `snapshotCollections(names: string[]): Promise<Record<string, unknown>>` (lee y serializa las colecciones para comparar antes/después)
- [X] T008 [P] Ampliar `tests/e2e/helpers/emulators.ts` con `seedPrize({ name, quantity, order })` usando el mismo mecanismo REST que `seedParticipants` (documento `prizes/{id}` con `nameKey`, `quantity`, `order`, `delivered: 0`, `spinCount: 0`, `createdAt`, `updatedAt`) y con la limpieza de `resetFirestore` cubriendo las colecciones nuevas
- [X] T009 [P] Ampliar `tests/rules/firestore.rules.test.ts`: sembrar `prizes/premio-1`, `spins/giro-1` y `settings/draw` en `beforeEach` (con las reglas desactivadas) y agregar a la tabla de colecciones `{ collection: "prizes", existingDoc: "premio-1", newDoc: "premio-nuevo" }` y `{ collection: "spins", existingDoc: "giro-1", newDoc: "giro-nuevo" }`, más una comprobación de que `settings/draw` está denegado; mantener que anónimo y administrador autenticado no pueden leer, listar, crear, actualizar ni borrar. `firestore.rules` **no cambia**

**Checkpoint**: Foundation ready — las historias pueden empezar (US1 y US2 pueden avanzar en paralelo hasta la integración en la página, T019/T037).

---

## Phase 3: User Story 1 - Gestionar la lista de premios (Priority: P1) 🎯 MVP

**Goal**: El administrador crea, edita, ordena y elimina premios (nombre + unidades) y ve las unidades entregadas/pendientes (FR-060 a FR-063).

**Independent Test**: En `/admin/sorteo`, crear tres premios con distintas cantidades, reordenarlos, editar uno, eliminar otro y comprobar que la lista y «N de M entregadas» se conservan tras recargar; un nombre repetido o una cantidad 0 se rechazan junto al campo.

### Tests for User Story 1 ⚠️ (escribir primero; deben fallar)

- [X] T010 [P] [US1] Agregar pruebas a `tests/unit/schemas.test.ts` para `prizeSchema` y `prizeOrderSchema`: nombre `"  Box   de bienvenida "` → `"Box de bienvenida"`; nombre de 1 carácter y de 61 → error; nombre con carácter de control → error; `quantity` omitida → 1; `quantity` 0, 101, 1.5 y `"abc"` → error; `quantity: "3"` (texto del formulario) → 3; `prizeOrderSchema` rechaza `ids` vacío y repetidos y acepta `["a","b"]`
- [X] T011 [P] [US1] Crear `tests/integration/prizes.test.ts` (patrón de `tests/integration/draws.test.ts`: `vi.setConfig` de timeouts, `clearFirestore` en `beforeEach`): alta guarda `nameKey` en minúsculas, `order` = máximo + 1, `delivered: 0`, `spinCount: 0`; nombre repetido sin distinguir mayúsculas («alexa» vs «Alexa») → `DuplicatePrizeNameError`; **dos altas simultáneas** del mismo nombre (`Promise.all`) → exactamente una creada; editar nombre y cantidad; `quantity` menor que `delivered` (premio sembrado con `delivered: 2`) → `QuantityBelowDeliveredError`; renombrar a un nombre existente → error y renombrar a su propio nombre → permitido; eliminar con `spinCount: 0` → se borra; eliminar con `spinCount: 1` → `PrizeHasHistoryError`; eliminar inexistente → `PrizeNotFoundError`; `reorderPrizes` con todos los ids reescribe `order = índice`, con ids faltantes/sobrantes/repetidos → `PrizeOrderMismatchError`; `listPrizes` devuelve `pending` y `exhausted` y ordena por `order`
- [X] T012 [P] [US1] Ampliar `tests/integration/admin-routes-auth.test.ts` con las filas de `POST /api/admin/prizes`, `PUT /api/admin/prizes/{id}`, `DELETE /api/admin/prizes/{id}` y `PUT /api/admin/prizes/order` siguiendo la tabla existente: 401 sin sesión, 403 con sesión sin claim `admin`, 403 con `Origin` de otro sitio (para `[id]` pasar `{ params: Promise.resolve({ id: "x" }) }`)

### Implementation for User Story 1

- [X] T013 [US1] Agregar a `src/lib/validation/schemas.ts` (sin tocar aún `drawRequestSchema`): constantes `PRIZE_NAME_MIN = 2`, `PRIZE_NAME_MAX = 60`, `PRIZE_QUANTITY_MIN = 1`, `PRIZE_QUANTITY_MAX = 100`; `prizeSchema = z.object({ name, quantity })` donde `name` se normaliza a NFC, colapsa espacios y exige **2–60 caracteres sin caracteres de control** (mensajes: «Ingresa el nombre del premio.», «El nombre debe tener entre 2 y 60 caracteres.», «El nombre no puede contener caracteres especiales de control.») y `quantity` es entero **1–100, por defecto 1**, aceptando el texto numérico del formulario (mensaje: «Ingresa una cantidad entera entre 1 y 100.»); `prizeOrderSchema = z.object({ ids: z.array(z.string().min(1)).min(1) })` con `ids` sin repetidos («La lista de premios no es válida.»); exportar `PrizeInput` (salida) y `PrizeFormInput` (entrada)
- [X] T014 [US1] Crear `src/services/prizes.service.ts` (con `import "server-only"`): `listPrizes()` (`orderBy("order")` → `PrizeView[]`); `createPrize(input, adminUid)` en **una transacción** que lee y escribe `settings/draw` (`{ updatedAt }` con `merge`) para serializar altas, consulta `prizes where nameKey == key` (`key` = nombre en minúsculas) → `DuplicatePrizeNameError` («Ya existe un premio con ese nombre.») y calcula `order = máximo + 1`; guarda `name`, `nameKey`, `quantity`, `order`, `delivered: 0`, `spinCount: 0`, `createdAt`/`updatedAt` con `serverTimestamp`; `updatePrize(id, input)` (misma serialización; `PrizeNotFoundError`; permite conservar su propio nombre; `quantity < delivered` → `QuantityBelowDeliveredError(delivered)` con mensaje «No puede ser menor que las unidades ya entregadas (N).»); `deletePrize(id)` (transacción: `PrizeNotFoundError`; `spinCount > 0` → `PrizeHasHistoryError` «Este premio ya tiene ganadores y no se puede eliminar.»); `reorderPrizes(ids)` (lee todos los premios, exige que `ids` sea **exactamente** el conjunto existente sin repetidos → si no, `PrizeOrderMismatchError`; escribe `order = índice` con un lote). Mover aquí `PrizeNotFoundError` («El premio no existe.») y que `spins.service.ts` lo importe (corrige T006)
- [X] T015 [P] [US1] Crear `src/app/api/admin/prizes/route.ts` con `POST`: `assertSameOrigin` → `requireAdminApi` → JSON → `prizeSchema.safeParse` (400 `VALIDATION_ERROR` con `zodToFieldErrors`) → `createPrize`; `DuplicatePrizeNameError` → 400 `VALIDATION_ERROR` con `fieldErrors.name`; éxito `201` con `{ id, name, quantity, order, delivered, pending }` (formato de `contracts/http-api.md`); errores no previstos: 500 `INTERNAL_ERROR` registrando solo `error.name`
- [X] T016 [P] [US1] Crear `src/app/api/admin/prizes/[id]/route.ts` con `PUT` (mismo cuerpo que el alta; `200` con el premio; `QuantityBelowDeliveredError` → 400 con `fieldErrors.quantity`; nombre repetido → 400 con `fieldErrors.name`; `PrizeNotFoundError` → 404 `NOT_FOUND`) y `DELETE` (`204`; `PrizeNotFoundError` → 404; `PrizeHasHistoryError` → 409 `PRIZE_HAS_HISTORY`), con la firma `{ params }: { params: Promise<{ id: string }> }` y `const { id } = await params`
- [X] T017 [P] [US1] Crear `src/app/api/admin/prizes/order/route.ts` con `PUT`: valida `prizeOrderSchema`, llama a `reorderPrizes`, responde `204`; `PrizeOrderMismatchError` → 400 `VALIDATION_ERROR` «La lista de premios no coincide con los premios existentes.»
- [X] T018 [US1] Crear `src/components/admin/PrizePanel.tsx` (cliente, `"use client"`): sección `aria-labelledby` con `<h2>` «Premios» (`region` accesible «Premios»); formulario de alta con `react-hook-form` + `zodResolver(prizeSchema)` y campos «Nombre del premio» y «Cantidad» (usar `TextField`) y botón «Agregar premio»; lista (`<ul>`) donde cada `<li>` muestra «{nombre}» y «{entregadas} de {cantidad} entregadas» (+ «Sorteado» si `exhausted`), con botones «Editar» (edición en línea de nombre y cantidad con los mismos campos y «Guardar»/«Cancelar»), «Subir» y «Bajar» (deshabilitados en los extremos; llaman a `PUT /api/admin/prizes/order` con la lista completa) y «Eliminar» (con `Dialog` de confirmación «¿Eliminar el premio “{nombre}”?»; deshabilitado con motivo si `spinCount > 0`: «Ya tiene ganadores»); usar `adminFetch` de `src/lib/admin-fetch.ts`; errores de campo desde `fieldErrors` del 400 con `setError`, error general con `Alert variant="error"`; `router.refresh()` dentro de `startTransition` tras cada cambio; estado vacío «Aún no hay premios. Agrega el primero.»; clases solo de tokens. Props: `{ prizes: PrizeView[] }`
- [X] T019 [US1] Editar `src/app/admin/(panel)/sorteo/page.tsx`: leer también `listPrizes()` en el `Promise.all` y renderizar `<PrizePanel prizes={prizes} />` entre `DrawPanel` y `DrawHistory` (se reordena en T037); no tocar aún el resto
- [X] T020 [US1] Crear `tests/e2e/prizes.spec.ts` (patrón de `tests/e2e/draw.spec.ts`: `createAdminUser`, `resetFirestore`, `loginAsAdmin`): crear «Alexa» (2), «Box» (1) y «Termo» (1) verificando «0 de 2 entregadas»; nombre repetido muestra «Ya existe un premio con ese nombre.»; cantidad 0 muestra el error junto al campo; «Subir/Bajar» cambian el orden y se conserva tras recargar; editar el nombre y la cantidad; eliminar un premio con confirmación; un premio sembrado con `spinCount: 1` tiene «Eliminar» deshabilitado

**Checkpoint**: US1 funcional y verificable por sí sola (junto con el sorteo antiguo todavía presente en la página).

---

## Phase 4: User Story 2 - Girar la ruleta por un premio (Priority: P1) 🎯 MVP

**Goal**: Elegir el premio en juego y girar una ruleta con un segmento por participante elegible; el servidor decide y guarda al ganador antes de la animación; ventana «¡Ganador #N!» con confeti y melodía; modo de práctica; cierre de inscripciones al primer giro real; historial básico (FR-064 a FR-077, FR-082, FR-085, FR-088 a FR-091).

**Independent Test**: Con varios participantes y un premio, girar una vez: la ruleta se detiene en el nombre registrado como ganador, aparece la ventana con premio y nombre (sin celular) y, tras recargar, el ganador sigue en el historial con su celular. Con inscripciones abiertas, el primer giro pide confirmación; el modo de práctica no deja ningún rastro.

### Tests for User Story 2 ⚠️ (escribir primero; deben fallar)

- [X] T021 [P] [US2] Crear `tests/unit/wheel.test.ts` para `src/lib/wheel.ts` según «Contratos de módulos»: `segmentColorIndexes` para `count` 1, 2, 3, 6, 7, 13, 50, 500 y 5 000 (longitud correcta, valores en `0..5`, **ningún par contiguo igual** incluido el último con el primero cuando `count > 2`); `indexAtPointer` en rotaciones 0, justo antes y justo después de cada borde de segmento y con rotaciones negativas o mayores que 2π; **propiedad**: para `count` en {1, 2, 3, 10, 150, 500, 5 000}, todo `winnerIndex`, `extraTurns` en {6, 7, 8}, `startRotation` aleatoria y `offsetFraction` en {−0.25, −0.1, 0, 0.1, 0.25}, `indexAtPointer(targetRotation(...), count) === winnerIndex` y `targetRotation ≥ startRotation + extraTurns·2π`; `labelLayout`: con 500 y radio 260 `showLabel` es `false`, con 10 es `true` y `firstNameOnly` es `false`, con 21 `firstNameOnly` es `true`; `abbreviate("María Pérez Soto", 8, false)` ≤ 8 caracteres y termina en `…`, `abbreviate("María Pérez Soto", 20, true)` → `"María"`; `pinStep` en 50, 51, 100, 101
- [X] T022 [P] [US2] Ampliar `tests/unit/draw.test.ts`: simular 1 000 giros sucesivos con `pickWinners(ids, 1)` sobre 1 000 ids quitando al ganador cada vez → ningún id se repite y se agotan todos; con `randomInt` inyectado que siempre devuelve `min` el ganador es el primero del arreglo
- [X] T023 [P] [US2] Ampliar `tests/unit/schemas.test.ts` con `spinRequestSchema`: `{ prizeId: "p1" }` válido; `prizeId` vacío o ausente → error; `confirmCloseRegistration` no booleano → error; `confirmCloseRegistration: true` válido
- [X] T024 [P] [US2] Crear `tests/integration/spins.test.ts` (mismos preparativos que `draws.test.ts`; admin de prueba `{ uid: "admin-uid-1", email: "admin@example.com" }`; `seedRegistrationStatus(false)` salvo donde se indique): (a) `spin` con 10 participantes y un premio de 2 unidades escribe `spins/{id}` con `number: 1`, `status: "active"`, `prizeId`, `winner.{fullName, company, phone}` (celular de **9 dígitos**), `createdBy`, `discardedAt: null`, `purgedAt: null`; pone `participants.drawId = spinId` solo en el ganador; deja `prizes.delivered = 1` y `spinCount = 1`; deja `settings/draw.nextNumber = 2`; (b) el resultado devuelto contiene `winner.ref === participantRef(celular E.164)` y **no** contiene celular ni empresa; (c) giros sucesivos numeran 1, 2, 3 y excluyen a los ganadores previos; (d) con `draws` antiguos sembrados (`seedLegacyDraw` con 3 ganadores) el primer giro nuevo recibe `number: 4`, y esos 3 siguen sin salir; (e) premio con `delivered == quantity` → `PrizeExhaustedError` sin cambios; premio inexistente → `PrizeNotFoundError`; sin elegibles → `NoEligibleError`; (f) **concurrencia**: 5 participantes y un premio de **1** unidad, `Promise.all` de dos `spin` → exactamente uno resuelve y el otro lanza `PrizeExhaustedError`, y queda un solo giro; con premio de 2 unidades y 3 giros simultáneos → 2 éxitos con números distintos y 1 `PrizeExhaustedError`; (g) **reintento**: con `randomInt` inyectado que fuerza a dos giros simultáneos a elegir a la misma persona, ambos terminan con ganadores distintos o uno lanza `PrizeExhaustedError`, nunca la misma persona dos veces; (h) **inscripciones**: con `open: true` (o sin documento) y sin confirmación → `ConfirmationRequiredError` y **nada cambia** (sin giro, `open` sigue `true`); con `confirmCloseRegistration: true` → gira y `settings/registration.open === false` con `updatedBy`; con inscripciones ya cerradas no se exige confirmación; (i) `practiceSpin` devuelve `{ practice: true, winner: { ref, fullName } }` y `snapshotCollections(["participants","prizes","spins","settings"])` es **idéntico antes y después** de varios giros de práctica, incluso con inscripciones abiertas; sin elegibles → `NoEligibleError`; (j) `listWheelParticipants` devuelve solo elegibles como `{ ref, fullName }` ordenados por `ref`, sin otros campos; (k) `listWinnerRecords` devuelve los giros ordenados por `number` descendente con `legacy: false`
- [X] T025 [P] [US2] Crear `tests/integration/spins.route.test.ts` (patrón de `tests/integration/registrations.route.test.ts` y `admin-routes-auth.test.ts`, con cookie de sesión de `helpers.ts`): `POST /api/admin/spins` con cuerpo válido → 201 con `id`, `number`, `status`, `createdAt`, `prize`, `winner.{ref, fullName}` y **sin** `phone` ni `company` en ninguna parte del JSON; cuerpo inválido → 400; inscripciones abiertas sin confirmación → 409 `CONFIRMATION_REQUIRED`; premio agotado → 409 `PRIZE_EXHAUSTED`; sin elegibles → 409 `NO_ELIGIBLE`; premio inexistente → 404 `NOT_FOUND`; tras cerrar las inscripciones, `GET /api/status` (con `invalidatePublicStatus` llamado por el handler) devuelve `open: false`; `POST /api/admin/spins/practice` → 200 sin escrituras y 409 sin elegibles; agregar filas de 401/403/`Origin` para ambas rutas a `tests/integration/admin-routes-auth.test.ts`

### Implementation for User Story 2

- [X] T026 [US2] Agregar `spinRequestSchema = z.object({ prizeId: z.string({ error: "Elige un premio." }).min(1, "Elige un premio."), confirmCloseRegistration: z.boolean({ error: "La confirmación no es válida." }).optional() })` y su tipo `SpinRequestInput` a `src/lib/validation/schemas.ts` (sin quitar aún `drawRequestSchema`)
- [X] T027 [P] [US2] Crear `src/lib/wheel.ts` implementando **exactamente** las firmas de «Contratos de módulos» (paleta de 6 con el orden indicado, `segmentColorIndexes`, `indexAtPointer`, `targetRotation`, `labelLayout`, `abbreviate`, `pinStep`), sin importar React, DOM ni Firebase; documentar con comentarios breves la convención de ángulos (research D-209 a D-211) para que T021 pase
- [X] T028 [P] [US2] Crear `src/lib/victory-sound.ts` (solo cliente): `primeAudio(): void` crea o reanuda un `AudioContext` (llamarla en el clic de «Girar»), `playVictory(): void` reproduce un arpegio ascendente de ondas seno (E3, E4, G4, B4, D5, E5, G5, B5; entradas separadas ~0,09 s, 2,2–3 s de duración cada una) con un filtro paso bajo a 1 100 Hz y volumen maestro 0,25 (research D-212), `getMuted(): boolean` y `setMuted(value: boolean): void` con `localStorage` bajo la clave `sorteo:silencio`. **Toda** lectura/escritura de `localStorage` y toda llamada de Web Audio va en `try/catch`: si falla, no se lanza ni se muestra error. `playVictory` no suena si `getMuted()`
- [X] T029 [P] [US2] Editar `src/components/ui/Confetti.tsx`: agregar props opcionales `pieces?: number` (por defecto `28`, que mantiene el confeti de bienvenida idéntico) y `accent?: boolean` (si es `true`, agrega `"bg-accent-600"` a las clases de pieza alternadas); mantener `data-confetti`, `aria-hidden`, `motion-reduce:hidden` y el posicionamiento determinista sin `Math.random`. La ventana del ganador la usará con `pieces={60}` y `accent`
- [X] T030 [US2] Implementar en `src/services/spins.service.ts` (sobre el esqueleto de T006): `listWheelParticipants()` (consulta `participants where drawId == null` con `.select("fullName")` → `{ ref: participantRef(doc.id), fullName }`, ordenados por `ref`); `practiceSpin(options)` (lista ids elegibles, `NoEligibleError` si no hay, `pickWinners(ids, 1, options.randomInt)`, lee **solo** el nombre del elegido y devuelve `{ practice: true, winner }`; **ninguna escritura**); `spin(input, admin, options)` según research D-204/D-205: lista elegibles (`NoEligibleError` si 0), elige con `pickWinners(ids, 1, options.randomInt)` y abre **una transacción** que lee `prizes/{id}` (`PrizeNotFoundError`; `delivered >= quantity` → `PrizeExhaustedError`), `settings/draw`, `settings/registration` y `participants/{elegido}` (si no existe o `drawId !== null` → `StaleWinnerError` interno y reintento hasta **3** veces; luego `DrawConflictError`); si `settings/registration.open !== false` (o no existe) y no vino `confirmCloseRegistration: true` → `ConfirmationRequiredError`; calcula `number` = `settings/draw.nextNumber` o, si no existe, `legacy winners + 1` (leyendo `draws` dentro de la transacción); escribe `spins/{nuevo}` con `number`, `prizeId`, `winner: { fullName, company, phone (9 dígitos con toNational) }`, `status: "active"`, `createdAt: serverTimestamp()`, `createdBy: { uid, email }`, `discardedAt: null`, `discardedBy: null`, `purgedAt: null`; `participants/{elegido}.drawId = spinId`; `prizes/{id}.delivered + 1`, `.spinCount + 1`, `.updatedAt`; `settings/draw = { nextNumber: number + 1, updatedAt }`; y si estaba abierta, `settings/registration = { open: false, updatedAt, updatedBy: admin.uid }` con `merge`. Devuelve `SpinResult` con `winner: { ref, fullName }` y **sin celular ni empresa**. `listWinnerRecords()` (base): lee `spins` ordenado por `number` descendente → `WinnerRecord[]` con `legacy: false`, `prizeName` leído de `prizes` por `prizeId`, `createdByEmail`, `discardedAt`, `discardedByEmail` (la unión con `draws` antiguos se agrega en T055)
- [X] T031 [US2] Crear `src/app/api/admin/spins/route.ts` con `POST`: `assertSameOrigin` → `requireAdminApi` → JSON → `spinRequestSchema` (400) → `spin`; responder `201` con el `SpinResult` (`createdAt` en ISO); mapear `PrizeNotFoundError` → 404 `NOT_FOUND`, `ConfirmationRequiredError` → 409 `CONFIRMATION_REQUIRED`, `PrizeExhaustedError` → 409 `PRIZE_EXHAUSTED`, `NoEligibleError` → 409 `NO_ELIGIBLE`, `DrawConflictError` → 409 `DRAW_CONFLICT`; tras un giro que cerró las inscripciones llamar a `invalidatePublicStatus()` de `src/services/public-status.service.ts` (llamarlo siempre tras un 201 es aceptable); `export const maxDuration = 60`; 500 `INTERNAL_ERROR` registrando solo `error.name`
- [X] T032 [P] [US2] Crear `src/app/api/admin/spins/practice/route.ts` con `POST` (sin cuerpo obligatorio): mismas comprobaciones de origen y sesión; `practiceSpin()` → `200` con `{ practice: true, winner }`; `NoEligibleError` → 409 `NO_ELIGIBLE`; `maxDuration = 60`
- [X] T033 [US2] Crear `src/components/admin/RouletteWheel.tsx` (cliente) con `forwardRef`/`useImperativeHandle` o props equivalentes. Props: `participants: WheelParticipant[]`, `size: number` (lado del canvas en px CSS), `spinTarget: { winnerRef: string; key: number; instant: boolean } | null` (un cambio de `key` inicia un giro; `instant` = reducir movimiento o ganador fuera de la lista), `onPointerName(name: string)` y `onSpinEnd(winnerRef: string)`. Comportamiento (research D-209 a D-211): (1) **leer los tokens** `ink-900`, `paper`, `accent-600`, `ink-600`, `line` con `getComputedStyle(document.documentElement).getPropertyValue("--color-…")` al montar (nunca literales); (2) **prerenderizar** la rueda en un canvas fuera de pantalla (segmentos con `segmentColorIndexes`/`PALETTE`, divisores finos con el token `line`, texto radial de adentro hacia afuera con `labelLayout`/`abbreviate`, fuente `font-sans` del documento, texto del token `text` de la paleta, sin texto si `showLabel` es falso; para `count = 1` un disco completo) y volver a prerenderizar solo si cambia la lista o `size` (resolución `min(devicePixelRatio, 3)`); (3) cada fotograma de `requestAnimationFrame` dibuja la rueda rotada con `drawImage` más una capa estática: aro exterior `ink-900` con anillo fino `paper`, pines pequeños cada `pinStep(count)` segmentos, buje central con disco `paper` y borde fino (el logo `icono-ti.webp` se superpone con un `<img>` centrado de ~27 % del tamaño, `aria-hidden`) y puntero triangular fijo arriba en `accent-600`; **sin sombras difusas ni degradados**; (4) giro: duración **6 500 ms**, desaceleración `1 − (1 − p)^4`, `extraTurns = 6 + Math.floor(Math.random() * 3)`, `offsetFraction = (Math.random() − 0.5) · 0.5`, rotación final con `targetRotation({ winnerIndex, count, startRotation: rotación actual, extraTurns, offsetFraction })`; cada ~60 ms llama `onPointerName(participants[indexAtPointer(rotation, count)].fullName)`; al terminar fija el nombre del ganador y llama `onSpinEnd`; (5) si `reducedMotion` o el `winnerRef` no está en `participants`, **no anima**: llama `onSpinEnd` de inmediato; (6) cancelar el `requestAnimationFrame` al desmontar; (7) `<canvas aria-hidden="true">` (la información se anuncia por el letrero del padre)
- [X] T034 [US2] Crear `src/components/admin/WinnerDialog.tsx` (cliente) sobre `Dialog` de `src/components/ui/Dialog.tsx` (`centered`). Props: `open`, `number: number`, `prizeName: string`, `winnerName: string`, `practice: boolean`, `onContinue(): void`. Título `¡Ganador #${number}!` (en práctica, `Práctica` como distintivo visible arriba del título y el título `¡Ganador de práctica!`); cuerpo con el nombre del premio y el **nombre completo** del ganador en `font-display` grande que se ajusta en varias líneas (`break-words`) sin desbordar hasta 100 caracteres; **no mostrar celular ni empresa**; `<Confetti pieces={60} accent />` también en práctica (`Confetti` ya se oculta con `motion-reduce`, FR-077); un botón «Continuar» (en práctica «Cerrar») que llama `onContinue`; `onClose` del `Dialog` (Escape) también llama `onContinue`. El botón «Volver a girar» se agrega en T045
- [X] T035 [US2] Crear `src/components/admin/DrawStage.tsx` (cliente). Props: `{ prizes: PrizeView[]; participants: WheelParticipant[]; registrationOpen: boolean }`. Estado: premio en juego (por defecto el **primer** premio, por `order`, con `pending > 0`; `radiogroup` «Premio en juego» con un `radio` por premio con unidades pendientes), `practice` (checkbox «Modo de práctica» + aviso visible «Práctica: no se guarda» cuando está activo), `muted` (inicializar con `getMuted()` en un efecto; botón con `aria-pressed` «Silenciar sonido»), fase `idle | confirming | requesting | spinning | result`, `pointerName`, `result`. Flujo: botón **«Girar para: {premio}»** (en práctica, «Girar (práctica)») **deshabilitado con el motivo asociado por `aria-describedby`** si no hay premio seleccionado («Elige un premio»), el premio no tiene unidades («Este premio ya no tiene unidades pendientes») o no hay elegibles («No hay participantes elegibles para sortear.»; en práctica no se exige premio) y mientras la fase no sea `idle` (FR-072); al pulsar llama `primeAudio()`; si es giro real y `registrationOpen`, abre un `Dialog` «Se cerrarán las inscripciones» con «Cancelar» y «Sí, girar» (cancelar no llama al servidor); luego `adminFetch("/api/admin/spins" | "/api/admin/spins/practice", POST)` con `{ prizeId, confirmCloseRegistration: true }` cuando corresponda; mapear errores a mensajes (`PRIZE_EXHAUSTED` «El premio ya no tiene unidades pendientes.», `NO_ELIGIBLE`, `DRAW_CONFLICT`, `CONFIRMATION_REQUIRED` → abrir la confirmación, 403, red) mostrados con `Alert variant="error"` y refrescar con `router.refresh()`; con 201/200 evaluar `window.matchMedia("(prefers-reduced-motion: reduce)").matches` **en ese momento** y pasar `spinTarget` a `RouletteWheel`; el **letrero** debajo/encima de la rueda es una región `aria-live="polite"` con nombre «Nombre bajo el puntero» que muestra `pointerName` visualmente durante el giro pero **solo anuncia el resultado final** (usar un nodo visual `aria-hidden` para los cambios rápidos y otro nodo `sr-only` con el nombre del ganador al terminar); al terminar (`onSpinEnd`) → `playVictory()` (suena también con reducción de movimiento, salvo que esté silenciado) y abrir `WinnerDialog`; «Continuar» cierra la ventana, vuelve a `idle` y llama `router.refresh()` en `startTransition` (la rueda recibe la lista nueva). Si el `winnerRef` no está en `participants` (lista desactualizada), abrir la ventana sin animar y refrescar. Estados vacíos: sin premios «Aún no hay premios. Agrega el primero.»; sin elegibles el aviso del botón. Mostrar «Participantes elegibles: N»
- [X] T036 [P] [US2] Crear `src/components/admin/WinnerHistory.tsx` (Server Component, sin estado): `region` «Historial de ganadores» con `<h2>`; `<ol>` de `WinnerRecord[]` (ya ordenado por número descendente) donde cada `<li>` muestra `#número`, premio (o «Sin premio» si `prizeName` es `null`), nombre completo, celular y empresa **solo si existen**, fecha con `formatLimaDateTime` de `src/lib/format.ts`, «Realizado por: {correo}» y estado «Ganador» o «Descartado» (con quién y cuándo si fue descartado); estado vacío «Aún no hay ganadores.»; clases solo de tokens. El botón «Descartar» se agrega en US3
- [X] T037 [US2] Reescribir `src/app/admin/(panel)/sorteo/page.tsx`: tras `requireAdmin()`, leer en paralelo `listPrizes()`, `listWheelParticipants()`, `getRegistrationStatus()` (de `src/services/registration-status.service.ts`) y `listWinnerRecords()`; renderizar en este orden `<h1>` «Sorteo» → sección **Ruleta** (`<DrawStage prizes participants registrationOpen={status.open} />`) → `<PrizePanel prizes />` → `<WinnerHistory records />`; quitar `DrawPanel`, `DrawHistory` y `countEligible`/`listDraws` de los imports
- [X] T038 [US2] Eliminar lo reemplazado: `src/components/admin/DrawPanel.tsx`, `src/components/admin/DrawAnimation.tsx`, `src/components/admin/DrawHistory.tsx`, `src/app/api/admin/draws/route.ts` (el directorio queda vacío: eliminarlo; la ruta responde 404), `src/services/draws.service.ts`, `tests/integration/draws.test.ts`, y de `src/lib/validation/schemas.ts` quitar `drawRequestSchema` y `DrawRequestInput` (y sus pruebas en `tests/unit/schemas.test.ts`). Buscar con Grep `executeDraw|draws.service|DrawPanel|DrawHistory|DrawAnimation|drawRequestSchema|countEligible|listDraws` en `src/` y `tests/` hasta que no queden referencias
- [X] T039 [US2] Quitar de `src/types/index.ts` `Draw`, `DrawResult` y `Winner`, y actualizar las pruebas que dependían de `executeDraw`: en `tests/integration/purge.test.ts` reemplazar cada `executeDraw(...)` por `seedLegacyDraw(...)` de `tests/integration/helpers.ts` (sembrando participantes antes) y adaptar las aserciones que usaban `draw.winners`/`draw.id` al valor devuelto por el helper; en `tests/integration/volume.test.ts` reemplazar el caso de `executeDraw({ count: 50 })` por 50 llamadas sucesivas a `spin` sobre un premio de 50 unidades que terminan sin ganadores repetidos y dentro del tiempo ya medido por `timed`; quitar la fila de `POST /api/admin/draws` de `tests/integration/admin-routes-auth.test.ts` (y añadir una comprobación de que `src/app/api/admin/draws/route.ts` ya no existe); revisar `tests/integration/participants.list.test.ts`, `legacy-consent.test.ts`, `registrations.route.test.ts` y `status.route.test.ts` por referencias a `draws.service`. Ejecutar `npm run typecheck` hasta que quede en verde
- [X] T040 [US2] Reescribir `tests/e2e/draw.spec.ts` (patrón del archivo anterior: `test.setTimeout(120_000)`, `createAdminUser`, `resetFirestore`, `seedParticipants(10)`, `seedPrize`): (a) sin premios el panel muestra «Aún no hay premios. Agrega el primero.» y «Girar» está deshabilitado con motivo; (b) con un premio, «Girar para: {premio}» abre la confirmación «Se cerrarán las inscripciones»; «Cancelar» no gira; «Sí, girar» gira, aparece `dialog` «¡Ganador #1!» con el premio y el nombre y **sin** un celular de 9 dígitos, y tras «Continuar» el historial muestra al ganador #1 con su celular y «Ganador», y el premio «1 de N entregadas»; (c) recargar conserva el historial; (d) abrir `/registro` tras el giro muestra «inscripciones cerradas»; (e) **modo de práctica**: marcar «Modo de práctica», girar, ventana «Práctica» con solo «Cerrar», sin confirmación de cierre y sin cambios en el historial ni en las unidades; (f) con `page.emulateMedia({ reducedMotion: "reduce" })` el diálogo aparece sin esperar el giro (< 2 s) y no hay `[data-confetti]` visible; (g) con 0 elegibles el botón queda deshabilitado con «No hay participantes elegibles para sortear.»; (h) con todos los premios sorteados el botón queda deshabilitado

**Checkpoint**: US1 + US2 = **MVP**: premios, ruleta, ganador guardado en el servidor, historial básico, práctica y cierre de inscripciones.

---

## Phase 5: User Story 3 - Descartar a un ganador ausente y volver a girar (Priority: P2)

**Goal**: «Volver a girar» descarta al ganador (queda en el historial, no vuelve a la ruleta, la unidad del premio se libera) y gira de nuevo; también se puede descartar desde el historial (FR-075, FR-078, FR-079).

**Independent Test**: Girar, tocar «Volver a girar»: el primer ganador aparece como «Descartado» (quién y cuándo), el nuevo giro lo excluye y lleva el número siguiente (#2), y el premio sigue contando una sola unidad entregada.

### Tests for User Story 3 ⚠️

- [X] T041 [P] [US3] Ampliar `tests/integration/spins.test.ts` con `discardSpin`: marca `status: "discarded"`, `discardedAt` y `discardedBy: { uid, email }`; `prizes.delivered` baja en 1 y `spinCount` **no** cambia; `participants.drawId` del ganador **no** cambia y no reaparece en `listWheelParticipants`; descartar dos veces → `SpinNotActiveError`; giro inexistente → `SpinNotFoundError`; tras descartar #1 y girar de nuevo el giro nuevo tiene `number: 2` y el descartado conserva el 1 (sin reutilizar números); premio de 2 unidades con un descartado → `delivered` cuenta solo los activos; si solo quedaba un elegible y fue descartado, `spin` lanza `NoEligibleError`; `discardSpin` sigue funcionando tras el borrado definitivo (participante ausente)
- [X] T042 [P] [US3] Ampliar `tests/integration/spins.route.test.ts` con `POST /api/admin/spins/{id}/discard`: 200 con `{ id, number, status: "discarded", discardedAt }`; 404 `NOT_FOUND`; 409 `SPIN_NOT_ACTIVE` al repetir; agregar su fila de 401/403/`Origin` a `tests/integration/admin-routes-auth.test.ts`

### Implementation for User Story 3

- [X] T043 [US3] Implementar `discardSpin(spinId, admin)` en `src/services/spins.service.ts`: **una transacción** que lee `spins/{id}` (`SpinNotFoundError`; `status !== "active"` → `SpinNotActiveError`) y `prizes/{prizeId}`; escribe `status: "discarded"`, `discardedAt: serverTimestamp()`, `discardedBy: { uid, email }` y `prizes.delivered − 1` (nunca por debajo de 0) con `updatedAt`; **no** toca `participants` ni `spinCount`; devuelve `{ id, number, status: "discarded", discardedAt }`. No existe ninguna operación inversa (FR-079)
- [X] T044 [US3] Crear `src/app/api/admin/spins/[id]/discard/route.ts` con `POST` (`params` como promesa): origen, sesión, `discardSpin`, `200` con `{ id, number, status, discardedAt }` (ISO); `SpinNotFoundError` → 404 `NOT_FOUND`; `SpinNotActiveError` → 409 `SPIN_NOT_ACTIVE`; 500 `INTERNAL_ERROR` sin datos personales en logs
- [X] T045 [US3] Editar `src/components/admin/WinnerDialog.tsx`: agregar la prop opcional `onDiscard?: () => void` y, cuando se pasa (giro real), un segundo botón secundario «Volver a girar» junto a «Continuar» (ambos deshabilitados mientras `busy`); en práctica no se muestra. Escape sigue equivaliendo a «Continuar»
- [X] T046 [US3] Editar `src/components/admin/DrawStage.tsx`: guardar el `id` del giro real en `result`; «Volver a girar» llama a `POST /api/admin/spins/{id}/discard` y, si responde 200, **inmediatamente** ejecuta de nuevo el flujo de giro por el mismo premio (cierra la ventana, `router.refresh()` para quitar al descartado de la lista de la ruleta **antes** de animar, y luego `POST /api/admin/spins`); si el descarte falla, mostrar el error y mantener la ventana; si el segundo giro falla, el estado queda coherente (unidad libre, ganador descartado) y se muestra el error. No pedir de nuevo el cierre de inscripciones (ya están cerradas)
- [X] T047 [US3] Crear `src/components/admin/DiscardWinnerButton.tsx` (cliente): botón «Descartar» con `Dialog` de confirmación «¿Descartar al ganador #{n}? La unidad volverá a estar disponible y esta persona no volverá a participar.» y «Cancelar»/«Sí, descartar»; llama a `POST /api/admin/spins/{id}/discard` con `adminFetch` y luego `router.refresh()` en `startTransition`; muestra errores con `Alert`. Editar `src/components/admin/WinnerHistory.tsx` para renderizarlo solo en los registros `status === "active"` y `legacy === false` (pasar `spinId` = `record.key`)
- [X] T048 [US3] Crear `tests/e2e/discard.spec.ts`: con 10 participantes y un premio de 1 unidad, girar → «Volver a girar» en la ventana → el historial muestra #1 «Descartado» y #2 «Ganador», el premio «1 de 1 entregadas» y el ganador #2 distinto del #1; girar por otro premio, aceptar con «Continuar» y descartar desde el historial con «Descartar» → la unidad vuelve («0 de N entregadas») y el botón de girar se habilita de nuevo; el número de elegibles nunca vuelve a incluir a los descartados

**Checkpoint**: US1 + US2 + US3 funcionan de forma independiente.

---

## Phase 6: User Story 4 - Proyectar el sorteo en pantalla completa (Priority: P2)

**Goal**: Modo de pantalla completa con fondo blanco, ruleta ampliada, logo de Cautiva, premio en juego grande, letrero del nombre y controles de girar, silenciar y salir; Escape sale (FR-076, FR-080, FR-081).

**Independent Test**: Activar la pantalla completa a 1920×1080, girar, silenciar y salir con Escape sin perder el estado; la ventana del ganador se ve dentro de la pantalla completa; el premio y el nombre son legibles a ~2 m en una pantalla de 40".

### Tests for User Story 4 ⚠️

- [X] T049 [US4] Crear `tests/e2e/presentation.spec.ts` (con `page.setViewportSize({ width: 1920, height: 1080 })`): pulsar «Pantalla completa» muestra el contenedor de proyección (verificar por un `data-testid="stage-fullscreen"` y no por la Fullscreen API, que en modo headless puede rechazarse y debe caer al respaldo CSS) con el logo, el premio en juego y el botón «Salir de pantalla completa»; el texto del premio tiene `font-size ≥ 48px` y el letrero `≥ 40px` (comprobar con `getComputedStyle`); girar dentro de la pantalla completa muestra el `dialog` «¡Ganador #N!» **visible** (dentro del contenedor) y «Continuar» lo cierra; «Silenciar sonido» alterna `aria-pressed` y la preferencia persiste tras recargar (`localStorage` `sorteo:silencio`); la tecla Escape sale de la pantalla completa y conserva el premio seleccionado y la práctica activada

### Implementation for User Story 4

- [X] T050 [US4] Crear `src/components/admin/useFullscreen.ts` (hook de cliente): `useFullscreen(): { ref: RefObject<HTMLElement | null>; active: boolean; enter(): Promise<void>; exit(): Promise<void> }`; `enter` llama a `ref.current.requestFullscreen()` y, si el navegador no la soporta o la rechaza (`catch`), activa un **respaldo CSS** (`active = true` sin API nativa); escucha `fullscreenchange` para sincronizar `active` cuando el usuario sale con Escape; en el respaldo, escuchar `keydown` de Escape en `document` mientras esté activo; limpiar listeners al desmontar
- [X] T051 [US4] Editar `src/components/admin/DrawStage.tsx` para el modo de proyección: envolver rueda, premio en juego, letrero, controles **y las ventanas (`WinnerDialog` y el `Dialog` de confirmación) dentro del mismo contenedor** (`ref` del hook, `data-testid="stage-fullscreen"` cuando `active`) para que sean visibles en pantalla completa (research D-213); con `active` aplicar `fixed inset-0 z-50 bg-paper` (respaldo) o el fondo `bg-paper` en nativo, mostrar `<Logo />` de `src/components/ui/Logo.tsx`, el premio en juego con `font-display text-5xl` o mayor (≥ 48 px) y el letrero con `text-4xl` o mayor (≥ 40 px), el aviso «Práctica: no se guarda» si corresponde, y solo los controles «Girar…», «Silenciar sonido» y «Salir de pantalla completa» (ocultar el selector de premios; el premio en juego se cambia en el panel normal). Botón «Pantalla completa» / «Salir de pantalla completa» en el panel normal. Salir no reinicia premio, práctica ni silencio (estado en el mismo componente)
- [X] T052 [US4] Editar `src/components/admin/RouletteWheel.tsx` y `DrawStage.tsx` para el tamaño: calcular `size` con un `ResizeObserver` sobre el contenedor (`min(ancho disponible, 560)` en el panel y `min(alto de ventana − márgenes, 900)` en pantalla completa; mínimo 280 en móvil de 360 px sin desborde horizontal) y volver a prerenderizar la rueda al cambiar `size` conservando la rotación actual; comprobar que con 5 000 segmentos el cambio de tamaño no bloquea la interfaz más de ~200 ms

**Checkpoint**: US1 a US4 funcionan de forma independiente.

---

## Phase 7: User Story 5 - Consultar el historial de ganadores por premio (Priority: P3)

**Goal**: Historial unificado (giros + rondas antiguas como «Sin premio»), exportación CSV con premio, número y estado, y conservación mínima tras el borrado definitivo (FR-083 a FR-086).

**Independent Test**: Realizar varios giros, descartar uno y sembrar una ronda antigua: el historial los muestra a todos con número, premio y estado; el CSV coincide; tras el borrado definitivo se conservan premio, número, nombre, fecha y estado sin celular ni empresa, y no se puede girar.

### Tests for User Story 5 ⚠️

- [X] T053 [P] [US5] Ampliar `tests/unit/csv.test.ts`: `toCsv` con las 7 columnas `Nombres,Celular,Empresa u ocupación,Fecha de registro,Premio,N.º de ganador,Estado`; fila de ganador activo → `Alexa,3,Ganador`; descartado → `Descartado`; participante que no ganó → las tres celdas vacías; premio `=cmd` o `+x` se neutraliza con `'`; un premio con coma se escapa entre comillas; sin filas devuelve solo el encabezado de 7 columnas; BOM y saltos `\r\n` se conservan
- [X] T054 [P] [US5] Ampliar `tests/integration/spins.test.ts` con `listWinnerRecords` y `getWinnerLookup`: con 2 rondas antiguas (`seedLegacyDraw` de 2 y 1 ganadores, creadas en ese orden) y 3 giros, los registros salen por número descendente: giros #6, #5, #4 y antiguos #3, #2, #1 con `prizeName: null`, `legacy: true`, `status: "active"`; la numeración de los antiguos es estable entre lecturas; tras `purgeAllParticipantData` los antiguos conservan número y nombre y pierden celular y empresa; `getWinnerLookup` devuelve en `bySpinId` cada giro (clave = id del giro) y en `byLegacyPhone` cada ganador antiguo (clave = celular de 9 dígitos) con `{ prizeName, number, status }`
- [X] T055 [P] [US5] Ampliar `tests/integration/purge.test.ts`: tras ejecutar giros reales y el borrado definitivo, cada `spins/{id}` conserva `number`, `prizeId`, `status`, `createdAt`, `createdBy`, `discardedAt/By` y `winner` queda **exactamente** `{ fullName }`, con `purgedAt` fijado (si ya tenía uno se conserva el original); repetir el borrado no cambia nada (idempotente); el borrado de un giro descartado también reduce su `winner`; **no existe ningún celular** (`+51…` ni 9 dígitos) en ningún documento de `spins`; después, `spin` lanza `NoEligibleError`
- [X] T056 [P] [US5] Ampliar `tests/integration/export.route.test.ts`: con un ganador activo, uno descartado, uno de una ronda antigua y uno sin ganar, el CSV trae `Premio`, `N.º de ganador` y `Estado` correctos (`Sin premio` y su número para el antiguo; vacíos para quien no ganó) y sigue exigiendo sesión (401/403)

### Implementation for User Story 5

- [X] T057 [US5] Editar `src/services/spins.service.ts`: `listWinnerRecords()` une los giros con `readLegacyWinners()` (T006) y devuelve **todo ordenado por `number` descendente**; implementar `getWinnerLookup()` según «Contratos de módulos»: `bySpinId` con un `WinnerInfo` por giro (`prizeName` leído del premio) y `byLegacyPhone` con un `WinnerInfo` por ganador de ronda antigua (`prizeName: null`, `status: "active"`, número calculado en T006), solo para los que conservan `phone`
- [X] T058 [US5] Editar `src/lib/csv.ts`: `CsvRow` agrega `prizeName: string | null`, `winnerNumber: number | null`, `winnerStatus: "active" | "discarded" | null`; `HEADER` pasa a `["Nombres", "Celular", "Empresa u ocupación", "Fecha de registro", "Premio", "N.º de ganador", "Estado"]`; las celdas nuevas se vacían si el participante no ganó, `Premio` usa «Sin premio» para `prizeName: null` cuando `winnerNumber !== null`, `Estado` es «Ganador» o «Descartado», y el nombre del premio pasa por `neutralizeFormula` y `escapeCell`
- [X] T059 [US5] Editar `src/app/api/admin/participants/export/route.ts`: leer `listParticipants()` y `getWinnerLookup()`, unir cada participante con su ganador: primero `lookup.bySpinId.get(participant.drawId)` y, si no hay, `lookup.byLegacyPhone.get(participant.phone)` (celular de 9 dígitos), y pasar las columnas nuevas a `toCsv`; conservar `maxDuration`, nombre de archivo, cabeceras y exigencia de sesión
- [X] T060 [US5] Editar `purgeAllParticipantData` en `src/services/participants.service.ts`: en el paso 1, además de `draws`, recorrer `spins` con el mismo `BulkWriter` y dejar `winner: { fullName }` y `purgedAt` (`data.purgedAt ?? serverTimestamp()`) solo si hay algo que reducir o falta `purgedAt` (idempotente, reintentable); no tocar el resto de campos del giro; actualizar el comentario de la función (pasos 1–3) y reutilizar `reduceWinners`/un helper equivalente para un único `winner`
- [X] T061 [US5] Editar `src/components/admin/WinnerHistory.tsx`: mostrar «Sin premio» para `prizeName === null`; omitir el celular y la empresa cuando no existen y, si el registro viene de una ronda con datos eliminados, mostrar la nota «Datos personales eliminados: solo se conservan el nombre, el número y el premio.» (usar `phone === undefined && company === undefined`); mantener el botón «Descartar» solo en activos no antiguos
- [X] T062 [US5] Ajustar `tests/e2e/purge.spec.ts` y `tests/e2e/export.spec.ts` al nuevo modelo: en purge, tras girar y borrar los datos, el historial conserva premio, número, nombre y estado (sin celular ni empresa) y «Girar» queda deshabilitado con «No hay participantes elegibles para sortear.»; en export, el CSV descargado incluye las columnas `Premio`, `N.º de ganador` y `Estado` con los valores esperados

**Checkpoint**: Las cinco historias funcionan de forma independiente.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Puertas de calidad de la constitución y validación de punta a punta.

- [X] T063 [P] Ejecutar `npm run typecheck`, `npm run lint` y `npm run format:check`; corregir con `npm run format` solo los archivos de esta feature; verificar que no queda `any` sin comentario justificativo ni `console.log` con datos personales en `src/services/spins.service.ts`, `src/services/prizes.service.ts` ni en los Route Handlers nuevos
- [X] T064 [P] Ejecutar `npm run test:unit` (incluida `no-hardcoded-colors.test.ts`: la rueda debe leer los colores de los tokens y no usar `rgba()` en `src/`) y `npm run test:rules`
- [X] T065 Ejecutar `npm test` (unitarias + reglas + integración contra los emuladores) y confirmar en verde `spins.test.ts`, `prizes.test.ts`, `spins.route.test.ts`, `admin-routes-auth.test.ts`, `purge.test.ts`, `export.route.test.ts` y `volume.test.ts`
- [X] T066 Ejecutar `npm run test:e2e` y confirmar en verde `prizes.spec.ts`, `draw.spec.ts`, `discard.spec.ts`, `presentation.spec.ts`, `purge.spec.ts`, `export.spec.ts` y los E2E del registro de las features 001/002 (sin regresiones)
- [ ] T067 Recorrer los 14 escenarios manuales de `specs/003-sorteo-premios-ruleta/quickstart.md` con `npm run emulators` + `npm run dev`; en especial los que no automatiza E2E: melodía y silencio reales (escenarios 2 y 6), pantalla completa nativa con la ventana visible (6), lectura a ~2 m en pantalla Full HD de 40" (6), escala de 500 y 5 000 participantes con la rueda fluida y sin texto superpuesto (12), accesibilidad con solo teclado y contraste AA del texto de los segmentos (13). Anotar cualquier desvío y corregirlo
  - Verificado de forma automática: escenarios 1, 3, 4, 5, 7, 8, 9, 10, 11, 12 y 14 (E2E, integración y medición con 500 y 5 000 participantes: 60 fps, ≈7 s del clic a la ventana del ganador), y capturas de la rueda y de la pantalla completa a 1920×1080 y 360 px.
  - **Pendiente de verificación humana**: melodía y silencio audibles (2 y 6), pantalla completa nativa en un monitor real (6), lectura a ~2 m en una pantalla Full HD de 40" (6) y recorrido solo con teclado (13).
- [X] T068 Revisión de código con foco en los principios III y IV de la constitución (plan, «Re-evaluación posterior al diseño»): (1) la respuesta de `POST /api/admin/spins` y la ventana del ganador no contienen celular; (2) la lista de la ruleta solo trae `{ ref, fullName }`; (3) el modo de práctica no escribe; (4) `spins` no guarda el id/celular del participante y el borrado lo reduce a `{ fullName }`; (5) todas las rutas nuevas exigen `requireAdminApi` y `assertSameOrigin`; (6) `firestore.rules` sigue en `deny all`; (7) sin secretos ni datos reales en el repo
- [X] T069 [P] Confirmar que `.github/workflows/ci.yml` y `scripts/lighthouse.mjs` no referencian `draws.service` ni `/api/admin/draws`, y ejecutar `npm run perf` para verificar que `/registro` y `/` siguen con Lighthouse móvil ≥ 90 en Performance y Accessibility (la feature no debería afectarlos)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup; **bloquea** todas las historias.
- **US1 (Phase 3)** y **US2 (Phase 4)**: dependen de Foundational y pueden avanzar **en paralelo** hasta la integración en la página. US2 necesita `PrizeView`/`listPrizes()` de US1 para `page.tsx` (T037 usa `listPrizes` de T014) y para que existan premios que sortear: implementar T013–T014 antes de T037, o sembrar premios con `seedPrize` mientras tanto.
- **US3 (Phase 5)**: depende de US2 (el giro, `WinnerDialog`, `DrawStage` y `WinnerHistory` ya existen).
- **US4 (Phase 6)**: depende de US2 (`DrawStage`, `RouletteWheel`, sonido y silencio ya existen); independiente de US3.
- **US5 (Phase 7)**: depende de US2 (`listWinnerRecords` base y `WinnerHistory`); T060 (borrado) es independiente de US3/US4.
- **Polish (Phase 8)**: depende de las historias que se vayan a entregar.

### User Story Dependencies

- **US1 (P1)**: sin dependencias de otras historias.
- **US2 (P1)**: usa premios de US1 (datos), pero se prueba con `seedPrize`; sin ello no es demostrable en la interfaz.
- **US3 (P2)**: extiende US2.
- **US4 (P2)**: extiende US2.
- **US5 (P3)**: extiende US2; el CSV y el borrado no dependen de US3/US4.

### Within Each User Story

- Pruebas primero (deben fallar) → esquemas/tipos → servicios → Route Handlers → componentes → integración en la página → E2E.
- Dentro de US2: T027 (`wheel.ts`) antes de T033; T028/T029 antes de T034/T035; T030 antes de T031/T032; T033/T034 antes de T035; T035/T036 antes de T037; **T038/T039 (eliminación) solo después de T037**.
- Las tareas que editan el mismo archivo **no** son paralelas (p. ej. T045 y T046 tocan archivos distintos, pero T035, T046, T051 y T052 editan `DrawStage.tsx`: hacerlas en orden).

### Parallel Opportunities

- Foundational: T004, T005, T007, T008 y T009 en paralelo tras T003 (T006 va aparte porque define los errores).
- US1: T010, T011 y T012 en paralelo; T015, T016 y T017 en paralelo tras T014.
- US2: T021 a T025 en paralelo; T027, T028 y T029 en paralelo; T031 y T032 en paralelo tras T030; T033, T034 y T036 en paralelo.
- US3: T041 y T042 en paralelo.
- US5: T053 a T056 en paralelo.
- Con dos desarrolladores: uno toma US1 (T010–T020) y otro US2 hasta T036; se encuentran en T037.

### Parallel Example: User Story 2

```text
# Pruebas de US2 (archivos distintos):
Task: "tests/unit/wheel.test.ts"                      (T021)
Task: "tests/unit/draw.test.ts (1 000 giros)"         (T022)
Task: "tests/integration/spins.test.ts"               (T024)
Task: "tests/integration/spins.route.test.ts"         (T025)

# Módulos independientes antes de los componentes:
Task: "src/lib/wheel.ts"                              (T027)
Task: "src/lib/victory-sound.ts"                      (T028)
Task: "src/components/ui/Confetti.tsx"                (T029)
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Completar Setup y Foundational.
2. Completar US1 (premios) y US2 (ruleta, giro, práctica, cierre de inscripciones, historial básico, limpieza de lo antiguo).
3. **Parar y validar**: escenarios 1, 2, 4, 5, 7, 8, 9 y 14 del quickstart. Con esto ya hay «varios sorteos» por premios y una ruleta nueva.
4. Desplegar o mostrar al cliente si está listo.

### Incremental Delivery

1. + US3 → descartes y «Volver a girar» (el caso más común en eventos reales).
2. + US4 → pantalla completa para proyectar.
3. + US5 → historial unificado, CSV y borrado conforme a FR-086.
4. Polish → puertas de calidad y recorrido manual completo.

### Notas

- `[P]` = archivos distintos y sin dependencias pendientes. Cada historia debe poder completarse y probarse sola.
- Verificar que las pruebas fallan antes de implementar. Confirmar (commit) tras cada tarea o grupo lógico.
- Tras el borrado de la colección antigua (`draws`) **no** se elimina su lectura: sigue siendo necesaria para el historial y la numeración (FR-083, FR-085).
- Evitar: tareas vagas, conflictos en el mismo archivo y dependencias entre historias que rompan su independencia.
