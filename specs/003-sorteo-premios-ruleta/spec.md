# Feature Specification: Sorteo por premios con ruleta

**Feature Branch**: `003-sorteo-premios-ruleta`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "Quiero que se puedan hacer varios sorteos. Tambien quiero que la ruleta sea más bonita, puedas revisar la de "D:\Trabajos\Cautiva Marketing\Sistema de Registro y Sorteo Ozarel". Hazme preguntas si tienes dudas."

Esta especificación es un **delta sobre las features 001 y 002**: todo lo que no se menciona aquí se
mantiene como estaba (registro, duplicados por celular, cierre de inscripciones, exportación a CSV,
borrado de datos, acceso protegido del panel, estilo minimalista). Reemplaza el sorteo de «N ganadores de
golpe» con animación simple (FR-019 a FR-023 de la 001) por un sorteo **por premios** con ruleta.

## Clarifications

### Session 2026-10-22

- Q: ¿Qué se entiende por «varios sorteos»? → A: Una lista de premios. El administrador crea los premios
  y gira la ruleta una vez por cada premio (o unidad de premio); cada giro da un ganador, que queda
  excluido de los siguientes. Son los mismos participantes y un solo QR; no hay eventos independientes.
- Q: Si el ganador no está presente o no responde, ¿se puede volver a girar? → A: Sí. El ganador se
  marca como «descartado» y queda en el historial (quién lo descartó y cuándo); no vuelve a la ruleta y
  la unidad del premio queda disponible para un nuevo giro.
- Q: ¿Qué colores tiene la ruleta, si la referencia usa dorado, negro y crema? → A: Negro, blanco,
  grises y el azul de Cautiva, de acuerdo con el diseño minimalista de la 002; no se enmienda la
  constitución.
- Q: ¿Debe la ventana «¡Ganador #N!» mostrar el celular del ganador cuando se proyecta en pantalla grande?
  → A: No. La ventana muestra solo el premio y el nombre del ganador; el celular completo se ve
  únicamente en el historial del panel y en el CSV, para que el equipo contacte al ganador sin exponerlo
  al público.
- Q: ¿Se puede girar con las inscripciones abiertas? → A: Sí, pero el primer giro pide confirmación y
  cierra las inscripciones automáticamente, para que la lista de participantes quede fija durante el
  sorteo. Esto reemplaza lo supuesto en la 001 («sin cierre automático al sortear»).
- Q: ¿Cómo prueba el administrador la ruleta antes del evento sin gastar participantes ni premios? → A:
  Con un «modo de práctica» que gira con los participantes reales pero no guarda nada. No hay botón para
  borrar ganadores ni reiniciar el sorteo.
- Q: Al descartar a un ganador y volver a girar, ¿el nuevo ganador reutiliza el número «#N» o lleva el
  siguiente? → A: Lleva el siguiente. Cada giro recibe un número consecutivo nuevo y el descartado
  conserva el suyo.
- Q: ¿Qué elementos de la ruleta de referencia se incorporan? → A: El letrero con el nombre bajo el
  puntero, la ventana del ganador con confeti, el sonido de victoria (silenciable) y el modo de pantalla
  completa para proyectar.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Gestionar la lista de premios (Priority: P1)

El administrador entra a la sección del sorteo y arma la lista de premios: cada premio tiene un nombre
(por ejemplo «Alexa» o «Box de bienvenida») y una cantidad de unidades (por defecto 1). Puede agregar,
editar, ordenar y eliminar premios, y ve de cada uno cuántas unidades ya tienen ganador y cuántas faltan.

**Why this priority**: Sin premios no hay «varios sorteos»; es la base de todo lo demás.

**Independent Test**: Crear tres premios con distintas cantidades, reordenarlos, editar uno, eliminar
otro y comprobar que la lista y los contadores de unidades se mantienen tras recargar la página.

**Acceptance Scenarios**:

1. **Given** el panel del sorteo sin premios, **When** el administrador agrega un premio con nombre y
   cantidad, **Then** aparece en la lista con «0 de N entregadas» y queda guardado al recargar.
2. **Given** un nombre vacío o repetido, o una cantidad menor que 1, **When** intenta guardar, **Then** no
   se guarda y se indica el motivo junto al campo.
3. **Given** un premio con al menos un ganador (activo o descartado), **When** el administrador intenta
   eliminarlo, **Then** no se permite y se explica que ya tiene historial; sí puede editar su nombre.
4. **Given** un premio con ganadores activos, **When** el administrador baja su cantidad por debajo de
   los ganadores activos, **Then** no se permite.
5. **Given** varios premios, **When** el administrador los reordena, **Then** el orden se conserva y
   define cuál se propone como siguiente premio en juego.
6. **Given** un visitante sin sesión de administrador, **When** intenta ver o modificar los premios,
   **Then** se le niega el acceso, igual que al resto del panel.

---

### User Story 2 - Girar la ruleta por un premio (Priority: P1)

El administrador elige el «premio en juego» y toca «Girar». Aparece una ruleta con un segmento por cada
participante elegible, el logo de Cautiva al centro y un puntero fijo arriba. La ruleta gira varios
segundos, va frenando y se detiene sobre el ganador. Mientras gira, un letrero sobre la ruleta muestra el
nombre completo de quien pasa bajo el puntero. Al detenerse, aparece una ventana «¡Ganador #N!» con el
premio y el nombre del ganador (sin su celular), con confeti y una melodía corta.

**Why this priority**: Es el momento central del evento y el cambio visible que se pide: una ruleta más
vistosa que la animación actual.

**Independent Test**: Con varios participantes registrados y un premio creado, girar una vez y comprobar
que la ruleta se detiene en el nombre registrado como ganador, que aparece la ventana con premio y
nombre, y que tras recargar el resultado es el mismo.

**Acceptance Scenarios**:

1. **Given** participantes elegibles y un premio con unidades disponibles, **When** el administrador toca
   «Girar para: {premio}», **Then** la ruleta gira durante varios segundos con desaceleración gradual y
   se detiene con el puntero sobre el segmento del ganador.
2. **Given** la ruleta girando, **When** pasan segmentos bajo el puntero, **Then** el letrero muestra en
   cada instante el nombre completo de quien está bajo el puntero, y al detenerse muestra el del ganador.
3. **Given** el giro terminado, **When** se detiene la ruleta, **Then** aparece la ventana «¡Ganador #N!»
   con el nombre del premio y el nombre completo del ganador, sin su celular, confeti y la melodía de
   victoria.
4. **Given** el giro, **When** el servidor responde, **Then** el ganador ya quedó decidido y registrado
   antes de que empiece a moverse la ruleta; la animación no influye en el resultado.
5. **Given** el giro terminado, **When** el administrador recarga la página, **Then** el ganador, su
   número y su premio aparecen igual en el historial.
6. **Given** el ganador anunciado, **When** el administrador cierra la ventana, **Then** el ganador queda
   fuera de la ruleta para los siguientes giros; si el premio aún tiene unidades, sigue en juego; si no,
   se propone el siguiente premio con unidades pendientes.
7. **Given** que ningún premio está seleccionado, que el premio no tiene unidades pendientes o que no hay
   participantes elegibles, **When** se muestra el botón, **Then** está deshabilitado y se indica el
   motivo.
8. **Given** un giro en curso, **When** el administrador intenta girar de nuevo (o lo hace desde otra
   sesión al mismo tiempo), **Then** no se produce un segundo ganador para la misma unidad del premio.
9. **Given** un solo participante elegible, **When** el administrador gira, **Then** la ruleta se muestra
   completa y ese participante resulta ganador.
10. **Given** la preferencia de reducir movimiento, **When** el administrador gira, **Then** no hay giro
    ni confeti: el ganador aparece directamente en la ventana.
11. **Given** el navegador que bloquea el audio, **When** se anuncia el ganador, **Then** el sorteo
    continúa normalmente sin sonido y sin errores visibles.
12. **Given** que las inscripciones están abiertas, **When** el administrador toca «Girar» por primera
    vez, **Then** aparece una confirmación que avisa que se cerrarán las inscripciones; al confirmar, se
    cierran y la ruleta gira, y al cancelar no pasa nada.
13. **Given** el giro de un participante cuyo nombre no cabe en su segmento, **When** se dibuja la
    ruleta, **Then** el nombre se abrevia dentro del segmento, y el nombre completo siempre se lee en el
    letrero.
14. **Given** el panel del sorteo, **When** el administrador activa el «modo de práctica» y gira,
    **Then** la ruleta funciona igual que en un giro real, con un aviso visible de «Práctica: no se
    guarda», y al terminar no queda ningún ganador, número, descarte ni cambio en los premios o en los
    participantes elegibles.
15. **Given** el modo de práctica, **When** el administrador gira, **Then** no se pide cerrar las
    inscripciones ni se cierran, y la ventana del resultado se muestra marcada como «Práctica» y solo
    ofrece cerrarla.

---

### User Story 3 - Descartar a un ganador ausente y volver a girar (Priority: P2)

Si la persona que ganó no está presente o no responde, el administrador toca «Volver a girar» en la
ventana del ganador. Esa persona queda marcada como «descartada» en el historial, no vuelve a la ruleta, y
la ruleta gira otra vez por el mismo premio.

**Why this priority**: En eventos reales es frecuente que el ganador no esté; sin esto habría que
improvisar fuera del sistema. Aporta menos que girar, por eso P2.

**Independent Test**: Girar, tocar «Volver a girar» y comprobar que el primer ganador aparece como
descartado en el historial, que el nuevo giro lo excluye y que el premio sigue contando una sola unidad
entregada.

**Acceptance Scenarios**:

1. **Given** la ventana del ganador, **When** el administrador toca «Volver a girar», **Then** el ganador
   queda como «descartado» con la fecha y el administrador que lo descartó, y la ruleta gira de nuevo por
   el mismo premio; el nuevo ganador lleva el número siguiente (si #1 fue descartado, el nuevo es #2).
2. **Given** un ganador descartado, **When** se hacen giros posteriores, **Then** esa persona no aparece
   en la ruleta ni puede resultar ganadora de ningún premio.
3. **Given** un premio con 2 unidades y un ganador descartado, **When** se revisa el contador, **Then**
   los descartados no cuentan como unidades entregadas.
4. **Given** una ventana de ganador cerrada y un resultado ya aceptado, **When** el administrador revisa
   el historial, **Then** puede marcar a ese ganador como descartado más tarde y el premio recupera la
   unidad disponible.
5. **Given** que solo quedaba un participante elegible y fue descartado, **When** se intenta girar,
   **Then** el botón queda deshabilitado por falta de participantes.

---

### User Story 4 - Proyectar el sorteo en pantalla completa (Priority: P2)

Para el evento, el administrador activa el modo de pantalla completa: fondo blanco, la ruleta en grande,
el logo de Cautiva, el premio en juego bien visible, el letrero con el nombre bajo el puntero y un botón
para silenciar y otro para salir.

**Why this priority**: El sorteo suele proyectarse a todo el público; mejora el espectáculo pero el
sorteo funciona sin él.

**Independent Test**: Activar la pantalla completa, girar y comprobar que la ruleta, el premio y el
letrero se leen a unos 2 metros en una pantalla Full HD de 40 pulgadas, y que se puede silenciar y salir.

**Acceptance Scenarios**:

1. **Given** el panel del sorteo, **When** el administrador activa «Pantalla completa», **Then** se ve
   solo la ruleta ampliada, el logo, el premio en juego y los controles de girar, silenciar y salir.
2. **Given** la pantalla completa, **When** el administrador toca «Silenciar», **Then** la melodía de
   victoria no suena hasta volver a activarla, y esa preferencia se recuerda en el dispositivo.
3. **Given** la pantalla completa, **When** el administrador toca «Salir» o la tecla Escape, **Then**
   vuelve al panel normal sin perder el estado del sorteo.
4. **Given** una pantalla Full HD de 40 pulgadas, **When** se muestra la ruleta ampliada, **Then** el
   letrero del nombre y el premio en juego son legibles desde unos 2 metros.

---

### User Story 5 - Consultar el historial de ganadores por premio (Priority: P3)

El administrador ve la lista de ganadores ordenada por número de ganador, con el premio, el nombre, la
fecha y el estado (ganador o descartado). Puede exportarla a CSV junto con el resto de datos.

**Why this priority**: Deja constancia del resultado y facilita la entrega de premios, pero el sorteo ya
es válido sin una vista más elaborada.

**Independent Test**: Realizar varios giros, descartar uno y comprobar que el historial muestra a todos
con su premio y estado, y que el CSV coincide.

**Acceptance Scenarios**:

1. **Given** varios giros realizados, **When** el administrador abre el historial, **Then** cada fila
   muestra número de ganador, premio, nombre completo, celular, empresa u ocupación, fecha y hora, y
   estado.
2. **Given** rondas realizadas antes de esta feature (sin premio), **When** se abre el historial,
   **Then** aparecen con el premio «Sin premio» y siguen visibles.
3. **Given** el historial, **When** el administrador exporta, **Then** el archivo incluye premio,
   número de ganador y estado, y mantiene las mismas protecciones de la 001 (por ejemplo, celdas que
   podrían interpretarse como fórmulas).
4. **Given** que se borraron los datos de los participantes al terminar la campaña, **When** se abre el
   historial, **Then** se conservan premio, número, nombre del ganador, fecha y estado, pero ya no se
   puede girar.

---

### Edge Cases

- ¿Qué pasa con cientos de participantes? La ruleta muestra un segmento por participante elegible, con
  el nombre abreviado o solo el primer nombre en los segmentos pequeños, y el nombre completo siempre se
  lee en el letrero.
- ¿Qué pasa si dos segmentos contiguos tendrían el mismo color? Nunca debe haber dos segmentos iguales
  juntos, incluida la unión entre el último y el primero.
- ¿Qué pasa si el administrador cierra la ventana del navegador durante un giro? El ganador ya quedó
  registrado en el servidor y aparece en el historial al volver.
- ¿Qué pasa si alguien intenta registrarse después del primer giro? Las inscripciones ya están cerradas
  (se cerraron al primer giro), así que ve el aviso de «inscripciones cerradas»; la lista de la ruleta no
  cambia durante el sorteo salvo por los ganadores y descartados.
- ¿Qué pasa si el administrador reabre las inscripciones a mano tras haber girado? Se permite, como en la
  001, y la ruleta incluye a los nuevos registrados desde el siguiente giro; nunca se cambia durante un
  giro.
- ¿Qué pasa si ya no quedan participantes elegibles pero sí premios pendientes? Se informa y no se
  permite girar.
- ¿Qué pasa si el mismo premio se descarta varias veces? Cada descarte queda en el historial; no hay un
  límite de descartes.
- ¿Qué pasa si se reduce la cantidad de un premio tras haber entregado unidades? No puede quedar por
  debajo de los ganadores activos.
- ¿Qué pasa con las rondas guardadas antes de esta feature? Se conservan y se muestran como «Sin
  premio»; sus ganadores siguen excluidos de los nuevos giros.

## Requirements *(mandatory)*

### Functional Requirements

**Premios**

- **FR-060**: El sistema DEBE permitir al administrador crear, editar, ordenar y eliminar premios, cada uno
  con un nombre único (de 2 a 60 caracteres) y una cantidad de unidades (entero de 1 a 100, por defecto 1).
- **FR-061**: El sistema NO DEBE permitir eliminar un premio que tenga ganadores (activos o descartados),
  ni bajar su cantidad por debajo de sus ganadores activos.
- **FR-062**: El sistema DEBE mostrar de cada premio las unidades entregadas (ganadores activos) y las
  pendientes, y marcar como «sorteado» el premio con todas sus unidades entregadas.
- **FR-063**: El sistema DEBE proponer como «premio en juego» el primer premio, según el orden definido,
  con unidades pendientes, y permitir al administrador elegir otro manualmente.

**Giro y ruleta**

- **FR-064**: El sistema DEBE permitir girar la ruleta por el premio en juego, produciendo exactamente un
  ganador por giro, elegido al azar con igual probabilidad entre los participantes elegibles (sin ganador
  activo ni descartado, y con registro válido).
- **FR-065**: El ganador DEBE decidirse y registrarse en el servidor antes de iniciar la animación; el
  cliente solo anima hacia el resultado recibido y nunca lo elige ni lo modifica.
- **FR-066**: La ruleta DEBE mostrar un segmento por cada participante elegible, con el logo de Cautiva
  en el centro y un puntero fijo en la parte superior.
- **FR-067**: Los segmentos DEBEN usar únicamente los colores de la marca minimalista (negro, blanco,
  grises y el azul de Cautiva como acento), alternados de modo que nunca haya dos segmentos contiguos del
  mismo color, y el texto de cada segmento DEBE cumplir el contraste mínimo AA (4.5:1) sobre su fondo.
- **FR-068**: El giro DEBE durar entre 5 y 8 segundos, con varias vueltas completas y una desaceleración
  gradual, y detenerse con el puntero sobre el segmento del ganador.
- **FR-069**: Durante el giro, un letrero sobre la ruleta DEBE mostrar el nombre completo del participante
  que está bajo el puntero, y al detenerse DEBE mostrar el del ganador.
- **FR-070**: La ruleta DEBE seguir siendo legible con al menos 500 participantes: los nombres de los
  segmentos se abrevian o se reducen según el espacio disponible, sin superponerse.
- **FR-071**: Con un solo participante elegible, la ruleta DEBE mostrarse de forma completa y poder
  girarse.
- **FR-072**: El sistema DEBE impedir giros simultáneos: mientras un giro está en curso el botón queda
  deshabilitado, y dos giros concurrentes desde distintas sesiones NO DEBEN entregar dos ganadores para
  la misma unidad ni elegir dos veces a la misma persona.
- **FR-073**: El botón de girar DEBE estar deshabilitado, indicando el motivo, cuando no haya premio
  seleccionado, el premio no tenga unidades pendientes o no existan participantes elegibles.

**Resultado, confeti y sonido**

- **FR-074**: Al detenerse la ruleta, el sistema DEBE mostrar una ventana «¡Ganador #N!» con el nombre del
  premio y el nombre completo del ganador, confeti en la paleta de la marca y una melodía
  corta de victoria.
- **FR-075**: La ventana DEBE ofrecer «Continuar» (acepta al ganador y cierra) y «Volver a girar»
  (descarta al ganador y gira de nuevo por el mismo premio); DEBE contener el foco, cerrarse con el
  teclado y anunciar su contenido a lectores de pantalla.
- **FR-076**: El sonido DEBE poder silenciarse, la preferencia DEBE recordarse en el dispositivo, y si el
  navegador bloquea el audio el sorteo DEBE continuar sin sonido ni errores visibles.
- **FR-077**: Con la preferencia de reducir movimiento, el sistema NO DEBE mostrar el giro ni el confeti y
  DEBE presentar el ganador directamente en la ventana.

**Descartes**

- **FR-078**: El administrador DEBE poder marcar como «descartado» a un ganador (desde la ventana del
  resultado o desde el historial), quedando registrados quién y cuándo; la persona NO DEBE volver a ser
  elegible y el premio DEBE recuperar esa unidad.
- **FR-079**: Un ganador descartado NO DEBE volver a ser marcado como ganador activo (no hay reactivación).

**Pantalla completa**

- **FR-080**: El sistema DEBE ofrecer un modo de pantalla completa con fondo blanco, la ruleta ampliada,
  el logo de Cautiva, el premio en juego, el letrero del nombre y los controles de girar, silenciar y
  salir; DEBE poder cerrarse con la tecla Escape.
- **FR-081**: En una pantalla Full HD de 40 pulgadas, el premio en juego y el letrero del nombre DEBEN ser
  legibles desde unos 2 metros.

**Historial y datos**

- **FR-082**: El sistema DEBE registrar de forma permanente cada giro: número de ganador (consecutivo en
  todo el evento; cada giro recibe un número nuevo, y un ganador descartado conserva el suyo sin que se
  reutilice), premio, participante, fecha y hora, administrador que lo ejecutó y estado (activo o
  descartado, con quién y cuándo).
- **FR-083**: El historial DEBE listar todos los ganadores con número, premio, nombre, celular, empresa u
  ocupación, fecha y estado, y DEBE mostrar las rondas anteriores a esta feature con el premio «Sin
  premio».
- **FR-084**: La exportación a CSV DEBE incluir premio, número de ganador y estado de los ganadores,
  manteniendo las protecciones de la 001.
- **FR-085**: Los ganadores de rondas anteriores a esta feature DEBEN seguir excluidos de los nuevos giros.
- **FR-086**: Tras el borrado de datos de la campaña (FR-030/FR-031 de la 001), el historial DEBE conservar
  premio, número, nombre del ganador, fecha y estado, y el sistema NO DEBE permitir nuevos giros.
- **FR-087**: El acceso a premios, giros, descartes e historial DEBE restringirse a administradores
  autenticados, verificado en el servidor en cada petición.
- **FR-088**: La interfaz DEBE estar en español (es-PE) y usar los colores solo mediante los tokens de
  diseño de la 002, sin valores de color escritos directamente en los componentes.
- **FR-089**: Si las inscripciones están abiertas, el primer giro DEBE pedir confirmación indicando que se
  cerrarán; al confirmar, el sistema DEBE cerrar las inscripciones y girar, y al cancelar NO DEBE girar ni
  cerrarlas. Con las inscripciones ya cerradas, el giro no pide esta confirmación.
- **FR-090**: El sistema DEBE ofrecer un «modo de práctica» que gire la ruleta con los participantes
  elegibles reales sin guardar nada: ni ganador, ni número, ni descarte, ni cambios en premios o
  participantes, ni cierre de inscripciones. El modo DEBE indicarse de forma visible en el panel, en la
  pantalla completa y en la ventana del resultado, y NO DEBE poder confundirse con un giro real.
- **FR-091**: Esta feature reemplaza el sorteo de «N ganadores de golpe» de la 001: el administrador ya no
  elige una cantidad de ganadores por sorteo, sino que gira por cada unidad de premio.

### Key Entities *(include if feature involves data)*

- **Premio**: Algo que se sortea. Atributos: nombre único, cantidad de unidades, orden en la lista y
  unidades entregadas (ganadores activos). Un premio con historial no se elimina.
- **Ganador (giro)**: Resultado de un giro de la ruleta. Atributos: número de ganador consecutivo, premio,
  participante elegido, fecha y hora, administrador que giró, estado (activo o descartado) y, si fue
  descartado, quién y cuándo. Reemplaza a la «Ronda de sorteo» de la 001; las rondas antiguas se muestran
  como ganadores «Sin premio».
- **Participante**: Sin cambios. Es elegible si no tiene ningún ganador asociado (activo o descartado);
  gana como máximo una vez.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-021**: El administrador puede armar una lista de 5 premios y girar por el primero en menos de 3
  minutos, sin ayuda.
- **SC-022**: Desde que toca «Girar» hasta ver la ventana del ganador pasan menos de 10 segundos.
- **SC-023**: En 1000 giros de prueba sobre el mismo conjunto de participantes, ninguna persona resulta
  ganadora más de una vez y ningún giro se detiene en un participante distinto al ganador registrado.
- **SC-024**: Con 500 participantes, el nombre del ganador se lee completo en el letrero en el 100 % de
  los giros, y no hay segmentos con texto superpuesto.
- **SC-025**: En una pantalla Full HD de 40 pulgadas, el premio en juego y el letrero del nombre se leen
  desde 2 metros.
- **SC-026**: Si dos administradores giran a la vez por la última unidad de un premio, solo uno obtiene
  ganador en el 100 % de las pruebas.
- **SC-027**: El 100 % de los ganadores descartados quedan visibles en el historial con premio, fecha y
  quién los descartó, y ninguno vuelve a aparecer en la ruleta.
- **SC-028**: Con la preferencia de reducir movimiento, el 100 % de los giros muestran al ganador sin
  animación de giro ni confeti.
- **SC-029**: Las pantallas del sorteo mantienen contraste AA y se pueden operar solo con el teclado.

## Assumptions

- Hay un solo evento a la vez: los mismos participantes y un solo QR. Los sorteos independientes con
  formulario y QR propios están fuera de alcance.
- Un participante gana como máximo un premio; los descartados no vuelven a participar.
- La ruleta se muestra solo en el panel de administración y en su modo de pantalla completa; los
  participantes no la ven en su celular.
- No hay forma de borrar ganadores ni reiniciar el sorteo; los ensayos se hacen en el modo de práctica.
- No se incluye sonido de «tic» durante el giro; solo la melodía de victoria al anunciar al ganador.
- El texto de los segmentos usa la tipografía de la marca (Inter), sin nuevas fuentes.
- El administrador que gira es quien proyecta o comparte pantalla; no hay control remoto ni vista de solo
  lectura para el público.
- El acceso de administrador, la autenticación y el borrado de datos se mantienen como en la 001.
- La ruleta de referencia (carpeta «Sistema de Registro y Sorteo Ozarel») sirve solo de inspiración
  visual y de flujo; a diferencia de ella, el ganador NO se elige en el cliente.
