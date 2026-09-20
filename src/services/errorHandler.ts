/**
 * Sanitized Error Handler for Attendzy
 * 
 * Audit Remediation:
 * - Strips all PII (email, UID, providerData, personal identifiers) from logs and error messages in production.
 * - Restricts verbose debugging details strictly to development environments (`process.env.NODE_ENV === 'development'`).
 * - Emits sanitized, structured error signatures suitable for production monitoring.
 */

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
  AUTH = 'auth',
}

export interface SanitizedErrorInfo {
  errorType: string;
  message: string;
  operationType: OperationType;
  timestamp: string;
  statusCode?: string;
  // Non-PII path segment (e.g. collection name only, no sensitive document IDs)
  collectionPath?: string;
}

export interface VerboseDevErrorInfo extends SanitizedErrorInfo {
  rawError: string;
  stack?: string;
  debugAuthContext?: {
    uid?: string;
    email?: string;
    emailVerified?: boolean;
    providerIds?: string[];
  };
}

/**
 * Checks if the runtime environment is development
 */
export function isDevEnvironment(): boolean {
  // Check process.env.NODE_ENV as specified in the security audit
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) {
    return process.env.NODE_ENV === 'development';
  }
  // Vite client fallback
  return typeof import.meta !== 'undefined' && Boolean((import.meta as any).env?.DEV);
}

/**
 * Strips document-specific IDs or user tokens from a Firestore path for telemetry
 * e.g. "users/abc123xyz/attendance_data/current" -> "users/[USER_ID]/attendance_data/[DOC_ID]"
 */
export function sanitizePath(rawPath: string | null): string {
  if (!rawPath) return 'unknown';
  return rawPath.replace(/\/[a-zA-Z0-9_\-]+/g, (match, offset) => {
    // Keep top-level collection names, redact sub-document IDs
    if (offset === 0) return match;
    return '/[REDACTED_ID]';
  });
}

/**
 * Centralized sanitized error handler for Firebase and Database operations
 */
export function handleSecureError(
  error: unknown,
  operationType: OperationType,
  path: string | null = null,
  authContext?: { uid?: string | null; email?: string | null; emailVerified?: boolean | null; providerData?: any[] }
): never {
  const isDev = isDevEnvironment();
  const rawErrorMessage = error instanceof Error ? error.message : String(error);
  const errorType = (error as any)?.code || (error instanceof Error ? error.name : 'OperationError');

  if (isDev) {
    // Detailed logging strictly in development mode for developer productivity
    const devErrorInfo: VerboseDevErrorInfo = {
      errorType,
      message: rawErrorMessage,
      operationType,
      timestamp: new Date().toISOString(),
      collectionPath: path || undefined,
      rawError: rawErrorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      debugAuthContext: authContext
        ? {
            uid: authContext.uid || undefined,
            email: authContext.email || undefined,
            emailVerified: authContext.emailVerified || undefined,
            providerIds: authContext.providerData?.map((p) => p.providerId) || [],
          }
        : undefined,
    };

    console.group(`[DEV ONLY] Database/Auth Error (${operationType})`);
    console.error('Details:', devErrorInfo);
    console.groupEnd();

    throw new Error(`[DEV] ${operationType} failure: ${rawErrorMessage}`);
  }

  // PRODUCTION: Strictly strip all PII and sensitive internal details
  const sanitizedInfo: SanitizedErrorInfo = {
    errorType,
    message: getGenericMessage(errorType),
    operationType,
    collectionPath: sanitizePath(path),
    timestamp: new Date().toISOString(),
  };

  // Safe production telemetry output
  console.error('[AttendanceService Error]', JSON.stringify(sanitizedInfo));

  // Throw sanitized error safe for user-facing displays and error boundaries
  throw new Error(sanitizedInfo.message);
}

/**
 * Returns generic, user-safe error messages preventing schema or identity leakage
 */
function getGenericMessage(codeOrType: string): string {
  switch (codeOrType) {
    case 'permission-denied':
    case 'auth/insufficient-permission':
      return 'Access denied. You do not have permission to view or modify this record.';
    case 'not-found':
      return 'The requested attendance record could not be found.';
    case 'unauthenticated':
    case 'auth/user-token-expired':
      return 'Your session has expired. Please sign in again.';
    case 'resource-exhausted':
      return 'Service temporarily busy. Please try again shortly.';
    default:
      return 'An unexpected error occurred while processing your attendance request.';
  }
}
