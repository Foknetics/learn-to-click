import {
  CubeState,
  EncounterState,
  Player,
  RoomState,
  RoomConfig,
  Assignment,
  RaidMarker,
} from '@learn-to-click/shared';

const CHANNEL_DURATION = 10_000;      // 10 seconds
const DEBUFF_DURATION = 30_000;       // 30 seconds
const BLAST_WAVE_CAST_TIME = 2_000;   // 2 seconds
const TICK_RATE = 10;                 // 10ms ticks
const BROADCAST_EVERY = 5;            // broadcast every 5 ticks (50ms)

export interface RoomData {
  id: string;
  leaderId: string;
  players: Map<string, Player>;
  assignments: Assignment[];
  config: RoomConfig;
  encounter: EncounterState;
  /** Server-only: timestamp deadline for hidden random delay after cooldown expires */
  blastWaveRandomDelay: number;
  tickCount: number;
  tickInterval: ReturnType<typeof setInterval> | null;
  onStateUpdate: (state: RoomState) => void;
  onEncounterEnd: (reason: string) => void;
}

function createDefaultEncounter(): EncounterState {
  return {
    status: 'waiting',
    bossState: 'free',
    blastWaveTimer: 0,
    blastWaveCasting: false,
    blastWaveCastTimer: 0,
    cubes: Array.from({ length: 5 }, (_, i) => ({
      index: i,
      channelingPlayerId: null,
      channelingPlayerName: null,
      channelStartTime: null,
    })),
  };
}

export function createDefaultCubes(): CubeState[] {
  return Array.from({ length: 5 }, (_, i) => ({
    index: i,
    channelingPlayerId: null,
    channelingPlayerName: null,
    channelStartTime: null,
  }));
}

export function toRoomState(room: RoomData): RoomState {
  return {
    id: room.id,
    leaderId: room.leaderId,
    players: Array.from(room.players.values()),
    assignments: room.assignments,
    config: room.config,
    encounter: room.encounter,
  };
}

export class GameEngine {
  private rooms = new Map<string, RoomData>();

  createRoom(
    roomId: string,
    leaderId: string,
    onStateUpdate: (state: RoomState) => void,
    onEncounterEnd: (reason: string) => void,
  ): RoomData {
    const config: RoomConfig = {
      blastWaveInitialDelay: 60_000,
      blastWaveInterval: 60_000,
      blastWaveRandomRange: 10_000,
      cubeMarkers: ['skull', 'cross', 'square', 'moon', 'triangle'],
    };
    const room: RoomData = {
      id: roomId,
      leaderId,
      players: new Map(),
      assignments: [],
      config,
      encounter: createDefaultEncounter(),
      blastWaveRandomDelay: 0,
      tickCount: 0,
      tickInterval: null,
      onStateUpdate,
      onEncounterEnd,
    };
    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId: string): RoomData | undefined {
    return this.rooms.get(roomId);
  }

  deleteRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room?.tickInterval) {
      clearInterval(room.tickInterval);
    }
    this.rooms.delete(roomId);
  }

  findRoomByPlayer(playerId: string): RoomData | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.has(playerId)) return room;
    }
    return undefined;
  }

  addPlayer(roomId: string, playerId: string, name: string, isLeader = false): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    // Check for duplicate names
    for (const player of room.players.values()) {
      if (player.name.toLowerCase() === name.toLowerCase()) {
        return false;
      }
    }

    room.players.set(playerId, {
      id: playerId,
      name,
      debuffUntil: null,
      channelingCube: null,
      channelStartTime: null,
      isLeader,
    });
    return true;
  }

  removePlayer(roomId: string, playerId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // If player was channeling, end the channel
    const player = room.players.get(playerId);
    if (player?.channelingCube !== null && player?.channelingCube !== undefined) {
      this.endChannel(room, playerId);
    }

    room.players.delete(playerId);

    // If leader left, transfer leadership or delete room
    if (playerId === room.leaderId) {
      const nextPlayer = room.players.values().next();
      if (!nextPlayer.done) {
        room.leaderId = nextPlayer.value.id;
        nextPlayer.value.isLeader = true;
      } else {
        this.deleteRoom(roomId);
      }
    }
  }

  setAssignments(roomId: string, assignments: Assignment[]): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.assignments = assignments;
  }

  updateConfig(roomId: string, config: Partial<RoomConfig>): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    if (config.blastWaveInitialDelay !== undefined) {
      room.config.blastWaveInitialDelay = config.blastWaveInitialDelay;
    }
    if (config.blastWaveInterval !== undefined) {
      room.config.blastWaveInterval = config.blastWaveInterval;
      // Update remaining timer if encounter is waiting
      if (room.encounter.status === 'waiting') {
        room.encounter.blastWaveTimer = config.blastWaveInterval;
      }
    }
    if (config.blastWaveRandomRange !== undefined) {
      room.config.blastWaveRandomRange = config.blastWaveRandomRange;
    }
    if (config.cubeMarkers !== undefined) {
      room.config.cubeMarkers = config.cubeMarkers;
    }
  }

  startEncounter(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room || room.encounter.status === 'active') return;

    room.encounter = createDefaultEncounter();
    room.encounter.status = 'active';
    const now = Date.now();
    // First blast uses initial delay only (no random — random rolls when cooldown expires and boss is free)
    room.blastWaveRandomDelay = 0;
    room.encounter.blastWaveTimer = now + room.config.blastWaveInitialDelay;

    // Clear all player channeling/debuff state
    for (const player of room.players.values()) {
      player.channelingCube = null;
      player.channelStartTime = null;
      player.debuffUntil = null;
    }

    // Start tick loop
    if (room.tickInterval) clearInterval(room.tickInterval);
    room.tickInterval = setInterval(() => this.tick(room), TICK_RATE);
  }

  resetEncounter(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (room.tickInterval) {
      clearInterval(room.tickInterval);
      room.tickInterval = null;
    }

    room.encounter = createDefaultEncounter();

    // Clear all player state
    for (const player of room.players.values()) {
      player.channelingCube = null;
      player.channelStartTime = null;
      player.debuffUntil = null;
    }

    room.onStateUpdate(toRoomState(room));
  }

  clickCube(roomId: string, playerId: string, cubeIndex: number): string | null {
    const room = this.rooms.get(roomId);
    if (!room) return 'Room not found';
    if (room.encounter.status !== 'active') return 'Encounter not active';
    if (cubeIndex < 0 || cubeIndex > 4) return 'Invalid cube index';

    const player = room.players.get(playerId);
    if (!player) return 'Player not found';

    const now = Date.now();

    // Check debuff
    if (player.debuffUntil && now < player.debuffUntil) {
      return 'You have a debuff and cannot click';
    }

    const cube = room.encounter.cubes[cubeIndex];

    // If player is channeling THIS cube -> break channel (double click)
    if (player.channelingCube === cubeIndex) {
      this.endChannel(room, playerId);
      return null;
    }

    // If player is channeling a different cube, block
    if (player.channelingCube !== null) {
      return 'You are already channeling another cube';
    }

    // If cube is being channeled by someone else, player gets debuff but doesn't channel
    if (cube.channelingPlayerId && cube.channelingPlayerId !== playerId) {
      player.debuffUntil = now + DEBUFF_DURATION;
      return null;
    }

    // Start channeling
    cube.channelingPlayerId = playerId;
    cube.channelingPlayerName = player.name;
    cube.channelStartTime = now;
    player.channelingCube = cubeIndex;
    player.channelStartTime = now;

    return null;
  }

  private endChannel(room: RoomData, playerId: string): void {
    const player = room.players.get(playerId);
    if (!player || player.channelingCube === null) return;

    const cubeIndex = player.channelingCube;
    const cube = room.encounter.cubes[cubeIndex];

    // Clear cube state
    if (cube.channelingPlayerId === playerId) {
      cube.channelingPlayerId = null;
      cube.channelingPlayerName = null;
      cube.channelStartTime = null;
    }

    // Apply debuff
    player.debuffUntil = Date.now() + DEBUFF_DURATION;
    player.channelingCube = null;
    player.channelStartTime = null;
  }

  private tick(room: RoomData): void {
    if (room.encounter.status !== 'active') return;

    const now = Date.now();

    // 1. Check for expired channels
    for (const player of room.players.values()) {
      if (
        player.channelingCube !== null &&
        player.channelStartTime !== null &&
        now - player.channelStartTime >= CHANNEL_DURATION
      ) {
        this.endChannel(room, player.id);
      }
    }

    // 2. Compute boss state: caged if all 5 cubes have active channels
    const activeChannels = room.encounter.cubes.filter(
      (c) => c.channelingPlayerId !== null,
    ).length;
    const wasCaged = room.encounter.bossState === 'caged';
    room.encounter.bossState = activeChannels >= 5 ? 'caged' : 'free';

    // 3. Handle blast wave logic
    // Cooldown always ticks (even while caged).
    // Random delay is rolled only when cooldown expires AND boss is free.
    // States:
    //   COOLDOWN:  blastWaveTimer > 0 (timestamp deadline, ticks always)
    //   EXPIRED:   blastWaveTimer = 0, randomDelay = 0, not casting (waiting for uncage to roll random)
    //   RANDOM:    blastWaveRandomDelay > 0 (timestamp deadline, ticks always)
    //   CASTING:   blastWaveCasting = true
    const isCaged = room.encounter.bossState === 'caged';

    if (room.encounter.blastWaveCasting) {
      if (isCaged) {
        // Cage interrupts cast — reset full cooldown
        room.encounter.blastWaveCasting = false;
        room.encounter.blastWaveCastTimer = 0;
        room.encounter.blastWaveTimer = now + room.config.blastWaveInterval;
      } else if (now >= room.encounter.blastWaveCastTimer) {
        // Cast finished — encounter ends
        room.encounter.status = 'ended';
        room.encounter.blastWaveCasting = false;
        room.encounter.blastWaveCastTimer = 0;

        if (room.tickInterval) {
          clearInterval(room.tickInterval);
          room.tickInterval = null;
        }

        room.onStateUpdate(toRoomState(room));
        room.onEncounterEnd('Blast Nova killed the raid!');
        return;
      }
    } else if (room.encounter.blastWaveTimer > 0 && now >= room.encounter.blastWaveTimer) {
      // Cooldown just expired — clear it
      room.encounter.blastWaveTimer = 0;
      if (!isCaged) {
        // Boss is free — roll random delay
        const randomDelay = Math.floor(Math.random() * room.config.blastWaveRandomRange);
        if (randomDelay > 0) {
          room.blastWaveRandomDelay = now + randomDelay;
        } else {
          room.encounter.blastWaveCasting = true;
          room.encounter.blastWaveCastTimer = now + BLAST_WAVE_CAST_TIME;
        }
      }
      // If caged: stays in EXPIRED state, waits for uncage
    } else if (room.blastWaveRandomDelay > 0) {
      if (isCaged) {
        // Boss caged during random wait — clear it, will re-roll on uncage
        room.blastWaveRandomDelay = 0;
      } else if (now >= room.blastWaveRandomDelay) {
        // Random delay expired and boss is free — start casting
        room.blastWaveRandomDelay = 0;
        room.encounter.blastWaveCasting = true;
        room.encounter.blastWaveCastTimer = now + BLAST_WAVE_CAST_TIME;
      }
    } else if (
      room.encounter.blastWaveTimer === 0
      && room.blastWaveRandomDelay === 0
      && !isCaged
    ) {
      // EXPIRED state + boss just uncaged — roll random and go
      const randomDelay = Math.floor(Math.random() * room.config.blastWaveRandomRange);
      if (randomDelay > 0) {
        room.blastWaveRandomDelay = now + randomDelay;
      } else {
        room.encounter.blastWaveCasting = true;
        room.encounter.blastWaveCastTimer = now + BLAST_WAVE_CAST_TIME;
      }
    }

    // 4. Broadcast state (throttled)
    room.tickCount++;
    if (room.tickCount % BROADCAST_EVERY === 0) {
      room.onStateUpdate(toRoomState(room));
    }
  }
}
