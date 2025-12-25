-- 数据库性能优化迁移
-- 优化索引和RLS策略性能

-- ============================================
-- 1. 为缺少索引的外键添加索引
-- ============================================

-- answers 表
-- answers.paper_id 外键索引
CREATE INDEX IF NOT EXISTS idx_answers_paper_id 
ON public.answers(paper_id);

-- answers.question_id 外键索引
CREATE INDEX IF NOT EXISTS idx_answers_question_id 
ON public.answers(question_id);

-- answers_draft 表
-- answers_draft.paper_id 外键索引
CREATE INDEX IF NOT EXISTS idx_answers_draft_paper_id 
ON public.answers_draft(paper_id);

-- paper_questions 表
-- paper_questions.question_id 外键索引（paper_id已有索引）
CREATE INDEX IF NOT EXISTS idx_paper_questions_question_id 
ON public.paper_questions(question_id);

-- papers 表
-- papers.created_by 外键索引（虽然不是外键，但经常用于查询）
CREATE INDEX IF NOT EXISTS idx_papers_created_by 
ON public.papers(created_by);

-- parent_child 表
-- parent_child.child_id 外键索引（parent_id已有唯一索引）
CREATE INDEX IF NOT EXISTS idx_parent_child_child_id 
ON public.parent_child(child_id);

-- questions 表
-- questions.created_by 外键索引（虽然不是外键，但经常用于查询）
CREATE INDEX IF NOT EXISTS idx_questions_created_by 
ON public.questions(created_by);

-- wrong_questions 表
-- wrong_questions.paper_id 外键索引（user_id和question_id已有索引）
CREATE INDEX IF NOT EXISTS idx_wrong_questions_paper_id 
ON public.wrong_questions(paper_id);

-- ============================================
-- 2. 优化未使用的索引（保留但添加注释）
-- ============================================

-- 这些索引当前未使用，但可能在未来的查询中需要
-- 保留它们以避免将来重新创建，但添加注释说明

COMMENT ON INDEX idx_questions_tags IS '标签索引，用于按标签筛选题目（当前未使用，但保留以备将来查询需要）';
COMMENT ON INDEX idx_answers_status IS '答案状态索引，用于筛选待批阅的简答题（当前未使用，但保留以备将来查询需要）';
COMMENT ON INDEX idx_profiles_student_duplicate IS '学生重复检查索引（当前未使用，但保留以备将来数据完整性检查）';
COMMENT ON INDEX idx_profiles_teacher_duplicate IS '教师重复检查索引（当前未使用，但保留以备将来数据完整性检查）';
COMMENT ON INDEX idx_profiles_name IS '姓名索引，用于按姓名搜索（当前未使用，但保留以备将来查询需要）';
COMMENT ON INDEX idx_profiles_school IS '学校索引，用于按学校筛选（当前未使用，但保留以备将来查询需要）';
COMMENT ON INDEX idx_profiles_role IS '角色索引，用于按角色筛选（当前未使用，但保留以备将来查询需要）';
COMMENT ON INDEX idx_wrong_questions_user IS '错题用户索引（当前未使用，但user_id已在唯一索引中，保留以备将来查询优化）';
COMMENT ON INDEX idx_wrong_questions_question IS '错题题目索引（当前未使用，但question_id已在唯一索引中，保留以备将来查询优化）';
COMMENT ON INDEX idx_wrong_questions_mastered IS '错题掌握状态索引，用于筛选已掌握/未掌握（当前未使用，但保留以备将来查询需要）';
COMMENT ON INDEX idx_wrong_questions_created IS '错题创建时间索引，用于按时间排序（当前未使用，但保留以备将来查询需要）';
COMMENT ON INDEX idx_papers_parent IS '试卷父级索引，用于版本管理查询（当前未使用，但保留以备将来查询需要）';
COMMENT ON INDEX idx_papers_version IS '试卷版本索引，用于版本管理查询（当前未使用，但保留以备将来查询需要）';
COMMENT ON INDEX idx_notifications_user_id IS '通知用户索引（当前未使用，但保留以备将来查询优化）';
COMMENT ON INDEX idx_notifications_created_at IS '通知创建时间索引，用于按时间排序（当前未使用，但保留以备将来查询需要）';

-- ============================================
-- 3. 优化多个宽松策略（合并策略提升性能）
-- ============================================

-- 注意：合并多个宽松策略可能会影响策略的可读性和维护性
-- 但可以提升性能，因为PostgreSQL只需要评估一个策略而不是多个
-- 这里我们保留原有策略结构，因为它们逻辑清晰且易于维护
-- 性能优化主要通过使用 (SELECT auth.uid()) 来实现，已在之前的迁移中完成

-- 如果需要进一步优化，可以考虑合并以下策略：
-- 1. answers 表的 SELECT 策略（3个策略合并为1个）
-- 2. answers 表的 UPDATE 策略（2个策略合并为1个）
-- 3. profiles 表的 SELECT 策略（2个策略合并为1个）
-- 4. wrong_questions 表的 SELECT 策略（2个策略合并为1个）

-- 但考虑到可读性和维护性，我们暂时保留现有策略结构
-- 如果将来性能成为瓶颈，可以考虑合并

-- ============================================
-- 4. 添加复合索引以优化常见查询
-- ============================================

-- answers 表：优化按用户和试卷查询
-- 注意：已有 idx_answers_user_paper 复合索引，无需重复创建

-- wrong_questions 表：优化按用户和掌握状态查询
CREATE INDEX IF NOT EXISTS idx_wrong_questions_user_mastered 
ON public.wrong_questions(user_id, is_mastered) 
WHERE is_mastered = false; -- 部分索引，只索引未掌握的错题

-- wrong_questions 表：优化按用户和题目查询（已有唯一索引，但添加覆盖索引）
-- 注意：已有 wrong_questions_user_id_question_id_key 唯一索引

-- papers 表：优化按发布状态和创建者查询
CREATE INDEX IF NOT EXISTS idx_papers_published_created_by 
ON public.papers(published, created_by) 
WHERE published = true; -- 部分索引，只索引已发布的试卷

-- questions 表：优化按学科、年级、类型查询
-- 注意：已有 idx_questions_filters 复合索引，无需重复创建

-- notifications 表：优化按用户和未读状态查询
CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
ON public.notifications(user_id, read) 
WHERE read = false; -- 部分索引，只索引未读通知

-- ============================================
-- 5. 添加注释说明
-- ============================================

COMMENT ON INDEX idx_answers_paper_id IS '优化按试卷查询答案的性能';
COMMENT ON INDEX idx_answers_question_id IS '优化按题目查询答案的性能';
COMMENT ON INDEX idx_answers_draft_paper_id IS '优化按试卷查询草稿的性能';
COMMENT ON INDEX idx_paper_questions_question_id IS '优化按题目查询试卷关联的性能';
COMMENT ON INDEX idx_papers_created_by IS '优化按创建者查询试卷的性能';
COMMENT ON INDEX idx_parent_child_child_id IS '优化按孩子查询家长关联的性能';
COMMENT ON INDEX idx_questions_created_by IS '优化按创建者查询题目的性能';
COMMENT ON INDEX idx_wrong_questions_paper_id IS '优化按试卷查询错题的性能';
COMMENT ON INDEX idx_wrong_questions_user_mastered IS '优化按用户和掌握状态查询错题的性能（部分索引）';
COMMENT ON INDEX idx_papers_published_created_by IS '优化按发布状态和创建者查询试卷的性能（部分索引）';
COMMENT ON INDEX idx_notifications_user_read IS '优化按用户和未读状态查询通知的性能（部分索引）';

