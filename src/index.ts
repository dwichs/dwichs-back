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

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
