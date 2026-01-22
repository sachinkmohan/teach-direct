import { useAuthStore } from '@/stores/authStore'

export function useAuth() {
  const { user, loading, error } = useAuthStore()

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
  }
}
