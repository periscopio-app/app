import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const notificationsQueue = new Queue("notifications", { connection });

export function startNotificationsWorker(
  handler: (job: Job) => Promise<void>,
) {
  return new Worker("notifications", handler, { connection });
}
