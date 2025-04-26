/* eslint-disable @typescript-eslint/no-explicit-any */

// src/app/api/generate/docx/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  Header,
  Footer,
  TextRun,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  Shading,
  ShadingType,
} from "docx";
import * as path from "path";
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

    // Create header with text
    const header = new Header({
      children: [
        new Paragraph({
          spacing: {
            before: 0,
            after: 0,
          },
          children: [
            new TextRun({
              text: "Hello Prépa",
              bold: true,
            }),
            new TextRun({
              text: ". Notre ambition : te proposer la ",
            }),
            new TextRun({
              text: "MEILLEURE",
              bold: true,
            }),
            new TextRun({
              text: " prépa avec les ",
            }),
            new TextRun({
              text: "MEILLEURS",
              bold: true,
            }),
            new TextRun({
              text: " professeurs",
            }),
          ],
        }),
      ],
    });

    // Create footer with copyright and page number
    const footer = new Footer({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "© Hello Prépa – Tous droits réservés",
            }),
          ],
        }),
        // Page number box in the right corner
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            // Create a simple table with one cell for the page number
            new Table({
              width: {
                size: 600,
                type: "dxa", // Unit in twentieths of a point (1/1440 of an inch)
              },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      borders: {
                        top: {
                          style: BorderStyle.SINGLE,
                          size: 1,
                        },
                        bottom: {
                          style: BorderStyle.SINGLE,
                          size: 1,
                        },
                        left: {
                          style: BorderStyle.SINGLE,
                          size: 1,
                        },
                        right: {
                          style: BorderStyle.SINGLE,
                          size: 1,
                        },
                      },
                      width: {
                        size: 600,
                        type: "dxa",
                      },
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({
                              children: ["Page ", { type: "page-number" }],
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });

    // Create Document sections
    const sections = [
      {
        headers: {
          default: header,
        },
        footers: {
          default: footer,
        },
        children: [
          // Yellow rectangle with "Calcul - Séance 1" text on first page
          new Paragraph({
            spacing: {
              before: 200,
              after: 400,
            },
            shading: {
              type: ShadingType.SOLID,
              color: "FFF1CC",
            },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "Calcul - Séance 1",
                bold: true,
                size: 36, // 18pt font size (in half-points)
              }),
            ],
          }),
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
          }),

          // Add spacing after question
          new Paragraph({
            text: "",
          }),
          new Paragraph({
            text: "",
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

          // Add spacing after options
          sections[0].children.push(
            new Paragraph({
              text: "",
            })
          );
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
          }),
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
