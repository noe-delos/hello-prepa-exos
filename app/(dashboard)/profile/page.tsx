// app/(dashboard)/profile/page.tsx
import { createClient } from "@/utils/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateProfile, updatePassword, uploadProfilePicture } from "./actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "@/types";

export default async function ProfilePage() {
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

  // Get user initials for the avatar fallback
  const getInitials = () => {
    if (user?.name && user?.surname) {
      return `${user.name[0]}${user.surname[0]}`.toUpperCase();
    }
    return "U";
  };

  return (
    <div className="w-full mx-auto space-y-8">
      <h1 className="text-3xl font-bold">Profile</h1>

      <div className="grid gap-8">
        {/* Profile Picture Update */}
        <Card>
          <CardHeader>
            <CardTitle>Photo de profil</CardTitle>
            <CardDescription>
              Mettez à jour votre photo de profil
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <Avatar className="w-24 h-24">
              {user?.picture_url ? (
                <AvatarImage src={user.picture_url} />
              ) : null}
              <AvatarFallback className="text-2xl">
                {getInitials()}
              </AvatarFallback>
            </Avatar>

            <form action={uploadProfilePicture} className="flex-1">
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <Label htmlFor="profile_picture" className="block mb-2">
                    Choisir une nouvelle image
                  </Label>
                  <Input
                    id="profile_picture"
                    name="profile_picture"
                    type="file"
                    accept="image/*"
                  />
                </div>
                <Button type="submit">Télécharger</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Personal Information Update */}
        <Card>
          <CardHeader>
            <CardTitle>Informations personnelles</CardTitle>
            <CardDescription>
              Mettez à jour vos informations personnelles
            </CardDescription>
          </CardHeader>
          <form action={updateProfile}>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Prénom</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={user?.name || ""}
                  />
                </div>
                <div>
                  <Label htmlFor="surname">Nom</Label>
                  <Input
                    id="surname"
                    name="surname"
                    defaultValue={user?.surname || ""}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={authUser?.email || ""}
                  disabled
                />
                <p className="text-sm text-muted-foreground mt-1">
                  L'email ne peut pas être modifié
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit">Enregistrer les modifications</Button>
            </CardFooter>
          </form>
        </Card>

        {/* Password Update */}
        <Card>
          <CardHeader>
            <CardTitle>Modifier le mot de passe</CardTitle>
            <CardDescription>Mettez à jour votre mot de passe</CardDescription>
          </CardHeader>
          <form action={updatePassword}>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="current_password">Mot de passe actuel</Label>
                <Input
                  id="current_password"
                  name="current_password"
                  type="password"
                />
              </div>
              <div>
                <Label htmlFor="new_password">Nouveau mot de passe</Label>
                <Input id="new_password" name="new_password" type="password" />
              </div>
              <div>
                <Label htmlFor="confirm_password">
                  Confirmer le nouveau mot de passe
                </Label>
                <Input
                  id="confirm_password"
                  name="confirm_password"
                  type="password"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit">Changer le mot de passe</Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
