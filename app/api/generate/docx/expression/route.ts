/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */

// src/app/api/generate/docx/expression/route.ts
import { NextRequest, NextResponse } from "next/server";
import * as docx from "docx";
import { Packer } from "docx";
import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";

// Schéma de validation pour la requête Expression
const DocxExpressionRequestSchema = z.object({
  userId: z.string().uuid(),
  content: z.object({
    title: z.string(),
    introduction: z.string(),
    exercises: z.array(
      z.object({
        question: z
          .union([z.string(), z.number()])
          .transform((val) => String(val)),
        options: z.object({
          A: z.union([z.string(), z.number()]).transform((val) => String(val)),
          B: z.union([z.string(), z.number()]).transform((val) => String(val)),
          C: z
            .union([z.string(), z.number()])
            .transform((val) => String(val))
            .optional(),
          D: z
            .union([z.string(), z.number()])
            .transform((val) => String(val))
            .optional(),
          E: z
            .union([z.string(), z.number()])
            .transform((val) => String(val))
            .optional(),
        }),
        answer: z
          .union([z.string(), z.number()])
          .transform((val) => String(val))
          .optional(),
        explanation: z.string().optional(),
        shortExplanation: z.string().optional(),
        // Expression-specific fields
        replacementCount: z.number().min(0).max(3).optional(),
        replacements: z.array(z.string()).optional(),
      })
    ),
    conclusion: z.string(),
  }),
  title: z.string(),
  correctionType: z
    .enum(["sansCorrection", "correctionCourte", "correctionDetaillee"])
    .default("sansCorrection"),
  randomExercises: z.array(z.any()).optional(),
  optionsCount: z.number().int().min(2).max(5).default(5),
});

// Images en base64 pour le logo et le filigrane - Utiliser des images minimalistes valides
const logoBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const watermarkBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export async function POST(request: NextRequest) {
  console.log("DOCX Expression API: Route called");
  try {
    // Récupérer et valider le corps de la requête
    const requestBody = await request.json();
    console.log("DOCX Expression API: Request body received");

    // Log de débogage supplémentaire
    console.log(
      "DOCX Expression API: Request body structure:",
      Object.keys(requestBody),
      "userId:",
      requestBody.userId,
      "title:",
      requestBody.title,
      "correctionType:",
      requestBody.correctionType,
      "content keys:",
      Object.keys(requestBody.content || {}),
      "actual content keys:",
      requestBody.content,
      "exercises count:",
      requestBody.content?.exercises?.length || 0
    );

    const validationResult = DocxExpressionRequestSchema.safeParse(requestBody);
    if (!validationResult.success) {
      console.error(
        "DOCX Expression API: Validation error:",
        JSON.stringify(validationResult.error)
      );
      return NextResponse.json(
        { error: validationResult.error },
        { status: 400 }
      );
    }

    const {
      userId,
      content,
      title,
      correctionType = "sansCorrection",
      optionsCount = 5, // Extract optionsCount with default value
    } = validationResult.data;

    console.log(
      `DOCX Expression API: Processing document for user ${userId} with title ${title}, correction type ${correctionType}, and ${optionsCount} options`
    );

    // Clean and sanitize the replacements arrays - remove any brackets from the text
    const cleanExercises = content.exercises.map(
      (exercise: any, index: number) => {
        console.log(`DOCX Expression API: Processing exercise ${index + 1}`);

        // Create options object with the appropriate number of options
        const optionLetters = Array.from({ length: optionsCount }, (_, i) =>
          String.fromCharCode(65 + i)
        ); // A=65, B=66, etc.

        // Initialize options object
        const options: any = {};

        // Fill in options from A to the specified limit
        optionLetters.forEach((letter) => {
          options[letter] = String(exercise.options[letter] || "");
        });

        // Clean the question text - remove any brackets
        let cleanQuestion = String(
          exercise.question || `Question ${index + 1}`
        );
        cleanQuestion = cleanQuestion
          .replace(/^(variation|inédit|exercice)\s+\d+[:.]\s+/i, "")
          .replace(/^(variation|inédit|exercice)\s+\d+\s+/i, "")
          .replace(/\[([^\]]+)\]/g, "$1"); // Remove any brackets, keeping the text inside

        // Ensure replacements array exists
        let replacements = Array.isArray(exercise.replacements)
          ? [...exercise.replacements]
          : [];

        // Filter out empty strings and ensure they are strings
        replacements = replacements
          .filter((item) => item && String(item).trim() !== "")
          .map((item) => String(item));

        return {
          ...exercise,
          question: cleanQuestion,
          options,
          replacements,
          replacementCount: Math.min(replacements.length, 3), // Ensure valid count (0-3)
          answer: exercise.answer || optionLetters[0], // Default to first option
        };
      }
    );

    content.exercises = cleanExercises;

    // Générer le document DOCX
    console.log("DOCX Expression API: Generating document");
    const doc = generateExpressionDocument(
      content,
      logoBase64,
      watermarkBase64,
      correctionType,
      optionsCount // Pass optionsCount to generateDocument
    );

    // Créer le buffer pour le document
    console.log("DOCX Expression API: Creating document buffer");
    const buffer = await Packer.toBuffer(doc);

    // Initialiser le client Supabase
    const supabase = createAdminClient();

    // Créer un nom de fichier unique avec date et heure
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${title.replace(/\s+/g, "_")}_${timestamp}.docx`;

    // Uploader le fichier dans Supabase Storage
    console.log(
      `DOCX Expression API: Uploading file "${fileName}" to Supabase Storage`
    );
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("documents")
      .upload(`${userId}/${fileName}`, buffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: false,
      });

    if (uploadError) {
      console.error("DOCX Expression API: Upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload document", details: uploadError },
        { status: 500 }
      );
    }

    // Générer l'URL publique du document
    console.log("DOCX Expression API: Generating public URL");
    const { data: urlData } = await supabase.storage
      .from("documents")
      .createSignedUrl(`${userId}/${fileName}`, 60 * 60 * 24 * 7); // 7 jours

    if (!urlData) {
      console.error("DOCX Expression API: Failed to generate signed URL");
      return NextResponse.json(
        { error: "Failed to generate document URL" },
        { status: 500 }
      );
    }

    console.log(
      "DOCX Expression API: Document successfully generated and uploaded"
    );
    return NextResponse.json({
      success: true,
      url: urlData.signedUrl,
      id: uploadData.path,
    });
  } catch (error) {
    console.error("DOCX Expression API: Error generating document:", error);
    // Log plus détaillé pour comprendre l'erreur
    if (error instanceof Error) {
      console.error("DOCX Expression API: Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }

    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// Fonction pour générer le document DOCX spécifique pour Expression
function generateExpressionDocument(
  content: any,
  logoBase64: string,
  watermarkBase64: string,
  correctionType = "sansCorrection",
  optionsCount = 5 // Add optionsCount parameter with default value
) {
  try {
    console.log("DOCX Expression API: Starting document generation");

    // Créer le document avec les styles par défaut
    const doc = new docx.Document({
      styles: {
        default: {
          document: {
            run: {
              font: "Calibri",
            },
          },
        },
      },
      sections: [
        {
          properties: {
            titlePage: true, // Enable different first page header
          },
          headers: {
            default: new docx.Header({
              children: [
                // Table for header layout with image on left and text on right
                new docx.Table({
                  width: {
                    size: 100,
                    type: docx.WidthType.PERCENTAGE,
                  },
                  borders: {
                    top: { style: docx.BorderStyle.NONE },
                    bottom: { style: docx.BorderStyle.NONE },
                    left: { style: docx.BorderStyle.NONE },
                    right: { style: docx.BorderStyle.NONE },
                    insideHorizontal: { style: docx.BorderStyle.NONE },
                    insideVertical: { style: docx.BorderStyle.NONE },
                  },
                  rows: [
                    new docx.TableRow({
                      children: [
                        // Left cell for small image
                        new docx.TableCell({
                          width: {
                            size: 10,
                            type: docx.WidthType.PERCENTAGE,
                          },
                          verticalAlign: docx.VerticalAlign.CENTER,
                          children: [
                            new docx.Paragraph({
                              children: [
                                new docx.ImageRun({
                                  type: "png",
                                  transformation: {
                                    width: 50,
                                    height: 30,
                                  },
                                }),
                              ],
                            }),
                          ],
                        }),
                        // Right cell for text
                        new docx.TableCell({
                          width: {
                            size: 90,
                            type: docx.WidthType.PERCENTAGE,
                          },
                          verticalAlign: docx.VerticalAlign.CENTER,
                          children: [
                            new docx.Paragraph({
                              children: [
                                new docx.TextRun({
                                  text: "Hello Prépa. ",
                                  bold: true,
                                  font: "Calibri",
                                }),
                                new docx.TextRun({
                                  text: "Notre ambition : te proposer la ",
                                  font: "Calibri",
                                }),
                                new docx.TextRun({
                                  text: "MEILLEURE ",
                                  bold: true,
                                  font: "Calibri",
                                }),
                                new docx.TextRun({
                                  text: "prépa avec les ",
                                  font: "Calibri",
                                }),
                                new docx.TextRun({
                                  text: "MEILLEURS ",
                                  bold: true,
                                  font: "Calibri",
                                }),
                                new docx.TextRun({
                                  text: "professeurs",
                                  font: "Calibri",
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
            first: new docx.Header({
              children: [
                // Table for header layout with image on left and text on right
                new docx.Table({
                  width: {
                    size: 100,
                    type: docx.WidthType.PERCENTAGE,
                  },
                  borders: {
                    top: { style: docx.BorderStyle.NONE },
                    bottom: { style: docx.BorderStyle.NONE },
                    left: { style: docx.BorderStyle.NONE },
                    right: { style: docx.BorderStyle.NONE },
                    insideHorizontal: { style: docx.BorderStyle.NONE },
                    insideVertical: { style: docx.BorderStyle.NONE },
                  },
                  rows: [
                    new docx.TableRow({
                      children: [
                        // Left cell for small image
                        new docx.TableCell({
                          width: {
                            size: 10,
                            type: docx.WidthType.PERCENTAGE,
                          },
                          verticalAlign: docx.VerticalAlign.CENTER,
                          children: [
                            new docx.Paragraph({
                              children: [
                                new docx.ImageRun({
                                  type: "png",
                                  transformation: {
                                    width: 50,
                                    height: 30,
                                  },
                                }),
                              ],
                            }),
                          ],
                        }),
                        // Right cell for text
                        new docx.TableCell({
                          width: {
                            size: 90,
                            type: docx.WidthType.PERCENTAGE,
                          },
                          verticalAlign: docx.VerticalAlign.CENTER,
                          children: [
                            new docx.Paragraph({
                              children: [
                                new docx.TextRun({
                                  text: "Hello Prépa. ",
                                  bold: true,
                                  font: "Calibri",
                                }),
                                new docx.TextRun({
                                  text: "Notre ambition : te proposer la ",
                                  font: "Calibri",
                                }),
                                new docx.TextRun({
                                  text: "MEILLEURE ",
                                  bold: true,
                                  font: "Calibri",
                                }),
                                new docx.TextRun({
                                  text: "prépa avec les ",
                                  font: "Calibri",
                                }),
                                new docx.TextRun({
                                  text: "MEILLEURS ",
                                  bold: true,
                                  font: "Calibri",
                                }),
                                new docx.TextRun({
                                  text: "professeurs",
                                  font: "Calibri",
                                }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
                // Add a small space to move the rectangle down
                new docx.Paragraph({
                  text: "",
                  spacing: {
                    before: 120, // Slightly more space before the rectangle
                  },
                }),
                // Colored rectangle with text inside - using a table for better vertical alignment
                new docx.Table({
                  width: {
                    size: 100,
                    type: docx.WidthType.PERCENTAGE,
                  },
                  borders: {
                    top: { style: docx.BorderStyle.NONE },
                    bottom: { style: docx.BorderStyle.NONE },
                    left: { style: docx.BorderStyle.NONE },
                    right: { style: docx.BorderStyle.NONE },
                  },
                  rows: [
                    new docx.TableRow({
                      children: [
                        new docx.TableCell({
                          shading: {
                            fill: "FFF1CC",
                          },
                          verticalAlign: docx.VerticalAlign.CENTER,
                          children: [
                            // Empty paragraph for spacing at top
                            new docx.Paragraph({
                              spacing: {
                                before: 150,
                                after: 0,
                              },
                              text: "",
                            }),
                            // Actual content
                            new docx.Paragraph({
                              alignment: docx.AlignmentType.CENTER,
                              spacing: {
                                before: 0,
                                after: 0,
                              },
                              children: [
                                new docx.TextRun({
                                  text:
                                    content.title || "Expression - Exercices",
                                  size: 36,
                                  bold: true,
                                  font: "Calibri",
                                }),
                              ],
                            }),
                            // Empty paragraph for spacing at bottom
                            new docx.Paragraph({
                              spacing: {
                                before: 0,
                                after: 150,
                              },
                              text: "",
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          },
          footers: {
            default: new docx.Footer({
              children: [
                // Floating image with EXACT specification as provided
                new docx.Paragraph({
                  children: [
                    new docx.ImageRun({
                      type: "png",
                      transformation: {
                        width: 40,
                        height: 80,
                      },
                      floating: {
                        horizontalPosition: {
                          relative: docx.HorizontalPositionRelativeFrom.PAGE,
                          offset: 6401200, // As specified
                        },
                        verticalPosition: {
                          relative: docx.VerticalPositionRelativeFrom.PAGE,
                          offset: 9990000, // As specified
                        },
                        zIndex: 10, // Make sure image is above text
                      },
                    }),
                  ],
                  spacing: {
                    after: 0, // Eliminate any spacing after the image
                  },
                }),
                // Simplified footer layout - single table with reduced spacing
                new docx.Table({
                  width: {
                    size: 100,
                    type: docx.WidthType.PERCENTAGE,
                  },
                  borders: {
                    top: { style: docx.BorderStyle.NONE },
                    bottom: { style: docx.BorderStyle.NONE },
                    left: { style: docx.BorderStyle.NONE },
                    right: { style: docx.BorderStyle.NONE },
                    insideHorizontal: { style: docx.BorderStyle.NONE },
                    insideVertical: { style: docx.BorderStyle.NONE },
                  },
                  rows: [
                    new docx.TableRow({
                      height: {
                        value: 200, // Reduced height
                        rule: docx.HeightRule.EXACT,
                      },
                      children: [
                        // Left empty space
                        new docx.TableCell({
                          width: {
                            size: 20,
                            type: docx.WidthType.PERCENTAGE,
                          },
                          verticalAlign: docx.VerticalAlign.BOTTOM, // Align to bottom
                          children: [new docx.Paragraph({})],
                        }),
                        // Center cell with copyright
                        new docx.TableCell({
                          width: {
                            size: 60,
                            type: docx.WidthType.PERCENTAGE,
                          },
                          verticalAlign: docx.VerticalAlign.BOTTOM, // Align to bottom
                          children: [
                            new docx.Paragraph({
                              alignment: docx.AlignmentType.CENTER,
                              spacing: {
                                before: 0,
                                after: 0,
                              },
                              children: [
                                new docx.TextRun({
                                  text: "© Hello Prépa – Tous droits réservés",
                                  font: "Calibri",
                                }),
                              ],
                            }),
                          ],
                        }),
                        // Right cell for page number
                        new docx.TableCell({
                          width: {
                            size: 20,
                            type: docx.WidthType.PERCENTAGE,
                          },
                          verticalAlign: docx.VerticalAlign.BOTTOM, // Align to bottom
                          children: [
                            new docx.Paragraph({
                              alignment: docx.AlignmentType.RIGHT,
                              spacing: {
                                before: 0,
                                after: 0,
                              },
                              children: [
                                new docx.TextRun({
                                  children: [docx.PageNumber.CURRENT],
                                  font: "Calibri",
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
            first: new docx.Footer({
              children: [
                // Floating image with EXACT specification as provided
                new docx.Paragraph({
                  children: [
                    new docx.ImageRun({
                      type: "png",
                      transformation: {
                        width: 40,
                        height: 80,
                      },
                      floating: {
                        horizontalPosition: {
                          relative: docx.HorizontalPositionRelativeFrom.PAGE,
                          offset: 6401200, // As specified
                        },
                        verticalPosition: {
                          relative: docx.VerticalPositionRelativeFrom.PAGE,
                          offset: 9990000, // As specified
                        },
                        zIndex: 10, // Make sure image is above text
                      },
                    }),
                  ],
                  spacing: {
                    after: 0, // Eliminate any spacing after the image
                  },
                }),
                // Simplified footer layout - first page
                new docx.Table({
                  width: {
                    size: 100,
                    type: docx.WidthType.PERCENTAGE,
                  },
                  borders: {
                    top: { style: docx.BorderStyle.NONE },
                    bottom: { style: docx.BorderStyle.NONE },
                    left: { style: docx.BorderStyle.NONE },
                    right: { style: docx.BorderStyle.NONE },
                    insideHorizontal: { style: docx.BorderStyle.NONE },
                    insideVertical: { style: docx.BorderStyle.NONE },
                  },
                  rows: [
                    new docx.TableRow({
                      height: {
                        value: 200, // Reduced height
                        rule: docx.HeightRule.EXACT,
                      },
                      children: [
                        // Left empty space
                        new docx.TableCell({
                          width: {
                            size: 20,
                            type: docx.WidthType.PERCENTAGE,
                          },
                          verticalAlign: docx.VerticalAlign.BOTTOM, // Align to bottom
                          children: [new docx.Paragraph({})],
                        }),
                        // Center cell with copyright
                        new docx.TableCell({
                          width: {
                            size: 60,
                            type: docx.WidthType.PERCENTAGE,
                          },
                          verticalAlign: docx.VerticalAlign.BOTTOM, // Align to bottom
                          children: [
                            new docx.Paragraph({
                              alignment: docx.AlignmentType.CENTER,
                              spacing: {
                                before: 0,
                                after: 0,
                              },
                              children: [
                                new docx.TextRun({
                                  text: "© Hello Prépa – Tous droits réservés",
                                  font: "Calibri",
                                }),
                              ],
                            }),
                          ],
                        }),
                        // Right cell for page number
                        new docx.TableCell({
                          width: {
                            size: 20,
                            type: docx.WidthType.PERCENTAGE,
                          },
                          verticalAlign: docx.VerticalAlign.BOTTOM, // Align to bottom
                          children: [
                            new docx.Paragraph({
                              alignment: docx.AlignmentType.RIGHT,
                              spacing: {
                                before: 0,
                                after: 0,
                              },
                              children: [
                                new docx.TextRun({
                                  children: [docx.PageNumber.CURRENT],
                                  font: "Calibri",
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
          },
          children: generateExpressionQuestionParagraphs(
            content.exercises,
            correctionType,
            optionsCount // Pass optionsCount to generateQuestionParagraphs
          ),
        },
      ],
    });

    console.log(
      "DOCX Expression API: Document generation completed successfully"
    );
    return doc;
  } catch (error) {
    console.error("DOCX Expression API: Error in generateDocument:", error);
    // Rethrow the error for handling in the main function
    throw error;
  }
}

// Function to find words in a text and apply underline formatting
function processExpressionText(text: string, wordsToUnderline: string[] = []) {
  if (!wordsToUnderline || wordsToUnderline.length === 0) {
    return [new docx.TextRun({ text: text, font: "Calibri" })];
  }

  const result: docx.TextRun[] = [];
  let remainingText = text;

  // Sort words by their position in the string (to process from left to right)
  const wordsWithPositions = wordsToUnderline
    .map((word) => ({ word, position: remainingText.indexOf(word) }))
    .filter((item) => item.position !== -1)
    .sort((a, b) => a.position - b.position);

  if (wordsWithPositions.length === 0) {
    return [new docx.TextRun({ text: text, font: "Calibri" })];
  }

  let lastPosition = 0;

  // Process each word to underline
  for (const { word, position } of wordsWithPositions) {
    // Add text before the word
    if (position > lastPosition) {
      result.push(
        new docx.TextRun({
          text: remainingText.substring(lastPosition, position),
          font: "Calibri",
        })
      );
    }

    // Add the underlined word
    result.push(
      new docx.TextRun({
        text: word,
        font: "Calibri",
        underline: {
          type: docx.UnderlineType.SINGLE,
        },
      })
    );

    lastPosition = position + word.length;
  }

  // Add any remaining text after the last underlined word
  if (lastPosition < remainingText.length) {
    result.push(
      new docx.TextRun({
        text: remainingText.substring(lastPosition),
        font: "Calibri",
      })
    );
  }

  return result;
}

// Create a more compact table with column layout for multiple replacements
function createCompactReplacementTable(
  optionLetter: string,
  replacements: string[],
  shouldBeBold: boolean = false
) {
  if (!replacements || replacements.length === 0 || replacements.length <= 1)
    return null;

  // For multiple replacements, create a table with proper column spacing
  const cellWidths = Array(replacements.length).fill(100 / replacements.length);

  // Create cells for each replacement, but put option letter with first replacement
  const cells = replacements.map((item, index) => {
    if (index === 0) {
      // First cell contains option letter + first replacement
      return new docx.TableCell({
        margins: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
        borders: {
          top: { style: docx.BorderStyle.NONE },
          bottom: { style: docx.BorderStyle.NONE },
          left: { style: docx.BorderStyle.NONE },
          right: { style: docx.BorderStyle.NONE },
        },
        width: {
          size: cellWidths[0],
          type: docx.WidthType.PERCENTAGE,
        },
        children: [
          new docx.Paragraph({
            children: [
              new docx.TextRun({
                text: `(${optionLetter}) ${item}`,
                font: "Calibri",
                bold: shouldBeBold,
              }),
            ],
          }),
        ],
      });
    } else {
      // Other cells contain just the replacement text
      return new docx.TableCell({
        margins: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
        },
        borders: {
          top: { style: docx.BorderStyle.NONE },
          bottom: { style: docx.BorderStyle.NONE },
          left: { style: docx.BorderStyle.NONE },
          right: { style: docx.BorderStyle.NONE },
        },
        width: {
          size: cellWidths[index],
          type: docx.WidthType.PERCENTAGE,
        },
        children: [
          new docx.Paragraph({
            children: [
              new docx.TextRun({
                text: item,
                font: "Calibri",
                bold: shouldBeBold,
              }),
            ],
          }),
        ],
      });
    }
  });

  // Create a compact table with a row of cells
  return new docx.Table({
    width: {
      size: 75,
      type: docx.WidthType.PERCENTAGE,
    },
    columnWidths: cellWidths,
    margins: {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    },
    borders: {
      top: { style: docx.BorderStyle.NONE },
      bottom: { style: docx.BorderStyle.NONE },
      left: { style: docx.BorderStyle.NONE },
      right: { style: docx.BorderStyle.NONE },
      insideHorizontal: { style: docx.BorderStyle.NONE },
      insideVertical: { style: docx.BorderStyle.NONE },
    },
    rows: [
      new docx.TableRow({
        children: cells,
      }),
    ],
  });
}

// Fonction pour générer les paragraphes de questions avec formatage spécifique pour Expression
function generateExpressionQuestionParagraphs(
  exercises: any,
  correctionType = "sansCorrection",
  optionsCount = 5 // Default to 5 options if not specified
) {
  try {
    console.log("DOCX Expression API: Generating question paragraphs");
    const children: any[] = [];

    // Log des informations sur les exercices
    console.log(
      `DOCX Expression API: Processing ${exercises.length} exercises`
    );

    // Calculate total number of pages needed
    const totalExercises = exercises.length;
    const firstPageExercises = 3;
    const exercisesPerSubsequentPage = 4;

    // Calculate how many complete pages we'll have after the first page
    const completeSubsequentPages = Math.floor(
      (totalExercises - firstPageExercises) / exercisesPerSubsequentPage
    );

    // Calculate remaining exercises for the last page
    const remainingExercises =
      (totalExercises - firstPageExercises) % exercisesPerSubsequentPage;

    // Generate option letters based on optionsCount
    const optionLetters = Array.from({ length: optionsCount }, (_, i) =>
      String.fromCharCode(65 + i)
    ); // A=65, B=66, etc.

    // Loop through exercises
    exercises.forEach((exercise: any, index: number) => {
      console.log(`DOCX Expression API: Building exercise ${index + 1}`);

      // Improved page break logic to prevent blank pages
      let needsPageBreak = false;

      if (index === firstPageExercises) {
        // First page break after the initial 3 exercises
        needsPageBreak = true;
      } else if (index > firstPageExercises) {
        // For remaining exercises, calculate if we need a page break
        const positionAfterFirstPage = index - firstPageExercises;

        // Only insert page breaks for complete pages, avoid page break that would create a nearly empty last page
        if (positionAfterFirstPage % exercisesPerSubsequentPage === 0) {
          // Don't add page break for the very last page if it would have just 1-2 exercises
          // This prevents creating pages with too few exercises
          const isLastPageWithFewExercises =
            positionAfterFirstPage / exercisesPerSubsequentPage ===
              completeSubsequentPages && remainingExercises <= 2;

          needsPageBreak = !isLastPageWithFewExercises;
        }
      }

      // Create question text with underlined words
      const questionTextRuns = [
        new docx.TextRun({
          text: `Question ${index + 1}. `,
          bold: true,
          font: "Calibri",
        }),
      ];

      // Check if we have replacements to underline
      const replacementCount = exercise.replacementCount || 0;
      const replacements = exercise.replacements || [];

      if (replacementCount > 0 && replacements.length > 0) {
        // Underline the words that need replacement
        questionTextRuns.push(
          ...processExpressionText(String(exercise.question), replacements)
        );
      } else {
        // Regular question without underlines (for error detection questions)
        questionTextRuns.push(
          new docx.TextRun({
            text: String(exercise.question),
            font: "Calibri",
          })
        );
      }

      // Question text paragraph
      children.push(
        new docx.Paragraph({
          spacing: {
            before: 200,
          },
          pageBreakBefore: needsPageBreak,
          children: questionTextRuns,
        })
      );

      // Options - Only include options that are available based on optionsCount
      const options = optionLetters.map((letter) => ({
        letter,
        text: exercise.options[letter] || "", // Use empty string as fallback
      }));

      options.forEach((option, optIndex) => {
        // Only bold the correct option if correction is requested
        const isCorrectOption = exercise.answer === option.letter;
        const shouldBeBold =
          correctionType !== "sansCorrection" && isCorrectOption;

        // Special handling for multiple replacements (2-3)
        if (replacementCount > 1) {
          try {
            // Try to split by slashes to get individual replacements
            const parts = option.text.split(/\s*\/\s*/);

            // Check if we have multiple parts
            if (parts.length > 1 && parts.length <= 3) {
              // Create a compact table with option letter in first column
              const table = createCompactReplacementTable(
                option.letter,
                parts,
                shouldBeBold
              );
              if (table) {
                // Add spacing before the first option
                if (optIndex === 0) {
                  children.push(
                    new docx.Paragraph({
                      spacing: {
                        before: 200,
                      },
                      text: "",
                    })
                  );
                }

                // Add the table with compact layout
                children.push(table);

                // Add spacing after the table
                children.push(
                  new docx.Paragraph({
                    spacing: {
                      after: 40,
                    },
                    text: "",
                  })
                );
              } else {
                // Fallback to standard format
                children.push(
                  new docx.Paragraph({
                    spacing: {
                      before: optIndex === 0 ? 200 : 40,
                      after: 40,
                    },
                    children: [
                      new docx.TextRun({
                        text: `(${option.letter}) ${option.text}`,
                        font: "Calibri",
                        bold: shouldBeBold,
                      }),
                    ],
                  })
                );
              }
            } else {
              // Single replacement option
              children.push(
                new docx.Paragraph({
                  spacing: {
                    before: optIndex === 0 ? 200 : 40,
                    after: 40,
                  },
                  children: [
                    new docx.TextRun({
                      text: `(${option.letter}) ${option.text}`,
                      font: "Calibri",
                      bold: shouldBeBold,
                    }),
                  ],
                })
              );
            }
          } catch (err) {
            // Fallback to simple format if there's an error in formatting
            children.push(
              new docx.Paragraph({
                spacing: {
                  before: optIndex === 0 ? 200 : 40,
                  after: 40,
                },
                children: [
                  new docx.TextRun({
                    text: `(${option.letter}) ${option.text}`,
                    font: "Calibri",
                    bold: shouldBeBold,
                  }),
                ],
              })
            );
          }
        } else {
          // Standard single-line option
          children.push(
            new docx.Paragraph({
              spacing: {
                before: optIndex === 0 ? 200 : 0, // Space before first option
                after: optIndex === options.length - 1 ? 200 : 0, // Space after last option
              },
              children: [
                new docx.TextRun({
                  text: `(${option.letter}) ${option.text}`,
                  font: "Calibri",
                  bold: shouldBeBold,
                }),
              ],
            })
          );
        }
      });

      // Add explanation if correction is requested
      if (correctionType !== "sansCorrection") {
        // For short correction, show a brief explanation
        if (
          correctionType === "correctionCourte" &&
          exercise.shortExplanation
        ) {
          children.push(
            new docx.Paragraph({
              spacing: {
                before: 200,
                after: 400,
              },
              children: [
                new docx.TextRun({
                  text: "Explication: ",
                  bold: true,
                  font: "Calibri",
                }),
                new docx.TextRun({
                  text: `${exercise.answer}. ${exercise.shortExplanation}`,
                  font: "Calibri",
                }),
              ],
            })
          );
        }
        // For detailed correction, show the full explanation
        else if (
          correctionType === "correctionDetaillee" &&
          exercise.explanation
        ) {
          children.push(
            new docx.Paragraph({
              spacing: {
                before: 200,
                after: 400,
              },
              children: [
                new docx.TextRun({
                  text: "Explication: ",
                  bold: true,
                  font: "Calibri",
                }),
                new docx.TextRun({
                  text: exercise.explanation,
                  font: "Calibri",
                }),
              ],
            })
          );
        }
      }

      // Add spacing after each exercise using empty paragraphs
      // This helps prevent content from being split awkwardly across pages
      children.push(new docx.Paragraph({ text: "" }));

      // Simplified spacing logic - just add consistent spacing between exercises
      // The page breaks are now controlled by the needsPageBreak logic above
      children.push(new docx.Paragraph({ text: "" }));
      children.push(new docx.Paragraph({ text: "" }));
    });

    // Remove excessive trailing empty paragraphs if they exist
    // This helps prevent blank pages at the end
    while (
      children.length > 2 &&
      children[children.length - 1].text === "" &&
      children[children.length - 2].text === ""
    ) {
      children.pop();
    }

    console.log(
      "DOCX Expression API: Question paragraphs generation completed"
    );
    return children;
  } catch (error) {
    console.error(
      "DOCX Expression API: Error in generateQuestionParagraphs:",
      error
    );
    // En cas d'erreur, retourner un paragraphe d'erreur pour éviter de bloquer toute la génération
    return [
      new docx.Paragraph({
        children: [
          new docx.TextRun({
            text: "Une erreur est survenue lors de la génération des questions. Veuillez réessayer.",
            font: "Calibri",
            color: "FF0000",
          }),
        ],
      }),
    ];
  }
}
