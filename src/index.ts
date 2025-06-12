import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { PrismaClient } from "../generated/prisma/client.js";
const prisma = new PrismaClient();

import { auth } from "./lib/auth.js";
import type { AuthType } from "./lib/auth.js";

import {
  createUserCart,
  addMenuItemToCart,
  getCartItems,
  getUserOrders,
} from "./lib/misc.js";

const app = new Hono<{
  Bindings: AuthType;
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

app.use(
  "/*",
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"], // Your SvelteKit frontend URL
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true, // Required for cookies/auth
  }),
);

app.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    c.set("user", null);
    c.set("session", null);
    return next();
  }

  c.set("user", session.user);
  c.set("session", session.session);
  return next();
});

app.use("/api/auth/sign-up/*", async (c, next) => {
  await next();

  if (c.res.ok) {
    const response = c.res.clone();
    const data = await response.json();

    createUserCart(data.user);
  }
});

// General auth handler
app.on(["POST", "GET"], "/api/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.get("/restaurants", async (c) => {
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
  } catch (error) {
    return c.json(
      {
        success: false,
        error: `Failed to fetch menuItems: ${error.message}`,
      },
      500,
    );
  }
});

app.get("/cart/items", async (c) => {
  const session = c.get("session");
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401); // 401 for unauthorized
  }

  const user = c.get("user");

  const menuItems = await getCartItems(user);

  return c.json({
    success: true,
    data: menuItems,
  });
});

app.post("/cart", async (c) => {
  const session = c.get("session");
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401); // 401 for unauthorized
  }

  const user = c.get("user");

  try {
    const body = await c.req.json();
    if (!body.menuItemId) {
      return c.json({ error: "menuItemId is required" }, 400);
    }

    await addMenuItemToCart(user, body.menuItemId); // Make sure this is awaited!

    return c.json({ message: "Menu item added to cart" }, 201);
  } catch (err) {
    console.error("Cart error:", err);

    // let status;
    //
    // // Differentiate between client and server errors
    // if (err instanceof prisma.PrismaClientKnownRequestError) {
    //   // Handle Prisma-specific errors (400 Bad Request)
    //   return c.json({ error: "Database error", details: err.message }, 400);
    // } else {
    //   // Generic server error (500)
    //
    return c.json({ error: "Failed to update cart" }, 500);
  }
});

app.get("/orders", async (c) => {
  const session = c.get("session");
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401); // 401 for unauthorized
  }

  const user = c.get("user");

  const userOrders = await getUserOrders(user);

  return c.json({
    success: true,
    data: userOrders,
  });
});

app.post("/orders", async (c) => {
  const session = c.get("session");
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  const user = c.get("user");

  const cart = await prisma.cart.findUnique({
    where: { userId: user.id },
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
        orderParticipants: { create: { userId: user.id } },
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

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
