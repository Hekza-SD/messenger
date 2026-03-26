import { MessengerClient } from '../src/messenger-client';
import { MessageProducer } from '../src/queue-manager';
import { MessageBuilder } from '../src/message-builder';
import type {
    MessengerClientConfig,
    SimpleMessageData,
    SendMessageOptions,
} from '../src/types';

// Mock des dépendances externes
jest.mock('../src/queue-manager');
jest.mock('../src/message-builder');

const MockedMessageProducer = MessageProducer as jest.MockedClass<
    typeof MessageProducer
>;
const MockedMessageBuilder = MessageBuilder as jest.MockedClass<
    typeof MessageBuilder
>;

describe('MessengerClient', () => {
    let client: MessengerClient;
    let mockMessageProducer: jest.Mocked<MessageProducer>;
    let config: MessengerClientConfig;

    beforeEach(() => {
        // Configuration de base pour les tests
        config = (global as any).testHelpers.createValidClientConfig();

        // Mock du MessageProducer
        mockMessageProducer = {
            enqueue: jest.fn().mockResolvedValue({ jobId: 'job-123' }),
            close: jest.fn().mockResolvedValue(undefined),
        } as any;

        MockedMessageProducer.mockImplementation(() => mockMessageProducer);

        client = new MessengerClient(config);
    });

    afterEach(async () => {
        await client.close();
        jest.clearAllMocks();
    });

    describe('Constructeur et Configuration', () => {
        it('should create client with default configuration', () => {
            const defaultClient = new MessengerClient();
            expect(defaultClient).toBeInstanceOf(MessengerClient);
        });

        it('should merge user config with defaults', () => {
            const customConfig = {
                defaults: {
                    queueId: 'custom-queue',
                    applicationId: 'custom-app',
                },
            };

            const customClient = new MessengerClient(customConfig);
            expect(customClient).toBeInstanceOf(MessengerClient);
        });

        it('should update configuration', () => {
            const newConfig = { defaults: { queueId: 'updated-queue' } };

            client.updateConfig(newConfig);
            // Vérifier que la config a été mise à jour (pas d'erreur)
            expect(() => client.updateConfig(newConfig)).not.toThrow();
        });
    });

    describe('sendMessage', () => {
        let messageData: SimpleMessageData;
        let options: SendMessageOptions;

        beforeEach(() => {
            messageData = (global as any).testHelpers.createValidMessageData();
            options = { queueId: 'test-queue', topic: 'test-topic' };
        });

        it('should send message successfully', async () => {
            const response = await client.sendMessage(messageData, options);

            expect(response.success).toBe(true);
            expect(response.messageId).toBeDefined();
            expect(mockMessageProducer.enqueue).toHaveBeenCalledWith(
                expect.objectContaining({
                    applicationId: 'test-app',
                    scenarioId: 'test-scenario',
                    to: ['test@example.com'],
                }),
                expect.objectContaining({ queueId: 'test-queue' }),
                'test-topic',
                expect.any(Object),
            );
        });

        it('should use default queueId and applicationId from config', async () => {
            const messageWithoutApp = { ...messageData };
            delete (messageWithoutApp as any).applicationId;

            const response = await client.sendMessage(messageWithoutApp, {
                topic: 'test-topic',
            });

            expect(response.success).toBe(true);
            expect(mockMessageProducer.enqueue).toHaveBeenCalledWith(
                expect.objectContaining({
                    applicationId: 'test-app', // Depuis la config par défaut
                }),
                expect.objectContaining({
                    queueId: 'test-queue', // Depuis la config par défaut
                }),
                'test-topic',
                expect.any(Object),
            );
        });

        it('should throw error when required parameters are missing', async () => {
            const response = await client.sendMessage(messageData, {}); // Pas de queueId ni topic

            expect(response.success).toBe(false);
            expect(response.error).toContain('queueId is required');
        });

        it('should handle queue manager errors', async () => {
            mockMessageProducer.enqueue.mockRejectedValue(
                new Error('Queue error'),
            );

            const response = await client.sendMessage(messageData, options);

            expect(response.success).toBe(false);
            expect(response.error).toBe('Queue error');
        });

        it('should emit message-queued event on success', async () => {
            const eventSpy = jest.fn();
            client.on('message-queued', eventSpy);

            await client.sendMessage(messageData, options);

            expect(eventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'message-queued',
                    queueId: 'test-queue',
                }),
            );
        });

        it('should emit message-failed event on error', async () => {
            const eventSpy = jest.fn();
            client.on('message-failed', eventSpy);

            mockMessageProducer.enqueue.mockRejectedValue(
                new Error('Test error'),
            );

            await client.sendMessage(messageData, options);

            expect(eventSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'message-failed',
                    data: expect.objectContaining({ error: 'Test error' }),
                }),
            );
        });

        it('should generate unique message IDs', async () => {
            const response1 = await client.sendMessage(messageData, options);
            const response2 = await client.sendMessage(messageData, options);

            expect(response1.messageId).toBeDefined();
            expect(response2.messageId).toBeDefined();
            expect(response1.messageId).not.toBe(response2.messageId);
        });
    });

    describe('Méthodes de raccourci', () => {
        beforeEach(() => {
            // Spy sur sendMessage pour vérifier les appels
            jest.spyOn(client, 'sendMessage').mockResolvedValue({
                success: true,
            });
        });

        it('should send email via sendEmail', async () => {
            await client.sendEmail('test@example.com', 'test-scenario', {
                userName: 'Test',
            });

            expect(client.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: ['test@example.com'],
                    scenarioId: 'test-scenario',
                    channel: 'email',
                    businessData: { userName: 'Test' },
                }),
                {},
            );
        });

        it('should send SMS via sendSMS', async () => {
            await client.sendSMS('+33612345678', 'sms-scenario', {
                code: '1234',
            });

            expect(client.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: ['+33612345678'],
                    scenarioId: 'sms-scenario',
                    channel: 'sms',
                    businessData: { code: '1234' },
                }),
                {},
            );
        });

        it('should send push notification via sendPush', async () => {
            await client.sendPush('device-token', 'push-scenario', {
                title: 'Test',
            });

            expect(client.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: ['device-token'],
                    scenarioId: 'push-scenario',
                    channel: 'push',
                    businessData: { title: 'Test' },
                }),
                {},
            );
        });

        it('should handle array of recipients', async () => {
            await client.sendEmail(
                ['user1@test.com', 'user2@test.com'],
                'test-scenario',
                { data: 'test' },
            );

            expect(client.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: ['user1@test.com', 'user2@test.com'],
                }),
                {},
            );
        });
    });

    describe('scheduleMessage', () => {
        it('should schedule message for future date', async () => {
            const futureDate = new Date(Date.now() + 60000); // Dans 1 minute
            const messageData = (
                global as any
            ).testHelpers.createValidMessageData();

            jest.spyOn(client, 'sendMessage').mockResolvedValue({
                success: true,
            });

            await client.scheduleMessage(messageData, futureDate);

            expect(client.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({ scheduleAt: futureDate }),
                {},
            );
        });

        it('should schedule message with string date', async () => {
            const dateString = '2024-12-25T09:00:00Z';
            const messageData = (
                global as any
            ).testHelpers.createValidMessageData();

            jest.spyOn(client, 'sendMessage').mockResolvedValue({
                success: true,
            });

            await client.scheduleMessage(messageData, dateString);

            expect(client.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({ scheduleAt: dateString }),
                {},
            );
        });
    });

    describe('createMessage', () => {
        it('should create MessageBuilder instance', () => {
            const builder = client.createMessage();

            expect(MockedMessageBuilder).toHaveBeenCalledWith(client);
        });
    });

    describe('close', () => {
        it('should close queue manager and remove listeners', async () => {
            const eventSpy = jest.fn();
            client.on('test-event', eventSpy);

            await client.close();

            expect(mockMessageProducer.close).toHaveBeenCalled();
            expect(client.listenerCount('test-event')).toBe(0);
        });
    });

    describe('Validation des données', () => {
        it('should validate required scenarioId', async () => {
            const invalidData = {
                to: ['test@example.com'],
                businessData: { test: 'data' },
                // Pas de scenarioId
            } as any;

            const response = await client.sendMessage(invalidData, {
                queueId: 'test-queue',
                topic: 'test-topic',
            });

            expect(response.success).toBe(false);
            expect(response.error).toContain('scenarioId');
        });

        it('should validate required recipients', async () => {
            const invalidData = {
                scenarioId: 'test-scenario',
                to: [], // Tableau vide
                businessData: { test: 'data' },
            };

            const response = await client.sendMessage(invalidData, {
                queueId: 'test-queue',
                topic: 'test-topic',
            });

            expect(response.success).toBe(false);
            expect(response.error).toContain('At least one recipient');
        });

        it('should validate required businessData', async () => {
            const invalidData = {
                scenarioId: 'test-scenario',
                to: ['test@example.com'],
                // Pas de businessData
            } as any;

            const response = await client.sendMessage(invalidData, {
                queueId: 'test-queue',
                topic: 'test-topic',
            });

            expect(response.success).toBe(false);
            expect(response.error).toContain('businessData');
        });
    });

    describe('Gestion des erreurs', () => {
        it('should handle unknown errors', async () => {
            mockMessageProducer.enqueue.mockRejectedValue('String error'); // Pas une Error

            const messageData = (
                global as any
            ).testHelpers.createValidMessageData();
            const response = await client.sendMessage(messageData, {
                queueId: 'test-queue',
                topic: 'test-topic',
            });

            expect(response.success).toBe(false);
            expect(response.error).toBe('Unknown error');
        });
    });
});
