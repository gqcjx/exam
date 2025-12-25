-- 创建通知表
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('exam_start', 'exam_end', 'grade_released', 'manual_review_completed', 'system')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  related_id UUID, -- 关联的试卷ID或其他ID
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- 添加注释
COMMENT ON TABLE notifications IS '用户通知表';
COMMENT ON COLUMN notifications.type IS '通知类型：exam_start(考试开始), exam_end(考试结束), grade_released(成绩发布), manual_review_completed(批阅完成), system(系统通知)';
COMMENT ON COLUMN notifications.related_id IS '关联的试卷ID或其他相关ID';

-- RLS策略：用户只能查看自己的通知
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- 系统和管理员可以创建通知（通过service_role key）
-- 注意：创建通知应该通过Edge Function或使用service_role key
