/**
 * Audio Engine providing realistic playback and stream routing for the Audiobook Player Overlay.
 * Supports:
 * - Uploaded MP3/WAV/AAC/OGG audio files
 * - Web Audio API procedural ambient audiobook hum / fantasy embers
 * - MediaStream destination for real-time video export with embedded audio
 */

class AudiobookAudioEngine {
  private ctx: AudioContext | null = null;
  private customAudio: HTMLAudioElement | null = null;
  private customAudioUrl: string | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private mediaStreamDest: MediaStreamAudioDestinationNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private isSynthesizing = false;
  private isUsingCustomAudio = false;

  public init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.value = 0.85;

        this.analyserNode = this.ctx.createAnalyser();
        this.analyserNode.fftSize = 64;

        this.mediaStreamDest = this.ctx.createMediaStreamDestination();

        this.gainNode.connect(this.ctx.destination);
        this.gainNode.connect(this.mediaStreamDest);
        this.gainNode.connect(this.analyserNode);
      }
    }
  }

  public setCustomAudio(url: string, onEnded?: () => void): HTMLAudioElement {
    this.init();
    if (this.customAudio) {
      this.customAudio.pause();
      this.customAudio.src = '';
    }

    this.customAudioUrl = url;
    this.customAudio = new Audio(url);
    this.customAudio.crossOrigin = 'anonymous';
    this.isUsingCustomAudio = true;

    if (onEnded) {
      this.customAudio.onended = onEnded;
    }

    // Connect customAudio through AudioContext so it feeds mediaStreamDest for video recording
    if (this.ctx && this.gainNode) {
      try {
        this.sourceNode = this.ctx.createMediaElementSource(this.customAudio);
        this.sourceNode.connect(this.gainNode);
      } catch (e) {
        // If already connected or cross-origin issue, audio plays via direct element
        console.warn('Audio node connection notice:', e);
      }
    }

    return this.customAudio;
  }

  public getAudioElement(): HTMLAudioElement | null {
    return this.customAudio;
  }

  public getAudioStreamDestination(): MediaStreamAudioDestinationNode | null {
    this.init();
    return this.mediaStreamDest;
  }

  public getAudioContext(): AudioContext | null {
    this.init();
    return this.ctx;
  }

  public clearCustomAudio() {
    if (this.customAudio) {
      this.customAudio.pause();
      this.customAudio = null;
    }
    this.customAudioUrl = null;
    this.isUsingCustomAudio = false;
  }

  public play(currentTime: number, volume: number, isMuted: boolean) {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const effectiveVolume = isMuted ? 0 : volume;

    if (this.isUsingCustomAudio && this.customAudio) {
      this.customAudio.currentTime = currentTime;
      this.customAudio.volume = effectiveVolume;
      this.customAudio.play().catch(() => {});
      return;
    }

    // Procedural ambient fantasy audiobook soundscape
    this.startProceduralAmbient(effectiveVolume);
  }

  public pause() {
    if (this.customAudio) {
      this.customAudio.pause();
    }
    this.stopProceduralAmbient();
  }

  public seek(seconds: number) {
    if (this.customAudio && this.isUsingCustomAudio) {
      this.customAudio.currentTime = seconds;
    }
  }

  public setVolume(volume: number, isMuted: boolean) {
    const effective = isMuted ? 0 : volume;
    if (this.gainNode) {
      this.gainNode.gain.setValueAtTime(effective, this.ctx ? this.ctx.currentTime : 0);
    }
    if (this.customAudio) {
      this.customAudio.volume = effective;
    }
  }

  public getAnalyserData(): Uint8Array | null {
    if (!this.analyserNode) return null;
    const data = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(data);
    return data;
  }

  private startProceduralAmbient(volume: number) {
    if (!this.ctx || !this.gainNode) return;
    this.stopProceduralAmbient();

    this.gainNode.gain.setValueAtTime(volume * 0.35, this.ctx.currentTime);

    // Warm twin sine oscillators creating deep, soothing resonant ambiance
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const subOsc = this.ctx.createOscillator();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(110, this.ctx.currentTime); // A2

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(164.81, this.ctx.currentTime); // E3 warm fifth

    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(55, this.ctx.currentTime); // A1 sub warmth

    // Low-pass filter for cozy audiobook vinyl warmth
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, this.ctx.currentTime);

    // Subtle gentle LFO for breathing movement
    const lfo = this.ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.2, this.ctx.currentTime);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    lfo.connect(lfoGain.gain);

    osc1.connect(filter);
    osc2.connect(filter);
    subOsc.connect(filter);
    filter.connect(this.gainNode);

    osc1.start();
    osc2.start();
    subOsc.start();

    // Store reference to clean up
    (this as unknown as { oscNodes: AudioNode[] }).oscNodes = [osc1, osc2, subOsc, filter];
    this.isSynthesizing = true;
  }

  private stopProceduralAmbient() {
    const nodes = (this as unknown as { oscNodes?: AudioNode[] }).oscNodes;
    if (nodes) {
      nodes.forEach((node) => {
        try {
          if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
            (node as AudioScheduledSourceNode).stop();
          }
          node.disconnect();
        } catch {
          // ignore
        }
      });
      (this as unknown as { oscNodes?: AudioNode[] }).oscNodes = undefined;
    }
    this.isSynthesizing = false;
  }
}

export const audioEngine = new AudiobookAudioEngine();
