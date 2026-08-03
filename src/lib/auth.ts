import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "../../generated/prisma/client.js";

const prisma = new PrismaClient();

const CONSUMER_ORIGINS = [
  "http://localhost:5173",
  "https://dwichs.karitchi.com",
];

const MERCHANT_ORIGINS = [
  "http://localhost:5174",
  "https://merchants.karitchi.com",
];

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  trustedOrigins: [...CONSUMER_ORIGINS, ...MERCHANT_ORIGINS],
  emailAndPassword: {
    enabled: true,
  },
  user: {
    deleteUser: {
      enabled: true,
    },
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user, ctx) => {
          const origin = ctx?.request?.headers.get("origin");
          const roleName = MERCHANT_ORIGINS.includes(origin ?? "")
            ? "restaurant"
            : "customer";

          const role = await prisma.role.findFirst({
            where: { name: roleName },
          });

          if (role) {
            await prisma.userRole.create({
              data: {
                userId: user.id,
                roleId: role.id,
              },
            });
          }
        },
      },
    },
  },
});

export type AuthType = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
};
