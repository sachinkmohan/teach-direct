import { useState } from 'react'
import { format, addDays, setHours, setMinutes, parse } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useBookLesson } from '@/hooks/useLessons'
import type { Package } from '@/hooks/usePackages'

interface BookingModalProps {
  package: Package
  teacherName: string
  onSuccess: () => void
  onCancel: () => void
}

/**
 * Render a booking modal that lets a user select a date, time, and optional meeting link, then submit a lesson booking.
 *
 * @param package - Package object containing lesson metadata (e.g., `id`, `teacher_id`, `duration_minutes`, `remaining_classes`)
 * @param teacherName - Display name of the teacher shown in the modal header
 * @param onSuccess - Callback invoked after a successful booking
 * @param onCancel - Callback invoked when the user cancels the booking flow
 * @returns A React element containing the booking modal UI
 */
export function BookingModal({ package: pkg, teacherName, onSuccess, onCancel }: BookingModalProps) {
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedTime, setSelectedTime] = useState<string>('')
  const [meetingLink, setMeetingLink] = useState('')
  const [error, setError] = useState<string | null>(null)

  const bookLesson = useBookLesson()

  // Generate available dates (7 days ago + today + next 29 days = 37 total days for testing)
  const availableDates = Array.from({ length: 37 }, (_, i) => {
    const date = addDays(new Date(), i - 7) // Start from 7 days ago
    return format(date, 'yyyy-MM-dd')
  })

  // Generate time slots (9 AM to 9 PM, every 30 minutes)
  const timeSlots = []
  for (let hour = 9; hour <= 21; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      if (hour === 21 && minute > 0) break
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      timeSlots.push(time)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedDate || !selectedTime) {
      setError('Please select a date and time')
      return
    }

    // Validate meeting link if provided
    if (meetingLink && !meetingLink.startsWith('http')) {
      setError('Please enter a valid meeting link (starting with http)')
      return
    }

    try {
      const [hours, minutes] = selectedTime.split(':').map(Number)
      const parsedDate = parse(selectedDate, 'yyyy-MM-dd', new Date())
      const scheduledAt = setMinutes(setHours(parsedDate, hours), minutes)

      // NOTE: Past date validation is disabled to allow testing with historical dates
      // In production, uncomment this to prevent booking lessons in the past:
      // if (isBefore(scheduledAt, new Date())) {
      //   setError('Please select a future date and time')
      //   return
      // }

      await bookLesson.mutateAsync({
        packageId: pkg.id,
        teacherId: pkg.teacher_id,
        scheduledAt,
        meetingLink: meetingLink || undefined,
      })

      onSuccess()
    } catch (err) {
      console.error('Booking error:', err)
      setError(err instanceof Error ? err.message : 'Failed to book lesson')
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Book a Lesson</CardTitle>
        <CardDescription>
          Schedule a lesson with {teacherName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Package Info */}
          <div className="bg-slate-50 p-4 rounded-md space-y-1">
            <p className="text-sm text-slate-600">
              Lesson duration: <span className="font-semibold">{pkg.duration_minutes} minutes</span>
            </p>
            <p className="text-sm text-slate-600">
              Remaining classes: <span className="font-semibold">{pkg.remaining_classes}</span>
            </p>
          </div>

          {/* Date Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Select Date</label>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
            >
              <option value="">Choose a date...</option>
              {availableDates.map((date) => (
                <option key={date} value={date}>
                  {format(new Date(date), 'EEEE, MMMM d, yyyy')}
                </option>
              ))}
            </select>
          </div>

          {/* Time Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Select Time</label>
            <select
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
            >
              <option value="">Choose a time...</option>
              {timeSlots.map((time) => (
                <option key={time} value={time}>
                  {format(setMinutes(setHours(new Date(), parseInt(time.split(':')[0])), parseInt(time.split(':')[1])), 'h:mm a')}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">Times shown in your local timezone</p>
          </div>

          {/* Meeting Link */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Meeting Link (Optional)
            </label>
            <Input
              type="url"
              placeholder="https://meet.google.com/xxx-xxx-xxx"
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
            />
            <p className="text-xs text-slate-500">
              Add a Google Meet, Zoom, or other video call link
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={bookLesson.isPending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={bookLesson.isPending || pkg.remaining_classes <= 0}
              className="flex-1"
            >
              {bookLesson.isPending ? 'Booking...' : 'Book Lesson'}
            </Button>
          </div>

          {pkg.remaining_classes <= 0 && (
            <p className="text-center text-sm text-red-600">
              No classes remaining in this package
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}