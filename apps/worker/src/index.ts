import Fastify from 'fastify';
import { webhookQueue } from './queue/bullmq.config';
import './queue/webhook.worker'; // Initializes the polling worker instance

const server = Fastify({ logger: true });

server.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

server.post('/v1/webhooks/:esp', async (request, reply) => {
  const { esp } = request.params as { esp: string };
  
  // High-performance asynchronous push to Redis queue
  await webhookQueue.add('process-webhook', {
    esp,
    rawPayload: request.body
  });
  
  // Return immediately to the ESP hitting this webhook to avoid latency penalties
  return reply.status(200).send({ received: true });
});

const start = async () => {
  try {
    await server.listen({ port: 3001, host: '0.0.0.0' });
    console.log('InboxShield Data Plane Gateway running on port 3001');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
