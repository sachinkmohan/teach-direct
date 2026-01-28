import { useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUserProfile, useUpdateUserProfile } from "@/hooks/useUser";
import { getCommonTimezones, getUserTimezone, formatInTimezone, getTimezoneAbbreviation, getFriendlyTimezoneName } from "@/hooks/useTimezone";

const settingsSchema = z.object({
  display_name: z.string().min(2, "Name must be at least 2 characters"),
  timezone: z.string().min(1, "Please select your timezone"),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export function SettingsPage() {
  const { data: userProfile, isLoading } = useUserProfile();
  const updateProfile = useUpdateUserProfile();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Timezone UI state
  const [showTimezoneVerification, setShowTimezoneVerification] = useState(false);
  const [showTimezoneDropdown, setShowTimezoneDropdown] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const timezones = getCommonTimezones();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isDirty },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
  });

  const selectedTimezone = useWatch({ control, name: "timezone" });

  // Reset form when user profile loads
  useEffect(() => {
    if (userProfile) {
      reset({
        display_name: userProfile.display_name || "",
        timezone: userProfile.timezone || "UTC",
      });
    }
  }, [userProfile, reset]);

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
    setValue("timezone", tz, { shouldDirty: true });
    setShowTimezoneDropdown(false);
    setShowTimezoneVerification(false);
  };

  // Re-detect timezone from browser
  const handleRedetectTimezone = () => {
    const detected = getUserTimezone();
    setValue("timezone", detected, { shouldDirty: true });
    setShowTimezoneDropdown(false);
    setShowTimezoneVerification(false);
  };

  const onSubmit = async (data: SettingsFormData) => {
    setSuccessMessage(null);
    try {
      await updateProfile.mutateAsync({
        display_name: data.display_name,
        timezone: data.timezone,
      });
      setSuccessMessage("Settings updated successfully!");
      // Reset form to clear dirty state and set new baseline
      reset(data);
    } catch (error) {
      console.error("Failed to update settings:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-slate-50 min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-4rem)]">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-600 mt-2">Manage your account settings</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profile Settings</CardTitle>
            <CardDescription>
              Update your display name and timezone
            </CardDescription>
          </CardHeader>
          <CardContent>
            {successMessage && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                {successMessage}
              </div>
            )}

            {updateProfile.error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                Failed to update settings. Please try again.
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Email (read-only) */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Email
                </label>
                <Input
                  type="email"
                  value={userProfile?.email || ""}
                  disabled
                  className="bg-slate-100"
                />
                <p className="text-xs text-slate-500">
                  Email cannot be changed
                </p>
              </div>

              {/* Display Name */}
              <div className="space-y-2">
                <label
                  htmlFor="display_name"
                  className="text-sm font-medium text-slate-700"
                >
                  Display Name
                </label>
                <Input
                  id="display_name"
                  type="text"
                  placeholder="Your name"
                  {...register("display_name")}
                />
                {errors.display_name && (
                  <p className="text-sm text-red-600">{errors.display_name.message}</p>
                )}
              </div>

              {/* Timezone - Same UI as signup */}
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

                {/* Default compact display - shows current timezone */}
                {!showTimezoneVerification && !showTimezoneDropdown && selectedTimezone && (
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
                {showTimezoneVerification && !showTimezoneDropdown && selectedTimezone && (
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
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleRedetectTimezone}
                        className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        Auto-detect from browser
                      </button>
                      <span className="text-xs text-slate-400">|</span>
                      <button
                        type="button"
                        onClick={() => setShowTimezoneDropdown(false)}
                        className="text-xs text-slate-500 hover:text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {errors.timezone && (
                  <p className="text-sm text-red-600">{errors.timezone.message}</p>
                )}
                <p className="text-xs text-slate-500">
                  This affects how lesson times are displayed
                </p>
              </div>

              <Button
                type="submit"
                disabled={updateProfile.isPending || !isDirty}
              >
                {updateProfile.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
