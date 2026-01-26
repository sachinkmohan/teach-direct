import { useEffect } from "react"
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MainLayout } from "@/components/layout"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import {
  HomePage,
  LoginPage,
  SignupPage,
  DashboardPage,
  TeachersPage,
  TeacherDetailPage,
  TeacherOnboardingPage,
  LessonsPage,
} from "@/pages"
import { useAuthStore } from "@/stores/authStore"
import { supabase } from "@/lib/supabase"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

function AppRoutes() {
  const initialize = useAuthStore((state) => state.initialize)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    initialize()
  }, [initialize])

  // Handle email confirmation callback (tokens in URL hash)
  useEffect(() => {
    const handleAuthCallback = async () => {
      // Check if we have auth tokens in the URL hash (from email confirmation)
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const type = hashParams.get('type')

      if (accessToken) {
        // Let Supabase process the tokens
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Auth callback error:', error)
          navigate('/login?error=confirmation_failed')
        } else if (data.session) {
          // Clear the hash from URL
          window.history.replaceState(null, '', window.location.pathname)

          // Redirect based on confirmation type
          if (type === 'signup' || type === 'email') {
            navigate('/login?confirmed=true')
          } else {
            navigate('/dashboard')
          }
        } else {
          // No session returned - fallback redirect
          console.error('Auth callback error: no session returned')
          window.history.replaceState(null, '', window.location.pathname)
          navigate('/login?error=confirmation_failed')
        }
      }
    }

    handleAuthCallback()
  }, [navigate, location.hash])

  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/teachers" element={<TeachersPage />} />
        <Route path="/teachers/:teacherId" element={<TeacherDetailPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/onboarding"
          element={
            <ProtectedRoute>
              <TeacherOnboardingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/lessons"
          element={
            <ProtectedRoute>
              <LessonsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
