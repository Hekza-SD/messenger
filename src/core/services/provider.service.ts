import { AbstractProvider } from '../../providers/abstract-provider';
import { ProviderFactory } from '../../providers/provider-factory';
import pinoLogger from '../../logger';
import { Provider, SupportedChannel } from '@prisma/client';
import prisma from '../../prisma';

export class ProviderService {
    private static providers = new Map<string, AbstractProvider>();

    static getAll(): Promise<Provider[]> {
        return prisma.provider.findMany();
    }

    /**
     * This method should be called once at application startup.
     * Initializes all providers based on the configuration and validates their supported channels.
     *
     * @throws Will throw an error if any provider declares unsupported types.
     *
     */
    static async init() {
        const allConfigs = await this.getAll();
        for (const config of allConfigs) {
            const instance = ProviderFactory.create(config);

            pinoLogger.info(
                `[BOOT] Provider ${config.providerId} initialized with supported channels: ${instance.supportedChannels}`,
            );
            this.providers.set(config.providerId, instance);
        }
    }

    static async getAllProviders() {
        return prisma.provider.findMany();
    }

    static async getByProviderId(providerId: string): Promise<Provider | null> {
        return prisma.provider.findUnique({ where: { providerId } });
    }

    static async getById(id: number): Promise<Provider | null> {
        return prisma.provider.findUnique({ where: { id } });
    }

    static getInstanceByProviderId(providerId: string): AbstractProvider {
        const provider = this.providers.get(providerId);
        if (!provider) throw new Error(`Provider ${providerId} not found`);
        return provider;
    }

    static async validateSupportedChannels(
        providerInstance: AbstractProvider,
        channels: SupportedChannel[],
    ) {
        const invalid = channels.filter(
            (t) => !providerInstance.supportedChannels.includes(t),
        );

        if (invalid.length > 0) {
            throw new Error(
                `Provider "${providerInstance.constructor.name}" does not support channels: ${invalid}. Supported channels are: ${providerInstance.supportedChannels}`,
            );
        }
    }
}
