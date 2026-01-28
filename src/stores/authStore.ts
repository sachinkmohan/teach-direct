import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

type User = Session['user']

interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
  initialized: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  signup: (email: string, password: string, role: 'student' | 'teacher', displayName: string, timezone: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  error: null,
  initialized: false,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  signup: async (email: string, password: string, role: 'student' | 'teacher', displayName: string, timezone: string) => {
    set({ loading: true, error: null })
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role,
            display_name: displayName,
            timezone,
          },
        },
      })
      if (error) throw error
      set({ user: data.user })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign up failed'
      set({ error: message })
      throw error
    } finally {
      set({ loading: false })
    }
  },

  login: async (email: string, password: string) => {
    set({ loading: true, error: null })
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      set({ user: data.user })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed'
      set({ error: message })
      throw error
    } finally {
      set({ loading: false })
    }
  },

  logout: async () => {
    // Immediately clear user for responsive UI
    set({ user: null, loading: true, error: null })
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Logout failed'
      set({ error: message })
      throw error
    } finally {
      set({ loading: false })
    }
  },

  initialize: async () => {
    // Prevent multiple initializations
    if (get().initialized) return

    set({ loading: true })
    try {
      // Get initial session
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      set({ user: data.session?.user || null, initialized: true })

      // Listen for auth changes
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ user: session?.user || null })
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to initialize auth'
      set({ error: message, initialized: true })
    } finally {
      set({ loading: false })
    }
  },
}))
