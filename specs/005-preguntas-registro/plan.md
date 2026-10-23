# Implementation Plan: Preguntas del registro en dos pasos

**Branch**: `005-preguntas-registro` | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-preguntas-registro/spec.md`

## Summary

Cambio sobre la aplicación de las features 001 a 004 (no es un proyecto nuevo): el formulario público pasa a
**dos pasos** y el panel aprende a mostrar, filtrar y exportar las nuevas respuestas.

- **Registro**: paso 1 «Tus datos» (nombres, celular con país, empresa u ocupación) y paso 2 con cuatro
  preguntas obligatorias: área de capacitación e invitado sugerido (texto libre, 2–100) e interés en el CRM
  con Agente IA y en GPS/cámara de Satelcom (Sí / Tal vez / No, en desplegables que arrancan sin respuesta). Desaparece la
  casilla del CRM. El registro se guarda solo al enviar el paso 2.
- **Duplicados temprano**: al tocar «Siguiente» se consulta al servidor si el celular ya está registrado o las
  inscripciones están cerradas, antes de pedir las respuestas; al enviar se vuelve a comprobar (transacción).
- **Panel**: columnas «CRM» y «GPS / cámara» en la tabla, un filtro por respuesta para cada una (reemplazan
  «Solo interesados en el CRM») y cuatro columnas nuevas en el CSV.

Enfoque técnico (detalle en [research.md](research.md)):

- **Un formulario, un esquema**: `RegistrationForm` conserva un único `useForm` con `registrationSchema`
  ampliado; el paso 1 se valida con `trigger([...campos del paso 1])`. Ambos pasos permanecen montados y el
  inactivo se oculta con `hidden` (sin perder valores al volver con «Atrás»).
- **Comprobación del paso 1**: endpoint nuevo `POST /api/registrations/check` (solo lectura, mismo origen,
  sin datos personales en la respuesta) apoyado en `checkRegistrationAvailable` del servicio; reutiliza la
  normalización de celular existente.
- **Datos**: `participants` gana `trainingArea`, `guestSuggestion` y `gpsInterest`; `crmInterest` pasa de
  booleano a `"yes" | "maybe" | "no"`. Los documentos anteriores se **normalizan al leer** (`true` → `yes`,
  `false`/ausente → `no`; los demás campos → «Sin respuesta»): **sin migración**, colecciones, índices ni
  reglas nuevas.
- **Dominio de interés**: módulo puro `lib/interest.ts` (valores, etiquetas y coincidencia de filtros) y tipo
  `Interest` en `types`.
- **UI nueva**: `SelectField` (desplegable nativo compatible con React Hook Form; también filtra el panel)
  (filtros del panel) y `StepProgress` («Paso N de 2»).
- **Sin dependencias nuevas.**

## Technical Context

**Language/Version**: TypeScript (`strict: true`), Node.js ≥ 22 (sin cambios).

**Primary Dependencies**: las de la 001–004 (`next` 16.4, `react` 19, `tailwindcss` 4, `zod` 4,
`react-hook-form` + `@hookform/resolvers`, `firebase` solo para Auth, `firebase-admin`, `server-only`,
`uqr`). **Ninguna dependencia nueva**: el `<select>` es un control nativo y la lógica del
filtro es una función pura.

**Storage**: Cloud Firestore vía Admin SDK; reglas `deny all` sin cambios. Cuatro campos en `participants`
(uno cambia de tipo, tres nuevos); sin colecciones ni índices nuevos. Ver [data-model.md](data-model.md).

**Testing**: Vitest (unitarias e integración contra el emulador), `@firebase/rules-unit-testing`,
Playwright (E2E con emuladores), Lighthouse (`npm run perf`). Pruebas nuevas y modificadas en
[quickstart.md](quickstart.md#pruebas-automáticas).

**Target Platform**: formulario público en móviles desde 360 px; panel en escritorio. Chrome, Edge, Firefox y
Safari recientes. Despliegue en Vercel (Node runtime), igual que antes.

**Project Type**: aplicación web única (Next.js full-stack) en la raíz del repo.

**Performance Goals**: la página de registro mantiene Lighthouse móvil ≥ 90 en Performance y Accessibility
(SC-045: dos campos de texto y dos desplegables nativos no añaden JavaScript relevante); la
comprobación del paso 1 es una sola petición con dos lecturas puntuales (`getAll`), sin transacción.

**Constraints**: sin secretos en el repo; todo texto en es-PE; sin colores literales en `src/` salvo
`globals.css`; modales con foco contenido; `any` prohibido; el servidor revalida todo y nunca confía en el
cliente; las respuestas no viajan a la ruleta, la ventana del ganador, el historial ni los logs; los textos
libres se tratan siempre como texto plano (React escapa; el CSV neutraliza fórmulas).

**Scale/Scope**: hasta 5 000 participantes (referencia de la 003); 4 respuestas por participante; ≈ 18
archivos de código tocados o nuevos y ≈ 14 archivos de pruebas ajustados o nuevos.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluado contra la constitución **v2.2.0** (2026-10-23), enmendada para esta feature.

| Principio / Sección | Evaluación | Cómo se cumple |
|---|---|---|
| I. Stack y Arquitectura en Capas | PASS | Next.js App Router + TS estricto + Firebase. La lógica nueva (`lib/interest.ts`, esquema) es pura; el único acceso a Firestore sigue en `participants.service.ts`. `RegistrationForm`, `SelectField`, `ParticipantsTable` solo reciben props o llaman a `fetch`; ninguno importa `firebase*`. |
| II. Calidad de Código y Validación | PASS | Un solo `registrationSchema` compartido por el formulario y por `POST /api/registrations`; el esquema del `check` reutiliza la misma regla de celular. El servidor revalida las cuatro respuestas. Componentes pequeños (`SelectField`, `StepProgress` salen de `RegistrationForm`/`ParticipantsTable`). `any` sin uso. ESLint y Prettier siguen en la puerta de calidad. |
| III. Seguridad y Control de Acceso | PASS | Reglas Firestore `deny all` intactas. Unicidad por E.164 como ID sin cambios (`transaction.create` → `ALREADY_EXISTS`); la comprobación del paso 1 es solo informativa y la garantía sigue en la transacción. El nuevo endpoint es público, de solo lectura, con `assertSameOrigin` y sin datos personales en la respuesta; que revele si un celular está registrado ya ocurría con el 409 de `POST /api/registrations` y la organización acepta no tener anti-automatización (ver D-402 y «Complexity Tracking»). Panel y exportación exigen sesión de administrador verificada en el servidor. |
| IV. Minimización y Uso de Datos Personales | PASS | Los campos son exactamente los de v2.2.0: nombres, celular con país, empresa u ocupación y las cuatro respuestas del paso 2. Ninguna respuesta entra en `WheelParticipant`, `SpinResult`, el snapshot de `spins` ni el historial; no influyen en el sorteo ni se registran en logs. La tabla del panel recibe solo CRM y GPS; capacitación e invitado salen únicamente en el CSV (`listParticipantsForExport`). El borrado definitivo elimina el documento completo. El contacto comercial lo ejerce la organización fuera del sistema. La cláusula de datos públicos (solo agregados) se respeta en lo que se muestra; el único dato por persona que sale al público es el estado «celular ya registrado» del endpoint `check`, igual que el `409` de la 001, y queda registrado como riesgo aceptado en «Complexity Tracking». |
| V. UX Mobile-First, Marca y Accesibilidad | PASS | Cada paso cabe en 360 px sin desplazamiento horizontal. Cada campo y desplegable tiene su `label`, errores en español con `aria-describedby`/`aria-live`; al cambiar de paso el foco va al título del paso y se anuncia «Paso N de 2»; áreas táctiles ≥ 44 px. Colores solo por tokens existentes. Todo en es-PE. |
| VI. Pruebas, Rendimiento y Simplicidad | PASS | Unitarias: esquema, `interest`, CSV. Integración: registro con las cuatro respuestas, `check`, duplicado sin modificar respuestas, lectura de documentos anteriores. E2E del registro: éxito en dos pasos, duplicado en el paso 1 y datos inválidos. Lighthouse sobre `/registro` ≥ 90. **Cero dependencias nuevas**. Se construye solo lo especificado (YAGNI). |
| Restricciones Técnicas y de Despliegue | PASS | Sin variables de entorno nuevas; `lang="es-PE"` intacto; sin cambios de hosting. |
| Flujo y Puertas de Calidad | PASS | Siguen `tsc --noEmit`, ESLint, Prettier, unitarias, reglas, E2E y Lighthouse. Sin secretos ni datos reales en los cambios. |

**Resultado previo a la investigación**: sin violaciones; Complexity Tracking solo anota el riesgo aceptado del
endpoint `check`.

**Re-evaluación posterior al diseño (Fase 1)**: se mantiene PASS. Puntos para la revisión de código
(principios III y IV): (1) `registerParticipant` conserva el `create` atómico y un duplicado **no** modifica
ninguna respuesta; (2) `POST /api/registrations/check` no devuelve ni registra datos de la persona (solo
`status` y códigos) y no escribe; (3) `trainingArea` y `guestSuggestion` solo salen por
`listParticipantsForExport`, nunca por `listParticipants` ni por la API de la ruleta; (4) ningún log nuevo
contiene celular, nombre ni respuestas; (5) los textos libres se muestran como texto y se neutralizan en el
CSV.

## Project Structure

### Documentation (this feature)

```text
specs/005-preguntas-registro/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── http-api.md      # Phase 1 output: cuerpos que cambian, endpoint nuevo, CSV y componentes
├── checklists/
│   └── requirements.md  # Checklist de calidad de la spec (/speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

Los artefactos de las features 001 a 004 quedan **superseded** solo en lo que esta cambia (la casilla
opcional del CRM, el filtro «Solo interesados en el CRM» y la columna «Interesado en CRM»); no se editan aquí.

### Source Code (repository root)

`+` nuevo · `~` modificado · `−` eliminado. Lo no listado no cambia.

```text
src/
├── app/
│   ├── registro/page.tsx                              ~ solo el texto de apertura («Completa tus datos y responde 4 preguntas…»)
│   └── api/
│       ├── registrations/
│       │   ├── route.ts                               = (usa el esquema ampliado; sin cambios de código)
│       │   └── check/route.ts                         + comprobación del paso 1: celular libre e inscripciones abiertas
│       └── admin/participants/export/route.ts         ~ usa listParticipantsForExport
├── components/
│   ├── registration/
│   │   ├── RegistrationForm.tsx                       ~ dos pasos, «Siguiente»/«Atrás», comprobación, foco y errores por paso; − casilla CRM
│   │   └── StepProgress.tsx                           + «Paso N de 2» con barra de avance
│   ├── admin/
│   │   └── ParticipantsTable.tsx                      ~ columnas CRM y GPS / cámara; dos filtros; − casilla «Solo interesados»
│   └── ui/
│       ├── SelectField.tsx                            + desplegable con etiqueta, compatible con RHF: preguntas de interés del registro y filtros del panel
│       └── CheckboxField.tsx                          − (se elimina: solo lo usaban el registro y la tabla, que dejan de usarlo)
├── lib/
│   ├── interest.ts                                    + Interest: valores, etiquetas, opciones de pregunta y coincidencia de filtros
│   ├── csv.ts                                         ~ columnas Área de capacitación, Invitado sugerido, CRM con Agente IA, GPS / cámara
│   └── validation/
│       └── schemas.ts                                 ~ registrationSchema con 4 respuestas; + registrationCheckSchema; − crmInterest booleano
├── services/
│   └── participants.service.ts                        ~ guarda las respuestas; + checkRegistrationAvailable; + listParticipantsForExport; normaliza documentos anteriores
└── types/index.ts                                     ~ + Interest; Participant/ParticipantListItem con crmInterest/gpsInterest; + ParticipantExportRow

tests/
├── unit/        schemas ~ · interest + · csv ~ · search = · no-hardcoded-colors =
├── integration/ registrations.route ~ · registrations.check.route + · duplicates ~ · participants.list ~ · export.route ~ · legacy-consent ~ · spins.route ~
├── rules/       firestore.rules.test.ts ~ (fixture con los campos nuevos; las reglas no cambian)
└── e2e/         registration ~ · duplicate ~ · export ~ · admin-access ~ · purge ~ (fixtures) · design ~ · helpers/emulators ~ · helpers/registration +
```

**Structure Decision**: se mantiene la aplicación Next.js única y la separación de capas de las features
anteriores. La lógica nueva (valores y filtros de interés, esquema) es pura y vive en `lib/`, probada sin
emulador; `participants.service.ts` sigue siendo el único lugar que lee y escribe el participante; los
componentes nuevos solo manejan presentación y se conectan al esquema compartido mediante React Hook Form.
Ningún archivo se mueve de capa.

## Cobertura de requisitos

| Requisitos | Dónde se cubren |
|---|---|
| FR-118, FR-121 (dos pasos, «Atrás», foco y anuncio) | `RegistrationForm`, `StepProgress` |
| FR-119 (validar el paso 1 y comprobar celular/cierre) | `trigger` del paso 1 + `POST /api/registrations/check`, `checkRegistrationAvailable`, `registrationCheckSchema` |
| FR-120, FR-122 (guardar solo al enviar; duplicado no modifica) | `registerParticipant` (`create` atómico, sin cambios de lógica); sin escritura en el paso 1 |
| FR-123 (sin doble envío) | guardia `submitting` y `loading` en los botones de ambos pasos |
| FR-124 a FR-128 (preguntas, opciones, validación en pantalla) | `RegistrationForm`, `SelectField`, `interest.ts` (opciones), `registrationSchema`, `answerSchema` |
| FR-129, FR-130 (validación y guardado en servidor) | `registrationSchema` en `POST /api/registrations`, `registerParticipant` |
| FR-131 (participantes anteriores) | normalización al leer en `participants.service.ts` (`toInterest`) |
| FR-132 (no influyen ni se exponen) | las respuestas quedan fuera de `WheelParticipant`, `SpinResult`, `WinnerRecord`; `listParticipants` sin textos libres |
| FR-133, FR-134 (columnas y filtros) | `ParticipantsTable`, `SelectField`, `interest.ts › matchesInterestFilter` |
| FR-135 (CSV con las cuatro respuestas) | `csv.ts`, `listParticipantsForExport`, `export/route.ts` |

## Riesgos y puntos a vigilar en la implementación

- **Filtro «Sin respuesta»**: el CRM de un participante anterior nunca es «sin respuesta» (la casilla anterior
  da Sí o No), así que solo el filtro de GPS / cámara ofrece esa opción (FR-134); el de CRM ofrece Todas, Sí,
  Tal vez y No (`CRM_FILTER_OPTIONS` frente a `GPS_FILTER_OPTIONS`).
- **Desplegables y React Hook Form**: las preguntas de interés usan `SelectField` con `{...register("campo")}`
  y una primera opción sin valor («Elige una opción»); el esquema rechaza `""`. T016 comprueba en el
  emulador el valor guardado de cada opción. (Se probó primero un grupo de radios, que alargaba el
  formulario; ver research D-406.)
- **Cuerpo anterior de `POST /api/registrations`**: un formulario abierto antes del despliegue enviaría
  `crmInterest` booleano y sin las demás respuestas ⇒ `400 VALIDATION_ERROR`. Recargar la página lo resuelve;
  no se mantiene compatibilidad (D-411).
- **Foco en el cambio de paso**: verificar con el E2E y a mano (teclado y lector de pantalla) que el foco
  llega al título del paso y que Enter en el paso 1 avanza en lugar de enviar.
- **Pruebas que fijan el formato anterior**: `schemas.test.ts`, `csv.test.ts`, `export.route.test.ts`,
  `participants.list.test.ts`, `registrations.route.test.ts`, `duplicates.test.ts`, `legacy-consent.test.ts`
  y los E2E de registro asumen la casilla booleana o el encabezado «Interesado en CRM»; se actualizan junto
  con el código (no se debilitan).
- **Ancho de 360 px**: la tabla del panel gana dos columnas; se mantiene la región con desplazamiento
  horizontal enfocable y se sube su ancho mínimo.
- **AGENTS.md**: antes de escribir código, leer la guía relevante de `node_modules/next/dist/docs/` (Route
  Handlers) para el endpoint nuevo.

## Complexity Tracking

Sin violaciones de la constitución v2.2.0. No se agregan dependencias (principio VI): el desplegable
es un control nativo y el filtro, una función pura.

Un riesgo aceptado, que no es una violación pero queda registrado a propósito:

| Punto | Por qué se acepta | Alternativa más simple descartada porque |
|---|---|---|
| `POST /api/registrations/check` es público y permite saber si un celular está registrado (principio IV: lo mostrado públicamente debe limitarse a agregados que no identifiquen a nadie) | Es el mismo dato que ya revela el `409 ALREADY_REGISTERED` de `POST /api/registrations` desde la 001; la respuesta no incluye ningún dato de la persona (solo el estado); el principio III acepta explícitamente no tener anti-automatización; es la única forma de cumplir FR-119 (avisar antes del paso 2) | No comprobar hasta el envío final obliga a contestar cuatro preguntas para descubrir que el registro no cuenta (rechazada por el usuario en la clarificación); reservar el celular al pasar el paso 1 crea registros incompletos y contradice FR-120 |
