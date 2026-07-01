import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTeacherPackages } from '@/hooks/usePackages'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'

export function TeacherStudentsView() {
  const { data: packages, isLoading } = useTeacherPackages()
  const [studentNames, setStudentNames] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!packages || packages.length === 0) return
    let cancelled = false

    const studentIds = [...new Set(packages.map(p => p.student_id))]
    supabase
      .from('users')
      .select('id, display_name, email')
      .in('id', studentIds)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Failed to fetch student data:', error)
          return
        }
        if (!data) return
        const names: Record<string, string> = {}
        data.forEach(u => { names[u.id] = u.display_name || u.email })
        setStudentNames(names)
      })

    return () => { cancelled = true }
  }, [packages])

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Students</CardTitle>
        <CardDescription>Active packages with remaining lessons</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-slate-500 text-sm">Loading...</p>
        ) : !packages || packages.length === 0 ? (
          <p className="text-slate-600">No active student packages</p>
        ) : (
          <div className="space-y-4">
            {packages.map(pkg => {
              const usedClasses = pkg.total_classes - pkg.remaining_classes
              const progressPercent = (usedClasses / pkg.total_classes) * 100
              const studentName = studentNames[pkg.student_id] || '...'

              return (
                <div key={pkg.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-slate-900 text-lg">{studentName}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Purchased {format(new Date(pkg.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-blue-600">
                      {pkg.remaining_classes} left
                    </span>
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span>{usedClasses} used</span>
                      <span>{pkg.remaining_classes} / {pkg.total_classes} remaining</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div>
                      <p className="text-slate-500 text-xs">Duration</p>
                      <p className="font-medium text-slate-900">{pkg.duration_minutes} min</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Total Classes</p>
                      <p className="font-medium text-slate-900">{pkg.total_classes}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Price per Class</p>
                      <p className="font-medium text-slate-900">€{pkg.price_per_class.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs">Total Paid</p>
                      <p className="font-medium text-slate-900">€{pkg.total_amount.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
