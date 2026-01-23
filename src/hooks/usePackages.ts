import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

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

export function usePackages() {
  const { user } = useAuthStore()

  return useQuery({
    queryKey: ['packages', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Package[]
    },
    enabled: !!user,
  })
}

export function useTeacherPackages() {
  const { user } = useAuthStore()

  return useQuery({
    queryKey: ['teacher-packages', user?.id],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Package[]
    },
    enabled: !!user,
  })
}
