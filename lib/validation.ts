import { z } from "zod";

// Zod schémata pro API vstupy — jediné místo s limity délek (security review:
// klientem plněná pole musí mít stropy).

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1, "Zadejte název").max(200),
  description: z.string().trim().max(5_000).optional(),
  clientId: z.number().int().positive().nullable().optional(),
});

export const projectPatchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5_000).nullable().optional(),
  // Omezení projektu — vkládá se do každého Claude promptu (M8).
  constraints: z.string().trim().max(5_000).nullable().optional(),
  // Po expert review (M3.5): změnu klienta smí jen canCreateProjects — hlídá route.
  clientId: z.number().int().positive().nullable().optional(),
});

// Klient (složka projektů). Trim už tady; case-insensitive duplicitu hlídá route.
export const clientCreateSchema = z.object({
  name: z.string().trim().min(1, "Zadejte název klienta").max(120),
});

export const projectRoleSchema = z.enum(["AUTHOR", "COMMENTER", "READER"]);

export const invitationCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email("Zadejte platný e-mail").max(320),
  role: projectRoleSchema,
  isInternal: z.boolean().optional().default(false),
});

export const memberPatchSchema = z
  .object({
    role: projectRoleSchema.optional(),
    isInternal: z.boolean().optional(),
  })
  .refine((v) => v.role !== undefined || v.isInternal !== undefined, {
    message: "Nic ke změně",
  });
