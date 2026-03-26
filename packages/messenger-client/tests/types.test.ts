import { z } from 'zod';
import {
    RedisQueueConnectionConfigSchema,
    SimpleMessageDataSchema,
    MessengerClientConfigSchema,
    validateMessageData,
    validateClientConfig,
    validateQueueConfig,
} from '../src/types';
import type {
    RedisQueueConnectionConfig,
    SimpleMessageData,
    MessengerClientConfig,
    SendMessageOptions,
    SendMessageResponse,
    MessengerEvent,
} from '../src/types';

describe('Types et Validations', () => {
    describe('RedisQueueConnectionConfigSchema', () => {
        it('should validate correct Redis queue config', () => {
            const validConfig: RedisQueueConnectionConfig = {
                queueId: 'test-queue',
                redisUrl: 'redis://localhost:6379',
            };

            const result =
                RedisQueueConnectionConfigSchema.safeParse(validConfig);
            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data).toEqual(validConfig);
            }
        });

        it('should reject invalid Redis URL', () => {
            const invalidConfig = {
                queueId: 'test-queue',
                redisUrl: 'not-a-valid-url',
            };

            const result =
                RedisQueueConnectionConfigSchema.safeParse(invalidConfig);
            expect(result.success).toBe(false);

            if (!result.success) {
                expect(result.error.issues[0].path).toContain('redisUrl');
            }
        });

        it('should reject missing queueId', () => {
            const invalidConfig = { redisUrl: 'redis://localhost:6379' };

            const result =
                RedisQueueConnectionConfigSchema.safeParse(invalidConfig);
            expect(result.success).toBe(false);

            if (!result.success) {
                expect(result.error.issues[0].path).toContain('queueId');
            }
        });

        it('should reject empty queueId', () => {
            const invalidConfig = {
                queueId: '',
                redisUrl: 'redis://localhost:6379',
            };

            const result =
                RedisQueueConnectionConfigSchema.safeParse(invalidConfig);
            expect(result.success).toBe(false);
        });

        it('should accept Redis URLs with different protocols', () => {
            const configs = [
                { queueId: 'test', redisUrl: 'redis://localhost:6379' },
                { queueId: 'test', redisUrl: 'rediss://secure.redis.com:6380' },
                {
                    queueId: 'test',
                    redisUrl: 'redis://user:pass@redis.com:6379/0',
                },
            ];

            configs.forEach((config) => {
                const result =
                    RedisQueueConnectionConfigSchema.safeParse(config);
                expect(result.success).toBe(true);
            });
        });
    });

    describe('SimpleMessageDataSchema', () => {
        it('should validate correct message data', () => {
            const validData: SimpleMessageData = {
                scenarioId: 'test-scenario',
                to: ['user@example.com'],
                businessData: { name: 'John Doe' },
            };

            const result = SimpleMessageDataSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });

        it('should reject missing required fields', () => {
            const testCases = [
                {}, // Tous les champs manquants
                { scenarioId: 'test' }, // Manque to et businessData
                { to: ['test@example.com'] }, // Manque scenarioId et businessData
                { businessData: {} }, // Manque scenarioId et to
            ];

            testCases.forEach((testCase) => {
                const result = SimpleMessageDataSchema.safeParse(testCase);
                expect(result.success).toBe(false);
            });
        });

        it('should reject empty recipients array', () => {
            const invalidData = {
                scenarioId: 'test-scenario',
                to: [],
                businessData: { test: 'data' },
            };

            const result = SimpleMessageDataSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should validate optional fields correctly', () => {
            const completeData: SimpleMessageData = {
                applicationId: 'test-app',
                scenarioId: 'test-scenario',
                to: ['user@example.com'],
                cc: ['cc@example.com'],
                bcc: ['bcc@example.com'],
                businessData: { name: 'John' },
                subject: 'Test Subject',
                bodyOverride: 'Custom body',
                replyTo: 'noreply@example.com',
                channels: ['email', 'sms'],
                locale: 'fr',
                tags: ['tag1', 'tag2'],
                correlationId: 'corr-123',
                scheduleAt: new Date(),
                callbackUrl: 'https://example.com/webhook',
                trackEvents: ['queued', 'sent'],
            };

            const result = SimpleMessageDataSchema.safeParse(completeData);
            expect(result.success).toBe(true);
        });

        it('should reject invalid email addresses', () => {
            const invalidData = {
                scenarioId: 'test-scenario',
                to: ['invalid-email'],
                businessData: { test: 'data' },
            };

            const result = SimpleMessageDataSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should reject invalid channel values', () => {
            const invalidData = {
                scenarioId: 'test-scenario',
                to: ['user@example.com'],
                businessData: { test: 'data' },
                channels: ['invalid-channel'],
            };

            const result = SimpleMessageDataSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should reject invalid URL in callbackUrl', () => {
            const invalidData = {
                scenarioId: 'test-scenario',
                to: ['user@example.com'],
                businessData: { test: 'data' },
                callbackUrl: 'not-a-url',
            };

            const result = SimpleMessageDataSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should validate date strings and Date objects for scheduleAt', () => {
            const validDates = [
                new Date(),
                '2024-12-25T09:00:00Z',
                '2024-12-25T09:00:00.000Z',
            ];

            validDates.forEach((date) => {
                const data = {
                    scenarioId: 'test-scenario',
                    to: ['user@example.com'],
                    businessData: { test: 'data' },
                    scheduleAt: date,
                };

                const result = SimpleMessageDataSchema.safeParse(data);
                expect(result.success).toBe(true);
            });
        });
    });

    describe('MessengerClientConfigSchema', () => {
        it('should validate minimal config', () => {
            const minimalConfig: MessengerClientConfig = {};

            const result = MessengerClientConfigSchema.safeParse(minimalConfig);
            expect(result.success).toBe(true);
        });

        it('should validate complete config', () => {
            const completeConfig: MessengerClientConfig = {
                apiUrl: 'https://api.messenger.com',
                defaults: {
                    queueId: 'default-queue',
                    topic: 'default-topic',
                    applicationId: 'my-app',
                    meta: { priority: 'normal', locale: 'fr' },
                    delivery: {
                        channels: ['email'],
                        retryPolicy: {
                            maxRetries: 3,
                            backoff: 'exponential',
                            delay: 1000,
                        },
                    },
                },
                redis: { connectionTimeout: 5000, retries: 3 },
            };

            const result =
                MessengerClientConfigSchema.safeParse(completeConfig);
            expect(result.success).toBe(true);
        });

        it('should reject invalid apiUrl', () => {
            const invalidConfig = { apiUrl: 'not-a-url' };

            const result = MessengerClientConfigSchema.safeParse(invalidConfig);
            expect(result.success).toBe(false);
        });

        it('should reject invalid priority value', () => {
            const invalidConfig = {
                defaults: { meta: { priority: 'invalid-priority' } },
            };

            const result = MessengerClientConfigSchema.safeParse(invalidConfig);
            expect(result.success).toBe(false);
        });
    });

    describe('Fonctions de validation', () => {
        describe('validateMessageData', () => {
            it('should validate and return valid message data', () => {
                const validData = {
                    scenarioId: 'test-scenario',
                    to: ['user@example.com'],
                    businessData: { name: 'John' },
                };

                const result = validateMessageData(validData);
                expect(result).toEqual(validData);
            });

            it('should throw error for invalid message data', () => {
                const invalidData = {
                    to: ['user@example.com'],
                    // Manque scenarioId et businessData
                };

                expect(() => validateMessageData(invalidData)).toThrow();
            });

            it('should include validation details in error message', () => {
                const invalidData = {};

                try {
                    validateMessageData(invalidData);
                    fail('Should have thrown an error');
                } catch (error) {
                    expect(error).toBeInstanceOf(Error);
                    expect((error as Error).message).toContain(
                        'Validation error',
                    );
                }
            });
        });

        describe('validateClientConfig', () => {
            it('should validate and return valid client config', () => {
                const validConfig = {
                    defaults: {
                        queueId: 'test-queue',
                        applicationId: 'test-app',
                    },
                };

                const result = validateClientConfig(validConfig);
                expect(result).toEqual(validConfig);
            });

            it('should validate empty config', () => {
                const emptyConfig = {};
                const result = validateClientConfig(emptyConfig);
                expect(result).toEqual(emptyConfig);
            });

            it('should throw error for invalid config', () => {
                const invalidConfig = { apiUrl: 'invalid-url' };

                expect(() => validateClientConfig(invalidConfig)).toThrow();
            });
        });

        describe('validateQueueConfig', () => {
            it('should validate and return valid queue config', () => {
                const validConfig = {
                    queueId: 'test-queue',
                    redisUrl: 'redis://localhost:6379',
                };

                const result = validateQueueConfig(validConfig);
                expect(result).toEqual(validConfig);
            });

            it('should throw error for invalid queue config', () => {
                const invalidConfig = { queueId: '', redisUrl: 'invalid-url' };

                expect(() => validateQueueConfig(invalidConfig)).toThrow();
            });
        });
    });

    describe('Type Guards et Utility Types', () => {
        describe('SendMessageOptions type', () => {
            it('should accept valid send message options', () => {
                const options: SendMessageOptions = {
                    queueId: 'test-queue',
                    topic: 'test-topic',
                    priority: 'high',
                    delay: 1000,
                    ttl: 60000,
                    jobOptions: {
                        attempts: 3,
                        backoff: 'exponential',
                        removeOnComplete: 10,
                        removeOnFail: 5,
                    },
                };

                // Test de compilation - si ça compile, le type est correct
                expect(options).toBeDefined();
            });
        });

        describe('SendMessageResponse type', () => {
            it('should represent successful response', () => {
                const successResponse: SendMessageResponse = {
                    success: true,
                    jobId: 'job-123',
                    messageId: 'msg-456',
                    details: { queueId: 'test-queue', topic: 'test-topic' },
                };

                expect(successResponse.success).toBe(true);
                expect(successResponse.jobId).toBeDefined();
            });

            it('should represent error response', () => {
                const errorResponse: SendMessageResponse = {
                    success: false,
                    error: 'Validation failed',
                };

                expect(errorResponse.success).toBe(false);
                expect(errorResponse.error).toBeDefined();
            });
        });

        describe('MessengerEvent type', () => {
            it('should represent different event types', () => {
                const events: MessengerEvent[] = [
                    {
                        type: 'message-queued',
                        data: { messageId: 'msg-123' },
                        timestamp: new Date(),
                        queueId: 'test-queue',
                        messageId: 'msg-123',
                    },
                    {
                        type: 'message-failed',
                        data: { error: 'Queue error' },
                        timestamp: new Date(),
                    },
                    {
                        type: 'connection-error',
                        data: { connectionId: 'conn-456' },
                        timestamp: new Date(),
                    },
                ];

                events.forEach((event) => {
                    expect(event.type).toBeDefined();
                    expect(event.timestamp).toBeInstanceOf(Date);
                });
            });
        });
    });

    describe('Scénarios de validation complexes', () => {
        it('should validate message with multiple channels', () => {
            const multiChannelMessage = {
                scenarioId: 'multi-channel-test',
                to: ['user@example.com'],
                businessData: { content: 'Hello' },
                channels: ['email', 'sms', 'push'],
            };

            const result =
                SimpleMessageDataSchema.safeParse(multiChannelMessage);
            expect(result.success).toBe(true);
        });

        it('should validate scheduled message', () => {
            const scheduledMessage = {
                scenarioId: 'scheduled-test',
                to: ['user@example.com'],
                businessData: { reminder: 'Meeting tomorrow' },
                scheduleAt: new Date(Date.now() + 86400000), // Demain
            };

            const result = SimpleMessageDataSchema.safeParse(scheduledMessage);
            expect(result.success).toBe(true);
        });

        it('should validate message with tracking and callbacks', () => {
            const trackedMessage = {
                scenarioId: 'tracked-test',
                to: ['user@example.com'],
                businessData: { orderId: '12345' },
                callbackUrl: 'https://myapp.com/webhooks/message-status',
                trackEvents: ['queued', 'sent', 'delivered', 'failed'],
                correlationId: 'order-12345-notification',
            };

            const result = SimpleMessageDataSchema.safeParse(trackedMessage);
            expect(result.success).toBe(true);
        });

        it('should reject message with mixed valid and invalid fields', () => {
            const mixedMessage = {
                scenarioId: 'test-scenario',
                to: ['valid@example.com', 'invalid-email'], // Un email valide, un invalide
                businessData: { content: 'Hello' },
                channels: ['email', 'invalid-channel'], // Un canal valide, un invalide
            };

            const result = SimpleMessageDataSchema.safeParse(mixedMessage);
            expect(result.success).toBe(false);
        });
    });
});
