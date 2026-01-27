import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface AdminLessonWithDetails {
  id: string;
  package_id: string;
  teacher_id: string;
  student_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  created_at: string;
  updated_at: string;
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
  package?: {
    price_per_class: number;
  };
}

// Fetch lessons awaiting admin approval
export function useAdminLessons() {
  return useQuery({
    queryKey: ["admin-lessons"],
    queryFn: async () => {
      // Fetch lessons with awaiting_admin_approval status
      const { data: lessons, error } = await supabase
        .from("lessons")
        .select("*")
        .eq("status", "awaiting_admin_approval")
        .order("updated_at", { ascending: false });

      if (error) throw error;

      if (!lessons || lessons.length === 0) {
        return [];
      }

      // Get unique user IDs
      const userIds = [
        ...new Set([
          ...lessons.map((l) => l.teacher_id),
          ...lessons.map((l) => l.student_id),
        ]),
      ];

      // Get unique package IDs
      const packageIds = [...new Set(lessons.map((l) => l.package_id))];

      // Fetch user info
      const { data: users } = await supabase
        .from("users")
        .select("id, email, display_name")
        .in("id", userIds);

      // Fetch package info for prices
      const { data: packages } = await supabase
        .from("packages")
        .select("id, price_per_class")
        .in("id", packageIds);

      // Create lookup maps
      const userMap: Record<
        string,
        { id: string; email: string; display_name: string | null }
      > = {};
      users?.forEach((u) => {
        userMap[u.id] = u;
      });

      const packageMap: Record<string, { price_per_class: number }> = {};
      packages?.forEach((p) => {
        packageMap[p.id] = { price_per_class: p.price_per_class };
      });

      // Merge info into lessons
      return lessons.map((lesson) => ({
        ...lesson,
        teacher: userMap[lesson.teacher_id],
        student: userMap[lesson.student_id],
        package: packageMap[lesson.package_id],
      })) as AdminLessonWithDetails[];
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Approve a single lesson
export function useApproveLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lessonId: string) => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error("Not authenticated - please log in again");
      }

      const { data, error } = await supabase.functions.invoke(
        "admin-approve-lesson",
        {
          body: { lessonId },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );

      if (error) {
        throw new Error(error.message || "Failed to approve lesson");
      }

      if (data?.results?.[0]?.error) {
        throw new Error(data.results[0].error);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-lessons"] });
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

// Approve multiple lessons at once
export function useBatchApproveLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lessonIds: string[]) => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error("Not authenticated - please log in again");
      }

      const { data, error } = await supabase.functions.invoke(
        "admin-approve-lesson",
        {
          body: { lessonIds },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );

      if (error) {
        throw new Error(error.message || "Failed to approve lessons");
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-lessons"] });
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}
