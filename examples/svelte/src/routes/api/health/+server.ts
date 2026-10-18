import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pesakit } from '$lib/server/pesakit';

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
