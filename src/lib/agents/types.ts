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
  energy?: number;
  genre?: string;
  danceability?: number;
  valence?: number;
  isWishlist: boolean;
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
