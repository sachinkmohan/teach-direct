import type { TeacherLessonOffering } from '@/types/database'

interface DurationSelectorProps {
  offerings: TeacherLessonOffering[]
  selectedDuration: number | null
  onSelect: (duration: number) => void
}

/**
 * Render a lesson-duration selector UI based on available offerings.
 *
 * Renders nothing if there are no offerings, a single-line duration display if exactly one offering exists, or a button group allowing selection when multiple offerings are provided.
 *
 * @param offerings - Available lesson offerings; each provides an `id` and `duration_minutes`
 * @param selectedDuration - Currently selected duration in minutes, or `null` when none is selected
 * @param onSelect - Callback invoked with the chosen duration in minutes when a duration button is clicked
 * @returns A React element that renders the duration selector UI, or `null` if there are no offerings
 */
export function DurationSelector({
  offerings,
  selectedDuration,
  onSelect,
}: DurationSelectorProps) {
  if (offerings.length === 0) {
    return null
  }

  // If only one duration available, don't show selector
  if (offerings.length === 1) {
    return (
      <div className="mb-4 text-sm text-slate-500">
        Lesson duration: <span className="font-medium text-slate-900">{offerings[0].duration_minutes} minutes</span>
      </div>
    )
  }

  return (
    <div className="mb-6">
      <label className="text-sm font-medium text-slate-700 mb-2 block">
        Choose Lesson Duration
      </label>
      <div className="flex flex-wrap gap-2">
        {offerings.map((offering) => {
          const isSelected = selectedDuration === offering.duration_minutes
          return (
            <button
              key={offering.id}
              type="button"
              onClick={() => onSelect(offering.duration_minutes)}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${isSelected
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }
              `}
            >
              {offering.duration_minutes} min
            </button>
          )
        })}
      </div>
    </div>
  )
}