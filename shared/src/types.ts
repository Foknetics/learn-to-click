export interface Player {
  id: string;         // socket ID
  name: string;       // character name
  debuffUntil: number | null;  // timestamp when debuff expires
  channelingCube: number | null; // cube index 0-4, null if not channeling
  channelStartTime: number | null; // timestamp when channel started
  isLeader: boolean;
}

export interface CubeState {
  index: number;  // 0-4
  channelingPlayerId: string | null;
  channelingPlayerName: string | null;
  channelStartTime: number | null;
}

export type BossState = 'free' | 'caged';
export type EncounterStatus = 'waiting' | 'active' | 'ended';

export interface EncounterState {
  status: EncounterStatus;
  bossState: BossState;
  blastWaveTimer: number;        // timestamp when blast wave cooldown expires (0 = inactive)
  blastWaveCasting: boolean;     // true during 2s cast
  blastWaveCastTimer: number;    // timestamp when cast finishes (0 when not casting)
  cubes: CubeState[];            // always length 5
}

export interface Assignment {
  team: number;         // 1-based team number
  players: string[];    // player names, index = cube position (0-4)
}

export type RaidMarker = 'skull' | 'cross' | 'square' | 'moon' | 'triangle' | 'diamond' | 'circle' | 'star' | 'none';

export const RAID_MARKERS: RaidMarker[] = ['skull', 'cross', 'square', 'moon', 'triangle', 'diamond', 'circle', 'star'];

export interface RoomConfig {
  blastWaveInitialDelay: number;   // ms, default 60000
  blastWaveInterval: number;       // ms, default 60000
  blastWaveRandomRange: number;    // ms, max random delay added after interval (default 10000)
  cubeMarkers: [RaidMarker, RaidMarker, RaidMarker, RaidMarker, RaidMarker];
}

export interface RoomState {
  id: string;
  leaderId: string;
  players: Player[];
  assignments: Assignment[];
  config: RoomConfig;
  encounter: EncounterState;
}
