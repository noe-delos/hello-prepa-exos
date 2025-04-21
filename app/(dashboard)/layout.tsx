import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { User } from "@/types";
import { FileViewerProvider } from "@/context/file-viewer-context";
import { FileViewerPanel } from "@/components/file-viewer-panel";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  const user = userProfile as User | null;

  return (
    <FileViewerProvider>
      <div className="flex h-screen w-full">
        <Sidebar user={user} />
        <div className="flex flex-col flex-1 overflow-hidden w-full transition-all duration-300">
          <Header user={user} />
          <main
            id="main-content"
            className="flex-1 overflow-auto p-6 w-full pt-0 transition-all duration-300"
          >
            {children}
          </main>
        </div>
        <FileViewerPanel />
      </div>
    </FileViewerProvider>
  );
}
