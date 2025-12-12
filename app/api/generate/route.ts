/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

// src/app/api/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { systemPrompt } from "./prompt"; // Importation du prompt système

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
  sousTest: z.enum([
    "calcul",
    "comprehension",
    "raisonnement",
    "condMinimales",
  ]),
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
});

// Schema to validate the generated content structure
const GeneratedContentSchema = z.object({
  title: z.string(),
  introduction: z.string(),
  exercises: z.array(
    z.object({
      question: z.string(),
      options: z.record(z.string(), z.string()),
      answer: z.string(),
      explanation: z.string().optional(),
      shortExplanation: z.string().optional(),
      image: z.string().optional(),
    })
  ),
  conclusion: z.string(),
});

// Helper function to extract JSON from text
function extractJSON(text: string): string {
  console.log("API: Attempting to extract JSON from text");

  // Check if response is wrapped in a code block
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    console.log("API: Found JSON in code block");
    return jsonMatch[1].trim();
  }

  // Remove any text before or after the JSON object
  const jsonObjectMatch = text.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch) {
    console.log("API: Found JSON object in text");
    return jsonObjectMatch[0];
  }

  console.log("API: No JSON pattern found, returning original text");
  return text;
}

// Helper function to validate and fix content structure
function validateAndFixContent(
  content: any,
  optionLetters: string[],
  sousTest: string,
  niveau: string
) {
  console.log("API: Validating and fixing content structure");

  // Ensure all required fields are present
  if (!content.title) {
    content.title = `Exercices de ${sousTest} TAGE MAGE - ${niveau}`;
  }
  if (!content.introduction) {
    content.introduction = `Voici une série d'exercices pour vous préparer à la section ${sousTest} du TAGE MAGE.`;
  }
  if (!content.conclusion) {
    content.conclusion = "Fin des exercices. Bonne préparation !";
  }

  // Ensure exercises is an array
  if (!content.exercises || !Array.isArray(content.exercises)) {
    console.log("API: No valid exercises array found");
    content.exercises = [];
  }

  // Normalize and clean up the exercises
  content.exercises = content.exercises.map((exercise: any, index: number) => {
    console.log(`API: Processing exercise ${index + 1}`);

    // Ensure question is a string
    if (typeof exercise.question !== "string") {
      exercise.question = String(exercise.question || "");
    }

    // Clean up the question to remove unnecessary mentions
    exercise.question = exercise.question
      .replace(/^(variation|inédit|exercice)\s+\d+[:.]\s+/i, "")
      .replace(/^(variation|inédit|exercice)\s+\d+\s+/i, "");

    // Ensure options are present and are strings
    if (!exercise.options) {
      exercise.options = {};
      optionLetters.forEach((letter) => {
        exercise.options[letter] = "";
      });
    } else {
      // Ensure all requested options are present
      optionLetters.forEach((letter) => {
        if (!exercise.options[letter]) {
          exercise.options[letter] = "";
        } else if (typeof exercise.options[letter] !== "string") {
          exercise.options[letter] = String(exercise.options[letter]);
        }
      });

      // Remove any extra options beyond what was requested
      Object.keys(exercise.options).forEach((key) => {
        if (!optionLetters.includes(key)) {
          delete exercise.options[key];
        }
      });
    }

    // Ensure answer is a string and is a valid option
    if (!exercise.answer) {
      exercise.answer = optionLetters[0]; // Default to first option
    } else if (typeof exercise.answer !== "string") {
      exercise.answer = String(exercise.answer);
    }

    // Ensure answer is among valid options
    if (!optionLetters.includes(exercise.answer)) {
      exercise.answer = optionLetters[0];
    }

    return exercise;
  });

  return content;
}

// Helper function to call Claude with streaming
async function callClaudeWithStreaming(
  prompt: string,
  systemPrompt: string,
  questionCount: number
): Promise<string> {
  console.log("API: Starting Claude streaming call");

  let accumulatedResponse = "";
  let thinkingContent = "";
  let mainContent = "";

  try {
    const stream = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 20000,
      temperature: 1,
      system:
        systemPrompt +
        `\n\nIMPORTANT CRITIQUE: Tu dois générer EXACTEMENT ${questionCount} exercices. Ta réponse doit être un objet JSON valide et complet contenant tous les ${questionCount} exercices, sans texte supplémentaire avant ou après le JSON.`,
      messages: [{ role: "user", content: prompt }],
      thinking: {
        type: "enabled",
        budget_tokens: 8000,
      },
      stream: true,
    });

    console.log("API: Claude stream created, processing chunks");

    for await (const chunk of stream as any) {
      if (chunk.type === "content_block_start") {
        console.log(
          `API: Content block started - Index: ${chunk.index}, Type: ${chunk.content_block.type}`
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
        console.log(`API: Content block stopped - Index: ${chunk.index}`);
      }
    }

    console.log("API: Streaming completed");
    console.log(`API: Thinking content length: ${thinkingContent.length}`);
    console.log(`API: Main content length: ${mainContent.length}`);
    
    // Log first 500 chars and last 500 chars of the response for debugging
    console.log("API: First 500 chars of response:", mainContent.substring(0, 500));
    console.log("API: Last 500 chars of response:", mainContent.substring(Math.max(0, mainContent.length - 500)));

    return mainContent;
  } catch (error) {
    console.error("API: Error during streaming:", error);
    throw error;
  }
}

// Helper function to call Claude without streaming for JSON validation
async function callClaudeForJSONValidation(
  invalidJSON: string,
  error: string,
  optionsCount: number
): Promise<string> {
  console.log("API: Calling Claude for JSON validation");

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
      "options": {
        ${Array.from(
          { length: optionsCount },
          (_, i) => `"${String.fromCharCode(65 + i)}": "string"`
        ).join(",\n        ")}
      },
      "answer": "string (une des lettres des options)",
      "explanation": "string (optionnel)",
      "shortExplanation": "string (optionnel)",
      "image": "string (optionnel)"
    }
  ],
  "conclusion": "string"
}

IMPORTANT: Retourne UNIQUEMENT le JSON corrigé, sans aucun texte avant ou après.`;

  const msg: any = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 20000,
    temperature: 1,
    system:
      "Tu es un expert en correction de JSON. Retourne uniquement du JSON valide sans aucun texte supplémentaire.",
    messages: [{ role: "user", content: validationPrompt }],
    thinking: {
      type: "enabled",
      budget_tokens: 6000,
    },
  });

  console.log("API: Claude JSON validation response received");
  return msg.content[1].text || "{}";
}

// Helper function to complete missing exercises
async function completeExercises(
  generatedContent: any,
  questionCount: number,
  optionsCount: number,
  correctionType: string,
  niveau: string,
  sousTest: string
): Promise<any> {
  const currentCount = generatedContent.exercises?.length || 0;
  
  if (currentCount >= questionCount) {
    console.log(`API: Already have ${currentCount} exercises, no completion needed`);
    return generatedContent;
  }
  
  const missingCount = questionCount - currentCount;
  console.log(`API: Need to generate ${missingCount} additional exercises (have ${currentCount}, need ${questionCount})`);
  
  const optionLetters = Array.from({ length: optionsCount }, (_, i) =>
    String.fromCharCode(65 + i)
  );
  
  const completionPrompt = `Le JSON suivant contient ${currentCount} exercices mais il en faut ${questionCount} au total.

${JSON.stringify(generatedContent, null, 2)}

Génère ${missingCount} exercices supplémentaires de ${sousTest} de niveau ${niveau} pour compléter la liste.

Pour chaque exercice supplémentaire, inclure :
1. Une question claire et directe
2. Exactement ${optionsCount} options (${optionLetters.join(", ")})
3. La réponse correcte
${correctionType !== "sansCorrection" ? (correctionType === "correctionCourte" ? "4. Une courte explication (shortExplanation)" : "4. Une explication détaillée (explanation)") : ""}

RETOURNE UNIQUEMENT les exercices manquants dans ce format JSON:
{
  "exercises": [
    // Les ${missingCount} exercices supplémentaires ici
  ]
}`;
  
  try {
    console.log(`API: Calling Claude to complete missing ${missingCount} exercises`);
    const msg: any = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 40000,
      temperature: 1,
      system: `Tu es un expert en génération d'exercices de ${sousTest} TAGE MAGE. Retourne uniquement du JSON valide.`,
      messages: [{ role: "user", content: completionPrompt }],
      thinking: {
        type: "enabled",
        budget_tokens: 6000,
      },
    });
    
    console.log("API: Claude completion response received");
    const responseText = msg.content[1].text || "{}";
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    let cleanedJSON = responseText;
    if (jsonMatch && jsonMatch[1]) {
      cleanedJSON = jsonMatch[1].trim();
    } else {
      const jsonObjectMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch) {
        cleanedJSON = jsonObjectMatch[0];
      }
    }
    
    const additionalExercises = JSON.parse(cleanedJSON);
    
    if (additionalExercises.exercises && Array.isArray(additionalExercises.exercises)) {
      generatedContent.exercises = [
        ...(generatedContent.exercises || []),
        ...additionalExercises.exercises
      ];
      console.log(`API: Successfully added ${additionalExercises.exercises.length} exercises, total now: ${generatedContent.exercises.length}`);
    }
  } catch (error) {
    console.error("API: Failed to complete exercises:", error);
  }
  
  return generatedContent;
}

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
      llmModel,
      optionsCount,
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
      llmModel,
      optionsCount,
    });

    console.log("API: Initializing Supabase admin client");
    // Create Supabase client
    const supabase = createAdminClient();
    console.log("API: Supabase admin client created successfully");

    // Récupération d'exercices aléatoires depuis la base de données
    console.log("API: Fetching random exercises from database");
    // Fetch a larger pool and shuffle client-side for true randomness
    const { data: allExercises, error: fetchError } = await supabase
      .from(`questions_${sousTest}`)
      .select("*")
      .limit(100);

    // Shuffle and take 20 random exercises
    const randomExercises = allExercises
      ? [...allExercises].sort(() => Math.random() - 0.5).slice(0, 20)
      : [];

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
      image: exercise.Image === "TRUE" ? "{INSÉRER IMAGE}" : null,
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

    // Prepare the options text based on optionsCount
    const optionsText =
      optionsCount === 2
        ? "(A, B)"
        : optionsCount === 3
        ? "(A, B, C)"
        : optionsCount === 4
        ? "(A, B, C, D)"
        : "(A, B, C, D, E)";

    // Convert optionsCount to actual option letters
    const optionLetters = Array.from({ length: optionsCount }, (_, i) =>
      String.fromCharCode(65 + i)
    ); // A=65, B=66, etc.

    // Create the difficulty distribution text for mixte niveau
    const mixteDistributionText =
      niveau === "mixte"
        ? "selon la distribution suivante : 20% facile, 30% moyen, 30% difficile, 20% très difficile"
        : "";

    // Call LLM to generate exercises
    const prompt = `IMPORTANT: Tu dois générer EXACTEMENT ${questionCount} exercices complets de ${sousTest}.

Générer ${questionCount} exercices ${
      niveau === "mixte"
        ? "de niveau varié " + mixteDistributionText
        : `de niveau ${niveau}`
    } 
pour le sous-test "${sousTest}" ${distributionText}. 
Fournir ces exercices ${correctionDescription}.

IMPORTANT: Assure-toi de générer TOUS les ${questionCount} exercices demandés dans le JSON. Ne t'arrête pas avant d'avoir créé tous les exercices.

Voici ${
      exercisesExamples.length
    } exemples d'exercices du type ${sousTest} pour t'inspirer (utilise-les comme référence pour le style et la structure):
${JSON.stringify(exercisesExamples, null, 2)}

IMPORTANT: Ces exemples montrent le format attendu. Tu dois créer ${questionCount} exercices originaux en suivant ce format.

Pour chaque exercice, inclure :
1. Une question claire sous forme de texte. 
   IMPORTANT: La question doit être directe et concise, sans mentions comme "Variation X" ou "Exercice X".
2. Des options à choix multiples ${optionsText} - IMPORTANT: Fournir exactement ${optionsCount} options
3. La réponse correcte (lettre ${optionLetters.join(", ")})
${
  correctionType !== "sansCorrection"
    ? correctionType === "correctionCourte"
      ? "4. Une courte explication (shortExplanation) qui indique brièvement la méthode de résolution"
      : "4. Une explication détaillée (explanation) qui donne la solution complète pas à pas"
    : ""
}

${
  llmModel === "claude"
    ? `TRÈS IMPORTANT: Ta réponse DOIT être au format JSON valide et complet, structuré exactement comme spécifié ci-dessous, sans commentaires ni texte supplémentaire avant ou après le JSON. Le JSON doit inclure tous les champs requis et respecter cette structure exacte:`
    : `Retourner le contenu dans un format JSON structuré avec ces champs :`
}
{
  "title": "Un titre pour le document",
  "introduction": "Texte d'introduction bref",
  "exercises": [
    {
      "question": "Énoncé de la question 1",
      "options": {
        ${optionLetters
          .map((letter) => `"${letter}": "Option ${letter}"`)
          .join(",\n        ")}
      },
      "answer": "Lettre de la réponse correcte",
      ${
        correctionType !== "sansCorrection"
          ? correctionType === "correctionCourte"
            ? `"shortExplanation": "Explication courte"`
            : `"explanation": "Explication détaillée"`
          : ""
      }
    }
    // Plus d'exercices... (CONTINUE JUSQU'À AVOIR EXACTEMENT ${questionCount} EXERCICES)
  ],
  "conclusion": "Texte de conclusion bref"
}

REMINDER FINAL: Le JSON doit contenir exactement ${questionCount} exercices complets. Vérifie que tu as bien généré ${questionCount} objets dans le tableau "exercises".

${
  llmModel === "claude"
    ? `Assure-toi que le JSON est valide et complet, avec tous les exercices demandés, et que chaque exercice contient tous les champs requis. N'ajoute aucun texte en dehors de l'objet JSON.`
    : ""
}`;

    console.log(`API: Calling ${llmModel} with prompt`);

    let generatedContent;
    let rawResponse = "";

    if (llmModel === "openai") {
      // Use OpenAI
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
      rawResponse = completion.choices[0].message.content || "{}";
    } else {
      // Use Claude with streaming
      try {
        rawResponse = await callClaudeWithStreaming(prompt, systemPrompt, questionCount);
        console.log("API: Claude streaming completed");
        console.log(`API: Raw response length: ${rawResponse.length}`);

        // Extract JSON from the response
        rawResponse = extractJSON(rawResponse);

        // Try to parse the JSON
        try {
          generatedContent = JSON.parse(rawResponse);
          console.log("API: Successfully parsed JSON from streaming response");
        } catch (parseError) {
          console.error(
            "API: Failed to parse JSON from streaming response:",
            parseError
          );
          console.log("API: Attempting to fix JSON with second Claude call");

          // Make a second call to Claude to fix the JSON
          const fixedJSON = await callClaudeForJSONValidation(
            rawResponse,
            String(parseError),
            optionsCount
          );

          // Extract JSON from the fixed response
          const cleanedJSON = extractJSON(fixedJSON);

          try {
            generatedContent = JSON.parse(cleanedJSON);
            console.log("API: Successfully parsed fixed JSON");
          } catch (secondParseError) {
            console.error("API: Failed to parse fixed JSON:", secondParseError);
            throw new Error(
              "Unable to generate valid JSON after multiple attempts"
            );
          }
        }
      } catch (error) {
        console.error("API: Error in Claude streaming process:", error);
        throw error;
      }
    }

    // If we're using OpenAI or if generatedContent wasn't set above
    if (!generatedContent && llmModel === "openai") {
      try {
        generatedContent = JSON.parse(rawResponse);
        console.log("API: Parsed generated content successfully");
      } catch (parseError) {
        console.error("API: Error parsing LLM response:", parseError);
        console.log("API: Raw LLM response:", rawResponse);
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
      optionLetters,
      sousTest,
      niveau
    );
    
    // Check if we need to complete missing exercises
    if (generatedContent.exercises && generatedContent.exercises.length < questionCount) {
      console.log(`API: Only ${generatedContent.exercises.length} exercises generated, need ${questionCount}`);
      generatedContent = await completeExercises(
        generatedContent,
        questionCount,
        optionsCount,
        correctionType,
        niveau,
        sousTest
      );
      
      // Validate again after completion
      generatedContent = validateAndFixContent(
        generatedContent,
        optionLetters,
        sousTest,
        niveau
      );
    }

    // Validate the generated content against our schema
    const contentValidation =
      GeneratedContentSchema.safeParse(generatedContent);
    if (!contentValidation.success) {
      console.error(
        "API: Generated content validation error:",
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
    console.log("API: Generating DOCX document");
    const docxEndpoint = `${request.nextUrl.origin}/api/generate/docx`;
    console.log("API: Calling DOCX endpoint:", docxEndpoint);

    const docxPayload = {
      userId,
      content: generatedContent,
      title: `${sousTest}_${niveau}_${questionCount}_questions`,
      correctionType, // Pass the correction type to the DOCX generator
      randomExercises,
      optionsCount, // Pass the options count to the DOCX generator
      questionCount, // Pass the question count for truncation safety
    };
    console.log("API: DOCX request payload prepared");

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
      llm_model: llmModel,
      options_count: optionsCount,
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
