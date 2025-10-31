import { z } from 'zod';

export const NewNoteSchema = z.object({
  paperId: z.string().min(1),
  page: z.number().int().nonnegative(),
  x: z.number(),
  y: z.number(),
  content: z.string().min(1),
  color: z.string().optional()
});

export const UpdateNoteSchema = z.object({
  id: z.string().min(1),
  content: z.string().optional(),
  color: z.string().optional()
});

export const PaperImportSchema = z.object({
  paths: z.array(z.string().min(1)).nonempty(),
  workspaceId: z.string().min(1)
});
