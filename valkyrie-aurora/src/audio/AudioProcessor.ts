export class AudioProcessor {
  private rawAudio: number[] = new Array(128).fill(0);
  private smoothedAudio: number[] = new Array(64).fill(0);

  public bass = 0;
  public mid = 0;
  public treble = 0;
  public overall = 0;

  private smoothingFactor = 0.35; // Exponential moving average factor

  public processAudioData(audioData: number[]): void {
    if (!Array.isArray(audioData) || audioData.length < 128) return;

    for (let i = 0; i < 128; i++) {
      const val = typeof audioData[i] === 'number' ? Math.max(0, Math.min(1, audioData[i])) : 0;
      this.rawAudio[i] = val;
    }

    // Aggregate left and right stereo channels into 64 mono bands
    let bassSum = 0;
    let midSum = 0;
    let trebleSum = 0;
    let totalSum = 0;

    for (let i = 0; i < 64; i++) {
      const left = this.rawAudio[i];
      const right = this.rawAudio[i + 64];
      const combined = (left + right) * 0.5;

      // Exponential smoothing
      this.smoothedAudio[i] += (combined - this.smoothedAudio[i]) * this.smoothingFactor;

      totalSum += this.smoothedAudio[i];

      if (i < 16) {
        bassSum += this.smoothedAudio[i];
      } else if (i < 40) {
        midSum += this.smoothedAudio[i];
      } else {
        trebleSum += this.smoothedAudio[i];
      }
    }

    this.bass = (bassSum / 16);
    this.mid = (midSum / 24);
    this.treble = (trebleSum / 24);
    this.overall = (totalSum / 64);
  }

  public getFrequencySpectrum(): number[] {
    return this.smoothedAudio;
  }
}

export const audioProcessor = new AudioProcessor();
