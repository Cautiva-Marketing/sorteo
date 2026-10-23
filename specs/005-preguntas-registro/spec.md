# Feature Specification: Preguntas del registro en dos pasos

**Feature Branch**: `005-preguntas-registro`

**Created**: 2026-10-23

**Status**: Draft

**Input**: User description: "Necesito agregar un pequeño formulario con las siguientes preguntas (puedes cambiar la redacción). Después de llenar los datos generales (nombre, celular, ocupación/empresa), deben responder las preguntas para completar su registro y participar en el sorteo (podríamos paginar el formulario). Recuerda que se van a registrar por celular/teléfono. La tercera pregunta reemplaza el checkbox que se agregó. En la tercera y cuarta preguntas debe haber un input con las opciones de Sí, Tal vez, envíame la información/cotización, y No (puedes cambiar la redacción). Preguntas: ¿En qué área te gustaría capacitarte? ¿Qué invitado te gustaría que trajéramos con Creando Valor? ¿Deseas adquirir el CRM con agente IA (Cautiva)? ¿Estás interesado en un GPS satelital o cámara para tu vehículo? (Satelcom)."

Esta especificación es un **delta sobre las features 001 a 004**: todo lo que no se menciona aquí se mantiene
como estaba (registro por QR, celular con país, duplicados por país + número, cierre y reapertura de
inscripciones, premios y ganadores, exportación a CSV, borrado de datos, acceso protegido del panel, estilo
minimalista). Cuando un requisito de esta feature contradice uno anterior, **prevalece este**: reemplaza a la
casilla opcional «¿Deseas adquirir el CRM con Agente IA?» (004, FR-101 a FR-105) y al filtro «Solo
interesados en el CRM» (004, FR-103).

## Clarifications

### Session 2026-10-23

- Q: ¿Cómo responde la persona «¿En qué área te gustaría capacitarte?» → A: Con texto libre; es
  obligatoria.
- Q: ¿Cómo responde la persona «¿Qué invitado te gustaría que trajéramos a Creando Valor?» y es obligatoria?
  → A: Con texto libre; es obligatoria.
- Q: Con el formulario en dos pasos, ¿cuándo se avisa que el celular ya está registrado? → A: Al pasar del
  paso 1 al paso 2 (al tocar «Siguiente»), para que quien ya participa no conteste las preguntas en vano. La
  comprobación se repite al enviar el paso 2, por si otra persona registró ese número mientras tanto.
- Q: ¿Qué respuestas se ven en el panel de administración? → A: Las cuatro respuestas salen en el CSV. En la
  tabla de participantes se ven solo las columnas de CRM y de GPS/cámara (Sí / Tal vez / No), cada una con
  su filtro por respuesta; el filtro «Solo interesados en el CRM» se reemplaza por estos. El área de
  capacitación y el invitado sugerido no aparecen en la tabla.
- Q: En los filtros de la tabla, ¿se debe poder filtrar también a quienes figuran como «Sin respuesta»
  (registrados antes de esta feature)? → A: Sí, donde puede haberlos: el filtro de GPS/cámara ofrece Todas,
  Sí, Tal vez, No y «Sin respuesta». El filtro de CRM ofrece solo Todas, Sí, Tal vez y No, porque todo
  participante anterior figura como Sí o No según la casilla que marcó (nunca «Sin respuesta»).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Completar el registro en dos pasos (Priority: P1)

Una persona escanea el QR y abre el formulario. En el **paso 1 de 2** escribe sus datos generales (nombres
completos, celular con su país y empresa u ocupación) y toca «Siguiente». En el **paso 2 de 2** responde
cuatro preguntas: en qué área le gustaría capacitarse, qué invitado le gustaría que trajeran a Creando Valor,
si desea adquirir el CRM con Agente IA de Cautiva y si le interesa un GPS satelital o una cámara para su
vehículo de Satelcom. Toca «Enviar y participar» y recibe la ventana de bienvenida de siempre. Solo con las
cuatro respuestas queda registrada y participa en el sorteo.

**Why this priority**: Es el flujo principal del evento y la razón de la feature: captar las respuestas
junto con el registro, sin perder a quien se registra desde un teléfono.

**Independent Test**: Registrar a una persona completando los dos pasos y comprobar que aparece en el panel
con sus datos y sus cuatro respuestas, que ve la ventana de bienvenida y que entra al sorteo; intentar enviar
el paso 2 con una respuesta vacía y comprobar que no se registra.

**Acceptance Scenarios**:

1. **Given** el formulario recién abierto, **When** se muestra, **Then** aparece el paso 1 («Paso 1 de 2»)
   con nombres completos, celular con país y empresa u ocupación, y el botón «Siguiente»; ya no aparece la
   casilla del CRM.
2. **Given** el paso 1 con datos válidos, **When** la persona toca «Siguiente», **Then** pasa al paso 2
   («Paso 2 de 2») con las cuatro preguntas, sin ninguna respuesta elegida, y el foco se mueve al inicio del
   paso para que lectores de pantalla y teclado lo noten.
3. **Given** el paso 1 con datos inválidos (nombre vacío o con símbolos, celular que no corresponde al país,
   empresa vacía), **When** toca «Siguiente», **Then** no avanza y cada error aparece en español bajo su
   campo, como antes.
4. **Given** el paso 2, **When** toca «Atrás», **Then** vuelve al paso 1 con todo lo escrito intacto, y al
   volver a avanzar conserva las respuestas del paso 2 que ya había dado.
5. **Given** el paso 2 con alguna pregunta sin responder, **When** toca «Enviar y participar», **Then** no se
   registra y el mensaje de error, en español, señala la pregunta faltante.
6. **Given** el paso 2 completo, **When** toca «Enviar y participar», **Then** se registra con sus datos y
   sus cuatro respuestas y se muestra la ventana de bienvenida con el nombre y el celular con prefijo.
7. **Given** una persona que no completó el paso 2 (cerró la página o no envió), **When** el administrador
   consulta los participantes, **Then** no figura: el registro se guarda solo al enviar el paso 2.
8. **Given** el flujo completo, **When** se usa en un teléfono de 360 px de ancho, **Then** cada paso cabe sin
   desplazamiento horizontal y los botones y opciones tienen un área táctil de al menos 44 px.

---

### User Story 2 - Avisar al paso 1 si el celular ya está registrado (Priority: P1)

Cuando una persona ya registrada vuelve a escanear el QR y escribe su celular, el sistema se lo avisa al tocar
«Siguiente», antes de pedirle las cuatro respuestas. Ve el aviso de «ya registrado» de siempre y no pierde
tiempo.

**Why this priority**: Evita que alguien conteste cuatro preguntas para descubrir al final que su registro
no cuenta. Protege además la integridad de los datos: una segunda tanda de respuestas no modifica la primera.

**Independent Test**: Intentar pasar al paso 2 con un celular ya registrado y comprobar el aviso en el paso 1;
registrar el mismo número desde dos pestañas al mismo tiempo y comprobar que solo se guarda un registro.

**Acceptance Scenarios**:

1. **Given** un celular ya registrado (mismo país y número), **When** la persona toca «Siguiente», **Then** se
   muestra el aviso «ya registrado» de siempre y no se muestra el paso 2.
2. **Given** ese aviso, **When** se cierra, **Then** la persona puede registrar a otra persona o terminar,
   como en las features anteriores.
3. **Given** un celular libre al tocar «Siguiente» pero registrado por otra persona antes de que se envíe el
   paso 2, **When** la persona toca «Enviar y participar», **Then** se muestra el aviso «ya registrado» y el
   registro existente no cambia.
4. **Given** un intento de registro duplicado con respuestas distintas, **When** se rechaza, **Then** ninguna
   de las respuestas guardadas del participante original se modifica.
5. **Given** que las inscripciones se cierran mientras la persona estaba en el paso 2, **When** envía,
   **Then** se muestra el aviso de cierre de siempre y no se guarda el registro.
6. **Given** inscripciones ya cerradas al abrir el formulario, **When** se abre, **Then** el comportamiento es
   el de siempre (aviso de cierre).
7. **Given** que la comprobación del celular al tocar «Siguiente» falla por falta de conexión, **When** se
   muestra el error, **Then** la persona sigue en el paso 1 con su mensaje claro y puede reintentar sin
   perder lo escrito.

---

### User Story 3 - Ver y filtrar las respuestas en el panel (Priority: P2)

El administrador abre la tabla de participantes y ve dos columnas, «CRM» y «GPS /
cámara», con la respuesta de cada persona (Sí, Tal vez o No; «Sin respuesta» en GPS/cámara para quienes se
registraron antes de esta feature). Puede filtrar por la respuesta de cada una —por
ejemplo, ver solo a quienes dijeron «Sí» o «Tal vez» al CRM— y combinar el filtro con la búsqueda por texto.
Al exportar el CSV obtiene las cuatro respuestas: área de capacitación, invitado sugerido, CRM y GPS/cámara.

**Why this priority**: Sin una forma ágil de ver y exportar las respuestas, el dato comercial no se
aprovecha. Depende del Paso 1 (hay que tener respuestas guardadas) pero no bloquea el registro.

**Independent Test**: Registrar cuatro personas con respuestas distintas y comprobar en la tabla las dos
columnas, que cada filtro deja solo a quienes corresponden (solos y combinados con la búsqueda) y que el CSV
trae las cuatro respuestas de cada persona.

**Acceptance Scenarios**:

1. **Given** participantes con respuestas distintas, **When** el administrador abre la tabla, **Then** ve una
   columna de CRM y una de GPS/cámara con «Sí», «Tal vez» o «No» para cada uno.
2. **Given** la tabla, **When** el administrador elige una respuesta (Sí, Tal vez o No) en el filtro de CRM,
   **Then** solo se listan los participantes con esa respuesta; igual con el filtro de GPS/cámara, que además
   ofrece «Sin respuesta» para aislar a los participantes anteriores a esta feature; ambos filtros y la
   búsqueda por texto se pueden combinar y el total mostrado refleja el resultado.
3. **Given** la tabla, **When** se muestra, **Then** no aparece el filtro anterior «Solo interesados en el
   CRM» y no hay columnas para el área de capacitación ni para el invitado sugerido.
4. **Given** participantes registrados, **When** el administrador exporta el CSV, **Then** incluye columnas
   para el área de capacitación, el invitado sugerido, la respuesta del CRM y la respuesta de GPS/cámara de
   cada participante, con el celular con prefijo como antes.
5. **Given** participantes registrados antes de esta feature, **When** se muestran o exportan, **Then** el CRM
   figura «Sí» o «No» según la casilla que marcaron, y el GPS/cámara, el área de capacitación y el invitado
   figuran como «Sin respuesta» (o vacíos en el CSV); siguen siendo elegibles para el sorteo.
6. **Given** un texto libre que empieza con `=`, `+`, `-` o `@`, **When** se exporta el CSV, **Then** se
   guarda como texto y no se interpreta como fórmula al abrirlo en una hoja de cálculo.
7. **Given** las respuestas, **When** se hace el sorteo, **Then** no afectan la elegibilidad ni la
   probabilidad de ganar, y no aparecen en la ventana del ganador ni en el historial de ganadores.

---

### Edge Cases

- ¿Qué pasa si la persona cierra la página en el paso 2? No queda registrada ni se guarda nada; debe empezar
  de nuevo al volver a escanear el QR.
- ¿Y si recarga la página en el paso 2? Vuelve al paso 1 con el formulario vacío; no se conservan datos entre
  recargas.
- ¿Y si cambia el país o el número en el paso 1 tras haber pasado al paso 2 y vuelto atrás? Al tocar
  «Siguiente» se vuelve a comprobar el número, no se reutiliza la comprobación anterior.
- ¿Y si escribe solo espacios o un solo carácter en el área de capacitación o el invitado? Se rechaza: mínimo
  2 caracteres visibles; máximo 100.
- ¿Y si pega en esos campos texto con saltos de línea o muchos espacios? Se normalizan (espacios sobrantes
  recortados) y se rechaza lo que exceda el máximo, con mensaje claro.
- ¿Y si escribe en esos campos código o etiquetas HTML? Se guardan y muestran como texto plano, sin
  interpretarse en ningún lugar del panel ni en el CSV.
- ¿Y si pulsa dos veces «Siguiente» o «Enviar y participar»? Solo se procesa una vez; el botón indica que
  está enviando.
- ¿Y si un participante anterior no tiene respuestas nuevas? El CRM se deduce de su casilla; lo demás figura
  «Sin respuesta». No se le pide que responda.
- ¿Y si la persona usa solo el teclado o un lector de pantalla? Puede recorrer ambos pasos y las opciones de
  cada pregunta sin ratón; los errores se anuncian y el foco queda en el primer elemento con error.
- ¿Y si la conexión falla al enviar el paso 2? Se muestra el error en español, la persona sigue en el paso 2
  con sus respuestas intactas y puede reintentar.

## Requirements *(mandatory)*

### Functional Requirements

**Flujo en dos pasos**

- **FR-118**: El formulario DEBE dividirse en dos pasos con indicador visible de avance («Paso 1 de 2» y
  «Paso 2 de 2»). El paso 1 contiene nombres completos, celular con su país y empresa u ocupación, con la
  validación existente; el paso 2 contiene las cuatro preguntas.
- **FR-119**: Al tocar «Siguiente», el sistema DEBE validar los campos del paso 1 y comprobar que el celular
  no está registrado ni las inscripciones cerradas. Solo si todo es válido DEBE mostrar el paso 2; si no,
  DEBE mostrar el error o el aviso correspondiente (campo inválido, «ya registrado» o cierre) sin avanzar.
- **FR-120**: El registro DEBE guardarse únicamente al enviar el paso 2 con todas las respuestas válidas. Quien
  abandona antes NO DEBE quedar registrado ni guardarse nada de lo escrito.
- **FR-121**: El paso 2 DEBE ofrecer «Atrás», que vuelve al paso 1 conservando lo escrito, y «Enviar y
  participar». Al avanzar o retroceder, el foco DEBE moverse al inicio del nuevo paso y el cambio DEBE
  anunciarse a lectores de pantalla.
- **FR-122**: Al enviar el paso 2 el sistema DEBE volver a comprobar duplicado y cierre de inscripciones. Un
  intento rechazado como duplicado NO DEBE modificar ninguna respuesta guardada de ese participante.
- **FR-123**: Cada paso DEBE evitar el doble envío (el botón queda deshabilitado e indica el avance mientras
  se procesa).

**Preguntas**

- **FR-124**: El paso 2 DEBE incluir, en este orden y todas obligatorias:
  1. «¿En qué área te gustaría capacitarte?» — texto libre.
  2. «¿Qué invitado te gustaría que trajéramos a Creando Valor?» — texto libre.
  3. «¿Deseas adquirir el CRM con Agente IA de Cautiva?» — una opción entre tres.
  4. «¿Te interesa un GPS satelital o una cámara para tu vehículo (Satelcom)?» — una opción entre tres.
- **FR-125**: Las preguntas 3 y 4 DEBEN ofrecer exactamente estas tres opciones, sin ninguna
  preseleccionada: «Sí, me interesa», «Tal vez, envíenme más información» (en la pregunta 4,
  «Tal vez, envíenme una cotización») y «No, por ahora». Cada pregunta DEBE presentarse como un
  desplegable de una sola línea (que se abre al tocarlo, para que el formulario no se alargue), con la
  pregunta como etiqueta, una primera opción «Elige una opción» sin respuesta, y ser operable con teclado y
  con área táctil de al menos 44 px.
- **FR-126**: Las preguntas de texto libre DEBEN rechazar respuestas vacías, de solo espacios o de menos de 2
  caracteres visibles, y de más de 100 caracteres, con mensajes claros en español; los espacios sobrantes DEBEN
  recortarse antes de guardar.
- **FR-127**: La casilla opcional «¿Deseas adquirir el CRM con Agente IA?» DEBE retirarse del formulario; su
  papel lo cumple la pregunta 3.
- **FR-128**: Cada pregunta DEBE tener su etiqueta asociada y su error en español, anunciado a lectores de
  pantalla; al enviar con errores el foco DEBE ir al primer elemento con error.

**Datos y validación**

- **FR-129**: El servidor DEBE validar las cuatro respuestas con las mismas reglas que el cliente: los textos
  según FR-126 y las opciones solo con uno de los tres valores permitidos; DEBE rechazar con error de
  validación una petición con respuestas ausentes o inválidas.
- **FR-130**: El registro del participante DEBE guardar las cuatro respuestas junto con sus datos
  generales. Los textos libres DEBEN tratarse siempre como texto plano en todas las pantallas del panel y en
  el CSV.
- **FR-131**: Los participantes registrados antes de esta feature DEBEN conservar su registro y su
  elegibilidad. Su respuesta de CRM DEBE derivarse de la casilla anterior (marcada = «Sí», no marcada =
  «No»); el GPS/cámara, el área de capacitación y el invitado DEBEN figurar como «Sin respuesta». No se les
  pide completar nada.
- **FR-132**: Las respuestas NO DEBEN influir en la elegibilidad ni en la probabilidad de ganar, y NO DEBEN
  mostrarse en el cliente público, en la ventana del ganador ni en el historial de ganadores.

**Panel de administración**

- **FR-133**: La tabla de participantes DEBE mostrar una columna «CRM» (Sí, Tal vez o No) y otra «GPS / cámara»
  (Sí, Tal vez, No o «Sin respuesta»), y NO DEBE mostrar el área de capacitación ni el invitado.
- **FR-134**: La tabla DEBE ofrecer un filtro por respuesta para el CRM (Todas, Sí, Tal vez, No) y otro para
  GPS/cámara (Todas, Sí, Tal vez, No, Sin respuesta), combinables entre sí y con la búsqueda por texto. El
  filtro anterior «Solo interesados en el CRM» DEBE retirarse.
- **FR-135**: El CSV exportado DEBE incluir columnas para el área de capacitación, el invitado sugerido, la
  respuesta del CRM y la respuesta de GPS/cámara de cada participante, y DEBE evitar que un texto libre que
  empiece con `=`, `+`, `-` o `@` se interprete como fórmula al abrirlo en una hoja de cálculo.

### Key Entities *(include if feature involves data)*

- **Participante**: persona registrada. Además de nombres, empresa u ocupación y celular con país, guarda el
  área de capacitación deseada, el invitado sugerido, su interés en el CRM con Agente IA (Sí / Tal vez / No)
  y su interés en GPS o cámara de Satelcom (Sí / Tal vez / No). La unicidad sigue siendo por país + número.
- **Respuestas del registro**: las cuatro respuestas del paso 2; dos de texto libre (2–100 caracteres) y dos
  de opción cerrada con tres valores. Solo las ve el administrador.
- **Interés comercial**: valor de opción cerrada (Sí / Tal vez / No) que indica si se contacta a la persona
  con información o cotización; para los registros anteriores puede faltar y se muestra como «Sin
  respuesta».
- **Exportación (CSV)**: archivo de participantes; añade las columnas de capacitación, invitado, CRM y
  GPS/cámara y muestra el celular con prefijo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-039**: Una persona completa el registro de dos pasos —datos y cuatro respuestas— en menos de 2
  minutos, y al primer intento en al menos 9 de cada 10 pruebas.
- **SC-040**: El 100 % de los registros nuevos queda guardado con sus cuatro respuestas; ningún registro
  nuevo se guarda con una respuesta ausente.
- **SC-041**: En el 100 % de las pruebas con un celular ya registrado, el aviso aparece antes de mostrar el
  paso 2, y ningún intento duplicado modifica las respuestas del participante original.
- **SC-042**: El administrador encuentra a los interesados (Sí o Tal vez) en CRM o en GPS/cámara y exporta sus
  respuestas en menos de 30 segundos.
- **SC-043**: Ambos pasos se pueden completar usando solo el teclado, y sus errores, avances y retrocesos se
  anuncian a lectores de pantalla, sin desplazamiento horizontal en 360 px de ancho.
- **SC-044**: Los participantes anteriores a esta feature siguen contándose como registrados y elegibles, con
  su CRM preservado, en el 100 % de los casos.
- **SC-045**: La página de registro mantiene Lighthouse móvil ≥ 90 en Performance y Accessibility.

## Assumptions

- El orden de las preguntas es el indicado por el usuario; la redacción final (con «tú», sin la marca entre
  paréntesis) es una adaptación que se puede ajustar sin cambiar los requisitos.
- Las preguntas 1 y 2 aceptan cualquier texto de 2 a 100 caracteres; no se valida que sea un área o un
  invitado «real» ni se agrupan respuestas parecidas.
- Los datos entre pasos viven solo en el navegador de la persona mientras el formulario está abierto; no se
  guardan borradores en el servidor ni se recuperan tras recargar.
- La comprobación de duplicado y de cierre del paso 1 es informativa; la garantía definitiva de unicidad sigue
  siendo la del servidor al guardar (FR-122).
- Los participantes anteriores no vuelven a ser consultados: no se les pide completar el paso 2 ni se les
  contacta desde el sistema.
- «Sí / Tal vez / No» son valores comerciales: el equipo de Cautiva (CRM) y de Satelcom (GPS/cámara) contacta
  fuera del sistema con la información o cotización a quienes eligen «Sí» o «Tal vez».
- El administrador sigue siendo el único con acceso a las respuestas y al celular completo; el cliente
  público no las ve.
- Solo se muestran en la tabla las columnas de CRM y GPS/cámara; el área de capacitación y el invitado se
  consultan en el CSV.
- **Constitución**: el principio IV (v2.1.0) permite hoy recolectar solo nombres, celular con país, empresa u
  ocupación y la respuesta Sí/No del CRM, y limita el uso comercial a contactar a quienes marcaron el CRM.
  Esta feature añade el área de capacitación, el invitado sugerido, el interés en GPS/cámara de Satelcom, la
  opción «Tal vez» y el contacto comercial por Satelcom; por tanto exige una **enmienda MINOR a la v2.2.0**
  mediante `/speckit-constitution` antes de `/speckit-plan`.
