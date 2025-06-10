import { PrismaClient } from "../generated/prisma/client.js";
const prisma = new PrismaClient();

async function main() {
  // Create 2 users
  const user1 = await prisma.user.create({
    data: {
      id: "user1",
      name: "John Doe",
      email: "john@example.com",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  const user2 = await prisma.user.create({
    data: {
      id: "user2",
      name: "Jane Smith",
      email: "jane@example.com",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  const role1 = await prisma.role.create({
    data: {
      name: "customer",
      description: "a customer",
    },
  });

  const role2 = await prisma.role.create({
    data: {
      name: "restaurant",
      description: "a restaurant",
    },
  });

  const userRole1 = await prisma.userRole.create({
    data: {
      userId: "user1",
      roleId: 1,
    },
  });

  const userRole2 = await prisma.userRole.create({
    data: {
      userId: "user2",
      roleId: 2,
    },
  });

  // Create 5 restaurants with addresses
  const restaurants = [
    {
      name: "le switch",
      description: "French cuisine at its finest",
      logoUrl: "https://example.com/bistro.jpg",
      address: {
        street: "123 Main St",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        country: "USA",
        latitude: 40.7128,
        longitude: -74.006,
      },
    },
    {
      name: "zanzibar",
      description: "Authentic Italian pasta dishes",
      logoUrl: "https://example.com/pasta.jpg",
      address: {
        street: "456 Elm St",
        city: "Chicago",
        state: "IL",
        postalCode: "60601",
        country: "USA",
        latitude: 41.8781,
        longitude: -87.6298,
      },
    },
    {
      name: "Sushi World",
      description: "Fresh Japanese sushi",
      logoUrl: "https://example.com/sushi.jpg",
      address: {
        street: "789 Oak St",
        city: "Los Angeles",
        state: "CA",
        postalCode: "90001",
        country: "USA",
        latitude: 34.0522,
        longitude: -118.2437,
      },
    },
    {
      name: "Burger Barn",
      description: "Classic American burgers",
      logoUrl: "https://example.com/burger.jpg",
      address: {
        street: "101 Pine St",
        city: "Austin",
        state: "TX",
        postalCode: "73301",
        country: "USA",
        latitude: 30.2672,
        longitude: -97.7431,
      },
    },
    {
      name: "Taco Fiesta",
      description: "Mexican street food",
      logoUrl: "https://example.com/taco.jpg",
      address: {
        street: "202 Maple St",
        city: "Miami",
        state: "FL",
        postalCode: "33101",
        country: "USA",
        latitude: 25.7617,
        longitude: -80.1918,
      },
    },
  ];

  for (const restaurantData of restaurants) {
    await prisma.restaurant.create({
      data: {
        name: restaurantData.name,
        description: restaurantData.description,
        logoUrl: restaurantData.logoUrl,
        Address: {
          create: {
            street: restaurantData.address.street,
            city: restaurantData.address.city,
            state: restaurantData.address.state,
            postalCode: restaurantData.address.postalCode,
            country: restaurantData.address.country,
            latitude: restaurantData.address.latitude,
            longitude: restaurantData.address.longitude,
          },
        },
      },
    });
  }

  // create order items
  await prisma.menuItem.createMany({
    data: [
      {
        name: "Margherita Pizza",
        category: "Pizza",
        ingredients: "Tomato sauce, mozzarella, basil",
        description: "Classic Italian pizza with fresh basil",
        price: 12.99,
        imageUrl: "https://example.com/pizza.jpg",
        restaurantId: 1,
      },
      {
        name: "Caesar Salad",
        category: "Salad",
        ingredients: "Romaine lettuce, croutons, parmesan, Caesar dressing",
        description: "Fresh crisp salad with homemade dressing",
        price: 8.99,
        imageUrl: "https://example.com/salad.jpg",
        restaurantId: 1,
      },
      {
        name: "Beef Burger",
        category: "Burger",
        ingredients: "Beef patty, cheese, lettuce, tomato, onion",
        description: "Juicy 1/2 pound beef burger with all the fixings",
        price: 10.99,
        imageUrl: "https://example.com/burger.jpg",
        restaurantId: 1,
      },
      {
        name: "Chocolate Cake",
        category: "Dessert",
        ingredients: "Flour, eggs, chocolate, sugar, butter",
        description: "Rich chocolate cake with fudge frosting",
        price: 6.99,
        imageUrl: "https://example.com/cake.jpg",
        restaurantId: 2,
      },
      {
        name: "Iced Coffee",
        category: "Drink",
        ingredients: "Coffee, milk, ice, sugar",
        description: "Refreshing cold coffee drink",
        price: 3.99,
        imageUrl: "https://example.com/coffee.jpg",
        restaurantId: 2,
      },
    ],
    skipDuplicates: true,
  });

  const statuses = [
    { name: "Pending" },
    { name: "Ready for Pickup" },
    { name: "Picked Up" },
    { name: "Cancelled" },
  ];

  await prisma.orderStatus.createMany({
    data: statuses,
    skipDuplicates: true,
  });

  console.log("Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
