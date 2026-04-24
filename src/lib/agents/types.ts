// Shared types for the 5-agent setlist pipeline

export interface SetlistInput {
  name: string;
  primaryGenre: string;
  secondaryGenre?: string;
  vibe?: string;
  crowdContext: string;
  durationMinutes: number;
  energyArc: {
    intro: number;
    buildup: number;
    peak: number;
    sustain: number;
    cooldown: number;
  };
  lineupSlot: string;
  seedTracks?: string[];
  soundcloudUrl?: string;
  wordplayTheme?: string;
  venueContext?: string;
}

export interface LibraryTrack {
  id: string;
  artist: string;
  title: string;
  bpm: number;
  key: string;
  genre?: string;
  // Mood/energy signals from Last.fm tags (replaces Spotify audio features)
  lastfmTags?: string[];       // e.g. ["afrobeats", "feel-good", "summer", "danceable"]
  // Serato analysis data (available for tracks already in library)
  seratoEnergy?: number;       // 0-10 scale from Serato's own analysis
  // Source metadata
  enrichmentSource?: 'beatport' | 'serato' | 'lastfm' | 'manual' | 'pending';
  isWishlist: boolean;
  beatportUrl?: string;
  beatportSearchUrl?: string;
  bpmSupremeSearchUrl?: string;
  traxsourceSearchUrl?: string;
  spotifyUrl?: string;
}

// Agent 1 output
export interface LibraryProfile {
  totalTracks: number;
  genreDistribution: Record<string, number>;
  bpmRange: { min: number; max: number; avg: number };
  energySpread: { low: number; mid: number; high: number };
  topArtists: string[];
  keyDistribution: Record<string, number>;
  wishlistCount: number;
  strengths: string[];
  gaps: string[];
}

// Agent 2 output
export interface GigIntelReport {
  venueName?: string;
  crowdProfile: string;
  trendingGenres: string[];
  recommendedBpmRange: { min: number; max: number };
  avoidArtists: string[];
  contextNotes: string;
}

// Agent 3 output
export interface SetBlueprint {
  totalTracks: number;
  phases: Array<{
    name: string;
    trackCount: number;
    energyTarget: number;
    bpmRange: { min: number; max: number };
    genreGuidance: string;
  }>;
  transitionStrategy: string;
  openerHeadlinerNotes: string;
}

// Agent 4 output — ordered track selection
export interface SelectedTrack extends LibraryTrack {
  position: number;
  phase: string;
  energyLevel: number;
  selectionReason: string;
  transitionNotes: string;
  harmonicMixingNotes: string;
  wordplayConnection?: string;
  isWishlistTrack: boolean;
}

// Agent 5 output — final reviewed setlist
export interface SetlistTrack {
  position: number;
  artist: string;
  title: string;
  bpm: number;
  key: string;
  energyLevel: number;
  whyThisTrack: string;
  transitionNotes: string;
  harmonicMixingNotes: string;
  wordplayConnection?: string;
  isWishlistTrack: boolean;
  beatportUrl?: string;
  spotifyUrl?: string;
  bpmSupremeSearchUrl?: string;
  traxsourceSearchUrl?: string;
}

export interface GeneratedSetlist {
  name: string;
  tracks: SetlistTrack[];
  reviewNotes: string;
  shareSlug: string;
}
