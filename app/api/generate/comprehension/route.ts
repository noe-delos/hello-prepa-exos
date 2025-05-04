/* eslint-disable @typescript-eslint/no-explicit-any */

// src/app/api/generate/comprehension/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { systemPrompt } from "./prompt-comprehension"; // Importation du prompt spécifique

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define validation schema for request body
const GenerateRequestSchema = z.object({
  userId: z.string().uuid(),
  sousTest: z.literal("comprehension"), // Limité uniquement à comprehension
  niveau: z.enum(["facile", "moyen", "difficile", "mixte"]),
  numTexts: z.number().int().min(1).max(10),
  questionsPerText: z.number().int().min(1).max(10).default(5),
  correctionType: z.enum([
    "sansCorrection",
    "correctionCourte",
    "correctionDetaillee",
  ]),
  outputFormat: z.enum(["docx"]), // Uniquement DOCX pour l'instant
});

export async function POST(request: NextRequest) {
  console.log("API Comprehension: Generate endpoint called");
  try {
    // Get and validate request body
    console.log("API Comprehension: Parsing request body");
    const body = await request.json();
    console.log("API Comprehension: Request body received:", JSON.stringify(body));

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
    } = validationResult.data;

    console.log("API Comprehension: Request validated successfully with parameters:", {
      userId,
      sousTest,
      niveau,
      numTexts,
      questionsPerText,
      correctionType,
      outputFormat,
    });

    console.log("API Comprehension: Initializing Supabase admin client");
    // Create Supabase client
    const supabase = createAdminClient();
    console.log("API Comprehension: Supabase admin client created successfully");

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

    console.log(`API Comprehension: Successfully fetched ${randomTexts.length} texts`);

    // Pour chaque texte, récupérer les questions associées
    const textsWithQuestions = [];
    for (const text of randomTexts) {
      const { data: questions, error: questionsError } = await supabase
        .from("questions_comprehension")
        .select("*")
        .eq("text_id", text.id);

      if (questionsError) {
        console.error("API Comprehension: Error fetching questions:", questionsError);
        continue;
      }

      textsWithQuestions.push({
        text: text.Texte,
        questions: questions.map(q => ({
          question: q.Enoncé,
          options: {
            A: q.A,
            B: q.B,
            C: q.C,
            D: q.D,
            E: q.E,
          },
          answer: q.right_answer
        }))
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

    // Call OpenAI to generate exercises
    const prompt = `Génère ${numTexts} textes avec ${questionsPerText} questions par texte pour le sous-test "Compréhension" du TAGE MAGE, de niveau ${niveau === "mixte" ? "varié (mélange de facile, moyen et difficile)" : niveau}.
Fournir ces exercices ${correctionDescription}.

Voici ${textsWithQuestions.length} exemples de textes et questions pour t'inspirer:
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
3. Pour chaque question, 5 options (A, B, C, D, E) avec une seule réponse correcte
4. L'indication de la réponse correcte
${
  correctionType !== "sansCorrection"
    ? correctionType === "correctionCourte"
      ? "5. Une explication courte (shortExplanation) qui justifie brièvement la réponse correcte"
      : "5. Une explication détaillée (explanation) qui explique la réponse et pourquoi les autres options sont incorrectes"
    : ""
}

Retourner le contenu dans un format JSON structuré avec ces champs :
- title: Un titre pour le document
- introduction: Texte d'introduction bref
- texts: Tableau d'objets texte avec leur contenu et leurs questions associées
- conclusion: Texte de conclusion bref`;

    console.log("API Comprehension: Calling OpenAI with prompt");
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
    console.log("API Comprehension: OpenAI response received successfully");

    let generatedContent;
    try {
      generatedContent = JSON.parse(
        completion.choices[0].message.content || "{}"
      );
      console.log("API Comprehension: Parsed generated content successfully");

      // S'assurer que tous les champs requis sont présents
      if (!generatedContent.title)
        generatedContent.title = `Exercices de Compréhension TAGE MAGE - ${niveau}`;
      if (!generatedContent.introduction)
        generatedContent.introduction = `Voici une série d'exercices pour vous préparer à la section Compréhension du TAGE MAGE. Chaque texte est suivi de questions pour évaluer votre compréhension.`;
      if (!generatedContent.conclusion)
        generatedContent.conclusion = "Fin des exercices. Bonne préparation !";
      
      // Vérifier la structure des textes et questions
      if (!generatedContent.texts || !Array.isArray(generatedContent.texts)) {
        generatedContent.texts = [];
        throw new Error("La structure des textes générés est invalide");
      }

      // Normaliser et valider chaque texte et ses questions
      generatedContent.texts = generatedContent.texts.map((text: any, textIndex: any) => {
        // Vérifier le contenu du texte
        if (!text.content || typeof text.content !== 'string') {
          text.content = `Texte ${textIndex + 1} - Contenu manquant`;
        }

        // Vérifier et normaliser les questions
        if (!text.questions || !Array.isArray(text.questions)) {
          text.questions = [];
        }

        text.questions = text.questions.map((question: any, questionIndex: any) => {
          // Normaliser la question
          if (!question.question || typeof question.question !== 'string') {
            question.question = `Question ${questionIndex + 1} - Énoncé manquant`;
          }

          // Normaliser les options
          if (!question.options) {
            question.options = { A: "", B: "", C: "", D: "", E: "" };
          } else {
            ["A", "B", "C", "D", "E"].forEach(option => {
              if (!question.options[option]) {
                question.options[option] = "";
              } else if (typeof question.options[option] !== "string") {
                question.options[option] = String(question.options[option]);
              }
            });
          }

          // Normaliser la réponse
          if (!question.answer) {
            question.answer = "A"; // Réponse par défaut
          } else if (typeof question.answer !== "string") {
            question.answer = String(question.answer);
          }

          return question;
        });

        return text;
      });

    } catch (parseError) {
      console.error("API Comprehension: Error parsing OpenAI response:", parseError);
      console.log(
        "API Comprehension: Raw OpenAI response:",
        completion.choices[0].message.content
      );
      throw new Error("Failed to parse OpenAI response");
    }

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
    };
    console.log("API Comprehension: DOCX request payload prepared");

    const response = await fetch(docxEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(docxPayload),
    });

    console.log("API Comprehension: DOCX generation response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Comprehension: Failed to generate DOCX. Response:", errorText);
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