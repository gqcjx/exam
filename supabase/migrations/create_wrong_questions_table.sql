-- 创建错题本表
CREATE TABLE IF NOT EXISTS wrong_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  paper_id UUID REFERENCES papers(id) ON DELETE SET NULL,
  user_answer TEXT,
  wrong_count INT DEFAULT 1,
  last_wrong_at TIMESTAMPTZ DEFAULT NOW(),
  is_mastered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, question_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_wrong_questions_user ON wrong_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_wrong_questions_question ON wrong_questions(question_id);
CREATE INDEX IF NOT EXISTS idx_wrong_questions_mastered ON wrong_questions(is_mastered);
CREATE INDEX IF NOT EXISTS idx_wrong_questions_created ON wrong_questions(created_at DESC);

-- 添加注释
COMMENT ON TABLE wrong_questions IS '错题本表，记录学生的错题信息';
COMMENT ON COLUMN wrong_questions.user_id IS '用户ID';
COMMENT ON COLUMN wrong_questions.question_id IS '题目ID';
COMMENT ON COLUMN wrong_questions.paper_id IS '试卷ID（可选）';
COMMENT ON COLUMN wrong_questions.user_answer IS '用户答案';
COMMENT ON COLUMN wrong_questions.wrong_count IS '错误次数';
COMMENT ON COLUMN wrong_questions.last_wrong_at IS '最后一次错误时间';
COMMENT ON COLUMN wrong_questions.is_mastered IS '是否已掌握';

