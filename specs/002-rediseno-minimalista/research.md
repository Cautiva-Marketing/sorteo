# Research: Rediseño minimalista y simplificación del registro

Resuelve los puntos abiertos del Technical Context de [plan.md](plan.md). No quedan
`NEEDS CLARIFICATION`. Se numera desde D-101 para no chocar con las decisiones D-001…D-014 de la
feature 001 ([research.md](../001-registro-sorteo/research.md)), que siguen vigentes salvo donde se indica
(D-005 App Check y la parte de consentimiento de D-010 quedan **sustituidas**; D-009 queda sustituida por
D-104).

Notas de versión: este proyecto usa Next.js 16 (el `AGENTS.md` advierte cambios incompatibles). Antes de
escribir código se leyeron las guías de `node_modules/next/dist/docs/` sobre fuentes
(`01-app/01-getting-started/13-fonts.md`), `headers()` (asíncrona) y Route Handlers.

## D-101: Rutas: `/` es la pantalla del QR y `/registro` es el formulario

- **Decision**: `/` muestra siempre la pantalla del QR con el contador; el formulario vive en `/registro`.
  El QR y el botón «Registrarme desde este dispositivo» apuntan a `/registro`. `/` nunca renderiza el
  formulario (FR-047). Con las inscripciones cerradas, ambas páginas muestran el aviso de cierre.
- **Rationale**: es la respuesta A de la clarificación y reproduce el ejemplo (raíz = QR; formulario aparte).
  Una dirección propia para el formulario permite compartir un enlace directo y probar cada pantalla por
  separado.
- **Alternatives considered**: formulario en `/` y QR en otra ruta (rechazada por el usuario); decidir según
  el tamaño de pantalla (frágil: un celular horizontal o una tablet cambiarían de pantalla).
- **Efecto**: la URL del QR se construye en el servidor con el host de la petición (`headers()`,
  asíncrona en Next 16) y `x-forwarded-proto`; así el QR siempre refleja el dominio desde el que se abrió la
  pantalla. Cualquier QR impreso con la dirección antigua (`/`) cae en la pantalla del QR, que ofrece el
  botón (caso borde del spec).
- **Origen validado y sin valor de respaldo**: `lib/origin.ts` (`buildOrigin`) toma el primer valor de
  `x-forwarded-host` y luego `host`, y usa el primero que sea un nombre de host válido (letras, dígitos, `.`,
  `-` y puerto opcional; se rechazan `/`, `@`, `?`, `#`, espacios; sin IPv6). El protocolo es el primer valor
  válido (`http`/`https`) de `x-forwarded-proto` o, si falta, `http` para `localhost`/`127.0.0.1` y `https`
  para el resto. **No hay origen por omisión**: si ningún encabezado es válido, devuelve `null`, el QR no se
  dibuja y la pantalla muestra un aviso con el botón de registro (así un fallo no genera un QR que apunte
  a `localhost` en producción).

## D-102: Quitar consentimiento y política de privacidad por completo

- **Decision**: se eliminan `src/lib/consent.ts`, `ConsentField`, `CheckboxField`, la ruta `/privacidad`, los
  campos `consent` y `consentVersion` del esquema Zod y del cuerpo de `POST /api/registrations`, el mapa
  `consent` de los documentos nuevos, y el código de error `CONSENT_VERSION_MISMATCH`. La constitución v2.0.0
  lo permite expresamente (principio IV).
- **Rationale**: el spec exige que ninguna pantalla pública muestre nada de esto (FR-033) y que el registro
  se acepte con solo tres campos (FR-034).
- **Datos existentes**: no hay migración. Los documentos creados antes con `consent` siguen siendo válidos:
  ningún código lee ese campo (el listado y el CSV ya no lo exponían) y el borrado definitivo elimina el
  documento completo. Un enlace antiguo a `/privacidad` devuelve la página 404 estándar de Next.
- **Alternatives considered**: ocultar el casillero y conservar la evidencia en silencio (guardaría un dato
  que el spec dice que ya no existe); script de limpieza (innecesario: no hay datos reales, ver Assumptions).

## D-103: Quitar App Check y reCAPTCHA de extremo a extremo; sin anti-spam

- **Decision**: se eliminan `app-check.service.ts`, `firebase/app-check-client.ts`, `instrumentation.ts`
  (su único cometido era `assertAppCheckConfig`), `getAdminAppCheck()` de `firebase/admin.ts`, el encabezado
  `X-Firebase-AppCheck`, el código de error `APP_CHECK_FAILED`, el estilo `.grecaptcha-badge`, la
  atribución de reCAPTCHA del pie y las variables `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` y
  `APP_CHECK_ENFORCEMENT` (`.env.example`, `playwright.config.ts`, `scripts/lighthouse.mjs`, helpers de
  pruebas y CI si las citan). El paquete `firebase` se mantiene porque el panel usa `firebase/auth`.
- **Rationale**: decisión de la empresa (clarificación) y permitido por la constitución v2.0.0, que deja de
  exigir anti-automatización. Se conserva todo lo demás del principio III: validación del servidor, unicidad
  por celular como ID de documento, transacción que respeta el cierre, reglas `deny all`.
- **Se conserva** la comprobación de `Origin` (`assertSameOrigin`): no es una verificación anti-bot sino la
  defensa contra envíos desde otros sitios web, y no añade pasos al participante.
  Sin `Origin` (peticiones que no vienen de un navegador) la comprobación deja pasar, igual que hoy; el
  comentario de `assertSameOrigin` en `src/lib/http.ts`, que dice que ahí «la protección real recae en App
  Check», debe reescribirse al implementar porque dejará de ser cierto.
- **Riesgo aceptado**: un script puede crear registros falsos. Si más adelante hiciera falta, una regla de
  límite de peticiones en el firewall de Vercel lo cubre **sin cambiar código**; no se implementa ahora
  (YAGNI y decisión explícita de no tener anti-spam).
- **Alternatives considered**: límite propio por IP (necesitaría estado compartido entre instancias
  serverless: infraestructura extra que el usuario descartó).

## D-104: Design tokens: blanco y negro con acento azul

Se sustituye D-009. Fuente de color: logo de Cautiva (`#0A70BB` en el ícono, `#3D8CD3` en los acentos del
logotipo) y negro de cautivamarketing.com (`#0A0A0A`). El lima y el crema de esa web **no** se usan
(decisión del usuario). Contrastes calculados con la fórmula de WCAG sobre `#FFFFFF`:

| Token (`@theme`) | Valor | Uso | Contraste verificado |
|---|---|---|---|
| `--color-paper` | `#ffffff` | fondo de página y tarjetas | — |
| `--color-paper-soft` | `#f5f5f5` | hover y fondos secundarios | `ink-900` 18,2:1; `ink-600` 7,2:1 |
| `--color-ink-900` | `#0a0a0a` | texto principal y botón primario | 19,8:1 sobre blanco; blanco sobre `ink-900` 19,8:1 |
| `--color-ink-600` | `#525252` | texto secundario, hover del botón | 7,8:1 sobre blanco |
| `--color-ink-500` | `#737373` | marcador de posición e íconos | 4,7:1 sobre blanco (cumple texto normal) |
| `--color-ink-300` | `#8c8c8c` | borde de campos y controles | 3,4:1 (≥ 3:1 exigido a componentes) |
| `--color-line` | `#e5e5e5` | bordes decorativos de tarjetas y separadores | decorativo, no identifica controles |
| `--color-accent-600` | `#0a70bb` | foco, enlaces, ícono del ticket | 5,2:1 sobre blanco y 4,8:1 sobre `paper-soft`: **sirve para texto** |
| `--color-accent-500` | `#3d8cd3` | punto del contador y adornos | 3,6:1: **solo elementos no textuales** |
| `--color-danger-700` | `#b42318` | errores | 6,6:1 |
| `--color-success-700` | `#067647` | estados correctos | 5,7:1 |

Migración de clases (mecánica, por componente):

| Clase actual | Pasa a | Nota |
|---|---|---|
| `bg-brand-50` (fondo de página) | `bg-paper` | |
| `bg-brand-600 text-white hover:bg-brand-700` (botón primario) | `bg-ink-900 text-paper hover:bg-ink-600` | texto en mayúsculas, `tracking-wider` |
| `border-brand-700 text-brand-700 hover:bg-brand-100` (secundario) | `border-ink-300 text-ink-900 hover:bg-paper-soft` | |
| `text-brand-700` (enlaces y títulos de aviso) | `text-accent-600` (enlaces) / `text-ink-900` (títulos) | |
| `outline-brand-500` (foco) | `outline-accent-600` | |
| `bg-ink-900` de cabecera con logo blanco | `bg-paper` con borde inferior `border-line` | el logo pasa a la versión clara |
| `border-ink-600` (campos) | `border-ink-300` | |

La prueba `tests/unit/no-hardcoded-colors.test.ts` se mantiene: solo `globals.css` puede tener colores
literales. Los tokens viejos `brand-*` se eliminan para que `tsc`/ESLint/`grep` detecten usos olvidados.

## D-105: Tipografía con `next/font/google`

- **Decision**: `Space Grotesk` (títulos) e `Inter` (texto) cargadas con `next/font/google` en
  `app/layout.tsx`, `subsets: ["latin"]`, `display: "swap"`, con variables CSS `--font-space-grotesk` y
  `--font-inter`; en `globals.css`, `@theme inline { --font-display: …; --font-sans: …; }` para exponerlas como
  clases `font-display` y `font-sans` de Tailwind, con familias genéricas de respaldo.
- **Rationale**: son las fuentes de cautivamarketing.com (`font-display` = Space Grotesk, `font-sans` = Inter).
  `next/font` las autoaloja en el mismo dominio, sin peticiones a Google desde el navegador, precarga lo
  necesario y ajusta la fuente de respaldo para evitar saltos de diseño. No agrega dependencias.
- **Pesos**: ambas son fuentes variables, así que no hace falta listar pesos; se usan 500–700 en títulos
  (la web usa `font-black`, que no carga en su propia hoja: se omite 900) y 400–600 en texto.
- **Riesgo**: la compilación necesita red para descargar las fuentes la primera vez (Vercel y CI la tienen).
  Si algún entorno estuviera sin red, se cambia a `next/font/local` con los `.woff2` en el repo (misma API).
- **Alternatives considered**: `<link>` a Google Fonts (petición de terceros que penaliza Lighthouse y
  privacidad); paquetes `@fontsource-*` (dependencia nueva sin necesidad).

## D-106: Logo para fondo claro

- **Hallazgo**: `logo.svg` es solo el **logotipo de texto** («cautiva marketing»): 15 trazados blancos y 4
  azules `#3d8cd3`; **no** incluye el ícono «ti». Sobre fondo blanco, el texto desaparece.
- **Decision**: el logo en pantalla es un componente `Logo` que compone, dentro de un `<span role="img"
  aria-label="Cautiva Marketing">`, el ícono `public/icono-ti.webp` (mancha azul con «ti») y el logotipo
  `public/logo-claro.svg` (copia de `logo.svg` con el relleno blanco cambiado por `#0a0a0a`). Un modo
  `variant="icon"` muestra solo el ícono (centro del QR y ventana de bienvenida). Ambos con `width`/`height`
  explícitos para no provocar saltos de diseño.
- **Origen del ícono**: `https://cautivamarketing.com/img/Icono%20lLogo%20Cautiva%20Marketing%20-%20Agencia%20de%20marketing.webp`
  (1309×1143 px, 26 KB). Al implementar se reduce a ≤ 400 px de ancho (< 10 KB) y se comprueba a ojo contra la
  captura de referencia. Si la empresa entrega una versión oficial para fondo claro, reemplaza a este
  derivado sin tocar el código (mismos nombres de archivo).
- **Se elimina** `public/logo.svg` para que nadie use por error la versión blanca sobre fondo blanco; el
  `logo.svg` de la raíz queda como fuente. Los archivos estáticos de `public/` no entran en la prueba de
  colores (solo revisa `src/`); se añaden a `.prettierignore` como el actual.
- **Alternatives considered**: vectorizar el ícono (trabajo de diseño fuera de alcance; el ícono es una
  imagen fija); usar el logo completo de la web (texto blanco, solo sirve sobre fondo oscuro).

## D-107: QR generado en el servidor con `uqr`

- **Decision**: dependencia nueva **`uqr` 0.1.3** (MIT, sin dependencias, ~79 KB de paquete, API
  `encode(texto, { ecc: "H", border: 0 })` → matriz de booleanos). `lib/qr.ts` convierte la matriz en una
  ruta SVG compacta (una sola `<path>` con tramos horizontales por fila) y calcula la zona central del
  ícono; `components/qr/QrCode.tsx` (Server Component) dibuja el `<svg>` con `fill="currentColor"` y el ícono
  «ti» en un recuadro blanco al centro. Corrección de errores **H (30 %)**; el ícono ocupa ≤ 20 % del lado
  (≈ 4 % del área) y los módulos bajo el recuadro no se dibujan. Zona de silencio de 4 módulos.
- **Justificación (principio VI)**: generar un QR exige codificación y corrección de errores Reed–Solomon;
  escribirlo a mano es costoso y propenso a errores. `uqr` es la opción más pequeña y se ejecuta solo en el
  servidor, así que **no suma JavaScript al cliente**.
- **Rationale**: el ejemplo usa `qr-code-styling` (cliente, ~100 KB) y `qrcode.react`; ambas obligarían a
  hidratar el QR en el navegador. Con `uqr` el QR llega en el HTML inicial, es legible para Lighthouse y no
  parpadea. Módulos cuadrados (no redondeados) por máxima legibilidad a 3 m (SC-016).
- **Alternatives considered**: `qrcode.react` (cliente, 115 KB sin empaquetar); `qrcode` (arrastra 3
  dependencias y genera PNG/terminal que no necesitamos).
- **Prueba**: la matriz y la zona del ícono se verifican en pruebas unitarias; la legibilidad real
  («9 de 10 escaneos a 3 m») es una comprobación manual en el quickstart.

## D-108: Contador en vivo con sondeo de un endpoint público

- **Decision**: `GET /api/status` (Route Handler, `dynamic = "force-dynamic"`, `Cache-Control: no-store`)
  devuelve `{ "open": boolean, "count": number }`. Lo implementa `public-status.service.ts`, que combina
  `getRegistrationStatus()` y `countParticipants()` (agregación `count()`, ya existente) y los memoriza **1 s
  por instancia** (con la promesa en curso compartida) para que ráfagas de peticiones no multipliquen
  lecturas. El cliente (`LiveRegistrationPanel`) consulta cada **3 s** con `fetch`, se pausa cuando la
  pestaña está oculta (`document.visibilityState`), consulta de inmediato al volver, y ante un fallo conserva
  el último valor sin mostrar errores (caso borde del spec).
- **Rationale**: la constitución prohíbe el acceso directo a Firestore desde el navegador (reglas `deny
  all`), así que un `onSnapshot` en cliente queda descartado. Sondeo de 3 s + petición < 1 s ⇒ el cambio
  aparece en ≤ 4–5 s (SC-015) y el cierre de inscripciones también (el mismo endpoint trae `open`). Costo:
  2 lecturas por consulta (`settings/registration` + `count()` ≈ 1 lectura por cada 1 000 documentos) ⇒ ≈ 2 400
  lecturas por hora de pantalla abierta, muy por debajo de la cuota gratuita diaria.
- **Alternatives considered**: SSE/WebSockets (conexiones largas en serverless, más complejidad); `revalidate`
  en CDN (retrasa la actualización y complica el cierre inmediato); Firestore en el cliente (viola III).
- **Privacidad**: el endpoint solo devuelve un booleano y un entero (FR-044); no acepta parámetros.

## D-109: Ventana de bienvenida, confeti y registro asistido

- **Decision**: se reutiliza `Dialog` (`<dialog>` nativo con `showModal()`: foco contenido, resto de la página
  inerte, cierre con Escape) y se le añade una propiedad opcional `icon` que se dibuja sobre el título.
  `WelcomeDialog` muestra el ícono «ti», «¡Bienvenido(a)!», el nombre completo, el texto de que ya está
  participando y una tarjeta de ticket (celular completo con formato `987 654 321` y estado «En sorteo» con
  ícono de verificación), más los botones **«Listo, muchas gracias»** (cierra y muestra `ThanksPanel`) y
  **«Registrar a otra persona»** (cierra, llama a `reset()` de React Hook Form y devuelve el foco al primer
  campo). Escape equivale a «Listo». `AlreadyRegisteredDialog` usa el mismo diseño, sin ticket.
- **Datos de la ventana**: salen de los valores ya validados que tiene el cliente (`fullName` normalizado y
  `phone` en E.164 → `formatNationalPhone`); el servidor no devuelve datos del participante (la respuesta
  201 no cambia). El celular completo solo existe en esa ventana (supuesto del spec).
- **Confeti**: `Confetti.tsx` renderiza ~28 piezas CSS (`position: fixed; inset: 0; pointer-events: none`) en
  negro y blanco con posición, retardo y giro derivados del índice (sin `Math.random` en el render, para
  cumplir las reglas de pureza de React y evitar diferencias de hidratación), animadas con `@keyframes` en
  `globals.css`. Usa `motion-reduce:hidden` además de la regla global de `prefers-reduced-motion`, de modo que
  con movimiento reducido **no se muestra** (FR-041). Como el `<dialog>` está en la capa superior, el confeti
  va dentro del diálogo con `overflow-visible` para pintarse sobre el fondo oscurecido.
- **Alternatives considered**: `canvas-confetti` (dependencia nueva para un adorno); modal propio con
  `role="dialog"` (repite lo que ya resuelve `<dialog>` y su gestión de foco).

## D-110: Estados del formulario

```text
form ──envío válido──► (201) welcome ──«Registrar a otra persona»──► form (vacío)
  │                              └─────«Listo» o Escape──────────► thanks
  ├─ 409 ALREADY_REGISTERED ──► already ──«Registrar a otra persona»──► form (vacío)
  │                                    └───────«Listo» o Escape──────► thanks
  ├─ 403 REGISTRATION_CLOSED ──► closed (aviso, sin formulario)
  └─ 400 / red / 500 ──► el formulario sigue visible con el error junto al campo o una alerta
```

`thanks` y `closed` reemplazan al formulario; el foco se mueve al aviso (como en la 001). La protección contra
el doble envío (`submitting` + botón deshabilitado) se mantiene.

## D-111: Panel de administración con los mismos tokens

- **Decision**: el restyling del panel se hace casi por completo con los tokens de D-104 y la tabla de
  migración de clases (los componentes ya usaban clases de token). Cambios estructurales mínimos: la cabecera
  deja de ser una franja oscura (`bg-ink-900`) y pasa a fondo blanco con el `Logo` claro y un borde inferior;
  la navegación marca la sección activa con subrayado (`border-b-2 border-ink-900`) en lugar de un fondo
  azul; títulos en `font-display`. No se cambia ninguna lógica, ruta ni contrato (SC-020).
- **Rationale**: cumple FR-052 con el menor riesgo de regresión en funciones que la 001 ya probó.

## D-115: Pantalla del QR en una sola columna (reemplaza la rejilla de dos columnas)

- **Decision**: la home va en **una sola columna en todos los tamaños**, como el ejemplo: logo → título →
  frase → tarjeta (QR + separador + contador) → botón → pie. El título y la frase los renderiza la página; el
  panel de cliente solo recibe `qr` y `action`. Con inscripciones cerradas, el aviso reemplaza a la tarjeta y
  al botón y el contador queda debajo.
- **Tamaño del QR**: `max-w-[min(100%,max(16rem,calc(100dvh-28rem)))]`: 28 rem ≈ 448 px es lo que ocupa todo lo
  que no es el QR (logo, título, frase, relleno de la tarjeta, contador, botón, pie), así que a 1080 p el SVG
  mide ≈ 630 px y el símbolo ≈ 500 px (≈ 23 cm en 40″); a 768 p, ≈ 320 px; nunca baja de 16 rem.
- **Consecuencia aceptada por el usuario**: el QR es más pequeño que con dos columnas (símbolo ≈ 500 px en
  lugar de ≈ 690 px). La referencia de la spec pasa de 30 cm / 3 m a **21 cm (≈ 450 px) / 2 m** (regla práctica
  de 10 veces el lado). Se prefirió esto a permitir desplazamiento, que en un proyector esconde el botón.
- **Alternatives considered**: dos columnas solo en pantallas anchas (era el diseño anterior; descartado por el
  usuario); permitir scroll para mantener ≥ 650 px (descartado: la pantalla proyectada no debe desplazarse).

## D-116: Enlace «Volver a la pantalla principal»

- **Decision**: componente `BackToHomeLink` (`next/link` a `/`, texto gris pequeño con flecha ←, objetivo
  táctil ≥ 44 px, foco con el azul del logo). Se muestra bajo el botón de envío dentro de la tarjeta (como el
  ejemplo) y bajo `ThanksPanel` y `ClosedNotice` en `/registro` (el aviso de cerradas lo renderiza el servidor).
  Las ventanas de bienvenida y de «ya estás participando» no lo llevan: tienen sus propios botones.
- **Rationale**: nadie queda sin salida en `/registro`; el contraste de `ink-600` sobre blanco es 7,8:1.

## D-112: Pruebas, rendimiento y puertas de calidad

- **Unitarias**: `schemas.test.ts` (sin `consent`/`consentVersion`; el resto de reglas igual), `phone.test.ts`
  (`formatNationalPhone`), `qr.test.ts` nuevo (tamaño de matriz, nivel H, zona de silencio, recuadro del ícono
  ≤ 20 % del lado, ruta SVG determinista), `origin.test.ts` nuevo (`buildOrigin`: encabezados válidos e
  inválidos, varios valores, protocolo, `null` sin valor de respaldo). Se elimina
  `app-check-enforcement.test.ts`.
- **Integración** (emulador): `registrations.route.test.ts` sin App Check ni consentimiento (éxito, duplicado,
  cerrado, datos inválidos, `Origin` ajeno), `status.route.test.ts` nuevo (`open`/`count`, cambia al registrar
  y al cerrar, respuesta sin datos personales), `legacy-consent.test.ts` nuevo (un documento anterior que aún
  trae `consent` sigue apareciendo en el listado y el CSV, puede ganar el sorteo y el borrado lo elimina, sin
  exponer `consent`), `helpers.ts` y `tests/e2e/helpers/emulators.ts` dejan de sembrar `consent`.
- **E2E** (Playwright): `registration.spec.ts` en `/registro` (tres campos, ninguna mención de
  consentimiento/privacidad/reCAPTCHA, botón «Enviar y participar», ventana de bienvenida con nombre y celular
  completos, «Registrar a otra persona» vacía el formulario, «Listo» muestra la pantalla final, errores junto
  a los campos), `duplicate.spec.ts` (ventana de «ya estás participando»), `qr-screen.spec.ts` nuevo (QR y
  contador visibles en `/`, `/` no muestra formulario, el botón lleva a `/registro`, el contador sube tras un
  registro sin recargar **en ≤ 5 s** (el límite de SC-015, sin ampliar), con inscripciones cerradas el QR
  cambia por el aviso también en ≤ 5 s, `/privacidad` da 404), verificación de que no hay desplazamiento
  horizontal a 360 px y de que a 1920×1080 y a 1366×768 la pantalla cabe sin desplazarse y a 1920×1080 el símbolo del QR mide al menos 650 px (referencia de SC-016). Los E2E del panel
  (`admin-access`, `draw`, `export`, `purge`) se mantienen y solo se ajustan en lo que dependa del logo o del
  sembrado.
- **Rendimiento**: `scripts/lighthouse.mjs` audita `/registro` **y** `/` (móvil, ≥ 90 en Performance y
  Accessibility) y deja de configurar App Check.
- **Accesibilidad**: se comprueban contrastes con los valores de D-104 y la ventana con teclado
  (Tab atrapado, Escape cierra); la accesibilidad automática la cubre Lighthouse.

## D-113: Dependencias

| Dependencia | Tipo | Justificación (principio VI) |
|---|---|---|
| `uqr` 0.1.3 | prod (nueva) | Genera la matriz del QR en el servidor; escribir la codificación y la corrección de errores a mano no es razonable. Ver D-107. |

Sin otras altas. No se agregan librerías de confeti, de animación, de modales ni de fuentes (`next/font` está
incluido en Next). Con la salida de App Check desaparece el uso de `firebase/app-check` y
`firebase-admin/app-check`, pero los paquetes `firebase` y `firebase-admin` se mantienen (Auth y Firestore).
La versión se fija exacta en `package.json`, como el resto.

## D-114: Despliegue y variables de entorno

Sin cambios de plataforma (Vercel, D-013). Se retiran de `.env.example` y de la configuración del entorno
`NEXT_PUBLIC_RECAPTCHA_SITE_KEY` y `APP_CHECK_ENFORCEMENT`; el proyecto de Firebase deja de necesitar App Check
ni la clave de reCAPTCHA Enterprise (se pueden eliminar en la consola cuando la 002 esté desplegada). La URL
pública del QR sale de la petición, así que no hay variable nueva.
