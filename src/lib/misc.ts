import { PrismaClient } from "../../generated/prisma/client.js";
const prisma = new PrismaClient();

export const createUserCart = async (user) => {
  await prisma.cart.create({
    data: {
      userId: user.id,
    },
  });
};
