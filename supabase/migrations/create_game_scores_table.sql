-- 创建游戏积分表
CREATE TABLE IF NOT EXISTS game_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_name TEXT NOT NULL DEFAULT 'dazui',
  score INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  play_duration INTEGER, -- 游戏时长（秒）
  best_score INTEGER DEFAULT 0, -- 历史最高分
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 唯一约束：每个用户每个游戏只保留一条记录（保留最新记录）
  UNIQUE(user_id, game_name)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_game_scores_user_id ON game_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_game_scores_game_name ON game_scores(game_name);
CREATE INDEX IF NOT EXISTS idx_game_scores_best_score ON game_scores(game_name, best_score DESC);
CREATE INDEX IF NOT EXISTS idx_game_scores_updated_at ON game_scores(updated_at DESC);

-- 添加注释
COMMENT ON TABLE game_scores IS '游戏积分表，记录学生游戏成绩';
COMMENT ON COLUMN game_scores.game_name IS '游戏名称，如 dazui（大嘴鸟）';
COMMENT ON COLUMN game_scores.score IS '最终分数';
COMMENT ON COLUMN game_scores.level IS '达到的等级';
COMMENT ON COLUMN game_scores.correct_count IS '正确数';
COMMENT ON COLUMN game_scores.wrong_count IS '错误数';
COMMENT ON COLUMN game_scores.play_duration IS '游戏时长（秒）';
COMMENT ON COLUMN game_scores.best_score IS '历史最高分';

-- 自动更新 updated_at
CREATE OR REPLACE FUNCTION update_game_scores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_game_scores_updated_at
  BEFORE UPDATE ON game_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_game_scores_updated_at();

-- RLS 策略
ALTER TABLE game_scores ENABLE ROW LEVEL SECURITY;

-- 学生可以查看自己的积分
CREATE POLICY "Students can view own scores"
  ON game_scores FOR SELECT
  USING (auth.uid() = user_id);

-- 学生可以插入自己的积分
CREATE POLICY "Students can insert own scores"
  ON game_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 学生可以更新自己的积分
CREATE POLICY "Students can update own scores"
  ON game_scores FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 教师和管理员可以查看所有学生的积分（用于排行榜）
CREATE POLICY "Teachers and admins can view all scores"
  ON game_scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('teacher', 'admin')
    )
  );
