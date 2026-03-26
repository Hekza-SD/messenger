import { ProviderExecutionContext } from '../core/entities/provider-execution-ctx';
import { AbstractProvider } from './abstract-provider';
import { Provider, SupportedChannel } from '@prisma/client';
import sgMail from '@sendgrid/mail';
import { config } from '../config';

export class SendGridProvider extends AbstractProvider {
    readonly id = 'sendgrid-provider';

    get implementedChannels() {
        return ['email'] as SupportedChannel[];
    }

    constructor(provider: Provider) {
        super(provider);
        if (!config.sendgridApiKey) {
            throw new Error(
                'SendGrid API key is not configured. Please set SENDGRID_API_KEY in the environment variables.',
            );
        }
        try {
            sgMail.setApiKey(config.sendgridApiKey);
        } catch (error) {
            throw new Error(
                'Failed to initialize SendGrid client. Please check the API key configuration.',
            );
        }
    }

    protected async sendByChannel(
        channel: SupportedChannel,
        message: ProviderExecutionContext,
    ): Promise<string | undefined> {
        switch (channel) {
            case 'email':
                try {
                    const response = await sgMail.send({
                        to: message.to,
                        cc: message.cc,
                        bcc: message.bcc,
                        subject: message.subject,
                        html: message.body,
                        from: this.from,
                        headers: message.headers,
                    });
                } catch (error) {
                    const errMsg =
                        error instanceof Error
                            ? error.message
                            : 'Unknown error occurred while sending email via SendGrid';
                    throw new Error(
                        `SendGridProvider failed to send email: ${errMsg}`,
                    );
                }

                break;
            default:
                throw new Error(`Unsupported channel: ${channel}`);
        }
        return;
    }
}
