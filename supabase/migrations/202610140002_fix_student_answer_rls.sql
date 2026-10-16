-- SECURITY DEFINER evita que las subconsultas de las políticas queden ocultas
-- por RLS de students o form_submissions al verificar la propiedad del envío.
create or replace function public.student_owns_form_submission(target_submission uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.form_submissions fs
    join public.students s on s.student_id = fs.student_id
    where fs.form_submission_id = target_submission
      and s.profile_id = auth.uid()
  );
$$;

create or replace function public.student_owns_form_answer(target_answer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.form_answers a
    join public.form_submissions fs on fs.form_submission_id = a.form_submission_id
    join public.students s on s.student_id = fs.student_id
    where a.form_answer_id = target_answer
      and s.profile_id = auth.uid()
  );
$$;

revoke all on function public.student_owns_form_submission(uuid) from public;
revoke all on function public.student_owns_form_answer(uuid) from public;
grant execute on function public.student_owns_form_submission(uuid) to authenticated;
grant execute on function public.student_owns_form_answer(uuid) to authenticated;

drop policy if exists student_own_form_answers on public.form_answers;
create policy student_own_form_answers on public.form_answers
  for all to authenticated
  using (public.student_owns_form_submission(form_submission_id))
  with check (public.student_owns_form_submission(form_submission_id));

drop policy if exists student_own_form_answer_options on public.form_answer_options;
create policy student_own_form_answer_options on public.form_answer_options
  for all to authenticated
  using (public.student_owns_form_answer(form_answer_id))
  with check (public.student_owns_form_answer(form_answer_id));
