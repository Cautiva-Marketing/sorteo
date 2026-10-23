# Contract: HTTP API, páginas y componentes (cambios de la feature 004)

Delta sobre [001](../../001-registro-sorteo/contracts/http-api.md),
[002](../../002-rediseno-minimalista/contracts/http-api.md) y
[003](../../003-sorteo-premios-ruleta/contracts/http-api.md). Todo lo no mencionado **no cambia**: `GET
/api/status`, la sesión de administrador, las inscripciones, los premios, el descarte, el giro de práctica y
el formato de error común `{ code, message, fieldErrors? }`. Mensajes en español (es-PE); esquemas Zod en
`src/lib/validation/schemas.ts`.

## Códigos de error

Se **elimina** `CONFIRMATION_REQUIRED` (409): ya no existe una confirmación previa al primer giro.
Los demás códigos no cambian.

---

## `POST /api/registrations` — Registrar un participante (cambia el cuerpo; FR-092 a FR-102)

Público (sin sesión), con `assertSameOrigin`. Cuerpo JSON:

```json
{
  "fullName": "María",
  "country": "CL",
  "phone": "9 1234 5678",
  "company": "Cautiva Marketing",
  "crmInterest": true
}
```

| Campo | Tipo | Reglas |
|---|---|---|
| `fullName` | string | 1 o más términos de letras (con tildes y ñ) y espacios; mínimo 2 letras; máx. 100 |
| `country` | string, opcional | uno de `PE AR BO BR CL CO EC GY PY SR UY VE`; por defecto `PE` |
| `phone` | string | número local del país; tolera espacios, guiones y paréntesis y, si coincide con el país, el prefijo internacional |
| `company` | string | 2–100 caracteres, sin caracteres de control |
| `crmInterest` | boolean, opcional | por defecto `false` |

Respuestas:

| Estado | Cuerpo | Cuándo |
|---|---|---|
| `201` | `{ "status": "registered" }` | se guardó el registro con `phone` = E.164 (`+56912345678`) |
| `400` | `VALIDATION_ERROR` + `fieldErrors` | p. ej. `fieldErrors.phone = ["Ingresa un celular chileno de 9 dígitos que empiece con 9."]`; `fieldErrors.fullName` si el nombre no es válido |
| `403` | `REGISTRATION_CLOSED` | las inscripciones están cerradas |
| `409` | `ALREADY_REGISTERED` | el número completo (país + número) ya existe; **no se modifica ningún dato** del registro existente |
| `500` | `INTERNAL_ERROR` | sin datos personales en logs |

Compatibilidad: un cuerpo antiguo `{ fullName, phone: "+51 987-654-321", company }` sigue siendo válido
(`country` = `PE`, `crmInterest` = `false`).

---

## `POST /api/admin/spins` — Girar la ruleta (cambia el cuerpo; FR-106, FR-107)

Cuerpo: `{ "prizeId": string }`. Se **elimina** `confirmCloseRegistration`: si algún cliente antiguo lo
envía, se ignora. Respuesta `201`, errores y concurrencia: igual que en la 003, **sin** el `409
CONFIRMATION_REQUIRED`.

Efecto lateral: si las inscripciones seguían abiertas, el giro las cierra **en la misma transacción** que
crea el ganador (todo o nada). El servidor invalida el contador público para que la pantalla del QR muestre
el cierre de inmediato.

`POST /api/admin/spins/practice`: sin cambios (no escribe, no cierra inscripciones).

---

## `GET /api/admin/participants/export` — CSV (cambia; FR-097, FR-104)

Encabezado, en este orden:

```text
Nombres,Celular (con código de país),Empresa u ocupación,Interesado en CRM,Fecha de registro,Premio,N.º de ganador,Estado
```

- **Celular**: `{prefijo} {número local}` sin `+` (`51 987654321`, `56 912345678`); los registros anteriores
  salen como `51 …`.
- **Interesado en CRM**: `Sí` o `No` (`No` si el documento no tiene el campo).
- El resto de columnas y reglas (BOM UTF-8, hora de Lima, neutralización de fórmulas en textos libres,
  `Cache-Control: no-store`, acceso solo de administrador) no cambian.

---

## Páginas y componentes

### `/registro` — formulario (FR-092 a FR-102)

Orden de los controles: **Nombres completos** → **Celular** (selector «País» + campo del número local) →
**Empresa u ocupación** → casilla **«¿Deseas adquirir el CRM con Agente IA?»** → botón «Enviar y participar».

- El selector muestra «Nombre (+prefijo)», con **Perú (+51)** preseleccionado y los 12 países ordenados
  alfabéticamente tras Perú; nombre accesible «País».
- El campo del número tiene su `<label>` «Celular» y un `placeholder` que cambia con el país; **no hay texto
  de ayuda** debajo (se eliminó «9 dígitos, por ejemplo …»).
- El `placeholder` de nombres es «Ej. María».
- Errores en español anunciados con `aria-describedby`/`aria-live`; el error del número aparece bajo el
  conjunto selector + campo.
- La ventana de bienvenida muestra el celular con prefijo (`+56 9 1234 5678`).

### Tarjeta «¡Gracias por registrarte!» (FR-114, FR-115)

Bajo el mensaje de agradecimiento: texto «Síguenos en nuestras redes sociales» y dos enlaces —
**Cautiva Marketing** → `https://www.facebook.com/cautivamarketingperu` y **Satelcom del Sur** →
`https://www.facebook.com/satelcomdelsur`—, con `target="_blank"`, `rel="noopener noreferrer"`, ícono
decorativo, área táctil ≥ 44 px y foco visible.

### `/` — pantalla del QR (FR-109 a FR-111)

QR con tope `max(14rem, (100dvh − 28rem) × 0,85)`; logo Creando Valor a 88 px de alto; logos aliados con alto
`h-11 sm:h-12 md:h-15`. Sin desplazamiento vertical en 1366×768 y 1920×1080 ni horizontal a 360 px.

### `/admin` — participantes (FR-097, FR-103)

Tabla con columnas **Nombres · Celular (con prefijo) · Empresa u ocupación · CRM (Sí/No) · Fecha de
registro**; casilla «Solo interesados en el CRM» que se combina con la búsqueda y reinicia la paginación; la
búsqueda acepta el número con o sin prefijo.

### `/admin/sorteo` — ruleta (FR-106, FR-112, FR-113)

«Girar» inicia el giro sin ventana intermedia (el componente `DrawStage` ya no recibe `registrationOpen`).
La ruleta completa usa la paleta de la «A» (`wheel-purple`, `wheel-lavender`, `wheel-cyan`) y el letrero del
nombre pasa a fondo `wheel-purple` con borde `wheel-cyan`.

### Componente `Dialog` (FR-116, FR-117)

Nueva prop opcional `blurBackdrop?: boolean` (por defecto `false` = fondo oscurecido sin desenfoque). La
usan con `true` solo `WelcomeDialog` y `AlreadyRegisteredDialog`.
