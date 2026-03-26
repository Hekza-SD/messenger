import { Worker as BullWorker } from 'bullmq';
import IORedis from 'ioredis';
import { BaseWorker } from './base-worker';
import pinoLogger from '../logger';
import { WorkerConfig } from '@prisma/client';
import { ScenarioService } from '../core/services/scenario.service';
import { QueueMessage } from '../core/entities/queue-message';
import { RedisManager } from '../core/queues/redis-connection';
import z from 'zod';

export const BullWorkerOptionsSchema = z.object({
    topic: z.string().min(3).max(100),
});
export type BullWorkerOptions = z.infer<typeof BullWorkerOptionsSchema>;

export class GenericBullWorker extends BaseWorker<BullWorkerOptions> {
    readonly id: string = 'generic-bull-worker';
    private connection?: IORedis;
    private worker?: BullWorker;

    constructor(workerConfig: WorkerConfig) {
        super(workerConfig, BullWorkerOptionsSchema);
    }

    protected async handleConnect(): Promise<void> {
        this.connection = await RedisManager.getInstance().getConnection(
            this.workerConfig.queueId,
        );

        await new Promise<void>((resolve) => {
            if (this.connection!.status === 'ready') {
                pinoLogger.info(
                    `[${this.workerConfig.workerConfigId}] Redis already ready`,
                );
                resolve();
                return;
            }

            this.connection!.once('ready', () => {
                pinoLogger.info(
                    `[${this.workerConfig.workerConfigId}] Redis connection ready`,
                );
                resolve();
            });
        });

        this.connection.on('end', async () => {
            pinoLogger.warn(
                this.workerConfig,
                `[${this.workerConfig.workerConfigId}] Redis connection lost`,
            );
            await this.teardownWorker();
        });

        this.connection.on('error', (err) => {
            pinoLogger.error(
                err,
                `[${this.workerConfig.workerConfigId}] Redis error`,
            );
        });
    }

    protected async handleSubscribe(): Promise<void> {
        if (this.worker || !this.connection)
            throw new Error('Worker already initialized or missing connection');

        pinoLogger.info(
            this.workerConfig,
            `[GenericBullWorker] Initializing BullMQ worker for queue: ${this.workerConfig.queueId}`,
        );

        this.worker = new BullWorker(
            this.workerConfig.options.topic,
            async (job) => await this.handleMessage(job.data),
            {
                connection: this.connection!.duplicate(),
                concurrency: this.workerConfig.concurrency ?? 1,
            },
        );

        this.worker.on('failed', (job, err) => {
            pinoLogger.error(
                { ...err, ...this.workerConfig },
                `[GenericBullWorker] Job failed`,
            );
        });

        this.worker.on('completed', (job) => {
            pinoLogger.info(
                this.workerConfig,
                `[GenericBullWorker] Job completed: ${job.id}`,
            );
        });
    }

    protected async teardownWorker(): Promise<void> {
        if (!this.worker) return;
        pinoLogger.info(
            this.workerConfig,
            '[GenericBullWorker] Closing BullMQ worker',
        );
        await this.worker.close();
        this.worker = undefined;
    }

    protected async handleDisconnect(): Promise<void> {
        await this.teardownWorker();
        await this.connection?.quit();
        this.connection = undefined;
    }

    protected async processMessage(message: QueueMessage): Promise<void> {
        await ScenarioService.execute(message);
    }
}
