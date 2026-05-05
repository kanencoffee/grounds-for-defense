// Procedural audio for Grounds for Defense — Web Audio API, no external files
const Audio = (() => {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicNodes = [];

  function ensureCtx() {
    if (ctx) return ctx;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.18;
    musicGain.connect(master);
    return ctx;
  }

  function tone(freq, dur, type='sine', vol=0.25, attack=0.005, release=null) {
    if (muted) return;
    const c = ensureCtx(); if (!c) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t = c.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noise(dur, vol=0.2, hpf=400, lpf=8000) {
    if (muted) return;
    const c = ensureCtx(); if (!c) return;
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i=0; i<data.length; i++) data[i] = (Math.random()*2-1) * (1 - i/data.length);
    const src = c.createBufferSource();
    src.buffer = buf;
    const hp = c.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=hpf;
    const lp = c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=lpf;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(hp).connect(lp).connect(g).connect(master);
    src.start();
    src.stop(c.currentTime + dur + 0.05);
  }

  function sweep(f1, f2, dur, type='sawtooth', vol=0.18) {
    if (muted) return;
    const c = ensureCtx(); if (!c) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    const t = c.currentTime;
    osc.frequency.setValueAtTime(f1, t);
    osc.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(master);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  // ===== SFX =====
  const sfx = {
    drip:        () => tone(880 + Math.random()*120, 0.05, 'square', 0.06),
    espressoChg: () => sweep(120, 600, 1.4, 'sawtooth', 0.08),
    espressoFire:() => { sweep(900, 100, 0.35, 'sawtooth', 0.22); noise(0.25, 0.08, 1200, 6000); },
    frother:     () => { noise(0.18, 0.08, 800, 4000); tone(420, 0.12, 'sine', 0.06); },
    cold:        () => tone(140 + Math.random()*20, 0.18, 'sine', 0.04),
    grinder:     () => noise(0.12, 0.1, 1200, 5000),
    pourover:    () => { tone(700, 0.08, 'triangle', 0.08); tone(900, 0.06, 'sine', 0.05, 0.005); },
    aeropress:   () => { tone(220, 0.04, 'square', 0.1); noise(0.06, 0.06, 600, 3000); },
    hit:         () => tone(1400 + Math.random()*200, 0.04, 'square', 0.05),
    enemyDie:    () => { sweep(440, 60, 0.25, 'sawtooth', 0.12); noise(0.15, 0.04, 200, 2000); },
    enemyReachEnd:()=> { sweep(220, 80, 0.4, 'square', 0.15); },
    place:       () => { tone(523, 0.06, 'sine', 0.12); tone(784, 0.12, 'sine', 0.08, 0.005); },
    sell:        () => { tone(659, 0.06, 'sine', 0.1); tone(440, 0.12, 'sine', 0.08, 0.005); },
    upgrade:     () => { tone(523, 0.08, 'square', 0.1); tone(659, 0.08, 'square', 0.1); tone(784, 0.16, 'square', 0.1); },
    waveStart:   () => { tone(440, 0.1, 'square', 0.1); tone(554, 0.1, 'square', 0.1, 0.005); tone(659, 0.18, 'square', 0.12, 0.005); },
    waveClear:   () => { [523,659,784,1047].forEach((f,i) => setTimeout(()=>tone(f, 0.15, 'sine', 0.14), i*70)); },
    perfectShot: () => { sweep(2000, 200, 0.5, 'square', 0.2); noise(0.3, 0.12, 600, 8000); },
    lose:        () => { [392, 370, 311, 261].forEach((f,i)=> setTimeout(()=>tone(f, 0.5, 'sawtooth', 0.18), i*220)); },
    win:         () => { [523, 659, 784, 1047, 1319].forEach((f,i)=> setTimeout(()=>tone(f, 0.4, 'triangle', 0.16), i*150)); },
    error:       () => tone(180, 0.1, 'square', 0.12),
    splash:      () => { noise(0.18, 0.1, 200, 2000); tone(180, 0.15, 'sine', 0.06); },
  };

  // ===== Ambient music — layered drone with slow modulation =====
  function startMusic() {
    if (musicNodes.length || muted) return;
    const c = ensureCtx(); if (!c) return;
    const t = c.currentTime;
    // C minor pad: C2, Eb2, G2, C3
    const freqs = [65.4, 77.8, 98.0, 130.8];
    freqs.forEach((f, i) => {
      const osc = c.createOscillator();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = f;
      // detune slightly per voice for chorus
      osc.detune.value = (i - 2) * 4;
      const g = c.createGain();
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.06, t + 3);
      // slow LFO on gain for breathing
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.07 + i*0.02;
      const lfoGain = c.createGain();
      lfoGain.gain.value = 0.025;
      lfo.connect(lfoGain).connect(g.gain);
      // soft lowpass
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 800;
      osc.connect(g).connect(lp).connect(musicGain);
      osc.start(t);
      lfo.start(t);
      musicNodes.push(osc, lfo);
    });
    // sparse high tinkle
    const tinkle = setInterval(() => {
      if (muted || !musicNodes.length) return;
      if (Math.random() < 0.6) return;
      const notes = [1047, 1319, 1568, 2093];
      tone(notes[Math.floor(Math.random()*notes.length)], 0.5, 'sine', 0.04, 0.05);
    }, 4500);
    musicNodes.push({ stop: () => clearInterval(tinkle) });
  }

  function stopMusic() {
    musicNodes.forEach(n => { try { n.stop && n.stop(); } catch(e){} });
    musicNodes = [];
  }

  function setMute(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.6;
  }

  function isMuted() { return muted; }

  return { sfx, startMusic, stopMusic, setMute, isMuted, ensureCtx };
})();
