-- 为 profiles 表添加学校、年级、班级、科目字段

-- 添加学校ID字段（学生和老师）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'school_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 添加年级ID字段（学生）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'grade_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN grade_id UUID REFERENCES public.grades(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 添加班级ID字段（学生）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'class_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 添加科目ID数组字段（老师）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'subject_ids'
  ) THEN
    ALTER TABLE profiles ADD COLUMN subject_ids UUID[] DEFAULT '{}';
  END IF;
END $$;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_profiles_school_id ON profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_profiles_grade_id ON profiles(grade_id);
CREATE INDEX IF NOT EXISTS idx_profiles_class_id ON profiles(class_id);
