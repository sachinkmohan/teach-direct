import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface DisputeModalProps {
  lessonId: string
  onSubmit: (lessonId: string, reason: string) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export function DisputeModal({ lessonId, onSubmit, onCancel, isLoading }: DisputeModalProps) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!reason.trim()) {
      setError('Please provide a reason for the dispute')
      return
    }

    if (reason.trim().length < 10) {
      setError('Please provide a more detailed reason (at least 10 characters)')
      return
    }

    try {
      await onSubmit(lessonId, reason.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit dispute')
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Dispute Lesson</CardTitle>
        <CardDescription>
          Please describe the issue with this lesson
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Warning */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
            <p className="font-medium">Important:</p>
            <p className="mt-1">
              Filing a dispute will pause the automatic fund release. Our team will
              review your case and reach out to both parties for resolution.
            </p>
          </div>

          {/* Reason Textarea */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Reason for dispute
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please describe what happened..."
              className="flex min-h-[120px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
              disabled={isLoading}
            />
            <p className="text-xs text-slate-500">
              Be specific about what happened during the lesson
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-amber-600 hover:bg-amber-700"
            >
              {isLoading ? 'Submitting...' : 'Submit Dispute'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
