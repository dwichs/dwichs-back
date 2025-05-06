import { PrismaClient } from "../../generated/prisma/client.js";
const prisma = new PrismaClient();

export const createUserCart = async (user) => {
  await prisma.cart.create({
    data: {
      userId: user.id,
    },
  });
};

export const addMenuItemToCart = async (user, menuItemId) => {
  const cartId = await prisma.cart.findUnique({
    where: {
      userId: user.id,
    },
    select: {
      id: true,
    },
  });

  await prisma.cartItem.create({
    data: {
      cartId: cartId.id,
      userId: user.id,
      menuItemId: menuItemId,
    },
  });
};

export const getCartItems = async (user) => {
  const cartItems = await prisma.cartItem.findMany({
    where: {
      userId: user.id,
    },
  });

  return cartItems;
};
