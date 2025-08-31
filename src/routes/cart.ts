import { Hono } from "hono";
import { PrismaClient } from "../../generated/prisma/client.js";
const prisma = new PrismaClient();
import type { AuthType } from "../lib/auth.js";

import { addMenuItemToCart, getCartItems } from "../lib/misc.js";

const app = new Hono<{ Variables: AuthType }>({
  strict: false,
});

app.get("/items", async (c) => {
  try {
    const user = c.get("user");
    const userId = user?.id;
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const groupId = c.req.query("groupId");

    let cart;

    if (groupId) {
      // Check if user is a member of the group
      const groupMembership = await prisma.groupMembership.findUnique({
        where: {
          groupId_userId: {
            groupId: parseInt(groupId),
            userId: userId,
          },
        },
      });

      if (!groupMembership) {
        return c.json({ error: "You are not a member of this group" }, 403);
      }

      // Fetch group cart
      cart = await prisma.cart.findUnique({
        where: { groupId: parseInt(groupId) },
        include: {
          items: {
            include: {
              MenuItem: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  ingredients: true,
                },
              },
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
    } else {
      // Fetch user cart
      cart = await prisma.cart.findUnique({
        where: { userId: userId },
        include: {
          items: {
            include: {
              MenuItem: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  ingredients: true,
                },
              },
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
    }

    if (!cart) {
      return c.json({ error: "Cart not found" }, 404);
    }

    return c.json({
      cartItems: cart.items.map((item) => ({
        id: item.MenuItem.id,
        name: item.MenuItem.name,
        price: item.MenuItem.price,
        ingredients: item.MenuItem.ingredients,
        addedBy: {
          id: item.User?.id,
          name: item.User?.name,
        },
      })),
    });
  } catch (err) {
    console.error("Error fetching cart:", err);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

app.post("/", async (c) => {
  try {
    const user = c.get("user");
    const userId = user?.id;
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { menuItemId } = await c.req.json();
    const groupId = c.req.query("groupId");

    if (!menuItemId) {
      return c.json({ error: "menuItemId is required" }, 400);
    }

    // Find the appropriate cart
    let cart;
    if (groupId) {
      // Check if user is in the group
      const membership = await prisma.groupMembership.findUnique({
        where: {
          groupId_userId: {
            groupId: parseInt(groupId),
            userId: userId,
          },
        },
      });

      if (!membership) {
        return c.json({ error: "Not a member of this group" }, 403);
      }

      cart = await prisma.cart.findUnique({
        where: { groupId: parseInt(groupId) },
      });
    } else {
      cart = await prisma.cart.findUnique({
        where: { userId: userId },
      });
    }

    if (!cart) {
      return c.json({ error: "Cart not found" }, 404);
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
        userId: userId,
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
// app.post("/", async (c) => {
//   const session = c.get("session");
//   if (!session) {
//     return c.json({ error: "Unauthorized" }, 401); // 401 for unauthorized
//   }
//
//   const user = c.get("user");
//   if (!user) return c.json({ error: "Unauthorized" }, 401);
//
//   const normalizedUser = {
//     ...user,
//
//     image: user!.image ?? null,
//   };
//
//   try {
//     const body = await c.req.json();
//     if (!body.menuItemId) {
//       return c.json({ error: "menuItemId is required" }, 400);
//     }
//
//     await addMenuItemToCart(normalizedUser, body.menuItemId); // Make sure this is awaited!
//
//     return c.json({ message: "Menu item added to cart" }, 201);
//   } catch (err) {
//     console.error("Cart error:", err);
//
//     // let status;
//     //
//     // // Differentiate between client and server errors
//     // if (err instanceof prisma.PrismaClientKnownRequestError) {
//     //   // Handle Prisma-specific errors (400 Bad Request)
//     //   return c.json({ error: "Database error", details: err.message }, 400);
//     // } else {
//     //   // Generic server error (500)
//     //
//     return c.json({ error: "Failed to update cart" }, 500);
//   }
// });

export default app;
