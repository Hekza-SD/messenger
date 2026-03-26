import { ProviderExecutionContext } from '../core/entities/provider-execution-ctx';
import { contextLogger } from '../core/context';
import { AbstractProvider } from './abstract-provider';
import { Provider, SupportedChannel } from '@prisma/client';

export class MockProvider extends AbstractProvider {
    readonly id = 'mock-multi-provider';
    get implementedChannels() {
        return ['email', 'sms', 'push'] as SupportedChannel[];
    }

    constructor(provider: Provider) {
        super(provider);
    }

    protected async sendByChannel(
        channel: SupportedChannel,
        message: ProviderExecutionContext,
    ): Promise<string | undefined> {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        switch (channel) {
            case 'email':
                contextLogger.info(`[MOCK][EMAIL] Sending message`, {
                    message,
                });
                break;
            case 'sms':
                contextLogger.info(`[MOCK][SMS] Sending message`, { message });
                break;
            case 'push':
                contextLogger.info(`[MOCK][PUSH] Sending message`, { message });
                break;
            default:
                throw new Error(`Unsupported channel: ${channel}`);
        }
        return 'mock-provider-message-id';
    }
}
