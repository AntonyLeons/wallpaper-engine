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
  private readonly NUM_BINS = 32;
  private readonly ATTACK_RATE = 30;
  private readonly RELEASE_RATE = 25;
  private rawSpectrumLeft: Float32Array = new Float32Array(this.NUM_BINS);
  private rawSpectrumRight: Float32Array = new Float32Array(this.NUM_BINS);
  private smoothedSpectrum: Float32Array = new Float32Array(this.NUM_BINS);

  private bass = 0;
  private mid = 0;
  private treble = 0;
  private overall = 0;
  private lastBass = 0;
  private lastBeatTime = -1e9;
  private beatPulse = 0;
  private lastAudioTime = 0;
  private hasReceivedAudio = false;

  private readonly metrics: AudioMetrics = {
    bass: 0,
    mid: 0,
    treble: 0,
    overall: 0,
    beatPulse: 0,
    spectrum: this.smoothedSpectrum,
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

    for (let i = 0; i < this.NUM_BINS; i++) {
      const sourceIndex = i * 2;
      this.rawSpectrumLeft[i] = Math.max(0, ((audioArray[sourceIndex] || 0) + (audioArray[sourceIndex + 1] || 0)) * 0.5);
      this.rawSpectrumRight[i] = Math.max(0, ((audioArray[sourceIndex + 64] || 0) + (audioArray[sourceIndex + 65] || 0)) * 0.5);
    }
  }

  public update(deltaTimeSec: number, sensitivity = 1.5): AudioMetrics {
    const now = performance.now();
    const isAudioActive = this.hasReceivedAudio && now - this.lastAudioTime < 2000;
    const attackFactor = 1 - Math.exp(-this.ATTACK_RATE * deltaTimeSec);
    const releaseFactor = 1 - Math.exp(-this.RELEASE_RATE * deltaTimeSec);

    if (isAudioActive) {
      let bassSum = 0;
      let midSum = 0;
      let trebleSum = 0;
      let totalSum = 0;

      for (let i = 0; i < this.NUM_BINS; i++) {
        const rawVal = Math.min(1, ((this.rawSpectrumLeft[i] + this.rawSpectrumRight[i]) / 2) * sensitivity);
        const targetVal = Math.pow(rawVal, 1.2);
        const factor = targetVal > this.smoothedSpectrum[i] ? attackFactor : releaseFactor;
        this.smoothedSpectrum[i] += (targetVal - this.smoothedSpectrum[i]) * factor;
        totalSum += this.smoothedSpectrum[i];
        if (i < 6) bassSum += this.smoothedSpectrum[i];
        else if (i < 20) midSum += this.smoothedSpectrum[i];
        else trebleSum += this.smoothedSpectrum[i];
      }

      this.bass = Math.min(1, (bassSum / 6) * 1.5);
      this.mid = Math.min(1, (midSum / 14) * 1.3);
      this.treble = Math.min(1, (trebleSum / 12) * 1.4);
      this.overall = Math.min(1, totalSum / this.NUM_BINS);

      const bassJump = this.bass - this.lastBass;
      if (bassJump > 0.16 && this.bass > 0.28 && now - this.lastBeatTime > 350) {
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

      for (let i = 0; i < this.NUM_BINS; i++) {
        const target = Math.sin(now * 0.002 + i * 0.2) * 0.08 + 0.08;
        const factor = target > this.smoothedSpectrum[i] ? attackFactor : releaseFactor;
        this.smoothedSpectrum[i] += (target - this.smoothedSpectrum[i]) * factor;
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
