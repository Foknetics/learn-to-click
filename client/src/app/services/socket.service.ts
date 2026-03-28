import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { RoomState } from '@learn-to-click/shared';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private socket: Socket | null = null;

  private roomState$ = new BehaviorSubject<RoomState | null>(null);
  private encounterEnded$ = new Subject<{ reason: string }>();
  private error$ = new Subject<{ message: string }>();
  private connected$ = new BehaviorSubject<boolean>(false);

  get roomState(): Observable<RoomState | null> {
    return this.roomState$.asObservable();
  }

  get encounterEnded(): Observable<{ reason: string }> {
    return this.encounterEnded$.asObservable();
  }

  get socketError(): Observable<{ message: string }> {
    return this.error$.asObservable();
  }

  get isConnected(): Observable<boolean> {
    return this.connected$.asObservable();
  }

  get currentRoomState(): RoomState | null {
    return this.roomState$.value;
  }

  get socketId(): string | undefined {
    return this.socket?.id;
  }

  connect(): void {
    if (this.socket?.connected) return;

    const serverUrl =
      ((window as unknown as Record<string, unknown>)['__SERVER_URL__'] as string) ||
      'http://localhost:3000';

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      this.connected$.next(true);
    });

    this.socket.on('disconnect', () => {
      this.connected$.next(false);
    });

    this.socket.on('room-state', (state: RoomState) => {
      this.roomState$.next(state);
    });

    this.socket.on('encounter-ended', (data: { reason: string }) => {
      this.encounterEnded$.next(data);
    });

    this.socket.on('error', (data: { message: string }) => {
      this.error$.next(data);
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.roomState$.next(null);
    this.connected$.next(false);
  }

  createRoom(): Promise<{ roomId: string }> {
    return this.emit<{ roomId: string }>('create-room');
  }

  joinRoom(roomId: string, playerName: string): Promise<{ success: boolean; error?: string }> {
    return this.emit<{ success: boolean; error?: string }>('join-room', { roomId, playerName });
  }

  leaveRoom(): void {
    this.socket?.emit('leave-room');
    this.roomState$.next(null);
  }

  setAssignments(fojiString: string): Promise<{ success: boolean; error?: string }> {
    return this.emit<{ success: boolean; error?: string }>('set-assignments', { fojiString });
  }

  updateConfig(config: { blastWaveInitialDelay?: number; blastWaveInterval?: number; blastWaveRandomRange?: number; cubeMarkers?: [string, string, string, string, string] }): void {
    this.socket?.emit('update-config', config);
  }

  startEncounter(): void {
    this.socket?.emit('start-encounter');
  }

  resetEncounter(): void {
    this.socket?.emit('reset-encounter');
  }

  clickCube(cubeIndex: number): void {
    this.socket?.emit('click-cube', { cubeIndex });
  }

  private emit<T>(event: string, data?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected'));
        return;
      }
      if (data !== undefined) {
        this.socket.emit(event, data, (response: T) => resolve(response));
      } else {
        this.socket.emit(event, (response: T) => resolve(response));
      }
    });
  }
}
