import { isPast, isFuture } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getTimezoneAbbreviation } from '@/hooks/useTimezone'
import type { LessonWithDetails } from '@/hooks/useLessons'
import type { Lesson } from '@/types/database'

interface LessonCardProps {
  lesson: LessonWithDetails
  userRole: 'student' | 'teacher'
  userTimezone: string
  onCancel?: (lessonId: string) => void
  onComplete?: (lessonId: string) => void
  onIncomplete?: (lessonId: string) => void
  onConfirm?: (lessonId: string) => void
  onDispute?: (lessonId: string) => void
  isConfirming?: boolean
}

type LessonStatus = Lesson['status']

const statusColors: Record<LessonStatus, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  completed: 'bg-gray-100 text-gray-800',
  pending_confirmation: 'bg-yellow-100 text-yellow-800',
  awaiting_admin_approval: 'bg-purple-100 text-purple-800',
  confirmed: 'bg-green-100 text-green-800',
  disputed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-500',
  incomplete: 'bg-orange-100 text-orange-800',
}

const statusLabels: Record<LessonStatus, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  pending_confirmation: 'Pending Confirmation',
  awaiting_admin_approval: 'Awaiting Admin Approval',
  confirmed: 'Confirmed',
  disputed: 'Disputed',
  cancelled: 'Cancelled',
  incomplete: 'Incomplete',
}

export function LessonCard({ lesson, userRole, userTimezone, onCancel, onComplete, onIncomplete, onConfirm, onDispute, isConfirming = false }: LessonCardProps) {
  const scheduledDate = new Date(lesson.scheduled_at)
  const isUpcoming = isFuture(scheduledDate)
  const isPastLesson = isPast(scheduledDate)
  const canCancel = isUpcoming && lesson.status === 'scheduled'
  const canComplete = isPastLesson && lesson.status === 'scheduled' && userRole === 'teacher'
  const canIncomplete = isPastLesson && lesson.status === 'scheduled' && userRole === 'teacher'
  const canConfirm = lesson.status === 'pending_confirmation' && userRole === 'student'
  const canDispute = lesson.status === 'pending_confirmation' && userRole === 'student'

  const otherPerson = userRole === 'student' ? lesson.teacher : lesson.student
  const otherPersonLabel = userRole === 'student' ? 'Teacher' : 'Student'
  const otherPersonTimezone = otherPerson?.timezone || 'UTC'

  // Safe status access with fallback
  const status = lesson.status as LessonStatus
  const statusColor = statusColors[status] ?? 'bg-gray-100 text-gray-800'
  const statusLabel = statusLabels[status] ?? status

  return (
    <Card className={lesson.status === 'cancelled' || lesson.status === 'incomplete' ? 'opacity-60' : ''}>
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Lesson Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                {statusLabel}
              </span>
              {isUpcoming && lesson.status === 'scheduled' && (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Upcoming
                </span>
              )}
            </div>

            <div>
              <p className="font-semibold text-lg">
                {formatInTimeZone(scheduledDate, userTimezone, 'EEEE, MMMM d, yyyy')}
              </p>
              <p className="text-slate-600">
                {formatInTimeZone(scheduledDate, userTimezone, 'h:mm a')} {getTimezoneAbbreviation(userTimezone, scheduledDate)} ({lesson.duration_minutes} minutes)
              </p>
              <p className="text-sm text-slate-500">
                {otherPersonLabel}'s time: {formatInTimeZone(scheduledDate, otherPersonTimezone, 'h:mm a')} {getTimezoneAbbreviation(otherPersonTimezone, scheduledDate)}
              </p>
            </div>

            <p className="text-sm text-slate-600">
              {otherPersonLabel}: <span className="font-medium">{otherPerson?.display_name || otherPerson?.email || 'Unknown'}</span>
            </p>

            {lesson.notes && (
              <p className="text-sm text-slate-600">
                Notes: {lesson.notes}
              </p>
            )}

            {/* Status message for awaiting_admin_approval */}
            {lesson.status === 'awaiting_admin_approval' && (
              <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded text-sm">
                <p className="text-purple-700">
                  {userRole === 'student' ? (
                    'Payment is pending admin approval.'
                  ) : (
                    'Student has approved. Awaiting admin approval for payment.'
                  )}
                </p>
              </div>
            )}

            {/* Status message for pending_confirmation */}
            {lesson.status === 'pending_confirmation' && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-sm">
                <p className="text-amber-700">
                  {userRole === 'student' ? (
                    'Please confirm that this lesson was completed.'
                  ) : (
                    'Awaiting student confirmation.'
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {canComplete && onComplete && (
              <Button
                onClick={() => onComplete(lesson.id)}
                variant="outline"
                className="w-full md:w-auto"
              >
                Mark Complete
              </Button>
            )}

            {canIncomplete && onIncomplete && (
              <Button
                onClick={() => onIncomplete(lesson.id)}
                variant="outline"
                className="w-full md:w-auto text-orange-600 hover:text-orange-700 border-orange-300"
              >
                Mark Incomplete
              </Button>
            )}

            {canConfirm && onConfirm && (
              <Button
                onClick={() => onConfirm(lesson.id)}
                className="w-full md:w-auto bg-green-600 hover:bg-green-700"
                disabled={isConfirming}
              >
                {isConfirming ? 'Confirming...' : 'Confirm Lesson'}
              </Button>
            )}

            {canDispute && onDispute && (
              <Button
                onClick={() => onDispute(lesson.id)}
                variant="outline"
                className="w-full md:w-auto text-amber-600 hover:text-amber-700 border-amber-300"
              >
                Dispute
              </Button>
            )}

            {canCancel && onCancel && (
              <Button
                onClick={() => onCancel(lesson.id)}
                variant="outline"
                className="w-full md:w-auto text-red-600 hover:text-red-700"
              >
                Cancel Lesson
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
