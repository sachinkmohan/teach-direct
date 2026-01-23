import { format, isPast, isFuture } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { LessonWithDetails } from '@/hooks/useLessons'

interface LessonCardProps {
  lesson: LessonWithDetails
  userRole: 'student' | 'teacher'
  onCancel?: (lessonId: string) => void
  onComplete?: (lessonId: string) => void
  onJoin?: (meetingLink: string) => void
}

const statusColors = {
  scheduled: 'bg-blue-100 text-blue-800',
  completed: 'bg-gray-100 text-gray-800',
  pending_confirmation: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
  disputed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-500',
}

const statusLabels = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  pending_confirmation: 'Pending Confirmation',
  confirmed: 'Confirmed',
  disputed: 'Disputed',
  cancelled: 'Cancelled',
}

export function LessonCard({ lesson, userRole, onCancel, onComplete, onJoin }: LessonCardProps) {
  const scheduledDate = new Date(lesson.scheduled_at)
  const isUpcoming = isFuture(scheduledDate)
  const isPastLesson = isPast(scheduledDate)
  const canCancel = isUpcoming && lesson.status === 'scheduled'
  const canComplete = isPastLesson && lesson.status === 'scheduled' && userRole === 'teacher'

  const otherPerson = userRole === 'student' ? lesson.teacher : lesson.student
  const otherPersonLabel = userRole === 'student' ? 'Teacher' : 'Student'

  return (
    <Card className={lesson.status === 'cancelled' ? 'opacity-60' : ''}>
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Lesson Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[lesson.status]}`}>
                {statusLabels[lesson.status]}
              </span>
              {isUpcoming && lesson.status === 'scheduled' && (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Upcoming
                </span>
              )}
            </div>

            <div>
              <p className="font-semibold text-lg">
                {format(scheduledDate, 'EEEE, MMMM d, yyyy')}
              </p>
              <p className="text-slate-600">
                {format(scheduledDate, 'h:mm a')} ({lesson.duration_minutes} minutes)
              </p>
            </div>

            <p className="text-sm text-slate-600">
              {otherPersonLabel}: <span className="font-medium">{otherPerson?.display_name || otherPerson?.email}</span>
            </p>

            {lesson.meeting_link && (
              <p className="text-sm">
                <span className="text-slate-600">Meeting: </span>
                <a
                  href={lesson.meeting_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Join Video Call
                </a>
              </p>
            )}

            {lesson.notes && (
              <p className="text-sm text-slate-600">
                Notes: {lesson.notes}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {lesson.meeting_link && isUpcoming && lesson.status === 'scheduled' && (
              <Button
                onClick={() => onJoin?.(lesson.meeting_link!)}
                className="w-full md:w-auto"
              >
                Join Meeting
              </Button>
            )}

            {canComplete && onComplete && (
              <Button
                onClick={() => onComplete(lesson.id)}
                variant="outline"
                className="w-full md:w-auto"
              >
                Mark Complete
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
