import IORedis from 'ioredis';
import { QueueService } from '../services/queue.service';
import z from 'zod';
import { BaseQueueOptions } from '../../config';
import { QueueConfig } from '@prisma/client';

export type TypedQueueConfig<T extends BaseQueueOptions = BaseQueueOptions> =
    Omit<QueueConfig, 'options'> & { options: T };

export const RedisQueueOptionsSchema = z.object({ redisUrl: z.url() });
export type RedisQueueOptions = z.infer<typeof RedisQueueOptionsSchema>;

export class RedisManager {
    private static instance: RedisManager;
    private redisConnections: Map<string, IORedis>;

    private constructor() {
        this.redisConnections = new Map();
    }

    static getInstance(): RedisManager {
        if (!RedisManager.instance) {
            RedisManager.instance = new RedisManager();
        }
        return RedisManager.instance;
    }

    async getConnection(queueId: string): Promise<IORedis> {
        const queue = await QueueService.getByQueueId(queueId);

        if (!queue) {
            throw new Error(`Queue with ID ${queueId} not found`);
        }

        QueueService.validateQueueOptions<RedisQueueOptions>(
            queue,
            RedisQueueOptionsSchema,
        );

        const { redisUrl } = queue.options;

        if (!this.redisConnections.has(queueId)) {
            const connection = new IORedis(redisUrl, {
                maxRetriesPerRequest: null,
                enableReadyCheck: false,
            });
            this.redisConnections.set(queueId, connection);
        }
        return this.redisConnections.get(queueId)!;
    }

    closeConnection(queueId: string): void {
        const connection = this.redisConnections.get(queueId);
        if (connection) {
            connection.quit();
            this.redisConnections.delete(queueId);
        }
    }

    closeAll(): void {
        for (const [queueId, connection] of this.redisConnections) {
            connection.quit();
            this.redisConnections.delete(queueId);
        }
    }
}
