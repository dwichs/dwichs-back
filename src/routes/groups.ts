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

app.post("/join", async (c) => {
  try {
    const body = await c.req.json();
    const groupId = body.groupId;
    const user = c.get("user");
    const userId = user?.id;

    // Basic validation
    if (!groupId || !userId) {
      return c.json(
        { error: "Group ID and user authentication are required" },
        400,
      );
    }

    // Type validation
    if (typeof userId !== "string") {
      return c.json({ error: "Invalid user authentication" }, 400);
    }

    // Convert groupId to integer if it's a string
    const parsedGroupId = parseInt(groupId);
    if (isNaN(parsedGroupId)) {
      return c.json({ error: "Invalid group ID format" }, 400);
    }

    // Check if group exists
    const group = await prisma.group.findUnique({
      where: { id: parsedGroupId },
      include: {
        User: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!group) {
      return c.json({ error: "Group not found" }, 404);
    }

    // Check if user is already a member
    const existingMembership = await prisma.groupMembership.findUnique({
      where: {
        groupId_userId: {
          groupId: parsedGroupId,
          userId: userId,
        },
      },
    });

    if (existingMembership) {
      return c.json({ error: "User is already a member of this group" }, 409);
    }

    // Add user to group
    const membership = await prisma.groupMembership.create({
      data: {
        groupId: parsedGroupId,
        userId: userId,
        roleInGroup: "member", // Default role for new members
      },
      include: {
        Group: {
          select: {
            id: true,
            name: true,
            createdAt: true,
          },
        },
        User: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Return the group with updated membership information
    const updatedGroup = await prisma.group.findUnique({
      where: { id: parsedGroupId },
      include: {
        User: {
          select: {
            id: true,
            name: true,
          },
        },
        GroupMembership: {
          include: {
            User: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return c.json(
      {
        message: `Successfully joined group "${group.name}"`,
        group: updatedGroup,
        membership: membership,
      },
      200,
    );
  } catch (error) {
    console.error("Error joining group:", error);

    // Handle specific Prisma errors
    if (error.code === "P2002") {
      return c.json({ error: "User is already a member of this group" }, 409);
    }

    if (error.code === "P2025") {
      return c.json({ error: "Group or user not found" }, 404);
    }

    return c.json({ error: "Internal server error" }, 500);
  }
});

app.post("/leave", async (c) => {
  try {
    const body = await c.req.json();
    const groupId = body.groupId;
    const user = c.get("user");
    const userId = user?.id;

    // Basic validation
    if (!groupId || !userId) {
      return c.json(
        { error: "Group ID and user authentication are required" },
        400,
      );
    }

    // Type validation
    if (typeof userId !== "string") {
      return c.json({ error: "Invalid user authentication" }, 400);
    }

    // Convert groupId to integer if it's a string
    const parsedGroupId = parseInt(groupId);
    if (isNaN(parsedGroupId)) {
      return c.json({ error: "Invalid group ID format" }, 400);
    }

    // Check if group exists and get group details
    const group = await prisma.group.findUnique({
      where: { id: parsedGroupId },
      include: {
        User: {
          select: {
            id: true,
            name: true,
          },
        },
        GroupMembership: {
          select: {
            userId: true,
            roleInGroup: true,
          },
        },
      },
    });

    if (!group) {
      return c.json({ error: "Group not found" }, 404);
    }

    // Check if user is actually a member of the group
    const membership = await prisma.groupMembership.findUnique({
      where: {
        groupId_userId: {
          groupId: parsedGroupId,
          userId: userId,
        },
      },
    });

    if (!membership) {
      return c.json({ error: "You are not a member of this group" }, 404);
    }

    // Prevent owner from leaving if there are other members
    // Owner should transfer ownership or delete the group instead
    if (group.ownerId === userId) {
      const otherMembers = group.GroupMembership.filter(
        (m) => m.userId !== userId,
      );

      if (otherMembers.length > 0) {
        return c.json(
          {
            error:
              "Group owner cannot leave while other members exist. Please transfer ownership or delete the group.",
          },
          403,
        );
      }
    }

    // Use transaction to handle leaving the group
    const result = await prisma.$transaction(async (tx) => {
      // Remove the membership
      await tx.groupMembership.delete({
        where: {
          groupId_userId: {
            groupId: parsedGroupId,
            userId: userId,
          },
        },
      });

      // If the owner is leaving and they're the only member, delete the group
      if (group.ownerId === userId) {
        await tx.group.delete({
          where: { id: parsedGroupId },
        });

        return {
          message: `Successfully left and deleted group "${group.name}" as you were the only member`,
          groupDeleted: true,
        };
      }

      // Get updated group information
      const updatedGroup = await tx.group.findUnique({
        where: { id: parsedGroupId },
        include: {
          User: {
            select: {
              id: true,
              name: true,
            },
          },
          GroupMembership: {
            include: {
              User: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      return {
        message: `Successfully left group "${group.name}"`,
        group: updatedGroup,
        groupDeleted: false,
      };
    });

    return c.json(result, 200);
  } catch (error) {
    console.error("Error leaving group:", error);

    // Handle specific Prisma errors
    if (error.code === "P2025") {
      return c.json({ error: "Group membership not found" }, 404);
    }

    if (error.code === "P2003") {
      return c.json(
        { error: "Cannot leave group due to related data constraints" },
        409,
      );
    }

    return c.json({ error: "Internal server error" }, 500);
  }
});
export default app;
