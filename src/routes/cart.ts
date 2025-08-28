import { Hono } from "hono";

import { addMenuItemToCart, getCartItems } from "../lib/misc.js";

const app = new Hono();

app.get("/items", async (c) => {
  const session = c.get("session");
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401); // 401 for unauthorized
  }

  const user = c.get("user");

  if (!user) throw new Error("User is required");

  const menuItems = await getCartItems(user);

  return c.json({
    success: true,
    data: menuItems,
  });
});

app.post("", async (c) => {
  const session = c.get("session");
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401); // 401 for unauthorized
  }

  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const normalizedUser = {
    ...user,
    image: user!.image ?? null,
  };

  try {
    const body = await c.req.json();
    if (!body.menuItemId) {
      return c.json({ error: "menuItemId is required" }, 400);
    }

    await addMenuItemToCart(normalizedUser, body.menuItemId); // Make sure this is awaited!

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

export default app;
