-- 删除游戏积分表及相关对象
-- 移除大嘴鸟游戏数据统计功能，优化数据表，提高网络传输速度

-- 删除触发器
DROP TRIGGER IF EXISTS update_game_scores_updated_at ON game_scores;

-- 删除函数
DROP FUNCTION IF EXISTS update_game_scores_updated_at();

-- 删除索引
DROP INDEX IF EXISTS idx_game_scores_user_id;
DROP INDEX IF EXISTS idx_game_scores_game_name;
DROP INDEX IF EXISTS idx_game_scores_best_score;
DROP INDEX IF EXISTS idx_game_scores_updated_at;

-- 删除表（级联删除所有依赖对象）
DROP TABLE IF EXISTS game_scores CASCADE;
