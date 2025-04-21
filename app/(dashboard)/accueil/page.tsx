import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { PendingFileChecker } from "@/components/pending-file-checker";
import QuestionGenerator from "@/components/layout/home";

export default async function AccueilPage() {
  const supabase = await createClient();

  // Get user session
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  // Redirect to login if not authenticated
  if (!authUser) {
    redirect("/login");
  }

  // Get user profile from the database
  const { data: userProfile } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  return (
    <>
      <PendingFileChecker />
      <QuestionGenerator user={userProfile} />
    </>
  );
}
