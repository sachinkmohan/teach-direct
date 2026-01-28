import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { isPast, isFuture } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LessonCard } from '@/components/lessons/LessonCard'
import { DisputeModal } from '@/components/lessons/DisputeModal'
import { useLessons, useCancelLesson, useCompleteLesson, useIncompleteLesson, useConfirmLesson, useDisputeLesson } from '@/hooks/useLessons'
import { useUserProfile } from '@/hooks/useUser'
import { getTimezoneAbbreviation } from '@/hooks/useTimezone'

type TabType = 'upcoming' | 'past' | 'all'

export function LessonsPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('upcoming')
  const [disputeModalLessonId, setDisputeModalLessonId] = useState<string | null>(null)
  const [confirmingLessonId, setConfirmingLessonId] = useState<string | null>(null)
  const { data: lessons, isLoading, error } = useLessons()
  const { data: userProfile } = useUserProfile()
  const cancelLesson = useCancelLesson()
  const completeLesson = useCompleteLesson()
  const incompleteLesson = useIncompleteLesson()
  const confirmLesson = useConfirmLesson()
  const disputeLesson = useDisputeLesson()

  // Use stored timezone from user profile, not browser timezone
  const userTimezone = userProfile?.timezone || 'UTC'
  const timezoneAbbr = getTimezoneAbbreviation(userTimezone)

  const userRole = userProfile?.role === 'teacher' ? 'teacher' : 'student'

  // Handle Escape key to close dispute modal
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && disputeModalLessonId) {
        setDisputeModalLessonId(null)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [disputeModalLessonId])

  // Filter lessons based on active tab
  const filteredLessons = lessons?.filter((lesson) => {
    const scheduledDate = new Date(lesson.scheduled_at)
    if (activeTab === 'upcoming') {
      // Show upcoming scheduled lessons OR pending_confirmation lessons (need action)
      return (isFuture(scheduledDate) && lesson.status !== 'cancelled') ||
             lesson.status === 'pending_confirmation'
    }
    if (activeTab === 'past') {
      // Show past lessons by scheduled date, excluding pending_confirmation (those are in upcoming)
      return isPast(scheduledDate) && lesson.status !== 'pending_confirmation'
    }
    return true // 'all' tab
  }).sort((a, b) => {
    // Sort pending_confirmation to the top for visibility
    if (a.status === 'pending_confirmation' && b.status !== 'pending_confirmation') return -1
    if (a.status !== 'pending_confirmation' && b.status === 'pending_confirmation') return 1
    // Otherwise sort by scheduled date
    return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
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
    if (window.confirm('Are you sure you want to mark this lesson as complete? The student will be notified to confirm.')) {
      try {
        await completeLesson.mutateAsync(lessonId)
      } catch (err) {
        console.error('Failed to mark lesson complete:', err)
        alert(err instanceof Error ? err.message : 'Failed to mark lesson as complete. Please try again.')
      }
    }
  }

  const handleIncomplete = async (lessonId: string) => {
    if (window.confirm('This lesson will be marked as incomplete and the class credit will be refunded to the student. Are you sure?')) {
      try {
        await incompleteLesson.mutateAsync(lessonId)
      } catch (err) {
        console.error('Failed to mark lesson incomplete:', err)
        alert(err instanceof Error ? err.message : 'Failed to mark lesson as incomplete. Please try again.')
      }
    }
  }

  const handleConfirm = (lessonId: string) => {
    if (confirmingLessonId) return // Prevent multiple confirmations at once

    if (window.confirm('Are you sure you want to confirm this lesson? Funds will be released to the teacher.')) {
      // Disable the button immediately
      setConfirmingLessonId(lessonId)

      // Fire and forget - process in background
      confirmLesson.mutateAsync(lessonId)
        .catch((err) => {
          console.error('Failed to confirm lesson:', err)
          alert(err instanceof Error ? err.message : 'Failed to confirm lesson. Please try again.')
        })
        .finally(() => {
          setConfirmingLessonId(null)
        })
    }
  }

  const handleDispute = (lessonId: string) => {
    setDisputeModalLessonId(lessonId)
  }

  const handleDisputeSubmit = async (lessonId: string, reason: string) => {
    await disputeLesson.mutateAsync({ lessonId, reason })
    setDisputeModalLessonId(null)
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

        {/* Pending Confirmation Alert for Students */}
        {userRole === 'student' && lessons && lessons.filter(l => l.status === 'pending_confirmation').length > 0 && (
          <Card className="mb-6 border-amber-300 bg-amber-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white font-bold">
                  !
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-900">
                    {lessons.filter(l => l.status === 'pending_confirmation').length} Lesson{lessons.filter(l => l.status === 'pending_confirmation').length !== 1 ? 's' : ''} Awaiting Confirmation
                  </h3>
                  <p className="text-amber-800 text-sm mt-1">
                    Your teacher has marked {lessons.filter(l => l.status === 'pending_confirmation').length === 1 ? 'a lesson' : 'lessons'} as complete. Please review and confirm to release payment, or dispute if there was an issue.
                  </p>
                  {activeTab !== 'upcoming' && (
                    <Button
                      onClick={() => setActiveTab('upcoming')}
                      size="sm"
                      className="mt-3"
                    >
                      View Pending Lessons
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
                userTimezone={userTimezone}
                onCancel={handleCancel}
                onComplete={handleComplete}
                onIncomplete={handleIncomplete}
                onConfirm={handleConfirm}
                onDispute={handleDispute}
                isConfirming={confirmingLessonId === lesson.id}
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
                  onClick={() => navigate('/teachers')}
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

      {/* Dispute Modal */}
      {disputeModalLessonId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <DisputeModal
            lessonId={disputeModalLessonId}
            onSubmit={handleDisputeSubmit}
            onCancel={() => setDisputeModalLessonId(null)}
            isLoading={disputeLesson.isPending}
          />
        </div>
      )}
    </div>
  )
}
