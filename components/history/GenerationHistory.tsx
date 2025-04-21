/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react/no-unescaped-entities */

"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { User } from "@/types";
import { Icon } from "@iconify/react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSidebarStore } from "@/store/sidebar-store";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useFileViewer } from "@/context/file-viewer-context";
import { toast } from "sonner";

// Define a Generation type
interface Generation {
  id: string;
  sous_test: string;
  niveau: string;
  part_exercice: string;
  document_type: string;
  question_count: number;
  output_format: string;
  file_path: string;
  created_at: string;
}

interface GenerationHistoryProps {
  user: User | null;
}

export function GenerationHistory({ user }: GenerationHistoryProps) {
  const router = useRouter();
  const { isCollapsed } = useSidebarStore();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { openFile } = useFileViewer();

  // Fetch generations using React Query
  const {
    data: generations,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["generations"],
    queryFn: async () => {
      if (!user) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("generations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as Generation[];
    },
    enabled: !!user,
  });

  // Helper function to get icon by document type
  const getDocumentIcon = (docType: string) => {
    switch (docType) {
      case "polycopie":
        return "mdi:file-document-outline";
      case "fiche":
        return "mdi:file-outline";
      case "examen":
        return "mdi:file-certificate-outline";
      default:
        return "mdi:file-outline";
    }
  };

  // Helper function to get test name in French
  const getTestName = (sousTest: string) => {
    switch (sousTest) {
      case "condMinimales":
        return "Cond. Minimales";
      case "comprehension":
        return "Compréhension";
      case "calcul":
        return "Calcul";
      case "raisonnement":
        return "Raisonnement";
      default:
        return sousTest;
    }
  };

  // Handler for opening a file
  const handleOpenFile = async (filePath: string, id: string) => {
    try {
      toast.info("Chargement du document...");

      const supabase = createClient();

      // Get file info for display
      const { data: generation } = await supabase
        .from("generations")
        .select("document_type, sous_test, output_format")
        .eq("id", id)
        .single();

      if (!generation) {
        toast.error("Génération non trouvée");
        return;
      }

      // Create a file name for display
      const fileName = `${getTestName(generation.sous_test)} - ${
        generation.document_type
      }.${generation.output_format}`;

      // Check if we're on the accueil page
      const currentPath = window.location.pathname;

      if (currentPath !== "/accueil") {
        // If not on accueil, navigate there first
        // Store the file details in sessionStorage
        sessionStorage.setItem(
          "pendingFile",
          JSON.stringify({
            url: filePath,
            type: generation.output_format,
            name: fileName,
          })
        );

        router.push("/accueil");
      } else {
        // If we're already on accueil, open the file directly
        openFile(filePath, generation.output_format, fileName);
        toast.success("Document chargé");
      }
    } catch (error) {
      console.error("Error opening file:", error);
      toast.error("Erreur lors de l'ouverture du fichier");
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-2">
      {/* History title */}
      {!isCollapsed && (
        <h3 className="text-sm font-medium text-foreground/60 mb-2">
          Historique
        </h3>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 p-2">
              <Skeleton className="h-8 w-8 rounded-md" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !isCollapsed && (
        <div className="text-sm text-red-500">
          Erreur lors du chargement de l'historique
        </div>
      )}

      {/* Empty state */}
      {generations?.length === 0 && !isLoading && !isCollapsed && (
        <div className="text-sm text-foreground/60 italic">
          Aucune génération récente
        </div>
      )}

      {/* List of generations */}
      {generations && generations.length > 0 && (
        <ScrollArea className={cn("h-60", isCollapsed && "h-72")}>
          <div className="space-y-1 pr-2">
            {generations.map((gen) => (
              <Button
                key={gen.id}
                variant="ghost"
                className={cn(
                  "w-full justify-start p-2 h-auto",
                  isCollapsed ? "flex-col" : "flex"
                )}
                onMouseEnter={() => setHoveredId(gen.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => handleOpenFile(gen.file_path, gen.id)}
              >
                <div
                  className={cn(
                    "flex items-center",
                    isCollapsed && "flex-col gap-1"
                  )}
                >
                  <Icon
                    icon={getDocumentIcon(gen.document_type)}
                    className={cn(
                      "text-foreground/60",
                      isCollapsed ? "h-6 w-6" : "h-5 w-5 mr-3"
                    )}
                  />
                  {!isCollapsed && (
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-medium truncate w-32">
                        {getTestName(gen.sous_test)}
                      </span>
                      <span className="text-xs text-foreground/60">
                        {format(new Date(gen.created_at), "dd MMM yyyy", {
                          locale: fr,
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </Button>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
