export const API_VERSION = 'v1';

export const DEFAULT_LIMITS = {
  MAX_TOKENS_PER_REQUEST: 4096,
  MAX_CONVERSATION_LENGTH: 100,
  MAX_FILE_SIZE_MB: 50,
  MAX_CONCURRENT_TOOLS: 5,
  TOOL_TIMEOUT_SECONDS: 120,
  CODE_EXECUTION_TIMEOUT_SECONDS: 60,
} as const;

export const PERFORMANCE_TARGETS = {
  TTFT_P50_MS: 600,
  TTFT_P99_MS: 2000,
  E2E_RESPONSE_P50_MS: 4000,
  E2E_RESPONSE_P99_MS: 10000,
  ARTIFACT_RETRIEVAL_P50_MS: 1000,
  ARTIFACT_RETRIEVAL_P99_MS: 3000,
} as const;

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
} as const;

export const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'de', 'ja', 'zh'] as const;

export const ARTIFACT_TYPES = {
  TEXT: 'text/plain',
  MARKDOWN: 'text/markdown',
  HTML: 'text/html',
  JSON: 'application/json',
  CSV: 'text/csv',
  CHART: 'application/vnd.penny.chart+json',
  DASHBOARD: 'application/vnd.penny.dashboard+json',
  IMAGE: 'image/*',
  PDF: 'application/pdf',
} as const;
