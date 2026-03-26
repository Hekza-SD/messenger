import { QueueMessage } from '../entities/queue-message';
import { ApplicationService } from './application.service';
import { TemplateService } from './template.service';
import { contextLogger } from '../context';
import { bus } from '../bus';
import { EventNames } from '../bus/event-names';
import { Scenario } from '@prisma/client';
import prisma from '../../prisma';

export class ScenarioService {
    static async getById(id: number): Promise<Scenario | null> {
        return prisma.scenario.findUnique({ where: { id } });
    }

    static async getByScenarioId(scenarioId: string): Promise<Scenario | null> {
        return await prisma.scenario.findUnique({ where: { scenarioId } });
    }

    static async getTemplatesIdsByScenarioId(
        scenarioId: string,
    ): Promise<string[]> {
        return prisma.scenarioTemplate
            .findMany({ where: { scenarioId }, select: { templateId: true } })
            .then((results) => results.map((r) => r.templateId));
    }

    /**
     * Main entry point for executing a queued message
     */
    static async execute(message: QueueMessage): Promise<void> {
        bus.emit(EventNames.ScenarioBeforeExecute, {
            scenarioId: message.scenarioId,
            inputData: message,
        });
        const startTime = Date.now();

        contextLogger.info('Executing scenario for incoming message', {
            appId: message.applicationId,
            scenarioId: message.scenarioId,
        });

        const app = await ApplicationService.getByAppId(message.applicationId);
        if (!app) {
            throw new Error(`Unknown application: ${message.applicationId}`);
        }

        const templatesByScenarioId = await this.getTemplatesIdsByScenarioId(
            message.scenarioId,
        );

        for (const templateId of templatesByScenarioId) {
            try {
                await TemplateService.execute({
                    applicationId: app.appId,
                    templateId: templateId,
                    businessData: message.businessData,
                    to: message.to,
                    cc: message.cc,
                    bcc: message.bcc,
                    meta: message.meta,
                    subject: message.subject,
                    bodyOverride: message.bodyOverride,
                    tracking: message.tracking,
                });
            } catch (err) {
                contextLogger.error(
                    `Template execution failed for scenario ${message.scenarioId}`,
                    { err, templateId, scenarioId: message.scenarioId },
                );
            }
        }
        bus.emit(EventNames.ScenarioAfterExecute, {
            scenarioId: message.scenarioId,
            result: message,
            durationMs: Date.now() - startTime,
        });
    }
}
