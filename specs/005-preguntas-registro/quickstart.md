# Quickstart: validar las preguntas del registro en dos pasos

Guía de validación de punta a punta de la feature 005. Detalles de datos y endpoints en
[data-model.md](data-model.md) y [contracts/http-api.md](contracts/http-api.md); el diseño y sus razones, en
[research.md](research.md).

## Prerrequisitos

- Node.js ≥ 22 y `npm install` hecho. Emuladores de Firebase (Firestore y Auth) con `firebase-tools` del repo.
- Variables de entorno locales como en la 001 (`.env.local`; ver `.env.example`). **Esta feature no agrega
  variables nuevas ni dependencias.**
- Un administrador con el claim `admin` (`npm run admin:grant -- <correo>` contra el emulador).

## Arranque

```bash
npm run emulators      # terminal 1: Firestore + Auth (proyecto demo-sorteo)
npm run dev            # terminal 2: http://localhost:3000
```

## Pruebas automáticas

| Comando | Qué cubre |
|---|---|
| `npm run typecheck` · `npm run lint` · `npm run format:check` | puertas de calidad (constitución) |
| `npm run test:unit` | **`schemas.test.ts`** (cuatro respuestas obligatorias; texto libre de 1 y de 101 caracteres, solo espacios, con saltos de línea normalizados y con caracteres de control; `crmInterest`/`gpsInterest` con valor ausente, `null`, inválido y booleano; `registrationCheckSchema`; errores del paso 1 y del paso 2 informados a la vez), **`interest.test.ts`** (nuevo: valores, etiquetas, opciones de cada pregunta, `matchesInterestFilter` para todos los filtros incluido «sin respuesta»), **`csv.test.ts`** (encabezado nuevo, columnas de respuestas, vacíos de participantes anteriores, neutralización de `=`, `+`, `-`, `@` en los textos libres), `search.test.ts`, `no-hardcoded-colors.test.ts` |
| `npm run test:rules` | `participants/{id}` con los campos nuevos sigue denegado a anónimos y administradores (fixture actualizado; las reglas no cambian) |
| `npm test` | lo anterior + integración: **`registrations.route.test.ts`** (registro con las cuatro respuestas; `400` por cada respuesta ausente o inválida y por el cuerpo antiguo; respuestas guardadas tal cual), **`registrations.check.route.test.ts`** (nuevo: `200` libre, `409` registrado, `403` cerrado, `400` número inválido, no escribe, sin datos personales en la respuesta), **`duplicates.test.ts`** (un duplicado con respuestas distintas no modifica las del original; carrera: número registrado entre el `check` y el envío ⇒ `409`), **`participants.list.test.ts`** (documentos anteriores: `crmInterest` `true`→`yes`, `false`/ausente→`no`, `gpsInterest` `null`; sin textos libres), **`export.route.test.ts`** (columnas nuevas, textos libres, vacíos de anteriores), `legacy-consent.test.ts`, `spins.route.test.ts` y `purge.test.ts` (fixtures; las respuestas no aparecen en el giro ni en el ganador) |
| `npm run test:e2e` | **`registration.spec.ts`** (flujo completo en dos pasos con teclado: Enter avanza en el paso 1, «Atrás» conserva lo escrito, errores del paso 1 y del paso 2, envío con una pregunta vacía no registra, el foco llega al título del paso), **`duplicate.spec.ts`** (el aviso «ya registrado» aparece al tocar «Siguiente», antes del paso 2), **`admin-access.spec.ts`** (columnas CRM y GPS / cámara, filtros solos y combinados con la búsqueda, ausencia de columnas de capacitación e invitado), **`export.spec.ts`** (las cuatro respuestas en el CSV), `purge.spec.ts` |
| `npm run perf` | Lighthouse móvil sobre `/registro` sigue ≥ 90 en Performance y Accessibility (SC-045) |

## Escenarios manuales

Cada escenario enlaza con las historias y requisitos que valida.

1. **Registro en dos pasos (US1; FR-118 a FR-128)** — abre `/registro` en un teléfono (360 px). Ves «Paso 1
   de 2» con nombres, celular con país y empresa u ocupación, y **no** hay casilla del CRM. Completa y toca
   «Siguiente»: aparece «Paso 2 de 2» con las cuatro preguntas, **sin ninguna opción marcada**. Toca
   «Atrás»: todo lo escrito sigue ahí; avanza otra vez y tus respuestas del paso 2 se conservan. Toca «Enviar
   y participar» con una pregunta sin responder: no se registra y el error señala la pregunta. Responde las
   cuatro y envía: ventana de bienvenida con tu celular con prefijo. En `/admin` aparece con sus datos.
2. **Preguntas de texto (FR-126)** — escribe un solo carácter, solo espacios y 101 caracteres en el área de
   capacitación o el invitado: cada caso muestra su error en español. Pega un texto con saltos de línea: se
   guarda como una sola línea.
3. **Teclado y lector de pantalla (FR-121, FR-125, FR-128; SC-043)** — recorre todo el formulario solo con el
   teclado: Enter en un campo del paso 1 avanza; las flechas cambian la opción de cada grupo; al cambiar de
   paso el foco cae en el título y se anuncia «Paso N de 2»; los errores se anuncian y el foco va al primer
   elemento con error.
4. **Duplicado al paso 1 (US2; FR-119, FR-122)** — registra a una persona y vuelve a abrir `/registro`: escribe
   el mismo celular (mismo país) y toca «Siguiente». Aparece «ya registrado» **sin** mostrar el paso 2. Abre
   dos pestañas con el mismo celular: pasa ambas al paso 2, envía una y luego la otra: la segunda muestra
   «ya registrado» y en el panel las respuestas siguen siendo las de la primera. Corta la conexión y toca
   «Siguiente»: mensaje de red en el paso 1, sin perder lo escrito.
5. **Inscripciones cerradas (FR-119, FR-122)** — con las inscripciones cerradas el formulario muestra el aviso
   de siempre; ciérralas mientras una persona está en el paso 2 y envía: aviso de cierre, sin registro.
6. **Panel (US3; FR-133, FR-134)** — registra cuatro personas con respuestas distintas de CRM y GPS. En
   `/admin` la tabla muestra las columnas **CRM** y **GPS / cámara** («Sí», «Tal vez», «No») y **no** las de
   capacitación e invitado. Cada filtro deja solo a quienes responden esa opción; combínalos entre sí y con
   la búsqueda; cambia de página: el filtro se conserva y la paginación vuelve a la 1. Con un participante
   anterior a esta feature, «Sin respuesta» lo aísla en el filtro de GPS / cámara; el filtro de CRM solo ofrece
   Todas, Sí, Tal vez y No (ese participante aparece como Sí o No según su casilla).
7. **CSV (FR-135)** — exporta: el encabezado nuevo con las cuatro columnas de respuestas; un texto libre que
   empiece con `=` aparece como texto en la hoja de cálculo; los participantes anteriores tienen CRM Sí/No y
   las demás celdas vacías.
8. **Sorteo y privacidad (FR-132)** — gira la ruleta con participantes con distintas respuestas: ninguna
   respuesta aparece en la ruleta, la ventana del ganador ni el historial, y todos pueden ganar.

## Criterios de salida

- Todas las pruebas automáticas pasan y `tsc --noEmit`, ESLint y Prettier no reportan nada.
- Los 8 escenarios manuales se cumplen en un teléfono (360 px) y en un monitor 1920×1080.
- Se cumplen SC-039 a SC-045 de la [spec](spec.md#success-criteria-mandatory).
