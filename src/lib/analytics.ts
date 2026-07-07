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
  signUp(method: 'email' | 'google') {
    track('sign_up', { method });
  },
  libraryUploaded(djSoftware: 'serato' | 'rekordbox') {
    track('library_uploaded', { dj_software: djSoftware });
  },
  setGenerated(genre: string, trackCount: number, durationMinutes: number) {
    track('set_generated', {
      genre,
      track_count: trackCount,
      duration_minutes: durationMinutes,
    });
  },
};
