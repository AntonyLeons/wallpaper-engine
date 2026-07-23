import { AppSettings } from '../config/settings';
import { WallpaperMediaProperties } from '../types/wallpaper';

export class ClockOverlay {
  private containerEl: HTMLElement | null = null;
  private timeEl: HTMLElement | null = null;
  private dateEl: HTMLElement | null = null;
  private mediaEl: HTMLElement | null = null;

  private lastFormattedTime = '';
  private lastFormattedDate = '';
  private mediaTitle = '';
  private mediaArtist = '';

  constructor() {
    this.createDOM();
    this.initMediaListener();
  }

  private createDOM(): void {
    this.containerEl = document.createElement('div');
    this.containerEl.id = 'clock-container';
    this.containerEl.className = 'clock-hud';

    this.timeEl = document.createElement('div');
    this.timeEl.id = 'clock-time';
    this.timeEl.className = 'clock-time';

    this.dateEl = document.createElement('div');
    this.dateEl.id = 'clock-date';
    this.dateEl.className = 'clock-date';

    this.mediaEl = document.createElement('div');
    this.mediaEl.id = 'clock-media';
    this.mediaEl.className = 'clock-media';
    this.mediaEl.style.display = 'none';

    this.containerEl.appendChild(this.timeEl);
    this.containerEl.appendChild(this.dateEl);
    this.containerEl.appendChild(this.mediaEl);

    document.body.appendChild(this.containerEl);
  }

  private initMediaListener(): void {
    if (typeof window !== 'undefined' && window.wallpaperRegisterMediaPropertiesListener) {
      try {
        window.wallpaperRegisterMediaPropertiesListener((props: WallpaperMediaProperties) => {
          this.mediaTitle = props.title || '';
          this.mediaArtist = props.artist || '';
          this.updateMediaDisplay();
        });
      } catch (err) {
        console.warn('Media listener error:', err);
      }
    }
  }

  private updateMediaDisplay(): void {
    if (!this.mediaEl) return;

    if (this.mediaTitle) {
      const text = this.mediaArtist ? `🎵 ${this.mediaTitle} — ${this.mediaArtist}` : `🎵 ${this.mediaTitle}`;
      this.mediaEl.textContent = text;
      this.mediaEl.style.display = 'block';
    } else {
      this.mediaEl.style.display = 'none';
    }
  }

  public update(settings: AppSettings): void {
    if (!this.containerEl || !this.timeEl || !this.dateEl) return;

    if (!settings.showClock) {
      this.containerEl.style.opacity = '0';
      this.containerEl.style.pointerEvents = 'none';
      return;
    }

    this.containerEl.style.opacity = '1';
    this.containerEl.style.pointerEvents = 'auto';

    const now = new Date();

    // Format Time
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    let ampm = '';

    if (settings.clockFormat === '12h') {
      ampm = hours >= 12 ? ' PM' : ' AM';
      hours = hours % 12 || 12;
    }

    const hoursStr = String(hours).padStart(2, '0');
    const timeStr = `${hoursStr}:${minutes}:${seconds}${ampm}`;

    if (timeStr !== this.lastFormattedTime) {
      this.timeEl.textContent = timeStr;
      this.lastFormattedTime = timeStr;
    }

    // Format Date
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    };
    const dateStr = now.toLocaleDateString(undefined, options);

    if (dateStr !== this.lastFormattedDate) {
      this.dateEl.textContent = dateStr;
      this.lastFormattedDate = dateStr;
    }

    // Dynamic color matching primary accent
    const p = settings.primaryColor;
    this.timeEl.style.textShadow = `0 0 20px rgba(${p.r}, ${p.g}, ${p.b}, 0.5), 0 0 40px rgba(${p.r}, ${p.g}, ${p.b}, 0.2)`;
  }
}
