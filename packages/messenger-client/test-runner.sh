#!/bin/bash

echo "🧪 Exécution de la suite de tests MessengerClient"
echo "================================================"

# Vérification des prérequis
echo "📋 Vérification de l'environnement..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ NPM n'est pas installé"
    exit 1
fi

echo "✅ Environnement OK"
echo ""

# Installation des dépendances si nécessaire
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install
    echo ""
fi

# Vérification TypeScript
echo "🔍 Vérification TypeScript..."
npm run lint
if [ $? -ne 0 ]; then
    echo "❌ Erreurs de compilation TypeScript"
    exit 1
fi
echo "✅ TypeScript OK"
echo ""

# Tests unitaires
echo "🧪 Exécution des tests unitaires..."
npm run test:unit
if [ $? -ne 0 ]; then
    echo "❌ Tests unitaires échoués"
    exit 1
fi
echo "✅ Tests unitaires OK"
echo ""

# Tests d'intégration
echo "🔗 Exécution des tests d'intégration..."
npm run test:integration
if [ $? -ne 0 ]; then
    echo "❌ Tests d'intégration échoués"
    exit 1
fi
echo "✅ Tests d'intégration OK"
echo ""

# Rapport de couverture
echo "📊 Génération du rapport de couverture..."
npm run test:coverage
echo ""

echo "🎉 Tous les tests sont passés avec succès !"
echo ""
echo "📊 Résultats:"
echo "  - TypeScript: ✅"
echo "  - Tests unitaires: ✅"
echo "  - Tests d'intégration: ✅" 
echo "  - Couverture de code: Voir coverage/lcov-report/index.html"
echo ""
echo "💡 Commandes utiles:"
echo "  npm test              # Tous les tests"
echo "  npm run test:watch    # Tests en mode watch"
echo "  npm run test:ci       # Tests pour CI/CD"