import { useMemo } from 'react'
import { format } from 'date-fns'
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz'

// Get user's local timezone
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

// Get timezone abbreviation (e.g., "PST", "EST")
export function getTimezoneAbbreviation(timezone: string, date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'short',
  })
  const parts = formatter.formatToParts(date)
  const tzPart = parts.find((part) => part.type === 'timeZoneName')
  return tzPart?.value || timezone
}

// Get timezone offset string (e.g., "GMT-8", "GMT+5:30")
export function getTimezoneOffset(timezone: string, date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'longOffset',
  })
  const parts = formatter.formatToParts(date)
  const tzPart = parts.find((part) => part.type === 'timeZoneName')
  return tzPart?.value || ''
}

// Format a date in a specific timezone
export function formatInTimezone(
  date: Date | string,
  timezone: string,
  formatStr: string = 'PPpp'
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return formatInTimeZone(dateObj, timezone, formatStr)
}

// Convert a date from one timezone to another
export function convertTimezone(
  date: Date | string,
  fromTimezone: string,
  toTimezone: string
): Date {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  // First convert to UTC from the source timezone, then to the target timezone
  const utcDate = fromZonedTime(dateObj, fromTimezone)
  return toZonedTime(utcDate, toTimezone)
}

// Get common timezone options for a dropdown
export function getCommonTimezones(): Array<{ value: string; label: string }> {
  const timezones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Anchorage',
    'Pacific/Honolulu',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Kolkata',
    'Asia/Dubai',
    'Australia/Sydney',
    'Pacific/Auckland',
  ]

  return timezones.map((tz) => ({
    value: tz,
    label: `${tz.replace(/_/g, ' ')} (${getTimezoneAbbreviation(tz)})`,
  }))
}

// Hook for timezone utilities
export function useTimezone() {
  const userTimezone = useMemo(() => getUserTimezone(), [])
  const timezoneAbbr = useMemo(() => getTimezoneAbbreviation(userTimezone), [userTimezone])
  const timezoneOffset = useMemo(() => getTimezoneOffset(userTimezone), [userTimezone])

  // Format a date/time showing local timezone
  const formatWithTimezone = (date: Date | string, formatStr: string = 'PPpp') => {
    return formatInTimezone(date, userTimezone, formatStr)
  }

  // Format just the time with timezone abbreviation
  const formatTimeWithTz = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return `${format(dateObj, 'h:mm a')} ${timezoneAbbr}`
  }

  // Format date and time with timezone
  const formatDateTimeWithTz = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return `${format(dateObj, 'EEEE, MMMM d, yyyy')} at ${format(dateObj, 'h:mm a')} ${timezoneAbbr}`
  }

  // Convert a local date/time to UTC for storage
  const toUTC = (date: Date) => {
    return fromZonedTime(date, userTimezone)
  }

  // Convert a UTC date to local timezone for display
  const toLocal = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return toZonedTime(dateObj, userTimezone)
  }

  return {
    userTimezone,
    timezoneAbbr,
    timezoneOffset,
    formatWithTimezone,
    formatTimeWithTz,
    formatDateTimeWithTz,
    toUTC,
    toLocal,
    getCommonTimezones,
  }
}
