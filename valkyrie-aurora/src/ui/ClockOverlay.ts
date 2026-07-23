import { settingsStore } from '../config/settings';

export class ClockOverlay {
  private clockContainer: HTMLElement | null = null;
  private timeEl: HTMLElement | null = null;
  private ampmEl: HTMLElement | null = null;
  private dateEl: HTMLElement | null = null;
  private audioStateTextEl: HTMLElement | null = null;

  private timerId: number | null = null;

  constructor() {
    this.clockContainer = document.getElementById('clock-container');
    this.timeEl = document.getElementById('clock-time');
    this.ampmEl = document.getElementById('clock-ampm');
    this.dateEl = document.getElementById('clock-date');
    this.audioStateTextEl = document.getElementById('audio-state-text');

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

    // Date formatting (e.g., "Thursday, July 23")
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    };
    this.dateEl.textContent = now.toLocaleDateString(undefined, options);
  }

  public setAudioStateText(text: string): void {
    if (this.audioStateTextEl) {
      this.audioStateTextEl.textContent = text;
    }
  }
}
