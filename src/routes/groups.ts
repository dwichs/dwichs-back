import { Hono } from "hono";
import { PrismaClient } from "../../generated/prisma/client.js";
const prisma = new PrismaClient();
import type { AuthType } from "../lib/auth.js";

const app = new Hono<{ Variables: AuthType }>({
  strict: false,
});

// POST /groups - Create a new group
app.post("/create", async (c) => {
  try {
    const body = await c.req.json();
    const name = body.name;
    const user = c.get("user");
    const ownerId = user?.id;

    // Basic validation
    if (!name || !ownerId) {
      return c.json({ error: "Name and ownerId are required" }, 400);
    }

    // Type validation
    if (typeof name !== "string" || typeof ownerId !== "string") {
      return c.json({ error: "Name and ownerId must be strings" }, 400);
    }

    // Check if owner exists
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
    });

    if (!owner) {
      return c.json({ error: "Owner not found" }, 404);
    }

    // Create the group
    const group = await prisma.group.create({
      data: {
        name: name,
        ownerId,
      },
      include: {
        User: {
          select: {
            id: true,
            // Add other user fields you want to return
          },
        },
      },
    });

    return c.json(group, 201);
  } catch (error) {
    console.error("Error creating group:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});
export default app;
