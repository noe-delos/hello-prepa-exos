/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

// src/app/api/generate/expression/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { systemPrompt } from "./prompt-expression"; // Import the expression-specific prompt

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Anthropic
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Define validation schema for request body
const GenerateRequestSchema = z.object({
  userId: z.string().uuid(),
  sousTest: z.literal("expression"), // Limited to expression only
  niveau: z.enum(["facile", "moyen", "difficile", "tresDifficile", "mixte"]),
  variationCount: z.number().int().min(0).max(50),
  ineditsCount: z.number().int().min(0).max(50),
  correctionType: z.enum([
    "sansCorrection",
    "correctionCourte",
    "correctionDetaillee",
  ]),
  questionCount: z.number().int().min(1).max(100),
  outputFormat: z.enum(["docx"]), // DOCX only for now
  llmModel: z.enum(["openai", "claude"]).default("openai"),
  optionsCount: z.number().int().min(2).max(5).default(5),
  selectedThemes: z.array(z.string()).min(0).optional(), // Optional themes
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
      replacements: z.array(z.string()).optional(), // Array of words to be replaced
      replacementCount: z.number().min(0).max(3).optional(), // Number of replacements (0-3)
    })
  ),
  conclusion: z.string(),
});

export async function POST(request: NextRequest) {
  console.log("API Expression: Generate endpoint called");
  try {
    // Get and validate request body
    console.log("API Expression: Parsing request body");
    const body = await request.json();
    console.log("API Expression: Request body received:", JSON.stringify(body));

    const validationResult = GenerateRequestSchema.safeParse(body);

    if (!validationResult.success) {
      console.error(
        "API Expression: Validation error:",
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

    console.log("API Expression: Request validated successfully with parameters:", {
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
    });

    console.log("API Expression: Initializing Supabase admin client");
    // Create Supabase client
    const supabase = createAdminClient();
    console.log("API Expression: Supabase admin client created successfully");

    // Retrieve random exercises from the database
    console.log(
      "API Expression: Fetching random exercises from database"
    );

    // Execute the query to get examples
    const { data: randomExercises, error: fetchError } = await supabase
      .from("questions_expression")
      .select("*")
      .limit(20)
      .order("Question", { ascending: false });

    if (fetchError) {
      console.error("API Expression: Error fetching exercises:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch exercises", details: fetchError },
        { status: 500 }
      );
    }

    console.log(
      `API Expression: Successfully fetched ${randomExercises.length} exercises`
    );

    // No exercises found
    if (randomExercises.length === 0) {
      return NextResponse.json(
        {
          error:
            "Aucun exercice trouvé dans la base de données. Veuillez réessayer ultérieurement.",
        },
        { status: 404 }
      );
    }

    // Process and extract the replacements from the exercise texts
    const processExerciseText = (text: string) => {
      const replacements: string[] = [];
      // Extract text within brackets [like this]
      const regex = /\[(.*?)\]/g;
      let match;
      let processedText = text;
      
      while ((match = regex.exec(text)) !== null) {
        replacements.push(match[1]);
      }
      
      // Remove the brackets for display
      processedText = text.replace(/\[(.*?)\]/g, "$1");
      
      return { processedText, replacements };
    };

    // Prepare exercise examples for the prompt
    const exercisesExamples = randomExercises.map((exercise) => {
      // Process the question text to extract replacements
      const { processedText, replacements } = processExerciseText(exercise.Énoncé || "");
      
      return {
        question: processedText,
        options: {
          A: exercise.A || "",
          B: exercise.B || "",
          C: exercise.C || "",
          D: exercise.D || "",
          E: exercise.E || "",
        },
        answer: exercise.Réponse || "",
        replacementCount: exercise.remplacer || 0,
        replacements: replacements,
      };
    });

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
    const prompt = `Générer ${questionCount} exercices ${
      niveau === "mixte"
        ? "de niveau varié " + mixteDistributionText
        : `de niveau ${niveau}`
    } 
pour le sous-test "expression" ${distributionText}. 
Fournir ces exercices ${correctionDescription}.

Voici ${
      exercisesExamples.length
    } exemples d'exercices du type expression pour t'inspirer:
${JSON.stringify(exercisesExamples, null, 2)}

Pour chaque exercice, inclure :
1. Une question claire qui demande soit de remplacer un mot (ou plusieurs) souligné(s), soit de trouver la phrase contenant une ou plusieurs fautes.
   - Pour les exercices de remplacement: Indiquer les mots à remplacer entre [crochets] dans le texte.
   - Pour les exercices de détection d'erreurs: utiliser replacementCount = 0 et demander de trouver l'option qui contient une erreur.
2. Le nombre de remplacements à effectuer (replacementCount): entre 0 et 3
   - 0 : Trouver la phrase contenant une erreur
   - 1-3 : Remplacer le nombre correspondant de mots/expressions soulignés
3. Des options à choix multiples ${optionsText} - IMPORTANT: Fournir exactement ${optionsCount} options
   - Si replacementCount = 0, chaque option est une phrase complète dont une contient une erreur
   - Si replacementCount = 1, chaque option est un mot/expression alternatif
   - Si replacementCount > 1, chaque option présente une combinaison de mots/expressions alternatifs
4. La réponse correcte (lettre ${optionLetters.join(", ")})
${
  correctionType !== "sansCorrection"
    ? correctionType === "correctionCourte"
      ? "5. Une courte explication (shortExplanation) qui indique brièvement pourquoi cette réponse est correcte"
      : "5. Une explication détaillée (explanation) qui donne la solution complète avec les raisons linguistiques"
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
      "question": "Énoncé de la question avec les mots à remplacer entre [crochets] si nécessaire",
      "replacementCount": 0-3, // Nombre de remplacements à effectuer
      "replacements": ["mot1", "mot2", "mot3"], // Liste des mots à remplacer (entre crochets dans la question)
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
    // Plus d'exercices...
  ],
  "conclusion": "Texte de conclusion bref"
}

${
  llmModel === "claude"
    ? `Assure-toi que le JSON est valide et complet, avec tous les exercices demandés, et que chaque exercice contient tous les champs requis. N'ajoute aucun texte en dehors de l'objet JSON.`
    : ""
}`;

    console.log(`API Expression: Calling ${llmModel} with prompt`);

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

      console.log("API Expression: OpenAI response received successfully");
      rawResponse = completion.choices[0].message.content || "{}";
    } else {
      // Use Claude with thinking enabled
      const msg: any = await anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 20000,
        temperature: 1,
        system:
          systemPrompt +
          "\n\nIMPORTANT: Ta réponse doit être un objet JSON valide et complet, sans texte supplémentaire avant ou après le JSON.",
        messages: [{ role: "user", content: prompt }],
        thinking: {
          type: "enabled",
          budget_tokens: 16000,
        },
      });

      console.log("API Expression: Claude response received successfully");
      rawResponse = msg.content[1].text || "{}";
    }

    // Additional processing for Claude responses to ensure valid JSON
    if (llmModel === "claude") {
      // Try to extract JSON from Claude's response (it might contain markdown code blocks or additional text)
      console.log("API Expression: Processing Claude response to extract JSON");

      // Check if response is wrapped in a code block
      const jsonMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        rawResponse = jsonMatch[1].trim();
      }

      // Remove any text before or after the JSON object
      const jsonObjectMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch) {
        rawResponse = jsonObjectMatch[0];
      }

      console.log("API Expression: Claude response processed");
    }

    try {
      // Parse the raw JSON response
      generatedContent = JSON.parse(rawResponse);
      console.log("API Expression: Parsed generated content successfully");
    } catch (parseError) {
      console.error("API Expression: Error parsing LLM response:", parseError);
      console.log("API Expression: Raw LLM response:", rawResponse);
      return NextResponse.json(
        {
          error:
            "Failed to parse LLM response. The model did not return valid JSON.",
          details: String(parseError),
        },
        { status: 500 }
      );
    }

    // Validate the generated content against our schema
    const contentValidation =
      GeneratedContentSchema.safeParse(generatedContent);
    if (!contentValidation.success) {
      console.error(
        "API Expression: Generated content validation error:",
        JSON.stringify(contentValidation.error)
      );

      // Attempt to fix the content structure
      console.log("API Expression: Attempting to fix content structure");

      // Ensure all required fields are present
      if (!generatedContent.title) {
        generatedContent.title = `Exercices d'expression TAGE MAGE - ${niveau}`;
      }
      if (!generatedContent.introduction) {
        generatedContent.introduction = `Voici une série d'exercices pour vous préparer à la section expression du TAGE MAGE.`;
      }
      if (!generatedContent.conclusion) {
        generatedContent.conclusion = "Fin des exercices. Bonne préparation !";
      }

      // Ensure exercises is an array
      if (
        !generatedContent.exercises ||
        !Array.isArray(generatedContent.exercises)
      ) {
        generatedContent.exercises = [];
        // If we have no valid exercises, return an error
        if (generatedContent.exercises.length === 0) {
          return NextResponse.json(
            {
              error:
                "La génération n'a pas produit d'exercices valides. Veuillez réessayer.",
              details: "No valid exercises found in the generated content.",
            },
            { status: 500 }
          );
        }
      }

      // Process each exercise to ensure it has the required fields
      generatedContent.exercises = generatedContent.exercises.map((exercise: any, index: number) => {
        // Process question to find and mark replacements if not already done
        if (!exercise.replacements || !Array.isArray(exercise.replacements)) {
          const { processedText, replacements } = processExerciseText(exercise.question || "");
          exercise.question = processedText;
          exercise.replacements = replacements;
        }
        
        // Set replacementCount if not present
        if (typeof exercise.replacementCount !== 'number') {
          exercise.replacementCount = exercise.replacements?.length || 0;
        }
        
        return exercise;
      });

      // Revalidate after fixes
      const revalidation = GeneratedContentSchema.safeParse(generatedContent);
      if (!revalidation.success) {
        return NextResponse.json(
          {
            error:
              "La structure du contenu généré reste invalide après corrections.",
            details: revalidation.error,
          },
          { status: 500 }
        );
      }
    }

    // Normalize and clean up the exercises
    if (
      generatedContent.exercises &&
      Array.isArray(generatedContent.exercises)
    ) {
      generatedContent.exercises = generatedContent.exercises.map(
        (exercise: any, _index: number) => {
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

          // Ensure replacementCount is valid
          if (typeof exercise.replacementCount !== 'number' || exercise.replacementCount < 0 || exercise.replacementCount > 3) {
            exercise.replacementCount = exercise.replacements?.length || 0;
          }

          // Ensure replacements array is present
          if (!exercise.replacements || !Array.isArray(exercise.replacements)) {
            exercise.replacements = [];
          }

          return exercise;
        }
      );
    }

    // Use the specialized DOCX generator for expression
    console.log("API Expression: Generating DOCX document");
    const docxEndpoint = `${request.nextUrl.origin}/api/generate/docx/expression`;
    console.log("API Expression: Calling specialized DOCX endpoint for expression:", docxEndpoint);

    const docxPayload = {
      userId,
      content: generatedContent,
      title: `${sousTest}_${niveau}_${questionCount}_questions`,
      correctionType,
      randomExercises,
      optionsCount,
    };
    console.log("API Expression: DOCX request payload prepared");

    const response = await fetch(docxEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(docxPayload),
    });

    console.log(
      "API Expression: DOCX generation response status:",
      response.status
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "API Expression: Failed to generate DOCX. Response:",
        errorText
      );
      throw new Error(`Failed to generate DOCX: ${errorText}`);
    }

    const result = await response.json();
    console.log("API Expression: DOCX generated successfully:", result);
    const documentUrl = result.url;
    const fileId = result.id;

    // Save to generations table using the original schema structure
    console.log("API Expression: Saving generation to database:", {
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
      selected_themes: selectedThemes || [], // Add selected themes to the database
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
        selected_themes: selectedThemes || [], // New field in the database
      })
      .select();

    if (error) {
      console.error("API Expression: Error saving generation:", error);
      return NextResponse.json(
        { error: "Failed to save generation", details: error },
        { status: 500 }
      );
    }

    console.log("API Expression: Generation saved successfully:", data);

    console.log("API Expression: Request completed successfully");
    return NextResponse.json({
      success: true,
      url: documentUrl,
      fileId,
    });
  } catch (error) {
    console.error("API Expression: Generation error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}