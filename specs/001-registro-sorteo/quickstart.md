# Quickstart: validar Registro y Sorteo

Guía de ejecución y validación de la funcionalidad. Los comandos `npm run …` son los scripts previstos
(se crean durante la implementación; ver `tasks.md`). Detalle de datos en [data-model.md](data-model.md) y de
endpoints en [contracts/http-api.md](contracts/http-api.md).

## Requisitos previos

- Node.js 22 LTS o superior y npm.
- JDK 21 o superior (lo exige el emulador de Firestore).
- Chromium de Playwright para E2E (`npx playwright install chromium`); Lighthouse usa Chrome/Chromium (puede reutilizar el de Playwright con `CHROME_PATH`).
- Un proyecto de Firebase de **desarrollo** (distinto del de producción) con Firestore (modo nativo) y
  Authentication (correo/contraseña) habilitados.
- Firebase App Check registrado para la app web con **reCAPTCHA Enterprise** (clave de sitio).
- Firebase CLI (`firebase-tools`, instalado como dependencia de desarrollo) para los emuladores.

## Variables de entorno (`.env.local`, nunca en el repo)

| Variable | Alcance | Descripción |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` | navegador | configuración web pública |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | navegador | clave de sitio de reCAPTCHA Enterprise |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | solo servidor | credenciales de la cuenta de servicio (Admin SDK) |
| `APP_CHECK_ENFORCEMENT` | solo servidor | `on` (por defecto) o `off` **solo** en desarrollo/pruebas; en producción apagada impide el arranque |
| `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST` | solo servidor | solo al usar emuladores |
| `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST` | navegador | solo al usar emuladores (desarrollo y E2E); el login del admin se conecta al emulador de Auth. Nunca en producción |

Sin `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` el formulario omite App Check (útil en desarrollo y E2E con `APP_CHECK_ENFORCEMENT=off`); en producción la clave es obligatoria y el servidor no arranca sin ella. Para los emuladores se usa el proyecto ficticio `demo-sorteo`.

`.env.example` incluye todas las claves sin valores.

## Preparar el entorno

```text
npm install
npm run emulators          # Firestore + Auth locales (desarrollo y pruebas)
npm run dev                # http://localhost:3000
npm run admin:grant -- <correo> <contraseña>   # crea/promueve un admin (claim "admin")
```

## Puertas de calidad (constitución, «Flujo de Desarrollo»)

```text
npm run typecheck          # tsc --noEmit
npm run lint               # ESLint (sin "any" sin justificar)
npm run format:check       # Prettier
npm run test               # unitarias + integración (emulador)
npm run test:rules         # reglas de Firestore (emulador)
npm run test:e2e           # Playwright (emuladores, APP_CHECK_ENFORCEMENT=off)
npm run perf               # Lighthouse móvil sobre "/" (Performance y Accessibility ≥ 90); levanta el emulador de Firestore y la app en modo producción
```

## Escenarios de validación manual / E2E

| # | Escenario | Pasos | Resultado esperado | Spec |
|---|---|---|---|---|
| 1 | Registro exitoso | Abrir `/` en un viewport de 360 px, completar datos válidos, marcar consentimiento, enviar | Aparece confirmación; existe `participants/+51…` con `drawId: null` y `consent.version` | US1, FR-011 |
| 2 | Validaciones | Enviar vacío; nombre de un solo término; nombre con dígitos; celular `812345678`; empresa de 101 caracteres; sin consentimiento | Cada error en español junto a su campo; nada se guarda; lo escrito se conserva | US1, FR-010 |
| 3 | Duplicado | Repetir con `+51 987-654-321` y con `987654321` | Mensaje "ya estás participando"; sigue habiendo 1 documento | US2 |
| 4 | Duplicado concurrente | Dos `POST` simultáneos con el mismo celular (prueba de integración) | Exactamente 1 documento | US2-3, SC-004 |
| 5 | Sin App Check | `POST /api/registrations` sin encabezado con enforcement activo | 401 `APP_CHECK_FAILED` | FR-013 |
| 6 | Acceso denegado | Abrir `/admin` sin sesión; llamar `GET /api/admin/participants/export` sin cookie; iniciar sesión con usuario sin claim | Redirección a login / 401 / 403; ningún dato | US3-1, SC-005 |
| 7 | Listado y búsqueda | Entrar como admin con ≥ 60 participantes; buscar `jose` y `JOSÉ` | Conteo total correcto, 50 por página, búsqueda sin distinguir tildes ni mayúsculas | US3, FR-016/017 |
| 8 | Cerrar inscripciones | En `/admin/campana` cerrar; abrir `/` en otra pestaña; intentar enviar un formulario ya abierto | Aviso de cerrado; el envío pendiente responde 403 `REGISTRATION_CLOSED` | US3-6/7, FR-028 |
| 9 | Sorteo | En `/admin/sorteo` sortear 1 y luego 3 | Animación simple, ganadores distintos, historial persistente tras recargar; segunda ronda pide confirmación y excluye a los anteriores | US4 |
| 10 | Exportar | Pulsar exportar con participantes con tildes, comas y una empresa `=1+1` | CSV con todas las filas, caracteres correctos, `'=1+1` neutralizado | US5, SC-008 |
| 11 | Borrado | Intentar con inscripciones abiertas (409); cerrar, escribir `BORRAR`, confirmar | Participantes eliminados; `draws[].winners` solo con `fullName`; exportación vacía | US6, SC-011 |
| 12 | Reglas | Con el SDK web contra el emulador intentar leer/escribir `participants`, `draws`, `settings` (anónimo y con claim `admin`) | Todo denegado | Constitución III |
| 13 | Rendimiento / accesibilidad | `npm run perf` sobre `/` en emulación móvil | Performance ≥ 90 y Accessibility ≥ 90; contraste AA; etiquetas asociadas | SC-003, FR-027 |
| 14 | Sesión vencida | En `/admin/campana`, borrar la cookie `admin_session` y pulsar "Cerrar inscripciones"; luego, tras volver a iniciar sesión, abrir `/admin/sorteo` | Redirección a `/admin/login?expirada=1` con "Tu sesión expiró. Inicia sesión de nuevo."; un sorteo ya guardado sigue en el historial | Edge case de sesión vencida |
| 15 | Volumen de 5 000 | Ejecutar `tests/integration/volume.test.ts` (5 000 participantes sembrados) | Listado completo, búsqueda < 2 s, CSV de 5 001 líneas y sorteo de 50 sin repetidos | SC-010 |

## Despliegue (Vercel)

1. Crear el proyecto en Vercel y cargar las variables por entorno (Preview → proyecto Firebase de desarrollo,
   Production → proyecto Firebase de producción).
2. Desplegar las reglas con `firebase deploy --only firestore:rules` (todo denegado).
3. Registrar el dominio de producción en App Check/reCAPTCHA Enterprise y en los dominios autorizados de Auth.
4. Crear los administradores con `npm run admin:grant` apuntando al proyecto de producción.
5. Verificar con los escenarios 1, 3, 6 y 8 sobre la URL desplegada; generar el QR hacia la URL pública.
