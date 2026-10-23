# Implementation Plan: Rediseño minimalista y simplificación del registro

**Branch**: `002-rediseno-minimalista` | **Date**: 2026-10-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-rediseno-minimalista/spec.md`

## Summary

Cambio sobre la aplicación de la feature 001 (no es un proyecto nuevo): se **quitan** el consentimiento,
la política de privacidad y reCAPTCHA/App Check; la dirección `/` pasa a ser una **pantalla con QR y
contador en vivo** y el formulario se muda a `/registro`; al registrarse aparece una **ventana de
bienvenida** con ticket y confeti; y toda la interfaz (incluido el panel) adopta un diseño
**blanco y negro** con el azul del logo de Cautiva como único acento, tipografía Space Grotesk + Inter
y el logo en versión para fondo claro (ícono «ti» + texto negro).

Enfoque técnico (detalle en [research.md](research.md)):

- **Eliminación**: se borran el campo `consent`, `CONSENT_VERSION`, la ruta `/privacidad`, `ConsentField`,
  `CheckboxField`, `app-check.service.ts`, `app-check-client.ts`, `instrumentation.ts` y las variables
  `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` / `APP_CHECK_ENFORCEMENT`. El Route Handler de registro conserva la
  validación Zod, la comprobación de `Origin` y la unicidad transaccional por celular.
- **Contador en vivo**: nuevo `GET /api/status` público (`{ open, count }`, sin datos personales) que el
  cliente consulta cada 3 s mientras la pestaña está visible. No se usa Firestore desde el navegador
  (las reglas siguen en `deny all`, constitución III).
- **QR**: se genera **en el servidor** con la librería `uqr` (única dependencia nueva, 0 dependencias
  propias) y se dibuja como un SVG inline con el ícono «ti» al centro; no suma JavaScript al cliente.
- **Ventana de bienvenida**: se reutiliza el `Dialog` basado en `<dialog>` nativo; el confeti es CSS puro
  (sin librería) y se oculta con `prefers-reduced-motion`.
- **Diseño**: se redefinen los design tokens de `globals.css` (blanco/negro/grises + acento azul) y se
  migran las clases de los componentes a los nuevos tokens; las fuentes se cargan con `next/font/google`
  (autoalojadas, sin petición a Google desde el navegador).

## Technical Context

**Language/Version**: TypeScript (`strict: true`), Node.js ≥ 22 (sin cambios respecto a la 001).

**Primary Dependencies**: las de la 001 (`next` 16, `react` 19, `tailwindcss` 4, `zod` 4,
`react-hook-form` + `@hookform/resolvers`, `firebase` solo para Auth, `firebase-admin`, `server-only`) más
**`uqr` 0.1.3** (QR). `firebase/app-check` deja de importarse; el paquete `firebase` se mantiene por
Auth del panel. Justificación en [research.md](research.md#d-107-qr-generado-en-el-servidor-con-uqr).

**Storage**: Cloud Firestore vía Admin SDK; reglas `deny all` sin cambios. Los documentos nuevos ya no
llevan el mapa `consent`. Ver [data-model.md](data-model.md).

**Testing**: Vitest (unitarias e integración contra emulador), `@firebase/rules-unit-testing` (sin
cambios), Playwright (E2E con emuladores), Lighthouse CLI. Pruebas nuevas y modificadas en
[quickstart.md](quickstart.md#pruebas-automáticas).

**Target Platform**: navegadores móviles modernos desde 360 px, pantallas de proyección/televisor para `/`,
y escritorio para el panel. Despliegue en Vercel (Node runtime), igual que la 001.

**Project Type**: aplicación web única (Next.js full-stack) en la raíz del repo.

**Performance Goals**: Lighthouse móvil ≥ 90 en Performance y Accessibility en `/registro` y en `/`;
formulario listo en < 3 s en 4G lento (SC-019); contador actualizado en ≤ 5 s (SC-015: sondeo de 3 s
+ petición < 1 s).

**Constraints**: sin secretos en el repo; todo texto en es-PE; sin valores de color literales en `src/`
salvo `globals.css`; contraste WCAG AA en el 100 % del texto (SC-017); JavaScript de cliente mínimo en
`/` (solo la isla del contador) y en `/registro` (formulario + diálogo); `any` prohibido.

**Scale/Scope**: hasta 5 000 participantes; 3 páginas públicas (`/`, `/registro` y el aviso final dentro
de `/registro`), 4 páginas de panel/login con restyling, 7 Route Handlers (se agrega `GET /api/status`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluado contra la constitución **v2.0.0** (2026-10-22).

| Principio / Sección | Evaluación | Cómo se cumple |
|---|---|---|
| I. Stack y Arquitectura en Capas | PASS | Se mantiene Next.js App Router + TS estricto + Firebase. Nuevo servicio `public-status.service.ts` (único punto con Firestore para el contador); los componentes solo llaman a `fetch('/api/status')`. `lib/qr.ts` y `lib/origin.ts` son lógica pura. Ningún componente importa `firebase*`. |
| II. Calidad de Código y Validación | PASS | `registrationSchema` queda con tres campos y se sigue compartiendo entre formulario y Route Handler; el servidor revalida todo. `GET /api/status` no recibe entrada. ESLint/Prettier/`any` sin cambios. |
| III. Seguridad y Control de Acceso | PASS | Reglas Firestore `deny all` intactas; unicidad por celular E.164 y creación transaccional intactas; panel con sesión + claim `admin` intacto; secretos en variables de entorno. La ausencia de anti-spam es **riesgo aceptado** por la propia constitución (no se exige reCAPTCHA/App Check). El endpoint público de estado no expone datos personales. |
| IV. Minimización y Uso de Datos Personales | PASS | Se recolectan solo nombres, celular y empresa u ocupación; no hay flujo de consentimiento (permitido por la v2.0.0). El contador público devuelve solo un total. El celular completo aparece únicamente en la ventana de bienvenida de quien se acaba de registrar (valores locales, no se vuelven a pedir al servidor). Borrado definitivo desde el panel intacto. |
| V. UX Mobile-First, Marca y Accesibilidad | PASS | Diseño desde 360 px y escala a pantalla grande; base blanco/negro con tokens en `@theme`, acento azul `#0A70BB` (≈5,2:1) y `#3D8CD3` solo para elementos no textuales; logo en versión clara; Space Grotesk + Inter; `<dialog>` modal con foco contenido, cierre con teclado y `prefers-reduced-motion`; etiquetas asociadas y errores con `aria-describedby`/`aria-live`; `lang="es-PE"`. Contrastes en [research.md](research.md#d-104-design-tokens-blanco-y-negro-con-acento-azul). |
| VI. Pruebas, Rendimiento y Simplicidad | PASS | Unitarias (esquemas sin consentimiento, QR, formato de celular); integración (registro sin consentimiento ni App Check, `GET /api/status`); E2E (éxito, duplicado, datos inválidos, cerrado, QR + contador); Lighthouse ≥ 90 en `/registro` y `/`. Única dependencia nueva `uqr`, justificada en research D-107. Confeti y modal sin librerías. |
| Restricciones Técnicas y de Despliegue | PASS | Entornos por variables de entorno (se eliminan las de reCAPTCHA/App Check); panel protegido en servidor sin cambios. |
| Flujo y Puertas de Calidad | PASS | Siguen `tsc --noEmit`, ESLint, Prettier, unitarias, reglas, E2E y Lighthouse; la prueba de colores literales se mantiene. |

**Resultado previo a la investigación**: sin violaciones; no se requiere Complexity Tracking.

**Re-evaluación posterior al diseño (Fase 1)**: se mantiene PASS. Puntos para la revisión de código
(principios III y IV): (1) el endpoint `GET /api/status` es público y sin límite de peticiones —se mitiga
con una memoria de 1 s por instancia que acota las lecturas a Firestore, sin ser anti-spam—; (2) el
registro queda sin verificación anti-automatización por decisión de la empresa; (3) nada del código
nuevo registra datos personales en logs.

## Project Structure

### Documentation (this feature)

```text
specs/002-rediseno-minimalista/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── http-api.md      # Phase 1 output: cambios al contrato HTTP y a las páginas
├── checklists/
│   └── requirements.md  # Checklist de calidad del spec (/speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

Los artefactos de `specs/001-registro-sorteo/` quedan **superseded** en lo que esta feature cambia
(consentimiento, App Check, rutas, paleta); no se editan aquí.

### Source Code (repository root)

`+` nuevo · `~` modificado · `−` eliminado. Lo no listado no cambia.

```text
src/
├── instrumentation.ts                       − (solo servía para assertAppCheckConfig)
├── app/
│   ├── layout.tsx                           ~ fuentes next/font (Space Grotesk, Inter), fondo blanco
│   ├── globals.css                          ~ nuevos tokens @theme, fuentes, confeti, sin .grecaptcha-badge
│   ├── page.tsx                             ~ pantalla QR + contador (Server Component)
│   ├── registro/page.tsx                    + formulario (o aviso de cerradas)
│   ├── privacidad/page.tsx                  −
│   ├── admin/
│   │   ├── login/page.tsx                   ~ restyling
│   │   └── (panel)/…                        ~ restyling (layout, participantes, sorteo, campaña)
│   └── api/
│       ├── registrations/route.ts           ~ sin App Check ni consentimiento
│       ├── status/route.ts                  + GET público { open, count }
│       └── admin/
│           ├── registration/route.ts        ~ tras cambiar el estado llama a invalidatePublicStatus()
│           └── participants/route.ts        ~ tras el borrado definitivo llama a invalidatePublicStatus()
├── components/
│   ├── ui/
│   │   ├── Logo.tsx                         ~ versión clara: ícono «ti» + texto negro
│   │   ├── Button.tsx · TextField.tsx · Alert.tsx · Dialog.tsx   ~ nuevos tokens; Dialog con ícono opcional
│   │   ├── Confetti.tsx                     + confeti CSS (oculto con reduced-motion)
│   │   └── CheckboxField.tsx                −
│   ├── registration/
│   │   ├── RegistrationForm.tsx             ~ 3 campos, estado welcome/already/thanks/closed, reset
│   │   ├── WelcomeDialog.tsx                + «¡Bienvenido(a)!», ticket, confeti, 2 botones
│   │   ├── AlreadyRegisteredDialog.tsx      + reemplaza AlreadyRegisteredPanel (mismo estilo)
│   │   ├── ThanksPanel.tsx                  + reemplaza SuccessPanel (pantalla final)
│   │   ├── ClosedNotice.tsx                 ~ restyling
│   │   ├── ConsentField.tsx                 −
│   │   ├── SuccessPanel.tsx                 −
│   │   └── AlreadyRegisteredPanel.tsx       −
│   ├── qr/
│   │   ├── QrCode.tsx                       + SVG del QR con ícono «ti» (Server Component)
│   │   └── LiveRegistrationPanel.tsx        + isla de cliente: contador con sondeo + cambio a «cerradas»
│   └── admin/…                              ~ restyling por tokens (sin cambios de lógica)
├── lib/
│   ├── consent.ts                           −
│   ├── qr.ts                                + matriz → ruta SVG, zona del ícono (lógica pura)
│   ├── origin.ts                            + buildOrigin(headers): origen público validado o null (lógica pura)
│   ├── validation/
│   │   ├── schemas.ts                       ~ quita consent y consentVersion
│   │   └── phone.ts                         ~ + formatNationalPhone ("987 654 321")
│   └── http.ts                              ~ quita códigos APP_CHECK_FAILED y CONSENT_VERSION_MISMATCH
├── services/
│   ├── app-check.service.ts                 −
│   ├── firebase/app-check-client.ts         −
│   ├── firebase/admin.ts                    ~ quita getAdminAppCheck
│   ├── participants.service.ts              ~ sin consentimiento; countParticipants se reutiliza
│   └── public-status.service.ts             + { open, count } con memoria de 1 s por instancia; invalidatePublicStatus()
│                                              lo llaman los Route Handlers de administrador (los servicios no lo importan: sin ciclos)
└── types/index.ts                           ~ quita Participant.consent y 2 códigos de error

public/
├── logo.svg                                 − (texto blanco; solo para fondos oscuros)
├── logo-claro.svg                           + logotipo "cautiva marketing" con texto negro
└── icono-ti.webp                            + ícono «ti» (de cautivamarketing.com)

scripts/lighthouse.mjs                       ~ audita /registro y /; sin variables de App Check
playwright.config.ts                         ~ sin APP_CHECK_ENFORCEMENT
.env.example · .prettierignore               ~ sin reCAPTCHA/App Check; ignora los logos nuevos
.github/workflows/ci.yml                     ~ solo si referencia variables de App Check

tests/
├── unit/        schemas.test.ts ~ · app-check-enforcement.test.ts − · qr.test.ts + · origin.test.ts + · phone.test.ts ~
├── integration/ registrations.route.test.ts ~ · helpers.ts ~ · status.route.test.ts + · legacy-consent.test.ts +
└── e2e/         registration.spec.ts ~ · duplicate.spec.ts ~ · qr-screen.spec.ts + · design.spec.ts + · helpers/emulators.ts ~
```

**Structure Decision**: se mantiene la aplicación Next.js única y la separación de capas de la 001. Lo
nuevo respeta la frontera: `services/` sigue siendo el único lugar que importa `firebase-admin`,
`lib/` queda para lógica pura (`qr.ts`, `origin.ts`) y los componentes solo consumen `fetch` y props. El QR vive en un
Server Component y solo el contador (que necesita sondeo) es un componente de cliente, pasándole el QR
como `children` para que no entre al paquete de JavaScript.

## Complexity Tracking

Sin violaciones de la constitución; no se registra complejidad adicional. La dependencia nueva `uqr` se
justifica en [research.md](research.md#d-107-qr-generado-en-el-servidor-con-uqr) conforme al principio VI.
