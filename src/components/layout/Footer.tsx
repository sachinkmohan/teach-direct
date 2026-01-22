import { Link } from "react-router-dom"

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-semibold text-slate-900 mb-4">TeachDirect</h3>
            <p className="text-sm text-slate-600">
              Connect directly with teachers for personalized online lessons.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900 mb-4">For Students</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/teachers" className="text-sm text-slate-600 hover:text-slate-900">
                  Find Teachers
                </Link>
              </li>
              <li>
                <Link to="/how-it-works" className="text-sm text-slate-600 hover:text-slate-900">
                  How It Works
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900 mb-4">For Teachers</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/become-teacher" className="text-sm text-slate-600 hover:text-slate-900">
                  Become a Teacher
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="text-sm text-slate-600 hover:text-slate-900">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900 mb-4">Company</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/about" className="text-sm text-slate-600 hover:text-slate-900">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-sm text-slate-600 hover:text-slate-900">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-200 mt-8 pt-8 text-center">
          <p className="text-sm text-slate-600">
            &copy; {new Date().getFullYear()} TeachDirect. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
