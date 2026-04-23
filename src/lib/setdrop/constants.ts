export const SD = {
  bg: '#0A0A0A',
  surface: '#141414',
  surface2: '#1A1A1A',
  surface3: '#222222',
  border: 'rgba(255,255,255,0.07)',
  borderMid: 'rgba(255,255,255,0.12)',
  accent: '#F5A623',
  accentDim: 'rgba(245,166,35,0.12)',
  accentHover: '#FFBA45',
  text: '#F0F0F0',
  textSec: '#8A8A8A',
  textMuted: '#4A4A4A',
  green: '#22C55E',
  greenDim: 'rgba(34,197,94,0.13)',
  yellow: '#EAB308',
  yellowDim: 'rgba(234,179,8,0.13)',
  red: '#EF4444',
  redDim: 'rgba(239,68,68,0.13)',
  mono: "var(--font-mono), monospace",
  display: "var(--font-display), sans-serif",
} as const;

export const GENRES = ['Hip Hop','R&B','House','Afrobeats','Techno','Dancehall','Latin','Pop','Other'] as const;
export const CROWD_TYPES = ['Club','Lounge','Wedding','Festival','House Party','Radio','Corporate'] as const;
export const LINEUP_SLOTS = ['Opener','Middle','Headliner','Closing'] as const;
export const DURATION_OPTS = ['30 min','60 min','90 min','120 min'] as const;

export type ConfidenceStatus = 'green' | 'yellow' | 'red';

export interface TrackStores {
  beatport: ConfidenceStatus;
  bpmSupreme: ConfidenceStatus;
  traxsource: ConfidenceStatus;
  spotify: ConfidenceStatus;
}

export interface SampleTrack {
  pos: number;
  artist: string;
  title: string;
  bpm: number;
  key: string;
  energy: number;
  wishlist: boolean;
  wordplay: string | null;
  why: string;
  transition: string;
  stores: TrackStores;
}

export const SAMPLE_TRACKS: SampleTrack[] = [
  { pos:1, artist:'Burna Boy', title:'Last Last', bpm:107, key:'4A', energy:3,
    wishlist:false, wordplay:null,
    why:'Perfect opener — familiar Afrobeats groove that eases the crowd in without showing your hand. Mid-tempo, emotionally resonant.',
    transition:'Blend on 8-bar loop. BPM match with pitch lock. Let the outro breathe.',
    stores:{ beatport:'green', bpmSupreme:'green', traxsource:'yellow', spotify:'green' }},
  { pos:2, artist:'Wizkid', title:'Essence (feat. Tems)', bpm:112, key:'4B', energy:4,
    wishlist:false, wordplay:null,
    why:'Key-compatible (4A → 4B), +5 BPM step-up maintains momentum. Emotional vocal keeps the early crowd engaged.',
    transition:'Low-pass filter exit, cut clean at 4-bar phrase. Gain match critical here.',
    stores:{ beatport:'green', bpmSupreme:'green', traxsource:'green', spotify:'green' }},
  { pos:3, artist:'Drake', title:'Rich Flex', bpm:138, key:'11B', energy:6,
    wishlist:true, wordplay:null,
    why:'Energy jump — the set shifts gears here. Crowd recogniser, creates a room-wide moment. Download before gig.',
    transition:'Filter swap at the break. Chop the intro.',
    stores:{ beatport:'yellow', bpmSupreme:'green', traxsource:'red', spotify:'green' }},
  { pos:4, artist:'Adekunle Gold', title:'Okay (feat. Wale)', bpm:120, key:'9A', energy:6,
    wishlist:false, wordplay:null,
    why:'Hip hop / Afrobeats crossover keeps both audiences locked. Sustains the energy peak with melodic relief.',
    transition:'BPM match, transition on chorus drop. Key change managed with brief filter.',
    stores:{ beatport:'green', bpmSupreme:'yellow', traxsource:'green', spotify:'green' }},
  { pos:5, artist:'4B & Chris Lorenzo', title:'Baddadan', bpm:128, key:'8B', energy:9,
    wishlist:false, wordplay:null,
    why:'Peak energy moment. The breakdown-to-drop lands after the R&B wave — dance floor reset. Absolute weapon.',
    transition:'Bass cut risers, delay throw on the vocal, big drop.',
    stores:{ beatport:'green', bpmSupreme:'yellow', traxsource:'green', spotify:'yellow' }},
  { pos:6, artist:'Tems', title:'Free Mind', bpm:124, key:'6A', energy:7,
    wishlist:false, wordplay:null,
    why:'Sustain phase — Tems holds the room after the peak. Crowd favourite, emotional height at a slightly lower intensity.',
    transition:'BPM match, swap on intro. Smooth.',
    stores:{ beatport:'yellow', bpmSupreme:'green', traxsource:'yellow', spotify:'green' }},
  { pos:7, artist:'DJ Snake', title:'Taki Taki (feat. Ozuna)', bpm:130, key:'5B', energy:7,
    wishlist:true, wordplay:null,
    why:'Latin pivot broadens the genre palette mid-set. Cross-cultural crowd moment. Download before gig.',
    transition:'Echo throw on the vocal exit, swap at 4-bar phrase.',
    stores:{ beatport:'green', bpmSupreme:'green', traxsource:'green', spotify:'green' }},
  { pos:8, artist:'Davido', title:'Fall', bpm:103, key:'3A', energy:4,
    wishlist:false, wordplay:null,
    why:'Cooldown begins. Slow, familiar, melodic. Lets the crowd breathe after the sustained peak.',
    transition:'Low-pass filter, gradual tempo reduction over 16 bars.',
    stores:{ beatport:'red', bpmSupreme:'yellow', traxsource:'green', spotify:'green' }},
];

export const LIBRARY_TRACKS: SampleTrack[] = [
  ...SAMPLE_TRACKS,
  { pos:9, artist:'Afrobeats All Stars', title:'Feeling', bpm:112, key:'4B', energy:5, wishlist:false, wordplay:null, why:'', transition:'', stores:{beatport:'green',bpmSupreme:'green',traxsource:'green',spotify:'green'} },
  { pos:10, artist:'Kizz Daniel', title:'Cough (Odo)', bpm:108, key:'2A', energy:4, wishlist:false, wordplay:null, why:'', transition:'', stores:{beatport:'green',bpmSupreme:'yellow',traxsource:'green',spotify:'green'} },
  { pos:11, artist:'Ayra Starr', title:'Rush', bpm:115, key:'7B', energy:5, wishlist:true, wordplay:null, why:'', transition:'', stores:{beatport:'yellow',bpmSupreme:'green',traxsource:'yellow',spotify:'green'} },
  { pos:12, artist:'Rema', title:'Calm Down', bpm:106, key:'1A', energy:4, wishlist:false, wordplay:null, why:'', transition:'', stores:{beatport:'green',bpmSupreme:'green',traxsource:'green',spotify:'green'} },
  { pos:13, artist:'Omah Lay', title:'Soso', bpm:118, key:'8A', energy:5, wishlist:false, wordplay:null, why:'', transition:'', stores:{beatport:'yellow',bpmSupreme:'green',traxsource:'green',spotify:'green'} },
  { pos:14, artist:'Fireboy DML', title:'Peru', bpm:126, key:'10B', energy:6, wishlist:true, wordplay:null, why:'', transition:'', stores:{beatport:'green',bpmSupreme:'yellow',traxsource:'red',spotify:'green'} },
  { pos:15, artist:'Asake', title:'Organise', bpm:133, key:'6B', energy:7, wishlist:false, wordplay:null, why:'', transition:'', stores:{beatport:'green',bpmSupreme:'green',traxsource:'yellow',spotify:'green'} },
];

export type PageId = 'landing' | 'dashboard' | 'builder' | 'output' | 'library' | 'share';
