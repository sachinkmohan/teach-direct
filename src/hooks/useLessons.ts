import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

export interface Lesson {
  id: string;
  package_id: string;
  teacher_id: string;
  student_id: string;
  scheduled_at: string;
  duration_minutes: number;
  meeting_link: string | null;
  status:
    | "scheduled"
    | "completed"
    | "pending_confirmation"
    | "awaiting_admin_approval"
    | "confirmed"
    | "disputed"
    | "cancelled";
  notes: string | null;
  auto_release_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LessonWithDetails extends Lesson {
  teacher?: {
    id: string;
    email: string;
    display_name: string | null;
  };
  student?: {
    id: string;
    email: string;
    display_name: string | null;
  };
}

// Helper function to fetch user info for lessons
async function fetchUserInfoForLessons(
  lessons: Lesson[],
): Promise<LessonWithDetails[]> {
  if (lessons.length === 0) return [];

  // Get unique user IDs
  const userIds = [
    ...new Set([
      ...lessons.map((l) => l.teacher_id),
      ...lessons.map((l) => l.student_id),
    ]),
  ];

  // Fetch user info
  const { data: users, error } = await supabase
    .from("users")
    .select("id, email, display_name")
    .in("id", userIds);

  if (error) {
    console.error("Failed to fetch user info for lessons:", error);
  }

  // Create lookup map
  const userMap: Record<
    string,
    { id: string; email: string; display_name: string | null }
  > = {};
  users?.forEach((u) => {
    userMap[u.id] = u;
  });

  // Merge user info into lessons
  return lessons.map((lesson) => ({
    ...lesson,
    teacher: userMap[lesson.teacher_id],
    student: userMap[lesson.student_id],
  }));
}

// Fetch lessons for the current user (student or teacher)
export function useLessons() {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: ["lessons", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      // Fetch lessons where user is student OR teacher
      const { data, error } = await supabase
        .from("lessons")
        .select("*")
        .or(`student_id.eq.${user.id},teacher_id.eq.${user.id}`)
        .order("scheduled_at", { ascending: true });

      if (error) throw error;

      // Fetch user info separately
      return fetchUserInfoForLessons(data as Lesson[]);
    },
    enabled: !!user,
  });
}

// Fetch upcoming lessons only
export function useUpcomingLessons() {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: ["upcoming-lessons", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("lessons")
        .select("*")
        .or(`student_id.eq.${user.id},teacher_id.eq.${user.id}`)
        .gte("scheduled_at", new Date().toISOString())
        .in("status", ["scheduled", "pending_confirmation"])
        .order("scheduled_at", { ascending: true });

      if (error) throw error;

      // Fetch user info separately
      return fetchUserInfoForLessons(data as Lesson[]);
    },
    enabled: !!user,
  });
}

// Book a new lesson
export function useBookLesson() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async ({
      packageId,
      teacherId,
      scheduledAt,
      meetingLink,
    }: {
      packageId: string;
      teacherId: string;
      scheduledAt: Date;
      meetingLink?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      // Get package to verify ownership and get price
      const { data: pkg, error: pkgError } = await supabase
        .from("packages")
        .select("student_id, price_per_class")
        .eq("id", packageId)
        .single();

      if (pkgError || !pkg) {
        throw new Error("Package not found");
      }

      if (pkg.student_id !== user.id) {
        throw new Error("This package does not belong to you");
      }

      // Call atomic booking function
      const { data, error } = await supabase.rpc("book_lesson_atomic", {
        p_package_id: packageId,
        p_teacher_id: teacherId,
        p_student_id: user.id,
        p_scheduled_at: scheduledAt.toISOString(),
        p_meeting_link: meetingLink || null,
        p_price_per_class: pkg.price_per_class,
      });

      if (error) throw error;

      // Fetch the created lesson
      const { data: lesson, error: lessonError } = await supabase
        .from("lessons")
        .select("*")
        .eq("id", data)
        .single();

      if (lessonError) {
        // Booking succeeded but fetch failed - return minimal data
        console.error("Lesson created but fetch failed:", lessonError);
        return { id: data } as Lesson;
      }

      return lesson as Lesson;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-lessons"] });
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      queryClient.invalidateQueries({ queryKey: ["my-teacher-profile"] });
    },
  });
}

// Cancel a lesson
export function useCancelLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lessonId: string) => {
      // Call atomic cancel function
      const { data, error } = await supabase.rpc("cancel_lesson_atomic", {
        p_lesson_id: lessonId,
      });

      if (error) throw error;

      return { success: data };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-lessons"] });
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      queryClient.invalidateQueries({ queryKey: ["my-teacher-profile"] });
    },
  });
}

// Update lesson (add meeting link, notes, etc.)
export function useUpdateLesson() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async ({
      lessonId,
      updates,
    }: {
      lessonId: string;
      updates: Partial<Pick<Lesson, "meeting_link" | "notes" | "status">>;
    }) => {
      if (!user) throw new Error("Not authenticated");

      // First verify the user is involved in this lesson
      const { data: lesson, error: fetchError } = await supabase
        .from("lessons")
        .select("teacher_id, student_id")
        .eq("id", lessonId)
        .single();

      if (fetchError) throw fetchError;
      if (!lesson) throw new Error("Lesson not found");

      // Verify user is either the teacher or student
      if (lesson.teacher_id !== user.id && lesson.student_id !== user.id) {
        throw new Error("You don't have permission to update this lesson");
      }

      const { data, error } = await supabase
        .from("lessons")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", lessonId)
        .select()
        .single();

      if (error) throw error;
      return data as Lesson;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-lessons"] });
    },
  });
}

// Complete a lesson (teacher marks as done)
export function useCompleteLesson() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (lessonId: string) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc("complete_lesson_atomic", {
        p_lesson_id: lessonId,
        p_teacher_id: user.id,
      });

      if (error) throw error;
      return { success: data };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-lessons"] });
      queryClient.invalidateQueries({ queryKey: ["my-teacher-profile"] });
    },
  });
}

// Confirm a lesson (student confirms - triggers Stripe transfer to teacher)
export function useConfirmLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lessonId: string) => {
      // Get the current session to ensure we have a valid access token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error("Not authenticated - please log in again");
      }

      // Call the confirm-lesson Edge Function which handles:
      // 1. Database update (release_lesson_funds)
      // 2. Stripe transfer to teacher's Connect account (90% after 10% platform fee)
      const { data, error } = await supabase.functions.invoke("confirm-lesson", {
        body: { lessonId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to confirm lesson");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return {
        success: true,
        transferId: data?.transferId,
        amount: data?.amount,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-lessons"] });
      queryClient.invalidateQueries({ queryKey: ["my-teacher-profile"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

// Dispute a lesson (student disputes)
export function useDisputeLesson() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async ({
      lessonId,
      reason,
    }: {
      lessonId: string;
      reason: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc("dispute_lesson", {
        p_lesson_id: lessonId,
        p_student_id: user.id,
        p_reason: reason,
      });

      if (error) throw error;
      return { success: data };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-lessons"] });
    },
  });
}
