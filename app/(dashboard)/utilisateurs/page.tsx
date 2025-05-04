import { createClient } from "@/utils/supabase/server";
import { DataTable } from "./data-table";
import { User } from "@/types";

export default async function UsersPage() {
  const supabase = await createClient();

  // Get authenticated user
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  // Get user profile to check if admin
  const { data: userProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", authUser?.id)
    .single();

  const isAdmin = userProfile?.role === "admin";

  // Get all users
  const { data: users } = await supabase
    .from("users")
    .select("*")
    .order("surname", { ascending: true });

  return (
    <div className="space-y-6 w-full">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Utilisateurs</h1>
      </div>

      <DataTable data={(users as User[]) || []} isAdmin={isAdmin} />
    </div>
  );
}
