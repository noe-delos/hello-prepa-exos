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
  niveau: z.enum(["facile", "moyen", "difficile"]),
  partExercice: z.enum(["variation", "inedits"]),
  documentType: z.enum(["polycopie", "fiche", "examen"]),
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
      partExercice,
      documentType,
      questionCount,
      outputFormat,
    } = validationResult.data;

    console.log("API: Request validated successfully with parameters:", {
      userId,
      sousTest,
      niveau,
      partExercice,
      documentType,
      questionCount,
      outputFormat,
    });

    console.log("API: Initializing Supabase admin client");
    // Create Supabase client
    const supabase = createAdminClient();
    console.log("API: Supabase admin client created successfully");

    // Call OpenAI to generate exercises
    const prompt = `Generate ${questionCount} ${niveau} difficulty exercises for the "${sousTest}" 
                    test with "${partExercice}" style. Format it as a "${documentType}" document.
                    For each exercise, include:
                    1. A clear question
                    2. Multiple choice options if applicable
                    3. The correct answer
                    4. A brief explanation
                    
                    Return the content in a structured JSON format with these fields:
                    - title: A title for the document
                    - introduction: Brief introduction text
                    - exercises: Array of exercise objects with question, options, answer, and explanation
                    - conclusion: Brief conclusion text`;

    console.log("API: Calling OpenAI with prompt:", prompt);
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are an expert educator specialized in creating educational exercises.",
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

    // Save to generations table
    console.log("API: Saving generation to database:", {
      user_id: userId,
      sous_test: sousTest,
      niveau: niveau,
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
        niveau: niveau,
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
