import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({
  fileBase64: z.string().min(10),
  mimeType: z.string().default("application/pdf"),
  hint: z.string().optional(),
  levelSchema: z.array(z.string().min(1)).min(1).default(["subject", "chapter", "topic", "subtopic"]),
});

export const parseSyllabusPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Verify admin
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const schema = data.levelSchema;
    const chain = schema.join(" > ");
    const SYSTEM = `You are a syllabus parser for competitive exam preparation.
Given a syllabus document, extract a strict hierarchical outline as JSON matching THIS exam's level schema.

Level schema for THIS exam (in order, top to bottom): ${chain}
- Depth 0 nodes MUST have type "${schema[0]}".
- Each deeper level uses the next label in the schema.
- Do NOT invent levels that are not in the schema; if the document is flatter, stop at the level it actually reaches.
- Do NOT introduce labels outside the schema.

Output ONLY valid JSON, no prose:
{ "nodes": Array<{ "title": string; "type": string; "depth": number; "children"?: same[] }> }
Rules:
- "type" MUST be one of: ${schema.map((s) => `"${s}"`).join(", ")}.
- "depth" MUST equal the index of "type" in the schema (0-based).
- Preserve the source's numbering/ordering as-is in titles when meaningful.
- Do not invent content that isn't in the document.
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
              text: data.hint
                ? `Context: ${data.hint}\n\nExtract the syllabus outline as JSON using the level schema: ${chain}.`
                : `Extract the syllabus outline as JSON using the level schema: ${chain}.`,
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
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
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
