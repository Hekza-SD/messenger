/**
 * Configuration globale des tests
 */

// Mock global pour console pendant les tests
const originalConsole = global.console;

beforeEach(() => {
    // Réinitialiser les mocks avant chaque test
    jest.clearAllMocks();
});

afterEach(() => {
    // Nettoyer après chaque test
    global.console = originalConsole;
});

// Helpers globaux pour les tests
(global as any).testHelpers = {
    /**
     * Créer des données de message valides pour les tests
     */
    createValidMessageData: (overrides = {}) => ({
        scenarioId: 'test-scenario',
        to: ['test@example.com'],
        businessData: { testField: 'testValue' },
        ...overrides,
    }),

    /**
     * Créer une configuration de client valide pour les tests
     */
    createValidClientConfig: (overrides = {}) => ({
        defaults: {
            queueId: 'test-queue',
            applicationId: 'test-app',
            topic: 'test-topic',
        },
        ...overrides,
    }),

    /**
     * Mock d'une réponse Redis réussie
     */
    mockRedisSuccess: () => ({
        add: jest.fn().mockResolvedValue({ id: 'job-123' }),
        close: jest.fn().mockResolvedValue(undefined),
        quit: jest.fn().mockResolvedValue(undefined),
    }),

    /**
     * Attendre que tous les timers et promises soient résolus
     */
    flushPromises: () => new Promise((resolve) => setImmediate(resolve)),
};

export {};
