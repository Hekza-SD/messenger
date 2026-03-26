import { WorkerConfig } from '@prisma/client';
import { BaseWorker } from './base-worker';
import { GenericBullWorker } from './generic-bullmq-worker';

export class WorkerFactory {
    private static registry = new Map<
        string,
        new (config: WorkerConfig) => BaseWorker
    >([['generic-bull-worker', GenericBullWorker]]);

    static create(config: WorkerConfig): BaseWorker {
        const WorkerClass = this.registry.get(config.workerImplId);

        if (!WorkerClass) {
            throw new Error(`Unknown worker implementation: ${config.workerImplId}`);
        }

        return new WorkerClass(config);
    }
}
