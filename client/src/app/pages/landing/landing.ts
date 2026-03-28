import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
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
  }

  ngAfterViewInit(): void {
    if (this.focusJoinName && this.playerNameInput) {
      setTimeout(() => this.playerNameInput!.nativeElement.focus());
    }
  }

  async createRoom(): Promise<void> {
    if (!this.createName.trim()) {
      this.error = 'Enter your character name';
      return;
    }
    this.loading = true;
    this.error = '';

    try {
      const { roomId } = await this.socketService.createRoom();
      const name = this.createName.trim();
      const result = await this.socketService.joinRoom(roomId, name);
      if (result.success) {
        localStorage.setItem('characterName', name);
        this.router.navigate(['/room', roomId]);
      } else {
        this.error = result.error || 'Failed to create room';
      }
    } catch {
      this.error = 'Connection failed. Try again.';
    } finally {
      this.loading = false;
    }
  }

  async joinRoom(): Promise<void> {
    if (!this.joinCode.trim()) {
      this.error = 'Enter a room code';
      return;
    }
    if (!this.playerName.trim()) {
      this.error = 'Enter your character name';
      return;
    }
    this.loading = true;
    this.error = '';

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
        this.error = result.error || 'Failed to join room';
      }
    } catch {
      this.error = 'Connection failed. Try again.';
    } finally {
      this.loading = false;
    }
  }
}
