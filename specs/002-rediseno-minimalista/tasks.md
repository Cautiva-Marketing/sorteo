---

description: "Task list for Rediseño minimalista y simplificación del registro"
---

# Tasks: Rediseño minimalista y simplificación del registro

**Input**: Design documents from `/specs/002-rediseno-minimalista/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/http-api.md, quickstart.md

**Tests**: INCLUIDAS. La constitución v2.0.0 (principio VI y puertas de calidad) exige pruebas unitarias,
la prueba E2E del registro (éxito, duplicado y datos inválidos), pruebas de reglas y Lighthouse ≥ 90. Dentro
de cada historia, las pruebas se escriben primero y deben fallar antes de implementar.

**Organization**: Tareas agrupadas por historia de usuario del spec para implementar y probar cada una por
separado. Es un cambio sobre una aplicación ya construida (feature 001): muchas tareas **editan** o
**eliminan** archivos existentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia de usuario a la que pertenece (US1…US4)
- Todas las rutas son relativas a la raíz del repo (`D:\Trabajos\Cautiva Marketing\sorteo`)

## Path Conventions

Aplicación Next.js única en la raíz: `src/app`, `src/components`, `src/lib`, `src/services`, `src/types`,
`tests/{unit,integration,rules,e2e}`, `scripts/`, `public/`. Solo `src/services/**` importa `firebase` o
`firebase-admin`; `src/lib/**` es lógica pura sin Firebase ni React. **Antes de escribir código de Next.js**
(`AGENTS.md`): consultar la guía correspondiente en `node_modules/next/dist/docs/` (fuentes:
`01-app/01-getting-started/13-fonts.md`; `headers()` es asíncrona).

## Mapa de tokens (referencia para todas las tareas de diseño)

Valores en [research.md D-104](research.md#d-104-design-tokens-blanco-y-negro-con-acento-azul). Clases nuevas:
`bg-paper`, `bg-paper-soft`, `text-ink-900`, `text-ink-600`, `text-ink-500`, `border-ink-300` (bordes de
campos), `border-line` (bordes decorativos), `text-accent-600` / `outline-accent-600` (foco, enlaces),
`bg-accent-500` (solo adornos no textuales), `text-danger-700`, `text-success-700`, `font-display`,
`font-sans`. Equivalencias de las clases viejas: `bg-brand-50`→`bg-paper`; botón primario
`bg-brand-600 text-white hover:bg-brand-700`→`bg-ink-900 text-paper hover:bg-ink-600`;
`border-brand-700`/`text-brand-700`→`border-line`/`text-ink-900` (títulos) o `text-accent-600` (enlaces);
`outline-brand-500`→`outline-accent-600`; `border-ink-600` en campos→`border-ink-300`;
`border-brand-100`/`border-brand-200`→`border-line`; `bg-brand-50` en tarjetas→`bg-paper-soft`; `bg-white`→
`bg-paper`. No se permiten colores literales fuera de `src/app/globals.css`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dependencia nueva y recursos de marca.

- [X] T001 Instalar la única dependencia nueva con versión exacta: `npm install --save-exact uqr@0.1.3` (MIT, sin dependencias; genera el QR en el servidor, justificación en research D-107). Comprobar que `package.json` queda con `"uqr": "0.1.3"` y que `package-lock.json` se actualiza; ejecutar `npm run typecheck`
- [X] T002 [P] Crear `public/logo-claro.svg`: copia de `logo.svg` (raíz) conservando el `viewBox="0 0 584.86 175.86"` y la clase `.cls-2 { fill: #3d8cd3 }`, cambiando la regla `.cls-1 { fill: #fff; }` por `fill: #0a0a0a;` (los 15 trazados de texto pasan a casi negro; los 4 azules no cambian). No modificar el `logo.svg` de la raíz
- [X] T003 [P] Crear `public/icono-ti.webp`: descargar el ícono «ti» de `https://cautivamarketing.com/img/Icono%20lLogo%20Cautiva%20Marketing%20-%20Agencia%20de%20marketing.webp` (1309×1143 px, 26 KB), redimensionar a ≤ 400 px de ancho manteniendo la proporción y exportar a WebP con peso < 10 KB (con la herramienta disponible: `cwebp`, `npx sharp-cli`, o un lienzo de Chromium vía Playwright); abrir el resultado y comprobar que se ve igual que el original (mancha azul con «t» blanca e «i» celeste)
- [X] T004 [P] Actualizar `.prettierignore`: añadir las líneas `public/logo-claro.svg` y `public/icono-ti.webp` (la línea `public/logo.svg` se retira en T012)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tokens de diseño, fuentes, logo y componentes base que TODAS las historias usan.

**⚠️ CRITICAL**: Ninguna historia puede empezar hasta completar esta fase. Los tokens `brand-*` se conservan **temporalmente** para que el panel siga viéndose bien hasta la historia US4; se eliminan en T066. El encabezado del panel y del login pasa a fondo claro **en esta fase** (T013–T015) porque el logo claro de T007 no se ve sobre el encabezado oscuro actual; el resto del panel se migra en US4.

- [X] T005 Actualizar `src/app/globals.css` (único archivo con colores literales). En `@theme` añadir exactamente: `--color-paper: #ffffff; --color-paper-soft: #f5f5f5; --color-ink-900: #0a0a0a; --color-ink-600: #525252; --color-ink-500: #737373; --color-ink-300: #8c8c8c; --color-line: #e5e5e5; --color-accent-600: #0a70bb; --color-accent-500: #3d8cd3;` (cambian los valores de `ink-900` y `ink-600`; `danger-700: #b42318` y `success-700: #067647` se conservan). Mantener los `--color-brand-*` actuales con un comentario `/* TEMPORAL: se eliminan en T066 */`. Añadir un bloque `@theme inline { --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif; --font-display: var(--font-space-grotesk), ui-sans-serif, system-ui, sans-serif; }`. Mantener la regla `prefers-reduced-motion` y (por ahora) `.grecaptcha-badge`
- [X] T006 Actualizar `src/app/layout.tsx` (depende de T005): importar `Space_Grotesk` e `Inter` de `next/font/google` con `subsets: ["latin"]`, `display: "swap"` y `variable: "--font-space-grotesk"` / `"--font-inter"` (fuentes variables: sin lista de pesos); `<html lang="es-PE" className={`${inter.variable} ${spaceGrotesk.variable}`}>`; `body` con `font-sans bg-paper text-ink-900 min-h-dvh antialiased`; conservar `metadata` y `viewport`
- [X] T007 [P] Reescribir `src/components/ui/Logo.tsx` (depende de T002, T003): prop `variant?: "full" | "icon"` (por defecto `"full"`) y `className?`. `full`: `<span role="img" aria-label="Cautiva Marketing" className="inline-flex items-center gap-3">` con `<img src="/icono-ti.webp" alt="" aria-hidden="true" width={50} height={44}>` y `<img src="/logo-claro.svg" alt="" aria-hidden="true" width={146} height={44}>` (ambas con `fetchPriority="high"`; mantener el `eslint-disable-next-line @next/next/no-img-element` justificado: SVG/WebP estáticos). `icon`: solo el ícono, `alt=""`, `aria-hidden`, prop `size` (por defecto 56 de alto, ancho proporcional 1309:1143). Reemplazar el comentario «SOLO sobre `bg-ink-900`» por uno que explique que el logo claro es para fondos claros
- [X] T008 [P] Restyle `src/components/ui/Button.tsx` con el mapa de tokens: `primary` = `bg-ink-900 text-paper hover:bg-ink-600 uppercase tracking-wider`; `secondary` = `border border-ink-300 bg-paper text-ink-900 hover:bg-paper-soft`; `danger` = `bg-danger-700 text-paper hover:opacity-90`; `rounded-lg`; foco `focus-visible:outline-accent-600`; conservar `min-h-11 min-w-11`, `buttonClassName`, `loading`/`aria-busy` y `disabled:opacity-60`
- [X] T009 [P] Restyle `src/components/ui/TextField.tsx`: etiqueta `text-sm font-semibold uppercase tracking-wide text-ink-900` (solo CSS; el texto accesible no cambia); nueva prop opcional `icon?: ReactNode` dibujada a la izquierda dentro del campo (`aria-hidden`, `text-ink-500`) con `pl-11` en el `input` cuando existe; `input` con `rounded-lg border-ink-300 bg-paper placeholder:text-ink-500 focus-visible:outline-accent-600` (`border-danger-700` si hay error). Conservar `forwardRef`, `useId`, `aria-describedby`, `aria-invalid` y la región `aria-live="polite"` del error
- [X] T010 [P] Restyle `src/components/ui/Alert.tsx`: `info` = `border-ink-300 text-ink-900` (sin tokens `brand-*`), `bg-paper`, `rounded-lg`; conservar `role="alert"` para `error` y `role="status" aria-live="polite"` para el resto
- [X] T011 [P] Actualizar `src/components/ui/Dialog.tsx`: añadir prop opcional `icon?: ReactNode` que se dibuja centrado sobre el título; clases `m-auto w-[calc(100%-2rem)] max-w-md overflow-visible rounded-2xl border border-line bg-paper p-6 text-ink-900 backdrop:bg-ink-900/60` y título `font-display`; **corregir el cierre programático**: el evento `close` provocado por pasar `open=false` NO debe llamar a `onClose` (usar una referencia que se active justo antes de `dialog.close()` y se limpie en el manejador del evento), de modo que `onClose` solo se invoque cuando el usuario cierra con Escape. Conservar `showModal()`, foco contenido, `aria-labelledby` y el montaje del contenido solo mientras está abierto. Comprobar que `src/components/admin/PurgeDialog.tsx` sigue funcionando (se valida en T065)
- [X] T012 Eliminar `public/logo.svg` y quitar la línea `public/logo.svg` de `.prettierignore` (depende de T007). Comprobar con `grep -rn "logo.svg" src` que solo quedan referencias a `/logo-claro.svg`. Ejecutar `npm run typecheck && npm run lint && npm run test:unit`
- [X] T013 [P] Editar `src/app/admin/(panel)/layout.tsx`: `<header className="border-b border-line bg-paper px-4 py-4">` (sin `bg-ink-900`) con `<Logo />` y `<AdminNav />` (está en Foundational y no en US4 porque el `Logo` claro de T007 no se ve sobre el encabezado oscuro actual del panel)
- [X] T014 [P] Editar `src/components/admin/AdminNav.tsx`: quitar `text-white` y los fondos `bg-brand-700*`; `itemClasses` = `inline-flex min-h-11 min-w-11 items-center border-b-2 px-3 py-2 text-base font-medium text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600`; enlace activo `border-ink-900 font-semibold`, inactivo `border-transparent hover:border-ink-300`; botón «Cerrar sesión» `ml-auto border-transparent underline hover:text-accent-600 disabled:opacity-60`; actualizar el comentario («sobre fondo `bg-ink-900`») y conservar `aria-current` y el cierre de sesión
- [X] T015 [P] Editar `src/app/admin/login/page.tsx` (`<header className="flex justify-center border-b border-line bg-paper px-4 py-6">`, `h1` con `font-display`) y aplicar el mapa de tokens a `src/components/admin/LoginForm.tsx` si usa clases `brand-*`/`bg-white`

**Checkpoint**: tokens, fuentes, logo claro y componentes base listos; el encabezado del panel y del login ya muestra el logo claro sobre fondo blanco; la aplicación compila.

---

## Phase 3: User Story 1 - Registrarse con un formulario limpio y sin trámites legales (Priority: P1) 🎯 MVP

**Goal**: `/registro` muestra el formulario minimalista de tres campos, sin consentimiento, política de privacidad ni reCAPTCHA/App Check, y el registro se guarda sin ninguna verificación adicional. Al terminar se muestra un aviso de agradecimiento (la ventana de bienvenida llega con US2).

**Independent Test**: abrir `/registro` en 360 px, completar los tres campos y enviar: no hay casillero, enlace legal ni mención de reCAPTCHA; el documento `participants/+51…` se crea sin `consent`; `POST /api/registrations` funciona sin cabecera de App Check; `/privacidad` da 404.

### Tests for User Story 1 (escribir primero; deben fallar antes de implementar) ⚠️

- [X] T016 [P] [US1] Actualizar `tests/unit/schemas.test.ts`: quitar `consent` y `consentVersion` del objeto `valid`; eliminar el bloque `describe("consent", …)` (líneas ~100–118); en la prueba «todos los mensajes de error están en español» esperar las rutas `["company", "fullName", "phone"]`; añadir la prueba «descarta consent y consentVersion si llegan»: `registrationSchema.parse({ ...valid, consent: true, consentVersion: "x" })` es igual a `{ ...valid, phone: "+51987654321" }` (sin esas claves)
- [X] T017 [P] [US1] Actualizar `tests/integration/helpers.ts`: eliminar la línea `process.env.APP_CHECK_ENFORCEMENT ??= "off";`, la constante `SEED_CONSENT_VERSION` con su comentario y la clave `consent` de los documentos de `seedParticipants` (quedan `fullName`, `phone`, `company`, `createdAt`, `drawId: null`)
- [X] T018 [P] [US1] Actualizar `tests/integration/registrations.route.test.ts`: quitar el `vi.hoisted`/`vi.mock` de `getAdminAppCheck`, el import de `CONSENT_VERSION`, `consent`/`consentVersion` de `validBody` y los `vi.stubEnv("APP_CHECK_ENFORCEMENT", …)`; eliminar las pruebas «401 APP_CHECK_FAILED» (dos), «201 con enforcement activo y token válido» y «409 CONSENT_VERSION_MISMATCH»; en la prueba 201 esperar que las claves del documento sean exactamente `["company", "createdAt", "drawId", "fullName", "phone"]` y que NO exista `consent`; en la prueba 400 quitar `consent: false` y esperar `fieldErrors` con las claves `["company", "fullName", "phone"]`; añadir «201: ignora `consent` y `consentVersion` si llegan y no los guarda» y «201: sin cabecera X-Firebase-AppCheck». Conservar cerrado (403), duplicado, cuerpo no JSON, `Origin` ajeno (403 `FORBIDDEN`) y no-fuga de datos
- [X] T019 [P] [US1] Actualizar `tests/integration/duplicates.test.ts`: quitar el import de `CONSENT_VERSION` y las claves `consent`/`consentVersion` de `body()`
- [X] T020 [P] [US1] Actualizar `tests/integration/export.route.test.ts` (quitar `consent: { acceptedAt: createdAt, version: "seed-v1" }` de los dos documentos sembrados, líneas ~89 y ~100) y `tests/integration/participants.list.test.ts` (línea ~68: cambiar el comentario «no se exponen el consentimiento ni otros campos» por «no se exponen otros campos», sin tocar las aserciones)
- [X] T021 [P] [US1] Actualizar `tests/e2e/helpers/emulators.ts`: quitar el campo `consent` de los documentos de participante que siembra (líneas ~56 y ~172) para que coincidan con el modelo de la 002
- [X] T022 [P] [US1] Crear `tests/integration/legacy-consent.test.ts` (usa `./helpers`; para la sesión de administrador sigue el patrón de `tests/integration/export.route.test.ts`): los documentos anteriores a la 002 que todavía traen el mapa `consent` (`consent: { acceptedAt: <Date>, version: "2026-10-v1" }` junto a `fullName`, `phone`, `company`, `createdAt`, `drawId: null`) siguen funcionando: (1) `listParticipants()` los devuelve y cada elemento tiene exactamente las claves `company`, `createdAt`, `drawId`, `fullName`, `phone` (sin `consent`); (2) `GET /api/admin/participants/export` incluye su fila y el encabezado sigue siendo exactamente `Nombres,Celular,Empresa u ocupación,Fecha de registro` (sin columna de consentimiento); (3) `executeDraw({ count: 1 }, { uid: "u1", email: "admin@example.com" })` puede elegirlo y `winners[0]` trae solo `fullName`, `company` y `phone`; (4) con `seedRegistrationStatus(false)`, `purgeAllParticipantData("u1")` lo elimina (la colección `participants` queda en 0). Cubre el caso borde «Registros creados antes de este cambio» de spec.md y «Documentos anteriores» de data-model.md
- [X] T023 [US1] Reescribir `tests/e2e/registration.spec.ts` para `/registro` (depende de T021): `openForm` hace `goto("/registro")`; campos sin consentimiento; botón `getByRole("button", { name: "Enviar y participar" })`. Pruebas: (1) logo `getByRole("img", { name: "Cautiva Marketing" })`, tres campos y botón visibles, **ningún** checkbox y ningún texto que coincida con `/consentimiento|privacidad|reCAPTCHA|finalidad/i`, sin desplazamiento horizontal; (2) envío válido («José Núñez Güemes», `987 654 321`, «Cautiva Marketing») muestra el texto «¡Gracias por registrarte!» y el formulario desaparece; (3) errores junto a cada campo con `aria-invalid`/`aria-describedby` y valores conservados (nombre «María», celular `812345678`, empresa de 101 caracteres), sin aserciones de consentimiento; (4) con `setRegistrationOpen(false)`, `/registro` muestra el heading «Las inscripciones están cerradas» y ningún campo ni botón; (5) `const response = await page.goto("/privacidad"); expect(response?.status()).toBe(404)`
- [X] T024 [P] [US1] Actualizar `tests/e2e/admin-access.spec.ts` (líneas ~131–165) y `tests/e2e/duplicate.spec.ts`: `goto("/")` → `goto("/registro")`; botón «Participar» → «Enviar y participar»; eliminar las líneas `getByRole("checkbox").check()`; en `duplicate.spec.ts` la primera confirmación pasa de «¡Listo! Ya estás participando» a «¡Gracias por registrarte!» (también en el `toHaveCount(0)` de la segunda comprobación); mantener «Ya estás participando en el sorteo» para el aviso de duplicado

### Implementation for User Story 1

- [X] T025 [US1] Editar `src/lib/validation/schemas.ts`: quitar `consent` y `consentVersion` de `registrationSchema` (queda `z.object({ fullName, phone, company })`). Reglas que NO cambian y se verifican con T016: `fullName` = «NFC, espacios colapsados, ≥ 2 términos de solo letras Unicode, ≤ 100 caracteres»; `phone` = «`+51` + `^9\d{8}$`», aceptando espacios, guiones, `+51`/`51`; `company` = «2–100 caracteres, espacios colapsados, sin caracteres de control»
- [X] T026 [P] [US1] Editar `src/types/index.ts`: quitar `consent: { acceptedAt; version }` de `Participant` y los códigos `"APP_CHECK_FAILED"` y `"CONSENT_VERSION_MISMATCH"` de `ApiErrorCode`
- [X] T027 [US1] Editar `src/services/participants.service.ts` (depende de T025, T026): eliminar el import de `CONSENT_VERSION`, la clase `ConsentVersionMismatchError`, la comprobación de versión al inicio de `registerParticipant` y el mapa `consent` del `transaction.create`; el documento creado queda con exactamente `fullName`, `phone`, `company`, `createdAt` (`FieldValue.serverTimestamp()`) y `drawId: null`; conservar la transacción (lee `settings/registration`, lanza `RegistrationClosedError` si `open === false`) y el manejo de `ALREADY_EXISTS`
- [X] T028 [US1] Editar `src/app/api/registrations/route.ts` (depende de T027): quitar el import y la llamada a `verifyAppCheckToken`, la lectura de `X-Firebase-AppCheck` y la rama de `ConsentVersionMismatchError`; conservar `assertSameOrigin`, el parseo JSON, `registrationSchema.safeParse` (400 con `zodToFieldErrors`), `RegistrationClosedError` (403), `AlreadyRegisteredError` (409), el 201 `{ status: "registered" }` y el `console.error` sin datos personales
- [X] T029 [P] [US1] Reescribir el comentario de `assertSameOrigin` en `src/lib/http.ts`: sin `Origin` la petición no proviene de un navegador (no es CSRF) y se deja pasar; quitar la frase «la protección real recae en App Check o en la sesión» (ahora solo la sesión protege el panel y el registro queda sin verificación anti-automatización por decisión de la empresa, constitución III). No cambiar el comportamiento
- [X] T030 [P] [US1] Crear `src/components/registration/ThanksPanel.tsx` (reemplaza a `SuccessPanel.tsx`, que se elimina): `<section role="status">` con `rounded-2xl border border-line bg-paper px-4 py-8 text-center`, ícono de verificación SVG `text-ink-900`, `<h2 className="font-display text-2xl font-bold text-ink-900">¡Gracias por registrarte!</h2>` y `<p className="text-base text-ink-600">Tu registro quedó guardado. Te contactaremos al celular que registraste si resultas ganador. ¡Mucha suerte!</p>`
- [X] T031 [P] [US1] Restyle `src/components/registration/ClosedNotice.tsx` y `src/components/registration/AlreadyRegisteredPanel.tsx` con el mapa de tokens: `border-brand-700`→`border-line`, títulos `text-brand-700`→`text-ink-900 font-display`, íconos `text-brand-700`→`text-ink-900`, `rounded-2xl`; conservar textos, `role="status"` y los headings exactos «Las inscripciones están cerradas» y «Ya estás participando en el sorteo»
- [X] T032 [US1] Reescribir `src/components/registration/RegistrationForm.tsx` (depende de T025, T030, T031): quitar `ConsentField`, `CONSENT_VERSION`, `preloadAppCheck`/`getRegistrationToken`, `handleFirstFocus`/`onFocus`, el encabezado `X-Firebase-AppCheck`, los mensajes `appCheck`/`verification`/`outdatedConsent` y las ramas 401 y `CONSENT_VERSION_MISMATCH`; `FieldName` = `"fullName" | "phone" | "company"`; `defaultValues` = `{ fullName: "", phone: "", company: "" }`; vistas `"form" | "thanks" | "already" | "closed"` (201 → `thanks` con `ThanksPanel`; 409 → `already` con `AlreadyRegisteredPanel`; 403 `REGISTRATION_CLOSED` → `closed`); campos con ícono SVG inline (persona, teléfono, maletín) mediante la prop `icon` de `TextField`, con las etiquetas «Nombres completos», «Celular» (`helpText` «9 dígitos, por ejemplo 987 654 321.») y «Empresa u ocupación»; botón `<Button type="submit" loading={isSubmitting} className="w-full">{isSubmitting ? "Enviando…" : "Enviar y participar"}</Button>`; conservar la protección contra doble envío (`submitting` ref) y el foco al aviso de resultado
- [X] T033 [P] [US1] Eliminar el código de App Check (depende de T028, T032): borrar `src/services/app-check.service.ts`, `src/services/firebase/app-check-client.ts`, `src/instrumentation.ts` y `tests/unit/app-check-enforcement.test.ts`; en `src/services/firebase/admin.ts` quitar el import de `getAppCheck`/`AppCheck` y la función `getAdminAppCheck()`. Comprobar con `grep -rniE "app-?check|recaptcha" src tests scripts playwright.config.ts .env.example` que no quedan referencias (T038 limpia las de configuración)
- [X] T034 [P] [US1] Eliminar el código de consentimiento y privacidad (depende de T032): borrar `src/lib/consent.ts`, `src/components/registration/ConsentField.tsx`, `src/components/ui/CheckboxField.tsx`, `src/components/registration/SuccessPanel.tsx` y `src/app/privacidad/page.tsx`; `grep -rniE "consent|privacidad" src` no debe devolver nada
- [X] T035 [US1] Crear `src/app/registro/page.tsx` (depende de T032): Server Component con `export const dynamic = "force-dynamic"` y `metadata = { title: "Registro | Sorteo" }`; `const { open } = await getRegistrationStatus()`; estructura `flex min-h-dvh flex-col`: encabezado centrado con `<Logo />`; `<main className="mx-auto w-full max-w-md flex-1 px-4 py-6">` con `<h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">Regístrate en el sorteo</h1>`, `<p className="mb-6 text-base text-ink-600">Completa tus 3 datos para participar en el sorteo.</p>` y, si `open`, una tarjeta `rounded-2xl border border-line bg-paper p-6` con `<RegistrationForm />`, si no `<ClosedNotice />`; pie `border-t border-line` con `<p className="text-xs font-medium uppercase tracking-[0.3em] text-ink-600">Cautiva Marketing</p>`
- [X] T036 [US1] Reemplazar el contenido de `src/app/page.tsx` por una redirección temporal: `import { redirect } from "next/navigation"; export default function HomePage() { redirect("/registro"); }` con el comentario «TEMPORAL: la pantalla del QR llega en T059 (US3)». Con esto `/` deja de mostrar el formulario y de enlazar a `/privacidad`
- [X] T037 [P] [US1] Editar `src/app/globals.css`: eliminar la regla `.grecaptcha-badge { visibility: hidden; }` y su comentario
- [X] T038 [P] [US1] Limpiar la configuración de App Check/reCAPTCHA: en `.env.example` borrar `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` (y su comentario) y `APP_CHECK_ENFORCEMENT` (y su comentario); en `playwright.config.ts` borrar la línea `APP_CHECK_ENFORCEMENT: "off",`; en `scripts/lighthouse.mjs` borrar `NEXT_PUBLIC_RECAPTCHA_SITE_KEY: "dummy-site-key"`, `delete env.APP_CHECK_ENFORCEMENT;` y retirar «App Check activo» de los comentarios de las líneas ~6 y ~29. (`.env.local` es un archivo local no versionado: si existe, quitar ahí también esas dos variables)
- [X] T039 [US1] Punto de control: ejecutar `npm run typecheck && npm run lint && npm run format:check && npm test`, luego `npm run test:e2e -- tests/e2e/registration.spec.ts tests/e2e/duplicate.spec.ts tests/e2e/admin-access.spec.ts` y abrir `/registro` a mano en 360 px; corregir lo que falle

**Checkpoint**: US1 funcional y probable por sí sola: registro de tres campos, sin consentimiento ni anti-spam, en `/registro`.

---

## Phase 4: User Story 2 - Ver un mensaje de bienvenida al registrarse (Priority: P1)

**Goal**: al registrarse aparece una ventana modal con confeti en blanco y negro, «¡Bienvenido(a)!», el nombre, el ticket con el celular completo y el estado «En sorteo», y las acciones «Listo, muchas gracias» y «Registrar a otra persona». Un celular repetido muestra una ventana del mismo estilo.

**Independent Test**: registrar un participante y ver la ventana con su nombre y celular; «Registrar a otra persona» deja el formulario vacío con el foco en el primer campo; «Listo, muchas gracias» (o Escape) muestra el aviso final; con movimiento reducido no hay confeti.

### Tests for User Story 2 (escribir primero; deben fallar antes de implementar) ⚠️

- [X] T040 [P] [US2] Añadir a `tests/unit/phone.test.ts` pruebas de `formatNationalPhone`: `"+51987654321"` → `"987 654 321"`; `"987654321"` → `"987 654 321"`; una entrada que no son 9 dígitos se devuelve tal cual
- [X] T041 [P] [US2] Actualizar `tests/e2e/registration.spec.ts` (después de T023): sustituir la prueba de envío válido por: la ventana `getByRole("dialog")` muestra «¡Bienvenido(a)!», «José Núñez Güemes», `987 654 321` completo y «En sorteo»; «Registrar a otra persona» cierra la ventana, deja los tres campos vacíos y el foco en «Nombres completos» (y NO aparece «¡Gracias por registrarte!»); un segundo registro con «Listo, muchas gracias» muestra «¡Gracias por registrarte!» y sin formulario; Escape equivale a «Listo»; un nombre de 100 caracteres se ajusta sin desbordamiento horizontal; con `page.emulateMedia({ reducedMotion: "reduce" })` el elemento `[data-confetti]` no es visible; con Tab repetido (≥ 10 veces) `document.activeElement` sigue dentro del `dialog`
- [X] T042 [P] [US2] Actualizar `tests/e2e/duplicate.spec.ts`: tras el segundo envío con el mismo celular, `getByRole("dialog")` muestra «Ya estás participando en el sorteo» con el botón «Registrar a otra persona», no aparece «¡Bienvenido(a)!», no hay `[role=alert]` en `main` y sigue habiendo 1 participante; «Registrar a otra persona» devuelve el formulario vacío

### Implementation for User Story 2

- [X] T043 [US2] Añadir `formatNationalPhone(value: string): string` a `src/lib/validation/phone.ts`: acepta E.164 (`+51XXXXXXXXX`) o 9 dígitos, devuelve `XXX XXX XXX` y, si tras quitar `+51` no son exactamente 9 dígitos, devuelve el texto original sin cambios
- [X] T044 [P] [US2] Crear `src/components/ui/Confetti.tsx` y sus estilos en `src/app/globals.css`: componente (sin estado ni `Math.random`) que dibuja 28 piezas `<span>` dentro de `<div aria-hidden="true" data-confetti className="pointer-events-none fixed inset-0 overflow-hidden motion-reduce:hidden">`; posición horizontal, retardo, duración y giro derivados del índice (p. ej. `left: ((i * 37) % 100)%`, `--delay`, `--duration`, `--spin` como variables CSS en `style`); colores solo con clases de token alternando `bg-ink-900`, `bg-paper border border-ink-300` y `bg-ink-500`; en `globals.css` un `@keyframes confetti-fall` (caída de arriba abajo con giro y desvanecimiento final) y una clase `.confetti-piece` que lo aplica con `animation-fill-mode: both` y 1 iteración
- [X] T045 [US2] Crear `src/components/registration/WelcomeDialog.tsx` (depende de T011, T043, T044): props `{ open: boolean; fullName: string; phone: string; onDone: () => void; onRegisterAnother: () => void }` (`phone` son los 9 dígitos nacionales). Usa `Dialog` con `title="¡Bienvenido(a)!"`, `icon={<Logo variant="icon" size={56} />}` y `onClose={onDone}` (Escape equivale a «Listo»); dentro: nombre completo en `<p className="font-display text-xl font-bold break-words">`, texto «Tu registro se completó con éxito. Ya estás participando en el sorteo. ¡Te deseamos mucha suerte!», tarjeta de ticket `rounded-xl border border-line bg-paper-soft p-4` con encabezado «TICKET REGISTRADO» (ícono de ticket `text-accent-600`) y dos pares etiqueta/valor: «CELULAR:» con `formatNationalPhone(phone)` y «ESTADO:» con «En sorteo» y un ícono de verificación `text-success-700`; botones `<Button className="w-full">Listo, muchas gracias</Button>` (`onDone`) y `<Button variant="secondary" className="w-full">` con ícono de persona y «Registrar a otra persona» (`onRegisterAnother`); renderiza `<Confetti />` mientras `open`
- [X] T046 [P] [US2] Crear `src/components/registration/AlreadyRegisteredDialog.tsx` (depende de T011) y eliminar `src/components/registration/AlreadyRegisteredPanel.tsx`: props `{ open; onDone; onRegisterAnother }`; `Dialog` con `title="Ya estás participando en el sorteo"`, ícono de información `text-accent-600`, texto «Ese celular ya está registrado, no necesitas hacer nada más. ¡Mucha suerte!», los mismos dos botones que `WelcomeDialog`; sin ticket ni confeti y sin mostrar ningún dato del registro existente
- [X] T047 [US2] Actualizar `src/components/registration/RegistrationForm.tsx` (depende de T045, T046; después de T032): estado `dialog: "welcome" | "already" | null` y `welcome: { fullName: string; phone: string } | null`; en el 201 guardar `welcome = { fullName: values.fullName, phone: toNational(values.phone) }` (valores ya normalizados por Zod: `phone` llega en E.164; usar `toNational` de `src/lib/validation/phone.ts`) y `dialog = "welcome"`; en el 409 `dialog = "already"`; el formulario permanece montado bajo la ventana; `onRegisterAnother`: `dialog = null`, `welcome = null`, `reset()` (valores por defecto vacíos) y marcar una referencia `focusFirstField`; `onDone`: `dialog = null` y `view = "thanks"`; un `useEffect` que, cuando `dialog === null && focusFirstField.current`, ejecute `setFocus("fullName")` (el efecto del `Dialog` hijo cierra el `<dialog>` antes que el del padre, así el foco no vuelve al botón de envío); retirar el uso de `AlreadyRegisteredPanel` y de la vista `already`
- [X] T048 [US2] Punto de control: `npm run typecheck && npm run lint && npm run test:unit` y `npm run test:e2e -- tests/e2e/registration.spec.ts tests/e2e/duplicate.spec.ts`; comprobar a mano el confeti y la ventana en 360 px y en escritorio

**Checkpoint**: US1 y US2 (ambas P1) completas: registro con ventana de bienvenida y registro asistido.

---

## Phase 5: User Story 3 - Mostrar una pantalla con QR y contador para proyectar en el evento (Priority: P2)

**Goal**: `/` es la pantalla del QR: logo, título, QR con el ícono «ti» que abre `/registro`, contador de registrados que se actualiza solo y botón «Registrarme desde este dispositivo»; con inscripciones cerradas, el QR y el botón se reemplazan por el aviso.

**Independent Test**: abrir `/` en una pantalla grande y en un celular (no hay formulario); escanear el QR (abre `/registro`); registrar a alguien y ver subir el contador en ≤ 5 s sin recargar; cerrar las inscripciones y ver el aviso en la pantalla abierta.

### Tests for User Story 3 (escribir primero; deben fallar antes de implementar) ⚠️

- [X] T049 [P] [US3] Crear `tests/unit/qr.test.ts` para `buildQr(text)` de `src/lib/qr.ts`: devuelve `{ size, path, logo: { x, y, size } }`; `size` es un entero impar ≥ 21; el lado del recuadro del ícono es impar, `logo.size <= Math.floor(size * 0.2)` y está centrado (`logo.x === logo.y === (size - logo.size) / 2`); ningún módulo dentro del recuadro del ícono aparece en `path`; el resultado es determinista (misma entrada → misma salida) y entradas distintas dan rutas distintas; la ruta solo usa comandos `M`, `h`, `v`, `z` y coordenadas dentro de `[0, size]`
- [X] T050 [P] [US3] Crear `tests/integration/status.route.test.ts` (usa `./helpers`): `GET /api/status` sin documentos responde 200 con exactamente `{ open: true, count: 0 }`, cabecera `Cache-Control: no-store` y claves `["count", "open"]`; con 3 participantes sembrados (`seedParticipants(3)`) y `invalidatePublicStatus()` devuelve `count: 3`; la memoria de 1 s: sembrar 1 participante, consultar (`count: 1`), sembrar otro y consultar de inmediato (sigue `1`), llamar `invalidatePublicStatus()` y consultar (`2`); con `seedRegistrationStatus(false)` + `invalidatePublicStatus()` devuelve `open: false`; el texto de la respuesta no contiene ningún nombre ni celular sembrado
- [X] T051 [P] [US3] Crear `tests/unit/origin.test.ts` para `buildOrigin(headers)` de `src/lib/origin.ts` (usar `new Headers({ … })`): `x-forwarded-host: "sorteo.example.com"` + `x-forwarded-proto: "https"` → `https://sorteo.example.com`; con varios valores (`"a.example.com, b.example.com"`, `"http, https"`) usa el primero; si `x-forwarded-host` no es válido (`"evil.com/x"`, `"a b"`, `"user@evil.com"`, `"x.com?y"`, vacío) cae a `host`; `host: "localhost:3000"` y `127.0.0.1:3000` sin protocolo → `http://…`; un dominio sin `x-forwarded-proto` → `https://…`; un `x-forwarded-proto` distinto de `http`/`https` se ignora; se aceptan mayúsculas; devuelve `null` (nunca `localhost`) si ningún encabezado trae un host válido (sin encabezados, `host` con espacio, barra, `@`, `?`, `#`, `\` o con puerto de más de 5 dígitos)
- [X] T052 [P] [US3] Crear `tests/e2e/qr-screen.spec.ts`: (a) `/` muestra el logo «Cautiva Marketing», el heading «Regístrate y participa en el sorteo», el QR (`svg[role="img"]` con `data-url` igual a `<baseURL>/registro` y una `<image>` dentro), el texto «0 registrados», el enlace «Registrarme desde este dispositivo» con `href="/registro"`, ningún campo `getByLabel("Nombres completos")` y sin desplazamiento horizontal a 360 px; (b) pulsar el enlace lleva a `/registro` con el formulario visible; (c) con `/` abierto, `seedParticipants(1)` (de `tests/e2e/helpers/emulators.ts`) hace aparecer «1 registrado» en ≤ 5 s sin recargar (SC-015: `toBeVisible({ timeout: 5000 })`, sin ampliar el margen; el sondeo es de 3 s y la memoria de 1 s), y con 2 «2 registrados»; (d) con `/` abierto, `setRegistrationOpen(false)` hace aparecer el heading «Las inscripciones están cerradas» en ≤ 5 s (mismo límite), desaparecen el QR y el enlace y el contador sigue visible; (e) `/` con inscripciones cerradas desde el inicio muestra el aviso y el contador; (f) con `page.setViewportSize({ width: 1920, height: 1080 })` el símbolo del QR (ancho del `svg[role="img"]` × (`viewBox` total − 8) / `viewBox` total, sin la zona de silencio) mide al menos 650 px (referencia de SC-016: 30 cm de lado en una pantalla de 40″ Full HD); (g) a 1920×1080 y a 1366×768 la página cabe sin desplazamiento vertical ni horizontal
 
### Implementation for User Story 3

- [X] T053 [US3] Crear `src/lib/qr.ts` (lógica pura, sin React ni Firebase; depende de T001): `buildQr(text: string)` usa `encode(text, { ecc: "H", border: 0 })` de `uqr` y devuelve `{ size, path, logo }`. `size` = módulos por lado (impar). `logo.size` = el mayor entero **impar** ≤ `Math.floor(size * 0.2)`, `logo.x = logo.y = (size - logo.size) / 2`. `path` = una sola cadena con, por cada fila `y`, un tramo `M{x} {y}h{n}v1h-{n}z` por cada racha horizontal de módulos oscuros, **omitiendo** los módulos dentro del recuadro del ícono. Sin zona de silencio en la matriz: la agrega el renderizador (T054)
- [X] T054 [US3] Crear `src/components/qr/QrCode.tsx` (Server Component, sin `"use client"`; depende de T053, T003): props `{ url: string; className?: string }`; `<svg role="img" aria-label="Código QR para registrarte en el sorteo" data-url={url} viewBox={`-4 -4 ${size + 8} ${size + 8}`} shapeRendering="crispEdges" className={…}>` con un `<rect>` de fondo `fill-paper` que cubre todo el `viewBox` (zona de silencio de 4 módulos), `<path d={path} className="fill-ink-900" />`, un `<rect>` `fill-paper` del tamaño del recuadro del ícono (más 0,5 módulo por lado) y `<image href="/icono-ti.webp" x y width height preserveAspectRatio="xMidYMid meet" />` ajustada al recuadro con 0,6 módulo de margen. Sin colores literales
- [X] T055 [US3] Crear `src/lib/origin.ts` (lógica pura, sin React ni Firebase; depende de T051): `buildOrigin(headers: Pick<Headers, "get">): string | null`. Candidatos de host, en orden: primer valor (separado por comas y recortado) de `x-forwarded-host` y luego `host`; se usa el **primero que cumpla** `/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/i` (no admite IPv6; se documenta en un comentario). Protocolo: primer valor de `x-forwarded-proto` si es `http` o `https`; si no, `http` cuando el host es `localhost` o `127.0.0.1` (con o sin puerto) y `https` en los demás casos. Devuelve `${protocolo}://${host}` o `null` si ningún candidato es válido (sin valor de respaldo: nunca devuelve `localhost` por omisión)
- [X] T056 [P] [US3] Añadir el tipo `PublicStatus` (`{ open: boolean; count: number }`, con `count` «integer ≥ 0») a `src/types/index.ts` y crear `src/services/public-status.service.ts` (`import "server-only"`): `getPublicStatus(): Promise<PublicStatus>` combina `getRegistrationStatus()` (`open`, `true` si el documento no existe) y `countParticipants()` con `Promise.all`; memoria por instancia de **1 s** (`TTL_MS = 1000`; guarda `{ value, expiresAt }` y la promesa en curso para que las peticiones simultáneas compartan una lectura; si falla, no se cachea el error); exporta `invalidatePublicStatus()` que borra la memoria
- [X] T057 [US3] Crear `src/app/api/status/route.ts` y conectar la invalidación (depende de T056): `export const dynamic = "force-dynamic"`; `GET` devuelve `Response.json(await getPublicStatus(), { headers: { "Cache-Control": "no-store" } })`; ante error responde `errorResponse("INTERNAL_ERROR", 500, "Ocurrió un error inesperado. Inténtalo de nuevo.")` y registra solo `error.name` (sin datos personales). Llamar a `invalidatePublicStatus()` desde los Route Handlers que mutan el estado, tras la operación correcta: `PUT` en `src/app/api/admin/registration/route.ts` (después de `setRegistrationOpen`) y `DELETE` en `src/app/api/admin/participants/route.ts` (después de `purgeAllParticipantData`). Los servicios NO importan `public-status.service` (evita ciclos: este importa `registration-status.service` y `participants.service`)
- [X] T058 [US3] Crear `src/components/qr/LiveRegistrationPanel.tsx` (`"use client"`; depende de T057): props `{ initial: PublicStatus; intro: ReactNode; qr: ReactNode; action: ReactNode }`; estado inicial `initial`; `useEffect` con `setInterval` de 3000 ms que hace `fetch("/api/status", { cache: "no-store" })` y actualiza el estado solo si `typeof open === "boolean" && Number.isInteger(count) && count >= 0`; ignora errores y conserva el último valor; solo consulta mientras `document.visibilityState === "visible"` y consulta de inmediato al volver a estar visible; limpia el intervalo y el listener al desmontar. Diseño: `grid gap-6 lg:grid-cols-2 lg:items-center lg:gap-12`; en una columna el orden es `intro`, QR, contador y botón; en `lg` el QR (dentro de una tarjeta `rounded-2xl border border-line p-4`, o el `ClosedNotice` si las inscripciones están cerradas) va en la columna izquierda ocupando dos filas, y a la derecha `intro` arriba y, abajo, el contador y el botón. El botón solo se muestra con `open`. Contador = un solo `<p>` `font-display text-xl font-semibold text-ink-900 lg:text-3xl` con el texto `${n.toLocaleString("es-PE")} ${n === 1 ? "registrado" : "registrados"}` precedido de un punto decorativo `aria-hidden` (`bg-accent-500`, con `motion-safe:animate-ping` en el halo)
- [X] T059 [US3] Reemplazar `src/app/page.tsx` (depende de T054, T055, T058; quita la redirección temporal de T036): Server Component con `export const dynamic = "force-dynamic"`; `const status = await getPublicStatus()`; `const headersList = await headers()`; `const origin = buildOrigin(headersList)` (de T055; nunca hay valor de respaldo `localhost`); `registrationUrl = origin ? `${origin}/registro` : null`. Si `registrationUrl` es `null`, se registra `console.error("No se pudo determinar el origen del QR")` (sin valores de encabezados) y el panel muestra en lugar del QR un `<Alert variant="info">No pudimos generar el código QR. Usa el botón para registrarte.</Alert>`, conservando el botón. Estructura: encabezado con `<Logo />` (`py-8 lg:py-5`); `<main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-8 lg:max-w-none lg:px-12">` con `<LiveRegistrationPanel initial={status} intro={<><h1 className="font-display text-3xl font-bold tracking-tight text-ink-900 md:text-5xl">Regístrate y participa en el sorteo</h1><p className="mt-2 text-base text-ink-600 md:text-xl">Escanea el código QR y completa tus datos para ingresar al sorteo.</p></>} qr={<QrCode url={registrationUrl} className="mx-auto h-auto w-full max-w-[min(100%,calc(100vh-14rem))]" /> o el Alert} action={<Link href="/registro" className={buttonClassName("primary", "w-full gap-2")}>Registrarme desde este dispositivo <ícono de enlace externo SVG aria-hidden/></Link>} />` (el alto de la pantalla limita el QR para que todo quepa sin desplazarse: a 1920×1080 el símbolo mide ≈ 685 px); pie con «Cautiva Marketing» igual que en `/registro`
- [X] T060 [US3] Punto de control: `npm run typecheck && npm run lint && npm run test:unit`, `npm test -- tests/integration/status.route.test.ts` (con emuladores vía `npm test`) y `npm run test:e2e -- tests/e2e/qr-screen.spec.ts`; abrir `/` en un monitor grande y escanear el QR con un celular

**Checkpoint**: US1, US2 y US3 funcionan de forma independiente; la entrada del evento está completa.

---

## Phase 6: User Story 4 - Panel de administración con el mismo estilo (Priority: P3)

**Goal**: el inicio de sesión y todas las secciones del panel usan el mismo sistema visual (fondo blanco, texto negro, Space Grotesk/Inter, logo claro, azul solo como acento) sin cambiar su funcionamiento.

**Independent Test**: iniciar sesión y recorrer participantes, búsqueda, exportación, sorteo, cierre de inscripciones y borrado: todo con el nuevo estilo y comportándose igual que en la 001.

### Tests for User Story 4 (escribir primero; deben fallar antes de implementar) ⚠️

- [X] T061 [P] [US4] Crear `tests/e2e/design.spec.ts`: para `/`, `/registro`, `/admin/login` y `/admin` (con `createAdminUser` + inicio de sesión como en `tests/e2e/admin-access.spec.ts`): el logo `getByRole("img", { name: "Cautiva Marketing" })` es visible; el fondo del `body` es `rgb(255, 255, 255)`; el `h1` tiene una `font-family` que coincide con `/Space.?Grotesk/i` y el `body` con `/Inter/i`; en `/admin` ningún elemento de `header` tiene fondo oscuro (el `header` es blanco; ya lo deja así T013 en Foundational, aquí queda como protección contra regresiones)

### Implementation for User Story 4

- [X] T062 [P] [US4] Aplicar el mapa de tokens a `src/components/admin/ParticipantsTable.tsx`: contenedor de la tabla `border-line bg-paper` con foco `outline-accent-600`, `thead border-line`, filas `border-line`, avisos «sin resultados» `border-line bg-paper`; títulos `h1` con `font-display`; conservar paginación, búsqueda y exportación
- [X] T063 [P] [US4] Aplicar el mapa de tokens a `src/components/admin/DrawPanel.tsx`, `src/components/admin/DrawAnimation.tsx` y `src/components/admin/DrawHistory.tsx`: `border-brand-200 bg-brand-50`→`border-line bg-paper-soft`; el spinner `border-brand-200 border-t-brand-600`→`border-line border-t-ink-900`; nombres de ganadores `text-brand-700`→`text-ink-900`; tarjetas del historial `border-ink-600 bg-white`→`border-line bg-paper`; títulos con `font-display`
- [X] T064 [P] [US4] Aplicar el mapa de tokens a `src/components/admin/RegistrationToggle.tsx`, `src/components/admin/PurgeDialog.tsx` (enlace `text-brand-700`→`text-accent-600`), `src/app/admin/(panel)/page.tsx`, `src/app/admin/(panel)/sorteo/page.tsx` y `src/app/admin/(panel)/campana/page.tsx` (títulos con `font-display`)
- [X] T065 [US4] Punto de control: `npm run typecheck && npm run lint` y `npm run test:e2e` completo (`admin-access`, `draw`, `export`, `purge`, `design` y los demás); recorrer el panel a mano en 360 px y 1280 px comprobando que cierre de inscripciones, sorteo, exportación y borrado (incluido el diálogo de borrado, que usa el `Dialog` modificado en T011) se comportan igual que en la 001

**Checkpoint**: las cuatro historias completas.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: cierre de la migración, rendimiento y validación final.

- [X] T066 Eliminar de `src/app/globals.css` los tokens temporales `--color-brand-*` y su comentario; comprobar con `grep -rn "brand-" src` que no quedan usos y que `npm run typecheck`, `npm run lint` y `npm run test:unit` (incluida `no-hardcoded-colors.test.ts`) pasan
- [X] T067 [P] Actualizar `scripts/lighthouse.mjs` para auditar **dos** páginas: sustituir `URL_TO_AUDIT` por `PATHS_TO_AUDIT = ["/registro", "/"]` (esperar a que responda `/registro`), ejecutar `audit()` por cada URL imprimiendo Performance y Accessibility por separado, y fallar si **cualquiera** queda por debajo de `MIN_SCORE = 90`; actualizar el comentario de cabecera («sobre `/registro` y `/`»)
- [X] T068 Ejecutar todas las puertas de calidad (constitución, «Flujo de Desarrollo»): `npm run typecheck`, `npm run lint`, `npm run format:check` (si falla, `npm run format` y revisar el diff), `npm test`, `npm run test:rules` (siguen denegando todo) y `npm run test:e2e`, y `npm run perf` (Performance y Accessibility ≥ 90 en `/registro` y `/`); corregir lo que falle
- [X] T069 Validar manualmente los 23 escenarios de [quickstart.md](quickstart.md#escenarios-de-validación), en especial: 7 (movimiento reducido), 10 (teclado y lector), 12 (escanear el QR a ~3 m, ≥ 9 de 10), 13 (contador en ≤ 5 s), 17 (sin conexión en la pantalla proyectada), 18 (tipografía y color) y 19 (contraste ≥ 4,5:1, 3:1 en bordes de campos); corregir los hallazgos y volver a ejecutar T068
  - Nota de ejecución: los escenarios 1–6, 8–11, 13–16, 18 y 20–23 se validaron con pruebas automáticas y capturas (Lighthouse: `/registro` 94/100 y `/` 97/100; 86 E2E, 238 pruebas con emuladores, 45 de reglas). El QR se decodificó por software (jsQR) a 1920×1080 y a 360 px. **Pendiente de verificación física** (no se pudo hacer desde aquí): escenario 12 (escanear con un celular real a ~3 m, 10 intentos), 7 y 10 con la preferencia real del sistema y un lector de pantalla, 17 con la pantalla proyectada real, y 19 en el panel con una herramienta de contraste (los tokens se calcularon y Lighthouse midió contraste 100 en las páginas públicas).
- [X] T070 [P] Búsqueda final de restos: `grep -rniE "recaptcha|app-?check|consent|privacidad|política de privacidad" src tests scripts playwright.config.ts .env.example` debe devolver solo las aserciones negativas de las pruebas (`tests/e2e/registration.spec.ts`, el 404 de `/privacidad`); `grep -rn "Logo de la empresa" src tests` no debe devolver nada

## Phase 8: Ajustes posteriores (home en una columna y enlace de regreso)

**Purpose**: cambios pedidos por el usuario tras revisar la implementación (spec FR-046 y FR-053; research D-115 y D-116). Sustituyen el diseño de dos columnas descrito en T058 y T059.

- [X] T071 [P] Pruebas primero: en `tests/e2e/registration.spec.ts` la primera prueba exige exactamente un enlace «Volver a la pantalla principal» (`href="/"`), y nuevas pruebas verifican que está bajo el botón de envío y lleva a `/` (con el QR visible), y que aparece tras «Listo, muchas gracias» y con las inscripciones cerradas; en `tests/e2e/qr-screen.spec.ts` el símbolo del QR a 1920×1080 pasa de ≥ 650 px a ≥ 450 px y una prueba nueva (1920×1080 y 1366×768) comprueba una sola columna: título → QR → contador → botón en orden vertical y QR y botón centrados
- [X] T072 [P] Crear `src/components/registration/BackToHomeLink.tsx`: `next/link` a `/` con flecha ← SVG `aria-hidden` y el texto «Volver a la pantalla principal»; `text-sm font-medium text-ink-600 hover:text-ink-900`, centrado, `min-h-11`, foco `outline-accent-600`
- [X] T073 Mostrar el enlace (depende de T072): en `src/components/registration/RegistrationForm.tsx` bajo el botón «Enviar y participar» (vista `form`, dentro de un `div.flex.flex-col.gap-1` con el botón) y bajo `ThanksPanel`/`ClosedNotice` (vistas `thanks` y `closed`); en `src/app/registro/page.tsx`, bajo `ClosedNotice` en la rama de inscripciones cerradas
- [X] T074 Home en una sola columna: en `src/components/qr/LiveRegistrationPanel.tsx` quitar la rejilla de dos columnas y la prop `intro` (abiertas: tarjeta `rounded-2xl border border-line p-4` con `qr` + separador `border-t` + contador, y el `action` debajo; cerradas: `ClosedNotice` y el contador debajo); en `src/app/page.tsx` renderizar el `h1` (`text-3xl md:text-4xl`) y la frase antes del panel, contenedor `max-w-3xl`, encabezado `py-6` y el QR con `max-w-[min(100%,max(16rem,calc(100dvh-28rem)))]`
- [X] T075 Actualizar la spec y los documentos: `spec.md` (Clarifications, US1-8, US3-1, US3-7, FR-046, FR-053, SC-016 y el supuesto de la regla práctica: 21 cm ≈ 450 px ≈ 2 m), `contracts/http-api.md`, `quickstart.md` (escenarios 11, 12 y 24) y `research.md` (D-115 y D-116)
- [X] T076 Verificar: `npm run typecheck`, `lint`, `format:check`, E2E completos, `npm run perf` (≥ 90 en `/registro` y `/`), capturas a 1920×1080, 1366×768 y 360×740 (una columna, sin scroll en las dos grandes) y decodificar el QR con jsQR

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias; T002, T003 y T004 en paralelo; T001 independiente.
- **Foundational (Phase 2)**: depende de Setup (T007 necesita T002 y T003; T012 y T013–T015 necesitan T007). BLOQUEA todas las historias.
- **US1 (Phase 3)**, **US2 (Phase 4)**, **US3 (Phase 5)**, **US4 (Phase 6)**: dependen de Foundational. US2 depende de US1 (edita `RegistrationForm.tsx` y `registration.spec.ts` tras T032/T023). US3 y US4 son independientes de US1/US2 salvo por archivos compartidos (ver abajo). US3 necesita T001 (`uqr`) y T003.
- **Polish (Phase 7)**: depende de las historias deseadas; T066 exige US4 completa (ya no quedan usos de `brand-*`); T067 exige US3 (`/` ya es la pantalla del QR).

### User Story Dependencies

- **US1 (P1)**: tras Foundational. Sin dependencias de otras historias. 🎯 MVP.
- **US2 (P1)**: tras US1 (reemplaza el aviso de agradecimiento directo por la ventana).
- **US3 (P2)**: tras Foundational; reemplaza la redirección temporal de T036 (si US3 se hiciera antes que US1, omitir T036 y crear `/registro` primero).
- **US4 (P3)**: tras Foundational; no requiere las demás historias.

### Within Each User Story

- Las pruebas se escriben primero y deben fallar antes de implementar.
- Esquemas/tipos → servicios → Route Handler → componentes → páginas.
- Archivos tocados por más de una tarea (evitar [P] entre ellas): `src/app/globals.css` (T005, T037, T044, T066), `src/components/registration/RegistrationForm.tsx` (T032, T047), `tests/e2e/registration.spec.ts` (T023, T041), `src/app/page.tsx` (T036, T059), `src/components/ui/Dialog.tsx` (T011).

### Parallel Opportunities

- Setup: T002, T003, T004 juntas.
- Foundational: T007–T011 juntas (tras T005/T006 si usan los tokens para validar visualmente); T013–T015 (encabezado del panel y del login) juntas tras T007–T011.
- US1 tests: T016–T021 y T022 juntas, luego T023 y T024; implementación: T026, T029, T030, T031 juntas tras T025; T033, T034, T037, T038 juntas tras T032.
- US2: T040, T041, T042 juntas; T044 y T046 en paralelo con T043.
- US3: T049, T050, T051 y T052 juntas; T056 en paralelo con T053, T054 y T055.
- US4: T061 y T062–T064 todas en paralelo (archivos distintos).
- Polish: T067 y T070 en paralelo.

---

## Parallel Example: User Story 1

```bash
# Pruebas de US1 en paralelo (archivos distintos):
Task: "Actualizar tests/unit/schemas.test.ts (quitar consent)"                       # T016
Task: "Actualizar tests/integration/helpers.ts (sin App Check ni consent)"           # T017
Task: "Actualizar tests/integration/registrations.route.test.ts"                     # T018
Task: "Actualizar tests/e2e/helpers/emulators.ts (sembrar sin consent)"              # T021

# Tras T025 (esquema), en paralelo:
Task: "Quitar Participant.consent y 2 códigos de error en src/types/index.ts"        # T026
Task: "Crear ThanksPanel.tsx y eliminar SuccessPanel.tsx"                            # T030
Task: "Restyle de ClosedNotice.tsx y AlreadyRegisteredPanel.tsx"                     # T031
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (Setup) y Phase 2 (Foundational).
2. Phase 3 (US1): `/registro` sin consentimiento ni anti-spam, con el nuevo diseño.
3. **PARAR y VALIDAR**: escenarios 1, 2, 3, 16 y 23 del quickstart. Ya es desplegable: el formulario nuevo funciona y la raíz redirige a él.

### Incremental Delivery

1. Setup + Foundational → base visual lista.
2. US1 → validar → desplegar (MVP).
3. US2 → ventana de bienvenida y registro asistido (completa las dos historias P1) → validar → desplegar.
4. US3 → pantalla del QR con contador en vivo (la raíz deja de redirigir) → validar → desplegar.
5. US4 → panel con el mismo estilo → validar → desplegar.
6. Polish → retirar tokens temporales, Lighthouse en ambas páginas y validación final.

### Notas de riesgo

- **Sin anti-spam** (decisión de la empresa, constitución III): un script puede crear registros falsos; si hiciera falta, una regla de límite de peticiones en el firewall de Vercel lo cubre sin código (research D-103).
- **Fuentes**: `next/font/google` descarga las fuentes al compilar (necesita red; Vercel y CI la tienen). Si algún entorno no, pasar a `next/font/local` con los `.woff2` en el repo (research D-105).
- **Logo**: el ícono «ti» y el logotipo recoloreado son un derivado; si la empresa entrega una versión oficial para fondo claro, reemplazar `public/icono-ti.webp` y `public/logo-claro.svg` sin tocar código (research D-106).
- **Artefactos de la 001**: quedan superseded en lo que esta feature cambia; no se editan.

## Notes

- [P] = archivos distintos, sin dependencias pendientes.
- [Story] enlaza la tarea con su historia para trazabilidad.
- Verificar que las pruebas fallan antes de implementar.
- Hacer commit tras cada tarea o grupo lógico; detenerse en cualquier checkpoint para validar la historia.
- Evitar: tareas vagas, conflictos en el mismo archivo, colores literales fuera de `globals.css`, `any` sin justificación.
