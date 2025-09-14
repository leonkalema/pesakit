import { v4 as uuidv4 } from 'uuid';

// Simple logger that works in both Node.js and browser environments
const createSimpleLogger = (options = {}) => {
  const level = options.level || 'info';
  const service = options.service || 'pesakit';
  
  const levels = { trace: 0, debug: 1, info: 2, warn: 3, error: 4, fatal: 5 };
  const currentLevel = levels[level] || 2;
  
  const log = (logLevel, message, meta = {}) => {
    if (levels[logLevel] >= currentLevel) {
      const timestamp = new Date().toISOString();
      const logData = {
        timestamp,
        level: logLevel,
        service,
        message,
        ...meta
      };
      
      if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'test') {
        console[logLevel === 'fatal' ? 'error' : logLevel](JSON.stringify(logData));
      }
    }
  };
  
  return {
    trace: (msg, meta) => log('trace', msg, meta),
    debug: (msg, meta) => log('debug', msg, meta),
    info: (msg, meta) => log('info', msg, meta),
    warn: (msg, meta) => log('warn', msg, meta),
    error: (msg, meta) => log('error', msg, meta),
    fatal: (msg, meta) => log('fatal', msg, meta)
  };
};

/**
 * Production-ready structured logger with correlation IDs
 */
class Logger {
  constructor(options = {}) {
    const {
      level = (typeof process !== 'undefined' ? process.env?.LOG_LEVEL : undefined) || 'info',
      service = 'pesakit',
      version = '2.0.0',
      environment = (typeof process !== 'undefined' ? process.env?.NODE_ENV : undefined) || 'development'
    } = options;

    this.logger = createSimpleLogger({
      level,
      service,
      version,
      environment
    });

    this.correlationId = uuidv4();
  }

  createCorrelationId() {
    this.correlationId = uuidv4();
    return this.correlationId;
  }

  setCorrelationId(id) {
    this.correlationId = id;
  }

  getCorrelationId() {
    return this.correlationId;
  }

  child(_bindings = {}) {
    const childLogger = new Logger();
    childLogger.correlationId = this.correlationId;
    return childLogger;
  }

  info(message, meta = {}) {
    this.logger.info(message, {
      ...meta,
      correlationId: this.correlationId
    });
  }

  error(message, error = null, meta = {}) {
    this.logger.error(message, {
      ...meta,
      err: error,
      correlationId: this.correlationId
    });
  }

  warn(message, meta = {}) {
    this.logger.warn(message, {
      ...meta,
      correlationId: this.correlationId
    });
  }

  debug(message, meta = {}) {
    this.logger.debug(message, {
      ...meta,
      correlationId: this.correlationId
    });
  }

  trace(message, meta = {}) {
    this.logger.trace(message, {
      ...meta,
      correlationId: this.correlationId
    });
  }

  // Performance logging
  time(label) {
    const start = typeof process !== 'undefined' && process.hrtime ? process.hrtime.bigint() : Date.now();
    return {
      end: (meta = {}) => {
        const duration = typeof process !== 'undefined' && process.hrtime ? 
          Number(process.hrtime.bigint() - start) / 1000000 : 
          Date.now() - start;
        this.info(`${label} completed`, {
          ...meta,
          duration,
          correlationId: this.correlationId
        });
        return duration;
      }
    };
  }

  // Security event logging
  security(event, meta = {}) {
    this.warn(`Security event: ${event}`, {
      ...meta,
      security: true,
      correlationId: this.correlationId
    });
  }

  // Audit logging
  audit(action, meta = {}) {
    this.info(`Audit: ${action}`, {
      ...meta,
      audit: true,
      correlationId: this.correlationId
    });
  }
}

export default Logger;
