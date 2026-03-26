import { PrismaClient, SupportedChannel } from '@prisma/client';

export async function seedTemplates(prisma: PrismaClient) {
    console.log('Seeding templates...');
    const templates = [
        {
            templateId: 'mqr_user_welcome',
            providerId: 'sendgrid-provider',
            path: 'generic_user_welcome',
            channels: [SupportedChannel.email],
        },
        {
            templateId: 'mqr_confirmation_email',
            providerId: 'mock-multi-provider',
            path: 'mqr_confirmation_email',
            channels: [SupportedChannel.email, SupportedChannel.sms],
        },
    ];

    for (const tpl of templates) {
        await prisma.template.upsert({
            where: { templateId: tpl.templateId },
            update: {},
            create: {
                templateId: tpl.templateId,
                providerId: tpl.providerId,
                path: tpl.path,
                channels: tpl.channels,
            },
        });
    }
    console.log('✅ Template configurations seeded');
}
