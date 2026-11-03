import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../apps/api/src/generated/prisma/client';

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DIRECT_URL or DATABASE_URL is required to seed the database');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString, max: 2 }),
});

const categories = [
  {
    name: 'Electronics',
    slug: 'electronics',
    description: 'Audio, phones and computing devices from trusted sellers.',
    children: [
      { name: 'Audio', slug: 'audio', description: 'Headphones, speakers and audio gear.' },
      { name: 'Smartphones', slug: 'smartphones', description: 'Phones and mobile accessories.' },
      { name: 'Computers', slug: 'computers', description: 'Laptops, monitors and peripherals.' },
    ],
  },
  {
    name: 'Fashion',
    slug: 'fashion',
    description: 'Everyday apparel and accessories.',
    children: [
      { name: 'Men', slug: 'men', description: 'Men’s clothing and accessories.' },
      { name: 'Women', slug: 'women', description: 'Women’s clothing and accessories.' },
    ],
  },
  {
    name: 'Home & Living',
    slug: 'home-living',
    description: 'Considered pieces for the home.',
    children: [
      { name: 'Kitchen', slug: 'kitchen', description: 'Cookware, tableware and appliances.' },
      { name: 'Decor', slug: 'decor', description: 'Lighting, textiles and decorative objects.' },
    ],
  },
  {
    name: 'Beauty & Personal Care',
    slug: 'beauty',
    description: 'Skincare, grooming and wellbeing.',
    children: [],
  },
  {
    name: 'Sports & Outdoors',
    slug: 'sports',
    description: 'Training, fitness and outdoor equipment.',
    children: [],
  },
  {
    name: 'Books & Stationery',
    slug: 'books',
    description: 'Reading, writing and desk essentials.',
    children: [],
  },
];

async function main(): Promise<void> {
  for (const parent of categories) {
    const created = await prisma.category.upsert({
      where: { slug: parent.slug },
      update: { name: parent.name, description: parent.description, isActive: true },
      create: {
        name: parent.name,
        slug: parent.slug,
        description: parent.description,
        isActive: true,
      },
    });
    for (const child of parent.children) {
      await prisma.category.upsert({
        where: { slug: child.slug },
        update: {
          name: child.name,
          description: child.description,
          parentId: created.id,
          isActive: true,
        },
        create: {
          name: child.name,
          slug: child.slug,
          description: child.description,
          parentId: created.id,
          isActive: true,
        },
      });
    }
  }
  // Reference data only. No demo products, orders, payments or sales are seeded.
  console.log('MarketHub categories seeded. No demo commerce data was created.');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
