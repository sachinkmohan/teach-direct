import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTeacherProfile } from '@/hooks/useTeachers'
import { useUserProfile } from '@/hooks/useUser'
import { useMyTeacherOfferings, useUpsertOffering, useToggleOfferingActive, useDeleteOffering } from '@/hooks/useTeacherOfferings'
import { DurationPricingEditor } from '@/components/teacher/DurationPricingEditor'
import { supabase } from '@/lib/supabase'
import type { TeacherLessonOffering } from '@/types/database'

const teacherProfileSchema = z.object({
  display_name: z.string().min(2, 'Display name must be at least 2 characters'),
  bio: z.string().min(50, 'Bio must be at least 50 characters'),
  subjects: z.string().min(1, 'Enter at least one subject'),
  languages: z.string().min(1, 'Enter at least one language'),
})

// Input type for form fields (what the form sees)
type TeacherProfileFormInput = z.input<typeof teacherProfileSchema>
// Output type after validation (what onSubmit receives)
type TeacherProfileFormData = z.output<typeof teacherProfileSchema>

export function TeacherOnboardingPage() {
  const navigate = useNavigate()
  const { data: userProfile, isLoading: userLoading } = useUserProfile()
  const { data: teacherProfile, isLoading: profileLoading } = useTeacherProfile()
  const { data: offerings = [], isLoading: offeringsLoading } = useMyTeacherOfferings()
  const upsertOffering = useUpsertOffering()
  const toggleOfferingActive = useToggleOfferingActive()
  const deleteOffering = useDeleteOffering()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offeringError, setOfferingError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<TeacherProfileFormInput, unknown, TeacherProfileFormData>({
    resolver: zodResolver(teacherProfileSchema),
  })

  useEffect(() => {
    if (teacherProfile && userProfile) {
      reset({
        display_name: userProfile.display_name || '',
        bio: teacherProfile.bio || '',
        subjects: teacherProfile.subjects?.join(', ') || '',
        languages: teacherProfile.languages?.join(', ') || '',
      })
    }
  }, [teacherProfile, userProfile, reset])

  const onSubmit = async (data: TeacherProfileFormData) => {
    // Validate that at least one active offering exists
    const activeOfferings = offerings.filter(o => o.is_active)
    if (activeOfferings.length === 0) {
      setOfferingError('You must have at least one active duration with pricing to save your profile.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Update user display name
      const { error: userError } = await supabase
        .from('users')
        .update({ display_name: data.display_name })
        .eq('id', user.id)

      if (userError) throw userError

      // Parse subjects and languages
      const subjects = data.subjects.split(',').map((s) => s.trim()).filter(Boolean)
      const languages = data.languages.split(',').map((l) => l.trim()).filter(Boolean)

      // Get the first active offering to set legacy hourly_rate for backward compatibility
      const primaryOffering = activeOfferings[0]

      // Upsert teacher profile
      const { error: profileError } = await supabase
        .from('teacher_profiles')
        .upsert({
          user_id: user.id,
          bio: data.bio,
          subjects,
          languages,
          // Set legacy fields from primary offering for backward compatibility
          hourly_rate: primaryOffering.single_rate,
          package_5_rate: primaryOffering.package_5_rate,
          package_10_rate: primaryOffering.package_10_rate,
          stripe_connect_status: 'pending',
          available_balance: 0,
          pending_balance: 0,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        })

      if (profileError) throw profileError

      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddDuration = async (duration: 30 | 45 | 60) => {
    setOfferingError(null)
    try {
      await upsertOffering.mutateAsync({
        duration_minutes: duration,
        single_rate: duration === 30 ? 15 : duration === 45 ? 20 : 25, // Default rates
        is_active: true,
      })
    } catch (err) {
      setOfferingError(err instanceof Error ? err.message : 'Failed to add duration')
    }
  }

  const handleUpdateOffering = async (offering: TeacherLessonOffering) => {
    setOfferingError(null)
    try {
      await upsertOffering.mutateAsync({
        duration_minutes: offering.duration_minutes,
        single_rate: offering.single_rate,
        package_5_rate: offering.package_5_rate,
        package_10_rate: offering.package_10_rate,
        is_active: offering.is_active,
        display_order: offering.display_order,
      })
    } catch (err) {
      setOfferingError(err instanceof Error ? err.message : 'Failed to update offering')
    }
  }

  const handleToggleActive = async (offeringId: string, isActive: boolean) => {
    setOfferingError(null)
    // Prevent deactivating the last active offering
    const activeOfferings = offerings.filter(o => o.is_active)
    if (!isActive && activeOfferings.length === 1 && activeOfferings[0].id === offeringId) {
      setOfferingError('You must have at least one active duration.')
      return
    }
    try {
      await toggleOfferingActive.mutateAsync({ offeringId, isActive })
    } catch (err) {
      setOfferingError(err instanceof Error ? err.message : 'Failed to update offering')
    }
  }

  const handleRemoveOffering = async (offeringId: string) => {
    setOfferingError(null)
    // Prevent removing the last offering
    if (offerings.length === 1) {
      setOfferingError('You must have at least one duration configured.')
      return
    }
    try {
      await deleteOffering.mutateAsync(offeringId)
    } catch (err) {
      setOfferingError(err instanceof Error ? err.message : 'Failed to remove offering')
    }
  }

  if (userLoading || profileLoading || offeringsLoading) {
    return (
      <div className="bg-slate-50 min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    )
  }

  if (userProfile?.role !== 'teacher') {
    return (
      <div className="bg-slate-50 min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-slate-600">Only teachers can access this page.</p>
            <Button onClick={() => navigate('/dashboard')} className="mt-4">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-4rem)] py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Set Up Your Teacher Profile</CardTitle>
            <CardDescription>
              Complete your profile to start accepting students
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="display_name" className="text-sm font-medium text-slate-700">
                  Display Name
                </label>
                <Input id="display_name" placeholder="Your name" {...register('display_name')} />
                {errors.display_name && (
                  <p className="text-sm text-red-600">{errors.display_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="bio" className="text-sm font-medium text-slate-700">
                  Bio
                </label>
                <textarea
                  id="bio"
                  rows={4}
                  className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                  placeholder="Tell students about yourself, your experience, and teaching style..."
                  {...register('bio')}
                />
                {errors.bio && (
                  <p className="text-sm text-red-600">{errors.bio.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="subjects" className="text-sm font-medium text-slate-700">
                  Subjects (comma-separated)
                </label>
                <Input
                  id="subjects"
                  placeholder="e.g., Mathematics, Physics, Chemistry"
                  {...register('subjects')}
                />
                {errors.subjects && (
                  <p className="text-sm text-red-600">{errors.subjects.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="languages" className="text-sm font-medium text-slate-700">
                  Languages (comma-separated)
                </label>
                <Input
                  id="languages"
                  placeholder="e.g., English, Spanish, Mandarin"
                  {...register('languages')}
                />
                {errors.languages && (
                  <p className="text-sm text-red-600">{errors.languages.message}</p>
                )}
              </div>

              <div className="border-t pt-6">
                <DurationPricingEditor
                  offerings={offerings}
                  onAdd={handleAddDuration}
                  onUpdate={handleUpdateOffering}
                  onToggleActive={handleToggleActive}
                  onRemove={handleRemoveOffering}
                  isLoading={upsertOffering.isPending || toggleOfferingActive.isPending || deleteOffering.isPending}
                  error={offeringError}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Profile'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
