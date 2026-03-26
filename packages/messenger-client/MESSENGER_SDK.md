# @techspear/messenger-client — SDK Context

> Fichier de contexte pour Claude. À fournir lors de l'intégration de la SDK dans un autre projet.

## Vue d'ensemble

`@techspear/messenger-client` est un client TypeScript autonome pour envoyer des messages (email, SMS, push, webhook) via le système Messenger. Il se connecte directement à Redis et enqueue des jobs BullMQ consommés par les workers Messenger. Aucune API HTTP n'est requise.

### Prérequis

- Node.js ≥ 18
- Redis accessible depuis le projet consommateur
- Peer dependencies : `bullmq` (≥ 5.60), `ioredis` (≥ 5.8)
- Dependency : `zod` (≥ 4.1)

### Installation

```bash
npm install @techspear/messenger-client bullmq ioredis
```

---

## Architecture de la SDK

```
Client App
    │
    ├── MessengerClient          # Classe principale (extends EventEmitter)
    │     ├── sendMessage()      # Envoi direct (SimpleMessageData)
    │     ├── sendEmail()        # Raccourci email
    │     ├── sendSMS()          # Raccourci SMS
    │     ├── sendPush()         # Raccourci push
    │     ├── scheduleMessage()  # Envoi planifié
    │     ├── createMessage()    # Retourne un MessageBuilder
    │     └── close()            # Ferme toutes les connexions Redis
    │
    ├── MessageBuilder           # Builder fluent pour messages complexes
    │     ├── .to() .cc() .bcc() .replyTo()
    │     ├── .withScenario() .forApplication()
    │     ├── .withBusinessData() .addBusinessData()
    │     ├── .viaEmail() .viaSMS() .viaPush() .viaChannel()
    │     ├── .inLocale() .withTags() .withCorrelationId()
    │     ├── .scheduleAt() .scheduleIn()
    │     ├── .useQueue() .withPriority() .withDelay() .withTTL()
    │     ├── .withJobOptions() .withCallback() .trackEvents()
    │     ├── .send()            # Valide et envoie
    │     ├── .build()           # Valide et retourne les données sans envoyer
    │     └── .clone()           # Clone le builder
    │
    ├── RedisConnectionManager   # Pool de connexions Redis (singleton)
    └── MessageProducer          # Producteur BullMQ
```

Le client construit un `QueueMessage` (structure attendue par les workers Messenger) et l'enqueue dans une queue BullMQ. Les workers du serveur Messenger consomment ces messages, résolvent le scénario + templates, rendent les templates Handlebars avec les `businessData`, et envoient via le provider configuré (SendGrid, Gmail, Mock, etc.).

---

## Concepts clés

| Concept           | Description                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------- |
| **applicationId** | Identifiant de l'application cliente (enregistrée dans Messenger)                        |
| **scenarioId**    | Identifiant du scénario de messaging (workflow avec 1..N templates)                      |
| **queueId**       | Identifiant de la queue BullMQ configurée dans Messenger                                 |
| **topic**         | Nom de la queue BullMQ (ex: `default`, `production`, `emails`)                           |
| **businessData**  | Données métier injectées dans les templates Handlebars (ex: `{ userName, orderNumber }`) |
| **channels**      | Canaux de livraison : `email`, `sms`, `push`, `webhook`                                  |

---

## Configuration

### Types de configuration

```typescript
interface MessengerClientConfig {
    apiUrl?: string; // URL API Messenger (optionnel, pas encore utilisé)
    defaults?: {
        queueId?: string; // Queue par défaut
        topic?: string; // Topic par défaut
        applicationId?: string; // Application par défaut
        meta?: {
            priority?: 'low' | 'normal' | 'high';
            locale?: string; // Locale par défaut (ex: 'fr', 'en')
            correlationId?: string;
            tags?: string[];
            createdAt?: string;
            expiresAt?: string;
        };
        delivery?: {
            channel?: ('email' | 'sms' | 'push' | 'webhook')[];
            retryPolicy?: {
                maxRetries: number;
                backoff: 'fixed' | 'linear' | 'exponential';
                delay?: number; // Délai en ms
            };
            scheduleAt?: string | null;
            ttl?: number;
        };
    };
    redis?: {
        connectionTimeout?: number; // Timeout en ms (défaut: 5000)
        retries?: number; // Tentatives de reconnexion (défaut: 3)
        url?: string; // URL Redis (défaut: redis://localhost:6379)
    };
}
```

### Helpers de configuration

```typescript
import { MessengerUtils } from '@techspear/messenger-client';

// Dev — Redis local, topic "default"
const devConfig = MessengerUtils.createDevConfig('my-queue', 'my-app-id');

// Prod — Redis distant, topic "production", retry policy incluse
const prodConfig = MessengerUtils.createProdConfig(
    'my-queue',
    'my-app-id',
    'redis://redis.prod:6379',
);

// Multi-queues
const client = MessengerUtils.createClientWithQueues([
    { queueId: 'emails', redisUrl: 'redis://redis-emails:6379' },
    { queueId: 'sms', redisUrl: 'redis://redis-sms:6379' },
]);
```

---

## Utilisation

### 1. Initialisation

```typescript
import { MessengerClient, MessengerUtils } from '@techspear/messenger-client';

const messenger = new MessengerClient(
    MessengerUtils.createDevConfig('main-queue', 'my-app'),
);
```

Ou via la factory :

```typescript
import {
    createMessengerClient,
    MessengerUtils,
} from '@techspear/messenger-client';

const messenger = createMessengerClient(
    MessengerUtils.createProdConfig(
        'main-queue',
        'my-app',
        process.env.REDIS_URL!,
    ),
);
```

### 2. Envoi simple (sendMessage)

```typescript
const result = await messenger.sendMessage({
    scenarioId: 'user-welcome',
    to: ['user@example.com'],
    businessData: {
        userName: 'John Doe',
        activationLink: 'https://app.com/activate/abc123',
    },
});

if (result.success) {
    console.log('Job ID:', result.jobId);
    console.log('Message ID:', result.messageId);
} else {
    console.error('Error:', result.error);
}
```

### 3. Raccourcis par canal

```typescript
// Email
await messenger.sendEmail('user@example.com', 'welcome-email', {
    userName: 'John',
});

// SMS
await messenger.sendSMS('+33612345678', 'sms-verification', { code: '123456' });

// Push
await messenger.sendPush('device-token-xyz', 'push-notification', {
    title: 'New message',
});
```

### 4. MessageBuilder (messages complexes)

```typescript
const result = await messenger
    .createMessage()
    .withScenario('order-confirmation')
    .forApplication('ecommerce-app')
    .to('client@example.com')
    .cc('support@company.com')
    .viaEmail()
    .inLocale('fr')
    .withBusinessData({
        orderNumber: 'ORD-2024-001',
        totalAmount: '149.99€',
        items: [
            { name: 'Product A', qty: 2 },
            { name: 'Product B', qty: 1 },
        ],
    })
    .withTags('order', 'confirmation')
    .withCorrelationId('session-abc-123')
    .withPriority('high')
    .send();
```

### 5. Envoi planifié

```typescript
// Via scheduleMessage
await messenger.scheduleMessage(
    {
        scenarioId: 'reminder',
        to: ['user@example.com'],
        businessData: { eventName: 'Meeting' },
    },
    new Date('2026-04-01T09:00:00Z'),
);

// Via le builder
await messenger
    .createMessage()
    .withScenario('daily-digest')
    .to('user@example.com')
    .withBusinessData({ date: '2026-04-01' })
    .scheduleIn(3600000) // dans 1 heure
    .send();
```

### 6. Build sans envoyer

```typescript
const { messageData, options } = messenger
    .createMessage()
    .withScenario('test')
    .to('test@example.com')
    .withBusinessData({ key: 'value' })
    .build();

// messageData et options peuvent être inspectés, logués, ou envoyés plus tard
```

### 7. Événements

```typescript
messenger.on('message-queued', (event) => {
    console.log(`Message ${event.messageId} queued in ${event.queueId}`);
});

messenger.on('message-failed', (event) => {
    console.error('Failed:', event.data.error);
});
```

### 8. Fermeture

```typescript
// Toujours fermer les connexions Redis au shutdown
process.on('SIGTERM', async () => {
    await messenger.close();
    process.exit(0);
});
```

---

## Structure du QueueMessage envoyé

Voici la structure exacte du message tel qu'il arrive dans la queue BullMQ et est consommé par les workers Messenger :

```typescript
interface QueueMessage {
    // Routing
    applicationId: string; // ID de l'application enregistrée
    scenarioId: string; // ID du scénario à exécuter

    // Données métier (injectées dans les templates Handlebars)
    businessData: Record<string, any>;

    // Destinataires
    to: string[]; // Destinataires principaux
    cc?: string[]; // Copie
    bcc?: string[]; // Copie cachée
    replyTo?: string; // Reply-to

    // Overrides de contenu (contournent le template)
    subject?: string;
    bodyOverride?: string;

    // Métadonnées
    meta?: {
        priority?: 'low' | 'normal' | 'high';
        locale?: string;
        correlationId?: string;
        tags?: string[];
        createdAt?: string;
        expiresAt?: string;
    };

    // Options de livraison
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

    // Tracking
    tracking?: {
        messageId?: string; // Généré automatiquement (msg_<timestamp>_<uuid>)
        callbackUrl?: string | null;
        events?: ('queued' | 'sent' | 'delivered' | 'failed')[];
    };
}
```

---

## Validation

La SDK valide automatiquement les données via Zod avant l'envoi. Champs obligatoires :

- `scenarioId` : non vide
- `to` : au moins 1 destinataire (string non vide)
- `businessData` : objet non vide

En cas d'erreur de validation, `sendMessage` retourne `{ success: false, error: "Message data validation error: ..." }`.

Les schemas Zod sont aussi exportés si besoin de validation côté consommateur :

```typescript
import {
    SimpleMessageDataSchema,
    MessengerClientConfigSchema,
    validateMessageData,
} from '@techspear/messenger-client';
```

---

## SendMessageResponse

```typescript
interface SendMessageResponse {
    success: boolean;
    jobId?: string; // ID du job BullMQ (si success)
    messageId?: string; // ID unique du message (msg_<ts>_<uuid>)
    error?: string; // Message d'erreur (si !success)
    details?: { queueId: string; topic: string; jobOptions?: any };
}
```

---

## Résolution des champs (priorité)

Le client fusionne les valeurs message → config defaults. Priorité (de la plus haute à la plus basse) :

| Champ           | 1. Message                    | 2. Config defaults                 | 3. Fallback              |
| --------------- | ----------------------------- | ---------------------------------- | ------------------------ |
| `queueId`       | `options.queueId`             | `config.defaults.queueId`          | ❌ Erreur                |
| `topic`         | `options.topic`               | `config.defaults.topic`            | ❌ Erreur                |
| `applicationId` | `messageData.applicationId`   | `config.defaults.applicationId`    | ❌ Erreur                |
| `locale`        | `messageData.locale`          | `config.defaults.meta.locale`      | `'en'`                   |
| `channels`      | `messageData.channels`        | `config.defaults.delivery.channel` | `['email']`              |
| `redis url`     | Queue config (configureQueue) | `config.redis.url`                 | `redis://localhost:6379` |

---

## API complète (exports)

```typescript
// Classes
export { MessengerClient }; // Classe principale
export { MessageBuilder }; // Builder fluent
export { RedisConnectionManager }; // Pool Redis (singleton, usage avancé)
export { MessageProducer }; // Producteur BullMQ (usage avancé)

// Types
export type {
    MessengerClientConfig,
    SendMessageOptions,
    SimpleMessageData,
    SendMessageResponse,
    RedisQueueConnectionConfig,
    MessengerEvent,
    QueueMessage,
};

// Schemas Zod
export {
    SimpleMessageDataSchema,
    MessengerClientConfigSchema,
    validateMessageData,
};

// Utilitaires
export { createMessengerClient }; // Factory function
export { MessengerUtils }; // Helpers de configuration
export { VERSION }; // '1.0.0'
```

---

## Bonnes pratiques d'intégration

1. **Toujours fermer le client** (`messenger.close()`) au shutdown pour libérer les connexions Redis
2. **Configurer les defaults** (queueId, topic, applicationId) pour éviter de les répéter à chaque envoi
3. **Utiliser le MessageBuilder** pour les messages complexes avec plusieurs options
4. **Écouter les événements** (`message-queued`, `message-failed`) pour le monitoring
5. **Les `businessData` doivent correspondre** aux variables attendues dans les templates Handlebars du scénario
6. **Le `scenarioId` doit exister** dans la base Messenger avec ses templates associés
7. **Le `applicationId` doit être enregistré** dans Messenger avec un `ApplicationScenario` lié au `scenarioId`
8. **La queue Redis doit être la même** que celle consommée par les workers Messenger

---

## Erreurs courantes

| Erreur                               | Cause                                   | Solution                                      |
| ------------------------------------ | --------------------------------------- | --------------------------------------------- |
| `queueId is required`                | Pas de queueId dans options ni defaults | Ajouter dans config ou options                |
| `topic is required`                  | Pas de topic dans options ni defaults   | Ajouter dans config ou options                |
| `applicationId is required`          | Pas d'applicationId                     | Ajouter dans messageData ou defaults          |
| `scenarioId is required`             | scenarioId manquant ou vide             | Fournir un scenarioId valide                  |
| `At least one recipient is required` | `to` vide ou manquant                   | Fournir au moins un destinataire              |
| `businessData cannot be empty`       | `businessData` vide `{}`                | Fournir au moins une clé dans businessData    |
| `ECONNREFUSED`                       | Redis inaccessible                      | Vérifier l'URL Redis et que le serveur tourne |
