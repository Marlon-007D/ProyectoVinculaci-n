# Solicitudes de revisión de base de datos

No se modificaron migraciones, políticas ni funciones SQL.

## Alcance de las políticas de formularios

En `supabase/migrations/202610100001_dece_forms.sql`, `dece_has_institution_access()` comprueba cualquier fila de `memberships`, sin verificar que el rol sea `dece_staff` o `student`. Las políticas `dece_forms_access` y relacionadas usan esa función para permitir acceso a formularios, envíos y respuestas. Además, se concede `DELETE` en esas tablas a `authenticated`. Si esta migración está aplicada junto con las políticas descritas para el proyecto, las políticas permisivas se combinan y pueden ampliar el acceso más allá del rol previsto. Solicitud: confirmar y ajustar las políticas para restringir formularios DECE a `dece_staff` de la institución y limitar estudiantes a sus propias fichas publicadas/en borrador, sin acceso a formularios de otras membresías.

## Unicidad de números de caso

`dece_cases.case_number` no tiene restricción de unicidad. Solicitud pendiente: agregar unicidad por institución (y año conforme al formato `DECE-AAAA-NNNN`) para evitar duplicados ante altas concurrentes. La aplicación consulta el mayor número visible por institución y año y suma uno, sin reintentos.

## Portal estudiantil de casos

Se informó que existe `public.dece_my_student_id()` y la RPC `public.dece_student_portal_summary()`, `SECURITY DEFINER`, ejecutable por `authenticated` sin permisos de escritura ni nuevas políticas RLS para estudiantes. El portal React ya llama exclusivamente esa RPC y renderiza solo número de caso, estado, siguiente acción pendiente/fecha y próxima visita futura; no consulta directamente tablas de casos/acciones desde la sesión estudiantil. Se intentó validar con la cuenta de pruebas disponible, pero autenticación respondió HTTP 400 antes de invocar la RPC. Pendiente: usar una sesión válida de estudiante, confirmar aislamiento y revisar si se permite mostrar la descripción de la acción.

## Auditoría de altas y ediciones de estudiantes y casos

El cliente inserta en `audit_events` únicamente `institution_id`, `profile_id`, `action`, `entity_type`, `entity_id` y nombres de campos cambiados; en casos añade solo los estados técnicos anterior/nuevo. Solicitud: confirmar que la tabla existe con esas columnas y que `dece_staff` puede insertar eventos solo en instituciones donde tiene membresía. Ante fallo, la aplicación no revierte la operación y muestra el aviso.

## Bucket privado

No se encontró configuración versionada de `dece-documents` ni políticas de almacenamiento. Solicitud: confirmar políticas de lectura/escritura que restrinjan la ruta `<institution_id>/<archivo>` a `dece_staff` de la institución y nieguen acceso a `institution_admin`.
