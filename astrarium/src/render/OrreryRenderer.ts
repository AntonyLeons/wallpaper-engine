import type { ColorRGB, PresetPalette } from '../config/settings';
import { AppSettings, PRESET_PALETTES } from '../config/settings';
import { AudioMetrics } from '../audio/AudioAnalyzer';
import { PointerState } from '../types/scene';
import { clamp, mulberry32, TAU } from './math';

interface Planet {
  orbit: number;
  rotation: number;
  tilt: number;
  angle: number;
  speed: number;
  size: number;
  color: string;
  tail: number;
}

interface Pulse {
  x: number;
  y: number;
  t: number;
  active: boolean;
}

interface Ring {
  f: number;
  tilt: number;
  speed: number;
}

const RINGS: Ring[] = [
  { f: 0.34, tilt: 0.30, speed: 0.10 },
  { f: 0.50, tilt: 0.46, speed: -0.075 },
  { f: 0.66, tilt: 0.60, speed: 0.055 },
];

const NUMERALS = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

export class OrreryRenderer {
  private time = 0;
  private cx = 0;
  private cy = 0;
  private R = 0;
  private parallaxX = 0;
  private parallaxY = 0;

  private dial = document.createElement('canvas');
  private dialSize = 0;
  private dialKey = '';
  private glow = document.createElement('canvas');
  private glowKey = '';
  private planets: Planet[] = [];
  private planetKey = '';
  private pulses: Pulse[] = Array.from({ length: 6 }, () => ({ x: 0, y: 0, t: 0, active: false }));
  private pulseIndex = 0;
  private spectrumGradient: CanvasGradient | null = null;
  private spectrumKey = '';

  private ensureDial(settings: AppSettings): void {
    const key = `${Math.round(this.R)}_${settings.preset}`;
    if (this.dialKey === key) return;
    this.dialKey = key;

    const R = this.R;
    const pad = R * 0.22;
    const size = Math.ceil(2 * (R + pad));
    this.dialSize = size;
    const scale = Math.min(1, 1536 / size);
    const backing = Math.max(1, Math.round(size * scale));
    this.dial.width = backing;
    this.dial.height = backing;
    const ctx = this.dial.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.translate(size / 2, size / 2);
    const palette = PRESET_PALETTES[settings.preset];

    ctx.strokeStyle = palette.brass;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = Math.max(1.5, R * 0.012);
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.stroke();

    ctx.globalAlpha = 0.32;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.965, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.9, 0, TAU);
    ctx.stroke();

    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * TAU - Math.PI / 2;
      const major = i % 5 === 0;
      const inner = major ? R * 0.855 : R * 0.885;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      ctx.globalAlpha = major ? 0.85 : 0.38;
      ctx.strokeStyle = major ? palette.brassLight : palette.brass;
      ctx.lineWidth = major ? Math.max(1.5, R * 0.008) : Math.max(0.7, R * 0.003);
      ctx.beginPath();
      ctx.moveTo(cos * inner, sin * inner);
      ctx.lineTo(cos * R * 0.945, sin * R * 0.945);
      ctx.stroke();
    }

    ctx.globalAlpha = 0.8;
    ctx.fillStyle = palette.dialText;
    ctx.font = `${Math.max(9, R * 0.072)}px Georgia, 'Times New Roman', serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * TAU - Math.PI / 2;
      ctx.fillText(NUMERALS[i], Math.cos(angle) * R * 0.785, Math.sin(angle) * R * 0.785);
    }

    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = palette.brass;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.7, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.685, 0, TAU);
    ctx.stroke();

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * TAU;
      ctx.globalAlpha = 0.14;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * R * 0.7, Math.sin(angle) * R * 0.7);
      ctx.lineTo(Math.cos(angle) * R * 0.86, Math.sin(angle) * R * 0.86);
      ctx.stroke();
    }

    ctx.globalAlpha = 0.25;
    ctx.fillStyle = palette.brassLight;
    for (let i = 0; i < 72; i++) {
      const angle = (i / 72) * TAU;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * R * 0.66, Math.sin(angle) * R * 0.66, Math.max(0.6, R * 0.003), 0, TAU);
      ctx.fill();
    }

    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = palette.brass;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.24, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private ensureGlow(settings: AppSettings): void {
    if (this.glowKey === settings.preset) return;
    this.glowKey = settings.preset;
    this.glow.width = 256;
    this.glow.height = 256;
    const ctx = this.glow.getContext('2d');
    if (!ctx) return;
    const rgb = PRESET_PALETTES[settings.preset].sunGlow;
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, `rgba(${rgb}, 0.9)`);
    gradient.addColorStop(0.22, `rgba(${rgb}, 0.38)`);
    gradient.addColorStop(0.6, `rgba(${rgb}, 0.08)`);
    gradient.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
  }

  private ensurePlanets(settings: AppSettings): void {
    const key = `${settings.planetCount}_${settings.preset}`;
    if (this.planetKey === key) return;
    this.planetKey = key;

    const palette = PRESET_PALETTES[settings.preset];
    const rng = mulberry32(7717);
    this.planets.length = 0;
    for (let i = 0; i < settings.planetCount; i++) {
      const orbit = 0.3 + ((i + 1) / Math.max(1, settings.planetCount)) * 0.34;
      this.planets.push({
        orbit,
        rotation: (rng() - 0.5) * 0.7,
        tilt: 0.44 + rng() * 0.22,
        angle: rng() * TAU,
        speed: (0.12 + rng() * 0.14) / (0.6 + orbit),
        size: 0.011 + rng() * 0.016,
        color: palette.planets[i % palette.planets.length],
        tail: 0.5 + rng() * 0.7,
      });
    }
  }

  private getSpectrumGradient(ctx: CanvasRenderingContext2D, settings: AppSettings): CanvasGradient {
    const p: ColorRGB = settings.primaryColor;
    const s: ColorRGB = settings.secondaryColor;
    const key = `${Math.round(this.cx)}_${Math.round(this.cy)}_${Math.round(this.R)}_${p.r}_${p.g}_${p.b}_${s.r}_${s.g}_${s.b}`;
    if (this.spectrumKey !== key || !this.spectrumGradient) {
      this.spectrumKey = key;
      const gradient = ctx.createLinearGradient(this.cx - this.R, this.cy - this.R, this.cx + this.R, this.cy + this.R);
      gradient.addColorStop(0, `rgba(${p.r}, ${p.g}, ${p.b}, 0.35)`);
      gradient.addColorStop(0.5, `rgba(${p.r}, ${p.g}, ${p.b}, 0.95)`);
      gradient.addColorStop(1, `rgba(${s.r}, ${s.g}, ${s.b}, 0.9)`);
      this.spectrumGradient = gradient;
    }
    return this.spectrumGradient;
  }

  private drawHand(ctx: CanvasRenderingContext2D, angle: number, length: number, width: number, color: string): void {
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-width * 2.2, -width * 0.6);
    ctx.lineTo(length * 0.25, -width * 0.55);
    ctx.lineTo(length, 0);
    ctx.lineTo(length * 0.25, width * 0.55);
    ctx.lineTo(-width * 2.2, width * 0.6);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(4, 8, 14, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-width * 2.2, 0, width * 1.1, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  public spawnPulse(x: number, y: number): void {
    const pulse = this.pulses[this.pulseIndex];
    pulse.x = x;
    pulse.y = y;
    pulse.t = 0;
    pulse.active = true;
    this.pulseIndex = (this.pulseIndex + 1) % this.pulses.length;
  }

  public update(dt: number, width: number, height: number, settings: AppSettings,
    audio: AudioMetrics, pointer: PointerState): void {
    this.time += dt;
    this.R = Math.min(Math.min(width, height) * 0.34, 620);

    const targetX = settings.mouseParallax && pointer.active ? (pointer.x - width * 0.5) * 0.018 : 0;
    const targetY = settings.mouseParallax && pointer.active ? (pointer.y - height * 0.5) * 0.018 : 0;
    const ease = Math.min(1, dt * 3);
    this.parallaxX += (targetX - this.parallaxX) * ease;
    this.parallaxY += (targetY - this.parallaxY) * ease;
    this.cx = width * 0.5 + this.parallaxX;
    this.cy = height * 0.5 + this.parallaxY;

    this.ensureDial(settings);
    this.ensureGlow(settings);
    this.ensurePlanets(settings);

    const energy = settings.audioReactive && audio.hasAudio ? audio.overall : 0;
    const motion = settings.orbitSpeed * (1 + energy * 0.7);
    for (const planet of this.planets) {
      planet.angle += planet.speed * motion * dt;
    }
    for (const pulse of this.pulses) {
      if (pulse.active) {
        pulse.t += dt * 0.9;
        if (pulse.t >= 1) pulse.active = false;
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, settings: AppSettings, audio: AudioMetrics): void {
    const palette: PresetPalette = PRESET_PALETTES[settings.preset];
    const R = this.R;
    const cx = this.cx;
    const cy = this.cy;
    const energy = settings.audioReactive && audio.hasAudio ? audio.overall : 0;
    const bass = settings.audioReactive && audio.hasAudio ? audio.bass : 0;
    const beat = settings.audioReactive && audio.hasAudio ? audio.beatPulse : 0;

    ctx.drawImage(this.dial, cx - this.dialSize / 2, cy - this.dialSize / 2, this.dialSize, this.dialSize);

    const p = settings.primaryColor;
    const s = settings.secondaryColor;
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = `rgb(${p.r}, ${p.g}, ${p.b})`;
    ctx.lineWidth = Math.max(1, R * 0.006);
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.995, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 0.14;
    ctx.strokeStyle = `rgb(${s.r}, ${s.g}, ${s.b})`;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.665, 0, TAU);
    ctx.stroke();
    ctx.restore();

    for (const planet of this.planets) {
      const rx = R * planet.orbit;
      const ry = rx * planet.tilt;
      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.strokeStyle = palette.brass;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, planet.rotation, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.32;
      ctx.lineWidth = Math.max(1.2, R * 0.005);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, planet.rotation, planet.angle - planet.tail, planet.angle);
      ctx.stroke();
      ctx.restore();
    }

    for (let i = 0; i < RINGS.length; i++) {
      const ring = RINGS[i];
      const rotation = this.time * ring.speed * settings.orbitSpeed + i * 0.7;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotation);
      ctx.beginPath();
      ctx.ellipse(0, 0, R * ring.f, R * ring.f * ring.tilt, 0, 0, TAU);
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = palette.brassDark;
      ctx.lineWidth = Math.max(2, R * 0.018);
      ctx.stroke();
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = palette.brassLight;
      ctx.lineWidth = Math.max(1, R * 0.006);
      ctx.stroke();
      ctx.restore();

      const t = this.time * ring.speed * 1.4 + i * 2.1;
      const ex = Math.cos(t) * R * ring.f;
      const ey = Math.sin(t) * R * ring.f * ring.tilt;
      const bx = cx + ex * Math.cos(rotation) - ey * Math.sin(rotation);
      const by = cy + ex * Math.sin(rotation) + ey * Math.cos(rotation);
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = palette.brassLight;
      ctx.beginPath();
      ctx.arc(bx, by, Math.max(2, R * 0.011), 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    const pulse = (bass * 0.35 + beat * 0.3) + Math.sin(this.time * 0.8) * 0.03;
    const glowRadius = R * 0.3 * (1 + pulse);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.7 + energy * 0.25;
    ctx.drawImage(this.glow, cx - glowRadius, cy - glowRadius, glowRadius * 2, glowRadius * 2);
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.time * 0.05);
    ctx.globalAlpha = 0.18 + energy * 0.2;
    ctx.strokeStyle = palette.sun;
    ctx.lineWidth = 1;
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * R * 0.075, Math.sin(angle) * R * 0.075);
      ctx.lineTo(Math.cos(angle) * R * 0.13 * (1 + pulse * 0.5), Math.sin(angle) * R * 0.13 * (1 + pulse * 0.5));
      ctx.stroke();
    }
    ctx.restore();

    const coreRadius = R * 0.052 * (1 + pulse * 0.25);
    const core = ctx.createRadialGradient(cx - coreRadius * 0.3, cy - coreRadius * 0.3, 0, cx, cy, coreRadius);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.4, palette.sun);
    core.addColorStop(1, `rgba(${palette.sunGlow}, 0.25)`);
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, coreRadius, 0, TAU);
    ctx.fill();

    for (const planet of this.planets) {
      const rx = R * planet.orbit;
      const ry = rx * planet.tilt;
      const ex = Math.cos(planet.angle) * rx;
      const ey = Math.sin(planet.angle) * ry;
      const cosR = Math.cos(planet.rotation);
      const sinR = Math.sin(planet.rotation);
      const x = cx + ex * cosR - ey * sinR;
      const y = cy + ex * sinR + ey * cosR;
      const radius = Math.max(2, R * planet.size);
      const sphere = ctx.createRadialGradient(x - radius * 0.35, y - radius * 0.35, radius * 0.05, x, y, radius * 1.05);
      sphere.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
      sphere.addColorStop(0.35, planet.color);
      sphere.addColorStop(1, 'rgba(4, 8, 14, 0.9)');
      ctx.fillStyle = sphere;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, TAU);
      ctx.fill();
    }

    if (settings.clockHands) {
      const now = new Date();
      const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
      const minutes = now.getMinutes() + seconds / 60;
      const hours = (now.getHours() % 12) + minutes / 60;

      this.drawHand(ctx, -Math.PI / 2 + (hours / 12) * TAU, R * 0.4, R * 0.02, palette.brassLight);
      this.drawHand(ctx, -Math.PI / 2 + (minutes / 60) * TAU, R * 0.58, R * 0.014, palette.brassLight);

      if (settings.showSeconds) {
        const s = settings.secondaryColor;
        const secondColor = `rgb(${s.r}, ${s.g}, ${s.b})`;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-Math.PI / 2 + (seconds / 60) * TAU);
        ctx.strokeStyle = secondColor;
        ctx.lineWidth = Math.max(1, R * 0.005);
        ctx.beginPath();
        ctx.moveTo(-R * 0.12, 0);
        ctx.lineTo(R * 0.64, 0);
        ctx.stroke();
        ctx.fillStyle = secondColor;
        ctx.beginPath();
        ctx.arc(R * 0.64, 0, Math.max(1.5, R * 0.009), 0, TAU);
        ctx.fill();
        ctx.restore();
      }

      ctx.fillStyle = palette.brassLight;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(3, R * 0.028), 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(4, 8, 14, 0.55)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(4, 8, 14, 0.7)';
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1, R * 0.01), 0, TAU);
      ctx.fill();
    }

    const showVisualizer = settings.audioReactive && audio.hasAudio && settings.visualizerStyle !== 'off';
    if (showVisualizer) {
      const count = Math.min(32, audio.spectrum.length);
      const gradient = this.getSpectrumGradient(ctx, settings);
      ctx.save();
      ctx.strokeStyle = gradient;
      ctx.lineCap = 'round';

      if (settings.visualizerStyle === 'orbit') {
        const base = R * 1.03;
        ctx.lineWidth = Math.max(1.5, R * 0.007);
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * TAU - Math.PI / 2;
          const value = clamp(audio.spectrum[i], 0, 1);
          const length = 3 + value * R * 0.16;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          ctx.moveTo(cx + cos * base, cy + sin * base);
          ctx.lineTo(cx + cos * (base + length), cy + sin * (base + length));
        }
        ctx.stroke();
        ctx.globalAlpha = 0.18;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, base, 0, TAU);
        ctx.stroke();
      } else {
        const points = 128;
        ctx.beginPath();
        for (let j = 0; j <= points; j++) {
          const index = (j / points) * count;
          const i0 = Math.floor(index) % count;
          const i1 = (i0 + 1) % count;
          const fraction = index - Math.floor(index);
          const value = clamp(audio.spectrum[i0] * (1 - fraction) + audio.spectrum[i1] * fraction, 0, 1);
          const angle = (j / points) * TAU - Math.PI / 2;
          const radius = R * 1.02 + value * R * 0.11 + Math.sin(j * 0.35 + this.time * 2) * R * 0.004;
          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius;
          if (j === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.globalAlpha = 0.12;
        ctx.lineWidth = Math.max(4, R * 0.03);
        ctx.stroke();
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = Math.max(2, R * 0.012);
        ctx.stroke();
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = Math.max(1, R * 0.004);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (beat > 0.01) {
      ctx.save();
      ctx.globalAlpha = beat * 0.35;
      ctx.strokeStyle = palette.brassLight;
      ctx.lineWidth = Math.max(1, R * 0.008);
      ctx.beginPath();
      ctx.arc(cx, cy, R * (1.06 + (1 - beat) * 0.12), 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    for (const item of this.pulses) {
      if (!item.active) continue;
      ctx.save();
      ctx.strokeStyle = palette.brassLight;
      ctx.globalAlpha = (1 - item.t) * 0.4;
      ctx.lineWidth = Math.max(0.5, 2.5 * (1 - item.t));
      ctx.beginPath();
      ctx.arc(item.x, item.y, 12 + item.t * R * 0.55, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = (1 - item.t) * 0.2;
      ctx.beginPath();
      ctx.arc(item.x, item.y, 12 + item.t * R * 0.38, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }
}
