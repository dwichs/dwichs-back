import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { User } from "../generated/prisma/client.js";

import restaurants from "./routes/restaurants.js";
import orders from "./routes/orders.js";
import cart from "./routes/cart.js";

import { PrismaClient } from "../generated/prisma/client.js";
const prisma = new PrismaClient();

import { auth } from "./lib/auth.js";
import type { AuthType } from "./lib/auth.js";

import { createUserCart, getUserOrders } from "./lib/misc.js";

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
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://dwichs.karitchi.com:443",
      "https://dwichs-merchants.karitchi.com:443",
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    c.set("user", null);
    c.set("session", null);
    console.log(session);
    return next();
  }

  c.set("user", session.user);
  c.set("session", session.session);

  return next();
});

app.route("/restaurants", restaurants);
app.route("/orders", orders);
app.route("/cart", cart);

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

app.get("/owners/restaurants", async (c) => {
  try {
    const session = c.get("session");

    if (!session) {
      return c.json({ error: "Unauthorized" }, 401); // 401 for unauthorized
    }

    const user = c.get("user");

    const restaurantsOfOwner = await prisma.restaurant.findMany({
      where: {
        ownerId: user?.id,
      },
    });

    return c.json({
      success: true,
      data: restaurantsOfOwner,
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

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
