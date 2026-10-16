# Esquema de base de datos DECE

Esquema operativo comunicado para el módulo de casos. La base ya está configurada; este documento no implica migraciones.

## Tablas

- `dece_cases`: `dece_case_id` uuid PK; `institution_id` uuid; `student_id` uuid; `case_number` varchar obligatorio, sin restricción de unicidad; `reason` text obligatorio; `primary_category` `dece_observation_category` obligatorio; `risk_level` `dece_risk_level` default `low`; `confidentiality_level` `dece_confidentiality_level` default `restricted`; `status` `case_status_type` default `registered`; `opened_by` uuid (profile); `created_at`; `updated_at`.
- `dece_visits`: `dece_visit_id`; `dece_case_id`; `visit_date` timestamptz obligatorio; `summary` text obligatorio; `attention_notes` text opcional; `attended_by` uuid (profile, opcional).
- `dece_observations`: `dece_observation_id`; `dece_visit_id`; `category` `dece_observation_category`; `description` text obligatorio; `severity` `dece_risk_level` default `low`; `requires_follow_up` boolean default `false`.
- `dece_actions`: `dece_action_id`; `dece_case_id`; `description` text obligatorio; `due_date` date opcional; `is_completed` boolean default `false`; `completed_at` timestamptz opcional; `responsible_profile_id` uuid opcional (profile).
- `dece_case_assignments` existe, pero no forma parte de esta fase.

## Enums

- `case_status_type`: `registered` = Registrado; `in_progress` = En atención; `under_monitoring` = En seguimiento; `closed` = Cerrado.
- `dece_risk_level`: `low` = Bajo; `medium` = Medio; `high` = Alto; `critical` = Crítico.
- `dece_confidentiality_level`: `restricted` = Restringido; `highly_restricted` = Altamente restringido.
- `dece_observation_category`: `physical` = Física; `psychological` = Psicológica; `social` = Social; `family` = Familiar; `academic` = Académica; `behavioral` = Conductual; `other` = Otra.

## Relaciones y permisos

`dece_cases` referencia `students` mediante la clave foránea compuesta `(institution_id, student_id)`. Las políticas RLS actuales permiten a `dece_staff` leer, crear, editar y borrar casos, visitas, observaciones y acciones de su institución. `institution_admin`, `student` y `anon` no tienen acceso directo a esas tablas. Para estudiantes se informó la RPC `public.dece_student_portal_summary()`, que devuelve un resumen limitado sin conceder acceso directo ni escritura; su validación desde la aplicación sigue pendiente. En esta fase no se aplican restricciones de acceso por `confidentiality_level`.
