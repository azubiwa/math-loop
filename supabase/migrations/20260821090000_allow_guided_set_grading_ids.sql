alter table public.math_abc_grade_usage
  drop constraint if exists math_abc_grade_usage_problem_id_check;

alter table public.math_abc_grade_usage
  add constraint math_abc_grade_usage_problem_id_check
  check (problem_id ~ '^(MABC[0-9]{3}|L[1-3]-[0-9]{3}|GSET-[0-9]{3})-[A-E]$');
