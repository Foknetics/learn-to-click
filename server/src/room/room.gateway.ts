import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RoomService } from './room.service.js';
import { parseFojiString } from './foji-parser.js';
import { RoomState, RaidMarker, RAID_MARKERS } from '@learn-to-click/shared';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RoomGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly roomService: RoomService) {}

  handleDisconnect(client: Socket): void {
    const roomId = this.roomService.leaveRoom(client.id);
    if (roomId) {
      const state = this.roomService.getRoomState(roomId);
      if (state) {
        this.server.to(roomId).emit('room-state', state);
      }
    }
  }

  @SubscribeMessage('create-room')
  handleCreateRoom(
    @ConnectedSocket() client: Socket,
  ): { roomId: string } {
    // Leave any existing room first
    this.roomService.leaveRoom(client.id);

    const room = this.roomService.createRoom(
      client.id,
      (state: RoomState) => {
        this.server.to(room.id).emit('room-state', state);
      },
      (reason: string) => {
        this.server.to(room.id).emit('encounter-ended', { reason });
      },
    );

    // Add the leader as a player (they'll set their name when joining)
    client.join(room.id);

    return { roomId: room.id };
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; playerName: string },
  ): { success: boolean; error?: string } {
    const roomId = data.roomId.toUpperCase().trim();
    const playerName = data.playerName.trim();

    if (!playerName || playerName.length > 20) {
      return { success: false, error: 'Invalid player name' };
    }

    // Leave any existing room first
    this.roomService.leaveRoom(client.id);

    const room = this.roomService.getRoom(roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    const isLeader = room.leaderId === client.id;
    const result = this.roomService.joinRoom(roomId, client.id, playerName);

    if (result.success) {
      // Mark as leader if this is the room creator
      if (isLeader) {
        const player = room.players.get(client.id);
        if (player) player.isLeader = true;
      }

      client.join(roomId);
      const state = this.roomService.getRoomState(roomId);
      if (state) {
        this.server.to(roomId).emit('room-state', state);
      }
    }

    return result;
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(@ConnectedSocket() client: Socket): void {
    const roomId = this.roomService.leaveRoom(client.id);
    if (roomId) {
      client.leave(roomId);
      const state = this.roomService.getRoomState(roomId);
      if (state) {
        this.server.to(roomId).emit('room-state', state);
      }
    }
  }

  @SubscribeMessage('set-assignments')
  handleSetAssignments(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { fojiString: string },
  ): { success: boolean; error?: string } {
    const room = this.roomService.findRoomByPlayer(client.id);
    if (!room) return { success: false, error: 'Not in a room' };
    if (room.leaderId !== client.id) return { success: false, error: 'Only the raid leader can set assignments' };

    const assignments = parseFojiString(data.fojiString);
    this.roomService.setAssignments(room.id, assignments);

    const state = this.roomService.getRoomState(room.id);
    if (state) {
      this.server.to(room.id).emit('room-state', state);
    }

    return { success: true };
  }

  @SubscribeMessage('update-config')
  handleUpdateConfig(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { blastWaveInitialDelay?: number; blastWaveInterval?: number; blastWaveRandomRange?: number; cubeMarkers?: [string, string, string, string, string] },
  ): void {
    const room = this.roomService.findRoomByPlayer(client.id);
    if (!room || room.leaderId !== client.id) return;

    const update: Record<string, unknown> = {};

    if (data.blastWaveInitialDelay !== undefined) {
      update['blastWaveInitialDelay'] = Math.max(1_000, Math.min(300_000, data.blastWaveInitialDelay));
    }

    if (data.blastWaveInterval !== undefined) {
      // Clamp between 10s and 300s
      update['blastWaveInterval'] = Math.max(1_000, Math.min(300_000, data.blastWaveInterval));
    }

    if (data.blastWaveRandomRange !== undefined) {
      // Clamp between 0s and 30s
      update['blastWaveRandomRange'] = Math.max(0, Math.min(30_000, data.blastWaveRandomRange));
    }

    if (data.cubeMarkers !== undefined && Array.isArray(data.cubeMarkers) && data.cubeMarkers.length === 5) {
      const validMarkers = [...RAID_MARKERS, 'none'] as string[];
      if (data.cubeMarkers.every(m => validMarkers.includes(m))) {
        update['cubeMarkers'] = data.cubeMarkers;
      }
    }

    this.roomService.updateConfig(room.id, update);

    const state = this.roomService.getRoomState(room.id);
    if (state) {
      this.server.to(room.id).emit('room-state', state);
    }
  }

  @SubscribeMessage('start-encounter')
  handleStartEncounter(@ConnectedSocket() client: Socket): void {
    const room = this.roomService.findRoomByPlayer(client.id);
    if (!room || room.leaderId !== client.id) return;

    this.roomService.startEncounter(room.id);
  }

  @SubscribeMessage('reset-encounter')
  handleResetEncounter(@ConnectedSocket() client: Socket): void {
    const room = this.roomService.findRoomByPlayer(client.id);
    if (!room || room.leaderId !== client.id) return;

    this.roomService.resetEncounter(room.id);
  }

  @SubscribeMessage('click-cube')
  handleClickCube(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { cubeIndex: number },
  ): void {
    const room = this.roomService.findRoomByPlayer(client.id);
    if (!room) return;

    const error = this.roomService.clickCube(room.id, client.id, data.cubeIndex);
    if (error) {
      client.emit('error', { message: error });
    }
    // State will be broadcast on next tick
  }
}
