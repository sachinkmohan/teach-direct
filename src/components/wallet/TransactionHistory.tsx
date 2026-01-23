import { format } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Transaction } from '@/hooks/useTransactions'

interface TransactionHistoryProps {
  transactions: Transaction[]
  isLoading?: boolean
  userRole?: 'teacher' | 'student'
}

const typeLabels: Record<Transaction['type'], string> = {
  purchase: 'Package Purchase',
  lesson_payment: 'Lesson Payment',
  withdrawal: 'Withdrawal',
  refund: 'Refund',
}

const typeColors: Record<Transaction['type'], string> = {
  purchase: 'bg-blue-100 text-blue-800',
  lesson_payment: 'bg-green-100 text-green-800',
  withdrawal: 'bg-purple-100 text-purple-800',
  refund: 'bg-amber-100 text-amber-800',
}

const statusColors: Record<Transaction['status'], string> = {
  pending: 'text-amber-600',
  completed: 'text-green-600',
  failed: 'text-red-600',
}

export function TransactionHistory({ transactions, isLoading, userRole }: TransactionHistoryProps) {
  const getTransactionSign = (transaction: Transaction) => {
    // Withdrawals are always negative (money leaving)
    if (transaction.type === 'withdrawal') return '-'

    // Refunds are always positive (money returning)
    if (transaction.type === 'refund') return '+'

    // Purchases are always negative (money spent)
    if (transaction.type === 'purchase') return '-'

    // Lesson payments:
    // - For teachers: positive (money earned)
    // - For students: negative (money spent from package)
    if (transaction.type === 'lesson_payment') {
      return userRole === 'teacher' ? '+' : '-'
    }

    return '+'
  }
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>Your recent transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-slate-100 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!transactions || transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>Your recent transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 text-center py-8">
            No transactions yet
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
        <CardDescription>Your recent transactions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${typeColors[transaction.type]}`}
                >
                  {typeLabels[transaction.type]}
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {getTransactionSign(transaction)} $
                    {transaction.amount.toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {format(new Date(transaction.created_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span
                  className={`text-xs font-medium capitalize ${statusColors[transaction.status]}`}
                >
                  {transaction.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
