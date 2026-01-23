import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";

export interface Transaction {
  id: string;
  user_id: string;
  type: "purchase" | "lesson_payment" | "withdrawal" | "refund";
  amount: number;
  status: "pending" | "completed" | "failed";
  stripe_payment_intent_id: string | null;
  metadata: Record<string, unknown> | null;
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

// Withdraw funds
export function useWithdraw() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: async (amount: number) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("withdraw-funds", {
        body: { amount },
      });

      if (error) {
        throw new Error(error.message || "Failed to withdraw funds");
      }

      if (data.error) {
        throw new Error(data.error);
      }

      return data as {
        success: boolean;
        transferId: string;
        amount: number;
        newBalance: number;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["teacherProfile"] });
    },
  });
}
