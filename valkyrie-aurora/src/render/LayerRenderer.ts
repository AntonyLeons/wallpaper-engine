import { settingsStore } from '../config/settings';
import { audioProcessor } from '../audio/AudioProcessor';

/** Only transparent atmosphere is redrawn; the painting stays in a compositor layer. */
export class LayerRenderer {
  private ctx: CanvasRenderingContext2D | null;
  private scene = document.getElementById('scene');
  private time = 0;
  private pointerX = 0;
  private pointerY = 0;
  private x = 0;
  private y = 0;
  private audio = 0;
  private particles = Array.from({ length: 96 }, (_, i) => ({
    x: ((i * 7919 + 173) % 10007) / 10007,
    y: ((i * 3571 + 617) % 10009) / 10009,
    phase: i * 2.39996,
    size: .55 + (i % 5) * .23,
  }));
  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d');
    window.addEventListener('pointermove', e => {
      this.pointerX = e.clientX / innerWidth - .5;
      this.pointerY = e.clientY / innerHeight - .5;
    }, { passive: true });
    document.addEventListener('pointerleave', () => { this.pointerX = this.pointerY = 0; });
    this.resize();
  }
  resize(): void {
    const scale = Math.min(1, 1280 / innerWidth, 800 / innerHeight);
    this.canvas.width = Math.round(innerWidth * scale);
    this.canvas.height = Math.round(innerHeight * scale);
  }
  render(dt: number): void {
    const s = settingsStore.current;
    this.time += dt;
    const t = this.time;
    const smooth = 1 - Math.exp(-dt * 3);
    this.x += (this.pointerX * s.parallaxIntensity * 9 - this.x) * smooth;
    this.y += (this.pointerY * s.parallaxIntensity * 6 - this.y) * smooth;
    if (this.scene) this.scene.style.transform = `translate3d(${this.x.toFixed(2)}px, ${(this.y + Math.sin(t * .23) * s.breathingIntensity * 1.2).toFixed(2)}px, 0)`;
    const target = s.audioReactive && s.visualizerStyle !== 'off' && performance.now() - audioProcessor.lastReceived < 1000
      ? audioProcessor.overall * s.audioSensitivity : 0;
    this.audio += (target - this.audio) * (1 - Math.exp(-dt * 4));
    const c = this.ctx;
    if (!c) return;
    const w = this.canvas.width, h = this.canvas.height;
    c.clearRect(0, 0, w, h);
    const p = s.primaryColor;
    c.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
    const count = Math.min(96, Math.round(s.particleCount * .32));
    for (let i = 0; i < count; i++) {
      const a = this.particles[i];
      const px = (a.x + Math.sin(t * .08 + a.phase) * .012) * w;
      const py = ((a.y - t * .008 * s.particleSpeed * (1 + i % 3) % 1 + 1) % 1) * h;
      c.globalAlpha = (.12 + .23 * (.5 + .5 * Math.sin(t * .6 + a.phase))) * Math.min(1.5, s.auroraIntensity + this.audio);
      c.beginPath(); c.arc(px, py, a.size, 0, Math.PI * 2); c.fill();
    }
    if (s.showConstellations) {
      c.strokeStyle = `rgba(${p.r},${p.g},${p.b},.16)`; c.lineWidth = .65;
      c.beginPath(); c.moveTo(w * .09, h * .18); c.lineTo(w * .15, h * .12); c.lineTo(w * .21, h * .17); c.lineTo(w * .24, h * .09); c.stroke();
    }
    if (s.showMeteors && t % 19 < 1.2) {
      const phase = (t % 19) / 1.2;
      c.globalAlpha = Math.sin(phase * Math.PI) * .45;
      c.strokeStyle = '#d8eeff'; c.lineWidth = 1;
      c.beginPath(); c.moveTo((.22 + phase * .16) * w, (.08 + phase * .13) * h); c.lineTo((.185 + phase * .16) * w, (.052 + phase * .13) * h); c.stroke();
    }
    if (this.audio > .005 && s.haloGlowIntensity > 0) {
      c.globalAlpha = Math.min(.5, this.audio * s.haloGlowIntensity);
      c.strokeStyle = `rgb(${s.secondaryColor.r},${s.secondaryColor.g},${s.secondaryColor.b})`; c.lineWidth = 1;
      c.beginPath();
      if (s.visualizerStyle === 'sacred_rings') {
        c.ellipse(w * .25, h * .79, w * .09, h * .025, 0, 0, Math.PI * 2);
      } else {
        for (let i = 0; i <= 48; i++) {
          const x = w * (.08 + i / 48 * .34);
          const y = h * .79 + Math.sin(i * (s.visualizerStyle === 'wave_pulse' ? .5 : .25) + t) * Math.sin(i / 48 * Math.PI) * this.audio * h * .035;
          if (s.visualizerStyle === 'bars') { c.moveTo(x, h * .8); c.lineTo(x, y); }
          else if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
        }
      }
      c.stroke();
    }
    c.globalAlpha = 1;
  }
}
