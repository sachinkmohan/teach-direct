import { useState } from 'react'
import { isPast, isFuture } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LessonCard } from '@/components/lessons/LessonCard'
import { useLessons, useCancelLesson, useUpdateLesson } from '@/hooks/useLessons'
import { useUserProfile } from '@/hooks/useUser'
import { useTimezone } from '@/hooks/useTimezone'

type TabType = 'upcoming' | 'past' | 'all'

export function LessonsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('upcoming')
  const { data: lessons, isLoading, error } = useLessons()
  const { data: userProfile } = useUserProfile()
  const cancelLesson = useCancelLesson()
  const updateLesson = useUpdateLesson()
  const { userTimezone, timezoneAbbr } = useTimezone()

  const userRole = userProfile?.role === 'teacher' ? 'teacher' : 'student'

  // Filter lessons based on active tab
  const filteredLessons = lessons?.filter((lesson) => {
    const scheduledDate = new Date(lesson.scheduled_at)
    if (activeTab === 'upcoming') {
      return isFuture(scheduledDate) && lesson.status !== 'cancelled'
    }
    if (activeTab === 'past') {
      return isPast(scheduledDate) || lesson.status === 'cancelled'
    }
    return true // 'all' tab
  })

  const handleCancel = async (lessonId: string) => {
    if (window.confirm('Are you sure you want to cancel this lesson?')) {
      try {
        await cancelLesson.mutateAsync(lessonId)
      } catch (err) {
        console.error('Failed to cancel lesson:', err)
        alert('Failed to cancel lesson. Please try again.')
      }
    }
  }

  const handleComplete = async (lessonId: string) => {
    try {
      await updateLesson.mutateAsync({
        lessonId,
        updates: { status: 'pending_confirmation' },
      })
    } catch (err) {
      console.error('Failed to mark lesson complete:', err)
      alert('Failed to mark lesson as complete. Please try again.')
    }
  }

  const handleJoin = (meetingLink: string) => {
    window.open(meetingLink, '_blank', 'noopener,noreferrer')
  }

  if (isLoading) {
    return (
      <div className="bg-slate-50 min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading lessons...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-slate-50 min-h-[calc(100vh-4rem)]">
        <div className="container mx-auto px-4 py-8">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-red-800">Error Loading Lessons</h3>
              <p className="text-red-700 text-sm mt-2">
                {error instanceof Error ? error.message : 'Failed to load lessons'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-4rem)]">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">My Lessons</h1>
          <p className="text-slate-600 mt-2">
            View and manage your scheduled lessons
          </p>
          <p className="text-sm text-slate-500 mt-1">
            All times shown in {userTimezone} ({timezoneAbbr})
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === 'upcoming' ? 'default' : 'outline'}
            onClick={() => setActiveTab('upcoming')}
          >
            Upcoming
          </Button>
          <Button
            variant={activeTab === 'past' ? 'default' : 'outline'}
            onClick={() => setActiveTab('past')}
          >
            Past
          </Button>
          <Button
            variant={activeTab === 'all' ? 'default' : 'outline'}
            onClick={() => setActiveTab('all')}
          >
            All
          </Button>
        </div>

        {/* Lessons List */}
        {filteredLessons && filteredLessons.length > 0 ? (
          <div className="space-y-4">
            {filteredLessons.map((lesson) => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                userRole={userRole}
                onCancel={handleCancel}
                onComplete={handleComplete}
                onJoin={handleJoin}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">No Lessons Found</CardTitle>
              <CardDescription>
                {activeTab === 'upcoming'
                  ? "You don't have any upcoming lessons scheduled."
                  : activeTab === 'past'
                  ? "You don't have any past lessons."
                  : "You don't have any lessons yet."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {userRole === 'student' && (
                <Button
                  variant="outline"
                  onClick={() => (window.location.href = '/teachers')}
                >
                  Browse Teachers
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Summary Stats */}
        {lessons && lessons.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-2xl font-bold text-slate-900">
                  {lessons.filter((l) => isFuture(new Date(l.scheduled_at)) && l.status === 'scheduled').length}
                </p>
                <p className="text-sm text-slate-600">Upcoming Lessons</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-2xl font-bold text-slate-900">
                  {lessons.filter((l) => l.status === 'confirmed' || l.status === 'completed').length}
                </p>
                <p className="text-sm text-slate-600">Completed Lessons</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-2xl font-bold text-slate-900">
                  {lessons.filter((l) => l.status === 'pending_confirmation').length}
                </p>
                <p className="text-sm text-slate-600">Pending Confirmation</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
