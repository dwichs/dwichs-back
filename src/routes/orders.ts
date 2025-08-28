import { Hono } from "hono";

import { PrismaClient } from "../../generated/prisma/client.js";
const prisma = new PrismaClient();

import { getUserOrders } from "../lib/misc.js";

const app = new Hono();

app.get("/", async (c) => {
  // @ts-expect-error
  const session = c.get("session");
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401); // 401 for unauthorized
  }

  // @ts-expect-error
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const normalizedUser = {
    ...user,
    // @ts-expect-error
    image: user.image ?? null,
  };

  // @ts-expect-error
  const userOrders = await getUserOrders(normalizedUser);

  return c.json({
    success: true,
    data: userOrders,
  });
});

app.post("/", async (c) => {
  // @ts-expect-error
  const session = c.get("session");
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  // @ts-expect-error
  const user = c.get("user");

  const cart = await prisma.cart.findUnique({
    // @ts-expect-error
    where: { userId: user!.id },
    include: { items: { include: { MenuItem: true } } },
  });

  if (!cart?.items.length) return c.json({ error: "Cart is empty" }, 400);

  const totalPrice = cart.items.reduce(
    (sum, ci) => sum + Number(ci.MenuItem.price),
    0,
  );

  const restaurantIdOfFirstItem = cart.items[0].MenuItem.restaurantId;

  const [orderCreated] = await prisma.$transaction([
    prisma.order.create({
      data: {
        totalPrice,
        orderDate: new Date(),
        OrderStatus: { connect: { id: 1 } },
        // @ts-expect-error
        orderParticipants: { create: { userId: user!.id } },
        Restaurant: {
          connect: { id: restaurantIdOfFirstItem },
        },
        OrderItem: {
          create: cart.items.map((ci) => ({
            menuItemId: ci.MenuItem.id,
            nameAtOrder: ci.MenuItem.name,
            priceAtOrder: ci.MenuItem.price,
            imageUrlAtOrder: ci.MenuItem.imageUrl,
            descriptionAtOrder: ci.MenuItem.description,
            specialRequest: ci.specialRequest,
          })),
        },
      },
      include: {
        OrderStatus: true,
        orderParticipants: true,
        OrderItem: true,
      },
    }),
    prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    }),
  ]);

  return c.json(
    {
      message: "Order placed and cart cleared.",
      order: orderCreated,
    },
    201,
  );
});

export default app;
