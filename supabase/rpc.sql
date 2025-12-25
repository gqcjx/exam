-- 随机抽题函数（已设置search_path确保安全性）
create or replace function fn_random_questions(
  p_subject text default null,
  p_grade text default null,
  p_types question_type[] default null,
  p_difficulty int default null,
  p_limit int default 10
)
returns setof questions
language sql
stable
security definer
set search_path = public
as $$
  select *
  from questions
  where (p_subject is null or subject = p_subject)
    and (p_grade is null or grade = p_grade)
    and (p_types is null or type = any(p_types))
    and (p_difficulty is null or difficulty = p_difficulty)
  order by random()
  limit p_limit;
$$;





