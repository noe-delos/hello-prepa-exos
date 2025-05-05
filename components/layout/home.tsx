/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useFileViewer } from "@/context/file-viewer-context";
import ShimmeringTitle from "../ui/animated-shiny-text";
import confetti from "canvas-confetti";
import { Icon } from "@iconify/react";
import { revalidateHistoryList } from "@/actions/list";

// Custom loading toast component
const GenerationProgressToast = ({ questionCount }: any) => {
  // Calculate estimated time (approx 7 seconds per exercise)
  const estimatedTimeSeconds = questionCount * 7;
  const estimatedMinutes = Math.ceil(estimatedTimeSeconds / 60);

  return (
    <div className="relative flex w-full min-w-[27rem] shadow-sm cursor-default items-center gap-3 rounded-xl border border-border bg-background p-4 pl-1">
      <div className="item flex flex-1 flex-col items-start justify-start gap-0 pl-4">
        <p className="max-w-sm truncate text-sm font-medium text-gray-900">
          Génération des exercices
        </p>
        <div className="h-fit text-sm text-gray-500">
          <ShimmeringTitle className="self-left z-0 flex h-fit cursor-default flex-row items-center text-foreground/80">
            Cette opération peut prendre plusieurs minutes (est~{" "}
            {estimatedMinutes}m)
          </ShimmeringTitle>
        </div>
      </div>
    </div>
  );
};

// Function to trigger confetti on success
const triggerConfetti = () => {
  const end = Date.now() + 1 * 1000; // 1.5 seconds
  const colors = ["#a786ff", "#fd8bbc", "#eca184", "#f8deb1"];

  const frame = () => {
    if (Date.now() > end) return;

    confetti({
      particleCount: 2,
      angle: 60,
      spread: 55,
      startVelocity: 60,
      origin: { x: 0, y: 0.5 },
      colors: colors,
    });

    confetti({
      particleCount: 2,
      angle: 120,
      spread: 55,
      startVelocity: 60,
      origin: { x: 1, y: 0.5 },
      colors: colors,
    });

    requestAnimationFrame(frame);
  };

  frame();
};

export default function QuestionGenerator({ user }: any) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isOpen: isPanelOpen } = useFileViewer();
  const greeting = user?.name ? `Bonjour ${user.name} !` : "Bonjour";

  // Loading state
  const [isGenerating, setIsGenerating] = useState(false);

  // State for form values
  const [formState, setFormState] = useState({
    sousTest: "calcul",
    niveau: "difficile",
    variationCount: 10,
    ineditsCount: 10,
    correctionType: "sansCorrection",
    outputFormat: "docx",
    llmModel: "openai", // New field for LLM model selection
    optionsCount: 5, // New field for number of options (A-E by default)
  });

  // Calculated total question count (changes based on sous-test)
  const getTotalQuestionCount = () => {
    if (formState.sousTest === "comprehension") {
      // Pour Compréhension: variationCount = nombre de textes, ineditsCount = nombre de questions par texte
      return formState.variationCount * formState.ineditsCount;
    } else {
      // Pour les autres sous-tests: somme simple des variations et inédits
      return formState.variationCount + formState.ineditsCount;
    }
  };

  const totalQuestionCount = getTotalQuestionCount();

  // Load saved preferences from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem("formState");
    if (savedState) {
      try {
        const parsedState = JSON.parse(savedState);
        setFormState((prevState) => ({
          ...prevState,
          ...parsedState,
        }));
      } catch (error) {
        console.error("Error parsing saved form state:", error);
      }
    }
  }, []);

  // Save preferences to localStorage and trigger generation
  const generateDocument = async () => {
    if (!user || !user.id) {
      toast.error("Vous devez être connecté pour générer un document");
      return;
    }

    if (totalQuestionCount === 0) {
      toast.error("Veuillez sélectionner au moins une question");
      return;
    }

    // Save
    localStorage.setItem("formState", JSON.stringify(formState));

    // Start loading state
    setIsGenerating(true);

    // Show custom loading toast with the shimmer effect
    const toastId = toast.custom(
      () => <GenerationProgressToast questionCount={totalQuestionCount} />,
      { id: "generation-progress", duration: Infinity }
    );

    try {
      // Determine which API endpoint to call based on the sous-test
      let apiEndpoint;
      if (formState.sousTest === "condMinimales") {
        apiEndpoint = "/api/generate/condmin";
      } else if (formState.sousTest === "comprehension") {
        apiEndpoint = "/api/generate/comprehension";
      } else {
        apiEndpoint = "/api/generate";
      }

      // Call generate API with user ID
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          sousTest: formState.sousTest,
          niveau: formState.niveau,
          variationCount: formState.variationCount,
          ineditsCount: formState.ineditsCount,
          correctionType: formState.correctionType,
          outputFormat: formState.outputFormat,
          questionCount: totalQuestionCount,
          llmModel: formState.llmModel, // Pass selected LLM model
          optionsCount: formState.optionsCount, // Pass number of options
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Une erreur est survenue lors de la génération"
        );
      }

      const data = await response.json();

      // Dismiss the custom toast
      toast.dismiss("generation-progress");

      // Trigger confetti effect
      triggerConfetti();

      // Custom success toast with green styling and icons
      toast.custom(
        () => (
          <div className="relative flex w-full min-w-[27rem] shadow-sm cursor-default items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 pl-1">
            <div className="flex items-center justify-center pl-3">
              <Icon
                icon="icon-park-solid:check-one"
                className="h-6 w-6 text-emerald-600"
              />
            </div>
            <div className="item flex flex-1 flex-col items-start justify-start gap-0 pl-2">
              <p className="max-w-sm truncate text-sm font-medium text-gray-900">
                Document généré avec succès!
              </p>
              <div className="h-fit text-sm text-gray-500">
                Vous pouvez télécharger le document.
              </div>
            </div>
            <div className="flex items-center pr-2">
              <button
                onClick={() => window.open(data.url, "_blank")}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black text-white hover:bg-gray-800 transition-colors"
              >
                <Icon icon="mdi:download" className="h-4 w-4" />
              </button>
            </div>
          </div>
        ),
        {
          duration: 10000,
        }
      );

      // Invalidate the generations query to refresh the sidebar
      queryClient.invalidateQueries({ queryKey: ["generations"] });

      // Force revalidate the path to ensure UI updates
      await revalidateHistoryList();
    } catch (error) {
      console.error("Generation error:", error);

      // Dismiss the custom toast
      toast.dismiss("generation-progress");

      // Error toast
      toast.error("Erreur lors de la génération", {
        description:
          error instanceof Error ? error.message : "Une erreur est survenue",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Update form state handlers
  const handleSousTestChange = (value: any) => {
    // Réinitialiser les valeurs par défaut en fonction du sous-test
    if (value === "comprehension") {
      setFormState((prev) => ({
        ...prev,
        sousTest: value,
        variationCount: 2, // Nombre de textes par défaut
        ineditsCount: 5, // Nombre de questions par texte par défaut
      }));
    } else {
      setFormState((prev) => ({ ...prev, sousTest: value }));
    }
  };

  const handleNiveauChange = (value: any) => {
    setFormState((prev) => ({ ...prev, niveau: value }));
  };

  const handleVariationCountChange = (value: any) => {
    const numValue = typeof value === "number" ? value : parseInt(value) || 0;
    setFormState((prev) => ({
      ...prev,
      variationCount: numValue,
    }));
  };

  const handleIneditsCountChange = (value: any) => {
    const numValue = typeof value === "number" ? value : parseInt(value) || 0;
    setFormState((prev) => ({
      ...prev,
      ineditsCount: numValue,
    }));
  };

  // Déterminer les étiquettes des sliders en fonction du sous-test
  const getSliderLabels = () => {
    if (formState.sousTest === "comprehension") {
      return {
        variation: "Nombre de textes",
        inedits: "Questions par texte",
        total: "Total",
      };
    } else {
      return {
        variation: "Nombre de variations",
        inedits: "Nombre d'inédits",
        total: "Nombre total de questions",
      };
    }
  };

  const sliderLabels = getSliderLabels();

  return (
    <div
      className={cn(
        "space-y-6 w-full mx-auto p-4 transition-all duration-300",
        isPanelOpen ? "max-w-full" : "max-w-7xl"
      )}
    >
      <div className="flex justify-center items-center pb-3">
        <h1 className="text-[2rem] font-bold">{greeting}</h1>
      </div>

      {/* New section for AI model selection */}
      {user?.id === "3b087056-69cb-4ecc-a380-5e1509758a75" && (
        <Card className="border-0 shadow-none">
          <CardContent className="p-6 pt-0 shadow-none">
            <h3 className="font-medium text-lg bg-zinc-100 p-3 py-2 rounded-lg">
              Options beta
            </h3>
            <div className="pt-4 flex items-center gap-4">
              <Select
                value={formState.llmModel}
                onValueChange={(value) =>
                  setFormState((prev) => ({ ...prev, llmModel: value }))
                }
              >
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Sélectionner un modèle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai" className="flex items-center">
                    <div className="flex items-center">
                      <Icon icon="logos:openai-icon" className="mr-2 h-5 w-5" />
                      <span>OpenAI (o3-mini)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="claude" className="flex items-center">
                    <div className="flex items-center">
                      <Icon
                        icon="simple-icons:anthropic"
                        className="mr-2 h-5 w-5"
                      />
                      <span>Claude (3.7 Sonnet)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={formState.optionsCount.toString()}
                onValueChange={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    optionsCount: parseInt(value),
                  }))
                }
              >
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Nombre d'options" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 options (A-C)</SelectItem>
                  <SelectItem value="4">4 options (A-D)</SelectItem>
                  <SelectItem value="5">5 options (A-E)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-none">
        <CardContent className="p-6 pt-0 shadow-none">
          <h3 className="font-medium text-lg bg-zinc-100 p-3 py-2 rounded-lg">
            Type de question
          </h3>
          <div className="space-y-8 pt-6">
            {/* Section Sous-test et Niveau - Changes to single column when panel is open */}
            <div
              className={cn(
                "grid gap-4 lg:gap-8",
                isPanelOpen ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"
              )}
            >
              {/* Sous-test */}
              <Card className="border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Sous-test</CardTitle>
                </CardHeader>
                <CardContent
                  className={cn(
                    isPanelOpen ? "grid grid-cols-2 gap-2" : "space-y-3"
                  )}
                >
                  {/* Option Compréhension - maintenant activée */}
                  <div className="flex items-center gap-3">
                    <div
                      className="h-5 w-5 rounded-full border border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSousTestChange("comprehension")}
                    >
                      <input
                        type="radio"
                        id="comprehension"
                        name="sous-test"
                        value="comprehension"
                        className="sr-only"
                        checked={formState.sousTest === "comprehension"}
                        onChange={() => {}}
                      />
                      <div
                        className={cn(
                          "h-3 w-3 rounded-full",
                          formState.sousTest === "comprehension"
                            ? "bg-[#FFE245]"
                            : ""
                        )}
                      ></div>
                    </div>
                    <label
                      htmlFor="comprehension"
                      onClick={() => handleSousTestChange("comprehension")}
                    >
                      Compréhension
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-5 w-5 rounded-full border border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSousTestChange("calcul")}
                    >
                      <input
                        type="radio"
                        id="calcul"
                        name="sous-test"
                        value="calcul"
                        className="sr-only"
                        checked={formState.sousTest === "calcul"}
                        onChange={() => {}}
                      />
                      <div
                        className={cn(
                          "h-3 w-3 rounded-full",
                          formState.sousTest === "calcul" ? "bg-[#FFE245]" : ""
                        )}
                      ></div>
                    </div>
                    <label
                      htmlFor="calcul"
                      onClick={() => handleSousTestChange("calcul")}
                    >
                      Calcul
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-5 w-5 rounded-full border border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSousTestChange("raisonnement")}
                    >
                      <input
                        type="radio"
                        id="raisonnement"
                        name="sous-test"
                        value="raisonnement"
                        className="sr-only"
                        checked={formState.sousTest === "raisonnement"}
                        onChange={() => {}}
                      />
                      <div
                        className={cn(
                          "h-3 w-3 rounded-full",
                          formState.sousTest === "raisonnement"
                            ? "bg-[#FFE245]"
                            : ""
                        )}
                      ></div>
                    </div>
                    <label
                      htmlFor="raisonnement"
                      onClick={() => handleSousTestChange("raisonnement")}
                    >
                      Raisonnement / Argumentation
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-5 w-5 rounded-full border border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSousTestChange("condMinimales")}
                    >
                      <input
                        type="radio"
                        id="condMinimales"
                        name="sous-test"
                        value="condMinimales"
                        className="sr-only"
                        checked={formState.sousTest === "condMinimales"}
                        onChange={() => {}}
                      />
                      <div
                        className={cn(
                          "h-3 w-3 rounded-full",
                          formState.sousTest === "condMinimales"
                            ? "bg-[#FFE245]"
                            : ""
                        )}
                      ></div>
                    </div>
                    <label
                      htmlFor="condMinimales"
                      onClick={() => handleSousTestChange("condMinimales")}
                    >
                      Cond. Minimales
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 rounded-full border border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="radio"
                        id="comprehension"
                        name="sous-test"
                        value="comprehension"
                        className="sr-only"
                        onChange={() => {}}
                        disabled
                      />
                      <div className={cn("h-3 w-3 rounded-full")}></div>
                    </div>
                    <label
                      htmlFor="comprehension"
                      className="cursor-not-allowed opacity-50"
                    >
                      Expression
                      <Badge variant="outline" className="ml-2 text-xs">
                        Bientôt disponible
                      </Badge>
                    </label>
                  </div>
                </CardContent>
              </Card>

              {/* Niveau */}
              <Card className="border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Niveau</CardTitle>
                </CardHeader>
                <CardContent
                  className={cn(
                    isPanelOpen ? "grid grid-cols-5 gap-2" : "space-y-3"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-5 w-5 rounded-full border border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleNiveauChange("facile")}
                    >
                      <input
                        type="radio"
                        id="facile"
                        name="niveau"
                        value="facile"
                        className="sr-only"
                        checked={formState.niveau === "facile"}
                        onChange={() => {}}
                      />
                      <div
                        className={cn(
                          "h-3 w-3 rounded-full",
                          formState.niveau === "facile" ? "bg-[#FFE245]" : ""
                        )}
                      ></div>
                    </div>
                    <label
                      htmlFor="facile"
                      onClick={() => handleNiveauChange("facile")}
                    >
                      Facile
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-5 w-5 rounded-full border border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleNiveauChange("moyen")}
                    >
                      <input
                        type="radio"
                        id="moyen"
                        name="niveau"
                        value="moyen"
                        className="sr-only"
                        checked={formState.niveau === "moyen"}
                        onChange={() => {}}
                      />
                      <div
                        className={cn(
                          "h-3 w-3 rounded-full",
                          formState.niveau === "moyen" ? "bg-[#FFE245]" : ""
                        )}
                      ></div>
                    </div>
                    <label
                      htmlFor="moyen"
                      onClick={() => handleNiveauChange("moyen")}
                    >
                      Moyen
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-5 w-5 rounded-full border border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleNiveauChange("difficile")}
                    >
                      <input
                        type="radio"
                        id="difficile"
                        name="niveau"
                        value="difficile"
                        className="sr-only"
                        checked={formState.niveau === "difficile"}
                        onChange={() => {}}
                      />
                      <div
                        className={cn(
                          "h-3 w-3 rounded-full",
                          formState.niveau === "difficile" ? "bg-[#FFE245]" : ""
                        )}
                      ></div>
                    </div>
                    <label
                      htmlFor="difficile"
                      onClick={() => handleNiveauChange("difficile")}
                    >
                      Difficile
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-5 w-5 rounded-full border border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleNiveauChange("tresDifficile")}
                    >
                      <input
                        type="radio"
                        id="tresDifficile"
                        name="niveau"
                        value="tresDifficile"
                        className="sr-only"
                        checked={formState.niveau === "tresDifficile"}
                        onChange={() => {}}
                      />
                      <div
                        className={cn(
                          "h-3 w-3 rounded-full",
                          formState.niveau === "tresDifficile"
                            ? "bg-[#FFE245]"
                            : ""
                        )}
                      ></div>
                    </div>
                    <label
                      htmlFor="tresDifficile"
                      onClick={() => handleNiveauChange("tresDifficile")}
                    >
                      Très difficile
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-5 w-5 rounded-full border border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleNiveauChange("mixte")}
                    >
                      <input
                        type="radio"
                        id="mixte"
                        name="niveau"
                        value="mixte"
                        className="sr-only"
                        checked={formState.niveau === "mixte"}
                        onChange={() => {}}
                      />
                      <div
                        className={cn(
                          "h-3 w-3 rounded-full",
                          formState.niveau === "mixte" ? "bg-[#FFE245]" : ""
                        )}
                      ></div>
                    </div>
                    <label
                      htmlFor="mixte"
                      onClick={() => handleNiveauChange("mixte")}
                    >
                      Mixte
                    </label>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Questions distribution section */}
            <div className="space-y-6">
              <h3 className="font-medium text-lg bg-zinc-100 p-3 py-2 rounded-lg">
                {formState.sousTest === "comprehension"
                  ? "Répartition des textes et questions"
                  : "Répartition des questions"}
              </h3>
              <div
                className={cn(
                  "grid gap-4 lg:gap-8",
                  isPanelOpen
                    ? "grid-cols-1 md:grid-cols-2"
                    : "grid-cols-1 md:grid-cols-2"
                )}
              >
                {/* Variations ou Textes */}
                <div className="space-y-3">
                  <Label htmlFor="variation-count" className="text-base">
                    {sliderLabels.variation}
                  </Label>
                  <div className="flex gap-4 items-center">
                    <Slider
                      id="variation-slider"
                      value={[formState.variationCount]}
                      max={formState.sousTest === "comprehension" ? 10 : 50}
                      min={formState.sousTest === "comprehension" ? 1 : 0}
                      step={1}
                      className="w-full"
                      onValueChange={(value) =>
                        handleVariationCountChange(value[0])
                      }
                    />
                    <Input
                      id="variation-count"
                      type="number"
                      min={formState.sousTest === "comprehension" ? 1 : 0}
                      max={formState.sousTest === "comprehension" ? 10 : 50}
                      value={formState.variationCount}
                      onChange={(e) =>
                        handleVariationCountChange(e.target.value)
                      }
                      className="w-16 text-center"
                    />
                  </div>
                </div>

                {/* Inédits ou Questions par texte */}
                <div className="space-y-3">
                  <Label htmlFor="inedits-count" className="text-base">
                    {sliderLabels.inedits}
                  </Label>
                  <div className="flex gap-4 items-center">
                    <Slider
                      id="inedits-slider"
                      value={[formState.ineditsCount]}
                      max={formState.sousTest === "comprehension" ? 10 : 50}
                      min={formState.sousTest === "comprehension" ? 1 : 0}
                      step={1}
                      className="w-full"
                      onValueChange={(value) =>
                        handleIneditsCountChange(value[0])
                      }
                    />
                    <Input
                      id="inedits-count"
                      type="number"
                      min={formState.sousTest === "comprehension" ? 1 : 0}
                      max={formState.sousTest === "comprehension" ? 10 : 50}
                      value={formState.ineditsCount}
                      onChange={(e) => handleIneditsCountChange(e.target.value)}
                      className="w-16 text-center"
                    />
                  </div>
                </div>
              </div>

              <div className="text-center font-medium">
                {formState.sousTest === "comprehension"
                  ? `Nombre total de questions : ${totalQuestionCount} (${formState.variationCount} textes × ${formState.ineditsCount} questions par texte)`
                  : `Nombre total de questions : ${totalQuestionCount}`}
              </div>
            </div>

            {/* Format section */}
            <div className="space-y-6">
              <h3 className="font-medium text-lg bg-zinc-100 p-3 py-2 rounded-lg">
                Format
              </h3>
              <div
                className={cn(
                  "grid gap-4 lg:gap-8",
                  isPanelOpen
                    ? "grid-cols-1 md:grid-cols-2"
                    : "grid-cols-1 md:grid-cols-2"
                )}
              >
                <div className="space-y-3">
                  <Label htmlFor="correction-type" className="text-base">
                    Type de correction
                  </Label>
                  <Select
                    value={formState.correctionType}
                    onValueChange={(value) =>
                      setFormState((prev) => ({
                        ...prev,
                        correctionType: value,
                      }))
                    }
                  >
                    <SelectTrigger id="correction-type" className="h-10">
                      <SelectValue placeholder="Sélectionner un type de correction" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sansCorrection">
                        Pas de correction
                      </SelectItem>
                      <SelectItem value="correctionCourte">
                        Version corrigée courte
                      </SelectItem>
                      <SelectItem value="correctionDetaillee">
                        Correction détaillée
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="output-format" className="text-base">
                    Format de sortie
                  </Label>
                  <Select
                    value={formState.outputFormat}
                    onValueChange={(value) =>
                      setFormState((prev) => ({ ...prev, outputFormat: value }))
                    }
                  >
                    <SelectTrigger id="output-format" className="h-10">
                      <SelectValue placeholder="Format de sortie" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Désactivation temporaire du PDF */}
                      {/* <SelectItem value="pdf">PDF</SelectItem> */}
                      <SelectItem value="docx">DOCX</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex justify-center pt-4">
              <Button
                size="lg"
                className="px-16 py-6 text-lg font-medium bg-amber-500 hover:bg-amber-600"
                onClick={generateDocument}
                disabled={isGenerating || totalQuestionCount === 0}
              >
                {isGenerating ? "Génération en cours..." : "Générer"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
