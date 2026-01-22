import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { useAuthStore } from "@/stores/authStore"

export function Header() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { logout } = useAuthStore()

  const handleLogout = async () => {
    try {
      await logout()
      navigate("/")
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-slate-900">TeachDirect</span>
          </Link>

          <nav className="hidden md:flex items-center space-x-6">
            <Link to="/teachers" className="text-sm font-medium text-slate-700 hover:text-slate-900">
              Find Teachers
            </Link>
            <Link to="/how-it-works" className="text-sm font-medium text-slate-700 hover:text-slate-900">
              How It Works
            </Link>
          </nav>

          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <Link to="/dashboard">
                  <Button variant="ghost">Dashboard</Button>
                </Link>
                <Button onClick={handleLogout} variant="outline">
                  Log Out
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost">Log In</Button>
                </Link>
                <Link to="/signup">
                  <Button>Sign Up</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
