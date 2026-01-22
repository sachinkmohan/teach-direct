export interface User {
  id: string
  email: string
  role: 'student' | 'teacher'
  display_name: string | null
  timezone: string
  created_at: string
  updated_at: string
}

export interface TeacherProfile {
  id: string
  user_id: string
  bio: string | null
  subjects: string[]
  languages: string[]
  hourly_rate: number | null
  package_5_rate: number | null
  package_10_rate: number | null
  stripe_connect_id: string | null
  stripe_connect_status: 'pending' | 'active' | 'inactive'
  available_balance: number
  pending_balance: number
  created_at: string
  updated_at: string
  // Joined fields
  user?: User
}

export interface Wallet {
  id: string
  user_id: string
  balance: number
  created_at: string
  updated_at: string
}

export interface Package {
  id: string
  student_id: string
  teacher_id: string
  total_classes: number
  remaining_classes: number
  price_per_class: number
  total_amount: number
  status: 'active' | 'completed' | 'expired' | 'refunded'
  created_at: string
  updated_at: string
}

export interface Lesson {
  id: string
  package_id: string
  teacher_id: string
  student_id: string
  scheduled_at: string
  duration_minutes: number
  meeting_link: string | null
  status: 'scheduled' | 'completed' | 'pending_confirmation' | 'confirmed' | 'disputed' | 'cancelled'
  auto_release_at: string | null
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  user_id: string
  type: 'purchase' | 'lesson_payment' | 'withdrawal' | 'refund'
  amount: number
  status: 'pending' | 'completed' | 'failed'
  stripe_payment_intent_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface TeacherWithProfile extends User {
  teacher_profile: TeacherProfile | null
}
