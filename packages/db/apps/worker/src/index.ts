import Fastify from 'fastify';

const server = Fastify({
  logger: true
});

// A simple health check endpoint
server.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Webhook ingress path stub
server.post('/v1/webhooks/:esp', async (request, reply) => {
  const { esp } = request.params as { esp: string };
  // In production: Validate crypto signature, dump payload to BullMQ Redis Queue
  
  // Acknowledge immediately to avoid ESP timeouts
  return reply.status(200).send({ received: true });
});

const start = async () => {
  try {
    await server.listen({ port: 3001, host: '0.0.0.0' });
    console.log('Worker API Gateway running on port 3001');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
