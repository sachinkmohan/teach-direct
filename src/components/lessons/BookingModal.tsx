import { useState, useMemo } from 'react'
import { format, addDays, setHours, setMinutes, parse } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useBookLesson } from '@/hooks/useLessons'
import { formatInTimezone, getTimezoneAbbreviation } from '@/hooks/useTimezone'
import type { Package } from '@/hooks/usePackages'

interface BookingModalProps {
  package: Package
  teacherName: string
  teacherTimezone: string
  studentTimezone: string
  onSuccess: () => void
  onCancel: () => void
}

export function BookingModal({
  package: pkg,
  teacherName,
  teacherTimezone,
  studentTimezone,
  onSuccess,
  onCancel
}: BookingModalProps) {
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedTime, setSelectedTime] = useState<string>('')
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

  // Calculate the selected datetime in student's timezone and convert to UTC/teacher's timezone
  const selectedDateTime = useMemo(() => {
    if (!selectedDate || !selectedTime) return null

    // Create ISO string in student's timezone, then convert to UTC
    const dateTimeString = `${selectedDate}T${selectedTime}:00`
    return fromZonedTime(dateTimeString, studentTimezone)
  }, [selectedDate, selectedTime, studentTimezone])

  // Format the selected time for display (what user picked - no conversion needed)
  const formattedStudentTime = useMemo(() => {
    if (!selectedTime) return null
    // Parse the HH:mm format and format as h:mm a
    return format(parse(selectedTime, 'HH:mm', new Date()), 'h:mm a')
  }, [selectedTime])

  // Format the UTC datetime in teacher's timezone for display
  const formattedTeacherTime = useMemo(() => {
    if (!selectedDateTime) return null
    // selectedDateTime is already UTC, just format it in teacher's timezone
    return formatInTimezone(selectedDateTime, teacherTimezone, 'h:mm a')
  }, [selectedDateTime, teacherTimezone])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedDate || !selectedTime) {
      setError('Please select a date and time')
      return
    }

    try {
      // Create ISO string in student's timezone, then convert to UTC for database storage
      const dateTimeString = `${selectedDate}T${selectedTime}:00`
      const scheduledAtUTC = fromZonedTime(dateTimeString, studentTimezone)

      // NOTE: Past date validation is disabled to allow testing with historical dates
      // In production, uncomment this to prevent booking lessons in the past:
      // if (isBefore(scheduledAtUTC, new Date())) {
      //   setError('Please select a future date and time')
      //   return
      // }

      await bookLesson.mutateAsync({
        packageId: pkg.id,
        teacherId: pkg.teacher_id,
        scheduledAt: scheduledAtUTC,
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
          {/* Timezone Booking Guide */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-2">
            <div className="flex items-start gap-2">
              <svg
                className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1 space-y-2">
                <p className="text-sm font-medium text-blue-900">
                  After Google Calendar Booking
                </p>
                <p className="text-sm text-blue-800">
                  Enter the <strong>same date and time</strong> you selected when booking on your teacher's Google Calendar.
                  Use your local time—we'll automatically show both your time and your teacher's time.
                </p>
                <div className="bg-white/50 rounded border border-blue-200 p-2 text-xs text-blue-700">
                  <strong>Example:</strong> If you booked for 3:00 PM on Google Calendar, enter 3:00 PM here.
                </div>
              </div>
            </div>
          </div>

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
          </div>

          {/* Dual Timezone Display */}
          {formattedStudentTime && formattedTeacherTime && selectedDateTime && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 space-y-1">
              <p className="text-sm text-blue-800">
                <span className="font-medium">Your time:</span>{' '}
                {formattedStudentTime}{' '}
                {getTimezoneAbbreviation(studentTimezone, selectedDateTime)}
              </p>
              <p className="text-sm text-blue-700">
                <span className="font-medium">Teacher's time:</span>{' '}
                {formattedTeacherTime}{' '}
                {getTimezoneAbbreviation(teacherTimezone, selectedDateTime)}
              </p>
            </div>
          )}

          {!formattedStudentTime && (
            <p className="text-xs text-slate-500">
              Times shown in your local timezone ({getTimezoneAbbreviation(studentTimezone)})
            </p>
          )}

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
