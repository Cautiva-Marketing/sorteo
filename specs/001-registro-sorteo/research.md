# Research: Registro y Sorteo

Todas las decisiones de abajo resuelven los puntos abiertos del Technical Context. No quedan
`NEEDS CLARIFICATION`. Versiones tomadas del registro de npm el 2026-10-21; deben fijarse en
`package.json` al hacer el scaffold (comprobando compatibilidad de peers entre Next, ESLint y TypeScript).

## D-001: Route Handlers en lugar de Server Actions

- **Decision**: todas las escrituras y lecturas JSON pasan por Route Handlers (`src/app/api/**`).
- **Rationale**: App Check envía el token en un encabezado (`X-Firebase-AppCheck`), algo natural en un
  `fetch` a un Route Handler y torpe en Server Actions; los códigos HTTP (400/401/403/409) hacen que los
  errores de duplicado y de inscripciones cerradas sean fáciles de probar con Playwright y Vitest; la
  exportación CSV necesita un Route Handler de todas formas. Un solo mecanismo reduce la superficie.
- **Alternatives considered**: Server Actions (el usuario las permitía): más acoplamiento al formulario y
  menos control de encabezados/estados; descartadas por simplicidad y testabilidad.

## D-002: Firestore solo vía Admin SDK; reglas `deny all`

- **Decision**: ningún cliente accede a Firestore. Reglas: `allow read, write: if false` para todo.
- **Rationale**: el Admin SDK ignora las reglas, así que el servidor puede crear el registro, y cualquier
  acceso directo con el SDK web queda bloqueado (cumple y supera el principio III: ni siquiera "crear" se
  permite desde el cliente). La autorización real (admin) vive en el servidor y se cubre con pruebas de
  integración; las reglas se prueban con el emulador para asegurar que nada se pueda leer/escribir.
- **Alternatives considered**: reglas que permiten `create` al participante con validación en reglas:
  obliga a duplicar validaciones, no permite verificar App Check ni la transacción con el estado de
  inscripciones; descartada.

## D-003: Unicidad por celular E.164 como ID del documento

- **Decision**: `participants/{+51XXXXXXXXX}`; la creación usa `transaction.create()`; si el documento ya
  existe Firestore devuelve `ALREADY_EXISTS` → se responde 409 `ALREADY_REGISTERED` sin datos del registro.
- **Rationale**: la unicidad queda garantizada por la base de datos aun con envíos concurrentes (SC-004). Los
  IDs con `+` son válidos en Firestore (solo se prohíben `/`, `.`, `..` y `__.*__`).
- **Alternatives considered**: consulta previa + `add()` (carrera posible); campo único con índice (Firestore
  no tiene restricciones únicas); descartadas.

## D-004: Inscripciones abiertas/cerradas verificadas dentro de la transacción de registro

- **Decision**: documento `settings/registration` (`open: boolean`). El registro lee ese documento y crea el
  participante en la **misma transacción**; si no existe el documento se considera `open: true`. La página `/`
  lee el estado en cada petición (render dinámico) para reflejar el cierre de inmediato (FR-028).
- **Rationale**: elimina la carrera "se cierra justo cuando alguien envía" (edge case del spec) y evita
  caché obsoleta. Costo: 1 lectura por visita (≈5 000 visitas → despreciable frente a la cuota gratuita).
- **Alternatives considered**: caché con `revalidateTag` (más complejidad, sin necesidad con este volumen).

## D-005: Firebase App Check con reCAPTCHA Enterprise y tokens de un solo uso

- **Decision**: el cliente inicializa App Check con `ReCaptchaEnterpriseProvider` y llama a
  `getLimitedUseToken()` en cada envío; el servidor valida con `getAppCheck().verifyToken(token, { consume: true })`
  (protección contra repetición). `APP_CHECK_ENFORCEMENT=off` desactiva la verificación solo en
  desarrollo/pruebas; en producción el servidor se niega a arrancar si está apagada (falla cerrada).
- **Rationale**: App Check es lo que pidió el usuario y cumple el requisito anti-abuso de la constitución. La
  documentación actual de Firebase para web se centra en reCAPTCHA Enterprise (sin desafío visible, sin costo
  hasta 10 000 evaluaciones al mes, suficiente para ≤ 5 000 registros más reintentos). Los tokens de un solo
  uso impiden reutilizar un token capturado.
- **Alternatives considered**: reCAPTCHA v3 (proveedor heredado, menos documentado); rate limiting propio por
  IP (estado compartido entre instancias serverless = infraestructura extra). Si hace falta más defensa, se
  añade una regla de limitación en el firewall de Vercel sin tocar el código.
- **Riesgo y mitigación**: el script de reCAPTCHA es de terceros y penaliza Lighthouse. Se carga de forma
  diferida (`import()` dinámico) al primer foco/interacción con el formulario, nunca en el render inicial; la
  insignia de reCAPTCHA se oculta con CSS y se añade el texto de atribución exigido por Google en el pie.

## D-006: Autenticación del panel con Firebase Auth + cookie de sesión

- **Decision**: `/admin/login` inicia sesión con correo y contraseña (SDK web, solo Auth); el cliente envía el
  `idToken` a `POST /api/admin/session`, que lo verifica (`verifyIdToken`, exigiendo `auth_time` reciente y claim
  `admin === true`) y crea una cookie de sesión (`createSessionCookie`, 8 h) `httpOnly`, `Secure`, `SameSite=Strict`.
  Toda página/endpoint admin llama a `requireAdmin()` → `verifySessionCookie(cookie, true)` + claim `admin`.
  Las cuentas las crea el equipo técnico con `scripts/grant-admin.ts` (custom claim); no hay autoregistro.
- **Rationale**: la cookie de sesión del Admin SDK es el patrón oficial para SSR; el claim impide que un usuario
  Firebase cualquiera entre; verificar en cada petición del servidor cumple "no basta con ocultar rutas".
- **Alternatives considered**: solo `proxy`/middleware para proteger (no es frontera de seguridad suficiente);
  Auth.js/NextAuth (dependencia extra sin beneficio). Los mutadores admin además comprueban el encabezado
  `Origin` (defensa adicional a `SameSite=Strict`).

## D-007: Lista, búsqueda y paginación del panel en cliente sobre una carga única

- **Decision**: la página `/admin` (Server Component) lee los participantes una vez (≤ 5 000 documentos,
  ordenados por `createdAt desc`) y los pasa a `ParticipantsTable`, que filtra y pagina (50 por página) en el
  navegador con normalización sin tildes/mayúsculas. El conteo total usa agregación `count()`. Un botón
  "Actualizar" vuelve a cargar.
- **Rationale**: Firestore no ofrece búsqueda por subcadena; con ≤ 5 000 filas (~0,5 MB) el filtrado local es
  instantáneo (SC-010) y evita un servicio de búsqueda externo. Costo: ≈5 000 lecturas por carga, aceptable.
- **Alternatives considered**: consultas por prefijo (no cubren subcadenas ni tildes); Algolia/Typesense
  (dependencia y costo injustificados, YAGNI).

## D-008: Sorteo: selección con `crypto` y asignación transaccional

- **Decision**: elegibles = `participants` con `drawId == null`. El servidor lista los IDs elegibles, elige N con
  Fisher-Yates parcial usando `crypto.randomInt` (RNG inyectable para pruebas) y en una transacción relee los N
  elegidos, verifica que sigan con `drawId == null`, les asigna `drawId` y crea `draws/{id}` con la copia de los
  ganadores. Si algún ganador cambió (sorteo concurrente), reintenta (máx. 3) y si no, responde 409.
  Si ya existen sorteos, el cliente debe enviar `confirmExisting: true` (409 `CONFIRMATION_REQUIRED` si falta).
- **Rationale**: aleatoriedad criptográfica, sin repetidos (FR-020/023), seguro ante dos administradores a la vez.
  La animación es solo visual (CSS, respeta `prefers-reduced-motion`): el resultado ya viene decidido del
  servidor (FR-021), sin dependencias de animación.
- **Alternatives considered**: `Math.random` (no auditable); lock distribuido (innecesario).

## D-009: Design tokens extraídos del logo

`logo.svg` contiene exactamente dos colores: `#3d8cd3` (acentos azules: puntos de la "i" y la "t") y `#ffffff`
(resto del logotipo). Se derivan los demás mezclando el azul con negro/blanco (sRGB). Contrastes calculados
(WCAG, relación de luminancia):

| Token (`@theme`) | Valor | Uso | Contraste verificado |
|---|---|---|---|
| `--color-brand-500` | `#3d8cd3` | Color de marca (logo), adornos, foco | 4,85:1 sobre `ink-900`; 3,57:1 sobre blanco → **no** para texto normal |
| `--color-brand-600` | `#3170a9` | Fondo de botón primario | texto blanco 5,22:1 |
| `--color-brand-700` | `#2b6294` | Enlaces y texto de marca sobre claro | 6,41:1 sobre blanco; 5,77:1 sobre `brand-50` |
| `--color-brand-50` / `-100` / `-200` | `#ecf4fb` / `#d8e8f6` / `#b1d1ed` | Fondos claros, bordes | — |
| `--color-ink-900` | `#0c1c2a` | Fondo oscuro donde va el logo y encabezados | blanco 17,28:1; azul de marca 4,85:1; texto sobre `brand-50` 15,55:1 |
| `--color-ink-600` | `#4a5b6b` | Texto secundario | 7,00:1 sobre blanco; 6,30:1 sobre `brand-50` |
| `--color-danger-700` | `#b42318` | Errores | 6,57:1 sobre blanco; 5,92:1 sobre `brand-50` |
| `--color-success-700` | `#067647` | Confirmaciones | 5,69:1 sobre blanco; 5,12:1 sobre `brand-50` |

El logo se muestra solo sobre `ink-900` (constitución V). Los estados rojo/verde no vienen del logo; son tokens
derivados que cumplen AA. Los componentes usan únicamente clases de tokens (`bg-brand-600`, `text-ink-900`…).

## D-010: Teléfono, nombres y empresa — reglas de validación únicas

- **Celular**: quitar espacios, guiones y paréntesis; aceptar prefijo `+51` o `51` solo si el resto son 9
  dígitos; exigir `^9\d{8}$`; guardar como `+51` + 9 dígitos (ID del documento). Mostrar y exportar en formato
  nacional de 9 dígitos.
- **Nombres**: normalizar a NFC, recortar y colapsar espacios; exigir ≥ 2 términos, cada uno `^\p{L}+$`
  (letras Unicode, incluye tildes, ñ, ü), máx. 100 caracteres. Se guarda con la capitalización ingresada.
- **Empresa/ocupación**: recortar y colapsar espacios; 2–100 caracteres; sin caracteres de control.
- **Consentimiento**: `consent: true` literal y `consentVersion` igual a la versión vigente (si no, 409
  `CONSENT_VERSION_MISMATCH` pidiendo recargar).

## D-011: Exportación CSV

- **Decision**: `GET /api/admin/participants/export` genera CSV UTF-8 con BOM (para tildes/ñ en Excel),
  separador coma, comillas dobles escapadas, columnas `Nombres, Celular, Empresa u ocupación, Fecha de registro`
  (hora de Lima, `YYYY-MM-DD HH:mm:ss`). Los textos libres que empiezan con `=`, `+`, `-`, `@`, tab o retorno
  se prefijan con `'` (FR-018). El celular, validado como 9 dígitos, no necesita neutralización.
- **Rationale**: respeta SC-008 y evita inyección de fórmulas; sin librería (la serialización es una función
  pura de ~20 líneas y se prueba unitariamente).

## D-012: Dependencias y justificación

| Dependencia | Tipo | Justificación (principio VI) |
|---|---|---|
| `next`, `react`, `react-dom` | prod | Stack fijado por la constitución. |
| `tailwindcss`, `@tailwindcss/postcss` | prod/dev | Pedido por el usuario; tokens en `@theme`. |
| `firebase` | prod | Solo `firebase/auth` y `firebase/app-check` en el navegador (importación modular). |
| `firebase-admin` | prod | Acceso a Firestore, verificación de App Check y sesiones en servidor. |
| `zod` | prod | Validación compartida cliente/servidor (principio II). |
| `react-hook-form`, `@hookform/resolvers` | prod | Pedido por el usuario; integra Zod. |
| `server-only` | prod | Impide importar servicios de servidor desde componentes de cliente. |
| `typescript`, `eslint`, `eslint-config-next`, `prettier` | dev | Calidad de código (principio II). |
| `typescript-eslint` | dev | Reglas de lint para TypeScript, incluida `no-explicit-any` como error (principio II). |
| `@types/node`, `@types/react`, `@types/react-dom` | dev | Tipos requeridos por `tsc` en modo estricto (principio II). |
| `vitest` | dev | Pruebas unitarias e integración. |
| `@firebase/rules-unit-testing` | dev | Pruebas de reglas contra el emulador (principio III). |
| `firebase-tools` | dev | Emuladores de Firestore y Auth. |
| `@playwright/test` | dev | E2E del registro y del panel. |
| `lighthouse` | dev | Puerta de rendimiento/accesibilidad ≥ 90. |
| `tsx` | dev | Ejecutar `scripts/grant-admin.ts` en TypeScript estricto. |

No se añaden librerías de animación, de tablas, de CSV, de fechas ni de componentes UI.

## D-013: Despliegue

- **Decision**: Vercel (Node runtime) con variables de entorno por entorno (Preview/Production) apuntando a
  proyectos Firebase distintos (dev/prod). Credenciales de Admin SDK como variables (`FIREBASE_PROJECT_ID`,
  `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`); la configuración web pública y la clave de sitio de
  reCAPTCHA con prefijo `NEXT_PUBLIC_`.
- **Rationale**: Next.js con render dinámico y Route Handlers funciona de forma nativa en Vercel; Firebase
  Hosting requeriría App Hosting o Cloud Functions, más complejidad sin beneficio para este alcance.

## D-014: Estrategia de pruebas

- **Unitarias** (`tests/unit`): `phone`, `schemas`, `search`, `csv`, `draw` (RNG inyectado, sin repetidos, N=total).
- **Integración** (`tests/integration`, emulador): registro (éxito, duplicado concurrente → 1 documento, cerrado),
  cierre simultáneo, sorteo concurrente sin ganadores repetidos, borrado (datos eliminados y sorteos reducidos
  a nombres).
- **Reglas** (`tests/rules`): cualquier lectura/escritura desde cliente (anónimo y autenticado) es denegada.
- **E2E** (Playwright + emuladores, `APP_CHECK_ENFORCEMENT=off`): registro exitoso, duplicado con otro formato,
  sin consentimiento, cerrado, acceso admin denegado/permitido, búsqueda, sorteo, exportación, borrado.
- **Rendimiento**: Lighthouse móvil sobre `/` ≥ 90 en Performance y Accessibility.
