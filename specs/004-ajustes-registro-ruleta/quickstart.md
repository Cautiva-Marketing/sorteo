# Quickstart: validar los ajustes de registro, QR y ruleta

Guía de validación de punta a punta de la feature 004. Detalles de datos y endpoints en
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
| `npm run test:unit` | **`phone.test.ts`** reescrito (12 países: ejemplo válido e inválido de cada uno; PE y CL estrictos; prefijo `+` propio y ajeno; prefijo pelado; `0` troncal; `9` móvil de Argentina y rechazo de 11 dígitos sin `9`; formato de visualización del E.164 y del valor antiguo de 9 dígitos), **`schemas.test.ts`** (un solo nombre, nombre de 1 letra, `country` por defecto, `crmInterest` por defecto, errores de nombre y celular informados a la vez, `spinRequestSchema` sin confirmación), **`csv.test.ts`** (columnas «Celular (con código de país)» e «Interesado en CRM»), **`search.test.ts`** (búsqueda con y sin prefijo), **`wheel.test.ts`** (paleta de 3 colores sin vecinos iguales para cualquier cantidad, incluida la unión último-primero, y contraste AA ≥ 4,5 de cada par fondo/texto leyendo los colores de `globals.css`), `social-links.test.ts` (URL exactas), `no-hardcoded-colors.test.ts` |
| `npm run test:rules` | `participants/+56…` y demás prefijos siguen denegados a anónimos y administradores (caso nuevo) |
| `npm test` | lo anterior + integración: **`registrations.route.test.ts`** (chileno válido, país por defecto, un solo nombre, `crmInterest` guardado y por defecto `false`, número inválido para el país), **`duplicates.test.ts`** (mismo número local en dos países = 2 participantes; duplicado no cambia `crmInterest`), **`participants.list.test.ts`** (E.164 y `crmInterest`; documentos sin el campo ⇒ `false`), **`export.route.test.ts`** (nuevas columnas, celular con prefijo), **`spins.test.ts`** y **`spins.route.test.ts`** (giro con inscripciones abiertas **sin** confirmación: gira y cierra; práctica no cierra; el cierre y el giro son atómicos), `legacy-consent.test.ts`, `purge.test.ts` |
| `npm run test:e2e` | **`registration.spec.ts`** (selector de país, un solo nombre, casilla CRM, sin texto de ayuda del celular, tarjeta de gracias con las dos redes), **`duplicate.spec.ts`**, **`draw.spec.ts`** (el botón «Girar» gira sin ventana y el letrero muestra un nombre en ≤ 2 s), **`qr-screen.spec.ts`** (sin desplazamiento en 1366×768 y 1920×1080, orden y centrado), **`admin-access.spec.ts`** (columna CRM, filtro «solo interesados», búsqueda con prefijo), `export.spec.ts` |
| `npm run perf` | Lighthouse móvil sobre `/registro` y `/` sigue ≥ 90 en Performance y Accessibility (SC-038) |

## Escenarios manuales

Cada escenario enlaza con las historias y requisitos que valida.

1. **Celular de Chile y un solo nombre (US1; FR-092 a FR-100)** — abre `/registro`. Comprueba que el campo
   «Celular» tiene un selector con **Perú (+51)** y que **no** hay texto «9 dígitos, por ejemplo …». Elige
   **Chile (+56)**, escribe «María» en nombres, `9 1234 5678` en celular y «Cautiva» en empresa; envía. La
   ventana de bienvenida muestra `+56 9 1234 5678`. En el panel (`/admin`) aparece con ese prefijo.
2. **Validación por país (FR-094)** — con Perú elige un número que empiece con `8` → error que nombra Perú.
   Con Chile, `8 1234 5678` → error. Con Colombia, `300 123 4567` → se acepta; con 9 dígitos → error de
   largo. Pega `+51 987 654 321` con **Chile** elegido → error (prefijo de otro país). Pega `+56 9 1234 5678`
   con Chile → se acepta.
3. **Duplicados (FR-095, FR-096)** — registra `987 654 321` en Perú y repítelo: aviso «ya registrado». Registra
   el mismo `987 654 321` con **Chile**: se acepta como otra persona. Un participante creado antes de esta
   feature (`+51…`) no puede registrarse otra vez.
4. **CRM (US2; FR-101 a FR-105)** — la casilla «¿Deseas adquirir el CRM con Agente IA?» aparece **desmarcada**.
   Registra a una persona marcándola y a otra sin marcarla. En `/admin` la columna **CRM** dice Sí/No; la casilla
   **«Solo interesados en el CRM»** deja solo a la primera y sigue funcionando junto con la búsqueda. Exporta el
   CSV: columna «Interesado en CRM» con `Sí`/`No`. Vuelve a registrar a la primera persona **sin** marcar la
   casilla → «ya registrado» y en el panel sigue en **Sí**. Gira la ruleta: la respuesta no aparece en la
   ventana del ganador.
5. **Giro directo (US3; FR-106 a FR-108)** — con las inscripciones **abiertas** y un premio en juego pulsa
   «Girar para: …»: la ruleta gira **sin ninguna ventana**. Al terminar, `/` muestra el aviso de cierre y en
   Campaña las inscripciones figuran cerradas; reábrelas desde ahí. Activa «Modo de práctica» con las
   inscripciones abiertas y gira: siguen abiertas.
6. **QR y logos (US4; FR-109 a FR-111)** — abre `/` en 1920×1080 y 1366×768: sin barra de desplazamiento
   vertical; el QR se ve ≈ 15 % más pequeño y los tres logos ≈ 20–25 % más grandes (desde 640 px de ancho; en teléfonos ≈ 10 %). Escanéalo con un teléfono
   desde ≈ 3 m en el proyector: abre `/registro`. A 360 px de ancho no hay desplazamiento horizontal y los
   logos aliados caben en una fila.
7. **Ruleta con la paleta de la «A» (US4; FR-112, FR-113)** — en `/admin/sorteo` con 3, 4, 7 y 13
   participantes: segmentos morado, lavanda y celeste sin vecinos repetidos (revisa la unión del último con el
   primero); aro, pines, buje, puntero y letrero con la misma paleta, sin negro, crema ni dorado; los nombres
   se leen sobre cada color (texto oscuro solo sobre el celeste). Los botones, tarjetas y la ventana del
   ganador conservan sus colores.
8. **Redes sociales (US5; FR-114, FR-115)** — termina un registro con «Listo, muchas gracias»: la tarjeta
   «¡Gracias por registrarte!» muestra «Síguenos en nuestras redes sociales» con **Cautiva Marketing** y
   **Satelcom del Sur**; cada enlace abre la página de Facebook correcta en una pestaña nueva y se activa con
   el teclado. El aviso de cierre y la ventana «ya registrado» no las muestran.
9. **Panel sin desenfoque (US6; FR-116, FR-117)** — abre en `/admin` las ventanas de ganador, descartar,
   premios y borrado de datos: el fondo se oscurece **sin desenfoque** y el foco sigue contenido con Escape para
   cerrar. En `/registro`, las ventanas de bienvenida y «ya registrado» conservan el desenfoque.

## Criterios de salida

- Todas las pruebas automáticas pasan y `tsc --noEmit`, ESLint y Prettier no reportan nada.
- Los 9 escenarios manuales se cumplen en un teléfono (360 px) y en un monitor 1920×1080.
- Se cumplen SC-030 a SC-038 de la [spec](spec.md#success-criteria-mandatory).
