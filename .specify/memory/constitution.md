# Registro y Sorteo Constitution

## Core Principles

### I. Stack y Arquitectura en Capas

- La aplicación DEBE construirse con Next.js (App Router) y TypeScript con `"strict": true`.
- El backend DEBE ser Firebase: Firestore para datos; Firebase Auth SOLO para el panel de
  administración.
- El código DEBE separarse en tres capas: UI (componentes), lógica (validación, normalización,
  sorteo) y acceso a datos (capa de servicios para Firebase).
- Los componentes de UI NO DEBEN importar el SDK de Firebase directamente; DEBEN consumir la
  capa de servicios.
- El despliegue DEBE ser compatible con Vercel o Firebase Hosting; no se admiten dependencias
  de una sola plataforma sin justificación.

**Rationale**: la separación de capas permite probar la lógica sin Firebase, cambiar el
backend con bajo costo y auditar en un solo lugar todo acceso a datos personales.

### II. Calidad de Código y Validación

- Los componentes DEBEN ser pequeños, de responsabilidad única y reutilizables.
- ESLint y Prettier DEBEN ejecutarse sin errores ni advertencias antes de integrar cambios.
- El tipo `any` está prohibido salvo con un comentario adyacente que justifique la excepción.
- Toda entrada DEBE validarse con Zod tanto en el cliente (UX) como en el servidor
  (Server Action o Route Handler). Los esquemas Zod DEBEN compartirse entre ambos lados.
- El servidor NUNCA DEBE confiar en datos validados solo por el cliente.

**Rationale**: la validación en cliente mejora la experiencia, pero solo la del servidor
protege los datos; compartir esquemas evita divergencias entre ambas.

### III. Seguridad y Control de Acceso (NO NEGOCIABLE)

- Las credenciales y claves de Firebase DEBEN residir en variables de entorno. Ningún secreto
  DEBE versionarse: los archivos `.env*` DEBEN estar en `.gitignore` y el repo DEBE incluir
  un `.env.example` sin valores reales. Las claves de servidor (p. ej. cuenta de servicio)
  NUNCA DEBEN usar el prefijo `NEXT_PUBLIC_`.
- Las reglas de Firestore DEBEN ser deny-by-default. Un participante SOLO PUEDE crear su
  propio registro; NO DEBE poder leer, listar, actualizar ni eliminar registros (propios o
  ajenos). La lectura/listado de participantes y la ejecución del sorteo DEBEN estar
  reservadas a administradores autenticados. Este requisito también se cumple si las reglas
  deniegan todo acceso directo desde clientes y toda lectura o escritura se realiza en el
  servidor (Admin SDK), siempre que la creación del registro sea la única escritura
  disponible para un participante y la autorización de administrador se verifique en el
  servidor en cada petición.
- No DEBE existir más de un registro por celular. El celular DEBE normalizarse a formato E.164 con
  el prefijo del país elegido (Perú `+51` por defecto; se admiten los países de Sudamérica que tengan
  formato de celular definido) y la unicidad DEBE garantizarse en el servidor o en las reglas de
  datos (p. ej. usando el celular normalizado como ID del documento), no solo en la UI. El mismo
  número local en países distintos son registros distintos; los registros `+51…` existentes siguen
  siendo válidos.
- El registro NO exige protección anti-automatización (reCAPTCHA, App Check ni equivalentes):
  la organización acepta el riesgo de registros automatizados o falsos. Esta decisión NO
  autoriza debilitar el resto del principio: la validación del servidor, la unicidad por
  celular y las reglas deny-by-default siguen siendo obligatorias.
- Las reglas de Firestore DEBEN estar cubiertas por pruebas contra el emulador.

**Rationale**: el panel y los datos personales deben seguir protegidos aunque el formulario sea
público; sin anti-spam, la validación estricta y la unicidad por celular son la defensa mínima
que mantiene la integridad del sorteo, y el riesgo restante queda aceptado de forma explícita.

### IV. Minimización y Uso de Datos Personales

- DEBE recolectarse solo lo estrictamente necesario: nombres completos, celular (con su país),
  empresa u ocupación y la respuesta opcional (Sí/No) a «¿Deseas adquirir el CRM con Agente IA?».
  Cualquier campo adicional exige enmendar esta constitución o justificarlo en el plan.
- El sistema NO incluye flujo de consentimiento ni política de privacidad (casillero, texto de
  finalidad, enlace o evidencia de aceptación). El cumplimiento de la Ley N.º 29733 (Perú) y su
  reglamento corresponde a la empresa organizadora, fuera del sistema.
- Los datos NO DEBEN usarse para una finalidad distinta a la participación en el sorteo y el
  contacto con los ganadores; la única excepción es que la organización PUEDE contactar con fines
  comerciales a quienes marcaron el interés en el CRM con Agente IA. Esa respuesta NO DEBE influir en
  el sorteo ni exponerse en el cliente público, en la ventana del ganador ni en logs. Los datos
  mostrados públicamente (p. ej. el contador de registrados) DEBEN limitarse a agregados que no
  identifiquen a ninguna persona.
- El administrador DEBE poder borrar los datos personales de los participantes al terminar la
  campaña, conservando del sorteo solo lo mínimo para dejar constancia del resultado.

**Rationale**: aunque el consentimiento se gestiona fuera del sistema, recolectar lo mínimo,
no exponerlo y poder borrarlo reduce el riesgo para los participantes y para la empresa.

### V. UX Mobile-First, Marca y Accesibilidad

- La interfaz DEBE diseñarse primero para móvil (desde 360 px de ancho) y escalar a pantallas
  mayores, incluidas pantallas de proyección; el flujo principal de entrada es el escaneo de un
  QR.
- El diseño DEBE ser minimalista: base blanco y negro (fondo blanco, texto casi negro `#0A0A0A`,
  grises neutros y bordes finos). La identidad de Cautiva Marketing se expresa con su logo y con
  su azul como único color de acento, usado solo en detalles mínimos. Las excepciones son los
  colores de estado (error y éxito) y la ruleta del sorteo, que PUEDE usar la paleta de la «A» del
  logo de Creando Valor (morado `#524A99`, lavanda `#706BAF` y celeste `#23BCEF`) definida como
  tokens propios; esa paleta NO DEBE usarse fuera de la ruleta.
- Los colores DEBEN definirse como design tokens (variables CSS / tema de Tailwind); NO DEBEN
  hardcodearse valores de color en componentes.
- El logo DEBE usarse en la versión que corresponda al fondo: sobre fondo claro, ícono «ti» más
  texto «cautiva marketing» en negro; la versión de texto blanco solo sobre fondos oscuros. Ningún
  elemento del logo DEBE perderse por falta de contraste. Los archivos del logo DEBEN versionarse
  en el repo.
- La tipografía DEBE ser la de cautivamarketing.com: Space Grotesk para títulos e Inter para el
  resto del texto, con texto de respaldo legible mientras cargan.
- El contraste DEBE cumplir WCAG 2.1 AA (4.5:1 texto normal, 3:1 texto grande y componentes
  de UI). El azul del logo `#0A70BB` (≈5.2:1 sobre blanco) PUEDE usarse como texto; `#3D8CD3`
  (≈3.6:1 sobre blanco) NO DEBE usarse para texto normal, solo para elementos no textuales.
- La tarjeta final del registro PUEDE incluir enlaces a las redes sociales de las marcas; DEBEN
  abrirse en pestaña nueva, con nombre accesible y área táctil de al menos 44 px.
- El texto sobre cada color de la ruleta DEBE cumplir el contraste AA sobre ese color.
- Cada campo DEBE tener un `label` asociado; los errores DEBEN estar en español, ser claros y
  anunciarse a lectores de pantalla (`aria-describedby` / `aria-live`). Las ventanas modales
  DEBEN contener el foco, poder cerrarse con el teclado y respetar `prefers-reduced-motion`.
- Toda la interfaz y los mensajes DEBEN estar en español (es-PE).

**Rationale**: la mayoría de participantes entra desde un celular, a menudo con luz exterior
y redes lentas; un diseño limpio con la marca de la empresa y buena accesibilidad eleva la
conversión y la confianza.

### VI. Pruebas, Rendimiento y Simplicidad

- DEBEN existir pruebas unitarias para: esquemas de validación Zod, normalización de celular y
  lógica del sorteo (selección con aleatoriedad criptográficamente segura, sin repetir
  ganadores, solo entre registros válidos).
- DEBE existir al menos una prueba E2E del flujo de registro que cubra éxito, celular
  duplicado y envío con datos inválidos.
- La página de registro DEBE obtener Lighthouse móvil ≥ 90 en Performance y Accessibility,
  con carga inicial ligera (JavaScript de cliente mínimo; preferir Server Components).
- DEBE construirse solo lo especificado (YAGNI). Toda dependencia nueva DEBE justificarse en el
  plan indicando el problema que resuelve y por qué no basta lo existente.

**Rationale**: el sorteo debe ser verificable y justo, el formulario rápido en redes móviles
lentas, y la base de código pequeña para mantenerla segura y simple.

## Restricciones Técnicas y de Despliegue

- Stack fijo: Next.js (App Router), TypeScript estricto, Firebase (Firestore, Auth solo
  admin), Zod, ESLint, Prettier. Cambiarlo exige una enmienda de esta constitución.
- Los entornos (local, preview, producción) DEBEN configurarse únicamente por variables de
  entorno; DEBE usarse un proyecto Firebase distinto para producción y para desarrollo.
- El panel de administración DEBE estar protegido por autenticación y verificación de rol en
  el servidor; ocultar rutas en la UI no se considera protección.
- El idioma por defecto del documento DEBE ser `es-PE` (`<html lang="es-PE">`), con fechas y
  zona horaria coherentes con Perú.

## Flujo de Desarrollo y Puertas de Calidad

- Antes de integrar o desplegar, DEBEN pasar: `tsc --noEmit`, ESLint, Prettier (check),
  pruebas unitarias, pruebas de reglas de Firestore, prueba E2E y auditoría Lighthouse.
- Todo `plan.md` DEBE incluir un "Constitution Check" que verifique los principios I–VI;
  cualquier desviación DEBE registrarse y justificarse en "Complexity Tracking".
- Ningún cambio DEBE incluir secretos, datos reales de participantes ni colores hardcodeados.
- Las revisiones de código DEBEN verificar explícitamente cumplimiento de los principios III
  y IV.

## Governance

- Esta constitución prevalece sobre cualquier otra práctica o documento del proyecto.
- Las enmiendas DEBEN hacerse mediante `/speckit-constitution`, documentando el cambio en un
  Sync Impact Report y actualizando la versión y la fecha de última enmienda.
- El versionado sigue SemVer: MAJOR para eliminar o redefinir de forma incompatible un
  principio o regla de gobernanza; MINOR para añadir un principio o sección, o ampliar de
  forma material una guía; PATCH para aclaraciones, redacción o correcciones menores.
- El cumplimiento DEBE revisarse en cada plan (Constitution Check) y en cada revisión de
  código; los incumplimientos sin justificación bloquean la integración.

**Version**: 2.1.0 | **Ratified**: 2026-10-21 | **Last Amended**: 2026-10-23
