/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react/no-unescaped-entities */

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

export default function QuestionGenerator({ user }: any) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isOpen: isPanelOpen } = useFileViewer();
  const greeting = user?.name ? `Bonjour ${user.name} !` : "Bonjour";

  // Loading state
  const [isGenerating, setIsGenerating] = useState(false);

  // State for form values
  const [formState, setFormState] = useState({
    sousTest: "condMinimales",
    niveau: "difficile",
    partExercice: "inedits",
    documentType: "polycopie",
    questionCount: 20,
    outputFormat: "pdf",
  });

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

    // Save
    localStorage.setItem("formState", JSON.stringify(formState));

    // Start loading state
    setIsGenerating(true);

    // Show loading toast
    const toastId = toast.loading("Génération du document en cours...");

    try {
      // Call generate API with user ID
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          ...formState,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Une erreur est survenue lors de la génération"
        );
      }

      const data = await response.json();

      // Success toast
      toast.success("Document généré avec succès!", {
        id: toastId,
        description:
          "Vous pouvez télécharger le document ou le consulter dans votre historique.",
        action: {
          label: "Télécharger",
          onClick: () => window.open(data.url, "_blank"),
        },
      });

      // Invalidate the generations query to refresh the sidebar
      queryClient.invalidateQueries({ queryKey: ["generations"] });
    } catch (error) {
      console.error("Generation error:", error);

      // Error toast
      toast.error("Erreur lors de la génération", {
        id: toastId,
        description:
          error instanceof Error ? error.message : "Une erreur est survenue",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Update form state handlers
  const handleSousTestChange = (value: any) => {
    setFormState((prev) => ({ ...prev, sousTest: value }));
  };

  const handleNiveauChange = (value: any) => {
    setFormState((prev) => ({ ...prev, niveau: value }));
  };

  const handlePartExerciceChange = (value: any) => {
    setFormState((prev) => ({ ...prev, partExercice: value }));
  };

  const handleQuestionCountChange = (value: any) => {
    setFormState((prev) => ({
      ...prev,
      questionCount: typeof value === "number" ? value : parseInt(value) || 20,
    }));
  };

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
                isPanelOpen ? "grid-cols-1" : "grid-cols-1 md:grid-cols-3"
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
                      Raisonnement
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
                    <div className="h-5 w-5 rounded-full border border-gray-300 flex items-center justify-center cursor-not-allowed opacity-50">
                      <input
                        type="radio"
                        id="expression"
                        name="sous-test"
                        value="expression"
                        className="sr-only"
                        disabled
                      />
                      <div className="h-3 w-3 rounded-full"></div>
                    </div>
                    <span className="flex items-center">
                      Expression
                      <Badge variant="outline" className="ml-2 text-xs">
                        Bientôt disponible
                      </Badge>
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 rounded-full border border-gray-300 flex items-center justify-center cursor-not-allowed opacity-50">
                      <input
                        type="radio"
                        id="logique"
                        name="sous-test"
                        value="logique"
                        className="sr-only"
                        disabled
                      />
                      <div className="h-3 w-3 rounded-full"></div>
                    </div>
                    <span className="flex items-center">
                      Logique
                      <Badge variant="outline" className="ml-2 text-xs">
                        Bientôt disponible
                      </Badge>
                    </span>
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
                    isPanelOpen ? "grid grid-cols-3 gap-2" : "space-y-3"
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
                </CardContent>
              </Card>

              {/* Part d'exercice */}
              <Card className="border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Part d'exercice</CardTitle>
                </CardHeader>
                <CardContent
                  className={cn(
                    isPanelOpen ? "grid grid-cols-2 gap-2" : "space-y-3"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-5 w-5 rounded-full border border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handlePartExerciceChange("variation")}
                    >
                      <input
                        type="radio"
                        id="variation"
                        name="part-exercice"
                        value="variation"
                        className="sr-only"
                        checked={formState.partExercice === "variation"}
                        onChange={() => {}}
                      />
                      <div
                        className={cn(
                          "h-3 w-3 rounded-full",
                          formState.partExercice === "variation"
                            ? "bg-[#FFE245]"
                            : ""
                        )}
                      ></div>
                    </div>
                    <label
                      htmlFor="variation"
                      onClick={() => handlePartExerciceChange("variation")}
                    >
                      Variation
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className="h-5 w-5 rounded-full border border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handlePartExerciceChange("inedits")}
                    >
                      <input
                        type="radio"
                        id="inedits"
                        name="part-exercice"
                        value="inedits"
                        className="sr-only"
                        checked={formState.partExercice === "inedits"}
                        onChange={() => {}}
                      />
                      <div
                        className={cn(
                          "h-3 w-3 rounded-full",
                          formState.partExercice === "inedits"
                            ? "bg-[#FFE245]"
                            : ""
                        )}
                      ></div>
                    </div>
                    <label
                      htmlFor="inedits"
                      onClick={() => handlePartExerciceChange("inedits")}
                    >
                      Inédits
                    </label>
                  </div>
                </CardContent>
              </Card>
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
                    ? "grid-cols-1 md:grid-cols-3"
                    : "grid-cols-1 md:grid-cols-3"
                )}
              >
                <div className="space-y-3">
                  <Label htmlFor="format-select" className="text-base">
                    Type de document
                  </Label>
                  <Select
                    value={formState.documentType}
                    onValueChange={(value) =>
                      setFormState((prev) => ({ ...prev, documentType: value }))
                    }
                  >
                    <SelectTrigger id="format-select" className="h-10">
                      <SelectValue placeholder="Sélectionner un format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="polycopie">Polycopié</SelectItem>
                      <SelectItem value="fiche">Fiche</SelectItem>
                      <SelectItem value="examen">Examen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="question-count" className="text-base">
                    Nombre de questions
                  </Label>
                  <div className="flex gap-4 items-center">
                    <Slider
                      id="question-slider"
                      value={[formState.questionCount]}
                      max={100}
                      min={1}
                      step={1}
                      className="w-full"
                      onValueChange={(value) =>
                        handleQuestionCountChange(value[0])
                      }
                    />
                    <Input
                      id="question-count"
                      type="number"
                      min={1}
                      max={100}
                      value={formState.questionCount}
                      onChange={(e) =>
                        handleQuestionCountChange(e.target.value)
                      }
                      className="w-16 text-center"
                    />
                  </div>
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
                      <SelectItem value="pdf">PDF</SelectItem>
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
                disabled={isGenerating}
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
