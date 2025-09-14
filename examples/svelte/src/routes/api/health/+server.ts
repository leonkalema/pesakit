import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Pesakit from 'pesakit';

const pesakit = new Pesakit({
  consumerKey: 'K6KoQabQeQkK5ZrPM67cbujFwhgrB6r1',
  consumerSecret: 'qgQnnnPF5fSqrJNEIDJOEoAuHTI=',
  environment: 'sandbox',
  timeout: 30000,
  retries: 3,
  enableLogging: false,
  logLevel: 'error'
});

export const GET: RequestHandler = async () => {
  try {
    const health = await pesakit.getHealthStatus();
    
    return json({
      ...health,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  } catch (error) {
    return json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Health check failed'
    }, { status: 503 });
  }
};
