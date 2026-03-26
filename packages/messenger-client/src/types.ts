/**
 * Types pour le MessengerClient autonome
 */

import { z } from 'zod';

/**
 * Interface pour un message dans la queue (version standalone)
 */
export interface QueueMessage {
    // ---- Routing ----
    applicationId: string;
    scenarioId: string;

    // ---- Business data ----
    businessData: Record<string, any>;

    // ---- Destination ----
    to: string[];
    cc?: string[];
    bcc?: string[];
    replyTo?: string;

    /**
     * Overrides the subject defined in the template
     */
    subject?: string;

    /**
     * Overrides the body defined in the template
     */
    bodyOverride?: string;

    // ---- Meta control ----
    meta?: {
        priority?: 'low' | 'normal' | 'high';
        locale?: string;
        correlationId?: string;
        tags?: string[];
        createdAt?: string;
        expiresAt?: string;
    };

    // ---- Delivery options ----
    delivery?: {
        channel?: ('email' | 'sms' | 'push' | 'webhook')[];
        retryPolicy?: {
            maxRetries: number;
            backoff: 'fixed' | 'linear' | 'exponential';
            delay?: number;
        };
        scheduleAt?: string | null;
        ttl?: number;
    };

    // ---- Tracking / observability ----
    tracking?: {
        messageId?: string;
        callbackUrl?: string | null;
        events?: ('queued' | 'sent' | 'delivered' | 'failed')[];
    };
}

/**
 * Configuration to initialize the MessengerClient
 */
export interface MessengerClientConfig {
    /** URL of the Messenger API (optional if using DB directly) */
    apiUrl?: string;
    /** Default configuration for all messages */
    defaults?: {
        /** Queue ID to use by default */
        queueId?: string;
        /** Topic to use by default */
        topic?: string;
        /** Application ID to use by default */
        applicationId?: string;
        /** Default metadata */
        meta?: QueueMessage['meta'];
        /** Default delivery options */
        delivery?: QueueMessage['delivery'];
    };
    /** Options for Redis connections (if using directly) */
    redis?: {
        /** Default timeout for connections */
        connectionTimeout?: number;
        /** Number of reconnection attempts */
        retries?: number;
        /** Custom Redis URL */
        url?: string;
    };
}

/**
 * Options when sending a message
 */
export interface SendMessageOptions {
    /** ID of the queue to use (required if not defined in defaults) */
    queueId?: string;
    /** Topic of the queue (required if not defined in defaults) */
    topic?: string;
    /** Priority of the message in the queue */
    priority?: 'low' | 'normal' | 'high';
    /** Delay before processing the message (in milliseconds) */
    delay?: number;
    /** TTL of the message in the queue (in milliseconds) */
    ttl?: number;
    /** Options specific to BullMQ */
    jobOptions?: {
        attempts?: number;
        backoff?: 'fixed' | 'exponential';
        removeOnComplete?: number;
        removeOnFail?: number;
    };
}

/**
 * Simple data structure to send a message
 */
export interface SimpleMessageData {
    /** ID of the application (required if not in defaults) */
    applicationId?: string;
    /** ID of the scenario */
    scenarioId: string;
    /** Primary recipients */
    to: string[];
    /** CC recipients (optional) */
    cc?: string[];
    /** BCC recipients (optional) */
    bcc?: string[];
    /** Business data to inject into the template */
    businessData: Record<string, any>;
    /** Subject of the message (override of the template) */
    subject?: string;
    /** Body of the message (override of the template) */
    bodyOverride?: string;
    /** Reply-to address */
    replyTo?: string;
    /** Delivery channels */
    channels?: ('email' | 'sms' | 'push' | 'webhook')[];
    /** Language/locale for the template */
    locale?: string;
    /** Tags to organize messages */
    tags?: string[];
    /** Correlation ID to trace flows */
    correlationId?: string;
    /** Future scheduling (ISO string or Date) */
    scheduleAt?: string | Date;
    /** Callback URL for status notifications */
    callbackUrl?: string;
    /** Events to track */
    trackEvents?: ('queued' | 'sent' | 'delivered' | 'failed')[];
}

/**
 * Response after sending a message
 */
export interface SendMessageResponse {
    /** Success of the operation */
    success: boolean;
    /** ID of the job in the queue */
    jobId?: string;
    /** ID of the message (if generated) */
    messageId?: string;
    /** Error message in case of failure */
    error?: string;
    /** Additional details */
    details?: { queueId: string; topic: string; jobOptions?: any };
}

/**
 * Configuration for a specific queue
 */
export interface RedisQueueConnectionConfig {
    /** Unique ID of the queue */
    queueId: string;
    /** Redis URL for this queue */
    redisUrl: string;
    /** Default topic for this queue */
    defaultTopic?: string;
}

/**
 * Event emitted during message processing
 */
export interface MessengerEvent {
    type:
        | 'message-queued'
        | 'message-sent'
        | 'message-failed'
        | 'connection-error';
    data: any;
    timestamp: Date;
    queueId?: string;
    messageId?: string;
}

// ============================================================================
// ZOD SCHEMAS FOR VALIDATION
// ============================================================================

export const RedisQueueConnectionConfigSchema = z.object({
    queueId: z.string().min(1, 'queueId cannot be empty'),
    redisUrl: z.string().url('Invalid Redis URL format'),
});

export const SimpleMessageDataSchema = z.object({
    applicationId: z.string().optional(),
    scenarioId: z.string().min(1, 'scenarioId is required'),
    to: z.array(z.string().min(1)).min(1, 'At least one recipient is required'),
    cc: z.array(z.string().min(1)).optional(),
    bcc: z.array(z.string().min(1)).optional(),
    businessData: z
        .record(z.string(), z.any())
        .refine((data) => Object.keys(data).length > 0, {
            message: 'businessData cannot be empty',
        }),
    subject: z.string().optional(),
    bodyOverride: z.string().optional(),
    replyTo: z.string().email('Invalid reply-to email').optional(),
    channels: z.array(z.enum(['email', 'sms', 'push', 'webhook'])).optional(),
    locale: z.string().optional(),
    tags: z.array(z.string()).optional(),
    correlationId: z.string().optional(),
    scheduleAt: z.union([z.date(), z.string().datetime()]).optional(),
    callbackUrl: z.string().url('Invalid callback URL').optional(),
    trackEvents: z
        .array(z.enum(['queued', 'sent', 'delivered', 'failed']))
        .optional(),
});

export const MessengerClientConfigSchema = z
    .object({
        apiUrl: z.string().url('Invalid API URL').optional(),
        defaults: z
            .object({
                queueId: z.string().optional(),
                topic: z.string().optional(),
                applicationId: z.string().optional(),
                meta: z
                    .object({
                        priority: z.enum(['low', 'normal', 'high']).optional(),
                        locale: z.string().optional(),
                        correlationId: z.string().optional(),
                        tags: z.array(z.string()).optional(),
                        createdAt: z.string().optional(),
                        expiresAt: z.string().optional(),
                    })
                    .optional(),
                delivery: z
                    .object({
                        channel: z
                            .array(z.enum(['email', 'sms', 'push', 'webhook']))
                            .optional(),
                        retryPolicy: z
                            .object({
                                maxRetries: z.number().int().positive(),
                                backoff: z.enum([
                                    'fixed',
                                    'linear',
                                    'exponential',
                                ]),
                                delay: z.number().int().positive().optional(),
                            })
                            .optional(),
                        scheduleAt: z.union([z.string(), z.null()]).optional(),
                        ttl: z.number().optional(),
                    })
                    .optional(),
            })
            .optional(),
        redis: z
            .object({
                connectionTimeout: z.number().int().positive().optional(),
                retries: z.number().int().nonnegative().optional(),
                url: z.string().optional(),
            })
            .optional(),
    })
    .optional()
    .default({});

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

export function validateMessageData(data: unknown): SimpleMessageData {
    try {
        return SimpleMessageDataSchema.parse(data);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const issues = error.issues
                .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
                .join(', ');
            throw new Error(`Message data validation error: ${issues}`);
        }
        throw new Error('Message data validation failed');
    }
}

export function validateClientConfig(config: unknown): MessengerClientConfig {
    try {
        const parsed = MessengerClientConfigSchema.parse(config);
        return parsed as MessengerClientConfig;
    } catch (error) {
        if (error instanceof z.ZodError) {
            const issues = error.issues
                .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
                .join(', ');
            throw new Error(`Client config validation error: ${issues}`);
        }
        throw new Error('Client config validation failed');
    }
}

export function validateQueueConfig(
    config: unknown,
): RedisQueueConnectionConfig {
    try {
        return RedisQueueConnectionConfigSchema.parse(config);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const issues = error.issues
                .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
                .join(', ');
            throw new Error(`Queue config validation error: ${issues}`);
        }
        throw new Error('Queue config validation failed');
    }
}

export function isValidationError(error: unknown): error is z.ZodError {
    return error instanceof z.ZodError;
}

export function getValidationErrors(error: z.ZodError): string[] {
    return error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
}
