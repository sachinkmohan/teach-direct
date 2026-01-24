import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { useAuthStore } from "@/stores/authStore"
import { useUserProfile } from "@/hooks/useUser"
import { useTeacherProfile } from "@/hooks/useTeachers"
import { useUpcomingLessons } from "@/hooks/useLessons"
import { usePackages, type Package } from "@/hooks/usePackages"
import { useTransactions, useMonthlyEarnings } from "@/hooks/useTransactions"
import { BookingModal } from "@/components/lessons/BookingModal"
import { TransactionHistory } from "@/components/wallet/TransactionHistory"
import { supabase } from "@/lib/supabase"
import { useState, useEffect, useMemo } from "react"
import { format } from "date-fns"

export function DashboardPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const { logout } = useAuthStore()
  const { data: userProfile, isLoading: userLoading, error: userError } = useUserProfile()
  const { data: teacherProfile, isLoading: teacherLoading, error: teacherError, refetch: refetchTeacherProfile } = useTeacherProfile()
  const { data: upcomingLessons } = useUpcomingLessons()
  const { data: packages } = usePackages()
  const activePackages = useMemo(
    () => packages?.filter(p => p.status === 'active' && p.remaining_classes > 0) ?? [],
    [packages]
  )
  const [connectingStripe, setConnectingStripe] = useState(false)
  const [bookingPackage, setBookingPackage] = useState<Package | null>(null)
  const [teacherNames, setTeacherNames] = useState<Record<string, string>>({})
  const { data: transactions, isLoading: transactionsLoading } = useTransactions()
  const { data: monthlyEarnings } = useMonthlyEarnings()

  // Fetch teacher names for packages
  useEffect(() => {
    const fetchTeacherNames = async () => {
      if (!packages || packages.length === 0) return

      const teacherIds = [...new Set(packages.map(p => p.teacher_id))]
      const { data, error } = await supabase
        .from('users')
        .select('id, display_name, email')
        .in('id', teacherIds)

      if (error) {
        console.error('Failed to fetch teacher names:', error)
        return
      }

      if (data) {
        const names: Record<string, string> = {}
        data.forEach(u => {
          names[u.id] = u.display_name || u.email
        })
        setTeacherNames(names)
      } else {
        console.warn('No teacher data returned')
      }
    }
    fetchTeacherNames()
  }, [packages])
  const [stripeMessage, setStripeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const isTeacher = userProfile?.role === 'teacher'
  const hasCompletedProfile = teacherProfile?.hourly_rate != null
  const isStripeConnected = teacherProfile?.stripe_connect_status === 'active'

  const handleLogout = async () => {
    try {
      await logout()
      navigate("/")
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  const handleConnectStripe = async () => {
    setConnectingStripe(true)
    try {
      // Get the current session to ensure we have a valid access token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session) {
        throw new Error('Not authenticated - please log in again')
      }

      const { data, error } = await supabase.functions.invoke('stripe-connect-onboard', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (error) {
        throw new Error(error.message || 'Failed to create onboarding link')
      }

      if (!data?.url) {
        throw new Error(data?.error || 'No onboarding URL returned')
      }

      // Redirect to Stripe onboarding
      window.location.href = data.url
    } catch (error) {
      console.error('Stripe Connect error:', error)
      setStripeMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to connect Stripe'
      })
      setConnectingStripe(false)
    }
  }

  // Handle Escape key to close modals
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (bookingPackage) setBookingPackage(null)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [bookingPackage])

  // Handle Stripe Connect redirect
  useEffect(() => {
    const stripeConnect = searchParams.get('stripe_connect')
    if (stripeConnect === 'success') {
      // Update stripe_connect_status to active
      const updateStatus = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            await supabase
              .from('teacher_profiles')
              .update({ stripe_connect_status: 'active' })
              .eq('user_id', user.id)

            // Refetch teacher profile to show updated status
            await refetchTeacherProfile()

            setStripeMessage({ type: 'success', text: 'Stripe account connected successfully!' })
          }
        } catch (error) {
          console.error('Failed to update status:', error)
        }
      }
      updateStatus()

      // Remove query param
      searchParams.delete('stripe_connect')
      setSearchParams(searchParams)
    } else if (stripeConnect === 'refresh' || stripeConnect === 'failed') {
      setStripeMessage({ type: 'error', text: 'Stripe connection incomplete. Please try again.' })
      searchParams.delete('stripe_connect')
      setSearchParams(searchParams)
    }
  }, [searchParams, setSearchParams, refetchTeacherProfile])

  // Show errors if queries failed
  if (userError) {
    return (
      <div className="bg-slate-50 min-h-[calc(100vh-4rem)]">
        <div className="container mx-auto px-4 py-8">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-red-800">Error Loading Profile</h3>
              <p className="text-red-700 text-sm mt-2">
                {userError instanceof Error ? userError.message : 'Failed to load user profile'}
              </p>
              <p className="text-red-600 text-xs mt-2">
                This may happen if your user record wasn't created. Please try logging out and signing up again,
                or run the database setup SQL in Supabase.
              </p>
              <div className="mt-4 space-x-4">
                <Button onClick={handleLogout} variant="outline">Log Out</Button>
                <Button onClick={() => window.location.reload()}>Retry</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (userLoading) {
    return (
      <div className="bg-slate-50 min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading profile...</p>
        </div>
      </div>
    )
  }

  // For teachers, wait for teacher profile to load too
  if (isTeacher && teacherLoading) {
    return (
      <div className="bg-slate-50 min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading teacher profile...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-4rem)]">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-2">
            Welcome back, {userProfile?.display_name || user?.email}
          </p>
          <span className="inline-block mt-2 px-3 py-1 bg-slate-200 text-slate-700 text-sm rounded-full capitalize">
            {userProfile?.role || 'user'}
          </span>
        </div>

        {/* Stripe Connect Message */}
        {stripeMessage && (
          <Card className={`mb-6 ${stripeMessage.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            <CardContent className="pt-6">
              <p className={stripeMessage.type === 'success' ? 'text-green-700' : 'text-red-700'}>
                {stripeMessage.text}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Teacher Profile Setup Banner */}
        {isTeacher && !hasCompletedProfile && (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-amber-800">Complete Your Profile</h3>
                  <p className="text-amber-700 text-sm">
                    Set up your teacher profile to start accepting students
                  </p>
                </div>
                <Link to="/teacher/onboarding">
                  <Button>Set Up Profile</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Teacher error (non-blocking) */}
        {isTeacher && teacherError && (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardContent className="pt-6">
              <p className="text-amber-700 text-sm">
                Could not load teacher profile. You may need to set it up.
              </p>
              <Link to="/teacher/onboarding" className="mt-2 inline-block">
                <Button size="sm">Set Up Profile</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isTeacher ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>My Profile</CardTitle>
                  <CardDescription>Manage your teacher profile</CardDescription>
                </CardHeader>
                <CardContent>
                  {hasCompletedProfile ? (
                    <>
                      <p className="text-slate-600 mb-4">
                        Rate: €{teacherProfile?.hourly_rate}/hr
                      </p>
                      <Link to="/teacher/onboarding">
                        <Button variant="outline">Edit Profile</Button>
                      </Link>
                    </>
                  ) : (
                    <Link to="/teacher/onboarding">
                      <Button>Complete Setup</Button>
                    </Link>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Stripe Connect</CardTitle>
                  <CardDescription>Connect your bank account</CardDescription>
                </CardHeader>
                <CardContent>
                  {isStripeConnected ? (
                    <>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                        <p className="text-sm text-slate-600">Connected</p>
                      </div>
                      <p className="text-xs text-slate-500 mb-4">
                        You can receive payments and withdraw earnings
                      </p>
                      <Button variant="outline" size="sm" onClick={handleConnectStripe}>
                        Update Settings
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="h-2 w-2 bg-amber-500 rounded-full"></div>
                        <p className="text-sm text-slate-600">Not connected</p>
                      </div>
                      <p className="text-xs text-slate-500 mb-4">
                        Connect Stripe to receive payments
                      </p>
                      <Button
                        onClick={handleConnectStripe}
                        disabled={connectingStripe}
                      >
                        {connectingStripe ? 'Connecting...' : 'Connect Stripe'}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>My Lessons</CardTitle>
                  <CardDescription>View scheduled lessons</CardDescription>
                </CardHeader>
                <CardContent>
                  {upcomingLessons && upcomingLessons.length > 0 ? (
                    <>
                      <p className="text-2xl font-bold text-slate-900 mb-1">
                        {upcomingLessons.length}
                      </p>
                      <p className="text-slate-600 mb-4">upcoming lesson{upcomingLessons.length !== 1 ? 's' : ''}</p>
                    </>
                  ) : (
                    <p className="text-slate-600 mb-4">No upcoming lessons</p>
                  )}
                  <Link to="/lessons">
                    <Button variant="outline">View Lessons</Button>
                  </Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Earnings</CardTitle>
                  <CardDescription>{monthlyEarnings?.month} {monthlyEarnings?.year}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-slate-900">
                    €{(monthlyEarnings?.amount || 0).toFixed(2)}
                  </p>
                  <p className="text-sm text-slate-500">This month's earnings</p>
                  {(teacherProfile?.pending_balance || 0) > 0 && (
                    <p className="text-sm text-amber-600 mt-1">
                      €{teacherProfile?.pending_balance?.toFixed(2)} pending confirmation
                    </p>
                  )}
                  {isStripeConnected && (
                    <p className="text-xs text-slate-500 mt-4">
                      Earnings are automatically deposited to your Stripe account
                    </p>
                  )}
                  {!isStripeConnected && (
                    <p className="text-xs text-amber-600 mt-4">
                      Connect Stripe to receive earnings
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>My Lessons</CardTitle>
                  <CardDescription>View and manage your lessons</CardDescription>
                </CardHeader>
                <CardContent>
                  {upcomingLessons && upcomingLessons.length > 0 ? (
                    <>
                      <p className="text-2xl font-bold text-slate-900 mb-1">
                        {upcomingLessons.length}
                      </p>
                      <p className="text-slate-600 mb-4">upcoming lesson{upcomingLessons.length !== 1 ? 's' : ''}</p>
                    </>
                  ) : (
                    <p className="text-slate-600 mb-4">No upcoming lessons</p>
                  )}
                  <div className="flex gap-2">
                    <Link to="/lessons">
                      <Button variant="outline">View All Lessons</Button>
                    </Link>
                    <Link to="/teachers">
                      <Button variant="outline">Browse Teachers</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>My Packages</CardTitle>
                  <CardDescription>Manage your lesson packages</CardDescription>
                </CardHeader>
                <CardContent>
                  {activePackages.length > 0 ? (
                    <div className="space-y-3">
                      {activePackages.map(pkg => {
                        const usedClasses = pkg.total_classes - pkg.remaining_classes
                        const progressPercent = (usedClasses / pkg.total_classes) * 100

                        return (
                          <div key={pkg.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1">
                                <p className="font-semibold text-slate-900 text-lg">
                                  {teacherNames[pkg.teacher_id] || 'Teacher'}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                  Purchased {format(new Date(pkg.created_at), 'MMM d, yyyy')}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => setBookingPackage(pkg)}
                                disabled={pkg.remaining_classes <= 0}
                              >
                                Book Lesson
                              </Button>
                            </div>

                            {/* Progress Bar */}
                            <div className="mb-3">
                              <div className="flex justify-between text-xs text-slate-600 mb-1">
                                <span>{usedClasses} used</span>
                                <span>{pkg.remaining_classes} remaining</span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full transition-all"
                                  style={{ width: `${progressPercent}%` }}
                                ></div>
                              </div>
                            </div>

                            {/* Package Details */}
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <p className="text-slate-500 text-xs">Total Classes</p>
                                <p className="font-medium text-slate-900">{pkg.total_classes}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs">Price per Class</p>
                                <p className="font-medium text-slate-900">€{pkg.price_per_class.toFixed(2)}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs">Total Paid</p>
                                <p className="font-medium text-slate-900">€{pkg.total_amount.toFixed(2)}</p>
                              </div>
                              <div>
                                <p className="text-slate-500 text-xs">Status</p>
                                <p className="font-medium text-slate-900 capitalize">{pkg.status}</p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      <Link to="/teachers" className="block mt-4">
                        <Button variant="outline" size="sm" className="w-full">
                          Purchase More
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <>
                      <p className="text-slate-600 mb-4">No active packages</p>
                      <Link to="/teachers">
                        <Button variant="outline">Purchase Package</Button>
                      </Link>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Spending Summary</CardTitle>
                  <CardDescription>Your payment history</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-2xl font-bold text-slate-900">
                        €{transactions?.filter(t => t.type === 'purchase').reduce((sum, t) => sum + t.amount, 0).toFixed(2) || '0.00'}
                      </p>
                      <p className="text-sm text-slate-500">Total Packages Purchased</p>
                    </div>

                    <div className="pt-3 border-t">
                      <p className="text-lg font-semibold text-slate-900">
                        €{transactions?.filter(t => t.type === 'lesson_payment').reduce((sum, t) => sum + t.amount, 0).toFixed(2) || '0.00'}
                      </p>
                      <p className="text-sm text-slate-500">Lessons Confirmed (Paid Out)</p>
                    </div>

                    {activePackages.length > 0 && (
                      <div className="pt-3 border-t">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-lg font-semibold text-slate-900">
                              {activePackages.reduce((sum, pkg) => sum + pkg.remaining_classes, 0)}
                            </p>
                            <p className="text-sm text-slate-500">Classes Remaining</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-semibold text-slate-900">
                              €{activePackages.reduce((sum, pkg) => sum + (pkg.remaining_classes * pkg.price_per_class), 0).toFixed(2)}
                            </p>
                            <p className="text-sm text-slate-500">Remaining Value</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Transaction History */}
        <div className="mt-8">
          <TransactionHistory
            transactions={
              isTeacher
                ? transactions?.filter(t => t.type === 'lesson_payment') || []
                : transactions?.filter(t => t.type === 'purchase' || t.type === 'refund' || t.type === 'lesson_payment') || []
            }
            isLoading={transactionsLoading}
            userRole={isTeacher ? 'teacher' : 'student'}
          />
        </div>

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Account Info</CardTitle>
              <CardDescription>Your account details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-600">Email</p>
                  <p className="font-medium text-slate-900">{user?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Role</p>
                  <p className="font-medium text-slate-900 capitalize">{userProfile?.role}</p>
                </div>
                <div className="pt-4">
                  <Button onClick={handleLogout} variant="outline" className="text-red-600 hover:text-red-700">
                    Log Out
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Booking Modal */}
      {bookingPackage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <BookingModal
            package={bookingPackage}
            teacherName={teacherNames[bookingPackage.teacher_id] || 'Teacher'}
            onSuccess={() => {
              setBookingPackage(null)
              // Refresh will happen automatically via React Query invalidation
            }}
            onCancel={() => setBookingPackage(null)}
          />
        </div>
      )}

    </div>
  )
}
