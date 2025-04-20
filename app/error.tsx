"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function ErrorPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-2xl font-bold">Une erreur est survenue</h1>
      <p>Désolé, quelque chose s'est mal passé.</p>
      <Button onClick={() => router.push("/login")}>
        Retour à la page de connexion
      </Button>
    </div>
  );
}
