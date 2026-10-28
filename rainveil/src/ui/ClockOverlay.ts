import { AppSettings } from '../config/settings';
import { WallpaperMediaProperties } from '../types/wallpaper';

export class ClockOverlay {
  private containerEl: HTMLElement | null = null;
  private digitsEl: HTMLElement | null = null;
  private secondsEl: HTMLElement | null = null;
  private dateEl: HTMLElement | null = null;
  private mediaEl: HTMLElement | null = null;

  private lastFormattedTime = '';
  private lastFormattedDate = '';
  private lastTick = -1;
  private lastFormat = '';
  private lastShowSeconds: boolean | null = null;
  private lastPositionKey = '';
  private lastAccentKey = '';
  private visible: boolean | null = null;

  private mediaTitle = '';
  private mediaArtist = '';

  private readonly dateFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  constructor() {
    this.createDOM();
    this.initMediaListener();
  }

  private createDOM(): void {
    this.containerEl = document.createElement('div');
    this.containerEl.id = 'clock-container';
    this.containerEl.className = 'clock-hud';

    const label = document.createElement('div');
    label.className = 'clock-label';
    label.textContent = 'Rainveil';

    const timeEl = document.createElement('div');
    timeEl.className = 'clock-time';

    this.digitsEl = document.createElement('span');
    this.digitsEl.className = 'clock-digits';

    this.secondsEl = document.createElement('span');
    this.secondsEl.className = 'clock-seconds';

    timeEl.append(this.digitsEl, this.secondsEl);

    this.dateEl = document.createElement('div');
    this.dateEl.className = 'clock-date';

    this.mediaEl = document.createElement('div');
    this.mediaEl.className = 'clock-media';
    this.mediaEl.style.display = 'none';

    this.containerEl.append(label, timeEl, this.dateEl, this.mediaEl);
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
      this.mediaEl.textContent = this.mediaArtist
        ? `${this.mediaTitle} — ${this.mediaArtist}`
        : this.mediaTitle;
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
        this.containerEl.style.top = '8%';
        this.containerEl.style.right = 'auto';
        this.containerEl.style.bottom = 'auto';
        this.containerEl.style.transform = 'none';
        break;

      case 'top_right':
        this.containerEl.style.left = 'auto';
        this.containerEl.style.top = '8%';
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
        this.containerEl.style.top = '8%';
        this.containerEl.style.right = 'auto';
        this.containerEl.style.bottom = 'auto';
        this.containerEl.style.transform = 'translateX(-50%)';
        break;
    }
  }

  public update(settings: AppSettings): void {
    if (!this.containerEl || !this.digitsEl || !this.secondsEl || !this.dateEl) return;

    if (this.visible !== settings.showClock) {
      this.visible = settings.showClock;
      this.containerEl.style.opacity = settings.showClock ? '1' : '0';
      this.containerEl.style.pointerEvents = 'none';
    }
    if (!settings.showClock) return;

    const posKey = `${settings.clockPosition}_${settings.clockPositionX}_${settings.clockPositionY}_${settings.taskbarOffset}`;
    if (posKey !== this.lastPositionKey) {
      this.applyPosition(settings);
      this.lastPositionKey = posKey;
    }

    const p = settings.primaryColor;
    const accentKey = `${p.r},${p.g},${p.b}`;
    if (accentKey !== this.lastAccentKey) {
      this.lastAccentKey = accentKey;
      this.containerEl.style.setProperty('--accent', `rgb(${p.r}, ${p.g}, ${p.b})`);
      this.containerEl.style.setProperty('--accent-soft', `rgba(${p.r}, ${p.g}, ${p.b}, 0.34)`);
      this.containerEl.style.setProperty('--accent-faint', `rgba(${p.r}, ${p.g}, ${p.b}, 0.12)`);
    }

    const timestamp = Date.now();
    const tick = Math.floor(timestamp / 1000);
    if (
      tick === this.lastTick &&
      settings.clockFormat === this.lastFormat &&
      settings.showSeconds === this.lastShowSeconds
    ) {
      return;
    }
    this.lastTick = tick;
    this.lastFormat = settings.clockFormat;
    this.lastShowSeconds = settings.showSeconds;

    const now = new Date(timestamp);
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    let suffix = '';

    if (settings.clockFormat === '12h') {
      suffix = hours >= 12 ? ' PM' : ' AM';
      hours = hours % 12 || 12;
    }

    const hoursStr = String(hours).padStart(2, '0');
    const timeKey = `${hoursStr}:${minutes}${settings.showSeconds ? `:${seconds}` : ''}${suffix}`;

    if (timeKey !== this.lastFormattedTime) {
      this.digitsEl.textContent = `${hoursStr}:${minutes}`;
      this.secondsEl.textContent = settings.showSeconds ? `:${seconds}${suffix}` : suffix;
      this.lastFormattedTime = timeKey;
    }

    const dateStr = this.dateFormatter.format(now).toUpperCase();
    if (dateStr !== this.lastFormattedDate) {
      this.dateEl.textContent = dateStr;
      this.lastFormattedDate = dateStr;
    }
  }
}
