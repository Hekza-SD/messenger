import { Queue } from 'bullmq';
import { RedisManager } from './redis-connection';

export class BullMQProducer {
    static async enqueue(data: any, queueId: string, topic: string) {
        const connection =
            await RedisManager.getInstance().getConnection(queueId);
        const queue = new Queue(topic, { connection });

        await queue.add('default', data);
        await queue.close();
    }
}
