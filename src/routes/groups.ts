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

    // Create the group and add creator as member in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the group
      const group = await tx.group.create({
        data: {
          name: name,
          ownerId,
        },
      });

      // Add the creator as a member with "owner" role
      await tx.groupMembership.create({
        data: {
          groupId: group.id,
          userId: ownerId,
          roleInGroup: "owner", // or "admin", "creator", etc. - adjust as needed
        },
      });

      // Return the group with membership data
      return await tx.group.findUnique({
        where: { id: group.id },
        include: {
          User: {
            select: {
              id: true,
              // Add other user fields you want to return
            },
          },
          GroupMembership: {
            include: {
              User: {
                select: {
                  id: true,
                  // Add other user fields you want to return
                },
              },
            },
          },
        },
      });
    });

    return c.json(result, 201);
  } catch (error) {
    console.error("Error creating group:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});
export default app;
