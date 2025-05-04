"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createUser(formData: FormData) {
  const supabase = createAdminClient();

  // Get form data
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const name = formData.get("name") as string;
  const surname = formData.get("surname") as string;
  const role = formData.get("role") as "admin" | "member";

  // Create the user in Auth
  const { error: authError, data: authData } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (authError) {
    return { error: authError.message };
  }

  // Create the user profile
  const { error: profileError } = await supabase
    .from("users")
    .update({
      name,
      surname,
      role,
      updated_at: new Date().toISOString(),
    })
    .eq("id", authData.user.id);

  if (profileError) {
    return { error: profileError.message };
  }

  revalidatePath("/utilisateurs");
  redirect("/utilisateurs");
}

export async function deleteUser(userId: string) {
  const supabase = createAdminClient();

  // Delete the user profile
  const { error: profileError } = await supabase
    .from("users")
    .delete()
    .eq("id", userId);

  if (profileError) {
    return { error: profileError.message };
  }

  // Delete the auth user
  const { error: authError } = await supabase.auth.admin.deleteUser(userId);

  if (authError) {
    return { error: authError.message };
  }

  revalidatePath("/utilisateurs");
  return { success: true };
}
