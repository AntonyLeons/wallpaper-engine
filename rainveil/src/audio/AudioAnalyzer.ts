export interface AudioMetrics {
  bass: number; // 0..1
  mid: number; // 0..1
  treble: number; // 0..1
  overall: number; // 0..1
  spectrum: Float32Array; // 32 smoothed frequency bins (0..1)
  hasAudio: boolean;
}

export class AudioAnalyzer {
  private readonly NUM_BINS = 32;
  private readonly ATTACK_RATE = 30;
  private readonly RELEASE_RATE = 25;
  private readonly rawSpectrumLeft: Float32Array = new Float32Array(this.NUM_BINS);
  private readonly rawSpectrumRight: Float32Array = new Float32Array(this.NUM_BINS);
  private readonly smoothedSpectrum: Float32Array = new Float32Array(this.NUM_BINS);

  private bass = 0;
  private mid = 0;
  private treble = 0;
  private overall = 0;

  private lastAudioTime = 0;
  private hasReceivedAudio = false;

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
      // Wallpaper Engine supplies 64 bins per channel: 0..63 left, 64..127 right.
      const sourceIndex = i * 2;
      this.rawSpectrumLeft[i] = Math.max(
        0,
        ((audioArray[sourceIndex] || 0) + (audioArray[sourceIndex + 1] || 0)) * 0.5
      );
      this.rawSpectrumRight[i] = Math.max(
        0,
        ((audioArray[sourceIndex + 64] || 0) + (audioArray[sourceIndex + 65] || 0)) * 0.5
      );
    }
  }

  public update(deltaTimeSec: number, sensitivity: number = 1.5): AudioMetrics {
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
        const rawVal = Math.min(1.0, ((this.rawSpectrumLeft[i] + this.rawSpectrumRight[i]) / 2) * sensitivity);
        const targetVal = Math.pow(rawVal, 1.2);

        const smoothingFactor = targetVal > this.smoothedSpectrum[i] ? attackFactor : releaseFactor;
        this.smoothedSpectrum[i] += (targetVal - this.smoothedSpectrum[i]) * smoothingFactor;

        totalSum += this.smoothedSpectrum[i];

        if (i < 6) {
          bassSum += this.smoothedSpectrum[i];
        } else if (i < 20) {
          midSum += this.smoothedSpectrum[i];
        } else {
          trebleSum += this.smoothedSpectrum[i];
        }
      }

      this.bass = Math.min(1.0, (bassSum / 6) * 1.5);
      this.mid = Math.min(1.0, (midSum / 14) * 1.3);
      this.treble = Math.min(1.0, (trebleSum / 12) * 1.4);
      this.overall = Math.min(1.0, totalSum / this.NUM_BINS);
    } else {
      // A slow ambient swell keeps the scene breathing when nothing is playing.
      const pulse = Math.sin(now * 0.0012) * 0.12 + 0.12;
      const wave = Math.cos(now * 0.0019) * 0.08 + 0.08;

      this.bass += (pulse - this.bass) * releaseFactor;
      this.mid += (wave - this.mid) * releaseFactor;
      this.treble += (pulse * 0.6 - this.treble) * releaseFactor;
      this.overall += (pulse * 0.7 - this.overall) * releaseFactor;

      for (let i = 0; i < this.NUM_BINS; i++) {
        const synthFreq = Math.sin(now * 0.002 + i * 0.2) * 0.06 + 0.06;
        const smoothingFactor = synthFreq > this.smoothedSpectrum[i] ? attackFactor : releaseFactor;
        this.smoothedSpectrum[i] += (synthFreq - this.smoothedSpectrum[i]) * smoothingFactor;
      }
    }

    return {
      bass: this.bass,
      mid: this.mid,
      treble: this.treble,
      overall: this.overall,
      spectrum: this.smoothedSpectrum,
      hasAudio: isAudioActive,
    };
  }
}
