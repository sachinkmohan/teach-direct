import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PricingDisplay } from './PricingDisplay'
import { DurationSelector } from './DurationSelector'
import type { TeacherWithUser } from '@/hooks/useTeachers'
import type { TeacherLessonOffering } from '@/types/database'

interface TeacherProfileViewProps {
  teacher: TeacherWithUser
  offerings?: TeacherLessonOffering[]
  selectedDuration?: number | null
  onDurationSelect?: (duration: number) => void
  onPurchase?: (packageType: 'single' | '5' | '10', durationMinutes: number) => void
}

/**
 * Render a teacher profile view with header, bio, and pricing controls.
 *
 * Shows teacher identity (name, email, subjects, languages), an about section, and pricing information.
 * When lesson offerings are provided the component prefers offering-based rates and can render a duration selector;
 * otherwise it falls back to legacy teacher rates (defaulting to a 30-minute duration).
 *
 * @param teacher - Teacher record (includes user info, bio, subjects, languages, and legacy rates)
 * @param offerings - Optional list of lesson offerings that provide duration-specific rates; defaults to an empty array
 * @param selectedDuration - Currently selected offering duration in minutes, or `null`/`undefined` when none is selected
 * @param onDurationSelect - Optional callback invoked with a duration (minutes) when the user selects a different offering
 * @param onPurchase - Optional callback invoked when a purchase action occurs; called with `(packageType, durationMinutes)`
 * @returns A React element containing the teacher profile UI
 */
export function TeacherProfileView({
  teacher,
  offerings = [],
  selectedDuration,
  onDurationSelect,
  onPurchase,
}: TeacherProfileViewProps) {
  const displayName = teacher.users?.display_name || teacher.users?.email?.split('@')[0] || 'Teacher'

  // Find the selected offering or use legacy pricing
  const selectedOffering = offerings.find(o => o.duration_minutes === selectedDuration)

  // Determine pricing to display - use offering if available, otherwise fall back to legacy fields
  const pricingToShow = selectedOffering
    ? {
        hourlyRate: selectedOffering.single_rate,
        package5Rate: selectedOffering.package_5_rate,
        package10Rate: selectedOffering.package_10_rate,
        durationMinutes: selectedOffering.duration_minutes,
      }
    : {
        hourlyRate: teacher.hourly_rate,
        package5Rate: teacher.package_5_rate,
        package10Rate: teacher.package_10_rate,
        durationMinutes: 30, // Default for legacy
      }

  const handlePurchase = (packageType: 'single' | '5' | '10') => {
    if (onPurchase) {
      onPurchase(packageType, pricingToShow.durationMinutes)
    }
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-start gap-6">
            <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center text-4xl font-bold text-slate-600 flex-shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-slate-900">{displayName}</h1>
              <p className="text-slate-500 mt-1">{teacher.users?.email}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {teacher.subjects?.map((subject) => (
                  <span
                    key={subject}
                    className="px-3 py-1 bg-slate-900 text-white text-sm rounded-full"
                  >
                    {subject}
                  </span>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {teacher.languages?.map((lang) => (
                  <span
                    key={lang}
                    className="px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded-full"
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bio */}
      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-600 whitespace-pre-wrap">
            {teacher.bio || 'This teacher has not added a bio yet.'}
          </p>
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Duration Selector - only show if multiple offerings available */}
          {offerings.length > 0 && onDurationSelect && (
            <DurationSelector
              offerings={offerings}
              selectedDuration={selectedDuration ?? null}
              onSelect={onDurationSelect}
            />
          )}

          {/* Show duration label if using offerings */}
          {selectedOffering && offerings.length === 1 && (
            <div className="mb-4 text-sm text-slate-500">
              Lesson duration: <span className="font-medium text-slate-900">{selectedOffering.duration_minutes} minutes</span>
            </div>
          )}

          <PricingDisplay
            hourlyRate={pricingToShow.hourlyRate}
            package5Rate={pricingToShow.package5Rate}
            package10Rate={pricingToShow.package10Rate}
            onPurchase={onPurchase ? handlePurchase : undefined}
            showPurchaseButtons={!!onPurchase}
          />
        </CardContent>
      </Card>
    </div>
  )
}