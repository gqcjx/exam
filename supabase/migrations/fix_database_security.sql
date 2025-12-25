-- 数据库安全性修复迁移
-- 修复RLS策略和函数安全性问题

-- ============================================
-- 1. 修复函数 search_path 安全性问题
-- ============================================

-- 修复 fn_random_questions 函数
CREATE OR REPLACE FUNCTION public.fn_random_questions(
  p_subject text DEFAULT NULL,
  p_grade text DEFAULT NULL,
  p_types question_type[] DEFAULT NULL,
  p_difficulty int DEFAULT NULL,
  p_limit int DEFAULT 10
)
RETURNS SETOF questions
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM questions
  WHERE (p_subject IS NULL OR subject = p_subject)
    AND (p_grade IS NULL OR grade = p_grade)
    AND (p_types IS NULL OR type = ANY(p_types))
    AND (p_difficulty IS NULL OR difficulty = p_difficulty)
  ORDER BY random()
  LIMIT p_limit;
$$;

-- 修复 sync_profile_email_on_create 函数
CREATE OR REPLACE FUNCTION public.sync_profile_email_on_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 如果 profile 不存在，则创建；如果存在，则更新 email
  INSERT INTO public.profiles (user_id, name, role, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::text, 'student'),
    NEW.email
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = NEW.email,
    updated_at = NOW();
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- 如果出错，记录错误但不阻止用户创建
    RAISE WARNING 'Failed to create/update profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- 修复 sync_email_on_profile_create 函数
CREATE OR REPLACE FUNCTION public.sync_email_on_profile_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 如果 email 为空，从 auth.users 获取
  IF NEW.email IS NULL OR NEW.email = '' THEN
    SELECT email INTO NEW.email
    FROM auth.users
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- 修复 sync_profile_email_on_update 函数
CREATE OR REPLACE FUNCTION public.sync_profile_email_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 如果 email 发生变化，更新 profiles 表
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE profiles
    SET email = NEW.email
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================
-- 2. 为未启用RLS的表启用RLS并添加策略
-- ============================================

-- paper_questions 表
ALTER TABLE public.paper_questions ENABLE ROW LEVEL SECURITY;

-- 删除已存在的策略（如果有）
DROP POLICY IF EXISTS "paper_questions read all" ON public.paper_questions;
DROP POLICY IF EXISTS "paper_questions insert admin/teacher" ON public.paper_questions;
DROP POLICY IF EXISTS "paper_questions update admin/teacher" ON public.paper_questions;
DROP POLICY IF EXISTS "paper_questions delete admin/teacher" ON public.paper_questions;

-- 创建新策略
CREATE POLICY "paper_questions read all" ON public.paper_questions
  FOR SELECT
  USING (true); -- 所有人都可以查看试卷题目关联

CREATE POLICY "paper_questions insert admin/teacher" ON public.paper_questions
  FOR INSERT
  WITH CHECK (public.is_admin_or_teacher());

CREATE POLICY "paper_questions update admin/teacher" ON public.paper_questions
  FOR UPDATE
  USING (public.is_admin_or_teacher());

CREATE POLICY "paper_questions delete admin/teacher" ON public.paper_questions
  FOR DELETE
  USING (public.is_admin_or_teacher());

-- answers_draft 表
ALTER TABLE public.answers_draft ENABLE ROW LEVEL SECURITY;

-- 删除已存在的策略（如果有）
DROP POLICY IF EXISTS "answers_draft owner select" ON public.answers_draft;
DROP POLICY IF EXISTS "answers_draft owner insert" ON public.answers_draft;
DROP POLICY IF EXISTS "answers_draft owner update" ON public.answers_draft;
DROP POLICY IF EXISTS "answers_draft owner delete" ON public.answers_draft;

-- 创建新策略
CREATE POLICY "answers_draft owner select" ON public.answers_draft
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "answers_draft owner insert" ON public.answers_draft
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "answers_draft owner update" ON public.answers_draft
  FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "answers_draft owner delete" ON public.answers_draft
  FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- wrong_questions 表
ALTER TABLE public.wrong_questions ENABLE ROW LEVEL SECURITY;

-- 删除已存在的策略（如果有）
DROP POLICY IF EXISTS "wrong_questions owner select" ON public.wrong_questions;
DROP POLICY IF EXISTS "wrong_questions owner insert" ON public.wrong_questions;
DROP POLICY IF EXISTS "wrong_questions owner update" ON public.wrong_questions;
DROP POLICY IF EXISTS "wrong_questions owner delete" ON public.wrong_questions;
DROP POLICY IF EXISTS "wrong_questions teacher/admin read" ON public.wrong_questions;

-- 创建新策略
CREATE POLICY "wrong_questions owner select" ON public.wrong_questions
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "wrong_questions owner insert" ON public.wrong_questions
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "wrong_questions owner update" ON public.wrong_questions
  FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "wrong_questions owner delete" ON public.wrong_questions
  FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- 允许教师和管理员查看所有错题（用于统计分析）
CREATE POLICY "wrong_questions teacher/admin read" ON public.wrong_questions
  FOR SELECT
  USING (public.is_admin_or_teacher());

-- tags 表
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- 删除已存在的策略（如果有）
DROP POLICY IF EXISTS "tags read all" ON public.tags;
DROP POLICY IF EXISTS "tags insert admin/teacher" ON public.tags;
DROP POLICY IF EXISTS "tags update admin/teacher" ON public.tags;
DROP POLICY IF EXISTS "tags delete admin/teacher" ON public.tags;

-- 创建新策略
CREATE POLICY "tags read all" ON public.tags
  FOR SELECT
  USING (true); -- 所有人都可以查看标签

CREATE POLICY "tags insert admin/teacher" ON public.tags
  FOR INSERT
  WITH CHECK (public.is_admin_or_teacher());

CREATE POLICY "tags update admin/teacher" ON public.tags
  FOR UPDATE
  USING (public.is_admin_or_teacher());

CREATE POLICY "tags delete admin/teacher" ON public.tags
  FOR DELETE
  USING (public.is_admin_or_teacher());

-- ============================================
-- 3. 优化现有RLS策略性能（使用 select auth.uid()）
-- ============================================

-- 优化 profiles 表策略
DROP POLICY IF EXISTS "profiles owner select" ON public.profiles;
CREATE POLICY "profiles owner select" ON public.profiles
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "profiles owner insert" ON public.profiles;
CREATE POLICY "profiles owner insert" ON public.profiles
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "profiles owner update" ON public.profiles;
CREATE POLICY "profiles owner update" ON public.profiles
  FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);

-- 优化 papers 表策略
DROP POLICY IF EXISTS "papers read published or owner/teacher/admin" ON public.papers;
CREATE POLICY "papers read published or owner/teacher/admin" ON public.papers
  FOR SELECT
  USING (
    published = true
    OR created_by = (SELECT auth.uid())
    OR public.is_admin_or_teacher()
  );

-- 优化 answers 表策略
DROP POLICY IF EXISTS "answers owner select" ON public.answers;
CREATE POLICY "answers owner select" ON public.answers
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "answers owner insert" ON public.answers;
CREATE POLICY "answers owner insert" ON public.answers
  FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "answers owner update" ON public.answers;
CREATE POLICY "answers owner update" ON public.answers
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "answers parent read child" ON public.answers;
CREATE POLICY "answers parent read child" ON public.answers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parent_child pc
      WHERE pc.parent_id = (SELECT auth.uid()) AND pc.child_id = answers.user_id
    )
  );

-- 优化 parent_child 表策略
DROP POLICY IF EXISTS "parent manages own relations insert" ON public.parent_child;
CREATE POLICY "parent manages own relations insert" ON public.parent_child
  FOR INSERT
  WITH CHECK (parent_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "parent manages own relations delete" ON public.parent_child;
CREATE POLICY "parent manages own relations delete" ON public.parent_child
  FOR DELETE
  USING (parent_id = (SELECT auth.uid()));

-- 优化 notifications 表策略
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications" ON public.notifications
  FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- ============================================
-- 4. 添加注释说明
-- ============================================

COMMENT ON FUNCTION public.fn_random_questions IS '随机抽题函数，已设置search_path确保安全性';
COMMENT ON FUNCTION public.sync_profile_email_on_create IS '同步用户邮箱到profiles表，已设置search_path确保安全性';
COMMENT ON FUNCTION public.sync_email_on_profile_create IS '从auth.users同步邮箱到profiles，已设置search_path确保安全性';
COMMENT ON FUNCTION public.sync_profile_email_on_update IS '更新profiles表的邮箱，已设置search_path确保安全性';

