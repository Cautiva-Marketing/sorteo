# Feature Specification: Registro y Sorteo

**Feature Branch**: `001-registro-sorteo`

**Created**: 2026-10-21

**Status**: Draft

**Input**: User description: "Quiero una aplicación web de registro para un sorteo. Participantes que entran desde su celular (típicamente escaneando un QR) se registran con nombres completos, celular y empresa u ocupación, aceptando el consentimiento de tratamiento de datos personales. Un administrador, desde un panel protegido, ve el listado con búsqueda y conteo, exporta a CSV y ejecuta el sorteo eligiendo uno o varios ganadores al azar con una animación simple, registrando el resultado. Usa la paleta de colores del logo de la empresa (`logo.svg`). Fuera de alcance: pagos, verificación por SMS, múltiples sorteos simultáneos."

## Clarifications

### Session 2026-10-21

- Q: ¿Qué debe pasar con el registro de nuevos participantes una vez que el administrador ejecuta el
  sorteo? → A: El administrador cierra las inscripciones manualmente desde el panel; con el registro
  cerrado, el formulario muestra un aviso y no acepta datos.
- Q: ¿Cuántos participantes se esperan registrar en total, aproximadamente? → A: Hasta 5 000
  participantes; el listado se pagina y la búsqueda sigue siendo inmediata.
- Q: ¿Qué debe pasar con los datos personales de los participantes cuando termine la campaña? → A: El
  administrador puede borrar todos los datos de participantes desde el panel (con confirmación) una
  vez entregado el premio; el registro del sorteo conserva solo lo mínimo de los ganadores.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrarse en el sorteo desde el celular (Priority: P1)

Una persona escanea un código QR con su celular y llega a la página principal, que muestra el logo y
la identidad visual de la empresa. Completa un formulario con sus nombres completos, su celular y su
empresa u ocupación, acepta el consentimiento de tratamiento de datos personales y envía. Al terminar
ve una pantalla que confirma que ya está participando.

**Why this priority**: Es el núcleo del producto. Sin registros no hay sorteo; por sí sola esta
historia ya permite captar participantes (MVP).

**Independent Test**: Abrir la página principal en un celular, completar el formulario con datos
válidos, aceptar el consentimiento y enviar. Se verifica que aparece la confirmación y que el
participante queda guardado.

**Acceptance Scenarios**:

1. **Given** un visitante en la página principal, **When** la abre, **Then** ve el logo de la empresa,
   la identidad visual de la marca, el formulario con los tres campos obligatorios, la finalidad del
   tratamiento de datos y el casillero de consentimiento sin marcar.
2. **Given** un formulario con datos válidos y el consentimiento aceptado, **When** el visitante envía,
   **Then** ve una pantalla de confirmación de que quedó registrado.
3. **Given** un formulario con algún campo vacío, **When** el visitante intenta enviar, **Then** no se
   registra y se indica, junto a cada campo faltante, qué debe completar.
4. **Given** un formulario completo pero con el consentimiento sin marcar, **When** el visitante intenta
   enviar, **Then** no se registra y se le indica que debe aceptar el consentimiento para participar.
5. **Given** un nombre con un solo término (p. ej. "María"), o con números o símbolos, **When** el
   visitante intenta enviar, **Then** se rechaza con un mensaje que pide nombre y apellido usando solo
   letras, espacios y tildes.
6. **Given** un celular que no tiene 9 dígitos o no empieza con 9, **When** el visitante intenta enviar,
   **Then** se rechaza con un mensaje que explica el formato peruano esperado.
7. **Given** una empresa u ocupación que excede la longitud máxima permitida, **When** el visitante
   intenta enviar, **Then** se rechaza con un mensaje que indica el límite.
8. **Given** que el administrador cerró las inscripciones, **When** un visitante abre la página
   principal, **Then** ve el logo y un aviso de que las inscripciones están cerradas, sin formulario, y
   ningún envío es aceptado.

---

### User Story 2 - No permitir registros duplicados por celular (Priority: P1)

Si una persona intenta registrarse otra vez con un celular que ya está registrado, el sistema no crea un
segundo registro y le informa de forma amable que ya está participando.

**Why this priority**: Garantiza la equidad del sorteo (una persona, una oportunidad) y es parte del
flujo básico de registro.

**Independent Test**: Registrar un celular y volver a enviar el formulario con el mismo celular (incluso
con otro nombre o escrito con espacios o prefijo +51). Se verifica que solo existe un registro y que se
muestra el aviso de "ya estás participando".

**Acceptance Scenarios**:

1. **Given** un celular ya registrado, **When** alguien envía el formulario con ese mismo celular,
   **Then** no se crea otro registro y se muestra un mensaje de que ya está participando.
2. **Given** un celular ya registrado, **When** alguien lo ingresa con distinto formato (espacios,
   guiones o prefijo +51), **Then** se reconoce como el mismo celular y se trata como duplicado.
3. **Given** dos envíos casi simultáneos con el mismo celular, **When** ambos se procesan, **Then**
   queda exactamente un registro.

---

### User Story 3 - Acceso protegido y consulta de participantes (Priority: P2)

Una persona del equipo administrador inicia sesión en un panel protegido y ve la lista de participantes
registrados con el total, y puede buscar por nombre, celular o empresa/ocupación.

**Why this priority**: Permite supervisar la campaña y verificar que los registros llegan. Es requisito
previo para ejecutar el sorteo y exportar.

**Independent Test**: Intentar entrar al panel sin sesión (debe ser rechazado), iniciar sesión como
administrador, ver el listado y el conteo total, y filtrar con la búsqueda.

**Acceptance Scenarios**:

1. **Given** una persona sin sesión de administrador, **When** intenta abrir el panel o pedir sus
   datos, **Then** se le niega el acceso y no ve ningún dato de participantes.
2. **Given** un administrador con sesión iniciada, **When** abre el panel, **Then** ve el conteo total
   de participantes y el listado con nombres, celular, empresa u ocupación y fecha de registro.
3. **Given** un listado con varios participantes, **When** el administrador escribe un texto en la
   búsqueda, **Then** el listado muestra solo los participantes cuyo nombre, celular o empresa/ocupación
   coinciden (sin distinguir mayúsculas ni tildes) y el conteo refleja los resultados.
4. **Given** una búsqueda sin coincidencias, **When** se aplica, **Then** se muestra un mensaje de que
   no hay resultados.
5. **Given** que aún no hay participantes, **When** el administrador abre el panel, **Then** ve un
   estado vacío claro con conteo 0.
6. **Given** inscripciones abiertas, **When** el administrador las cierra desde el panel, **Then** el
   estado cambia a "cerradas" de inmediato y los nuevos envíos son rechazados; el administrador puede
   volver a abrirlas.
7. **Given** un visitante con el formulario ya abierto, **When** las inscripciones se cierran antes de
   que envíe, **Then** su envío es rechazado con el aviso de inscripciones cerradas y sus datos no se
   guardan.

---

### User Story 4 - Ejecutar el sorteo y registrar el resultado (Priority: P2)

El administrador indica cuántos ganadores quiere (uno o varios), ejecuta el sorteo y ve una animación
simple que termina mostrando a los ganadores elegidos al azar entre los participantes. El resultado
queda registrado de forma permanente.

**Why this priority**: Es el objetivo final de la campaña. Depende de que existan participantes
(Historias 1 y 3) pero es independiente de la exportación.

**Independent Test**: Con varios participantes cargados, ejecutar un sorteo de 1 ganador y otro de 3
ganadores. Se verifica la animación, que los ganadores pertenecen a los participantes, que no se
repiten y que el resultado queda guardado y consultable.

**Acceptance Scenarios**:

1. **Given** un administrador con participantes registrados, **When** indica N ganadores (N ≤ total de
   participantes elegibles) y ejecuta el sorteo, **Then** se muestra una animación simple y luego la
   lista de N ganadores distintos con sus datos.
2. **Given** un sorteo ejecutado, **When** termina, **Then** el resultado (ganadores, cantidad, fecha y
   hora, y administrador que lo ejecutó) queda registrado y puede consultarse después.
3. **Given** un número de ganadores mayor que los participantes elegibles, o menor que 1, **When** el
   administrador intenta ejecutar, **Then** se impide y se explica el límite.
4. **Given** un sorteo que ya tiene ganadores registrados, **When** el administrador ejecuta un nuevo
   sorteo, **Then** quienes ya ganaron no vuelven a ser elegidos y se pide confirmación antes de
   ejecutar.
5. **Given** que no hay participantes, **When** el administrador abre la sección de sorteo, **Then** la
   acción de sortear está deshabilitada con una explicación.
6. **Given** que el sorteo ya se ejecutó, **When** se recarga la página, **Then** el resultado sigue
   visible y no cambia.

---

### User Story 5 - Exportar la lista de participantes a CSV (Priority: P3)

El administrador descarga un archivo CSV con todos los participantes para respaldarlos o usarlos fuera
del sistema.

**Why this priority**: Es útil pero no bloquea el sorteo; se puede entregar después.

**Independent Test**: Con participantes registrados, pulsar exportar y abrir el archivo en una hoja de
cálculo; verificar que contiene a todos los participantes y que tildes y ñ se ven bien.

**Acceptance Scenarios**:

1. **Given** un administrador con sesión, **When** pulsa exportar, **Then** descarga un CSV con una fila
   por participante y las columnas nombres, celular, empresa u ocupación y fecha de registro.
2. **Given** participantes con tildes, ñ o comas en los datos, **When** se abre el CSV en una hoja de
   cálculo común, **Then** los caracteres y columnas se muestran correctamente.
3. **Given** valores que empiezan con `=`, `+`, `-` o `@`, **When** se exportan, **Then** no se
   interpretan como fórmulas al abrirse en una hoja de cálculo.
4. **Given** una búsqueda activa, **When** el administrador exporta, **Then** se exporta siempre la
   lista completa de participantes, no solo los resultados filtrados.
5. **Given** que no hay participantes, **When** se pulsa exportar, **Then** se informa que no hay datos
   para exportar.

---

### User Story 6 - Borrar los datos personales al terminar la campaña (Priority: P3)

Una vez entregado el premio, el administrador elimina del sistema los datos personales de todos los
participantes, de modo que no se conserven más tiempo del necesario para la finalidad declarada. Del
sorteo solo se conserva lo mínimo necesario para dejar constancia del resultado.

**Why this priority**: Es una obligación de privacidad (Ley 29733) al cierre de la campaña, pero no
bloquea el registro ni el sorteo.

**Independent Test**: Con participantes y un sorteo ejecutado, usar la acción de borrado y confirmar.
Se verifica que el listado queda vacío, que no se puede exportar ningún dato personal y que el registro
del sorteo conserva solo nombres de ganadores, fecha y cantidad.

**Acceptance Scenarios**:

1. **Given** un administrador con sesión, **When** elige borrar los datos de participantes, **Then**
   el sistema advierte que la acción es irreversible, sugiere exportar antes y exige una confirmación
   explícita.
2. **Given** la confirmación del administrador, **When** se completa el borrado, **Then** el listado
   queda vacío con conteo 0 y no queda ningún celular ni empresa u ocupación de participantes.
3. **Given** un sorteo ya registrado, **When** se borran los datos de participantes, **Then** el
   registro del sorteo conserva únicamente nombres completos de los ganadores, fecha y hora, y cantidad
   de ganadores.
4. **Given** que las inscripciones están abiertas, **When** el administrador intenta borrar los datos,
   **Then** se le pide cerrar primero las inscripciones.
5. **Given** una persona sin sesión de administrador, **When** intenta ejecutar el borrado, **Then** se
   le niega el acceso y no se elimina nada.

---

### Edge Cases

- Celular escrito con espacios, guiones o prefijo `+51` / `51`: se normaliza antes de validar y de
  comparar duplicados.
- Nombres con tildes, ñ y diéresis (p. ej. "José Núñez Güemes") son válidos; nombres con números o
  símbolos no lo son.
- Espacios sobrantes al inicio, al final o repetidos se limpian antes de validar y guardar.
- Doble toque en "Enviar" o reenvío desde la pantalla de confirmación: no genera registros dobles.
- Pérdida de conexión al enviar: el visitante ve un mensaje claro y puede reintentar sin perder lo que
  escribió.
- Intento de enviar datos saltándose el formulario (validaciones solo del lado del visitante): el
  sistema también valida y rechaza datos inválidos.
- Intentos masivos o automatizados de registro: el sistema los limita sin afectar a participantes
  legítimos.
- Sesión del administrador vencida durante una acción: se le pide iniciar sesión de nuevo sin perder el
  resultado de un sorteo ya registrado.
- Dos administradores ejecutan el sorteo a la vez: no se registran resultados contradictorios ni
  ganadores repetidos.
- Exportación con muchos registros (miles): se completa sin truncar datos.
- Un administrador cierra las inscripciones justo cuando un visitante envía: el envío se acepta solo si
  se recibió antes del cierre; nunca queda un registro parcial.

## Requirements *(mandatory)*

### Functional Requirements

**Registro de participantes**

- **FR-001**: El sistema MUST mostrar una página principal con el logo y la identidad visual de la
  empresa, optimizada para uso desde celular.
- **FR-002**: El sistema MUST ofrecer un formulario con tres campos obligatorios: nombres completos,
  celular y empresa u ocupación.
- **FR-003**: El sistema MUST validar que los nombres contengan al menos nombre y apellido (dos o más
  términos) formados solo por letras, espacios y tildes, con una longitud máxima de 100 caracteres.
- **FR-004**: El sistema MUST validar que el celular sea un número peruano de 9 dígitos que empiece con
  9, aceptando entrada con espacios, guiones o prefijo `+51`/`51` y guardándolo en un formato
  normalizado único.
- **FR-005**: El sistema MUST aceptar texto libre en empresa u ocupación con una longitud mínima de 2 y
  máxima de 100 caracteres.
- **FR-006**: El sistema MUST mostrar, antes del envío, la finalidad del tratamiento de datos
  personales (participar en el sorteo y contactar a los ganadores) y un casillero de consentimiento
  explícito, obligatorio y sin marcar por defecto, con acceso al texto completo de la política.
- **FR-007**: El sistema MUST impedir el registro si el consentimiento no fue aceptado.
- **FR-008**: El sistema MUST guardar, junto con cada registro, la evidencia del consentimiento (fecha y
  hora, y versión del texto aceptado) y la fecha y hora del registro.
- **FR-009**: El sistema MUST validar todos los datos también al recibirlos, sin depender de la
  validación del lado del visitante.
- **FR-010**: El sistema MUST mostrar mensajes de error en español, claros y asociados al campo
  correspondiente, y conservar lo ya escrito cuando haya errores.
- **FR-011**: El sistema MUST mostrar una pantalla de confirmación cuando el registro se complete.
- **FR-012**: El sistema MUST impedir más de un registro por celular normalizado y, ante un intento
  repetido, informar al visitante que ya está participando sin revelar datos del registro existente.
- **FR-013**: El sistema MUST aceptar un registro solo si incluye una verificación de que la solicitud
  proviene de la aplicación y no de un programa automatizado, válida para un único uso; las
  solicitudes sin ella, inválidas o repetidas MUST ser rechazadas.
- **FR-014**: Un visitante MUST NOT poder consultar, listar ni modificar registros de otros
  participantes ni los propios después de enviarlos.
- **FR-028**: El sistema MUST mantener un estado de inscripciones (abiertas o cerradas), inicialmente
  abiertas. Con las inscripciones cerradas, la página principal MUST mostrar un aviso en lugar del
  formulario y el sistema MUST rechazar cualquier envío, también al recibirlo.
- **FR-029**: El sistema MUST permitir al administrador cerrar y volver a abrir las inscripciones
  manualmente desde el panel, mostrando siempre el estado actual.

**Panel de administrador**

- **FR-015**: El sistema MUST proteger el panel con inicio de sesión; solo cuentas de administrador
  autorizadas pueden acceder al panel y a sus datos.
- **FR-016**: El sistema MUST mostrar al administrador el conteo total de participantes y un listado con
  nombres, celular, empresa u ocupación y fecha de registro, ordenado por el más reciente primero. Con más de 50 participantes, el listado MUST mostrarse paginado
  (50 por página) mostrando siempre el conteo total.
- **FR-017**: El sistema MUST permitir buscar en el listado por nombre, celular o empresa/ocupación, sin
  distinguir mayúsculas ni tildes, y mostrar cuántos resultados coinciden.
- **FR-018**: El sistema MUST permitir exportar la lista de participantes a un archivo CSV legible en
  hojas de cálculo comunes (tildes y ñ correctas) y protegido contra interpretación de fórmulas.
- **FR-019**: El sistema MUST permitir al administrador elegir cuántos ganadores sortear (mínimo 1,
  máximo el número de participantes elegibles).
- **FR-020**: El sistema MUST seleccionar a los ganadores al azar, con igual probabilidad para cada
  participante elegible y sin repetir ganadores en un mismo sorteo.
- **FR-021**: El sistema MUST mostrar una animación simple durante el sorteo; la animación no debe
  influir en quiénes resultan ganadores, que se determinan antes de mostrarlos.
- **FR-022**: El sistema MUST registrar de forma permanente cada sorteo: ganadores, cantidad, fecha y
  hora, y administrador que lo ejecutó; y permitir consultarlo después.
- **FR-023**: El sistema MUST excluir de sorteos posteriores a quienes ya hayan sido registrados como
  ganadores, y pedir confirmación antes de ejecutar un nuevo sorteo si ya existen ganadores.
- **FR-024**: El sistema MUST tratar los datos personales solo para la finalidad declarada y no
  mostrarlos a quien no sea administrador.
- **FR-030**: El sistema MUST permitir al administrador borrar de forma definitiva todos los datos de
  participantes desde el panel, solo con las inscripciones cerradas, advirtiendo que es irreversible y
  exigiendo confirmación explícita.
- **FR-031**: Tras el borrado, el sistema MUST conservar del sorteo únicamente los nombres completos de
  los ganadores, la fecha y hora, y la cantidad de ganadores; el celular y la empresa u ocupación de
  todos los participantes, incluidos los ganadores, MUST eliminarse.
- **FR-032**: El texto de finalidad mostrado en el formulario MUST indicar que los datos se eliminarán
  al terminar la campaña, una vez entregado el premio.

**Identidad visual y accesibilidad**

- **FR-025**: El sistema MUST usar en toda la interfaz la paleta de colores extraída del logo de la
  empresa (`logo.svg`) y mostrar el logo en la página principal y en el panel.
- **FR-026**: Toda la interfaz y todos los mensajes MUST estar en español (Perú).
- **FR-027**: Los campos del formulario MUST tener etiquetas visibles y los textos MUST tener contraste
  suficiente para leerse con claridad en un celular al aire libre.

### Key Entities *(include if feature involves data)*

- **Participante**: Persona registrada en el sorteo. Atributos: nombres completos, celular normalizado
  (identificador único), empresa u ocupación, fecha y hora de registro, evidencia de consentimiento
  (fecha/hora y versión del texto aceptado).
- **Ronda de sorteo**: Ejecución del sorteo (cada vez que el administrador sortea). Atributos: fecha y
  hora, cantidad de ganadores solicitada, administrador que la ejecutó. Se relaciona con uno o más
  Ganadores. (En el resto del documento, «sorteo» o «campaña» designa el evento completo y «ronda de
  sorteo» cada ejecución.)
- **Ganador**: Participante elegido en una Ronda de sorteo. Se relaciona con un Participante y con una
  Ronda de sorteo; un Participante gana como máximo una vez. Tras el borrado de datos solo se conserva
  su nombre completo.
- **Estado de inscripciones**: Condición única de la campaña vigente (abiertas o cerradas) que controla
  si se aceptan nuevos registros; solo el Administrador la cambia.
- **Administrador**: Persona autorizada del equipo de la empresa para ver participantes, exportar y
  ejecutar el sorteo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un participante nuevo completa el registro (desde que abre la página hasta ver la
  confirmación) en menos de 1 minuto.
- **SC-002**: Al menos el 95 % de los participantes que intentan registrarse con datos válidos lo logran
  en el primer intento.
- **SC-003**: La página de registro se muestra lista para usar en menos de 3 segundos en una conexión
  móvil lenta.
- **SC-004**: Cero registros duplicados por celular, incluso cuando el mismo número se escribe con
  distinto formato o se envía varias veces seguidas.
- **SC-005**: El 100 % de los intentos de acceso al panel o a los datos sin sesión de administrador son
  rechazados.
- **SC-006**: El administrador encuentra a un participante concreto con la búsqueda en menos de 10
  segundos.
- **SC-007**: El administrador completa un sorteo (elegir cantidad, ejecutar y ver ganadores) en menos de
  1 minuto, y el 100 % de los ganadores mostrados son participantes registrados y distintos entre sí.
- **SC-008**: La exportación contiene exactamente tantas filas como participantes registrados, sin
  caracteres dañados.
- **SC-009**: Todos los participantes que envían el formulario ven una confirmación o un mensaje de error
  comprensible en español; ningún envío termina en una pantalla en blanco o sin respuesta.
- **SC-010**: Con hasta 5 000 participantes registrados, el listado, la búsqueda, la exportación a CSV y
  el sorteo se completan sin truncar datos, y la búsqueda muestra resultados en menos de 2 segundos.
- **SC-011**: Tras el borrado de datos, el 0 % de celulares y empresas u ocupaciones de participantes
  permanece accesible desde el panel, la exportación o el registro del sorteo.
- **SC-012**: El 0 % de los registros se acepta sin una verificación válida de un solo uso.

## Assumptions

- Los participantes usan principalmente celulares con navegador moderno y conexión móvil variable.
- Se esperan hasta 5 000 participantes en total; el sistema no necesita dimensionarse para volúmenes
  mayores en esta versión.
- El código QR que apunta a la página principal se genera y se imprime fuera de esta funcionalidad.
- Solo hay un sorteo vigente a la vez (los múltiples sorteos simultáneos están fuera de alcance), pero
  se pueden ejecutar varias rondas sucesivas; los ganadores de rondas anteriores quedan excluidos.
- Las inscripciones empiezan abiertas y solo el administrador las cierra o reabre, de forma manual; no
  hay cierre programado por fecha ni cierre automático al sortear.
- Las cuentas de administrador son pocas y las crea de antemano el equipo técnico; no hay
  autoregistro de administradores ni recuperación de cuenta propia en esta versión.
- La paleta se extrae de `logo.svg`, que contiene dos colores: azul `#3d8cd3` y blanco `#ffffff`. El
  logo es blanco con acentos azules, por lo que se usa sobre fondos oscuros; los colores derivados
  (fondos, texto, estados de error y éxito) se definirán a partir de esos dos manteniendo contraste
  suficiente.
- Se admiten solo letras, espacios y tildes en nombres, tal como se pidió; guiones y apóstrofes no se
  aceptan en esta versión.
- El texto de consentimiento y la política de privacidad los proporciona la empresa; la versión
  inicial del texto se define antes de la publicación.
- Los datos se conservan durante la campaña y el tiempo necesario para entregar el premio; después, el
  administrador los borra manualmente desde el panel. No hay borrado automático ni atención de
  solicitudes individuales de eliminación (derechos ARCO) dentro del sistema en esta versión; se
  atienden fuera de él.
- Un premio por persona: un participante no puede ganar más de una vez.
- Quedan fuera de alcance por ahora: pagos, verificación por SMS (el celular no se verifica) y
  múltiples sorteos simultáneos.
- Se aplican las reglas de la constitución del proyecto (privacidad Ley 29733, seguridad, accesibilidad
  y rendimiento móvil).
