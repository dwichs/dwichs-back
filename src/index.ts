import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { PrismaClient } from "../generated/prisma/client.js";
const prisma = new PrismaClient();

import { auth } from "./lib/auth.js";
import type { AuthType } from "./lib/auth.js";

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
    origin: ["http://localhost:5173"], // Your SvelteKit frontend URL
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

app.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw));

// app.get("/", (c) => {
//   async function main() {
//     const allUsers = await prisma.user.findMany();
//     console.log(allUsers);
//   }
//
//   main()
//     .then(async () => {
//       await prisma.$disconnect();
//     })
//     .catch(async (e) => {
//       console.error(e);
//       await prisma.$disconnect();
//       process.exit(1);
//     });
//
//   return c.text("Hello Hono!");
// });

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

app.post("/cart", async (c) => {
  const { id } = c.get("user");
  const session = c.get("session");

  console.log(id);

  const { menuItemId } = await c.req.json();
  console.log(menuItemId);

  return c.json({ session });
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
