import { PrismaClient } from "../generated/prisma/client.js";
const prisma = new PrismaClient();

async function main() {
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

  // Create users first (restaurant owners)
  const now = new Date();

  await prisma.user.create({
    data: {
      id: "owner1",
      name: "Restaurant Owner 1",
      email: "owner1@example.com",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    },
  });

  await prisma.user.create({
    data: {
      id: "owner2",
      name: "Restaurant Owner 2",
      email: "owner2@example.com",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    },
  });

  // Create 5 sandwich restaurants
  const restaurants = [
    {
      name: "Le Switch",
      description: "Gourmet sandwiches with a French twist",
      logoUrl: "https://example.com/leswitch.jpg",
      address: {
        street: "123 Rue de la Sandwich",
        city: "Paris",
        state: "IDF",
        postalCode: "75001",
        country: "France",
        latitude: 48.8566,
        longitude: 2.3522,
      },
    },
    {
      name: "Rezistanz",
      description: "Bold flavors and rebellious sandwiches",
      logoUrl: "https://example.com/rezistanz.jpg",
      address: {
        street: "456 Revolution Street",
        city: "Berlin",
        state: "BE",
        postalCode: "10115",
        country: "Germany",
        latitude: 52.52,
        longitude: 13.405,
      },
    },
    {
      name: "Sandwich Central",
      description: "Your go-to spot for classic sandwiches",
      logoUrl: "https://example.com/sandwichcentral.jpg",
      address: {
        street: "789 Main Avenue",
        city: "New York",
        state: "NY",
        postalCode: "10001",
        country: "USA",
        latitude: 40.7128,
        longitude: -74.006,
      },
    },
    {
      name: "The Bread Box",
      description: "Artisanal sandwiches made with fresh bread daily",
      logoUrl: "https://example.com/breadbox.jpg",
      address: {
        street: "321 Baker Street",
        city: "London",
        state: "ENG",
        postalCode: "NW1 6XE",
        country: "UK",
        latitude: 51.5074,
        longitude: -0.1278,
      },
    },
    {
      name: "Sub & More",
      description: "Submarine sandwiches and specialty subs",
      logoUrl: "https://example.com/subandmore.jpg",
      address: {
        street: "654 Ocean Drive",
        city: "Miami",
        state: "FL",
        postalCode: "33139",
        country: "USA",
        latitude: 25.7617,
        longitude: -80.1918,
      },
    },
  ];

  // Create restaurants with actual owners
  console.log("Creating restaurants...");
  const restaurantOwners = ["owner1", "owner2", "owner1", "owner2", "owner1"]; // Alternating ownership

  for (let i = 0; i < restaurants.length; i++) {
    const restaurantData = restaurants[i];
    console.log(
      `Creating restaurant ${i + 1}: ${restaurantData.name} with owner: ${restaurantOwners[i]}`,
    );

    await prisma.restaurant.create({
      data: {
        name: restaurantData.name,
        description: restaurantData.description,
        logoUrl: restaurantData.logoUrl,
        ownerId: restaurantOwners[i],
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
  console.log("Restaurants created successfully.");

  // Sandwich menu items for each restaurant
  const sandwichMenus = [
    // Le Switch (Restaurant 1)
    [
      {
        name: "Le Croque Monsieur",
        category: "Sandwich",
        ingredients: "Ham, Gruyère cheese, béchamel sauce, brioche bread",
        description: "Classic French grilled ham and cheese sandwich",
        price: 7.5,
        imageUrl: "https://example.com/croque-monsieur.jpg",
        restaurantId: 1,
      },
      {
        name: "Le Parisien",
        category: "Sandwich",
        ingredients: "Brie cheese, prosciutto, arugula, baguette, fig jam",
        description: "Elegant French sandwich with premium ingredients",
        price: 8.0,
        imageUrl: "https://example.com/parisien.jpg",
        restaurantId: 1,
      },
      {
        name: "Le Végétarien",
        category: "Sandwich",
        ingredients: "Roasted vegetables, goat cheese, pesto, ciabatta",
        description: "Fresh vegetarian sandwich with Mediterranean flavors",
        price: 6.5,
        imageUrl: "https://example.com/vegetarien.jpg",
        restaurantId: 1,
      },
      {
        name: "Le Poulet Rôti",
        category: "Sandwich",
        ingredients: "Roasted chicken, camembert, lettuce, sourdough",
        description: "Tender roasted chicken with creamy French cheese",
        price: 7.75,
        imageUrl: "https://example.com/poulet-roti.jpg",
        restaurantId: 1,
      },
      {
        name: "Le Jambon Beurre",
        category: "Sandwich",
        ingredients: "French ham, butter, cornichons, fresh baguette",
        description: "Simple yet perfect traditional French sandwich",
        price: 5.5,
        imageUrl: "https://example.com/jambon-beurre.jpg",
        restaurantId: 1,
      },
    ],
    // Rezistanz (Restaurant 2)
    [
      {
        name: "The Rebel",
        category: "Sandwich",
        ingredients:
          "Spicy chorizo, pepper jack cheese, jalapeños, chipotle mayo, sourdough",
        description: "Fiery sandwich for those who dare to be different",
        price: 7.75,
        imageUrl: "https://example.com/rebel.jpg",
        restaurantId: 2,
      },
      {
        name: "Revolution",
        category: "Sandwich",
        ingredients: "Pulled pork, coleslaw, BBQ sauce, pickles, brioche bun",
        description: "A game-changing BBQ sandwich that breaks all rules",
        price: 8.0,
        imageUrl: "https://example.com/revolution.jpg",
        restaurantId: 2,
      },
      {
        name: "The Uprising",
        category: "Sandwich",
        ingredients:
          "Fried chicken, hot sauce, blue cheese, celery, kaiser roll",
        description: "Buffalo chicken sandwich with an attitude",
        price: 7.25,
        imageUrl: "https://example.com/uprising.jpg",
        restaurantId: 2,
      },
      {
        name: "Anarchy",
        category: "Sandwich",
        ingredients:
          "Mixed meats, multiple cheeses, everything sauce, pretzel roll",
        description: "Chaotic combination that somehow works perfectly",
        price: 8.0,
        imageUrl: "https://example.com/anarchy.jpg",
        restaurantId: 2,
      },
      {
        name: "Underground",
        category: "Sandwich",
        ingredients: "Black bean patty, avocado, sprouts, hummus, whole wheat",
        description: "Secret weapon of the plant-based resistance",
        price: 6.75,
        imageUrl: "https://example.com/underground.jpg",
        restaurantId: 2,
      },
    ],
    // Sandwich Central (Restaurant 3)
    [
      {
        name: "The Classic Club",
        category: "Sandwich",
        ingredients: "Turkey, bacon, lettuce, tomato, mayo, white bread",
        description: "Traditional club sandwich done right",
        price: 6.99,
        imageUrl: "https://example.com/classic-club.jpg",
        restaurantId: 3,
      },
      {
        name: "Reuben Supreme",
        category: "Sandwich",
        ingredients:
          "Corned beef, sauerkraut, Swiss cheese, Russian dressing, rye",
        description: "Premium version of the deli classic",
        price: 7.99,
        imageUrl: "https://example.com/reuben.jpg",
        restaurantId: 3,
      },
      {
        name: "Italian Hero",
        category: "Sandwich",
        ingredients:
          "Salami, pepperoni, provolone, lettuce, tomato, Italian dressing, sub roll",
        description: "Loaded Italian cold cut sandwich",
        price: 7.5,
        imageUrl: "https://example.com/italian-hero.jpg",
        restaurantId: 3,
      },
      {
        name: "Tuna Melt",
        category: "Sandwich",
        ingredients: "Tuna salad, cheddar cheese, tomato, sourdough bread",
        description: "Comfort food classic grilled to perfection",
        price: 6.49,
        imageUrl: "https://example.com/tuna-melt.jpg",
        restaurantId: 3,
      },
      {
        name: "Philly Cheesesteak",
        category: "Sandwich",
        ingredients: "Sliced steak, provolone, onions, peppers, hoagie roll",
        description: "Authentic Philadelphia-style cheesesteak",
        price: 8.0,
        imageUrl: "https://example.com/philly.jpg",
        restaurantId: 3,
      },
    ],
    // The Bread Box (Restaurant 4)
    [
      {
        name: "Artisan Turkey",
        category: "Sandwich",
        ingredients:
          "Roasted turkey, brie, cranberry sauce, arugula, multigrain",
        description: "Gourmet turkey sandwich on house-made bread",
        price: 7.0,
        imageUrl: "https://example.com/artisan-turkey.jpg",
        restaurantId: 4,
      },
      {
        name: "Mediterranean Delight",
        category: "Sandwich",
        ingredients:
          "Hummus, roasted red peppers, cucumber, feta, olives, pita",
        description: "Fresh and healthy Mediterranean flavors",
        price: 6.5,
        imageUrl: "https://example.com/mediterranean.jpg",
        restaurantId: 4,
      },
      {
        name: "Smoked Salmon Bagel",
        category: "Sandwich",
        ingredients:
          "Smoked salmon, cream cheese, capers, red onion, everything bagel",
        description: "Luxurious breakfast sandwich any time of day",
        price: 8.0,
        imageUrl: "https://example.com/salmon-bagel.jpg",
        restaurantId: 4,
      },
      {
        name: "Grilled Portobello",
        category: "Sandwich",
        ingredients:
          "Grilled portobello, goat cheese, roasted peppers, focaccia",
        description: "Hearty vegetarian option with bold flavors",
        price: 7.25,
        imageUrl: "https://example.com/portobello.jpg",
        restaurantId: 4,
      },
      {
        name: "The Breakfast Stack",
        category: "Sandwich",
        ingredients:
          "Scrambled eggs, bacon, cheese, hash browns, English muffin",
        description: "All-day breakfast sandwich that satisfies",
        price: 6.25,
        imageUrl: "https://example.com/breakfast-stack.jpg",
        restaurantId: 4,
      },
    ],
    // Sub & More (Restaurant 5)
    [
      {
        name: "The Submarine",
        category: "Sandwich",
        ingredients:
          "Ham, salami, turkey, provolone, lettuce, tomato, oil & vinegar, sub roll",
        description: "Our signature loaded submarine sandwich",
        price: 7.75,
        imageUrl: "https://example.com/submarine.jpg",
        restaurantId: 5,
      },
      {
        name: "Meatball Marinara",
        category: "Sandwich",
        ingredients:
          "House-made meatballs, marinara sauce, mozzarella, Italian herbs, sub roll",
        description: "Classic Italian-American comfort food",
        price: 7.49,
        imageUrl: "https://example.com/meatball.jpg",
        restaurantId: 5,
      },
      {
        name: "Chicken Parmesan",
        category: "Sandwich",
        ingredients:
          "Breaded chicken cutlet, marinara, mozzarella, parmesan, sub roll",
        description: "Crispy chicken parm sub that hits the spot",
        price: 8.0,
        imageUrl: "https://example.com/chicken-parm.jpg",
        restaurantId: 5,
      },
      {
        name: "Veggie Supreme",
        category: "Sandwich",
        ingredients:
          "Lettuce, tomato, cucumber, peppers, onions, cheese, Italian dressing, sub roll",
        description: "Fresh and loaded vegetarian submarine",
        price: 5.99,
        imageUrl: "https://example.com/veggie-supreme.jpg",
        restaurantId: 5,
      },
      {
        name: "The Captain's Choice",
        category: "Sandwich",
        ingredients: "Roast beef, turkey, ham, swiss, lettuce, mayo, sub roll",
        description: "Triple meat sub for serious appetites",
        price: 8.0,
        imageUrl: "https://example.com/captains-choice.jpg",
        restaurantId: 5,
      },
    ],
  ];

  // Create all menu items
  for (const menu of sandwichMenus) {
    await prisma.menuItem.createMany({
      data: menu,
      skipDuplicates: true,
    });
  }

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
  console.log("Created 5 sandwich restaurants:");
  console.log("- Le Switch (French gourmet sandwiches)");
  console.log("- Rezistanz (Bold and rebellious sandwiches)");
  console.log("- Sandwich Central (Classic American sandwiches)");
  console.log("- The Bread Box (Artisanal sandwiches)");
  console.log("- Sub & More (Submarine sandwiches)");
  console.log("Each restaurant has 5 unique sandwich menu items!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
