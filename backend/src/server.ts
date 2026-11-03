import { createAppFromEnv } from './bootstrap';
import { loadEnv } from './env';

const env = loadEnv();
const app = await createAppFromEnv(env, { logger: true });
await app.listen({ port: env.PORT, host: '0.0.0.0' });
