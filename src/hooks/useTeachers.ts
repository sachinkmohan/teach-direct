import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { TeacherProfile, User } from '@/types/database'
import { useAuthStore } from '@/stores/authStore'

export interface TeacherWithUser extends TeacherProfile {
  users: User
}

export function useTeachers(filters?: { subject?: string; language?: string }) {
  return useQuery({
    queryKey: ['teachers', filters],
    queryFn: async () => {
      let query = supabase
        .from('teacher_profiles')
        .select(`
          *,
          users (*)
        `)
        .not('hourly_rate', 'is', null)

      if (filters?.subject) {
        query = query.contains('subjects', [filters.subject])
      }

      if (filters?.language) {
        query = query.contains('languages', [filters.language])
      }

      const { data, error } = await query

      if (error) throw error
      return data as TeacherWithUser[]
    },
  })
}

export function useTeacher(userId: string) {
  return useQuery({
    queryKey: ['teacher', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teacher_profiles')
        .select(`
          *,
          users (*)
        `)
        .eq('user_id', userId)
        .single()

      if (error) throw error
      return data as TeacherWithUser
    },
    enabled: !!userId,
  })
}

export function useTeacherProfile() {
  const { user: authUser, loading: authLoading } = useAuthStore()

  return useQuery({
    queryKey: ['my-teacher-profile', authUser?.id],
    queryFn: async () => {
      if (!authUser) return null

      const { data, error } = await supabase
        .from('teacher_profiles')
        .select('*')
        .eq('user_id', authUser.id)
        .single()

      // Return null if no profile exists (not an error)
      if (error && error.code === 'PGRST116') {
        return null
      }
      if (error) throw error
      return data as TeacherProfile
    },
    enabled: !authLoading && !!authUser?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}
