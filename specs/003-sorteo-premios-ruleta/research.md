# Research: Sorteo por premios con ruleta

Decisiones técnicas de la feature 003. Cada una indica qué se decidió, por qué y qué se descartó. No quedan
marcadores `NEEDS CLARIFICATION`. Referencias al código tomadas del repositorio en la fecha del plan.

## D-201: Colecciones nuevas `prizes` y `spins`; `draws` queda de solo lectura

- **Decisión**: un documento por premio en `prizes/{id}` y **un documento por giro** en `spins/{id}`.
  La colección `draws` de la 001 no se modifica ni se migra: se lee para mostrar las rondas antiguas como
  «Sin premio» y para sembrar el contador. El borrado definitivo sigue reduciéndola a `{ fullName }`.
- **Razón**: el giro es ahora la unidad (1 ganador, 1 premio, 1 número, 1 estado). Meterlo en `draws`
  (documento con arreglo `winners` y `requestedCount`) obligaría a convivir dos formas en la misma colección.
  No hay datos reales que migrar (002 ya lo asumió), y leer `draws` sin tocarlo cumple FR-083 y FR-085 sin
  riesgo: los participantes ya ganadores conservan su `drawId` y siguen fuera de la ruleta.
- **Alternativas**: (a) reutilizar `draws` con un documento por giro y `winners` de 1 elemento — descartado
  por la forma híbrida y por dejar `requestedCount` sin sentido; (b) migrar `draws` a `spins` con un script —
  descartado: escritura masiva sin beneficio, y complica el borrado definitivo.

## D-202: Ganador o descartado = `participants.drawId`; elegibles sin cambios

- **Decisión**: al girar se pone `participants.drawId = spinId`; al descartar **no se toca** (el descartado
  sigue excluido). La consulta `where("drawId", "==", null)` sigue siendo la definición de elegible
  (FR-064, FR-079, FR-085).
- **Razón**: mantiene un único criterio de elegibilidad para giros nuevos, descartes y rondas antiguas, sin
  índices compuestos nuevos y sin cambiar `listParticipants` ni el CSV.
- **Alternativa**: marcar `status` en el participante — descartada: duplica el estado del giro y exigiría una
  segunda escritura en cada descarte.

## D-203: Número de ganador con un contador transaccional en `settings/draw`

- **Decisión**: `settings/draw = { nextNumber }`. Cada giro lo lee y lo incrementa dentro de su transacción
  (FR-082: consecutivo en todo el evento, nuevo en cada giro, el descartado conserva el suyo). Si el
  documento no existe, `nextNumber` se calcula como **(ganadores de `draws` antiguos) + 1**.
- **Numeración de lo antiguo**: las rondas de `draws` no tienen número; se numeran al leerlas, ordenadas por
  `createdAt` ascendente y por posición en `winners` (#1…#k). Como `draws` es inmutable (el borrado conserva
  la cantidad de ganadores), la numeración es estable y coincide con el `nextNumber` sembrado.
- **Razón**: un contador transaccional da números únicos y sin huecos entre giros concurrentes. Calcular
  «máximo + 1» leyendo `spins` fuera de la transacción repetiría números bajo concurrencia.
- **Alternativa**: `FieldValue.increment` fuera de transacción — descartada: no garantiza que el número quede
  atado al giro que se confirma (un giro abortado dejaría huecos).

## D-204: Atomicidad y concurrencia (FR-072, SC-026)

- **Decisión**: `spin(prizeId, admin, { confirmCloseRegistration })` hace:
  1. fuera de la transacción: lista los ids elegibles (`select()` sin descargar datos) y elige uno con
     `pickWinners(ids, 1)` (`crypto.randomInt`, igual probabilidad);
  2. **una transacción** que lee `prizes/{id}`, `settings/draw`, `settings/registration` y
     `participants/{elegido}`; comprueba que el premio exista y `delivered < quantity`
     (`PrizeExhaustedError`), que el elegido siga con `drawId == null` (si no, `StaleWinnerError` y se
     reintenta hasta 3 veces como hacía `commitDraw`; luego `DrawConflictError`), y que las inscripciones
     estén cerradas o venga la confirmación; y escribe `spins/{nuevo}`, `participants.drawId`,
     `prizes.delivered + 1`, `prizes.spinCount + 1`, `settings/draw.nextNumber + 1` y, si estaba abierta,
     `settings/registration.open = false`.
  3. si no hay elegibles, lanza `NoEligibleError` antes de abrir la transacción.
- **Por qué no hay doble ganador**: el Admin SDK usa bloqueo pesimista en las transacciones. Dos giros
  simultáneos leen el mismo `settings/draw` y el mismo premio: el segundo espera, relee el estado ya
  actualizado y, si era la última unidad, falla con `PrizeExhaustedError` (409). Como el contador se escribe
  en todos los giros, **todos** se serializan; un mismo participante elegido por dos giros distintos lo
  detecta la comprobación de `drawId`.
- **Cliente**: el botón se deshabilita mientras hay una petición o un giro en curso (FR-072, primera parte).
- **Alternativa**: bloqueo explícito con un documento `lock` — descartada: el contador ya cumple ese papel.

## D-205: Cierre automático de inscripciones en el primer giro (FR-089)

- **Decisión**: la página pasa `registrationOpen` al panel. Si está abierta y el giro **no es de práctica**,
  `DrawStage` muestra una confirmación «Al girar se cerrarán las inscripciones» antes de llamar; al confirmar
  envía `confirmCloseRegistration: true`. El servidor lo exige **dentro de la transacción**: si
  `settings/registration.open !== false` y no viene la confirmación, lanza `ConfirmationRequiredError`
  (`409 CONFIRMATION_REQUIRED`, código que ya existe), cubriendo el caso de un panel desactualizado.
  Al cerrar, el Route Handler llama a `invalidatePublicStatus()` (patrón de la 002) para que la pantalla del
  QR muestre «inscripciones cerradas» sin esperar el TTL de 1 s.
- **Razón**: leer y escribir `settings/registration` en la misma transacción que el giro garantiza que
  nadie se registre entre el cierre y el primer ganador (el registro lee ese mismo documento).
- **Alternativa**: cerrar desde el cliente con `PUT /api/admin/registration` y luego girar — descartada: dos
  llamadas no atómicas; un fallo entre ambas dejaría inscripciones cerradas sin giro.

## D-206: Modo de práctica = endpoint aparte que no escribe

- **Decisión**: `POST /api/admin/spins/practice` elige un elegible con el mismo `pickWinners` y devuelve
  `{ practice: true, winner: { ref, fullName } }`. **No** abre transacciones ni escribe, no exige premio y no
  toca las inscripciones (FR-090). Es una ruta distinta de `/api/admin/spins` para que sea imposible que un
  parámetro mal enviado guarde un ganador real.
- **Razón**: la garantía «no se guarda nada» se prueba comparando el estado de Firestore antes y después.
- **Alternativa**: un indicador `practice: true` en `POST /api/admin/spins` — descartada por el riesgo de
  escritura accidental.

## D-207: Datos de la ruleta: `{ref, fullName}` con `ref` = hash del celular

- **Decisión**: el Server Component lee los elegibles con `select("fullName")` y arma `WheelParticipant =
  { ref, fullName }`, donde `ref` son los primeros 16 caracteres hexadecimales de `SHA-256(idDelDocumento)`.
  La lista se ordena por `ref` en memoria (orden estable y de apariencia aleatoria; evita un índice
  compuesto `drawId + createdAt`). El giro devuelve `winner.ref` y el cliente lo busca en su lista.
- **Razón**: los nombres **no son únicos**, hace falta un identificador; usar el celular enviaría números a
  una vista que se proyecta (principio IV). El hash no es un secreto, solo evita enviar el celular.
- **Lista desactualizada**: si el `ref` del ganador no está en la lista del cliente (alguien más giró o se
  descartó), el panel no anima: muestra la ventana del ganador directamente y refresca la lista.
- **Tamaño**: 5 000 elegibles ≈ 250 KB en el payload del Server Component; aceptable y solo viaja en la carga
  y tras cada acción confirmada (`router.refresh()`).
- **Alternativa**: `GET /api/admin/wheel` — descartada: otro endpoint para lo que ya hace el Server Component.

## D-208: Sin dependencias nuevas

- **Decisión**: `<canvas>` 2D propio para la rueda, Web Audio para la melodía, Fullscreen API para la
  proyección y el `Confetti` CSS existente. Sin `canvas-confetti`, librerías de ruleta ni de audio.
- **Razón** (principio VI): la referencia (Ozarel/La Toscana) usa `canvas-confetti`, pero el confeti CSS de
  la 002 ya cubre «lluvia de confeti» con 20 líneas de CSS y respeta `prefers-reduced-motion` sin código
  extra. La rueda y el sonido se escriben una vez y se prueban en lógica pura.

## D-209: Rueda en canvas con prerenderizado

- **Decisión**: al montar y cuando cambia la lista o el tamaño, se dibuja la rueda completa (segmentos,
  divisores, texto) en un `OffscreenCanvas`/canvas oculto; cada fotograma de `requestAnimationFrame` solo
  hace `drawImage` rotado sobre el canvas visible (más el aro, los pines y el puntero, que son estáticos y se
  dibujan una vez en una capa aparte). El costo por fotograma no depende del número de participantes.
- **Resolución**: `devicePixelRatio` con tope de 3 (como la referencia) y tamaño según el contenedor: 360 px
  en móvil, ~560 px en el panel y hasta ~900 px en pantalla completa 1920×1080.
- **Geometría** (de la referencia, adaptada a la marca): aro exterior en negro con un anillo fino blanco,
  pines pequeños sobre el aro (uno por segmento, uno de cada 2 o 5 al aumentar la cantidad), buje central
  con el logo «ti» sobre disco blanco con borde fino, puntero fijo en la parte superior. **Sin sombras
  difusas ni degradados** (diseño minimalista de la 002).
- **Texto**: radial, de adentro hacia afuera, orientado en el sentido de lectura en la mitad izquierda para
  que no quede invertido. Tamaño de fuente por número de segmentos (`lib/wheel.ts › fontSizeFor`) y nombre
  abreviado: con más de 20 segmentos solo el primer nombre y, si no cabe, con «…». Si el arco disponible es
  menor que el mínimo legible (fuente < 7 px: de unos 100 participantes en adelante en una rueda de 560 px) **no se dibuja texto**
  en el segmento: es el extremo de «se reducen» de FR-070 y el nombre siempre se lee completo en el letrero
  (SC-024). La rueda a esa escala funciona como un «tambor» coloreado.

## D-210: Paleta de la rueda sin vecinos iguales (FR-067)

- **Decisión**: ciclo de 6 tokens con fondos oscuros y claros alternados y su texto de contraste:

  | Fondo | Texto | Contraste |
  |---|---|---|
  | `--color-ink-900` (#0A0A0A) | `--color-paper` | ≈ 19:1 |
  | `--color-paper` (#FFFFFF) | `--color-ink-900` | ≈ 19:1 |
  | `--color-accent-600` (#0A70BB) | `--color-paper` | ≈ 5,2:1 |
  | `--color-paper` | `--color-ink-900` | ≈ 19:1 |
  | `--color-ink-600` (#525252) | `--color-paper` | ≈ 7,8:1 |
  | `--color-paper` | `--color-ink-900` | ≈ 19:1 |

  Los blancos se separan con divisores finos (`--color-line`/`--color-ink-300`) para que no se confundan con
  el fondo de la página. El azul `#3D8CD3` no se usa (3,6:1, solo para elementos no textuales).
- **Regla del cierre del ciclo**: `colorOf(i) = i % 6`; si `N > 2` y `colorOf(N-1) == colorOf(0)` se reasigna el
  último segmento a un color distinto del anterior y del primero. Con `N = 1` la rueda es un disco único y
  con `N = 2` se usan los dos primeros. Los índices de color se calculan en `lib/wheel.ts` (puro, probado) y
  el componente los traduce a tokens.
- **Lectura de tokens**: `getComputedStyle(document.documentElement).getPropertyValue("--color-ink-900")`;
  así `src/` no contiene ningún literal de color (la prueba `no-hardcoded-colors` lo comprueba). Para la
  transparencia se usa `globalAlpha`, no `rgba(...)`.

## D-211: Animación y alineación con el ganador (FR-068, FR-069)

- **Decisión**: `requestAnimationFrame` con duración de **6 500 ms**, desaceleración cuártica
  (`1 - (1 - p)^4`) y **6 a 8 vueltas completas** en sentido horario. El ángulo final alinea el centro del
  segmento ganador con el puntero (12 en punto) más un desplazamiento aleatorio de ±25 % del arco, para que
  no pare siempre en el centro **sin salir nunca del segmento**. La función es pura
  (`targetRotation(winnerIndex, count, startAngle, extraTurns, offsetFraction)`) y se prueba con valores
  inyectados.
- **Letrero**: durante el giro se actualiza cada ~60 ms con el nombre completo del segmento bajo el puntero
  (`indexAtPointer(rotation, count)`); al detenerse muestra el del ganador. Se anuncia a lectores de pantalla
  solo al final (`aria-live="polite"` sobre el resultado, no sobre cada cambio del giro).
- **Aleatoriedad del cliente**: `Math.random` solo para vueltas y desplazamiento: no decide el ganador
  (FR-065) y no necesita ser criptográfica.
- **Sin sonido de «tic»** (supuesto del spec).
- **Reducción de movimiento (FR-077)**: con `prefers-reduced-motion: reduce` no se anima la rueda ni se
  muestra el confeti: se abre directamente la ventana del ganador. Se evalúa al iniciar cada giro.
- **Alternativa**: animar con CSS `transform` y `transition` — descartada: no permite leer el ángulo para el
  letrero ni reanudar desde el ángulo donde quedó la rueda.

## D-212: Ventana del ganador, sonido y silencio (FR-074 a FR-076)

- **Ventana**: se reutiliza `Dialog` (`<dialog>` nativo: foco contenido, Escape, `aria-labelledby`). Título
  «¡Ganador #N!», premio, nombre completo (se ajusta en varias líneas) y **sin celular** (Q1). Botones
  «Continuar» y «Volver a girar». Cerrar con Escape equivale a «Continuar»: el ganador ya está guardado
  desde que respondió el servidor. En práctica, la ventana lleva el distintivo «Práctica» y solo ofrece
  «Cerrar».
- **Confeti**: `Confetti` gana las props `pieces` (por defecto 28) y `accent` (agrega piezas en
  `bg-accent-600`); la ventana del ganador usa 60 piezas con acento. Sigue siendo CSS puro y oculto con
  `motion-reduce`.
- **Sonido**: arpegio ascendente de ondas seno con filtro paso bajo, generado con Web Audio (sin archivos),
  volumen 0,25. El `AudioContext` se crea y se reanuda en el clic de «Girar» (gesto del usuario, para evitar
  el bloqueo de autoplay) y todo va en `try/catch`: si falla, el sorteo continúa sin sonido ni errores. La
  preferencia de silencio se guarda en `localStorage` (`sorteo:silencio`), con lectura y escritura protegidas
  por `try/catch` (puede no estar disponible) y se respeta en el panel y en la pantalla completa.

## D-213: Pantalla completa (FR-080, FR-081)

- **Decisión**: `DrawStage` pide `requestFullscreen()` sobre su contenedor y escucha `fullscreenchange`. Si
  el navegador la rechaza o no la soporta, usa un respaldo CSS (`fixed inset-0`) con el mismo contenido y un
  botón «Salir». Escape sale en ambos casos (nativo en la API; manejado con `keydown` en el respaldo).
- **La ventana del ganador se monta dentro del contenedor** que entra en pantalla completa: así queda
  visible en el modo nativo (una `<dialog>` fuera del subárbol de pantalla completa puede quedar oculta según
  el navegador). Se comprueba en el escenario 6 del quickstart.
- **Contenido**: fondo blanco (`bg-paper`), logo de Cautiva (versión clara), nombre del premio en juego en
  texto grande (≥ 48 px en 1920×1080), rueda de ~900 px, letrero (≥ 40 px) y controles de girar, silencio y
  salir. Con eso el premio y el nombre se leen a 2 m en 40" Full HD (FR-081).

## D-214: Premios: nombre único, orden y borrado protegido (FR-060 a FR-063)

- **Nombre único**: `nameKey` = nombre en NFC, minúsculas y sin espacios repetidos. Crear y renombrar corren
  en una transacción que **lee y escribe `settings/draw`** (mismo contador) y consulta por `nameKey`; así dos
  altas simultáneas del mismo nombre se serializan y la segunda ve a la primera. Duplicado → `400
  VALIDATION_ERROR` con `fieldErrors.name`.
- **Orden**: campo `order` entero. Alta = máximo + 1. `PUT /api/admin/prizes/order` recibe la lista completa
  de ids y reescribe `order = índice` en un lote; si la lista no coincide con los premios existentes, 400.
- **Unidades**: `quantity` de 1 a 100 (por defecto 1); no puede bajar de `delivered` (ganadores activos).
  `delivered` y `spinCount` son contadores guardados en el premio y mantenidos dentro de las transacciones
  de giro y descarte (lectura O(1)).
- **Baja**: solo si `spinCount == 0`; con historial → `409 PRIZE_HAS_HISTORY`. Editar el nombre se permite
  siempre; el historial lee el nombre actual por `prizeId` (no se copia en el giro).
- **Premio en juego** (FR-063): `DrawStage` selecciona por defecto el primer premio, por `order`, con
  `delivered < quantity`; el administrador puede elegir otro. Tras un giro aceptado o descartado la página se
  refresca y el cálculo se repite.

## D-215: Descartar y volver a girar (FR-075, FR-078)

- **Decisión**: `POST /api/admin/spins/{id}/discard` marca el giro como `discarded` (con `discardedAt` y
  `discardedBy`), baja `prizes.delivered` y deja `participants.drawId` intacto. Es idempotente en estado: si
  ya está descartado → `409 SPIN_NOT_ACTIVE`. «Volver a girar» es **descartar + girar de nuevo** desde el
  cliente (dos llamadas): si la segunda falla, el estado es coherente (unidad libre, ganador descartado).
  Funciona desde la ventana del ganador y desde el historial (`DiscardWinnerButton`).
- **Sin reactivación** (FR-079): no existe ninguna ruta que devuelva un giro a `active` ni un `drawId` a
  `null`.
- **Tras el borrado definitivo**: se puede descartar (corrige el estado), pero no girar (no quedan
  participantes).

## D-216: Historial unificado y CSV (FR-082 a FR-084)

- **Historial**: `listWinnerRecords()` une `spins` (orden por `number` descendente) y los ganadores de
  `draws` antiguos (con su número calculado y premio «Sin premio»). Devuelve un solo tipo `WinnerRecord`; el
  Server Component lo pinta en `WinnerHistory`. Con el borrado ejecutado se conserva premio, número, nombre,
  fecha y estado, y se omiten celular y empresa.
- **CSV**: la exportación de participantes agrega **Premio**, **N.º de ganador** y **Estado**
  («Ganador»/«Descartado»/vacío). El Route Handler une `participants.drawId` con un mapa
  `drawId → { premio, número, estado }` construido con `listWinnerRecords()`. Se mantienen la neutralización
  de fórmulas y el BOM UTF-8; el nombre del premio, texto libre, se neutraliza.
- **Alternativa**: un segundo CSV solo de ganadores — descartada: el spec pide «junto con el resto de datos».

## D-217: Borrado definitivo (FR-086)

- **Decisión**: `purgeAllParticipantData` agrega al paso 1 la reducción de `spins`: `winner` queda como
  `{ fullName }` y se fija `purgedAt` (si ya tenía, se conserva). El resto de campos del giro (`number`,
  `prizeId`, `status`, `createdAt`, `createdBy`, `discardedAt/By`) se conserva. Nada de esto contiene
  celular: el giro **no guarda el id del participante** (solo el snapshot `winner`).
- **Sin giros posteriores**: sin participantes no hay elegibles → `NoEligibleError`.

## D-218: Rutas dinámicas en Next.js 16

- **Hallazgo** (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`): en los
  Route Handlers el segundo argumento trae `params` como **promesa**: `{ params }: { params: Promise<{ id:
  string }> }` y se usa `const { id } = await params` (o el helper global `RouteContext<'/ruta/[id]'>`).
  Las rutas `/api/admin/prizes/[id]` y `/api/admin/spins/[id]/discard` siguen esa forma.

## D-219: Pruebas de concurrencia y de «no escribe»

- **Concurrencia (SC-026)**: prueba de integración que lanza dos `spin` en paralelo (`Promise.all`) por un
  premio de 1 unidad y exige exactamente un éxito y un `PrizeExhaustedError`; repetida con 2 unidades y 3
  giros. Con `randomInt` inyectable (como en la 001) se fuerza que ambos elijan a la misma persona y se
  comprueba el reintento.
- **Sin repetidos (SC-023)**: prueba que gira 1 000 veces (sin emulador, sobre `pickWinners`) y otra de
  integración con 50 giros reales sobre 60 participantes: ningún id repetido.
- **Práctica sin escrituras (SC-027/FR-090)**: se toma una instantánea de `prizes`, `spins`, `participants` y
  `settings` antes y después de varios giros de práctica y deben ser idénticas.
