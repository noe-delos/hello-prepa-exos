// src/app/api/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { systemPrompt } from "./prompt"; // Importation du prompt système

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define validation schema for request body
const GenerateRequestSchema = z.object({
  userId: z.string().uuid(),
  sousTest: z.enum([
    "calcul", // Pour l'instant, on ne gère que calcul
  ]),
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
  console.log("API: Generate endpoint called");
  try {
    // Get and validate request body
    console.log("API: Parsing request body");
    const body = await request.json();
    console.log("API: Request body received:", JSON.stringify(body));

    const validationResult = GenerateRequestSchema.safeParse(body);

    if (!validationResult.success) {
      console.error(
        "API: Validation error:",
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

    console.log("API: Request validated successfully with parameters:", {
      userId,
      sousTest,
      niveau,
      variationCount,
      ineditsCount,
      correctionType,
      questionCount,
      outputFormat,
    });

    console.log("API: Initializing Supabase admin client");
    // Create Supabase client
    const supabase = createAdminClient();
    console.log("API: Supabase admin client created successfully");

    // Récupération de 20 exercices aléatoires depuis la base de données
    console.log("API: Fetching random exercises from database");
    const { data: randomExercises, error: fetchError } = await supabase
      .from(`questions_${sousTest}`)
      .select("*")
      .limit(20)
      .order("Question", { ascending: false });

    if (fetchError) {
      console.error("API: Error fetching exercises:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch exercises", details: fetchError },
        { status: 500 }
      );
    }

    console.log(
      `API: Successfully fetched ${randomExercises.length} exercises`
    );

    // Prépare les exemples d'exercices pour le prompt
    const exercisesExamples = randomExercises.map((exercise) => ({
      question: exercise.Énoncé,
      options: {
        A: exercise.A,
        B: exercise.B,
        C: exercise.C,
        D: exercise.D,
        E: exercise.E,
      },
      answer: exercise.Réponse,
      image:
        exercise.Image && exercise.Image !== "EMPTY" ? exercise.Image : null,
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
      niveau === "mixte" ? "de niveaux variés" : `de niveau ${niveau}`
    } 
                    pour le sous-test "${sousTest}" ${distributionText}. 
                    Fournir ces exercices ${correctionDescription}.
                    
                    Voici ${
                      exercisesExamples.length
                    } exemples d'exercices du type ${sousTest} pour t'inspirer:
                    ${JSON.stringify(exercisesExamples, null, 2)}
                    
                    Pour chaque exercice, inclure :
                    1. Une question claire sous forme de texte
                    2. Des options à choix multiples (A, B, C, D, E)
                    3. La réponse correcte ${
                      correctionType !== "sansCorrection"
                        ? "avec explication"
                        : ""
                    }
                    
                    Retourner le contenu dans un format JSON structuré avec ces champs :
                    - title: Un titre pour le document
                    - introduction: Texte d'introduction bref
                    - exercises: Tableau d'objets exercice avec question (string), options, réponse ${
                      correctionType !== "sansCorrection"
                        ? "et explication"
                        : ""
                    }
                    - conclusion: Texte de conclusion bref`;

    console.log("API: Calling OpenAI with prompt");
    const completion = await openai.chat.completions.create({
      model: "o3-mini", // Modèle o3 comme demandé
      messages: [
        {
          role: "system",
          content: systemPrompt, // Utilisation du prompt système
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });
    console.log("API: OpenAI response received successfully");

    let generatedContent;
    try {
      generatedContent = JSON.parse(
        completion.choices[0].message.content || "{}"
      );
      console.log("API: Parsed generated content successfully");

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

            // S'assurer que toutes les options sont présentes et sont des chaînes
            if (!exercise.options) {
              exercise.options = { A: "", B: "", C: "", D: "", E: "" };
            } else {
              ["A", "B", "C", "D", "E"].forEach((option) => {
                if (!exercise.options[option]) {
                  exercise.options[option] = "";
                } else if (typeof exercise.options[option] !== "string") {
                  exercise.options[option] = String(exercise.options[option]);
                }
              });
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
        generatedContent.title = `Exercices de Calcul TAGE MAGE - ${niveau}`;
      if (!generatedContent.introduction)
        generatedContent.introduction =
          "Voici une série d'exercices pour vous préparer à la section Calcul du TAGE MAGE.";
      if (!generatedContent.conclusion)
        generatedContent.conclusion = "Fin des exercices. Bonne préparation !";
    } catch (parseError) {
      console.error("API: Error parsing OpenAI response:", parseError);
      console.log(
        "API: Raw OpenAI response:",
        completion.choices[0].message.content
      );
      throw new Error("Failed to parse OpenAI response");
    }

    // Generate DOCX document
    console.log("API: Generating DOCX document");
    const docxEndpoint = `${request.nextUrl.origin}/api/generate/docx`;
    console.log("API: Calling DOCX endpoint:", docxEndpoint);

    const docxPayload = {
      userId,
      content: generatedContent,
      title: `${sousTest}_${niveau}_${questionCount}_questions`,
      randomExercises, // Passons également les exercices aléatoires pour être utilisés dans la génération du document
    };
    console.log("API: DOCX request payload prepared");

    const response = await fetch(docxEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(docxPayload),
    });

    console.log("API: DOCX generation response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API: Failed to generate DOCX. Response:", errorText);
      throw new Error(`Failed to generate DOCX: ${errorText}`);
    }

    const result = await response.json();
    console.log("API: DOCX generated successfully:", result);
    const documentUrl = result.url;
    const fileId = result.id;

    // Save to generations table using the original schema structure
    console.log("API: Saving generation to database:", {
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
      console.error("API: Error saving generation:", error);
      return NextResponse.json(
        { error: "Failed to save generation", details: error },
        { status: 500 }
      );
    }

    console.log("API: Generation saved successfully:", data);

    console.log("API: Request completed successfully");
    return NextResponse.json({
      success: true,
      url: documentUrl,
      fileId,
    });
  } catch (error) {
    console.error("API: Generation error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
