# Data Model: Registro y Sorteo

Almacén: Cloud Firestore (modo nativo). Acceso exclusivo desde el servidor con Admin SDK
([research D-002](research.md#d-002-firestore-solo-vía-admin-sdk-reglas-deny-all)).

## Colecciones

### `participants/{phoneE164}` — Participante

El ID del documento es el celular normalizado, p. ej. `+51987654321` (garantiza unicidad, FR-012).

| Campo | Tipo | Reglas de validación | Origen |
|---|---|---|---|
| `fullName` | string | NFC, espacios colapsados, ≥ 2 términos de solo letras Unicode, ≤ 100 caracteres (FR-003) | formulario |
| `phone` | string | `+51` + `^9\d{8}$`; debe ser igual al ID del documento (FR-004) | formulario (normalizado) |
| `company` | string | 2–100 caracteres, espacios colapsados, sin caracteres de control (FR-005) | formulario |
| `createdAt` | timestamp | hora del servidor (FR-008) | servidor |
| `consent.acceptedAt` | timestamp | hora del servidor (FR-008) | servidor |
| `consent.version` | string | igual a `CONSENT_VERSION` vigente (FR-008) | formulario, verificada por servidor |
| `drawId` | string \| null | `null` al registrarse; ID del sorteo en que ganó | servidor |

- Ganador = `drawId != null`. Un participante gana como máximo una vez (FR-023).
- No hay campos adicionales: minimización de datos (constitución IV).
- Consultas: lista ordenada por `createdAt desc` (índice simple automático); elegibles `where drawId == null`
  (índice simple automático); conteo con agregación `count()`. No se requieren índices compuestos.

### `draws/{drawId}` — Sorteo (una ronda)

| Campo | Tipo | Notas |
|---|---|---|
| `createdAt` | timestamp | hora del servidor |
| `createdBy` | map `{ uid: string, email: string }` | administrador que ejecutó (FR-022) |
| `requestedCount` | number | entero ≥ 1 y ≤ elegibles al momento (FR-019) |
| `winners` | array de `{ fullName, company, phone }` | copia al momento de la ronda para mostrar el resultado (US4); `phone` en formato nacional de 9 dígitos (el ID del participante conserva E.164) |
| `purgedAt` | timestamp \| null | se completa al borrar los datos (FR-031) |

Tras el borrado de datos (`purgedAt != null`), cada elemento de `winners` queda solo como `{ fullName }`;
`company` y `phone` se eliminan (FR-031, SC-011).

### `settings/registration` — Estado de inscripciones

| Campo | Tipo | Notas |
|---|---|---|
| `open` | boolean | si el documento no existe se interpreta `true` (inicialmente abiertas) |
| `updatedAt` | timestamp | |
| `updatedBy` | string | uid del administrador |
| `dataPurgedAt` | timestamp \| null | marca de que se borraron los datos de la campaña |

## Relaciones

```text
settings/registration (1) ── controla ──► participants (N)
participants (N) ── ganó en ──► draws (0..1 por participante vía drawId)
draws (1) ── contiene copia de ──► winners (N dentro del documento)
```

Los ganadores no se modelan como subcolección: la copia dentro de `draws` facilita el borrado atómico de datos
personales y la consulta del historial con una sola lectura.

## Transiciones de estado

```text
Inscripciones:  abiertas ⇄ cerradas                    (solo admin, FR-029)

Participante:   (inexistente) ──registro──► registrado ──sorteo──► ganador ──borrado──► (eliminado)
                                 │ requiere: abiertas + App Check + validación + consentimiento
                                 └─ si el celular ya existe → ALREADY_EXISTS (409), sin cambios

Borrado:        solo con inscripciones cerradas (FR-030):
                1) reducir draws[].winners a { fullName } y fijar purgedAt
                2) eliminar todos los participants (BulkWriter, lotes)
                3) fijar settings/registration.dataPurgedAt
                Reintentable: si falla a la mitad, volver a ejecutar completa sin duplicar efectos.
```

## Operaciones transaccionales

| Operación | Lecturas | Escrituras | Garantía |
|---|---|---|---|
| Registrar | `settings/registration` | `create` de `participants/{phone}` | no se registra con inscripciones cerradas ni duplicado, aun con concurrencia |
| Ejecutar sorteo | los N `participants` elegidos | `update drawId` ×N + `create` de `draws/{id}` | ningún participante gana dos veces aunque haya dos sorteos simultáneos |
| Cambiar estado | — | `set` de `settings/registration` | el siguiente registro ve el cambio |

## Reglas de seguridad (`firestore.rules`)

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Prueba obligatoria (`tests/rules`): para un contexto anónimo y uno autenticado (incluso con claim `admin`),
`get`, `list`, `create`, `update` y `delete` sobre `participants`, `draws` y `settings` son denegados. La
autorización del administrador se verifica en el servidor, no en las reglas.
