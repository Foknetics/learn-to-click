import { Component, Input, computed, signal, ElementRef, HostListener } from '@angular/core';
import { Assignment, Player, EncounterState, RaidMarker } from '@learn-to-click/shared';

const CHANNEL_DURATION = 10_000;
const DEBUFF_DURATION = 30_000;

const MARKER_SPRITE_POS: Record<string, string> = {
  star:     '0% 0%',
  circle:   '33.33% 0%',
  diamond:  '66.67% 0%',
  triangle: '100% 0%',
  moon:     '0% 100%',
  square:   '33.33% 100%',
  cross:    '66.67% 100%',
  skull:    '100% 100%',
};

@Component({
  selector: 'app-assignment-grid',
  templateUrl: './assignment-grid.html',
  styleUrl: './assignment-grid.scss',
  host: {
    '[style.left.%]': 'posX',
    '[style.bottom.%]': 'posY',
    '[style.width.%]': 'width',
  },
})
export class AssignmentGrid {
  @Input({ required: true }) set assignments(value: Assignment[]) {
    this._assignments.set(value);
  }
  @Input({ required: true }) set players(value: Player[]) {
    this._players.set(value);
  }
  @Input({ required: true }) set encounter(value: EncounterState) {
    this._encounter.set(value);
  }
  @Input() set cubeMarkers(value: RaidMarker[]) {
    this._cubeMarkers.set(value);
  }
  @Input() myPlayerId = '';

  _assignments = signal<Assignment[]>([]);
  _players = signal<Player[]>([]);
  _encounter = signal<EncounterState>({
    status: 'waiting',
    bossState: 'free',
    blastWaveTimer: 0,
    blastWaveCasting: false,
    blastWaveCastTimer: 0,
    cubes: [],
  });
  _cubeMarkers = signal<RaidMarker[]>(['skull', 'cross', 'square', 'moon', 'triangle']);

  cubeIndices = [0, 1, 2, 3, 4];

  // Overlay position/size as percentages of the arena
  posX = 2;    // left %
  posY = 2;    // bottom %
  width = 33;  // width %
  height = 33; // height %

  private dragging = false;
  private resizing = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private startPosX = 0;
  private startPosY = 0;
  private startWidth = 0;
  private startHeight = 0;

  constructor(private el: ElementRef<HTMLElement>) {}

  onDragStart(e: MouseEvent): void {
    e.preventDefault();
    this.dragging = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.startPosX = this.posX;
    this.startPosY = this.posY;
  }

  onResizeStart(e: MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.resizing = true;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.startWidth = this.width;
    this.startHeight = this.height;
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent): void {
    const parent = this.el.nativeElement.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();

    if (this.dragging) {
      const dx = ((e.clientX - this.dragStartX) / rect.width) * 100;
      const dy = ((e.clientY - this.dragStartY) / rect.height) * 100;
      this.posX = Math.max(0, Math.min(100 - this.width, this.startPosX + dx));
      this.posY = Math.max(0, Math.min(100 - this.height, this.startPosY - dy)); // bottom-based, invert Y
    }

    if (this.resizing) {
      const dx = ((e.clientX - this.dragStartX) / rect.width) * 100;
      const dy = ((e.clientY - this.dragStartY) / rect.height) * 100;
      this.width = Math.max(15, Math.min(80, this.startWidth + dx));
      this.height = Math.max(15, Math.min(80, this.startHeight + dy));
    }
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    this.dragging = false;
    this.resizing = false;
  }

  markerIcon(index: number): string | null {
    const marker = this._cubeMarkers()[index];
    return MARKER_SPRITE_POS[marker] ?? null;
  }

  getPlayerStatus(playerName: string): 'channeling' | 'debuffed' | 'ready' | 'offline' {
    const player = this._players().find(
      p => p.name.toLowerCase() === playerName.toLowerCase(),
    );
    if (!player) return 'offline';
    if (player.channelingCube !== null) return 'channeling';
    if (player.debuffUntil && player.debuffUntil > Date.now()) return 'debuffed';
    return 'ready';
  }

  /** Returns current bar width % and type, recalculated from server timestamps each tick */
  getBarInfo(playerName: string): { percent: number; type: 'channel' | 'debuff' } | null {
    const player = this._players().find(
      p => p.name.toLowerCase() === playerName.toLowerCase(),
    );
    if (!player) return null;

    const now = Date.now();
    if (player.channelingCube !== null && player.channelStartTime) {
      const elapsed = now - player.channelStartTime;
      const percent = Math.max(0, 100 - (elapsed / CHANNEL_DURATION) * 100);
      return { percent, type: 'channel' };
    }
    if (player.debuffUntil && player.debuffUntil > now) {
      const remaining = player.debuffUntil - now;
      const percent = Math.max(0, (remaining / DEBUFF_DURATION) * 100);
      return { percent, type: 'debuff' };
    }
    return null;
  }

  isMyName(playerName: string): boolean {
    const player = this._players().find(p => p.id === this.myPlayerId);
    return player?.name.toLowerCase() === playerName.toLowerCase();
  }
}
