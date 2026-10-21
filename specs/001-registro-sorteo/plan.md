# Implementation Plan: Registro y Sorteo

**Branch**: `001-registro-sorteo` | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-registro-sorteo/spec.md`

## Summary

Aplicación web mobile-first en la que los participantes se registran a un sorteo (nombres, celular,
empresa u ocupación, con consentimiento Ley 29733) y un administrador, desde un panel protegido,
supervisa los registros, exporta a CSV, cierra/abre inscripciones, ejecuta el sorteo y borra los datos
personales al terminar la campaña.

Enfoque técnico (de la instrucción del usuario y [research.md](research.md)): Next.js App Router +
TypeScript estricto + Tailwind CSS; Firestore como almacén; **toda** escritura y lectura de datos pasa
por Route Handlers que usan Firebase Admin SDK, de modo que las reglas de Firestore pueden denegar todo
acceso directo desde clientes. El celular normalizado (E.164) es el ID del documento, y la creación con
`create()` dentro de una transacción garantiza unicidad y cierre de inscripciones de forma atómica.
Firebase App Check (reCAPTCHA Enterprise, tokens de un solo uso) protege el registro; Firebase Auth
(correo/contraseña + claim `admin`) y cookie de sesión protegen el panel. Zod valida en cliente y
servidor con los mismos esquemas; React Hook Form maneja el formulario. Los colores salen de `logo.svg`
y se definen como tokens en el tema de Tailwind.

## Technical Context

**Language/Version**: TypeScript (`strict: true`, versión compatible con Next y typescript-eslint al
hacer el scaffold); Node.js 22 LTS o superior (desarrollo local con 24).

**Primary Dependencies**: `next` 16, `react` 19, `tailwindcss` 4 (`@tailwindcss/postcss`), `zod` 4,
`react-hook-form` + `@hookform/resolvers`, `firebase` (cliente, solo Auth y App Check, importación
modular), `firebase-admin` (servidor), `server-only`. Detalle y justificación de cada una en
[research.md](research.md#d-012-dependencias-y-justificación).

**Storage**: Cloud Firestore (modo nativo) accedido únicamente vía Admin SDK; reglas `deny all` para
clientes. Ver [data-model.md](data-model.md).

**Testing**: Vitest (unitarias e integración contra emulador de Firestore), `@firebase/rules-unit-testing`
(reglas), Playwright (E2E con emuladores de Firestore y Auth), Lighthouse CLI (rendimiento/accesibilidad).

**Target Platform**: Navegadores móviles modernos (prioridad 360 px) y escritorio para el panel. Despliegue
en Vercel (Node runtime); Firebase Hosting queda como alternativa no verificada en este plan.

**Project Type**: Aplicación web única (Next.js full-stack) en la raíz del repo; sin backend separado.

**Performance Goals**: Lighthouse móvil ≥ 90 en Performance y Accessibility en `/`; página lista en < 3 s
en 4G lento (SC-003); búsqueda del panel < 2 s con 5 000 registros (SC-010).

**Constraints**: JS inicial mínimo en `/` (formulario como único componente de cliente; App Check y
reCAPTCHA cargados de forma diferida al primer foco); sin secretos en el repo; todo texto en es-PE;
tokens de color obligatorios (sin hex en componentes); `any` prohibido sin justificación.

**Scale/Scope**: Hasta 5 000 participantes, un sorteo vigente con rondas sucesivas, pocas cuentas admin;
4 páginas de panel/login, 1 página pública + política de privacidad, 6 Route Handlers (7 operaciones HTTP).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio / Sección | Evaluación | Cómo se cumple |
|---|---|---|
| I. Stack y Arquitectura en Capas | PASS | Next.js App Router + TS estricto + Firebase (Firestore; Auth solo admin). Capas: `components/` (UI) → `lib/` (lógica pura) → `services/` (único lugar que importa `firebase`/`firebase-admin`). Despliegue en Vercel. |
| II. Calidad de Código y Validación | PASS | Esquemas Zod únicos en `lib/validation`, usados por React Hook Form (cliente) y por cada Route Handler (servidor). ESLint + Prettier en CI; `any` prohibido (regla `no-explicit-any` como error). |
| III. Seguridad y Prevención de Abuso | PASS | Credenciales solo en variables de entorno (`.env.example` sin valores; claves de Admin sin prefijo `NEXT_PUBLIC_`). Reglas de Firestore `deny all` (más estrictas que "solo crear": el participante nunca toca Firestore; crea su registro únicamente vía servidor; modalidad reconocida expresamente en la constitución v1.0.1). Unicidad por celular E.164 como ID + `create()` transaccional. Anti-abuso: App Check con token de un solo uso verificado en servidor. Listado/sorteo/borrado solo con sesión + claim `admin` verificados en servidor. Pruebas de reglas con emulador. |
| IV. Privacidad (Ley 29733) | PASS | Casillero de consentimiento obligatorio no premarcado, finalidad visible (incluye el borrado al final de la campaña, FR-032), enlace a `/privacidad`; se guarda fecha y versión del texto; solo se recolectan nombre, celular y empresa/ocupación; función de borrado definitivo. |
| V. UX Mobile-First, Marca y Accesibilidad | PASS | Diseño desde 360 px; tokens en `@theme` de Tailwind derivados de `logo.svg`; logo solo sobre fondo oscuro `ink-900`; contraste AA verificado (ver [research.md](research.md#d-009-design-tokens-extraídos-del-logo)); etiquetas asociadas, errores con `aria-describedby`/`aria-live`; `lang="es-PE"`. |
| VI. Pruebas, Rendimiento y Simplicidad | PASS | Unitarias (Zod, celular, búsqueda, CSV, sorteo con RNG inyectable); integración con emulador (unicidad concurrente, cierre atómico, sorteo concurrente, borrado); E2E del registro (éxito, duplicado, sin consentimiento, cerrado); Lighthouse ≥ 90. Sin dependencias fuera de las justificadas en research D-012. |
| Restricciones Técnicas y de Despliegue | PASS | Proyectos Firebase separados dev/prod por variables de entorno; panel protegido en servidor (no solo ocultar rutas). |
| Flujo y Puertas de Calidad | PASS | `tsc --noEmit`, ESLint, Prettier, unitarias, reglas, E2E y Lighthouse definidos como scripts npm y listados en [quickstart.md](quickstart.md). |

**Resultado previo a la investigación**: sin violaciones; no se requiere Complexity Tracking.

**Re-evaluación posterior al diseño (Fase 1)**: se mantiene PASS. Dos decisiones que merecen atención en
revisión de código: (1) las reglas `deny all` interpretan el principio III de forma más estricta, no más
laxa; (2) la verificación de App Check se desactiva únicamente con `APP_CHECK_ENFORCEMENT=off` y solo fuera
de producción (el servidor falla al arrancar en producción si está apagada).

## Project Structure

### Documentation (this feature)

```text
specs/001-registro-sorteo/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── http-api.md      # Phase 1 output: contrato de los Route Handlers
├── checklists/
│   └── requirements.md  # Checklist de calidad del spec (/speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── instrumentation.ts                # al arrancar el servidor: assertAppCheckConfig() (falla cerrada)
├── app/
│   ├── layout.tsx                    # <html lang="es-PE">, fuentes, globals
│   ├── globals.css                   # Tailwind + @theme (design tokens del logo)
│   ├── page.tsx                      # Registro (Server Component: lee estado de inscripciones)
│   ├── privacidad/page.tsx           # Política de privacidad / texto de consentimiento
│   ├── admin/
│   │   ├── login/page.tsx            # Inicio de sesión del admin (fuera del grupo protegido)
│   │   └── (panel)/                  # Grupo de rutas protegido (no altera la URL)
│   │       ├── layout.tsx            # requireAdmin() + navegación
│   │       ├── page.tsx              # Participantes: conteo, búsqueda, paginación, exportar
│   │       ├── sorteo/page.tsx       # Ejecutar sorteo + historial
│   │       └── campana/page.tsx      # Abrir/cerrar inscripciones + borrar datos
│   └── api/
│       ├── registrations/route.ts            # POST (público, App Check)
│       └── admin/
│           ├── session/route.ts              # POST crear sesión / DELETE cerrar sesión
│           ├── registration/route.ts         # PUT abrir/cerrar inscripciones
│           ├── draws/route.ts                # POST ejecutar sorteo
│           └── participants/
│               ├── route.ts                  # DELETE borrado definitivo
│               └── export/route.ts           # GET CSV
├── components/
│   ├── ui/                           # Logo, Button, TextField, CheckboxField, Alert, Dialog
│   ├── registration/                 # RegistrationForm, ConsentField, SuccessPanel,
│   │                                 # AlreadyRegisteredPanel, ClosedNotice
│   └── admin/                        # LoginForm, AdminNav, ParticipantsTable, SearchBox,
│                                     # DrawPanel, DrawAnimation, DrawHistory,
│                                     # RegistrationToggle, PurgeDialog
├── lib/                              # Lógica pura, sin Firebase ni React
│   ├── validation/                   # phone.ts (normalización E.164), schemas.ts (Zod compartidos)
│   ├── consent.ts                    # CONSENT_VERSION + texto de finalidad
│   ├── search.ts                     # normalización sin tildes y filtrado
│   ├── format.ts                     # fechas en hora de Lima
│   ├── admin-fetch.ts                # fetch del panel: 401 → /admin/login?expirada=1
│   ├── csv.ts                        # serialización + neutralización de fórmulas
│   ├── draw.ts                       # selección aleatoria (Fisher-Yates, RNG inyectable)
│   └── http.ts                       # formato de errores de la API, check de Origin
├── services/                         # ÚNICO lugar que importa firebase / firebase-admin
│   ├── firebase/
│   │   ├── admin.ts                  # init Admin SDK (server-only)
│   │   ├── client.ts                 # init SDK web (solo Auth + App Check)
│   │   ├── auth-client.ts            # inicio de sesión del admin (SDK web)
│   │   └── app-check-client.ts       # carga diferida + getLimitedUseToken
│   ├── app-check.service.ts          # verifyToken({ consume: true }) (server-only)
│   ├── admin-auth.service.ts         # sesión por cookie, requireAdmin()
│   ├── participants.service.ts       # registrar, listar, contar, exportar, borrar
│   ├── registration-status.service.ts# leer / cambiar estado de inscripciones
│   └── draws.service.ts              # ejecutar sorteo (transacción), listar historial
└── types/                            # Tipos de dominio (Participant, Draw, ApiError…)

scripts/
├── grant-admin.ts                    # Crea/promueve usuario admin (custom claim) con Admin SDK
└── lighthouse.mjs                    # Puerta de rendimiento/accesibilidad ≥ 90

tests/
├── unit/                             # Zod, celular, búsqueda, CSV, sorteo
├── integration/                      # Servicios contra emulador de Firestore
├── rules/                            # Reglas de Firestore (@firebase/rules-unit-testing)
└── e2e/                              # Playwright

public/
└── logo.svg                          # Copia de logo.svg de la raíz

.github/workflows/ci.yml              # CI: typecheck, lint, format, test, rules, e2e, Lighthouse

firestore.rules · firestore.indexes.json · firebase.json · .env.example
```

**Structure Decision**: aplicación Next.js única (sin separar frontend y backend) porque la constitución
pide la capa de servicios dentro del mismo proyecto y el alcance no justifica más de un despliegue.
`services/` es la frontera con Firebase; `lib/` es lógica pura testeable sin emulador; `components/` y
`app/` nunca importan `firebase*` directamente.

## Complexity Tracking

Sin violaciones de la constitución; no se registra complejidad adicional.
