import { PrismaClient, Prisma } from "../generated/prisma/client.js";

const prisma = new PrismaClient();

async function main() {
  // 1. Create Roles
  const [adminRole, userRole] = await Promise.all([
    prisma.role.create({
      data: { name: "admin", description: "Administrator" },
    }),
    prisma.role.create({
      data: { name: "user", description: "Regular User" },
    }),
  ]);

  // 2. Create Users
  const [user1, user2] = await Promise.all([
    prisma.user.create({
      data: {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        phoneNumber: "+1234567890",
      },
    }),
    prisma.user.create({
      data: {
        firstName: "Jane",
        lastName: "Smith",
        email: "jane.smith@example.com",
      },
    }),
  ]);

  // 3. Assign Roles
  await Promise.all([
    prisma.userRole.create({
      data: { userId: user1.id, roleId: adminRole.id },
    }),
    prisma.userRole.create({
      data: { userId: user2.id, roleId: userRole.id },
    }),
  ]);

  // 4. Create Restaurant
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Burger Palace",
      description: "Home of the best burgers in town",
      Address: {
        create: {
          street: "456 Yummy Lane",
          city: "Foodville",
          state: "NY",
          postalCode: "67890",
          country: "USA",
        },
      },
      MenuItem: {
        create: [
          {
            name: "Classic Burger",
            category: "Burgers",
            price: new Prisma.Decimal("12.99"),
            ingredients: "Beef patty, lettuce, tomato, onion",
            description: "Our signature burger",
          },
          {
            name: "Veggie Burger",
            category: "Burgers",
            price: new Prisma.Decimal("11.99"),
            ingredients: "Black bean patty, avocado, sprouts",
            description: "Vegetarian delight",
          },
        ],
      },
    },
    include: {
      Address: true,
      MenuItem: true,
    },
  });

  // 5. Create Group
  const group = await prisma.group.create({
    data: {
      name: "Office Lunch Group",
      ownerId: user1.id,
      GroupMembership: {
        create: [
          { userId: user1.id, roleInGroup: "Organizer" },
          { userId: user2.id, roleInGroup: "Participant" },
        ],
      },
    },
  });

  // 6. Create Cart with Transaction
  const cart = await prisma.$transaction(async (tx) => {
    const cart = await tx.cart.create({
      data: {
        groupId: group.id,
        userId: user1.id,
      },
    });

    await tx.cartItem.createMany({
      data: [
        {
          cartId: cart.id,
          menuItemId: restaurant.MenuItem[0].id,
          quantity: 2,
          userId: user1.id,
          specialRequest: "No onions",
        },
        {
          cartId: cart.id,
          menuItemId: restaurant.MenuItem[1].id,
          quantity: 1,
          userId: user2.id,
        },
      ],
    });
    return cart;
  });

  // 7. Order Statuses
  const [pendingStatus, completedStatus] = await Promise.all([
    prisma.orderStatus.create({ data: { name: "Pending" } }),
    prisma.orderStatus.create({ data: { name: "Completed" } }),
  ]);

  // 8. Payment Method
  const paymentMethod = await prisma.paymentMethod.create({
    data: {
      type: "Credit Card",
      accountNumber: "**** **** **** 1234",
      expiryDate: new Date("2025-12-31"),
      isDefault: true,
      userId: user1.id,
    },
  });

  // 9. Create Order
  const order = await prisma.order.create({
    data: {
      totalPrice: new Prisma.Decimal("37.97"),
      statusId: completedStatus.id,
      paymentMethodId: paymentMethod.id,
      OrderItem: {
        create: [
          {
            priceAtOrder: new Prisma.Decimal("12.99"),
            nameAtOrder: "Classic Burger",
            quantity: 2,
            menuItemId: restaurant.MenuItem[0].id,
            userId: user1.id,
          },
          {
            priceAtOrder: new Prisma.Decimal("11.99"),
            nameAtOrder: "Veggie Burger",
            quantity: 1,
            menuItemId: restaurant.MenuItem[1].id,
            userId: user2.id,
          },
        ],
      },
      OrderGroupMember: {
        create: [{ userId: user1.id }, { userId: user2.id }],
      },
    },
  });

  // 10. Payment
  await prisma.payment.create({
    data: {
      amount: new Prisma.Decimal("37.97"),
      status: "Completed",
      paymentMethodId: paymentMethod.id,
      userId: user1.id,
      orderId: order.id,
      transactionReference: "TX123456789",
    },
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
