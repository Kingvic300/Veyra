'use client';

/**
 * Cookie and storage consent. Strictly necessary storage (the session cookie,
 * this consent record) never needs consent. Optional categories default to
 * off and only switch on after an explicit choice.
 */

export interface Consent {
  version: 1;
  analytics: boolean;
  decidedAt: string;
}

const KEY = 'veyra:consent';
export const OPEN_CONSENT_EVENT = 'veyra:open-consent';
export const CONSENT_CHANGED_EVENT = 'veyra:consent-changed';

export function readConsent(): Consent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Consent;
    return parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

export function saveConsent(analytics: boolean): Consent {
  const consent: Consent = { version: 1, analytics, decidedAt: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify(consent));
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: consent }));
  return consent;
}

/** Re-open the consent preferences from anywhere (for example the footer). */
export function openConsentPreferences() {
  window.dispatchEvent(new Event(OPEN_CONSENT_EVENT));
}
