import {
    SimpleMessageData,
    SendMessageOptions,
    SendMessageResponse,
} from './types';
import type { MessengerClient } from './messenger-client';
/**
 * Builder for building messages in a fluent way
 * Allows step-by-step construction of complex messages
 */
export class MessageBuilder {
    private messageData: Partial<SimpleMessageData> = {};
    private sendOptions: SendMessageOptions = {};
    private messengerClient: MessengerClient;

    constructor(messengerClient: MessengerClient) {
        this.messengerClient = messengerClient;
    }

    /**
     * The application ID
     */
    forApplication(applicationId: string): MessageBuilder {
        this.messageData.applicationId = applicationId;
        return this;
    }

    /**
     * The scenario ID
     */
    withScenario(scenarioId: string): MessageBuilder {
        this.messageData.scenarioId = scenarioId;
        return this;
    }

    /**
     * The main recipients
     */
    to(...recipients: string[]): MessageBuilder {
        this.messageData.to = recipients;
        return this;
    }

    /**
     * Adds main recipients
     */
    addTo(...recipients: string[]): MessageBuilder {
        if (!this.messageData.to) {
            this.messageData.to = [];
        }
        this.messageData.to.push(...recipients);
        return this;
    }

    /**
     * Sets the CC recipients
     */
    cc(...recipients: string[]): MessageBuilder {
        this.messageData.cc = recipients;
        return this;
    }

    /**
     * Sets the BCC recipients
     */
    bcc(...recipients: string[]): MessageBuilder {
        this.messageData.bcc = recipients;
        return this;
    }

    /**
     * Sets the reply-to address
     */
    replyTo(email: string): MessageBuilder {
        this.messageData.replyTo = email;
        return this;
    }

    /**
     * Sets the message subject
     */
    withSubject(subject: string): MessageBuilder {
        this.messageData.subject = subject;
        return this;
    }

    /**
     * Sets a custom message body
     */
    withBody(body: string): MessageBuilder {
        this.messageData.bodyOverride = body;
        return this;
    }

    /**
     * Sets the business data to inject into the template
     */
    withBusinessData(data: Record<string, any>): MessageBuilder {
        this.messageData.businessData = {
            ...this.messageData.businessData,
            ...data,
        };
        return this;
    }

    /**
     * Adds a specific business data entry
     */
    addBusinessData(key: string, value: any): MessageBuilder {
        if (!this.messageData.businessData) {
            this.messageData.businessData = {};
        }
        this.messageData.businessData[key] = value;
        return this;
    }

    /**
     * Sets the communication channel
     */
    viaChannel(
        channels: ('email' | 'sms' | 'push' | 'webhook')[],
    ): MessageBuilder {
        this.messageData.channels = channels;
        return this;
    }

    /**
     * Shortcut to set the email channel only
     */
    viaEmail(): MessageBuilder {
        return this.viaChannel(['email']);
    }

    /**
     * Shortcut to set the SMS channel only
     */
    viaSMS(): MessageBuilder {
        return this.viaChannel(['sms']);
    }

    /**
     * Shortcut to set the push channel only
     */
    viaPush(): MessageBuilder {
        return this.viaChannel(['push']);
    }

    /**
     * Sets the locale/language
     */
    inLocale(locale: string): MessageBuilder {
        this.messageData.locale = locale;
        return this;
    }

    /**
     * Adds tags to the message
     */
    withTags(...tags: string[]): MessageBuilder {
        if (!this.messageData.tags) {
            this.messageData.tags = [];
        }
        this.messageData.tags.push(...tags);
        return this;
    }

    /**
     * Sets a correlation ID
     */
    withCorrelationId(correlationId: string): MessageBuilder {
        this.messageData.correlationId = correlationId;
        return this;
    }

    /**
     * Schedules the message for later delivery
     */
    scheduleAt(date: Date | string): MessageBuilder {
        this.messageData.scheduleAt = date;
        return this;
    }

    /**
     * Schedules the message in X milliseconds
     */
    scheduleIn(milliseconds: number): MessageBuilder {
        const scheduleDate = new Date(Date.now() + milliseconds);
        return this.scheduleAt(scheduleDate);
    }

    /**
     * Sets a callback URL for notifications
     */
    withCallback(callbackUrl: string): MessageBuilder {
        this.messageData.callbackUrl = callbackUrl;
        return this;
    }

    /**
     * Sets the events to track
     */
    trackEvents(
        ...events: ('queued' | 'sent' | 'delivered' | 'failed')[]
    ): MessageBuilder {
        this.messageData.trackEvents = events;
        return this;
    }

    /**
     * Configures the queue to use
     */
    useQueue(queueId: string, topic?: string): MessageBuilder {
        this.sendOptions.queueId = queueId;
        if (topic) {
            this.sendOptions.topic = topic;
        }
        return this;
    }

    /**
     * Sets the message priority in the queue
     */
    withPriority(priority: 'low' | 'normal' | 'high'): MessageBuilder {
        this.sendOptions.priority = priority;
        return this;
    }

    /**
     * Sets a delay before processing the message
     */
    withDelay(milliseconds: number): MessageBuilder {
        this.sendOptions.delay = milliseconds;
        return this;
    }

    /**
     * Sets the TTL of the message in the queue
     */
    withTTL(milliseconds: number): MessageBuilder {
        this.sendOptions.ttl = milliseconds;
        return this;
    }

    /**
     * Configures the BullMQ job options
     */
    withJobOptions(options: {
        attempts?: number;
        backoff?: 'fixed' | 'exponential';
        removeOnComplete?: number;
        removeOnFail?: number;
    }): MessageBuilder {
        this.sendOptions.jobOptions = options;
        return this;
    }

    /**
     * Validates required fields
     */
    private validate(): void {
        if (!this.messageData.scenarioId) {
            throw new Error('scenarioId is required');
        }
        if (!this.messageData.to || this.messageData.to.length === 0) {
            throw new Error('At least one recipient is required');
        }
        if (!this.messageData.businessData) {
            throw new Error('businessData is required');
        }
    }

    /**
     * Builds and sends the message
     */
    async send(): Promise<SendMessageResponse> {
        this.validate();
        return await this.messengerClient.sendMessage(
            this.messageData as SimpleMessageData,
            this.sendOptions,
        );
    }

    /**
     * Builds the constructed data without sending the message
     */
    build(): { messageData: SimpleMessageData; options: SendMessageOptions } {
        this.validate();
        return {
            messageData: this.messageData as SimpleMessageData,
            options: this.sendOptions,
        };
    }

    /**
     * Clone the builder to create a new instance with the same data
     */
    clone(): MessageBuilder {
        const cloned = new MessageBuilder(this.messengerClient);
        cloned.messageData = { ...this.messageData };
        cloned.sendOptions = { ...this.sendOptions };
        return cloned;
    }

    /**
     * Reset the builder to start fresh
     */
    reset(): MessageBuilder {
        this.messageData = {};
        this.sendOptions = {};
        return this;
    }
}
