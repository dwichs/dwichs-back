import { Hono } from "hono";
import { PrismaClient } from "../../generated/prisma/client.js";
const prisma = new PrismaClient();
import type { AuthType } from "../lib/auth.js";

const app = new Hono<{ Variables: AuthType }>({
  strict: false,
});

app.get("/me", async (c) => {
  try {
    const userId = c.get("user")?.id;

    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const roles = await prisma.userRole.findMany({
      where: { userId },
      select: {
        Role: {
          select: { name: true },
        },
      },
    });

    return c.json({ roles: roles.map((r) => r.Role.name) });
  } catch (err) {
    console.error("Error fetching roles:", err);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

export default app;
