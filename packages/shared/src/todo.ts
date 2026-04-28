import { z } from 'zod';

export const TodoSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1).max(500),
  completed: z.boolean(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  // userId intentionally NOT exposed over the wire in v1 — auth seam is server-side only.
  // Architecture line 271: 'user_id' is server-side; v1 default-user is implicit.
});

export type Todo = z.infer<typeof TodoSchema>;

export const CreateTodoInputSchema = z.object({
  description: z.string().min(1).max(500),
});

export type CreateTodoInput = z.infer<typeof CreateTodoInputSchema>;

export const UpdateTodoCompletionInputSchema = z.object({
  completed: z.boolean(),
});

export type UpdateTodoCompletionInput = z.infer<typeof UpdateTodoCompletionInputSchema>;
