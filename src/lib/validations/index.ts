import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export const registerSchema = z.object({
  displayName: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(100),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

export const createTaskSchema = z.object({
  title: z.string().min(1, "El título es requerido").max(500),
  description: z.string().max(5000).optional(),
  projectId: z.string().optional(),
  priority: z
    .enum(["low", "medium", "high", "urgent"])
    .default("medium"),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  estimatedHours: z.number().min(0).max(1000).optional(),
  parentId: z.string().min(1).optional(),
  recurrence: z
    .enum(["daily", "weekly", "biweekly", "monthly", "yearly", "none"])
    .default("none"),
  reminderAt: z.string().optional(),
  categories: z.array(z.string()).optional(),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  status: z.enum(["pending", "in_progress", "review", "completed", "cancelled"]).optional(),
  isArchived: z.boolean().optional(),
  actualHours: z.number().min(0).max(1000).optional(),
  categories: z.array(z.string()).optional(),
  pdfUrl: z.string().url().nullable().optional(),
  pdfName: z.string().max(255).nullable().optional(),
  reminderAt: z.string().nullable().optional(),
});

export const createProjectSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(100),
  description: z.string().max(500).optional(),
  icon: z.string().max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido").optional(),
});

export const createCategorySchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido").optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
