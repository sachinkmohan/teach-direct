import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

export interface Lesson {
  id: string
  package_id: string
  teacher_id: string
  student_id: string
  scheduled_at: string
  duration_minutes: number
  meeting_link: string | null
  status: 'scheduled' | 'completed' | 'pending_confirmation' | 'confirmed' | 'disputed' | 'cancelled'
  notes: string | null
  auto_release_at: string | null
  created_at: string
  updated_at: string
}

export interface LessonWithDetails extends Lesson {
  teacher?: {
    id: string
    email: string
    display_name: string | null
  }
  student?: {
    id: string
    email: string
    display_name: string | null
  }
}

// Helper function to fetch user info for lessons
async function fetchUserInfoForLessons(lessons: Lesson[]): Promise<LessonWithDetails[]> {
  if (lessons.length === 0) return []

  // Get unique user IDs
  const userIds = [...new Set([
    ...lessons.map(l => l.teacher_id),
    ...lessons.map(l => l.student_id)
  ])]

  // Fetch user info
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, display_name')
    .in('id', userIds)

  if (error) {
    console.error('Failed to fetch user info for lessons:', error)
  }

  // Create lookup map
  const userMap: Record<string, { id: string; email: string; display_name: string | null }> = {}
  users?.forEach(u => {
    userMap[u.id] = u
  })

  // Merge user info into lessons
  return lessons.map(lesson => ({
    ...lesson,
    teacher: userMap[lesson.teacher_id],
    student: userMap[lesson.student_id],
  }))
}

// Fetch lessons for the current user (student or teacher)
export function useLessons() {
  const { user } = useAuthStore()

  return useQuery({
    queryKey: ['lessons', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated')

      // Fetch lessons where user is student OR teacher
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .or(`student_id.eq.${user.id},teacher_id.eq.${user.id}`)
        .order('scheduled_at', { ascending: true })

      if (error) throw error

      // Fetch user info separately
      return fetchUserInfoForLessons(data as Lesson[])
    },
    enabled: !!user,
  })
}

// Fetch upcoming lessons only
export function useUpcomingLessons() {
  const { user } = useAuthStore()

  return useQuery({
    queryKey: ['upcoming-lessons', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .or(`student_id.eq.${user.id},teacher_id.eq.${user.id}`)
        .gte('scheduled_at', new Date().toISOString())
        .in('status', ['scheduled', 'pending_confirmation'])
        .order('scheduled_at', { ascending: true })

      if (error) throw error

      // Fetch user info separately
      return fetchUserInfoForLessons(data as Lesson[])
    },
    enabled: !!user,
  })
}

// Book a new lesson
export function useBookLesson() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  return useMutation({
    mutationFn: async ({
      packageId,
      teacherId,
      scheduledAt,
      meetingLink,
    }: {
      packageId: string
      teacherId: string
      scheduledAt: Date
      meetingLink?: string
    }) => {
      if (!user) throw new Error('Not authenticated')

      // Get package to verify ownership and get price
      const { data: pkg, error: pkgError } = await supabase
        .from('packages')
        .select('student_id, price_per_class')
        .eq('id', packageId)
        .single()

      if (pkgError || !pkg) {
        throw new Error('Package not found')
      }

      if (pkg.student_id !== user.id) {
        throw new Error('This package does not belong to you')
      }

      // Call atomic booking function
      const { data, error } = await supabase.rpc('book_lesson_atomic', {
        p_package_id: packageId,
        p_teacher_id: teacherId,
        p_student_id: user.id,
        p_scheduled_at: scheduledAt.toISOString(),
        p_meeting_link: meetingLink || null,
        p_price_per_class: pkg.price_per_class,
      })

      if (error) throw error

      // Fetch the created lesson
      const { data: lesson, error: lessonError } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', data)
        .single()

      if (lessonError) throw lessonError

      return lesson as Lesson
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] })
      queryClient.invalidateQueries({ queryKey: ['upcoming-lessons'] })
      queryClient.invalidateQueries({ queryKey: ['packages'] })
      queryClient.invalidateQueries({ queryKey: ['teacherProfile'] })
    },
  })
}

// Cancel a lesson
export function useCancelLesson() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (lessonId: string) => {
      // Call atomic cancel function
      const { data, error } = await supabase.rpc('cancel_lesson_atomic', {
        p_lesson_id: lessonId,
      })

      if (error) throw error

      return { success: data }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] })
      queryClient.invalidateQueries({ queryKey: ['upcoming-lessons'] })
      queryClient.invalidateQueries({ queryKey: ['packages'] })
      queryClient.invalidateQueries({ queryKey: ['teacherProfile'] })
    },
  })
}

// Update lesson (add meeting link, notes, etc.)
export function useUpdateLesson() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      lessonId,
      updates,
    }: {
      lessonId: string
      updates: Partial<Pick<Lesson, 'meeting_link' | 'notes' | 'status'>>
    }) => {
      const { data, error } = await supabase
        .from('lessons')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', lessonId)
        .select()
        .single()

      if (error) throw error
      return data as Lesson
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lessons'] })
      queryClient.invalidateQueries({ queryKey: ['upcoming-lessons'] })
    },
  })
}
