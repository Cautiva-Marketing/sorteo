# Quickstart: validar el rediseño minimalista

Guía de ejecución y validación de la feature 002. Parte del entorno de la 001
([quickstart.md](../001-registro-sorteo/quickstart.md)): los requisitos previos (Node 22+, JDK 21+, Chromium
de Playwright, proyecto Firebase de desarrollo) y los scripts `npm run …` son los mismos. Detalle de datos en
[data-model.md](data-model.md) y de endpoints en [contracts/http-api.md](contracts/http-api.md).

## Qué cambia respecto a la 001

- **Ya no hace falta** App Check ni reCAPTCHA Enterprise: no se crea clave de sitio ni se registra la app en
  App Check.
- Variables de entorno: **se eliminan** `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` y `APP_CHECK_ENFORCEMENT` (de
  `.env.local`, `.env.example`, Vercel, Playwright y el script de Lighthouse). El resto no cambia.
- Dependencia nueva: `npm install` instala `uqr` (QR en el servidor).
- La compilación descarga las fuentes Space Grotesk e Inter la primera vez (necesita red).

## Preparar el entorno

```text
npm install
npm run emulators          # Firestore + Auth locales
npm run dev                # http://localhost:3000   (pantalla del QR)  ·  /registro (formulario)
npm run admin:grant -- <correo> <contraseña>   # solo si aún no hay un administrador
```

## Pruebas automáticas

```text
npm run typecheck          # tsc --noEmit
npm run lint               # ESLint
npm run format:check       # Prettier
npm run test:unit          # esquemas, celular, QR, CSV, sorteo, colores literales
npm run test               # unitarias + integración (emulador)
npm run test:rules         # reglas de Firestore: siguen todo denegado
npm run test:e2e           # Playwright (emuladores)
npm run perf               # Lighthouse móvil sobre /registro y /  (Performance y Accessibility ≥ 90)
```

Pruebas nuevas o modificadas: `tests/unit/schemas.test.ts`, `phone.test.ts`, `qr.test.ts` y `origin.test.ts`;
`tests/integration/registrations.route.test.ts`, `status.route.test.ts` y `legacy-consent.test.ts`;
`tests/e2e/registration.spec.ts`, `duplicate.spec.ts`, `qr-screen.spec.ts` y `design.spec.ts`. Se elimina
`tests/unit/app-check-enforcement.test.ts`. Detalle en [research.md D-112](research.md#d-112-pruebas-rendimiento-y-puertas-de-calidad).

## Escenarios de validación

| # | Escenario | Pasos | Resultado esperado | Spec |
|---|---|---|---|---|
| 1 | Formulario limpio | Abrir `/registro` en 360 px | Logo claro (ícono «ti» + texto negro), título, frase, tarjeta con 3 campos y botón negro «Enviar y participar»; **ninguna** mención de consentimiento, privacidad, finalidad ni reCAPTCHA; sin desplazamiento horizontal | US1-1/2, FR-033/035, SC-014 |
| 2 | Registro sin trámites | Completar datos válidos y enviar | Se guarda sin pedir nada más; el documento `participants/+51…` **no** tiene `consent`; aparece la ventana de bienvenida | US1-3, FR-034 |
| 3 | Validaciones | Enviar vacío; nombre de un solo término; celular `812345678`; empresa de 101 caracteres | Errores en español junto a cada campo; nada se guarda; lo escrito se conserva | US1-4 |
| 4 | Ventana de bienvenida | Tras el escenario 2 | Ícono «ti», «¡Bienvenido(a)!», nombre completo, ticket con el celular completo (`987 654 321`) y «En sorteo», botones «Listo, muchas gracias» y «Registrar a otra persona»; confeti visible | US2-1/2, FR-037/038 |
| 5 | Registrar a otra persona | Pulsar «Registrar a otra persona» | La ventana se cierra y el formulario queda **vacío** con el foco en el primer campo | US2-3, FR-039 |
| 6 | Pantalla final | Pulsar «Listo, muchas gracias» (o Escape) | Aviso de agradecimiento con el logo; sin datos de la persona anterior | US2-4 |
| 7 | Movimiento reducido | Activar «reducir movimiento» en el sistema y registrar | Ventana sin confeti ni animaciones | US2-5, FR-041 |
| 8 | Duplicado | Repetir con `+51 987-654-321` | Ventana de «ya estás participando», sin datos del registro existente, con «Registrar a otra persona»; sigue habiendo 1 documento | US2-6, FR-040 |
| 9 | Nombre largo | Registrar un nombre de 100 caracteres | El nombre se ajusta en varias líneas dentro de la ventana, sin desbordar | US2-7 |
| 10 | Teclado y lector | Con la ventana abierta usar Tab y Escape | El foco no sale de la ventana; Escape la cierra; el contenido se anuncia | US2-8, FR-041 |
| 11 | Pantalla del QR | Abrir `/` en un monitor grande y en un celular | **Una sola columna** en ambos: logo, título, frase, tarjeta con el QR (ícono «ti» al centro) y el contador, y el botón «Registrarme desde este dispositivo» debajo; **no** aparece el formulario; sin desbordes | US3-1/9, FR-042/046 |
| 12 | Escaneo | Abrir `/` en una pantalla de 40 pulgadas Full HD (1920×1080), comprobar que el símbolo del QR mide ≥ 21 cm de lado (≈ 450 px) y que toda la página cabe sin desplazarse, y escanearlo con un celular a ~2 m, 10 intentos | Abre `/registro`; ≥ 9 de 10 escaneos a la primera | US3-2/7, FR-046, SC-016 |
| 13 | Contador en vivo | Con `/` abierto, registrar a alguien desde otro dispositivo | El número sube en ≤ 5 s sin recargar; «0 registrados», «1 registrado», «N registrados» | US3-3/4, SC-015 |
| 14 | Contador anónimo | `GET /api/status` sin sesión | `{ "open": …, "count": … }` y nada más; sin nombres ni celulares | US3-5, FR-044 |
| 15 | Inscripciones cerradas | Cerrar desde `/admin/campana` con `/` y `/registro` abiertos | `/` cambia (≤ 5 s) el QR y el botón por el aviso de cierre y conserva el contador; `/registro` muestra el aviso; un envío pendiente responde 403 `REGISTRATION_CLOSED` | US1-7, US3-6, FR-045 |
| 16 | Enlace antiguo | Abrir `/privacidad` y abrir `/` en un celular desde un QR impreso | `/privacidad` → 404; `/` muestra la pantalla del QR con el botón | US1-5, FR-047 |
| 17 | Sin conexión en la pantalla proyectada | Cortar la red con `/` abierta y restablecerla | El contador conserva el último valor sin errores y se actualiza al volver | Edge case |
| 18 | Tipografía y color | Inspeccionar `/`, `/registro` y el panel | Títulos en Space Grotesk, texto en Inter; fondo blanco, texto negro, azul solo en foco/punto del contador/ícono del ticket; `grep` de colores literales en `src/` (salvo `globals.css`) vacío | FR-048/050/051, SC-018 |
| 19 | Contraste | Revisar contraste en todas las pantallas (Lighthouse/axe) | 100 % del texto ≥ 4,5:1 (3:1 en texto grande y bordes de campos) | FR-036, SC-017 |
| 20 | Panel con el mismo estilo | Iniciar sesión y recorrer participantes, búsqueda, exportar, sorteo, campaña y borrado | Mismo estilo; todas las funciones se comportan como en la 001 (ver sus escenarios 6–11, 14 y 15) | US4, SC-020 |
| 21 | Rendimiento | `npm run perf` | `/registro` y `/` ≥ 90 en Performance y Accessibility; formulario listo en < 3 s en 4G lento | SC-019 |
| 22 | Reglas | `npm run test:rules` | Todo sigue denegado para anónimo y para `admin` desde el cliente | Constitución III |
| 24 | Volver a la pantalla principal | En `/registro` pulsar «Volver a la pantalla principal» (bajo «Enviar y participar»); repetir tras «Listo, muchas gracias» y con las inscripciones cerradas | Lleva a `/` (pantalla del QR) en los tres casos; el enlace se alcanza con el teclado | US1-8, FR-053 |
| 23 | Registro sin verificación | `POST /api/registrations` sin cabecera de App Check y con cuerpo válido | 201 (y 409 al repetir); ya no existe 401 `APP_CHECK_FAILED` | FR-034 |

## Despliegue (Vercel)

1. Quitar `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` y `APP_CHECK_ENFORCEMENT` de las variables de entorno de Preview y
   Production (el servidor ya no las lee).
2. Desplegar; las reglas de Firestore no cambian (`firebase deploy --only firestore:rules` solo si hubiera
   cambios de otras ramas).
3. Verificar con los escenarios 2, 11, 12, 13 y 15 sobre la URL desplegada; el QR de `/` ya apunta al
   dominio desde el que se abra la pantalla.
4. Para los QR impresos que se difundan por otro medio, apuntarlos a `<dominio>/registro`.
5. Opcional, cuando todo funcione: eliminar la clave de reCAPTCHA Enterprise y desactivar App Check en la
   consola de Firebase.
