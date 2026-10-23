# Research: Preguntas del registro en dos pasos

Decisiones técnicas de la feature 005. Cada una indica qué se decidió, por qué y qué se descartó. No quedan
marcadores `NEEDS CLARIFICATION`. Referencias al código tomadas del repositorio en la fecha del plan.

## D-401: Un solo formulario y un solo esquema, con los dos pasos montados

- **Decisión**: `RegistrationForm` mantiene un único `useForm` con `registrationSchema` (ya compartido con el
  servidor) y un estado `step: 1 | 2`. «Siguiente» valida solo el paso 1 con
  `trigger(["fullName", "country", "phone", "company"], { shouldFocus: true })`; React Hook Form ejecuta el
  resolver completo pero informa únicamente los errores de los campos pedidos, así que las respuestas aún
  vacías del paso 2 no muestran error. Ambos pasos están **montados** y el inactivo lleva `hidden`
  (fuera del árbol de accesibilidad y del orden de tabulación). El `<form>` usa `onSubmit` con la bifurcación
  `step === 1 → goNext()` / `step === 2 → handleSubmit(submit)`; así Enter en un campo del paso 1 avanza en
  lugar de intentar enviar.
- **Razón**: conserva el contrato de un esquema único (constitución II) y evita duplicar reglas; mantener
  ambos pasos montados garantiza que «Atrás» y «Siguiente» no pierdan valores ni dependan de cómo RHF
  re-registra inputs desmontados (los desplegables, en particular). El peso extra es de cuatro controles en el DOM.
- **Alternativas**: (a) dos esquemas y dos `useForm`, uno por paso — descartada: hay que fusionar los datos
  al final y se duplican mensajes; (b) desmontar el paso inactivo — descartada: riesgo de perder el valor de
  los desplegables y de re-registrar con `shouldUnregister`; (c) una página por paso con estado en la URL —
  descartada: la spec no guarda borradores y recargar debe volver al paso 1.

## D-402: Comprobación del paso 1 con un endpoint de solo lectura

- **Decisión**: `POST /api/registrations/check` con cuerpo `{ country, phone }`, validado con
  `registrationCheckSchema` (los mismos `country` y la misma regla de celular que `registrationSchema`,
  extraída a una función compartida). El servicio `checkRegistrationAvailable(phone)` lee
  `settings/registration` y `participants/{phone}` con **un único `getAll`** (sin transacción) y lanza
  `RegistrationClosedError` o `AlreadyRegisteredError`, en ese orden (igual que la transacción de registro).
  Respuestas: `200 { status: "available" }`, `403 REGISTRATION_CLOSED`, `409 ALREADY_REGISTERED`,
  `400 VALIDATION_ERROR`, `500 INTERNAL_ERROR`. Con `assertSameOrigin` y sin datos personales en cuerpo ni
  logs.
- **Razón**: FR-119 pide avisar antes de mostrar el paso 2. La comprobación es informativa (puede quedar
  obsoleta si otra persona registra el mismo número mientras se contestan las preguntas); la garantía
  definitiva sigue siendo `transaction.create` en `registerParticipant` (FR-122), que repite la
  comprobación de cierre y duplicado. El endpoint **no escribe**, así que no puede dejar datos a medias
  (FR-120).
- **Riesgo aceptado**: el endpoint permite saber si un celular está registrado sin intentar registrarlo. Ese
  dato ya lo revela el `409 ALREADY_REGISTERED` de `POST /api/registrations`, y la constitución (III) acepta
  que el registro no tenga protección anti-automatización; la respuesta no incluye ningún dato de la persona.
  El principio IV limita lo mostrado públicamente a agregados que no identifiquen a nadie; este estado «ya
  registrado» por celular es la única excepción por persona y queda anotado en «Complexity Tracking» de
  [plan.md](plan.md#complexity-tracking).
- **Alternativas**: (a) enviar el paso 1 completo a un endpoint que "reserve" el celular — descartada: crea
  registros incompletos y contradice FR-120; (b) no comprobar hasta el final — descartada por el usuario
  (clarificación: aviso al pasar al paso 2); (c) una Server Action — descartada: el proyecto usa Route
  Handlers para el registro y los tests de integración los invocan directamente.

## D-403: Modelo de datos sin migración; normalizar al leer

- **Decisión**: `participants/{phoneE164}` guarda `trainingArea` (texto), `guestSuggestion` (texto),
  `crmInterest` (`"yes" | "maybe" | "no"`) y `gpsInterest` (`"yes" | "maybe" | "no"`). `crmInterest` conserva
  su nombre pero **cambia de booleano a texto**. Los documentos anteriores no se reescriben: al leer,
  `toInterest(valor)` devuelve el texto si es uno de los tres válidos, `"yes"` si es `true` y `"no"` si es
  `false` o falta (FR-131); `gpsInterest` ausente ⇒ `null` («Sin respuesta»); `trainingArea` y
  `guestSuggestion` ausentes ⇒ `""`.
- **Razón**: ningún documento necesita migrarse y el CSV/tabla tratan los anteriores como pide la spec. Un
  campo de dos tipos convive solo hasta que se borren los datos de la campaña; la lectura es el único lugar
  que lo sabe (`participants.service.ts`).
- **Alternativas**: (a) campo nuevo `crmAnswer` y dejar `crmInterest` booleano muerto — descartada: dos
  campos para la misma respuesta y lógica de precedencia; (b) script de migración que reescriba los
  documentos — descartada: riesgo y trabajo sin beneficio, la lectura ya lo resuelve; (c) guardar números
  (0/1/2) — descartada: menos legible en la consola de Firestore.

## D-404: Esquema de las respuestas de texto libre

- **Decisión**: `answerSchema` para `trainingArea` y `guestSuggestion`: normaliza a NFC, **convierte
  cualquier espacio en blanco (incluidos saltos de línea y tabulaciones) en un espacio simple y recorta**,
  luego rechaza caracteres de control restantes y exige 2–100 caracteres. Mensajes propios por campo, en
  español («Cuéntanos en qué área te gustaría capacitarte (mínimo 2 caracteres).»). Constantes
  `ANSWER_MIN = 2` y `ANSWER_MAX = 100`.
- **Razón**: la spec (casos límite) pide normalizar espacios sobrantes y saltos de línea, no rechazarlos;
  `companySchema` rechaza los caracteres de control antes de normalizar, por lo que no sirve tal cual. Los
  textos son texto plano: React los escapa en el panel y `neutralizeFormula` los protege en el CSV (FR-130,
  FR-135).
- **Alternativas**: reutilizar `companySchema` — descartada: rechazaría un pegado con salto de línea y su
  mensaje habla de «empresa u ocupación».

## D-405: Dominio de interés en un módulo puro

- **Decisión**: `src/lib/interest.ts` exporta `INTEREST_VALUES = ["yes", "maybe", "no"]`, las etiquetas de
  tabla/CSV (`Sí`, `Tal vez`, `No`, y «Sin respuesta»/vacío para `null`), las opciones de cada pregunta
  (textos del formulario: «Sí, me interesa», «Tal vez, envíenme más información» o «…una cotización», «No,
  por ahora») y `matchesInterestFilter(value, filter)` con `filter ∈ "all" | Interest | "none"`. El tipo
  `Interest` vive en `types/index.ts`.
- **Razón**: la misma lista alimenta el esquema Zod, el formulario, la tabla, los filtros y el CSV; un módulo
  puro se prueba sin emulador y evita literales repetidos.
- **Alternativas**: etiquetas dentro de cada componente — descartada: se desincronizarían entre formulario,
  tabla y CSV.

## D-406: Desplegable nativo para las preguntas de interés (antes: grupo de radios)

- **Decisión**: las dos preguntas de interés usan `components/ui/SelectField.tsx`: un `<select>` nativo con
  la pregunta como `label`, una primera opción `«Elige una opción»` sin valor (`""`) y las tres respuestas,
  compatible con `register` de React Hook Form y con error por `aria-describedby` / `aria-live`, igual que
  `TextField`. El valor por defecto del formulario es `undefined`; el desplegable arranca en la primera
  opción y el esquema rechaza `""` con «Elige una opción.». El mismo componente (en modo controlado) sirve a
  los filtros del panel.
- **Razón**: un grupo de radios ocupaba ≈ 3 líneas por pregunta (≈ 6 en total) y alargaba el paso 2 en el
  teléfono; el desplegable ocupa una línea por pregunta, usa el selector del sistema en móvil (teclado,
  lectores de pantalla y toque sin dependencias) y reutiliza un solo componente. Cambio pedido por el
  usuario tras ver el formulario en un iPhone.
- **Alternativas**: librería de UI (Radix, etc.) — descartada por el principio VI (dependencia nueva sin
  necesidad); botones segmentados ARIA — descartada: más código y más riesgo de accesibilidad.

## D-407: Panel: dos filtros y free-text solo en el CSV

- **Decisión**: la tabla añade las columnas «CRM» (ya existe como Sí/No) y «GPS / cámara», con etiquetas de
  `interest.ts`. Los dos filtros son `<select>` nativos (`SelectField`: etiqueta visible y opciones «Todas»,
  «Sí», «Tal vez», «No»; solo el de GPS / cámara añade «Sin respuesta», porque el CRM de un participante
  anterior siempre es Sí o No) combinados con `AND` entre sí y con la búsqueda por texto, y reinician la
  paginación. `listParticipants()` devuelve `crmInterest` y `gpsInterest` pero **no** los textos
  libres; el CSV usa `listParticipantsForExport()` (la misma lectura más `trainingArea` y
  `guestSuggestion`).
- **Razón**: el usuario eligió ver capacitación e invitado solo en el CSV; no enviarlos al navegador del
  administrador cuando no se muestran respeta la minimización (IV) y reduce el tamaño de la página con
  miles de filas.
- **Alternativas**: un solo `listParticipants` con todo — descartada: serializa textos libres que la tabla
  no usa; chips o botones de filtro — descartada: más espacio y más código que un `select` nativo.

## D-408: Encabezado y celdas del CSV

- **Decisión**: encabezado, en este orden: `Nombres, Celular (con código de país), Empresa u ocupación,
  Área de capacitación, Invitado sugerido, CRM con Agente IA, GPS / cámara, Fecha de registro, Premio, N.º de
  ganador, Estado`. `CRM con Agente IA` y `GPS / cámara` salen como `Sí` / `Tal vez` / `No`; `GPS / cámara`
  vacío para quienes no respondieron; los textos libres pasan por `neutralizeFormula` y `escapeCell`.
- **Razón**: FR-135 y el escenario 4 de la US3; la columna «Interesado en CRM» de la 004 deja de existir
  porque la respuesta ya no es booleana.

## D-409: Foco y anuncios al cambiar de paso

- **Decisión**: cada paso tiene un título `<h2 tabIndex={-1}>` («Tus datos», «Cuéntanos un poco más»); al
  cambiar de paso se enfoca ese título y `StepProgress` muestra «Paso N de 2» dentro de una región
  `aria-live="polite"` visible para todos. Al fallar la validación del paso 1 o el envío final, RHF enfoca el
  primer campo con error (`shouldFocus`). Si el servidor devuelve un error de un campo del paso 1 en el envío
  final (p. ej. celular inválido por un cambio de reglas), la vista vuelve al paso 1.
- **Razón**: FR-121 y FR-128; mover el foco al título es el patrón habitual para formularios por pasos con
  lector de pantalla y deja el teclado en un punto lógico.

## D-410: Sin dependencias nuevas y rendimiento

- **Decisión**: sin paquetes nuevos. Se verifica con Lighthouse sobre `/registro` (≥ 90) tras el cambio.
- **Razón**: el JavaScript adicional es la lógica de pasos y dos componentes pequeños; no hay librerías que
  pesen en el bundle del formulario público.

## D-411: Sin compatibilidad con el cuerpo anterior

- **Decisión**: `POST /api/registrations` exige las cuatro respuestas; un cuerpo con `crmInterest` booleano o
  sin las demás recibe `400 VALIDATION_ERROR` con `fieldErrors` por campo faltante. No se aceptan valores por
  defecto.
- **Razón**: FR-129 pide rechazar respuestas ausentes y FR-120 que sin las cuatro no se participe. Un
  formulario abierto antes del despliegue se resuelve recargando la página.
- **Alternativa**: aceptar el cuerpo anterior y guardar `no` — descartada: crearía registros sin las
  respuestas que el negocio quiere captar.
