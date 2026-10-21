# Solicitudes de revisión de base de datos

No se modificaron migraciones, políticas ni funciones SQL.

## Alcance de las políticas de formularios

En `supabase/migrations/202610100001_dece_forms.sql`, `dece_has_institution_access()` comprueba cualquier fila de `memberships`, sin verificar que el rol sea `dece_staff` o `student`. Las políticas `dece_forms_access` y relacionadas usan esa función para permitir acceso a formularios, envíos y respuestas. Además, se concede `DELETE` en esas tablas a `authenticated`. Si esta migración está aplicada junto con las políticas descritas para el proyecto, las políticas permisivas se combinan y pueden ampliar el acceso más allá del rol previsto. Solicitud: confirmar y ajustar las políticas para restringir formularios DECE a `dece_staff` de la institución y limitar estudiantes a sus propias fichas publicadas/en borrador, sin acceso a formularios de otras membresías.

### Incidencia comprobada en sesión de estudiante

DECE puede guardar preguntas, pero al estudiante la consulta inicial a `form_definitions` devuelve cero filas; la interfaz informa que no puede ver la ficha o que aún no está publicada. Esta consulta filtra por `institution_id`, `code` (`general` / `authorization`) e `is_active = true`. Solicitud: con la sesión autenticada de estudiante, verificar `SELECT` de la ficha activa y publicada en `form_definitions`, su versión `published` en `form_versions`, y preguntas/opciones en `form_questions` y `form_question_options`. Confirmar además que ambas fichas tengan esos códigos, `is_active = true` y el mismo `institution_id` del estudiante. Una consulta desde SQL Editor como `postgres` no valida RLS de `authenticated`.

## Esquema operativo DECE

El repositorio solo incluye la migración de integridad de formularios. No hay definición versionada de las tablas de familia, contactos de emergencia, casos, visitas, observaciones, acciones, documentos ni enums de casos. Solicitud: compartir o versionar el esquema vigente de esas tablas (columnas, claves foráneas, enums y políticas RLS), además de las columnas completas de `students` y el modelo de relaciones, para implementar altas/ediciones, historial y archivos sin asumir nombres ni valores.

## Auditoría de altas y ediciones de estudiantes

El cliente DECE intenta insertar en `audit_events` únicamente `institution_id`, `profile_id`, `action`, `entity_type`, `entity_id` y `payload.changed_fields` (nombres de campos; nunca valores personales). El repositorio no incluye el esquema ni las políticas RLS de `audit_events`, así que no se puede confirmar que la escritura esté permitida. Solicitud: confirmar que la tabla existe con esas columnas y que `dece_staff` puede insertar eventos solo en instituciones donde tiene membresía. La aplicación no revierte la operación de estudiante si falla la auditoría y muestra un aviso.

## Bucket privado

No se encontró configuración versionada de `dece-documents` ni políticas de almacenamiento. Solicitud: confirmar políticas de lectura/escritura que restrinjan la ruta `<institution_id>/<archivo>` a `dece_staff` de la institución y nieguen acceso a `institution_admin`.
