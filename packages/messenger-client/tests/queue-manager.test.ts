import { RedisConnectionManager, MessageProducer } from '../src/queue-manager';
import type { RedisQueueConnectionConfig } from '../src/types';
import IORedis from 'ioredis';
import { Queue } from 'bullmq';

// Mock des dépendances externes
jest.mock('ioredis');
jest.mock('bullmq');

const MockedIORedis = IORedis as jest.MockedClass<typeof IORedis>;
const MockedQueue = Queue as jest.MockedClass<typeof Queue>;

describe('RedisConnectionManager', () => {
    let connectionManager: RedisConnectionManager;
    let mockRedisConnection: jest.Mocked<IORedis>;
    let mockQueue: jest.Mocked<Queue>;
    let config: RedisQueueConnectionConfig;

    beforeEach(() => {
        // Reset singleton pour chaque test
        (RedisConnectionManager as any).instance = null;
        connectionManager = RedisConnectionManager.getInstance();

        // Configuration de test
        config = { queueId: 'test-queue', redisUrl: 'redis://localhost:6379' };

        // Mock Redis connection
        mockRedisConnection = {
            quit: jest.fn().mockResolvedValue('OK'),
            connect: jest.fn().mockResolvedValue(undefined),
            status: 'ready',
        } as any;

        MockedIORedis.mockImplementation(() => mockRedisConnection);

        // Mock Queue
        mockQueue = {
            add: jest.fn().mockResolvedValue({ id: 'job-123' }),
            close: jest.fn().mockResolvedValue(undefined),
            name: 'test-topic',
        } as any;

        MockedQueue.mockImplementation(() => mockQueue);
    });

    afterEach(async () => {
        await connectionManager.closeAll();
        jest.clearAllMocks();
    });

    describe('Singleton pattern', () => {
        it('should return same instance', () => {
            const instance1 = RedisConnectionManager.getInstance();
            const instance2 = RedisConnectionManager.getInstance();

            expect(instance1).toBe(instance2);
        });
    });

    describe('getConnection', () => {
        it('should create new connection with correct config', async () => {
            const connection = await connectionManager.getConnection(config);

            expect(MockedIORedis).toHaveBeenCalledWith(
                'redis://localhost:6379',
                expect.objectContaining({
                    maxRetriesPerRequest: null,
                    enableReadyCheck: false,
                    lazyConnect: true,
                }),
            );

            expect(connection).toBe(mockRedisConnection);
        });

        it('should reuse existing connection for same queueId', async () => {
            const connection1 = await connectionManager.getConnection(config);
            const connection2 = await connectionManager.getConnection(config);

            expect(connection1).toBe(connection2);
            expect(MockedIORedis).toHaveBeenCalledTimes(1);
        });

        it('should create separate connections for different queueIds', async () => {
            const config2 = { ...config, queueId: 'test-queue-2' };

            const connection1 = await connectionManager.getConnection(config);
            const connection2 = await connectionManager.getConnection(config2);

            expect(connection1).toBe(mockRedisConnection);
            expect(connection2).toBeDefined();
            expect(MockedIORedis).toHaveBeenCalledTimes(2);
        });
    });

    describe('getQueue', () => {
        it('should create new queue with correct config', async () => {
            const queue = await connectionManager.getQueue(
                config,
                'test-topic',
            );

            expect(MockedQueue).toHaveBeenCalledWith(
                'test-topic',
                expect.objectContaining({ connection: mockRedisConnection }),
            );

            expect(queue).toBe(mockQueue);
        });

        it('should reuse existing queue for same queueId and topic', async () => {
            const queue1 = await connectionManager.getQueue(
                config,
                'test-topic',
            );
            const queue2 = await connectionManager.getQueue(
                config,
                'test-topic',
            );

            expect(queue1).toBe(queue2);
            expect(MockedQueue).toHaveBeenCalledTimes(1);
        });

        it('should create separate queues for different topics', async () => {
            const queue1 = await connectionManager.getQueue(config, 'topic-1');
            const queue2 = await connectionManager.getQueue(config, 'topic-2');

            expect(queue1).toBeDefined();
            expect(queue2).toBeDefined();
            expect(MockedQueue).toHaveBeenCalledTimes(2);
        });

        it('should create separate queues for different queueIds', async () => {
            const config2 = { ...config, queueId: 'queue-2' };

            const queue1 = await connectionManager.getQueue(
                config,
                'test-topic',
            );
            const queue2 = await connectionManager.getQueue(
                config2,
                'test-topic',
            );

            expect(MockedQueue).toHaveBeenCalledTimes(2);
        });
    });

    describe('closeConnection', () => {
        it('should close specific connection and associated queues', async () => {
            // Créer une connexion et une queue
            await connectionManager.getConnection(config);
            await connectionManager.getQueue(config, 'test-topic');

            await connectionManager.closeConnection('test-queue');

            expect(mockRedisConnection.quit).toHaveBeenCalled();
            expect(mockQueue.close).toHaveBeenCalled();
        });

        it('should handle closing non-existent connection gracefully', async () => {
            await expect(
                connectionManager.closeConnection('non-existent-queue'),
            ).resolves.not.toThrow();
        });

        it('should close only queues for specified queueId', async () => {
            const config2 = { ...config, queueId: 'queue-2' };

            // Créer des queues pour différents queueIds
            await connectionManager.getQueue(config, 'topic-1');
            await connectionManager.getQueue(config2, 'topic-2');

            await connectionManager.closeConnection('test-queue');

            // Vérifier qu'une seule queue a été fermée
            expect(mockQueue.close).toHaveBeenCalledTimes(1);
        });
    });

    describe('closeAll', () => {
        it('should close all connections and queues', async () => {
            // Créer plusieurs connexions et queues
            await connectionManager.getConnection(config);
            await connectionManager.getQueue(config, 'topic-1');
            await connectionManager.getQueue(config, 'topic-2');

            const config2 = { ...config, queueId: 'queue-2' };
            await connectionManager.getConnection(config2);
            await connectionManager.getQueue(config2, 'topic-3');

            await connectionManager.closeAll();

            expect(mockRedisConnection.quit).toHaveBeenCalledTimes(2);
            expect(mockQueue.close).toHaveBeenCalledTimes(3);
        });

        it('should handle errors during closure gracefully', async () => {
            await connectionManager.getConnection(config);

            mockRedisConnection.quit.mockRejectedValue(
                new Error('Connection error'),
            );

            await expect(connectionManager.closeAll()).resolves.not.toThrow();
        });
    });
});

describe('MessageProducer', () => {
    let producer: MessageProducer;
    let mockConnectionManager: jest.Mocked<RedisConnectionManager>;
    let mockQueue: jest.Mocked<Queue>;
    let config: RedisQueueConnectionConfig;

    beforeEach(() => {
        producer = new MessageProducer();

        config = { queueId: 'test-queue', redisUrl: 'redis://localhost:6379' };

        // Mock du queue retourné par le connection manager
        mockQueue = {
            add: jest.fn().mockResolvedValue({ id: 'job-123' }),
            close: jest.fn().mockResolvedValue(undefined),
            name: 'test-topic',
        } as any;

        // Mock du connection manager
        mockConnectionManager = {
            getQueue: jest.fn().mockResolvedValue(mockQueue),
            closeAll: jest.fn().mockResolvedValue(undefined),
        } as any;

        // Remplacer l'instance du connection manager
        (producer as any).connectionManager = mockConnectionManager;
    });

    afterEach(async () => {
        await producer.close();
        jest.clearAllMocks();
    });

    describe('enqueue', () => {
        it('should enqueue message with default options', async () => {
            const data = { test: 'data' };

            const result = await producer.enqueue(data, config, 'test-topic');

            expect(mockConnectionManager.getQueue).toHaveBeenCalledWith(
                config,
                'test-topic',
            );
            expect(mockQueue.add).toHaveBeenCalledWith(
                'default',
                data,
                expect.objectContaining({
                    attempts: 3,
                    backoff: 'exponential',
                    removeOnComplete: 100,
                    removeOnFail: 50,
                }),
            );
            expect(result).toEqual({ jobId: 'job-123' });
        });

        it('should enqueue message with custom options', async () => {
            const data = { test: 'data' };
            const options = {
                delay: 5000,
                jobOptions: {
                    attempts: 5,
                    backoff: 'fixed' as const,
                    removeOnComplete: 10,
                    removeOnFail: 5,
                },
            };

            await producer.enqueue(data, config, 'test-topic', options);

            expect(mockQueue.add).toHaveBeenCalledWith(
                'default',
                data,
                expect.objectContaining({
                    delay: 5000,
                    attempts: 5,
                    backoff: 'fixed',
                    removeOnComplete: 10,
                    removeOnFail: 5,
                }),
            );
        });

        it('should handle job without ID', async () => {
            mockQueue.add.mockResolvedValue({ id: undefined } as any);

            const result = await producer.enqueue({}, config, 'test-topic');

            expect(result).toEqual({ jobId: 'unknown' });
        });

        it('should handle queue creation errors', async () => {
            mockConnectionManager.getQueue.mockRejectedValue(
                new Error('Queue creation failed'),
            );

            await expect(
                producer.enqueue({}, config, 'test-topic'),
            ).rejects.toThrow('Queue creation failed');
        });

        it('should handle job creation errors', async () => {
            mockQueue.add.mockRejectedValue(new Error('Job creation failed'));

            await expect(
                producer.enqueue({}, config, 'test-topic'),
            ).rejects.toThrow('Job creation failed');
        });

        it('should merge custom job options with defaults', async () => {
            const options = {
                jobOptions: {
                    attempts: 10,
                    // removeOnComplete non spécifié, doit utiliser la valeur par défaut
                },
            };

            await producer.enqueue({}, config, 'test-topic', options);

            expect(mockQueue.add).toHaveBeenCalledWith(
                'default',
                {},
                expect.objectContaining({
                    attempts: 10,
                    backoff: 'exponential', // Valeur par défaut
                    removeOnComplete: 100, // Valeur par défaut
                    removeOnFail: 50, // Valeur par défaut
                }),
            );
        });
    });

    describe('close', () => {
        it('should close connection manager', async () => {
            await producer.close();

            expect(mockConnectionManager.closeAll).toHaveBeenCalled();
        });

        it('should handle closure errors gracefully', async () => {
            mockConnectionManager.closeAll.mockRejectedValue(
                new Error('Close error'),
            );

            await expect(producer.close()).rejects.toThrow('Close error');
        });
    });

    describe('Integration scenarios', () => {
        it('should handle multiple enqueue operations', async () => {
            const data1 = { message: 'first' };
            const data2 = { message: 'second' };

            mockQueue.add
                .mockResolvedValueOnce({ id: 'job-1' } as any)
                .mockResolvedValueOnce({ id: 'job-2' } as any);

            const result1 = await producer.enqueue(data1, config, 'topic-1');
            const result2 = await producer.enqueue(data2, config, 'topic-2');

            expect(result1).toEqual({ jobId: 'job-1' });
            expect(result2).toEqual({ jobId: 'job-2' });
            expect(mockConnectionManager.getQueue).toHaveBeenCalledTimes(2);
        });

        it('should handle different queue configurations', async () => {
            const config2 = { ...config, queueId: 'queue-2' };

            await producer.enqueue({}, config, 'topic-1');
            await producer.enqueue({}, config2, 'topic-2');

            expect(mockConnectionManager.getQueue).toHaveBeenCalledWith(
                config,
                'topic-1',
            );
            expect(mockConnectionManager.getQueue).toHaveBeenCalledWith(
                config2,
                'topic-2',
            );
        });
    });
});
