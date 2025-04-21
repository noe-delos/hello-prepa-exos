"use client";

import { useQuery } from "@tanstack/react-query";
import { Icon } from "@iconify/react";
import { Generation } from "@/types";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/store/sidebar-store";
import { getGenerations } from "./actions";

export function GenerationHistory({ user }: { user: any }) {
  const { isCollapsed } = useSidebarStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [userLoaded, setUserLoaded] = useState(false);
  // Only proceed if we have a user
  const userId = user?.id;

  useEffect(() => {
    if (user?.id) {
      setUserLoaded(true);
    }
  }, [user]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["generations"],
    queryFn: () => getGenerations(user?.id),
    enabled: userLoaded, // Only run the query if userId exists and is truthy
    staleTime: Infinity,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Icon
          icon="line-md:loading-twotone-loop"
          className="text-amber-500"
          width={24}
        />
      </div>
    );
  }

  if (error || !data) {
    return isCollapsed ? null : (
      <div className="px-3 py-2 text-sm text-foreground/70">
        Erreur de chargement:{" "}
        {error instanceof Error ? error.message : "Erreur inconnue"}
      </div>
    );
  }

  const generations: Generation[] = data.generations || [];

  // If no generations or no user, show empty state
  if (!userId || generations.length === 0) {
    return isCollapsed ? null : (
      <div className="px-3 py-2 text-sm text-foreground/70">
        Aucune génération
      </div>
    );
  }

  // Only show first 5 generations by default when sidebar is expanded
  const displayedGenerations = isExpanded
    ? generations
    : generations.slice(0, 5);

  // Format the generation item text
  const formatGenerationText = (generation: Generation) => {
    const sousTest =
      {
        condMinimales: "Cond. Min.",
        comprehension: "Compréhension",
        calcul: "Calcul",
        raisonnement: "Raisonnement",
      }[generation.sous_test] || generation.sous_test;

    const niveau =
      {
        facile: "Facile",
        moyen: "Moyen",
        difficile: "Difficile",
      }[generation.niveau] || generation.niveau;

    return `${sousTest} - ${niveau} (${generation.question_count})`;
  };

  // Format document type icon
  const getDocumentIcon = (format: string) => {
    switch (format) {
      case "pdf":
        return "mdi:file-pdf-box";
      case "docx":
        return "mdi:file-word-box";
      default:
        return "mdi:file-document-outline";
    }
  };

  if (isCollapsed) {
    return (
      <div className="px-2 py-2">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center gap-3 px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                <Icon
                  icon="mdi:history"
                  className="size-5 text-foreground/50"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">Historique</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div className="py-2">
      <div className="px-3 py-2 text-sm font-medium flex items-center justify-between">
        <span>Historique</span>
        {generations.length > 5 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-foreground/70 hover:text-foreground"
          >
            {isExpanded ? "Voir moins" : "Voir plus"}
          </button>
        )}
      </div>

      <div className="space-y-1 mt-1">
        {displayedGenerations.map((generation) => (
          <a
            key={generation.id}
            href={generation.file_path}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center px-3 py-2 text-sm rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Icon
              icon={getDocumentIcon(generation.output_format)}
              className="mr-2 size-4 text-foreground/70"
            />
            <div className="flex-1 truncate">
              <div className="font-medium truncate">
                {formatGenerationText(generation)}
              </div>
              <div className="text-xs text-foreground/70">
                {format(new Date(generation.created_at), "dd MMM yyyy, HH:mm", {
                  locale: fr,
                })}
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
