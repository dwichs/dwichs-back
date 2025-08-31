import { Hono } from "hono";

import { PrismaClient } from "../../generated/prisma/client.js";
const prisma = new PrismaClient();

import type { AuthType } from "../lib/auth.js";

import { getUserOrders } from "../lib/misc.js";

const app = new Hono<{ Variables: AuthType }>({
  strict: false,
});

app.get("/", async (c) => {
  const session = c.get("session");
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401); // 401 for unauthorized
  }

  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const normalizedUser = {
    ...user,

    image: user.image ?? null,
  };

  const userOrders = await getUserOrders(normalizedUser);

  return c.json({
    success: true,
    data: userOrders,
  });
});

app.get("/merchants", async (c) => {
  try {
    const user = c.get("user");
    const userId = user?.id;
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const restaurantId = c.req.query("restaurantId");
    if (!restaurantId) {
      return c.json({ error: "Restaurant ID is required" }, 400);
    }
    // Check if user owns this restaurant
    const restaurant = await prisma.restaurant.findUnique({
      where: {
        id: parseInt(restaurantId),
        ownerId: userId, // Verify ownership
      },
    });
    if (!restaurant) {
      return c.json(
        { error: "Restaurant not found or you don't own this restaurant" },
        403,
      );
    }
    // Get all orders for this restaurant
    const orders = await prisma.order.findMany({
      where: { restaurantId: restaurant.id },
      include: {
        OrderStatus: {
          select: {
            name: true,
          },
        },
        OrderItem: {
          select: {
            nameAtOrder: true,
            priceAtOrder: true,
            specialRequest: true,
          },
        },
      },
      orderBy: {
        orderDate: "desc",
      },
    });
    return c.json({
      orders: orders.map((order) => ({
        id: order.id,
        date: order.orderDate,
        status: order.OrderStatus.name,
        totalPrice: order.totalPrice,
        items: order.OrderItem.map((item) => ({
          name: item.nameAtOrder,
          price: item.priceAtOrder,
          specialRequest: item.specialRequest,
        })),
      })),
    });
  } catch (err) {
    console.error("Error fetching merchant orders:", err);
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

    const groupId = c.req.query("groupId");

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
        include: {
          items: {
            include: {
              MenuItem: true,
              User: true,
            },
          },
        },
      });
    } else {
      cart = await prisma.cart.findUnique({
        where: { userId: userId },
        include: {
          items: {
            include: {
              MenuItem: true,
              User: true,
            },
          },
        },
      });
    }

    if (!cart || cart.items.length === 0) {
      return c.json({ error: "Cart is empty" }, 400);
    }

    // Calculate total price
    const totalPrice = cart.items.reduce((sum, item) => {
      return sum + parseFloat(item.MenuItem.price);
    }, 0);

    // Get restaurant ID from first item (assuming all items from same restaurant)
    const restaurantId = cart.items[0].MenuItem.restaurantId;

    // Create order in a transaction
    const order = await prisma.$transaction(async (tx) => {
      // Create the order
      const newOrder = await tx.order.create({
        data: {
          totalPrice: totalPrice,
          statusId: 1, // Assuming 1 is "pending" status
          restaurantId: restaurantId,
        },
      });

      // Create order participants
      if (groupId) {
        // For group orders, add all users who have items in cart
        const uniqueUserIds = [
          ...new Set(cart.items.map((item) => item.userId)),
        ];
        await tx.orderParticipants.createMany({
          data: uniqueUserIds.map((uid) => ({
            orderId: newOrder.id,
            userId: uid,
          })),
        });
      } else {
        // For individual orders, just add the current user
        await tx.orderParticipants.create({
          data: {
            orderId: newOrder.id,
            userId: userId,
          },
        });
      }

      // Create order items
      await tx.orderItem.createMany({
        data: cart.items.map((item) => ({
          orderId: newOrder.id,
          priceAtOrder: item.MenuItem.price,
          nameAtOrder: item.MenuItem.name,
          imageUrlAtOrder: item.MenuItem.imageUrl,
          descriptionAtOrder: item.MenuItem.description,
          specialRequest: item.specialRequest,
          menuItemId: item.menuItemId,
          userId: item.userId,
        })),
      });

      // Clear the cart after successful order
      await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      return newOrder;
    });

    return c.json({
      success: true,
      orderId: order.id,
      message: "Order placed successfully",
    });
  } catch (err) {
    console.error("Error creating order:", err);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

export default app;
