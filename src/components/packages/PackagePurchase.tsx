import { useState } from 'react'
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

interface PackagePurchaseProps {
  teacherId: string
  teacherName: string
  packageType: 'single' | 'package_5' | 'package_10'
  price: number
  classes: number
  onSuccess: () => void
  onCancel: () => void
}

export function PackagePurchase({
  teacherId,
  teacherName,
  packageType,
  price,
  classes,
  onSuccess,
  onCancel,
}: PackagePurchaseProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setProcessing(true)
    setError(null)

    try {
      // Create payment intent
      const { data, error: functionError } = await supabase.functions.invoke('purchase-package', {
        body: {
          teacherId,
          packageType,
        },
      })

      console.log('Function response:', { data, error: functionError })

      if (functionError) {
        console.error('Function error details:', functionError)
        throw new Error(functionError.message || 'Failed to call Edge Function')
      }

      if (data?.error) {
        console.error('Edge Function returned error:', data.error)
        throw new Error(data.error)
      }

      if (!data?.clientSecret) {
        console.error('No client secret in response:', data)
        throw new Error('Failed to create payment intent')
      }

      // Confirm payment with Stripe
      const { error: paymentError, paymentIntent } = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
        },
      })

      if (paymentError) {
        throw new Error(paymentError.message)
      }

      // Create package record in database
      const { error: packageError } = await supabase.from('packages').insert({
        student_id: (await supabase.auth.getUser()).data.user?.id,
        teacher_id: teacherId,
        total_classes: classes,
        remaining_classes: classes,
        price_per_class: price / classes,
        total_amount: price,
        status: 'active',
      })

      if (packageError) {
        console.error('Failed to create package:', packageError)
        throw new Error('Payment successful but failed to create package. Please contact support.')
      }

      // Update transaction status to completed
      await supabase
        .from('transactions')
        .update({ status: 'completed' })
        .eq('stripe_payment_intent_id', data.paymentIntentId)

      // Success!
      onSuccess()
    } catch (err) {
      console.error('Payment error:', err)
      setError(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Purchase Package</CardTitle>
        <CardDescription>
          {classes} class{classes > 1 ? 'es' : ''} with {teacherName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-slate-600">Package Details</p>
            <div className="bg-slate-50 p-4 rounded-md space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Total Classes:</span>
                <span className="text-sm font-medium">{classes}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Price per Class:</span>
                <span className="text-sm font-medium">${(price / classes).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-medium">Total:</span>
                <span className="font-bold text-lg">${price.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Payment Method</label>
            <div className="border border-slate-200 rounded-md p-3">
              <CardElement
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#424770',
                      '::placeholder': {
                        color: '#aab7c4',
                      },
                    },
                    invalid: {
                      color: '#9e2146',
                    },
                  },
                }}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={processing}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!stripe || processing}
              className="flex-1"
            >
              {processing ? 'Processing...' : `Pay $${price.toFixed(2)}`}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
