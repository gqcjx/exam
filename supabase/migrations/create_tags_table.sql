-- 创建标签表
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- 添加注释
COMMENT ON TABLE tags IS '题目标签表';
COMMENT ON COLUMN tags.name IS '标签名称';
COMMENT ON COLUMN tags.color IS '标签颜色（可选）';

