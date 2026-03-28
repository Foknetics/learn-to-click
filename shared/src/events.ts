// ---- Client -> Server Events ----
export interface ClientToServerEvents {
  'create-room': (callback: (response: { roomId: string }) => void) => void;
  'join-room': (data: { roomId: string; playerName: string }, callback: (response: { success: boolean; error?: string }) => void) => void;
  'leave-room': () => void;
  'set-assignments': (data: { fojiString: string }, callback: (response: { success: boolean; error?: string }) => void) => void;
  'update-config': (data: { blastWaveInterval?: number; blastWaveRandomRange?: number; cubeMarkers?: [string, string, string, string, string] }) => void;
  'start-encounter': () => void;
  'reset-encounter': () => void;
  'click-cube': (data: { cubeIndex: number }) => void;
}

// ---- Server -> Client Events ----
export interface ServerToClientEvents {
  'room-state': (state: import('./types').RoomState) => void;
  'encounter-ended': (data: { reason: string }) => void;
  'error': (data: { message: string }) => void;
}
