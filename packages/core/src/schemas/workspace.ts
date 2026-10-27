import { z } from "zod";
import { Id } from "./common";

export const WorkspaceKind = z.enum(["business", "personal"]);
export type WorkspaceKind = z.infer<typeof WorkspaceKind>;

/** What the workspace switcher can select: one kind, or everything. */
export const WorkspaceScope = z.enum(["business", "personal", "all"]);
export type WorkspaceScope = z.infer<typeof WorkspaceScope>;

export const Workspace = z.object({
  id: Id,
  name: z.string().min(1),
  kind: WorkspaceKind,
});
export type Workspace = z.infer<typeof Workspace>;
