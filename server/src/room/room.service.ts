import { Injectable } from '@nestjs/common';
import { GameEngine, RoomData, toRoomState } from './game-engine.js';
import { RoomState, Assignment, RoomConfig } from '@learn-to-click/shared';

function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

@Injectable()
export class RoomService {
  private engine = new GameEngine();

  createRoom(
    leaderId: string,
    onStateUpdate: (state: RoomState) => void,
    onEncounterEnd: (reason: string) => void,
  ): RoomData {
    let roomId: string;
    do {
      roomId = generateRoomId();
    } while (this.engine.getRoom(roomId));

    return this.engine.createRoom(roomId, leaderId, onStateUpdate, onEncounterEnd);
  }

  getRoom(roomId: string): RoomData | undefined {
    return this.engine.getRoom(roomId);
  }

  findRoomByPlayer(playerId: string): RoomData | undefined {
    return this.engine.findRoomByPlayer(playerId);
  }

  joinRoom(roomId: string, playerId: string, playerName: string): { success: boolean; error?: string } {
    const room = this.engine.getRoom(roomId);
    if (!room) return { success: false, error: 'Room not found' };

    const added = this.engine.addPlayer(roomId, playerId, playerName);
    if (!added) return { success: false, error: 'Name already taken in this room' };

    return { success: true };
  }

  leaveRoom(playerId: string): string | undefined {
    const room = this.engine.findRoomByPlayer(playerId);
    if (!room) return undefined;

    const roomId = room.id;
    this.engine.removePlayer(roomId, playerId);

    // If room was deleted (no players left), return undefined
    if (!this.engine.getRoom(roomId)) return undefined;

    return roomId;
  }

  setAssignments(roomId: string, assignments: Assignment[]): void {
    this.engine.setAssignments(roomId, assignments);
  }

  updateConfig(roomId: string, config: Partial<RoomConfig>): void {
    this.engine.updateConfig(roomId, config);
  }

  startEncounter(roomId: string): void {
    this.engine.startEncounter(roomId);
  }

  resetEncounter(roomId: string): void {
    this.engine.resetEncounter(roomId);
  }

  clickCube(roomId: string, playerId: string, cubeIndex: number): string | null {
    return this.engine.clickCube(roomId, playerId, cubeIndex);
  }

  getRoomState(roomId: string): RoomState | undefined {
    const room = this.engine.getRoom(roomId);
    if (!room) return undefined;
    return toRoomState(room);
  }

  deleteRoom(roomId: string): void {
    this.engine.deleteRoom(roomId);
  }
}
