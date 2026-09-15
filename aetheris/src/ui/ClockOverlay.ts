import { AppSettings } from '../config/settings';
import { WallpaperMediaProperties } from '../types/wallpaper';

export class ClockOverlay {
  private containerEl: HTMLElement | null = null;
  private timeEl: HTMLElement | null = null;
  private dateEl: HTMLElement | null = null;
  private mediaEl: HTMLElement | null = null;

  private lastFormattedTime = '14:30:00';
  private lastFormattedDate = 'THURSDAY, 23 JUL';
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

  private applyPosition(settings: AppSettings): void {
    if (!this.containerEl) return;

    const bottomOffset = settings.taskbarOffset + 24;

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

    if (!settings.showClock) {
      this.containerEl.style.opacity = '0';
      this.containerEl.style.pointerEvents = 'none';
      return;
    }

    this.containerEl.style.opacity = '1';
    this.containerEl.style.pointerEvents = 'auto';

    // Position updates (memoized to avoid DOM thrashing)
    const posKey = `${settings.clockPosition}_${settings.clockPositionX}_${settings.clockPositionY}_${settings.taskbarOffset}`;
    if (posKey !== this.lastPositionKey) {
      this.applyPosition(settings);
      this.lastPositionKey = posKey;
    }

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
    const secondsStr = settings.showSeconds ? `:${seconds}` : '';
    const timeStr = `${hoursStr}:${minutes}${secondsStr}${ampm}`;

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

  public renderToCanvas(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    settings: AppSettings
  ): void {
    if (!settings.showClock) return;

    ctx.save();

    const p = settings.primaryColor;
    const cardWidth = Math.min(420, width * 0.8);
    const cardHeight = 110;
    const bottomOffset = settings.taskbarOffset + 24;

    let cx = width * 0.5;
    let cy = height * 0.10 + cardHeight * 0.5;

    switch (settings.clockPosition) {
      case 'top_left':
        cx = width * 0.04 + cardWidth * 0.5;
        cy = height * 0.10 + cardHeight * 0.5;
        break;
      case 'top_right':
        cx = width * 0.96 - cardWidth * 0.5;
        cy = height * 0.10 + cardHeight * 0.5;
        break;
      case 'center':
        cx = width * 0.5;
        cy = height * 0.5;
        break;
      case 'bottom_center':
        cx = width * 0.5;
        cy = height - bottomOffset - cardHeight * 0.5;
        break;
      case 'bottom_left':
        cx = width * 0.04 + cardWidth * 0.5;
        cy = height - bottomOffset - cardHeight * 0.5;
        break;
      case 'bottom_right':
        cx = width * 0.96 - cardWidth * 0.5;
        cy = height - bottomOffset - cardHeight * 0.5;
        break;
      case 'custom':
        cx = (settings.clockPositionX / 100) * (width - cardWidth) + cardWidth * 0.5;
        cy = (settings.clockPositionY / 100) * (height - cardHeight) + cardHeight * 0.5;
        break;
      case 'top_center':
      default:
        cx = width * 0.5;
        cy = height * 0.10 + cardHeight * 0.5;
        break;
    }

    const rx = cx - cardWidth / 2;
    const ry = cy - cardHeight / 2;

    const timeText = this.lastFormattedTime || '14:30:00';
    const dateText = this.lastFormattedDate || 'THURSDAY, 23 JUL';
    const mediaText = this.mediaTitle
      ? (this.mediaArtist ? `🎵 ${this.mediaTitle} — ${this.mediaArtist}` : `🎵 ${this.mediaTitle}`)
      : '🎵 Solar Drift — Aetheris';

    // Glassmorphism Card Backdrop
    ctx.fillStyle = 'rgba(10, 12, 24, 0.45)';
    ctx.beginPath();
    ctx.roundRect(rx, ry, cardWidth, cardHeight, 18);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Time Text
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = `rgba(${p.r}, ${p.g}, ${p.b}, 0.6)`;
    ctx.shadowBlur = 15;
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(timeText, cx, ry + 10);

    // Date Text
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = '500 14px system-ui, sans-serif';
    ctx.fillText(dateText.toUpperCase(), cx, ry + 60);

    // Media Badge
    ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, 0.95)`;
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(mediaText, cx, ry + 82);

    ctx.restore();
  }
}
