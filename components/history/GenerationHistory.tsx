/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react/no-unescaped-entities */

"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";
import { User } from "@/types";
import { Icon } from "@iconify/react";
import {
  format,
  isAfter,
  isWithinInterval,
  startOfDay,
  subDays,
} from "date-fns";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ShinyButton } from "@/components/ui/shiny-button"; // Import the shiny button component
import { revalidateHistoryList } from "@/actions/list";
import { motion } from "framer-motion"; // Import framer-motion

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
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const { openFile } = useFileViewer();
  const [latestGenerationId, setLatestGenerationId] = useState<string | null>(
    null
  );
  const previousGenerationsRef = useRef<Generation[]>([]);

  // Filter categories
  const filterCategories = [
    { id: "comprehension", name: "Compréhension" },
    { id: "calcul", name: "Calcul" },
    { id: "raisonnement", name: "Raisonnement" },
    { id: "condMinimales", name: "Cond. Minimales" },
  ];

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
        .limit(100);

      if (error) throw error;
      return data as Generation[];
    },
    enabled: !!user,
  });

  // Detect new generation entries
  useEffect(() => {
    if (!generations || !previousGenerationsRef.current.length) {
      previousGenerationsRef.current = generations || [];
      return;
    }

    // Find new generations that weren't in the previous list
    if (generations.length > 0 && previousGenerationsRef.current.length > 0) {
      const previousIds = new Set(
        previousGenerationsRef.current.map((gen) => gen.id)
      );
      const newGeneration = generations.find((gen) => !previousIds.has(gen.id));

      if (newGeneration) {
        // Force a revalidation to ensure the UI is up-to-date
        revalidateHistoryList();

        setLatestGenerationId(newGeneration.id);

        // Clear the latest generation ID after 1.5 seconds
        setTimeout(() => {
          setLatestGenerationId(null);
        }, 6500);
      }
    }

    // Update the reference
    previousGenerationsRef.current = generations || [];
  }, [generations]);

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

  // Toggle filter category
  const toggleFilter = (categoryId: string) => {
    setActiveFilters((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  // Clear all filters
  const clearFilters = () => {
    setActiveFilters([]);
    setSelectedDate(undefined);
  };

  // Filter generations based on active filters and selected date
  const filteredGenerations = useMemo(() => {
    if (!generations) return [];

    return generations.filter((gen) => {
      // Apply category filters
      const passesTypeFilter =
        activeFilters.length === 0 || activeFilters.includes(gen.sous_test);

      // Apply date filter
      let passesDateFilter = true;
      if (selectedDate) {
        const genDate = startOfDay(new Date(gen.created_at));
        const filterDate = startOfDay(selectedDate);
        passesDateFilter = genDate.getTime() === filterDate.getTime();
      }

      return passesTypeFilter && passesDateFilter;
    });
  }, [generations, activeFilters, selectedDate]);

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
        openFile(filePath, generation.output_format, fileName);
      }
    } catch (error) {
      console.error("Error opening file:", error);
      toast.error("Erreur lors de l'ouverture du fichier");
    }
  };

  // Check if any filters are active
  const hasActiveFilters =
    activeFilters.length > 0 || selectedDate !== undefined;

  // Animation variants for list items
  const listVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 260,
        damping: 20,
      },
    },
  };

  if (!user) return null;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* History header and filters */}
      {!isCollapsed && (
        <div className="mb-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground/60">
              Historique
            </h3>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-6 px-2 text-xs"
              >
                Effacer
              </Button>
            )}
          </div>

          {/* Filter grid */}
          <div className="grid grid-cols-2 gap-1">
            {filterCategories.map((category) => (
              <Button
                key={category.id}
                variant={
                  activeFilters.includes(category.id) ? "default" : "outline"
                }
                size="sm"
                onClick={() => toggleFilter(category.id)}
                className={cn(
                  "h-8 text-xs justify-center",
                  activeFilters.includes(category.id)
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                )}
              >
                {category.name}
              </Button>
            ))}
          </div>

          {/* Date picker */}
          <div className="flex justify-center mt-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={selectedDate ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "w-full h-8 text-xs justify-between",
                    selectedDate
                      ? "bg-primary text-primary-foreground"
                      : "bg-background"
                  )}
                >
                  {selectedDate
                    ? format(selectedDate, "dd/MM/yyyy", { locale: fr })
                    : "Filtrer par date"}
                  <Icon
                    icon="solar:calendar-bold-duotone"
                    className="ml-2 h-4 w-4"
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
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

      {/* Empty state - for when there are no generations or no filter results */}
      {!isLoading && !error && (
        <>
          {filteredGenerations.length === 0 && !isCollapsed && (
            <div className="text-xs text-foreground/30 ml-2">
              {generations?.length === 0
                ? "Aucune génération récente"
                : "Aucun résultat avec ces filtres"}
            </div>
          )}
        </>
      )}

      {/* List of generations - with flex-1 to take remaining space */}
      {!isLoading && filteredGenerations.length > 0 && (
        <div className="flex-1 overflow-hidden relative">
          <div className="h-full overflow-y-auto pr-2">
            <motion.div
              className="space-y-1"
              variants={listVariants}
              initial="hidden"
              animate="show"
            >
              {filteredGenerations.map((gen) => {
                const isLatestGeneration = gen.id === latestGenerationId;

                // For non-collapsed view and latest generation, render with ShinyButton
                if (!isCollapsed && isLatestGeneration) {
                  return (
                    <motion.div
                      key={gen.id}
                      variants={itemVariants as any}
                      layout
                    >
                      <ShinyButton
                        className={cn(
                          "w-full justify-start p-2 h-auto",
                          "justify-between"
                        )}
                        onMouseEnter={() => setHoveredId(gen.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        onClick={() => handleOpenFile(gen.file_path, gen.id)}
                      >
                        <div className="flex items-center gap-2">
                          <Icon
                            icon={getDocumentIcon(gen.document_type)}
                            className="h-5 w-5 text-foreground/60 flex-shrink-0"
                          />
                          <span className="text-sm font-medium truncate max-w-[120px] capitalize">
                            {getTestName(gen.sous_test)}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-xs bg-slate-100 dark:bg-slate-800 border-0 px-2 py-0 h-5"
                        >
                          {formatShortDate(gen.created_at)}
                        </Badge>
                      </ShinyButton>
                    </motion.div>
                  );
                }

                // Default button for all other cases
                return (
                  <motion.div
                    key={gen.id}
                    variants={itemVariants as any}
                    layout
                  >
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full justify-start p-2 h-auto",
                        isCollapsed ? "justify-center" : "justify-between",
                        isLatestGeneration && isCollapsed
                          ? "border border-primary"
                          : ""
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
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
}
