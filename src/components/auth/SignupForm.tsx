import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthStore } from "@/stores/authStore";
import { getCommonTimezones, getUserTimezone, formatInTimezone, getTimezoneAbbreviation, getFriendlyTimezoneName } from "@/hooks/useTimezone";

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["student", "teacher"], "Please select your role"),
  timezone: z.string().min(1, "Please select your timezone"),
});

type SignupFormData = z.infer<typeof signupSchema>;

export function SignupForm() {
  const { signup, error: authError } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Timezone state - start with auto-detected timezone already "confirmed"
  const [detectedTimezone] = useState(getUserTimezone());
  const [showTimezoneVerification, setShowTimezoneVerification] = useState(false);
  const [showTimezoneDropdown, setShowTimezoneDropdown] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const timezones = getCommonTimezones();

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      timezone: detectedTimezone,
    },
  });

  const selectedTimezone = useWatch({ control, name: "timezone" }) || detectedTimezone;

  // Update current time every second for display
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Show verification with live clock
  const handleShowVerification = () => {
    setShowTimezoneVerification(true);
    setShowTimezoneDropdown(false);
  };

  // Confirm from verification view
  const handleConfirmTimezone = () => {
    setShowTimezoneVerification(false);
    setShowTimezoneDropdown(false);
  };

  // Show dropdown to change timezone
  const handleChangeTimezone = () => {
    setShowTimezoneDropdown(true);
    setShowTimezoneVerification(false);
  };

  // When user selects from dropdown
  const handleTimezoneSelect = (tz: string) => {
    setValue("timezone", tz);
    setShowTimezoneDropdown(false);
    setShowTimezoneVerification(false);
  };

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    try {
      await signup(data.email, data.password, data.role, data.name, data.timezone);
      setUserEmail(data.email);
      setSignupSuccess(true);
    } catch (error) {
      console.error("Signup error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Show success message after signup
  if (signupSuccess) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
          <CardDescription className="text-base">
            We've sent a confirmation link to
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="font-medium text-slate-900">{userEmail}</p>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-600">
            <p className="mb-2">
              <strong>Next steps:</strong>
            </p>
            <ol className="list-decimal list-inside space-y-1 text-left">
              <li>
                Open the email with subject 'Confirm Your Signup on
                LearnFromATutor'
              </li>
              <li>Click the confirmation link</li>
              <li>Return here to log in</li>
            </ol>
          </div>

          <p className="text-sm text-slate-500">
            Didn't receive the email? Check your spam folder or{" "}
            <button
              onClick={() => setSignupSuccess(false)}
              className="text-slate-900 font-medium hover:underline"
            >
              try again
            </button>
          </p>

          <div className="pt-4 border-t border-slate-200">
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-slate-900 text-white hover:bg-slate-800 h-10 px-4 py-2 w-full"
            >
              Go to Login
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
        <CardDescription>
          Enter your details to get started with Learn From A Tutor
        </CardDescription>
      </CardHeader>
      <CardContent>
        {authError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {authError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Full Name */}
          <div className="space-y-2">
            <label
              htmlFor="name"
              className="text-sm font-medium text-slate-700"
            >
              Full Name
            </label>
            <Input
              id="name"
              type="text"
              placeholder="John Doe"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="text-sm font-medium text-slate-700"
            >
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>

          {/* Password with show/hide toggle */}
          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="pr-10"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>

          {/* Role - Radio Buttons */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              I am a
            </label>
            <div className="space-y-2">
              <label className="flex items-center p-3 border border-slate-200 rounded-md cursor-pointer hover:bg-slate-50 has-[:checked]:border-slate-900 has-[:checked]:bg-slate-50">
                <input
                  type="radio"
                  value="student"
                  className="h-4 w-4 text-slate-900 border-slate-300 focus:ring-slate-900"
                  {...register("role")}
                />
                <span className="ml-3 text-sm text-slate-700">Student</span>
              </label>
              <label className="flex items-center p-3 border border-slate-200 rounded-md cursor-pointer hover:bg-slate-50 has-[:checked]:border-slate-900 has-[:checked]:bg-slate-50">
                <input
                  type="radio"
                  value="teacher"
                  className="h-4 w-4 text-slate-900 border-slate-300 focus:ring-slate-900"
                  {...register("role")}
                />
                <span className="ml-3 text-sm text-slate-700">Teacher</span>
              </label>
            </div>
            {errors.role && (
              <p className="text-sm text-red-600">{errors.role.message}</p>
            )}
          </div>

          {/* Timezone - Clean auto-detect display */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">
                Your Timezone
              </label>
              <button
                type="button"
                onClick={handleShowVerification}
                className="text-xs text-slate-500 hover:text-slate-700 hover:underline"
              >
                (Not sure? Click to verify)
              </button>
            </div>

            {/* Hidden input for form value */}
            <input type="hidden" {...register("timezone")} />

            {/* Default compact display - shows detected timezone */}
            {!showTimezoneVerification && !showTimezoneDropdown && (
              <div className="border border-slate-200 rounded-md p-3 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-700">
                    {getFriendlyTimezoneName(selectedTimezone)} ({getTimezoneAbbreviation(selectedTimezone)})
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatInTimezone(currentTime, selectedTimezone, 'h:mm a')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleChangeTimezone}
                  className="text-xs text-slate-600 hover:text-slate-900 underline"
                >
                  Change
                </button>
              </div>
            )}

            {/* Verification view with live clock */}
            {showTimezoneVerification && !showTimezoneDropdown && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <p className="text-sm text-blue-800 mb-2">
                  Is this your local time?
                </p>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl font-semibold text-blue-900">
                    {formatInTimezone(currentTime, selectedTimezone, 'h:mm:ss a')}
                  </span>
                  <span className="text-sm text-blue-700">
                    {getFriendlyTimezoneName(selectedTimezone)} ({getTimezoneAbbreviation(selectedTimezone)})
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleConfirmTimezone}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Yes, that's correct
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleChangeTimezone}
                    className="border-blue-300 text-blue-700 hover:bg-blue-100"
                  >
                    No, change it
                  </Button>
                </div>
              </div>
            )}

            {/* Timezone dropdown */}
            {showTimezoneDropdown && (
              <div className="space-y-2">
                <select
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                  value={selectedTimezone}
                  onChange={(e) => handleTimezoneSelect(e.target.value)}
                >
                  <option value="">Select your timezone</option>
                  {timezones.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowTimezoneDropdown(false)}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>
            )}

            {errors.timezone && (
              <p className="text-sm text-red-600">{errors.timezone.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Creating account..." : "Create Account"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm">
          <span className="text-slate-600">Already have an account? </span>
          <Link
            to="/login"
            className="font-medium text-slate-900 hover:underline"
          >
            Log in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
