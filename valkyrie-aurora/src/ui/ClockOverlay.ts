import { settingsStore } from '../config/settings';

export class ClockOverlay {
  private container = document.getElementById('clock-container');
  private time = document.getElementById('clock-time');
  private ampm = document.getElementById('clock-ampm');
  private date = document.getElementById('clock-date');
  private dateFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  constructor() {
    this.updateClock();
    window.setInterval(() => { if (!document.hidden && settingsStore.current.showClock) this.updateClock(); }, 1000);
  }
  updateVisibility(): void {
    this.container?.classList.toggle('hidden', !settingsStore.current.showClock);
    this.updateClock();
  }
  updateClock(): void {
    const s = settingsStore.current;
    const now = new Date();
    const hours = s.clockFormat === '12h' ? now.getHours() % 12 || 12 : now.getHours();
    const value = `${String(hours).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}${s.showSeconds ? ':' + String(now.getSeconds()).padStart(2, '0') : ''}`;
    if (this.time && this.time.textContent !== value) this.time.textContent = value;
    if (this.ampm) this.ampm.textContent = s.clockFormat === '12h' ? now.getHours() >= 12 ? 'PM' : 'AM' : '';
    const date = this.dateFormatter.format(now);
    if (this.date && this.date.textContent !== date) this.date.textContent = date;
  }
}
