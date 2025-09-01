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
    const result = await prisma.$transaction(async (tx) => {
      // Create the order
      const newOrder = await tx.order.create({
        data: {
          totalPrice: totalPrice,
          statusId: 1, // Assuming 1 is "pending" status
          restaurantId: restaurantId,
        },
      });

      // Create order participants
      let uniqueUserIds;
      if (groupId) {
        // For group orders, add all users who have items in cart
        uniqueUserIds = [...new Set(cart.items.map((item) => item.userId))];
        await tx.orderParticipants.createMany({
          data: uniqueUserIds.map((uid) => ({
            orderId: newOrder.id,
            userId: uid,
          })),
        });
      } else {
        // For individual orders, just add the current user
        uniqueUserIds = [userId];
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

      // Create payment record - user placing the order is the payer
      const payment = await tx.payment.create({
        data: {
          amount: totalPrice,
          status: "paid", // Payment status
          orderId: newOrder.id,
          userId: userId, // The user placing the order is the payer
          paymentMethodId: null,
          transactionReference: null,
        },
      });

      // Create reimbursements for group orders
      let reimbursements = [];
      if (groupId && uniqueUserIds.length > 1) {
        // Calculate what each user owes
        const userShares = {};

        // Calculate each user's share of the bill
        cart.items.forEach((item) => {
          const itemUserId = item.userId;
          const itemPrice = parseFloat(item.MenuItem.price);

          if (!userShares[itemUserId]) {
            userShares[itemUserId] = 0;
          }
          userShares[itemUserId] += itemPrice;
        });

        // Create reimbursement records for users who didn't pay
        const reimbursementPromises = uniqueUserIds
          .filter((participantId) => participantId !== userId) // Exclude the payer
          .map((debtorId) => {
            const amountOwed = userShares[debtorId] || 0;

            if (amountOwed > 0) {
              return tx.reimbursement.create({
                data: {
                  amount: amountOwed,
                  status: "unpaid",
                  description: `Reimbursement for order from ${cart.items[0]?.MenuItem?.Restaurant?.name || "restaurant"}`,
                  debtorId: debtorId,
                  creditorId: userId, // The person who paid
                  orderId: newOrder.id,
                },
              });
            }
            return null;
          })
          .filter(Boolean); // Remove null values

        reimbursements = await Promise.all(reimbursementPromises);
      }

      // Clear the cart after successful order
      await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      return {
        order: newOrder,
        payment,
        reimbursements,
        isGroupOrder: groupId && uniqueUserIds.length > 1,
      };
    });

    const response = {
      success: true,
      orderId: result.order.id,
      paymentId: result.payment.id,
      totalAmount: totalPrice,
      message: "Order placed successfully",
    };

    // Add reimbursement info for group orders
    if (result.isGroupOrder) {
      response.reimbursements = {
        created: result.reimbursements.length,
        totalOwed: result.reimbursements.reduce(
          (sum, r) => sum + parseFloat(r.amount),
          0,
        ),
        details: result.reimbursements.map((r) => ({
          id: r.id,
          debtorId: r.debtorId,
          amount: parseFloat(r.amount),
          status: r.status,
        })),
      };
    }

    return c.json(response);
  } catch (err) {
    console.error("Error creating order:", err);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

app.put("/:orderId/status", async (c) => {
  try {
    const user = c.get("user");
    const userId = user?.id;
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const orderId = parseInt(c.req.param("orderId"));
    const { status } = await c.req.json();

    if (isNaN(orderId)) {
      return c.json({ error: "Invalid order ID" }, 400);
    }

    if (!status) {
      return c.json({ error: "Status is required" }, 400);
    }

    // Validate status values
    const validStatuses = [
      "Pending",
      "Ready for Pickup",
      "Picked Up",
      "Cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return c.json({ error: "Invalid status value" }, 400);
    }

    // Find the order and verify ownership
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        Restaurant: {
          select: {
            ownerId: true,
          },
        },
      },
    });

    if (!order) {
      return c.json({ error: "Order not found" }, 404);
    }

    // Check if user owns the restaurant
    if (order.Restaurant.ownerId !== userId) {
      return c.json({ error: "You don't own this restaurant" }, 403);
    }

    // Find the status ID
    const orderStatus = await prisma.orderStatus.findFirst({
      where: { name: status },
    });

    if (!orderStatus) {
      return c.json({ error: "Status not found in database" }, 400);
    }

    // Update the order status
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { statusId: orderStatus.id },
    });

    return c.json({
      success: true,
      orderId: updatedOrder.id,
      status: status,
    });
  } catch (err) {
    console.error("Error updating order status:", err);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

export default app;
