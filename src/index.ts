import { apiBootstrap } from './api';
import { MessengerApp } from './app';
import pinoLogger from './logger';

async function bootstrap() {
    const app = MessengerApp.getInstance();

    try {
        await app.init();
        await app.start();
    } catch (err) {
        pinoLogger.fatal(err, 'Critical error during startup. Exiting...');
        process.exit(1);
    }

    const shutdownHandler = async () => {
        pinoLogger.warn('Shutting down gracefully...');
        await app.shutdown();
        process.exit(0);
    };

    process.on('SIGINT', shutdownHandler);
    process.on('SIGTERM', shutdownHandler);
}

// apiBootstrap();
bootstrap();
