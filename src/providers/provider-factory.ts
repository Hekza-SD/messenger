import { Provider } from '@prisma/client';
import { MockProvider } from './mock-provider';
import { AbstractProvider } from './abstract-provider';
import { SendGridProvider } from './sendgrid-provider';
import { GmailProvider } from './gmail-provider';

export class ProviderFactory {
    private static registry = new Map<
        string,
        new (provider: Provider) => AbstractProvider
    >([
        ['mock-multi-provider', MockProvider],
        ['sendgrid-provider', SendGridProvider],
        ['gmail-provider', GmailProvider],
    ]);

    /**
     * Returns an instance of the provider corresponding to the given provider ID.
     */
    static create(provider: Provider): AbstractProvider {
        const ProviderClass = this.registry.get(provider.providerId);

        if (!ProviderClass) {
            throw new Error(`Unknown provider: ${provider.providerId}`);
        }

        return new ProviderClass(provider);
    }
}
