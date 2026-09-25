import { useLessons } from '@/hooks/useLessons'
import { useUserProfile } from '@/hooks/useUser'
import { getTimezoneAbbreviation } from '@/hooks/useTimezone'
import { LessonCalendar } from '@/components/calendar/LessonCalendar'

export function CalendarPage() {
  const { data: lessons, isLoading, error } = useLessons()
  const { data: userProfile } = useUserProfile()

  const userTimezone = userProfile?.timezone || 'UTC'
  const timezoneAbbr = getTimezoneAbbreviation(userTimezone)
  const userRole = userProfile?.role === 'teacher' ? 'teacher' : 'student'

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <p className="text-slate-500">Loading calendar...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <p className="text-red-600">Failed to load your lessons. Please try again.</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-4rem)]">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Calendar</h1>
            <p className="text-slate-600 mt-2">
              Your lessons for the week
            </p>
          </div>
          <p className="text-sm text-slate-500">
            {userTimezone} ({timezoneAbbr})
          </p>
        </div>

        <LessonCalendar
          lessons={lessons || []}
          userTimezone={userTimezone}
          userRole={userRole}
        />
      </div>
    </div>
  )
}
