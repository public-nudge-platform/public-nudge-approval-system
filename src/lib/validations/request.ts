import { z } from "zod";
import { RequestType } from "@prisma/client";

export const requestItemSchema = z.object({
  description: z.string().min(1, "品項說明為必填"),
  quantity: z.number().int().positive("數量須為正整數"),
  unitPrice: z.number().positive("單價須大於 0"),
  note: z.string().optional(),
});

export const createRequestSchema = z.object({
  type: z.nativeEnum(RequestType),
  title: z.string().min(1, "標題為必填").max(100),
  description: z.string().optional(),
  neededBy: z.string().datetime().optional(),
  items: z.array(requestItemSchema).min(1, "至少需要一個品項"),
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;
