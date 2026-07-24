import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({
  fileBase64: z.string().min(10),
  mimeType: z.string().default("application/pdf"),
  hint: z.string().optional(),
  stage: z.enum(["prelims", "mains", "both"]).default("both"),
});

const SCHEMA = ["subject", "chapter", "topic", "subtopic"] as const;

export const parseSyllabusPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const chain = SCHEMA.join(" > ");
    const SYSTEM = `You are a syllabus parser for competitive exam preparation.
Extract a strict 4-level hierarchical outline as JSON matching the fixed schema below.

Fixed schema (top → bottom): ${chain}
- Depth 0 nodes MUST have type "subject".
- Depth 1 nodes MUST have type "chapter".
- Depth 2 nodes MUST have type "topic".
- Depth 3 nodes MUST have type "subtopic".
- Do NOT introduce any other labels.
- If the source document has a coarser structure (e.g. Paper > Unit > ...), COLLAPSE it into these four levels by folding the outer groupings into the subject title (e.g. "Paper I — Indian Polity").
- If the source is shallower, stop at the deepest level the document reaches. Do not invent content.

Output ONLY valid JSON, no prose:
{ "nodes": Array<{ "title": string; "type": "subject"|"chapter"|"topic"|"subtopic"; "depth": 0|1|2|3; "children"?: same[] }> }
Rules:
- "depth" MUST equal the index of "type" in [subject, chapter, topic, subtopic].
- Preserve source numbering/ordering in titles when meaningful.
- Trim whitespace, keep titles concise.`;

    const body = {
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${data.hint ? `Context: ${data.hint}\n\n` : ""}Extract the ${data.stage === "both" ? "combined" : data.stage.toUpperCase()} syllabus as JSON using Subject > Chapter > Topic > Subtopic.${data.stage !== "both" ? ` Only include content that belongs to the ${data.stage.toUpperCase()} stage of this exam.` : ""}`,
            },
            {
              type: "file",
              file: {
                filename: "syllabus.pdf",
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
      if (res.status === 402) throw new Error("AI credits exhausted. Please add credits to the workspace.");
      throw new Error(`AI error ${res.status}: ${text.slice(0, 300)}`);
    }

    const json: any = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try {
      parsed = typeof content === "string" ? JSON.parse(content) : content;
    } catch {
      throw new Error("AI returned invalid JSON. Try again.");
    }
    return parsed as { nodes: Array<{ title: string; type: string; depth?: number; children?: any[] }> };
  });
