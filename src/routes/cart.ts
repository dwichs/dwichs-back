import { Hono } from "hono";
import { PrismaClient } from "../../generated/prisma/client.js";
const prisma = new PrismaClient();
import type { AuthType } from "../lib/auth.js";

import { addMenuItemToCart, getCartItems } from "../lib/misc.js";

const app = new Hono<{ Variables: AuthType }>({
  strict: false,
});

app.get("/", async (c) => {
  const session = c.get("session");
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401); // 401 for unauthorized
  }

  const user = c.get("user");

  if (!user) throw new Error("User is required");

  const menuItems = await getCartItems(user);

  return c.json({
    success: true,
    data: menuItems,
  });
});

app.post("/", async (c) => {
  try {
    const session = c.get("session");
    if (!session) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const user = c.get("user");
    if (!user) {
      return c.json({ error: "User is required" }, 400);
    }

    const { menuItemId } = await c.req.json();
    const groupId = c.req.query("groupId");

    console.log(menuItemId, groupId);

    if (!menuItemId) {
      return c.json({ error: "menuItemId is required" }, 400);
    }

    let cart;

    if (groupId) {
      // Check if user is a member of the group
      const groupMembership = await prisma.groupMembership.findUnique({
        where: {
          groupId_userId: {
            groupId: parseInt(groupId),
            userId: user.id,
          },
        },
      });

      if (!groupMembership) {
        return c.json({ error: "You are not a member of this group" }, 403);
      }

      // Find group cart
      cart = await prisma.cart.findUnique({
        where: { groupId: parseInt(groupId) },
      });

      if (!cart) {
        return c.json({ error: "Group cart not found" }, 404);
      }
    } else {
      // Find user cart
      cart = await prisma.cart.findUnique({
        where: { userId: user.id },
      });

      if (!cart) {
        return c.json({ error: "User cart not found" }, 404);
      }
    }

    // Verify menu item exists
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: parseInt(menuItemId) },
    });

    if (!menuItem) {
      return c.json({ error: "Menu item not found" }, 404);
    }

    // Add item to cart
    const cartItem = await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        menuItemId: parseInt(menuItemId),
        userId: user.id,
      },
    });

    return c.json({
      success: true,
      data: {
        id: cartItem.id,
        menuItemId: cartItem.menuItemId,
        cartId: cartItem.cartId,
      },
    });
  } catch (err) {
    console.error("Error adding item to cart:", err);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

export default app;
