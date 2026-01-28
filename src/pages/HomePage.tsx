import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function HomePage() {
  return (
    <div className="bg-slate-50">
      {/* Hero Section */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-5xl font-bold text-slate-900 mb-6">
              Learn Directly from Expert Teachers
            </h1>
            <p className="text-xl text-slate-600 mb-8">
              Connect with qualified teachers for personalized online lessons. Pay as you go, no subscriptions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/teachers">
                <Button size="lg">Find a Teacher</Button>
              </Link>
              <Link to="/signup">
                <Button size="lg" variant="outline">Become a Teacher</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>1. Browse Teachers</CardTitle>
                <CardDescription>
                  Search through our marketplace of qualified teachers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">
                  Filter by subject, language, price, and availability to find the perfect match for your learning goals.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>2. Purchase Packages</CardTitle>
                <CardDescription>
                  Buy lesson packages directly from teachers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">
                  Choose from 5 or 10 class packages. Your payment is held securely until after each lesson.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>3. Book & Learn</CardTitle>
                <CardDescription>
                  Schedule lessons and start learning
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600">
                  Book lessons at your convenience, meet online via Google Meet, and track your progress.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-slate-900 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Learning?</h2>
          <p className="text-xl text-slate-300 mb-8">
            Join thousands of students learning with Learn From A Tutor
          </p>
          <Link to="/signup">
            <Button size="lg" variant="outline" className="bg-white text-slate-900 hover:bg-slate-100">
              Get Started Free
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
