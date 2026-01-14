/**
 * Application-wide constants
 * Centralizes magic numbers and configuration values
 */

// Database Query Limits
export const DB_LIMITS = {
  TEMPLATES: 500,
  BLOG_POSTS: 100,
  COMPLIANCE_CARDS: 500,
  LEGAL_UPDATES: 200,
  SCREENING_CONTENT: 100,
  WORKFLOWS: 100,
  ACTIVE_USERS: 10000,
  USERS_BY_STATE: 10000,
  MONITORING_RUNS_DEFAULT: 10,
  MONITORING_RUNS_MAX: 100,
  RECENT_LEGAL_UPDATES: 10,
} as const;

// Legislative Monitoring
export const LEGISLATIVE_MONITORING = {
  BILLS_PER_STATE_LIMIT: 10, // Limit bills processed per state in MVP
  BILL_TITLE_PREVIEW_LENGTH: 60, // Characters to show in logs
} as const;

// Performance Monitoring
export const PERFORMANCE = {
  MAX_METRICS_STORED: 1000, // Keep last N metrics in memory
  SLOW_OPERATION_THRESHOLD_MS: 1000, // Log operations slower than this
} as const;

// Cache TTL (Time To Live) in seconds
export const CACHE_TTL = {
  STATES: 3600, // 1 hour - states rarely change
  TEMPLATES: 1800, // 30 minutes
  COMPLIANCE_CARDS: 1800, // 30 minutes
} as const;

// Rate Limiting
export const RATE_LIMITS = {
  CHAT_WINDOW_MS: 60000, // 1 minute window
  CHAT_MAX_REQUESTS: 10, // Max requests per window
  DOCUMENT_GENERATION_WINDOW_MS: 60000, // 1 minute window
  DOCUMENT_GENERATION_MAX_REQUESTS: 5, // Max requests per window
} as const;

// Stripe
export const STRIPE = {
  MONTHLY_PRICE_CENTS: 1200, // $12.00/month
  TRIAL_DAYS: 7,
} as const;

// Email
export const EMAIL = {
  TRIAL_REMINDER_DAYS_BEFORE: [7, 3, 1], // Send reminders at these days before trial ends
} as const;

// Request Timeouts
export const TIMEOUTS = {
  REQUEST_MS: 30000, // 30 seconds for general requests
  WEBHOOK_MS: 10000, // 10 seconds for webhooks
} as const;

// Payload Limits
export const PAYLOAD_LIMITS = {
  JSON_MB: 10, // 10MB for JSON payloads
  RAW_MB: 5, // 5MB for raw payloads (webhooks)
} as const;

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

// OpenAI
export const OPENAI = {
  MODEL: 'gpt-4',
  MAX_TOKENS: 1000,
  TEMPERATURE: 0.7,
} as const;

// Validation
export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_PROPERTY_NAME_LENGTH: 200,
  MAX_DOCUMENT_NAME_LENGTH: 200,
  MAX_BLOG_TITLE_LENGTH: 200,
  MAX_BLOG_SLUG_LENGTH: 200,
} as const;

