import { PrismaClient } from '@prisma/client';

export async function seedWorkersConfigs(prisma: PrismaClient) {
    console.log('Seeding worker configurations...');
    await prisma.workerConfig.upsert({
        where: { workerConfigId: 'bull-worker' },
        update: {},
        create: {
            workerConfigId: 'bull-worker',
            workerImplId: 'generic-bull-worker',
            queueId: 'messenger-queue',
            options: { topic: process.env.QUEUE_TOPIC || 'msg' },
        },
    });
    console.log('✅ Worker configurations seeded');
}
