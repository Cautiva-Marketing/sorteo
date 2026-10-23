# Research: Ajustes de registro, pantalla del QR y ruleta

Decisiones técnicas de la feature 004. Cada una indica qué se decidió, por qué y qué se descartó. No quedan
marcadores `NEEDS CLARIFICATION`. Referencias al código tomadas del repositorio en la fecha del plan.

## D-301: Tabla de países propia, sin `libphonenumber`

- **Decisión**: un módulo de datos `src/lib/validation/countries.ts` con los 12 países de Sudamérica. Cada
  entrada: código ISO (`PE`), nombre en español, prefijo (`51`), tipo de regla y un ejemplo para el
  `placeholder`. Dos reglas (clarificación Q1 de la spec):
  - **Estricta** (Perú y Chile): exactamente 9 dígitos y el primero es `9` (`^9\d{8}$`).
  - **Por largo** (los otros 10): cantidad de dígitos dentro de un rango, sin regla de dígito inicial.

  | ISO | País | Prefijo | Dígitos del número local | Prefijo troncal `0` |
  |---|---|---|---|---|
  | `PE` | Perú | 51 | 9, empieza con 9 | no |
  | `CL` | Chile | 56 | 9, empieza con 9 | no |
  | `AR` | Argentina | 54 | 10 (se admite 11 con el `9` móvil, que se descarta) | sí |
  | `BO` | Bolivia | 591 | 8 | no |
  | `BR` | Brasil | 55 | 10–11 | sí |
  | `CO` | Colombia | 57 | 10 | no |
  | `EC` | Ecuador | 593 | 9 | sí |
  | `GY` | Guyana | 592 | 7 | no |
  | `PY` | Paraguay | 595 | 9 | sí |
  | `SR` | Surinam | 597 | 7 | no |
  | `UY` | Uruguay | 598 | 8 | sí |
  | `VE` | Venezuela | 58 | 10 | sí |

  Los largos salen del plan de numeración E.164 de cada país; se confirman con una prueba por país al
  implementar (tarea de verificación, no un riesgo de diseño: la tabla es datos, el algoritmo no cambia).
- **Razón**: la spec fija una validación deliberadamente simple (largo, y dígito inicial solo en PE y CL).
  Una tabla de 12 filas la cumple y es auditable. La constitución VI exige justificar toda dependencia nueva
  y `libphonenumber-js` (incluso la versión `min`) añade decenas de KB al bundle del formulario público,
  que debe mantener Lighthouse ≥ 90, para validar reglas más estrictas que las pedidas.
- **Alternativas**: (a) `libphonenumber-js` — descartada por peso y por exceder lo especificado;
  (b) regex única `\d{7,11}` para todos — descartada: no daría el mensaje por país ni cumpliría FR-094.

## D-302: Normalización a E.164 con prefijo del país; unicidad por número completo

- **Decisión**: el servidor convierte `(país, texto)` en `+{prefijo}{número local}` con estos pasos, en este
  orden: (1) quitar espacios, guiones y paréntesis; (2) si empieza con `+`, el prefijo debe ser el del país
  elegido (si es de otro país → error de validación) y se quita; si no empieza con `+`, se quita el prefijo
  pelado solo cuando el total de dígitos es exactamente `prefijo + largo máximo` del país (conserva la
  tolerancia actual de Perú a `51987654321` sin ambigüedad en los demás; en Argentina también se admite
  `prefijo + 11` por el `9` móvil); (3) en países con prefijo troncal, quitar un `0` inicial; (4) en
  Argentina, si quedan 11 dígitos y el primero es `9`, quitarlo; (5) aplicar la regla del país (D-301) **sobre
  el número ya normalizado**, de modo que Argentina solo acepta exactamente 10 dígitos (un número de 11
  dígitos que no empieza con `9` se rechaza). El resultado `+{prefijo}{local}` es el campo `phone` **y el ID del documento**
  `participants/{phone}`.
- **Razón**: el paso (3) y (4) existen para cumplir FR-095 (unicidad real): sin ellos la misma persona
  podría registrarse como `0981…` y `981…` en Paraguay, o con y sin el `9` móvil en Argentina, y quedar
  duplicada. Usar el E.164 completo como ID hace que el mismo número local en países distintos sean
  documentos distintos sin cambiar nada en `registerParticipant` (la unicidad sigue siendo
  `transaction.create` → `ALREADY_EXISTS`).
- **Compatibilidad (FR-096)**: los documentos existentes ya son `+51XXXXXXXXX`; la nueva normalización de
  Perú produce exactamente el mismo valor, así que un intento de volver a registrarlos choca igual. **No hay
  migración.**
- **Alternativas**: guardar `country` y número local por separado — descartada: duplica datos que el prefijo
  ya determina (los 12 prefijos no se solapan: `51`–`58` frente a `591`–`598`) y obliga a un ID compuesto.

## D-303: Un solo esquema Zod compartido, con `country` y validación a nivel de objeto

- **Decisión**: `registrationSchema` pasa a `{ fullName, country, phone, company, crmInterest }`, con
  `country` = código ISO (por defecto `PE`, así un cliente antiguo que solo envía `phone` sigue
  funcionando) y `crmInterest` booleano (por defecto `false`). La salida normalizada es
  `{ fullName, phone /* E.164 */, company, crmInterest }`. El celular se valida en un `superRefine`/
  transformación **del objeto** (necesita `country` y `phone` a la vez) y asigna el error a la ruta
  `["phone"]`.
- **Detalle a confirmar con la prueba de esquemas**: que, con un nombre inválido y un celular inválido, se
  informen **ambos** errores a la vez (UX del formulario). Si Zod 4 omitiera la validación del objeto por
  haber errores previos, se usa `when` en el `refine` o se valida el celular en un esquema auxiliar. Es un
  detalle de implementación; el contrato (errores por campo en `fieldErrors`) no cambia.
- **Razón**: constitución II — el mismo esquema en cliente (React Hook Form) y servidor.
- **Alternativa**: que el cliente arme el E.164 antes de enviar — descartada: el servidor nunca debe confiar
  en el cliente y aun así tendría que repetir la validación.

## D-304: Selector de país nativo `<select>` junto al campo del número

- **Decisión**: componente `PhoneField` con `<label>` «Celular», un `<select>` con el nombre y el prefijo
  («Perú (+51)») y un `<input type="tel">` para el número local. El `placeholder` del número cambia con el
  país (ejemplo de la tabla). Ambos controles se registran en React Hook Form (`country`, `phone`) y el error
  se anuncia con `aria-describedby`/`aria-live`, como `TextField`. Sin texto de ayuda (FR-098).
- **Razón**: el `<select>` nativo es accesible y usable con teclado y en móviles sin JavaScript extra
  (constitución VI: carga ligera). No se usan banderas emoji: Windows no las dibuja (muestra letras), y el
  proyector/PC de los asistentes puede ser Windows.
- **Alternativas**: lista desplegable personalizada con búsqueda — descartada (YAGNI: son 12 opciones);
  librería de selector de país — descartada (dependencia nueva sin necesidad).

## D-305: Nombre con uno o más términos

- **Decisión**: en `fullNameSchema` la regla pasa de «≥ 2 términos de letras» a «≥ 1 término, todos de solo
  letras (`\p{L}+`), con al menos 2 letras en total»; se mantienen el máximo de 100, la normalización NFC y
  el colapso de espacios. Mensaje: «Ingresa tu nombre usando solo letras, espacios y tildes.» El `placeholder`
  pasa a «Ej. María» y el texto de la etiqueta («Nombres completos») no cambia.
- **Razón**: FR-099/FR-100. El mínimo de 2 letras evita «A» o «x» sin impedir nombres reales cortos («Jo»).
- **Efecto en la ruleta**: ninguno; `abbreviate` y `labelLayout` ya manejan un solo término.

## D-306: Interés en el CRM como booleano `crmInterest`

- **Decisión**: campo `crmInterest: boolean` en `participants/{phone}`. Se escribe en `registerParticipant`
  (junto con los demás campos, dentro de la misma transacción `create`). Los documentos anteriores no lo
  tienen: **ausente = `false`** en toda lectura (`listParticipants`, CSV, filtro). Un registro duplicado no
  escribe nada (el `create` falla), cumpliendo la clarificación Q3.
- **UI pública**: casilla con `<label>` visible y texto «¿Deseas adquirir el CRM con Agente IA?», sin marcar.
  Se envía siempre `true`/`false`.
- **UI del panel**: la tabla suma la columna «CRM» (Sí/No) y un control «Solo interesados en el CRM»
  (casilla) que se combina con la búsqueda por texto y reinicia la paginación; el CSV suma la columna
  «Interesado en CRM» (Sí/No) tras «Empresa u ocupación».
- **Privacidad (constitución IV)**: `crmInterest` no entra en `WheelParticipant`, `SpinResult` ni en el
  snapshot `spins.winner`; por eso no viaja a la ruleta ni a la ventana del ganador (FR-105). El borrado
  definitivo ya elimina el documento completo del participante, así que no requiere cambios.
- **Alternativa**: guardar «Sí»/«No» como texto — descartada: un booleano es más simple de filtrar y validar.

## D-307: Presentación del celular, búsqueda y CSV

- **Decisión**: se reemplazan `toNational` y `formatNationalPhone` (que asumen Perú) por
  `formatPhoneDisplay(value)`, que acepta E.164 **y** el valor antiguo de 9 dígitos (los giros y rondas
  anteriores guardaron `winner.phone` en 9 dígitos; se interpretan como Perú). Salida: `+51 987 654 321`
  (9 dígitos agrupados de 3 en 3; otros largos, sin agrupar: `+57 3001234567`).
  - `listParticipants` devuelve el E.164 completo; la tabla, la ventana de bienvenida y el historial usan
    `formatPhoneDisplay`.
  - **Búsqueda** (`lib/search.ts`): compara los **dígitos** de la consulta con los dígitos del E.164, así
    `987654321`, `51987654321` y `+51 987 654 321` encuentran al mismo participante (se elimina el caso
    especial del prefijo `+51`).
  - **CSV**: el celular sale como `{prefijo} {número local}` sin `+` (por ejemplo `51 987654321`). Un valor
    que empieza con `+` lo tomaría Excel como fórmula y `neutralizeFormula` le antepondría un apóstrofo
    visible; sin `+` y con un espacio se lee como texto, conserva el prefijo (FR-097) y no necesita
    neutralización. La columna se titula «Celular (con código de país)».
  - **Ganadores antiguos** (`byLegacyPhone`, clave de 9 dígitos): el CSV solo los resuelve para
    participantes `+51`, quitando el prefijo.
- **Razón**: FR-097 pide el prefijo en panel, CSV, bienvenida, historial y búsqueda, sin romper los datos
  anteriores.

## D-308: Giro directo; el cierre automático ya es atómico

- **Decisión**: se elimina la ventana de confirmación y todo lo que la sostenía:
  - `DrawStage`: se quitan la fase `confirming`, el `Dialog` «Se cerrarán las inscripciones», el estado
    `closedBySpin` y la prop `registrationOpen` (la página `/admin/sorteo` deja de pasarla).
  - `spins.service.ts`: se quitan `ConfirmationRequiredError`, el parámetro `confirmCloseRegistration` y su
    comprobación. **Se conserva** el cierre dentro de la misma transacción del giro
    (`if (registrationOpen) transaction.set(registrationRef, { open: false, … })`), que ya garantiza que
    las inscripciones solo se cierran si el giro se guardó (FR-107) y vuelve imposible el caso «el giro se
    registró pero el cierre falló».
  - `spinRequestSchema`: queda `{ prizeId }`. Zod descarta claves desconocidas, así que un cliente viejo que
    aún envíe `confirmCloseRegistration` no falla.
  - API: el código `CONFIRMATION_REQUIRED` deja de existir.
  - El modo de práctica (`POST /api/admin/spins/practice`) no escribe nada, así que no cierra inscripciones
    (FR-107).
- **Razón**: FR-106/FR-107 con el menor cambio posible y sin tocar la atomicidad ni la concurrencia que ya
  prueba `spins.test.ts`.

## D-309: Desenfoque del fondo configurable en `Dialog`

- **Decisión**: `Dialog` recibe `blurBackdrop?: boolean` (por defecto `false`). Con `true` aplica
  `backdrop:backdrop-blur-[2px]`; sin él solo oscurece (`backdrop:bg-ink-900/50`). `WelcomeDialog` y
  `AlreadyRegisteredDialog` (formulario público) pasan `blurBackdrop`; las ventanas del panel
  (`WinnerDialog`, `DiscardWinnerButton`, `PrizePanel`, `PurgeDialog`) no pasan nada y quedan sin
  desenfoque. Las clases se escriben como cadenas completas para que Tailwind las detecte.
- **Razón**: FR-116/FR-117 (Q4 de la spec): el panel queda sin el filtro costoso de compositing, que pesa
  sobre una ruleta animada a pantalla completa, y la experiencia pública no cambia. Por defecto «sin
  desenfoque» hace que cualquier ventana nueva del panel nazca liviana.
- **Alternativa**: quitarlo en todas — descartada por decisión del usuario (Q4).

## D-310: Paleta de la «A» en la ruleta

- **Decisión**: tres tokens propios en `globals.css`, tomados de `public/creandovalor.svg`:
  `--color-wheel-purple: #524a99`, `--color-wheel-lavender: #706baf`, `--color-wheel-cyan: #23bcef`.
  Constitución V 2.1.0 los reserva a la ruleta. Reparto (Q2: ruleta completa):

  | Elemento | Color |
  |---|---|
  | Segmentos (ciclo de 3: morado, lavanda, celeste) | `wheel-purple`, `wheel-lavender`, `wheel-cyan` |
  | Texto del segmento | `paper` sobre morado y lavanda; `ink-900` sobre celeste |
  | Aro: banda exterior e interior | `wheel-purple`; filete intermedio `wheel-lavender` |
  | Pines del aro | `wheel-cyan` |
  | Divisores entre segmentos | `paper` (línea fina) |
  | Buje | disco `paper` con aro `wheel-purple` (el isotipo, con degradado morado→celeste, necesita fondo claro) |
  | Puntero | relleno `wheel-purple`, borde `paper` |
  | Letrero del nombre (`DrawStage`) | fondo `wheel-purple`, borde `wheel-cyan`, texto `paper` |
  | Ruleta vacía (0 participantes) | disco `paper` |

  Contraste calculado (WCAG): blanco/morado 7,5:1; blanco/lavanda 4,76:1 (≥ 4,5, AA normal);
  `ink-900`/celeste 8,7:1; blanco/celeste solo 2,2:1 — por eso el texto sobre celeste es oscuro; pines
  celestes/banda morada 3,4:1 (≥ 3, no textual).
- **Cambios en `lib/wheel.ts`**: `PALETTE` pasa de 6 a 3 entradas y `ColorToken` cambia a
  `"wheel-purple" | "wheel-lavender" | "wheel-cyan" | "paper" | "ink-900"`. `segmentColorIndexes` ya
  resuelve la unión último-primero cuando `count % 3 == 1` (reasigna el último a un color distinto del
  anterior y del primero), así que ningún vecino repite color con 3 colores y cualquier cantidad ≥ 3
  (FR-112). `RouletteWheel.readTokens` lee los tokens nuevos; `paintWheel` y `paintOverlay` dejan de usar
  `gold-*`, `ink-300` y `paper-soft`.
- **Fuera de alcance (Q2)**: botones, tarjetas, ventana del ganador y confeti conservan sus colores.
- **Prueba `no-hardcoded-colors`**: sigue vigente; los hex nuevos viven solo en `globals.css`.

## D-311: QR más pequeño y logos más grandes

- **Decisión** (valores de partida, a ajustar a la vista):
  - **QR** (`src/app/page.tsx`): el tope pasa de `max(16rem, 100dvh − 28rem)` a
    `max(14rem, (100dvh − 28rem) × 0,85)` ⇒ −15 % (1366×768: 320→272 px; 1920×1080: 632→537 px; el piso de
    16→14 rem).
  - **Logo Creando Valor** (`Logo size`): 72 → 88 px (+22 %).
  - **Logos aliados** (`PartnerLogos`): alto `h-10 md:h-12` → `h-11 sm:h-12 md:h-15` (≥ 768 px: 48→60 px, +25 %;
    640–767 px: 40→48 px, +20 %; < 640 px: 40→44 px, +10 %). Se actualizan los atributos `width`/`height`
    de las imágenes para no provocar saltos de diseño.
- **Por qué solo +10 % en teléfono**: con 360 px de ancho, dos logos de 48 px de alto más el espacio entre ellos
  (151 + 185 + 40 px) pasan los 328 px útiles y obligarían a partir la fila o a desbordar. A 44 px (139 + 169 +
  16 px) caben en una fila. La spec admite el ajuste a la vista (Assumptions: «los porcentajes son
  aproximados»); el aumento pleno aplica a las pantallas de proyección, que es donde importa.
- **Presupuesto de alto en 1366×768**: el bloque de reserva `28rem` se mantiene; los logos crecen ≈ 28 px
  (16 + 12) y el QR cede 48 px ⇒ queda ≈ 20 px de holgura, así que no hay desplazamiento. Las pruebas E2E
  existentes (`qr-screen.spec.ts`: orden vertical, centrado, sin hueco, «cabe sin desplazarse») lo vigilan.
- **FR-111 (alineado con la spec tras el análisis)**: «sin desplazamiento» significa **sin desplazamiento
  vertical** en 1366×768 y 1920×1080 (pantallas de proyección) y **sin desplazamiento horizontal** a 360 px. A
  360 px de ancho la pantalla puede desplazarse en vertical según el alto del teléfono (con 640 px de alto
  logo + título + QR mínimo + logos no caben) y no es un dispositivo de proyección; este plan no lo cambia.
  Del mismo modo, FR-110/SC-035 aplican el aumento de 20–25 % desde 640 px de ancho (ver arriba).
- **`PartnerLogos` es compartido** con `/registro`: los logos aliados también crecen allí (el logo de cabecera
  de `/registro`, `size 52`, no cambia). Es coherente y evita una variante extra.
- **Escaneo**: el QR mantiene corrección H y el ícono central ≤ 20 % del lado; a 272 px con ≈ 41 módulos son
  ≈ 6,6 px por módulo (antes 7,8), suficiente para escanear desde un teléfono. Se valida con
  `qr-screen.spec.ts` y el paso manual del quickstart.

## D-312: Redes sociales en la tarjeta de gracias

- **Decisión**: `ThanksPanel` (sigue siendo Server Component) añade, bajo el mensaje, el texto «Síguenos en
  nuestras redes sociales» y dos enlaces con ícono de Facebook y el nombre de la marca: «Cautiva Marketing»
  (`https://www.facebook.com/cautivamarketingperu`) y «Satelcom del Sur»
  (`https://www.facebook.com/satelcomdelsur`). Las URL viven en `src/lib/social-links.ts` (constante
  tipada, probada en una prueba unitaria). Cada enlace usa `target="_blank"` y
  `rel="noopener noreferrer"` (FR-115), `min-h-11` (44 px de alto táctil) y foco visible. El ícono es un
  `<svg aria-hidden>` en línea; el nombre accesible es el texto visible. Solo la tarjeta de gracias lleva
  las redes: el aviso de cierre y la ventana «ya registrado» no cambian.
- **Razón**: FR-114/FR-115 sin dependencias (no se usa librería de íconos). Fondo, bordes y texto con
  tokens existentes; sin colores nuevos.

## D-313: Sin dependencias nuevas, reglas de Firestore y variables de entorno sin cambios

- **Decisión**: la feature no agrega paquetes, variables de entorno ni colecciones. Las reglas `deny all` de
  `firestore.rules` no cambian; la prueba de reglas gana un caso con un ID `+56…` para dejar constancia de
  que los nuevos prefijos siguen cubiertos.
- **Razón**: constitución VI (YAGNI y dependencias justificadas).
