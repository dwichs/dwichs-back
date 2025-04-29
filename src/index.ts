import { serve } from "@hono/node-server";
import { Hono } from "hono";

import { PrismaClient } from "../generated/prisma/client.js";
const prisma = new PrismaClient();

const app = new Hono();

app.get("/", (c) => {
  async function main() {
    const allUsers = await prisma.user.findMany();
    console.log(allUsers);
  }

  main()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });

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

app.get("/restaurants/:id/menu-items", (c) => {
  async function main() {
    const restaurants = await prisma.restaurant.findMany();
    console.log(restaurants);
  }

  main()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });

  return c.text(`${c.req.param("id")}`);
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
