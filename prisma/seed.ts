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

  // Create 5 restaurants with addresses
  const restaurants = [
    {
      name: "Bistro Central",
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
      name: "Pasta Palace",
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
