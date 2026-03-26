export interface QueueMessage {
    // ---- Routing / identification ----
    applicationId: string;
    scenarioId: string;

    // ---- Business data ----
    businessData: Record<string, any>; // données injectées dans le template

    // ---- Destination ----
    to: string[]; // destinataires (emails, phones, tokens…)
    cc?: string[];
    bcc?: string[];
    replyTo?: string; // utile pour email
    subject?: string; // override si besoin
    bodyOverride?: string; // override si besoin (email, sms…)

    // ---- Meta control ----
    meta?: {
        priority?: 'low' | 'normal' | 'high';
        locale?: string; // choix de langue du template
        correlationId?: string; // pour tracer un flot complet
        tags?: string[];
        createdAt?: string; // ISO8601
        expiresAt?: string; // pour expirer le message si pas traité à temps
    };

    // ---- Delivery options ----
    delivery?: {
        channel?: ('email' | 'sms' | 'push' | 'webhook')[];
        retryPolicy?: {
            maxRetries: number;
            backoff: 'fixed' | 'linear' | 'exponential';
            delay?: number; // ms entre retries si fixed/linear
        };
        scheduleAt?: string | null; // planification future
        ttl?: number; // ms de validité max du message
    };

    // ---- Tracking / observability ----
    tracking?: {
        messageId?: string; // id unique assigné par Messenger
        callbackUrl?: string | null; // webhook pour notifier du statut
        events?: ('queued' | 'sent' | 'delivered' | 'failed')[];
    };
}
