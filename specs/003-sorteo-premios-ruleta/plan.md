# Implementation Plan: Sorteo por premios con ruleta

**Branch**: `003-sorteo-premios-ruleta` | **Date**: 2026-10-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-sorteo-premios-ruleta/spec.md`

## Summary

Cambio sobre la aplicación de las features 001 y 002 (no es un proyecto nuevo): el sorteo de «N ganadores de
golpe» con animación de relleno se **reemplaza** por un sorteo **por premios con ruleta**. El administrador
arma una lista de premios (nombre + unidades) y gira una ruleta por cada unidad; cada giro produce **un
ganador** decidido y guardado **en el servidor** antes de que la ruleta se mueva. Un ganador ausente se
**descarta** (queda en el historial, no vuelve a la ruleta) y se vuelve a girar. Hay **modo de práctica**
(gira sin guardar nada), **pantalla completa** para proyectar, letrero con el nombre bajo el puntero,
ventana «¡Ganador #N!» con confeti y melodía silenciable, y el primer giro real **cierra las inscripciones**
con confirmación.

Enfoque técnico (detalle en [research.md](research.md)):

- **Datos**: colecciones nuevas `prizes` y `spins` (un documento por giro) y un contador en
  `settings/draw`. La colección `draws` de la 001 queda **solo de lectura** y se muestra como «Sin premio»;
  no hay migración de datos. «Ganador o descartado» sigue marcándose con `participants.drawId`, así que la
  consulta de elegibles (`drawId == null`) no cambia y los ganadores antiguos siguen excluidos (FR-085).
- **Atomicidad**: cada giro y cada descarte son **una transacción** de Firestore que lee premio, contador,
  inscripciones y ganador elegido. El contador `settings/draw` es el punto de serialización: dos giros
  simultáneos por la última unidad nunca entregan dos ganadores (FR-072, SC-026).
- **Aleatoriedad**: se reutiliza `pickWinners` (`crypto.randomInt`) con `count = 1`. El aleatorio del
  cliente solo decide vueltas y desplazamiento dentro del segmento, nunca el ganador (FR-065).
- **Ruleta**: `<canvas>` 2D propio, sin librería. La rueda se **prerenderiza una vez** en un canvas
  fuera de pantalla y cada fotograma solo la rota, así 5 000 segmentos no cuestan más que 50. Los colores se
  leen de los design tokens (`getComputedStyle`), sin valores literales en `src/`.
- **Sonido y confeti**: melodía generada con Web Audio (sin archivos, sin dependencias); confeti con el
  `Confetti` CSS existente ampliado. Pantalla completa con la Fullscreen API y respaldo CSS.
- **Sin dependencias nuevas.** Se elimina `DrawPanel`, `DrawAnimation`, `DrawHistory`, `draws.service.ts` y
  `POST /api/admin/draws`.

## Technical Context

**Language/Version**: TypeScript (`strict: true`), Node.js ≥ 22 (sin cambios).

**Primary Dependencies**: las de la 001/002 (`next` 16.4, `react` 19, `tailwindcss` 4, `zod` 4,
`react-hook-form` + `@hookform/resolvers`, `firebase` solo para Auth, `firebase-admin`, `server-only`,
`uqr`). **Ninguna dependencia nueva** (canvas, Web Audio y Fullscreen son APIs del navegador). Ver
[research.md](research.md#d-208-sin-dependencias-nuevas).

**Storage**: Cloud Firestore vía Admin SDK; reglas `deny all` sin cambios. Colecciones nuevas `prizes` y
`spins`, documento `settings/draw`. Sin índices compuestos nuevos. Ver [data-model.md](data-model.md).

**Testing**: Vitest (unitarias e integración contra el emulador), `@firebase/rules-unit-testing`,
Playwright (E2E con emuladores). Pruebas nuevas y modificadas en
[quickstart.md](quickstart.md#pruebas-automáticas).

**Target Platform**: panel de administración en escritorio y pantalla de proyección Full HD (40"); Chrome,
Edge, Firefox y Safari recientes. Despliegue en Vercel (Node runtime), igual que la 001.

**Project Type**: aplicación web única (Next.js full-stack) en la raíz del repo.

**Performance Goals**: giro completo + ventana del ganador en < 10 s (SC-022: respuesta del servidor < 1,5 s
+ giro de 6,5 s); rueda a 60 fps con 500 participantes y fluida con 5 000; `POST /api/admin/spins` con
5 000 elegibles en < 1,5 s (lectura de ids + una transacción pequeña).

**Constraints**: sin secretos en el repo; todo texto en es-PE; sin valores de color literales en `src/`
salvo `globals.css` (la prueba `no-hardcoded-colors` sigue vigente, también para el `<canvas>`); contraste AA
en el texto de los segmentos; `prefers-reduced-motion` sin giro ni confeti; modales con foco contenido;
`any` prohibido; el ganador jamás lo elige el cliente.

**Scale/Scope**: hasta 5 000 participantes elegibles (referencia 500 para legibilidad de los nombres), hasta
100 unidades por premio, decenas de premios; 1 página de panel rediseñada (`/admin/sorteo`), 6 Route
Handlers nuevos y 1 eliminado.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluado contra la constitución **v2.0.0** (2026-10-22).

| Principio / Sección | Evaluación | Cómo se cumple |
|---|---|---|
| I. Stack y Arquitectura en Capas | PASS | Next.js App Router + TS estricto + Firebase. Servicios nuevos `prizes.service.ts` y `spins.service.ts` son el único lugar con Firestore para premios y giros; `lib/wheel.ts` (geometría, paleta, ángulos) y `lib/draw.ts` son lógica pura sin Firebase. Los componentes (`DrawStage`, `RouletteWheel`, `PrizePanel`…) solo llaman a `fetch` y reciben props; ninguno importa `firebase*`. |
| II. Calidad de Código y Validación | PASS | Esquemas Zod nuevos (`prizeSchema`, `prizeOrderSchema`, `spinRequestSchema`) compartidos entre el formulario de premios y los Route Handlers; el servidor revalida todo y verifica premio, unidades y elegibles por su cuenta. Componentes pequeños (rueda, diálogo, panel de premios, historial separados). `any` sin uso. |
| III. Seguridad y Control de Acceso | PASS | Reglas Firestore `deny all` intactas (cubren `prizes`, `spins` y `settings/draw`; se amplía la prueba de reglas). Premios, giros, descartes y práctica exigen sesión de administrador verificada en el servidor en cada petición (`requireAdminApi`) y `assertSameOrigin` en los métodos que modifican. Unicidad por celular y creación de registros intactas. El ganador se decide y se guarda en el servidor. |
| IV. Minimización y Uso de Datos Personales | PASS | No se agregan campos personales. La lista de la ruleta lleva solo `{ref, fullName}` (ref = hash del celular, sin el número) y solo a administradores; la ventana del ganador **no muestra el celular** (clarificación Q1) y la respuesta del giro tampoco lo incluye. El giro guarda una copia mínima del ganador que el borrado definitivo reduce a `{fullName}` (FR-086). Sin datos personales en logs. |
| V. UX Mobile-First, Marca y Accesibilidad | PASS | Panel utilizable desde 360 px (ruleta escala al ancho); proyección Full HD. Colores solo por tokens: la rueda lee `--color-*` y alterna negro, blanco, grises y el azul `#0A70BB`, con texto AA sobre cada fondo. Logo de Cautiva (versión clara) al centro y en pantalla completa. Modales con `<dialog>` nativo (foco contenido, Escape), `prefers-reduced-motion` sin giro ni confeti, etiquetas y `aria-live` para el letrero y los resultados. Todo en es-PE. |
| VI. Pruebas, Rendimiento y Simplicidad | PASS | Unitarias: selección sin repetir (`draw.ts`), geometría/paleta de la rueda, esquemas, CSV. Integración contra el emulador: giro, descarte, premios, concurrencia por la última unidad, cierre de inscripciones, práctica sin escrituras, borrado. E2E del flujo completo. Lighthouse sigue sobre `/registro` y `/` (el panel no se audita; no cambia). **Cero dependencias nuevas.** |
| Restricciones Técnicas y de Despliegue | PASS | Sin variables de entorno nuevas; panel protegido en servidor; el sorteo no depende de una plataforma concreta. |
| Flujo y Puertas de Calidad | PASS | Siguen `tsc --noEmit`, ESLint, Prettier, unitarias, reglas, E2E; la prueba de colores literales se mantiene y obliga a leer los colores de la rueda desde los tokens. |

**Resultado previo a la investigación**: sin violaciones; no se requiere Complexity Tracking.

**Re-evaluación posterior al diseño (Fase 1)**: se mantiene PASS. Puntos para la revisión de código
(principios III y IV): (1) los **nombres completos de todos los participantes elegibles** se pintan en la
ruleta proyectada y viajan al navegador del administrador: es inherente al sorteo en vivo, se limita a
nombres (sin celular ni empresa) y a sesión de administrador; (2) la respuesta de `POST /api/admin/spins` y la
ventana del ganador no incluyen el celular; el celular solo sale en el historial renderizado en el servidor y
en el CSV; (3) el modo de práctica no escribe en Firestore (se verifica con una prueba que compara el estado
antes y después); (4) nada del código nuevo registra datos personales en logs.

## Project Structure

### Documentation (this feature)

```text
specs/003-sorteo-premios-ruleta/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/
│   └── http-api.md      # Phase 1 output: endpoints nuevos y eliminados, contrato de la página
├── checklists/
│   └── requirements.md  # Checklist de calidad del spec (/speckit-specify)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

Los artefactos de `specs/001-registro-sorteo/` quedan **superseded** en lo que esta feature cambia (FR-019 a
FR-023: cantidad de ganadores, animación simple, confirmación de «ya hay sorteos»); no se editan aquí.

### Source Code (repository root)

`+` nuevo · `~` modificado · `−` eliminado. Lo no listado no cambia.

```text
src/
├── app/
│   ├── admin/(panel)/sorteo/page.tsx              ~ lee premios, ganadores, ruleta y estado de inscripciones; monta DrawStage, PrizePanel, WinnerHistory
│   └── api/admin/
│       ├── draws/route.ts                         − (reemplazado por spins)
│       ├── prizes/route.ts                        + POST crear premio
│       ├── prizes/order/route.ts                  + PUT reordenar
│       ├── prizes/[id]/route.ts                   + PUT editar · DELETE eliminar
│       ├── spins/route.ts                         + POST girar por un premio (real)
│       ├── spins/practice/route.ts                + POST girar en modo de práctica (no escribe)
│       ├── spins/[id]/discard/route.ts            + POST descartar un ganador
│       └── participants/export/route.ts           ~ agrega Premio, N.º de ganador y Estado
├── components/
│   ├── admin/
│   │   ├── DrawPanel.tsx · DrawAnimation.tsx · DrawHistory.tsx     −
│   │   ├── DrawStage.tsx                          + isla de cliente: premio en juego, girar, práctica, pantalla completa, silencio, máquina de estados del giro
│   │   ├── RouletteWheel.tsx                      + canvas: prerenderizado, rotación por rAF, letrero del nombre
│   │   ├── WinnerDialog.tsx                       + «¡Ganador #N!» (Continuar / Volver a girar), confeti
│   │   ├── PrizePanel.tsx                         + lista, alta/edición, orden y baja de premios (cliente)
│   │   ├── WinnerHistory.tsx                      + historial por número (servidor) con «Sin premio» para lo antiguo
│   │   └── DiscardWinnerButton.tsx                + descartar desde el historial (cliente)
│   └── ui/Confetti.tsx                            ~ props `pieces` y `accent` (azul de Cautiva)
├── lib/
│   ├── draw.ts                                    = se reutiliza `pickWinners(ids, 1)`
│   ├── wheel.ts                                   + paleta sin vecinos iguales, ángulos de parada, índice bajo el puntero, tamaño de fuente (lógica pura)
│   ├── victory-sound.ts                           + melodía con Web Audio y preferencia de silencio (solo cliente)
│   ├── csv.ts                                     ~ 3 columnas nuevas
│   └── validation/schemas.ts                      ~ − drawRequestSchema; + prizeSchema, prizeOrderSchema, spinRequestSchema
├── services/
│   ├── draws.service.ts                           − 
│   ├── spins.service.ts                           + girar, descartar, práctica, ruleta (elegibles), historial unificado (giros + `draws` antiguos)
│   ├── prizes.service.ts                          + CRUD de premios, orden, nombre único
│   └── participants.service.ts                    ~ el borrado definitivo también reduce `spins`
└── types/index.ts                                 ~ − Draw*; + Prize, Spin, WinnerRecord, WheelParticipant; nuevos códigos de error

tests/
├── unit/        draw.test.ts = · wheel.test.ts + · schemas.test.ts ~ · csv.test.ts ~ · no-hardcoded-colors.test.ts =
├── integration/ draws.test.ts − → spins.test.ts + · prizes.test.ts + · routes (admin-routes-auth.test.ts ~) · purge.test.ts ~ · export.route.test.ts ~ · volume.test.ts ~
├── rules/       firestore.rules.test.ts ~ (prizes, spins, settings/draw)
└── e2e/         draw.spec.ts ~ (reescrito: premios, giro, descarte, práctica, pantalla completa) · purge.spec.ts ~ · export.spec.ts ~
```

**Structure Decision**: se mantiene la aplicación Next.js única y la separación de capas de la 001/002.
`services/` sigue siendo el único lugar que importa `firebase-admin`; `lib/` queda para lógica pura
(`wheel.ts`, `draw.ts`) probada sin emulador; los componentes solo consumen `fetch` y props. La página del
sorteo es un Server Component que lee los datos (premios, ruleta, historial) y los pasa a islas de cliente;
tras cada acción confirmada se llama a `router.refresh()`, como hacía `DrawPanel`. La rueda y el sonido
viven solo en el cliente porque dependen de `canvas`, Web Audio y la Fullscreen API.

## Cobertura de requisitos

| Requisitos | Dónde se cubren |
|---|---|
| FR-060 a FR-063 (premios) | `prizes.service.ts`, `PrizePanel`, `prizeSchema`; selección del premio en juego en `DrawStage` (primer premio con unidades pendientes) |
| FR-064, FR-065, FR-072 (giro, decisión en servidor, concurrencia) | `spins.service.ts › spin` (una transacción), `pickWinners`, `POST /api/admin/spins`; botón bloqueado en `DrawStage` |
| FR-066 a FR-071 (ruleta) | `RouletteWheel`, `lib/wheel.ts` (paleta, ángulos, fuente, letrero) |
| FR-073 (botón deshabilitado con motivo) | `DrawStage` (premio, unidades, elegibles) |
| FR-074 a FR-077 (resultado, confeti, sonido, reducción de movimiento) | `WinnerDialog`, `Confetti`, `victory-sound.ts`, `matchMedia('(prefers-reduced-motion)')` |
| FR-078, FR-079 (descartes) | `spins.service.ts › discardSpin`, `DiscardWinnerButton`, botón «Volver a girar» |
| FR-080, FR-081 (pantalla completa) | `DrawStage` (Fullscreen API + respaldo CSS), tamaños para 1920×1080 |
| FR-082 a FR-087 (historial, CSV, exclusión previa, purga, acceso) | `listWinnerRecords`, `WinnerHistory`, `csv.ts`, `purgeAllParticipantData`, `requireAdminApi` |
| FR-088 (es-PE y tokens) | todos los componentes; prueba `no-hardcoded-colors` |
| FR-089 (cierre de inscripciones al primer giro) | `spins.service.ts › spin` (confirmación y cierre en la misma transacción), diálogo en `DrawStage` |
| FR-090 (modo de práctica) | `POST /api/admin/spins/practice` (sin escrituras), distintivo «Práctica» en panel, pantalla completa y ventana |
| FR-091 (reemplaza FR-019 a FR-023 de la 001) | eliminación de `DrawPanel`, `draws.service.ts` y `POST /api/admin/draws` |

## Complexity Tracking

Sin violaciones de la constitución; no se registra complejidad adicional. No se agregan dependencias
(principio VI); la ruleta, el sonido y el confeti se resuelven con APIs del navegador y con el componente
`Confetti` existente.
