import { EventEmitter } from 'events';
import { MessageProducer } from './queue-manager';
import { MessageBuilder } from './message-builder';
import type {
    MessengerClientConfig,
    SendMessageOptions,
    SimpleMessageData,
    SendMessageResponse,
    MessengerEvent,
    QueueMessage,
    RedisQueueConnectionConfig,
} from './types';
import { validateMessageData } from './types';

/**
 * Client principal pour interagir avec le système Messenger (version autonome)
 * Simplifie l'envoi de messages dans les queues Redis
 */
export class MessengerClient extends EventEmitter {
    private config: MessengerClientConfig;
    private producer: MessageProducer;
    private queueConfigs: Map<string, RedisQueueConnectionConfig> = new Map();

    constructor(config: MessengerClientConfig = {}) {
        super();
        this.config = {
            defaults: {},
            redis: { connectionTimeout: 5000, retries: 3 },
            ...config,
        };
        this.producer = new MessageProducer();
    }

    /**
     * Configure une queue pour utilisation
     */
    configureQueue(
        queueId: string,
        redisUrl: string,
        defaultTopic?: string,
    ): void {
        this.queueConfigs.set(queueId, { queueId, redisUrl, defaultTopic });
    }

    /**
     * Envoie un message simple dans la queue
     */
    async sendMessage(
        messageData: SimpleMessageData,
        options: SendMessageOptions = {},
    ): Promise<SendMessageResponse> {
        try {
            // Validate input data
            validateMessageData(messageData);

            // Validation des paramètres obligatoires
            const queueId = options.queueId || this.config.defaults?.queueId;
            const topic = options.topic || this.config.defaults?.topic;
            const applicationId =
                messageData.applicationId ||
                this.config.defaults?.applicationId;

            if (!queueId) {
                throw new Error('queueId is required in options or defaults');
            }
            if (!topic) {
                throw new Error('topic is required in options or defaults');
            }
            if (!applicationId) {
                throw new Error(
                    'applicationId is required in message data or defaults',
                );
            }

            // Obtenir la configuration de la queue
            let queueConfig = this.queueConfigs.get(queueId);
            if (!queueConfig) {
                // Configuration par défaut si pas explicitement configurée
                const redisUrl =
                    this.config.redis?.url || 'redis://localhost:6379';
                queueConfig = { queueId, redisUrl };
                this.queueConfigs.set(queueId, queueConfig);
            }

            // Construction du message complet
            const queueMessage = this.buildQueueMessage(
                messageData,
                applicationId,
            );

            // Envoi dans la queue
            const result = await this.producer.enqueue(
                queueMessage,
                queueConfig,
                topic,
                options,
            );

            const response: SendMessageResponse = {
                success: true,
                jobId: result.jobId,
                messageId: queueMessage.tracking?.messageId,
                details: { queueId, topic, jobOptions: options.jobOptions },
            };

            // Émission d'un événement
            this.emit('message-queued', {
                type: 'message-queued',
                data: queueMessage,
                timestamp: new Date(),
                queueId,
                messageId: queueMessage.tracking?.messageId,
            } as MessengerEvent);

            return response;
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : 'Unknown error';

            // Émission d'un événement d'erreur
            this.emit('message-failed', {
                type: 'message-failed',
                data: { error: errorMessage, messageData, options },
                timestamp: new Date(),
                queueId: options.queueId,
            } as MessengerEvent);

            return { success: false, error: errorMessage };
        }
    }

    /**
     * Crée un builder pour construire des messages complexes
     */
    createMessage(): MessageBuilder {
        return new MessageBuilder(this);
    }

    /**
     * Envoie un message email simple
     */
    async sendEmail(
        to: string | string[],
        scenarioId: string,
        businessData: Record<string, any>,
        options: Omit<
            SimpleMessageData,
            'to' | 'scenarioId' | 'businessData' | 'channel'
        > &
            SendMessageOptions = {},
    ): Promise<SendMessageResponse> {
        return this.sendMessage(
            {
                to: Array.isArray(to) ? to : [to],
                scenarioId,
                businessData,
                channels: ['email'],
                ...options,
            },
            options,
        );
    }

    /**
     * Envoie un SMS simple
     */
    async sendSMS(
        to: string | string[],
        scenarioId: string,
        businessData: Record<string, any>,
        options: Omit<
            SimpleMessageData,
            'to' | 'scenarioId' | 'businessData' | 'channel'
        > &
            SendMessageOptions = {},
    ): Promise<SendMessageResponse> {
        return this.sendMessage(
            {
                to: Array.isArray(to) ? to : [to],
                scenarioId,
                businessData,
                channels: ['sms'],
                ...options,
            },
            options,
        );
    }

    /**
     * Envoie une notification push
     */
    async sendPush(
        to: string | string[],
        scenarioId: string,
        businessData: Record<string, any>,
        options: Omit<
            SimpleMessageData,
            'to' | 'scenarioId' | 'businessData' | 'channel'
        > &
            SendMessageOptions = {},
    ): Promise<SendMessageResponse> {
        return this.sendMessage(
            {
                to: Array.isArray(to) ? to : [to],
                scenarioId,
                businessData,
                channels: ['push'],
                ...options,
            },
            options,
        );
    }

    /**
     * Planifie un message pour envoi ultérieur
     */
    async scheduleMessage(
        messageData: SimpleMessageData,
        scheduleAt: Date | string,
        options: SendMessageOptions = {},
    ): Promise<SendMessageResponse> {
        return this.sendMessage({ ...messageData, scheduleAt }, options);
    }

    /**
     * Met à jour la configuration du client
     */
    updateConfig(newConfig: Partial<MessengerClientConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Ferme toutes les connexions
     */
    async close(): Promise<void> {
        await this.producer.close();
        this.queueConfigs.clear();
        this.removeAllListeners();
    }

    /**
     * Construit un QueueMessage complet à partir des données simplifiées
     */
    private buildQueueMessage(
        messageData: SimpleMessageData,
        applicationId: string,
    ): QueueMessage {
        const messageId = this.generateMessageId();
        const now = new Date().toISOString();

        return {
            applicationId,
            scenarioId: messageData.scenarioId,
            businessData: messageData.businessData,
            to: messageData.to,
            cc: messageData.cc,
            bcc: messageData.bcc,
            replyTo: messageData.replyTo,
            subject: messageData.subject,
            bodyOverride: messageData.bodyOverride,
            meta: {
                priority: 'normal',
                ...this.config.defaults?.meta,
                locale:
                    messageData.locale ||
                    this.config.defaults?.meta?.locale ||
                    'en',
                correlationId: messageData.correlationId,
                tags: messageData.tags || [],
                createdAt: now,
            },
            delivery: {
                ...this.config.defaults?.delivery,
                channel: messageData.channels ||
                    this.config.defaults?.delivery?.channel || ['email'],
                scheduleAt: messageData.scheduleAt
                    ? messageData.scheduleAt instanceof Date
                        ? messageData.scheduleAt.toISOString()
                        : messageData.scheduleAt
                    : null,
            },
            tracking: {
                messageId,
                callbackUrl: messageData.callbackUrl,
                events: messageData.trackEvents || [
                    'queued',
                    'sent',
                    'delivered',
                    'failed',
                ],
            },
        };
    }

    /**
     * Génère un ID unique pour le message
     */
    private generateMessageId(): string {
        return `msg_${Date.now()}_${crypto.randomUUID().slice(0, 9)}`;
    }
}
