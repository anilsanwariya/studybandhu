import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({
  fileBase64: z.string().min(10),
  mimeType: z.string().default("application/pdf"),
  hint: z.string().optional(),
});

const SYSTEM = `You are a syllabus parser for competitive exam preparation.
Given a syllabus document, extract a strict hierarchical outline as JSON.
The hierarchy has up to 4 levels: subject -> chapter -> topic -> subtopic.
Only output valid JSON matching this TypeScript type, no prose:
{ "nodes": Array<{ "title": string; "type": "subject"|"chapter"|"topic"|"subtopic"; "children"?: same[] }> }
Rules:
- Top-level items MUST be type "subject".
- Preserve the source's numbering/ordering as-is in titles when meaningful.
- Do not invent content that isn't in the document.
- Trim whitespace, keep titles concise.`;

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

    const body = {
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: data.hint ? `Context: ${data.hint}\n\nExtract the syllabus outline as JSON.` : "Extract the syllabus outline as JSON." },
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
    return parsed as { nodes: Array<{ title: string; type: string; children?: any[] }> };
  });
