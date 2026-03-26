import { MessageBuilder } from '../src/message-builder';
import { MessengerClient } from '../src/messenger-client';
import type { SimpleMessageData, SendMessageOptions } from '../src/types';

// Mock du MessengerClient
const mockMessengerClient = { sendMessage: jest.fn() } as any;

describe('MessageBuilder', () => {
    let builder: MessageBuilder;

    beforeEach(() => {
        jest.clearAllMocks();
        builder = new MessageBuilder(mockMessengerClient);
        mockMessengerClient.sendMessage.mockResolvedValue({
            success: true,
            messageId: 'test-id',
        });
    });

    describe('Construction de base', () => {
        it('should create builder with messenger client', () => {
            expect(builder).toBeInstanceOf(MessageBuilder);
        });

        it('should set application ID', () => {
            const result = builder.forApplication('test-app');
            expect(result).toBe(builder); // Retourne this pour chaînage
        });

        it('should set scenario ID', () => {
            const result = builder.withScenario('test-scenario');
            expect(result).toBe(builder);
        });

        it('should set business data', () => {
            const data = { key: 'value', number: 42 };
            const result = builder.withBusinessData(data);
            expect(result).toBe(builder);
        });
    });

    describe('Gestion des destinataires', () => {
        it('should set recipients with to()', () => {
            const result = builder.to('user1@test.com', 'user2@test.com');
            expect(result).toBe(builder);
        });

        it('should add recipients with addTo()', () => {
            builder.to('user1@test.com');
            const result = builder.addTo('user2@test.com', 'user3@test.com');
            expect(result).toBe(builder);
        });

        it('should set CC recipients', () => {
            const result = builder.cc('cc1@test.com', 'cc2@test.com');
            expect(result).toBe(builder);
        });

        it('should set BCC recipients', () => {
            const result = builder.bcc('bcc1@test.com', 'bcc2@test.com');
            expect(result).toBe(builder);
        });

        it('should set reply-to address', () => {
            const result = builder.replyTo('noreply@test.com');
            expect(result).toBe(builder);
        });
    });

    describe('Contenu du message', () => {
        it('should set custom subject', () => {
            const result = builder.withSubject('Custom Subject');
            expect(result).toBe(builder);
        });

        it('should set custom body', () => {
            const result = builder.withBody('Custom body content');
            expect(result).toBe(builder);
        });

        it('should add single business data field', () => {
            builder.withBusinessData({ existing: 'data' });
            const result = builder.addBusinessData('newField', 'newValue');
            expect(result).toBe(builder);
        });

        it('should merge business data when called multiple times', () => {
            builder.withBusinessData({ field1: 'value1' });
            builder.withBusinessData({ field2: 'value2' });

            const { messageData } = builder.build();
            expect(messageData.businessData).toEqual({
                field1: 'value1',
                field2: 'value2',
            });
        });
    });

    describe('Configuration des canaux', () => {
        it('should set channel via viaChannel()', () => {
            const result = builder.viaChannel(['sms']);
            expect(result).toBe(builder);
        });

        it('should set email channel via viaEmail()', () => {
            const result = builder.viaEmail();
            expect(result).toBe(builder);
        });

        it('should set SMS channel via viaSMS()', () => {
            const result = builder.viaSMS();
            expect(result).toBe(builder);
        });

        it('should set push channel via viaPush()', () => {
            const result = builder.viaPush();
            expect(result).toBe(builder);
        });

        it('should set multiple channels', () => {
            const result = builder.viaChannel(['email', 'sms']);
            expect(result).toBe(builder);
        });
    });

    describe('Métadonnées et options', () => {
        it('should set locale', () => {
            const result = builder.inLocale('fr');
            expect(result).toBe(builder);
        });

        it('should add tags', () => {
            const result = builder.withTags('tag1', 'tag2', 'tag3');
            expect(result).toBe(builder);
        });

        it('should append tags when called multiple times', () => {
            builder.withTags('tag1', 'tag2');
            builder.withTags('tag3', 'tag4');

            const { messageData } = builder.build();
            expect(messageData.tags).toEqual(['tag1', 'tag2', 'tag3', 'tag4']);
        });

        it('should set correlation ID', () => {
            const result = builder.withCorrelationId('corr-123');
            expect(result).toBe(builder);
        });

        it('should set callback URL', () => {
            const result = builder.withCallback('https://example.com/webhook');
            expect(result).toBe(builder);
        });

        it('should set tracking events', () => {
            const result = builder.trackEvents('queued', 'sent', 'delivered');
            expect(result).toBe(builder);
        });
    });

    describe('Planification', () => {
        it('should schedule at specific date', () => {
            const date = new Date('2024-12-25T09:00:00Z');
            const result = builder.scheduleAt(date);
            expect(result).toBe(builder);
        });

        it('should schedule at specific date string', () => {
            const result = builder.scheduleAt('2024-12-25T09:00:00Z');
            expect(result).toBe(builder);
        });

        it('should schedule in milliseconds', () => {
            const result = builder.scheduleIn(60000); // 1 minute
            expect(result).toBe(builder);

            const { messageData } = builder.build();
            expect(messageData.scheduleAt).toBeInstanceOf(Date);
        });
    });

    describe('Configuration de la queue', () => {
        it('should set queue and topic', () => {
            const result = builder.useQueue('test-queue', 'test-topic');
            expect(result).toBe(builder);
        });

        it('should set queue without topic', () => {
            const result = builder.useQueue('test-queue');
            expect(result).toBe(builder);
        });

        it('should set priority', () => {
            const result = builder.withPriority('high');
            expect(result).toBe(builder);
        });

        it('should set delay', () => {
            const result = builder.withDelay(5000);
            expect(result).toBe(builder);
        });

        it('should set TTL', () => {
            const result = builder.withTTL(60000);
            expect(result).toBe(builder);
        });

        it('should set job options', () => {
            const jobOptions = {
                attempts: 5,
                backoff: 'exponential' as const,
                removeOnComplete: 10,
            };
            const result = builder.withJobOptions(jobOptions);
            expect(result).toBe(builder);
        });
    });

    describe('Validation', () => {
        it('should throw error when scenarioId is missing', () => {
            builder.to('test@example.com').withBusinessData({ test: 'data' });

            expect(() => builder.build()).toThrow('scenarioId is required');
        });

        it('should throw error when recipients are missing', () => {
            builder
                .withScenario('test-scenario')
                .withBusinessData({ test: 'data' });

            expect(() => builder.build()).toThrow(
                'At least one recipient is required',
            );
        });

        it('should throw error when recipients array is empty', () => {
            builder
                .withScenario('test-scenario')
                .to() // Pas d'arguments
                .withBusinessData({ test: 'data' });

            expect(() => builder.build()).toThrow(
                'At least one recipient is required',
            );
        });

        it('should throw error when businessData is missing', () => {
            builder.withScenario('test-scenario').to('test@example.com');

            expect(() => builder.build()).toThrow('businessData is required');
        });

        it('should pass validation with all required fields', () => {
            builder
                .withScenario('test-scenario')
                .to('test@example.com')
                .withBusinessData({ test: 'data' });

            expect(() => builder.build()).not.toThrow();
        });
    });

    describe('build()', () => {
        it('should return message data and options', () => {
            const result = builder
                .withScenario('test-scenario')
                .to('test@example.com')
                .withBusinessData({ test: 'data' })
                .withSubject('Test Subject')
                .viaEmail()
                .withPriority('high')
                .useQueue('test-queue', 'test-topic')
                .build();

            expect(result).toHaveProperty('messageData');
            expect(result).toHaveProperty('options');

            expect(result.messageData).toMatchObject({
                scenarioId: 'test-scenario',
                to: ['test@example.com'],
                businessData: { test: 'data' },
                subject: 'Test Subject',
                channels: ['email'],
            });

            expect(result.options).toMatchObject({
                queueId: 'test-queue',
                topic: 'test-topic',
                priority: 'high',
            });
        });
    });

    describe('send()', () => {
        it('should validate and send message', async () => {
            const response = await builder
                .withScenario('test-scenario')
                .to('test@example.com')
                .withBusinessData({ test: 'data' })
                .send();

            expect(mockMessengerClient.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    scenarioId: 'test-scenario',
                    to: ['test@example.com'],
                    businessData: { test: 'data' },
                }),
                expect.any(Object),
            );

            expect(response).toEqual({ success: true, messageId: 'test-id' });
        });

        it('should throw validation error before sending', async () => {
            builder.to('test@example.com'); // Pas de scenario ni businessData

            await expect(builder.send()).rejects.toThrow(
                'scenarioId is required',
            );
            expect(mockMessengerClient.sendMessage).not.toHaveBeenCalled();
        });
    });

    describe('Utilitaires', () => {
        it('should clone builder with same data', () => {
            builder
                .withScenario('test-scenario')
                .to('test@example.com')
                .withBusinessData({ test: 'data' });

            const cloned = builder.clone();

            expect(cloned).not.toBe(builder);
            expect(cloned).toBeInstanceOf(MessageBuilder);

            const originalData = builder.build();
            const clonedData = cloned.build();

            expect(clonedData.messageData).toEqual(originalData.messageData);
            expect(clonedData.options).toEqual(originalData.options);
        });

        it('should reset builder data', () => {
            builder
                .withScenario('test-scenario')
                .to('test@example.com')
                .withBusinessData({ test: 'data' });

            const result = builder.reset();

            expect(result).toBe(builder); // Retourne this
            expect(() => builder.build()).toThrow(); // Plus de données valides
        });

        it('should maintain independent state after clone', () => {
            builder.withScenario('original-scenario');

            const cloned = builder.clone();
            cloned.withScenario('cloned-scenario');

            const originalData = builder.build();
            const clonedData = cloned.build();

            expect(originalData.messageData.scenarioId).toBe(
                'original-scenario',
            );
            expect(clonedData.messageData.scenarioId).toBe('cloned-scenario');
        });
    });

    describe('Chaînage complexe', () => {
        it('should handle complex message building', async () => {
            const futureDate = new Date(Date.now() + 60000);

            const response = await builder
                .forApplication('ecommerce-app')
                .withScenario('order-confirmation')
                .to('customer@example.com')
                .cc('manager@company.com')
                .bcc('audit@company.com')
                .replyTo('support@company.com')
                .withSubject('Order #12345 Confirmed')
                .withBusinessData({
                    orderNumber: '12345',
                    customerName: 'John Doe',
                    total: 99.99,
                })
                .addBusinessData('currency', 'EUR')
                .viaEmail()
                .inLocale('en')
                .withTags('ecommerce', 'order', 'confirmation')
                .withCorrelationId('order-12345-confirmation')
                .scheduleAt(futureDate)
                .withCallback('https://shop.com/webhook/email-status')
                .trackEvents('queued', 'sent', 'delivered', 'failed')
                .useQueue('ecommerce-queue', 'order-emails')
                .withPriority('high')
                .withDelay(1000)
                .withTTL(86400000)
                .withJobOptions({
                    attempts: 3,
                    backoff: 'exponential',
                    removeOnComplete: 50,
                })
                .send();

            expect(response.success).toBe(true);
            expect(mockMessengerClient.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    applicationId: 'ecommerce-app',
                    scenarioId: 'order-confirmation',
                    to: ['customer@example.com'],
                    cc: ['manager@company.com'],
                    bcc: ['audit@company.com'],
                    replyTo: 'support@company.com',
                    subject: 'Order #12345 Confirmed',
                    businessData: {
                        orderNumber: '12345',
                        customerName: 'John Doe',
                        total: 99.99,
                        currency: 'EUR',
                    },
                    channels: ['email'],
                    locale: 'en',
                    tags: ['ecommerce', 'order', 'confirmation'],
                    correlationId: 'order-12345-confirmation',
                    scheduleAt: futureDate,
                    callbackUrl: 'https://shop.com/webhook/email-status',
                    trackEvents: ['queued', 'sent', 'delivered', 'failed'],
                }),
                expect.objectContaining({
                    queueId: 'ecommerce-queue',
                    topic: 'order-emails',
                    priority: 'high',
                    delay: 1000,
                    ttl: 86400000,
                    jobOptions: {
                        attempts: 3,
                        backoff: 'exponential',
                        removeOnComplete: 50,
                    },
                }),
            );
        });
    });
});
