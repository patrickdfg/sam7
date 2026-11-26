// =========================================================================
// HYBRID AUDIO ENGINE: Auto-loads assets/bgm_<track>.mp3 if present,
// otherwise seamlessly synthesizes multi-channel 16-bit Oriental Chiptune!
// =========================================================================
const Sound = {
  ctx: null, muted: false, bgmVol: 0.7, sfxVol: 0.85,
  bgmTimer: null, currentTrack: null, step: 0,
  htmlAudio: null, usingExternalBgm: false,

  init() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  setVolumes(bgmPct, sfxPct) {
    this.bgmVol = bgmPct / 100;
    this.sfxVol = sfxPct / 100;
    if (this.htmlAudio) this.htmlAudio.volume = this.muted ? 0 : this.bgmVol;
  },

  playTone(freq, dur, type='square', vol=0.07, delay=0, isBgm=false) {
    const scale = isBgm ? this.bgmVol : this.sfxVol;
    if (this.muted || !this.ctx || freq <= 0 || scale <= 0.01) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol * scale, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(t); osc.stop(t + dur);
  },

  playNoise(dur=0.06, vol=0.05, isBgm=false) {
    const scale = isBgm ? this.bgmVol : this.sfxVol;
    if (this.muted || !this.ctx || scale <= 0.01) return;
    const bufSize = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol * scale, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    src.connect(gain); gain.connect(this.ctx.destination);
    src.start();
  },

  sfx(name) {
    this.init();
    if (name === 'step') this.playTone(140, 0.035, 'triangle', 0.045);
    if (name === 'talk') this.playTone(540 + Math.random()*130, 0.035, 'square', 0.035);
    if (name === 'radar') { this.playTone(1200, 0.09, 'sine', 0.08); this.playTone(1600, 0.12, 'sine', 0.06, 0.09); }
    if (name === 'coin') { this.playTone(987, 0.07, 'square', 0.08); this.playTone(1318, 0.16, 'square', 0.08, 0.07); }
    if (name === 'equip') { [440, 660, 880].forEach((f,i)=>this.playTone(f, 0.08, 'triangle', 0.09, i*0.04)); }
    if (name === 'hit') { this.playTone(135, 0.11, 'sawtooth', 0.13); this.playNoise(0.08, 0.09); }
    if (name === 'crit') { this.playTone(220, 0.08, 'sawtooth', 0.15); this.playTone(110, 0.18, 'square', 0.14, 0.05); this.playNoise(0.12, 0.12); }
    if (name === 'warn') { [220, 185, 220].forEach((f,i)=>this.playTone(f, 0.12, 'sawtooth', 0.1, i*0.12)); }
    if (name === 'skill') { [330,440,587,880,1174].forEach((f,i)=>this.playTone(f, 0.14, 'sawtooth', 0.095, i*0.045)); }
    if (name === 'cutin') { [293,440,587,880,1174,1480].forEach((f,i)=>this.playTone(f, 0.16, 'square', 0.1, i*0.05)); }
    if (name === 'heal') { [523,659,784,1046].forEach((f,i)=>this.playTone(f, 0.12, 'triangle', 0.09, i*0.055)); }
    if (name === 'portal') { [392,523,659,784].forEach((f,i)=>this.playTone(f, 0.1, 'sine', 0.08, i*0.05)); }
    if (name === 'levelup') { [523,659,784,1046,1318].forEach((f,i)=>this.playTone(f, i===4?0.4:0.1, 'square', 0.1, i*0.08)); }
    if (name === 'dragonball') {
      [523,659,784,1046,784,1046,1318].forEach((f,i)=>this.playTone(f, i===6?0.5:0.11, 'square', 0.11, i*0.09));
    }
    if (name === 'shenron') {
      [196,261,329,392,523,659,784,1046].forEach((f,i)=>this.playTone(f, 0.35, 'sawtooth', 0.09, i*0.11));
    }
  },

  stopBGM() {
    clearInterval(this.bgmTimer);
    if (this.htmlAudio) { this.htmlAudio.pause(); this.htmlAudio = null; }
    this.usingExternalBgm = false;
  },

  playBGM(track) {
    if (this.currentTrack === track) return;
    this.currentTrack = track;
    this.stopBGM();

    // 1. Try optional high-quality MP3 loop (assets/bgm_<track>.mp3)
    const audio = new Audio(`assets/bgm_${track}.mp3`);
    audio.loop = true;
    audio.volume = this.muted ? 0 : this.bgmVol;
    audio.oncanplaythrough = () => {
      if (this.currentTrack !== track) return;
      clearInterval(this.bgmTimer);
      this.htmlAudio = audio;
      this.usingExternalBgm = true;
      audio.play().catch(() => this.startChiptune(track));
    };
    audio.onerror = () => {
      if (this.currentTrack === track && !this.usingExternalBgm) this.startChiptune(track);
    };
    audio.load();
  },

  startChiptune(track) {
    clearInterval(this.bgmTimer);
    this.step = 0;
    const tracks = {
      village:  { tempo: 250, lead: [392,440,523,587,659,587,523,440, 392,330,293,330,392,440,392,0], bass: [196,0,261,0,220,0,196,0, 146,0,164,0,196,0,196,0], wave: 'triangle' },
      forest:   { tempo: 210, lead: [330,392,440,523,440,392,330,293, 261,293,330,392,330,293,261,0], bass: [164,0,196,0,220,0,164,0, 130,0,146,0,164,0,130,0], wave: 'triangle' },
      chibi:    { tempo: 265, lead: [293,330,392,440,523,440,392,330, 293,261,220,261,293,330,293,0], bass: [146,0,196,0,164,0,146,0, 110,0,130,0,146,0,146,0], wave: 'sine' },
      hulao:    { tempo: 185, lead: [220,293,330,293,392,330,293,220, 261,293,330,392,330,293,220,0], bass: [110,110,146,0,164,164,146,0, 130,130,146,0,164,0,110,0], wave: 'square', drums: true },
      palace:   { tempo: 230, lead: [293,330,440,587,523,440,392,330, 293,440,587,659,587,440,293,0], bass: [146,146,220,0,196,196,164,0, 146,146,220,0,293,0,146,0], wave: 'square' },
      battle:   { tempo: 145, lead: [220,261,330,220,392,330,261,220, 293,330,440,293,523,440,392,330], bass: [110,110,130,110,146,146,130,110, 146,146,164,146,196,164,146,130], wave: 'sawtooth', drums: true },
      boss:     { tempo: 130, lead: [220,233,293,220,349,330,293,233, 261,293,349,440,392,349,330,293], bass: [110,110,116,110,146,146,130,116, 130,130,146,164,146,130,116,110], wave: 'sawtooth', drums: true },
      ending:   { tempo: 260, lead: [523,659,784,1046,880,784,659,587, 523,587,659,784,1046,1174,1046,0], bass: [261,0,329,0,392,0,329,0, 261,0,329,0,392,0,523,0], wave: 'triangle' }
    };
    const t = tracks[track] || tracks.village;
    this.bgmTimer = setInterval(() => {
      if (this.muted || !this.ctx || this.bgmVol <= 0.01) return;
      const idx = this.step % t.lead.length;
      const lf = t.lead[idx], bf = t.bass[idx];
      if (lf > 0) this.playTone(lf, t.tempo/1000 * 0.85, t.wave, track==='battle'||track==='boss' ? 0.045 : 0.052, 0, true);
      if (bf > 0) this.playTone(bf, t.tempo/1000 * 0.9, 'sine', 0.046, 0, true);
      if (t.drums && this.step % 2 === 0) this.playNoise(0.035, 0.025, true);
      this.step++;
    }, t.tempo);
  }
};
