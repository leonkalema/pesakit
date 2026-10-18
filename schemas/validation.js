import Joi from 'joi';
import { ValidationError } from '../lib/errors.js';

const url = Joi.string().uri({ scheme: ['http', 'https'] }).max(2048);

const configSchema = Joi.object({
  consumerKey: Joi.string().required().min(10).max(200),
  consumerSecret: Joi.string().required().min(10).max(200),
  environment: Joi.string().valid('sandbox', 'production', 'test').default('sandbox'),
  timeout: Joi.number().integer().min(1000).max(120000).default(30000),
  retries: Joi.number().integer().min(0).max(10).default(3),
  enableLogging: Joi.boolean().default(true),
  logLevel: Joi.string().valid('trace', 'debug', 'info', 'warn', 'error').default('info'),
  ipnUrl: url.optional(),
  ipnNotificationType: Joi.string().valid('GET', 'POST').default('GET')
});

const subscriptionSchema = Joi.object({
  accountNumber: Joi.string().required().max(100),
  startDate: Joi.string().required().pattern(/^\d{2}-\d{2}-\d{4}$/)
    .messages({ 'string.pattern.base': 'startDate must be DD-MM-YYYY' }),
  endDate: Joi.string().required().pattern(/^\d{2}-\d{2}-\d{4}$/)
    .messages({ 'string.pattern.base': 'endDate must be DD-MM-YYYY' }),
  frequency: Joi.string().required().valid('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')
});

const paymentDataSchema = Joi.object({
  amount: Joi.number().positive().precision(2).required(),
  description: Joi.string().required().min(1).max(100),
  reference: Joi.string().required().min(1).max(50).pattern(/^[a-zA-Z0-9\-_.:]+$/)
    .messages({ 'string.pattern.base': 'Reference may contain letters, digits, hyphens, underscores, dots and colons' }),
  email: Joi.string().email().max(254).optional(),
  phoneNumber: Joi.string().pattern(/^\+?[0-9]{7,15}$/).optional()
    .messages({ 'string.pattern.base': 'Phone number must be digits with an optional leading +' }),
  callbackUrl: url.required(),
  cancellationUrl: url.optional(),
  redirectMode: Joi.string().valid('TOP_WINDOW', 'PARENT_WINDOW').optional(),
  branch: Joi.string().max(100).optional(),
  currency: Joi.string().length(3).uppercase().default('KES'),
  notificationId: Joi.string().guid().optional(),
  ipnUrl: url.optional(),
  firstName: Joi.string().max(50).optional(),
  middleName: Joi.string().max(50).optional(),
  lastName: Joi.string().max(50).optional(),
  billingAddress: Joi.object({
    line1: Joi.string().max(100),
    line2: Joi.string().max(100),
    city: Joi.string().max(50),
    state: Joi.string().max(50),
    postalCode: Joi.string().max(20),
    zipCode: Joi.string().max(20),
    countryCode: Joi.string().length(2).uppercase()
  }).optional(),
  subscription: subscriptionSchema.optional()
}).or('email', 'phoneNumber')
  .messages({ 'object.missing': 'Provide at least one of email or phoneNumber' });

const orderTrackingIdSchema = Joi.string().required().min(1).max(100)
  .pattern(/^[a-zA-Z0-9\-_]+$/)
  .messages({ 'string.pattern.base': 'Order tracking ID contains invalid characters' });

const ipnDataSchema = Joi.object({
  orderTrackingId: orderTrackingIdSchema,
  orderMerchantReference: Joi.string().max(100).optional(),
  orderNotificationType: Joi.string().max(50).default('IPNCHANGE')
});

const ipnRegistrationSchema = Joi.object({
  url: url.required(),
  notificationType: Joi.string().valid('GET', 'POST').default('GET')
});

const refundSchema = Joi.object({
  confirmationCode: Joi.string().required().max(100),
  amount: Joi.number().positive().precision(2).required(),
  username: Joi.string().required().max(100),
  remarks: Joi.string().required().max(500)
});

const run = (schema, data, label) => {
  const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });
  if (error) {
    const details = error.details.map((d) => ({ field: d.path.join('.'), message: d.message }));
    throw new ValidationError(`${label} validation failed: ${JSON.stringify(details)}`, { fields: details });
  }
  return value;
};

const validators = {
  validateConfig: (data) => run(configSchema, data, 'Configuration'),
  validatePaymentData: (data) => run(paymentDataSchema, data, 'Payment data'),
  validateOrderTrackingId: (id) => run(orderTrackingIdSchema, id, 'Order tracking ID'),
  validateIpnData: (data) => run(ipnDataSchema, data, 'IPN data'),
  validateIpnRegistration: (data) => {
    const value = run(ipnRegistrationSchema, data, 'IPN registration');
    return { url: value.url, type: value.notificationType };
  },
  validateRefund: (data) => run(refundSchema, data, 'Refund')
};

const schemas = {
  configSchema,
  paymentDataSchema,
  subscriptionSchema,
  orderTrackingIdSchema,
  ipnDataSchema,
  ipnRegistrationSchema,
  refundSchema
};

export { schemas, validators };
