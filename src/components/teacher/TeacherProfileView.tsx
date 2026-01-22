import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PricingDisplay } from './PricingDisplay'
import type { TeacherWithUser } from '@/hooks/useTeachers'

interface TeacherProfileViewProps {
  teacher: TeacherWithUser
  onPurchase?: (packageType: 'single' | '5' | '10') => void
}

export function TeacherProfileView({ teacher, onPurchase }: TeacherProfileViewProps) {
  const displayName = teacher.users?.display_name || teacher.users?.email?.split('@')[0] || 'Teacher'

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
          <PricingDisplay
            hourlyRate={teacher.hourly_rate}
            package5Rate={teacher.package_5_rate}
            package10Rate={teacher.package_10_rate}
            onPurchase={onPurchase}
            showPurchaseButtons={!!onPurchase}
          />
        </CardContent>
      </Card>
    </div>
  )
}
