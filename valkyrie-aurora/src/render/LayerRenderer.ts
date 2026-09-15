import { audioProcessor } from '../audio/AudioProcessor';
import { settingsStore } from '../config/settings';

interface Snowflake { x: number; y: number; speed: number; size: number; opacity: number; phase: number; }
interface Star { x: number; y: number; r: number; phase: number; speed: number; }
interface Meteor { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; active: boolean; }

/** Deterministic PRNG so the procedural scene looks identical every launch. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fully procedural Nordic night scene. Replaces the old raster backdrop
 * with original canvas art: sky, stars, moon, aurora curtains, layered
 * ridges, fjord reflection, meteors, constellations and stardust.
 * No external assets, works offline, deterministic across runs.
 */
export class LayerRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly snow: Snowflake[] = [];
  private readonly stars: Star[] = [];
  private readonly meteors: Meteor[] = [];
  private readonly constellationLinks: Array<[number, number]> = [];

  private time = 0;
  private meteorTimer = 2.5;
  private pointerX = 0;
  private pointerY = 0;
  private targetPointerX = 0;
  private targetPointerY = 0;

  // Cached gradients rebuilt only on resize (perf: avoid per-frame allocs).
  private cachedW = 0;
  private cachedH = 0;
  private skyGradient: CanvasGradient | null = null;
  private vignetteGradient: CanvasGradient | null = null;
  private waterGradient: CanvasGradient | null = null;
  // Reused offscreen canvas for feathered aurora bands (no per-frame alloc).
  private auroraCanvas: HTMLCanvasElement | null = null;
  private auroraCtx: CanvasRenderingContext2D | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!context) throw new Error('Failed to get 2D canvas context');
    this.ctx = context;

    const rand = mulberry32(20260915);

    for (let i = 0; i < 500; i += 1) {
      this.snow.push({
        x: rand(), y: rand(),
        speed: 0.018 + rand() * 0.05,
        size: 0.6 + rand() * 1.6,
        opacity: 0.08 + rand() * 0.3,
        phase: rand() * Math.PI * 2,
      });
    }

    for (let i = 0; i < 220; i += 1) {
      this.stars.push({
        x: rand(), y: rand() * 0.72,
        r: 0.4 + rand() * 1.3,
        phase: rand() * Math.PI * 2,
        speed: 0.6 + rand() * 2.2,
      });
    }

    // Small local constellation groups: only link nearby bright stars.
    const brightIdx = this.stars
      .map((s, idx) => ({ s, idx }))
      .filter((e) => e.s.y < 0.45 && e.s.r > 1.05)
      .map((e) => e.idx);
    const used = new Set<number>();
    for (const a of brightIdx) {
      if (used.has(a)) continue;
      if (this.constellationLinks.length >= 10) break;
      let best = -1; let bestDist = 0.045;
      for (const b of brightIdx) {
        if (b === a || used.has(b)) continue;
        const dx = this.stars[a].x - this.stars[b].x;
        const dy = (this.stars[a].y - this.stars[b].y) * 1.4;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < bestDist) { bestDist = d; best = b; }
      }
      if (best >= 0) {
        this.constellationLinks.push([a, best]);
        used.add(a); used.add(best);
      }
    }

    for (let i = 0; i < 3; i += 1) {
      this.meteors.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, active: false });
    }

    window.addEventListener('mousemove', (event) => {
      this.targetPointerX = (event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
      this.targetPointerY = (event.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
    }, { passive: true });
    window.addEventListener('mouseleave', () => { this.targetPointerX = 0; this.targetPointerY = 0; });
  }

  public render(deltaTime: number): void {
    const { ctx, canvas } = this;
    const settings = settingsStore.current;
    const width = canvas.width;
    const height = canvas.height;
    if (width === 0 || height === 0) return;

    this.time += deltaTime;
    const ease = Math.min(1, deltaTime * 2.2);
    this.pointerX += (this.targetPointerX - this.pointerX) * ease;
    this.pointerY += (this.targetPointerY - this.pointerY) * ease;

    this.ensureCachedGradients(width, height);

    const audioLevel = settings.audioReactive ? audioProcessor.overall * settings.audioSensitivity : 0;
    const clampedAudio = Math.max(0, Math.min(1, audioLevel));
    const breathe = Math.sin(this.time * 0.5) * 0.5 + 0.5;
    const breatheAmp = 1 + (breathe - 0.5) * 0.06 * settings.breathingIntensity;
    const parallax = settings.parallaxIntensity;

    // 1. Sky base
    ctx.fillStyle = this.skyGradient ?? '#040914';
    ctx.fillRect(0, 0, width, height);

    // 2. Stars + constellations
    this.drawStars(width, height);
    if (settings.showConstellations) this.drawConstellations(width, height);

    // 3. Moon with halo (uses haloGlowIntensity + audio pulse)
    this.drawMoon(width, height, clampedAudio, breatheAmp, parallax, settings.haloGlowIntensity);

    // 4. Aurora curtains (signature look, audio-reactive shimmer)
    if (settings.visualizerStyle !== 'off') {
      this.drawAurora(width, height, clampedAudio, breatheAmp, parallax, settings.auroraIntensity);
    }

    // 5. Mountain ridges back-to-front with parallax depth
    this.drawRidges(width, height, parallax);

    // 6. Fjord water + reflections
    this.drawWater(width, height, clampedAudio);

    // 7. Audio visualizer extras
    this.drawVisualizerExtras(width, height, clampedAudio, settings.visualizerStyle);

    // 8. Meteors
    if (settings.showMeteors) this.drawMeteors(width, height, deltaTime);

    // 9. Stardust / snow
    this.drawSnow(width, height, deltaTime, Math.round(settings.particleCount), settings.particleSpeed);

    // 10. Audio-reactive color wash + cinematic vignette
    const p = settings.primaryColor;
    const s = settings.secondaryColor;
    const alpha = Math.min(0.2, 0.045 + clampedAudio * 0.06) * settings.auroraIntensity;
    const wash = ctx.createLinearGradient(0, 0, width, height);
    wash.addColorStop(0, `rgba(${p.r}, ${p.g}, ${p.b}, ${alpha})`);
    wash.addColorStop(0.52, 'rgba(1, 7, 18, 0)');
    wash.addColorStop(1, `rgba(${s.r}, ${s.g}, ${s.b}, ${alpha * 0.55})`);
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, width, height);

    if (this.vignetteGradient) {
      ctx.fillStyle = this.vignetteGradient;
      ctx.fillRect(0, 0, width, height);
    }
  }

  private ensureCachedGradients(width: number, height: number): void {
    if (this.cachedW === width && this.cachedH === height && this.skyGradient) return;
    const { ctx } = this;
    this.cachedW = width; this.cachedH = height;

    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#01040c');
    sky.addColorStop(0.45, '#061224');
    sky.addColorStop(0.72, '#0a1f33');
    sky.addColorStop(1, '#040914');
    this.skyGradient = sky;

    const water = ctx.createLinearGradient(0, height * 0.72, 0, height);
    water.addColorStop(0, '#0b2438');
    water.addColorStop(0.5, '#061423');
    water.addColorStop(1, '#02070f');
    this.waterGradient = water;

    const cx = width / 2; const cy = height * 0.45;
    const radius = Math.max(width, height) * 0.75;
    const vig = ctx.createRadialGradient(cx, cy, Math.min(width, height) * 0.35, cx, cy, radius);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.52)');
    this.vignetteGradient = vig;
  }

  private drawStars(width: number, height: number): void {
    const { ctx } = this;
    ctx.save();
    for (let i = 0; i < this.stars.length; i += 1) {
      const st = this.stars[i];
      const tw = 0.45 + 0.55 * Math.sin(this.time * st.speed + st.phase);
      ctx.globalAlpha = 0.25 + tw * 0.55;
      const r = st.r * (width / 1600 + 0.6);
      if (r > 1.4) {
        ctx.fillStyle = '#e6f5ff';
        ctx.beginPath();
        ctx.arc(st.x * width, st.y * height, r * 0.8, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#dff3ff';
        ctx.fillRect(st.x * width, st.y * height, r, r);
      }
    }
    ctx.restore();
  }

  private drawConstellations(width: number, height: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = 'rgba(170, 220, 255, 0.85)';
    ctx.lineWidth = Math.max(1, width / 2200);
    ctx.beginPath();
    for (let i = 0; i < this.constellationLinks.length; i += 1) {
      const [a, b] = this.constellationLinks[i];
      const sa = this.stars[a]; const sb = this.stars[b];
      if (!sa || !sb) continue;
      ctx.moveTo(sa.x * width, sa.y * height);
      ctx.lineTo(sb.x * width, sb.y * height);
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawMoon(width: number, height: number, audio: number, breathe: number, parallax: number, halo: number): void {
    const { ctx } = this;
    const mx = width * 0.78 - this.pointerX * 10 * parallax;
    const my = height * 0.24 - this.pointerY * 8 * parallax;
    const baseR = Math.min(width, height) * 0.028 * breathe;
    const haloR = baseR * (5 + halo * 3 + audio * 4);

    const glow = ctx.createRadialGradient(mx, my, baseR * 0.5, mx, my, haloR);
    glow.addColorStop(0, `rgba(220, 240, 255, ${0.5 + audio * 0.3})`);
    glow.addColorStop(0.25, `rgba(170, 210, 255, ${0.16 * halo + audio * 0.12})`);
    glow.addColorStop(1, 'rgba(170, 210, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(mx - haloR, my - haloR, haloR * 2, haloR * 2);

    ctx.save();
    ctx.fillStyle = '#eaf6ff';
    ctx.beginPath();
    ctx.arc(mx, my, baseR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(190, 215, 240, 0.55)';
    ctx.beginPath();
    ctx.arc(mx - baseR * 0.25, my - baseR * 0.15, baseR * 0.82, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawAurora(width: number, height: number, audio: number, breathe: number, parallax: number, intensity: number): void {
    const { ctx } = this;
    const settings = settingsStore.current;
    const p = settings.primaryColor;
    const s = settings.secondaryColor;
    const horizon = height * 0.66;
    const bands = 3;

    if (!this.auroraCanvas || !this.auroraCtx || this.auroraCanvas.width !== width || this.auroraCanvas.height !== height) {
      this.auroraCanvas = document.createElement('canvas');
      this.auroraCanvas.width = width; this.auroraCanvas.height = height;
      this.auroraCtx = this.auroraCanvas.getContext('2d');
      if (!this.auroraCtx) return;
    }
    const actx = this.auroraCtx;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let b = 0; b < bands; b += 1) {
      const bandT = b / Math.max(1, bands - 1);
      const baseY = height * (0.06 + bandT * 0.16);
      const amp = (height * 0.12 + audio * height * 0.1) * breathe * (1 - bandT * 0.3);
      const alpha = (0.32 - bandT * 0.07) * intensity * (1 + audio * 0.9);
      if (alpha <= 0.01) continue;

      const drift = this.time * (0.14 + b * 0.06) + b * 2.1;
      const px = this.pointerX * (6 + b * 5) * parallax;
      const cx = 0.32 + b * 0.18 + Math.sin(drift * 0.4) * 0.03;
      const spread = 0.34 - bandT * 0.05;
      const leftX = (cx - spread * 1.2) * width - px;
      const rightX = (cx + spread * 1.2) * width - px;
      const pc = b % 2 === 0 ? p : s;
      const steps = 64;

      actx.save();
      actx.clearRect(0, 0, width, height);
      actx.globalCompositeOperation = 'source-over';
      const grad = actx.createLinearGradient(0, baseY - amp, 0, horizon);
      grad.addColorStop(0, `rgba(${pc.r}, ${pc.g}, ${pc.b}, 0)`);
      grad.addColorStop(0.45, `rgba(${pc.r}, ${pc.g}, ${pc.b}, ${alpha * 0.7})`);
      grad.addColorStop(0.72, `rgba(${pc.r}, ${pc.g}, ${pc.b}, ${alpha})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      actx.fillStyle = grad;
      actx.beginPath();
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const x = (cx + (t - 0.5) * spread * 2.4) * width - px;
        const wave = Math.sin(t * 6.2 + drift) * 0.5 + Math.sin(t * 13.7 - drift * 1.4) * 0.3 + Math.sin(t * 3.1 + drift * 0.6) * 0.4;
        const y = baseY + wave * amp * 0.4;
        if (i === 0) actx.moveTo(x, y);
        else actx.lineTo(x, y);
      }
      for (let i = steps; i >= 0; i -= 1) {
        const t = i / steps;
        const x = (cx + (t - 0.5) * spread * 2.4) * width - px;
        const ray = 0.55 + 0.45 * Math.sin(t * 26 + drift * 2.2 + b * 1.3);
        actx.lineTo(x, horizon - (horizon - baseY) * 0.22 * ray);
      }
      actx.closePath();
      actx.fill();
      // Horizontal feather so curtains read as ribbons, not boxes.
      actx.globalCompositeOperation = 'destination-in';
      const mask = actx.createLinearGradient(leftX, 0, rightX, 0);
      mask.addColorStop(0, 'rgba(0,0,0,0)');
      mask.addColorStop(0.22, 'rgba(0,0,0,1)');
      mask.addColorStop(0.78, 'rgba(0,0,0,1)');
      mask.addColorStop(1, 'rgba(0,0,0,0)');
      actx.fillStyle = mask;
      actx.fillRect(leftX, 0, rightX - leftX, height);
      actx.restore();

      ctx.drawImage(this.auroraCanvas, 0, 0);

      // Bright lower curtain edge
      ctx.strokeStyle = `rgba(${pc.r}, ${pc.g}, ${pc.b}, ${Math.min(0.45, alpha * 0.85)})`;
      ctx.lineWidth = Math.max(1, height * 0.0016);
      ctx.beginPath();
      for (let i = 8; i <= steps - 8; i += 1) {
        const t = i / steps;
        const edgeFade = Math.sin((t * Math.PI));
        if (edgeFade < 0.25) continue;
        const x = (cx + (t - 0.5) * spread * 2.4) * width - px;
        const ray = 0.55 + 0.45 * Math.sin(t * 26 + drift * 2.2 + b * 1.3);
        const y = horizon - (horizon - baseY) * 0.22 * ray;
        const first = i === 8;
        if (first) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  private ridgeHeight(layer: number, x: number): number {
    // Ridged sine noise: sharp crests, narrow peaks.
    const r1 = 1 - Math.abs(Math.sin(x * 6.3 + layer * 1.7));
    const r2 = 1 - Math.abs(Math.sin(x * 13.7 + layer * 4.2 + 1.3));
    const r3 = 1 - Math.abs(Math.sin(x * 27.0 + layer * 2.3 + 4.1));
    const r4 = 1 - Math.abs(Math.sin(x * 47.0 + layer * 7.9 + 2.0));
    const h = Math.pow(r1, 1.6) * 0.46 + Math.pow(r2, 1.8) * 0.28 + Math.pow(r3, 2.0) * 0.17 + r4 * 0.09;
    return Math.max(0, Math.min(1, h));
  }

  private drawRidges(width: number, height: number, parallax: number): void {
    const { ctx } = this;
    const layers = [
      { base: 0.6, amp: 0.2, color: '#0e2338', depth: 4 },
      { base: 0.69, amp: 0.18, color: '#081525', depth: 9 },
      { base: 0.78, amp: 0.15, color: '#040c17', depth: 15 },
    ];
    ctx.save();
    for (let l = 0; l < layers.length; l += 1) {
      const layer = layers[l];
      const offsetX = this.pointerX * layer.depth * parallax;
      const offsetY = this.pointerY * layer.depth * 0.4 * parallax;
      ctx.fillStyle = layer.color;
      ctx.beginPath();
      ctx.moveTo(-20, height + 20);
      const steps = 96;
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const h = this.ridgeHeight(l, t);
        const x = t * (width + 40) - 20 - offsetX;
        const y = height * layer.base - h * height * layer.amp - offsetY;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width + 20, height + 20);
      ctx.closePath();
      ctx.fill();
      // Subtle moonlit rim on the far ridge crest.
      if (l === 0) {
        ctx.strokeStyle = 'rgba(190, 220, 245, 0.22)';
        ctx.lineWidth = Math.max(1, height * 0.0012);
        ctx.beginPath();
        for (let i = 0; i <= steps; i += 1) {
          const t = i / steps;
          const h = this.ridgeHeight(l, t);
          const x = t * (width + 40) - 20 - offsetX;
          const y = height * layer.base - h * height * layer.amp - offsetY;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawWater(width: number, height: number, audio: number): void {
    const { ctx } = this;
    const top = height * 0.78;
    ctx.fillStyle = this.waterGradient ?? '#061423';
    ctx.fillRect(0, top, width, height - top);

    // Moon reflection: continuous streak with soft wobble highlights.
    const mx = width * 0.78;
    const streakW = width * 0.012 * (1 + audio * 1.2);
    const streakGrad = ctx.createLinearGradient(0, top, 0, height);
    streakGrad.addColorStop(0, `rgba(200, 230, 255, ${0.13 + audio * 0.12})`);
    streakGrad.addColorStop(1, 'rgba(200, 230, 255, 0)');
    ctx.fillStyle = streakGrad;
    ctx.fillRect(mx - streakW / 2, top, streakW, height - top);
    ctx.fillStyle = `rgba(220, 240, 255, ${0.16 + audio * 0.14})`;
    for (let i = 0; i < 6; i += 1) {
      const t = i / 7;
      const wobble = Math.sin(this.time * 1.3 + i * 1.7) * width * 0.004;
      const y = top + t * (height - top) * 0.9;
      const w = streakW * (1.1 - t * 0.7) * (0.5 + ((i * 37) % 30) / 60);
      ctx.fillRect(mx + wobble - w / 2, y, w, 2);
    }

    // Horizontal shimmer lines
    ctx.save();
    ctx.globalAlpha = 0.07 + audio * 0.06;
    ctx.fillStyle = '#9fd8ff';
    for (let i = 0; i < 14; i += 1) {
      const y = top + ((i * 53 + Math.sin(this.time * 0.8 + i) * 8) % (height - top));
      const w = width * (0.02 + ((i * 37) % 40) / 400);
      const x = ((i * 389) % 100) / 100 * width;
      ctx.fillRect(x, y, w, 1);
    }
    ctx.restore();
  }

  private drawVisualizerExtras(width: number, height: number, audio: number, style: string): void {
    const { ctx } = this;
    const settings = settingsStore.current;
    const p = settings.primaryColor;
    if (style === 'bars') {
      const spectrum = audioProcessor.getFrequencySpectrum();
      const n = 48;
      const bw = width / n;
      ctx.save();
      for (let i = 0; i < n; i += 1) {
        const v = spectrum[Math.floor((i / n) * spectrum.length)] ?? 0;
        const h = 4 + v * height * 0.16 * settings.audioSensitivity + Math.sin(this.time * 2 + i * 0.6) * 2;
        ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, 0.5)`;
        ctx.fillRect(i * bw + bw * 0.25, height - h - 8, bw * 0.5, h);
      }
      ctx.restore();
    } else if (style === 'wave_pulse') {
      ctx.save();
      ctx.strokeStyle = `rgba(${p.r}, ${p.g}, ${p.b}, 0.65)`;
      ctx.lineWidth = Math.max(1.5, height * 0.002);
      ctx.beginPath();
      const yBase = height * 0.82;
      for (let i = 0; i <= 96; i += 1) {
        const t = i / 96;
        const v = Math.sin(t * Math.PI * 4 + this.time * 2.4) * (4 + audio * 26);
        const x = t * width;
        const y = yBase + v;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    } else if (style === 'sacred_rings') {
      const mx = width * 0.78;
      const my = height * 0.24;
      ctx.save();
      ctx.globalAlpha = 0.5;
      for (let r = 0; r < 3; r += 1) {
        const radius = (Math.min(width, height) * (0.06 + r * 0.035)) * (1 + audio * 0.35 + Math.sin(this.time * 1.2 + r) * 0.03);
        ctx.strokeStyle = r % 2 === 0
          ? `rgba(${p.r}, ${p.g}, ${p.b}, 0.55)`
          : `rgba(${settings.secondaryColor.r}, ${settings.secondaryColor.g}, ${settings.secondaryColor.b}, 0.5)`;
        ctx.lineWidth = Math.max(1, width / 1400);
        ctx.beginPath();
        ctx.arc(mx, my, radius, this.time * (0.2 + r * 0.12), this.time * (0.2 + r * 0.12) + Math.PI * 1.5);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawMeteors(width: number, height: number, deltaTime: number): void {
    const { ctx } = this;
    this.meteorTimer -= deltaTime;
    if (this.meteorTimer <= 0) {
      const m = this.meteors.find((e) => !e.active);
      if (m) {
        m.x = 0.15 + Math.random() * 0.7;
        m.y = 0.02 + Math.random() * 0.2;
        const speed = 0.5 + Math.random() * 0.5;
        m.vx = -speed * 0.55; m.vy = speed * 0.32;
        m.life = 0; m.maxLife = 0.9 + Math.random() * 0.6;
        m.active = true;
      }
      this.meteorTimer = 3 + Math.random() * 5;
    }

    ctx.save();
    for (let i = 0; i < this.meteors.length; i += 1) {
      const m = this.meteors[i];
      if (!m.active) continue;
      m.life += deltaTime;
      if (m.life >= m.maxLife) { m.active = false; continue; }
      const t = m.life / m.maxLife;
      const alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
      const x = m.x * width + m.vx * m.life * width;
      const y = m.y * height + m.vy * m.life * height;
      const tail = 0.09 * width;
      const grad = ctx.createLinearGradient(x, y, x - tail * 0.7, y - tail * 0.4);
      grad.addColorStop(0, `rgba(255, 255, 255, ${0.9 * alpha})`);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = Math.max(1, width / 900);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - tail * 0.7, y - tail * 0.4);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawSnow(width: number, height: number, deltaTime: number, requestedCount: number, speedMul: number): void {
    const count = Math.min(this.snow.length, Math.max(18, requestedCount));
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = 'rgba(230, 248, 255, 0.55)';
    for (let index = 0; index < count; index += 1) {
      const flake = this.snow[index];
      flake.y += flake.speed * speedMul * deltaTime;
      flake.x += Math.sin(this.time * 0.45 + flake.phase) * 0.0009 * deltaTime * 60 * 0.016;
      if (flake.y > 1.03) { flake.y = -0.03; flake.x = (flake.x + 0.37) % 1; }
      if (flake.x < -0.03) flake.x = 1.03;
      if (flake.x > 1.03) flake.x = -0.03;
      ctx.globalAlpha = flake.opacity;
      const s = flake.size * (width / 1600 + 0.6);
      ctx.fillRect(flake.x * width, flake.y * height, s, s);
    }
    ctx.restore();
  }
}
