---

description: "Task list for Preguntas del registro en dos pasos"
---

# Tasks: Preguntas del registro en dos pasos

**Input**: Design documents from `/specs/005-preguntas-registro/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/http-api.md, quickstart.md

**Tests**: INCLUIDAS. La constitución v2.2.0 (principio VI y puertas de calidad) exige pruebas unitarias de los
esquemas Zod y una prueba E2E del registro (éxito, duplicado y datos inválidos). Dentro de cada historia, las
pruebas se escriben primero y deben fallar antes de implementar. **No se debilita ninguna prueba existente**:
las que fijan el formato anterior (casilla booleana del CRM, encabezado «Interesado en CRM», envío en un solo
paso) se actualizan al nuevo comportamiento.

**Organization**: Tareas agrupadas por historia de usuario de la spec. Es un cambio sobre una aplicación ya
construida (features 001 a 004): casi todas las tareas **editan** archivos existentes. **Cero dependencias
nuevas** (no se ejecuta `npm install`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia de usuario a la que pertenece (US1…US3)
- Todas las rutas son relativas a la raíz del repo (`D:\Trabajos\Cautiva Marketing\sorteo`)

## Path Conventions

Aplicación Next.js única en la raíz: `src/app`, `src/components`, `src/lib`, `src/services`, `src/types`,
`tests/{unit,integration,rules,e2e}`. Solo `src/services/**` importa `firebase` o `firebase-admin`;
`src/lib/**` es lógica pura sin Firebase ni React. **Antes de escribir código de Next.js** (`AGENTS.md`): esta
versión tiene cambios incompatibles; lee la guía pertinente en `node_modules/next/dist/docs/`. Mensajes de
interfaz y de error en español (es-PE). **Sin colores literales** (`#rrggbb`, `rgb(`, `hsl(`, `oklch(`) fuera
de `src/app/globals.css`: usar clases de token (`bg-paper`, `text-ink-900`, `border-line`…). Las pruebas de
integración y E2E corren contra los emuladores (`npm test`, `npm run test:e2e`).

> **Cambio posterior a la implementación**: tras ver el paso 2 en un iPhone, las dos preguntas de interés
> pasaron de grupos de radios a **desplegables** (`SelectField`, primera opción «Elige una opción») para que
> el formulario no se alargue. `RadioGroupField` se eliminó y T016, T019 y el helper
> `tests/e2e/helpers/registration.ts` se adaptaron; las referencias a radios de arriba son históricas.

## Contratos de módulos (referencia para todas las tareas)

Firmas y textos que comparten varias tareas; no cambiarlos sin actualizar las demás.

- **`src/types/index.ts`**:
  - `type Interest = "yes" | "maybe" | "no"`.
  - `Participant` y `ParticipantListItem`: `crmInterest: Interest` (antes `boolean`), `gpsInterest: Interest | null`.
    `Participant` añade además `trainingArea: string` y `guestSuggestion: string`.
  - `interface ParticipantExportRow extends ParticipantListItem { trainingArea: string; guestSuggestion: string }`.
  - `ParticipantListItem` **no** lleva los textos libres. `WheelParticipant`, `SpinResult`, `PracticeResult` y
    `WinnerRecord` **no cambian**.
- **`src/lib/interest.ts`** (nuevo, puro, sin Firebase ni React):
  - `INTEREST_VALUES: readonly ["yes", "maybe", "no"]`.
  - `interestLabel(value: Interest | null): string` → `"Sí"` / `"Tal vez"` / `"No"` / `"Sin respuesta"` (`null`).
  - `interestCsvLabel(value: Interest | null): string` → igual pero `""` para `null`.
  - `CRM_OPTIONS` y `GPS_OPTIONS: readonly { value: Interest; label: string }[]`, en este orden: CRM «Sí, me
    interesa» · «Tal vez, envíenme más información» · «No, por ahora»; GPS «Sí, me interesa» · «Tal vez,
    envíenme una cotización» · «No, por ahora».
  - `type InterestFilter = "all" | Interest | "none"` y
    `matchesInterestFilter(value: Interest | null, filter: InterestFilter): boolean` (`"all"` coincide con todo;
    `"none"` solo con `null`).
  - `CRM_FILTER_OPTIONS` y `GPS_FILTER_OPTIONS: readonly { value: InterestFilter; label: string }[]`:
    CRM → Todas · Sí · Tal vez · No (sin «Sin respuesta»: el CRM de un participante anterior siempre es Sí o No);
    GPS → Todas · Sí · Tal vez · No · Sin respuesta.
  - `normalizeStoredInterest(value: unknown): Interest` — para `crmInterest` guardado: `"yes" | "maybe" | "no"`
    pasan tal cual; `true` ⇒ `"yes"`; `false`, ausente o cualquier otro valor ⇒ `"no"`.
  - `normalizeStoredOptionalInterest(value: unknown): Interest | null` — para `gpsInterest`: solo
    `"yes" | "maybe" | "no"` pasan; cualquier otro valor o ausente ⇒ `null`.
- **`src/lib/validation/schemas.ts`**:
  - `ANSWER_MIN = 2`, `ANSWER_MAX = 100`.
  - `answerSchema(messages)` (privado): `z.string()` → NFC → **cualquier espacio en blanco (saltos de línea y
    tabulaciones incluidos) pasa a un espacio simple y se recorta** → rechaza caracteres de control restantes
    (`\p{Cc}`) → `min(2)` → `max(100)`. Mensajes — `trainingArea`: requerido/mínimo «Cuéntanos en qué área te
    gustaría capacitarte (mínimo 2 caracteres).»; `guestSuggestion`: «Cuéntanos qué invitado te gustaría que
    trajéramos (mínimo 2 caracteres).»; máximo común «La respuesta no puede pasar de 100 caracteres.»; control:
    «La respuesta no puede contener caracteres especiales de control.»
  - `interestSchema`: `z.enum(["yes", "maybe", "no"], { error: "Elige una opción." })`, **sin `default`**.
  - `registrationSchema`: los campos de la 004 (`fullName`, `country` con `default("PE")`, `phone`, `company`) más
    `trainingArea`, `guestSuggestion`, `crmInterest`, `gpsInterest` **obligatorios**; **desaparece** el
    `crmInterest` booleano con `default(false)`. La salida sigue normalizando `phone` a E.164.
  - `registrationCheckSchema`: `{ country, phone }` con la **misma** regla de celular (la refinación de
    `registrationSchema` se extrae a una función compartida); salida: `{ phone }` en E.164.
  - Tipos `RegistrationFormInput` y `RegistrationInput` se derivan de `registrationSchema`.
- **`src/services/participants.service.ts`**:
  - `registerParticipant(input: RegistrationInput): Promise<void>` — igual que hoy (transacción: cierre → `create`),
    pero guarda `trainingArea`, `guestSuggestion`, `crmInterest` y `gpsInterest`.
  - `checkRegistrationAvailable(phone: string): Promise<void>` — **nuevo**; `getDb().getAll(settingsRef,
    participantRef)`, sin transacción y **sin escribir**; lanza `RegistrationClosedError` si
    `settings/registration.open === false` y, si no, `AlreadyRegisteredError` si el documento existe.
  - `listParticipants(): Promise<ParticipantListItem[]>` — añade `crmInterest: normalizeStoredInterest(...)` y
    `gpsInterest: normalizeStoredOptionalInterest(...)`; **no** devuelve textos libres.
  - `listParticipantsForExport(): Promise<ParticipantExportRow[]>` — **nuevo**; lo mismo más
    `trainingArea: String(data.trainingArea ?? "")` y `guestSuggestion: String(data.guestSuggestion ?? "")`.
- **`src/components/ui/RadioGroupField.tsx`** (nuevo): props `legend: string`, `options: readonly { value: string;
  label: string }[]`, `error?: string`, más el resultado de `register("campo")` (`name`, `onChange`, `onBlur` y
  `ref`), que se aplica a **cada** `<input type="radio">` del grupo (no solo al primero: React Hook Form necesita
  el `ref` de todos los radios para leer cuál está marcado y enfoca el primero cuando el grupo tiene un error).
  `<fieldset>` + `<legend>`; cada opción es un radio con `<label>` clicable de ≥ 44 px; ninguna opción marcada
  por defecto; error con `aria-describedby` y `aria-live="polite"` como `TextField`.
- **`src/components/ui/SelectField.tsx`** (nuevo): props `label`, `options: readonly { value: string; label:
  string }[]`, `value`, `onChange(value: string)`; etiqueta visible asociada a un `<select>` nativo (≥ 44 px).
- **`src/components/registration/StepProgress.tsx`** (nuevo): props `step: 1 | 2`, `total: 2`; muestra «Paso N de
  2» dentro de una región `aria-live="polite"`.
- **Textos de la interfaz** (paso 1 «Tus datos», botón «Siguiente»; paso 2 «Cuéntanos un poco más», botones
  «Atrás» y «Enviar y participar»): preguntas 1 «¿En qué área te gustaría capacitarte?», 2 «¿Qué invitado te
  gustaría que trajéramos a Creando Valor?», 3 «¿Deseas adquirir el CRM con Agente IA de Cautiva?», 4 «¿Te
  interesa un GPS satelital o una cámara para tu vehículo (Satelcom)?».

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: confirmar el punto de partida; no hay estructura ni dependencias nuevas.

- [X] T001 Leer en `node_modules/next/dist/docs/` la guía de Route Handlers (`app/api/**/route.ts`) y revisar `src/app/api/registrations/route.ts` y `src/lib/http.ts` (`assertSameOrigin`, `errorResponse`, `zodToFieldErrors`): el endpoint nuevo `check` debe seguir ese mismo patrón.
- [X] T002 Comprobar el punto de partida limpio antes de cambiar nada: `npm run typecheck`, `npm run lint` y `npm run test:unit` pasan en `main` (anota cualquier fallo preexistente para no confundirlo con regresiones).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: dominio de interés, esquema compartido, capa de datos y fixtures. Todo lo demás depende de esto.

**⚠️ CRITICAL**: ninguna historia puede empezar hasta cerrar esta fase. Al terminar, `tsc --noEmit`, ESLint y las
pruebas unitarias vuelven a estar en verde (las pruebas de integración y E2E de registro se actualizan en las
historias).

- [X] T003 [P] Crear `tests/unit/interest.test.ts` (debe fallar primero): `INTEREST_VALUES` es `["yes","maybe","no"]`; `interestLabel` devuelve «Sí», «Tal vez», «No» y «Sin respuesta» para `null`; `interestCsvLabel(null)` es `""`; `CRM_OPTIONS` y `GPS_OPTIONS` tienen exactamente 3 opciones en el orden y con los textos del contrato (incluidos «…más información» frente a «…una cotización»); `matchesInterestFilter` para cada combinación de valor (`yes`, `maybe`, `no`, `null`) y filtro (`all`, `yes`, `maybe`, `no`, `none`); `CRM_FILTER_OPTIONS` ofrece Todas, Sí, Tal vez y No (sin «Sin respuesta») y `GPS_FILTER_OPTIONS` ofrece además «Sin respuesta»; `normalizeStoredInterest`: `"yes"`/`"maybe"`/`"no"` tal cual, `true`→`"yes"`, `false`/`undefined`/`null`/`"si"`/`1`→`"no"`; `normalizeStoredOptionalInterest`: los tres valores tal cual y `undefined`/`null`/`true`/`"si"`→`null`.
- [X] T004 [P] Actualizar `tests/unit/schemas.test.ts` (deben fallar primero): el objeto base `valid` suma `trainingArea`, `guestSuggestion`, `crmInterest: "no"` y `gpsInterest: "no"`; reemplazar el bloque `crmInterest` booleano y las pruebas que listan las claves de salida (`["company","crmInterest","fullName","phone"]`) por las nuevas claves; casos nuevos: `trainingArea`/`guestSuggestion` aceptan 2 y 100 caracteres y rechazan vacío, solo espacios, 1 carácter y 101 caracteres con los mensajes del contrato; un texto con saltos de línea, tabulaciones y espacios repetidos se normaliza a una sola línea («Ventas\n  y   marketing» → «Ventas y marketing»); un carácter de control (`\u0007`) se rechaza; `crmInterest` y `gpsInterest` aceptan `"yes"`, `"maybe"`, `"no"` y rechazan ausente, `null`, `""`, `"si"`, `true` (el cuerpo antiguo) con «Elige una opción.»; el cuerpo anterior sin las cuatro respuestas ya **no** es válido (reemplaza «sigue aceptando el cuerpo anterior»); un `safeParse({})` informa a la vez nombre, celular, empresa y las cuatro respuestas; `registrationCheckSchema`: acepta `{ phone: "987 654 321" }` (país por defecto `PE` ⇒ `+51987654321`), `{ country: "CL", phone: "9 1234 5678" }` ⇒ `+56912345678`, rechaza `{ country: "CL", phone: "812345678" }` con el mensaje de Chile y un `country` fuera de la lista; todos los mensajes de error siguen en español.
- [X] T005 [P] Actualizar `src/types/index.ts` según el contrato: agregar `Interest`; cambiar `Participant.crmInterest` y `ParticipantListItem.crmInterest` de `boolean` a `Interest`, agregar `gpsInterest: Interest | null` a ambos y `trainingArea`/`guestSuggestion` solo a `Participant`; agregar `ParticipantExportRow`. Documentar con comentarios que los documentos anteriores se normalizan al leer (`true`→`yes`, `false`/ausente→`no`; GPS ausente→`null`).
- [X] T006 Crear `src/lib/interest.ts` con todas las exportaciones del contrato (depende de T005; hace pasar T003). Sin literales de color ni dependencias de Firebase/React.
- [X] T007 Modificar `src/lib/validation/schemas.ts` (depende de T006; hace pasar T004): agregar `ANSWER_MIN`/`ANSWER_MAX`, `answerSchema`, `interestSchema` e incorporar `trainingArea`, `guestSuggestion`, `crmInterest` y `gpsInterest` a `registrationSchema` quitando el `crmInterest` booleano y la constante `CRM_MESSAGE`; extraer la refinación del celular (hoy dentro de `registrationSchema`, con `when: () => true` y `phoneErrorMessage`) a una función compartida y usarla en el nuevo `registrationCheckSchema` (exportado, con su tipo `RegistrationCheckInput`). Restricciones de datos, textuales: `trainingArea` y `guestSuggestion` «string, 2–100 caracteres, espacios colapsados»; `crmInterest` y `gpsInterest` `"yes" | "maybe" | "no"`, obligatorios y sin valor por defecto.
- [X] T008 Modificar `src/services/participants.service.ts` (depende de T005–T007): `registerParticipant` agrega `trainingArea: input.trainingArea`, `guestSuggestion: input.guestSuggestion`, `crmInterest: input.crmInterest` y `gpsInterest: input.gpsInterest` al `transaction.create` (sin otros campos); `listParticipants` devuelve `crmInterest: normalizeStoredInterest(data.crmInterest)` y `gpsInterest: normalizeStoredOptionalInterest(data.gpsInterest)` (sin textos libres); extraer el mapeo común y agregar `listParticipantsForExport()`. Actualizar el comentario de `listParticipants` (ya no solo «campos que muestra el panel»). Sin logs que incluyan datos personales.
- [X] T009 [P] Adaptar `src/lib/csv.ts` solo para que compile con los tipos nuevos (depende de T005, T006): `CsvRow.crmInterest: Interest` y la celda `interestCsvLabel(row.crmInterest)` en lugar de `row.crmInterest ? "Sí" : "No"`; el encabezado y las demás columnas se mantienen hasta US3.
- [X] T010 [P] Adaptar `src/components/admin/ParticipantsTable.tsx` solo para que compile (depende de T005, T006): el filtro actual pasa a `row.crmInterest === "yes"` y la celda a `interestLabel(row.crmInterest)`; las columnas y la casilla «Solo interesados en el CRM» se reemplazan en US3.
- [X] T011 [P] Actualizar `tests/e2e/helpers/emulators.ts`: `SeedParticipantInput` pasa a `crmInterest?: boolean | Interest` (un booleano escribe `booleanValue`, simulando un documento anterior; un texto escribe `stringValue`; ausente ⇒ no se escribe el campo) y suma `gpsInterest?: Interest`, `trainingArea?: string`, `guestSuggestion?: string`, escribiendo cada campo solo si viene definido.
- [X] T012 [P] Actualizar el fixture de `tests/rules/firestore.rules.test.ts` (línea del participante con `crmInterest: true`): usar `crmInterest: "yes"` y agregar `gpsInterest`, `trainingArea` y `guestSuggestion`; las aserciones de denegación no cambian (las reglas siguen `deny all`).
- [X] T013 Verificar la fase: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test:unit` y `npm run test:rules` en verde. Las pruebas de integración y E2E de registro todavía fallan o se actualizan en las fases siguientes (anótalo, no las debilites).

**Checkpoint**: dominio, esquema y capa de datos listos - ya se pueden construir las historias.

---

## Phase 3: User Story 1 - Completar el registro en dos pasos (Priority: P1) 🎯 MVP

**Goal**: la persona completa sus datos (paso 1) y responde las cuatro preguntas (paso 2); el registro se guarda
solo al enviar el paso 2 con todas las respuestas válidas y participa en el sorteo.

**Independent Test**: registrar a una persona recorriendo los dos pasos (también con teclado) y comprobar que
aparece en el panel con sus datos y respuestas, que ve la ventana de bienvenida y que entra al sorteo; enviar
el paso 2 con una respuesta vacía no registra; «Atrás» conserva lo escrito.

### Tests for User Story 1 ⚠️

> **NOTA: escríbelas primero y comprueba que FALLAN antes de implementar.**

- [X] T014 [P] [US1] Actualizar `tests/integration/registrations.route.test.ts`: `validBody` suma `trainingArea: "Ventas y atención al cliente"`, `guestSuggestion: "Un experto en marketing digital"`, `crmInterest: "maybe"`, `gpsInterest: "no"`; la prueba de minimización lista las claves guardadas `["company","createdAt","crmInterest","drawId","fullName","gpsInterest","guestSuggestion","phone","trainingArea"]` y comprueba los cuatro valores guardados tal cual; reemplazar «sin crmInterest guarda false / con true guarda true» y «un crmInterest que no es booleano se rechaza» por: `400 VALIDATION_ERROR` con `fieldErrors` por cada respuesta ausente, vacía, de 1 carácter, de 101 caracteres y por valor de interés inválido (`"si"`, `true`); el cuerpo antiguo (`crmInterest: true` y sin las demás respuestas) recibe `400` y **no** crea ningún documento; un texto con saltos de línea se guarda como una sola línea; un texto con etiquetas HTML (`<script>alert(1)</script>`) se guarda tal cual, como texto plano, sin modificarlo. Los otros casos (país por defecto, Chile, un solo nombre, origen cruzado, JSON inválido) usan `validBody` actualizado.
- [X] T015 [P] [US1] Crear `tests/e2e/helpers/registration.ts` con helpers compartidos de Playwright: `openForm(page)` (navega a `/registro` y espera `networkidle`), `fillStepOne(page, { fullName, phone, company, country? })`, `clickNext(page)` (botón «Siguiente»), `fillAnswers(page, { trainingArea?, guestSuggestion?, crm?, gps? })` (los radios se eligen por su nombre accesible, p. ej. `getByRole("radio", { name: "Tal vez, envíenme más información" })` dentro del grupo de la pregunta), `submitAnswers(page)` (botón «Enviar y participar») y `registerViaForm(page, values?)` que hace todo el recorrido con valores por defecto válidos.
- [X] T016 [US1] Reescribir `tests/e2e/registration.spec.ts` sobre el flujo de dos pasos usando `tests/e2e/helpers/registration.ts` (depende de T015): quitar el `fields().crm` y las pruebas de la casilla («la casilla del CRM es opcional…», `getByRole("checkbox")` con `toHaveCount(1)` ⇒ ahora `toHaveCount(0)`); casos nuevos — paso 1 muestra «Paso 1 de 2», los tres campos y «Siguiente», sin el botón «Enviar y participar» visible y sin casilla; «Siguiente» con el paso 1 vacío no avanza y marca los tres campos con `aria-invalid`; con datos válidos muestra «Paso 2 de 2», las cuatro preguntas (los dos radiogrupos por su leyenda) **sin ninguna opción marcada** y el foco en el título «Cuéntanos un poco más»; «Atrás» vuelve al paso 1 con lo escrito y al avanzar de nuevo conserva las respuestas del paso 2; Enter en un campo del paso 1 avanza al paso 2 en vez de enviar; enviar el paso 2 vacío no registra y muestra cada error bajo su pregunta (texto con `aria-describedby`, radios con «Elige una opción.») y enfoca el primer elemento con error; textos de 1 y de 101 caracteres muestran su error; con las cuatro respuestas válidas aparece la ventana «¡Bienvenido(a)!»; «Registrar a otra persona» reinicia el formulario en el **paso 1** vacío (país `PE`) con el foco en «Nombres completos»; cada paso sin desplazamiento horizontal en 360 px; **áreas táctiles (US1 escenario 8, FR-125)**: `boundingBox().height ≥ 44` en cada opción de radio, en «Siguiente», «Atrás» y «Enviar y participar»; **valores de los radios**: elegir «Tal vez, envíenme más información» en el CRM y «No, por ahora» en GPS y luego otras opciones en una segunda persona guarda exactamente `maybe`/`no` y las otras (se lee el documento en el emulador, para detectar un `ref` mal aplicado a los radios); **casos límite**: abandonar en el paso 2 (llegar al paso 2 y navegar a otra página) no deja ningún documento en `participants`; recargar la página en el paso 2 vuelve al paso 1 con el formulario vacío; **doble envío (FR-123)**: un doble clic rápido en «Enviar y participar» produce una sola petición `POST /api/registrations` (se cuenta con `page.route`) y un solo participante guardado. Mantener las pruebas existentes de bienvenida, confeti, redes sociales, enlace de regreso, cierre y 404 de privacidad adaptando su `fillAndSubmit` al nuevo helper.
- [X] T017 [US1] Ajustar `tests/e2e/design.spec.ts` (alrededor de las líneas 72 y 122–128): donde se envía el formulario con «Enviar y participar» para abrir la ventana de bienvenida, usar `registerViaForm` de `tests/e2e/helpers/registration.ts` (depende de T015); las aserciones de desenfoque de las ventanas públicas no cambian.
- [X] T018 [US1] Ajustar `tests/e2e/admin-access.spec.ts` (alrededor de las líneas 181–209, el visitante que se registra): usar el recorrido de dos pasos de `tests/e2e/helpers/registration.ts` (depende de T015) y reemplazar la comprobación de que «Enviar y participar» no existe/existe (líneas 185 y 190) por la del botón que corresponda al paso 1 («Siguiente») o al formulario cerrado. **No** tocar aún el caso del CRM (US3).

### Implementation for User Story 1

- [X] T019 [P] [US1] Crear `src/components/ui/RadioGroupField.tsx` según el contrato: aplicar `{...register}` (`name`, `onChange`, `onBlur` y `ref`) a **cada** radio del grupo, nunca solo al primero (con un solo `ref` RHF no puede leer cuál radio está marcado; el foco al primer error lo resuelve RHF con los `ref` de todos), `<fieldset>` con `<legend>` visible y la misma tipografía de etiquetas que `TextField` (clases de token), opciones con `min-h-11`, `accent-ink-900` y foco visible `outline-gold-700` como `CheckboxField`, `aria-invalid` y `aria-describedby` apuntando al error, y `aria-live="polite"` para anunciarlo.
- [X] T020 [P] [US1] Crear `src/components/registration/StepProgress.tsx` según el contrato: texto «Paso {step} de {total}» y una barra de dos segmentos con tokens (`bg-ink-900` el avance, `bg-line` el resto), `aria-live="polite"`; sin colores literales.
- [X] T021 [US1] Modificar `src/components/registration/RegistrationForm.tsx` (depende de T019, T020, T007): estado `step: 1 | 2` y `useForm` con `defaultValues` de `fullName`, `country`, `phone`, `company`, `trainingArea` y `guestSuggestion` en `""` y **sin** valor para `crmInterest`/`gpsInterest` (ninguna opción marcada); quitar la casilla `CheckboxField` del CRM y su import; constante `STEP_ONE_FIELDS = ["fullName","country","phone","company"]` y ampliar `FieldName`/`FIELD_NAMES` con las cuatro respuestas; ambos pasos montados dentro del mismo `<form>`, el inactivo con el atributo `hidden`; título `<h2 tabIndex={-1}>` por paso («Tus datos», «Cuéntanos un poco más») con `StepProgress`; función `goNext()` que ejecuta `await trigger(STEP_ONE_FIELDS, { shouldFocus: true })` y, si es válido, `setStep(2)` y enfoca el título del paso 2; botón «Siguiente» (type `submit`) en el paso 1 y «Atrás» (type `button`) + «Enviar y participar» en el paso 2; `onSubmit` bifurca: en paso 1 hace `event.preventDefault()` y llama `goNext()` (así Enter avanza), en paso 2 mantiene la guardia anti doble envío y `handleSubmit(submit)`; el paso 2 renderiza `TextField` para `trainingArea` y `guestSuggestion` (etiquetas del contrato, `autoComplete="off"`, `maxLength` no se fuerza: el esquema informa el exceso) y dos `RadioGroupField` con `CRM_OPTIONS` y `GPS_OPTIONS`; `submit` envía `{ ...values, country: getValues("country") }`; si el servidor devuelve `fieldErrors` de un campo del paso 1 durante el envío final, `applyFieldErrors` también hace `setStep(1)`; «Registrar a otra persona» (`registerAnother`) llama `reset()` **y** `setStep(1)`; el foco tras el reinicio sigue yendo a `fullName`. Mantener `WelcomeDialog`, `AlreadyRegisteredDialog`, `ThanksPanel`, `ClosedNotice` y las vistas `thanks`/`closed` como están.
- [X] T022 [US1] Verificar US1: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test:unit`, `npx vitest run tests/integration/registrations.route.test.ts` y `npx playwright test tests/e2e/registration.spec.ts tests/e2e/design.spec.ts tests/e2e/admin-access.spec.ts --grep-invert "CRM"` en verde (con los emuladores arriba); recorrer a mano el escenario 1–3 de [quickstart.md](quickstart.md) en 360 px.

**Checkpoint**: US1 funcional - registro completo en dos pasos con las cuatro respuestas guardadas (MVP).

---

## Phase 4: User Story 2 - Avisar al paso 1 si el celular ya está registrado (Priority: P1)

**Goal**: al tocar «Siguiente» se avisa si el celular ya está registrado o las inscripciones están cerradas,
antes de pedir las respuestas; el envío final repite la comprobación y un duplicado nunca modifica respuestas
guardadas.

**Independent Test**: intentar pasar al paso 2 con un celular ya registrado ⇒ aviso en el paso 1 sin mostrar el
paso 2; registrar el mismo número desde dos pestañas ⇒ solo se guarda un registro y las respuestas son las de la
primera.

### Tests for User Story 2 ⚠️

- [X] T023 [P] [US2] Crear `tests/integration/registrations.check.route.test.ts` (importa `POST` de `@/app/api/registrations/check/route`; mismas utilidades que `registrations.route.test.ts`): `200 { status: "available" }` con un número libre e inscripciones abiertas (y no crea ningún documento: `participants` sigue vacío); `409 ALREADY_REGISTERED` con un número ya registrado (también con otro formato del mismo número, p. ej. `+51 987-654-321`); `403 REGISTRATION_CLOSED` con las inscripciones cerradas (y tiene prioridad sobre el duplicado); `400 VALIDATION_ERROR` con `fieldErrors.phone` para un celular inválido del país (`CL` + `812345678`) y para un `country` fuera de la lista; mismo número local en otro país ⇒ `200`; origen cruzado ⇒ rechazado como en `registrations.route.test.ts`; cuerpo que no es JSON ⇒ `400`; el cuerpo de la respuesta no contiene nombre, empresa ni respuestas del participante existente; cabecera `Cache-Control: no-store`.
- [X] T024 [P] [US2] Actualizar `tests/integration/duplicates.test.ts`: los cuerpos de registro suman las cuatro respuestas; reemplazar «un duplicado con crmInterest: true no cambia la respuesta guardada» por «un duplicado con otras cuatro respuestas (otro `crmInterest`, otro `gpsInterest`, otro `trainingArea`, otro `guestSuggestion`) responde `409` y los cuatro valores guardados siguen siendo los del primero»; caso de carrera: `POST /check` ⇒ `200`, luego otro registro del mismo número entra, y el envío del primero ⇒ `409` sin modificar nada; mantener los casos existentes de formatos equivalentes y de países distintos.
- [X] T025 [US2] Actualizar `tests/e2e/duplicate.spec.ts` (depende de T015 y, para pasar, del formulario de dos pasos de T021): usar `tests/e2e/helpers/registration.ts` para registrar a la primera persona; reintentar con el mismo celular en otro formato (`+51 987-654-321`) y otro nombre: al tocar «Siguiente» aparece el diálogo «Ya estás participando en el sorteo» **sin** mostrar el paso 2 (`getByText("Paso 2 de 2")` con `toHaveCount(0)`), sin revelar datos del registro existente y con un solo participante guardado; «Registrar a otra persona» devuelve el formulario vacío en el paso 1; el mismo número local en otro país (`CL`) sigue siendo otro participante y llega al paso 2; carrera con dos páginas (`browser.newContext()`): ambas pasan al paso 2 con el mismo celular, la primera envía y la segunda al enviar ve el diálogo de «ya registrado» y el panel conserva las respuestas de la primera; con el servidor sin conexión (`page.route("**/api/registrations/check", route => route.abort())`) «Siguiente» muestra el mensaje de red en el paso 1, conserva lo escrito y permite reintentar; con las inscripciones cerradas durante el paso 1 (`setRegistrationOpen(false)` antes de «Siguiente») se muestra el aviso de cierre; **volver y cambiar el celular**: la persona llega al paso 2 con un celular libre, toca «Atrás», cambia el celular por uno ya registrado y toca «Siguiente» ⇒ se vuelve a comprobar y aparece «ya estás participando» sin mostrar el paso 2 (no se reutiliza la comprobación anterior); **doble toque (FR-123)**: un doble clic rápido en «Siguiente» produce una sola petición a `/api/registrations/check` (se cuenta con `page.route`) y avanza una sola vez.

### Implementation for User Story 2

- [X] T026 [US2] Agregar `checkRegistrationAvailable(phone)` a `src/services/participants.service.ts` según el contrato (depende de T008): `const [settings, participant] = await db.getAll(settingsRef, participantRef)`; `RegistrationClosedError` si `settings.exists && settings.data()?.open === false`; luego `AlreadyRegisteredError` si `participant.exists`; sin escrituras ni transacción; comentar que es informativa y que la garantía de unicidad sigue siendo `transaction.create` de `registerParticipant`.
- [X] T027 [US2] Crear `src/app/api/registrations/check/route.ts` (depende de T026, T007): `POST`, `assertSameOrigin`, `request.json()` con `try/catch` ⇒ `400 VALIDATION_ERROR`, `registrationCheckSchema.safeParse` ⇒ `400` con `zodToFieldErrors`, `checkRegistrationAvailable(parsed.data.phone)`; `200 { status: "available" }` con `Cache-Control: no-store`, `403 REGISTRATION_CLOSED`, `409 ALREADY_REGISTERED` y `500 INTERNAL_ERROR` (log solo con `error.name`, sin datos personales), con los mismos mensajes en español que `registrations/route.ts`.
- [X] T028 [US2] Modificar `goNext()` en `src/components/registration/RegistrationForm.tsx` (depende de T021, T027): después de validar el paso 1, `fetch("/api/registrations/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ country: getValues("country"), phone: getValues("phone") }) })` con la guardia anti doble toque y el botón «Siguiente» con `loading` («Comprobando…»); `200` ⇒ `setStep(2)` y foco al título del paso 2; `409` ⇒ `setDialog("already")` sin avanzar; `403` ⇒ `setView("closed")`; `400` ⇒ `applyFieldErrors` (error bajo el celular); error de red o `500` ⇒ `setServerError` con `MESSAGES.network`/`MESSAGES.unexpected` y el usuario sigue en el paso 1 con lo escrito (reutilizar `readApiError`/`handleError` en lugar de duplicarlos).
- [X] T029 [US2] Verificar US2: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npx vitest run tests/integration/registrations.check.route.test.ts tests/integration/duplicates.test.ts tests/integration/registrations.route.test.ts` y `npx playwright test tests/e2e/duplicate.spec.ts tests/e2e/registration.spec.ts` en verde; el recorrido manual de los escenarios 4–5 de [quickstart.md](quickstart.md) queda en T046.

**Checkpoint**: US1 y US2 funcionan - aviso temprano de duplicado/cierre y unicidad intacta.

---

## Phase 5: User Story 3 - Ver y filtrar las respuestas en el panel (Priority: P2)

**Goal**: el administrador ve las columnas CRM y GPS / cámara, las filtra por respuesta (combinables con la
búsqueda) y exporta las cuatro respuestas en el CSV.

**Independent Test**: registrar cuatro personas con respuestas distintas (y sembrar un participante anterior):
la tabla muestra las dos columnas sin capacitación ni invitado, cada filtro deja solo a quienes corresponden
(solo y combinado con la búsqueda) y el CSV trae las cuatro respuestas de cada persona.

### Tests for User Story 3 ⚠️

- [X] T030 [P] [US3] Actualizar `tests/unit/csv.test.ts`: el encabezado esperado pasa a `Nombres,Celular (con código de país),Empresa u ocupación,Área de capacitación,Invitado sugerido,CRM con Agente IA,GPS / cámara,Fecha de registro,Premio,N.º de ganador,Estado`; `CsvRow` de la prueba usa `crmInterest: Interest`, `gpsInterest: Interest | null`, `trainingArea` y `guestSuggestion`; casos: las columnas CRM y GPS dicen `Sí`/`Tal vez`/`No`; `gpsInterest: null` ⇒ celda vacía; los textos libres con comas y comillas se escapan; textos que empiezan con `=`, `+`, `-`, `@` salen con el prefijo `'` en ambas columnas de texto; un texto con etiquetas HTML (`<script>alert(1)</script>`) sale como texto, solo escapado como celda CSV (comillas y comas), sin transformarse; el orden de las columnas es el del encabezado, también en filas de ganadores; sin filas devuelve solo el encabezado.
- [X] T031 [P] [US3] Actualizar `tests/integration/participants.list.test.ts`: el fixture de documentos suma las respuestas nuevas; `listParticipants()` devuelve `crmInterest` y `gpsInterest` tal como se guardaron y **no** devuelve `trainingArea` ni `guestSuggestion` (la prueba de claves lista exactamente `fullName`, `phone`, `company`, `crmInterest`, `gpsInterest`, `createdAt`, `drawId`); documentos anteriores: `crmInterest: true` ⇒ `"yes"`, `false` ⇒ `"no"`, campo ausente ⇒ `"no"`, y `gpsInterest` ausente ⇒ `null`; `listParticipantsForExport()` añade los dos textos libres (`""` en los anteriores).
- [X] T032 [P] [US3] Actualizar `tests/integration/export.route.test.ts`: el encabezado nuevo en cada aserción; filas con las cuatro respuestas, celdas vacías de GPS y de los dos textos en un participante anterior y `Sí`/`No` del CRM según su casilla anterior; texto libre con `=1+1` neutralizado; acceso sin sesión ⇒ `401`.
- [X] T033 [P] [US3] Actualizar `tests/integration/legacy-consent.test.ts` (líneas con `crmInterest` y el encabezado): un participante anterior sigue listándose y exportándose con CRM `"no"`/`No`, GPS `null`/vacío y los textos vacíos, sin campos de consentimiento.
- [X] T034 [P] [US3] Ampliar `tests/integration/spins.route.test.ts` (líneas 63–64): el texto de la respuesta del giro no contiene `crmInterest`, `gpsInterest`, `trainingArea` ni `guestSuggestion` (regex insensible a mayúsculas); sembrar participantes con las cuatro respuestas y comprobar que todos son elegibles (FR-132).
- [X] T035 [P] [US3] Reescribir el caso del CRM de `tests/e2e/admin-access.spec.ts` (alrededor de las líneas 117–150; depende de T011 y T018): sembrar con `seedParticipant` cuatro personas con distintas combinaciones de `crmInterest`/`gpsInterest` más una anterior con `crmInterest: true` booleano y sin `gpsInterest`; comprobar las columnas «CRM» y «GPS / cámara» con «Sí», «Tal vez», «No» y «Sin respuesta», que **no** hay columnas «Área de capacitación» ni «Invitado sugerido» ni la casilla «Solo interesados en el CRM», que el selector «CRM con Agente IA» filtra por Sí, Tal vez y No (sin la opción «Sin respuesta»; la persona anterior con la casilla marcada aparece en «Sí») y el selector «GPS / cámara» filtra por Sí, Tal vez, No y Sin respuesta (esta última aísla a la persona anterior), que ambos combinados y con la búsqueda por texto dan la intersección, que el contador «Coincidencias» refleja el resultado y que cambiar un filtro vuelve a la página 1.
- [X] T036 [P] [US3] Actualizar `tests/e2e/export.spec.ts` (líneas 41, 61 y 99): sembrar con las respuestas nuevas, encabezado nuevo y comprobar que el CSV descargado trae las cuatro respuestas de cada participante, vacíos en el anterior y la neutralización de fórmulas.
- [X] T037 [P] [US3] Actualizar el encabezado esperado en `tests/e2e/purge.spec.ts` (línea 106) al nuevo y, si el caso siembra participantes, con las respuestas nuevas.

### Implementation for User Story 3

- [X] T038 [P] [US3] Crear `src/components/ui/SelectField.tsx` según el contrato: `<label htmlFor>` con el mismo estilo de etiqueta que `TextField`, `<select>` nativo con `min-h-11`, borde `border-ink-300`, fondo `bg-paper` y foco visible `outline-gold-700`; `onChange` entrega `event.target.value`; sin colores literales.
- [X] T039 [US3] Modificar `src/lib/csv.ts` (depende de T009, T030): `CsvRow` suma `gpsInterest: Interest | null`, `trainingArea: string` y `guestSuggestion: string`; `HEADER` pasa a `["Nombres","Celular (con código de país)","Empresa u ocupación","Área de capacitación","Invitado sugerido","CRM con Agente IA","GPS / cámara","Fecha de registro","Premio","N.º de ganador","Estado"]` (se elimina «Interesado en CRM»); las celdas siguen ese orden con `escapeCell(neutralizeFormula(...))` para los dos textos libres e `interestCsvLabel` para CRM y GPS; actualizar el comentario de `toCsv`.
- [X] T040 [US3] Modificar `src/app/api/admin/participants/export/route.ts` (depende de T008, T039): usar `listParticipantsForExport()` en lugar de `listParticipants()`; el resto (ganadores, nombre de archivo, cabeceras, `requireAdminApi`) no cambia.
- [X] T041 [US3] Modificar `src/components/admin/ParticipantsTable.tsx` (depende de T006, T038, T031): quitar `onlyInterested` y la `CheckboxField` «Solo interesados en el CRM» (y su import si ya no se usa); agregar estados `crmFilter` y `gpsFilter` (`InterestFilter`, por defecto `"all"`) con dos `SelectField` etiquetados «CRM con Agente IA» y «GPS / cámara» y las opciones de `CRM_FILTER_OPTIONS` (sin «Sin respuesta») y `GPS_FILTER_OPTIONS` respectivamente; `matches` = `filterParticipants(rows.filter(row => matchesInterestFilter(row.crmInterest, crmFilter) && matchesInterestFilter(row.gpsInterest, gpsFilter)), query)`; cada cambio de filtro llama `setRequestedPage(1)`; nueva columna «GPS / cámara» tras «CRM» y celdas con `interestLabel(...)` (CRM y GPS); subir el ancho mínimo de la tabla (`min-w-xl` ⇒ `min-w-3xl`) y mantener la región con desplazamiento horizontal enfocable; **no** agregar columnas de capacitación ni invitado; el contador «Coincidencias» y los mensajes «Aún no hay participantes» / «No hay resultados» siguen igual.
- [X] T042 [US3] Verificar US3: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test:unit`, `npx vitest run tests/integration/participants.list.test.ts tests/integration/export.route.test.ts tests/integration/legacy-consent.test.ts tests/integration/spins.route.test.ts` y `npx playwright test tests/e2e/admin-access.spec.ts tests/e2e/export.spec.ts tests/e2e/purge.spec.ts` en verde; el recorrido manual de los escenarios 6–8 de [quickstart.md](quickstart.md) queda en T046.

**Checkpoint**: las tres historias funcionan de forma independiente.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: cierre de calidad de toda la feature.

- [X] T043 Buscar restos del formato anterior y corregirlos: en `src/` y `tests/` no deben quedar `crmInterest: boolean`, `crmInterest: false`/`true` como valor de esquema o de registro (salvo los fixtures que simulan documentos anteriores), «Interesado en CRM», «Solo interesados en el CRM» ni la casilla «¿Deseas adquirir el CRM con Agente IA?» (la pregunta 3 ya no es casilla); tras T021 y T041 `CheckboxField` ya no lo usa ninguna pantalla (solo lo importaban `RegistrationForm` y `ParticipantsTable`): confirmarlo con una búsqueda de `CheckboxField` en `src/` y `tests/` y **eliminar** `src/components/ui/CheckboxField.tsx` (YAGNI; vuelve a crearse si una pantalla futura lo necesita).
- [X] T044 Puertas de calidad completas (constitución): `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test:unit`, `npm run test:rules`, `npm test` y `npm run test:e2e` (con los emuladores) en verde, incluida `tests/unit/no-hardcoded-colors.test.ts`.
- [X] T045 [P] Rendimiento y accesibilidad: `npm run perf` (Lighthouse móvil sobre `/registro`) mantiene ≥ 90 en Performance y Accessibility (SC-045); si baja, revisar el peso de `RegistrationForm` (ambos pasos montados) antes de cualquier otro cambio.
- [ ] T046 Ejecutar los 8 escenarios manuales de [quickstart.md](quickstart.md) en un teléfono (360 px) y en un monitor 1920×1080, incluida la prueba solo con teclado y con lector de pantalla (SC-043).
- [X] T047 Revisión de código dirigida a los principios III y IV de la constitución v2.2.0 (puntos de la re-evaluación de [plan.md](plan.md#constitution-check)): (1) `registerParticipant` conserva el `create` atómico y un duplicado no modifica respuestas; (2) `POST /api/registrations/check` solo lee y su respuesta y sus logs no incluyen datos de la persona; (3) `trainingArea` y `guestSuggestion` solo salen por `listParticipantsForExport`; (4) ningún log nuevo contiene celular, nombre ni respuestas; (5) los textos libres se muestran como texto y se neutralizan en el CSV; (6) ninguna respuesta aparece en `WheelParticipant`, `SpinResult`, `WinnerRecord` ni en la ventana del ganador.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias; puede empezar de inmediato.
- **Foundational (Phase 2)**: depende de Setup y **bloquea** todas las historias.
- **User Stories (Phase 3+)**: dependen de la fase Foundational.
  - **US1 (P1)**: independiente tras Foundational (MVP).
  - **US2 (P1)**: va **después de US1**. Las pruebas de integración (T023, T024), el servicio (T026) y la ruta (T027) no dependen de US1 y pueden hacerse en paralelo con ella; pero la prueba E2E T025 usa el helper T015 y necesita el formulario de dos pasos de T021, y `T028` modifica `RegistrationForm.tsx` y **depende de T021**.
  - **US3 (P2)**: independiente de US1 y US2 tras Foundational (los datos se siembran con `seedParticipant`); `T035` toca el mismo archivo que `T018` ⇒ va después.
- **Polish (Phase 6)**: depende de las historias que se vayan a entregar.

### Within Each Story

- Las pruebas se escriben primero y deben fallar antes de implementar.
- Dominio (`types`, `interest`, `schemas`) → servicio → ruta/componentes → verificación.
- `RegistrationForm.tsx` lo tocan T021 (US1) y T028 (US2): en ese orden. `participants.service.ts` lo tocan
  T008 (Foundational) y T026 (US2). `ParticipantsTable.tsx` lo tocan T010 y T041; `csv.ts`, T009 y T039.

### Parallel Opportunities

- Foundational: T003, T004, T005, T011 y T012 en paralelo; luego T006 → T007 → T008; T009 y T010 en paralelo
  tras T006.
- US1: T014, T015, T019 y T020 en paralelo; T016, T017 y T018 van tras T015 (sin `[P]`: cada una espera al helper, aunque tocan archivos distintos y pueden repartirse entre personas una vez listo); T021 al final.
- US2: T023 y T024 en paralelo (y también con US1); T025 tras T015; T026 → T027 → T028 (T028 tras T021).
- US3: T030–T037 y T038 en paralelo (archivos distintos); T039 → T040; T041 tras T038.
- Con varias personas: tras Foundational, una persona en US1, otra en US2 (T023, T024, T026, T027; T025 y T028 cuando US1 llegue a T015 y T021) y otra en US3.

---

## Parallel Example: User Story 1

```bash
# Pruebas y componentes de US1 a la vez (archivos distintos):
Task: "Actualizar tests/integration/registrations.route.test.ts con las cuatro respuestas"
Task: "Crear tests/e2e/helpers/registration.ts con los helpers de dos pasos"
Task: "Crear src/components/ui/RadioGroupField.tsx"
Task: "Crear src/components/registration/StepProgress.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Fase 1: Setup.
2. Fase 2: Foundational (**bloquea todo**).
3. Fase 3: US1 ⇒ **PARA y valida**: el registro de dos pasos guarda las cuatro respuestas.
4. Desplegar/demostrar si se quiere (las respuestas ya se capturan; el panel muestra el CRM con el formato mínimo
   de T010 y el CSV sigue con el encabezado anterior).

### Incremental Delivery

1. Setup + Foundational ⇒ base lista.
2. US1 ⇒ prueba independiente ⇒ MVP (captura de respuestas).
3. US2 ⇒ aviso temprano de duplicado y cierre.
4. US3 ⇒ columnas, filtros y CSV completo para el equipo comercial.
5. Polish ⇒ puertas de calidad, Lighthouse y escenarios manuales.

### Parallel Team Strategy

Tras Foundational: A en US1 (formulario), B en US2 (endpoint y pruebas de duplicados; integra `T028` cuando
`T021` esté listo) y C en US3 (panel y CSV).

---

## Notes

- `[P]` = archivos distintos y sin dependencias pendientes.
- `[Story]` enlaza cada tarea con su historia para trazabilidad.
- Cada historia se puede completar y probar sola (salvo `T028`, que se apoya en `T021`).
- Verifica que las pruebas fallen antes de implementar; **no debilites** pruebas existentes.
- Los fixtures que simulan participantes anteriores (campo `crmInterest` booleano o ausente) son intencionales:
  cubren FR-131 y SC-044.
- Haz commit al terminar cada tarea o grupo lógico; detente en cualquier checkpoint para validar la historia.
- Evita: tareas vagas, conflictos en un mismo archivo, dependencias entre historias que rompan su independencia.
