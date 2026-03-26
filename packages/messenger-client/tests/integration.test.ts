/**
 * Tests d'intégration pour le MessengerClient
 * Ces tests simulent des scénarios réels d'utilisation
 */

import { MessengerClient, createMessengerClient, MessengerUtils } from '../src';
import type { MessengerEvent } from '../src/types';

// Mock des dépendances pour les tests d'intégration
jest.mock('../src/queue-manager');

describe("Tests d'intégration MessengerClient", () => {
    let client: MessengerClient;
    let eventLog: MessengerEvent[];

    beforeEach(() => {
        eventLog = [];

        // Configuration réaliste pour les tests
        client = createMessengerClient({
            defaults: {
                queueId: 'integration-test-queue',
                topic: 'default',
                applicationId: 'integration-test-app',
                meta: { priority: 'normal', locale: 'fr' },
                delivery: { channels: ['email'] },
            },
            redis: { connectionTimeout: 5000, retries: 3 },
        });

        // Capture des événements pour vérification
        client.on('message-queued', (event) => eventLog.push(event));
        client.on('message-failed', (event) => eventLog.push(event));
        client.on('message-sent', (event) => eventLog.push(event));
        client.on('connection-error', (event) => eventLog.push(event));
    });

    afterEach(async () => {
        await client.close();
        eventLog = [];
    });

    describe('Scénarios E-commerce', () => {
        it('should handle complete order confirmation workflow', async () => {
            // Simulation d'un workflow complet de confirmation de commande
            const orderData = {
                orderNumber: 'ORD-2024-001',
                customerName: 'Marie Dubois',
                customerEmail: 'marie.dubois@example.com',
                items: [
                    { name: 'T-shirt Premium', quantity: 2, price: 29.99 },
                    { name: 'Jean Slim Fit', quantity: 1, price: 89.99 },
                ],
                total: 149.97,
                currency: 'EUR',
                shippingAddress: {
                    street: '123 Rue de la Paix',
                    city: 'Paris',
                    postalCode: '75001',
                    country: 'France',
                },
                estimatedDelivery: '2024-12-20',
            };

            // 1. Email de confirmation immédiat
            const confirmationResponse = await client
                .createMessage()
                .forApplication('ecommerce-shop')
                .withScenario('order-confirmation')
                .to(orderData.customerEmail)
                .cc('orders@shop.com')
                .withSubject(
                    `Confirmation de votre commande ${orderData.orderNumber}`,
                )
                .withBusinessData(orderData)
                .viaEmail()
                .inLocale('fr')
                .withTags('ecommerce', 'order', 'confirmation')
                .withCorrelationId(`order-${orderData.orderNumber}`)
                .withCallback('https://shop.com/webhooks/email-status')
                .withPriority('high')
                .send();

            expect(confirmationResponse.success).toBe(true);
            expect(confirmationResponse.messageId).toBeDefined();

            // 2. SMS de confirmation (si numéro fourni)
            if (orderData.customerEmail) {
                const smsResponse = await client.sendSMS(
                    '+33612345678',
                    'order-confirmation-sms',
                    {
                        orderNumber: orderData.orderNumber,
                        total: orderData.total,
                        currency: orderData.currency,
                    },
                    { topic: 'order-sms', priority: 'normal' },
                );

                expect(smsResponse.success).toBe(true);
            }

            // 3. Email de suivi programmé pour J+1
            const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
            const trackingResponse = await client.scheduleMessage(
                {
                    to: [orderData.customerEmail],
                    scenarioId: 'order-tracking-info',
                    businessData: {
                        orderNumber: orderData.orderNumber,
                        trackingUrl: `https://shop.com/track/${orderData.orderNumber}`,
                        estimatedDelivery: orderData.estimatedDelivery,
                    },
                    correlationId: `order-${orderData.orderNumber}-tracking`,
                },
                tomorrow,
                { topic: 'order-tracking' },
            );

            expect(trackingResponse.success).toBe(true);

            // Vérifier les événements générés
            expect(
                eventLog.filter((e) => e.type === 'message-queued'),
            ).toHaveLength(3);
            expect(eventLog.every((e) => e.type === 'message-queued')).toBe(
                true,
            );
        });

        it('should handle abandoned cart reminder sequence', async () => {
            const cartData = {
                customerId: 'cust-789',
                customerEmail: 'john.doe@example.com',
                cartId: 'cart-456',
                items: [
                    {
                        name: 'Sneakers Running',
                        price: 119.99,
                        imageUrl: 'https://shop.com/img/sneakers.jpg',
                    },
                ],
                cartTotal: 119.99,
                cartUrl: 'https://shop.com/cart/cart-456',
                promoCode: 'COMEBACK10',
            };

            // Séquence de rappels de panier abandonné
            const reminderSequence = [
                {
                    delay: 60 * 60 * 1000,
                    scenario: 'cart-reminder-1h',
                    priority: 'normal' as const,
                }, // 1h
                {
                    delay: 24 * 60 * 60 * 1000,
                    scenario: 'cart-reminder-24h',
                    priority: 'normal' as const,
                }, // 24h
                {
                    delay: 72 * 60 * 60 * 1000,
                    scenario: 'cart-reminder-72h',
                    priority: 'low' as const,
                }, // 72h
            ];

            const responses = [];

            for (const reminder of reminderSequence) {
                const response = await client
                    .createMessage()
                    .withScenario(reminder.scenario)
                    .to(cartData.customerEmail)
                    .withBusinessData(cartData)
                    .viaEmail()
                    .withTags('ecommerce', 'cart-abandonment', 'reminder')
                    .withCorrelationId(`cart-${cartData.cartId}-reminder`)
                    .scheduleIn(reminder.delay)
                    .withPriority(reminder.priority)
                    .send();

                responses.push(response);
            }

            // Vérifier que tous les rappels sont programmés
            expect(responses.every((r) => r.success)).toBe(true);
            expect(responses).toHaveLength(3);
        });
    });

    describe('Scénarios SaaS/Application métier', () => {
        it('should handle user onboarding workflow', async () => {
            const userData = {
                userId: 'user-123',
                email: 'newuser@company.com',
                firstName: 'Alice',
                lastName: 'Martin',
                company: 'TechCorp',
                accountType: 'premium',
                activationToken: 'token-abc123',
                trialEndDate: '2024-12-31',
            };

            // 1. Email de bienvenue immédiat
            const welcomeResponse = await client.sendEmail(
                userData.email,
                'user-welcome',
                {
                    firstName: userData.firstName,
                    company: userData.company,
                    activationUrl: `https://app.com/activate/${userData.activationToken}`,
                    accountType: userData.accountType,
                },
                { topic: 'user-onboarding', priority: 'high' },
            );

            expect(welcomeResponse.success).toBe(true);

            // 2. Email d'aide à la configuration (J+1)
            const setupHelpResponse = await client
                .createMessage()
                .withScenario('setup-help')
                .to(userData.email)
                .withBusinessData({
                    firstName: userData.firstName,
                    setupGuideUrl: 'https://app.com/setup-guide',
                    supportUrl: 'https://app.com/support',
                })
                .viaEmail()
                .withTags('onboarding', 'setup', 'help')
                .scheduleIn(24 * 60 * 60 * 1000)
                .send();

            expect(setupHelpResponse.success).toBe(true);

            // 3. Rappel de fin d'essai (3 jours avant)
            const trialEndDate = new Date('2024-12-31');
            const reminderDate = new Date(
                trialEndDate.getTime() - 3 * 24 * 60 * 60 * 1000,
            );

            const trialReminderResponse = await client.scheduleMessage(
                {
                    to: [userData.email],
                    scenarioId: 'trial-ending-reminder',
                    businessData: {
                        firstName: userData.firstName,
                        trialEndDate: userData.trialEndDate,
                        upgradeUrl: 'https://app.com/upgrade',
                    },
                    tags: ['trial', 'reminder', 'upgrade'],
                },
                reminderDate,
            );

            expect(trialReminderResponse.success).toBe(true);
        });

        it('should handle team collaboration notifications', async () => {
            const projectData = {
                projectId: 'proj-456',
                projectName: 'Nouveau Site Web',
                teamMembers: [
                    {
                        email: 'dev1@company.com',
                        role: 'Developer',
                        name: 'Bob',
                    },
                    {
                        email: 'dev2@company.com',
                        role: 'Designer',
                        name: 'Carol',
                    },
                    {
                        email: 'manager@company.com',
                        role: 'Manager',
                        name: 'David',
                    },
                ],
                deadline: '2024-12-15',
                priority: 'High',
                description: 'Développement interface utilisateur moderne',
            };

            const teamEmails = projectData.teamMembers.map(
                (member) => member.email,
            );

            // Notification d'assignation de projet
            const assignmentResponse = await client
                .createMessage()
                .withScenario('project-assignment')
                .to(...teamEmails)
                .cc('all-projects@company.com')
                .withBusinessData(projectData)
                .viaEmail()
                .withTags('project', 'assignment', 'team')
                .withCorrelationId(`project-${projectData.projectId}`)
                .withPriority('high')
                .send();

            expect(assignmentResponse.success).toBe(true);

            // Notifications individualisées par rôle
            for (const member of projectData.teamMembers) {
                const personalizedResponse = await client.sendEmail(
                    member.email,
                    'personalized-project-info',
                    {
                        ...projectData,
                        memberName: member.name,
                        memberRole: member.role,
                        roleSpecificTasks: `Tâches spécifiques pour ${member.role}`,
                    },
                    { topic: 'personalized-notifications', priority: 'normal' },
                );

                expect(personalizedResponse.success).toBe(true);
            }

            // Rappel de deadline programmé
            const deadlineDate = new Date('2024-12-15');
            const reminderDate = new Date(
                deadlineDate.getTime() - 7 * 24 * 60 * 60 * 1000,
            ); // 7 jours avant

            const deadlineReminderResponse = await client.scheduleMessage(
                {
                    to: teamEmails,
                    scenarioId: 'project-deadline-reminder',
                    businessData: {
                        projectName: projectData.projectName,
                        deadline: projectData.deadline,
                        daysRemaining: 7,
                    },
                },
                reminderDate,
            );

            expect(deadlineReminderResponse.success).toBe(true);
        });
    });

    describe('Scénarios Healthcare/Services', () => {
        it('should handle appointment reminder sequence', async () => {
            const appointmentData = {
                patientId: 'pat-789',
                patientName: 'Jean Martin',
                patientEmail: 'jean.martin@email.com',
                patientPhone: '+33612345678',
                doctorName: 'Dr. Sophie Dubois',
                appointmentDate: '2024-12-15',
                appointmentTime: '14:30',
                appointmentType: 'Consultation générale',
                clinicName: 'Centre Médical Central',
                clinicAddress: '456 Avenue de la Santé, 75015 Paris',
                clinicPhone: '01.23.45.67.89',
            };

            // Email de confirmation immédiat
            const confirmationResponse = await client.sendEmail(
                appointmentData.patientEmail,
                'appointment-confirmation',
                appointmentData,
                { topic: 'medical-appointments', priority: 'high' },
            );

            expect(confirmationResponse.success).toBe(true);

            // Rappel email 24h avant
            const email24hBefore = new Date('2024-12-14T14:30:00Z');
            const emailReminderResponse = await client.scheduleMessage(
                {
                    to: [appointmentData.patientEmail],
                    scenarioId: 'appointment-reminder-email',
                    businessData: appointmentData,
                },
                email24hBefore,
            );

            expect(emailReminderResponse.success).toBe(true);

            // Rappel SMS 2h avant
            const sms2hBefore = new Date('2024-12-15T12:30:00Z');
            const smsReminderResponse = await client.scheduleMessage(
                {
                    to: [appointmentData.patientPhone],
                    scenarioId: 'appointment-reminder-sms',
                    businessData: {
                        patientName: appointmentData.patientName,
                        doctorName: appointmentData.doctorName,
                        time: appointmentData.appointmentTime,
                        clinicPhone: appointmentData.clinicPhone,
                    },
                    channels: ['sms'],
                },
                sms2hBefore,
            );

            expect(smsReminderResponse.success).toBe(true);

            // Email de suivi post-consultation programmé
            const followUpDate = new Date('2024-12-16T09:00:00Z');
            const followUpResponse = await client.scheduleMessage(
                {
                    to: [appointmentData.patientEmail],
                    scenarioId: 'post-consultation-follow-up',
                    businessData: {
                        patientName: appointmentData.patientName,
                        doctorName: appointmentData.doctorName,
                        satisfactionSurveyUrl: 'https://clinic.com/survey/123',
                    },
                },
                followUpDate,
            );

            expect(followUpResponse.success).toBe(true);
        });
    });

    describe('Gestion des erreurs en conditions réelles', () => {
        it('should handle partial failures in batch operations', async () => {
            const recipients = [
                'valid1@example.com',
                'valid2@example.com',
                'invalid-email', // Email invalide
                'valid3@example.com',
            ];

            const results = [];

            // Traitement batch avec gestion d'erreurs individuelle
            for (const recipient of recipients) {
                try {
                    const response = await client.sendEmail(
                        recipient,
                        'newsletter',
                        {
                            recipientEmail: recipient,
                            newsletterEdition: 'Week 42',
                            unsubscribeUrl: `https://app.com/unsubscribe/${recipient}`,
                        },
                    );

                    results.push({
                        recipient,
                        success: response.success,
                        messageId: response.messageId,
                    });
                } catch (error) {
                    results.push({
                        recipient,
                        success: false,
                        error:
                            error instanceof Error
                                ? error.message
                                : 'Unknown error',
                    });
                }
            }

            // Vérifier que les emails valides sont traités
            const successfulSends = results.filter((r) => r.success);
            const failedSends = results.filter((r) => !r.success);

            expect(successfulSends).toHaveLength(3); // 3 emails valides
            expect(failedSends).toHaveLength(1); // 1 email invalide
            expect(failedSends[0].recipient).toBe('invalid-email');
        });

        it('should handle connection recovery scenarios', async () => {
            // Simuler une erreur de connexion puis récupération
            let attemptCount = 0;

            // Mock pour simuler une panne temporaire
            jest.spyOn(client, 'sendMessage').mockImplementation(
                async (messageData, options) => {
                    attemptCount++;
                    if (attemptCount <= 2) {
                        // Simuler une erreur de connexion pour les 2 premiers appels
                        return { success: false, error: 'Connection timeout' };
                    }
                    // Récupération au 3ème appel
                    return {
                        success: true,
                        messageId: `recovery-msg-${attemptCount}`,
                    };
                },
            );

            const messageData = {
                to: ['recovery-test@example.com'],
                scenarioId: 'connection-recovery-test',
                businessData: { test: 'recovery scenario' },
            };

            // Première tentative - échec
            const attempt1 = await client.sendMessage(messageData);
            expect(attempt1.success).toBe(false);

            // Deuxième tentative - échec
            const attempt2 = await client.sendMessage(messageData);
            expect(attempt2.success).toBe(false);

            // Troisième tentative - succès
            const attempt3 = await client.sendMessage(messageData);
            expect(attempt3.success).toBe(true);

            expect(attemptCount).toBe(3);
        });
    });

    describe('Performance et monitoring', () => {
        it('should handle high-volume messaging efficiently', async () => {
            const startTime = Date.now();
            const messageCount = 100;
            const promises = [];

            // Envoi en parallèle de nombreux messages
            for (let i = 0; i < messageCount; i++) {
                const promise = client.sendEmail(
                    `user${i}@example.com`,
                    'bulk-newsletter',
                    {
                        userIndex: i,
                        personalizedContent: `Content for user ${i}`,
                        campaignId: 'bulk-campaign-001',
                    },
                    { topic: 'bulk-emails', priority: 'low' },
                );
                promises.push(promise);
            }

            const results = await Promise.all(promises);
            const endTime = Date.now();
            const processingTime = endTime - startTime;

            // Vérifications de performance
            expect(results).toHaveLength(messageCount);
            expect(results.every((r) => r.success)).toBe(true);
            expect(processingTime).toBeLessThan(10000); // Moins de 10 secondes

            // Vérifier les événements générés
            const queuedEvents = eventLog.filter(
                (e) => e.type === 'message-queued',
            );
            expect(queuedEvents).toHaveLength(messageCount);
        });

        it('should properly track correlation IDs across related messages', async () => {
            const correlationId = 'workflow-test-123';
            const workflowMessages = [
                { scenario: 'workflow-start', delay: 0 },
                { scenario: 'workflow-step1', delay: 1000 },
                { scenario: 'workflow-step2', delay: 2000 },
                { scenario: 'workflow-complete', delay: 3000 },
            ];

            const responses = [];

            for (const [index, message] of workflowMessages.entries()) {
                const response = await client
                    .createMessage()
                    .withScenario(message.scenario)
                    .to('workflow-user@example.com')
                    .withBusinessData({
                        workflowId: correlationId,
                        stepNumber: index + 1,
                        totalSteps: workflowMessages.length,
                    })
                    .withCorrelationId(correlationId)
                    .withTags('workflow', `step-${index + 1}`)
                    .scheduleIn(message.delay)
                    .send();

                responses.push(response);
            }

            // Vérifier que tous les messages du workflow sont liés
            expect(responses.every((r) => r.success)).toBe(true);

            // Vérifier que les événements contiennent le correlation ID
            const workflowEvents = eventLog.filter(
                (e) => e.data && e.data.correlationId === correlationId,
            );
            expect(workflowEvents).toHaveLength(workflowMessages.length);
        });
    });
});
