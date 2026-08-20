import { z } from "zod";
import { normalizeRollNumber } from "@/lib/roll-match";

/** One row read from a photographed award list. */
export type ExtractedMarkRow = {
  rollNumber: string;
  studentName?: string;
  obtainedMarks: number | null;
  absent: boolean;
};

const DEFAULT_MODEL = "gemini-3.6-flash";

const responseSchema = z.object({
  sheetTotalMarks: z.number().nullable().optional(),
  rows: z.array(
    z.object({
      rollNumber: z.string().trim().min(1),
      studentName: z.string().trim().optional(),
      obtainedMarks: z.number().nullable().optional(),
      absent: z.boolean().optional(),
    }),
  ),
});

export type ExtractedSheet = {
  /** "TOTAL MARKS" printed on the sheet, used to warn about a wrong paper total. */
  sheetTotalMarks: number | null;
  rows: ExtractedMarkRow[];
};

function buildPrompt(totalMarks: number): string {
  return [
    "This image is a printed student award list from a school.",
    "For each student row, read these columns from the image only:",
    "- ROLL NO (exact digits as printed)",
    "- STUDENT NAME (as printed)",
    '- OBT. MARKS (handwritten number in that column)',
    `Total marks for this test is ${totalMarks}; every obtained mark must be between 0 and ${totalMarks}.`,
    "Rules:",
    "- Read roll numbers ONLY from the image. Never substitute or guess roll numbers.",
    "- Read student names ONLY from the image for each row.",
    "- Pair each mark with the roll number and name on the same row.",
    '- If a row has no handwritten mark, set obtainedMarks to null and absent to false.',
    '- If the cell says A, AB, ABS or Absent instead of a number, set absent to true and obtainedMarks to null.',
    "- Never invent rows, never copy names or rolls from memory, never renumber rows.",
    "- Digits may be handwritten; read carefully and do not confuse 1/7, 3/8, 5/6, or 0/6.",
    '- Also report sheetTotalMarks from the sheet (TOTAL MARKS column or header), or null if not printed.',
  ].join("\n");
}

/**
 * Sends the sheet photo to Gemini and returns the handwritten marks it reads.
 * Values still need admin review before saving — this is assistance, not truth.
 */
export async function extractMarksFromSheetImage(input: {
  base64Image: string;
  mimeType: string;
  totalMarks: number;
}): Promise<ExtractedSheet> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "Photo reading is not configured. Enter marks manually for now.",
    );
  }
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: buildPrompt(input.totalMarks) },
              {
                inline_data: {
                  mime_type: input.mimeType,
                  data: input.base64Image,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              sheetTotalMarks: { type: "NUMBER", nullable: true },
              rows: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    rollNumber: { type: "STRING" },
                    studentName: { type: "STRING" },
                    obtainedMarks: { type: "NUMBER", nullable: true },
                    absent: { type: "BOOLEAN" },
                  },
                  required: ["rollNumber"],
                },
              },
            },
            required: ["rows"],
          },
        },
      }),
    },
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        "Photo reading is unavailable right now. Enter marks manually, or try again later.",
      );
    }
    if (response.status === 429) {
      throw new Error(
        "Too many photo reads at once. Wait a moment, then try Read again.",
      );
    }
    throw new Error(
      "Could not read marks from this photo. Use a clearer, straight photo of the filled sheet.",
    );
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = (payload.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text) {
    throw new Error(
      "No marks found in this photo. Fill the OBT. MARKS column clearly, or type marks manually.",
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    throw new Error("Could not read marks from this image. Try a clearer photo.");
  }

  const parsed = responseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error("Could not read marks from this image. Try a clearer photo.");
  }

  const seen = new Set<string>();
  const rows: ExtractedMarkRow[] = [];
  for (const row of parsed.data.rows) {
    const key = normalizeRollNumber(row.rollNumber);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const absent = row.absent === true;
    let marks = absent ? null : (row.obtainedMarks ?? null);
    if (marks !== null) {
      if (!Number.isFinite(marks) || marks < 0 || marks > input.totalMarks) {
        marks = null;
      } else {
        marks = Math.round(marks * 100) / 100;
      }
    }
    rows.push({
      rollNumber: row.rollNumber.trim(),
      studentName: row.studentName?.trim() || undefined,
      obtainedMarks: marks,
      absent,
    });
  }

  const printedTotal = parsed.data.sheetTotalMarks;
  return {
    sheetTotalMarks:
      typeof printedTotal === "number" && Number.isFinite(printedTotal) && printedTotal > 0
        ? printedTotal
        : null,
    rows,
  };
}
