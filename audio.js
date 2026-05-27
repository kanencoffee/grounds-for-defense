// MP3-based audio for Grounds for Defense — KANEN-styled SFX & music via Ludo.ai
const Audio = (() => {
  const BASE = 'assets/audio/';
  let muted = false;
  let musicEl = null;
  let currentMusic = null;

  // SFX key -> filename
  const SFX_FILES = {
    hit:             'sfx-hit.mp3',
    enemyDie:        'sfx-enemy-die.mp3',
    grinder:         'sfx-grinder.mp3',
    espressoChg:     'sfx-espresso-chg.mp3',
    espressoFire:    'sfx-espresso-fire.mp3',
    drip:            'sfx-drip.mp3',
    aeropress:       'sfx-aeropress.mp3',
    frother:         'sfx-frother.mp3',
    pourover:        'sfx-pourover.mp3',
    splash:          'sfx-splash.mp3',
    perfectShot:     'sfx-perfect.mp3',
    upgrade:         'sfx-upgrade.mp3',
    error:           'sfx-error.mp3',
    sell:            'sfx-sell.mp3',
    place:           'sfx-place.mp3',
    waveStart:       'sfx-wave-start.mp3',
    waveClear:       'sfx-wave-clear.mp3',
    enemyReachEnd:   'sfx-reach-end.mp3',
    win:             'sfx-win.mp3',
    lose:            'sfx-lose.mp3',
  };

  // Per-SFX volume (0-1)
  const SFX_VOL = {
    hit: 0.35, enemyDie: 0.45, grinder: 0.4, espressoChg: 0.35, espressoFire: 0.5,
    drip: 0.4, aeropress: 0.45, frother: 0.4, pourover: 0.4, splash: 0.45,
    perfectShot: 0.55, upgrade: 0.55, error: 0.5, sell: 0.5, place: 0.5,
    waveStart: 0.6, waveClear: 0.6, enemyReachEnd: 0.6, win: 0.7, lose: 0.7,
  };

  // Preload pools (clone-based to allow overlap)
  const POOL_SIZE = 4;
  const pools = {};
  function buildPool(key) {
    const arr = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const a = new window.Audio(BASE + SFX_FILES[key]);
      a.preload = 'auto';
      a.volume = SFX_VOL[key] ?? 0.5;
      arr.push(a);
    }
    pools[key] = { arr, idx: 0 };
  }
  for (const k of Object.keys(SFX_FILES)) buildPool(k);

  function play(key) {
    if (muted) return;
    const pool = pools[key]; if (!pool) return;
    const a = pool.arr[pool.idx];
    pool.idx = (pool.idx + 1) % POOL_SIZE;
    try {
      a.currentTime = 0;
      a.volume = SFX_VOL[key] ?? 0.5;
      const p = a.play();
      if (p && p.catch) p.catch(()=>{});
    } catch(e) {}
  }

  // Build sfx.X() callable map
  const sfx = {};
  for (const k of Object.keys(SFX_FILES)) sfx[k] = () => play(k);

  function ensureCtx() { /* no-op: audio elements don't need ctx warmup */ return true; }

  function startMusic(track = 'main') {
    if (muted) return;
    if (musicEl && currentMusic === track) {
      if (musicEl.paused) musicEl.play().catch(()=>{});
      return;
    }
    stopMusic();
    const file = track === 'boss' ? 'music-boss.mp3' : 'music-main.mp3';
    musicEl = new window.Audio(BASE + file);
    musicEl.loop = true;
    musicEl.volume = 0.25;
    musicEl.play().catch(()=>{});
    currentMusic = track;
  }

  function stopMusic() {
    if (musicEl) {
      try { musicEl.pause(); musicEl.src = ''; } catch(e) {}
      musicEl = null;
      currentMusic = null;
    }
  }

  function setMute(m) {
    muted = !!m;
    if (muted) stopMusic();
  }
  function isMuted() { return muted; }

  return { sfx, startMusic, stopMusic, setMute, isMuted, ensureCtx };
})();
