-- 创建教师班级关联表（用于标识班主任）

CREATE TABLE IF NOT EXISTS public.teacher_class_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, class_id) -- 一个教师只能管理一个班级一次
);

COMMENT ON TABLE public.teacher_class_relations IS '教师班级关联表，用于标识班主任';
COMMENT ON COLUMN public.teacher_class_relations.teacher_id IS '教师用户ID';
COMMENT ON COLUMN public.teacher_class_relations.class_id IS '班级ID';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_teacher_class_relations_teacher_id ON public.teacher_class_relations(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_class_relations_class_id ON public.teacher_class_relations(class_id);

-- 启用 RLS
ALTER TABLE public.teacher_class_relations ENABLE ROW LEVEL SECURITY;

-- RLS 策略：教师可以查看自己管理的班级
CREATE POLICY "teacher_class_relations teacher select own" ON public.teacher_class_relations
  FOR SELECT USING (
    teacher_id = (SELECT auth.uid())
  );

-- RLS 策略：管理员和教师可以查看所有关联
CREATE POLICY "teacher_class_relations admin/teacher select all" ON public.teacher_class_relations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = (SELECT auth.uid())
      AND role IN ('admin', 'teacher')
    )
  );

-- RLS 策略：管理员和教师可以插入
CREATE POLICY "teacher_class_relations admin/teacher insert" ON public.teacher_class_relations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = (SELECT auth.uid())
      AND role IN ('admin', 'teacher')
    )
  );

-- RLS 策略：管理员和教师可以删除
CREATE POLICY "teacher_class_relations admin/teacher delete" ON public.teacher_class_relations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = (SELECT auth.uid())
      AND role IN ('admin', 'teacher')
    )
  );
