/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

// src/app/api/generate/condmin/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { systemPrompt } from "./prompt-condmin"; // Importation du prompt spécifique

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Anthropic
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 900000,
});

// Define validation schema for request body
const GenerateRequestSchema = z.object({
  userId: z.string().uuid(),
  sousTest: z.literal("condMinimales"), // Limité uniquement à condMinimales
  niveau: z.enum(["facile", "moyen", "difficile", "tresDifficile", "mixte"]),
  variationCount: z.number().int().min(0).max(50),
  ineditsCount: z.number().int().min(0).max(50),
  correctionType: z.enum([
    "sansCorrection",
    "correctionCourte",
    "correctionDetaillee",
  ]),
  questionCount: z.number().int().min(1).max(100),
  outputFormat: z.enum(["docx"]), // Uniquement DOCX pour l'instant
  llmModel: z.enum(["openai", "claude"]).default("openai"),
  optionsCount: z.number().int().min(2).max(5).default(5),
  selectedThemes: z.array(z.string()).min(1), // At least one theme must be selected
});

// Schema to validate the generated content structure
const GeneratedContentSchema = z.object({
  title: z.string(),
  introduction: z.string(),
  exercises: z.array(
    z.object({
      question: z.string(),
      info1: z.string(),
      info2: z.string(),
      answer: z.string(),
      explanation: z.string().optional(),
      shortExplanation: z.string().optional(),
      theme: z.string().optional(), // Optional theme field
    })
  ),
  conclusion: z.string(),
});

// Helper function to extract JSON from text
function extractJSON(text: string): string {
  console.log("API CondMin: Attempting to extract JSON from text");

  // Check if response is wrapped in a code block
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    console.log("API CondMin: Found JSON in code block");
    return jsonMatch[1].trim();
  }

  // Remove any text before or after the JSON object
  const jsonObjectMatch = text.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch) {
    console.log("API CondMin: Found JSON object in text");
    return jsonObjectMatch[0];
  }

  console.log("API CondMin: No JSON pattern found, returning original text");
  return text;
}

// Helper function to validate and fix content structure
function validateAndFixContent(
  content: any,
  selectedThemes: string[],
  niveau: string
) {
  console.log("API CondMin: Validating and fixing content structure");

  // Ensure all required fields are present
  if (!content.title) {
    content.title = `Exercices de Conditions Minimales TAGE MAGE - ${niveau}`;
  }
  if (!content.introduction) {
    content.introduction = `Voici une série d'exercices pour vous préparer à la section Conditions Minimales du TAGE MAGE. Pour chaque question, déterminez quelle(s) information(s) est/sont suffisante(s) pour y répondre.`;
  }
  if (!content.conclusion) {
    content.conclusion = "Fin des exercices. Bonne préparation !";
  }

  // Ensure exercises is an array
  if (!content.exercises || !Array.isArray(content.exercises)) {
    console.log("API CondMin: No valid exercises array found");
    content.exercises = [];
  }

  // Normalize and clean up the exercises
  content.exercises = content.exercises.map((exercise: any, index: number) => {
    console.log(`API CondMin: Processing exercise ${index + 1}`);

    // Ensure question is a string
    if (typeof exercise.question !== "string") {
      exercise.question = String(exercise.question || "");
    }

    // Clean up the question to remove unnecessary mentions
    exercise.question = exercise.question
      .replace(/^(variation|inédit|exercice)\s+\d+[:.]\s+/i, "")
      .replace(/^(variation|inédit|exercice)\s+\d+\s+/i, "");

    // Ensure info1 and info2 are present and are strings
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

    // Ensure answer is a string
    if (!exercise.answer) {
      exercise.answer = "A"; // Default answer
    } else if (typeof exercise.answer !== "string") {
      exercise.answer = String(exercise.answer);
    }

    // Ensure answer is a valid option (A-E)
    if (!["A", "B", "C", "D", "E"].includes(exercise.answer)) {
      exercise.answer = "A";
    }

    // Ensure theme is present and valid
    if (!exercise.theme || typeof exercise.theme !== "string") {
      // Assign a random theme from selected themes
      exercise.theme =
        selectedThemes[Math.floor(Math.random() * selectedThemes.length)];
    } else if (!selectedThemes.includes(exercise.theme)) {
      // If theme is not in selected themes, reassign
      exercise.theme =
        selectedThemes[Math.floor(Math.random() * selectedThemes.length)];
    }

    return exercise;
  });

  return content;
}

// Helper function to call Claude with streaming
async function callClaudeWithStreaming(
  prompt: string,
  systemPrompt: string
): Promise<string> {
  console.log("API CondMin: Starting Claude streaming call");

  let accumulatedResponse = "";
  let thinkingContent = "";
  let mainContent = "";

  try {
    const stream = await anthropic.messages.create({
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 20000,
      temperature: 1,
      system:
        systemPrompt +
        "\n\nIMPORTANT: Ta réponse doit être un objet JSON valide et complet, sans texte supplémentaire avant ou après le JSON.",
      messages: [{ role: "user", content: prompt }],
      stream: true,
    });

    console.log("API CondMin: Claude stream created, processing chunks");

    for await (const chunk of stream as any) {
      if (chunk.type === "content_block_start") {
        console.log(
          `API CondMin: Content block started - Index: ${chunk.index}, Type: ${chunk.content_block.type}`
        );
      } else if (chunk.type === "content_block_delta") {
        if (chunk.index === 0) {
          // This is the thinking content
          thinkingContent += chunk.delta.text;
        } else if (chunk.index === 1) {
          // This is the main response content
          mainContent += chunk.delta.text;
          accumulatedResponse += chunk.delta.text;
        }
      } else if (chunk.type === "content_block_stop") {
        console.log(
          `API CondMin: Content block stopped - Index: ${chunk.index}`
        );
      }
    }

    console.log("API CondMin: Streaming completed");
    console.log(
      `API CondMin: Thinking content length: ${thinkingContent.length}`
    );
    console.log(`API CondMin: Main content length: ${mainContent.length}`);

    return mainContent;
  } catch (error) {
    console.error("API CondMin: Error during streaming:", error);
    throw error;
  }
}

// Helper function to call Claude without streaming for JSON validation
async function callClaudeForJSONValidation(
  invalidJSON: string,
  error: string,
  selectedThemes: string[]
): Promise<string> {
  console.log("API CondMin: Calling Claude for JSON validation");

  const validationPrompt = `Le JSON suivant est invalide ou mal formaté:

${invalidJSON}

Erreur rencontrée: ${error}

Corrige ce JSON pour qu'il soit valide et respecte exactement cette structure:
{
  "title": "string",
  "introduction": "string",
  "exercises": [
    {
      "question": "string",
      "info1": "string",
      "info2": "string",
      "answer": "string (A, B, C, D ou E)",
      "theme": "string (un des thèmes suivants: ${selectedThemes.join(", ")})",
      "explanation": "string (optionnel)",
      "shortExplanation": "string (optionnel)"
    }
  ],
  "conclusion": "string"
}

IMPORTANT: Retourne UNIQUEMENT le JSON corrigé, sans aucun texte avant ou après.`;

  const msg: any = await anthropic.messages.create({
    model: "claude-3-7-sonnet-20250219",
    max_tokens: 20000,
    temperature: 0.3,
    system:
      "Tu es un expert en correction de JSON. Retourne uniquement du JSON valide sans aucun texte supplémentaire.",
    messages: [{ role: "user", content: validationPrompt }],
  });

  console.log("API CondMin: Claude JSON validation response received");
  return msg.content[1].text || "{}";
}

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
      llmModel,
      optionsCount,
      selectedThemes,
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
        llmModel,
        optionsCount,
        selectedThemes,
      }
    );

    console.log("API CondMin: Initializing Supabase admin client");
    // Create Supabase client
    const supabase = createAdminClient();
    console.log("API CondMin: Supabase admin client created successfully");

    // Retrieve random exercises from the database based on selected themes
    console.log(
      "API CondMin: Fetching random exercises from database by themes"
    );

    // Build the query based on selected themes
    let query = supabase.from("questions_condMinimales").select("*").limit(20);

    // Add theme filter if specific themes are selected
    if (selectedThemes.length > 0) {
      query = query.in("Thème", selectedThemes);
    }

    // Execute the query
    const { data: randomExercises, error: fetchError } = await query.order(
      "Question",
      { ascending: false }
    );

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

    // No exercises found with selected themes
    if (randomExercises.length === 0) {
      return NextResponse.json(
        {
          error:
            "Aucun exercice trouvé pour les thèmes sélectionnés. Veuillez sélectionner d'autres thèmes.",
        },
        { status: 404 }
      );
    }

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

    // Create the difficulty distribution text for mixte niveau
    const mixteDistributionText =
      niveau === "mixte"
        ? "selon la distribution suivante : 20% facile, 30% moyen, 30% difficile, 20% très difficile"
        : "";

    // Create themes text for prompt
    const themesText =
      selectedThemes.length > 0
        ? `sur les thèmes suivants : ${selectedThemes.join(", ")}`
        : "sur tous les thèmes";

    // Note: For CondMin, we always use 5 options regardless of optionsCount
    // as it has a fixed format with 5 specific options

    // Call LLM to generate exercises
    const prompt = `Générer ${questionCount} exercices ${
      niveau === "mixte"
        ? "de niveau varié " + mixteDistributionText
        : `de niveau ${niveau}`
    } pour le sous-test "Conditions Minimales" ${distributionText} ${themesText}. 
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
4. Le thème de l'exercice (doit être l'un des thèmes suivants: ${selectedThemes.join(
      ", "
    )})
${
  correctionType !== "sansCorrection"
    ? correctionType === "correctionCourte"
      ? "5. Une courte explication (shortExplanation) qui indique brièvement le raisonnement pour déterminer la suffisance des informations"
      : "5. Une explication détaillée (explanation) qui analyse en profondeur la suffisance de chaque information"
    : ""
}

${
  llmModel === "claude"
    ? `TRÈS IMPORTANT: Ta réponse DOIT être au format JSON valide et complet, structuré exactement comme spécifié ci-dessous, sans commentaires ni texte supplémentaire avant ou après le JSON. Le JSON doit inclure tous les champs requis et respecter cette structure exacte:`
    : `Retourner le contenu dans un format JSON structuré avec ces champs :`
}
{
  "title": "Un titre pour le document",
  "introduction": "Texte d'introduction bref qui explique le principe des Conditions Minimales",
  "exercises": [
    {
      "question": "Énoncé de la question principale (ex: Le nombre n est-il pair ?)",
      "info1": "Information 1 (ex: n est un cube.)",
      "info2": "Information 2 (ex: n + 1 est divisible par 4.)",
      "answer": "Lettre de la réponse correcte (A, B, C, D ou E)",
      "theme": "Le thème de l'exercice (parmi les thèmes spécifiés)",
      ${
        correctionType !== "sansCorrection"
          ? correctionType === "correctionCourte"
            ? `"shortExplanation": "Version courte de l'explication"`
            : `"explanation": "Explication détaillée du raisonnement"`
          : ""
      }
    }
    // Plus d'exercices...
  ],
  "conclusion": "Texte de conclusion bref"
}

${
  llmModel === "claude"
    ? `Assure-toi que le JSON est valide et complet, avec tous les exercices demandés, et que chaque exercice contient tous les champs requis. N'ajoute aucun texte en dehors de l'objet JSON.`
    : ""
}`;

    console.log(`API CondMin: Calling ${llmModel} with prompt`);

    let generatedContent;
    let rawResponse = "";

    if (llmModel === "openai") {
      // Use OpenAI
      const completion = await openai.chat.completions.create({
        model: "o3-mini",
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
      rawResponse = completion.choices[0].message.content || "{}";
    } else {
      // Use Claude with streaming
      try {
        rawResponse = await callClaudeWithStreaming(prompt, systemPrompt);
        console.log("API CondMin: Claude streaming completed");
        console.log(`API CondMin: Raw response length: ${rawResponse.length}`);

        // Extract JSON from the response
        rawResponse = extractJSON(rawResponse);

        // Try to parse the JSON
        try {
          generatedContent = JSON.parse(rawResponse);
          console.log(
            "API CondMin: Successfully parsed JSON from streaming response"
          );
        } catch (parseError) {
          console.error(
            "API CondMin: Failed to parse JSON from streaming response:",
            parseError
          );
          console.log(
            "API CondMin: Attempting to fix JSON with second Claude call"
          );

          // Make a second call to Claude to fix the JSON
          const fixedJSON = await callClaudeForJSONValidation(
            rawResponse,
            String(parseError),
            selectedThemes
          );

          // Extract JSON from the fixed response
          const cleanedJSON = extractJSON(fixedJSON);

          try {
            generatedContent = JSON.parse(cleanedJSON);
            console.log("API CondMin: Successfully parsed fixed JSON");
          } catch (secondParseError) {
            console.error(
              "API CondMin: Failed to parse fixed JSON:",
              secondParseError
            );
            throw new Error(
              "Unable to generate valid JSON after multiple attempts"
            );
          }
        }
      } catch (error) {
        console.error("API CondMin: Error in Claude streaming process:", error);
        throw error;
      }
    }

    // If we're using OpenAI or if generatedContent wasn't set above
    if (!generatedContent && llmModel === "openai") {
      try {
        generatedContent = JSON.parse(rawResponse);
        console.log("API CondMin: Parsed generated content successfully");
      } catch (parseError) {
        console.error("API CondMin: Error parsing LLM response:", parseError);
        console.log("API CondMin: Raw LLM response:", rawResponse);
        return NextResponse.json(
          {
            error:
              "Failed to parse LLM response. The model did not return valid JSON.",
            details: String(parseError),
          },
          { status: 500 }
        );
      }
    }

    // Validate and fix the content structure
    generatedContent = validateAndFixContent(
      generatedContent,
      selectedThemes,
      niveau
    );

    // Validate the generated content against our schema
    const contentValidation =
      GeneratedContentSchema.safeParse(generatedContent);
    if (!contentValidation.success) {
      console.error(
        "API CondMin: Generated content validation error:",
        JSON.stringify(contentValidation.error)
      );

      // Check if we have no valid exercises
      if (
        !generatedContent.exercises ||
        generatedContent.exercises.length === 0
      ) {
        return NextResponse.json(
          {
            error:
              "La génération n'a pas produit d'exercices valides. Veuillez réessayer.",
            details: "No valid exercises found in the generated content.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          error:
            "La structure du contenu généré reste invalide après corrections.",
          details: contentValidation.error,
        },
        { status: 500 }
      );
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
      optionsCount,
      selectedThemes, // Pass selected themes to DOCX generator
    };
    console.log("API CondMin: DOCX request payload prepared");

    const response = await fetch(docxEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Pass through authentication headers from the original request
        ...(request.headers.get("authorization") && {
          authorization: request.headers.get("authorization")!,
        }),
        ...(request.headers.get("cookie") && {
          cookie: request.headers.get("cookie")!,
        }),
        // Add any other auth headers your app uses
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
      llm_model: llmModel,
      options_count: optionsCount,
      selected_themes: selectedThemes,
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
        llm_model: llmModel,
        options_count: optionsCount,
        selected_themes: selectedThemes, // Add selected themes to the database
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
