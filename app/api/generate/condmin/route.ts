/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

// src/app/api/generate/condmin/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { systemPrompt } from "./prompt-condmin"; // Importation du prompt spécifique

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define validation schema for request body
const GenerateRequestSchema = z.object({
  userId: z.string().uuid(),
  sousTest: z.literal("condMinimales"), // Limité uniquement à condMinimales
  niveau: z.enum(["facile", "moyen", "difficile", "mixte"]),
  variationCount: z.number().int().min(0).max(50),
  ineditsCount: z.number().int().min(0).max(50),
  correctionType: z.enum([
    "sansCorrection",
    "correctionCourte",
    "correctionDetaillee",
  ]),
  questionCount: z.number().int().min(1).max(100),
  outputFormat: z.enum(["docx"]), // Uniquement DOCX pour l'instant
});

export async function POST(request: NextRequest) {
  console.log("API CondMin: Generate endpoint called");
  try {
    // Get and validate request body
    console.log("API CondMin: Parsing request body");
    const body = await request.json();
    console.log("API CondMin: Request body received:", JSON.stringify(body));

    const validationResult = GenerateRequestSchema.safeParse(body);

    if (!validationResult.success) {
      console.error(
        "API CondMin: Validation error:",
        JSON.stringify(validationResult.error)
      );
      return NextResponse.json(
        { error: validationResult.error },
        { status: 400 }
      );
    }

    const {
      userId,
      sousTest,
      niveau,
      variationCount,
      ineditsCount,
      correctionType,
      questionCount,
      outputFormat,
    } = validationResult.data;

    console.log(
      "API CondMin: Request validated successfully with parameters:",
      {
        userId,
        sousTest,
        niveau,
        variationCount,
        ineditsCount,
        correctionType,
        questionCount,
        outputFormat,
      }
    );

    console.log("API CondMin: Initializing Supabase admin client");
    // Create Supabase client
    const supabase = createAdminClient();
    console.log("API CondMin: Supabase admin client created successfully");

    // Récupération de 20 exercices aléatoires depuis la base de données
    console.log("API CondMin: Fetching random exercises from database");
    const { data: randomExercises, error: fetchError } = await supabase
      .from("questions_condMinimales")
      .select("*")
      .limit(20)
      .order("Question", { ascending: false });

    if (fetchError) {
      console.error("API CondMin: Error fetching exercises:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch exercises", details: fetchError },
        { status: 500 }
      );
    }

    console.log(
      `API CondMin: Successfully fetched ${randomExercises.length} exercises`
    );

    // Prépare les exemples d'exercices pour le prompt
    const exercisesExamples = randomExercises.map((exercise) => ({
      question: exercise.Énoncé,
      info1: exercise.Info1,
      info2: exercise.Info2,
      answer: exercise.Réponse,
      theme:
        exercise.Thème && exercise.Thème !== "EMPTY" ? exercise.Thème : null,
    }));

    // Prepare distribution text for prompt
    const distributionText = `avec ${variationCount} variations et ${ineditsCount} inédits`;

    // Prepare correction type for prompt
    let correctionDescription;
    switch (correctionType) {
      case "sansCorrection":
        correctionDescription = "sans correction";
        break;
      case "correctionCourte":
        correctionDescription = "avec une version corrigée courte";
        break;
      case "correctionDetaillee":
        correctionDescription = "avec une correction détaillée";
        break;
    }

    // Map correctionType to document_type for database compatibility
    let documentType;
    switch (correctionType) {
      case "sansCorrection":
        documentType = "polycopie";
        break;
      case "correctionCourte":
        documentType = "fiche";
        break;
      case "correctionDetaillee":
        documentType = "examen";
        break;
    }

    // Determine part_exercice value based on which has more questions
    const partExercice =
      variationCount >= ineditsCount ? "variation" : "inedits";

    // For "mixte" niveau, we'll use "moyen" for the database to maintain compatibility
    const dbNiveau = niveau === "mixte" ? "moyen" : niveau;

    // Call OpenAI to generate exercises
    const prompt = `Générer ${questionCount} exercices ${
      niveau === "mixte" ? "de niveau varié" : `de niveau ${niveau}`
    } pour le sous-test "Conditions Minimales" ${distributionText}. 
Fournir ces exercices ${correctionDescription}.

Voici ${
      exercisesExamples.length
    } exemples d'exercices de Conditions Minimales pour t'inspirer:
${JSON.stringify(exercisesExamples, null, 2)}

RAPPEL IMPORTANT: Le format des exercices de Conditions Minimales est spécifique:
- Une question principale
- Deux informations numérotées (1) et (2) 
- La réponse identifie quelle(s) information(s) est/sont suffisante(s) pour répondre à la question

Pour chaque exercice, inclure :
1. Une question claire et directe
2. Les deux informations (info1 et info2)
3. La réponse correcte (lettre A, B, C, D ou E)
${
  correctionType !== "sansCorrection"
    ? correctionType === "correctionCourte"
      ? "4. Une courte explication (shortExplanation) qui indique brièvement le raisonnement pour déterminer la suffisance des informations"
      : "4. Une explication détaillée (explanation) qui analyse en profondeur la suffisance de chaque information"
    : ""
}

Retourner le contenu dans un format JSON structuré avec ces champs :
- title: Un titre pour le document
- introduction: Texte d'introduction bref qui explique le principe des Conditions Minimales
- exercises: Tableau d'objets exercice avec question, info1, info2, réponse ${
      correctionType !== "sansCorrection"
        ? correctionType === "correctionCourte"
          ? "et shortExplanation"
          : "et explanation"
        : ""
    }
- conclusion: Texte de conclusion bref`;

    console.log("API CondMin: Calling OpenAI with prompt");
    const completion = await openai.chat.completions.create({
      model: "o3-mini", // Modèle o3 comme demandé
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });
    console.log("API CondMin: OpenAI response received successfully");

    let generatedContent;
    try {
      generatedContent = JSON.parse(
        completion.choices[0].message.content || "{}"
      );
      console.log("API CondMin: Parsed generated content successfully");

      // Vérifier et normaliser les données si nécessaire
      if (
        generatedContent.exercises &&
        Array.isArray(generatedContent.exercises)
      ) {
        generatedContent.exercises = generatedContent.exercises.map(
          (exercise: any, _index: number) => {
            // S'assurer que la question est une chaîne
            if (typeof exercise.question !== "string") {
              exercise.question = String(exercise.question);
            }

            // Nettoyer la question pour enlever les mentions inutiles
            exercise.question = exercise.question
              .replace(/^(variation|inédit|exercice)\s+\d+[:.]\s+/i, "")
              .replace(/^(variation|inédit|exercice)\s+\d+\s+/i, "");

            // S'assurer que info1 et info2 sont présents et sont des chaînes
            if (!exercise.info1) {
              exercise.info1 = "Information 1 manquante";
            } else if (typeof exercise.info1 !== "string") {
              exercise.info1 = String(exercise.info1);
            }

            if (!exercise.info2) {
              exercise.info2 = "Information 2 manquante";
            } else if (typeof exercise.info2 !== "string") {
              exercise.info2 = String(exercise.info2);
            }

            // S'assurer que la réponse est une chaîne
            if (!exercise.answer) {
              exercise.answer = "";
            } else if (typeof exercise.answer !== "string") {
              exercise.answer = String(exercise.answer);
            }

            return exercise;
          }
        );
      }

      // S'assurer que tous les champs requis sont présents
      if (!generatedContent.title)
        generatedContent.title = `Exercices de Conditions Minimales TAGE MAGE - ${niveau}`;
      if (!generatedContent.introduction)
        generatedContent.introduction = `Voici une série d'exercices pour vous préparer à la section Conditions Minimales du TAGE MAGE. Pour chaque question, déterminez si les informations fournies sont suffisantes pour y répondre.`;
      if (!generatedContent.conclusion)
        generatedContent.conclusion = "Fin des exercices. Bonne préparation !";
    } catch (parseError) {
      console.error("API CondMin: Error parsing OpenAI response:", parseError);
      console.log(
        "API CondMin: Raw OpenAI response:",
        completion.choices[0].message.content
      );
      throw new Error("Failed to parse OpenAI response");
    }

    // Generate DOCX document
    console.log("API CondMin: Generating DOCX document");
    const docxEndpoint = `${request.nextUrl.origin}/api/generate/condmin/docx`;
    console.log("API CondMin: Calling DOCX endpoint:", docxEndpoint);

    const docxPayload = {
      userId,
      content: generatedContent,
      title: `${sousTest}_${niveau}_${questionCount}_questions`,
      correctionType,
      randomExercises,
    };
    console.log("API CondMin: DOCX request payload prepared");

    const response = await fetch(docxEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(docxPayload),
    });

    console.log(
      "API CondMin: DOCX generation response status:",
      response.status
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "API CondMin: Failed to generate DOCX. Response:",
        errorText
      );
      throw new Error(`Failed to generate DOCX: ${errorText}`);
    }

    const result = await response.json();
    console.log("API CondMin: DOCX generated successfully:", result);
    const documentUrl = result.url;
    const fileId = result.id;

    // Save to generations table using the original schema structure
    console.log("API CondMin: Saving generation to database:", {
      user_id: userId,
      sous_test: sousTest,
      niveau: dbNiveau,
      part_exercice: partExercice,
      document_type: documentType,
      question_count: questionCount,
      output_format: outputFormat,
      file_path: documentUrl,
    });

    const { data, error } = await supabase
      .from("generations")
      .insert({
        user_id: userId,
        sous_test: sousTest,
        niveau: dbNiveau,
        part_exercice: partExercice,
        document_type: documentType,
        question_count: questionCount,
        output_format: outputFormat,
        file_path: documentUrl,
      })
      .select();

    if (error) {
      console.error("API CondMin: Error saving generation:", error);
      return NextResponse.json(
        { error: "Failed to save generation", details: error },
        { status: 500 }
      );
    }

    console.log("API CondMin: Generation saved successfully:", data);

    console.log("API CondMin: Request completed successfully");
    return NextResponse.json({
      success: true,
      url: documentUrl,
      fileId,
    });
  } catch (error) {
    console.error("API CondMin: Generation error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
