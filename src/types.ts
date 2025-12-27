export type Role = 'admin' | 'teacher' | 'student' | 'parent'

export type QuestionType = 'single' | 'multiple' | 'true_false' | 'fill' | 'short'

export type AnswerStatus = 'auto' | 'pending' | 'graded'

export interface Profile {
  user_id: string
  name: string | null
  role: Role
  grade: string | null
  class: string | null
  child_ids?: string[] | null
  avatar_url?: string | null
  disabled?: boolean | null
  school_id?: string | null
}

export interface NavLinkItem {
  path: string
  label: string
  roles?: Role[]
}

export type QuestionItem = {
  id: string
  subject: string
  grade?: string | null
  semester?: string | null
  textbook_version?: string | null
  difficulty: number
  type: QuestionType
  stem: string
  options?: Array<{ label: string; text: string }>
  answer: string[]
  analysis?: string | null
  tags?: string[]
  created_by?: string | null
}

export type QuestionsFilter = Partial<{
  subject: string
  grade: string
  type: QuestionType
  difficulty: number
  search: string
}>

// 试卷相关类型
export interface Paper {
  id: string
  title: string
  subject?: string | null
  grade?: string | null
  total_score: number
  duration_minutes: number
  mode: 'manual' | 'random'
  published: boolean
  allow_review: boolean
  start_time?: string | null
  end_time?: string | null
  max_attempts?: number | null
  created_by?: string | null
  created_at: string
}

export interface PaperQuestion {
  id: string
  paper_id: string
  question_id: string
  order_no: number
  score: number
  question?: QuestionItem
}

export interface PaperWithQuestions extends Paper {
  questions: Array<PaperQuestion & { question: QuestionItem }>
}

// 答案相关类型
export interface Answer {
  id: string
  user_id: string
  paper_id: string
  question_id: string
  chosen: string[] | string | null
  is_correct: boolean | null
  score: number
  manual_score: number | null
  comment: string | null
  status: AnswerStatus
  submitted_at: string | null
  created_at: string
}

// 答题草稿类型
export interface ExamDraft {
  paper_id: string
  answers: Record<string, string[] | string> // question_id -> chosen answer
  updated_at: number
}
