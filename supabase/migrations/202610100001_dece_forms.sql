-- Integridad de formularios DECE. Ejecutar después de crear las tablas base
-- incluidas en el esquema compartido.

create unique index if not exists form_definitions_institution_code_uidx
  on public.form_definitions (institution_id, code);
create unique index if not exists form_versions_definition_number_uidx
  on public.form_versions (form_definition_id, version_number);
create unique index if not exists form_questions_version_code_uidx
  on public.form_questions (form_version_id, code);
create unique index if not exists form_questions_version_id_uidx
  on public.form_questions (form_version_id, form_question_id);
create unique index if not exists form_question_options_question_id_uidx
  on public.form_question_options (form_question_id, question_option_id);
create unique index if not exists form_submissions_student_version_uidx
  on public.form_submissions (student_id, form_version_id);
create unique index if not exists form_submissions_id_version_uidx
  on public.form_submissions (form_submission_id, form_version_id);
create unique index if not exists form_answers_submission_question_uidx
  on public.form_answers (form_submission_id, form_question_id);
create unique index if not exists form_answers_id_question_uidx
  on public.form_answers (form_answer_id, form_question_id);

-- El esquema de contexto tenía varias FK compuestas enlazadas a columnas
-- equivocadas. Se sustituyen por relaciones que validan formulario, versión,
-- pregunta y opción de cada respuesta.
alter table public.form_answers
  drop constraint if exists form_answer_submission_version_fk,
  drop constraint if exists form_answer_question_version_fk,
  drop constraint if exists form_answer_selected_option_fk,
  drop constraint if exists form_answer_selected_option_question_fk;

alter table public.form_answers
  add constraint form_answer_submission_version_fk
    foreign key (form_submission_id, form_version_id)
    references public.form_submissions (form_submission_id, form_version_id),
  add constraint form_answer_question_version_fk
    foreign key (form_version_id, form_question_id)
    references public.form_questions (form_version_id, form_question_id),
  add constraint form_answer_selected_option_question_fk
    foreign key (form_question_id, selected_option_id)
    references public.form_question_options (form_question_id, question_option_id);

alter table public.form_answer_options
  drop constraint if exists form_answer_options_answer_question_fk,
  drop constraint if exists form_answer_options_option_question_fk;

alter table public.form_answer_options
  add constraint form_answer_options_answer_question_fk
    foreign key (form_answer_id, form_question_id)
    references public.form_answers (form_answer_id, form_question_id) on delete cascade,
  add constraint form_answer_options_option_question_fk
    foreign key (form_question_id, question_option_id)
    references public.form_question_options (form_question_id, question_option_id);

create unique index if not exists form_answer_options_answer_option_uidx
  on public.form_answer_options (form_answer_id, question_option_id);

grant select, insert, update, delete on
  public.form_definitions, public.form_versions, public.form_questions,
  public.form_question_options, public.form_submissions, public.form_answers,
  public.form_answer_options to authenticated;

-- Las preguntas de sistema se conservan siempre: la interfaz solo puede
-- retirar preguntas personalizadas y la base también rechaza borrar o alterar
-- el vínculo de una pregunta fija.
create or replace function public.protect_dece_system_question()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.is_system then
    raise exception 'Las preguntas de sistema no se pueden modificar ni eliminar';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists protect_dece_system_question on public.form_questions;
create trigger protect_dece_system_question
before update or delete on public.form_questions
for each row execute function public.protect_dece_system_question();

create or replace function public.ensure_dece_submission_student_institution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  form_institution uuid;
  student_institution uuid;
begin
  select d.institution_id into form_institution
  from public.form_versions v
  join public.form_definitions d using (form_definition_id)
  where v.form_version_id = new.form_version_id;

  select s.institution_id into student_institution
  from public.students s where s.student_id = new.student_id;

  if form_institution is null or student_institution is distinct from form_institution then
    raise exception 'La ficha y el estudiante deben pertenecer a la misma institución';
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_dece_submission_student_institution on public.form_submissions;
create trigger ensure_dece_submission_student_institution
before insert or update of form_version_id, student_id on public.form_submissions
for each row execute function public.ensure_dece_submission_student_institution();

-- Una política común permite al módulo DECE reutilizar el usuario autenticado
-- por el login. La institución debe estar en sus memberships.
create or replace function public.dece_has_institution_access(target_institution uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.institution_id = target_institution
      and m.profile_id = auth.uid()
  );
$$;

revoke all on function public.dece_has_institution_access(uuid) from public;
grant execute on function public.dece_has_institution_access(uuid) to authenticated;

alter table public.form_definitions enable row level security;
alter table public.form_versions enable row level security;
alter table public.form_questions enable row level security;
alter table public.form_question_options enable row level security;
alter table public.form_submissions enable row level security;
alter table public.form_answers enable row level security;
alter table public.form_answer_options enable row level security;

drop policy if exists dece_forms_access on public.form_definitions;
create policy dece_forms_access on public.form_definitions
  for all to authenticated
  using (public.dece_has_institution_access(institution_id))
  with check (public.dece_has_institution_access(institution_id));

drop policy if exists dece_form_versions_access on public.form_versions;
create policy dece_form_versions_access on public.form_versions
  for all to authenticated
  using (exists (
    select 1 from public.form_definitions d
    where d.form_definition_id = form_versions.form_definition_id
      and public.dece_has_institution_access(d.institution_id)
  ))
  with check (exists (
    select 1 from public.form_definitions d
    where d.form_definition_id = form_versions.form_definition_id
      and public.dece_has_institution_access(d.institution_id)
  ));

drop policy if exists dece_form_questions_access on public.form_questions;
create policy dece_form_questions_access on public.form_questions
  for all to authenticated
  using (exists (
    select 1 from public.form_versions v
    join public.form_definitions d using (form_definition_id)
    where v.form_version_id = form_questions.form_version_id
      and public.dece_has_institution_access(d.institution_id)
  ))
  with check (exists (
    select 1 from public.form_versions v
    join public.form_definitions d using (form_definition_id)
    where v.form_version_id = form_questions.form_version_id
      and public.dece_has_institution_access(d.institution_id)
  ));

drop policy if exists dece_form_question_options_access on public.form_question_options;
create policy dece_form_question_options_access on public.form_question_options
  for all to authenticated
  using (exists (
    select 1 from public.form_questions q
    join public.form_versions v using (form_version_id)
    join public.form_definitions d using (form_definition_id)
    where q.form_question_id = form_question_options.form_question_id
      and public.dece_has_institution_access(d.institution_id)
  ))
  with check (exists (
    select 1 from public.form_questions q
    join public.form_versions v using (form_version_id)
    join public.form_definitions d using (form_definition_id)
    where q.form_question_id = form_question_options.form_question_id
      and public.dece_has_institution_access(d.institution_id)
  ));

drop policy if exists dece_form_submissions_access on public.form_submissions;
create policy dece_form_submissions_access on public.form_submissions
  for all to authenticated
  using (exists (
    select 1 from public.form_versions v
    join public.form_definitions d using (form_definition_id)
    where v.form_version_id = form_submissions.form_version_id
      and public.dece_has_institution_access(d.institution_id)
  ))
  with check (exists (
    select 1 from public.form_versions v
    join public.form_definitions d using (form_definition_id)
    where v.form_version_id = form_submissions.form_version_id
      and public.dece_has_institution_access(d.institution_id)
  ));

drop policy if exists dece_form_answers_access on public.form_answers;
create policy dece_form_answers_access on public.form_answers
  for all to authenticated
  using (exists (
    select 1 from public.form_submissions s
    JOIN public.form_versions v
  ON v.form_version_id = s.form_version_id
    join public.form_definitions d using (form_definition_id)
    where s.form_submission_id = form_answers.form_submission_id
      and public.dece_has_institution_access(d.institution_id)
  ))
  with check (exists (
    select 1 from public.form_submissions s
    JOIN public.form_versions v
  ON v.form_version_id = s.form_version_id
    join public.form_definitions d using (form_definition_id)
    where s.form_submission_id = form_answers.form_submission_id
      and public.dece_has_institution_access(d.institution_id)
  ));

drop policy if exists dece_form_answer_options_access on public.form_answer_options;
create policy dece_form_answer_options_access on public.form_answer_options
  for all to authenticated
  using (exists (
    select 1 from public.form_answers a
    join public.form_submissions s using (form_submission_id)
    JOIN public.form_versions v
  ON v.form_version_id = s.form_version_id
    join public.form_definitions d using (form_definition_id)
    where a.form_answer_id = form_answer_options.form_answer_id
      and public.dece_has_institution_access(d.institution_id)
  ))
  with check (exists (
    select 1 from public.form_answers a
    join public.form_submissions s using (form_submission_id)
    JOIN public.form_versions v
  ON v.form_version_id = s.form_version_id
    join public.form_definitions d using (form_definition_id)
    where a.form_answer_id = form_answer_options.form_answer_id
      and public.dece_has_institution_access(d.institution_id)
  ));

-- Crear las dos fichas base para una institución. Se invoca una vez por centro:
-- select public.create_dece_default_forms('<institution UUID>');
create or replace function public.create_dece_default_forms(target_institution uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  form_code text;
  form_title text;
  definition_id uuid;
  version_id uuid;
begin
  if not public.dece_has_institution_access(target_institution) then
    raise exception 'No tienes acceso a esta institución';
  end if;

  foreach form_code in array array['general', 'authorization'] loop
    form_title := case form_code
      when 'general' then 'Registro general acumulativo estudiantil'
      else 'Ficha de autorización para atención y emergencias'
    end;

    insert into public.form_definitions (institution_id, code, name, is_active)
    values (target_institution, form_code, form_title, true)
    on conflict (institution_id, code) do update set name = excluded.name, is_active = true, updated_at = now()
    returning form_definition_id into definition_id;

    select v.form_version_id into version_id
    from public.form_versions v
    where v.form_definition_id = definition_id and v.status = 'published'
    order by v.version_number desc limit 1;

    if version_id is null then
      insert into public.form_versions (form_definition_id, version_number, status, published_at)
      values (definition_id, 1, 'published', now())
      returning form_version_id into version_id;

      insert into public.form_questions
        (form_version_id, code, label, data_type, source_field, is_required, is_system, position, display_config)
      values
        (version_id, 'student_national_id', 'Número de cédula', 'text', 'students.national_id', true, true, 1, '{"section":"Identificación"}'),
        (version_id, 'student_name', 'Apellidos y nombres', 'text', 'students.first_name', true, true, 2, '{"section":"Identificación"}'),
        (version_id, 'student_grade', 'Año de EGB', 'text', 'students.grade_level', false, true, 3, '{"section":"Identificación"}');

      if form_code = 'general' then
        insert into public.form_questions
          (form_version_id, code, label, data_type, is_required, is_system, position, display_config)
        values
          (version_id, 'family_contact', 'Representante o cuidador principal', 'text', false, false, 10, '{"section":"Datos familiares"}'),
          (version_id, 'family_phone', 'Teléfono familiar de contacto', 'text', false, false, 11, '{"section":"Datos familiares"}'),
          (version_id, 'family_members', 'Personas con quienes vive el estudiante', 'textarea', false, false, 12, '{"section":"Composición familiar"}'),
          (version_id, 'housing', 'Condición y descripción de vivienda', 'textarea', false, false, 13, '{"section":"Vivienda y servicios"}'),
          (version_id, 'health_conditions', 'Condiciones médicas o alergias relevantes', 'textarea', false, false, 14, '{"section":"Salud"}'),
          (version_id, 'academic_notes', 'Información académica adicional', 'textarea', false, false, 15, '{"section":"Información académica"}');
      else
        insert into public.form_questions
          (form_version_id, code, label, data_type, is_required, is_system, position, display_config)
        values
          (version_id, 'emergency_contact_name', 'Nombre del contacto de emergencia', 'text', true, false, 10, '{"section":"Atención y emergencias"}'),
          (version_id, 'emergency_contact_relation', 'Parentesco del contacto', 'text', false, false, 11, '{"section":"Atención y emergencias"}'),
          (version_id, 'emergency_contact_phone', 'Teléfono fijo de emergencia', 'text', true, false, 12, '{"section":"Atención y emergencias"}'),
          (version_id, 'emergency_contact_mobile', 'Teléfono celular de emergencia', 'text', false, false, 13, '{"section":"Atención y emergencias"}'),
          (version_id, 'medical_conditions', 'Enfermedades o condiciones médicas relevantes', 'textarea', false, false, 14, '{"section":"Información de salud"}'),
          (version_id, 'allergies', 'Alergias y medicamentos', 'textarea', false, false, 15, '{"section":"Información de salud"}'),
          (version_id, 'authorization_confirmed', 'Confirmo la autorización de atención y traslado de emergencia', 'boolean', true, false, 16, '{"section":"Autorización"}'),
          (version_id, 'authorization_notes', 'Observaciones de la autorización', 'textarea', false, false, 17, '{"section":"Autorización"}');
      end if;
    end if;
  end loop;
end;
$$;

grant execute on function public.create_dece_default_forms(uuid) to authenticated;
