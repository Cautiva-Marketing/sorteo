---

description: "Task list for Ajustes de registro, pantalla del QR y ruleta"
---

# Tasks: Ajustes de registro, pantalla del QR y ruleta

**Input**: Design documents from `/specs/004-ajustes-registro-ruleta/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/http-api.md, quickstart.md

**Tests**: INCLUIDAS. La constitución v2.1.0 (principio VI y puertas de calidad) exige pruebas unitarias de los
esquemas Zod y de la normalización de celular, y una prueba E2E del registro (éxito, duplicado y datos
inválidos). Dentro de cada historia, las pruebas se escriben primero y deben fallar antes de implementar.
**No se debilita ninguna prueba existente**: las que fijan el formato anterior (celular de 9 dígitos, 6 colores,
confirmación previa al giro) se actualizan al nuevo comportamiento.

**Organization**: Tareas agrupadas por historia de usuario de la spec. Es un cambio sobre una aplicación ya
construida (features 001 a 003): casi todas las tareas **editan** archivos existentes. **Cero dependencias
nuevas** (no se ejecuta `npm install`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia de usuario a la que pertenece (US1…US6)
- Todas las rutas son relativas a la raíz del repo (`D:\Trabajos\Cautiva Marketing\sorteo`)

## Path Conventions

Aplicación Next.js única en la raíz: `src/app`, `src/components`, `src/lib`, `src/services`, `src/types`,
`tests/{unit,integration,rules,e2e}`. Solo `src/services/**` importa `firebase` o `firebase-admin`;
`src/lib/**` es lógica pura sin Firebase ni React. **Antes de escribir código de Next.js** (`AGENTS.md`): esta
versión tiene cambios incompatibles; lee la guía pertinente en `node_modules/next/dist/docs/`. Mensajes de
interfaz y de error en español (es-PE). **Sin colores literales** (`#rrggbb`, `rgb(`, `hsl(`, `oklch(`) fuera
de `src/app/globals.css`: usar clases de token (`bg-paper`, `text-ink-900`, `bg-wheel-purple`…) y, en el
canvas, leer los tokens con `getComputedStyle`. Las pruebas de integración y E2E corren contra los
emuladores (`npm test`, `npm run test:e2e`).

## Contratos de módulos (referencia para todas las tareas)

Firmas que comparten varias tareas; no cambiarlas sin actualizar las demás.

- **`src/lib/validation/countries.ts`** (nuevo, datos puros):
  - `type CountryCode = "PE" | "AR" | "BO" | "BR" | "CL" | "CO" | "EC" | "GY" | "PY" | "SR" | "UY" | "VE"`.
  - `interface Country { code: CountryCode; name: string; dial: string; rule: { kind: "mobile9" } | { kind: "length"; min: number; max: number }; trunkZero: boolean; example: string }`.
  - `COUNTRIES: readonly Country[]` con Perú primero y luego por nombre: Argentina, Bolivia, Brasil, Chile,
    Colombia, Ecuador, Guyana, Paraguay, Surinam, Uruguay, Venezuela. `DEFAULT_COUNTRY: CountryCode = "PE"`.
    `COUNTRY_CODES: readonly [CountryCode, ...CountryCode[]]` (para `z.enum`). `getCountry(code: CountryCode): Country`.
  - Datos (research D-301): `PE` 51 `mobile9` · `CL` 56 `mobile9` · `AR` 54 `length 10–10` (exactamente 10 dígitos
    tras quitar el `9` móvil; ver el paso 5 de `normalizePhone`) troncal sí · `BO` 591
    `length 8` · `BR` 55 `length 10–11` troncal sí · `CO` 57 `length 10` · `EC` 593 `length 9` troncal sí · `GY` 592
    `length 7` · `PY` 595 `length 9` troncal sí · `SR` 597 `length 7` · `UY` 598 `length 8` troncal sí · `VE` 58
    `length 10` troncal sí. `mobile9` = exactamente 9 dígitos y el primero es `9` (`^9\d{8}$`).
  - Ejemplos válidos para `example` y las pruebas: PE `987654321` · CL `912345678` · AR `1112345678` · BO `71234567` ·
    BR `11987654321` · CO `3001234567` · EC `991234567` · GY `6091234` · PY `981123456` · SR `7412345` · UY `94123456` ·
    VE `4141234567`.
- **`src/lib/validation/phone.ts`** (reescrito, puro):
  - `normalizePhone(country: CountryCode, input: string): string | null` — devuelve el E.164 `+{dial}{local}` o
    `null`. Pasos, en este orden (research D-302): (1) quitar espacios, guiones y paréntesis; (2) si empieza con
    `+`, el prefijo debe ser `+{dial}` del país elegido (si no → `null`) y se quita; si no empieza con `+`, se
    quita `{dial}` pelado **solo** cuando el total de dígitos es exactamente `dial.length + máximo del país`
    (en `AR`, también `dial.length + 11`, por el `9` móvil);
    (3) tras el prefijo, solo dígitos (cualquier otro carácter → `null`); (4) si `trunkZero` y empieza con `0`,
    quitar ese `0`; (5) en `AR`, si quedan 11 dígitos y el primero es `9`, quitar el `9` (si quedan 11 dígitos
    y el primero no es `9`, el resultado sigue teniendo 11 y el paso 6 lo rechaza); (6) aplicar la regla del
    país (`mobile9` o rango `min–max`) sobre el número ya normalizado, de modo que Argentina solo acepta
    exactamente 10 dígitos.
  - `phoneErrorMessage(country: CountryCode): string` — PE: «Ingresa un celular peruano de 9 dígitos que empiece
    con 9.»; CL: «Ingresa un celular chileno de 9 dígitos que empiece con 9.»; resto: «Ingresa un celular válido de
    {nombre} ({n} dígitos).» si `min == max`, o «({min} a {max} dígitos).» si no.
  - `formatPhoneDisplay(value: string): string` — acepta E.164 **o** el valor antiguo de 9 dígitos (se interpreta
    como Perú). Salida `+51 987 654 321` (9 dígitos agrupados 3-3-3); otros largos sin agrupar (`+57 3001234567`).
    Reconoce prefijos de 3 dígitos (`591`–`598`) antes que los de 2; si no reconoce el valor, lo devuelve igual.
  - `formatPhoneCsv(value: string): string` — `{dial} {local}` sin `+` (`51 987654321`); el valor antiguo de 9
    dígitos sale como `51 …`; si no lo reconoce, lo devuelve igual.
  - `phoneDigits(value: string): string` = solo los dígitos de `value`.
  - `peruNational(value: string): string | null` — los 9 dígitos de un E.164 `+51…`; `null` si el prefijo no es `51`.
    Sustituye a `toNational` para la clave de ganadores de rondas antiguas.
  - **Se conservan `toNational` y `formatNationalPhone`** hasta la tarea de limpieza final (T059), para no romper
    los consumidores mientras se migran.
- **`src/lib/validation/schemas.ts`**: `registrationSchema` pasa a `{ fullName, country, phone, company,
  crmInterest }`. Entrada: `country` opcional (`PE` por defecto), `phone` = número local, `crmInterest` booleano
  opcional (`false` por defecto). Salida: `{ fullName, phone /* E.164 */, company, crmInterest }`. El error de
  celular va en la ruta `["phone"]` con `phoneErrorMessage(country)`.
- **`src/lib/wheel.ts`**: `type ColorToken = "wheel-purple" | "wheel-lavender" | "wheel-cyan" | "paper" | "ink-900"`
  y `PALETTE` de **3** entradas, en este orden: `wheel-purple→paper`, `wheel-lavender→paper`, `wheel-cyan→ink-900`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: confirmar el punto de partida antes de tocar nada.

- [X] T001 Confirmar el estado base: ejecutar `npm run typecheck`, `npm run lint`, `npm run format:check` y `npm run test:unit` en la raíz y anotar que pasan (si algo ya falla, corregirlo o registrarlo antes de seguir; no hay cambios de archivos)
- [X] T002 Leer en `node_modules/next/dist/docs/` la guía de Componentes de Servidor y de Cliente y la de Route Handlers (requisito de `AGENTS.md`) antes de editar `src/components/**` y `src/app/api/**`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: los países y la normalización de celular que usan el formulario, el servidor, la tabla, el CSV, la
búsqueda y el historial. **Ninguna historia puede empezar sin esta fase.**

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests (escribir primero; deben fallar)

- [X] T003 [P] Reescribir `tests/unit/phone.test.ts` para el contrato de `phone.ts`: por cada uno de los 12 países, el ejemplo válido del contrato normaliza a `+{dial}{local}` y un número de largo incorrecto devuelve `null`; PE y CL exigen 9 dígitos que empiezan con 9 (`812345678` → `null`); prefijo `+` propio se acepta (`+56 9 1234 5678` con `CL`) y ajeno devuelve `null` (`+51 987654321` con `CL`); prefijo pelado solo con el largo total exacto (`51987654321` con `PE` ✓, `5198765432` ✗); `0` troncal (`0981 123 456` con `PY` = `0981123456` → `+595981123456`, igual que sin el `0`); Argentina con `9` móvil (`91112345678` → `+541112345678`, igual que `1112345678`) y un número de 11 dígitos que no empieza con `9` (`11123456789` con `AR`) → `null`; letras → `null`. Probar también `phoneErrorMessage`, `formatPhoneDisplay` (`+51987654321` → `+51 987 654 321`, `987654321` → `+51 987 654 321`, `+573001234567` → `+57 3001234567`, `+59171234567` → `+591 71234567` (prefijo de 3 dígitos), y un valor con prefijo inexistente como `+99912345678` o no numérico como `abc` se devuelve igual), `formatPhoneCsv`, `phoneDigits` y `peruNational`. **Conservar** los `describe` actuales de `toNational` y `formatNationalPhone` hasta T059

### Implementation

- [X] T004 Crear `src/lib/validation/countries.ts` con `CountryCode`, `Country`, `COUNTRIES`, `DEFAULT_COUNTRY`, `COUNTRY_CODES` y `getCountry`, con los datos exactos del contrato de módulos (los 12 países, su prefijo, regla, troncal y ejemplo; orden: Perú primero y luego por nombre)
- [X] T005 Reescribir `src/lib/validation/phone.ts`: agregar `normalizePhone(country, input)`, `phoneErrorMessage`, `formatPhoneDisplay`, `formatPhoneCsv`, `phoneDigits` y `peruNational` según el contrato (importar la tabla de `countries.ts`); **mantener** las exportaciones `toNational` y `formatNationalPhone` sin cambios. La versión anterior de `normalizePhone(input)` desaparece: su única llamada actual (`src/lib/validation/schemas.ts`) se migra en T011, así que `npm run typecheck` y `schemas.test.ts` quedan en rojo entre T005 y T011 (esperado; no ejecutar esas puertas hasta terminar T011)

**Checkpoint**: Foundation ready - `npm run test:unit -- tests/unit/phone.test.ts` pasa (el typecheck de todo el proyecto vuelve a verde en T011); user story implementation can now begin

---

## Phase 3: User Story 1 - Registrarse desde cualquier país de Sudamérica con solo un nombre (Priority: P1) 🎯 MVP

**Goal**: el formulario ofrece un selector de país (Perú por defecto), acepta celulares de los 12 países y un
solo nombre, no muestra el texto «9 dígitos, por ejemplo …», y el celular se ve con su prefijo en el panel, la
ventana de bienvenida, el historial, el CSV y la búsqueda (FR-092 a FR-100).

**Independent Test**: registrar a una persona con celular de Chile y un solo nombre y a otra con celular de Perú
dejando el país por defecto; ambas aparecen en `/admin` con su prefijo, el mismo número local en dos países da dos
participantes, y no se muestra el texto de ayuda (quickstart escenarios 1 a 3).

### Tests for User Story 1 (escribir primero; deben fallar) ⚠️

- [X] T006 [P] [US1] Actualizar `tests/unit/schemas.test.ts` (bloque de `registrationSchema`): un solo nombre («María») se acepta; nombre de 1 letra («A»), con números, con símbolos o vacío se rechazan; `country` ausente = `PE`; `country` fuera de los 12 se rechaza; celular inválido para el país elegido da error en la ruta `phone` con `phoneErrorMessage`; un nombre inválido y un celular inválido se informan **a la vez**; la salida trae `phone` en E.164 (`+56912345678`); un cuerpo antiguo `{ fullName, phone: "+51 987-654-321", company }` sigue siendo válido
- [X] T007 [P] [US1] Actualizar `tests/integration/registrations.route.test.ts`: `POST /api/registrations` con `country: "CL"`, nombre de una palabra y `9 1234 5678` responde 201 y crea `participants/+56912345678` con `phone: "+56912345678"`; sin `country` crea el documento `+51…`; un número inválido para el país responde 400 con `fieldErrors.phone`; el cuerpo antiguo sin `country` sigue funcionando
- [X] T008 [P] [US1] Actualizar `tests/integration/duplicates.test.ts`: el mismo número local `987654321` en `PE` y en `CL` (`987654321` válido en ambos) crea dos participantes; `981 123 456` y `0981 123 456` con `PY` son el mismo registro (el segundo da 409 `ALREADY_REGISTERED`); las variantes peruanas actuales (`+51 987-654321`, `51987654321`, `(+51) 987 654 321`) siguen chocando; un participante creado con el formato anterior (`+51…`) no puede registrarse de nuevo
- [X] T009 [P] [US1] Actualizar `tests/unit/search.test.ts`, `tests/integration/participants.list.test.ts`, `tests/unit/csv.test.ts` y `tests/integration/export.route.test.ts`: la búsqueda por `987654321`, `51987654321` y `+51 987 654 321` encuentra al mismo participante; por `56 9 1234 5678` encuentra al chileno; una consulta sin dígitos («María») filtra solo por nombre y empresa y **no** devuelve todas las filas por coincidir con el celular; `listParticipants()` devuelve `phone` en E.164 (`+51987654321`, no 9 dígitos); el CSV muestra el celular como `51 987654321` bajo el encabezado «Celular (con código de país)» (antes `987654321`), un participante `+56…` sale como `56 912345678` y un ganador de una ronda antigua sigue resolviéndose por su celular de 9 dígitos. Ejecutar además `tests/integration/legacy-consent.test.ts` y `tests/integration/volume.test.ts` y corregir cualquier aserción que dependa del celular de 9 dígitos (los ayudantes `tests/integration/helpers.ts` y `tests/e2e/helpers/emulators.ts` ya generan E.164 `+519…`)
- [X] T010 [P] [US1] Actualizar `tests/e2e/registration.spec.ts` y `tests/e2e/duplicate.spec.ts`: el selector «País» existe con «Perú (+51)» preseleccionado y lista los 12 países; no existe el texto «9 dígitos, por ejemplo»; registro con Chile y un solo nombre muestra el celular `+56 9 1234 5678` en la ventana de bienvenida; número inválido para el país muestra el error junto al campo; duplicado sigue mostrando «ya registrado» sin revelar datos. Ajustar `tests/e2e/admin-access.spec.ts` (búsqueda por 9 dígitos y por empresa, y que la tabla muestre el prefijo) y `tests/e2e/export.spec.ts` (el valor esperado del celular en el CSV pasa de `987654321` a `51 987654321`)

### Implementation for User Story 1

- [X] T011 [US1] Editar `src/lib/validation/schemas.ts`: `fullNameSchema` acepta **«Uno o más términos de solo letras, mínimo 2 letras en total, máx. 100»** (`FULL_NAME_MAX`), con NFC y espacios colapsados, y mensaje «Ingresa tu nombre usando solo letras, espacios y tildes.»; `registrationSchema` agrega `country` (`z.enum(COUNTRY_CODES)`, por defecto `PE`) y valida el celular a nivel de objeto con `normalizePhone(country, phone)` (error en `["phone"]` con `phoneErrorMessage`); la salida entrega `phone` en E.164. `phoneSchema` y su `PHONE_MESSAGE` anteriores se eliminan. Asegurar que los errores de nombre y de celular salgan juntos (research D-303; si Zod 4 omite la validación de objeto con errores previos, usar `when` en el `refine`)
- [X] T012 [P] [US1] Crear `src/components/registration/PhoneField.tsx`: etiqueta «Celular» (`<label>` asociado al número), un `<select>` nativo con nombre accesible «País» y opciones «Nombre (+prefijo)» tomadas de `COUNTRIES` (Perú primero), y un `<input type="tel" inputMode="tel" autoComplete="tel-national">` para el número local con `placeholder` = `example` del país elegido (formateado en grupos), ícono de teléfono, error con `aria-describedby`/`aria-live` como `src/components/ui/TextField.tsx`, **sin texto de ayuda**. Props: `registerCountry`/`registerPhone` (resultados de `register` de React Hook Form), `country: CountryCode` (para el placeholder) y `error?: string`. Solo tokens de color; mínimo 44 px de alto
- [X] T013 [US1] Editar `src/components/registration/RegistrationForm.tsx`: reemplazar el `TextField` de celular por `PhoneField` (usar `watch("country")` para el placeholder), quitar `helpText`, `defaultValues` con `country: "PE"`, placeholder de nombres «Ej. María», `FIELD_NAMES` sin cambios (`phone` ya cubre el error), `WelcomeData.phone` pasa a E.164 (quitar `toNational`) y `registerAnother` restablece el país a `PE`
- [X] T014 [P] [US1] Editar `src/components/registration/WelcomeDialog.tsx`: mostrar el celular con `formatPhoneDisplay(phone)` y actualizar el comentario de la prop `phone` (ahora E.164)
- [X] T015 [P] [US1] Editar `src/services/participants.service.ts`: `listParticipants()` devuelve `phone: String(data.phone ?? doc.id)` (E.164 completo, sin `toNational`) y quitar el import de `toNational`; actualizar los comentarios (`registerParticipant` ya usa `input.phone` como ID del documento: no cambia su lógica) y `ParticipantListItem.phone` / `Participant.phone` en `src/types/index.ts` (E.164 con cualquiera de los 12 prefijos)
- [X] T016 [P] [US1] Editar `src/lib/search.ts`: `Searchable.phone` es E.164 (o el valor antiguo) y `filterParticipants` compara `phoneDigits(consulta)` con `phoneDigits(row.phone)` (`includes`) **solo si la consulta tiene al menos un dígito** (con `""`, `includes` sería verdadero para todas las filas; conservar la guarda `phoneQuery !== ""` del código actual); eliminar `phoneQueryDigits` y su caso especial `+51`; actualizar los comentarios
- [X] T017 [US1] Editar `src/components/admin/ParticipantsTable.tsx`: la celda de celular usa `formatPhoneDisplay(row.phone)`; la clave de fila sigue siendo `row.phone`
- [X] T018 [US1] Editar (después de T015: ambas tareas modifican `src/types/index.ts`) `src/services/spins.service.ts` (línea del snapshot `winner.phone`): guardar `String(participant.phone ?? participantSnap.id)` en E.164 en lugar de `toNational(...)` y quitar el import; editar `src/components/admin/WinnerHistory.tsx` para mostrar `formatPhoneDisplay(record.phone)`; actualizar el comentario de `WinnerRecord.phone` en `src/types/index.ts` (E.164, o 9 dígitos en giros y rondas anteriores, que se leen como Perú)
- [X] T019 [P] [US1] Editar `src/lib/csv.ts` y `src/app/api/admin/participants/export/route.ts`: el encabezado «Celular» pasa a «Celular (con código de país)» y la celda usa `escapeCell(formatPhoneCsv(row.phone))` (sin `neutralizeFormula`: no empieza con `+`); `CsvRow.phone` es el E.164; la clave de ganadores antiguos usa `peruNational(participant.phone)` (si es `null`, no busca en `byLegacyPhone`). Las pruebas de CSV y exportación ya se actualizaron en T009 y T010 y deben pasar con este cambio

**Checkpoint**: US1 completa. Los tests de T003, T006 a T010 pasan; el escenario 1 a 3 del quickstart se cumple.

---

## Phase 4: User Story 2 - Indicar interés en el CRM con Agente IA (Priority: P1)

**Goal**: casilla opcional «¿Deseas adquirir el CRM con Agente IA?» guardada como `crmInterest`; el administrador
la ve en la tabla (Sí/No), filtra «solo interesados» y la exporta en el CSV (FR-101 a FR-105).

**Independent Test**: registrar a una persona marcando la casilla y a otra sin marcarla; en `/admin` la columna
muestra Sí/No, el filtro deja solo a la primera y el CSV trae la columna «Interesado en CRM» (quickstart
escenario 4).

**Dependencia**: comparte archivos con US1 (`schemas.ts`, `RegistrationForm.tsx`, `participants.service.ts`,
`ParticipantsTable.tsx`, `csv.ts` y sus pruebas); hacerla **después** de US1.

### Tests for User Story 2 (escribir primero; deben fallar) ⚠️

- [X] T020 [P] [US2] Actualizar `tests/unit/schemas.test.ts`: `crmInterest` ausente = `false`; `true`/`false` se conservan; un valor no booleano (`"si"`) se rechaza
- [X] T021 [P] [US2] Actualizar `tests/integration/registrations.route.test.ts`, `tests/integration/duplicates.test.ts` y `tests/integration/participants.list.test.ts`: el registro con `crmInterest: true` guarda `crmInterest: true` en el documento y sin el campo guarda `false`; un segundo intento duplicado con `crmInterest: true` responde 409 y **no cambia** la respuesta guardada (`false`); `listParticipants()` devuelve `crmInterest` y un documento creado sin el campo (formato anterior) da `false`
- [X] T022 [P] [US2] Actualizar `tests/unit/csv.test.ts` y `tests/integration/export.route.test.ts`: el encabezado es `Nombres,Celular (con código de país),Empresa u ocupación,Interesado en CRM,Fecha de registro,Premio,N.º de ganador,Estado`; la celda es `Sí` o `No`; un participante sin el campo sale como `No`
- [X] T023 [P] [US2] Actualizar `tests/integration/spins.route.test.ts` (o `tests/integration/spins.test.ts`): la respuesta del giro y la lista de la ruleta **no** contienen `crmInterest`. Actualizar `tests/e2e/registration.spec.ts` (la casilla «¿Deseas adquirir el CRM con Agente IA?» aparece desmarcada y se puede enviar con y sin marcar) y `tests/e2e/admin-access.spec.ts` (columna «CRM» con Sí/No y la casilla «Solo interesados en el CRM» deja solo a quien marcó, combinada con la búsqueda)

### Implementation for User Story 2

- [X] T024 [US2] Editar `src/lib/validation/schemas.ts`: agregar a `registrationSchema` el campo `crmInterest: z.boolean({ error: "La respuesta no es válida." }).default(false)`; la salida (`RegistrationInput`) incluye `crmInterest: boolean`
- [X] T025 [P] [US2] Editar `src/types/index.ts`: agregar `crmInterest: boolean` a `Participant` y a `ParticipantListItem`, con el comentario «`true` si marcó el interés en el CRM con Agente IA; ausente en documentos anteriores = `false`»
- [X] T026 [US2] Editar `src/services/participants.service.ts`: `registerParticipant` agrega `crmInterest: input.crmInterest` al `transaction.create` y `listParticipants` devuelve `crmInterest: data.crmInterest === true`. No tocar la ruta de duplicado (el `create` falla sin escribir)
- [X] T027 [P] [US2] Crear `src/components/ui/CheckboxField.tsx` (`forwardRef`, compatible con `register`): `<input type="checkbox">` de 20 px con `accent-ink-900`, `<label>` clicable de al menos 44 px de alto con el texto recibido, `description?` opcional y foco visible; solo tokens de color
- [X] T028 [US2] Editar `src/components/registration/RegistrationForm.tsx`: agregar `<CheckboxField label="¿Deseas adquirir el CRM con Agente IA?" {...register("crmInterest")} />` entre «Empresa u ocupación» y el botón, con `defaultValues.crmInterest: false`
- [X] T029 [US2] Editar `src/components/admin/ParticipantsTable.tsx`: columna «CRM» con `Sí`/`No`, casilla «Solo interesados en el CRM» (estado local, aplicada antes de `filterParticipants`, reinicia la paginación y se anuncia en «Coincidencias: N»); el mensaje «No hay resultados» sigue valiendo
- [X] T030 [US2] Editar `src/lib/csv.ts`: agregar `crmInterest: boolean` a `CsvRow`, la columna «Interesado en CRM» entre «Empresa u ocupación» y «Fecha de registro» con `Sí`/`No`, y actualizar el comentario del encabezado

**Checkpoint**: US1 y US2 funcionan; escenario 4 del quickstart se cumple y `crmInterest` no aparece en la ruleta ni en la ventana del ganador.

---

## Phase 5: User Story 3 - Girar la ruleta sin ventana de confirmación (Priority: P2)

**Goal**: «Girar» gira de inmediato; el primer giro real cierra las inscripciones dentro de la misma transacción;
la práctica no cierra nada (FR-106 a FR-108).

**Independent Test**: con inscripciones abiertas, pulsar «Girar»: sin ventana, la ruleta gira y al terminar las
inscripciones figuran cerradas (quickstart escenario 5).

### Tests for User Story 3 (escribir primero; deben fallar) ⚠️

- [X] T031 [P] [US3] Actualizar `tests/integration/spins.test.ts`: quitar los casos de `ConfirmationRequiredError`; agregar «con inscripciones abiertas `spin({ prizeId }, ADMIN)` gira y deja `settings/registration.open === false`», «con inscripciones cerradas gira y no cambia `updatedAt` de `settings/registration`», «si el giro falla (premio agotado o sin elegibles) las inscripciones siguen abiertas» y «el modo de práctica no cierra inscripciones ni escribe en Firestore»
- [X] T032 [P] [US3] Actualizar `tests/integration/spins.route.test.ts` y `tests/unit/schemas.test.ts`: `POST /api/admin/spins` con `{ prizeId }` y las inscripciones abiertas responde 201 (ya no 409 `CONFIRMATION_REQUIRED`); un cuerpo antiguo con `confirmCloseRegistration: true` sigue dando 201 (la clave se ignora); `spinRequestSchema.parse({ prizeId: "p1" })` devuelve `{ prizeId: "p1" }`
- [X] T033 [P] [US3] Actualizar `tests/e2e/draw.spec.ts`: con las inscripciones abiertas, «Girar para: …» inicia el giro **sin** ningún diálogo «Se cerrarán las inscripciones»; al terminar, `/` muestra el aviso de cierre; el modo de práctica deja las inscripciones abiertas; tras el giro real, el control de inscripciones de `/admin/campana` (`RegistrationToggle`) permite reabrirlas y `/` vuelve a mostrar el QR (FR-108); **tiempo de inicio (SC-034)**: tras pulsar «Girar», el letrero del nombre bajo el puntero (`aria-hidden`, dentro de `section[aria-label="Nombre bajo el puntero"]`) muestra un nombre no vacío en 2 000 ms o menos (`expect(...).not.toHaveText("", { timeout: 2000 })`), lo que indica que la ruleta ya se mueve

### Implementation for User Story 3

- [X] T034 [US3] Editar `src/lib/validation/schemas.ts`: `spinRequestSchema` queda `z.object({ prizeId: z.string({ error: "Elige un premio." }).min(1, "Elige un premio.") })` (sin `confirmCloseRegistration`) y actualizar su comentario
- [X] T035 [US3] Editar `src/services/spins.service.ts`: eliminar `ConfirmationRequiredError`, el parámetro `confirmCloseRegistration` de `commitSpin` y `spin`, y su comprobación; **conservar** el cierre dentro de la transacción (`if (registrationOpen) transaction.set(registrationRef, { open: false, … })`) y actualizar los comentarios (FR-089 → FR-107)
- [X] T036 [P] [US3] Editar `src/app/api/admin/spins/route.ts`: quitar el import y la rama de `ConfirmationRequiredError`; mantener `invalidatePublicStatus()` tras un giro real; editar `src/types/index.ts` para eliminar `"CONFIRMATION_REQUIRED"` de `ApiErrorCode`
- [X] T037 [US3] Editar `src/components/admin/DrawStage.tsx`: eliminar la fase `"confirming"` de `Phase`, el `<Dialog>` «Se cerrarán las inscripciones», el estado `closedBySpin` (y su `setClosedBySpin`), la prop `registrationOpen` de `DrawStageProps`, la rama `CONFIRMATION_REQUIRED` de `startSpin`, el parámetro `confirmClose` (el cuerpo es siempre `{ prizeId: activePrize?.id }`), el import de `Dialog` si queda sin uso y `handleSpinClick` (llama directo a `void startSpin()`); actualizar el comentario de cabecera (FR-089 → FR-106)
- [X] T038 [P] [US3] Editar `src/app/admin/(panel)/sorteo/page.tsx`: dejar de pasar `registrationOpen={registration.open}` a `DrawStage` y quitar la lectura del estado de inscripciones si queda sin uso

**Checkpoint**: US3 completa; `grep -rn "confirmCloseRegistration\|ConfirmationRequired\|CONFIRMATION_REQUIRED" src` solo puede devolver comentarios históricos de specs (no código).

---

## Phase 6: User Story 4 - Nueva identidad visual: QR, logos y ruleta (Priority: P2)

**Goal**: QR ≈ 15 % menor, logos ≈ 20–25 % mayores en la pantalla del QR y ruleta completa con los colores de la
«A» del logo, sin vecinos del mismo color y con texto AA (FR-109 a FR-113).

**Independent Test**: abrir `/` en 360 px, 1366×768 y 1920×1080 y `/admin/sorteo` con 3, 4, 7 y 13 participantes
(quickstart escenarios 6 y 7).

**Dependencia**: T045 edita `DrawStage.tsx` (el letrero), que también modifica US3 ⇒ hacerla **después** de US3. El resto de la historia (QR, logos, paleta y ruleta) no depende de las demás.

### Tests for User Story 4 (escribir primero; deben fallar) ⚠️

- [X] T039 [P] [US4] Actualizar `tests/unit/wheel.test.ts`: `PALETTE` es exactamente `[{wheel-purple→paper},{wheel-lavender→paper},{wheel-cyan→ink-900}]`; `segmentColorIndexes` devuelve índices `0..2` y **nunca** deja dos vecinos con el mismo fondo, incluida la unión último-primero, para `count` ∈ {3, 4, 5, 6, 7, 8, 12, 13, 19, 50, 101, 500, 5000}; `count = 1` → `[0]` y `count = 2` → `[0, 1]`. Quitar las aserciones de los 6 colores negro/crema/dorado. **Contraste AA (FR-113, SC-036)**: leer de `src/app/globals.css` (con `node:fs`, como hace `no-hardcoded-colors.test.ts`) los valores de `--color-wheel-purple`, `--color-wheel-lavender`, `--color-wheel-cyan`, `--color-paper` y `--color-ink-900`, calcular la razón de contraste WCAG de cada par `background`/`text` de `PALETTE` y comprobar que es ≥ 4,5, y lo mismo para el letrero (`paper` sobre `wheel-purple`); y que `wheel-cyan` sobre `wheel-purple` (pines) sea ≥ 3
- [X] T040 [P] [US4] Actualizar `tests/e2e/qr-screen.spec.ts`: en 1920×1080 y 1366×768 el QR mide ≈ 85 % del tamaño anterior (≤ 280 px de ancho a 1366×768 y ≤ 545 px a 1920×1080, y ≥ 14 rem), los logos aliados miden ≥ 48 px de alto (≥ 44 px a 360 px) y el logo Creando Valor 88 px; la pantalla cabe sin desplazamiento vertical en esos dos tamaños; a 360 px no hay desplazamiento horizontal (`scrollWidth <= clientWidth`) y los logos aliados quedan en una sola fila. Conservar las pruebas de orden vertical, centrado y sin hueco
- [X] T041 [P] [US4] Actualizar `tests/e2e/presentation.spec.ts`: con la ruleta visible, el letrero del nombre tiene fondo del token morado (`background-color` = valor de `--color-wheel-purple`) y borde celeste, y el canvas se pinta (no vacío)

### Implementation for User Story 4

- [X] T042 [US4] Editar `src/app/globals.css`: agregar en `@theme static` los tokens `--color-wheel-purple: #524a99;`, `--color-wheel-lavender: #706baf;` y `--color-wheel-cyan: #23bcef;` (comentario: «Paleta de la “A” del logo de Creando Valor; uso exclusivo de la ruleta, constitución V»). Es el único archivo donde pueden vivir estos valores
- [X] T043 [US4] Editar `src/lib/wheel.ts`: `ColorToken` y `PALETTE` según el contrato (3 entradas), actualizar el comentario de la paleta y comprobar que `segmentColorIndexes` sigue resolviendo la unión último-primero con 3 colores (reasignar al primer índice cuyo fondo difiera del anterior y del primero)
- [X] T044 [US4] Editar `src/components/admin/RouletteWheel.tsx`: `TokenName`/`TOKEN_NAMES` pasan a `["wheel-purple", "wheel-lavender", "wheel-cyan", "paper", "ink-900"]`; en `paintWheel`: aro con banda exterior `wheel-purple`, filete `wheel-lavender`, banda interior `wheel-purple`, ruleta vacía con disco `paper`, divisores `paper`, pines `wheel-cyan`; en `paintOverlay`: aro del buje `wheel-purple`, disco del buje `paper`, puntero relleno `wheel-purple` con borde `paper`. Quitar toda referencia a `gold-*`, `ink-300` y `paper-soft`; actualizar los comentarios («negro/dorado» → «morado/celeste»)
- [X] T045 [US4] Editar `src/components/admin/DrawStage.tsx` (`pointerNameBox`): reemplazar `border-gold-600 bg-gold-100` y el texto `text-ink-900` por `border-wheel-cyan bg-wheel-purple` y `text-paper` (contraste 7,5:1); no cambiar botones, tarjetas ni ventana del ganador
- [X] T046 [P] [US4] Editar `src/app/page.tsx`: `Logo size={88}` en la cabecera y el tope del QR a `max-w-[min(100%,max(14rem,calc((100dvh-28rem)*0.85)))]`; actualizar el comentario (28 rem de reserva para lo que no es el QR; el QR ocupa el 85 % del resto, mínimo 14 rem)
- [X] T047 [P] [US4] Editar `src/components/ui/PartnerLogos.tsx`: alto `h-11 sm:h-12 md:h-15` en ambas imágenes, espacio `gap-x-4 sm:gap-x-10`, atributos `width`/`height` coherentes con el mayor tamaño (Satelcom 189×60, Cautiva 231×60) y comentario con la razón (research D-311: a 360 px caben en una fila). Comprobar a mano que `/registro` sigue bien con el componente compartido

**Checkpoint**: US4 completa; `tests/unit/no-hardcoded-colors.test.ts` sigue pasando (los hex nuevos solo están en `globals.css`).

---

## Phase 7: User Story 5 - Seguir las redes sociales al terminar el registro (Priority: P3)

**Goal**: la tarjeta «¡Gracias por registrarte!» muestra «Síguenos en nuestras redes sociales» con los enlaces de
Facebook de Cautiva Marketing y Satelcom del Sur (FR-114, FR-115).

**Independent Test**: terminar un registro con «Listo, muchas gracias» y comprobar texto y enlaces (quickstart
escenario 8).

### Tests for User Story 5 (escribir primero; deben fallar) ⚠️

- [X] T048 [P] [US5] Crear `tests/unit/social-links.test.ts`: `SOCIAL_LINKS` tiene exactamente dos entradas, «Cautiva Marketing» → `https://www.facebook.com/cautivamarketingperu` y «Satelcom del Sur» → `https://www.facebook.com/satelcomdelsur`, ambas `https:`
- [X] T049 [P] [US5] Actualizar `tests/e2e/registration.spec.ts`: tras «Listo, muchas gracias» la tarjeta contiene «Síguenos en nuestras redes sociales» y dos enlaces con esos nombres, con `target="_blank"` y `rel` que incluye `noopener` y `noreferrer`, alcanzables con Tab y con un área táctil de al menos 44 px de alto (`boundingBox().height >= 44`); el aviso de cierre y la ventana «ya registrado» no los muestran

### Implementation for User Story 5

- [X] T050 [P] [US5] Crear `src/lib/social-links.ts` exportando `SOCIAL_LINKS: ReadonlyArray<{ name: string; href: string }>` con las dos páginas de Facebook
- [X] T051 [P] [US5] Editar `src/components/ui/icons.tsx`: agregar `FacebookIcon` (SVG decorativo con `aria-hidden`, hereda `currentColor`, mismas props que los demás íconos)
- [X] T052 [US5] Editar `src/components/registration/ThanksPanel.tsx` (sigue siendo Server Component): bajo el mensaje, un bloque con el texto «Síguenos en nuestras redes sociales» y una lista de enlaces generada desde `SOCIAL_LINKS`, cada uno con `FacebookIcon`, `target="_blank"`, `rel="noopener noreferrer"`, `min-h-11` de alto táctil, foco visible y solo tokens de color; el nombre accesible es el texto visible de la marca

**Checkpoint**: US5 completa; los enlaces se activan con teclado y abren en pestaña nueva.

---

## Phase 8: User Story 6 - Ventanas del panel sin desenfoque (Priority: P3)

**Goal**: las ventanas emergentes del panel de administración oscurecen el fondo sin desenfocarlo; las del
formulario público no cambian (FR-116, FR-117).

**Independent Test**: abrir las ventanas del panel y comprobar que el fondo no se desenfoca; las del formulario
público conservan el desenfoque (quickstart escenario 9).

**Dependencia**: edita `WelcomeDialog.tsx` (también tocado en US1); hacerla **después** de US1.

### Tests for User Story 6 (escribir primero; deben fallar) ⚠️

- [X] T053 [P] [US6] Actualizar `tests/e2e/design.spec.ts` (con el ayudante de `tests/e2e/helpers/admin.ts`): en `/admin`, al abrir una ventana del panel (descartar ganador, borrar datos o premios) `getComputedStyle(dialog, "::backdrop").backdropFilter` es `none`; en `/registro`, la ventana de bienvenida y la de «ya registrado» tienen un `backdropFilter` con `blur`; en ambos casos Escape cierra la ventana y el foco queda contenido

### Implementation for User Story 6

- [X] T054 [US6] Editar `src/components/ui/Dialog.tsx`: nueva prop opcional `blurBackdrop?: boolean` (por defecto `false`); la clase del `<dialog>` incluye `backdrop:bg-ink-900/50` siempre y `backdrop:backdrop-blur-[2px]` **solo** cuando `blurBackdrop` es `true` (escribir ambas cadenas completas para que Tailwind las detecte); documentar la prop en el comentario del componente
- [X] T055 [P] [US6] Editar `src/components/registration/WelcomeDialog.tsx` y `src/components/registration/AlreadyRegisteredDialog.tsx`: pasar `blurBackdrop` al `<Dialog>`. No pasar nada en `src/components/admin/WinnerDialog.tsx`, `DiscardWinnerButton.tsx`, `PrizePanel.tsx` ni `PurgeDialog.tsx` (heredan «sin desenfoque»)

**Checkpoint**: US6 completa; todas las historias funcionan de forma independiente.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: limpieza de lo temporal, reglas y puertas de calidad de la constitución.

- [X] T056 [P] Editar `tests/rules/firestore.rules.test.ts`: agregar un caso con el ID `participants/+56912345678` (existente y nuevo) que confirme que anónimos y administradores no pueden leer, listar, actualizar ni borrar, igual que `+51…`
- [X] T057 [P] Buscar y corregir referencias residuales al formato anterior: `grep -rn "toNational\|formatNationalPhone\|9 dígitos, por ejemplo\|987 654 321" src tests` (los ejemplos de pruebas con `987654321` como número local son válidos; revisar los demás) y los textos «nombre y apellido» en `src/` y `tests/`
- [X] T058 [P] Verificar que `crmInterest` no se registra en logs ni viaja a la ruleta: `grep -rn "crmInterest" src` solo debe aparecer en esquema, tipos, `participants.service.ts`, `RegistrationForm.tsx`, `CheckboxField` (si aplica), `ParticipantsTable.tsx` y `csv.ts`
- [X] T059 Cuando T003 a T057 estén verdes, quitar las exportaciones `toNational` y `formatNationalPhone` de `src/lib/validation/phone.ts` y sus `describe` en `tests/unit/phone.test.ts`; confirmar con `npm run typecheck` que nadie las usa
- [X] T060 Quitar el bloque temporal «SYNC IMPACT REPORT» (comentario HTML) al inicio de `.specify/memory/constitution.md` antes de integrar los cambios, sin tocar el resto de la constitución
- [X] T061 Ejecutar las puertas de calidad en este orden y corregir lo que falle: `npm run typecheck` · `npm run lint` · `npm run format` seguido de `npm run format:check` · `npm run test:unit` · `npm run test:rules` · `npm test` · `npm run test:e2e`
- [X] T062 Ejecutar `npm run perf` (Lighthouse móvil sobre `/registro` y `/`) y confirmar Performance y Accessibility ≥ 90 (SC-038); si el selector o la casilla bajan la nota, corregirlo antes de cerrar
- [ ] T063 Recorrer los 9 escenarios de `specs/004-ajustes-registro-ruleta/quickstart.md` en un teléfono de 360 px y en un monitor de 1920×1080 (incluido el escaneo del QR a ≈ 3 m) y anotar cualquier desvío de tamaños de QR/logos para ajustarlo a la vista (research D-311)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup; **bloquea** todas las historias (los países y la normalización de celular).
- **User Stories (Phase 3 a 8)**: todas dependen de Foundational. Orden recomendado por prioridad: US1 → US2 → US3 → US4 → US5 → US6.
- **Polish (Phase 9)**: depende de las historias que se quieran entregar; T059 exige que todos los consumidores
  de `toNational`/`formatNationalPhone` estén migrados (US1).

### User Story Dependencies

- **US1 (P1)**: tras Foundational; sin dependencias de otras historias. **MVP.**
- **US2 (P1)**: tras Foundational; comparte `schemas.ts`, `RegistrationForm.tsx`, `participants.service.ts`,
  `ParticipantsTable.tsx`, `csv.ts` y varias pruebas con US1 ⇒ ejecutarla **después** de US1 (o coordinar esos
  archivos si se hace en paralelo).
- **US3 (P2)**: tras Foundational; independiente de US1/US2 salvo `schemas.ts` y `types/index.ts` (ediciones
  pequeñas en otras secciones).
- **US4 (P2)**: tras Foundational; el letrero (T045) toca `DrawStage.tsx` ⇒ después de US3.
- **US5 (P3)**: tras Foundational; independiente.
- **US6 (P3)**: tras Foundational; `WelcomeDialog.tsx` también lo toca US1 ⇒ después de US1.

### Within Each User Story

- Las pruebas se escriben primero y deben **fallar** antes de implementar.
- Esquemas y tipos → servicios → componentes → páginas.
- Historia completa y con su checkpoint antes de pasar a la siguiente prioridad.

### Parallel Opportunities

- Dentro de Foundational: T003 (prueba) puede escribirse mientras se prepara T004; T004 antes de T005.
- Dentro de cada historia, las tareas de prueba marcadas [P] (archivos distintos) van en paralelo; y en
  implementación las marcadas [P] (T012, T014, T015, T016, T019 en US1; T025 y T027 en US2; T036 y T038 en
  US3; T046 y T047 en US4; T050 y T051 en US5; T055 en US6).
- US3, US5 y (con cuidado en `DrawStage.tsx`) US4 pueden avanzar en paralelo con US1/US2 si hay más de una persona.

---

## Parallel Example: User Story 1

```bash
# Pruebas de US1 en paralelo (archivos distintos):
Task: "Actualizar tests/unit/schemas.test.ts (registrationSchema, un solo nombre, país)"            # T006
Task: "Actualizar tests/integration/registrations.route.test.ts (Chile, país por defecto)"          # T007
Task: "Actualizar tests/integration/duplicates.test.ts (dos países, 0 troncal)"                     # T008
Task: "Actualizar tests/unit/search.test.ts y tests/integration/participants.list.test.ts"          # T009
Task: "Actualizar tests/e2e/registration.spec.ts y duplicate.spec.ts"                               # T010

# Implementación de US1 en paralelo tras T011 (esquema):
Task: "Crear src/components/registration/PhoneField.tsx"                                           # T012
Task: "Editar src/components/registration/WelcomeDialog.tsx (formatPhoneDisplay)"                   # T014
Task: "Editar src/services/participants.service.ts y src/types/index.ts"                           # T015
Task: "Editar src/lib/search.ts"                                                                    # T016
Task: "Editar src/lib/csv.ts y la ruta de exportación"                                             # T019
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1: Setup (T001–T002).
2. Phase 2: Foundational (T003–T005) — países y normalización de celular.
3. Phase 3: US1 (T006–T019).
4. **STOP and VALIDATE**: `npm run test:unit`, `npm test`, y los escenarios 1 a 3 del quickstart. Desplegable ya: permite registrar a asistentes de Chile y de Sudamérica con un solo nombre.

### Incremental Delivery

1. Setup + Foundational → base lista.
2. US1 → probar → demo (MVP: registro inclusivo).
3. US2 → probar → demo (dato comercial del CRM).
4. US3 → probar (giro directo en el evento) · US4 → probar (marca) · US5 → probar (redes) · US6 → probar (panel liviano).
5. Polish (T056–T063): limpieza, reglas, puertas de calidad, Lighthouse y recorrido manual.

### Parallel Team Strategy

Con varias personas, tras Foundational: A = US1 → US2 (comparten archivos); B = US3 → US4; C = US5; D = US6 (después de que A termine `WelcomeDialog.tsx`).

---

## Notes

- [P] tasks = archivos distintos, sin dependencias pendientes.
- La etiqueta [Story] vincula cada tarea con su historia para trazabilidad (US1…US6).
- Cada historia debe poder completarse y probarse por separado (salvo las dependencias de archivo indicadas).
- Verificar que las pruebas fallan antes de implementar; hacer commit tras cada tarea o grupo lógico.
- No se ejecuta `npm install`: la feature no agrega dependencias.
- Evitar: tareas vagas, conflictos de archivo entre tareas [P], y debilitar pruebas existentes para que pasen.
