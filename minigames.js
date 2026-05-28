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
  // Focus: home-actionable signals to spot stale/bad coffee.
  // Roast date, bag sniff, visual sheen, bloom test, crema, flow, temp, milk skin.
  const GAMES = [
    // Wave 1
    () => gridClick({
      title: 'Spot the Stale Beans',
      lesson: 'Fresh beans are dark and oily. Stale beans look faded, gray, and dusty.',
      cols: 4,
      items: shuffle([
        { label: '<span class="bean fresh">🫘</span>', bad: false },
        { label: '<span class="bean fresh">🫘</span>', bad: false },
        { label: '<span class="bean fresh">🫘</span>', bad: false },
        { label: '<span class="bean fresh">🫘</span>', bad: false },
        { label: '<span class="bean fresh">🫘</span>', bad: false },
        { label: '<span class="bean stale">🫘</span>', bad: true },
        { label: '<span class="bean fresh">🫘</span>', bad: false },
        { label: '<span class="bean stale">🫘</span>', bad: true },
        { label: '<span class="bean fresh">🫘</span>', bad: false },
        { label: '<span class="bean fresh">🫘</span>', bad: false },
        { label: '<span class="bean stale">🫘</span>', bad: true },
        { label: '<span class="bean fresh">🫘</span>', bad: false },
        { label: '<span class="bean stale">🫘</span>', bad: true },
        { label: '<span class="bean fresh">🫘</span>', bad: false },
        { label: '<span class="bean fresh">🫘</span>', bad: false },
        { label: '<span class="bean fresh">🫘</span>', bad: false },
      ]),
    }),
    // Wave 2 — Roast date
    () => multiChoice({
      title: 'Roast Date Check',
      lesson: 'Coffee peaks 7-21 days after roast. Past ~30 days, especially in a no-valve paper bag, assume stale. No date printed = treat as suspect.',
      prompt: 'You\'re buying coffee today (May 28). Which roast date should you pick?',
      choices: [
        { text: 'Roasted Feb 12',  correct: false, why: '3+ months old — stale and lifeless.' },
        { text: 'Roasted May 22',  correct: true,  why: '6 days old — right in the peak window.' },
        { text: 'Roasted yesterday', correct: false, why: 'Too fresh — beans need ~5 days to off-gas first.' },
        { text: 'No date on the bag', correct: false, why: 'No date = roaster doesn\'t care. Walk away.' },
      ],
    }),
    // Wave 3 — Bag sniff test
    () => multiChoice({
      title: 'The Bag Sniff Test',
      lesson: 'Open the bag and inhale. Fresh = vibrant, fruity, chocolatey. Stale = wet cardboard, dusty, or NOTHING at all (absence of aroma is itself the signal).',
      prompt: 'You open a new bag and stick your nose in. Which smell means the beans are STALE?',
      choices: [
        { text: 'Bright fruity sweetness',     correct: false, why: 'That\'s fresh — light/medium roasted, well-stored.' },
        { text: 'Rich chocolate & caramel',    correct: false, why: 'Fresh medium-dark roast. Buy it.' },
        { text: 'Wet cardboard / barely any smell', correct: true, why: 'Cardboard or no aroma = oxidized. The volatile oils have evaporated.' },
        { text: 'Smoky, ashy',                  correct: false, why: 'That\'s over-roasted or burnt, not stale — different defect.' },
      ],
    }),
    // Wave 4 — The Bloom Test (most fun home signal!)
    () => multiChoice({
      title: 'The Bloom Test',
      lesson: 'Pour hot water on fresh grounds and they erupt into a puffy CO₂ dome — the "bloom." Stale beans have no gas left, so they just sit flat. This is the single most dramatic at-home freshness test.',
      prompt: 'You wet your pour-over grounds and watch what happens. Which one tells you the beans are FRESH?',
      choices: [
        { text: 'Grounds puff up into a thick rising dome with bubbles', correct: true, why: 'Big bloom = lots of trapped CO₂ = fresh beans. Beautiful.' },
        { text: 'Grounds sit flat — water just pools on top',           correct: false, why: 'No bloom = no CO₂ = stale. Beans have off-gassed already.' },
        { text: 'Grounds release a single tiny burp then stop',          correct: false, why: 'Weak bloom = past peak. Probably 4-8 weeks old.' },
        { text: 'The water turns bright green',                         correct: false, why: 'Then you have bigger problems than staleness.' },
      ],
    }),
    // Wave 5 — Crema check
    () => multiChoice({
      title: 'Crema Check',
      lesson: 'Crema is emulsified CO₂. Fresh beans give a thick golden-brown crema that holds for a minute or more. Stale beans give pale, thin crema that vanishes in seconds.',
      prompt: 'You pull an espresso shot. What does the crema tell you?',
      choices: [
        { text: 'Thick golden-brown, holds for over a minute',   correct: true,  why: 'Healthy crema = fresh beans + good extraction. Drink up.' },
        { text: 'Pale tan, thin, dissipates in 10 seconds',      correct: false, why: 'Pale & thin crema = stale beans, low CO₂.' },
        { text: 'Almost no crema at all, watery surface',        correct: false, why: 'No crema = very stale OR coffee is too coarse / under-dosed.' },
        { text: 'Dark with big bubbles popping',                  correct: false, why: 'Big bubbles often mean over-extracted or burnt. Not great either.' },
      ],
    }),
    // Wave 6 — Flow rate tells
    () => multiChoice({
      title: 'Espresso Flow Rate',
      lesson: 'Fresh beans + correct grind = a slow honey-like drizzle. Stale beans pour fast because there\'s no CO₂ resistance left in the puck.',
      prompt: 'Your espresso shot runs out in 12 seconds, watery and thin. Most likely cause?',
      choices: [
        { text: 'Stale beans or grind too coarse', correct: true,  why: 'Both let water rush through. Stale beans lose the gas that creates resistance.' },
        { text: 'Water too hot',                   correct: false, why: 'Hot water affects taste, not flow speed.' },
        { text: 'Cup is too small',                correct: false, why: 'The cup has nothing to do with flow rate.' },
        { text: 'Beans were too fresh',            correct: false, why: 'Fresh beans actually SLOW the flow (more CO₂ resistance).' },
      ],
    }),
    // Wave 7 — Brew temperature
    () => meterStop({
      title: 'Brew Water Temperature',
      lesson: 'Ideal brew temp is 195-205°F (90-96°C). Boiling water (212°F) scorches; cool water under-extracts and tastes sour.',
      prompt: 'Stop the gauge in the green zone (195-205°F).',
      minLabel: '160°F',
      maxLabel: '220°F',
      zoneStart: 58,
      zoneEnd: 75,
      speed: 1.4,
    }),
    // Wave 8 — Diagnose off-flavors
    () => multiChoice({
      title: 'Diagnose the Cup',
      lesson: 'Stale coffee tastes FLAT and lifeless — loss of brightness, no acidity, dull. Different from sour (under-extracted), bitter (over-extracted), or smoky (burnt).',
      prompt: 'Your coffee is fully brewed but tastes flat, dull, papery — no brightness, no aroma off the cup. What\'s wrong?',
      choices: [
        { text: 'The beans are stale',       correct: true,  why: 'Loss of brightness + papery flavor + no aroma = oxidized stale beans.' },
        { text: 'You under-extracted',       correct: false, why: 'Under-extracted = SOUR and sharp, not flat.' },
        { text: 'You over-extracted',        correct: false, why: 'Over-extracted = BITTER and ashy, not papery-flat.' },
        { text: 'The milk was bad',          correct: false, why: 'This is black coffee — milk isn\'t the variable.' },
      ],
    }),
    // Wave 9 — Milk skin (still relevant for cappuccino home users)
    () => gridClick({
      title: 'Milk Skin Spotter',
      lesson: 'Heat milk past ~160°F and proteins coagulate into a skin on top. That milk is scorched — toss it.',
      cols: 3,
      items: shuffle([
        { label: '🥛', bad: false }, { label: '🥛', bad: false }, { label: '🍶', bad: true },
        { label: '🥛', bad: false }, { label: '🍶', bad: true },  { label: '🥛', bad: false },
      ]),
    }),
    // Wave 10 — Master test
    () => multiChoice({
      title: 'Master Test: The Buying Decision',
      lesson: 'Tying it all together. You\'re standing in a coffee shop looking at four bags of beans.',
      prompt: 'Which single sign tells you most reliably that a bag of coffee is FRESH and worth buying?',
      choices: [
        { text: 'The bag says "100% Arabica"',           correct: false, why: '99% of specialty coffee is arabica. Means nothing about freshness.' },
        { text: 'A roast date within the last 2-3 weeks', correct: true,  why: 'The roast date is THE single most reliable freshness indicator. Everything else flows from this.' },
        { text: 'It\'s labeled "Premium"',                correct: false, why: 'Marketing word with no defined meaning.' },
        { text: 'It looks dark and oily',                 correct: false, why: 'Oily can mean fresh dark roast OR stale beans that sweated oils to the surface. Ambiguous.' },
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
