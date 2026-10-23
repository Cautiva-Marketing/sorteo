# Feature Specification: Ajustes de registro, pantalla del QR y ruleta

**Feature Branch**: `004-ajustes-registro-ruleta`

**Created**: 2026-10-23

**Status**: Draft

**Input**: User description: "Tengo que realizar los siguientes cambios en la web: Incluir números chilenos y de Suramérica. Quitar el mensaje «9 dígitos, por ejemplo …» del formulario. Permitir el registro con solo un nombre. Reducir un poco el tamaño del QR y aumentar un poco tamaño de los tres logos. Agregar un checkbox con «¿Deseas adquirir el CRM con Agente IA?» al registro y guardar la respuesta en la información de los participantes. Quitar el popup de «Se cerrarán las inscripciones» y girar automáticamente la ruleta. Quitar «efecto desenfocado» al momento de abrir un popup en el panel de control (admin) para optimizar recursos. Cambiar colores de la ruleta, utilizar colores de la A del logo de creAndo valor. Agregar «Síguenos en nuestras redes sociales» en la card de «Gracias por registrarte» https://www.facebook.com/cautivamarketingperu, https://www.facebook.com/satelcomdelsur. Hazme preguntas si tienes dudas."

Esta especificación es un **delta sobre las features 001, 002 y 003**: todo lo que no se menciona aquí se
mantiene como estaba (registro por QR, duplicados por celular, cierre y reapertura de inscripciones,
premios y ganadores, exportación a CSV, borrado de datos, acceso protegido del panel, estilo minimalista).
Cuando un requisito de esta feature contradice uno anterior, **prevalece este**: reemplaza al celular
exclusivamente peruano (001), al nombre de al menos dos palabras (001), al aviso de confirmación antes del
primer giro (003, FR-089) y a la paleta de la ruleta (003).

## Clarifications

### Session 2026-10-23

- Q: ¿Cómo elige el participante el país de su celular? → A: Con un selector de país junto al campo del
  número: Perú preseleccionado (prefijo +51), Chile (+56) y el resto de países de Sudamérica. El
  participante escribe solo su número local; no tiene que escribir el prefijo.
- Q: Al quitar el aviso «Se cerrarán las inscripciones», ¿qué pasa con las inscripciones? → A: El administrador
  toca «Girar» y la ruleta gira de inmediato. El primer giro real sigue cerrando las inscripciones
  automáticamente, en silencio, para que la lista quede fija durante el sorteo; se pueden reabrir desde
  Campaña. El modo de práctica no cierra nada.
- Q: ¿Dónde se ve la respuesta a «¿Deseas adquirir el CRM con Agente IA?» en el panel? → A: En la tabla de
  participantes (columna Sí/No), en el CSV exportado y con un filtro para ver solo a quienes respondieron Sí.
- Q: El desenfoque del fondo lo comparte una misma ventana modal usada en el panel y en el formulario
  público. ¿Dónde se quita? → A: Solo en las ventanas del panel de administración; las ventanas del
  formulario público conservan su aspecto actual.
- Q: ¿Qué tan estricta debe ser la validación del celular para los países distintos de Perú? → A: Estricta
  en Perú y Chile (9 dígitos y empieza con 9); en los otros 10 países solo se valida el rango de largo de
  dígitos.
- Q: ¿Qué partes de la ruleta cambian a los colores de la «A» del logo? → A: La ruleta completa: segmentos,
  aro y pines, buje central, puntero y letrero con el nombre bajo el puntero. Los botones y tarjetas del
  panel, la ventana del ganador y el confeti no cambian.
- Q: Si una persona ya registrada vuelve a registrarse y marca la casilla del CRM, ¿se actualiza su
  respuesta? → A: No. Se mantiene la respuesta original; el segundo intento muestra «ya registrado» y no
  modifica ningún dato.
- Q: ¿Qué significa «sin desplazamiento» en la pantalla del QR y cuánto crecen los logos en un teléfono?
  → A: En 1366×768 y 1920×1080 (proyección) no hay desplazamiento vertical; en 360 px de ancho no hay
  desplazamiento horizontal (a ese ancho la pantalla puede desplazarse en vertical según el alto del
  teléfono). Los logos crecen 20–25 % desde 640 px de ancho; en teléfonos crecen alrededor de 10 % para
  que los dos logos de abajo quepan en una fila.
- Q: ¿Qué se entiende por «Sudamérica»? → A: Los 12 países soberanos: Argentina, Bolivia, Brasil, Chile,
  Colombia, Ecuador, Guyana, Paraguay, Perú, Surinam, Uruguay y Venezuela.
- Q: ¿Qué son «los tres logos»? → A: Los de la pantalla del QR: Creando Valor (arriba), Satelcom y Cautiva
  Marketing (abajo, «Con el respaldo de»).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrarse desde cualquier país de Sudamérica con solo un nombre (Priority: P1)

Una persona escanea el QR y abre el formulario. Junto al campo «Celular» ve un selector de país con Perú
preseleccionado. Si es chilena (o de otro país sudamericano), cambia el país, escribe su número local y
se registra. Puede escribir un solo nombre (por ejemplo «María») en «Nombres completos». Bajo el campo
de celular ya no aparece el texto «9 dígitos, por ejemplo 987 654 321».

**Why this priority**: Es el flujo principal del evento y hoy deja fuera a cualquier asistente que no
tenga celular peruano o que escriba un solo nombre.

**Independent Test**: Registrar una persona con celular de Chile y un solo nombre y otra con celular de
Perú dejando el país por defecto; comprobar que ambas aparecen en el panel con su país/prefijo y que el
texto de ayuda del celular no se muestra.

**Acceptance Scenarios**:

1. **Given** el formulario abierto, **When** se muestra el campo de celular, **Then** hay un selector de
   país con Perú (+51) preseleccionado, la lista incluye los 12 países de Sudamérica con su prefijo y
   no aparece el texto «9 dígitos, por ejemplo …».
2. **Given** el país Chile y un celular chileno válido, **When** la persona envía el formulario, **Then**
   el registro se guarda y la ventana de bienvenida muestra el celular con su prefijo (+56).
3. **Given** el país Perú (por defecto) y un celular peruano de 9 dígitos que empieza con 9, **When**
   envía el formulario, **Then** se registra igual que antes de esta feature.
4. **Given** un solo nombre de letras (por ejemplo «María»), **When** envía el formulario, **Then** el
   registro se acepta; un nombre con números o símbolos, o vacío, sigue rechazándose con un mensaje claro.
5. **Given** un número que no corresponde al formato de celular del país elegido, **When** envía el
   formulario, **Then** no se guarda y el error, en español, indica el país y el formato esperado.
6. **Given** un número ya registrado con el mismo país, **When** otra persona intenta registrarlo,
   **Then** se muestra el aviso de «ya registrado» de siempre.
7. **Given** dos personas con el mismo número local pero de países distintos, **When** ambas se
   registran, **Then** se aceptan como dos participantes distintos.
8. **Given** participantes registrados antes de esta feature (todos peruanos), **When** el administrador
   los consulta, **Then** siguen apareciendo con su celular peruano y no se pueden registrar de nuevo.

---

### User Story 2 - Indicar interés en el CRM con Agente IA (Priority: P1)

En el formulario aparece una casilla «¿Deseas adquirir el CRM con Agente IA?», desmarcada por defecto y
opcional. Quien la marca queda registrado como interesado. El administrador ve la respuesta (Sí/No) en la
tabla de participantes, puede filtrar para ver solo a los interesados y la respuesta sale en el CSV.

**Why this priority**: Es el dato comercial que la empresa quiere capturar durante el evento; debe
guardarse desde el primer registro para no perderse.

**Independent Test**: Registrar a una persona marcando la casilla y a otra sin marcarla; comprobar en la
tabla del panel «Sí» y «No», que el filtro deja solo a la primera y que el CSV trae la columna con ambos
valores.

**Acceptance Scenarios**:

1. **Given** el formulario, **When** se carga, **Then** la casilla «¿Deseas adquirir el CRM con Agente
   IA?» aparece desmarcada, con su etiqueta asociada, y no es obligatoria.
2. **Given** la casilla marcada, **When** la persona se registra, **Then** su registro guarda «Sí»; si no
   la marca, guarda «No».
3. **Given** participantes con respuestas distintas, **When** el administrador abre la tabla de
   participantes, **Then** ve una columna con Sí/No para cada uno.
4. **Given** la tabla de participantes, **When** el administrador activa el filtro «Solo interesados en el CRM»,
   **Then** solo se listan quienes respondieron Sí, y la búsqueda por texto sigue funcionando junto con el
   filtro.
5. **Given** participantes registrados, **When** el administrador exporta el CSV, **Then** incluye una
   columna con la respuesta (Sí/No) de cada participante.
6. **Given** participantes registrados antes de esta feature, **When** se muestran o exportan, **Then**
   figuran como «No».
7. **Given** la casilla marcada o no, **When** se hace el sorteo, **Then** la respuesta no afecta la
   elegibilidad ni la probabilidad de ganar.

---

### User Story 3 - Girar la ruleta sin ventana de confirmación (Priority: P2)

El administrador toca «Girar» y la ruleta empieza a girar de inmediato, sin la ventana «Se cerrarán las
inscripciones». Si las inscripciones seguían abiertas, el primer giro real las cierra automáticamente.

**Why this priority**: Quita un paso que interrumpe el momento central del evento en pantalla grande; no
cambia el resultado del sorteo.

**Independent Test**: Con las inscripciones abiertas, tocar «Girar» y comprobar que no aparece ninguna
ventana, que la ruleta gira y que, al terminar, las inscripciones figuran como cerradas.

**Acceptance Scenarios**:

1. **Given** inscripciones abiertas y un premio en juego, **When** el administrador toca «Girar»,
   **Then** la ruleta gira de inmediato y no aparece ninguna ventana de confirmación.
2. **Given** ese primer giro real, **When** se completa, **Then** las inscripciones quedan cerradas, la
   pantalla del QR muestra el aviso de cierre y el administrador puede reabrirlas desde Campaña.
3. **Given** el modo de práctica, **When** se gira, **Then** las inscripciones no cambian.
4. **Given** inscripciones ya cerradas, **When** se gira, **Then** el comportamiento es el mismo: giro
   inmediato.
5. **Given** que el giro falla (sin conexión, error del servidor), **When** se muestra el error,
   **Then** las inscripciones no quedan cerradas por un giro que no ocurrió.

---

### User Story 4 - Nueva identidad visual: QR, logos y ruleta (Priority: P2)

En la pantalla del QR, el código se ve un poco más pequeño y los tres logos (Creando Valor, Satelcom y
Cautiva Marketing) un poco más grandes. La ruleta usa los colores de la «A» del logo de Creando Valor
(morado, lavanda y celeste) en lugar de negro, crema y dorado.

**Why this priority**: Mejora la presencia de la marca en la proyección, pero no bloquea el registro ni el
sorteo.

**Independent Test**: Abrir la pantalla del QR y la ruleta en 360 px, 1366×768 y 1920×1080 y comparar con
el estado anterior: QR menor, logos mayores (en 640 px o más), sin desplazamiento (vertical en las dos
pantallas de proyección, horizontal en 360 px), QR escaneable; segmentos de la ruleta con la paleta de la
«A» y nombres legibles.

**Acceptance Scenarios**:

1. **Given** la pantalla del QR, **When** se compara con la versión anterior en una pantalla de 640 px
   o más, **Then** el QR es 15 % más pequeño (±5 puntos) y los tres logos entre 20 y 25 % más grandes
   (FR-109 y FR-110).
2. **Given** QR y logos reajustados, **When** se abre en 1366×768 y 1920×1080, **Then** todo cabe sin
   desplazamiento vertical; **When** se abre en 360 px de ancho, **Then** no hay desplazamiento
   horizontal, los dos logos de abajo quedan en una fila y ningún logo se deforma ni se superpone.
3. **Given** el QR más pequeño, **When** se escanea con un celular a 3 m de la proyección,
   **Then** abre el formulario al primer intento.
4. **Given** la ruleta con 3 o más participantes, **When** se dibuja, **Then** los segmentos usan los
   colores de la «A» del logo (morado, lavanda y celeste) y ninguno comparte color con sus vecinos,
   incluida la unión del último con el primero.
5. **Given** la ruleta completa, **When** se mira, **Then** el aro, los pines, el buje, el puntero y el
   letrero del nombre también usan la paleta de la «A», sin negro, crema ni dorado.
6. **Given** cualquier segmento, **When** se lee su nombre, **Then** el texto tiene contraste suficiente
   (AA) sobre su color.
7. **Given** 1 o 2 participantes, **When** se dibuja la ruleta, **Then** se ve correctamente con la nueva
   paleta.

---

### User Story 5 - Seguir las redes sociales al terminar el registro (Priority: P3)

Al terminar, la tarjeta «¡Gracias por registrarte!» muestra «Síguenos en nuestras redes sociales» con
enlaces a las páginas de Facebook de Cautiva Marketing y de Satelcom del Sur.

**Why this priority**: Aprovecha el momento de mayor atención del participante para ganar seguidores; es
un añadido sin impacto en el flujo.

**Independent Test**: Completar un registro hasta «Listo, muchas gracias» y comprobar que la tarjeta
muestra el texto y los dos enlaces correctos, que abren en una pestaña nueva.

**Acceptance Scenarios**:

1. **Given** la tarjeta «¡Gracias por registrarte!», **When** se muestra, **Then** incluye el texto
   «Síguenos en nuestras redes sociales» y dos enlaces con nombre legible.
2. **Given** los enlaces, **When** la persona toca el primero, **Then** abre
   `https://www.facebook.com/cautivamarketingperu`; el segundo abre
   `https://www.facebook.com/satelcomdelsur`; ambos en una pestaña nueva, sin cerrar la tarjeta.
3. **Given** un lector de pantalla, **When** recorre los enlaces, **Then** cada uno anuncia a qué página
   lleva (nombre de la marca) y es operable con teclado.
4. **Given** el aviso de cierre de inscripciones o la ventana «ya registrado», **When** se muestran,
   **Then** no incluyen las redes (solo la tarjeta de gracias).

---

### User Story 6 - Ventanas del panel sin desenfoque (Priority: P3)

Al abrir una ventana emergente en el panel de administración (ganador, borrado de datos, descartar, etc.),
el fondo se oscurece pero ya no se desenfoca, para ahorrar recursos del equipo que proyecta.

**Why this priority**: Es una optimización de rendimiento sin cambio funcional.

**Independent Test**: Abrir cada ventana del panel y comprobar que el fondo se oscurece sin desenfoque, y
que las ventanas del formulario público se ven como antes.

**Acceptance Scenarios**:

1. **Given** cualquier ventana emergente del panel de administración, **When** se abre, **Then** el fondo
   se oscurece pero no se desenfoca.
2. **Given** las ventanas del formulario público (bienvenida, ya registrado), **When** se abren,
   **Then** se ven como antes de esta feature.
3. **Given** una ventana del panel abierta, **When** el administrador usa el teclado, **Then** el foco
   sigue contenido en la ventana y Escape la cierra, como antes.

---

### Edge Cases

- ¿Qué pasa si la persona pega en el campo local un número con prefijo internacional (por ejemplo
  «+56 9 1234 5678»)? Se acepta si coincide con el país elegido; si el prefijo es de otro país, se
  indica el error en lugar de adivinar.
- ¿Y si cambia el país después de escribir el número? El número se vuelve a validar con el país nuevo y
  el error, si lo hay, se muestra en ese momento.
- ¿Y si el nombre es de una sola letra o solo espacios? Se rechaza con un mensaje claro (mínimo 2 letras).
- ¿Y si un participante antiguo no tiene respuesta del CRM? Se trata como «No» en todo el sistema.
- ¿Y si una persona ya registrada vuelve a registrarse marcando la casilla del CRM? Se muestra «ya
  registrado» y su respuesta original no cambia; el interés posterior lo anota el equipo fuera del
  sistema.
- ¿Y si se gira con las inscripciones ya cerradas? Gira normalmente; no se reabren ni se vuelven a cerrar.
- ¿Y si el cierre automático de inscripciones falla? No puede quedar un giro registrado sin el cierre:
  el giro y el cierre se guardan juntos; si uno falla, ninguno se guarda y el administrador puede volver
  a girar.
- ¿Y si un teléfono sin app de Facebook toca el enlace? Abre la página en el navegador.
- ¿Y si hay muchos participantes (más de 100)? La nueva paleta se repite sin que dos vecinos coincidan.
- ¿Y si la pantalla es angosta (360 px de ancho) o un proyector de 1366×768? Los logos más grandes no
  generan desplazamiento horizontal ni se cortan, y en 1366×768 no hay desplazamiento vertical.
- ¿Y si un país no tiene formato de celular conocido? No se ofrece en la lista: solo se incluyen países
  con formato definido.

## Requirements *(mandatory)*

### Functional Requirements

**Celulares de Sudamérica**

- **FR-092**: El formulario DEBE mostrar un selector de país junto al campo «Celular», con Perú (+51)
  preseleccionado y los 12 países de Sudamérica (Argentina, Bolivia, Brasil, Chile, Colombia, Ecuador,
  Guyana, Paraguay, Perú, Surinam, Uruguay y Venezuela), cada uno con su prefijo visible.
- **FR-093**: El participante DEBE escribir solo su número local; el sistema DEBE combinarlo con el
  prefijo del país elegido.
- **FR-094**: El sistema DEBE validar, en el cliente y en el servidor, el número según el país elegido,
  tolerando espacios, guiones y paréntesis: en Perú y Chile exige exactamente 9 dígitos que empiecen con
  9; en los otros 10 países exige solo que la cantidad de dígitos esté dentro del rango válido de ese
  país (sin regla de dígito inicial). DEBE rechazar el que no cumpla con un mensaje en español que
  nombre el país y el formato esperado.
- **FR-095**: La unicidad DEBE aplicarse al número completo con prefijo de país: no puede haber dos
  registros con el mismo país y número; el mismo número local en países distintos son participantes
  distintos. Para que una misma persona no quede duplicada por escribir su número de otra forma, antes
  de comparar el sistema DEBE ignorar el prefijo internacional si coincide con el país elegido, el `0`
  inicial de marcado nacional (Argentina, Brasil, Ecuador, Paraguay, Uruguay y Venezuela) y, en Argentina,
  el `9` inicial de celular.
- **FR-096**: Los celulares ya registrados (peruanos) DEBEN seguir siendo válidos y únicos, sin
  migración manual y sin aparecer duplicados al registrarse de nuevo.
- **FR-097**: El celular DEBE mostrarse con su prefijo de país en la ventana de bienvenida, la tabla de
  participantes, el historial de ganadores y el CSV; la búsqueda del panel DEBE encontrar a un
  participante por su número con o sin prefijo. La ventana del ganador sigue sin mostrar el celular
  (feature 003 y FR-105).
- **FR-098**: El formulario NO DEBE mostrar el texto de ayuda «9 dígitos, por ejemplo 987 654 321» ni
  uno equivalente bajo el campo de celular.

**Nombre**

- **FR-099**: El campo «Nombres completos» DEBE aceptar uno o más términos compuestos solo por letras
  (incluidas tildes y la ñ) y espacios, con un mínimo de 2 letras en total y el máximo de 100 caracteres
  ya existente; DEBE seguir rechazando vacíos, números y símbolos.
- **FR-100**: El mensaje de error y el texto de ejemplo del campo de nombre DEBEN dejar de exigir
  «nombre y apellido».

**Interés en el CRM con Agente IA**

- **FR-101**: El formulario DEBE incluir una casilla con la etiqueta «¿Deseas adquirir el CRM con Agente
  IA?», desmarcada por defecto, opcional y con la etiqueta asociada al control.
- **FR-102**: El sistema DEBE guardar la respuesta (Sí/No) en el registro del participante, validada
  también en el servidor; si la respuesta no llega, DEBE guardarse como «No». Un intento de registro
  duplicado NO DEBE modificar la respuesta ya guardada.
- **FR-103**: La tabla de participantes DEBE mostrar una columna con la respuesta Sí/No y ofrecer un
  filtro para listar solo a quienes respondieron Sí, combinable con la búsqueda por texto.
- **FR-104**: El CSV exportado DEBE incluir una columna con la respuesta Sí/No de cada participante;
  los participantes anteriores a esta feature DEBEN figurar como «No».
- **FR-105**: La respuesta NO DEBE influir en la elegibilidad ni en la probabilidad de ganar, ni
  mostrarse en el cliente público ni en la ventana del ganador.

**Sorteo**

- **FR-106**: Al tocar «Girar», el sistema NO DEBE mostrar ninguna ventana de confirmación sobre el cierre
  de inscripciones; la ruleta DEBE comenzar a girar de inmediato.
- **FR-107**: El primer giro real con inscripciones abiertas DEBE cerrarlas automáticamente, sin pedir
  confirmación, y solo si el giro se realizó; el modo de práctica NO DEBE cerrarlas.
- **FR-108**: El administrador DEBE poder reabrir las inscripciones desde Campaña, como hasta ahora.

**Identidad visual**

- **FR-109**: En la pantalla del QR, el código DEBE reducirse 15 % (con una tolerancia de ±5 puntos)
  respecto de su tamaño actual y seguir siendo escaneable a 3 m en proyección.
- **FR-110**: Los tres logos de la pantalla del QR (Creando Valor, Satelcom y Cautiva Marketing) DEBEN
  aumentar entre 20 y 25 % respecto de su tamaño actual en pantallas de 640 px de ancho o más (escritorio
  y proyección), conservando proporción y sin deformarse. En pantallas más angostas (teléfonos) PUEDEN
  crecer menos (alrededor de 10 %) para que los dos logos de abajo sigan en una sola fila sin
  desplazamiento horizontal.
- **FR-111**: La pantalla del QR DEBE caber sin desplazamiento vertical en 1366×768 y 1920×1080 (pantallas
  de proyección) y sin desplazamiento horizontal en 360 px de ancho.
- **FR-112**: Los segmentos de la ruleta DEBEN usar los colores de la «A» del logo de Creando Valor
  (morado `#524A99`, lavanda `#706BAF` y celeste `#23BCEF`), de modo que dos segmentos vecinos nunca
  compartan color, incluida la unión del último con el primero. El aro y sus pines, el buje central, el
  puntero y el letrero con el nombre bajo el puntero DEBEN usar también esa paleta, sin restos de negro,
  crema o dorado en la ruleta. Los botones, tarjetas, la ventana del ganador y el confeti NO DEBEN
  cambiar de color.
- **FR-113**: El texto de cada segmento y del letrero DEBE tener contraste AA sobre su color de fondo.

**Redes sociales**

- **FR-114**: La tarjeta «¡Gracias por registrarte!» DEBE mostrar el texto «Síguenos en nuestras redes
  sociales» y dos enlaces: Cautiva Marketing (`https://www.facebook.com/cautivamarketingperu`) y Satelcom
  del Sur (`https://www.facebook.com/satelcomdelsur`).
- **FR-115**: Los enlaces DEBEN abrirse en una pestaña nueva sin dar acceso a la página de origen,
  tener nombre accesible, ser operables con teclado y tener un área táctil de al menos 44 px.

**Panel liviano**

- **FR-116**: Las ventanas emergentes del panel de administración NO DEBEN aplicar desenfoque al fondo;
  DEBEN conservar el fondo oscurecido, la contención del foco, el cierre con Escape y el respeto a
  `prefers-reduced-motion`.
- **FR-117**: Las ventanas del formulario público NO DEBEN cambiar su aspecto.

### Key Entities *(include if feature involves data)*

- **Participante**: persona registrada. Además de nombres, empresa u ocupación y celular, ahora el celular
  incluye su país (prefijo) y el registro guarda su interés en el CRM con Agente IA (Sí/No). La unicidad es
  por país + número.
- **País**: uno de los 12 países de Sudamérica, con nombre, prefijo telefónico y formato de celular
  válido; Perú es el predeterminado.
- **Exportación (CSV)**: archivo de participantes; añade la columna de interés en el CRM y muestra el
  celular con prefijo.
- **Enlace de red social**: nombre visible y dirección de la página de Facebook de cada marca.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-030**: Una persona con celular chileno completa el registro en menos de 1 minuto y al primer
  intento en al menos 9 de cada 10 pruebas.
- **SC-031**: Los 12 países de la lista aceptan un celular válido de ejemplo y rechazan uno inválido en
  el 100 % de las pruebas.
- **SC-032**: Ningún número (país + número) queda registrado dos veces; los registros peruanos
  anteriores a esta feature siguen contándose como registrados.
- **SC-033**: El 100 % de los registros nuevos guarda la respuesta del CRM (Sí/No), y el administrador
  filtra y exporta a los interesados en menos de 30 segundos.
- **SC-034**: Desde que el administrador toca «Girar» hasta que la ruleta empieza a moverse pasan 2
  segundos o menos, sin pasos intermedios.
- **SC-035**: La pantalla del QR no exige desplazarse verticalmente en 1366×768 y 1920×1080 ni
  horizontalmente en 360 px de ancho, el QR se escanea al primer intento a 3 m en proyector y, en
  pantallas de 640 px o más, los tres logos se ven al menos 20 % más grandes que antes.
- **SC-036**: El 100 % de los segmentos de la ruleta usa la paleta de la «A», sin vecinos del mismo
  color, con texto de contraste AA, de 1 a 200 participantes.
- **SC-037**: El 100 % de las ventanas del panel se abre sin desenfoque de fondo; las del formulario
  público no cambian.
- **SC-038**: La página de registro mantiene Lighthouse móvil ≥ 90 en Performance y Accessibility.

## Assumptions

- «Sudamérica» son los 12 países soberanos listados; se excluyen territorios (Guayana Francesa, Islas
  Malvinas) y países de otras regiones.
- La validación comprueba largo (y dígito inicial solo en Perú y Chile), no que el número exista ni que
  esté activo; un número con largo correcto pero inexistente en otro país puede registrarse.
- «Los tres logos» son los de la pantalla del QR; los porcentajes de reducción y aumento son aproximados
  («un poco») y se ajustarán a la vista si algún tamaño no cabe sin desplazamiento.
- Los colores de la «A» se toman del archivo del logo `creandovalor.svg`: morado `#524A99`, lavanda
  `#706BAF` y celeste `#23BCEF`.
- Las redes sociales son solo los dos enlaces de Facebook indicados.
- La casilla del CRM es una preferencia comercial opcional: no condiciona la participación y no cambia
  el sorteo.
- El administrador sigue siendo el único con acceso a la respuesta del CRM y al celular completo.
- **Constitución**: la v2.0.0 chocaba con tres reglas de esta feature y se enmendó a la **v2.1.0**
  (2026-10-23), que ya la permite: (III) el celular se normaliza a E.164 con el prefijo del país, no solo
  `+51…`; (IV) el interés en el CRM es un dato permitido, con uso comercial acotado a contactar a quienes
  lo marcaron; (V) la ruleta puede usar la paleta de la «A» (morado, lavanda y celeste) como tokens
  propios, sin ampliar el acento del resto de la interfaz.
