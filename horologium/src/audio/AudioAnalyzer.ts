export interface AudioMetrics {
  bass: number;
  mid: number;
  treble: number;
  overall: number;
  beatPulse: number;
  spectrum: Float32Array;
  hasAudio: boolean;
}

export class AudioAnalyzer {
  private readonly numBins = 32;
  private readonly attackRate = 30;
  private readonly releaseRate = 25;
  private readonly rawLeft = new Float32Array(this.numBins);
  private readonly rawRight = new Float32Array(this.numBins);
  private readonly smoothed = new Float32Array(this.numBins);

  private bass = 0;
  private mid = 0;
  private treble = 0;
  private overall = 0;
  private lastBass = 0;
  private beatPulse = 0;
  private lastBeatTime = -1e9;
  private lastAudioTime = 0;
  private hasReceivedAudio = false;

  private readonly metrics: AudioMetrics = {
    bass: 0,
    mid: 0,
    treble: 0,
    overall: 0,
    beatPulse: 0,
    spectrum: this.smoothed,
    hasAudio: false,
  };

  constructor() {
    this.registerWallpaperListener();
  }

  private registerWallpaperListener(): void {
    if (typeof window !== 'undefined' && window.wallpaperRegisterAudioListener) {
      try {
        window.wallpaperRegisterAudioListener((audioArray: number[]) => {
          this.onAudioData(audioArray);
        });
      } catch (err) {
        console.warn('Audio listener registration error:', err);
      }
    }
  }

  public onAudioData(audioArray: number[]): void {
    if (!audioArray || audioArray.length < 128) return;

    this.hasReceivedAudio = true;
    this.lastAudioTime = performance.now();

    for (let i = 0; i < this.numBins; i++) {
      const source = i * 2;
      this.rawLeft[i] = Math.max(0, ((audioArray[source] || 0) + (audioArray[source + 1] || 0)) * 0.5);
      this.rawRight[i] = Math.max(0, ((audioArray[source + 64] || 0) + (audioArray[source + 65] || 0)) * 0.5);
    }
  }

  public update(deltaTimeSec: number, sensitivity = 1.5): AudioMetrics {
    const now = performance.now();
    const isAudioActive = this.hasReceivedAudio && now - this.lastAudioTime < 2000;
    const attackFactor = 1 - Math.exp(-this.attackRate * deltaTimeSec);
    const releaseFactor = 1 - Math.exp(-this.releaseRate * deltaTimeSec);

    if (isAudioActive) {
      let bassSum = 0;
      let midSum = 0;
      let trebleSum = 0;
      let totalSum = 0;

      for (let i = 0; i < this.numBins; i++) {
        const raw = Math.min(1, ((this.rawLeft[i] + this.rawRight[i]) / 2) * sensitivity);
        const target = Math.pow(raw, 1.2);
        const factor = target > this.smoothed[i] ? attackFactor : releaseFactor;
        this.smoothed[i] += (target - this.smoothed[i]) * factor;
        totalSum += this.smoothed[i];
        if (i < 6) bassSum += this.smoothed[i];
        else if (i < 20) midSum += this.smoothed[i];
        else trebleSum += this.smoothed[i];
      }

      this.bass = Math.min(1, (bassSum / 6) * 1.5);
      this.mid = Math.min(1, (midSum / 14) * 1.3);
      this.treble = Math.min(1, (trebleSum / 12) * 1.4);
      this.overall = Math.min(1, totalSum / this.numBins);

      const jump = this.bass - this.lastBass;
      if (jump > 0.16 && this.bass > 0.28 && now - this.lastBeatTime > 350) {
        this.beatPulse = 1;
        this.lastBeatTime = now;
      }
      this.lastBass = this.bass;
    } else {
      const pulse = Math.sin(now * 0.0015) * 0.15 + 0.15;
      const wave = Math.cos(now * 0.0025) * 0.1 + 0.1;
      this.bass += (pulse * 0.5 - this.bass) * releaseFactor;
      this.mid += (wave * 0.4 - this.mid) * releaseFactor;
      this.treble += (pulse * 0.3 - this.treble) * releaseFactor;
      this.overall += (pulse * 0.4 - this.overall) * releaseFactor;
      this.lastBass = this.bass;

      for (let i = 0; i < this.numBins; i++) {
        const target = Math.sin(now * 0.002 + i * 0.2) * 0.08 + 0.08;
        const factor = target > this.smoothed[i] ? attackFactor : releaseFactor;
        this.smoothed[i] += (target - this.smoothed[i]) * factor;
      }
    }

    this.beatPulse = Math.max(0, this.beatPulse - deltaTimeSec * 3.5);

    this.metrics.bass = this.bass;
    this.metrics.mid = this.mid;
    this.metrics.treble = this.treble;
    this.metrics.overall = this.overall;
    this.metrics.beatPulse = this.beatPulse;
    this.metrics.hasAudio = isAudioActive;
    return this.metrics;
  }
}
