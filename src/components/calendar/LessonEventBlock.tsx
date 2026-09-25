import type { EventContentArg } from '@fullcalendar/core'
import type { Lesson } from '@/types/database'

type LessonStatus = Lesson['status']

// Same status vocabulary as LessonCard's statusColors, adapted for a
// small calendar block rather than a badge.
const statusBlockColors: Record<LessonStatus, string> = {
  scheduled: 'bg-blue-100 text-blue-900 border-blue-300',
  completed: 'bg-gray-100 text-gray-900 border-gray-300',
  pending_confirmation: 'bg-yellow-100 text-yellow-900 border-yellow-300',
  awaiting_admin_approval: 'bg-purple-100 text-purple-900 border-purple-300',
  confirmed: 'bg-green-100 text-green-900 border-green-300',
  disputed: 'bg-red-100 text-red-900 border-red-300',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-300 opacity-60',
  incomplete: 'bg-orange-100 text-orange-900 border-orange-300',
}

// Rendered by FullCalendar once per event. Never derives times from
// `arg.event.start` directly - that Date object only reliably reflects
// the browser's local zone or UTC, not the calendar's configured
// `timeZone`. `arg.timeText` is already formatted for the right zone.
export function LessonEventBlock(arg: EventContentArg) {
  const otherPartyName = (arg.event.extendedProps.otherPartyName as string) || 'Unknown'
  const status = arg.event.extendedProps.status as LessonStatus
  const colorClasses = statusBlockColors[status] ?? 'bg-slate-100 text-slate-900 border-slate-300'

  return (
    <div className={`h-full w-full rounded border-l-2 px-1.5 py-0.5 overflow-hidden ${colorClasses}`}>
      <div className="text-xs font-medium truncate">{otherPartyName}</div>
      <div className="text-[11px] opacity-80 truncate">{arg.timeText}</div>
    </div>
  )
}
