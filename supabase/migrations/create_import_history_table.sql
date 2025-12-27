-- 创建导入历史记录表

CREATE TABLE IF NOT EXISTS public.import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  import_type VARCHAR(50) NOT NULL DEFAULT 'students',
  file_name VARCHAR(255) NOT NULL,
  total_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  errors TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.import_history IS '导入历史记录表';
COMMENT ON COLUMN public.import_history.user_id IS '执行导入的用户ID';
COMMENT ON COLUMN public.import_history.import_type IS '导入类型（students等）';
COMMENT ON COLUMN public.import_history.file_name IS '导入的文件名';
COMMENT ON COLUMN public.import_history.total_count IS '总记录数';
COMMENT ON COLUMN public.import_history.success_count IS '成功数量';
COMMENT ON COLUMN public.import_history.failed_count IS '失败数量';
COMMENT ON COLUMN public.import_history.errors IS '错误信息数组';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_import_history_user_id ON public.import_history(user_id);
CREATE INDEX IF NOT EXISTS idx_import_history_import_type ON public.import_history(import_type);
CREATE INDEX IF NOT EXISTS idx_import_history_created_at ON public.import_history(created_at DESC);

-- 启用 RLS
ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户可以查看自己的导入历史
CREATE POLICY "import_history user select own" ON public.import_history
  FOR SELECT USING (
    user_id = (SELECT auth.uid())
  );

-- RLS 策略：管理员可以查看所有导入历史
CREATE POLICY "import_history admin select all" ON public.import_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

-- RLS 策略：用户可以插入自己的导入历史
CREATE POLICY "import_history user insert own" ON public.import_history
  FOR INSERT WITH CHECK (
    user_id = (SELECT auth.uid())
  );

-- RLS 策略：用户可以更新自己的导入历史
CREATE POLICY "import_history user update own" ON public.import_history
  FOR UPDATE USING (
    user_id = (SELECT auth.uid())
  );
