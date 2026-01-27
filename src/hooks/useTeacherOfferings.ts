import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { TeacherLessonOffering } from '@/types/database'

export type { TeacherLessonOffering }

// Fetch active offerings for a specific teacher (for students viewing)
export function useTeacherOfferings(teacherId: string) {
  return useQuery({
    queryKey: ['teacher-offerings', teacherId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teacher_lesson_offerings')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('duration_minutes', { ascending: true })

      if (error) throw error
      return data as TeacherLessonOffering[]
    },
    enabled: !!teacherId,
  })
}

// Fetch current teacher's offerings (all, including inactive)
export function useMyTeacherOfferings() {
  const { user } = useAuthStore()

  return useQuery({
    queryKey: ['my-teacher-offerings', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('teacher_lesson_offerings')
        .select('*')
        .eq('teacher_id', user.id)
        .order('display_order', { ascending: true })
        .order('duration_minutes', { ascending: true })

      if (error) throw error
      return data as TeacherLessonOffering[]
    },
    enabled: !!user,
  })
}

// Input type for creating/updating an offering
export interface OfferingInput {
  duration_minutes: 30 | 45 | 60
  single_rate: number
  package_5_rate?: number | null
  package_10_rate?: number | null
  is_active?: boolean
  display_order?: number
}

// Mutation to create or update an offering
export function useUpsertOffering() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  return useMutation({
    mutationFn: async (input: OfferingInput) => {
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('teacher_lesson_offerings')
        .upsert({
          teacher_id: user.id,
          duration_minutes: input.duration_minutes,
          single_rate: input.single_rate,
          package_5_rate: input.package_5_rate ?? null,
          package_10_rate: input.package_10_rate ?? null,
          is_active: input.is_active ?? true,
          display_order: input.display_order ?? 0,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'teacher_id,duration_minutes',
        })
        .select()
        .single()

      if (error) throw error
      return data as TeacherLessonOffering
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-teacher-offerings'] })
      queryClient.invalidateQueries({ queryKey: ['teacher-offerings'] })
    },
  })
}

// Mutation to toggle offering active status
export function useToggleOfferingActive() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  return useMutation({
    mutationFn: async ({ offeringId, isActive }: { offeringId: string; isActive: boolean }) => {
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('teacher_lesson_offerings')
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', offeringId)
        .eq('teacher_id', user.id)
        .select()
        .single()

      if (error) throw error
      return data as TeacherLessonOffering
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-teacher-offerings'] })
      queryClient.invalidateQueries({ queryKey: ['teacher-offerings'] })
    },
  })
}

// Mutation to delete an offering
export function useDeleteOffering() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  return useMutation({
    mutationFn: async (offeringId: string) => {
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('teacher_lesson_offerings')
        .delete()
        .eq('id', offeringId)
        .eq('teacher_id', user.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-teacher-offerings'] })
      queryClient.invalidateQueries({ queryKey: ['teacher-offerings'] })
    },
  })
}

// Mutation to update multiple offerings at once (for reordering)
export function useUpdateOfferingsOrder() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  return useMutation({
    mutationFn: async (offerings: { id: string; display_order: number }[]) => {
      if (!user) throw new Error('Not authenticated')

      const updates = offerings.map(({ id, display_order }) =>
        supabase
          .from('teacher_lesson_offerings')
          .update({ display_order, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('teacher_id', user.id)
      )

      const results = await Promise.all(updates)
      const errors = results.filter(r => r.error)
      if (errors.length > 0) {
        throw errors[0].error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-teacher-offerings'] })
      queryClient.invalidateQueries({ queryKey: ['teacher-offerings'] })
    },
  })
}
