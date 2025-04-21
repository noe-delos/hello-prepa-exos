/* eslint-disable react/no-unescaped-entities */

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function AdminPage() {
  const supabase = await createClient();

  // Check if user is authenticated
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  // Check if user is admin
  const { data: userProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", authUser.id)
    .single();

  if (userProfile?.role !== "admin") {
    redirect("/accueil");
  }

  // Get stats
  const { count: totalUsers } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true });

  const { count: adminUsers } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");

  const { count: memberUsers } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .eq("role", "member");

  return (
    <div className="space-y-6 w-full">
      <h1 className="text-3xl font-bold">Administration</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Total Utilisateurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Administrateurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{adminUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Membres</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{memberUsers}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="mb-4">
          <TabsTrigger value="users">Gestion des utilisateurs</TabsTrigger>
          <TabsTrigger value="settings">Paramètres</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Gestion des utilisateurs</CardTitle>
              <CardDescription>
                Gérez les utilisateurs de la plateforme
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>
                Accédez à la{" "}
                <a
                  href="/utilisateurs"
                  className="underline text-blue-600 hover:text-blue-800"
                >
                  page utilisateurs
                </a>{" "}
                pour gérer les utilisateurs de la plateforme.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Paramètres d'administration</CardTitle>
              <CardDescription>
                Configurez les paramètres de la plateforme
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>
                Les paramètres d'administration seront disponibles
                prochainement.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
