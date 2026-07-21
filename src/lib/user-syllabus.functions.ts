import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const NodeTypeSchema = z.enum(["chapter", "topic", "subtopic"]);

/** List all custom nodes + hidden admin ids for a given exam (for the current user). */
export const listUserOverrides = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ examId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const [nodes, hidden] = await Promise.all([
      context.supabase
        .from("user_syllabus_nodes")
        .select("id, parent_id, parent_kind, title, node_type, depth, sort_order")
        .eq("exam_id", data.examId)
        .order("sort_order", { ascending: true })
        .order("title", { ascending: true }),
      context.supabase.from("user_node_hidden").select("node_id"),
    ]);
    return {
      nodes: (nodes.data ?? []) as Array<{
        id: string;
        parent_id: string;
        parent_kind: "admin" | "user";
        title: string;
        node_type: "chapter" | "topic" | "subtopic";
        depth: number;
        sort_order: number;
      }>,
      hidden: ((hidden.data as Array<{ node_id: string }> | null) ?? []).map((r) => r.node_id),
    };
  });

export const addUserNode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        examId: z.string().uuid(),
        parentKind: z.enum(["admin", "user"]),
        parentId: z.string().uuid(),
        title: z.string().min(1).max(200),
        nodeType: NodeTypeSchema,
        depth: z.number().int().min(1).max(3),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("user_syllabus_nodes")
      .insert({
        user_id: context.userId,
        exam_id: data.examId,
        parent_kind: data.parentKind,
        parent_id: data.parentId,
        title: data.title,
        node_type: data.nodeType,
        depth: data.depth,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row!.id };
  });

export const updateUserNode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), title: z.string().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_syllabus_nodes")
      .update({ title: data.title })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUserNode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    // Cascade delete descendants owned by this user.
    const { data: rows } = await context.supabase
      .from("user_syllabus_nodes")
      .select("id, parent_id, parent_kind");
    const all = (rows ?? []) as Array<{ id: string; parent_id: string; parent_kind: string }>;
    const toDelete = new Set<string>([data.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const r of all) {
        if (r.parent_kind === "user" && toDelete.has(r.parent_id) && !toDelete.has(r.id)) {
          toDelete.add(r.id);
          changed = true;
        }
      }
    }
    const { error } = await context.supabase
      .from("user_syllabus_nodes")
      .delete()
      .in("id", Array.from(toDelete));
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setAdminNodeHidden = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ nodeId: z.string().uuid(), hidden: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    if (data.hidden) {
      const { error } = await context.supabase
        .from("user_node_hidden")
        .upsert({ user_id: context.userId, node_id: data.nodeId });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("user_node_hidden")
        .delete()
        .eq("node_id", data.nodeId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
