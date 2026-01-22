import { useState } from 'react'
import { useTeachers } from '@/hooks/useTeachers'
import { TeacherCard } from '@/components/teacher'
import { Input } from '@/components/ui/input'

export function TeachersPage() {
  const [subjectFilter, setSubjectFilter] = useState('')
  const [languageFilter, setLanguageFilter] = useState('')

  const { data: teachers, isLoading, error } = useTeachers({
    subject: subjectFilter || undefined,
    language: languageFilter || undefined,
  })

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-4rem)]">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Find Teachers</h1>
          <p className="text-slate-600 mt-2">Browse our marketplace of qualified teachers</p>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-slate-700 mb-1">
                Subject
              </label>
              <Input
                id="subject"
                placeholder="e.g., Mathematics, English"
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="language" className="block text-sm font-medium text-slate-700 mb-1">
                Language
              </label>
              <Input
                id="language"
                placeholder="e.g., English, Spanish"
                value={languageFilter}
                onChange={(e) => setLanguageFilter(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Teachers Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
            <p className="text-slate-600">Loading teachers...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600">Error loading teachers. Please try again.</p>
          </div>
        ) : teachers && teachers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teachers.map((teacher) => (
              <TeacherCard key={teacher.id} teacher={teacher} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg">
            <p className="text-slate-600 text-lg">No teachers found matching your criteria.</p>
            <p className="text-slate-500 mt-2">Try adjusting your filters or check back later.</p>
          </div>
        )}
      </div>
    </div>
  )
}
