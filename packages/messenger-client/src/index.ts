/**
 * @techspear/messenger-client
 *
 * Autonomous TypeScript client for sending messages via the Messenger system
 * Compatible with any Node.js/TypeScript project
 */

export { MessengerClient } from './messenger-client';
export { MessageBuilder } from './message-builder';
export { RedisConnectionManager, MessageProducer } from './queue-manager';

export type {
    MessengerClientConfig,
    SendMessageOptions,
    SimpleMessageData,
    SendMessageResponse,
    RedisQueueConnectionConfig,
    MessengerEvent,
    QueueMessage,
} from './types';

import { MessengerClient } from './messenger-client';
import type { MessengerClientConfig } from './types';

/**
 * Factory function to create a MessengerClient instance
 */
export function createMessengerClient(config: MessengerClientConfig = {}) {
    return new MessengerClient(config);
}

/**
 * Utilitaries for quick configuration
 */
export const MessengerUtils = {
    /**
     * Creates a default configuration for development usage
     */
    createDevConfig: (
        queueId: string,
        applicationId: string,
        redisUrl = 'redis://localhost:6379',
    ) => ({
        defaults: {
            queueId,
            topic: 'default',
            applicationId,
            meta: { priority: 'normal' as const, locale: 'fr' },
            delivery: { channel: ['email'] as const },
        },
        redis: { connectionTimeout: 5000, retries: 3, url: redisUrl },
    }),

    /**
     * Creates a default configuration for production usage
     */
    createProdConfig: (
        queueId: string,
        applicationId: string,
        redisUrl: string,
        apiUrl?: string,
    ) => ({
        apiUrl,
        defaults: {
            queueId,
            topic: 'production',
            applicationId,
            meta: { priority: 'normal' as const, locale: 'fr' },
            delivery: {
                channel: ['email'] as const,
                retryPolicy: {
                    maxRetries: 3,
                    backoff: 'exponential' as const,
                    delay: 1000,
                },
            },
        },
        redis: { connectionTimeout: 10000, retries: 5, url: redisUrl },
    }),

    /**
     * Creates a client with custom queue configuration
     */
    createClientWithQueues: (
        queues: Array<{
            queueId: string;
            redisUrl: string;
            defaultTopic?: string;
        }>,
    ) => {
        const client = new MessengerClient();

        queues.forEach((queue) => {
            client.configureQueue(
                queue.queueId,
                queue.redisUrl,
                queue.defaultTopic,
            );
        });

        return client;
    },
};

// Package version
export const VERSION = '1.0.0';
