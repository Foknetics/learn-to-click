import { Component, Input, Output, EventEmitter, computed, signal } from '@angular/core';
import { CubeState, RaidMarker } from '@learn-to-click/shared';

// Sprite sheet positions for WoW raid marker icons (percentage-based)
// Sprite is 4 columns x 2 rows
// Row 0: star, circle, diamond, triangle
// Row 1: moon, square, cross, skull
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
  selector: 'app-cube',
  templateUrl: './cube.html',
  styleUrl: './cube.scss',
})
export class CubeComponent {
  @Input({ required: true }) set cubeState(value: CubeState) {
    this._cubeState.set(value);
  }
  @Input() cubeIndex = 0;
  @Input() marker: RaidMarker = 'none';
  @Input() isActive = false;
  @Output() clicked = new EventEmitter<number>();

  _cubeState = signal<CubeState>({
    index: 0,
    channelingPlayerId: null,
    channelingPlayerName: null,
    channelStartTime: null,
  });

  isChanneling = computed(() => this._cubeState().channelingPlayerId !== null);
  channelerName = computed(() => this._cubeState().channelingPlayerName ?? '');

  channelProgress = computed(() => {
    const cube = this._cubeState();
    if (!cube.channelStartTime) return 0;
    const elapsed = Date.now() - cube.channelStartTime;
    return Math.min(100, (elapsed / 10000) * 100);
  });

  get markerIcon(): string | null {
    return MARKER_SPRITE_POS[this.marker] ?? null;
  }

  get markerPlacement(): 'above' | 'left' | 'right' | 'below' {
    switch (this.marker) {
      case 'cross': return 'left';
      case 'triangle': return 'right';
      case 'skull': return 'below';
      default: return 'above';
    }
  }

  onClick(): void {
    if (this.isActive) {
      this.clicked.emit(this.cubeIndex);
    }
  }
}
