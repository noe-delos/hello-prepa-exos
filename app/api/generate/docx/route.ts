/* eslint-disable @typescript-eslint/no-explicit-any */

// src/app/api/generate/docx/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Document, Packer, Paragraph, HeadingLevel } from "docx";
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

    const supabase = createAdminClient();

    // Create Document sections
    const sections = [
      {
        children: [
          // Title
          new Paragraph({
            text: content.title || title,
            heading: HeadingLevel.HEADING_1,
          }),

          // Introduction
          ...(content.introduction
            ? [
                new Paragraph({
                  text: content.introduction,
                }),
              ]
            : []),
        ],
      },
    ];

    // Add exercises
    if (Array.isArray(content.exercises)) {
      content.exercises.forEach((exercise: any, index: number) => {
        sections[0].children.push(
          // Exercise heading
          new Paragraph({
            text: `Exercise ${index + 1}`,
            heading: HeadingLevel.HEADING_2,
          }),

          // Question
          new Paragraph({
            text: exercise.question,
          })
        );

        // Add options if they exist
        if (Array.isArray(exercise.options)) {
          exercise.options.forEach((option: any, optIndex: number) => {
            sections[0].children.push(
              new Paragraph({
                text: `${String.fromCharCode(65 + optIndex)}. ${option}`,
                indent: {
                  left: 360, // 0.5 inches in twips
                },
              })
            );
          });
        }

        // Answer and explanation
        sections[0].children.push(
          new Paragraph({
            text: `Answer: ${exercise.answer}`,
            indent: {
              left: 720, // 1 inch in twips
            },
          })
        );

        if (exercise.explanation) {
          sections[0].children.push(
            new Paragraph({
              text: `Explanation: ${exercise.explanation}`,
              indent: {
                left: 720, // 1 inch in twips
              },
            })
          );
        }

        // Add spacing between exercises
        sections[0].children.push(
          new Paragraph({
            text: "",
          })
        );
      });
    }

    // Add conclusion if it exists
    if (content.conclusion) {
      sections[0].children.push(
        new Paragraph({
          text: content.conclusion,
        })
      );
    }

    // Create the DOCX document
    const doc = new Document({
      sections,
    });

    // Prepare buffer for the document
    const buffer = await Packer.toBuffer(doc);

    // Generate a unique filename
    const timestamp = new Date().getTime();
    const filename = `${title.replace(/\s+/g, "_")}_${timestamp}.docx`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from("documents")
      .upload(`${userId}/${filename}`, buffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: false,
      });

    if (error) {
      console.error("Error uploading DOCX:", error);
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
    console.error("DOCX generation error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
