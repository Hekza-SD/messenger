import { bus } from './core/bus';
import { LoggerPlugin } from './core/plugins/logger-plugin';
import { MetricsPlugin } from './core/plugins/metrics-plugin';
import { PluginManager } from './core/plugins/plugin-manager';
import { ProviderService } from './core/services/provider.service';
import { WorkerService } from './core/services/worker.service';
import { RedisManager } from './core/queues/redis-connection';
import pinoLogger from './logger';
import prisma from './prisma';

export class MessengerApp {
    private static instance: MessengerApp;
    private pluginManager: PluginManager;

    public static getInstance(): MessengerApp {
        if (!MessengerApp.instance) {
            MessengerApp.instance = new MessengerApp();
        }
        return MessengerApp.instance;
    }

    private constructor() {
        this.pluginManager = new PluginManager(bus);
        this.registerPlugins();
    }

    private registerPlugins() {
        this.pluginManager.register(LoggerPlugin);
        this.pluginManager.register(MetricsPlugin);
    }

    async init() {
        await ProviderService.init();
        await WorkerService.init();
    }

    async start() {
        pinoLogger.info('[BOOT] Messenger up and running.');
    }

    async shutdown() {
        await WorkerService.disconnectAll();
        RedisManager.getInstance().closeAll();
        await prisma.$disconnect();
    }
}
