# Quickstart: validar el sorteo por premios con ruleta

Guía de validación de punta a punta de la feature 003. Detalles de datos y endpoints en
[data-model.md](data-model.md) y [contracts/http-api.md](contracts/http-api.md); el diseño y sus razones, en
[research.md](research.md).

## Prerrequisitos

- Node.js ≥ 22 y `npm install` hecho. Emuladores de Firebase (Firestore y Auth) con `firebase-tools` del repo.
- Variables de entorno locales como en la 001 (`.env.local`; ver `.env.example`). **Esta feature no agrega
  variables nuevas.**
- Un administrador con el claim `admin` (`npm run admin:grant -- <correo>` contra el emulador, como en la 001).

## Arranque

```bash
npm run emulators      # terminal 1: Firestore + Auth (proyecto demo-sorteo)
npm run dev            # terminal 2: http://localhost:3000
```

Registra algunos participantes desde `/registro` (o usa `seedParticipants(n)` de
`tests/e2e/helpers/emulators.ts` para sembrar 10, 60, 500 o 5 000) e inicia sesión en `/admin/login`.

## Pruebas automáticas

| Comando | Qué cubre |
|---|---|
| `npm run typecheck` · `npm run lint` · `npm run format:check` | puertas de calidad (constitución) |
| `npm run test:unit` | `draw.test.ts` (sin repetidos en 1 000 giros), **`wheel.test.ts`** (paleta sin vecinos iguales incluido el cierre del ciclo, ángulo de parada dentro del segmento ganador, índice bajo el puntero, tamaño de fuente), `schemas.test.ts` (premios), `csv.test.ts` (3 columnas), `no-hardcoded-colors.test.ts` |
| `npm run test:rules` | `prizes`, `spins` y `settings/draw` denegados a anónimos y a administradores |
| `npm test` | lo anterior + integración: **`spins.test.ts`** (giro, número consecutivo, descarte, reintento por ganador repetido, **dos giros simultáneos por la última unidad = un solo ganador**, cierre de inscripciones con y sin confirmación, **práctica sin escrituras**, rondas antiguas «Sin premio» y excluidas), **`prizes.test.ts`** (alta, nombre repetido, edición, baja con historial, orden), `admin-routes-auth.test.ts` (401/403/Origin en los endpoints nuevos y 404 en `/api/admin/draws`), `purge.test.ts` (giros reducidos a `{ fullName }`), `export.route.test.ts` |
| `npm run test:e2e` | **`draw.spec.ts`** reescrito: premios → giro → ventana → descarte y nuevo giro → práctica → pantalla completa; `purge.spec.ts` y `export.spec.ts` ajustados |

## Escenarios manuales

Cada escenario enlaza con los requisitos que valida.

1. **Premios (US1; FR-060 a FR-063)** — en `/admin/sorteo` crea «Alexa» (2 unidades), «Box» (1) y «Termo»
   (1). Intenta un nombre repetido (error junto al campo) y una cantidad 0. Reordénalos y recarga: el orden y
   «0 de N entregadas» se conservan. «Alexa» queda como premio en juego.
2. **Girar (US2; FR-064 a FR-074)** — con 10+ participantes pulsa «Girar para: Alexa». Aparece la
   confirmación de cierre de inscripciones (escenario 5); acepta. La rueda gira ~6,5 s y frena sobre un
   segmento; el letrero muestra los nombres que pasan bajo el puntero y termina en el ganador. Se abre
   «¡Ganador #1!» con el premio y el nombre, **sin celular**, con confeti y melodía. Recarga la página: el
   ganador #1 sigue en el historial con su celular y premio. «Alexa» muestra «1 de 2 entregadas».
3. **Descartar y volver a girar (US3; FR-075, FR-078, FR-079)** — gira por «Box» y en la ventana pulsa
   «Volver a girar»: el ganador #2 queda «Descartado» en el historial (quién y cuándo), gira de nuevo y el
   nuevo ganador es el **#3**. «Box» muestra «1 de 1 entregadas»; el descartado no vuelve a salir. Descarta
   desde el historial a un ganador ya aceptado y comprueba que la unidad vuelve al premio.
4. **Práctica (FR-090)** — activa «Modo de práctica»: aparece «Práctica: no se guarda». Gira varias veces; la
   ventana dice «Práctica» y solo ofrece «Cerrar». Comprueba que no cambian ganadores, números, premios ni
   las inscripciones (ni se pide confirmación de cierre).
5. **Cierre de inscripciones (FR-089)** — con inscripciones abiertas, el primer giro real pide confirmar;
   «Cancelar» no gira ni cierra. Tras confirmar, abre `/` y `/registro` en otra pestaña: muestran
   «inscripciones cerradas». Reábrelas desde Campaña: la ruleta incluye a los nuevos desde el siguiente giro.
6. **Pantalla completa (US4; FR-080, FR-081)** — pulsa «Pantalla completa» en una ventana de 1920×1080:
   fondo blanco, logo, premio en juego grande, rueda ampliada y letrero. Gira y comprueba que la **ventana
   del ganador se ve dentro de la pantalla completa**; silencia y verifica que no suena; Escape vuelve al
   panel sin perder el estado. Revisa a ~2 m en una pantalla de 40" que el premio y el nombre se leen.
7. **Reducir movimiento (FR-077)** — activa «Reducir movimiento» en el sistema operativo (o emúlalo en las
   herramientas del navegador): al girar no hay animación ni confeti; la ventana del ganador aparece directo.
8. **Sin elegir premio / sin unidades / sin elegibles (FR-073)** — con todos los premios sorteados, con 0
   elegibles y con la práctica sin premio: el botón correspondiente queda deshabilitado con el motivo.
9. **Concurrencia (FR-072, SC-026)** — en dos pestañas con sesión de administrador, deja un premio con 1
   unidad y pulsa «Girar» en ambas a la vez: solo una obtiene ganador y la otra muestra «El premio ya no
   tiene unidades pendientes».
10. **Historial y CSV (US5; FR-082 a FR-085)** — el historial lista cada ganador con número, premio, nombre,
    celular, empresa, fecha y estado. Si hay rondas de la 001 en el emulador, aparecen como «Sin premio» y
    sus ganadores no vuelven a la ruleta. Descarga el CSV: incluye **Premio**, **N.º de ganador** y
    **Estado**.
11. **Borrado definitivo (FR-086)** — cierra las inscripciones y borra los datos desde Campaña: el historial
    conserva premio, número, nombre, fecha y estado (sin celular ni empresa); la ruleta queda vacía y el botón
    de girar deshabilitado («No hay participantes elegibles para sortear.»). En Firestore, `spins` no contiene
    ningún celular.
12. **Escala (FR-070, SC-024, SC-022)** — siembra 500 y luego 5 000 participantes: la rueda sigue a 60 fps con
    500 y fluida con 5 000; con 500 no hay texto superpuesto (los segmentos sin espacio no llevan texto) y el
    letrero muestra el nombre completo del ganador; de «Girar» a la ventana pasan < 10 s.
13. **Accesibilidad (FR-075, SC-029)** — recorre el panel con solo teclado: botón de girar, selección de premio,
    práctica, silencio, pantalla completa y ventanas (foco contenido, Escape cierra). Contraste AA en el texto
    de los segmentos y del letrero.
14. **Seguridad (FR-087)** — sin sesión, las rutas `/api/admin/prizes*` y `/api/admin/spins*` responden 401;
    con sesión sin claim `admin`, 403; con `Origin` ajeno, 403. `/api/admin/draws` responde 404.

## Criterios para dar la feature por terminada

- Todas las pruebas automáticas en verde y los escenarios 1 a 14 cumplidos.
- `tsc --noEmit`, ESLint y Prettier sin errores ni advertencias; la prueba de colores literales pasa (la rueda
  lee los colores de los tokens).
- Revisión de código con foco en los principios III y IV (ver «Re-evaluación» en [plan.md](plan.md)).
