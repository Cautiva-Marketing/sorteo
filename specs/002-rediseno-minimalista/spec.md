# Feature Specification: Rediseño minimalista y simplificación del registro

**Feature Branch**: `002-rediseno-minimalista`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "Quiero quitar "Acepto el tratamiento de mis datos personales...", politica de privacidad, y esas cosas, tambien el codigo reCAPTCHA. Además, la UI no se parece a la web del ejemplo https://sorteo.terrabellainternacional.com/?view=registro (capturas del formulario, del mensaje de bienvenida y de la pantalla con el código QR). La web de la empresa que organiza el sorteo es https://cautivamarketing.com/, pero quiero un diseño super minimalista, usando blanco y negro, y la tipografica de la web de cautivamarketing. Hazme preguntas si tienes dudas. Tambien usa el logo y los colores de CautivaMarketing, pero mantenlo super minimalista. Puedes revisar el repo del proyecto de referencia (Sistema de Registro y Sorteo Ozarel)."

Esta especificación es un **delta sobre la feature 001** (`specs/001-registro-sorteo/spec.md`): todo lo
que no se menciona aquí se mantiene como estaba en la 001 (duplicados por celular, cierre de
inscripciones, sorteo, exportación a CSV, borrado de datos, acceso protegido del panel).

## Clarifications

### Session 2026-10-22

- Q: Quitar el consentimiento y la política de privacidad contradice el principio IV de la constitución
  (Ley 29733). ¿Cómo se maneja? → A: Se quita todo (casillero, página de privacidad, evidencia de
  consentimiento y textos legales) y se enmienda la constitución. El cumplimiento legal queda a cargo
  de la empresa, fuera del sistema.
- Q: Sin reCAPTCHA desaparece la única protección contra registros automatizados. ¿Qué la reemplaza?
  → A: Nada. El registro queda sin verificación anti-spam y se enmienda la constitución.
- Q: ¿Qué campos tiene el formulario? → A: Se mantienen los tres actuales: nombres completos, celular y
  empresa u ocupación (el ejemplo pedía nombres y documento de identidad; aquí no).
- Q: Además del formulario, ¿qué piezas del ejemplo se incorporan? → A: La pantalla con el código QR y
  el contador de registrados, el mensaje de bienvenida al registrarse, y el mismo estilo visual en el
  panel de administración.
- Q: ¿Qué logo y qué colores se usan? → A: El logo y los colores de Cautiva Marketing, en un diseño muy
  minimalista: base blanco y negro, el azul del logo como único acento y, para el logo, el ícono «ti»
  junto al texto «cautiva marketing» en negro (versión para fondo claro).
- Q: ¿Qué tipografía se usa? → A: La de cautivamarketing.com: Space Grotesk para títulos y Inter para
  el resto del texto.
- Q: ¿Qué ve una persona que abre en su celular la dirección raíz del sitio: la pantalla del QR o el
  formulario? → A: La raíz siempre muestra la pantalla del QR con el contador (como el ejemplo); el
  formulario tiene su propia dirección y se llega a él con el QR o con el botón «Registrarme desde
  este dispositivo».
- Q: ¿La tarjeta de ticket de la ventana de bienvenida muestra el celular completo o parcialmente
  oculto? → A: El celular completo, para que el participante confirme que lo escribió bien.
- Q: ¿Qué se entiende por «pantalla grande» y por QR legible a cierta distancia? → A: La pantalla de
  referencia es de 40 pulgadas Full HD (1920×1080). Con la pantalla del QR en una sola columna, el símbolo
  del QR (sin contar su margen blanco) es lo más grande que quepa sin desplazarse y debe medir al menos
  21 cm de lado (≈ 450 px en esa pantalla), legible desde unos 2 metros. (Antes: 30 cm y 3 metros, con dos
  columnas.)
- Q: ¿Cómo se ordena la pantalla del QR en pantallas grandes? → A: En una sola columna en todos los
  tamaños, como el ejemplo: logo, título, frase, tarjeta con el QR y el contador, y el botón debajo; no se
  usan dos columnas.
- Q: ¿Cómo se vuelve a la pantalla principal desde el formulario? → A: Con un enlace «Volver a la pantalla
  principal» bajo el botón de envío, dentro de la tarjeta, y también bajo el aviso de gracias y el de
  inscripciones cerradas.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrarse con un formulario limpio y sin trámites legales (Priority: P1)

Una persona abre el formulario en su celular y ve una página casi vacía: el logo de Cautiva, el título
«Regístrate en el sorteo», una frase corta y una tarjeta con tres campos y un botón negro. No hay casillero
de consentimiento, ni enlaces a políticas, ni avisos de reCAPTCHA. Llena los tres campos, toca el botón y
queda registrada.

**Why this priority**: Es el núcleo del producto y el cambio principal que se pide. Por sí sola ya deja
un formulario usable, con la nueva imagen y sin pasos legales.

**Independent Test**: Abrir el formulario en un celular de 360 px de ancho, completar los tres campos con
datos válidos y enviar. Se verifica que no aparece ningún casillero, enlace legal ni mención a reCAPTCHA,
que el envío funciona sin ninguna verificación adicional y que el participante queda guardado.

**Acceptance Scenarios**:

1. **Given** un visitante en el formulario, **When** lo abre, **Then** ve el logo de Cautiva, el título,
   una frase corta, tres campos con etiqueta visible y un botón negro a todo el ancho, sobre fondo blanco.
2. **Given** el formulario, **When** se revisa toda la página, **Then** no aparece ningún casillero de
   consentimiento, enlace a política de privacidad, texto de finalidad del tratamiento de datos ni
   atribución o insignia de reCAPTCHA.
3. **Given** los tres campos con datos válidos, **When** el visitante envía, **Then** el registro se
   guarda sin pedir ninguna aceptación ni verificación adicional y se muestra el mensaje de bienvenida
   (Historia 2).
4. **Given** un campo vacío o inválido, **When** el visitante intenta enviar, **Then** no se registra y se
   indica junto al campo qué debe corregir, con las mismas reglas de validación de la feature 001
   (nombres con nombre y apellido, celular peruano de 9 dígitos, empresa u ocupación de 2 a 100
   caracteres).
5. **Given** que alguien visita la dirección antigua de la política de privacidad, **When** la abre,
   **Then** ve la página de «no encontrado» y no un texto legal.
6. **Given** el campo enfocado, **When** el visitante lo toca, **Then** el campo muestra un indicador
   claro de foco que usa el azul del logo.
7. **Given** que el administrador cerró las inscripciones, **When** un visitante abre el formulario,
   **Then** ve el logo y un aviso de «inscripciones cerradas» con el mismo estilo, sin formulario.
8. **Given** el formulario, **When** se muestra, **Then** bajo el botón de envío hay un enlace «Volver a la
   pantalla principal» que lleva a la pantalla del QR; el mismo enlace aparece bajo el aviso de gracias y
   bajo el aviso de inscripciones cerradas.

---

### User Story 2 - Ver un mensaje de bienvenida al registrarse (Priority: P1)

Al terminar el registro aparece, sobre el formulario oscurecido, una ventana con confeti en blanco y
negro, el mensaje «¡Bienvenido(a)!», el nombre del participante, una tarjeta tipo ticket con el celular
registrado y el estado «En sorteo», y dos botones: «Listo, muchas gracias» y «Registrar a otra persona».
La segunda opción deja el formulario vacío para que otra persona se registre en el mismo dispositivo
(por ejemplo, en un stand atendido por una persona del equipo).

**Why this priority**: Reemplaza a la antigua pantalla de confirmación (FR-011 de la 001) y es lo que el
participante recuerda al terminar. También permite el registro asistido en un mismo dispositivo.

**Independent Test**: Registrar un participante, verificar que aparece la ventana con su nombre y celular,
tocar «Registrar a otra persona» y comprobar que el formulario queda vacío; repetir y tocar «Listo,
muchas gracias».

**Acceptance Scenarios**:

1. **Given** un registro completado, **When** se guarda, **Then** aparece una ventana de bienvenida con
   el ícono de Cautiva, «¡Bienvenido(a)!», el nombre completo del participante y el texto de que ya está
   participando.
2. **Given** la ventana de bienvenida, **When** se muestra, **Then** incluye una tarjeta de ticket con
   el celular registrado completo (los 9 dígitos, sin ocultar ninguno) y el estado «En sorteo».
3. **Given** la ventana de bienvenida, **When** el visitante toca «Registrar a otra persona», **Then** la
   ventana se cierra y el formulario aparece vacío y listo para un nuevo registro.
4. **Given** la ventana de bienvenida, **When** el visitante toca «Listo, muchas gracias», **Then** la
   ventana se cierra y se muestra una pantalla final sencilla con el logo y el mensaje de
   agradecimiento, sin dejar el formulario con datos de la persona anterior.
5. **Given** un dispositivo con la preferencia de reducir movimiento, **When** aparece la ventana,
   **Then** el confeti y las animaciones no se muestran o se reducen al mínimo.
6. **Given** un celular ya registrado, **When** alguien lo envía de nuevo, **Then** aparece una ventana
   del mismo estilo que informa que ya está participando, sin revelar datos del registro existente y
   con la misma opción de «Registrar a otra persona».
7. **Given** un nombre muy largo (hasta 100 caracteres), **When** se muestra la ventana, **Then** el
   nombre se ajusta en varias líneas sin desbordar ni romper el diseño.
8. **Given** la ventana abierta, **When** se usa solo el teclado o un lector de pantalla, **Then** el
   foco queda dentro de la ventana, se puede cerrar con el teclado y el contenido se anuncia.

---

### User Story 3 - Mostrar una pantalla con QR y contador para proyectar en el evento (Priority: P2)

El equipo proyecta en una pantalla grande (o imprime) una página con el logo, el título «Regístrate y
participa en el sorteo», un código QR que lleva al formulario, un contador de personas registradas que se
actualiza solo, y un botón «Registrarme desde este dispositivo» para quien no quiere escanear.

**Why this priority**: Es la puerta de entrada del evento y le da vida a la campaña con el contador en
vivo. No bloquea el registro (el formulario sigue siendo accesible por enlace directo).

**Independent Test**: Abrir la página principal en una pantalla grande, verificar el QR y el contador;
escanear el QR con un celular y llegar al formulario; registrar a alguien y comprobar que el contador sube
sin recargar la pantalla proyectada.

**Acceptance Scenarios**:

1. **Given** la página principal, **When** se abre, **Then** muestra, en una sola columna y en este orden, el logo,
   el título, una frase corta, una tarjeta con un código QR con el ícono «ti» al centro y el contador, y
   debajo el botón «Registrarme desde este dispositivo».
2. **Given** el código QR, **When** se escanea con un celular, **Then** abre directamente el formulario
   de registro.
3. **Given** la pantalla abierta, **When** se registra un participante nuevo, **Then** el contador sube
   en menos de 5 segundos sin recargar la página.
4. **Given** 0 o 1 registrados, **When** se muestra el contador, **Then** el texto es coherente
   («0 registrados», «1 registrado»).
5. **Given** que el contador es público, **When** se revisa, **Then** muestra solo un número, sin nombres
   ni celulares ni ningún otro dato de los participantes.
6. **Given** que el administrador cerró las inscripciones, **When** se abre la pantalla, **Then** en
   lugar del QR y del botón se muestra el aviso de inscripciones cerradas, y el contador final sigue
   visible.
7. **Given** la pantalla de referencia (40 pulgadas Full HD, 1920×1080) y un celular de 360 px, **When**
   se abre la página, **Then** el diseño sigue en una sola columna sin desbordes y, en la pantalla de
   referencia, el símbolo del QR mide al menos 21 cm de lado (≈ 450 px) y toda la página cabe sin
   desplazarse, lo que permite escanearlo desde unos 2 metros.
8. **Given** el botón «Registrarme desde este dispositivo», **When** se toca, **Then** lleva al
   formulario de la Historia 1.
9. **Given** una persona que abre la dirección raíz en su celular, **When** carga la página, **Then**
   ve la pantalla del QR con el botón «Registrarme desde este dispositivo» y no el formulario; el
   diseño se ve completo y usable en esa pantalla pequeña.

---

### User Story 4 - Panel de administración con el mismo estilo (Priority: P3)

El administrador ve el panel (listado, búsqueda, exportación, sorteo, cierre de inscripciones y borrado)
con la misma imagen minimalista: fondo blanco, texto negro, la tipografía de Cautiva, el logo en versión
para fondo claro y el azul solo como acento.

**Why this priority**: Da coherencia visual a toda la aplicación, pero no cambia lo que se puede hacer;
puede entregarse al final.

**Independent Test**: Iniciar sesión como administrador y recorrer cada sección del panel verificando
que usa el nuevo estilo y que todas las funciones de la 001 siguen funcionando.

**Acceptance Scenarios**:

1. **Given** la pantalla de inicio de sesión del administrador, **When** se abre, **Then** usa el mismo
   estilo (logo, tipografía, botón negro) que el formulario.
2. **Given** un administrador con sesión, **When** recorre el listado, la búsqueda, la exportación, el
   sorteo, el cierre de inscripciones y el borrado, **Then** cada sección usa el nuevo estilo y se
   comporta exactamente como en la feature 001.
3. **Given** el panel, **When** se revisa, **Then** el logo aparece en versión para fondo claro y todos
   los textos cumplen el contraste exigido (FR-036).
4. **Given** la sección de borrado de datos, **When** se muestra, **Then** sigue pidiendo cerrar
   inscripciones, advertir que es irreversible y confirmar de forma explícita.

---

### Edge Cases

- Un visitante abre un enlace antiguo con el casillero de consentimiento marcado o la política de
  privacidad: la página ya no existe y nada de eso se pide ni se guarda.
- Registros creados antes de este cambio que tienen evidencia de consentimiento guardada: siguen siendo
  válidos y siguen apareciendo en el listado, el CSV y el sorteo; esa evidencia ya no se muestra ni se
  exige.
- Sin protección anti-spam, alguien puede enviar muchos registros falsos: se acepta como riesgo conocido
  (ver Supuestos); el administrador puede revisar y borrar los datos con las herramientas existentes.
- El contador sube en una pantalla proyectada mientras el administrador cierra las inscripciones: el
  aviso de cierre aparece y el número final se mantiene.
- Pérdida de conexión en la pantalla proyectada: el contador conserva el último valor conocido y se
  reanuda al recuperar la conexión, sin mostrar errores técnicos.
- Un participante toca «Registrar a otra persona» y la persona anterior no debe poder ver los datos
  escritos antes: el formulario queda completamente vacío.
- Una persona abre en su celular un enlace a la raíz (por ejemplo, un QR impreso con la dirección
  antigua): ve la pantalla del QR y llega al formulario con el botón, sin perder el contexto.
- Participante que ya se registró y vuelve a escanear el QR: ve el formulario, y si usa el mismo
  celular recibe el aviso de «ya estás participando».
- Pantallas muy pequeñas (360 px) y muy grandes (televisor): el diseño no se desborda ni requiere
  desplazamiento horizontal.
- Usuarios con reducción de movimiento activada: no ven confeti ni animaciones que se repitan.

## Requirements *(mandatory)*

### Functional Requirements

**Cambios sobre la feature 001: requisitos eliminados**

- **FR-006, FR-007, FR-008, FR-032 (de la 001)**: Quedan eliminados. El sistema no muestra finalidad del
  tratamiento de datos, casillero de consentimiento, aviso sobre la eliminación al terminar la campaña
  ni enlace a política, y no exige ni guarda consentimiento.
- **FR-013 y SC-012 (de la 001)**: Quedan eliminados. El registro no exige ninguna verificación
  anti-automatización.
- Los escenarios 1.1 (en lo relativo al consentimiento) y 1.4 de la Historia 1 de la 001 dejan de
  aplicar.

**Registro de participantes**

- **FR-033**: El sistema MUST NOT mostrar en ninguna pantalla pública casillero de consentimiento,
  texto de finalidad del tratamiento de datos, enlace a política de privacidad, ni insignia o
  atribución de reCAPTCHA.
- **FR-034**: El sistema MUST aceptar el registro con solo los tres campos (nombres completos, celular,
  empresa u ocupación), aplicando las mismas validaciones y la misma regla de un registro por celular
  de la feature 001, sin requerir verificación adicional.
- **FR-035**: La página pública del formulario MUST mostrar, en este orden: logo, título «Regístrate en
  el sorteo», frase corta, tarjeta con los tres campos (etiqueta visible, con un ícono discreto) y un
  botón de envío a todo el ancho, y un pie de página con el nombre «Cautiva Marketing». Reemplaza el
  orden de la página principal de FR-001 de la 001.
- **FR-036**: Todo el texto MUST cumplir un contraste mínimo de 4,5:1 (3:1 en texto grande y componentes
  de interfaz), también en el panel; el azul del logo MUST usarse como texto solo si cumple ese
  contraste.

**Mensaje de bienvenida (reemplaza FR-011 de la 001)**

- **FR-037**: Al completarse un registro, el sistema MUST mostrar una ventana de bienvenida que incluya
  el ícono de Cautiva, «¡Bienvenido(a)!», el nombre completo del participante y un texto de que ya está
  participando.
- **FR-038**: La ventana MUST incluir una tarjeta de ticket con el celular registrado, completo y sin
  ocultar dígitos, y el estado «En sorteo».
- **FR-039**: La ventana MUST ofrecer dos acciones: «Listo, muchas gracias» (cierra la ventana y muestra
  una pantalla final sencilla de agradecimiento) y «Registrar a otra persona» (cierra la ventana y deja
  el formulario completamente vacío).
- **FR-040**: Ante un celular ya registrado, el sistema MUST mostrar una ventana del mismo estilo que
  informa que ya está participando, sin revelar datos del registro existente y con la acción «Registrar
  a otra persona».
- **FR-041**: La ventana MUST incluir confeti en blanco y negro solo cuando el dispositivo no pide
  reducir el movimiento; MUST ser accesible con teclado y lector de pantalla (foco contenido dentro de la
  ventana, cierre con el teclado y contenido anunciado).

**Pantalla con QR y contador**

- **FR-042**: La página principal (la dirección raíz del sitio, para cualquier dispositivo) MUST
  mostrar el logo, el título «Regístrate y participa en el
  sorteo», una frase corta, un código QR que abre el formulario de registro (con el ícono «ti» al
  centro), el contador de registrados y el botón «Registrarme desde este dispositivo».
- **FR-043**: El contador MUST reflejar el número de participantes registrados, actualizarse en menos de
  5 segundos tras un nuevo registro sin recargar la página, y usar el singular cuando hay exactamente
  un registrado.
- **FR-044**: El contador público MUST mostrar únicamente el total, sin exponer ningún dato de los
  participantes.
- **FR-045**: Con las inscripciones cerradas, la página principal MUST mostrar el aviso de cierre en
  lugar del QR y del botón, manteniendo visible el total de registrados.
- **FR-046**: La página principal MUST ir en una sola columna en todos los tamaños (logo, título, frase,
  tarjeta con el QR y el contador, y el botón debajo) y adaptarse sin desbordes desde celulares de 360 px
  hasta pantallas grandes. El QR MUST ser lo más grande que permita el alto de la pantalla sin exigir
  desplazamiento y, en una pantalla de 40 pulgadas Full HD (1920×1080), su símbolo MUST medir al menos
  21 cm de lado (≈ 450 px), legible desde unos 2 metros.
- **FR-047**: El formulario MUST tener su propia dirección, distinta de la raíz. El QR y el botón de la
  página principal MUST llevar a esa dirección, que también puede compartirse como enlace directo. La
  dirección raíz MUST NOT mostrar el formulario.

**Identidad visual (modifica FR-025 de la 001)**

- **FR-048**: Toda la interfaz pública y el panel MUST usar una base blanca y negra (fondo blanco, texto
  casi negro, grises neutros para elementos secundarios y bordes finos) con el azul del logo de Cautiva
  como único color de acento, reservado a detalles mínimos (por ejemplo: foco de campos, punto del
  contador, ícono del ticket). No se usan otros colores de acento salvo los de error y éxito, necesarios
  para entender el estado.
- **FR-049**: El logo MUST mostrarse en su versión para fondo claro (ícono «ti» y texto «cautiva
  marketing» en negro) en la página principal, el formulario, la ventana de bienvenida y el panel; el
  ícono «ti» solo se usa donde el espacio es reducido (centro del QR, ventana de bienvenida).
- **FR-050**: Los títulos MUST usar la tipografía Space Grotesk y el resto del texto la tipografía Inter,
  las mismas de cautivamarketing.com, con texto de respaldo legible si no cargan.
- **FR-051**: El diseño MUST ser minimalista: mucho espacio en blanco, bordes finos en lugar de sombras
  marcadas, botones negros con texto blanco en mayúsculas y sin imágenes decorativas ni fondos de color.
- **FR-052**: El sistema MUST aplicar el mismo estilo (FR-048 a FR-051) al panel de administración, sin
  modificar sus funciones.
- **FR-053**: La página del formulario MUST ofrecer un enlace «Volver a la pantalla principal» (con una flecha
  hacia la izquierda) que lleve a la pantalla del QR: bajo el botón de envío, dentro de la tarjeta, y también
  bajo el aviso de gracias y bajo el de inscripciones cerradas. El enlace MUST ser discreto (texto gris
  pequeño), accesible con teclado y con contraste suficiente (FR-036).

### Key Entities *(include if feature involves data)*

- **Participante**: Igual que en la 001, pero ya no tiene evidencia de consentimiento (fecha y hora, y
  versión del texto aceptado). Los registros anteriores que la tengan la conservan sin usarla.
- **Estado de inscripciones**: Sin cambios; ahora también determina si la página principal muestra el
  QR o el aviso de cierre.
- **Contador de registrados**: Total público de participantes. No es una entidad nueva: se deriva de los
  participantes y no expone datos personales.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-013**: Un participante completa el registro, desde que abre el formulario hasta ver la
  bienvenida, en menos de 30 segundos.
- **SC-014**: El 100 % de las pantallas públicas está libre de casillero de consentimiento, enlace de
  privacidad y mención o insignia de reCAPTCHA.
- **SC-015**: El contador de la pantalla proyectada muestra un nuevo registro en menos de 5 segundos, sin
  recargar la página.
- **SC-016**: Un celular promedio escanea el QR de la pantalla de referencia (40 pulgadas Full HD, símbolo del
  QR de al menos 450 px) a unos 2 metros en el primer intento en al menos 9 de cada 10 pruebas.
- **SC-017**: El 100 % del texto de la interfaz, pública y del panel, cumple el contraste mínimo
  exigido.
- **SC-018**: El 100 % de las pantallas (página principal, formulario, bienvenida, aviso de ya registrado,
  aviso de cierre, inicio de sesión y panel) usa el mismo estilo: base blanca y negra, azul solo como
  acento, y las tipografías de Cautiva.
- **SC-019**: La página del formulario sigue cargando lista para usar en menos de 3 segundos en una
  conexión móvil lenta (se mantiene SC-003 de la 001).
- **SC-020**: Las funciones de la feature 001 que no se tocan (duplicados por celular, cierre de
  inscripciones, listado, búsqueda, CSV, sorteo, borrado) siguen cumpliendo sus criterios de éxito
  originales.

## Assumptions

- La empresa asume la responsabilidad legal de recolectar datos sin consentimiento explícito en el
  sistema (Ley 29733) y de informar a los participantes por otros medios si lo requiere; esto queda fuera
  del sistema. La constitución del proyecto debe enmendarse para reflejarlo antes de planificar.
- Se acepta que el registro quede sin protección anti-spam, con el riesgo de registros automatizados o
  falsos; el administrador cuenta con las herramientas existentes para revisar y borrar los datos.
- La constitución del proyecto debe enmendarse antes de `/speckit-plan`. Principios afectados: III
  (protección anti-spam), IV (consentimiento y evidencia), V (paleta: blanco y negro con el azul del logo
  como acento, y logo en versión para fondo claro en lugar de «solo sobre fondo oscuro») y VI (la prueba
  E2E ya no incluye «envío sin consentimiento»).
- El logo para fondo claro se obtiene del logo actual de Cautiva (texto blanco pasa a casi negro, se
  mantienen los acentos azules) junto con el ícono «ti» publicado en cautivamarketing.com; si la empresa
  entrega una versión oficial para fondo claro, se usa esa.
- Los colores de referencia salen del logo de Cautiva: azul `#0A70BB` (contraste de unos 5,2:1 sobre
  blanco, apto para texto) y azul claro `#3D8CD3` (contraste de unos 3,6:1, solo para elementos no
  textuales); el negro de referencia es `#0A0A0A`. No se usan el verde lima ni el crema de la web.
- Las tipografías Space Grotesk (títulos) e Inter (texto) son las que usa cautivamarketing.com.
- La ventana de bienvenida muestra el celular completo porque quien se registra acaba de escribirlo;
  solo está en esa ventana, nunca en el contador ni en ninguna pantalla pública.
- El supuesto de la 001 de que el QR impreso apunta a la página principal ya no aplica: cualquier QR o
  enlace externo que se difunda debe apuntar a la dirección del formulario, no a la raíz. La pantalla
  del QR de la propia aplicación ya apunta a ella.
- Regla práctica para el tamaño del QR: un celular lee un QR a una distancia de unas 10 veces su lado;
  para 2 m hacen falta ≈ 21 cm. En una pantalla de 40 pulgadas Full HD (≈ 0,046 cm por píxel) eso son
  ≈ 450 px. Con una sola columna y sin desplazamiento, el QR llega a ≈ 500 px a 1920×1080.
- El contador público es un dato agregado sin información personal; mostrar el total a cualquier
  visitante es aceptable para la campaña.
- El diseño de referencia del ejemplo (La Toscana / Terrabella) se usa solo como guía de estructura y
  flujo; no se copian su marca ni sus textos.
- No hay aún datos reales de participantes, por lo que el cambio no requiere migrar ni limpiar registros.
- Se mantiene todo lo demás de la feature 001, incluido el límite de hasta 5 000 participantes, un
  premio por persona, un solo sorteo vigente y la exclusión de pagos y verificación por SMS.
