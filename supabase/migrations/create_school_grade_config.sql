-- 创建学校、年级、学科配置表
-- 用于动态管理学校、年级和学科信息

-- ============================================
-- 1. 创建学科配置表
-- ============================================

CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT, -- 学科代码（可选）
  display_order INTEGER DEFAULT 0, -- 显示顺序
  enabled BOOLEAN DEFAULT true, -- 是否启用
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.subjects IS '学科配置表';
COMMENT ON COLUMN public.subjects.name IS '学科名称（如：数学、语文、英语）';
COMMENT ON COLUMN public.subjects.code IS '学科代码（可选，如：MATH、CHINESE）';
COMMENT ON COLUMN public.subjects.display_order IS '显示顺序，数字越小越靠前';
COMMENT ON COLUMN public.subjects.enabled IS '是否启用，禁用后不会在下拉列表中显示';

-- ============================================
-- 2. 创建年级配置表
-- ============================================

CREATE TABLE IF NOT EXISTS public.grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT, -- 年级代码（可选）
  level INTEGER, -- 年级级别（1-12，用于排序）
  display_order INTEGER DEFAULT 0, -- 显示顺序
  enabled BOOLEAN DEFAULT true, -- 是否启用
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.grades IS '年级配置表';
COMMENT ON COLUMN public.grades.name IS '年级名称（如：七年级、八年级、九年级）';
COMMENT ON COLUMN public.grades.code IS '年级代码（可选，如：GRADE_7）';
COMMENT ON COLUMN public.grades.level IS '年级级别，1-12，用于排序（七年级=7，八年级=8）';
COMMENT ON COLUMN public.grades.display_order IS '显示顺序，数字越小越靠前';
COMMENT ON COLUMN public.grades.enabled IS '是否启用，禁用后不会在下拉列表中显示';

-- ============================================
-- 3. 创建学校配置表
-- ============================================

CREATE TABLE IF NOT EXISTS public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT, -- 学校代码（可选）
  address TEXT, -- 学校地址
  phone TEXT, -- 联系电话
  enabled BOOLEAN DEFAULT true, -- 是否启用
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.schools IS '学校配置表';
COMMENT ON COLUMN public.schools.name IS '学校名称';
COMMENT ON COLUMN public.schools.code IS '学校代码（可选）';
COMMENT ON COLUMN public.schools.enabled IS '是否启用，禁用后不会在下拉列表中显示';

-- ============================================
-- 4. 创建班级配置表（可选，用于更细化的管理）
-- ============================================

CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  grade_id UUID REFERENCES public.grades(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- 班级名称（如：1班、2班）
  code TEXT, -- 班级代码（可选）
  enabled BOOLEAN DEFAULT true, -- 是否启用
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(school_id, grade_id, name) -- 同一学校的同一年级不能有重复的班级名
);

COMMENT ON TABLE public.classes IS '班级配置表';
COMMENT ON COLUMN public.classes.school_id IS '所属学校ID';
COMMENT ON COLUMN public.classes.grade_id IS '所属年级ID';
COMMENT ON COLUMN public.classes.name IS '班级名称（如：1班、2班）';
COMMENT ON COLUMN public.classes.enabled IS '是否启用';

-- ============================================
-- 5. 创建索引
-- ============================================

-- 学科表索引
CREATE INDEX IF NOT EXISTS idx_subjects_enabled ON public.subjects(enabled, display_order);
CREATE INDEX IF NOT EXISTS idx_subjects_name ON public.subjects(name);

-- 年级表索引
CREATE INDEX IF NOT EXISTS idx_grades_enabled ON public.grades(enabled, display_order);
CREATE INDEX IF NOT EXISTS idx_grades_level ON public.grades(level);
CREATE INDEX IF NOT EXISTS idx_grades_name ON public.grades(name);

-- 学校表索引
CREATE INDEX IF NOT EXISTS idx_schools_enabled ON public.schools(enabled);
CREATE INDEX IF NOT EXISTS idx_schools_name ON public.schools(name);

-- 班级表索引
CREATE INDEX IF NOT EXISTS idx_classes_school_grade ON public.classes(school_id, grade_id);
CREATE INDEX IF NOT EXISTS idx_classes_enabled ON public.classes(enabled);

-- ============================================
-- 6. 启用 RLS
-- ============================================

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. 创建 RLS 策略
-- ============================================

-- 学科表策略：所有人可读，管理员/教师可写
CREATE POLICY "subjects read all" ON public.subjects
  FOR SELECT
  USING (true);

CREATE POLICY "subjects insert admin/teacher" ON public.subjects
  FOR INSERT
  WITH CHECK (public.is_admin_or_teacher());

CREATE POLICY "subjects update admin/teacher" ON public.subjects
  FOR UPDATE
  USING (public.is_admin_or_teacher());

CREATE POLICY "subjects delete admin/teacher" ON public.subjects
  FOR DELETE
  USING (public.is_admin_or_teacher());

-- 年级表策略：所有人可读，管理员/教师可写
CREATE POLICY "grades read all" ON public.grades
  FOR SELECT
  USING (true);

CREATE POLICY "grades insert admin/teacher" ON public.grades
  FOR INSERT
  WITH CHECK (public.is_admin_or_teacher());

CREATE POLICY "grades update admin/teacher" ON public.grades
  FOR UPDATE
  USING (public.is_admin_or_teacher());

CREATE POLICY "grades delete admin/teacher" ON public.grades
  FOR DELETE
  USING (public.is_admin_or_teacher());

-- 学校表策略：所有人可读，管理员/教师可写
CREATE POLICY "schools read all" ON public.schools
  FOR SELECT
  USING (true);

CREATE POLICY "schools insert admin/teacher" ON public.schools
  FOR INSERT
  WITH CHECK (public.is_admin_or_teacher());

CREATE POLICY "schools update admin/teacher" ON public.schools
  FOR UPDATE
  USING (public.is_admin_or_teacher());

CREATE POLICY "schools delete admin/teacher" ON public.schools
  FOR DELETE
  USING (public.is_admin_or_teacher());

-- 班级表策略：所有人可读，管理员/教师可写
CREATE POLICY "classes read all" ON public.classes
  FOR SELECT
  USING (true);

CREATE POLICY "classes insert admin/teacher" ON public.classes
  FOR INSERT
  WITH CHECK (public.is_admin_or_teacher());

CREATE POLICY "classes update admin/teacher" ON public.classes
  FOR UPDATE
  USING (public.is_admin_or_teacher());

CREATE POLICY "classes delete admin/teacher" ON public.classes
  FOR DELETE
  USING (public.is_admin_or_teacher());

-- ============================================
-- 8. 插入默认数据
-- ============================================

-- 插入默认学科
INSERT INTO public.subjects (name, code, display_order) VALUES
  ('数学', 'MATH', 1),
  ('语文', 'CHINESE', 2),
  ('英语', 'ENGLISH', 3),
  ('物理', 'PHYSICS', 4),
  ('化学', 'CHEMISTRY', 5),
  ('科学', 'SCIENCE', 6)
ON CONFLICT (name) DO NOTHING;

-- 插入默认年级
INSERT INTO public.grades (name, code, level, display_order) VALUES
  ('一年级', 'GRADE_1', 1, 1),
  ('二年级', 'GRADE_2', 2, 2),
  ('三年级', 'GRADE_3', 3, 3),
  ('四年级', 'GRADE_4', 4, 4),
  ('五年级', 'GRADE_5', 5, 5),
  ('六年级', 'GRADE_6', 6, 6),
  ('七年级', 'GRADE_7', 7, 7),
  ('八年级', 'GRADE_8', 8, 8),
  ('九年级', 'GRADE_9', 9, 9),
  ('高一', 'GRADE_10', 10, 10),
  ('高二', 'GRADE_11', 11, 11),
  ('高三', 'GRADE_12', 12, 12)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 9. 创建更新时间触发器
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subjects_updated_at
  BEFORE UPDATE ON public.subjects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grades_updated_at
  BEFORE UPDATE ON public.grades
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schools_updated_at
  BEFORE UPDATE ON public.schools
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_classes_updated_at
  BEFORE UPDATE ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

