# 添加 start_time 和 end_time 列到 papers 表

## 问题描述

创建试卷时出现错误：
- `Could not find the 'end_time' column of 'papers' in the schema cache`
- `column papers.start_time does not exist`

这是因为 `papers` 表中缺少 `start_time` 和 `end_time` 列。

## 解决方案

### 方法 1：在 Supabase Dashboard 中执行 SQL（推荐）

1. 打开 Supabase Dashboard：https://supabase.com/dashboard
2. 选择你的项目
3. 进入 **SQL Editor**
4. 复制并执行以下 SQL：

```sql
-- 为 papers 表添加 start_time 和 end_time 列
ALTER TABLE papers 
ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;

-- 添加注释
COMMENT ON COLUMN papers.start_time IS '试卷开始时间（可选）';
COMMENT ON COLUMN papers.end_time IS '试卷结束时间（可选）';
```

### 方法 2：使用 Supabase CLI

如果你使用 Supabase CLI 管理迁移：

```bash
# 在项目根目录执行
cd exam
supabase db push
```

或者直接应用迁移文件：

```bash
supabase migration up add_start_time_and_end_time_to_papers
```

## 验证

执行 SQL 后，可以在 Supabase Dashboard 的 **Table Editor** 中查看 `papers` 表，确认 `start_time` 和 `end_time` 列已添加。

## 注意事项

- 这两个列都是可选的（允许 NULL）
- 类型为 `TIMESTAMPTZ`（带时区的时间戳）
- 用于控制试卷的开始和结束时间


