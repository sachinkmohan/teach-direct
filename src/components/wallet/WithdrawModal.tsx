import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface WithdrawModalProps {
  availableBalance: number
  onSubmit: (amount: number) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

const MIN_WITHDRAWAL_AMOUNT = 10

export function WithdrawModal({ availableBalance, onSubmit, onCancel, isLoading }: WithdrawModalProps) {
  const [amount, setAmount] = useState('')
  const [error, setError] = useState<string | null>(null)

  const numericAmount = parseFloat(amount) || 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!amount || numericAmount <= 0) {
      setError('Please enter a valid amount')
      return
    }

    if (numericAmount < MIN_WITHDRAWAL_AMOUNT) {
      setError(`Minimum withdrawal amount is $${MIN_WITHDRAWAL_AMOUNT}`)
      return
    }

    if (numericAmount > availableBalance) {
      setError(`Amount exceeds available balance of $${availableBalance.toFixed(2)}`)
      return
    }

    try {
      await onSubmit(numericAmount)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process withdrawal')
    }
  }

  const handleMaxClick = () => {
    // Round down to 2 decimal places
    setAmount(Math.floor(availableBalance * 100) / 100 + '')
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Allow only numbers and one decimal point
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setAmount(value)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Withdraw Funds</CardTitle>
        <CardDescription>
          Transfer earnings to your connected bank account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Available Balance */}
          <div className="p-4 bg-slate-50 rounded-md">
            <p className="text-sm text-slate-600">Available Balance</p>
            <p className="text-2xl font-bold text-slate-900">
              ${availableBalance.toFixed(2)}
            </p>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Withdrawal Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                $
              </span>
              <Input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0.00"
                className="pl-7 pr-16"
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleMaxClick}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 text-xs"
                disabled={isLoading}
              >
                Max
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Minimum withdrawal: ${MIN_WITHDRAWAL_AMOUNT}
            </p>
          </div>

          {/* Info */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
            <p>
              Funds will be transferred to your connected Stripe account. Transfers
              typically arrive within 2-3 business days.
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
              disabled={isLoading || numericAmount < MIN_WITHDRAWAL_AMOUNT || numericAmount > availableBalance}
              className="flex-1"
            >
              {isLoading ? 'Processing...' : `Withdraw $${numericAmount.toFixed(2)}`}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
