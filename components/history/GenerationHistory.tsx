/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react/no-unescaped-entities */

"use client";

import React, { useState, useMemo } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

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
  const [searchQuery, setSearchQuery] = useState("");
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
    // Use the same icon for all document types
    return "solar:document-bold-duotone";
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

  // Format date to just day and month
  const formatShortDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM", { locale: fr });
  };

  // Filter generations based on search query
  const filteredGenerations = useMemo(() => {
    if (!generations) return [];
    if (!searchQuery.trim()) return generations;

    const query = searchQuery.toLowerCase();
    return generations.filter((gen) => {
      const testName = getTestName(gen.sous_test).toLowerCase();
      const docType = gen.document_type.toLowerCase();
      return testName.includes(query) || docType.includes(query);
    });
  }, [generations, searchQuery]);

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
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* History header and search */}
      <div className="mb-2 space-y-2">
        {!isCollapsed && (
          <>
            <h3 className="text-sm font-medium text-foreground/60">
              Historique
            </h3>
            <div className="relative">
              <Input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-7 text-xs w-full py-1 pr-7"
              />
              <Icon
                icon="solar:magnifer-linear"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-foreground/60 h-4 w-4"
              />
            </div>
          </>
        )}
      </div>

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

      {/* Empty state - for when there are no generations or no search results */}
      {!isLoading && !error && (
        <>
          {filteredGenerations.length === 0 && !isCollapsed && (
            <div className="text-sm text-foreground/60 italic">
              {generations?.length === 0
                ? "Aucune génération récente"
                : "Aucun résultat pour cette recherche"}
            </div>
          )}
        </>
      )}

      {/* List of generations - with flex-1 to take remaining space */}
      {!isLoading && filteredGenerations.length > 0 && (
        <div className="flex-1 overflow-hidden relative">
          <div className="h-full overflow-y-auto pr-2">
            <div className="space-y-1">
              {filteredGenerations.map((gen) => (
                <Button
                  key={gen.id}
                  variant="ghost"
                  className={cn(
                    "w-full justify-start p-2 h-auto",
                    isCollapsed ? "justify-center" : "justify-between"
                  )}
                  onMouseEnter={() => setHoveredId(gen.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => handleOpenFile(gen.file_path, gen.id)}
                >
                  {isCollapsed ? (
                    <Icon
                      icon={getDocumentIcon(gen.document_type)}
                      className="h-6 w-6 text-foreground/60"
                    />
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <Icon
                          icon={getDocumentIcon(gen.document_type)}
                          className="h-5 w-5 text-foreground/60 flex-shrink-0"
                        />
                        <span className="text-sm font-medium truncate max-w-[120px]">
                          {getTestName(gen.sous_test)}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-xs bg-slate-100 dark:bg-slate-800 border-0 px-2 py-0 h-5"
                      >
                        {formatShortDate(gen.created_at)}
                      </Badge>
                    </>
                  )}
                </Button>
              ))}
            </div>
          </div>
          {/* Fade-out effect at the bottom of the list */}
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-50 dark:from-slate-950 to-transparent pointer-events-none"></div>
        </div>
      )}
    </div>
  );
}
