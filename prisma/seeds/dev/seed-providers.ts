import { PrismaClient, SupportedChannel } from '@prisma/client';

export async function seedProviders(prisma: PrismaClient) {
    console.log('Seeding providers...');
    await prisma.provider.upsert({
        where: { providerId: 'mock-multi-provider' },
        update: {},
        create: {
            providerId: 'mock-multi-provider',
            name: 'mock provider',
            from: 'mock@example.com',
            description: 'Mock provider for testing',
            supportedChannels: [
                SupportedChannel.email,
                SupportedChannel.sms,
                SupportedChannel.push,
                SupportedChannel.webhook,
            ],
        },
    });

    await prisma.provider.upsert({
        where: { providerId: 'sendgrid-provider' },
        update: {},
        create: {
            providerId: 'sendgrid-provider',
            name: 'sendgrid provider',
            from: 'test@example.com',
            description: 'Sendgrid email provider',
            supportedChannels: [SupportedChannel.email],
            options: { sendGridApiKey: 'your-sendgrid-api-key' },
        },
    });

    await prisma.provider.upsert({
        where: { providerId: 'gmail-provider' },
        update: {},
        create: {
            providerId: 'gmail-provider',
            name: 'gmail provider',
            from: 'test@example.com',
            description: 'Gmail email provider',
            supportedChannels: [SupportedChannel.email],
            options: {
                gmailUser: 'your-gmail-user',
                gmailPass: 'your-gmail-pass',
            },
        },
    });

    console.log('✅ Provider seeded');
}
