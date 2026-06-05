/**
 * FileShift 数据库种子数据
 * 运行: npx pnpm --filter @fileshift/server prisma:seed
 */
import { PrismaClient } from '@prisma/client';
import { ALL_TOOLS, ToolCategory } from '@fileshift/shared';

const prisma = new PrismaClient();

async function seedTools() {
  console.log('Seeding tools...');

  for (const tool of ALL_TOOLS) {
    await prisma.tool.upsert({
      where: { id: tool.id },
      update: {
        name: tool.name,
        description: tool.description,
        category: tool.category,
        pointsCost: tool.pointsCost,
        vipDiscount: tool.vipDiscount,
        maxFileSize: tool.maxFileSize,
        inputFormats: tool.inputFormats,
        outputFormats: tool.outputFormats,
      },
      create: {
        id: tool.id,
        name: tool.name,
        description: tool.description,
        category: tool.category,
        pointsCost: tool.pointsCost,
        vipDiscount: tool.vipDiscount,
        maxFileSize: tool.maxFileSize,
        inputFormats: tool.inputFormats,
        outputFormats: tool.outputFormats,
        enabled: true,
      },
    });
  }

  console.log(`Seeded ${ALL_TOOLS.length} tools`);
}

async function seedPointsPackages() {
  console.log('Seeding points packages...');

  const packages = [
    {
      name: '体验包',
      points: 100,
      price: 990, // ¥9.90
      description: '适合轻度使用',
      sortOrder: 1,
    },
    {
      name: '标准包',
      points: 300,
      price: 2490, // ¥24.90
      description: '适合日常办公',
      sortOrder: 2,
    },
    {
      name: '超值包',
      points: 800,
      price: 5990, // ¥59.90
      description: '高频用户推荐',
      sortOrder: 3,
    },
    {
      name: '豪华包',
      points: 2000,
      price: 12990, // ¥129.90
      description: '团队使用首选',
      sortOrder: 4,
    },
  ];

  for (const pkg of packages) {
    await prisma.pointsPackage.upsert({
      where: { name: pkg.name },
      update: pkg,
      create: pkg,
    });
  }

  console.log(`Seeded ${packages.length} points packages`);
}

async function seedVipPackages() {
  console.log('Seeding VIP packages...');

  const vipPackages = [
    {
      type: 'MONTHLY',
      name: '月度VIP',
      price: 2990, // ¥29.90
      durationDays: 30,
      monthlyPoints: 200,
      discount: 0.8,
    },
    {
      type: 'QUARTERLY',
      name: '季度VIP',
      price: 7990, // ¥79.90
      durationDays: 90,
      monthlyPoints: 250,
      discount: 0.8,
    },
    {
      type: 'YEARLY',
      name: '年度VIP',
      price: 24990, // ¥249.90
      durationDays: 365,
      monthlyPoints: 300,
      discount: 0.7,
    },
  ];

  for (const pkg of vipPackages) {
    await prisma.vipPackage.upsert({
      where: { type: pkg.type as 'MONTHLY' | 'QUARTERLY' | 'YEARLY' },
      update: {
        name: pkg.name,
        price: pkg.price,
        durationDays: pkg.durationDays,
        monthlyPoints: pkg.monthlyPoints,
        discount: pkg.discount,
      },
      create: pkg as Record<string, unknown>,
    });
  }

  console.log(`Seeded ${vipPackages.length} VIP packages`);
}

async function main() {
  console.log('========================================');
  console.log('FileShift Database Seed');
  console.log('========================================');
  console.log('');

  await seedTools();
  await seedPointsPackages();
  await seedVipPackages();

  console.log('');
  console.log('========================================');
  console.log('Seed completed successfully!');
  console.log('========================================');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
