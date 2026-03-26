import { ProviderExecutionContext } from '../core/entities/provider-execution-ctx';
import { contextLogger } from '../core/context';
import { bus } from '../core/bus';
import { EventNames } from '../core/bus/event-names';
import { Provider, SupportedChannel } from '@prisma/client';
import { BaseProviderOptions } from '../config/types';
import { ZodSchema } from 'zod';

export interface ProviderChannelResult {
    providerId: string;
    channel: SupportedChannel;
    success: boolean;
    providerMessageId?: string;
    durationMs?: number;
    error?: string;
}

export type TypedProviderConfig<
    T extends BaseProviderOptions = BaseProviderOptions,
> = Omit<Provider, 'options'> & { options: T };

export abstract class AbstractProvider<
    TOptions extends BaseProviderOptions = BaseProviderOptions,
> {
    abstract readonly id: string;
    abstract get implementedChannels(): SupportedChannel[];
    private readonly optionsSchema?: ZodSchema<TOptions>;

    supportedChannels: SupportedChannel[] = [];
    from: string;
    protected providerConfig: TypedProviderConfig<TOptions>;

    constructor(provider: Provider, optionsSchema?: ZodSchema<TOptions>) {
        this.from = provider.from || '';
        this.setSupportedChannels(provider.supportedChannels);

        if (optionsSchema) {
            this.optionsSchema = optionsSchema;
            this.validateProviderOptions(provider);
        }
        this.providerConfig = provider as TypedProviderConfig<TOptions>;
    }

    public setSupportedChannels(channels: SupportedChannel[]) {
        this.supportedChannels = this.implementedChannels.filter((c) =>
            channels.includes(c),
        );
    }

    async send(
        ctx: ProviderExecutionContext,
    ): Promise<ProviderChannelResult[]> {
        const results: ProviderChannelResult[] = [];

        bus.emit(EventNames.ProviderSendStart, {
            providerId: this.id,
            payload: ctx,
        });
        const startTime = Date.now();

        const invalidChannels = ctx.channels.filter(
            (c) => !this.supportedChannels.includes(c),
        );

        if (invalidChannels.length) {
            const errorMsg = `Provider ${this.id} does not support channels: ${invalidChannels.join(', ')}`;
            contextLogger.error(errorMsg, { message: ctx });
            for (const c of invalidChannels) {
                results.push({
                    providerId: this.id,
                    channel: c,
                    success: false,
                    error: errorMsg,
                });
            }
        }

        const validChannels = ctx.channels.filter((c) =>
            this.supportedChannels.includes(c),
        );

        for (const channel of validChannels) {
            try {
                bus.emit(EventNames.ProviderBeforeSend, {
                    providerId: this.id,
                    payload: ctx,
                });

                const providerMessageId = await this.sendByChannel(
                    channel,
                    ctx,
                );

                const result: ProviderChannelResult = {
                    providerId: this.id,
                    channel,
                    success: true,
                    providerMessageId:
                        providerMessageId || `unknown-${Date.now()}`,
                    durationMs: Date.now() - startTime,
                };

                results.push(result);

                bus.emit(EventNames.ProviderAfterSend, {
                    providerId: this.id,
                    response: result,
                });
            } catch (err: any) {
                const errorMsg = err?.message || 'Unknown error';
                contextLogger.error(
                    `Error sending message via provider ${this.id} on channel ${channel}`,
                    { ctx, error: err },
                );

                const result: ProviderChannelResult = {
                    providerId: this.id,
                    channel,
                    success: false,
                    error: errorMsg,
                };

                results.push(result);

                bus.emit(EventNames.ProviderError, {
                    providerId: this.id,
                    error: err,
                });
            }
        }

        bus.emit(EventNames.ProviderSendEnd, { providerId: this.id, results });

        return results;
    }

    protected validateProviderOptions(
        config: Provider,
    ): asserts config is TypedProviderConfig<TOptions> {
        if (!config.options) {
            throw new Error(
                `[${this.constructor.name}] providerConfig.options missing`,
            );
        }

        if (!this.optionsSchema) {
            throw new Error(
                `[${this.constructor.name}] providerConfig.optionsSchema missing. Cannot validate options.`,
            );
        }

        const parsed = this.optionsSchema.safeParse(config.options);

        if (!parsed.success) {
            const issues = parsed.error.issues
                .map((i) => `${i.path.join('.')}: ${i.message}`)
                .join(', ');
            throw new Error(
                `[${this.constructor.name}] Invalid providerConfig.options: ${issues}`,
            );
        }

        (config as any).options = parsed.data;
    }

    protected abstract sendByChannel(
        channel: SupportedChannel,
        message: ProviderExecutionContext,
    ): Promise<string | undefined>;

    healthCheck?(): Promise<boolean>;
}
