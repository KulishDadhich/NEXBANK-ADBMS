import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient();
export const findUserByEmail = (email: string) =>
  prisma.user.findUnique({ where: { email } });
