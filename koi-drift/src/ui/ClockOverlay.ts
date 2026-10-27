import { AppSettings } from '../config/settings';
import { WallpaperMediaProperties } from '../types/wallpaper';

export class ClockOverlay {
  private containerEl: HTMLElement | null = null;
  private timeEl: HTMLElement | null = null;
  private digitsEl: HTMLElement | null = null;
  private secondsEl: HTMLElement | null = null;
  private lastTick = -1;
  private lastClockFormat = '';
  private lastShowSeconds = false;
  private visible: boolean | null = null;
  private readonly dateFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  private dateEl: HTMLElement | null = null;
  private mediaEl: HTMLElement | null = null;

  private lastFormattedTime = '';
  private lastFormattedDate = '';
  private mediaTitle = '';
  private mediaArtist = '';
  private lastPositionKey = '';

  constructor() {
    this.createDOM();
    this.initMediaListener();
  }

  private createDOM(): void {
    this.containerEl = document.createElement('div');
    this.containerEl.id = 'clock-container';
    this.containerEl.className = 'clock-hud';

    this.dateEl = document.createElement('div');
    this.dateEl.id = 'clock-date';
    this.dateEl.className = 'clock-date';

    this.timeEl = document.createElement('div');
    this.timeEl.id = 'clock-time';
    this.timeEl.className = 'clock-time';
    this.digitsEl = document.createElement('span');
    this.secondsEl = document.createElement('span');
    this.secondsEl.className = 'clock-seconds';
    this.timeEl.append(this.digitsEl, this.secondsEl);

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
          this.mediaTitle = typeof props?.title === 'string' ? props.title : '';
          this.mediaArtist = typeof props?.artist === 'string' ? props.artist : '';
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
      const text = this.mediaArtist ? `${this.mediaTitle} Â· ${this.mediaArtist}` : this.mediaTitle;
      this.mediaEl.textContent = text;
      this.mediaEl.style.display = 'block';
    } else {
      this.mediaEl.style.display = 'none';
    }
  }

  private applyPosition(settings: AppSettings): void {
    if (!this.containerEl) return;

    const bottomOffset = settings.taskbarOffset + 32;
    this.containerEl.dataset.position = settings.clockPosition;

    switch (settings.clockPosition) {
      case 'top_left':
        this.containerEl.style.left = '4%';
        this.containerEl.style.top = '10%';
        this.containerEl.style.right = 'auto';
        this.containerEl.style.bottom = 'auto';
        this.containerEl.style.transform = 'none';
        break;

      case 'top_right':
        this.containerEl.style.left = 'auto';
        this.containerEl.style.top = '10%';
        this.containerEl.style.right = '4%';
        this.containerEl.style.bottom = 'auto';
        this.containerEl.style.transform = 'none';
        break;

      case 'center':
        this.containerEl.style.left = '50%';
        this.containerEl.style.top = '50%';
        this.containerEl.style.right = 'auto';
        this.containerEl.style.bottom = 'auto';
        this.containerEl.style.transform = 'translate(-50%, -50%)';
        break;

      case 'bottom_center':
        this.containerEl.style.left = '50%';
        this.containerEl.style.top = 'auto';
        this.containerEl.style.right = 'auto';
        this.containerEl.style.bottom = `${bottomOffset}px`;
        this.containerEl.style.transform = 'translateX(-50%)';
        break;

      case 'bottom_left':
        this.containerEl.style.left = '4%';
        this.containerEl.style.top = 'auto';
        this.containerEl.style.right = 'auto';
        this.containerEl.style.bottom = `${bottomOffset}px`;
        this.containerEl.style.transform = 'none';
        break;

      case 'bottom_right':
        this.containerEl.style.left = 'auto';
        this.containerEl.style.top = 'auto';
        this.containerEl.style.right = '4%';
        this.containerEl.style.bottom = `${bottomOffset}px`;
        this.containerEl.style.transform = 'none';
        break;

      case 'custom':
        this.containerEl.style.left = `${settings.clockPositionX}%`;
        this.containerEl.style.top = `${settings.clockPositionY}%`;
        this.containerEl.style.right = 'auto';
        this.containerEl.style.bottom = 'auto';
        this.containerEl.style.transform = `translate(-${settings.clockPositionX}%, -${settings.clockPositionY}%)`;
        break;

      case 'top_center':
      default:
        this.containerEl.style.left = '50%';
        this.containerEl.style.top = '10%';
        this.containerEl.style.right = 'auto';
        this.containerEl.style.bottom = 'auto';
        this.containerEl.style.transform = 'translateX(-50%)';
        break;
    }
  }

  public update(settings: AppSettings): void {
    if (!this.containerEl || !this.timeEl || !this.dateEl) return;

    if (this.visible !== settings.showClock) {
      this.visible = settings.showClock;
      this.containerEl.style.opacity = settings.showClock ? '1' : '0';
    }
    if (!settings.showClock) return;

    // Position updates (memoized to avoid DOM thrashing)
    const posKey = `${settings.clockPosition}_${settings.clockPositionX}_${settings.clockPositionY}_${settings.taskbarOffset}`;
    if (posKey !== this.lastPositionKey) {
      this.applyPosition(settings);
      this.lastPositionKey = posKey;
    }

    const timestamp = Date.now();
    const tick = Math.floor(timestamp / 1000);
    if (tick === this.lastTick && settings.clockFormat === this.lastClockFormat
      && settings.showSeconds === this.lastShowSeconds) return;
    this.lastTick = tick;
    this.lastClockFormat = settings.clockFormat;
    this.lastShowSeconds = settings.showSeconds;
    const now = new Date(timestamp);

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
    const secondsStr = settings.showSeconds ? `:${seconds}` : '';
    const timeStr = `${hoursStr}:${minutes}${secondsStr}${ampm}`;

    if (timeStr !== this.lastFormattedTime) {
      if (this.digitsEl) this.digitsEl.textContent = `${hoursStr}:${minutes}`;
      if (this.secondsEl) this.secondsEl.textContent = `${secondsStr}${ampm}`;
      this.lastFormattedTime = timeStr;
    }

    const dateStr = this.dateFormatter.format(now);

    if (dateStr !== this.lastFormattedDate) {
      this.dateEl.textContent = dateStr.toUpperCase();
      this.lastFormattedDate = dateStr;
    }
  }
}
