# Implementation Plan: Ajustes de registro, pantalla del QR y ruleta

**Branch**: `004-ajustes-registro-ruleta` | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-ajustes-registro-ruleta/spec.md`

## Summary

Cambio sobre la aplicación de las features 001 a 003 (no es un proyecto nuevo): nueve ajustes pequeños que
tocan el formulario público, la pantalla del QR, el panel y la ruleta.

- **Registro**: el celular admite los 12 países de Sudamérica mediante un selector de país (Perú +51 por
  defecto); el nombre acepta una sola palabra; se quita el texto de ayuda «9 dígitos, por ejemplo …»; nueva
  casilla opcional «¿Deseas adquirir el CRM con Agente IA?» guardada en el participante.
- **Panel**: columna Sí/No del CRM, filtro «solo interesados» y columna en el CSV; celular siempre con
  prefijo; ventanas emergentes sin desenfoque de fondo.
- **Sorteo**: «Girar» gira de inmediato (sin ventana) y el primer giro real sigue cerrando las inscripciones
  dentro de la misma transacción; ruleta completa con los colores de la «A» del logo de Creando Valor.
- **Marca y cierre del registro**: QR ≈ 15 % menor y los tres logos ≈ 20–25 % mayores en la pantalla del QR;
  redes sociales de Facebook en la tarjeta «¡Gracias por registrarte!».

Enfoque técnico (detalle en [research.md](research.md)):

- **Celular**: tabla propia de 12 países (`lib/validation/countries.ts`); normalización a E.164 con el
  prefijo del país, que sigue siendo el ID del documento ⇒ la unicidad por número completo y los registros
  `+51…` existentes funcionan **sin migración**. Estricto en Perú y Chile (9 dígitos, empieza con 9); en los
  demás, solo rango de largo.
- **Datos**: un único campo nuevo, `participants.crmInterest` (booleano; ausente = `false`). Sin
  colecciones, índices ni reglas nuevas.
- **Esquema compartido**: `registrationSchema` agrega `country` y `crmInterest`, y valida el celular a nivel
  de objeto; el mismo esquema en el formulario (React Hook Form) y en `POST /api/registrations`.
- **Giro directo**: se elimina la confirmación (`ConfirmationRequiredError`, `CONFIRMATION_REQUIRED`,
  `confirmCloseRegistration`); el cierre automático ya es atómico con el giro.
- **Ruleta**: tres tokens de color propios (`wheel-purple`, `wheel-lavender`, `wheel-cyan`) y `PALETTE` de 3
  entradas; el ciclo sin vecinos iguales ya lo resuelve `segmentColorIndexes`.
- **Ventanas**: `Dialog` gana `blurBackdrop` (por defecto sin desenfoque); solo las dos del formulario
  público lo activan.
- **Sin dependencias nuevas.**

## Technical Context

**Language/Version**: TypeScript (`strict: true`), Node.js ≥ 22 (sin cambios).

**Primary Dependencies**: las de la 001–003 (`next` 16.4, `react` 19, `tailwindcss` 4, `zod` 4,
`react-hook-form` + `@hookform/resolvers`, `firebase` solo para Auth, `firebase-admin`, `server-only`,
`uqr`). **Ninguna dependencia nueva**: la validación por país es una tabla de datos (ver
[research.md](research.md#d-301-tabla-de-países-propia-sin-libphonenumber)).

**Storage**: Cloud Firestore vía Admin SDK; reglas `deny all` sin cambios. Un campo nuevo
(`participants.crmInterest`); sin colecciones ni índices nuevos. Ver [data-model.md](data-model.md).

**Testing**: Vitest (unitarias e integración contra el emulador), `@firebase/rules-unit-testing`,
Playwright (E2E con emuladores), Lighthouse (`npm run perf`). Pruebas nuevas y modificadas en
[quickstart.md](quickstart.md#pruebas-automáticas).

**Target Platform**: formulario público en móviles desde 360 px; pantalla del QR y panel en escritorio y
proyector (1366×768 y 1920×1080); Chrome, Edge, Firefox y Safari recientes. Despliegue en Vercel (Node
runtime), igual que antes.

**Project Type**: aplicación web única (Next.js full-stack) en la raíz del repo.

**Performance Goals**: el formulario público mantiene Lighthouse móvil ≥ 90 en Performance y Accessibility
(SC-038; el selector nativo y la tabla de 12 países no añaden JavaScript relevante); el giro empieza en ≤ 2 s
desde el toque (SC-034: una petición, sin paso intermedio); quitar el desenfoque de las ventanas del panel
reduce el costo de composición mientras la ruleta anima.

**Constraints**: sin secretos en el repo; todo texto en es-PE; sin colores literales en `src/` salvo
`globals.css` (la prueba `no-hardcoded-colors` sigue vigente, también para el `<canvas>`); contraste AA en el
texto de la ruleta (celeste con texto oscuro); modales con foco contenido; `any` prohibido; el servidor
revalida todo y nunca confía en el cliente; `crmInterest` no viaja a la ruleta ni a la ventana del ganador.

**Scale/Scope**: 12 países; hasta 5 000 participantes (referencia de la 003); 1 campo nuevo; ≈ 25 archivos de
código tocados (formulario, esquema, servicios, tabla, CSV, `DrawStage`, ruleta, `Dialog`, página del QR,
logos, tarjeta de gracias) y ≈ 17 archivos de pruebas ajustados.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluado contra la constitución **v2.1.0** (2026-10-23), enmendada para esta feature.

| Principio / Sección | Evaluación | Cómo se cumple |
|---|---|---|
| I. Stack y Arquitectura en Capas | PASS | Next.js App Router + TS estricto + Firebase. Los países y la normalización viven en `lib/validation` (lógica pura, sin Firebase); el único acceso a Firestore sigue en `participants.service.ts`/`spins.service.ts`. `PhoneField`, `ParticipantsTable`, `ThanksPanel` y `Dialog` solo reciben props o llaman a `fetch`; ninguno importa `firebase*`. |
| II. Calidad de Código y Validación | PASS | Un solo `registrationSchema` (con `country` y `crmInterest`) compartido por el formulario y el Route Handler; el servidor recalcula el E.164 y revalida todo. Componentes pequeños (`PhoneField` y la casilla se separan de `RegistrationForm`). `any` sin uso. ESLint y Prettier siguen en la puerta de calidad. |
| III. Seguridad y Control de Acceso | PASS | Reglas Firestore `deny all` intactas (nuevo caso de prueba con ID `+56…`). El celular se normaliza a E.164 con el prefijo del país y es el ID del documento ⇒ unicidad por número completo garantizada por la base (`create` → `ALREADY_EXISTS`), y el mismo número local en otro país es otro participante (v2.1.0). El `0` troncal y el `9` móvil de Argentina se descartan para que no haya duplicados de la misma persona. Sigue sin anti-automatización (riesgo aceptado). Panel y giro exigen sesión de administrador verificada en el servidor; el cierre de inscripciones sigue siendo atómico con el giro. |
| IV. Minimización y Uso de Datos Personales | PASS | Los campos son exactamente los permitidos por v2.1.0: nombres, celular con país, empresa u ocupación y la respuesta opcional del CRM. `crmInterest` no entra en `WheelParticipant`, `SpinResult`, el snapshot de `spins` ni la ventana del ganador, no influye en el sorteo y no se registra en logs. El borrado definitivo elimina el documento completo (incluida la respuesta). El uso comercial acotado (contactar a los interesados) lo ejerce la organización fuera del sistema. |
| V. UX Mobile-First, Marca y Accesibilidad | PASS | Formulario desde 360 px: selector + número caben en una fila; el `<select>` nativo y la casilla tienen `label`, errores en español con `aria-describedby`/`aria-live`. Colores solo por tokens: los tres de la «A» son tokens propios usados únicamente por la ruleta (excepción de v2.1.0) con texto AA sobre cada color. Enlaces sociales ≥ 44 px, `rel="noopener noreferrer"`. Modales con `<dialog>` nativo (foco contenido, Escape) y `prefers-reduced-motion`. Todo en es-PE. |
| VI. Pruebas, Rendimiento y Simplicidad | PASS | Unitarias: esquemas, celular de los 12 países, paleta de la ruleta, CSV, búsqueda. E2E del registro: éxito, duplicado y datos inválidos (ahora también chileno y un solo nombre). Lighthouse sobre `/registro` y `/` sigue ≥ 90. **Cero dependencias nuevas** (se descartó `libphonenumber-js`, ver D-301). Se construye solo lo especificado (YAGNI). |
| Restricciones Técnicas y de Despliegue | PASS | Sin variables de entorno nuevas; documento con `lang="es-PE"` intacto; sin cambios de hosting. |
| Flujo y Puertas de Calidad | PASS | Siguen `tsc --noEmit`, ESLint, Prettier, unitarias, reglas, E2E y Lighthouse. Sin secretos ni datos reales en los cambios. |

**Resultado previo a la investigación**: sin violaciones; no se requiere Complexity Tracking.

**Re-evaluación posterior al diseño (Fase 1)**: se mantiene PASS. Puntos para la revisión de código
(principios III y IV): (1) el ID del documento es el E.164 completo con cualquiera de los 12 prefijos y
`registerParticipant` no cambia su `create` atómico; (2) un registro duplicado **no** actualiza
`crmInterest` (clarificación Q3); (3) `crmInterest` no aparece en ninguna respuesta pública ni en la API de
la ruleta; (4) ningún log nuevo contiene celular, nombre ni respuesta del CRM; (5) el `winner.phone` de
los giros y rondas anteriores (9 dígitos) se sigue interpretando como Perú al mostrarlo.

## Project Structure

### Documentation (this feature)

```text
specs/004-ajustes-registro-ruleta/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── http-api.md      # Phase 1 output: cuerpos que cambian, CSV, páginas y componentes
├── checklists/
│   └── requirements.md  # Checklist de calidad de la spec (/speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

Los artefactos de las features 001 a 003 quedan **superseded** solo en lo que esta cambia (celular
exclusivamente peruano, nombre de dos palabras o más, confirmación previa al primer giro, paleta negro-crema-
dorado de la ruleta); no se editan aquí.

### Source Code (repository root)

`+` nuevo · `~` modificado · `−` eliminado. Lo no listado no cambia.

```text
src/
├── app/
│   ├── page.tsx                                   ~ tope del QR ×0,85 y logo Creando Valor a 88 px
│   ├── globals.css                                ~ tokens wheel-purple, wheel-lavender, wheel-cyan
│   ├── admin/(panel)/sorteo/page.tsx              ~ deja de pasar `registrationOpen` a DrawStage
│   └── api/
│       ├── registrations/route.ts                 = (usa el esquema nuevo; el cuerpo trae country/crmInterest)
│       └── admin/
│           ├── spins/route.ts                     ~ − manejo de CONFIRMATION_REQUIRED
│           └── participants/export/route.ts       ~ celular con prefijo; clave de ganadores antiguos solo para +51
├── components/
│   ├── registration/
│   │   ├── RegistrationForm.tsx                   ~ PhoneField, casilla CRM, valores por defecto, sin helpText, WelcomeData con E.164
│   │   ├── PhoneField.tsx                         + selector de país + número local (accesible, con RHF)
│   │   ├── ThanksPanel.tsx                        ~ «Síguenos en nuestras redes sociales» + 2 enlaces
│   │   ├── WelcomeDialog.tsx                      ~ celular con prefijo; blurBackdrop
│   │   └── AlreadyRegisteredDialog.tsx            ~ blurBackdrop
│   ├── admin/
│   │   ├── DrawStage.tsx                          ~ − fase `confirming`, − Dialog de cierre, − `closedBySpin`/`registrationOpen`; letrero con tokens de la ruleta
│   │   ├── RouletteWheel.tsx                      ~ tokens y capas con la paleta de la «A»
│   │   ├── ParticipantsTable.tsx                  ~ columna CRM, casilla «Solo interesados», celular con prefijo
│   │   ├── WinnerHistory.tsx                      ~ celular con formatPhoneDisplay
│   │   └── WinnerDialog.tsx · DiscardWinnerButton.tsx · PrizePanel.tsx · PurgeDialog.tsx   = (heredan «sin desenfoque» del Dialog)
│   └── ui/
│       ├── CheckboxField.tsx                      + casilla accesible compatible con React Hook Form (interés en el CRM)
│       ├── Dialog.tsx                             ~ prop `blurBackdrop` (por defecto false)
│       ├── PartnerLogos.tsx                       ~ logos aliados más grandes (h-11 / sm:h-12 / md:h-15)
│       └── icons.tsx                              ~ + FacebookIcon
├── lib/
│   ├── validation/
│   │   ├── countries.ts                           + tabla de los 12 países (prefijo, regla, troncal, ejemplo)
│   │   ├── phone.ts                               ~ normalizePhone(country, texto), formatPhoneDisplay; − toNational/formatNationalPhone
│   │   └── schemas.ts                             ~ registrationSchema (country, crmInterest, nombre ≥1 término); spinRequestSchema sin confirmación
│   ├── social-links.ts                            + URL de las dos páginas de Facebook
│   ├── wheel.ts                                   ~ PALETTE de 3 entradas y nuevos ColorToken
│   ├── csv.ts                                     ~ columnas de celular con prefijo e «Interesado en CRM»
│   └── search.ts                                  ~ búsqueda por dígitos del E.164
├── services/
│   ├── participants.service.ts                    ~ guarda crmInterest; lista E.164 + crmInterest
│   └── spins.service.ts                           ~ − ConfirmationRequiredError/confirmCloseRegistration; winner.phone en E.164; cierre atómico se conserva
└── types/index.ts                                 ~ crmInterest en Participant/ParticipantListItem; − CONFIRMATION_REQUIRED

tests/
├── unit/        phone ~ (reescrita) · schemas ~ · csv ~ · search ~ · wheel ~ · social-links +  · no-hardcoded-colors =
├── integration/ registrations.route ~ · duplicates ~ · participants.list ~ · export.route ~ · spins ~ · spins.route ~ · legacy-consent ~ · purge =
├── rules/       firestore.rules.test.ts ~ (caso con ID +56…)
└── e2e/         registration ~ · duplicate ~ · draw ~ · qr-screen ~ · admin-access ~ · export ~ · design ~ (backdrop sin desenfoque en el panel) · presentation ~
```

**Structure Decision**: se mantiene la aplicación Next.js única y la separación de capas de las features
anteriores. La lógica nueva (países, normalización, formato) es pura y vive en `lib/validation/`, probada sin
emulador; `participants.service.ts` sigue siendo el único lugar que escribe el participante; los
componentes nuevos (`PhoneField`) solo manejan presentación y se conectan al esquema compartido mediante
React Hook Form. Ningún archivo se mueve de capa.

## Cobertura de requisitos

| Requisitos | Dónde se cubren |
|---|---|
| FR-092, FR-093 (selector de país, número local) | `countries.ts`, `PhoneField`, `RegistrationForm` |
| FR-094 (validación por país, estricta en PE/CL) | `countries.ts`, `phone.ts › normalizePhone`, `registrationSchema` (servidor y cliente) |
| FR-095, FR-096 (unicidad por número completo, compatibilidad) | E.164 como ID en `registerParticipant` (sin cambio de lógica); `normalizePhone` produce el mismo valor para los `+51…` existentes |
| FR-097 (prefijo en panel, CSV, bienvenida, búsqueda) | `formatPhoneDisplay`, `ParticipantsTable`, `WinnerHistory`, `WelcomeDialog`, `csv.ts`, `search.ts` |
| FR-098 (sin texto de ayuda) | `RegistrationForm` (se quita `helpText`) |
| FR-099, FR-100 (un solo nombre) | `fullNameSchema`, placeholder del campo |
| FR-101 a FR-105 (CRM) | casilla en `RegistrationForm`, `crmInterest` en esquema y `registerParticipant`, columna y filtro en `ParticipantsTable`, columna en `csv.ts`; sin viaje a la ruleta |
| FR-106 a FR-108 (giro directo, cierre automático, reapertura) | `DrawStage`, `spins.service.ts`, `spinRequestSchema`; reapertura existente en Campaña |
| FR-109 a FR-111 (QR, logos, sin desplazamiento) | `app/page.tsx`, `Logo size`, `PartnerLogos`; `qr-screen.spec.ts` |
| FR-112, FR-113 (paleta de la «A») | `globals.css`, `lib/wheel.ts`, `RouletteWheel`, letrero en `DrawStage` |
| FR-114, FR-115 (redes sociales) | `ThanksPanel`, `social-links.ts`, `FacebookIcon` |
| FR-116, FR-117 (ventanas sin desenfoque en el panel) | `Dialog › blurBackdrop`; `WelcomeDialog` y `AlreadyRegisteredDialog` lo activan |

## Riesgos y puntos a vigilar en la implementación

- **Largos por país**: la tabla de D-301 se verifica con una prueba por país; si algún rango resultara
  corto, se corrige el dato, no el algoritmo.
- **Errores del formulario**: confirmar con la prueba de esquemas que nombre y celular inválidos se
  informan a la vez (research D-303).
- **Pruebas que fijan el formato anterior**: `phone.test.ts`, `csv.test.ts`, `export.route.test.ts`,
  `participants.list.test.ts`, `spins*.test.ts`, `schemas.test.ts` y `wheel.test.ts` asumen celular de 9
  dígitos, 6 colores o confirmación previa; se actualizan junto con el código (no se debilitan).
- **Ancho de 360 px**: ver research D-311 (logos aliados a 44 px en teléfonos para que quepan en una fila).

## Complexity Tracking

Sin violaciones de la constitución v2.1.0; no se registra complejidad adicional. No se agregan dependencias
(principio VI): la validación por país es una tabla de datos y el selector, el `<select>` nativo.
