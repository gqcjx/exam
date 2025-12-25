-- 为papers表添加版本管理字段
ALTER TABLE papers 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS parent_paper_id UUID REFERENCES papers(id) ON DELETE SET NULL;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_papers_parent ON papers(parent_paper_id);
CREATE INDEX IF NOT EXISTS idx_papers_version ON papers(version);

-- 添加注释
COMMENT ON COLUMN papers.version IS '试卷版本号';
COMMENT ON COLUMN papers.parent_paper_id IS '父试卷ID（用于版本管理）';

