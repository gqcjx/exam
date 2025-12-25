export type Role = 'admin' | 'teacher' | 'student' | 'parent'

export type Profile = {
  user_id: string
  name: string
  role: Role
  grade?: string | null
  class?: string | null
  avatar_url?: string | null
  child_ids?: string[] | null
}

