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
  const { data: users } = await supabase
    .from('users')
    .select('id, email, display_name')
    .in('id', userIds)

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

      // First, check if package has remaining classes
      const { data: pkg, error: pkgError } = await supabase
        .from('packages')
        .select('*')
        .eq('id', packageId)
        .single()

      if (pkgError || !pkg) {
        throw new Error('Package not found')
      }

      if (pkg.remaining_classes <= 0) {
        throw new Error('No remaining classes in this package')
      }

      if (pkg.student_id !== user.id) {
        throw new Error('This package does not belong to you')
      }

      // Create the lesson
      const { data: lesson, error: lessonError } = await supabase
        .from('lessons')
        .insert({
          package_id: packageId,
          teacher_id: teacherId,
          student_id: user.id,
          scheduled_at: scheduledAt.toISOString(),
          meeting_link: meetingLink || null,
          status: 'scheduled',
        })
        .select()
        .single()

      if (lessonError) throw lessonError

      // Deduct one class from the package
      const { error: updateError } = await supabase
        .from('packages')
        .update({
          remaining_classes: pkg.remaining_classes - 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', packageId)

      if (updateError) {
        // Rollback: delete the lesson if package update fails
        await supabase.from('lessons').delete().eq('id', lesson.id)
        throw new Error('Failed to update package')
      }

      // Update teacher's pending_balance
      const { data: teacherProfile, error: teacherError } = await supabase
        .from('teacher_profiles')
        .select('pending_balance')
        .eq('user_id', teacherId)
        .single()

      if (!teacherError && teacherProfile) {
        const currentPending = teacherProfile.pending_balance || 0
        const { error: balanceError } = await supabase
          .from('teacher_profiles')
          .update({
            pending_balance: currentPending + pkg.price_per_class,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', teacherId)

        if (balanceError) {
          console.error('Failed to update teacher pending balance:', balanceError)
          // Note: We don't rollback here as the lesson is already booked
          // The balance can be reconciled later
        }
      }

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
      // Get the lesson first
      const { data: lesson, error: lessonError } = await supabase
        .from('lessons')
        .select('*, package:package_id(*)')
        .eq('id', lessonId)
        .single()

      if (lessonError || !lesson) {
        throw new Error('Lesson not found')
      }

      // Update lesson status to cancelled
      const { error: updateError } = await supabase
        .from('lessons')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', lessonId)

      if (updateError) throw updateError

      // Refund the class back to the package
      const { error: pkgError } = await supabase
        .from('packages')
        .update({
          remaining_classes: lesson.package.remaining_classes + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', lesson.package_id)

      if (pkgError) throw pkgError

      // Reduce teacher's pending_balance
      const { data: teacherProfile, error: teacherError } = await supabase
        .from('teacher_profiles')
        .select('pending_balance')
        .eq('user_id', lesson.teacher_id)
        .single()

      if (!teacherError && teacherProfile) {
        const currentPending = teacherProfile.pending_balance || 0
        const newPending = Math.max(0, currentPending - lesson.package.price_per_class)
        const { error: balanceError } = await supabase
          .from('teacher_profiles')
          .update({
            pending_balance: newPending,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', lesson.teacher_id)

        if (balanceError) {
          console.error('Failed to update teacher pending balance:', balanceError)
        }
      }

      return { success: true }
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
