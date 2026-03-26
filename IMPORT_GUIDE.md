# Guide d'importation du MessengerClient

Ce document explique les différentes façons d'importer et d'utiliser le MessengerClient dans vos projets.

## 🚀 Option 1: Package NPM autonome (Recommandé)

### Installation

```bash
npm install @techspear/messenger-client bullmq ioredis
```

### Utilisation

```typescript
import {
    createMessengerClient,
    MessengerUtils,
} from '@techspear/messenger-client';

const client = createMessengerClient(
    MessengerUtils.createDevConfig(
        'my-queue',
        'my-app',
        'redis://localhost:6379',
    ),
);

// Configuration des queues
client.configureQueue('my-queue', 'redis://localhost:6379', 'notifications');

await client.sendEmail('user@example.com', 'welcome', { name: 'Alice' });
await client.close();
```

**Avantages:**

- ✅ Package autonome, pas de dépendances au projet Messenger
- ✅ Facile à installer avec npm/yarn
- ✅ Versioning indépendant
- ✅ Compatible avec tout projet Node.js/TypeScript
- ✅ Types TypeScript inclus

## 📦 Option 2: Import depuis le projet principal

Si vous avez accès au code source du projet Messenger :

```typescript
import { createMessengerClient } from './path/to/messenger/src/client';

const client = createMessengerClient({
    defaults: { queueId: 'my-queue', applicationId: 'my-app' },
});
```

**Avantages:**

- ✅ Accès direct au code source
- ✅ Peut utiliser les services internes du projet

**Inconvénients:**

- ❌ Couplage fort avec le projet Messenger
- ❌ Dépendances complexes (Prisma, etc.)

## 🔧 Option 3: Sous-module Git

```bash
# Ajouter comme sous-module
git submodule add https://github.com/TechSpear-SD/messenger.git vendor/messenger

# Dans votre projet
import { createMessengerClient } from './vendor/messenger/packages/messenger-client';
```

## 🎯 Option 4: Export en tant que fichier distribué

Créez un fichier standalone dans le projet principal :

### Création du fichier distribué

```bash
cd messenger-project
npm run build:client  # Build spécial pour le client
```

### Structure recommandée

```
dist/
├── messenger-client.js          # Version CommonJS
├── messenger-client.esm.js      # Version ES Modules
├── messenger-client.d.ts        # Types TypeScript
└── package.json                 # Métadonnées
```

### Utilisation

```typescript
import { MessengerClient } from './dist/messenger-client.esm.js';
```

## 📋 Comparaison des options

| Option            | Simplicité | Autonomie  | Maintenance | Recommandé pour       |
| ----------------- | ---------- | ---------- | ----------- | --------------------- |
| Package NPM       | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐  | Production            |
| Import direct     | ⭐⭐⭐     | ⭐⭐       | ⭐⭐        | Développement interne |
| Sous-module       | ⭐⭐       | ⭐⭐⭐     | ⭐⭐⭐      | Projets liés          |
| Fichier distribué | ⭐⭐⭐⭐   | ⭐⭐⭐⭐   | ⭐⭐⭐      | Déploiement simple    |

## 🔧 Configuration de build pour option NPM

Voici les fichiers de configuration créés pour publier le package :

### package.json

```json
{
    "name": "@techspear/messenger-client",
    "version": "1.0.0",
    "main": "dist/index.js",
    "types": "dist/index.d.ts",
    "module": "dist/index.esm.js",
    "files": ["dist", "README.md"]
}
```

### Scripts de build

```bash
# Build complet
npm run build

# Publication
npm publish
```

## 📚 Exemples d'intégration

### Dans une application Express

```typescript
// app.ts
import express from 'express';
import {
    createMessengerClient,
    MessengerUtils,
} from '@techspear/messenger-client';

const app = express();
const messenger = createMessengerClient(
    MessengerUtils.createProdConfig(
        'notifications',
        'my-api',
        process.env.REDIS_URL!,
    ),
);

messenger.configureQueue('notifications', process.env.REDIS_URL!, 'emails');

app.post('/send-welcome', async (req, res) => {
    try {
        const response = await messenger.sendEmail(req.body.email, 'welcome', {
            userName: req.body.name,
        });
        res.json({ success: response.success });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cleanup à l'arrêt
process.on('SIGTERM', async () => {
    await messenger.close();
    process.exit(0);
});
```

### Dans une application Next.js

```typescript
// lib/messenger.ts
import {
    createMessengerClient,
    MessengerUtils,
} from '@techspear/messenger-client';

let messengerClient: any = null;

export function getMessengerClient() {
    if (!messengerClient) {
        messengerClient = createMessengerClient(
            MessengerUtils.createProdConfig(
                'nextjs-notifications',
                'nextjs-app',
                process.env.REDIS_URL!,
            ),
        );

        messengerClient.configureQueue(
            'nextjs-notifications',
            process.env.REDIS_URL!,
            'web-notifications',
        );
    }
    return messengerClient;
}

// api/send-email.ts
import { getMessengerClient } from '../../lib/messenger';

export default async function handler(req, res) {
    const client = getMessengerClient();

    const response = await client.sendEmail(
        req.body.to,
        req.body.scenario,
        req.body.data,
    );

    res.json(response);
}
```

### Dans un microservice

```typescript
// services/notification.service.ts
import { createMessengerClient } from '@techspear/messenger-client';

export class NotificationService {
    private messenger;

    constructor() {
        this.messenger = createMessengerClient({
            defaults: {
                queueId: 'microservice-notifications',
                applicationId: 'notification-service',
            },
            redis: { url: process.env.REDIS_URL },
        });

        this.messenger.configureQueue(
            'microservice-notifications',
            process.env.REDIS_URL!,
            'notifications',
        );
    }

    async sendUserNotification(userId: string, type: string, data: any) {
        return this.messenger
            .createMessage()
            .withScenario(`user-${type}`)
            .to(`user-${userId}@notifications.internal`)
            .withBusinessData(data)
            .withTags('user-notification', type)
            .withCorrelationId(`user-${userId}-${Date.now()}`)
            .send();
    }

    async close() {
        await this.messenger.close();
    }
}
```

## 🎯 Recommandation finale

**Pour la plupart des cas d'usage, utilisez l'Option 1 (Package NPM)** car elle offre :

1. **Simplicité maximale** - Installation standard avec npm
2. **Autonomie complète** - Pas de dépendances externes
3. **Maintenance facile** - Versioning et updates séparés
4. **Portabilité** - Compatible avec tout environnement Node.js
5. **Documentation** - README et types TypeScript inclus

Les fichiers ont été créés dans `packages/messenger-client/` et sont prêts pour la publication sur NPM !
