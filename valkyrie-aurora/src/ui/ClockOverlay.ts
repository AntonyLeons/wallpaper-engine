import { settingsStore } from '../config/settings';

export class ClockOverlay {
  private clockContainer: HTMLElement | null = null;
  private timeEl: HTMLElement | null = null;
  private ampmEl: HTMLElement | null = null;
  private dateEl: HTMLElement | null = null;
  private audioStateTextEl: HTMLElement | null = null;
  private eqBars: (HTMLElement | null)[] = [];

  private timerId: number | null = null;

  constructor() {
    this.clockContainer = document.getElementById('clock-container');
    this.timeEl = document.getElementById('clock-time');
    this.ampmEl = document.getElementById('clock-ampm');
    this.dateEl = document.getElementById('clock-date');
    this.audioStateTextEl = document.getElementById('audio-state-text');

    this.eqBars = [
      document.getElementById('eq-1'),
      document.getElementById('eq-2'),
      document.getElementById('eq-3'),
      document.getElementById('eq-4'),
    ];

    this.startClock();
  }

  public updateVisibility(): void {
    const settings = settingsStore.current;
    if (!this.clockContainer) return;

    if (settings.showClock) {
      this.clockContainer.classList.remove('hidden');
    } else {
      this.clockContainer.classList.add('hidden');
    }

    this.updateClock();
  }

  private startClock(): void {
    this.updateClock();
    this.timerId = window.setInterval(() => this.updateClock(), 1000);
  }

  public stopClock(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  public updateClock(): void {
    if (!this.timeEl || !this.dateEl) return;

    const settings = settingsStore.current;
    const now = new Date();

    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    let ampm = '';

    if (settings.clockFormat === '12h') {
      ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      if (hours === 0) hours = 12;
    }

    const hoursStr = hours.toString().padStart(2, '0');
    const timeStr = settings.showSeconds
      ? `${hoursStr}:${minutes}:${seconds}`
      : `${hoursStr}:${minutes}`;

    this.timeEl.textContent = timeStr;
    if (this.ampmEl) {
      this.ampmEl.textContent = settings.clockFormat === '12h' ? ampm : '';
    }

    // Date formatting (e.g. "Tuesday, August 18")
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    };
    this.dateEl.textContent = now.toLocaleDateString(undefined, options);
  }

  public updateAudioStatus(audioLevel: number): void {
    if (this.eqBars.length === 0) return;

    const isLive = audioLevel > 0.02;
    if (this.audioStateTextEl) {
      this.audioStateTextEl.textContent = isLive ? 'AUDIO SYNC' : 'VALKYRIE IDLE';
    }

    for (let i = 0; i < this.eqBars.length; i++) {
      const bar = this.eqBars[i];
      if (bar) {
        const heightPercent = isLive
          ? Math.min(100, Math.max(15, (audioLevel * (1.2 + i * 0.4) + Math.sin(Date.now() * 0.01 + i) * 0.2) * 100))
          : 20;
        bar.style.height = `${heightPercent}%`;
      }
    }
  }

  public setAudioStateText(text: string): void {
    if (this.audioStateTextEl) {
      this.audioStateTextEl.textContent = text;
    }
  }
}
