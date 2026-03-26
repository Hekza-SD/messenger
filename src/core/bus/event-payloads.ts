import { ProviderChannelResult } from '../../providers/abstract-provider';
import { EventNames } from './event-names';

export type EventPayloads = {
    /** -------------------- WORKER -------------------- */
    [EventNames.WorkerDisconnected]: { workerId: string };

    [EventNames.WorkerMessageReceived]: {
        workerId: string;
        workerClass: string;
        message: any;
    };
    [EventNames.WorkerConnected]: {
        workerConfig: Record<string, any>;
        workerId: string;
    };
    [EventNames.WorkerSubscribed]: {
        workerConfig: Record<string, any>;
        workerId: string;
    };
    [EventNames.WorkerMessageProcessed]: {
        workerId: string;
        durationMs: number;
    };

    /** -------------------- SCENARIO -------------------- */
    [EventNames.ScenarioBeforeExecute]: { scenarioId: string; inputData: any };
    [EventNames.ScenarioAfterExecute]: {
        scenarioId: string;
        durationMs: number;
        result: any;
    };

    /** -------------------- TEMPLATE -------------------- */

    [EventNames.TemplateBeforeExecute]: { templateId: string; data: any };
    [EventNames.TemplateAfterExecute]: { templateId: string; result: any };
    [EventNames.TemplateBeforeTransform]: { templateId: string; data: any };
    [EventNames.TemplateAfterTransform]: {
        templateId: string;
        transformedData: any;
        durationMs: number;
    };
    [EventNames.TemplateError]: { templateId: string; error: Error };
    [EventNames.TemplateBeforeRender]: { templateId: string; context: any };
    [EventNames.TemplateAfterRender]: {
        templateId: string;
        rendered: { subject: string; body: string };
        durationMs: number;
        context: any;
    };
    [EventNames.TemplateRenderError]: { templateId: string; error: Error };

    /** -------------------- PROVIDER -------------------- */
    [EventNames.ProviderSendStart]: { providerId: string; payload: any };
    [EventNames.ProviderSendEnd]: { providerId: string; results: any[] };
    [EventNames.ProviderBeforeSend]: { providerId: string; payload: any };
    [EventNames.ProviderAfterSend]: {
        providerId: string;
        response: ProviderChannelResult;
    };
    [EventNames.ProviderError]: { providerId: string; error: Error };

    /** -------------------- SYSTEM -------------------- */
    [EventNames.SystemError]: { error: Error };
};
