/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

// src/app/api/generate/calcul/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { systemPrompt } from "./prompt-calcul"; // Import the calcul-specific prompt
import { tageAmageCalcul } from "./tage-amage-calcul"; // Import the chapter data

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
  sousTest: z.literal("calcul"), // Limited to calcul only
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
  llmModel: z.enum(["openai", "claude"]).default("claude"), // Keep parameter but always use claude
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
      options: z.record(z.string(), z.string()),
      answer: z.string(),
      explanation: z.string().optional(),
      shortExplanation: z.string().optional(),
      image: z.string().optional(),
      theme: z.string().optional(),
    })
  ),
  conclusion: z.string(),
});

// Theme to TypeScript variable mapping
const THEME_TO_VARIABLES: Record<string, string[]> = {
  Probabilité: ["combinaisonsArrangementsAnagrammes"],
  "Proportionnalité simple et multiple": ["fractions"],
  Géométrie: [
    "geometrieAstucesGeometriques",
    "geometrieCercleSphereArc",
    "geometrieQuadrilateres",
    "geometrieTriangles",
    "theoremePythagore",
    "theoremeThalès",
  ],
  "Carrés / Cubes / Identités remarquables": ["carresCubesNombresPremiers"],
  "Partage du temps de travail": ["moyennes"],
  "Nombres premiers / PPCM / PGCD": ["carresCubesNombresPremiers"],
  "Calcul mental": ["calculMental1", "calculMental2", "astucesCalcul"],
  "Nombre de rencontres et Nombre de salutations": [
    "combinaisonsArrangementsAnagrammes",
  ],
  "Base 10, 100 et 1000": ["base100ou1000", "bases"],
  Tableaux: ["moyennes"],
  Combinaisons: ["combinaisonsArrangementsAnagrammes"],
  "Suites arithmétiques / Suites géométriques": ["questionsRares"],
  "Puissances, pourcentages et ratios": ["astucesPremierDernierChiffre"],
  "Équations / Systèmes d'équations": ["inconnuesEntieres"],
  "Unités et conversion": ["contenanceConcentrationFluxDebit"],
  "Cas de croisement et cas de rattrapage": [
    "casCroisementDepartDiffere",
    "casCroisementDepartSimultane",
    "casRattrapage",
  ],
  "Vitesse, Distance, Temps (VDT)": ["casRattrapage"],
  Intérêts: ["interetsSimpleComposes"],
  "Les arbres": ["arbres"],
  Barycentre: ["barycentre"],
};

// Helper function to extract JSON from text
function extractJSON(text: string): string {
  console.log("🔍 Extracting JSON from Claude response");

  // Check if response is wrapped in a code block
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    console.log("✅ Found JSON in code block");
    return jsonMatch[1].trim();
  }

  // Remove any text before or after the JSON object
  const jsonObjectMatch = text.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch) {
    console.log("✅ Found JSON object in text");
    return jsonObjectMatch[0];
  }

  console.log("⚠️ No JSON pattern found, returning original text");
  return text;
}

// Helper function to validate and fix content structure
function validateAndFixContent(
  content: any,
  optionLetters: string[],
  selectedThemes: string[]
) {
  console.log("🔧 Validating and fixing content structure");

  // Ensure all required fields are present
  if (!content.title) {
    content.title = `Exercices de calcul TAGE MAGE`;
  }
  if (!content.introduction) {
    content.introduction = `Voici une série d'exercices pour vous préparer à la section calcul du TAGE MAGE.`;
  }
  if (!content.conclusion) {
    content.conclusion = "Fin des exercices. Bonne préparation !";
  }

  // Ensure exercises is an array
  if (!content.exercises || !Array.isArray(content.exercises)) {
    console.log("⚠️ No valid exercises array found");
    content.exercises = [];
  }

  // Normalize and clean up the exercises
  content.exercises = content.exercises.map((exercise: any, index: number) => {
    console.log(`🔧 Processing exercise ${index + 1}`);

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
  console.log("🤖 Starting Claude streaming call");

  let accumulatedResponse = "";
  let thinkingContent = "";
  let mainContent = "";

  try {
    const stream = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 64000,
      temperature: 1,
      system:
        systemPrompt +
        "\n\nIMPORTANT: Ta réponse doit être un objet JSON valide et complet, sans texte supplémentaire avant ou après le JSON.",
      messages: [{ role: "user", content: prompt }],
      thinking: {
        type: "enabled",
        budget_tokens: 16000,
      },
      stream: true,
    });

    console.log("🤖 Claude stream created, processing chunks");

    for await (const chunk of stream as any) {
      if (chunk.type === "content_block_start") {
        console.log(
          `🤖 Content block started - Index: ${chunk.index}, Type: ${chunk.content_block.type}`
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
        console.log(`🤖 Content block stopped - Index: ${chunk.index}`);
      }
    }

    console.log("✅ Claude streaming completed");
    console.log(`📝 Main content length: ${mainContent.length}`);

    return mainContent;
  } catch (error) {
    console.error("❌ Error during Claude streaming:", error);
    throw error;
  }
}

// Helper function to extract chapter content from TypeScript variables
async function extractChapterContentForThemes(
  selectedThemes: string[]
): Promise<string> {
  console.log(
    "📄 Starting chapter content extraction for themes:",
    selectedThemes
  );

  try {
    // Get all unique variables needed for selected themes
    const allVariables = new Set<string>();
    selectedThemes.forEach((theme) => {
      const variables = THEME_TO_VARIABLES[theme];
      if (variables) {
        variables.forEach((variable) => allVariables.add(variable));
        console.log(
          `📄 Theme "${theme}" requires variables: ${variables.join(", ")}`
        );
      } else {
        console.log(`⚠️ No variables found for theme: ${theme}`);
      }
    });

    const variablesToExtract = Array.from(allVariables);
    console.log(
      `📄 Total variables to extract: ${variablesToExtract.join(", ")}`
    );

    if (variablesToExtract.length === 0) {
      throw new Error("No variables found for selected themes");
    }

    // Extract content from each variable
    let extractedContent = "";
    variablesToExtract.forEach((variableName) => {
      const content =
        tageAmageCalcul[variableName as keyof typeof tageAmageCalcul];
      if (content) {
        extractedContent += `\n=== ${variableName.toUpperCase()} ===\n${content}\n`;
        console.log(
          `✅ Variable ${variableName} extracted (${content.length} chars)`
        );
      } else {
        console.log(`⚠️ Variable ${variableName} not found in tageAmageCalcul`);
      }
    });

    console.log(
      `✅ Chapter content extraction completed (${extractedContent.length} chars)`
    );
    console.log(
      "📄 First 500 chars of extracted content:",
      extractedContent.substring(0, 500)
    );

    return extractedContent;
  } catch (error) {
    console.error("❌ Error in chapter content extraction:", error);
    throw error;
  }
}

// Helper function to generate variations using database exercises
async function generateVariations(
  variationCount: number,
  selectedThemes: string[],
  niveau: string,
  correctionType: string,
  optionsCount: number,
  supabase: any
): Promise<any> {
  if (variationCount === 0) {
    console.log("⏭️ Skipping variations (count = 0)");
    return { exercises: [] };
  }

  console.log(
    `🔄 Starting variations generation (${variationCount} exercises)`
  );

  // Fetch random exercises from database
  console.log("🔄 Fetching random exercises from database...");
  let query = supabase
    .from("random_calcul_questions")
    .select("*")
    .limit(variationCount);

  if (selectedThemes.length > 0) {
    query = query.in("Thème", selectedThemes);
  }

  const { data: randomExercises, error: fetchError } = await query;

  if (fetchError) {
    console.error("❌ Error fetching exercises:", fetchError);
    throw new Error("Failed to fetch exercises from database");
  }

  console.log(
    `✅ Fetched ${randomExercises?.length || 0} exercises from database`
  );

  if (!randomExercises || randomExercises.length === 0) {
    throw new Error("No exercises found for selected themes");
  }

  // Prepare exercise examples for the prompt
  const exercisesExamples = randomExercises.map((exercise: any) => ({
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
    theme: exercise.Thème && exercise.Thème !== "EMPTY" ? exercise.Thème : null,
  }));

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
  );

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

  const prompt = `Générer ${variationCount} exercices de variation ${
    niveau === "mixte"
      ? "de niveau varié " + mixteDistributionText
      : `de niveau ${niveau}`
  } 
pour le sous-test "calcul" ${themesText}. 
Fournir ces exercices ${correctionDescription}.

Voici ${
    exercisesExamples.length
  } exemples d'exercices du type calcul pour t'inspirer et créer des VARIATIONS:
${JSON.stringify(exercisesExamples, null, 2)}

IMPORTANT: Tu dois créer des VARIATIONS de ces exercices, c'est-à-dire modifier l'enrobage (contexte, noms, valeurs) tout en conservant la mécanique de résolution identique.

Pour chaque exercice, inclure :
1. Une question claire sous forme de texte. 
   IMPORTANT: La question doit être directe et concise, sans mentions comme "Variation X" ou "Exercice X".
2. Des options à choix multiples ${optionsText} - IMPORTANT: Fournir exactement ${optionsCount} options
3. La réponse correcte (lettre ${optionLetters.join(", ")})
4. Le thème de l'exercice (doit être l'un des thèmes suivants: ${selectedThemes.join(
    ", "
  )})
${
  correctionType !== "sansCorrection"
    ? correctionType === "correctionCourte"
      ? "5. Une courte explication (shortExplanation) qui indique brièvement la méthode de résolution"
      : "5. Une explication un peu plus détaillée (explanation) qui donne la solution complète pas à pas mais pas trop longue non plus"
    : ""
}

TRÈS IMPORTANT: Ta réponse DOIT être au format JSON valide et complet, structuré exactement comme spécifié ci-dessous:

{
  "exercises": [
    {
      "question": "Énoncé de la question 1",
      "options": {
        ${optionLetters
          .map((letter) => `"${letter}": "Option ${letter}"`)
          .join(",\n        ")}
      },
      "answer": "Lettre de la réponse correcte",
      "theme": "Le thème de l'exercice (parmi les thèmes spécifiés)",
      ${
        correctionType !== "sansCorrection"
          ? correctionType === "correctionCourte"
            ? `"shortExplanation": "Explication courte"`
            : `"explanation": "Explication détaillée"`
          : ""
      }
    }
    // Plus d'exercices...
  ]
}`;

  console.log("🔄 Calling Claude for variations generation...");
  const rawResponse = await callClaudeWithStreaming(prompt, systemPrompt);

  // Extract and parse JSON
  const cleanedResponse = extractJSON(rawResponse);
  let generatedContent;

  try {
    generatedContent = JSON.parse(cleanedResponse);
    console.log(
      `✅ Variations generated successfully (${
        generatedContent.exercises?.length || 0
      } exercises)`
    );
  } catch (parseError) {
    console.error("❌ Failed to parse variations JSON:", parseError);
    throw new Error("Failed to parse variations response");
  }

  return generatedContent;
}

// Helper function to generate inédits using manual PDF content
async function generateInedits(
  ineditsCount: number,
  selectedThemes: string[],
  niveau: string,
  correctionType: string,
  optionsCount: number
): Promise<any> {
  if (ineditsCount === 0) {
    console.log("⏭️ Skipping inédits (count = 0)");
    return { exercises: [] };
  }

  console.log(`✨ Starting inédits generation (${ineditsCount} exercises)`);

  // Determine theme distribution (1 theme per 2 exercises by default)
  const themesNeeded = Math.ceil(ineditsCount / 2);
  console.log(`✨ Need ${themesNeeded} themes for ${ineditsCount} inédits`);

  // Randomly select the required number of themes
  const shuffledThemes = [...selectedThemes].sort(() => Math.random() - 0.5);
  const selectedThemesForInedits = shuffledThemes.slice(0, themesNeeded);

  console.log(
    `✨ Selected themes for inédits: ${selectedThemesForInedits.join(", ")}`
  );

  // Extract PDF content for selected themes only
  const pdfContent = await extractChapterContentForThemes(
    selectedThemesForInedits
  );

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
  );

  // Create the difficulty distribution text for mixte niveau
  const mixteDistributionText =
    niveau === "mixte"
      ? "selon la distribution suivante : 20% facile, 30% moyen, 30% difficile, 20% très difficile"
      : "";

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

  const prompt = `Générer ${ineditsCount} exercices INÉDITS ${
    niveau === "mixte"
      ? "de niveau varié " + mixteDistributionText
      : `de niveau ${niveau}`
  } 
pour le sous-test "calcul" sur les thèmes suivants : ${selectedThemesForInedits.join(
    ", "
  )}. 
Fournir ces exercices ${correctionDescription}.

IMPORTANT: Tu dois créer des exercices INÉDITS, c'est-à-dire entièrement nouveaux et originaux, en te basant sur le contenu du manuel suivant:

=== CONTENU DU MANUEL TAGE MAGE ===
${pdfContent}
=== FIN DU CONTENU DU MANUEL ===

En te basant sur ce contenu, crée des exercices originaux qui respectent:
1. Les concepts et méthodes expliqués dans le manuel
2. Le style et format typique du TAGE MAGE
3. La distribution des thèmes demandée

Répartis les exercices de manière équilibrée sur les thèmes sélectionnés (environ 2 exercices par thème).

Pour chaque exercice, inclure :
1. Une question claire sous forme de texte. 
   IMPORTANT: La question doit être directe et concise, sans mentions comme "Inédit X" ou "Exercice X".
2. Des options à choix multiples ${optionsText} - IMPORTANT: Fournir exactement ${optionsCount} options
3. La réponse correcte (lettre ${optionLetters.join(", ")})
4. Le thème de l'exercice (doit être l'un des thèmes suivants: ${selectedThemesForInedits.join(
    ", "
  )})
${
  correctionType !== "sansCorrection"
    ? correctionType === "correctionCourte"
      ? "5. Une courte explication (shortExplanation) qui indique brièvement la méthode de résolution"
      : "5. Une explication un peu plus détaillée (explanation) qui donne la solution complète pas à pas mais pas trop longue non plus"
    : ""
}

TRÈS IMPORTANT: Ta réponse DOIT être au format JSON valide et complet, structuré exactement comme spécifié ci-dessous:

{
  "exercises": [
    {
      "question": "Énoncé de la question 1",
      "options": {
        ${optionLetters
          .map((letter) => `"${letter}": "Option ${letter}"`)
          .join(",\n        ")}
      },
      "answer": "Lettre de la réponse correcte",
      "theme": "Le thème de l'exercice (parmi les thèmes spécifiés)",
      ${
        correctionType !== "sansCorrection"
          ? correctionType === "correctionCourte"
            ? `"shortExplanation": "Explication courte"`
            : `"explanation": "Explication détaillée"`
          : ""
      }
    }
    // Plus d'exercices...
  ]
}`;

  console.log("✨ Calling Claude for inédits generation...");
  const rawResponse = await callClaudeWithStreaming(prompt, systemPrompt);

  // Extract and parse JSON
  const cleanedResponse = extractJSON(rawResponse);
  let generatedContent;

  try {
    generatedContent = JSON.parse(cleanedResponse);
    console.log(
      `✅ Inédits generated successfully (${
        generatedContent.exercises?.length || 0
      } exercises)`
    );
  } catch (parseError) {
    console.error("❌ Failed to parse inédits JSON:", parseError);
    throw new Error("Failed to parse inédits response");
  }

  return generatedContent;
}

// Helper function to merge variations and inédits using OpenAI
async function mergeExercises(
  variationsResult: any,
  ineditsResult: any,
  correctionType: string,
  optionsCount: number,
  selectedThemes: string[]
): Promise<any> {
  console.log("🔗 Starting exercises merge with OpenAI");

  const variationsExercises = variationsResult.exercises || [];
  const ineditsExercises = ineditsResult.exercises || [];

  console.log(
    `🔗 Merging ${variationsExercises.length} variations + ${ineditsExercises.length} inédits`
  );

  // Convert optionsCount to actual option letters
  const optionLetters = Array.from({ length: optionsCount }, (_, i) =>
    String.fromCharCode(65 + i)
  );

  const mergePrompt = `Tu dois fusionner deux listes d'exercices de calcul TAGE MAGE dans un format final structuré.

EXERCICES VARIATIONS:
${JSON.stringify(variationsExercises, null, 2)}

EXERCICES INÉDITS:
${JSON.stringify(ineditsExercises, null, 2)}

Fusionne ces exercices dans un document final avec la structure JSON suivante:

{
  "title": "Exercices de Calcul TAGE MAGE",
  "introduction": "Une introduction appropriée pour le document",
  "exercises": [
    // Tous les exercices fusionnés ici, en mélangeant variations et inédits
  ],
  "conclusion": "Une conclusion appropriée"
}

IMPORTANT:
- Mélange les exercices variations et inédits de manière aléatoire
- Assure-toi que chaque exercice a exactement ${optionsCount} options (${optionLetters.join(
    ", "
  )})
- Vérifie que tous les thèmes sont dans la liste: ${selectedThemes.join(", ")}
- Ne modifie pas le contenu des exercices, fais juste la fusion et la structuration
- Retourne uniquement le JSON, sans texte supplémentaire`;

  console.log("🔗 Calling OpenAI for merge...");

  const response = await openai.chat.completions.create({
    model: "o3-mini",
    messages: [
      {
        role: "system",
        content:
          "Tu es un assistant qui fusionne des exercices. Retourne uniquement du JSON valide.",
      },
      {
        role: "user",
        content: mergePrompt,
      },
    ],
    response_format: { type: "json_object" },
  });

  const mergedContent = response.choices[0].message.content;
  console.log(`✅ Merge completed by OpenAI`);

  try {
    const parsedContent = JSON.parse(mergedContent || "{}");
    console.log(
      `✅ Final merged content: ${
        parsedContent.exercises?.length || 0
      } total exercises`
    );
    return parsedContent;
  } catch (parseError) {
    console.error("❌ Failed to parse merged JSON:", parseError);
    throw new Error("Failed to parse merged response");
  }
}

export async function POST(request: NextRequest) {
  console.log("🚀 CALCUL API: Generate endpoint called");
  try {
    // Get and validate request body
    console.log("📥 Parsing request body");
    const body = await request.json();
    console.log("📥 Request body received:", JSON.stringify(body, null, 2));

    const validationResult = GenerateRequestSchema.safeParse(body);

    if (!validationResult.success) {
      console.error(
        "❌ Validation error:",
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
      llmModel, // Keep parameter but don't use for logic
      optionsCount,
      selectedThemes,
    } = validationResult.data;

    console.log("✅ Request validated successfully with parameters:", {
      userId,
      sousTest,
      niveau,
      variationCount,
      ineditsCount,
      correctionType,
      questionCount,
      outputFormat,
      optionsCount,
      selectedThemes,
    });

    // Initialize Supabase admin client
    console.log("🔧 Initializing Supabase admin client");
    const supabase = createAdminClient();
    console.log("✅ Supabase admin client created successfully");

    // Convert optionsCount to actual option letters
    const optionLetters = Array.from({ length: optionsCount }, (_, i) =>
      String.fromCharCode(65 + i)
    );

    console.log("🏁 Starting three-phase generation process:");
    console.log(`  Phase 1: Generate ${variationCount} variations`);
    console.log(`  Phase 2: Generate ${ineditsCount} inédits`);
    console.log(`  Phase 3: Merge results`);

    // Phase 1: Generate Variations
    console.log("\n=== PHASE 1: VARIATIONS ===");
    const variationsResult = await generateVariations(
      variationCount,
      selectedThemes,
      niveau,
      correctionType,
      optionsCount,
      supabase
    );

    // Phase 2: Generate Inédits
    console.log("\n=== PHASE 2: INÉDITS ===");
    const ineditsResult = await generateInedits(
      ineditsCount,
      selectedThemes,
      niveau,
      correctionType,
      optionsCount
    );

    // Phase 3: Merge Results
    console.log("\n=== PHASE 3: MERGE ===");
    let generatedContent = await mergeExercises(
      variationsResult,
      ineditsResult,
      correctionType,
      optionsCount,
      selectedThemes
    );

    // Validate and fix the final content structure
    console.log("🔧 Final validation and cleanup");
    generatedContent = validateAndFixContent(
      generatedContent,
      optionLetters,
      selectedThemes
    );

    // Validate the generated content against our schema
    const contentValidation =
      GeneratedContentSchema.safeParse(generatedContent);
    if (!contentValidation.success) {
      console.error(
        "❌ Generated content validation error:",
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
    console.log("📄 Generating DOCX document");
    const docxEndpoint = `${request.nextUrl.origin}/api/generate/docx`;
    console.log("📄 Calling DOCX endpoint:", docxEndpoint);

    const docxPayload = {
      userId,
      content: generatedContent,
      title: `${sousTest}_${niveau}_${questionCount}_questions`,
      correctionType,
      randomExercises: [], // Empty since we're using new generation method
      optionsCount,
      selectedThemes,
    };

    const response = await fetch(docxEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(request.headers.get("authorization") && {
          authorization: request.headers.get("authorization")!,
        }),
        ...(request.headers.get("cookie") && {
          cookie: request.headers.get("cookie")!,
        }),
      },
      body: JSON.stringify(docxPayload),
    });

    console.log("📄 DOCX generation response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Failed to generate DOCX. Response:", errorText);
      throw new Error(`Failed to generate DOCX: ${errorText}`);
    }

    const result = await response.json();
    console.log("✅ DOCX generated successfully:", result);
    const documentUrl = result.url;
    const fileId = result.id;

    // Save to generations table
    const dbNiveau = niveau === "mixte" ? "moyen" : niveau;
    const documentType =
      correctionType === "sansCorrection"
        ? "polycopie"
        : correctionType === "correctionCourte"
        ? "fiche"
        : "examen";
    const partExercice =
      variationCount >= ineditsCount ? "variation" : "inedits";

    console.log("💾 Saving generation to database");
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
        llm_model: "claude", // Always claude now
        options_count: optionsCount,
        selected_themes: selectedThemes,
      })
      .select();

    if (error) {
      console.error("❌ Error saving generation:", error);
      return NextResponse.json(
        { error: "Failed to save generation", details: error },
        { status: 500 }
      );
    }

    console.log("✅ Generation saved successfully:", data);
    console.log("🎉 Request completed successfully");

    return NextResponse.json({
      success: true,
      url: documentUrl,
      fileId,
    });
  } catch (error) {
    console.error("❌ Generation error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
