// src/app/api/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define validation schema for request body
const GenerateRequestSchema = z.object({
  userId: z.string().uuid(),
  sousTest: z.enum([
    "condMinimales",
    "comprehension",
    "calcul",
    "raisonnement",
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
  outputFormat: z.enum(["pdf", "docx"]),
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
                    
                    Pour chaque exercice, inclure :
                    1. Une question claire
                    2. Des options à choix multiples si applicable
                    3. La réponse correcte ${
                      correctionType !== "sansCorrection"
                        ? "avec explication"
                        : ""
                    }
                    
                    Retourner le contenu dans un format JSON structuré avec ces champs :
                    - title: Un titre pour le document
                    - introduction: Texte d'introduction bref
                    - exercises: Tableau d'objets exercice avec question, options, réponse ${
                      correctionType !== "sansCorrection"
                        ? "et explication"
                        : ""
                    }
                    - conclusion: Texte de conclusion bref`;

    console.log("API: Calling OpenAI with prompt:", prompt);
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "Vous êtes un expert en éducation spécialisé dans la création d'exercices pédagogiques en français.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });
    console.log("API: OpenAI response received successfully");

    try {
      const generatedContent = JSON.parse(
        completion.choices[0].message.content || "{}"
      );
      console.log(
        "API: Parsed generated content successfully",
        generatedContent
      );
    } catch (parseError) {
      console.error("API: Error parsing OpenAI response:", parseError);
      console.log(
        "API: Raw OpenAI response:",
        completion.choices[0].message.content
      );
      throw new Error("Failed to parse OpenAI response");
    }

    const generatedContent = JSON.parse(
      completion.choices[0].message.content || "{}"
    );

    // Generate document based on output format
    let documentUrl;
    let fileId;
    if (outputFormat === "pdf") {
      console.log("API: Generating PDF document");
      const pdfEndpoint = `${request.nextUrl.origin}/api/generate/pdf`;
      console.log("API: Calling PDF endpoint:", pdfEndpoint);

      const pdfPayload = {
        userId,
        content: generatedContent,
        title: `${sousTest}_${niveau}_${questionCount}_questions`,
      };
      console.log("API: PDF request payload:", JSON.stringify(pdfPayload));

      const response = await fetch(pdfEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pdfPayload),
      });

      console.log("API: PDF generation response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API: Failed to generate PDF. Response:", errorText);
        throw new Error(`Failed to generate PDF: ${errorText}`);
      }

      const result = await response.json();
      console.log("API: PDF generated successfully:", result);
      documentUrl = result.url;
      fileId = result.id;
    } else {
      console.log("API: Generating DOCX document");
      const docxEndpoint = `${request.nextUrl.origin}/api/generate/docx`;
      console.log("API: Calling DOCX endpoint:", docxEndpoint);

      const docxPayload = {
        userId,
        content: generatedContent,
        title: `${sousTest}_${niveau}_${questionCount}_questions`,
      };
      console.log("API: DOCX request payload:", JSON.stringify(docxPayload));

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
      documentUrl = result.url;
      fileId = result.id;
    }

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
