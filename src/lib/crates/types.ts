// Shape of a track stored in themed_crates.tracks_json (the source of truth for
// a crate's contents). Shared between the crate-generation route and the admin
// crate detail page.
export interface CrateTrack {
  id: string;
  artist: string;
  title: string;
  bpm: number | null;
  key: string | null;
  genre: string | null;
  year: number | null;
  filePath: string | null;
}
