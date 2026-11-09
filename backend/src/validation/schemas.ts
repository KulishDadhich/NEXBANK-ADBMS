import { z } from "zod";
export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(12).max(128),
});
export const loginSchema = registerSchema.pick({ email: true, password: true });
export const transferSchema = z.object({
  senderId: z.uuid(),
  recipient: z.string().regex(/^NX\d{16}$/),
  amount: z.string().max(20),
  description: z.string().trim().max(255).default(""),
});
export const beneficiarySchema = z.object({
  accountNumber: z.string().regex(/^NX\d{16}$/),
  nickname: z.string().trim().min(1).max(80),
});
