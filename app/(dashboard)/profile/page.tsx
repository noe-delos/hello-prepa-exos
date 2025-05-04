/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */

// app/(dashboard)/profile/page.tsx
"use client";

import { createClient } from "@/utils/supabase/client";
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
import { useRef, useState, useEffect } from "react";
import { Camera, X, Check } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [authUser, setAuthUser] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Fetch user data on component mount and when needed
  const fetchUserData = async () => {
    const supabase = createClient();

    // Get authenticated user
    const {
      data: { user: authUserData },
    } = await supabase.auth.getUser();
    setAuthUser(authUserData);

    // Get user profile from the database
    if (authUserData) {
      const { data: userProfile } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUserData.id)
        .single();

      setUser(userProfile as User | null);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  // Get user initials for the avatar fallback
  const getInitials = () => {
    if (user?.name && user?.surname) {
      return `${user.name[0]}${user.surname[0]}`.toUpperCase();
    }
    return "U";
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);

      // Create preview URL
      const fileUrl = URL.createObjectURL(file);
      setPreviewUrl(fileUrl);
    }
  };

  // Handle avatar click
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  // Reset file selection state
  const resetFileSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle upload
  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);

    const formData = new FormData();
    formData.append("profile_picture", selectedFile);

    const result = await uploadProfilePicture(formData);

    setIsUploading(false);

    if (result.success) {
      // Reset the file selection UI
      resetFileSelection();

      // Update user data with the new picture
      if (result.pictureUrl) {
        setUser((prevUser) =>
          prevUser ? { ...prevUser, picture_url: result.pictureUrl } : null
        );
      }

      // Refresh the page data
      router.refresh();

      // Refetch the user data to ensure everything is in sync
      await fetchUserData();
    } else {
      // Show error
      alert(result.error);
    }
  };

  // Cancel preview
  const cancelPreview = () => {
    resetFileSelection();
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
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Avatar with click handler and hover effects */}
            <div className="relative">
              <Avatar
                className={`w-24 h-24 cursor-pointer transition-all duration-200 
                          ${
                            !previewUrl &&
                            "hover:ring-4 hover:ring-primary hover:ring-opacity-50"
                          }`}
                onClick={!previewUrl ? handleAvatarClick : undefined}
              >
                {previewUrl ? (
                  <AvatarImage src={previewUrl} />
                ) : user?.picture_url ? (
                  <AvatarImage src={user.picture_url} />
                ) : null}
                <AvatarFallback className="text-2xl">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>

              {/* Camera overlay on hover when no preview is active */}
              {!previewUrl && (
                <div
                  className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40 rounded-full opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                  onClick={handleAvatarClick}
                >
                  <Camera className="text-white" />
                </div>
              )}

              {/* Action buttons when preview is active */}
              {previewUrl && (
                <div className="mt-4 flex justify-center space-x-2">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={cancelPreview}
                    className="rounded-full h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    onClick={handleUpload}
                    disabled={isUploading}
                    className="rounded-full h-8 w-8 p-0"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="flex-1">
              {previewUrl ? (
                <p className="text-sm">
                  {selectedFile?.name} (
                  {(selectedFile?.size || 0) / 1024 < 1000
                    ? `${Math.round((selectedFile?.size || 0) / 1024)} KB`
                    : `${
                        Math.round(
                          ((selectedFile?.size || 0) / 1024 / 1024) * 10
                        ) / 10
                      } MB`}
                  )
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Cliquez sur la photo de profil pour télécharger une nouvelle
                  image
                </p>
              )}
            </div>
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
          <form action={updateProfile as any}>
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
          <form action={updatePassword as any}>
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
