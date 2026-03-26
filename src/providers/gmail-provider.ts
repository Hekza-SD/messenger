import nodemailer, {
    Transporter,
    SendMailOptions,
    SentMessageInfo,
} from 'nodemailer';
import { ProviderExecutionContext } from '../core/entities/provider-execution-ctx';
import { AbstractProvider } from './abstract-provider';
import { Provider, SupportedChannel } from '@prisma/client';
import z from 'zod';

export const GmailProviderOptionsSchema = z.object({
    gmailUser: z.string().min(5).max(100),
    gmailPass: z.string().min(5).max(100),
});
export type GmailProviderOptions = z.infer<typeof GmailProviderOptionsSchema>;

export class GmailProvider extends AbstractProvider<GmailProviderOptions> {
    readonly id = 'gmail-provider';
    get implementedChannels() {
        return ['email'] as SupportedChannel[];
    }

    private transporter: Transporter | undefined;

    constructor(provider: Provider) {
        super(provider, GmailProviderOptionsSchema);
        this.initTransporter();
    }

    initTransporter() {
        try {
            this.transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: this.providerConfig.options.gmailUser,
                    pass: this.providerConfig.options.gmailPass,
                },
            });
            console.log('Mailer transporter initialized successfully.');
        } catch (error: any) {
            console.warn(
                'Error while creating the mail transporter. SMTP Transport may not be reacheable',
                error,
            );
        }
    }

    protected async sendByChannel(
        channel: SupportedChannel,
        message: ProviderExecutionContext,
    ): Promise<string | undefined> {
        if (!this.transporter) {
            throw new Error(
                'GMAIL transporter is not initialized. Email could not be sent',
            );
        }
        switch (channel) {
            case 'email':
                const mailOptions = {
                    from: message.from || this.from,
                    to: message.to,
                    subject: message.subject,
                    html: message.body,
                } as SendMailOptions;

                try {
                    const info = await this.transporter.sendMail(mailOptions);
                    return info.messageId;
                } catch (error) {
                    throw new Error(`GMAIL Provider: Error sending email`, {
                        cause: error,
                    });
                }
            default:
                throw new Error(`Unsupported channel: ${channel}`);
        }
    }
}
