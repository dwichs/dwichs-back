import { Hono } from "hono";
import { PrismaClient } from "../../generated/prisma/client.js";
const prisma = new PrismaClient();

const app = new Hono();

app.get("/restaurants", async (c) => {
  try {
    console.log("hello");
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

app.get("/restaurants/:id/orders", async (c) => {
  try {
    const session = c.get("session");

    if (!session) {
      return c.json({ error: "Unauthorized" }, 401); // 401 for unauthorized
    }

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

app.get("/restaurants/orders", async (c) => {
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

app.get("/restaurants/:id", async (c) => {
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
