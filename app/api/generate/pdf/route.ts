// src/app/api/generate/pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    // Get request body
    const body = await request.json();
    const { userId, content, title } = body;

    if (!userId || !content || !title) {
      return NextResponse.json(
        { error: "User ID, content and title are required" },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = createAdminClient();

    // Create a PDF document
    const doc = new PDFDocument({ margin: 50 });

    // Create a Buffer to store the PDF
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => {
      chunks.push(Buffer.from(chunk));
    });

    // Generate PDF content
    doc.fontSize(25).text(content.title || title, { align: "center" });
    doc.moveDown();

    // Introduction
    if (content.introduction) {
      doc.fontSize(12).text(content.introduction, { align: "justify" });
      doc.moveDown(2);
    }

    // Exercises
    if (Array.isArray(content.exercises)) {
      content.exercises.forEach((exercise, index) => {
        doc.fontSize(14).text(`Exercise ${index + 1}`, { underline: true });
        doc.moveDown(0.5);

        // Question
        doc.fontSize(12).text(exercise.question);
        doc.moveDown(0.5);

        // Options if they exist
        if (Array.isArray(exercise.options)) {
          exercise.options.forEach((option, optIndex) => {
            doc
              .fontSize(10)
              .text(`${String.fromCharCode(65 + optIndex)}. ${option}`);
          });
          doc.moveDown(0.5);
        }

        // Answer and explanation
        doc.fontSize(10).text(`Answer: ${exercise.answer}`, { indent: 20 });
        if (exercise.explanation) {
          doc.moveDown(0.5);
          doc.fontSize(10).text(`Explanation: ${exercise.explanation}`, {
            indent: 20,
            align: "justify",
          });
        }

        doc.moveDown(2);
      });
    }

    // Conclusion
    if (content.conclusion) {
      doc.fontSize(12).text(content.conclusion, { align: "justify" });
    }

    // Finalize PDF
    doc.end();

    // Wait for the PDF to be fully generated
    await new Promise<void>((resolve) => {
      doc.on("end", () => {
        resolve();
      });
    });

    // Combine chunks into a single buffer
    const pdfBuffer = Buffer.concat(chunks);

    // Generate a unique filename
    const timestamp = new Date().getTime();
    const filename = `${title.replace(/\s+/g, "_")}_${timestamp}.pdf`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from("documents")
      .upload(`${userId}/${filename}`, pdfBuffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (error) {
      console.error("Error uploading PDF:", error);
      return NextResponse.json(
        { error: "Failed to upload document" },
        { status: 500 }
      );
    }

    // Get the public URL
    const { data: urlData } = await supabase.storage
      .from("documents")
      .createSignedUrl(`${userId}/${filename}`, 60 * 60 * 24 * 7); // 7 days expiry

    return NextResponse.json({
      success: true,
      url: urlData?.signedUrl,
      id: data.id,
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
