import { PRESET_PALETTES } from '../config/settings';
import type { AppSettings, PresetPalette } from '../config/settings';
import type { AudioMetrics } from '../audio/AudioAnalyzer';
import { cssColor, withAlpha } from '../util/color';

export interface MouseState {
  x: number;
  y: number;
  active: boolean;
  lensRadius: number;
}

interface Gear {
  angle: number;
  speed: number;
  body: Path2D;
  accents: Path2D;
  rivets: Path2D;
}

interface Orbit {
  radius: number;
  tilt: number;
  angle: number;
  speed: number;
  size: number;
  color: string;
  trail: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
  alpha: number;
}

interface Shockwave {
  x: number;
  y: number;
  age: number;
  maxAge: number;
  strength: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class GearSystem {
  private gears: Gear[] = [];
  private orbits: Orbit[] = [];
  private sparks: Spark[] = [];
  private shockwaves: Shockwave[] = [];
  private shockwavePool: Shockwave[] = [];
  private glowSprite = document.createElement('canvas');
  private readonly rng = mulberry32(0x5eed);
  private cachedPreset = 'brass';
  private cacheKey = '';
  private time = 0;
  private parallaxX = 0;
  private parallaxY = 0;
  private tilt = 0;
  private beatCooldown = 0;
  private width = 1;
  private height = 1;
  private centerX = 0;
  private centerY = 0;
  private radius = 1;

  constructor() {
    this.buildGlowSprite(PRESET_PALETTES.brass);
  }

  private buildGlowSprite(palette: PresetPalette): void {
    this.glowSprite.width = 128;
    this.glowSprite.height = 128;
    const ctx = this.glowSprite.getContext('2d');
    if (!ctx) return;
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, withAlpha(palette.glow, 0.95));
    gradient.addColorStop(0.18, withAlpha(palette.glow, 0.42));
    gradient.addColorStop(0.55, withAlpha(palette.glow, 0.09));
    gradient.addColorStop(1, withAlpha(palette.glow, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }

  private ensureGeometry(width: number, height: number, settings: AppSettings): void {
    this.width = width;
    this.height = height;
    this.centerX = width * 0.5;
    this.centerY = height * 0.5;
    const radius = Math.min(720, Math.min(width, height) * 0.34);
    const key = `${width}_${height}_${radius}_${settings.clockworkPreset}_${settings.gearCount}_${settings.orbitCount}`;
    if (this.cacheKey === key) return;
    this.cacheKey = key;
    this.radius = radius;

    if (this.cachedPreset !== settings.clockworkPreset) {
      this.cachedPreset = settings.clockworkPreset;
      this.buildGlowSprite(PRESET_PALETTES[settings.clockworkPreset]);
    }
    this.buildGears(settings);
    this.buildOrbits(settings);
  }

  private buildGears(settings: AppSettings): void {
    this.gears.length = 0;
    const count = settings.gearCount;
    const rng = mulberry32(4127);

    for (let i = 0; i < count; i++) {
      const t = i / Math.max(1, count - 1);
      const radius = this.radius * (0.9 - t * 0.68);
      const ringWidth = Math.max(9, this.radius * 0.024 - t * this.radius * 0.006);
      const toothDepth = Math.max(4, this.radius * 0.016);
      const inner = radius - toothDepth - ringWidth;
      const teeth = Math.max(12, Math.round(radius / 10));
      const step = (Math.PI * 2) / teeth;

      const body = new Path2D();
      let first = true;
      for (let j = 0; j < teeth; j++) {
        const a = j * step;
        const profile: Array<[number, number]> = [
          [a, radius - toothDepth],
          [a + step * 0.18, radius],
          [a + step * 0.46, radius],
          [a + step * 0.64, radius - toothDepth],
        ];
        for (const [angle, r] of profile) {
          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r;
          if (first) {
            body.moveTo(x, y);
            first = false;
          } else {
            body.lineTo(x, y);
          }
        }
      }
      body.closePath();
      body.moveTo(inner, 0);
      body.arc(0, 0, inner, 0, Math.PI * 2);

      const accents = new Path2D();
      accents.moveTo(inner + 2, 0);
      accents.arc(0, 0, inner + 2, 0, Math.PI * 2);
      const marks = Math.max(24, teeth * 2);
      for (let m = 0; m < marks; m++) {
        const angle = m / marks * Math.PI * 2;
        const long = m % 5 === 0;
        const start = long ? inner + 2 : inner + ringWidth * 0.48;
        const end = radius - toothDepth - 2;
        accents.moveTo(Math.cos(angle) * start, Math.sin(angle) * start);
        accents.lineTo(Math.cos(angle) * end, Math.sin(angle) * end);
      }

      const rivets = new Path2D();
      const rivetCount = Math.max(8, Math.round(teeth / 2));
      const rivetRadius = inner + ringWidth * 0.5;
      const dot = Math.max(1.4, this.radius * 0.0045);
      for (let k = 0; k < rivetCount; k++) {
        const angle = k / rivetCount * Math.PI * 2;
        const x = Math.cos(angle) * rivetRadius;
        const y = Math.sin(angle) * rivetRadius;
        rivets.moveTo(x + dot, y);
        rivets.arc(x, y, dot, 0, Math.PI * 2);
      }

      this.gears.push({
        angle: rng() * Math.PI * 2,
        speed: (0.055 + (count - i) * 0.018) * (i % 2 === 0 ? 1 : -1),
        body,
        accents,
        rivets,
      });
    }
  }

  private buildOrbits(settings: AppSettings): void {
    this.orbits.length = 0;
    const count = settings.orbitCount;
    const rng = mulberry32(9137);
    const palette = PRESET_PALETTES[settings.clockworkPreset];

    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0;
      this.orbits.push({
        radius: this.radius * (0.24 + t * 0.8),
        tilt: 0.84 + rng() * 0.14,
        angle: rng() * Math.PI * 2,
        speed: (0.17 - t * 0.11) * (i % 2 === 0 ? 1 : -1),
        size: Math.max(3, this.radius * (0.012 + rng() * 0.012)),
        color: palette.planets[i % palette.planets.length],
        trail: 0.3 + rng() * 0.3,
      });
    }
  }

  private makeSpark(): Spark {
    const r = this.rng;
    return {
      x: r() * this.width,
      y: r() * this.height,
      vx: (r() - 0.5) * 9,
      vy: -5 - r() * 12,
      size: 0.8 + r() * 1.8,
      phase: r() * Math.PI * 2,
      alpha: 0.25 + r() * 0.6,
    };
  }

  private ensureSparks(settings: AppSettings): void {
    while (this.sparks.length < settings.sparkCount) this.sparks.push(this.makeSpark());
    while (this.sparks.length > settings.sparkCount) this.sparks.pop();
  }

  public spawnShockwave(x: number, y: number, strength = 1): void {
    const wave = this.shockwavePool.pop() ?? { x: 0, y: 0, age: 0, maxAge: 1, strength: 1 };
    wave.x = x;
    wave.y = y;
    wave.age = 0;
    wave.strength = strength;
    wave.maxAge = 1.1 + strength * 0.5;
    if (this.shockwaves.length < 10) this.shockwaves.push(wave);
    else this.shockwavePool.push(wave);
    this.burst(x, y);
  }

  private burst(x: number, y: number): void {
    const count = Math.min(14, this.sparks.length);
    for (let i = 0; i < count; i++) {
      const spark = this.sparks[i];
      spark.x = x + (this.rng() - 0.5) * 44;
      spark.y = y + (this.rng() - 0.5) * 44;
      spark.vx = (this.rng() - 0.5) * 70;
      spark.vy = (this.rng() - 0.5) * 70;
      spark.alpha = 0.7 + this.rng() * 0.3;
    }
  }

  public update(
    deltaTimeSec: number,
    width: number,
    height: number,
    settings: AppSettings,
    audio: AudioMetrics,
    mouse: MouseState
  ): void {
    this.time += deltaTimeSec;
    this.ensureGeometry(width, height, settings);
    this.ensureSparks(settings);

    const active = settings.audioReactive && audio.hasAudio;
    const bass = active ? audio.bass : 0;
    const mid = active ? audio.mid : 0;
    const beat = active ? audio.beatPulse : 0;

    this.beatCooldown = Math.max(0, this.beatCooldown - deltaTimeSec);
    if (beat > 0.75 && this.beatCooldown <= 0) {
      this.spawnShockwave(this.centerX + this.parallaxX, this.centerY + this.parallaxY, 0.75 + bass * 0.5);
      this.beatCooldown = 0.28;
    }

    const targetX = settings.mouseParallax && mouse.active ? (mouse.x / width - 0.5) * 30 : 0;
    const targetY = settings.mouseParallax && mouse.active ? (mouse.y / height - 0.5) * 24 : 0;
    const targetTilt = settings.mouseParallax && mouse.active ? (mouse.x / width - 0.5) * 0.05 : 0;
    const ease = Math.min(1, deltaTimeSec * 3);
    this.parallaxX += (targetX - this.parallaxX) * ease;
    this.parallaxY += (targetY - this.parallaxY) * ease;
    this.tilt += (targetTilt - this.tilt) * ease;

    const speedFactor = settings.rotationSpeed * (1 + mid * 0.6 + bass * 0.35);
    for (const gear of this.gears) gear.angle += gear.speed * speedFactor * deltaTimeSec;
    for (const orbit of this.orbits) orbit.angle += orbit.speed * speedFactor * deltaTimeSec;

    const relax = Math.min(1, deltaTimeSec * 0.6);
    for (const spark of this.sparks) {
      spark.vx += (0 - spark.vx) * relax;
      spark.vy += (-9 - spark.vy) * relax;
      spark.x += (spark.vx + Math.sin(this.time * 0.7 + spark.phase) * 6) * deltaTimeSec;
      spark.y += spark.vy * deltaTimeSec;
      if (spark.y < -12) {
        spark.y = height + 12;
        spark.x = this.rng() * width;
      } else if (spark.y > height + 60) {
        spark.y = -12;
      }
      if (spark.x < -12) spark.x = width + 12;
      else if (spark.x > width + 12) spark.x = -12;
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const wave = this.shockwaves[i];
      wave.age += deltaTimeSec;
      if (wave.age >= wave.maxAge) {
        this.shockwaves.splice(i, 1);
        this.shockwavePool.push(wave);
      }
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    settings: AppSettings,
    audio: AudioMetrics,
    mouse: MouseState
  ): void {
    const palette = PRESET_PALETTES[settings.clockworkPreset];
    const active = settings.audioReactive && audio.hasAudio;
    const bass = active ? audio.bass : 0;
    const treble = active ? audio.treble : 0;
    const beat = active ? audio.beatPulse : 0;
    const glow = settings.glowIntensity;

    this.drawLens(ctx, mouse, settings);

    ctx.save();
    ctx.translate(this.centerX + this.parallaxX, this.centerY + this.parallaxY);
    ctx.rotate(this.tilt);
    this.drawGlow(ctx, 0, 0, this.radius * (0.32 + bass * 0.1 + beat * 0.05), (0.26 + bass * 0.26 + beat * 0.12) * glow);
    this.drawChapterRing(ctx, palette, settings, bass, treble, glow);
    this.drawGears(ctx, palette);
    this.drawOrbitTracks(ctx, palette);
    this.drawOrbitBodies(ctx, palette, treble, beat, glow);
    this.drawHands(ctx, palette);
    this.drawHub(ctx, palette, settings, bass, glow);
    ctx.restore();

    this.drawShockwaves(ctx, settings, width, height);
    this.drawSparks(ctx, settings, treble, glow);
  }

  private drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, alpha: number): void {
    if (alpha <= 0 || radius <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(this.glowSprite, x - radius, y - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  private drawChapterRing(
    ctx: CanvasRenderingContext2D,
    palette: PresetPalette,
    settings: AppSettings,
    bass: number,
    treble: number,
    glow: number
  ): void {
    const r = this.radius * 1.06;
    ctx.strokeStyle = withAlpha(palette.metalDark, 0.95);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = withAlpha(palette.metalLight, 0.4);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, r + 2.6, 0, Math.PI * 2);
    ctx.arc(0, 0, r - 3.6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = withAlpha(palette.engraving, 0.28 + treble * 0.22);
    ctx.beginPath();
    for (let i = 0; i < 120; i++) {
      const angle = i / 120 * Math.PI * 2 - Math.PI / 2;
      const length = i % 10 === 0 ? this.radius * 0.055
        : i % 5 === 0 ? this.radius * 0.033 : this.radius * 0.017;
      const start = r - 6 - length;
      ctx.moveTo(Math.cos(angle) * start, Math.sin(angle) * start);
      ctx.lineTo(Math.cos(angle) * (r - 6), Math.sin(angle) * (r - 6));
    }
    ctx.stroke();

    const sweep = (this.time * 0.16) % (Math.PI * 2) - Math.PI / 2;
    ctx.strokeStyle = cssColor(settings.primaryColor, 0.55);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r - 1, sweep - 0.5, sweep);
    ctx.stroke();
    this.drawGlow(ctx, Math.cos(sweep) * (r - 1), Math.sin(sweep) * (r - 1),
      16 + bass * 8, (0.35 + bass * 0.3) * glow);
  }

  private drawGears(ctx: CanvasRenderingContext2D, palette: PresetPalette): void {
    for (const gear of this.gears) {
      ctx.save();
      ctx.translate(4, 6);
      ctx.rotate(gear.angle);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
      ctx.fill(gear.body, 'evenodd');
      ctx.restore();

      ctx.save();
      ctx.rotate(gear.angle);
      ctx.fillStyle = palette.metalMid;
      ctx.fill(gear.body, 'evenodd');
      ctx.strokeStyle = palette.metalDark;
      ctx.lineWidth = 1.1;
      ctx.stroke(gear.body);
      ctx.strokeStyle = withAlpha(palette.metalLight, 0.3);
      ctx.lineWidth = 1;
      ctx.stroke(gear.accents);
      ctx.fillStyle = withAlpha(palette.rivet, 0.7);
      ctx.fill(gear.rivets);
      ctx.restore();
    }
  }

  private drawOrbitTracks(ctx: CanvasRenderingContext2D, palette: PresetPalette): void {
    for (const orbit of this.orbits) {
      ctx.save();
      ctx.scale(1, orbit.tilt);
      ctx.beginPath();
      ctx.arc(0, 0, orbit.radius, 0, Math.PI * 2);
      ctx.strokeStyle = withAlpha(palette.engraving, 0.14);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, orbit.radius, orbit.angle - orbit.trail, orbit.angle);
      ctx.strokeStyle = withAlpha(orbit.color, 0.4);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawOrbitBodies(
    ctx: CanvasRenderingContext2D,
    palette: PresetPalette,
    treble: number,
    beat: number,
    glow: number
  ): void {
    for (const orbit of this.orbits) {
      const x = Math.cos(orbit.angle) * orbit.radius;
      const y = Math.sin(orbit.angle) * orbit.radius * orbit.tilt;
      this.drawGlow(ctx, x, y, orbit.size * 3.4, (0.18 + treble * 0.28 + beat * 0.18) * glow);
      ctx.beginPath();
      ctx.arc(x, y, orbit.size, 0, Math.PI * 2);
      ctx.fillStyle = orbit.color;
      ctx.fill();
      ctx.strokeStyle = withAlpha(palette.metalDark, 0.75);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x - orbit.size * 0.32, y - orbit.size * 0.32, orbit.size * 0.34, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
      ctx.fill();
    }
  }

  private drawHands(ctx: CanvasRenderingContext2D, palette: PresetPalette): void {
    this.drawNeedle(ctx, this.time * 0.09, this.radius * 0.99, withAlpha(palette.metalLight, 0.9));
    this.drawNeedle(ctx, -this.time * 0.16, this.radius * 0.64, withAlpha(palette.rivet, 0.7));
  }

  private drawNeedle(ctx: CanvasRenderingContext2D, angle: number, length: number, color: string): void {
    ctx.save();
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-length * 0.13, -2.2);
    ctx.lineTo(0, -2.2);
    ctx.lineTo(length, 0);
    ctx.lineTo(0, 2.2);
    ctx.lineTo(-length * 0.13, 2.2);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  private drawHub(
    ctx: CanvasRenderingContext2D,
    palette: PresetPalette,
    settings: AppSettings,
    bass: number,
    glow: number
  ): void {
    const hub = this.radius * 0.085;
    ctx.beginPath();
    ctx.arc(0, 0, hub, 0, Math.PI * 2);
    ctx.fillStyle = palette.metalDark;
    ctx.fill();
    ctx.strokeStyle = withAlpha(palette.metalLight, 0.75);
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, hub * 0.62, 0, Math.PI * 2);
    ctx.strokeStyle = withAlpha(palette.engraving, 0.4);
    ctx.lineWidth = 1;
    ctx.stroke();

    const resonance = this.radius * (0.115 + bass * 0.055);
    ctx.beginPath();
    ctx.arc(0, 0, resonance, 0, Math.PI * 2);
    ctx.strokeStyle = cssColor(settings.primaryColor, 0.18 + bass * 0.32);
    ctx.lineWidth = 1.4;
    ctx.stroke();

    this.drawGlow(ctx, 0, 0, hub * 1.1 * (1 + bass * 0.25), (0.5 + bass * 0.3) * glow);
    ctx.beginPath();
    ctx.arc(0, 0, hub * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(palette.rivet, 0.9);
    ctx.fill();
  }

  private drawShockwaves(
    ctx: CanvasRenderingContext2D,
    settings: AppSettings,
    width: number,
    height: number
  ): void {
    for (const wave of this.shockwaves) {
      const t = wave.age / wave.maxAge;
      const radius = 12 + t * Math.max(width, height) * 0.2 * wave.strength;
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = cssColor(settings.primaryColor, (1 - t) * 0.3 * wave.strength);
      ctx.lineWidth = 1 + (1 - t) * 2.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, radius * 0.82, 0, Math.PI * 2);
      ctx.strokeStyle = cssColor(settings.secondaryColor, (1 - t) * 0.14 * wave.strength);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  private drawSparks(
    ctx: CanvasRenderingContext2D,
    settings: AppSettings,
    treble: number,
    glow: number
  ): void {
    if (this.sparks.length === 0) return;
    const palette = PRESET_PALETTES[settings.clockworkPreset];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = palette.glow;
    for (const spark of this.sparks) {
      const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.time * 2.2 + spark.phase));
      ctx.globalAlpha = Math.min(1, spark.alpha * twinkle * (0.55 + treble * 0.75) * glow);
      ctx.fillRect(spark.x, spark.y, spark.size, spark.size);
    }
    ctx.restore();
  }

  private drawLens(ctx: CanvasRenderingContext2D, mouse: MouseState, settings: AppSettings): void {
    if (!settings.mouseParallax || !mouse.active) return;
    this.drawGlow(ctx, mouse.x, mouse.y, mouse.lensRadius * 0.5, 0.05 * settings.glowIntensity);
    ctx.beginPath();
    ctx.arc(mouse.x, mouse.y, 24 + Math.sin(this.time) * 3, 0, Math.PI * 2);
    ctx.strokeStyle = cssColor(settings.primaryColor, 0.12);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
