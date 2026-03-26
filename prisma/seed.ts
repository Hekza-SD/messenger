import { seedProd } from './seeds/prod';
import { seedDev } from './seeds/dev';
import { seedBase } from './seeds/base';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
async function main() {
    console.log('Seeding database...');

    await seedBase(prisma);

    if (process.env.NODE_ENV === 'prd') {
        await seedProd(prisma);
    } else {
        await seedDev(prisma);
    }

    console.log('Seeding complete.');
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
