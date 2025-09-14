const pino = require('pino');
const { v4: uuidv4 } = require('uuid');

/**
 * Production-ready structured logger with correlation IDs
 */
class Logger {
  constructor(options = {}) {
    const {
      level = process.env.LOG_LEVEL || 'info',
      service = 'pesakit',
      version = require('../package.json').version,
      environment = process.env.NODE_ENV || 'development'
    } = options;

    this.logger = pino({
      name: service,
      level,
      formatters: {
        level: (label) => ({ level: label }),
        bindings: () => ({
          service,
          version,
          environment,
          pid: process.pid,
          hostname: require('os').hostname()
        })
      },
      serializers: {
        err: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      redact: {
        paths: [
          'consumerKey',
          'consumerSecret',
          'token',
          'authorization',
          'password',
          'secret'
        ],
        censor: '[REDACTED]'
      }
    });

    this.correlationId = null;
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

  child(bindings = {}) {
    const childLogger = new Logger();
    childLogger.logger = this.logger.child({
      ...bindings,
      correlationId: this.correlationId
    });
    childLogger.correlationId = this.correlationId;
    return childLogger;
  }

  info(message, meta = {}) {
    this.logger.info({
      ...meta,
      correlationId: this.correlationId
    }, message);
  }

  error(message, error = null, meta = {}) {
    this.logger.error({
      ...meta,
      err: error,
      correlationId: this.correlationId
    }, message);
  }

  warn(message, meta = {}) {
    this.logger.warn({
      ...meta,
      correlationId: this.correlationId
    }, message);
  }

  debug(message, meta = {}) {
    this.logger.debug({
      ...meta,
      correlationId: this.correlationId
    }, message);
  }

  trace(message, meta = {}) {
    this.logger.trace({
      ...meta,
      correlationId: this.correlationId
    }, message);
  }

  // Performance logging
  time(label) {
    const start = process.hrtime.bigint();
    return {
      end: (meta = {}) => {
        const duration = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
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

module.exports = Logger;
