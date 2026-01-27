import { useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  useAdminLessons,
  useApproveLesson,
  useBatchApproveLesson,
} from '@/hooks/useAdminLessons'

export function AdminDashboardPage() {
  const { data: lessons, isLoading, error } = useAdminLessons()
  const approveLesson = useApproveLesson()
  const batchApprove = useBatchApproveLesson()
  const [selectedLessons, setSelectedLessons] = useState<Set<string>>(new Set())
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const handleSelectLesson = (lessonId: string) => {
    setSelectedLessons((prev) => {
      const next = new Set(prev)
      if (next.has(lessonId)) {
        next.delete(lessonId)
      } else {
        next.add(lessonId)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (!lessons) return
    if (selectedLessons.size === lessons.length) {
      setSelectedLessons(new Set())
    } else {
      setSelectedLessons(new Set(lessons.map((l) => l.id)))
    }
  }

  const handleApprove = async (lessonId: string) => {
    setApprovingId(lessonId)
    try {
      await approveLesson.mutateAsync(lessonId)
      setSelectedLessons((prev) => {
        const next = new Set(prev)
        next.delete(lessonId)
        return next
      })
    } catch (err) {
      console.error('Failed to approve lesson:', err)
    } finally {
      setApprovingId(null)
    }
  }

  const handleBatchApprove = async () => {
    if (selectedLessons.size === 0) return
    try {
      await batchApprove.mutateAsync(Array.from(selectedLessons))
      setSelectedLessons(new Set())
    } catch (err) {
      console.error('Failed to batch approve lessons:', err)
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
            <p className="text-slate-600">Loading pending lessons...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-red-600">
          <p>Error loading lessons: {error.message}</p>
        </div>
      </div>
    )
  }

  const pendingCount = lessons?.length || 0
  const totalAmount = lessons?.reduce(
    (sum, l) => sum + (l.package?.price_per_class || 0) * 0.9,
    0
  ) || 0

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{pendingCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Total Payout Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalAmount.toFixed(2)} EUR</p>
            <p className="text-xs text-slate-500">(90% teacher share)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Selected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{selectedLessons.size}</p>
          </CardContent>
        </Card>
      </div>

      {/* Batch Actions */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" onClick={handleSelectAll}>
            {selectedLessons.size === pendingCount ? 'Deselect All' : 'Select All'}
          </Button>
          {selectedLessons.size > 0 && (
            <Button
              onClick={handleBatchApprove}
              disabled={batchApprove.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {batchApprove.isPending
                ? `Approving ${selectedLessons.size}...`
                : `Approve Selected (${selectedLessons.size})`}
            </Button>
          )}
        </div>
      )}

      {/* Lessons Table */}
      {pendingCount === 0 ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-slate-500">
              No lessons awaiting approval.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
                  <input
                    type="checkbox"
                    checked={selectedLessons.size === pendingCount}
                    onChange={handleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
                  Teacher
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
                  Student
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
                  Teacher Payout
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lessons?.map((lesson) => {
                const pricePerClass = lesson.package?.price_per_class || 0
                const teacherPayout = pricePerClass * 0.9
                const isApproving = approvingId === lesson.id

                return (
                  <tr key={lesson.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedLessons.has(lesson.id)}
                        onChange={() => handleSelectLesson(lesson.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {format(new Date(lesson.scheduled_at), 'MMM d, yyyy h:mm a')}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {lesson.teacher?.display_name || lesson.teacher?.email || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {lesson.student?.display_name || lesson.student?.email || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {pricePerClass.toFixed(2)} EUR
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-green-600">
                      {teacherPayout.toFixed(2)} EUR
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(lesson.id)}
                        disabled={isApproving || batchApprove.isPending}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {isApproving ? 'Approving...' : 'Approve'}
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Error/Success Messages */}
      {approveLesson.isError && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded text-red-600">
          {approveLesson.error.message}
        </div>
      )}
      {batchApprove.isError && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded text-red-600">
          {batchApprove.error.message}
        </div>
      )}
      {approveLesson.isSuccess && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded text-green-600">
          Lesson approved and payment transferred successfully.
        </div>
      )}
      {batchApprove.isSuccess && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded text-green-600">
          Batch approval completed. Check individual results for details.
        </div>
      )}
    </div>
  )
}
