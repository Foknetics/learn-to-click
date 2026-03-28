import { Component, Input, Output, EventEmitter, computed, signal, effect } from '@angular/core';
import { EncounterState, Player, RaidMarker } from '@learn-to-click/shared';
import { CubeComponent } from '../cube/cube';

@Component({
  selector: 'app-arena',
  imports: [CubeComponent],
  templateUrl: './arena.html',
  styleUrl: './arena.scss',
})
export class Arena {
  @Input({ required: true }) set encounter(value: EncounterState) {
    this._encounter.set(value);
  }
  @Input({ required: true }) set players(value: Player[]) {
    this._players.set(value);
  }
  @Input() set myPlayer(value: Player | null) {
    this._myPlayer.set(value);
  }
  @Input() set cubeMarkers(value: RaidMarker[]) {
    this._cubeMarkers.set(value);
  }
  @Input() set blastWaveInterval(value: number) {
    this._blastWaveInterval.set(value);
  }
  @Output() cubeClicked = new EventEmitter<number>();

  _encounter = signal<EncounterState>({
    status: 'waiting',
    bossState: 'free',
    blastWaveTimer: 0,
    blastWaveCasting: false,
    blastWaveCastTimer: 0,
    cubes: [],
  });
  _players = signal<Player[]>([]);
  _myPlayer = signal<Player | null>(null);
  _cubeMarkers = signal<RaidMarker[]>(['skull', 'cross', 'square', 'moon', 'triangle']);
  _blastWaveInterval = signal(60000);

  bossStatusText = computed(() => {
    const enc = this._encounter();
    if (enc.status === 'waiting') return 'WAITING';
    if (enc.status === 'ended') return 'DEFEATED';
    return enc.bossState === 'caged' ? 'CAGED' : 'FREE';
  });

  blastWaveTimerText = computed(() => {
    const enc = this._encounter();
    if (enc.blastWaveCasting || !enc.blastWaveTimer) return null;
    const remaining = Math.max(0, enc.blastWaveTimer - Date.now());
    return `${(remaining / 1000).toFixed(1)}s`;
  });

  blastWaveTimerPercent = computed(() => {
    const enc = this._encounter();
    if (enc.blastWaveCasting || !enc.blastWaveTimer) return 0;
    const interval = this._blastWaveInterval();
    if (interval <= 0) return 0;
    const remaining = Math.max(0, enc.blastWaveTimer - Date.now());
    return (remaining / interval) * 100;
  });

  blastWaveTimerRemaining = computed(() => {
    const enc = this._encounter();
    if (!enc.blastWaveTimer) return 0;
    return Math.max(0, enc.blastWaveTimer - Date.now());
  });

  blastWaveCastPercent = computed(() => {
    const enc = this._encounter();
    if (!enc.blastWaveCasting || !enc.blastWaveCastTimer) return 0;
    const remaining = Math.max(0, enc.blastWaveCastTimer - Date.now());
    return ((2000 - remaining) / 2000) * 100;
  });

  cagedRemainingPercent = computed(() => {
    const enc = this._encounter();
    if (enc.bossState !== 'caged') return null;
    const earliest = enc.cubes.reduce((min, c) => {
      if (c.channelStartTime !== null && c.channelStartTime < min) return c.channelStartTime;
      return min;
    }, Infinity);
    if (!isFinite(earliest)) return null;
    const remaining = Math.max(0, 10000 - (Date.now() - earliest));
    return (remaining / 10000) * 100;
  });

  cagedRemainingText = computed(() => {
    const enc = this._encounter();
    if (enc.bossState !== 'caged') return null;
    const earliest = enc.cubes.reduce((min, c) => {
      if (c.channelStartTime !== null && c.channelStartTime < min) return c.channelStartTime;
      return min;
    }, Infinity);
    if (!isFinite(earliest)) return null;
    const remaining = Math.max(0, 10000 - (Date.now() - earliest));
    return (remaining / 1000).toFixed(1) + 's';
  });

  // Pentagon positions — C1=bottom, then clockwise: C2=left, C3=top-left, C4=top-right, C5=right
  // Percentages from pixel coords on 1394x784 image, anchor = center of cube
  cubePositions = [
    { top: '87.37%', left: '49.50%' },   // C1 - bottom (690, 685)
    { top: '46.30%', left: '15.50%' },   // C2 - left (~216, 363)
    { top: '7.53%',  left: '36.73%' },   // C3 - top-left (512, 59)
    { top: '7.53%',  left: '63.41%' },   // C4 - top-right (884, 59)
    { top: '46.30%', left: '84.00%' },   // C5 - right (~1171, 363)
  ];

  onCubeClick(index: number): void {
    this.cubeClicked.emit(index);
  }

  debuffRemainingSeconds = computed(() => {
    const p = this._myPlayer();
    if (!p?.debuffUntil) return null;
    const remaining = Math.max(0, Math.ceil((p.debuffUntil - Date.now()) / 1000));
    return remaining > 0 ? remaining : null;
  });

  // Beam endpoints for SVG — viewBox matches arena aspect ratio (700x394)
  private beamPoints = [
    { x: 690, y: 685 },  // C1 - bottom
    { x: 216, y: 363 },  // C2 - left
    { x: 512, y: 59 },   // C3 - top-left
    { x: 884, y: 59 },   // C4 - top-right
    { x: 1171, y: 363 }, // C5 - right
  ];

  beamX(index: number): number {
    return this.beamPoints[index].x;
  }

  beamY(index: number): number {
    return this.beamPoints[index].y;
  }
}
