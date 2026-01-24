import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

export interface Transaction {
  id: string;
  user_id: string;
  type: "purchase" | "lesson_payment" | "refund";
  amount: number;
  status: "pending" | "completed" | "failed";
  stripe_payment_intent_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface MonthlyEarning {
  id: string;
  teacher_id: string;
  year: number;
  month: number;
  total_amount: number;
  lesson_count: number;
  created_at: string;
}

// Fetch transactions for the current user
export function useTransactions() {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!user,
  });
}

// Fetch this month's earnings for teachers (calculated from transactions)
export function useMonthlyEarnings() {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: ["monthly-earnings", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      // Get current month's start and end dates
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      const { data, error } = await supabase
        .from("transactions")
        .select("amount")
        .eq("user_id", user.id)
        .eq("type", "lesson_payment")
        .eq("status", "completed")
        .gte("created_at", startOfMonth.toISOString())
        .lte("created_at", endOfMonth.toISOString());

      if (error) throw error;

      const totalEarnings = data?.reduce((sum, t) => sum + t.amount, 0) || 0;

      return {
        amount: totalEarnings,
        month: now.toLocaleString("default", { month: "long" }),
        year: now.getFullYear(),
      };
    },
    enabled: !!user,
  });
}

// Fetch earnings history from the monthly_earnings table
export function useEarningsHistory() {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: ["earnings-history", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("monthly_earnings")
        .select("*")
        .eq("teacher_id", user.id)
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .limit(12); // Last 12 months

      if (error) throw error;
      return data as MonthlyEarning[];
    },
    enabled: !!user,
  });
}
