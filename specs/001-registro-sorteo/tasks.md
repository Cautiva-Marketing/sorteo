---

description: "Task list for Registro y Sorteo"
---

# Tasks: Registro y Sorteo

**Input**: Design documents from `/specs/001-registro-sorteo/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/http-api.md, quickstart.md

**Tests**: INCLUIDAS. La constitución (principio VI y puertas de calidad) exige pruebas unitarias de
validaciones y sorteo, prueba E2E del registro, pruebas de reglas de Firestore y Lighthouse ≥ 90. Dentro de
cada historia, las pruebas se escriben primero y deben fallar antes de implementar.

**Organization**: Tareas agrupadas por historia de usuario del spec para implementar y probar cada una
por separado.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia de usuario a la que pertenece (US1…US6)
- Todas las rutas son relativas a la raíz del repo (`D:\Trabajos\Cautiva Marketing\sorteo`)

## Path Conventions

Aplicación Next.js única en la raíz: `src/app`, `src/components`, `src/lib`, `src/services`, `src/types`,
`tests/{unit,integration,rules,e2e}`, `scripts/`. Solo `src/services/**` importa `firebase` o
`firebase-admin`; `src/lib/**` es lógica pura sin Firebase ni React.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicializar el proyecto y las herramientas.

- [X] T001 Crear los archivos base del proyecto Next.js en la raíz (sin `create-next-app`, el directorio ya tiene `.specify/`, `specs/` y `.claude/`): `package.json` (`name: "registro-sorteo"`, `private: true`, `engines.node: ">=22"`, scripts `dev`, `build`, `start`, `typecheck` = `tsc --noEmit`, `lint`, `format`, `format:check`, `test:unit` = `vitest run tests/unit`, `test` = `firebase emulators:exec --project demo-sorteo --only firestore,auth "vitest run"`, `test:rules` = `firebase emulators:exec --project demo-sorteo --only firestore "vitest run tests/rules"`, `test:e2e` = `firebase emulators:exec --project demo-sorteo --only firestore,auth "playwright test"`, `emulators` = `firebase emulators:start --project demo-sorteo --only firestore,auth` (un ID de proyecto con prefijo `demo-` hace que los emuladores no necesiten credenciales reales), `admin:grant` = `tsx scripts/grant-admin.ts`, `perf` = `firebase emulators:exec --project demo-sorteo --only firestore "node scripts/lighthouse.mjs"`), `tsconfig.json` con `"strict": true` y alias `@/*` → `src/*`, `next.config.ts`, `postcss.config.mjs` (`@tailwindcss/postcss`)
- [X] T002 Instalar dependencias en `package.json`: prod `next`, `react`, `react-dom`, `tailwindcss`, `@tailwindcss/postcss`, `firebase`, `firebase-admin`, `zod`, `react-hook-form`, `@hookform/resolvers`, `server-only`; dev `typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `eslint`, `eslint-config-next`, `typescript-eslint`, `prettier`, `vitest`, `@firebase/rules-unit-testing`, `firebase-tools`, `@playwright/test`, `lighthouse`, `tsx` (solo estas; justificación en research D-012; fijar versiones compatibles entre Next, ESLint y TypeScript); después ejecutar `npx playwright install chromium` (requisito local además de JDK 21 o superior para el emulador de Firestore)
- [X] T003 [P] Configurar ESLint y Prettier: `eslint.config.mjs` (flat config con `eslint-config-next` y `typescript-eslint`, regla `@typescript-eslint/no-explicit-any` como `error`, prohibir importar `firebase` y `firebase-admin` fuera de `src/services/**` y `scripts/**` con `no-restricted-imports`), `.prettierrc` y `.prettierignore`
- [X] T004 [P] Crear `.gitignore` (`node_modules`, `.next`, `.env*` con excepción `!.env.example`, `firebase-debug.log`, `*.log`, `test-results`, `playwright-report`) y `.env.example` con todas las claves sin valores: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`, `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `APP_CHECK_ENFORCEMENT` (comentario: `on` por defecto; `off` solo en desarrollo/pruebas), `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST` (solo para emuladores locales y E2E; nunca en producción)
- [X] T005 [P] Copiar `logo.svg` de la raíz a `public/logo.svg`
- [X] T006 [P] Crear `vitest.config.ts` (entorno `node`, alias `@` → `src`, alias `server-only` → `tests/setup/server-only-stub.ts`, `include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts", "tests/rules/**/*.test.ts"]`, `fileParallelism: false` para las pruebas con emulador) y `tests/setup/server-only-stub.ts` (módulo vacío)
- [X] T007 [P] Crear `playwright.config.ts` (`testDir: "tests/e2e"`, `webServer` que ejecuta `npm run dev` con `APP_CHECK_ENFORCEMENT=off`, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, `FIREBASE_PROJECT_ID=demo-sorteo`, y valores ficticios para el navegador: `NEXT_PUBLIC_FIREBASE_API_KEY=fake-api-key`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=localhost`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-sorteo`, `NEXT_PUBLIC_FIREBASE_APP_ID=demo-app`, `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` (sin `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, por lo que el cliente omite App Check), `baseURL: "http://localhost:3000"`, proyectos `mobile` con viewport 360×740 y `desktop`)
- [X] T008 [P] Crear `firebase.json` (emuladores `firestore` puerto 8080 y `auth` puerto 9099, referencia a `firestore.rules` y `firestore.indexes.json`), `firestore.rules` con exactamente `rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if false; } } }` y `firestore.indexes.json` con `{ "indexes": [], "fieldOverrides": [] }`
- [X] T009 Inicializar el repositorio git en la raíz (`git init`, rama `main`), verificar con `git status --ignored` que `.env*` (salvo `.env.example`), `node_modules` y `.next` quedan ignorados, y crear el primer commit con `.specify/`, `.claude/`, `specs/`, `logo.svg` y la configuración inicial de T001–T008; el remoto de GitHub se agrega después (`git remote add origin <url>`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestructura que TODAS las historias necesitan (tipos, errores HTTP, Admin SDK, tokens de diseño, UI base, estado de inscripciones, utilidades de prueba).

**⚠️ CRITICAL**: Ninguna historia puede empezar hasta completar esta fase.

- [X] T010 [P] Definir tipos de dominio en `src/types/index.ts`: `Participant` (`fullName`, `phone`, `company`, `createdAt`, `consent: { acceptedAt, version }`, `drawId: string | null`), `Winner` (`fullName`, `company?`, `phone?`), `Draw` (`id`, `createdAt`, `createdBy: { uid, email }`, `requestedCount`, `winners: Winner[]`, `purgedAt: Date | null`), `RegistrationStatus` (`open`, `updatedAt?`, `updatedBy?`, `dataPurgedAt?`) y `ApiErrorCode` con exactamente los códigos de contracts/http-api.md (`VALIDATION_ERROR`, `APP_CHECK_FAILED`, `UNAUTHORIZED`, `FORBIDDEN`, `REGISTRATION_CLOSED`, `ALREADY_REGISTERED`, `CONSENT_VERSION_MISMATCH`, `CONFIRMATION_REQUIRED`, `REGISTRATION_OPEN`, `DRAW_CONFLICT`, `INTERNAL_ERROR`)
- [X] T011 [P] Implementar `src/lib/http.ts`: `errorResponse(code, status, message, fieldErrors?)` que devuelve `Response.json({ code, message, fieldErrors? }, { status })` con mensajes en español, `zodToFieldErrors(error)` y `assertSameOrigin(request)` (compara el encabezado `Origin` con el host de la petición; si no coincide devuelve `403 FORBIDDEN`)
- [X] T012 [P] Implementar `src/services/firebase/admin.ts` (`import "server-only"`): inicialización única de Admin SDK con `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (reemplazando `\\n` por saltos de línea), funciones `getDb()`, `getAdminAuth()`, `getAdminAppCheck()`; con `FIRESTORE_EMULATOR_HOST` o `FIREBASE_AUTH_EMULATOR_HOST` definidos usa los emuladores sin credenciales reales
- [X] T013 [P] Implementar `src/services/firebase/client.ts`: inicialización diferida y única de la app web con las variables `NEXT_PUBLIC_FIREBASE_*` (`getFirebaseApp()`), sin inicializar nada al importar el módulo
- [X] T014 [P] Crear `src/app/globals.css`: `@import "tailwindcss";` y bloque `@theme` con los tokens de research D-009: `--color-brand-500: #3d8cd3; --color-brand-600: #3170a9; --color-brand-700: #2b6294; --color-brand-50: #ecf4fb; --color-brand-100: #d8e8f6; --color-brand-200: #b1d1ed; --color-ink-900: #0c1c2a; --color-ink-600: #4a5b6b; --color-danger-700: #b42318; --color-success-700: #067647;` (único archivo donde pueden aparecer valores de color); más `.grecaptcha-badge { visibility: hidden; }` y regla `@media (prefers-reduced-motion: reduce)` que desactiva animaciones
- [X] T015 Crear `src/app/layout.tsx` (depende de T014): `<html lang="es-PE">`, `metadata` (título "Sorteo", descripción en español), `viewport` (`width=device-width, initial-scale=1`), importa `./globals.css`, fuente del sistema, `body` con `bg-brand-50 text-ink-900 min-h-dvh`
- [X] T016 [P] Crear `src/components/ui/Logo.tsx`: `<img src="/logo.svg" width={292} height={88} alt="Logo de la empresa" fetchPriority="high">` documentando en comentario que SOLO se usa sobre fondo `bg-ink-900` (constitución V)
- [X] T017 [P] Crear `src/components/ui/Button.tsx`: botón con variantes `primary` (`bg-brand-600 text-white hover:bg-brand-700`), `secondary` y `danger` (usando solo clases de tokens), objetivo táctil ≥ 44 px, estado `disabled`/`loading` con `aria-busy`, foco visible con `outline-brand-500`
- [X] T018 [P] Crear `src/components/ui/TextField.tsx`: `forwardRef<HTMLInputElement>`; `label` visible asociado por `htmlFor`/`id`, texto de ayuda opcional, mensaje de error con `id` referenciado por `aria-describedby` y `aria-invalid`, estilos con tokens (compatible con `register` de React Hook Form)
- [X] T019 [P] Crear `src/components/ui/CheckboxField.tsx`: `forwardRef<HTMLInputElement>`; `<input type="checkbox">` con `label` asociado que admite contenido enriquecido (enlaces), mensaje de error con `aria-describedby`, sin estado inicial marcado
- [X] T020 [P] Crear `src/components/ui/Alert.tsx`: variantes `error` (`role="alert"`, `text-danger-700`), `success` y `info` (`role="status"`, `aria-live="polite"`), usando solo tokens
- [X] T021 Implementar `src/services/registration-status.service.ts` (`import "server-only"`; depende de T010, T012): `getRegistrationStatus()` lee `settings/registration`; **si el documento no existe se interpreta `open: true`**; `setRegistrationOpen(open, adminUid)` hace `set` con `open`, `updatedAt` (hora del servidor) y `updatedBy`, preservando `dataPurgedAt`
- [X] T022 [P] Crear `tests/integration/helpers.ts`: configura `FIRESTORE_EMULATOR_HOST`/`FIREBASE_AUTH_EMULATOR_HOST`, `APP_CHECK_ENFORCEMENT`, variables mínimas de Admin SDK (`FIREBASE_PROJECT_ID=demo-sorteo` por defecto); exporta `clearFirestore()` (borra todas las colecciones vía Admin SDK), `seedParticipants(n)` y `seedRegistrationStatus(open)`
- [X] T023 [P] Crear `tests/e2e/helpers/emulators.ts`: `resetFirestore()` (DELETE a `http://127.0.0.1:8080/emulator/v1/projects/demo-sorteo/databases/(default)/documents`), `seedParticipants(n)`, `setRegistrationOpen(open)` y `createAdminUser(email, password, { admin: true })` usando la API REST del emulador de Auth y claims personalizados
- [X] T024 [P] Crear `tests/rules/firestore.rules.test.ts` con `@firebase/rules-unit-testing`: para contexto anónimo, usuario autenticado y usuario con claim `admin`, verificar que `get`, `list`, `create`, `update` y `delete` sobre `participants/{id}`, `draws/{id}` y `settings/registration` son **todos denegados** (constitución III, quickstart escenario 12)
- [X] T025 [P] Crear `tests/unit/no-hardcoded-colors.test.ts`: recorre `src/**/*.{ts,tsx,css}` excepto `src/app/globals.css` y falla si encuentra valores de color literales (`#rgb`, `#rrggbb`, `rgb(`, `rgba(`, `hsl(`, `oklch(`) (constitución V)

**Checkpoint**: Base lista; las historias pueden empezar.

---

## Phase 3: User Story 1 - Registrarse en el sorteo desde el celular (Priority: P1) 🎯 MVP

**Goal**: Un visitante abre `/` en su celular, completa y envía el formulario con consentimiento y ve la confirmación; con inscripciones cerradas ve un aviso.

**Independent Test**: Quickstart escenarios 1, 2 y 5: registro válido guarda el participante y muestra confirmación; datos inválidos o sin consentimiento muestran errores en español y no guardan; sin token de App Check responde 401; con inscripciones cerradas se muestra el aviso y el envío responde 403.

### Tests for User Story 1 ⚠️ (escribir primero; deben FALLAR)

- [X] T026 [P] [US1] Pruebas unitarias en `tests/unit/phone.test.ts` para `normalizePhone`: acepta `987654321`, `987 654 321`, `987-654-321`, `+51987654321`, `51987654321`, `(+51) 987 654 321` → `+51987654321`; rechaza `812345678`, `98765432` (8 dígitos), `9876543210`, `abc`, vacío y `+52987654321`
- [X] T027 [P] [US1] Pruebas unitarias en `tests/unit/schemas.test.ts` para `registrationSchema`: nombre "María" (un término) inválido, "José Núñez Güemes" válido, "Ana 2 Pérez" inválido, 101 caracteres inválido, espacios colapsados y NFC aplicados; empresa de 1 o 101 caracteres inválida y con caracteres de control inválida; `consent: false` inválido; `consentVersion` requerido; los mensajes están en español
- [X] T028 [P] [US1] Pruebas unitarias en `tests/unit/app-check-enforcement.test.ts`: `assertAppCheckConfig()` lanza error cuando `NODE_ENV=production` y `APP_CHECK_ENFORCEMENT=off`; no lanza en `development`/`test` con `off`; `register()` de `src/instrumentation.ts` llama a `assertAppCheckConfig()` en el runtime `nodejs`; `assertAppCheckConfig()` lanza cuando `NODE_ENV=production` y falta `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`; `getRegistrationToken()` (de `src/services/firebase/app-check-client.ts`) devuelve `null` sin cargar reCAPTCHA cuando `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` no está definida
- [X] T029 [P] [US1] Pruebas de integración en `tests/integration/registrations.route.test.ts` (emulador de Firestore; invoca `POST` de `src/app/api/registrations/route.ts` con `Request`): 201 con documento `participants/+51…` con `drawId: null`, `consent.version` y `consent.acceptedAt`; 400 `VALIDATION_ERROR` con `fieldErrors`; 401 `APP_CHECK_FAILED` con enforcement activo y sin encabezado `X-Firebase-AppCheck` (verificación mockeada); 403 `REGISTRATION_CLOSED`; 409 `CONSENT_VERSION_MISMATCH`
- [X] T030 [P] [US1] Prueba E2E en `tests/e2e/registration.spec.ts` (proyecto `mobile` 360 px): página muestra logo, tres campos, finalidad y casillero sin marcar; envío válido muestra confirmación; campos vacíos, nombre de un término, celular `812345678`, empresa de 101 caracteres y consentimiento sin marcar muestran errores junto al campo y conservan lo escrito; con `setRegistrationOpen(false)` se ve el aviso de cerrado sin formulario

### Implementation for User Story 1

- [X] T031 [P] [US1] Implementar `src/lib/validation/phone.ts`: `normalizePhone(input): string | null` — quita espacios, guiones y paréntesis; acepta prefijo `+51` o `51` solo si el resto son 9 dígitos; exige `^9\d{8}$`; devuelve `+51` + 9 dígitos (**debe ser igual al ID del documento**); `toNational(e164)` devuelve los 9 dígitos
- [X] T032 [US1] Implementar `src/lib/validation/schemas.ts` con `registrationSchema` de Zod (depende de T031): `fullName`: NFC, espacios colapsados, **≥ 2 términos de solo letras Unicode, ≤ 100 caracteres (FR-003)** (cada término `^\p{L}+$`); `phone`: transform con `normalizePhone`, **`+51` + `^9\d{8}$`; debe ser igual al ID del documento (FR-004)**; `company`: **2–100 caracteres, espacios colapsados, sin caracteres de control (FR-005)**; `consent`: `z.literal(true)`; `consentVersion`: string; mensajes de error en español (es-PE); exportar el tipo inferido
- [X] T033 [P] [US1] Implementar `src/lib/consent.ts`: `CONSENT_VERSION = "2026-10-v1"`, `PURPOSE_TEXT` (participar en el sorteo y contactar a los ganadores; **debe indicar que los datos se eliminarán al terminar la campaña, una vez entregado el premio — FR-032**) y `CONSENT_LABEL`; marcar el texto como provisional (se reemplaza en T105)
- [X] T034 [P] [US1] Implementar `src/services/app-check.service.ts` (`import "server-only"`): `assertAppCheckConfig()` (falla cerrada: lanza si `NODE_ENV === "production"` y `APP_CHECK_ENFORCEMENT === "off"`, y también si `NODE_ENV === "production"` y falta `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`) y `verifyAppCheckToken(token)` que usa `getAdminAppCheck().verifyToken(token, { consume: true })`; con `APP_CHECK_ENFORCEMENT=off` (solo fuera de producción) devuelve verdadero sin verificar; token ausente o inválido → falso; `assertAppCheckConfig()` se invoca al arrancar el servidor desde `src/instrumentation.ts` y no durante `next build`
- [X] T035 [P] [US1] Implementar `src/services/firebase/app-check-client.ts`: `preloadAppCheck()` (importa `firebase/app-check` con `import()` dinámico e inicializa `ReCaptchaEnterpriseProvider` con `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` una sola vez) y `getRegistrationToken()` que llama a `getLimitedUseToken()`; **si `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` no está definida, `preloadAppCheck()` no hace nada y `getRegistrationToken()` devuelve `null`** (el formulario entonces no envía el encabezado `X-Firebase-AppCheck`; así funcionan desarrollo y E2E con `APP_CHECK_ENFORCEMENT=off`); con la clave definida, un fallo al obtener el token muestra un error en español y no envía el formulario; con `NEXT_PUBLIC_APP_CHECK_DEBUG` activa el token de depuración solo en desarrollo
- [X] T036 [P] [US1] Crear `src/instrumentation.ts` (depende de T034): exporta `register()` que, solo si `process.env.NEXT_RUNTIME === "nodejs"`, importa dinámicamente `@/services/app-check.service` y llama `assertAppCheckConfig()` para que el servidor no arranque con una configuración insegura en producción; no se ejecuta durante `next build`
- [X] T037 [US1] Añadir a `src/services/participants.service.ts` (`import "server-only"`; depende de T021, T032, T033) `registerParticipant(input)`: en una transacción de Firestore lee `settings/registration` (si `open === false` lanza `RegistrationClosedError`) y hace `transaction.create` de `participants/{phone}` con `fullName`, `phone`, `company`, `createdAt` (hora del servidor), `consent.acceptedAt` (hora del servidor), `consent.version` (**igual a `CONSENT_VERSION` vigente (FR-008)**; si no coincide lanza `ConsentVersionMismatchError`) y `drawId: null` (**`null` al registrarse; ID del sorteo en que ganó**); sin campos adicionales (minimización)
- [X] T038 [US1] Implementar `src/app/api/registrations/route.ts` (`POST`; depende de T011, T032, T034, T037): `assertSameOrigin`; verificar `X-Firebase-AppCheck` (401 `APP_CHECK_FAILED`); parsear con `registrationSchema` (400 `VALIDATION_ERROR` con `fieldErrors`); `registerParticipant`; mapear `RegistrationClosedError` → 403 `REGISTRATION_CLOSED`, `ConsentVersionMismatchError` → 409 `CONSENT_VERSION_MISMATCH`; éxito → `201 { "status": "registered" }`; cualquier otro error → 500 `INTERNAL_ERROR` sin filtrar detalles ni datos personales en logs
- [X] T039 [P] [US1] Crear `src/components/registration/ConsentField.tsx`: usa `CheckboxField` con la finalidad (`PURPOSE_TEXT`) visible junto al casillero (no premarcado) y enlace a `/privacidad`
- [X] T040 [P] [US1] Crear `src/components/registration/SuccessPanel.tsx`: mensaje de confirmación "¡Listo! Ya estás participando" con ícono y `role="status"`
- [X] T041 [P] [US1] Crear `src/components/registration/ClosedNotice.tsx`: aviso "Las inscripciones están cerradas" con tokens de marca
- [X] T042 [US1] Crear `src/components/registration/RegistrationForm.tsx` (`"use client"`; depende de T018, T019, T020, T032, T035, T039, T040): React Hook Form con `zodResolver(registrationSchema)`, campos Nombres completos / Celular (`inputMode="tel"`, `autoComplete="tel-national"`) / Empresa u ocupación, `ConsentField`, llama `preloadAppCheck()` en el primer `onFocus` de cualquier campo, al enviar obtiene `getRegistrationToken()` y hace `fetch POST /api/registrations`; botón deshabilitado mientras envía (evita doble envío); 201 → `SuccessPanel`; 400 → errores por campo desde `fieldErrors`; 401/403 `REGISTRATION_CLOSED`/500/red → `Alert` en español conservando lo escrito; 403 `REGISTRATION_CLOSED` muestra `ClosedNotice`
- [X] T043 [US1] Crear `src/app/page.tsx` (Server Component dinámico `export const dynamic = "force-dynamic"`; depende de T015, T016, T021, T041, T042): cabecera `bg-ink-900` con `Logo`, lee `getRegistrationStatus()`; si `open` muestra `RegistrationForm`, si no `ClosedNotice` (sin formulario); pie con texto de atribución de reCAPTCHA/Google exigido al ocultar la insignia y enlace a `/privacidad`
- [X] T044 [P] [US1] Crear `src/app/privacidad/page.tsx`: texto completo de finalidad y política usando `PURPOSE_TEXT` y mostrando `CONSENT_VERSION`, en español, con enlace de regreso a `/`

**Checkpoint**: US1 funcional y probada de forma independiente (MVP).

---

## Phase 4: User Story 2 - No permitir registros duplicados por celular (Priority: P1)

**Goal**: Un celular ya registrado, en cualquier formato, no crea un segundo registro y el visitante ve "ya estás participando".

**Independent Test**: Quickstart escenarios 3 y 4: reenvío con `+51 987-654-321` y `987654321` → un solo documento y mensaje de duplicado; 10 envíos concurrentes → un solo documento.

### Tests for User Story 2 ⚠️

- [X] T045 [P] [US2] Pruebas de integración en `tests/integration/duplicates.test.ts`: tras registrar `987654321`, enviar `+51 987-654321`, `51987654321` con otro nombre → 409 `ALREADY_REGISTERED`, sigue 1 documento y la respuesta no contiene datos del registro existente; 10 `POST` simultáneos con el mismo celular → exactamente 1 respuesta 201, 9 respuestas 409 y 1 documento
- [X] T046 [P] [US2] Prueba E2E en `tests/e2e/duplicate.spec.ts`: registrar un celular y reintentar con otro formato y otro nombre → se muestra "ya estás participando", sin errores y sin confirmar de nuevo

### Implementation for User Story 2

- [X] T047 [US2] En `src/services/participants.service.ts` capturar el error `ALREADY_EXISTS` (código gRPC 6) de `transaction.create` en `registerParticipant` y lanzar `AlreadyRegisteredError` (sin incluir datos del registro existente)
- [X] T048 [US2] En `src/app/api/registrations/route.ts` mapear `AlreadyRegisteredError` → `409 ALREADY_REGISTERED` con mensaje "Este celular ya está participando."
- [X] T049 [P] [US2] Crear `src/components/registration/AlreadyRegisteredPanel.tsx`: mensaje amable "Ya estás participando en el sorteo" con `role="status"`, sin mostrar datos del registro existente
- [X] T050 [US2] En `src/components/registration/RegistrationForm.tsx` manejar la respuesta 409 `ALREADY_REGISTERED` mostrando `AlreadyRegisteredPanel`, y 409 `CONSENT_VERSION_MISMATCH` pidiendo recargar la página

**Checkpoint**: US1 y US2 funcionan; la unicidad queda garantizada por la base de datos.

---

## Phase 5: User Story 3 - Acceso protegido y consulta de participantes (Priority: P2)

**Goal**: El administrador inicia sesión, ve conteo total y listado paginado con búsqueda, y puede cerrar/abrir inscripciones.

**Independent Test**: Quickstart escenarios 6, 7 y 8: sin sesión se redirige a login (y los endpoints responden 401/403); con sesión se ve el conteo y la tabla (50 por página); la búsqueda ignora tildes y mayúsculas; cerrar inscripciones muestra el aviso en `/` y rechaza envíos.

### Tests for User Story 3 ⚠️

- [X] T051 [P] [US3] Pruebas unitarias en `tests/unit/search.test.ts`: `normalizeForSearch("JOSÉ Núñez")` → `"jose nunez"`; `filterParticipants` busca por nombre, celular (9 dígitos y con `+51`) y empresa; sin coincidencias devuelve lista vacía; cadena vacía devuelve todos
- [X] T052 [P] [US3] Pruebas unitarias en `tests/unit/format.test.ts`: `formatLimaDateTime` formatea un instante UTC como `YYYY-MM-DD HH:mm:ss` en zona `America/Lima` (UTC−5)
- [X] T053 [P] [US3] Pruebas de integración en `tests/integration/admin-auth.test.ts` (emulador de Auth): `POST /api/admin/session` con ID token de usuario con claim `admin` → 204 con cookie `httpOnly`, `SameSite=Strict`; sin claim → 403; token inválido → 401; `requireAdmin` rechaza cookie ausente, manipulada o sin claim; `DELETE /api/admin/session` expira la cookie
- [X] T054 [P] [US3] Pruebas de integración en `tests/integration/participants.list.test.ts`: `listParticipants` ordena por `createdAt` descendente; `countParticipants` coincide con el total; `PUT /api/admin/registration` con sesión admin cambia `settings/registration.open` y sin sesión devuelve 401
- [X] T055 [P] [US3] Prueba E2E en `tests/e2e/admin-access.spec.ts`: `/admin` sin sesión redirige a `/admin/login`; login con usuario sin claim falla con mensaje en español; login admin entra al panel; con 60 participantes sembrados se ve el conteo 60 y 50 filas en la página 1; buscar `jose` y `JOSÉ` da los mismos resultados; búsqueda sin coincidencias muestra "No hay resultados"; sin participantes se ve estado vacío con conteo 0; cerrar inscripciones en `/admin/campana` hace que `/` muestre el aviso; con el formulario público ya abierto, cerrar las inscripciones y enviar muestra el aviso de cerrado sin guardar datos (US3-7); con la cookie de sesión eliminada, pulsar "Cerrar inscripciones" redirige a `/admin/login?expirada=1` con el mensaje "Tu sesión expiró. Inicia sesión de nuevo."

### Implementation for User Story 3

- [X] T056 [P] [US3] Implementar `src/lib/search.ts`: `normalizeForSearch(text)` (minúsculas, NFD y eliminación de marcas diacríticas, espacios colapsados) y `filterParticipants(rows, query)` que busca la consulta normalizada en nombre, celular (9 dígitos) y empresa
- [X] T057 [P] [US3] Implementar `src/lib/format.ts`: `formatLimaDateTime(date)` → `YYYY-MM-DD HH:mm:ss` en `America/Lima` usando `Intl.DateTimeFormat` (sin librerías de fechas)
- [X] T058 [US3] Implementar `src/services/admin-auth.service.ts` (`import "server-only"`; depende de T012): `createSession(idToken)` (verifica con `verifyIdToken`, exige `auth_time` ≤ 5 min y claim `admin === true`, crea cookie con `createSessionCookie` de 8 h), `clearSession()`, `requireAdmin()` para páginas (lee la cookie con `cookies()`, `verifySessionCookie(cookie, true)` + claim `admin`; si falla `redirect("/admin/login")`) y `requireAdminApi(request)` para Route Handlers (devuelve `{ uid, email }` o una `Response` 401 `UNAUTHORIZED`/403 `FORBIDDEN`); cookie `admin_session` con `httpOnly`, `Secure` (salvo emulador local), `SameSite=Strict`, `Path=/`, `Max-Age=28800`
- [X] T059 [P] [US3] Implementar `src/services/firebase/auth-client.ts`: `signInAdmin(email, password)` con `signInWithEmailAndPassword` de `firebase/auth` (importación dinámica) que devuelve el ID token; si existe `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST` y `NODE_ENV !== "production"` llama `connectAuthEmulator(auth, "http://" + host, { disableWarnings: true })` antes de iniciar sesión (necesario para E2E); `signOutClient()`
- [X] T060 [US3] Implementar `src/app/api/admin/session/route.ts` (depende de T011, T058): `POST` recibe `{ idToken }`, llama `createSession` y responde `204` con `Set-Cookie` (401 `UNAUTHORIZED` token inválido/antiguo, 403 `FORBIDDEN` sin claim); `DELETE` responde `204` y expira la cookie; ambos con `assertSameOrigin`
- [X] T061 [P] [US3] Crear `scripts/grant-admin.ts`: recibe `<correo> <contraseña>`, crea el usuario en Firebase Auth si no existe (o lo localiza) y asigna `setCustomUserClaims(uid, { admin: true })` con Admin SDK; imprime el uid; no guarda credenciales en disco
- [X] T062 [US3] Añadir a `src/services/participants.service.ts` `listParticipants()` (todos los documentos de `participants` ordenados por `createdAt desc`, devolviendo `fullName`, `phone` en 9 dígitos, `company`, `createdAt`, `drawId`) y `countParticipants()` con agregación `count()` (depende de T037)
- [X] T063 [US3] Añadir a `src/lib/validation/schemas.ts` `registrationStatusSchema` (`{ open: z.boolean() }`, mensajes en español)
- [X] T064 [US3] Implementar `src/app/api/admin/registration/route.ts` (`PUT`; depende de T021, T058, T063): `assertSameOrigin`, `requireAdminApi`, validar con `registrationStatusSchema`, llamar `setRegistrationOpen`, responder `200 { open, updatedAt }`
- [X] T065 [P] [US3] Crear `src/lib/admin-fetch.ts` (cliente, sin Firebase): `adminFetch(input, init)` envuelve `fetch` con `credentials: "same-origin"` y, si la respuesta es 401, ejecuta `window.location.assign("/admin/login?expirada=1")` y devuelve una promesa que no se resuelve; en los demás casos devuelve la `Response` sin modificar. Lo usan todos los componentes del panel que llaman a `/api/admin/*` (excepto el login)
- [X] T066 [P] [US3] Crear `src/components/admin/LoginForm.tsx` (`"use client"`): correo y contraseña con React Hook Form + Zod (campos requeridos), llama `signInAdmin`, envía el `idToken` a `POST /api/admin/session` y navega a `/admin`; errores en español ("Credenciales incorrectas", "No tienes permisos de administrador"); si la URL trae `?expirada=1` muestra el aviso "Tu sesión expiró. Inicia sesión de nuevo."
- [X] T067 [US3] Crear `src/app/admin/login/page.tsx` (fuera del grupo `(panel)`; depende de T016, T066): cabecera `bg-ink-900` con `Logo` y `LoginForm`
- [X] T068 [P] [US3] Crear `src/components/admin/AdminNav.tsx`: navegación Participantes (`/admin`), Sorteo (`/admin/sorteo`), Campaña (`/admin/campana`) y botón "Cerrar sesión" (`DELETE /api/admin/session`), con `aria-current` en la ruta activa
- [X] T069 [US3] Crear `src/app/admin/(panel)/layout.tsx` (depende de T058, T068): llama `await requireAdmin()`, cabecera `bg-ink-900` con `Logo` y `AdminNav`; el grupo `(panel)` evita bucle de redirección con `/admin/login`
- [X] T070 [P] [US3] Crear `src/components/admin/ParticipantsTable.tsx` (`"use client"`; depende de T056, T057): recibe `rows` y `total`; cuadro de búsqueda con etiqueta ("Buscar por nombre, celular o empresa"), filtra en el navegador con `filterParticipants`, muestra conteo de coincidencias y total, pagina **50 por página**, tabla accesible (`<th scope>`), mensajes "Aún no hay participantes" y "No hay resultados", botón "Actualizar" (`router.refresh()`)
- [X] T071 [US3] Crear `src/app/admin/(panel)/page.tsx` (depende de T062, T070): Server Component que obtiene `listParticipants()` y `countParticipants()` y los pasa a `ParticipantsTable`
- [X] T072 [P] [US3] Crear `src/components/admin/RegistrationToggle.tsx` (`"use client"`): muestra el estado actual (abiertas/cerradas) y botón para cambiarlo con `PUT /api/admin/registration` mediante `adminFetch` (sesión vencida → login), `aria-live` para confirmar el cambio y manejo de error
- [X] T073 [US3] Crear `src/app/admin/(panel)/campana/page.tsx` (depende de T021, T072): lee `getRegistrationStatus()` y muestra `RegistrationToggle` (la sección de borrado se agrega en US6)

**Checkpoint**: Panel protegido operativo con listado, búsqueda y control de inscripciones.

---

## Phase 6: User Story 4 - Ejecutar el sorteo y registrar el resultado (Priority: P2)

**Goal**: El administrador elige cuántos ganadores, ejecuta el sorteo con animación simple y el resultado queda guardado y consultable.

**Independent Test**: Quickstart escenario 9: sorteos de 1 y de 3 ganadores muestran animación y ganadores distintos; el historial persiste tras recargar; una segunda ronda pide confirmación y excluye a los ganadores anteriores; dos sorteos simultáneos no repiten ganadores.

**Depende de**: US3 (tareas T058, T060 de autenticación y el panel T069); datos de US1.

### Tests for User Story 4 ⚠️

- [X] T074 [P] [US4] Pruebas unitarias en `tests/unit/draw.test.ts` para `pickWinners(ids, count, randomInt)`: devuelve `count` ids distintos pertenecientes a `ids`; con `count === ids.length` devuelve todos; con RNG inyectado determinista da el resultado esperado; `count` < 1 o > `ids.length` lanza error; no modifica el arreglo de entrada
- [X] T075 [P] [US4] Pruebas de integración en `tests/integration/draws.test.ts` (emulador): `executeDraw` con 10 participantes y `count: 3` → 3 ganadores distintos con `drawId` asignado y documento `draws/{id}` con `requestedCount: 3`, `createdBy` y `winners`; segundo sorteo sin `confirmExisting` → `CONFIRMATION_REQUIRED`, con confirmación excluye a los ganadores previos; `count` mayor a los elegibles → `VALIDATION_ERROR` indicando el máximo; dos `executeDraw` simultáneos nunca repiten ganadores; `countEligible()` devuelve el número de participantes con `drawId == null` y baja tras cada sorteo
- [X] T076 [P] [US4] Prueba E2E en `tests/e2e/draw.spec.ts`: admin con 10 participantes sembrados sortea 1 y luego 3; se ve animación y ganadores; tras recargar el historial muestra ambos sorteos; sin participantes el botón de sortear está deshabilitado con explicación; tras eliminar la cookie de sesión y volver a iniciar sesión, un sorteo ya guardado sigue en el historial

### Implementation for User Story 4

- [X] T077 [P] [US4] Implementar `src/lib/draw.ts`: `pickWinners(ids, count, randomInt = crypto.randomInt)` con Fisher-Yates parcial (selección sin repetición, igual probabilidad, sin mutar la entrada)
- [X] T078 [US4] Añadir a `src/lib/validation/schemas.ts` `drawRequestSchema`: `count` entero ≥ 1 (**entero ≥ 1 y ≤ elegibles al momento (FR-019)**; el límite superior lo valida el servicio con el mensaje del máximo) y `confirmExisting` booleano opcional
- [X] T079 [US4] Implementar `src/services/draws.service.ts` (`import "server-only"`; depende de T010, T012, T077, T078): `executeDraw({ count, confirmExisting }, admin)` — si existen documentos en `draws` y no hay `confirmExisting` lanza `ConfirmationRequiredError`; lista ids con `drawId == null` (elegibles), valida `count`, elige con `pickWinners`, y en una **transacción** relee los elegidos, verifica `drawId == null`, les asigna el `drawId` y crea `draws/{id}` con `createdAt` (hora del servidor), `createdBy: { uid, email }`, `requestedCount`, `winners: [{ fullName, company, phone }]` (con `phone` en formato nacional de 9 dígitos mediante `toNational`) y `purgedAt: null`; si algún ganador cambió reintenta hasta 3 veces y luego lanza `DrawConflictError`; `listDraws()` ordenado por `createdAt desc`; `countEligible()` con agregación `count()` sobre `participants` con `drawId == null`
- [X] T080 [US4] Implementar `src/app/api/admin/draws/route.ts` (`POST`; depende de T011, T058, T079): `assertSameOrigin`, `requireAdminApi`, validar con `drawRequestSchema`; mapear errores a 400 `VALIDATION_ERROR` (con el máximo elegible), 409 `CONFIRMATION_REQUIRED`, 409 `DRAW_CONFLICT`; éxito → `201` con `{ id, createdAt, requestedCount, winners }` (teléfono en 9 dígitos); `export const maxDuration = 60`
- [X] T081 [P] [US4] Crear `src/components/admin/DrawAnimation.tsx` (`"use client"`): animación simple solo con CSS/React (p. ej. nombres ficticios de relleno o puntos que giran ~3 s y revelan ganadores uno por uno), respeta `prefers-reduced-motion` (sin animación, resultado inmediato) y no influye en el resultado (recibe los ganadores ya decididos)
- [X] T082 [P] [US4] Crear `src/components/admin/DrawPanel.tsx` (`"use client"`; depende de T081): campo "Cantidad de ganadores" (mín. 1, máx. elegibles), botón "Sortear" deshabilitado sin elegibles con explicación, diálogo de confirmación si ya hay sorteos (envía `confirmExisting: true`), llama `POST /api/admin/draws` mediante `adminFetch` (sesión vencida → login), muestra `DrawAnimation` y luego la lista de ganadores con sus datos
- [X] T083 [P] [US4] Crear `src/components/admin/DrawHistory.tsx`: lista de sorteos (fecha en hora de Lima con `formatLimaDateTime`, cantidad, administrador, ganadores); tras el borrado de datos los ganadores aparecen solo con nombre
- [X] T084 [US4] Crear `src/app/admin/(panel)/sorteo/page.tsx` (depende de T079, T082, T083): Server Component que obtiene `countEligible()` y `listDraws()` y renderiza `DrawPanel` y `DrawHistory`

**Checkpoint**: Sorteo funcional, auditable y seguro ante concurrencia.

---

## Phase 7: User Story 5 - Exportar la lista de participantes a CSV (Priority: P3)

**Goal**: El administrador descarga un CSV con todos los participantes, legible en hojas de cálculo y seguro frente a fórmulas.

**Independent Test**: Quickstart escenario 10: CSV con una fila por participante, tildes/ñ correctas, comas escapadas, `=1+1` neutralizado, siempre la lista completa.

**Depende de**: US3 (autenticación y `listParticipants`).

### Tests for User Story 5 ⚠️

- [X] T085 [P] [US5] Pruebas unitarias en `tests/unit/csv.test.ts` para `toCsv(rows)`: empieza con BOM UTF-8 y encabezado `Nombres,Celular,Empresa u ocupación,Fecha de registro`; escapa comas, comillas y saltos de línea; prefija con `'` los textos que empiezan con `=`, `+`, `-`, `@`, tab o retorno; conserva tildes y ñ; el celular de 9 dígitos no se prefija; sin filas devuelve solo el encabezado
- [X] T086 [P] [US5] Pruebas de integración en `tests/integration/export.route.test.ts`: `GET /api/admin/participants/export` sin sesión → 401; con sesión admin → 200, `Content-Type: text/csv; charset=utf-8`, `Content-Disposition` con `participantes-AAAAMMDD.csv` y número de filas igual al de participantes
- [X] T087 [P] [US5] Prueba E2E en `tests/e2e/export.spec.ts`: con una búsqueda activa, pulsar "Exportar CSV" descarga el archivo con la lista completa; con 0 participantes el botón está deshabilitado y se informa "No hay datos para exportar"

### Implementation for User Story 5

- [X] T088 [P] [US5] Implementar `src/lib/csv.ts`: `toCsv(rows)` y `neutralizeFormula(text)` según research D-011 (BOM, coma, comillas dobles escapadas, columnas fijas, fecha con `formatLimaDateTime`)
- [X] T089 [US5] Implementar `src/app/api/admin/participants/export/route.ts` (`GET`; depende de T058, T062, T088): `requireAdminApi`, `listParticipants()`, respuesta `text/csv; charset=utf-8` con `Content-Disposition: attachment; filename="participantes-AAAAMMDD.csv"` (fecha de Lima); `export const maxDuration = 60`
- [X] T090 [US5] En `src/components/admin/ParticipantsTable.tsx` añadir enlace/botón "Exportar CSV" hacia `/api/admin/participants/export` (siempre exporta la lista completa; texto de ayuda lo aclara), deshabilitado con 0 participantes mostrando "No hay datos para exportar"

**Checkpoint**: Exportación disponible.

---

## Phase 8: User Story 6 - Borrar los datos personales al terminar la campaña (Priority: P3)

**Goal**: Con las inscripciones cerradas, el administrador borra definitivamente los datos de los participantes; del sorteo solo se conservan nombres de ganadores, fecha y cantidad.

**Independent Test**: Quickstart escenario 11: con inscripciones abiertas el borrado se rechaza; cerrado y con la frase `BORRAR`, se eliminan los participantes y `draws[].winners` queda solo con `fullName`; la exportación sale vacía.

**Depende de**: US3 (autenticación, página de campaña) y US4 (historial de sorteos).

### Tests for User Story 6 ⚠️

- [X] T091 [P] [US6] Pruebas de integración en `tests/integration/purge.test.ts` (emulador): `DELETE /api/admin/participants` sin sesión → 401; con inscripciones abiertas → 409 `REGISTRATION_OPEN`; frase distinta de `BORRAR` → 400; con inscripciones cerradas y frase correcta → 200 `{ deletedParticipants }`, colección `participants` vacía, cada `winners` de `draws` queda exactamente como `{ fullName }`, `purgedAt` y `settings/registration.dataPurgedAt` definidos; repetir la operación es idempotente; con más de 500 participantes los elimina todos
- [X] T092 [P] [US6] Prueba E2E en `tests/e2e/purge.spec.ts`: el botón de borrado está bloqueado/rechazado con inscripciones abiertas; tras cerrar, el diálogo advierte que es irreversible y sugiere exportar, exige escribir `BORRAR`; al confirmar el listado queda vacío (conteo 0) y el historial de sorteos solo muestra nombres de ganadores

### Implementation for User Story 6

- [X] T093 [US6] Añadir a `src/lib/validation/schemas.ts` `purgeRequestSchema`: `{ confirm: z.literal("BORRAR") }` con mensaje en español
- [X] T094 [US6] Añadir a `src/services/participants.service.ts` `purgeAllParticipantData(adminUid)`: si `settings/registration.open === true` lanza `RegistrationOpenError`; (1) para cada `draws/{id}` reduce `winners` a **`{ fullName }`** y fija `purgedAt`; (2) elimina todos los documentos de `participants` con `BulkWriter` en lotes; (3) fija `settings/registration.dataPurgedAt`; reintentable sin duplicar efectos; devuelve el número de participantes eliminados
- [X] T095 [US6] Implementar `DELETE` en `src/app/api/admin/participants/route.ts` (depende de T058, T093, T094): `assertSameOrigin`, `requireAdminApi`, validar con `purgeRequestSchema` (400 `VALIDATION_ERROR`), mapear `RegistrationOpenError` → 409 `REGISTRATION_OPEN`, éxito → `200 { deletedParticipants }`; `export const maxDuration = 60`
- [X] T096 [P] [US6] Crear `src/components/ui/Dialog.tsx`: diálogo modal accesible basado en `<dialog>` nativo (foco atrapado, cierre con Escape, título con `aria-labelledby`), estilos con tokens
- [X] T097 [P] [US6] Crear `src/components/admin/PurgeDialog.tsx` (`"use client"`; depende de T096): advierte que la acción es irreversible, sugiere exportar antes (enlace a la exportación), exige escribir `BORRAR`, llama `DELETE /api/admin/participants` mediante `adminFetch` (sesión vencida → login), muestra el resultado y errores en español
- [X] T098 [US6] En `src/app/admin/(panel)/campana/page.tsx` añadir la sección "Cierre de campaña" con `PurgeDialog`, deshabilitada con aviso "Cierra primero las inscripciones" mientras estén abiertas

**Checkpoint**: Ciclo completo de campaña, incluida la eliminación de datos.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Puertas de calidad de la constitución y validación final.

- [X] T099 [P] Crear `scripts/lighthouse.mjs` (se ejecuta con `npm run perf`, que ya lo envuelve en `firebase emulators:exec --project demo-sorteo --only firestore`): hace `next build` y `next start` en modo producción con `FIREBASE_PROJECT_ID=demo-sorteo`, `NEXT_PUBLIC_RECAPTCHA_SITE_KEY=dummy-site-key` y `APP_CHECK_ENFORCEMENT` sin definir (activo; la página no inicializa App Check hasta el primer foco y Lighthouse no interactúa), espera a que `http://localhost:3000/` responda, ejecuta Lighthouse (emulación móvil; requiere Chrome o Chromium, p. ej. el de Playwright vía `CHROME_PATH`), imprime puntajes de Performance y Accessibility, detiene el servidor y sale con error si alguno es < 90
- [X] T100 Ejecutar `npm run perf` y optimizar hasta Performance ≥ 90 y Accessibility ≥ 90 en `/` (JS inicial mínimo, `Logo` con prioridad, App Check/reCAPTCHA cargados solo al primer foco, sin fuentes externas bloqueantes)
- [X] T101 [P] Revisión de accesibilidad manual: navegación por teclado completa del formulario y del panel, foco visible, errores anunciados (`aria-live`/`aria-describedby`), `prefers-reduced-motion` en la animación del sorteo, contraste AA con los tokens de research D-009; corregir hallazgos en `src/components/**`
- [X] T102 [P] Revisión de seguridad: confirmar que ninguna variable de servidor usa `NEXT_PUBLIC_`, que todo archivo de `src/services/**` de servidor importa `server-only`, que no hay secretos ni datos reales en el repo (`.env*` ignorados), que todos los Route Handlers que modifican datos (`POST`/`PUT`/`DELETE`) llaman `assertSameOrigin`, que todos los handlers de `/api/admin/*` excepto `POST /api/admin/session` llaman `requireAdminApi` (`GET /api/admin/participants/export` no usa `assertSameOrigin` porque se invoca por navegación), y que `assertAppCheckConfig()` se invoca al arrancar el servidor desde `src/instrumentation.ts`
- [X] T103 Crear `tests/integration/volume.test.ts` (SC-010, emulador): sembrar 5 000 participantes; comprobar que `listParticipants()` devuelve los 5 000, que `filterParticipants` responde en menos de 2 000 ms para una consulta con tildes, que `toCsv` genera 5 001 líneas (encabezado + 5 000 filas) y que `executeDraw({ count: 50 })` termina sin ganadores repetidos; imprimir los tiempos medidos
- [X] T104 Crear `tests/integration/admin-routes-auth.test.ts` (SC-005): tabla de rutas `PUT /api/admin/registration`, `POST /api/admin/draws`, `GET /api/admin/participants/export`, `DELETE /api/admin/participants`; para cada una verificar 401 `UNAUTHORIZED` sin cookie, 403 `FORBIDDEN` con cookie de un usuario sin claim `admin` y, en las que modifican datos, 403 con encabezado `Origin` ajeno; `POST` y `DELETE /api/admin/session` quedan fuera de la tabla: ya se prueban en T053 (`DELETE` es idempotente y no exige sesión, para que cerrar sesión funcione aunque la sesión haya vencido)
- [ ] T105 Reemplazar el texto provisional de finalidad y política por el texto final entregado por la empresa en `src/lib/consent.ts` y `src/app/privacidad/page.tsx` y actualizar `CONSENT_VERSION` (Ley 29733)
- [X] T106 Crear `.github/workflows/ci.yml` (GitHub Actions) que en cada `push` y `pull_request` ejecute: checkout, Node 22, JDK 21 (`actions/setup-java`, distribución `temurin`), `npm ci`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test`, `npm run test:rules`, `npx playwright install --with-deps chromium` y `npm run test:e2e`; añadir un job separado `lighthouse` que ejecute `npm run perf` (el script ya levanta el emulador y construye la app en modo producción); las variables de prueba van en el propio workflow con valores ficticios (`demo-sorteo`), nunca secretos reales
- [X] T107 Ejecutar todas las puertas de calidad y corregir fallos: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test`, `npm run test:rules`, `npm run test:e2e`
- [X] T108 Ejecutar los 15 escenarios de `specs/001-registro-sorteo/quickstart.md` contra el entorno local con emuladores y registrar resultados
- [ ] T109 Preparar el despliegue según quickstart.md («Despliegue»): variables por entorno en Vercel (Preview → proyecto Firebase de desarrollo, Production → producción), `firebase deploy --only firestore:rules`, dominio de producción autorizado en App Check/reCAPTCHA Enterprise y en Auth, `npm run admin:grant` para las cuentas administradoras; en la consola de App Check fijar el umbral mínimo de puntuación de reCAPTCHA Enterprise (valor por defecto 0,5), activar la aplicación (enforcement) de la verificación y revisar las métricas de solicitudes rechazadas tras el primer evento; una regla de límite por IP en el firewall de Vercel sobre `POST /api/registrations` solo si se observa abuso, con un límite alto (≥ 100 solicitudes por minuto) porque en un evento muchas personas comparten la misma IP del wifi; verificar escenarios 1, 3, 6 y 8 sobre la URL desplegada

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias; T001 → T002 primero, el resto en paralelo.
- **Foundational (Phase 2)**: depende de Setup; BLOQUEA todas las historias.
- **US1 (P1)** y **US2 (P1)**: tras Foundational; US2 extiende archivos de US1 (`participants.service.ts`, `route.ts`, `RegistrationForm.tsx`), por lo que va después de US1.
- **US3 (P2)**: tras Foundational; no depende de US1 salvo por `participants.service.ts` (T062 se añade al archivo creado en T037) y por datos para probar.
- **US4 (P2)**: depende de US3 (autenticación T058/T060, layout T069) y de US1 (participantes).
- **US5 (P3)**: depende de US3 (T058, T062, T070).
- **US6 (P3)**: depende de US3 (T058, T073) y US4 (T083 para el historial).
- **Polish (Phase 9)**: tras las historias deseadas.

### Within Each User Story

- Pruebas primero (deben fallar) → utilidades de `lib/` → servicios → Route Handlers → componentes → páginas.
- Tareas que editan el mismo archivo (`participants.service.ts`, `schemas.ts`, `RegistrationForm.tsx`, `ParticipantsTable.tsx`, `campana/page.tsx`, `route.ts` de registrations) son secuenciales y no llevan `[P]`.

### Task-Level Dependencies Worth Noting

- T015 ← T014; T021 ← T010, T012; T032 ← T031; T037 ← T021, T032, T033; T038 ← T011, T032, T034, T037; T042 ← T018, T019, T020, T032, T035, T039, T040; T043 ← T015, T016, T021, T041, T042.
- T062 ← T037; T069 ← T058, T068; T071 ← T062, T070; T079 ← T077, T078; T089 ← T058, T062, T088; T097 ← T096; T098 ← T073, T097.
- T065 ← T011 (no depende de Firebase); T072, T082, T097 ← T065; T103 ← T062, T079, T088; T104 ← T060, T064, T080, T089, T095; T106 ← T001, T007, T099 (y recomienda ejecutarse antes de T107).
- T036 ← T034; T037 en adelante no dependen de él, pero el servidor lo ejecuta al arrancar (probado en T028).

### Parallel Opportunities

- Setup: T003–T008 en paralelo tras T002.
- Foundational: T010–T014, T016–T020, T022–T025 en paralelo (T015 espera a T014; T021 a T010/T012).
- Cada historia: todas sus pruebas `[P]` en paralelo; utilidades de `lib/` y componentes presentacionales `[P]` en paralelo.
- Tras Foundational, US1 y US3 pueden avanzar en paralelo (por equipos distintos), coordinando la edición de `participants.service.ts`.

---

## Parallel Example: User Story 1

```bash
# Pruebas de US1 en paralelo:
Task: "Pruebas unitarias en tests/unit/phone.test.ts"
Task: "Pruebas unitarias en tests/unit/schemas.test.ts"
Task: "Pruebas unitarias en tests/unit/app-check-enforcement.test.ts"
Task: "Pruebas de integración en tests/integration/registrations.route.test.ts"
Task: "Prueba E2E en tests/e2e/registration.spec.ts"

# Utilidades y componentes independientes de US1:
Task: "Implementar src/lib/validation/phone.ts"
Task: "Implementar src/lib/consent.ts"
Task: "Implementar src/services/app-check.service.ts"
Task: "Implementar src/services/firebase/app-check-client.ts"
Task: "Crear src/components/registration/ConsentField.tsx"
Task: "Crear src/components/registration/SuccessPanel.tsx"
Task: "Crear src/components/registration/ClosedNotice.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Fase 1: Setup. 2. Fase 2: Foundational. 3. Fase 3: US1. 4. Fase 4: US2 (duplicados; es P1 y parte del flujo básico).
5. **DETENERSE y VALIDAR**: escenarios 1 a 5 del quickstart y Lighthouse sobre `/`. El QR ya puede publicarse para captar registros.

### Incremental Delivery

1. Setup + Foundational → base lista.
2. US1 + US2 → captación de participantes (MVP desplegable).
3. US3 → panel protegido, listado, búsqueda y cierre de inscripciones.
4. US4 → sorteo.
5. US5 → exportación CSV (puede adelantarse antes del sorteo si se quiere respaldar datos).
6. US6 → borrado de datos al terminar la campaña.
7. Polish → rendimiento, accesibilidad, seguridad, texto legal final y despliegue.

### Parallel Team Strategy

Tras Foundational: Desarrollador A → US1 → US2; Desarrollador B → US3 → US4 → US5 → US6 (comparten `participants.service.ts`, coordinar los cambios).

---

## Notes

- `[P]` = archivos distintos y sin dependencias pendientes.
- La etiqueta `[Story]` da trazabilidad con el spec; Setup, Foundational y Polish no llevan etiqueta.
- Verificar que las pruebas fallen antes de implementar cada historia.
- Hacer commit tras cada tarea o grupo lógico.
- El proyecto no tenía `git`; T009 (fin de Setup) lo inicializa y el remoto se configura en GitHub, donde correrá el workflow de T106.
- Evitar: tareas vagas, conflictos en el mismo archivo, colores literales fuera de `src/app/globals.css`, importar `firebase`/`firebase-admin` fuera de `src/services/**` y `scripts/**`.
