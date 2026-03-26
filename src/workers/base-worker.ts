import { QueueMessage } from '../core/entities/queue-message';
import { bus } from '../core/bus';
import { EventNames } from '../core/bus/event-names';
import { getContext, runWithContext } from '../core/context';
import pinoLogger from '../logger';
import crypto from 'crypto';
import { WorkerConfig } from '@prisma/client';
import { BaseWorkerOptions } from '../config/types';
import { ZodSchema } from 'zod';

export type TypedWorkerConfig<T extends BaseWorkerOptions = BaseWorkerOptions> =
    Omit<WorkerConfig, 'options'> & { options: T };

export abstract class BaseWorker<
    TOptions extends BaseWorkerOptions = BaseWorkerOptions,
> {
    abstract id: string;
    protected workerConfig: TypedWorkerConfig<TOptions>;
    private readonly optionsSchema?: ZodSchema<TOptions>;

    constructor(
        workerConfig: WorkerConfig,
        optionsSchema?: ZodSchema<TOptions>,
    ) {
        if (optionsSchema) {
            this.optionsSchema = optionsSchema;
            this.validateWorkerOptions(workerConfig);
        }
        this.workerConfig = workerConfig as TypedWorkerConfig<TOptions>;
    }

    async handleMessage(message: QueueMessage): Promise<void> {
        const start = Date.now();

        if (!message.meta) message.meta = {};
        if (!message.meta.correlationId) {
            message.meta.correlationId = crypto.randomUUID();
            pinoLogger.debug(
                { correlationId: message.meta.correlationId, message },
                'Generated new correlationId',
            );
        }

        bus.emit(EventNames.WorkerMessageReceived, {
            workerId: this.workerConfig.workerConfigId,
            workerClass: this.workerConfig.workerImplId,
            message,
        });

        const correlationId = message.meta.correlationId;

        // Run the message processing promise chain within the context of the correlation ID
        await runWithContext({ correlationId }, async () => {
            const ctx = getContext();
            const logger = ctx?.logger ?? pinoLogger;

            if (!this.isValidQueueMessage(message)) {
                logger.warn({ message }, 'Invalid message format, skipped');
                return;
            }

            await this.processMessage(message);
        });

        const duration = Date.now() - start;
        bus.emit(EventNames.WorkerMessageProcessed, {
            workerId: this.id,
            durationMs: duration,
        });
    }

    async connect(): Promise<void> {
        await this.handleConnect();
        bus.emit(EventNames.WorkerConnected, {
            workerConfig: this.workerConfig,
            workerId: this.id,
        });
    }

    async subscribe(): Promise<void> {
        await this.handleSubscribe();
        bus.emit(EventNames.WorkerSubscribed, {
            workerConfig: this.workerConfig,
            workerId: this.id,
        });
    }

    async disconnect(): Promise<void> {
        await this.handleDisconnect();
        bus.emit(EventNames.WorkerDisconnected, { workerId: this.id });
    }

    protected abstract handleDisconnect(): Promise<void>;
    protected abstract handleConnect(): Promise<void>;
    protected abstract handleSubscribe(): Promise<void>;
    protected abstract processMessage(message: QueueMessage): Promise<void>;

    protected isValidQueueMessage(msg: any): msg is QueueMessage {
        return typeof msg?.applicationId === 'string' && Array.isArray(msg?.to);
    }

    protected validateWorkerOptions(
        config: WorkerConfig,
    ): asserts config is TypedWorkerConfig<TOptions> {
        if (!config.options) {
            throw new Error(
                `[${this.constructor.name}] workerConfig.options missing`,
            );
        }

        if (!this.optionsSchema) {
            throw new Error(
                `[${this.constructor.name}] workerConfig.optionsSchema missing. Cannot validate options.`,
            );
        }

        const parsed = this.optionsSchema.safeParse(config.options);

        if (!parsed.success) {
            const issues = parsed.error.issues
                .map((i) => `${i.path.join('.')}: ${i.message}`)
                .join(', ');
            throw new Error(
                `[${this.constructor.name}] Invalid workerConfig.options: ${issues}`,
            );
        }

        (config as any).options = parsed.data;
    }
}
