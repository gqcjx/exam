-- 启用 RLS 与示例策略（请按需调整）

-- 安全函数：检查当前用户是否为管理员或教师（避免 RLS 递归）
create or replace function public.is_admin_or_teacher()
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  user_role role_type;
begin
  select role into user_role
  from profiles
  where user_id = auth.uid();
  
  return user_role in ('admin', 'teacher');
exception
  when others then
    return false;
end;
$$;

-- profiles
alter table profiles enable row level security;
drop policy if exists "profiles owner select" on profiles;
create policy "profiles owner select" on profiles
  for select using ((select auth.uid()) = user_id);
drop policy if exists "profiles owner insert" on profiles;
create policy "profiles owner insert" on profiles
  for insert with check ((select auth.uid()) = user_id);
drop policy if exists "profiles owner update" on profiles;
create policy "profiles owner update" on profiles
  for update using ((select auth.uid()) = user_id);
drop policy if exists "profiles admin/teacher read" on profiles;
create policy "profiles admin/teacher read" on profiles
  for select using (public.is_admin_or_teacher());

-- questions
alter table questions enable row level security;
drop policy if exists "questions read all" on questions;
create policy "questions read all" on questions
  for select using (true); -- 若需仅登录可读改为 auth.uid() is not null
drop policy if exists "questions insert admin/teacher" on questions;
create policy "questions insert admin/teacher" on questions
  for insert with check (public.is_admin_or_teacher());
drop policy if exists "questions update admin/teacher" on questions;
create policy "questions update admin/teacher" on questions
  for update using (public.is_admin_or_teacher());
drop policy if exists "questions delete admin/teacher" on questions;
create policy "questions delete admin/teacher" on questions
  for delete using (public.is_admin_or_teacher());

-- papers
alter table papers enable row level security;
drop policy if exists "papers read published or owner/teacher/admin" on papers;
create policy "papers read published or owner/teacher/admin" on papers
  for select using (
    published = true
    or created_by = (select auth.uid())
    or public.is_admin_or_teacher()
  );
drop policy if exists "papers insert admin/teacher" on papers;
create policy "papers insert admin/teacher" on papers
  for insert with check (public.is_admin_or_teacher());
drop policy if exists "papers update admin/teacher" on papers;
create policy "papers update admin/teacher" on papers
  for update using (public.is_admin_or_teacher());
drop policy if exists "papers delete admin/teacher" on papers;
create policy "papers delete admin/teacher" on papers
  for delete using (public.is_admin_or_teacher());

-- answers
alter table answers enable row level security;
drop policy if exists "answers owner select" on answers;
create policy "answers owner select" on answers
  for select using (user_id = (select auth.uid()));
drop policy if exists "answers owner insert" on answers;
create policy "answers owner insert" on answers
  for insert with check (user_id = (select auth.uid()));
drop policy if exists "answers owner update" on answers;
create policy "answers owner update" on answers
  for update using (user_id = (select auth.uid()));
drop policy if exists "answers teacher/admin read" on answers;
create policy "answers teacher/admin read" on answers
  for select using (public.is_admin_or_teacher());
drop policy if exists "answers parent read child" on answers;
create policy "answers parent read child" on answers
  for select using (
    exists (
      select 1 from parent_child pc
      where pc.parent_id = (select auth.uid()) and pc.child_id = answers.user_id
    )
  );
drop policy if exists "answers teacher/admin update manual_score" on answers;
create policy "answers teacher/admin update manual_score" on answers
  for update using (public.is_admin_or_teacher())
  with check (true);

-- parent_child
alter table parent_child enable row level security;
drop policy if exists "parent manages own relations insert" on parent_child;
create policy "parent manages own relations insert" on parent_child
  for insert with check (parent_id = (select auth.uid()));
drop policy if exists "parent manages own relations delete" on parent_child;
create policy "parent manages own relations delete" on parent_child
  for delete using (parent_id = (select auth.uid()));
drop policy if exists "teacher/admin read" on parent_child;
create policy "teacher/admin read" on parent_child
  for select using (public.is_admin_or_teacher());

-- paper_questions
alter table paper_questions enable row level security;
drop policy if exists "paper_questions read all" on paper_questions;
create policy "paper_questions read all" on paper_questions
  for select using (true); -- 所有人都可以查看试卷题目关联
drop policy if exists "paper_questions insert admin/teacher" on paper_questions;
create policy "paper_questions insert admin/teacher" on paper_questions
  for insert with check (public.is_admin_or_teacher());
drop policy if exists "paper_questions update admin/teacher" on paper_questions;
create policy "paper_questions update admin/teacher" on paper_questions
  for update using (public.is_admin_or_teacher());
drop policy if exists "paper_questions delete admin/teacher" on paper_questions;
create policy "paper_questions delete admin/teacher" on paper_questions
  for delete using (public.is_admin_or_teacher());

-- answers_draft
alter table answers_draft enable row level security;
drop policy if exists "answers_draft owner select" on answers_draft;
create policy "answers_draft owner select" on answers_draft
  for select using ((select auth.uid()) = user_id);
drop policy if exists "answers_draft owner insert" on answers_draft;
create policy "answers_draft owner insert" on answers_draft
  for insert with check ((select auth.uid()) = user_id);
drop policy if exists "answers_draft owner update" on answers_draft;
create policy "answers_draft owner update" on answers_draft
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "answers_draft owner delete" on answers_draft;
create policy "answers_draft owner delete" on answers_draft
  for delete using ((select auth.uid()) = user_id);

-- wrong_questions
alter table wrong_questions enable row level security;
drop policy if exists "wrong_questions owner select" on wrong_questions;
create policy "wrong_questions owner select" on wrong_questions
  for select using ((select auth.uid()) = user_id);
drop policy if exists "wrong_questions owner insert" on wrong_questions;
create policy "wrong_questions owner insert" on wrong_questions
  for insert with check ((select auth.uid()) = user_id);
drop policy if exists "wrong_questions owner update" on wrong_questions;
create policy "wrong_questions owner update" on wrong_questions
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "wrong_questions owner delete" on wrong_questions;
create policy "wrong_questions owner delete" on wrong_questions
  for delete using ((select auth.uid()) = user_id);
drop policy if exists "wrong_questions teacher/admin read" on wrong_questions;
create policy "wrong_questions teacher/admin read" on wrong_questions
  for select using (public.is_admin_or_teacher());

-- tags
alter table tags enable row level security;
drop policy if exists "tags read all" on tags;
create policy "tags read all" on tags
  for select using (true); -- 所有人都可以查看标签
drop policy if exists "tags insert admin/teacher" on tags;
create policy "tags insert admin/teacher" on tags
  for insert with check (public.is_admin_or_teacher());
drop policy if exists "tags update admin/teacher" on tags;
create policy "tags update admin/teacher" on tags
  for update using (public.is_admin_or_teacher());
drop policy if exists "tags delete admin/teacher" on tags;
create policy "tags delete admin/teacher" on tags
  for delete using (public.is_admin_or_teacher());

-- notifications
alter table notifications enable row level security;
drop policy if exists "Users can view their own notifications" on notifications;
create policy "Users can view their own notifications" on notifications
  for select using ((select auth.uid()) = user_id);
drop policy if exists "Users can update their own notifications" on notifications;
create policy "Users can update their own notifications" on notifications
  for update using ((select auth.uid()) = user_id);
drop policy if exists "Users can delete their own notifications" on notifications;
create policy "Users can delete their own notifications" on notifications
  for delete using ((select auth.uid()) = user_id);

