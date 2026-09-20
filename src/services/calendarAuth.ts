/**
 * Google OAuth Scopes Configuration for Attendzy
 * 
 * Audit Remediation:
 * - Removed broad scope: 'https://www.googleapis.com/auth/calendar' (Full Calendar Read/Write/Delete)
 * - Removed broad scope: 'https://www.googleapis.com/auth/calendar.readonly' (Read-only Calendar)
 * - Principle of Least Privilege: Enforces minimum required scope strictly for event creation.
 * - Standard Login Provider: Uses standard profile & email scopes so basic sign-in succeeds reliably.
 * - Calendar Provider: Requests calendar.events only when synchronizing attendance calendar events.
 */

import { GoogleAuthProvider } from 'firebase/auth';

export const MINIMAL_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events', // Grants write/manage access strictly to events
] as const;

/**
 * Standard Google Auth Provider for basic user sign-in.
 * Only requests standard profile and email; avoids blocking login with unverified API scopes.
 */
export function createStandardGoogleAuthProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account',
  });
  return provider;
}

/**
 * Configure a GoogleAuthProvider instance with minimum required calendar scopes
 * for creating and managing attendance events.
 */
export function createCalendarGoogleAuthProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  
  // Attach only the minimum required scope for calendar event sync
  MINIMAL_CALENDAR_SCOPES.forEach((scope) => {
    provider.addScope(scope);
  });

  provider.setCustomParameters({
    prompt: 'consent',
    access_type: 'online',
  });

  return provider;
}

// Backward compatibility alias for existing imports
export const createConfiguredGoogleAuthProvider = createStandardGoogleAuthProvider;

