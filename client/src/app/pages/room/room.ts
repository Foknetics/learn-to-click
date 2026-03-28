import { Component, OnInit, OnDestroy, computed, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { SocketService } from '../../services/socket.service';
import { RoomState, EncounterState, Player, Assignment, RaidMarker, RAID_MARKERS } from '@learn-to-click/shared';
import { Arena } from '../../components/arena/arena';
import { AssignmentGrid } from '../../components/assignment-grid/assignment-grid';

@Component({
  selector: 'app-room',
  imports: [FormsModule, TitleCasePipe, RouterLink, Arena, AssignmentGrid],
  templateUrl: './room.html',
  styleUrl: './room.scss',
})
export class Room implements OnInit, OnDestroy {
  roomState = signal<RoomState | null>(null);
  deathMessage = signal<string | null>(null);

  fojiInput = '';
  blastWaveInitialDelaySeconds = 60;
  blastWaveSeconds = 60;
  blastWaveRandomSeconds = 10;
  showCopied = false;
  raidersExpanded: boolean | null = null;

  raidMarkers = RAID_MARKERS;

  private subs: Subscription[] = [];

  isLeader = computed(() => {
    const state = this.roomState();
    return state?.leaderId === this.socketService.socketId;
  });

  myPlayer = computed(() => {
    const state = this.roomState();
    return state?.players.find(p => p.id === this.socketService.socketId) ?? null;
  });

  encounterActive = computed(() => {
    return this.roomState()?.encounter.status === 'active';
  });

  encounterEnded = computed(() => {
    return this.roomState()?.encounter.status === 'ended';
  });

  sortedPlayers = computed(() => {
    const state = this.roomState();
    if (!state) return [];
    return [...state.players].sort((a, b) => a.name.localeCompare(b.name));
  });

  constructor(
    public socketService: SocketService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.socketService.connect();

    this.subs.push(
      this.socketService.roomState.subscribe(state => {
        if (state) {
          this.roomState.set(state);
          this.blastWaveInitialDelaySeconds = state.config.blastWaveInitialDelay / 1000;
          this.blastWaveSeconds = state.config.blastWaveInterval / 1000;
          this.blastWaveRandomSeconds = state.config.blastWaveRandomRange / 1000;

          // Clear death overlay when encounter resets to waiting
          if (state.encounter.status === 'waiting') {
            this.deathMessage.set(null);
          }

          // Set raiders panel default: expanded for non-leaders, collapsed for leaders
          if (this.raidersExpanded === null) {
            this.raidersExpanded = state.leaderId !== this.socketService.socketId;
          }
        }
      }),
    );

    this.subs.push(
      this.socketService.encounterEnded.subscribe(({ reason }) => {
        this.deathMessage.set(reason);
      }),
    );

    this.subs.push(
      this.socketService.socketError.subscribe(({ message }) => {
        if (message.includes('not in a room') || message.includes('Room not found')) {
          this.router.navigate(['/']);
        }
      }),
    );

    // If user navigated directly to a room URL without joining, redirect to landing with room code
    setTimeout(() => {
      if (!this.roomState()) {
        this.router.navigate(['/'], { queryParams: { join: this.roomId } });
      }
    }, 1500);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  get roomId(): string {
    return this.route.snapshot.paramMap.get('roomId') ?? '';
  }

  get roomLink(): string {
    return `${window.location.origin}/?join=${this.roomId}`;
  }

  copyRoomCode(): void {
    navigator.clipboard.writeText(this.roomLink);
    this.showCopied = true;
    setTimeout(() => (this.showCopied = false), 2000);
  }

  async applyAssignments(): Promise<void> {
    if (!this.fojiInput.trim()) return;
    const result = await this.socketService.setAssignments(this.fojiInput.trim());
    if (!result.success) {
      console.error('Failed to set assignments:', result.error);
    }
  }

  updateBlastWaveTimer(): void {
    const initialDelay = Math.max(1, Math.min(300, this.blastWaveInitialDelaySeconds)) * 1000;
    const interval = Math.max(1, Math.min(300, this.blastWaveSeconds)) * 1000;
    const randomRange = Math.max(0, Math.min(30, this.blastWaveRandomSeconds)) * 1000;
    this.socketService.updateConfig({ blastWaveInitialDelay: initialDelay, blastWaveInterval: interval, blastWaveRandomRange: randomRange });
  }

  updateCubeMarker(cubeIndex: number, marker: string): void {
    const state = this.roomState();
    if (!state) return;
    const markers = [...state.config.cubeMarkers] as [string, string, string, string, string];
    markers[cubeIndex] = marker;
    this.socketService.updateConfig({ cubeMarkers: markers });
  }

  startEncounter(): void {
    this.deathMessage.set(null);
    this.socketService.startEncounter();
  }

  resetEncounter(): void {
    this.deathMessage.set(null);
    this.socketService.resetEncounter();
  }

  onCubeClick(cubeIndex: number): void {
    this.socketService.clickCube(cubeIndex);
  }

  leaveRoom(): void {
    this.socketService.leaveRoom();
    this.router.navigate(['/']);
  }
}
