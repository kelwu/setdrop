declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function track(eventName: string, params?: Record<string, string | number | boolean>) {
  if (typeof window === 'undefined') return;
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', eventName, params);
}

export const trackEvent = {
  // — Signup —
  signupStarted(method: 'email' | 'google') {
    track('signup_started', { method });
  },
  signUp(method: 'email' | 'google') {
    track('sign_up', { method });
  },

  // — Library import — the started/failed pair reveals whether users who don't
  // finish an import never tried, or tried and hit a parse/upload failure.
  libraryUploadStarted(djSoftware: 'serato' | 'rekordbox') {
    track('library_upload_started', { dj_software: djSoftware });
  },
  libraryUploaded(djSoftware: 'serato' | 'rekordbox') {
    track('library_uploaded', { dj_software: djSoftware });
  },
  libraryUploadFailed(djSoftware: 'serato' | 'rekordbox', reason: string) {
    track('library_upload_failed', { dj_software: djSoftware, reason });
  },

  // — Set generation — `reason` is a fixed category (not raw error text) to keep
  // cardinality low; 'rate_limited' distinguishes the quota wall from real errors.
  setGenerationStarted(genre: string, durationMinutes: number) {
    track('set_generation_started', { genre, duration_minutes: durationMinutes });
  },
  setGenerated(genre: string, trackCount: number, durationMinutes: number) {
    track('set_generated', {
      genre,
      track_count: trackCount,
      duration_minutes: durationMinutes,
    });
  },
  setGenerationFailed(reason: string, genre?: string) {
    track('set_generation_failed', genre ? { reason, genre } : { reason });
  },
};
