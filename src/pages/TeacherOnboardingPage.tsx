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
import { supabase } from '@/lib/supabase'

const teacherProfileSchema = z.object({
  display_name: z.string().min(2, 'Display name must be at least 2 characters'),
  bio: z.string().min(50, 'Bio must be at least 50 characters'),
  subjects: z.string().min(1, 'Enter at least one subject'),
  languages: z.string().min(1, 'Enter at least one language'),
  hourly_rate: z.string().min(1, 'Hourly rate is required').transform((val) => {
    const num = Number(val)
    if (isNaN(num)) throw new Error('Must be a number')
    if (num < 5) throw new Error('Minimum rate is $5')
    if (num > 500) throw new Error('Maximum rate is $500')
    return num
  }),
  package_5_rate: z.string().optional().transform((val) => {
    if (!val || val === '') return undefined
    const num = Number(val)
    if (isNaN(num)) throw new Error('Must be a number')
    if (num < 20) throw new Error('Minimum is $20')
    return num
  }),
  package_10_rate: z.string().optional().transform((val) => {
    if (!val || val === '') return undefined
    const num = Number(val)
    if (isNaN(num)) throw new Error('Must be a number')
    if (num < 40) throw new Error('Minimum is $40')
    return num
  }),
})

// Input type for form fields (what the form sees)
type TeacherProfileFormInput = z.input<typeof teacherProfileSchema>
// Output type after validation (what onSubmit receives)
type TeacherProfileFormData = z.output<typeof teacherProfileSchema>

export function TeacherOnboardingPage() {
  const navigate = useNavigate()
  const { data: userProfile, isLoading: userLoading } = useUserProfile()
  const { data: teacherProfile, isLoading: profileLoading } = useTeacherProfile()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        hourly_rate: teacherProfile.hourly_rate?.toString() || '',
        package_5_rate: teacherProfile.package_5_rate?.toString() || '',
        package_10_rate: teacherProfile.package_10_rate?.toString() || '',
      })
    }
  }, [teacherProfile, userProfile, reset])

  const onSubmit = async (data: TeacherProfileFormData) => {
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

      // Upsert teacher profile
      const { error: profileError } = await supabase
        .from('teacher_profiles')
        .upsert({
          user_id: user.id,
          bio: data.bio,
          subjects,
          languages,
          hourly_rate: data.hourly_rate,
          package_5_rate: data.package_5_rate ?? null,
          package_10_rate: data.package_10_rate ?? null,
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

  if (userLoading || profileLoading) {
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
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Pricing</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="hourly_rate" className="text-sm font-medium text-slate-700">
                      Hourly Rate ($) *
                    </label>
                    <Input
                      id="hourly_rate"
                      type="number"
                      step="0.01"
                      placeholder="25.00"
                      {...register('hourly_rate')}
                    />
                    {errors.hourly_rate && (
                      <p className="text-sm text-red-600">{errors.hourly_rate.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="package_5_rate" className="text-sm font-medium text-slate-700">
                      5-Class Package ($)
                    </label>
                    <Input
                      id="package_5_rate"
                      type="number"
                      step="0.01"
                      placeholder="110.00"
                      {...register('package_5_rate')}
                    />
                    {errors.package_5_rate && (
                      <p className="text-sm text-red-600">{errors.package_5_rate.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="package_10_rate" className="text-sm font-medium text-slate-700">
                      10-Class Package ($)
                    </label>
                    <Input
                      id="package_10_rate"
                      type="number"
                      step="0.01"
                      placeholder="200.00"
                      {...register('package_10_rate')}
                    />
                    {errors.package_10_rate && (
                      <p className="text-sm text-red-600">{errors.package_10_rate.message}</p>
                    )}
                  </div>
                </div>
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
