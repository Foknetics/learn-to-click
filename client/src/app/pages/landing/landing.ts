import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, NgZone, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SocketService } from '../../services/socket.service';

@Component({
  selector: 'app-landing',
  imports: [FormsModule],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing implements OnInit, AfterViewInit {
  joinCode = '';
  playerName = '';
  createName = '';
  error = '';
  loading = false;
  private focusJoinName = false;

  @ViewChild('playerNameInput') playerNameInput?: ElementRef<HTMLInputElement>;

  constructor(
    private socketService: SocketService,
    private route: ActivatedRoute,
    private router: Router,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {
    this.socketService.connect();
  }

  ngOnInit(): void {
    const saved = localStorage.getItem('characterName');
    if (saved) {
      this.createName = saved;
      this.playerName = saved;
    }

    const joinParam = this.route.snapshot.queryParamMap.get('join');
    if (joinParam) {
      this.joinCode = joinParam.toUpperCase();
      this.focusJoinName = true;
    }

    this.socketService.socketError.subscribe(({ message }) => {
      this.zone.run(() => {
        this.setError(message);
        this.setLoading(false);
      });
    });
  }

  ngAfterViewInit(): void {
    if (this.focusJoinName && this.playerNameInput) {
      setTimeout(() => this.playerNameInput!.nativeElement.focus());
    }
  }

  private setLoading(value: boolean): void {
    this.loading = value;
    this.cdr.detectChanges();
  }

  private setError(message: string): void {
    this.error = message;
    this.cdr.detectChanges();
  }

  async createRoom(): Promise<void> {
    if (!this.createName.trim()) {
      this.setError('Enter your character name');
      return;
    }
    this.setLoading(true);
    this.setError('');

    try {
      const { roomId } = await this.socketService.createRoom();
      const name = this.createName.trim();
      const result = await this.socketService.joinRoom(roomId, name);
      if (result.success) {
        localStorage.setItem('characterName', name);
        this.router.navigate(['/room', roomId]);
      } else {
        this.setError(result.error || 'Failed to create room');
      }
    } catch {
      this.setError('Connection failed. Try again.');
    } finally {
      this.setLoading(false);
    }
  }

  async joinRoom(): Promise<void> {
    if (!this.joinCode.trim()) {
      this.setError('Enter a room code');
      return;
    }
    if (!this.playerName.trim()) {
      this.setError('Enter your character name');
      return;
    }
    this.setLoading(true);
    this.setError('');

    try {
      const name = this.playerName.trim();
      const result = await this.socketService.joinRoom(
        this.joinCode.trim().toUpperCase(),
        name,
      );
      if (result.success) {
        localStorage.setItem('characterName', name);
        this.router.navigate(['/room', this.joinCode.trim().toUpperCase()]);
      } else {
        this.setError(result.error || 'Failed to join room');
      }
    } catch {
      this.setError('Connection failed. Try again.');
    } finally {
      this.setLoading(false);
    }
  }
}
