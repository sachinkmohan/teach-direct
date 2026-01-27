import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { TeacherLessonOffering } from '@/types/database'

interface DurationPricingEditorProps {
  offerings: TeacherLessonOffering[]
  onAdd: (duration: 30 | 45 | 60) => void
  onUpdate: (offering: TeacherLessonOffering) => void
  onToggleActive: (offeringId: string, isActive: boolean) => void
  onRemove: (offeringId: string) => void
  isLoading?: boolean
  error?: string | null
}

const DURATIONS: { value: 30 | 45 | 60; label: string }[] = [
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '60 minutes' },
]

export function DurationPricingEditor({
  offerings,
  onAdd,
  onUpdate,
  onToggleActive,
  onRemove,
  isLoading,
  error,
}: DurationPricingEditorProps) {
  const configuredDurations = offerings.map(o => o.duration_minutes)
  const availableDurations = DURATIONS.filter(d => !configuredDurations.includes(d.value))
  const activeOfferings = offerings.filter(o => o.is_active)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Lesson Durations & Pricing</h3>
        {availableDurations.length > 0 && (
          <div className="relative">
            <AddDurationDropdown
              availableDurations={availableDurations}
              onAdd={onAdd}
              disabled={isLoading}
            />
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {error}
        </div>
      )}

      {activeOfferings.length === 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
          You must have at least one active duration to be visible to students.
        </div>
      )}

      {offerings.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <p>No durations configured yet.</p>
          <p className="text-sm mt-1">Add a duration to set your pricing.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {offerings.map(offering => (
            <DurationOfferingCard
              key={offering.id}
              offering={offering}
              onUpdate={onUpdate}
              onToggleActive={onToggleActive}
              onRemove={onRemove}
              canRemove={offerings.length > 1 || !offering.is_active}
              isLoading={isLoading}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface AddDurationDropdownProps {
  availableDurations: { value: 30 | 45 | 60; label: string }[]
  onAdd: (duration: 30 | 45 | 60) => void
  disabled?: boolean
}

function AddDurationDropdown({ availableDurations, onAdd, disabled }: AddDurationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
      >
        + Add Duration
      </Button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-md shadow-lg z-20">
            {availableDurations.map(duration => (
              <button
                key={duration.value}
                type="button"
                className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 first:rounded-t-md last:rounded-b-md"
                onClick={() => {
                  onAdd(duration.value)
                  setIsOpen(false)
                }}
              >
                {duration.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Zod schema for offering price validation
const offeringPriceSchema = z.object({
  single_rate: z.coerce.number().min(1, 'Single rate must be at least €1'),
  package_5_rate: z
    .union([z.string().length(0), z.coerce.number().min(1, '5-class rate must be at least €1')])
    .transform(val => (val === '' ? undefined : val))
    .optional(),
  package_10_rate: z
    .union([z.string().length(0), z.coerce.number().min(1, '10-class rate must be at least €1')])
    .transform(val => (val === '' ? undefined : val))
    .optional(),
})

type OfferingPriceFormData = z.infer<typeof offeringPriceSchema>

interface DurationOfferingCardProps {
  offering: TeacherLessonOffering
  onUpdate: (offering: TeacherLessonOffering) => void
  onToggleActive: (offeringId: string, isActive: boolean) => void
  onRemove: (offeringId: string) => void
  canRemove: boolean
  isLoading?: boolean
}

function DurationOfferingCard({
  offering,
  onUpdate,
  onToggleActive,
  onRemove,
  canRemove,
  isLoading,
}: DurationOfferingCardProps) {
  const [isEditing, setIsEditing] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OfferingPriceFormData>({
    resolver: zodResolver(offeringPriceSchema),
    defaultValues: {
      single_rate: offering.single_rate,
      package_5_rate: offering.package_5_rate ?? undefined,
      package_10_rate: offering.package_10_rate ?? undefined,
    },
  })

  // Reset form when offering changes or editing starts
  useEffect(() => {
    if (isEditing) {
      reset({
        single_rate: offering.single_rate,
        package_5_rate: offering.package_5_rate ?? undefined,
        package_10_rate: offering.package_10_rate ?? undefined,
      })
    }
  }, [isEditing, offering, reset])

  const handleSaveClick = () => {
    handleSubmit((data) => {
      onUpdate({
        ...offering,
        single_rate: data.single_rate,
        package_5_rate: data.package_5_rate || null,
        package_10_rate: data.package_10_rate || null,
      })
      setIsEditing(false)
    })()
  }

  const handleCancelClick = () => {
    reset()
    setIsEditing(false)
  }

  const durationLabel = DURATIONS.find(d => d.value === offering.duration_minutes)?.label || `${offering.duration_minutes} minutes`

  return (
    <Card className={!offering.is_active ? 'opacity-60' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">{durationLabel}</CardTitle>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleActive(offering.id, !offering.is_active)}
              disabled={isLoading}
              className={`
                relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                ${offering.is_active ? 'bg-green-500' : 'bg-slate-300'}
                ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              title={offering.is_active ? 'Click to deactivate' : 'Click to activate'}
            >
              <span
                className={`
                  inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                  ${offering.is_active ? 'translate-x-6' : 'translate-x-1'}
                `}
              />
            </button>
            <span className="text-xs text-slate-500">
              {offering.is_active ? 'Active' : 'Inactive'}
            </span>
            {canRemove && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemove(offering.id)}
                disabled={isLoading}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 px-2"
              >
                Remove
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div
            className="space-y-3"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSaveClick()
              }
            }}
          >
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-700">Single Class *</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">€</span>
                  <Input
                    type="number"
                    step="0.01"
                    {...register('single_rate')}
                    className={`pl-7 ${errors.single_rate ? 'border-red-500' : ''}`}
                    placeholder="25.00"
                  />
                </div>
                {errors.single_rate && (
                  <p className="text-xs text-red-600 mt-1">{errors.single_rate.message}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">5-Class Package</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">€</span>
                  <Input
                    type="number"
                    step="0.01"
                    {...register('package_5_rate')}
                    className={`pl-7 ${errors.package_5_rate ? 'border-red-500' : ''}`}
                    placeholder="110.00"
                  />
                </div>
                {errors.package_5_rate && (
                  <p className="text-xs text-red-600 mt-1">{errors.package_5_rate.message}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">10-Class Package</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">€</span>
                  <Input
                    type="number"
                    step="0.01"
                    {...register('package_10_rate')}
                    className={`pl-7 ${errors.package_10_rate ? 'border-red-500' : ''}`}
                    placeholder="200.00"
                  />
                </div>
                {errors.package_10_rate && (
                  <p className="text-xs text-red-600 mt-1">{errors.package_10_rate.message}</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={handleCancelClick}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={handleSaveClick} disabled={isLoading}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="grid grid-cols-3 gap-4 text-sm flex-1">
              <div>
                <span className="text-slate-500">Single:</span>{' '}
                <span className="font-medium">€{offering.single_rate.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-500">5-Class:</span>{' '}
                {offering.package_5_rate ? (
                  <span className="font-medium">€{offering.package_5_rate.toFixed(2)}</span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </div>
              <div>
                <span className="text-slate-500">10-Class:</span>{' '}
                {offering.package_10_rate ? (
                  <span className="font-medium">€{offering.package_10_rate.toFixed(2)}</span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              disabled={isLoading}
            >
              Edit
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
