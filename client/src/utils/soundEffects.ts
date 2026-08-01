// Web Audio API Sound Synthesizer for Premium Micro-interactions

class SoundEngine {
  private audioContext: AudioContext | null = null;
  private isEnabled: boolean = true;

  private init() {
    if (!this.audioContext && typeof window !== 'undefined') {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioContextClass();
      } catch (e) {
        console.warn('Web Audio API not supported');
        this.isEnabled = false;
      }
    }
  }

  // Play a soft, pleasant pop for receiving messages
  playPop() {
    if (!this.isEnabled) return;
    this.init();
    if (!this.audioContext) return;

    const t = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = 'sine';
    
    // Frequency sweep for a "pop" sound
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.1);
    
    // Volume envelope
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.connect(gain);
    gain.connect(this.audioContext.destination);

    osc.start(t);
    osc.stop(t + 0.1);
  }

  // Play a sleek chime for joining a room or completing a task
  playChime() {
    if (!this.isEnabled) return;
    this.init();
    if (!this.audioContext) return;

    const t = this.audioContext.currentTime;
    
    // Play a major chord (C, E, G)
    const playNote = (freq: number, delay: number) => {
      if (!this.audioContext) return;
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(0, t + delay);
      gain.gain.linearRampToValueAtTime(0.15, t + delay + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.8);
      
      osc.connect(gain);
      gain.connect(this.audioContext.destination);
      
      osc.start(t + delay);
      osc.stop(t + delay + 0.8);
    };

    playNote(523.25, 0);      // C5
    playNote(659.25, 0.08);   // E5
    playNote(783.99, 0.16);   // G5
  }

  // Play a soft whoosh for sending files
  playWhoosh() {
    if (!this.isEnabled) return;
    this.init();
    if (!this.audioContext) return;

    const t = this.audioContext.currentTime;
    const bufferSize = this.audioContext.sampleRate * 0.5; // 0.5 seconds of noise
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    // Generate white noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;

    // Filter to make it sound like a "whoosh" (bandpass sweeping up)
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1;
    filter.frequency.setValueAtTime(100, t);
    filter.frequency.exponentialRampToValueAtTime(2000, t + 0.2);
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.5);

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioContext.destination);

    noise.start(t);
    noise.stop(t + 0.5);
  }
}

export const sounds = new SoundEngine();
