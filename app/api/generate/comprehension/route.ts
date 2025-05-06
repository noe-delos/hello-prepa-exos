/* eslint-disable @typescript-eslint/no-explicit-any */

// src/app/api/generate/comprehension/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { systemPrompt } from "./prompt-comprehension"; // Importation du prompt spécifique

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
  sousTest: z.literal("comprehension"), // Limité uniquement à comprehension
  niveau: z.enum(["facile", "moyen", "difficile", "tresDifficile", "mixte"]),
  numTexts: z.number().int().min(1).max(10),
  questionsPerText: z.number().int().min(1).max(10).default(5),
  correctionType: z.enum([
    "sansCorrection",
    "correctionCourte",
    "correctionDetaillee",
  ]),
  outputFormat: z.enum(["docx"]), // Uniquement DOCX pour l'instant
  llmModel: z.enum(["openai", "claude"]).default("openai"),
  optionsCount: z.number().int().min(2).max(5).default(5),
});

// Schema to validate the generated content structure
const GeneratedContentSchema = z.object({
  title: z.string(),
  introduction: z.string(),
  texts: z.array(
    z.object({
      content: z.string(),
      questions: z.array(
        z.object({
          question: z.string(),
          options: z.record(z.string(), z.string()),
          answer: z.string(),
          explanation: z.string().optional(),
          shortExplanation: z.string().optional(),
        })
      ),
    })
  ),
  conclusion: z.string(),
});

export async function POST(request: NextRequest) {
  console.log("API Comprehension: Generate endpoint called");
  try {
    // Get and validate request body
    console.log("API Comprehension: Parsing request body");
    const body = await request.json();
    console.log(
      "API Comprehension: Request body received:",
      JSON.stringify(body)
    );

    // Adaptation pour la compatibilité avec l'interface existante
    const adaptedBody = {
      ...body,
      numTexts: body.variationCount || 1, // Utilise variationCount comme nombre de textes
      questionsPerText: body.ineditsCount || 5, // Utilise ineditsCount comme nombre de questions par texte
    };

    const validationResult = GenerateRequestSchema.safeParse(adaptedBody);

    if (!validationResult.success) {
      console.error(
        "API Comprehension: Validation error:",
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
      numTexts,
      questionsPerText,
      correctionType,
      outputFormat,
      llmModel,
      optionsCount,
    } = validationResult.data;

    console.log(
      "API Comprehension: Request validated successfully with parameters:",
      {
        userId,
        sousTest,
        niveau,
        numTexts,
        questionsPerText,
        correctionType,
        outputFormat,
        llmModel,
        optionsCount,
      }
    );

    console.log("API Comprehension: Initializing Supabase admin client");
    // Create Supabase client
    const supabase = createAdminClient();
    console.log(
      "API Comprehension: Supabase admin client created successfully"
    );

    // Récupération de 2 textes aléatoires avec leurs questions
    console.log("API Comprehension: Fetching random texts from database");
    const { data: randomTexts, error: textsError } = await supabase
      .from("content_compréhension")
      .select("*")
      .limit(2)
      .order("id", { ascending: false });

    if (textsError) {
      console.error("API Comprehension: Error fetching texts:", textsError);
      return NextResponse.json(
        { error: "Failed to fetch texts", details: textsError },
        { status: 500 }
      );
    }

    console.log(
      `API Comprehension: Successfully fetched ${randomTexts.length} texts`
    );

    // Pour chaque texte, récupérer les questions associées
    const textsWithQuestions = [];
    for (const text of randomTexts) {
      const { data: questions, error: questionsError } = await supabase
        .from("questions_comprehension")
        .select("*")
        .eq("text_id", text.id);

      if (questionsError) {
        console.error(
          "API Comprehension: Error fetching questions:",
          questionsError
        );
        continue;
      }

      textsWithQuestions.push({
        text: text.Texte,
        questions: questions.map((q) => ({
          question: q.Enoncé,
          options: {
            A: q.A,
            B: q.B,
            C: q.C,
            D: q.D,
            E: q.E,
          },
          answer: q.right_answer,
        })),
      });
    }

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

    // For "mixte" niveau, we'll use "moyen" for the database to maintain compatibility
    const dbNiveau = niveau === "mixte" ? "moyen" : niveau;

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
    const prompt = `Génère ${numTexts} textes avec ${questionsPerText} questions par texte pour le sous-test "Compréhension" du TAGE MAGE, de niveau ${
      niveau === "mixte" ? "varié " + mixteDistributionText : niveau
    }.
Fournir ces exercices ${correctionDescription}.

Voici ${
      textsWithQuestions.length
    } exemples de textes et questions pour t'inspirer:
${JSON.stringify(textsWithQuestions, null, 2)}

IMPORTANT: Les textes que tu vas générer doivent être TOTALEMENT INÉDITS et ORIGINAUX. N'utilise pas les sujets des exemples, ils sont uniquement là pour te montrer la structure.

Consignes pour les textes :
- Entre 350 et 450 mots
- Sujet non polémique de culture générale (histoire, économie, sciences, société, philosophie, etc.)
- Style neutre, factuel, structuré en 1 ou 2 paragraphes maximum
- Niveau de langue soutenu
- Structure argumentative claire
- Subtilement ambigu par endroits pour permettre des questions à inférence

Pour chaque texte, inclure :
1. Le texte lui-même, avec éventuellement des expressions marquées par "(Question X)" pour les questions de remplacement
2. Exactement ${questionsPerText} questions variées (compréhension littérale, inférence, vocabulaire, structure, thèse principale)
3. Pour chaque question, ${optionsCount} options (${optionLetters.join(
      ", "
    )}) avec une seule réponse correcte
4. L'indication de la réponse correcte
${
  correctionType !== "sansCorrection"
    ? correctionType === "correctionCourte"
      ? "5. Une explication courte (shortExplanation) qui justifie brièvement la réponse correcte"
      : "5. Une explication détaillée (explanation) qui explique la réponse et pourquoi les autres options sont incorrectes"
    : ""
}

${
  llmModel === "claude"
    ? `TRÈS IMPORTANT: Ta réponse DOIT être au format JSON valide et complet, structuré exactement comme spécifié ci-dessous, sans commentaires ni texte supplémentaire avant ou après le JSON. Le JSON doit inclure tous les champs requis et respecter cette structure exacte:`
    : `Retourner le contenu dans un format JSON structuré avec ces champs:`
}
{
  "title": "Un titre pour le document",
  "introduction": "Texte d'introduction bref",
  "texts": [
    {
      "content": "Texte complet, comportant éventuellement des marqueurs (Question X)",
      "questions": [
        {
          "question": "Énoncé de la question",
          "options": {
            ${optionLetters
              .map((letter) => `"${letter}": "Option ${letter}"`)
              .join(",\n            ")}
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
        // Plus de questions...
      ]
    }
    // Plus de textes...
  ],
  "conclusion": "Texte de conclusion bref"
}

${
  llmModel === "claude"
    ? `Assure-toi que le JSON est valide et complet, avec tous les textes demandés, et que chaque texte contient toutes les questions et tous les champs requis. N'ajoute aucun texte en dehors de l'objet JSON.`
    : ""
}`;

    console.log(`API Comprehension: Calling ${llmModel} with prompt`);

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

      console.log("API Comprehension: OpenAI response received successfully");
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

      console.log("API Comprehension: Claude response received successfully");
      rawResponse = msg.content[1].text || "{}";
    }

    // Additional processing for Claude responses to ensure valid JSON
    if (llmModel === "claude") {
      // Try to extract JSON from Claude's response (it might contain markdown code blocks or additional text)
      console.log(
        "API Comprehension: Processing Claude response to extract JSON"
      );

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

      console.log("API Comprehension: Claude response processed");
    }

    try {
      // Parse the raw JSON response
      generatedContent = JSON.parse(rawResponse);
      console.log("API Comprehension: Parsed generated content successfully");
    } catch (parseError) {
      console.error(
        "API Comprehension: Error parsing LLM response:",
        parseError
      );
      console.log("API Comprehension: Raw LLM response:", rawResponse);
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
        "API Comprehension: Generated content validation error:",
        JSON.stringify(contentValidation.error)
      );

      // Attempt to fix the content structure
      console.log("API Comprehension: Attempting to fix content structure");

      // Ensure all required fields are present
      if (!generatedContent.title) {
        generatedContent.title = `Exercices de Compréhension TAGE MAGE - ${niveau}`;
      }
      if (!generatedContent.introduction) {
        generatedContent.introduction = `Voici une série d'exercices pour vous préparer à la section Compréhension du TAGE MAGE. Chaque texte est suivi de questions pour évaluer votre compréhension.`;
      }
      if (!generatedContent.conclusion) {
        generatedContent.conclusion = "Fin des exercices. Bonne préparation !";
      }

      // Ensure texts is an array
      if (!generatedContent.texts || !Array.isArray(generatedContent.texts)) {
        generatedContent.texts = [];
        // If we have no valid texts, return an error
        return NextResponse.json(
          {
            error:
              "La génération n'a pas produit de textes valides. Veuillez réessayer.",
            details: "No valid texts found in the generated content.",
          },
          { status: 500 }
        );
      }

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

    // Normalize and validate each text and its questions
    generatedContent.texts = generatedContent.texts.map(
      (text: any, textIndex: any) => {
        // Ensure content is a string
        if (!text.content || typeof text.content !== "string") {
          text.content = `Texte ${textIndex + 1} - Contenu manquant`;
        }

        // Ensure questions is an array
        if (!text.questions || !Array.isArray(text.questions)) {
          text.questions = [];
        }

        text.questions = text.questions.map(
          (question: any, questionIndex: any) => {
            // Ensure question is a string
            if (!question.question || typeof question.question !== "string") {
              question.question = `Question ${
                questionIndex + 1
              } - Énoncé manquant`;
            }

            // Ensure options are present and valid
            if (!question.options) {
              question.options = {};
              // Add only the required options
              optionLetters.forEach((letter) => {
                question.options[letter] = "";
              });
            } else {
              // Keep only the required options
              const newOptions: any = {};
              optionLetters.forEach((letter) => {
                if (question.options[letter]) {
                  newOptions[letter] =
                    typeof question.options[letter] === "string"
                      ? question.options[letter]
                      : String(question.options[letter]);
                } else {
                  newOptions[letter] = "";
                }
              });
              question.options = newOptions;
            }

            // Ensure answer is a string
            if (!question.answer) {
              question.answer = optionLetters[0]; // First letter as default answer
            } else if (typeof question.answer !== "string") {
              question.answer = String(question.answer);
            }

            // Ensure answer is among valid options
            if (!optionLetters.includes(question.answer)) {
              question.answer = optionLetters[0];
            }

            return question;
          }
        );

        return text;
      }
    );

    // Calculate total question count (for database)
    const totalQuestions = generatedContent.texts.reduce(
      (total: any, text: any) => total + text.questions.length,
      0
    );

    // Generate DOCX document
    console.log("API Comprehension: Generating DOCX document");
    const docxEndpoint = `${request.nextUrl.origin}/api/generate/comprehension/docx`;
    console.log("API Comprehension: Calling DOCX endpoint:", docxEndpoint);

    const docxPayload = {
      userId,
      content: generatedContent,
      title: `${sousTest}_${niveau}_${numTexts}_textes`,
      correctionType,
      textsWithQuestions, // Pass example texts for reference
      optionsCount, // Pass the options count to the DOCX generator
    };
    console.log("API Comprehension: DOCX request payload prepared");

    const response = await fetch(docxEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(docxPayload),
    });

    console.log(
      "API Comprehension: DOCX generation response status:",
      response.status
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "API Comprehension: Failed to generate DOCX. Response:",
        errorText
      );
      throw new Error(`Failed to generate DOCX: ${errorText}`);
    }

    const result = await response.json();
    console.log("API Comprehension: DOCX generated successfully:", result);
    const documentUrl = result.url;
    const fileId = result.id;

    // Save to generations table using the original schema structure
    console.log("API Comprehension: Saving generation to database:", {
      user_id: userId,
      sous_test: sousTest,
      niveau: dbNiveau,
      part_exercice: "inedits", // Toujours "inedits" car on crée des textes originaux
      document_type: documentType,
      question_count: totalQuestions,
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
        part_exercice: "inedits",
        document_type: documentType,
        question_count: totalQuestions,
        output_format: outputFormat,
        file_path: documentUrl,
        llm_model: llmModel,
        options_count: optionsCount,
      })
      .select();

    if (error) {
      console.error("API Comprehension: Error saving generation:", error);
      return NextResponse.json(
        { error: "Failed to save generation", details: error },
        { status: 500 }
      );
    }

    console.log("API Comprehension: Generation saved successfully:", data);

    console.log("API Comprehension: Request completed successfully");
    return NextResponse.json({
      success: true,
      url: documentUrl,
      fileId,
    });
  } catch (error) {
    console.error("API Comprehension: Generation error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
