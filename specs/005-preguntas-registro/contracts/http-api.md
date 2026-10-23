# Contract: HTTP API, páginas y componentes (cambios de la feature 005)

Delta sobre [001](../../001-registro-sorteo/contracts/http-api.md),
[002](../../002-rediseno-minimalista/contracts/http-api.md),
[003](../../003-sorteo-premios-ruleta/contracts/http-api.md) y
[004](../../004-ajustes-registro-ruleta/contracts/http-api.md). Todo lo no mencionado **no cambia**: `GET
/api/status`, la sesión de administrador, las inscripciones, los premios, el giro y el descarte, y el formato
de error común `{ code, message, fieldErrors? }`. Mensajes en español (es-PE); esquemas Zod en
`src/lib/validation/schemas.ts`.

## Códigos de error

Sin códigos nuevos: la comprobación del paso 1 reutiliza `VALIDATION_ERROR`, `REGISTRATION_CLOSED`,
`ALREADY_REGISTERED` e `INTERNAL_ERROR`.

---

## `POST /api/registrations/check` — Comprobar el paso 1 (nuevo; FR-119)

Público (sin sesión), con `assertSameOrigin`. **Solo lectura**: no crea ni modifica nada. Cuerpo JSON:

```json
{ "country": "CL", "phone": "9 1234 5678" }
```

| Campo | Tipo | Reglas |
|---|---|---|
| `country` | string, opcional | uno de `PE AR BO BR CL CO EC GY PY SR UY VE`; por defecto `PE` |
| `phone` | string | número local del país, con la misma normalización y validación que el registro |

Respuestas:

| Estado | Cuerpo | Cuándo |
|---|---|---|
| `200` | `{ "status": "available" }` | las inscripciones están abiertas y el número completo no está registrado |
| `400` | `VALIDATION_ERROR` + `fieldErrors.phone` | número inválido para el país (mismo mensaje que el registro) |
| `403` | `REGISTRATION_CLOSED` | las inscripciones están cerradas |
| `409` | `ALREADY_REGISTERED` | el número completo ya existe |
| `500` | `INTERNAL_ERROR` | sin datos personales en logs |

`Cache-Control: no-store`. La respuesta es informativa: no reserva el número; el envío final repite la
comprobación dentro de la transacción de registro.

---

## `POST /api/registrations` — Registrar un participante (cambia el cuerpo; FR-120, FR-122, FR-124 a FR-130)

Público (sin sesión), con `assertSameOrigin`. Cuerpo JSON:

```json
{
  "fullName": "María",
  "country": "CL",
  "phone": "9 1234 5678",
  "company": "Cautiva Marketing",
  "trainingArea": "Ventas y atención al cliente",
  "guestSuggestion": "Un experto en marketing digital",
  "crmInterest": "maybe",
  "gpsInterest": "no"
}
```

| Campo | Tipo | Reglas |
|---|---|---|
| `fullName`, `country`, `phone`, `company` | — | sin cambios respecto de la 004 |
| `trainingArea` | string, **obligatorio** | 2–100 caracteres tras normalizar (espacios en blanco y saltos de línea → un espacio; sin caracteres de control) |
| `guestSuggestion` | string, **obligatorio** | ídem |
| `crmInterest` | string, **obligatorio** | `"yes"`, `"maybe"` o `"no"` (ya **no** es booleano) |
| `gpsInterest` | string, **obligatorio** | `"yes"`, `"maybe"` o `"no"` |

Respuestas:

| Estado | Cuerpo | Cuándo |
|---|---|---|
| `201` | `{ "status": "registered" }` | se guardó el registro con sus cuatro respuestas |
| `400` | `VALIDATION_ERROR` + `fieldErrors` | cualquier campo ausente o inválido, p. ej. `fieldErrors.trainingArea = ["Cuéntanos en qué área te gustaría capacitarte (mínimo 2 caracteres)."]`, `fieldErrors.crmInterest = ["Elige una opción."]` |
| `403` | `REGISTRATION_CLOSED` | las inscripciones están cerradas |
| `409` | `ALREADY_REGISTERED` | el número completo ya existe; **no se modifica ninguna respuesta** del registro existente |
| `500` | `INTERNAL_ERROR` | sin datos personales en logs |

Compatibilidad: ya **no** se acepta el cuerpo anterior (`crmInterest` booleano y sin las demás respuestas):
recibe `400` (research D-411).

---

## `GET /api/admin/participants/export` — CSV (cambia; FR-135)

Encabezado, en este orden:

```text
Nombres,Celular (con código de país),Empresa u ocupación,Área de capacitación,Invitado sugerido,CRM con Agente IA,GPS / cámara,Fecha de registro,Premio,N.º de ganador,Estado
```

- **Área de capacitación** e **Invitado sugerido**: el texto libre, con la neutralización de fórmulas
  existente (`=`, `+`, `-`, `@`, tab, retorno ⇒ prefijo `'`); vacío en participantes anteriores.
- **CRM con Agente IA**: `Sí`, `Tal vez` o `No` (los participantes anteriores salen `Sí`/`No` según la casilla
  que marcaron).
- **GPS / cámara**: `Sí`, `Tal vez` o `No`; vacío en participantes anteriores.
- Se **elimina** la columna «Interesado en CRM». El resto (BOM UTF-8, hora de Lima, celular con prefijo,
  `Cache-Control: no-store`, acceso solo de administrador) no cambia.

---

## Páginas y componentes

### `/registro` — formulario en dos pasos (FR-118 a FR-128)

`StepProgress` muestra «Paso 1 de 2» o «Paso 2 de 2» (región `aria-live="polite"`).

**Paso 1 — «Tus datos»**: Nombres completos → Celular (selector «País» + número local) → Empresa u ocupación →
botón **«Siguiente»**. «Siguiente» (o Enter en un campo) valida el paso, llama a `POST
/api/registrations/check` y:

- `200` → muestra el paso 2 y enfoca su título;
- `409` → ventana «ya registrado» de siempre (no avanza);
- `403` → aviso de cierre de siempre;
- `400` → error bajo el campo del celular;
- error de red o `500` → mensaje en español sobre el botón; se queda en el paso 1 con lo escrito.

**Paso 2 — «Cuéntanos un poco más»**, en este orden, todas obligatorias y sin respuesta elegida de inicio:

1. **«¿En qué área te gustaría capacitarte?»** — campo de texto.
2. **«¿Qué invitado te gustaría que trajéramos a Creando Valor?»** — campo de texto.
3. **«¿Deseas adquirir el CRM con Agente IA de Cautiva?»** — desplegable (`<select>` nativo) que
   arranca en «Elige una opción»: «Sí, me interesa» · «Tal vez, envíenme más información» · «No, por ahora».
4. **«¿Te interesa un GPS satelital o una cámara para tu vehículo (Satelcom)?»** — desplegable que arranca en «Elige una
   opción»: «Sí, me interesa» · «Tal vez, envíenme una cotización» · «No, por ahora».

Botones: **«Atrás»** (vuelve al paso 1 con lo escrito) y **«Enviar y participar»**. Los errores aparecen bajo
cada pregunta, en español, con `aria-describedby`/`aria-live`; el foco va al primer elemento con error. Al
terminar se muestra la ventana de bienvenida de siempre; «Registrar a otra persona» reinicia el formulario en
el paso 1. La casilla «¿Deseas adquirir el CRM con Agente IA?» ya no existe.

### `/admin` — participantes (FR-133, FR-134)

Tabla con columnas **Nombres · Celular (con prefijo) · Empresa u ocupación · CRM · GPS / cámara · Fecha de
registro**; las celdas de CRM dicen «Sí», «Tal vez» o «No» y las de GPS / cámara, además, «Sin respuesta»
(participantes anteriores). No hay columnas para el área de capacitación ni el invitado.

Filtros (selectores nativos): **«CRM con Agente IA»** con **Todas · Sí · Tal vez · No** y **«GPS / cámara»**
con **Todas · Sí · Tal vez · No · Sin respuesta**. Son combinables entre sí y con la búsqueda por texto;
reinician la paginación y el contador «Coincidencias» refleja el resultado. Se elimina la casilla «Solo
interesados en el CRM».

### Componentes nuevos

- `SelectField` — props: `label`, `options: { value, label }[]`, `placeholder?` (primera opción sin valor),
  `error?` y los atributos de un `<select>` (compatible con `register("campo")` y también controlado con
  `value` + `onChange`). Etiqueta visible asociada, error con `aria-describedby`/`aria-live`, alto ≥ 44 px.
  Lo usan las dos preguntas de interés del registro y los filtros del panel.
- `StepProgress` — props: `step: 1 | 2`, `total: 2`.
