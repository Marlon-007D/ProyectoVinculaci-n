-- Estudiantes pueden consultar y editar únicamente sus propios envíos y respuestas.
-- Se mantiene el historial al modificar el envío: no se eliminan respuestas ni plantillas.

drop policy if exists student_own_form_submissions on public.form_submissions;
create policy student_own_form_submissions on public.form_submissions
  for all to authenticated
  using (exists (
    select 1 from public.students s
    where s.student_id = form_submissions.student_id
      and s.profile_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.students s
    where s.student_id = form_submissions.student_id
      and s.profile_id = auth.uid()
  ));

drop policy if exists student_own_form_answers on public.form_answers;
create policy student_own_form_answers on public.form_answers
  for all to authenticated
  using (exists (
    select 1 from public.form_submissions fs
    join public.students s on s.student_id = fs.student_id
    where fs.form_submission_id = form_answers.form_submission_id
      and s.profile_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.form_submissions fs
    join public.students s on s.student_id = fs.student_id
    where fs.form_submission_id = form_answers.form_submission_id
      and s.profile_id = auth.uid()
  ));

drop policy if exists student_own_form_answer_options on public.form_answer_options;
create policy student_own_form_answer_options on public.form_answer_options
  for all to authenticated
  using (exists (
    select 1 from public.form_answers a
    join public.form_submissions fs on fs.form_submission_id = a.form_submission_id
    join public.students s on s.student_id = fs.student_id
    where a.form_answer_id = form_answer_options.form_answer_id
      and s.profile_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.form_answers a
    join public.form_submissions fs on fs.form_submission_id = a.form_submission_id
    join public.students s on s.student_id = fs.student_id
    where a.form_answer_id = form_answer_options.form_answer_id
      and s.profile_id = auth.uid()
  ));
