import { z } from "zod";
import { normalizeRollNumber } from "@/lib/roll-match";

/** One row read from a photographed award list. */
export type ExtractedMarkRow = {
  rollNumber: string;
  obtainedMarks: number | null;
  absent: boolean;
};

const DEFAULT_MODEL = "gemini-3.6-flash";

const responseSchema = z.object({
  sheetTotalMarks: z.number().nullable().optional(),
  rows: z.array(
    z.object({
      rollNumber: z.string().trim().min(1),
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

function buildPrompt(totalMarks: number, rollNumbers: string[]): string {
  const known = rollNumbers.length
    ? `Roll numbers printed on this sheet: ${rollNumbers.join(", ")}. Only use roll numbers from this list.`
    : "";
  return [
    "This image is a printed student award list from a school. Marks are handwritten in the",
    '"OBT. MARKS" column next to each printed roll number.',
    `Read every data row and return the handwritten obtained marks. Total marks for this test is ${totalMarks}, so every value must be between 0 and ${totalMarks}.`,
    known,
    "Rules:",
    "- Report the printed roll number exactly as printed, plus the handwritten mark for that row.",
    '- If a row has no handwritten mark, set obtainedMarks to null and absent to false.',
    '- If the cell says A, AB, ABS or Absent instead of a number, set absent to true and obtainedMarks to null.',
    "- Never invent a row, never guess a mark you cannot read clearly, and never renumber rows.",
    "- Digits may be written in a hand style; read them carefully and do not confuse 1/7, 3/8, 5/6, or 0/6.",
    '- Also report sheetTotalMarks: the total marks printed on the sheet itself (the "TOTAL MARKS" column or header), or null if it is not printed.',
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Sends the sheet photo to Gemini and returns the handwritten marks it reads.
 * Values still need admin review before saving — this is assistance, not truth.
 */
export async function extractMarksFromSheetImage(input: {
  base64Image: string;
  mimeType: string;
  totalMarks: number;
  rollNumbers: string[];
}): Promise<ExtractedSheet> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to your environment to read marks from photos.",
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
              { text: buildPrompt(input.totalMarks, input.rollNumbers) },
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
    const detail = await response.text().catch(() => "");
    const hint =
      response.status === 404
        ? ` Model "${model}" was rejected — set GEMINI_MODEL to a model your key can use.`
        : "";
    throw new Error(
      `Gemini request failed (${response.status}).${hint} ${detail.slice(0, 300)}`.trim(),
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
    throw new Error("Gemini returned no marks for this image. Try a clearer photo.");
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
    rows.push({ rollNumber: row.rollNumber.trim(), obtainedMarks: marks, absent });
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
