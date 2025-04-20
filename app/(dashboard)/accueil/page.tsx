import { createClient } from "@/utils/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CheckIcon, AlertCircle } from "lucide-react";
import { User } from "@/types";

export default async function HomePage() {
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

  const user = userProfile as User | null;
  const greeting = user?.name ? `Bonjour ${user.name},` : "Bonjour,";
  const currentTime = new Date();
  const hours = currentTime.getHours();

  // Determine greeting based on time of day
  let timeGreeting = "";
  if (hours < 12) {
    timeGreeting = "Bon début de journée";
  } else if (hours < 18) {
    timeGreeting = "Bon après-midi";
  } else {
    timeGreeting = "Bonne soirée";
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4">
        <div>
          <h1 className="text-3xl font-bold">{greeting}</h1>
        </div>
        <div className="mt-4 md:mt-0">
          <Button variant="outline">Paramètres</Button>
        </div>
      </div>

      <Tabs defaultValue="questions" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="format">Format</TabsTrigger>
          <TabsTrigger value="resultats">Résultats</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Sous-test */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sous-test</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 border rounded flex-shrink-0"></div>
                  <span>Compréhension</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 border rounded flex-shrink-0">
                    <span className="flex items-center justify-center">+</span>
                  </div>
                  <span>Calcul</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 border rounded flex-shrink-0"></div>
                  <span>Raisonnement</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 border rounded flex-shrink-0 bg-amber-500"></div>
                  <span>Cond. Minimales</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 border rounded flex-shrink-0"></div>
                  <span>Expression</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 border rounded flex-shrink-0"></div>
                  <span>Logique</span>
                </div>
              </CardContent>
            </Card>

            {/* Niveau */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Niveau</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 border rounded flex-shrink-0"></div>
                  <span>Facile</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 border rounded flex-shrink-0"></div>
                  <span>Moyen</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 border rounded flex-shrink-0 bg-amber-500"></div>
                  <span>Difficile</span>
                </div>
              </CardContent>
            </Card>

            {/* Piège */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Piège</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 border rounded flex-shrink-0"></div>
                  <span>Avec piège</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 border rounded flex-shrink-0 bg-amber-500"></div>
                  <span>Sans piège</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="pt-4">
            <h2 className="text-xl font-semibold mb-4">Format</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-center justify-between px-4 py-3 rounded-full border">
                <span>Polycopié</span>
                <span>▼</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 rounded-full border">
                <span>20 questions</span>
                <span>▼</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3 rounded-full border">
                <span>PDF</span>
                <span>▼</span>
              </div>
            </div>
          </div>

          <div className="text-center text-sm text-muted-foreground py-4">
            Vous allez générer 20 questions de conditions minimales, de niveau
            difficile, sans piège, au format polycopié PDF.
          </div>

          <div className="flex justify-center pt-2">
            <Button className="px-16 py-6 text-lg bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700">
              Générer
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="format">
          <Card>
            <CardHeader>
              <CardTitle>Options de format</CardTitle>
              <CardDescription>
                Configurez les détails du format
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>
                Cette section permet de configurer les options de format de vos
                tests.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resultats">
          <Card>
            <CardHeader>
              <CardTitle>Résultats précédents</CardTitle>
              <CardDescription>Historique des tests générés</CardDescription>
            </CardHeader>
            <CardContent>
              <p>L'historique de vos tests générés sera affiché ici.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <CheckIcon className="h-5 w-5 text-green-500" />
              Profil
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p>
                <span className="font-medium">Nom:</span>{" "}
                {user?.surname || "Non défini"}
              </p>
              <p>
                <span className="font-medium">Prénom:</span>{" "}
                {user?.name || "Non défini"}
              </p>
              <p>
                <span className="font-medium">Rôle:</span>{" "}
                {user?.role === "admin" ? "Administrateur" : "Membre"}
              </p>
            </div>
          </CardContent>
          <CardFooter className="pt-0">
            <Button variant="ghost" size="sm">
              Modifier le profil
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tests récents</CardTitle>
            <CardDescription>Derniers tests générés</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm">Aucun test récent</p>
            </div>
          </CardContent>
          <CardFooter className="pt-0">
            <Button variant="ghost" size="sm">
              Voir l'historique
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Notifications
            </CardTitle>
            <CardDescription>Mises à jour du système</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">Aucune notification pour le moment</p>
          </CardContent>
          <CardFooter className="pt-0">
            <Button variant="ghost" size="sm">
              Paramètres de notification
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
