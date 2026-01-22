import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { User } from '@/types/database'
import { useAuthStore } from '@/stores/authStore'

export function useUserProfile() {
  const { user: authUser, loading: authLoading } = useAuthStore()

  return useQuery({
    queryKey: ['user-profile', authUser?.id],
    queryFn: async () => {
      if (!authUser) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (error) {
        // If user doesn't exist in users table, try to create one
        if (error.code === 'PGRST116') {
          const role = authUser.user_metadata?.role || 'student'
          const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert({
              id: authUser.id,
              email: authUser.email,
              role: role,
            })
            .select()
            .single()

          if (insertError) throw insertError
          return newUser as User
        }
        throw error
      }
      return data as User
    },
    enabled: !authLoading && !!authUser?.id,
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient()
  const { user: authUser } = useAuthStore()

  return useMutation({
    mutationFn: async (updates: Partial<User>) => {
      if (!authUser) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', authUser.id)
        .select()
        .single()

      if (error) throw error
      return data as User
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] })
    },
  })
}
