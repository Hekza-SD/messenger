import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import type { RedisQueueConnectionConfig } from './types';

/**
 * Gestionnaire de connexions Redis autonome
 */
export class RedisConnectionManager {
    private static instance: RedisConnectionManager;
    private connections: Map<string, IORedis> = new Map();
    private queues: Map<string, Queue> = new Map();

    private constructor() {}

    static getInstance(): RedisConnectionManager {
        if (!RedisConnectionManager.instance) {
            RedisConnectionManager.instance = new RedisConnectionManager();
        }
        return RedisConnectionManager.instance;
    }

    /**
     * Obtient ou crée une connexion Redis pour une queue
     */
    async getConnection(config: RedisQueueConnectionConfig): Promise<IORedis> {
        const { queueId, redisUrl } = config;

        if (!this.connections.has(queueId)) {
            const connection = new IORedis(redisUrl, {
                maxRetriesPerRequest: null,
                enableReadyCheck: false,
                lazyConnect: true,
            });

            this.connections.set(queueId, connection);
        }

        return this.connections.get(queueId)!;
    }

    /**
     * Obtient ou crée une queue BullMQ
     */
    async getQueue(
        config: RedisQueueConnectionConfig,
        topic: string,
    ): Promise<Queue> {
        const queueKey = `${config.queueId}:${topic}`;

        if (!this.queues.has(queueKey)) {
            const connection = await this.getConnection(config);
            const queue = new Queue(topic, { connection });
            this.queues.set(queueKey, queue);
        }

        return this.queues.get(queueKey)!;
    }

    /**
     * Ferme une connexion spécifique
     */
    async closeConnection(queueId: string): Promise<void> {
        const connection = this.connections.get(queueId);
        if (connection) {
            await connection.quit();
            this.connections.delete(queueId);
        }

        // Fermer aussi les queues associées
        for (const [key, queue] of this.queues) {
            if (key.startsWith(`${queueId}:`)) {
                await queue.close();
                this.queues.delete(key);
            }
        }
    }

    /**
     * Ferme toutes les connexions
     */
    async closeAll(): Promise<void> {
        // Fermer toutes les queues
        await Promise.all(
            Array.from(this.queues.values()).map((queue) => queue.close()),
        );
        this.queues.clear();

        // Fermer toutes les connexions
        await Promise.all(
            Array.from(this.connections.values()).map((connection) =>
                connection.quit(),
            ),
        );
        this.connections.clear();
    }
}

/**
 * Producteur de messages autonome
 */
export class MessageProducer {
    private connectionManager = RedisConnectionManager.getInstance();

    /**
     * Envoie un message dans une queue
     */
    async enqueue(
        data: any,
        config: RedisQueueConnectionConfig,
        topic: string,
        options: any = {},
    ): Promise<{ jobId: string }> {
        const queue = await this.connectionManager.getQueue(config, topic);

        const job = await queue.add('default', data, {
            delay: options.delay,
            attempts: options.jobOptions?.attempts || 3,
            backoff: options.jobOptions?.backoff || 'exponential',
            removeOnComplete: options.jobOptions?.removeOnComplete || 100,
            removeOnFail: options.jobOptions?.removeOnFail || 50,
            ...options.jobOptions,
        });

        return { jobId: job.id || 'unknown' };
    }

    /**
     * Ferme toutes les connexions
     */
    async close(): Promise<void> {
        await this.connectionManager.closeAll();
    }
}
