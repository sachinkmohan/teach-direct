import { Link } from 'react-router-dom'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { TeacherWithUser } from '@/hooks/useTeachers'

interface TeacherCardProps {
  teacher: TeacherWithUser
}

export function TeacherCard({ teacher }: TeacherCardProps) {
  const displayName = teacher.users?.display_name || teacher.users?.email?.split('@')[0] || 'Teacher'

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-2xl font-bold text-slate-600">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{displayName}</h3>
            <p className="text-sm text-slate-500">
              {teacher.subjects?.slice(0, 2).join(', ')}
              {teacher.subjects?.length > 2 && ` +${teacher.subjects.length - 2} more`}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600 line-clamp-3">
          {teacher.bio || 'No bio available'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {teacher.languages?.slice(0, 3).map((lang) => (
            <span
              key={lang}
              className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-full"
            >
              {lang}
            </span>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <div>
          <p className="text-lg font-bold text-slate-900">
            ${teacher.hourly_rate?.toFixed(2)}/hr
          </p>
          {teacher.package_5_rate && (
            <p className="text-xs text-slate-500">
              5-class: ${teacher.package_5_rate?.toFixed(2)}
            </p>
          )}
        </div>
        <Link to={`/teachers/${teacher.user_id}`}>
          <Button>View Profile</Button>
        </Link>
      </CardFooter>
    </Card>
  )
}
