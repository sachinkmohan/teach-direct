import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface PricingDisplayProps {
  hourlyRate: number | null
  package5Rate: number | null
  package10Rate: number | null
  onPurchase?: (packageType: 'single' | '5' | '10') => void
  showPurchaseButtons?: boolean
}

export function PricingDisplay({
  hourlyRate,
  package5Rate,
  package10Rate,
  onPurchase,
  showPurchaseButtons = true,
}: PricingDisplayProps) {
  const packages = [
    {
      type: 'single' as const,
      name: 'Single Class',
      classes: 1,
      rate: hourlyRate,
      perClass: hourlyRate,
    },
    {
      type: '5' as const,
      name: '5-Class Package',
      classes: 5,
      rate: package5Rate,
      perClass: package5Rate ? package5Rate / 5 : null,
      savings: hourlyRate && package5Rate ? ((hourlyRate * 5 - package5Rate) / (hourlyRate * 5) * 100).toFixed(0) : null,
    },
    {
      type: '10' as const,
      name: '10-Class Package',
      classes: 10,
      rate: package10Rate,
      perClass: package10Rate ? package10Rate / 10 : null,
      savings: hourlyRate && package10Rate ? ((hourlyRate * 10 - package10Rate) / (hourlyRate * 10) * 100).toFixed(0) : null,
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {packages.map((pkg) => (
        <Card key={pkg.type} className={pkg.type === '5' ? 'border-slate-900' : ''}>
          <CardHeader>
            <CardTitle className="text-lg">{pkg.name}</CardTitle>
            {pkg.savings && (
              <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                Save {pkg.savings}%
              </span>
            )}
          </CardHeader>
          <CardContent>
            {pkg.rate ? (
              <>
                <p className="text-3xl font-bold text-slate-900">
                  ${pkg.rate.toFixed(2)}
                </p>
                <p className="text-sm text-slate-500">
                  ${pkg.perClass?.toFixed(2)} per class
                </p>
                {showPurchaseButtons && onPurchase && (
                  <Button
                    onClick={() => onPurchase(pkg.type)}
                    className="w-full mt-4"
                    variant={pkg.type === '5' ? 'default' : 'outline'}
                  >
                    Purchase
                  </Button>
                )}
              </>
            ) : (
              <p className="text-slate-500">Not available</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
