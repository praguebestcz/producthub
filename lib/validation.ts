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

// M6 — komentáře. Jedno schéma pro kořen vlákna i odpověď; superRefine hlídá
// exkluzivitu (odpověď = jen parentId + text, kotvu dědí z kořene).
// Limity délek jsou závazné ze security review (M6). Pole `screenshot` schéma
// záměrně NEZNÁ — Zod object neznámé klíče zahazuje (API v1 ho nesmí přijmout).
export const commentCreateSchema = z
  .object({
    body: z.string().trim().min(1, "Napište komentář").max(10_000),
    visibility: z.enum(["PUBLIC", "INTERNAL"]).optional().default("PUBLIC"),
    // @zmínky — userId členů projektu (členství ověřuje route).
    mentions: z.array(z.number().int().positive()).max(20).optional().default([]),
    // Odpověď: kořenový komentář vlákna.
    parentId: z.number().int().positive().optional(),
    // Kořen: verze dokumentu + stránka + kotva na element.
    documentVersionId: z.number().int().positive().optional(),
    pagePath: z.string().min(1).max(500).optional(),
    dataReviewId: z.string().trim().min(1).max(200).optional(),
    domPath: z.string().min(1).max(2_000).optional(),
    elementHtml: z.string().min(1).max(20_000).optional(),
    viewportWidth: z.number().int().positive().max(20_000).optional(),
    viewportHeight: z.number().int().positive().max(20_000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.parentId !== undefined) {
      // Odpověď nesmí nést vlastní kotvu ani určení stránky/verze.
      const forbidden =
        v.documentVersionId ?? v.pagePath ?? v.dataReviewId ?? v.domPath ??
        v.elementHtml ?? v.viewportWidth ?? v.viewportHeight;
      if (forbidden !== undefined) {
        ctx.addIssue({
          code: "custom",
          message: "Odpověď nemůže mít vlastní kotvu ani stránku",
        });
      }
    } else if (v.documentVersionId === undefined || v.pagePath === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Komentáři chybí verze dokumentu nebo stránka",
      });
    }
  });

// Změna stavu vlákna — OPEN vzniká jen vytvořením, API přijímá jen tyto dva.
export const commentStatusSchema = z.object({
  status: z.enum(["RESOLVED", "REOPENED"]),
});

// Reakce emoji — omezená sada (security review: NE libovolný string, obrana
// proti XSS/obřím hodnotám). Frontend posílá přesně tyto hodnoty.
export const REACTION_EMOJIS = ["👍", "✅", "👀", "❤️", "🎉", "🙏"] as const;
export const reactionCreateSchema = z.object({
  emoji: z.enum(REACTION_EMOJIS),
});

// M8 — „zadání" (prompt export). `body` je snapshot markdownu (může být velký,
// agregace mnoha komentářů) — délkový strop v znacích tady, bajtový strop 1 MB
// hlídá route i DB CHECK. `commentIds` jsou jen informativní (max 500).
export const promptExportCreateSchema = z.object({
  documentVersionId: z.number().int().positive(),
  title: z.string().trim().min(1, "Zadejte název zadání").max(200),
  body: z.string().min(1, "Prompt je prázdný").max(1_000_000),
  commentIds: z
    .array(z.number().int().positive())
    .max(500)
    .optional()
    .default([]),
});

export const promptExportStatusSchema = z.object({
  status: z.enum(["CREATED", "HANDED_OFF", "DONE"]),
});

// AI nastavení (admin). anthropicApiKey: string = nastavit, null = smazat,
// undefined = neměnit. Klíč se v odpovědi NIKDY nezrcadlí zpět.
export const aiConfigPatchSchema = z
  .object({
    anthropicApiKey: z
      .string()
      .trim()
      .regex(/^sk-ant-/, "Neplatný Anthropic klíč (má začínat sk-ant-)")
      .max(300)
      .nullable()
      .optional(),
    // Měsíční rozpočet na AI v USD (dolarech). 0 = bez limitu.
    monthlyBudgetUsd: z.number().nonnegative().max(100_000).optional(),
  })
  .refine(
    (v) =>
      v.anthropicApiKey !== undefined || v.monthlyBudgetUsd !== undefined,
    { message: "Nic ke změně" },
  );

// M8 — vygenerování promptu se změnami přes AI z vybraných komentářů.
// Limit počtu komentářů drží náklady na AI volání pod kontrolou.
export const promptGenerateSchema = z.object({
  documentVersionId: z.number().int().positive(),
  commentIds: z.array(z.number().int().positive()).min(1, "Vyberte komentáře").max(100),
  // Doplnění od autora (odpovědi na „k upřesnění") pro přegenerování. Nepovinné.
  clarification: z.string().trim().max(5_000).optional(),
  // Aktuální návrh promptu (i s ručními úpravami) — když je vyplněný, AI ho
  // zpřesní podle doplnění místo generování od nuly (zachová úpravy). Nepovinné.
  currentDraft: z.string().max(1_000_000).optional(),
});
