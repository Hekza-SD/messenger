module.exports = {
    // Configuration héritée de jest.config.js
    ...require('./jest.config.js'),
    
    // Configurations spécifiques pour CI
    ci: true,
    watchAll: false,
    bail: true, // Arrêter à la première erreur
    forceExit: true, // Forcer la sortie après les tests
    detectOpenHandles: true, // Détecter les handles ouverts
    
    // Rapports pour CI
    reporters: [
        'default',
        ['jest-junit', {
            outputDirectory: 'test-results',
            outputName: 'junit.xml',
            ancestorSeparator: ' › ',
            uniqueOutputName: 'false',
            suiteNameTemplate: '{filepath}',
            classNameTemplate: '{classname}',
            titleTemplate: '{title}'
        }]
    ],
    
    // Couverture pour CI
    collectCoverage: true,
    coverageReporters: ['text', 'lcov', 'json'],
    coverageDirectory: 'coverage',
    
    // Timeout plus court pour CI
    testTimeout: 8000
};