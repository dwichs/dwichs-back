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

      if (!cart) {
        return c.json({ error: "Group cart not found" }, 404);
      }
    } else {
      // Fetch user cart or create if it doesn't exist
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

      // Create user cart if it doesn't exist
      if (!cart) {
        cart = await prisma.cart.create({
          data: {
            userId: userId,
          },
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
    }

    return c.json({
      cartItems: cart.items.map((item) => ({
        cartItemId: item.id,
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

    // Find or create the appropriate cart
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

      if (!cart) {
        return c.json({ error: "Group cart not found" }, 404);
      }
    } else {
      // Find or create user cart
      cart = await prisma.cart.findUnique({
        where: { userId: userId },
      });

      // Create cart if it doesn't exist for the user
      if (!cart) {
        cart = await prisma.cart.create({
          data: {
            userId: userId,
          },
        });
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

app.delete("/:cartItemId", async (c) => {
  try {
    const user = c.get("user");
    const userId = user?.id;
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const cartItemId = parseInt(c.req.param("cartItemId"));
    const groupId = c.req.query("groupId");

    if (isNaN(cartItemId)) {
      return c.json({ error: "Invalid cart item ID" }, 400);
    }

    console.log(cartItemId);

    // Find the cart item to verify it exists and get cart info
    const cartItem = await prisma.cartItem.findUnique({
      where: { id: cartItemId },
      include: {
        Cart: true,
      },
    });

    if (!cartItem) {
      return c.json({ error: "Cart item not found" }, 404);
    }

    // Verify user has permission to delete this item
    if (groupId) {
      // For group cart: check if user is a member of the group
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

      // Verify the cart item belongs to the specified group cart
      if (cartItem.Cart.groupId !== parseInt(groupId)) {
        return c.json(
          { error: "Cart item does not belong to this group cart" },
          400,
        );
      }
    } else {
      // For personal cart: verify the cart item belongs to the user's cart
      if (cartItem.Cart.userId !== userId) {
        return c.json({ error: "Cart item does not belong to your cart" }, 403);
      }
    }

    // Delete the cart item
    await prisma.cartItem.delete({
      where: { id: cartItemId },
    });

    return c.json({
      success: true,
      message: "Item removed from cart",
    });
  } catch (err) {
    console.error("Error deleting cart item:", err);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

export default app;
