import Joi from 'joi';
import { ValidationError } from '../lib/errors.js';

/**
 * Comprehensive validation schemas for all Pesakit operations
 */

const configSchema = Joi.object({
  consumerKey: Joi.string().required().min(10).max(200),
  consumerSecret: Joi.string().required().min(10).max(200),
  environment: Joi.string().valid('sandbox', 'production').default('sandbox'),
  timeout: Joi.number().integer().min(1000).max(60000).default(30000),
  retries: Joi.number().integer().min(0).max(10).default(3),
  enableLogging: Joi.boolean().default(true),
  logLevel: Joi.string().valid('trace', 'debug', 'info', 'warn', 'error').default('info')
});

const paymentDataSchema = Joi.object({
  amount: Joi.number().positive().precision(2).required()
    .min(1)
    .max(1000000)
    .messages({
      'number.positive': 'Amount must be a positive number',
      'number.min': 'Amount must be at least 1',
      'number.max': 'Amount cannot exceed 1,000,000'
    }),
  
  description: Joi.string().required().min(1).max(500)
    .pattern(/^[a-zA-Z0-9\s\-_.,!@#$%^&*()]+$/)
    .messages({
      'string.pattern.base': 'Description contains invalid characters'
    }),
  
  reference: Joi.string().required().min(1).max(100)
    .pattern(/^[a-zA-Z0-9\-_]+$/)
    .messages({
      'string.pattern.base': 'Reference must contain only alphanumeric characters, hyphens, and underscores'
    }),
  
  email: Joi.string().email().required()
    .max(254)
    .messages({
      'string.email': 'Please provide a valid email address'
    }),
  
  callbackUrl: Joi.string().uri({ scheme: ['http', 'https'] }).required()
    .max(2048)
    .messages({
      'string.uri': 'Callback URL must be a valid HTTP/HTTPS URL'
    }),
  
  currency: Joi.string().valid('KES', 'UGX', 'TZS', 'RWF', 'MWK', 'ZMW', 'ZWL', 'USD').default('KES'),

  // PesaPal API: one of these is required by downstream logic. We allow both here; business logic decides which to use
  notificationId: Joi.string()
    .guid({ version: ['uuidv4', 'uuidv5'] })
    .optional(),
  ipnUrl: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .optional(),
  
  firstName: Joi.string().min(1).max(50).optional()
    .pattern(/^[a-zA-Z\s\-']+$/),
  
  lastName: Joi.string().min(1).max(50).optional()
    .pattern(/^[a-zA-Z\s\-']+$/),
  
  phoneNumber: Joi.string().optional()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .messages({
      'string.pattern.base': 'Phone number must be in international format'
    }),
  
  billingAddress: Joi.object({
    line1: Joi.string().max(100),
    line2: Joi.string().max(100),
    city: Joi.string().max(50),
    state: Joi.string().max(50),
    postalCode: Joi.string().max(20),
    countryCode: Joi.string().length(2).uppercase()
  }).optional()
});

const orderTrackingIdSchema = Joi.string().required()
  .min(1)
  .max(100)
  .pattern(/^[a-zA-Z0-9\-_]+$/)
  .messages({
    'string.pattern.base': 'Order tracking ID contains invalid characters'
  });

const ipnDataSchema = Joi.object({
  orderTrackingId: orderTrackingIdSchema,
  status: Joi.string().required()
    .valid('PENDING', 'COMPLETED', 'FAILED', 'INVALID', 'REVERSED'),
  merchantReference: Joi.string().max(100),
  amount: Joi.number().positive().precision(2),
  currency: Joi.string().length(3).uppercase(),
  paymentMethod: Joi.string().max(50),
  paymentAccount: Joi.string().max(100),
  timestamp: Joi.date().iso()
});

const signatureValidationSchema = Joi.object({
  signature: Joi.string().required().min(1),
  payload: Joi.string().required(),
  secret: Joi.string().required().min(1)
});

/**
 * Validation helper functions
 */
const validateConfig = (config) => {
  const { error, value } = configSchema.validate(config, { 
    abortEarly: false,
    stripUnknown: true 
  });
  
  if (error) {
    const details = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    }));
    throw new ValidationError(`Configuration validation failed: ${JSON.stringify(details)}`);
  }
  
  return value;
};

const validatePaymentData = (data) => {
  const { error, value } = paymentDataSchema.validate(data, { 
    abortEarly: false,
    stripUnknown: true 
  });
  
  if (error) {
    const details = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    }));
    throw new ValidationError(`Payment data validation failed: ${JSON.stringify(details)}`);
  }
  
  return value;
};

const validateOrderTrackingId = (id) => {
  const { error, value } = orderTrackingIdSchema.validate(id);
  
  if (error) {
    throw new ValidationError(`Order tracking ID validation failed: ${error.message}`);
  }
  
  return value;
};

const validateIpnData = (data) => {
  const { error, value } = ipnDataSchema.validate(data, { 
    abortEarly: false,
    stripUnknown: true 
  });
  
  if (error) {
    const details = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    }));
    throw new ValidationError(`IPN data validation failed: ${JSON.stringify(details)}`);
  }
  
  return value;
};

const validateSignature = (data) => {
  const { error, value } = signatureValidationSchema.validate(data);
  
  if (error) {
    throw new ValidationError(`Signature validation failed: ${error.message}`);
  }
  
  return value;
};

export const schemas = {
  configSchema,
  paymentDataSchema,
  orderTrackingIdSchema,
  ipnDataSchema,
  signatureValidationSchema
};

export const validators = {
  validateConfig,
  validatePaymentData,
  validateOrderTrackingId,
  validateIpnData,
  validateSignature
};
