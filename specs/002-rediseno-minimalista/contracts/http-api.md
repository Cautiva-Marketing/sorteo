# Contract: HTTP API y páginas (cambios de la feature 002)

Delta sobre [001 contracts/http-api.md](../../001-registro-sorteo/contracts/http-api.md). Los endpoints de
administrador (`/api/admin/**`) **no cambian**. Cuerpos JSON en `application/json; charset=utf-8`; mensajes de
error en español (es-PE); formato de error común y esquemas Zod de `src/lib/validation/schemas.ts` como en la
001.

## Códigos de error

Se **retiran** `APP_CHECK_FAILED` (401) y `CONSENT_VERSION_MISMATCH` (409). Se mantienen `VALIDATION_ERROR`,
`UNAUTHORIZED`, `FORBIDDEN`, `REGISTRATION_CLOSED`, `ALREADY_REGISTERED`, `CONFIRMATION_REQUIRED`,
`REGISTRATION_OPEN`, `DRAW_CONFLICT` e `INTERNAL_ERROR`.

---

## Público

### `POST /api/registrations` — Registrar participante (FR-033, FR-034; reemplaza el de la 001)

Encabezados: `Content-Type: application/json`. **Ya no** se envía ni se exige `X-Firebase-AppCheck`. Se sigue
exigiendo que `Origin`, si viene, coincida con el host de la aplicación.

Cuerpo:

| Campo | Tipo | Regla |
|---|---|---|
| `fullName` | string | ≥ 2 términos de solo letras (con tildes), ≤ 100 caracteres |
| `phone` | string | celular peruano; acepta espacios, guiones, `+51`/`51`; se normaliza a `+51XXXXXXXXX` |
| `company` | string | 2–100 caracteres |

Las claves `consent` y `consentVersion` ya no existen; si llegaran, se ignoran y no se guardan.

Respuestas:

| Estado | `code` | Cuándo | Cuerpo |
|---|---|---|---|
| 201 | — | registro creado | `{ "status": "registered" }` (sin datos del participante) |
| 400 | `VALIDATION_ERROR` | datos inválidos | error común con `fieldErrors` |
| 403 | `REGISTRATION_CLOSED` | inscripciones cerradas, también ante un envío con el formulario ya abierto | error común |
| 403 | `FORBIDDEN` | `Origin` de otro sitio | error común |
| 409 | `ALREADY_REGISTERED` | el celular ya existe (cualquier formato) | error común; no devuelve datos del registro existente |
| 500 | `INTERNAL_ERROR` | fallo inesperado | error común; sin datos personales en logs |

Idempotencia: reenviar los mismos datos devuelve 409 `ALREADY_REGISTERED`; nunca crea un segundo documento
(FR-012 de la 001, sin cambios). No hay verificación anti-automatización (riesgo aceptado, constitución III).

### `GET /api/status` — Estado público y contador (nuevo; FR-043, FR-044, FR-045)

Sin parámetros, sin autenticación, sin cuerpo de entrada. Cabeceras de respuesta:
`Cache-Control: no-store`.

Respuesta `200`:

```json
{ "open": true, "count": 86 }
```

| Campo | Tipo | Significado |
|---|---|---|
| `open` | boolean | las inscripciones están abiertas |
| `count` | integer ≥ 0 | total de participantes registrados |

- Solo contiene esos dos campos; nunca nombres, celulares ni otros datos de participantes.
- El cliente lo consulta cada 3 s mientras la pestaña está visible; ante un fallo conserva el último valor.
- Errores: `500 INTERNAL_ERROR` (error común). Memoria de 1 s por instancia en el servidor (ver
  [data-model.md](../data-model.md#estado-público-publicstatus)).

---

## Páginas (contrato de interfaz)

| Ruta | Acceso | Contenido |
|---|---|---|
| `/` | público | **pantalla del QR**: logo, título «Regístrate y participa en el sorteo», frase corta, QR (con el ícono «ti» al centro) que abre `/registro`, contador de registrados (se actualiza solo) y botón «Registrarme desde este dispositivo», **en una sola columna** (la tarjeta con el QR y el contador, y el botón debajo; el QR es lo más grande que quepa sin desplazarse). Con inscripciones cerradas, el QR y el botón se reemplazan por el aviso de cierre y el contador final sigue visible. Nunca muestra el formulario |
| `/registro` | público | **formulario**: logo, título «Regístrate en el sorteo», frase corta y tarjeta con los tres campos y el botón «Enviar y participar», con el enlace «Volver a la pantalla principal» (a `/`) debajo del botón y también bajo los avisos de gracias y de inscripciones cerradas. Al registrarse, ventana de bienvenida (ticket) con «Listo, muchas gracias» y «Registrar a otra persona»; ante un celular repetido, ventana de «ya estás participando»; con inscripciones cerradas, el aviso en lugar del formulario |
| `/privacidad` | — | **eliminada**: responde con la página 404 de Next |
| `/admin/login` | público | formulario de correo y contraseña (nuevo estilo) |
| `/admin` | admin | conteo total, búsqueda, tabla paginada (50), exportar y actualizar (nuevo estilo) |
| `/admin/sorteo` | admin | cantidad de ganadores, ejecutar con animación, historial (nuevo estilo) |
| `/admin/campana` | admin | estado de inscripciones y borrado de datos (nuevo estilo) |

Reglas de las páginas públicas:

- Ninguna muestra casillero de consentimiento, texto de finalidad, enlace a política de privacidad ni
  mención o insignia de reCAPTCHA (FR-033, SC-014).
- La URL del QR es absoluta, `<origen de la petición>/registro`, calculada en el servidor.
- Las rutas `/admin/*` (excepto `login`) siguen redirigiendo a `/admin/login` sin sesión válida.

## Contrato visual compartido (resumen para las pruebas)

- Nombre accesible del logo: «Cautiva Marketing» (`role="img"`).
- Botón de envío del formulario: «Enviar y participar». Botones de la ventana: «Listo, muchas gracias» y
  «Registrar a otra persona». Botón de la pantalla del QR: «Registrarme desde este dispositivo».
- Etiquetas de los campos (nombre accesible): «Nombres completos», «Celular», «Empresa u ocupación» (se
  muestran en mayúsculas solo por estilo).
- Contador: texto «N registrados» o «1 registrado».
- Confeti y animaciones: ocultos con `prefers-reduced-motion: reduce`.
