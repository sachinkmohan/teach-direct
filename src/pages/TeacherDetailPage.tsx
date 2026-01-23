import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Elements } from '@stripe/react-stripe-js'
import { useTeacher } from '@/hooks/useTeachers'
import { TeacherProfileView } from '@/components/teacher'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { stripePromise } from '@/lib/stripe'
import { PackagePurchase } from '@/components/packages/PackagePurchase'

export function TeacherDetailPage() {
  const { teacherId } = useParams<{ teacherId: string }>()
  const { data: teacher, isLoading, error } = useTeacher(teacherId || '')
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [purchaseModal, setPurchaseModal] = useState<{
    type: 'single' | 'package_5' | 'package_10'
    price: number
    classes: number
  } | null>(null)

  const handlePurchase = (packageType: 'single' | '5' | '10') => {
    if (!teacher) return

    let type: 'single' | 'package_5' | 'package_10'
    let price: number
    let classes: number

    if (packageType === 'single') {
      type = 'single'
      price = teacher.hourly_rate || 0
      classes = 1
    } else if (packageType === '5') {
      type = 'package_5'
      price = teacher.package_5_rate || 0
      classes = 5
    } else {
      type = 'package_10'
      price = teacher.package_10_rate || 0
      classes = 10
    }

    setPurchaseModal({ type, price, classes })
  }

  const handlePurchaseSuccess = () => {
    setPurchaseModal(null)
    navigate('/dashboard', {
      state: { message: 'Package purchased successfully!' }
    })
  }

  const handlePurchaseCancel = () => {
    setPurchaseModal(null)
  }

  if (isLoading) {
    return (
      <div className="bg-slate-50 min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading teacher profile...</p>
        </div>
      </div>
    )
  }

  if (error || !teacher) {
    return (
      <div className="bg-slate-50 min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg">Teacher not found</p>
          <Link to="/teachers">
            <Button className="mt-4">Back to Teachers</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-4rem)]">
      <div className="container mx-auto px-4 py-8">
        <Link to="/teachers" className="inline-flex items-center text-slate-600 hover:text-slate-900 mb-6">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Teachers
        </Link>

        <TeacherProfileView
          teacher={teacher}
          onPurchase={isAuthenticated ? handlePurchase : undefined}
        />

        {!isAuthenticated && (
          <div className="mt-6 bg-white p-6 rounded-lg shadow-sm text-center">
            <p className="text-slate-600 mb-4">Log in to purchase a package from this teacher</p>
            <Link to="/login">
              <Button>Log In to Purchase</Button>
            </Link>
          </div>
        )}
      </div>

      {/* Purchase Modal */}
      {purchaseModal && teacher && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Elements stripe={stripePromise}>
            <PackagePurchase
              teacherId={teacher.user_id}
              teacherName={teacher.users?.display_name || teacher.users?.email || 'Teacher'}
              packageType={purchaseModal.type}
              price={purchaseModal.price}
              classes={purchaseModal.classes}
              onSuccess={handlePurchaseSuccess}
              onCancel={handlePurchaseCancel}
            />
          </Elements>
        </div>
      )}
    </div>
  )
}
