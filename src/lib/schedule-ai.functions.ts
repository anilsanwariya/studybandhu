import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const TopicCatalogItem = z.object({
  id: z.string(),
  title: z.string(),
  subject: z.string().optional(),
  chapter: z.string().optional(),
});

const InputSchema = z.object({
  fileBase64: z.string().min(10),
  mimeType: z.string().default("application/pdf"),
  topics: z.array(TopicCatalogItem).max(2000),
  hint: z.string().optional(),
});

export interface ParsedTest {
  title: string;
  date: string; // ISO YYYY-MM-DD
  mappedTopicIds: string[];
}
export interface ParsedSeries {
  title: string;
  tests: ParsedTest[];
}

export const parseSchedulePdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const catalog = data.topics
      .map(
        (t) =>
          `${t.id} | ${[t.subject, t.chapter, t.title].filter(Boolean).join(" > ")}`,
      )
      .join("\n");

    const SYSTEM = `You are a parser for competitive-exam test-series schedules.
From the attached PDF, extract every test series and its scheduled tests.

Output ONLY valid JSON matching:
{ "series": Array<{
  "title": string,
  "tests": Array<{
    "title": string,
    "date": string,           // ISO date YYYY-MM-DD
    "mappedTopicIds": string[] // ids from the TOPIC CATALOG below, [] if unclear
  }>
}>}

Rules:
- Preserve the source's test names and dates. Convert any date format to YYYY-MM-DD.
- If a year is missing, assume the nearest future occurrence from today (${new Date().toISOString().slice(0, 10)}).
- "mappedTopicIds" MUST be a subset of ids from the TOPIC CATALOG. Match by meaning against test scope / syllabus mentions. If nothing matches, return [].
- If the PDF has only ONE unnamed series, invent a short title (e.g. "Uploaded Schedule").
- Do NOT include commentary or markdown fences.

TOPIC CATALOG (id | subject > chapter > topic):
${catalog || "(no topics available)"}`;

    const body = {
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: data.hint
                ? `Context: ${data.hint}\n\nExtract the test-series schedule as JSON.`
                : `Extract the test-series schedule as JSON.`,
            },
            {
              type: "file",
              file: {
                filename: "schedule.pdf",
                file_data: `data:${data.mimeType};base64,${data.fileBase64}`,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("AI rate limit — try again shortly.");
      if (res.status === 402)
        throw new Error("AI credits exhausted. Please add credits to the workspace.");
      throw new Error(`AI error ${res.status}: ${text.slice(0, 300)}`);
    }

    const json: unknown = await res.json();
    const content =
      (json as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]
        ?.message?.content ?? "{}";
    let parsed: { series?: ParsedSeries[] };
    try {
      parsed = typeof content === "string" ? JSON.parse(content) : (content as never);
    } catch {
      throw new Error("AI returned invalid JSON. Try again.");
    }

    const validIds = new Set(data.topics.map((t) => t.id));
    const series = (parsed.series ?? [])
      .map((s) => ({
        title: String(s.title ?? "Uploaded Schedule").slice(0, 200),
        tests: (s.tests ?? [])
          .map((t) => ({
            title: String(t.title ?? "Test").slice(0, 200),
            date: String(t.date ?? "").slice(0, 10),
            mappedTopicIds: Array.isArray(t.mappedTopicIds)
              ? t.mappedTopicIds.filter((id) => validIds.has(id))
              : [],
          }))
          .filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t.date)),
      }))
      .filter((s) => s.tests.length > 0);

    return { series };
  });
