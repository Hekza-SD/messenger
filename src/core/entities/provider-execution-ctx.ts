import { SupportedChannel } from '@prisma/client';

export interface ProviderExecutionContext {
    // ---- Routing / identification ----
    applicationId: string;

    // ---- Destination ----
    to: string[]; // destinataires (emails, phones, tokens…)
    cc?: string[];
    bcc?: string[];
    subject: string; // override si besoin
    body: string; // override si besoin
    from: string; // override si besoin
    headers?: Record<string, string>; // custom headers if supported by provider/channel
    channels: SupportedChannel[]; // channels to use (email, sms, push, webhook…)

    // ---- Meta control ----
    meta?: {
        correlationId?: string; // pour tracer un flot complet
        tags?: string[];
        createdAt?: string; // ISO8601 (ajout automatique à l’entrée queue)
    };

    // ---- Tracking / observability ----
    tracking?: {
        messageId?: string; // id unique assigné par Messenger
    };
}
