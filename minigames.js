// Educational minigames for Grounds for Defense.
// Each minigame runs after a wave clears, teaches a coffee-quality concept,
// and awards bonus beans (in-game currency) on success.

const Minigames = (() => {
  const REWARD = 40; // bonus beans awarded for success
  let inProgress = false;
  let onCompleteCb = null;

  // ---------- Modal helpers ----------
  function modal() { return document.getElementById('mg-modal'); }
  function showModal(title, lesson, bodyHTML) {
    document.getElementById('mg-title').textContent = title;
    document.getElementById('mg-lesson').textContent = lesson;
    document.getElementById('mg-body').innerHTML = bodyHTML;
    document.getElementById('mg-result').textContent = '';
    document.getElementById('mg-skip').onclick = () => finish(false);
    modal().classList.remove('hidden');
  }
  function finish(success, extraMsg) {
    if (!inProgress) return;
    inProgress = false;
    const resEl = document.getElementById('mg-result');
    if (success) {
      resEl.style.color = '#7be07b';
      resEl.textContent = `✓ Correct! +${REWARD} beans. ${extraMsg || ''}`;
    } else {
      resEl.style.color = '#ff9b9b';
      resEl.textContent = `${extraMsg || 'Skipped.'}`;
    }
    setTimeout(() => {
      modal().classList.add('hidden');
      if (onCompleteCb) {
        const cb = onCompleteCb; onCompleteCb = null;
        cb(success);
      }
    }, success ? 1400 : 900);
  }

  // ---------- Template A: Click the bad ones (grid) ----------
  // items: [{label, bad}], need to click ALL bad items within `time` seconds
  function gridClick(opts, success) {
    const items = opts.items;
    const need = items.filter(i => i.bad).length;
    let found = 0, wrong = 0;
    const html = `<div class="mg-grid" style="grid-template-columns:repeat(${opts.cols},1fr)">` +
      items.map((it, i) => `<div class="mg-cell" data-i="${i}"><span>${it.label}</span></div>`).join('') +
      `</div><div class="mg-progress">Find: ${need} · Found: <span id="mg-found">0</span></div>`;
    showModal(opts.title, opts.lesson, html);
    document.querySelectorAll('.mg-cell').forEach(el => {
      el.onclick = () => {
        if (el.classList.contains('done')) return;
        const it = items[+el.dataset.i];
        if (it.bad) {
          el.classList.add('done','good');
          found++;
          document.getElementById('mg-found').textContent = found;
          if (found >= need) finish(true);
        } else {
          el.classList.add('done','bad');
          wrong++;
          if (wrong >= 2) finish(false, '✗ Too many mis-clicks. The bad coffee got through.');
        }
      };
    });
  }

  // ---------- Template B: Multiple choice ----------
  function multiChoice(opts) {
    const html = `<div class="mg-prompt">${opts.prompt}</div>` +
      `<div class="mg-choices">` +
      opts.choices.map((c,i) => `<button class="mg-choice" data-i="${i}">${c.text}</button>`).join('') +
      `</div>`;
    showModal(opts.title, opts.lesson, html);
    document.querySelectorAll('.mg-choice').forEach(el => {
      el.onclick = () => {
        const i = +el.dataset.i;
        if (opts.choices[i].correct) {
          el.classList.add('correct');
          finish(true, opts.choices[i].why || '');
        } else {
          el.classList.add('wrong');
          el.disabled = true;
          // reveal correct one
          document.querySelectorAll('.mg-choice').forEach((b,j) => {
            if (opts.choices[j].correct) b.classList.add('correct');
          });
          finish(false, `✗ ${opts.choices[i].why || 'Wrong.'}`);
        }
      };
    });
  }

  // ---------- Template C: Stop the meter in the green zone ----------
  function meterStop(opts) {
    const html = `<div class="mg-prompt">${opts.prompt}</div>
      <div class="mg-meter">
        <div class="mg-track">
          <div class="mg-zone" style="left:${opts.zoneStart}%; width:${opts.zoneEnd - opts.zoneStart}%"></div>
          <div class="mg-needle" id="mg-needle"></div>
        </div>
        <div class="mg-meter-labels"><span>${opts.minLabel}</span><span>${opts.maxLabel}</span></div>
      </div>
      <button class="mg-stop" id="mg-stop">STOP</button>`;
    showModal(opts.title, opts.lesson, html);
    let pos = 0, dir = 1, speed = opts.speed || 1.2, stopped = false;
    const needle = document.getElementById('mg-needle');
    function tick() {
      if (stopped) return;
      pos += dir * speed;
      if (pos >= 100) { pos = 100; dir = -1; }
      if (pos <= 0) { pos = 0; dir = 1; }
      needle.style.left = pos + '%';
      requestAnimationFrame(tick);
    }
    tick();
    document.getElementById('mg-stop').onclick = () => {
      stopped = true;
      const hit = pos >= opts.zoneStart && pos <= opts.zoneEnd;
      finish(hit, hit ? `Locked at ${Math.round(pos)}.` : `✗ Hit ${Math.round(pos)} — outside the ${opts.zoneStart}-${opts.zoneEnd} sweet spot.`);
    };
  }

  // ---------- The 10 minigames ----------
  const GAMES = [
    // Wave 1
    () => gridClick({
      title: 'Spot the Stale Beans',
      lesson: 'Stale beans look wrinkled, dusty, and dull. Fresh beans are oily and uniform.',
      cols: 4,
      items: shuffle([
        { label: '🫘', bad: false }, { label: '🫘', bad: false }, { label: '🫘', bad: false }, { label: '🫘', bad: false },
        { label: '🫘', bad: false }, { label: '🥜', bad: true },  { label: '🫘', bad: false }, { label: '🥜', bad: true },
        { label: '🫘', bad: false }, { label: '🫘', bad: false }, { label: '🥜', bad: true },  { label: '🫘', bad: false },
        { label: '🥜', bad: true },  { label: '🫘', bad: false }, { label: '🫘', bad: false }, { label: '🫘', bad: false },
      ]),
    }),
    // Wave 2
    () => multiChoice({
      title: 'Roast Date Check',
      lesson: 'Coffee peaks 7-21 days after roast. Anything older than ~30 days is past prime.',
      prompt: 'You\'re buying coffee today (May 28). Which roast date should you pick?',
      choices: [
        { text: 'Roasted Feb 12',  correct: false, why: '3+ months old — stale and lifeless.' },
        { text: 'Roasted May 22',  correct: true,  why: '6 days old — right in the peak window.' },
        { text: 'Roasted yesterday', correct: false, why: 'Too fresh — gas needs to off-gas for ~5 days first.' },
        { text: 'No date on the bag', correct: false, why: 'No date = avoid. Roasters that care print it.' },
      ],
    }),
    // Wave 3
    () => multiChoice({
      title: 'Sniff Test',
      lesson: 'Defects have signature smells. Train your nose, save your cup.',
      prompt: 'The coffee smells like wet cardboard or damp basement. What\'s the defect?',
      choices: [
        { text: 'Stale / oxidized', correct: true,  why: 'Cardboard = oxidation. The beans sat too long.' },
        { text: 'Over-extracted',   correct: false, why: 'Over-extraction tastes bitter/ashy, not papery.' },
        { text: 'Under-roasted',    correct: false, why: 'Under-roasted smells grassy or peanut-like.' },
        { text: 'Burnt / scorched', correct: false, why: 'Burnt smells acrid and smoky, like ash.' },
      ],
    }),
    // Wave 4
    () => gridClick({
      title: 'Milk Skin Spotter',
      lesson: 'When milk is overheated (>160°F), a skin forms on top. That milk is ruined.',
      cols: 3,
      items: shuffle([
        { label: '🥛', bad: false }, { label: '🥛', bad: false }, { label: '🍶', bad: true },
        { label: '🥛', bad: false }, { label: '🍶', bad: true },  { label: '🥛', bad: false },
      ]),
    }),
    // Wave 5
    () => multiChoice({
      title: 'Grind Size Match',
      lesson: 'Brew method dictates grind. Wrong grind = bad coffee no matter what.',
      prompt: 'You\'re making espresso. What grind size do you need?',
      choices: [
        { text: 'Coarse (sea salt)',   correct: false, why: 'Coarse is for French press — espresso would run thin.' },
        { text: 'Medium (sand)',       correct: false, why: 'Medium is for drip — espresso would gush.' },
        { text: 'Fine (powdered sugar)', correct: true, why: 'Fine grind builds the pressure espresso needs.' },
        { text: 'Whole beans',         correct: false, why: 'Hot water would pass right through whole beans.' },
      ],
    }),
    // Wave 6
    () => meterStop({
      title: 'Brew Water Temperature',
      lesson: 'Ideal brew temp is 195-205°F (90-96°C). Hotter scorches, cooler under-extracts.',
      prompt: 'Stop the gauge in the green zone (195-205°F).',
      minLabel: '160°F',
      maxLabel: '220°F',
      zoneStart: 58,
      zoneEnd: 75,
      speed: 1.4,
    }),
    // Wave 7
    () => meterStop({
      title: 'Espresso Shot Time',
      lesson: 'A balanced shot pulls in 25-30 seconds. Faster = sour, slower = bitter.',
      prompt: 'Stop the timer in the 25-30 second zone.',
      minLabel: '15s',
      maxLabel: '40s',
      zoneStart: 40,
      zoneEnd: 60,
      speed: 1.6,
    }),
    // Wave 8
    () => multiChoice({
      title: 'Under-Extraction Tells',
      lesson: 'Pulled too fast / coarse grind / not enough coffee → sour, weak, watery shot.',
      prompt: 'Your espresso tastes SOUR and lemony. The most likely cause?',
      choices: [
        { text: 'Grind too coarse', correct: true,  why: 'Coarse grind = fast flow = under-extracted = sour.' },
        { text: 'Grind too fine',   correct: false, why: 'Too fine causes bitter, not sour.' },
        { text: 'Water too hot',    correct: false, why: 'Hot water pushes toward bitter, not sour.' },
        { text: 'Old beans',        correct: false, why: 'Old beans taste flat, not sharply sour.' },
      ],
    }),
    // Wave 9
    () => gridClick({
      title: 'Cull the Defective Beans',
      lesson: 'Quakers (unripe), insect-damaged, and broken beans all ruin a cup. SCA cup grading allows zero primary defects.',
      cols: 4,
      items: shuffle([
        { label: '🫘', bad: false }, { label: '🪲', bad: true },  { label: '🫘', bad: false }, { label: '🫘', bad: false },
        { label: '🥜', bad: true },  { label: '🫘', bad: false }, { label: '🫘', bad: false }, { label: '💩', bad: true },
        { label: '🫘', bad: false }, { label: '🫘', bad: false }, { label: '🫘', bad: false }, { label: '🫘', bad: false },
      ]),
    }),
    // Wave 10 — final
    () => multiChoice({
      title: 'Master Cupping Test',
      lesson: 'You\'ve defended the counter. Time to prove you can spot bad coffee in the wild.',
      prompt: 'A cafe serves you a "specialty" pour-over. Which is the #1 red flag the coffee is BAD?',
      choices: [
        { text: 'They use organic beans',     correct: false, why: 'Organic is fine — it tells you nothing about freshness.' },
        { text: 'The bag has no roast date',  correct: true,  why: 'No roast date is the universal "we don\'t care" signal.' },
        { text: 'The cup has crema on top',   correct: false, why: 'Crema is on espresso, not pour-over — irrelevant.' },
        { text: 'The beans are dark-roasted', correct: false, why: 'Dark roast is a style choice, not a defect.' },
      ],
    }),
  ];

  function shuffle(a) { const b = a.slice(); for (let i = b.length-1; i > 0; i--) { const j = (Math.random()*(i+1))|0; [b[i],b[j]] = [b[j],b[i]]; } return b; }

  function play(waveIndex, cb) {
    if (inProgress) return cb && cb(false);
    inProgress = true;
    onCompleteCb = cb;
    const idx = Math.max(0, Math.min(GAMES.length - 1, waveIndex - 1));
    GAMES[idx]();
  }

  function isOpen() { return inProgress; }
  function rewardAmount() { return REWARD; }

  return { play, isOpen, rewardAmount, count: GAMES.length };
})();
window.Minigames = Minigames;
