# @techspear/messenger-client

[![npm version](https://badge.fury.io/js/%40techspear%2Fmessenger-client.svg)](https://badge.fury.io/js/%40techspear%2Fmessenger-client)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)

Client TypeScript autonome et léger pour envoyer des messages via le système Messenger. Compatible avec tout projet Node.js/TypeScript.

## 🚀 Installation

```bash
npm install @techspear/messenger-client
# ou
yarn add @techspear/messenger-client
# ou
pnpm add @techspear/messenger-client
```

### Dépendances requises

Le client nécessite ces packages dans votre projet :

```bash
npm install bullmq ioredis
```

## 📖 Utilisation rapide

### Configuration de base

```typescript
import { createMessengerClient } from '@techspear/messenger-client';

// Configuration simple
const client = createMessengerClient({
    defaults: { queueId: 'my-queue', applicationId: 'my-app' },
    redis: { url: 'redis://localhost:6379' },
});

// Configurez vos queues
client.configureQueue('my-queue', 'redis://localhost:6379', 'notifications');

// Envoi d'un email simple
await client.sendEmail('user@example.com', 'welcome-user', {
    userName: 'Jean Dupont',
});

// Important : fermez les connexions
await client.close();
```

### Avec utilitaires de configuration

```typescript
import {
    createMessengerClient,
    MessengerUtils,
} from '@techspear/messenger-client';

// Configuration pour développement
const devClient = createMessengerClient(
    MessengerUtils.createDevConfig(
        'dev-queue',
        'my-app',
        'redis://localhost:6379',
    ),
);

// Configuration pour production
const prodClient = createMessengerClient(
    MessengerUtils.createProdConfig(
        'prod-queue',
        'my-app',
        'redis://prod:6379',
    ),
);
```

## 🎯 Fonctionnalités

### 1. Envoi de messages simples

```typescript
// Email
await client.sendEmail('user@example.com', 'welcome-email', {
    userName: 'Alice',
    bonus: 10,
});

// SMS
await client.sendSMS('+33612345678', 'security-alert', {
    alertType: 'login',
    location: 'Paris',
});

// Notification Push
await client.sendPush('device-token', 'new-message', {
    senderName: 'Bob',
    preview: 'Salut !',
});
```

### 2. API fluide avec MessageBuilder

```typescript
await client
    .createMessage()
    .forApplication('ecommerce')
    .withScenario('order-confirmation')
    .to('customer@example.com')
    .cc('manager@company.com')
    .withSubject('Commande #12345')
    .withBusinessData({
        orderNumber: '12345',
        total: 89.99,
        items: [...]
    })
    .viaEmail()
    .inLocale('fr')
    .withTags('order', 'confirmation')
    .withPriority('high')
    .send();
```

### 3. Planification de messages

```typescript
// Programmation pour une date spécifique
const futureDate = new Date('2024-12-25T09:00:00Z');
await client.scheduleMessage(messageData, futureDate);

// Programmation relative
await client
    .createMessage()
    .withScenario('meeting-reminder')
    .to('user@example.com')
    .scheduleIn(60 * 60 * 1000) // Dans 1 heure
    .send();
```

### 4. Gestion multi-queues

```typescript
import { MessengerUtils } from '@techspear/messenger-client';

// Client avec plusieurs queues configurées
const client = MessengerUtils.createClientWithQueues([
    {
        queueId: 'urgent-queue',
        redisUrl: 'redis://localhost:6379',
        defaultTopic: 'alerts',
    },
    {
        queueId: 'marketing-queue',
        redisUrl: 'redis://localhost:6379',
        defaultTopic: 'campaigns',
    },
]);

// Envoi sur queue spécifique
await client.sendEmail(
    'admin@company.com',
    'system-alert',
    { alertType: 'CRITICAL' },
    { queueId: 'urgent-queue', priority: 'high' },
);
```

### 5. Gestion des événements

```typescript
// Écoute des événements
client.on('message-queued', (event) => {
    console.log('Message en queue:', event.messageId);
});

client.on('message-failed', (event) => {
    console.error('Échec:', event.data.error);
});

// Envoi avec callback webhook
await client
    .createMessage()
    .withScenario('newsletter')
    .to('user@example.com')
    .withCallback('https://myapp.com/webhook')
    .trackEvents('sent', 'delivered', 'failed')
    .send();
```

## 🔧 Configuration avancée

### Options complètes du client

```typescript
const client = createMessengerClient({
    // URL de l'API (optionnel)
    apiUrl: 'https://messenger-api.com',

    // Valeurs par défaut
    defaults: {
        queueId: 'main-queue',
        topic: 'default',
        applicationId: 'my-app',
        meta: { priority: 'normal', locale: 'fr' },
        delivery: {
            channel: 'email',
            retryPolicy: { maxRetries: 3, backoff: 'exponential' },
        },
    },

    // Options Redis
    redis: {
        url: 'redis://localhost:6379',
        connectionTimeout: 5000,
        retries: 3,
    },
});

// Configuration des queues
client.configureQueue('urgent-queue', 'redis://urgent:6379', 'alerts');
client.configureQueue('marketing-queue', 'redis://marketing:6379', 'campaigns');
```

## 📊 Types TypeScript

Le package est entièrement typé avec TypeScript :

```typescript
import type {
    MessengerClientConfig,
    SimpleMessageData,
    SendMessageResponse,
    MessengerEvent,
} from '@techspear/messenger-client';

// Configuration typée
const config: MessengerClientConfig = {
    defaults: { queueId: 'my-queue', applicationId: 'my-app' },
};

// Données de message typées
const messageData: SimpleMessageData = {
    to: ['user@example.com'],
    scenarioId: 'welcome',
    businessData: { userName: 'Alice' },
};
```

## 🔒 Bonnes pratiques

### 1. Gestion des erreurs

```typescript
try {
    const response = await client.sendEmail(...);
    if (!response.success) {
        console.error('Erreur:', response.error);
    }
} catch (error) {
    console.error('Exception:', error);
} finally {
    await client.close(); // Important !
}
```

### 2. Réutilisation avec pattern builder

```typescript
const baseMessage = client
    .createMessage()
    .forApplication('ecommerce')
    .viaEmail()
    .inLocale('fr');

// Réutilisation
const welcomeMessage = baseMessage
    .clone()
    .withScenario('welcome')
    .to('user@example.com');

const orderMessage = baseMessage
    .clone()
    .withScenario('order-confirmation')
    .to('customer@example.com');
```

### 3. Configuration par environnement

```typescript
// config/messenger.ts
import { MessengerUtils } from '@techspear/messenger-client';

const config =
    process.env.NODE_ENV === 'production'
        ? MessengerUtils.createProdConfig(
              'prod-queue',
              'my-app',
              process.env.REDIS_URL!,
          )
        : MessengerUtils.createDevConfig(
              'dev-queue',
              'my-app',
              'redis://localhost:6379',
          );

export default config;
```

## 🚧 Exemple complet

```typescript
import {
    createMessengerClient,
    MessengerUtils,
} from '@techspear/messenger-client';

async function sendWelcomeEmail() {
    // Configuration
    const client = createMessengerClient(
        MessengerUtils.createDevConfig('notifications', 'ecommerce-app'),
    );

    // Configuration des queues
    client.configureQueue('notifications', 'redis://localhost:6379', 'emails');

    try {
        // Envoi avec builder
        const response = await client
            .createMessage()
            .withScenario('user-welcome')
            .to('newuser@example.com')
            .withBusinessData({
                userName: 'Marie Dupont',
                activationUrl: 'https://myapp.com/activate/123',
                welcomeBonus: 10,
            })
            .viaEmail()
            .withSubject('Bienvenue sur notre plateforme !')
            .withTags('welcome', 'new-user')
            .withCallback('https://myapp.com/webhooks/email-status')
            .send();

        console.log('Email envoyé:', response.success ? '✅' : '❌');
        if (response.messageId) {
            console.log('ID du message:', response.messageId);
        }
    } catch (error) {
        console.error('Erreur:', error);
    } finally {
        // Fermeture des connexions
        await client.close();
    }
}

sendWelcomeEmail();
```

## 📝 Changelog

### v1.0.0

- Version initiale
- Support pour emails, SMS, notifications push
- API fluide avec MessageBuilder
- Gestion multi-queues
- Planification de messages
- Support TypeScript complet

## 🤝 Contribution

Les contributions sont les bienvenues ! Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour les détails.

## 📄 Licence

MIT © TechSpear
