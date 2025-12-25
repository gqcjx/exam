-- 添加学期和教材版本字段到questions表
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS semester TEXT,
ADD COLUMN IF NOT EXISTS textbook_version TEXT;

-- 添加注释
COMMENT ON COLUMN questions.semester IS '学期：上学期或下学期';
COMMENT ON COLUMN questions.textbook_version IS '教材版本：如人教版、苏教版等';



