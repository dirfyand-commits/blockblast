/**
 * sound.js – Sistem audio lengkap menggunakan Web Audio API
 * Block Blast Pro – Puzzle Arena
 * Semua suara dibuat secara prosedural (tidak perlu file audio eksternal)
 */

class SoundSystem {
  constructor() {
    this.ctx = null;
    this.musicEnabled = true;
    this.sfxEnabled   = true;
    this.musicVolume  = 0.35;
    this.sfxVolume    = 0.7;
    this.bgmNode      = null;     // oscillator chain untuk BGM
    this.bgmGain      = null;
    this._bgmPlaying  = false;
    this._bgmInterval = null;
    this._bgmNoteIdx  = 0;
    this._initiated   = false;

    // Load settings dari localStorage
    const saved = localStorage.getItem('bb_audio');
    if (saved) {
      const s = JSON.parse(saved);
      this.musicEnabled = s.music !== false;
      this.sfxEnabled   = s.sfx   !== false;
    }
  }

  /** Inisialisasi AudioContext (harus dipanggil setelah interaksi user) */
  init() {
    if (this._initiated) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = this.musicVolume;
      this.bgmGain.connect(this.ctx.destination);
      this._initiated = true;
      if (this.musicEnabled) this.startBGM();
    } catch(e) {
      console.warn('AudioContext tidak tersedia:', e);
    }
  }

  saveSettings() {
    localStorage.setItem('bb_audio', JSON.stringify({
      music: this.musicEnabled,
      sfx:   this.sfxEnabled,
    }));
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    if (this.musicEnabled) { this.init(); this.startBGM(); }
    else this.stopBGM();
    this.saveSettings();
    return this.musicEnabled;
  }

  toggleSFX() {
    this.sfxEnabled = !this.sfxEnabled;
    this.saveSettings();
    return this.sfxEnabled;
  }

  // ─── BGM GENERATOR ────────────────────────────────────────
  // Melodi looping "chiptune lo-fi" yang menenangkan
  startBGM() {
    if (!this.ctx || this._bgmPlaying) return;
    this._bgmPlaying = true;

    // Urutan nada (frekuensi Hz) – tangga nada minor pentatonik
    const SCALE = [
      261.63, 293.66, 311.13, 349.23, 392.00,
      440.00, 466.16, 523.25, 587.33, 622.25,
    ];
    const MELODY = [
      4,3,2,1,3,2,4,5, 6,5,4,3,5,4,3,2,
      3,4,5,4,3,2,1,0, 2,3,4,3,2,1,0,1,
    ].map(i => SCALE[i % SCALE.length]);

    let noteIdx = 0;
    const BPM   = 76;
    const NOTE  = (60 / BPM) * 0.5; // eighth note

    const playNote = () => {
      if (!this._bgmPlaying || !this.ctx) return;
      const freq = MELODY[noteIdx % MELODY.length];
      noteIdx++;

      const osc  = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 0.02);
      gain.gain.linearRampToValueAtTime(0.1, this.ctx.currentTime + NOTE * 0.7);
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + NOTE);

      osc.connect(gain);
      gain.connect(this.bgmGain);

      osc.start(this.ctx.currentTime);
      osc.stop(this.ctx.currentTime + NOTE);
    };

    // Chord pads latar belakang
    const playPad = () => {
      if (!this._bgmPlaying || !this.ctx) return;
      const chords = [[130.81, 164.81, 196.00], [110.00, 138.59, 164.81]];
      const chord  = chords[Math.floor(noteIdx / 8) % chords.length];
      chord.forEach(freq => {
        const osc  = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + NOTE * 8);
        osc.connect(gain);
        gain.connect(this.bgmGain);
        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + NOTE * 8);
      });
    };

    this._bgmInterval = setInterval(() => {
      if (!this.musicEnabled) return;
      playNote();
      if (noteIdx % 8 === 0) playPad();
    }, NOTE * 1000);
  }

  stopBGM() {
    this._bgmPlaying = false;
    if (this._bgmInterval) { clearInterval(this._bgmInterval); this._bgmInterval = null; }
  }

  // ─── SFX ───────────────────────────────────────────────────
  _playTone(opts) {
    if (!this.sfxEnabled || !this.ctx) return;
    const {
      type = 'square', freq = 440, freq2 = null,
      duration = 0.15, volume = 0.5,
      attack = 0.01, decay = 0.1,
      detune = 0,
    } = opts;

    const osc  = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value    = detune;

    if (freq2) {
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(freq2, this.ctx.currentTime + duration);
    }

    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume * this.sfxVolume, this.ctx.currentTime + attack);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + attack + decay);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration + 0.05);
  }

  /** Suara saat block ditempatkan */
  playPlace() {
    this._playTone({ type: 'triangle', freq: 520, freq2: 440, duration: 0.12, volume: 0.45, decay: 0.1 });
  }

  /** Suara saat 1 baris/kolom dihancurkan */
  playClear() {
    const notes = [440, 523, 659, 784];
    notes.forEach((f, i) => {
      setTimeout(() => {
        this._playTone({ type: 'sine', freq: f, freq2: f * 1.5, duration: 0.18, volume: 0.6, decay: 0.14 });
      }, i * 55);
    });
  }

  /** Suara combo */
  playCombo(level = 2) {
    const base = 330 + level * 55;
    for (let i = 0; i < level; i++) {
      setTimeout(() => {
        this._playTone({ type: 'sawtooth', freq: base + i * 80, freq2: base + i * 80 + 200, duration: 0.2, volume: 0.55, decay: 0.18 });
      }, i * 80);
    }
  }

  /** Suara game over */
  playGameOver() {
    const notes = [440, 392, 349, 261];
    notes.forEach((f, i) => {
      setTimeout(() => {
        this._playTone({ type: 'sawtooth', freq: f, duration: 0.4, volume: 0.4, decay: 0.35 });
      }, i * 180);
    });
  }

  /** Suara menang */
  playWin() {
    const melody = [523, 659, 784, 1047, 784, 1047, 1319];
    melody.forEach((f, i) => {
      setTimeout(() => {
        this._playTone({ type: 'sine', freq: f, freq2: f * 1.02, duration: 0.22, volume: 0.6, decay: 0.18 });
      }, i * 100);
    });
  }

  /** Suara penalti duel */
  playPenalty() {
    this._playTone({ type: 'sawtooth', freq: 180, freq2: 100, duration: 0.5, volume: 0.7, decay: 0.45 });
    setTimeout(() => {
      this._playTone({ type: 'square', freq: 120, duration: 0.3, volume: 0.5, decay: 0.28 });
    }, 150);
  }

  /** Suara klik UI */
  playClick() {
    this._playTone({ type: 'sine', freq: 800, freq2: 700, duration: 0.08, volume: 0.25, decay: 0.07 });
  }

  /** Suara level up */
  playLevelUp() {
    const seq = [523, 659, 784, 1047, 1319];
    seq.forEach((f, i) => {
      setTimeout(() => {
        this._playTone({ type: 'triangle', freq: f, duration: 0.25, volume: 0.55, decay: 0.22 });
      }, i * 90);
    });
  }

  /** Suara coin */
  playCoin() {
    this._playTone({ type: 'sine', freq: 1046, freq2: 1318, duration: 0.15, volume: 0.4, decay: 0.12 });
  }

  /** Suara block tidak bisa diletakkan */
  playInvalid() {
    this._playTone({ type: 'square', freq: 200, duration: 0.1, volume: 0.3, decay: 0.08 });
  }

  /** Suara rank up */
  playRankUp() {
    const seq = [659, 784, 880, 1047, 1319, 1568];
    seq.forEach((f, i) => {
      setTimeout(() => {
        this._playTone({ type: 'triangle', freq: f, duration: 0.28, volume: 0.6, decay: 0.25 });
      }, i * 100);
    });
  }

  /** Suara battle royale elimination */
  playElimination() {
    this._playTone({ type: 'sawtooth', freq: 440, freq2: 110, duration: 0.6, volume: 0.6, decay: 0.55 });
  }
}

// Ekspor sebagai global singleton
window.Sound = new SoundSystem();
