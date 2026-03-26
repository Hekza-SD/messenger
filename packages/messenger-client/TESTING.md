# Documentation des Tests - MessengerClient

Cette documentation décrit la stratégie de test et l'utilisation des tests pour le package MessengerClient.

## 📋 Vue d'ensemble

Le package MessengerClient dispose d'une suite de tests complète couvrant :

- **Tests unitaires** : Chaque classe et fonction individuellement
- **Tests d'intégration** : Scénarios réels d'utilisation
- **Tests de validation** : Schemas et types avec Zod
- **Tests de performance** : Gestion de charge et efficacité

### Couverture de code

Objectif de couverture : **80%** minimum sur toutes les métriques :

- Branches : 80%
- Fonctions : 80%
- Lignes : 80%
- Statements : 80%

## 🚀 Commandes de test

### Tests basiques

```bash
# Lancer tous les tests
npm test

# Tests en mode watch (développement)
npm run test:watch

# Tests avec couverture de code
npm run test:coverage

# Tests pour CI/CD
npm run test:ci
```

### Tests spécifiques

```bash
# Tests unitaires uniquement
npm run test:unit

# Tests d'intégration uniquement
npm run test:integration

# Tests d'un fichier spécifique
npm test -- messenger-client.test.ts

# Tests avec pattern de nom
npm test -- --testNamePattern="send message"
```

### Vérification de types

```bash
# Vérification TypeScript (pas de compilation)
npm run lint
```

## 📁 Structure des tests

```
tests/
├── setup.ts                    # Configuration globale
├── messenger-client.test.ts     # Tests MessengerClient
├── message-builder.test.ts      # Tests MessageBuilder
├── queue-manager.test.ts        # Tests QueueManager
├── types.test.ts               # Tests types et validations
└── integration.test.ts         # Tests d'intégration
```

## 🧪 Types de tests

### 1. Tests unitaires

#### MessengerClient (`messenger-client.test.ts`)

- Configuration et initialisation
- Méthodes d'envoi (sendEmail, sendSMS, sendPush)
- Planification de messages
- Gestion des événements
- Gestion des erreurs
- Validation des données

#### MessageBuilder (`message-builder.test.ts`)

- API fluide (chaînage de méthodes)
- Validation des données construites
- Gestion des destinataires
- Configuration des canaux
- Planification et options
- Clonage et réinitialisation

#### QueueManager (`queue-manager.test.ts`)

- Gestion des connexions Redis
- Pattern Singleton
- Création et fermeture de queues
- Gestion d'erreurs de connexion
- Production de messages

#### Types et Validations (`types.test.ts`)

- Schemas Zod pour validation
- Fonctions de validation utilitaires
- Tests de types TypeScript
- Scénarios de validation complexes

### 2. Tests d'intégration

Les tests d'intégration simulent des workflows réels d'applications :

#### Scénarios E-commerce

- Workflow complet de commande (confirmation → suivi → livraison)
- Séquence de rappels de panier abandonné
- Notifications promotionnelles

#### Scénarios SaaS

- Onboarding d'utilisateur (bienvenue → aide → rappels)
- Notifications d'équipe et collaboration
- Gestion des essais et abonnements

#### Scénarios Healthcare

- Système de rappels de rendez-vous
- Suivi post-consultation
- Communications multi-canaux (email + SMS)

#### Scénarios de performance

- Envoi en masse (100+ messages)
- Gestion des pannes temporaires
- Traçabilité avec correlation IDs

## 🛠️ Configuration Jest

### Configuration principale (`jest.config.js`)

```javascript
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    coverageThreshold: {
        global: { branches: 80, functions: 80, lines: 80, statements: 80 },
    },
    setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
    testTimeout: 10000,
};
```

### Helpers globaux (`tests/setup.ts`)

Fonctions utilitaires disponibles dans tous les tests :

- `testHelpers.createValidMessageData()`
- `testHelpers.createValidClientConfig()`
- `testHelpers.mockRedisSuccess()`
- `testHelpers.flushPromises()`

## 🔧 Stratégies de mock

### Dépendances externes mockées

- `bullmq` : Queue Redis pour tests sans infrastructure
- `ioredis` : Connexions Redis simulées
- Producteur de messages : Réponses contrôlées

### Pattern de mock utilisé

```typescript
// Mock de classe complète
jest.mock('../src/queue-manager');
const MockedQueueManager = QueueManager as jest.MockedClass<
    typeof QueueManager
>;

// Mock partiel avec spies
jest.spyOn(client, 'sendMessage').mockResolvedValue({ success: true });

// Mock avec implémentation personnalisée
mockQueue.add.mockImplementation(async (name, data, options) => {
    // Logique de test personnalisée
    return { id: 'test-job-id' };
});
```

## 📊 Métriques et rapports

### Rapport de couverture

Après `npm run test:coverage`, consultez :

- `coverage/lcov-report/index.html` : Rapport HTML détaillé
- `coverage/lcov.info` : Format LCOV pour CI/CD
- Console : Résumé de couverture

### Métriques surveillées

- **Temps d'exécution** : Tests < 10 secondes
- **Couverture de code** : > 80% sur toutes les métriques
- **Taux de succès** : 100% des tests doivent passer
- **Performance** : Envoi de 100 messages < 10 secondes

## 🐛 Débogage des tests

### Tests qui échouent

```bash
# Mode verbose pour plus de détails
npm test -- --verbose

# Run un seul test
npm test -- --testNamePattern="specific test name"

# Debug avec Node
npm test -- --runInBand --no-cache --no-coverage
```

### Problèmes courants

#### Timeouts

```typescript
// Augmenter le timeout pour un test spécifique
it('should handle long operation', async () => {
    // ... test code
}, 30000); // 30 secondes
```

#### Mocks qui ne fonctionnent pas

```typescript
// S'assurer que les mocks sont bien réinitialisés
beforeEach(() => {
    jest.clearAllMocks();
});
```

#### Problèmes d'import

```typescript
// Utiliser des imports dynamiques si nécessaire
const { MessengerClient } = await import('../src/messenger-client');
```

## 📝 Bonnes pratiques

### Écriture de tests

1. **AAA Pattern** : Arrange → Act → Assert
2. **Noms descriptifs** : `should handle email sending with validation error`
3. **Tests isolés** : Chaque test est indépendant
4. **Mocks appropriés** : Mock seulement ce qui est nécessaire

### Exemple de test bien structuré

```typescript
describe('MessengerClient', () => {
    describe('sendEmail', () => {
        it('should send email successfully with valid data', async () => {
            // Arrange
            const client = createMessengerClient(validConfig);
            const messageData = createValidMessageData();

            // Act
            const response = await client.sendEmail(
                'user@example.com',
                'welcome',
                messageData,
            );

            // Assert
            expect(response.success).toBe(true);
            expect(response.messageId).toBeDefined();
        });
    });
});
```

### Gestion des erreurs dans les tests

```typescript
it('should handle validation errors gracefully', async () => {
    const invalidData = {
        /* données invalides */
    };

    await expect(client.sendMessage(invalidData)).rejects.toThrow(
        'Validation error',
    );

    // Ou pour les réponses d'erreur sans exception
    const response = await client.sendMessage(invalidData);
    expect(response.success).toBe(false);
    expect(response.error).toContain('validation');
});
```

## 🔄 CI/CD Integration

### GitHub Actions exemple

```yaml
- name: Run tests
  run: npm run test:ci

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
      file: ./coverage/lcov.info
```

### Scripts pré-commit

```bash
# Dans package.json
"scripts": {
    "precommit": "npm run lint && npm run test:ci"
}
```

## 📈 Évolution des tests

### Ajouter de nouveaux tests

1. Identifier le type de test nécessaire
2. Choisir le fichier approprié ou en créer un nouveau
3. Suivre les patterns existants
4. Vérifier la couverture de code
5. Documenter les cas edge particuliers

### Maintenance

- Réviser les tests lors des changements d'API
- Maintenir les mocks à jour avec les dépendances
- Surveiller les performances des tests
- Mettre à jour la documentation

Cette suite de tests garantit la robustesse et la fiabilité du MessengerClient dans tous les scénarios d'utilisation.
