import { WorkerConfig } from '@prisma/client';
import prisma from '../../prisma';
import { BaseWorker } from '../../workers/base-worker';
import { WorkerFactory } from '../../workers/worker-factory';

export class WorkerService {
    private static workers = new Map<string, BaseWorker>();

    static async getAll(): Promise<WorkerConfig[]> {
        return prisma.workerConfig.findMany();
    }

    /**
     * This method should be called once at application startup.
     * Initializes all workers based on the configuration and validates their supported channels.
     *
     * @throws Will throw an error if any worker declares unsupported types.
     *
     */
    static async init() {
        for (const config of await this.getAll()) {
            const instance: BaseWorker = WorkerFactory.create(config);
            await instance.connect();
            await instance.subscribe();

            this.workers.set(config.workerConfigId, instance);
        }
    }

    static getCachedWorkerInstance(workerConfigId: string): BaseWorker {
        const worker = this.workers.get(workerConfigId);
        if (!worker) throw new Error(`Worker ${workerConfigId} not found`);
        return worker;
    }

    static async disconnectAll() {
        for (const worker of this.workers.values()) {
            await worker.disconnect();
        }
    }
}
