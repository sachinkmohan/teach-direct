import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import type { TeacherLessonOffering } from '@/types/database'

export type { TeacherLessonOffering }

/**
 * Fetches active lesson offerings for the specified teacher, ordered by display order then duration.
 *
 * @param teacherId - The ID of the teacher whose active offerings to fetch
 * @returns A React Query result whose `data` is an array of `TeacherLessonOffering` when successful
 */
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

/**
 * Fetches all lesson offerings for the currently authenticated teacher, including inactive ones.
 *
 * @returns An array of `TeacherLessonOffering` for the authenticated user
 */
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

/**
 * Provides a mutation hook to create or update a teacher's lesson offering.
 *
 * The mutation upserts an offering scoped to the current authenticated teacher and, on success,
 * invalidates cached queries for the teacher's offerings.
 *
 * @returns The mutation result whose `mutate`/`mutateAsync` accepts an `OfferingInput` and resolves to the upserted `TeacherLessonOffering`.
 * @throws Error when there is no authenticated user or when the database operation fails.
 */
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

/**
 * Toggle the active state of a teacher's lesson offering.
 *
 * @returns A React Query mutation hook that accepts variables `{ offeringId: string; isActive: boolean }`, updates the offering's `is_active` and `updated_at` for the current authenticated teacher, and resolves to the updated `TeacherLessonOffering`. On success, related offering queries are invalidated.
 */
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

/**
 * Provide a mutation hook that deletes a teacher's offering by id.
 *
 * The mutation requires an authenticated user and removes the record from
 * the `teacher_lesson_offerings` table where `id` equals the provided offering id
 * and `teacher_id` equals the current user's id. On success, related query caches
 * for the current teacher's offerings and public teacher offerings are invalidated.
 *
 * @returns A React Query mutation result for deleting an offering; call `mutate` or `mutateAsync` with the offering id to perform the deletion. The mutation will throw an error if the user is not authenticated or if the deletion fails.
 */
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

/**
 * Updates the display order for multiple teacher lesson offerings.
 *
 * @param offerings - An array of objects each containing an `id` and the new `display_order` value.
 * @returns Nothing.
 */
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
    },
  })
}