-- 为 papers 表添加 start_time 和 end_time 列
ALTER TABLE papers 
ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;

-- 添加注释
COMMENT ON COLUMN papers.start_time IS '试卷开始时间（可选）';
COMMENT ON COLUMN papers.end_time IS '试卷结束时间（可选）';


