import { Hono } from "hono";
import { PrismaClient } from "../../generated/prisma/client.js";
const prisma = new PrismaClient();

const app = new Hono();

// get restaurants
app.get("/", async (c) => {
  try {
    const restaurants = await prisma.restaurant.findMany();
    return c.json({
      success: true,
      data: restaurants,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: "Failed to fetch restaurants",
      },
      500,
    );
  }
});

// return orders of a specific restaurant
app.get("/:id/orders", async (c) => {
  try {
    // @ts-expect-error
    const session = c.get("session");

    if (!session) {
      return c.json({ error: "Unauthorized" }, 401); // 401 for unauthorized
    }

    // @ts-expect-error
    const user = c.get("user");

    const id = Number(c.req.param("id"));

    const orders = await prisma.order.findMany({
      where: { restaurantId: id },
      include: {
        OrderItem: true, // include all items for each order
        OrderStatus: true, // optional, include status info
      },
      orderBy: {
        orderDate: "desc",
      },
    });

    return c.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: "Failed to fetch restaurants owned by the restaurant owner",
      },
      500,
    );
  }
});

// also get restaurants ?
app.get("/orders", async (c) => {
  try {
    const restaurants = await prisma.restaurant.findMany();
    return c.json({
      success: true,
      data: restaurants,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: "Failed to fetch restaurants",
      },
      500,
    );
  }
});

// get the menu items of specific a restaurant
app.get("/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));

    const menuItems = await prisma.menuItem.findMany({
      where: {
        restaurantId: id,
      },
    });

    return c.json({
      success: true,
      data: menuItems,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(`Failed to fetch menuItems: ${error.message}`);
    } else {
      console.error("An unexpected error occurred", error);
    }
  }
});

export default app;
