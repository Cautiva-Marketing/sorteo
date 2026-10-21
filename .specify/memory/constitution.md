<!--
SYNC IMPACT REPORT (temporal; eliminar antes de hacer commit)
- Version change: 1.0.0 → 1.0.1 (PATCH: aclaración del principio III, sin cambiar su intención)
- Principios modificados: III. Seguridad y Prevención de Abuso (se aclara que reglas
  `deny all` con acceso solo por servidor cumplen el requisito)
- Principios añadidos en 1.0.0 (adopción inicial):
  I. Stack y Arquitectura en Capas
  II. Calidad de Código y Validación
  III. Seguridad y Prevención de Abuso (NO NEGOCIABLE)
  IV. Privacidad de Datos Personales (Ley 29733)
  V. UX Mobile-First, Marca y Accesibilidad
  VI. Pruebas, Rendimiento y Simplicidad
- Secciones añadidas: Restricciones Técnicas y de Despliegue; Flujo de Desarrollo y
  Puertas de Calidad; Governance
- Secciones eliminadas: ninguna
- Plantillas dependientes: no se modifican (leen la constitución en tiempo de ejecución)
- TODOs pendientes: ninguno (la ruta del logo se resolvió a `logo.svg` en la raíz del repo)
-->
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

### III. Seguridad y Prevención de Abuso (NO NEGOCIABLE)

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
- No DEBE existir más de un registro por celular. El celular DEBE normalizarse a formato
  E.164 (`+51XXXXXXXXX`) y la unicidad DEBE garantizarse en el servidor o en las reglas de
  datos (p. ej. usando el celular normalizado como ID del documento), no solo en la UI.
- El registro DEBE estar protegido contra spam mediante al menos uno de: rate limiting,
  Firebase App Check o reCAPTCHA.
- Las reglas de Firestore DEBEN estar cubiertas por pruebas contra el emulador.

**Rationale**: el formulario es público y se difunde por QR; sin reglas estrictas y sin
anti-abuso, el sorteo pierde legitimidad y los datos personales quedan expuestos.

### IV. Privacidad de Datos Personales (Ley 29733)

- El tratamiento de nombre y celular DEBE cumplir la Ley N.º 29733 (Perú) y su reglamento.
- El formulario DEBE mostrar, antes del envío, la finalidad del tratamiento (participación en
  el sorteo y contacto al ganador) y un casillero de consentimiento explícito, obligatorio y
  NO premarcado, con enlace al texto completo de la política.
- El registro DEBE guardar evidencia del consentimiento (fecha/hora y versión del texto
  aceptado).
- DEBE recolectarse solo lo estrictamente necesario (nombre y celular); cualquier campo
  adicional exige enmendar esta constitución o justificarlo en el plan.
- Los datos NO DEBEN usarse para una finalidad distinta a la declarada sin nuevo
  consentimiento, ni exponerse en el cliente público ni en logs.

**Rationale**: el consentimiento informado y la minimización son obligaciones legales y
reducen el riesgo para los participantes y para la empresa.

### V. UX Mobile-First, Marca y Accesibilidad

- La interfaz DEBE diseñarse primero para móvil (desde 360 px de ancho) y escalar a pantallas
  mayores; el flujo principal de entrada es el escaneo de un QR.
- La identidad visual DEBE derivarse de `logo.svg` (raíz del repo): azul de marca `#3d8cd3` y
  blanco `#ffffff`. Los colores DEBEN definirse como design tokens (variables CSS / tema de
  Tailwind); NO DEBEN hardcodearse valores de color en componentes.
- El logo es blanco con acentos azules: DEBE colocarse solo sobre fondos oscuros distintos del
  azul de marca, de modo que ningún elemento del logo se pierda.
- El contraste DEBE cumplir WCAG 2.1 AA (4.5:1 texto normal, 3:1 texto grande y componentes
  de UI). Nota: `#3d8cd3` frente a blanco ronda 3.6:1, por lo que NO DEBE usarse para texto
  normal en ninguna combinación con blanco; DEBE definirse un token más oscuro para ese caso.
- Cada campo DEBE tener un `label` asociado; los errores DEBEN estar en español, ser claros y
  anunciarse a lectores de pantalla (`aria-describedby` / `aria-live`).
- Toda la interfaz y los mensajes DEBEN estar en español (es-PE).

**Rationale**: la mayoría de participantes entra desde un celular, a menudo con luz exterior
y redes lentas; la marca consistente y la accesibilidad elevan la conversión y la confianza.

### VI. Pruebas, Rendimiento y Simplicidad

- DEBEN existir pruebas unitarias para: esquemas de validación Zod, normalización de celular y
  lógica del sorteo (selección con aleatoriedad criptográficamente segura, sin repetir
  ganadores, solo entre registros válidos).
- DEBE existir al menos una prueba E2E del flujo de registro que cubra éxito, celular
  duplicado y envío sin consentimiento.
- La página de registro DEBE obtener Lighthouse móvil ≥ 90 en Performance y Accessibility,
  con carga inicial ligera (JavaScript de cliente mínimo; preferir Server Components).
- DEBE construirse solo lo especificado (YAGNI). Toda dependencia nueva DEBE justificarse en el
  plan indicando el problema que resuelve y por qué no basta lo existente.

**Rationale**: el sorteo debe ser verificable y justo, el formulario rápido en redes móviles
lentas, y la base de código pequeña para mantenerla seguros y simple.

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

**Version**: 1.0.1 | **Ratified**: 2026-10-21 | **Last Amended**: 2026-10-21
