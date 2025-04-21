import QuestionGenerator from "@/components/layout/home";
import { createClient } from "@/utils/supabase/server";

export async function HomePage() {
  const supabase = await createClient();

  // Get authenticated user
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  // Get user profile from the database
  const { data: userProfile } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser?.id)
    .single();

  const user = userProfile;

  return <QuestionGenerator user={user} />;
}

export default HomePage;
