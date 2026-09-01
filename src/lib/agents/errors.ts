/**
 * Thrown by the pipeline when the DJ's request can't be satisfied by their
 * library — the candidate pool is too thin for the chosen genre / era / artist /
 * playlist at the requested duration.
 *
 * This is an EXPECTED, user-actionable rejection, not a system failure. The
 * message is safe to show the DJ verbatim. The generate-setlist route records
 * these as `generation_events.status = 'rejected'` (never `'error'`) so the
 * health-check watchdog excludes them from the failure rate — a DJ hammering an
 * unsatisfiable filter must not page as an outage.
 */
export class SetlistInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SetlistInputError';
  }
}
