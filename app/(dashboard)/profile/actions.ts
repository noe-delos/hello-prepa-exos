"use server";
/* eslint-disable @typescript-eslint/no-unused-vars */
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Non autorisé" };
  }

  // Get form data
  const name = formData.get("name") as string;
  const surname = formData.get("surname") as string;

  // Update user profile
  const { error } = await supabase
    .from("users")
    .update({
      name,
      surname,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile");
  return { success: true };
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();

  // Get form data
  const currentPassword = formData.get("current_password") as string;
  const newPassword = formData.get("new_password") as string;
  const confirmPassword = formData.get("confirm_password") as string;

  // Validate passwords
  if (newPassword !== confirmPassword) {
    return { error: "Les nouveaux mots de passe ne correspondent pas" };
  }

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { error: "Utilisateur non trouvé" };
  }

  // First verify the current password by trying to sign in
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (signInError) {
    return { error: "Mot de passe actuel incorrect" };
  }

  // Update password
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile");
  return { success: true };
}

export async function uploadProfilePicture(formData: FormData) {
  const supabase = await createClient();

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Non autorisé" };
  }

  // Get form data
  const profilePicture = formData.get("profile_picture") as File;

  if (!profilePicture || profilePicture.size === 0) {
    return { error: "Aucun fichier sélectionné" };
  }

  // Upload file to storage
  const fileName = `${user.id}/${Date.now()}-${profilePicture.name}`;
  const { error: uploadError, data: uploadData } = await supabase.storage
    .from("profile_pictures")
    .upload(fileName, profilePicture, {
      upsert: true,
    });

  if (uploadError) {
    return { error: uploadError.message };
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from("profile_pictures").getPublicUrl(fileName);

  // Update user profile with new picture URL
  const { error: updateError } = await supabase
    .from("users")
    .update({
      picture_url: publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (updateError) {
    return { error: updateError.message };
  }

  // Return the publicUrl along with success status so client can update immediately
  revalidatePath("/profile");
  return { success: true, pictureUrl: publicUrl };
}
