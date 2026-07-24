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
  // Separate rates keep beats responsive while letting the visualizer trail off naturally.
  private readonly ATTACK_RATE = 30;
  private readonly RELEASE_RATE = 25;
  private rawSpectrumLeft: Float32Array = new Float32Array(this.NUM_BINS);
  private rawSpectrumRight: Float32Array = new Float32Array(this.NUM_BINS);
  private smoothedSpectrum: Float32Array = new Float32Array(this.NUM_BINS);

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
      // Combine each adjacent pair so the renderer can retain its efficient 32-bin spectrum.
      const sourceIndex = i * 2;
      this.rawSpectrumLeft[i] = Math.max(0, ((audioArray[sourceIndex] || 0) + (audioArray[sourceIndex + 1] || 0)) * 0.5);
      this.rawSpectrumRight[i] = Math.max(0, ((audioArray[sourceIndex + 64] || 0) + (audioArray[sourceIndex + 65] || 0)) * 0.5);
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
        // Combined mono average
        const rawVal = Math.min(1.0, ((this.rawSpectrumLeft[i] + this.rawSpectrumRight[i]) / 2) * sensitivity);

        // Exponential response curve for dynamic audio punch
        const targetVal = Math.pow(rawVal, 1.2);

        // Rise quickly on beats and release gradually so the visualizer does not snap to zero.
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
      // Subtle ambient pulse when no audio is playing
      const pulse = Math.sin(now * 0.0015) * 0.15 + 0.15;
      const wave = Math.cos(now * 0.0025) * 0.1 + 0.1;

      this.bass += (pulse * 0.5 - this.bass) * releaseFactor;
      this.mid += (wave * 0.4 - this.mid) * releaseFactor;
      this.treble += (pulse * 0.3 - this.treble) * releaseFactor;
      this.overall += (pulse * 0.4 - this.overall) * releaseFactor;

      for (let i = 0; i < this.NUM_BINS; i++) {
        const synthFreq = Math.sin(now * 0.002 + i * 0.2) * 0.08 + 0.08;
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
