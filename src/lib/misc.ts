import { PrismaClient } from "../../generated/prisma/client.js";
import type { User } from "../../generated/prisma/client.js";
const prisma = new PrismaClient();

export const createUserCart = async (user: User) => {
  await prisma.cart.create({
    data: {
      userId: user.id,
    },
  });
};

export const addMenuItemToCart = async (user: User, menuItemId: number) => {
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
      cartId: cartId!.id,
      userId: user.id,
      menuItemId: menuItemId,
    },
  });
};

export const getCartItems = async (user: {
  id: string;
  image?: string | null;
}) => {
  const cartWithMenuItems = await prisma.cart.findFirst({
    where: {
      userId: user.id, // or groupId if it's a group cart
    },
    include: {
      items: {
        include: {
          MenuItem: true, // Include full menu item details
        },
      },
    },
  });

  const menuItemsInCart =
    cartWithMenuItems?.items.map((item) => item.MenuItem) || [];

  return menuItemsInCart;
};

export const getUserOrders = async (user: User) => {
  const userOrders = await prisma.order.findMany({
    where: {
      orderParticipants: {
        some: {
          userId: user.id,
        },
      },
    },
    include: {
      orderParticipants: {
        include: {
          User: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      OrderItem: {
        include: {
          MenuItem: true,
        },
      },
      PaymentMethod: true,
      OrderStatus: true,
    },
    orderBy: {
      orderDate: "desc",
    },
  });

  return userOrders;
};
