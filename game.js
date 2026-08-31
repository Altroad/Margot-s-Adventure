/* Margot's Adventure
   One level. One phone call. Everything else is in the way. */

(() => {
  'use strict';

  // ---------------------------------------------------------------- config

  const VIEW_W = 640;
  const VIEW_H = 360;
  const GROUND_Y = 302;          // y of the walking surface

  const GRAVITY      = 1900;
  const JUMP_V       = 585;      // ~90px of lift
  const JUMP_CUT     = 200;      // release early, rise less
  const MAX_SPEED    = 200;
  const ACCEL        = 1700;
  const AIR_ACCEL    = 950;
  const GROUND_DRAG  = 2100;
  const AIR_DRAG     = 260;
  const MAX_FALL     = 620;
  const COYOTE       = 0.11;
  const JUMP_BUFFER  = 0.13;

  const STUMBLE_TIME    = 0.45;
  const STUMBLE_PENALTY = 2;     // seconds added to the day
  const INVULN          = 1.2;

  const PW = 19, PH = 34;        // Margot's collision box

  // ---------------------------------------------------------------- level

  const SEG = {
    home:     { x0: 0,    x1: 340  },
    run:      { x0: 340,  x1: 2000 },
    magpies:  { x0: 2000, x1: 3220 },
    meetings: { x0: 3220, x1: 4520 },
    party:    { x0: 4520, x1: 5880 },
    call:     { x0: 5880, x1: 6300 },
  };
  const LEVEL_W = SEG.call.x1;

  // Hand-picked stops. A straight orange-to-blue lerp muddies through grey,
  // so the sunrise gets its own short, deliberate transition.
  const SKY = [
    { x: 0,    top: '#E8825F', bot: '#FFC98E' },  // before sunrise
    { x: 800,  top: '#EE9A6E', bot: '#FFD9A6' },  // sun coming up
    { x: 1450, top: '#F0B48D', bot: '#FFE8C4' },  // warm haze
    { x: 1800, top: '#C7C4C9', bot: '#FBF0DE' },  // the brief pale minute
    { x: 2100, top: '#7CBCE4', bot: '#CDE8F7' },  // morning
    { x: 3220, top: '#8AC4E7', bot: '#DCEEF8' },  // midday
    { x: 4520, top: '#7DBDDB', bot: '#FFE2B4' },  // afternoon
    { x: 5450, top: '#6E86BC', bot: '#F7C89A' },  // golden hour
    { x: 5880, top: '#4E5C96', bot: '#F0A177' },  // dusk
    { x: 6300, top: '#3A4480', bot: '#D9805F' },
  ];

  const HURDLES = [
    { x: 560,  kind: 'puddle'  },
    { x: 780,  kind: 'bench'   },
    { x: 980,  kind: 'puddle'  },
    { x: 1150, kind: 'dog'     },
    { x: 1340, kind: 'bench'   },
    { x: 1520, kind: 'puddle'  },
    { x: 1680, kind: 'scooter' },
    { x: 1870, kind: 'bench'   },
  ];
  const HURDLE_SIZE = {
    puddle:  { w: 46, h: 7,  hit: [40, 7]  },
    bench:   { w: 48, h: 23, hit: [42, 21] },
    dog:     { w: 42, h: 17, hit: [36, 15] },
    scooter: { w: 36, h: 21, hit: [28, 19] },
  };

  const MAGPIE_DEFS = [
    { x: 2170, period: 2.4, phase: 0.0 },
    { x: 2410, period: 2.6, phase: 1.1 },
    { x: 2650, period: 2.3, phase: 0.5 },
    { x: 2880, period: 2.7, phase: 1.7 },
    { x: 3090, period: 2.2, phase: 0.9 },
  ];

  const MEETING_DEFS = [
    { x: 3390, h: 46, title: 'Weekly Sync',     quip: 'You’re on mute' },
    { x: 3620, h: 54, title: 'Quick Catch-up',  quip: 'Just a quick one' },
    { x: 3870, h: 44, title: 'Sprint Planning', quip: 'Let’s take that offline' },
    { x: 4100, h: 56, title: 'Q3 Roadmap',      quip: 'Can everyone see my screen?' },
    { x: 4320, h: 48, title: 'Retro',           quip: 'I’ll drop a note in the chat' },
  ];
  const MEETING_W = 74;

  const PLATFORMS = [
    { x: 4820, y: GROUND_Y - 62, w: 78, h: 11 },   // esky
    { x: 5250, y: GROUND_Y - 48, w: 96, h: 11 },   // trestle table
  ];

  const PARTY_DEFS = [
    { x: 4670, y: GROUND_Y - 26,  kind: 'present' },
    { x: 4859, y: GROUND_Y - 106, kind: 'balloon' },
    { x: 5010, y: GROUND_Y - 25,  kind: 'cake'    },
    { x: 5150, y: GROUND_Y - 110, kind: 'balloon' },
    { x: 5298, y: GROUND_Y - 72,  kind: 'hat'     },
    { x: 5450, y: GROUND_Y - 26,  kind: 'juice'   },
    { x: 5600, y: GROUND_Y - 104, kind: 'balloon' },
    { x: 5745, y: GROUND_Y - 24,  kind: 'candles' },
  ];

  const GATE_X  = 5820;
  const PHONE_X = 6140;

  // ---------------------------------------------------------------- helpers

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp  = (a, b, t) => a + (b - a) * t;

  function hash(n) {
    const s = Math.sin(n * 127.1) * 43758.5453;
    return s - Math.floor(s);
  }

  function hexMix(a, b, t) {
    const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
    const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
    return `rgb(${Math.round(lerp(pa[0], pb[0], t))},${Math.round(lerp(pa[1], pb[1], t))},${Math.round(lerp(pa[2], pb[2], t))})`;
  }

  function skyAt(x) {
    let i = 0;
    while (i < SKY.length - 2 && x > SKY[i + 1].x) i++;
    const a = SKY[i], b = SKY[i + 1];
    const t = clamp((x - a.x) / (b.x - a.x), 0, 1);
    return { top: hexMix(a.top, b.top, t), bot: hexMix(a.bot, b.bot, t) };
  }

  function roundRect(c, x, y, w, h, r) {
    const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  function fmtClock(s) {
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${String(r).padStart(2, '0')}`;
  }
  function fmtPrecise(s) {
    const m = Math.floor(s / 60);
    const r = (s % 60);
    return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`;
  }

  // ---------------------------------------------------------------- storage

  const STORE_KEY = 'margot.best.v1';
  function loadBest() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function saveBest(v) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch (e) { /* private mode */ }
  }
  function loadMuted() {
    try { return localStorage.getItem('margot.muted') === '1'; } catch (e) { return false; }
  }
  function saveMuted(m) {
    try { localStorage.setItem('margot.muted', m ? '1' : '0'); } catch (e) { /* ignore */ }
  }

  // ---------------------------------------------------------------- audio

  const Sound = {
    ac: null,
    on: !loadMuted(),

    ensure() {
      if (!this.ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ac = new AC();
      }
      if (this.ac.state === 'suspended') this.ac.resume();
      return this.ac;
    },

    tone(freq, dur, type = 'sine', vol = 0.12, slideTo = null) {
      if (!this.on) return;
      const ac = this.ensure();
      if (!ac) return;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, ac.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + dur);
      g.gain.setValueAtTime(0.0001, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(vol, ac.currentTime + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      o.connect(g).connect(ac.destination);
      o.start();
      o.stop(ac.currentTime + dur + 0.02);
    },

    noise(dur, vol = 0.1) {
      if (!this.on) return;
      const ac = this.ensure();
      if (!ac) return;
      const n = Math.floor(ac.sampleRate * dur);
      const buf = ac.createBuffer(1, n, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = ac.createBufferSource();
      const g = ac.createGain();
      g.gain.value = vol;
      src.buffer = buf;
      src.connect(g).connect(ac.destination);
      src.start();
    },

    jump()    { this.tone(340, 0.14, 'triangle', 0.1, 560); },
    land()    { this.noise(0.06, 0.05); },
    collect() { this.tone(700, 0.1, 'sine', 0.1, 1100); setTimeout(() => this.tone(1050, 0.1, 'sine', 0.07), 70); },
    stomp()   { this.tone(220, 0.16, 'square', 0.08, 90); this.noise(0.1, 0.06); },
    stumble() { this.tone(200, 0.24, 'sawtooth', 0.09, 90); },
    caw()     { this.tone(880, 0.09, 'sawtooth', 0.06, 520); setTimeout(() => this.tone(760, 0.08, 'sawtooth', 0.05, 460), 90); },
    ring()    { this.tone(480, 0.28, 'sine', 0.09); setTimeout(() => this.tone(600, 0.28, 'sine', 0.09), 150); },
    gate()    { this.tone(520, 0.14, 'sine', 0.09, 780); },
    win()     {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.34, 'triangle', 0.1), i * 130));
    },
  };

  // ---------------------------------------------------------------- input

  const keys = Object.create(null);
  const input = { left: false, right: false, jump: false, jumpPressed: false };

  const LEFT_KEYS  = ['ArrowLeft', 'a', 'A'];
  const RIGHT_KEYS = ['ArrowRight', 'd', 'D'];
  const JUMP_KEYS  = [' ', 'Spacebar', 'ArrowUp', 'w', 'W'];

  window.addEventListener('keydown', (e) => {
    if (JUMP_KEYS.includes(e.key) || LEFT_KEYS.includes(e.key) || RIGHT_KEYS.includes(e.key) || e.key === 'ArrowDown') {
      e.preventDefault();
    }
    if (e.repeat) return;
    keys[e.key] = true;
    if (JUMP_KEYS.includes(e.key)) input.jumpPressed = true;

    if (e.key === 'm' || e.key === 'M') toggleSound();
    if (e.key === 'r' || e.key === 'R') { if (game.phase === 'play') startGame(); }
    if ((e.key === 'Enter' || JUMP_KEYS.includes(e.key)) && game.phase !== 'play') {
      if (game.phase === 'title') startGame();
      else if (game.phase === 'won') startGame();
    }
  });

  window.addEventListener('keyup', (e) => { keys[e.key] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; touchState.left = touchState.right = touchState.jump = false; });

  const touchState = { left: false, right: false, jump: false };

  function bindPad(el, prop) {
    const set = (v) => {
      touchState[prop] = v;
      el.dataset.down = v ? '1' : '0';
      if (v && prop === 'jump') input.jumpPressed = true;
      if (v) Sound.ensure();
    };
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); set(true); });
    el.addEventListener('pointerup',   (e) => { e.preventDefault(); set(false); });
    el.addEventListener('pointercancel', () => set(false));
    el.addEventListener('pointerleave', () => set(false));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function readInput() {
    input.left  = LEFT_KEYS.some(k => keys[k]) || touchState.left;
    input.right = RIGHT_KEYS.some(k => keys[k]) || touchState.right;
    input.jump  = JUMP_KEYS.some(k => keys[k]) || touchState.jump;
  }

  // ---------------------------------------------------------------- state

  const game = {
    phase: 'title',        // title | play | finale | won
    time: 0,
    penalty: 0,
    stumbles: 0,
    finaleT: 0,
    shake: 0,
  };

  const player = {
    x: 90, y: GROUND_Y, vx: 0, vy: 0,
    onGround: true, facing: 1,
    runPhase: 0,
    coyote: 0, buffer: 0,
    stumbleT: 0, invulnT: 0,
    holdingPhone: false,
  };

  let magpies = [];
  let meetings = [];
  let party = [];
  let puffs = [];
  let floaters = [];
  const cam = { x: 0 };

  const tasks = [
    { id: 'run',      label: '16 km run',  done: false },
    { id: 'magpies',  label: 'Magpies',    done: false },
    { id: 'meetings', label: 'Meetings',   done: false },
    { id: 'party',    label: 'Party',      done: false },
  ];

  function resetLevel() {
    game.time = 0; game.penalty = 0; game.stumbles = 0; game.finaleT = 0; game.shake = 0;

    player.x = 90; player.y = GROUND_Y; player.vx = 0; player.vy = 0;
    player.onGround = true; player.facing = 1; player.runPhase = 0;
    player.coyote = 0; player.buffer = 0; player.stumbleT = 0; player.invulnT = 0;
    player.holdingPhone = false;

    magpies = MAGPIE_DEFS.map(d => ({ ...d, t: d.phase, cawed: false }));
    meetings = MEETING_DEFS.map(d => ({ ...d, w: MEETING_W, alive: true, pop: 0 }));
    party = PARTY_DEFS.map(d => ({ ...d, taken: false, bob: hash(d.x) * 6.28 }));
    puffs = []; floaters = [];
    cam.x = 0;
    tasks.forEach(t => { t.done = false; });
  }

  const partyLeft   = () => party.filter(p => !p.taken).length;
  const meetingsLeft = () => meetings.filter(m => m.alive).length;

  function runKm() {
    const t = clamp((player.x - SEG.run.x0) / (SEG.run.x1 - SEG.run.x0), 0, 1);
    return t * 16;
  }

  function activeSegment() {
    const x = player.x;
    for (const k of Object.keys(SEG)) {
      if (x >= SEG[k].x0 && x < SEG[k].x1) return k;
    }
    return 'call';
  }

  // ---------------------------------------------------------------- effects

  function puff(x, y, n = 6, color = 'rgba(255,255,255,0.75)') {
    for (let i = 0; i < n; i++) {
      puffs.push({
        x, y,
        vx: (Math.random() - 0.5) * 90,
        vy: -Math.random() * 70 - 10,
        r: 2 + Math.random() * 3,
        life: 0.5 + Math.random() * 0.35,
        t: 0,
        color,
      });
    }
  }

  function float(x, y, text, color = '#2A2440') {
    floaters.push({ x, y, text, color, t: 0, life: 1.5 });
  }

  function stumble(reason) {
    if (player.invulnT > 0 || player.stumbleT > 0) return;
    player.stumbleT = STUMBLE_TIME;
    player.invulnT = INVULN;
    player.vx = -110 * player.facing;
    player.vy = -190;
    game.penalty += STUMBLE_PENALTY;
    game.stumbles++;
    game.shake = 0.32;
    Sound.stumble();
    float(player.x, player.y - PH - 12, reason, '#F0567A');
    puff(player.x, player.y - 6, 8, 'rgba(240,86,122,0.5)');
  }

  // ---------------------------------------------------------------- physics

  function solidsNear() {
    const list = [];
    for (const p of PLATFORMS) list.push(p);
    for (const m of meetings) {
      if (m.alive) list.push({ x: m.x, y: GROUND_Y - m.h, w: m.w, h: m.h, meeting: m });
    }
    if (partyLeft() > 0) {
      // tall enough that it can't be hopped — otherwise she reaches the phone
      // with the party unfinished and nothing to do there
      list.push({ x: GATE_X, y: GROUND_Y - 210, w: 9, h: 210, gate: true });
    }
    return list;
  }

  function updatePlayer(dt) {
    const staggered = player.stumbleT > 0;

    // horizontal intent
    let dir = 0;
    if (!staggered) {
      if (input.left)  dir -= 1;
      if (input.right) dir += 1;
    }

    const accel = player.onGround ? ACCEL : AIR_ACCEL;
    if (dir !== 0) {
      player.vx += dir * accel * dt;
      player.facing = dir;
    } else {
      const drag = (player.onGround ? GROUND_DRAG : AIR_DRAG) * dt;
      if (player.vx > 0) player.vx = Math.max(0, player.vx - drag);
      else if (player.vx < 0) player.vx = Math.min(0, player.vx + drag);
    }
    player.vx = clamp(player.vx, -MAX_SPEED, MAX_SPEED);

    // jump
    player.coyote = player.onGround ? COYOTE : Math.max(0, player.coyote - dt);
    if (input.jumpPressed) player.buffer = JUMP_BUFFER;
    else player.buffer = Math.max(0, player.buffer - dt);

    if (player.buffer > 0 && player.coyote > 0 && !staggered) {
      player.vy = -JUMP_V;
      player.onGround = false;
      player.coyote = 0;
      player.buffer = 0;
      Sound.jump();
      puff(player.x, player.y - 2, 5, 'rgba(255,255,255,0.7)');
    }
    if (!input.jump && player.vy < -JUMP_CUT) player.vy = -JUMP_CUT;

    // gravity
    player.vy = Math.min(MAX_FALL, player.vy + GRAVITY * dt);

    const solids = solidsNear();
    const wasAir = !player.onGround;

    // --- horizontal move + resolve
    player.x += player.vx * dt;
    let box = { x: player.x - PW / 2, y: player.y - PH, w: PW, h: PH };
    for (const s of solids) {
      if (box.x < s.x + s.w && box.x + box.w > s.x && box.y < s.y + s.h && box.y + box.h > s.y) {
        if (player.vx > 0) player.x = s.x - PW / 2;
        else if (player.vx < 0) player.x = s.x + s.w + PW / 2;
        player.vx = 0;
        box = { x: player.x - PW / 2, y: player.y - PH, w: PW, h: PH };
        // no floater here — this runs every physics step, and the gate
        // already carries a standing "N more to find" sign.
      }
    }
    player.x = clamp(player.x, 12, LEVEL_W - 12);

    // --- vertical move + resolve
    player.y += player.vy * dt;
    player.onGround = false;
    box = { x: player.x - PW / 2, y: player.y - PH, w: PW, h: PH };

    for (const s of solids) {
      if (box.x < s.x + s.w && box.x + box.w > s.x && box.y < s.y + s.h && box.y + box.h > s.y) {
        if (player.vy > 0) {
          // landing on top
          player.y = s.y;
          player.vy = 0;
          player.onGround = true;
          if (s.meeting && s.meeting.alive) {
            dismissMeeting(s.meeting);
            player.vy = -370;          // satisfying bounce off
            player.onGround = false;
          }
        } else if (player.vy < 0) {
          player.y = s.y + s.h + PH;
          player.vy = 0;
        }
        box = { x: player.x - PW / 2, y: player.y - PH, w: PW, h: PH };
      }
    }

    if (player.y >= GROUND_Y) {
      player.y = GROUND_Y;
      player.vy = 0;
      player.onGround = true;
    }

    if (player.onGround && wasAir) {
      Sound.land();
      puff(player.x, player.y, 4, 'rgba(255,255,255,0.6)');
    }

    // run cycle
    if (player.onGround) player.runPhase += Math.abs(player.vx) * dt * 0.11;
    if (player.stumbleT > 0) player.stumbleT -= dt;
    if (player.invulnT > 0) player.invulnT -= dt;
  }

  function dismissMeeting(m) {
    m.alive = false;
    m.pop = 0.5;
    Sound.stomp();
    float(m.x + m.w / 2, GROUND_Y - m.h - 14, m.quip, '#5B5FC7');
    puff(m.x + m.w / 2, GROUND_Y - m.h, 10, 'rgba(91,95,199,0.55)');
    game.shake = 0.18;
  }

  // ---------------------------------------------------------------- entities

  function updateHurdles() {
    if (player.invulnT > 0) return;
    const pb = { x: player.x - PW / 2 + 3, y: player.y - PH, w: PW - 6, h: PH };
    for (const h of HURDLES) {
      const sz = HURDLE_SIZE[h.kind];
      const hb = { x: h.x - sz.hit[0] / 2, y: GROUND_Y - sz.hit[1], w: sz.hit[0], h: sz.hit[1] };
      if (pb.x < hb.x + hb.w && pb.x + pb.w > hb.x && pb.y < hb.y + hb.h && pb.y + pb.h > hb.y) {
        stumble(h.kind === 'puddle' ? 'Splash' : h.kind === 'dog' ? 'Sorry!' : 'Oof');
        return;
      }
    }
  }

  function magpieState(m) {
    // returns {y, diving, telegraph}
    const p = m.period;
    const t = m.t % p;
    const hoverEnd    = p - 1.35;
    const telegraphEnd = p - 0.62;
    const diveEnd     = p - 0.26;

    if (t < hoverEnd) {
      return { y: 138 + Math.sin(m.t * 2.4) * 7, phase: 'hover', k: 0 };
    }
    if (t < telegraphEnd) {
      const k = (t - hoverEnd) / (telegraphEnd - hoverEnd);
      return { y: 138 + Math.sin(m.t * 2.4) * 7 - k * 12, phase: 'telegraph', k };
    }
    if (t < diveEnd) {
      const k = (t - telegraphEnd) / (diveEnd - telegraphEnd);
      const ease = k * k;
      return { y: lerp(126, GROUND_Y - 30, ease), phase: 'dive', k };
    }
    const k = (t - diveEnd) / (p - diveEnd);
    return { y: lerp(GROUND_Y - 30, 138, k), phase: 'return', k };
  }

  function updateMagpies(dt) {
    for (const m of magpies) {
      const prev = m.t % m.period;
      m.t += dt;
      const now = m.t % m.period;
      const st = magpieState(m);

      // caw once as the telegraph starts
      const tp = m.period - 1.35;
      if (prev < tp && now >= tp && Math.abs(m.x - player.x) < 340) Sound.caw();

      if (st.phase === 'dive' && player.invulnT <= 0) {
        const bx = m.x, by = st.y;
        const pb = { x: player.x - PW / 2 + 2, y: player.y - PH, w: PW - 4, h: PH };
        const nx = clamp(bx, pb.x, pb.x + pb.w);
        const ny = clamp(by, pb.y, pb.y + pb.h);
        const d = Math.hypot(bx - nx, by - ny);
        if (d < 15) stumble('Swooped!');
      }
    }
  }

  function updateParty(dt) {
    for (const p of party) {
      if (p.taken) continue;
      p.bob += dt * 2;
      const py = p.y + (p.kind === 'balloon' ? Math.sin(p.bob) * 4 : 0);
      if (Math.abs(p.x - player.x) < 22 && Math.abs(py - (player.y - PH / 2)) < 30) {
        p.taken = true;
        Sound.collect();
        puff(p.x, py, 8, 'rgba(242,180,65,0.8)');
        const left = partyLeft();
        float(p.x, py - 14, left === 0 ? 'Party sorted!' : `${8 - left}/8`, '#F0567A');
        if (left === 0) Sound.gate();
      }
    }
  }

  function updateTasks() {
    const set = (id, v) => {
      const t = tasks.find(t => t.id === id);
      if (t && !t.done && v) {
        t.done = true;
        float(player.x, player.y - PH - 24, 'Done', '#5C8F4E');
      }
    };
    if (player.x > SEG.run.x1) set('run', true);
    if (player.x > SEG.magpies.x1) set('magpies', true);
    if (meetingsLeft() === 0) set('meetings', true);
    if (partyLeft() === 0) set('party', true);
  }

  function updateEffects(dt) {
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;
      if (p.t >= p.life) puffs.splice(i, 1);
    }
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.t += dt;
      f.y -= 22 * dt;
      if (f.t >= f.life) floaters.splice(i, 1);
    }
    if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 1.6);
    for (const m of meetings) {
      if (m.pop > 0) m.pop = Math.max(0, m.pop - dt);
    }
  }

  // ---------------------------------------------------------------- finale

  function updateFinale(dt) {
    game.finaleT += dt;
    const t = game.finaleT;
    player.vx = 0;
    player.facing = 1;

    if (t > 0.6 && !player.holdingPhone) {
      player.holdingPhone = true;
      float(PHONE_X - 6, GROUND_Y - 96, 'Calling Daniel…', '#2A2440');
    }
    if (t > 1.5 && t < 1.6) Sound.ring();
    if (t > 2.3 && t < 2.4) Sound.ring();
    if (t > 3.1 && t < 3.2) {
      float(PHONE_X + 30, GROUND_Y - 108, '“Margot! Finally.”', '#5C8F4E');
      Sound.win();
    }
    if (t > 4.6) finish();
  }

  function finish() {
    game.phase = 'won';
    const total = game.time + game.penalty;
    const best = loadBest();
    const isBest = !best || total < best.time;
    if (isBest) saveBest({ time: total, stumbles: game.stumbles });
    const shown = isBest ? total : best.time;

    el.winTime.textContent = fmtPrecise(total);
    el.winBest.textContent = fmtPrecise(shown);
    el.winStumbles.textContent = String(game.stumbles);
    el.winNote.textContent = isBest
      ? 'A new personal best. Sixteen kilometres, five meetings, one birthday party and a great many magpies.'
      : 'She got there. Sixteen kilometres, five meetings, one birthday party and a great many magpies later.';
    show('win');
  }

  // ---------------------------------------------------------------- drawing

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const stage = document.getElementById('stage');

  function resize() {
    const r = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const s = w / VIEW_W;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }
  window.addEventListener('resize', resize);

  // --- scenery pieces

  function drawGumTree(x, groundY, scale, tint) {
    ctx.save();
    ctx.translate(x, groundY);
    ctx.scale(scale, scale);
    const bark = tint ? '#A9B3A6' : '#9AA79B';
    const leaf = tint ? '#8FAE86' : '#6E9A6A';
    ctx.fillStyle = bark;
    ctx.fillRect(-3, -70, 6, 70);
    ctx.beginPath();
    ctx.moveTo(0, -52); ctx.lineTo(-16, -74); ctx.lineTo(-11, -74);
    ctx.moveTo(0, -58); ctx.lineTo(15, -80);
    ctx.strokeStyle = bark;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = leaf;
    ctx.beginPath(); ctx.ellipse(-14, -82, 17, 12, 0, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.ellipse(13, -88, 19, 13, 0, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -96, 21, 14, 0, 0, 6.3); ctx.fill();
    ctx.restore();
  }

  const HOUSE_WALLS = ['#E6D9C4', '#DCCBB6', '#EADFCE', '#D8CDBE'];
  const HOUSE_ROOFS = ['#B0705E', '#9C6B62', '#C08268', '#8E6A64'];

  function drawHouse(x, groundY, w, h, seed) {
    const wall = HOUSE_WALLS[Math.floor(hash(seed) * HOUSE_WALLS.length)];
    const roof = HOUSE_ROOFS[Math.floor(hash(seed * 1.7) * HOUSE_ROOFS.length)];
    ctx.fillStyle = wall;
    ctx.fillRect(x, groundY - h, w, h);
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(x - 8, groundY - h + 2);
    ctx.lineTo(x + w / 2, groundY - h - 26);
    ctx.lineTo(x + w + 8, groundY - h + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(42,36,64,0.09)';        // eave shadow
    ctx.fillRect(x, groundY - h + 2, w, 4);
    ctx.fillStyle = '#9FC0D4';                     // windows
    for (let i = 0; i < Math.floor(w / 34); i++) {
      ctx.fillRect(x + 11 + i * 34, groundY - h + 18, 17, 17);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(x + 11 + i * 34, groundY - h + 18, 17, 7);
      ctx.fillStyle = '#9FC0D4';
    }
  }

  function drawBackground() {
    const sky = skyAt(cam.x + VIEW_W / 2);
    const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    g.addColorStop(0, sky.top);
    g.addColorStop(1, sky.bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // the sun climbs and sets across the day
    const dayT = clamp(cam.x / LEVEL_W, 0, 1);
    const sunX = VIEW_W * 0.2 + dayT * VIEW_W * 0.58;
    const sunY = 236 - Math.sin(dayT * Math.PI) * 186;
    const sunCol = dayT < 0.2 ? '#FFC98A' : dayT > 0.82 ? '#FFB182' : '#FFEDB4';
    const halo = ctx.createRadialGradient(sunX, sunY, 14, sunX, sunY, 64);
    halo.addColorStop(0, 'rgba(255,236,180,0.4)');
    halo.addColorStop(1, 'rgba(255,236,180,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(sunX - 70, sunY - 70, 140, 140);
    ctx.fillStyle = sunCol;
    ctx.beginPath(); ctx.arc(sunX, sunY, 19, 0, 6.3); ctx.fill();

    // clouds — slow parallax, spaced in their own drifting layer
    const cpx = cam.x * 0.14;
    const firstC = Math.floor(cpx / 210) - 1;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = firstC; i < firstC + 6; i++) {
      const x = i * 210 + hash(i * 3.3) * 90 - cpx;
      if (x < -120 || x > VIEW_W + 120) continue;
      const y = 26 + hash(i * 7.7) * 86;
      const s = 0.72 + hash(i * 5.1) * 0.6;
      // each puff its own path, or they chain into spikes
      ctx.beginPath(); ctx.ellipse(x, y, 32 * s, 11 * s, 0, 0, 6.3); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + 19 * s, y - 5 * s, 21 * s, 9.5 * s, 0, 0, 6.3); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x - 20 * s, y + 2 * s, 17 * s, 8 * s, 0, 0, 6.3); ctx.fill();
    }

    // far hills — kept low so they frame the scene instead of hazing it out
    ctx.fillStyle = 'rgba(116,150,124,0.34)';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    for (let i = 0; i <= VIEW_W; i += 12) {
      const wx = i + cam.x * 0.22;
      ctx.lineTo(i, 274 - Math.sin(wx * 0.004) * 17 - Math.sin(wx * 0.0011) * 11);
    }
    ctx.lineTo(VIEW_W, GROUND_Y);
    ctx.closePath();
    ctx.fill();
  }

  // Backdrop pieces are planted just below the ground line so the ground band
  // covers their feet. Which scenery shows is chosen by where the *view* is,
  // not by the parallax layer's own coordinate.
  const PLANT_Y = 306;

  function drawMidground() {
    const px = cam.x * 0.55;
    const first = Math.floor(px / 185) - 1;

    for (let i = first; i < first + 7; i++) {
      const sx = i * 185 + hash(i * 2.7) * 70 - px;
      if (sx < -170 || sx > VIEW_W + 170) continue;

      const here = cam.x + sx;                      // world spot this decor stands at
      if (here >= SEG.meetings.x0 - 150 && here < SEG.meetings.x1 + 60) continue; // indoors

      if (here < SEG.meetings.x0) {
        drawGumTree(sx, PLANT_Y, 0.8 + hash(i * 5.3) * 0.4, true);
      } else {
        drawHouse(sx, PLANT_Y, 78, 50 + hash(i * 13.1) * 20, i);
      }
    }

    // the office tower Margot disappears into, drawn on the approach
    const towerX = SEG.meetings.x0 - cam.x * 0.55 - (SEG.meetings.x0 - cam.x) * 0.45;
    if (towerX > -320 && towerX < VIEW_W + 320) {
      const h = 210;
      ctx.fillStyle = '#9AA6C8';
      ctx.fillRect(towerX - 130, PLANT_Y - h, 300, h);
      ctx.fillStyle = '#8493BA';
      ctx.fillRect(towerX - 130, PLANT_Y - h, 300, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.42)';
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 9; c++) {
          ctx.fillRect(towerX - 118 + c * 32, PLANT_Y - h + 24 + r * 26, 20, 15);
        }
      }
    }
  }

  const GROUND_STOPS = [
    { x: 0,               top: '#7FB069', body: '#5C8F4E' },  // home lawn
    { x: SEG.run.x0,      top: '#D9C7A8', body: '#B9A488' },  // park path
    { x: SEG.magpies.x0,  top: '#8CBE72', body: '#6A9A56' },  // grass verge
    { x: SEG.meetings.x0, top: '#8E86B8', body: '#6E67A0' },  // office carpet
    { x: SEG.party.x0,    top: '#84BC6C', body: '#63954F' },  // back lawn
    { x: SEG.call.x0,     top: '#6E8F72', body: '#4F6C57' },  // evening lawn
  ];
  const GROUND_BLEND = 80;

  function groundColors(x) {
    let i = 0;
    while (i < GROUND_STOPS.length - 1 && x >= GROUND_STOPS[i + 1].x) i++;
    const cur = GROUND_STOPS[i];
    const nxt = GROUND_STOPS[i + 1];
    if (!nxt) return cur;
    const d = nxt.x - x;
    if (d > GROUND_BLEND) return cur;
    const t = 1 - d / GROUND_BLEND;               // ease into the next surface
    return { top: hexMix(cur.top, nxt.top, t), body: hexMix(cur.body, nxt.body, t) };
  }

  function drawGround() {
    // banded so the surface changes with the segment
    const step = 4;
    for (let sx = -step; sx < VIEW_W + step; sx += step) {
      const wx = cam.x + sx;
      const c = groundColors(wx);
      ctx.fillStyle = c.top;
      ctx.fillRect(sx, GROUND_Y, step + 1, 7);
      ctx.fillStyle = c.body;
      ctx.fillRect(sx, GROUND_Y + 7, step + 1, VIEW_H - GROUND_Y - 7);
    }

    // grass tufts / carpet fleck
    for (let i = 0; i < 90; i++) {
      const wx = Math.floor((cam.x - 40) / 26) * 26 + i * 26;
      const sx = wx - cam.x;
      if (sx < -20 || sx > VIEW_W + 20) continue;
      const isCarpet = wx >= SEG.meetings.x0 && wx < SEG.party.x0;
      ctx.fillStyle = isCarpet ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.2)';
      const hh = isCarpet ? 2 : 4 + hash(wx) * 4;
      ctx.fillRect(sx + hash(wx * 3) * 18, GROUND_Y + 2, isCarpet ? 5 : 2, hh);
    }
  }

  function drawOfficeInterior() {
    const x0 = SEG.meetings.x0 - cam.x;
    const x1 = SEG.meetings.x1 - cam.x;
    if (x1 < -60 || x0 > VIEW_W + 60) return;

    const l = Math.max(-60, x0), r = Math.min(VIEW_W + 60, x1);
    const w = r - l;
    if (w <= 0) return;

    // wall, floor to ceiling — opaque, so nothing outside bleeds through
    ctx.fillStyle = '#EDEFF9';
    ctx.fillRect(l, 0, w, GROUND_Y);

    // ceiling band with recessed lights
    ctx.fillStyle = '#DFE2F1';
    ctx.fillRect(l, 0, w, 34);
    ctx.fillStyle = '#C9CDE6';
    ctx.fillRect(l, 34, w, 3);
    for (let wx = Math.floor(SEG.meetings.x0 / 150) * 150; wx < SEG.meetings.x1; wx += 150) {
      const sx = wx - cam.x;
      if (sx < l - 40 || sx > r + 40) continue;
      ctx.fillStyle = '#FFFBEA';
      roundRect(ctx, sx, 12, 54, 9, 4); ctx.fill();
      ctx.fillStyle = 'rgba(255,251,234,0.3)';
      ctx.beginPath();
      ctx.moveTo(sx, 21); ctx.lineTo(sx + 54, 21);
      ctx.lineTo(sx + 78, 118); ctx.lineTo(sx - 24, 118);
      ctx.closePath(); ctx.fill();
    }

    // windows onto the midday sky
    for (let wx = SEG.meetings.x0 + 120; wx < SEG.meetings.x1 - 80; wx += 300) {
      const sx = wx - cam.x;
      if (sx < l - 150 || sx > r + 150) continue;
      ctx.fillStyle = '#BFE0F2';
      roundRect(ctx, sx, 96, 124, 92, 4); ctx.fill();
      // a little skyline through the glass
      ctx.fillStyle = 'rgba(140,158,196,0.5)';
      ctx.fillRect(sx + 12, 150, 26, 38);
      ctx.fillRect(sx + 48, 132, 22, 56);
      ctx.fillRect(sx + 82, 158, 28, 30);
      ctx.strokeStyle = '#A8AECD';
      ctx.lineWidth = 3;
      roundRect(ctx, sx, 96, 124, 92, 4); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx + 62, 96); ctx.lineTo(sx + 62, 188);
      ctx.moveTo(sx, 142); ctx.lineTo(sx + 124, 142);
      ctx.stroke();
      ctx.fillStyle = '#C4C9E2';
      ctx.fillRect(sx - 5, 188, 134, 5);
    }

    // desks along the back wall
    for (let wx = Math.floor(SEG.meetings.x0 / 190) * 190 + 60; wx < SEG.meetings.x1; wx += 190) {
      const sx = wx - cam.x;
      if (sx < l - 90 || sx > r + 90) continue;
      ctx.fillStyle = '#D6D2C6';
      ctx.fillRect(sx, GROUND_Y - 46, 74, 6);
      ctx.fillStyle = '#C2BEB2';
      ctx.fillRect(sx + 4, GROUND_Y - 40, 5, 40);
      ctx.fillRect(sx + 65, GROUND_Y - 40, 5, 40);
      ctx.fillStyle = '#5C6480';                 // monitor
      roundRect(ctx, sx + 22, GROUND_Y - 74, 32, 22, 2); ctx.fill();
      ctx.fillStyle = '#8FA8C8';
      ctx.fillRect(sx + 25, GROUND_Y - 71, 26, 16);
      ctx.fillStyle = '#5C6480';
      ctx.fillRect(sx + 36, GROUND_Y - 52, 4, 6);
    }

    // skirting
    ctx.fillStyle = '#C9CDE6';
    ctx.fillRect(l, GROUND_Y - 9, w, 9);

    // glass doors at each end
    [SEG.meetings.x0, SEG.meetings.x1].forEach((wx) => {
      const sx = wx - cam.x;
      if (sx < -70 || sx > VIEW_W + 70) return;
      ctx.fillStyle = '#B9C0DC';
      ctx.fillRect(sx - 16, 128, 32, GROUND_Y - 128);
      ctx.fillStyle = '#DCE6F4';
      ctx.fillRect(sx - 12, 134, 24, GROUND_Y - 140);
      ctx.fillStyle = '#5B5FC7';
      ctx.fillRect(sx - 16, 128, 32, 7);
      ctx.fillStyle = '#8E96C4';
      ctx.fillRect(sx - 1, 140, 2, GROUND_Y - 148);
      ctx.fillStyle = '#5B5FC7';
      ctx.fillRect(sx + 3, GROUND_Y - 96, 6, 16);
    });
  }

  function drawKmMarkers() {
    for (let k = 2; k <= 16; k += 2) {
      const wx = SEG.run.x0 + (SEG.run.x1 - SEG.run.x0) * (k / 16);
      const sx = wx - cam.x;
      if (sx < -40 || sx > VIEW_W + 40) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(sx - 1, GROUND_Y - 26, 3, 26);
      roundRect(ctx, sx - 13, GROUND_Y - 40, 26, 16, 3);
      ctx.fill();
      ctx.fillStyle = '#5C8F4E';
      ctx.font = '700 9px Karla, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${k}k`, sx, GROUND_Y - 29);
    }
    ctx.textAlign = 'left';
  }

  function drawHurdles() {
    for (const h of HURDLES) {
      const sx = h.x - cam.x;
      if (sx < -60 || sx > VIEW_W + 60) continue;
      const sz = HURDLE_SIZE[h.kind];
      const b = GROUND_Y;

      if (h.kind === 'puddle') {
        ctx.fillStyle = 'rgba(110,170,205,0.75)';
        ctx.beginPath(); ctx.ellipse(sx, b - 2, sz.w / 2, 5, 0, 0, 6.3); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath(); ctx.ellipse(sx - 7, b - 3, 7, 2, 0, 0, 6.3); ctx.fill();
      } else if (h.kind === 'bench') {
        ctx.fillStyle = '#A97C50';
        ctx.fillRect(sx - 24, b - 16, 48, 6);
        ctx.fillRect(sx - 24, b - 25, 48, 5);
        ctx.fillStyle = '#6E5136';
        ctx.fillRect(sx - 20, b - 16, 4, 16);
        ctx.fillRect(sx + 16, b - 16, 4, 16);
      } else if (h.kind === 'dog') {
        ctx.fillStyle = '#C69A6D';
        roundRect(ctx, sx - 20, b - 14, 40, 14, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + 18, b - 16, 8, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#8A6844';
        ctx.beginPath(); ctx.ellipse(sx + 15, b - 21, 4, 6, 0.3, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#2A2440';
        ctx.fillRect(sx + 21, b - 17, 2, 2);
        // little sleep z
        ctx.fillStyle = 'rgba(42,36,64,0.5)';
        ctx.font = '700 9px Karla, sans-serif';
        ctx.fillText('z', sx + 25, b - 26);
      } else {
        ctx.fillStyle = '#4A5570';
        ctx.fillRect(sx - 16, b - 6, 32, 4);
        ctx.fillRect(sx + 10, b - 20, 4, 16);
        ctx.fillStyle = '#2A2440';
        ctx.beginPath(); ctx.arc(sx - 13, b - 3, 4, 0, 6.3); ctx.fill();
        ctx.beginPath(); ctx.arc(sx + 13, b - 3, 4, 0, 6.3); ctx.fill();
      }
    }
  }

  function drawMagpie(sx, sy, phase) {
    const BLACK = '#1E1E24';
    const WHITE = '#F7F7FA';
    const diving = phase === 'dive';
    const flap = diving ? -0.85 : Math.sin(performance.now() * 0.016) * 0.65;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(-1, 1);                     // faces left, toward Margot's approach
    if (diving) ctx.rotate(0.5);

    // far wing, behind the body
    ctx.fillStyle = '#0F0F14';
    ctx.save();
    ctx.translate(-1, -1);
    ctx.rotate(-flap * 0.7);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-9, -13, -22, -9);
    ctx.quadraticCurveTo(-12, 1, 0, 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // tail — long and wedged
    ctx.fillStyle = BLACK;
    ctx.beginPath();
    ctx.moveTo(-6, -2);
    ctx.lineTo(-24, -6);
    ctx.lineTo(-26, 0);
    ctx.lineTo(-23, 4);
    ctx.lineTo(-6, 3);
    ctx.closePath();
    ctx.fill();

    // body
    ctx.fillStyle = BLACK;
    ctx.beginPath(); ctx.ellipse(0, 0, 10, 6.5, -0.08, 0, 6.3); ctx.fill();

    // white belly patch
    ctx.fillStyle = WHITE;
    ctx.beginPath(); ctx.ellipse(-1, 1.5, 7, 3.6, -0.05, 0, 6.3); ctx.fill();

    // head
    ctx.fillStyle = BLACK;
    ctx.beginPath(); ctx.arc(8.5, -4, 4.6, 0, 6.3); ctx.fill();

    // white nape — the magpie's tell
    ctx.fillStyle = WHITE;
    ctx.beginPath(); ctx.ellipse(4.2, -6, 3.4, 2.4, -0.5, 0, 6.3); ctx.fill();

    // beak
    ctx.fillStyle = '#C8C8D2';
    ctx.beginPath();
    ctx.moveTo(12.4, -5.2);
    ctx.lineTo(20, -3.4);
    ctx.lineTo(12.4, -1.8);
    ctx.closePath();
    ctx.fill();

    // eye
    ctx.fillStyle = '#F2B441';
    ctx.beginPath(); ctx.arc(9.8, -5.2, 1.5, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#1E1E24';
    ctx.beginPath(); ctx.arc(10.2, -5.2, 0.7, 0, 6.3); ctx.fill();

    // near wing, over the body
    ctx.save();
    ctx.translate(0, -2);
    ctx.rotate(-flap);
    ctx.fillStyle = BLACK;
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.quadraticCurveTo(-8, -16, -23, -12);
    ctx.quadraticCurveTo(-11, 2, 2, 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = WHITE;                 // white wing flash
    ctx.beginPath();
    ctx.moveTo(-2, -2);
    ctx.quadraticCurveTo(-9, -9, -17, -9);
    ctx.quadraticCurveTo(-9, -4, -2, -0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  function drawMagpies() {
    for (const m of magpies) {
      const sx = m.x - cam.x;
      if (sx < -70 || sx > VIEW_W + 70) continue;
      const st = magpieState(m);

      if (st.phase === 'telegraph') {
        const pulse = 0.35 + Math.sin(m.t * 26) * 0.25;
        ctx.strokeStyle = `rgba(240,86,122,${pulse})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(sx, st.y + 12);
        ctx.lineTo(sx, GROUND_Y - 4);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = `rgba(240,86,122,${pulse * 0.6})`;
        ctx.beginPath(); ctx.ellipse(sx, GROUND_Y - 2, 17, 5, 0, 0, 6.3); ctx.fill();
      }

      // shadow on the ground
      const h = clamp(1 - (GROUND_Y - st.y) / 200, 0.12, 0.5);
      ctx.fillStyle = `rgba(42,36,64,${h * 0.35})`;
      ctx.beginPath(); ctx.ellipse(sx, GROUND_Y - 1, 12 * h + 5, 3.5, 0, 0, 6.3); ctx.fill();

      drawMagpie(sx, st.y, st.phase);
    }
  }

  function drawMeetings() {
    for (const m of meetings) {
      const sx = m.x - cam.x;
      if (sx < -140 || sx > VIEW_W + 140) continue;
      const top = GROUND_Y - m.h;

      if (!m.alive) {
        if (m.pop > 0) {
          const k = clamp(m.pop / 0.5, 0, 1);
          ctx.save();
          ctx.globalAlpha = k * 0.8;
          ctx.translate(sx + m.w / 2, top + m.h / 2);
          ctx.scale(1 + (1 - k) * 0.5, 1 + (1 - k) * 0.5);
          ctx.strokeStyle = '#5B5FC7';
          ctx.lineWidth = 2;
          roundRect(ctx, -m.w / 2, -m.h / 2, m.w, m.h, 6);
          ctx.stroke();
          ctx.restore();
        }
        continue;
      }

      // window body
      ctx.fillStyle = 'rgba(42,36,64,0.16)';
      ctx.beginPath(); ctx.ellipse(sx + m.w / 2, GROUND_Y - 1, m.w * 0.42, 4, 0, 0, 6.3); ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      roundRect(ctx, sx, top, m.w, m.h, 6); ctx.fill();
      ctx.fillStyle = '#5B5FC7';
      roundRect(ctx, sx, top, m.w, 15, 6); ctx.fill();
      ctx.fillRect(sx, top + 9, m.w, 6);

      // title
      ctx.fillStyle = '#FFF6E9';
      ctx.font = '700 8px Karla, sans-serif';
      ctx.textAlign = 'left';
      const label = m.title.length > 15 ? m.title.slice(0, 14) + '…' : m.title;
      ctx.fillText(label, sx + 5, top + 11);

      // participant tiles
      const rows = m.h > 56 ? 2 : 1;
      const tw = (m.w - 14) / 2;
      const th = Math.min(17, (m.h - 22) / rows - 3);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < 2; c++) {
          const bx = sx + 5 + c * (tw + 4);
          const by = top + 19 + r * (th + 3);
          ctx.fillStyle = ['#C9CCEB', '#DCDEF3', '#B8BCE4', '#D2D5EF'][(r * 2 + c) % 4];
          roundRect(ctx, bx, by, tw, th, 3); ctx.fill();
          ctx.fillStyle = 'rgba(91,95,199,0.55)';
          ctx.beginPath(); ctx.arc(bx + tw / 2, by + th / 2 - 1, Math.min(4, th / 3), 0, 6.3); ctx.fill();
        }
      }

      // "jump here" nudge on the nearest one
      if (Math.abs(m.x + m.w / 2 - player.x) < 120 && player.onGround) {
        const a = 0.4 + Math.sin(performance.now() * 0.006) * 0.25;
        ctx.fillStyle = `rgba(240,86,122,${a})`;
        ctx.beginPath();
        ctx.moveTo(sx + m.w / 2, top - 16);
        ctx.lineTo(sx + m.w / 2 - 6, top - 8);
        ctx.lineTo(sx + m.w / 2 + 6, top - 8);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.textAlign = 'left';
  }

  function drawPlatforms() {
    for (const p of PLATFORMS) {
      const sx = p.x - cam.x;
      if (sx < -140 || sx > VIEW_W + 140) continue;
      ctx.fillStyle = '#C9B79A';
      roundRect(ctx, sx, p.y, p.w, p.h, 3); ctx.fill();
      ctx.fillStyle = '#A08B6C';
      ctx.fillRect(sx + 6, p.y + p.h, 5, GROUND_Y - p.y - p.h);
      ctx.fillRect(sx + p.w - 11, p.y + p.h, 5, GROUND_Y - p.y - p.h);
      // a tablecloth stripe
      ctx.fillStyle = 'rgba(240,86,122,0.7)';
      ctx.fillRect(sx, p.y, p.w, 3);
    }
  }

  function drawPartyItem(p) {
    const sx = p.x - cam.x;
    const sy = p.y + (p.kind === 'balloon' ? Math.sin(p.bob) * 4 : 0);

    switch (p.kind) {
      case 'balloon': {
        ctx.strokeStyle = 'rgba(42,36,64,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx, sy + 10);
        ctx.quadraticCurveTo(sx + 4, sy + 22, sx, sy + 32);
        ctx.stroke();
        const col = ['#F0567A', '#F2B441', '#5B9BD5'][Math.floor(hash(p.x) * 3)];
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.ellipse(sx, sy, 9, 11, 0, 0, 6.3); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.ellipse(sx - 3, sy - 4, 3, 4, -0.4, 0, 6.3); ctx.fill();
        break;
      }
      case 'cake': {
        ctx.fillStyle = '#FFF6E9';
        roundRect(ctx, sx - 12, sy - 6, 24, 14, 3); ctx.fill();
        ctx.fillStyle = '#F0567A';
        ctx.fillRect(sx - 12, sy - 2, 24, 4);
        ctx.fillStyle = '#F2B441';
        ctx.fillRect(sx - 1, sy - 14, 2, 8);
        ctx.beginPath(); ctx.ellipse(sx, sy - 16, 2, 3.4, 0, 0, 6.3); ctx.fill();
        break;
      }
      case 'present': {
        ctx.fillStyle = '#5B9BD5';
        roundRect(ctx, sx - 11, sy - 11, 22, 22, 3); ctx.fill();
        ctx.fillStyle = '#F2B441';
        ctx.fillRect(sx - 2, sy - 11, 4, 22);
        ctx.fillRect(sx - 11, sy - 2, 22, 4);
        break;
      }
      case 'hat': {
        ctx.fillStyle = '#F0567A';
        ctx.beginPath();
        ctx.moveTo(sx, sy - 14); ctx.lineTo(sx - 9, sy + 8); ctx.lineTo(sx + 9, sy + 8);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#FFF6E9';
        ctx.beginPath(); ctx.arc(sx, sy - 15, 3, 0, 6.3); ctx.fill();
        ctx.fillRect(sx - 9, sy + 6, 18, 3);
        break;
      }
      case 'juice': {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.moveTo(sx - 8, sy - 12); ctx.lineTo(sx + 8, sy - 12);
        ctx.lineTo(sx + 5, sy + 10); ctx.lineTo(sx - 5, sy + 10);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#F2B441';
        ctx.beginPath();
        ctx.moveTo(sx - 7, sy - 6); ctx.lineTo(sx + 7, sy - 6);
        ctx.lineTo(sx + 5, sy + 9); ctx.lineTo(sx - 5, sy + 9);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#F0567A'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sx + 3, sy - 18); ctx.lineTo(sx + 1, sy - 6); ctx.stroke();
        break;
      }
      case 'candles': {
        // a boxed set of candles — reads better than three bare sticks
        ctx.fillStyle = '#F0567A';
        roundRect(ctx, sx - 12, sy - 4, 24, 13, 2); ctx.fill();
        for (let i = -1; i <= 1; i++) {
          ctx.fillStyle = '#FFF6E9';
          ctx.fillRect(sx + i * 7 - 2, sy - 15, 4, 12);
          ctx.fillStyle = '#E0446A';                      // stripe
          ctx.fillRect(sx + i * 7 - 2, sy - 11, 4, 2);
          ctx.fillStyle = '#F2B441';                      // flame
          ctx.beginPath(); ctx.ellipse(sx + i * 7, sy - 18, 2.2, 3.6, 0, 0, 6.3); ctx.fill();
        }
        break;
      }
    }
  }

  function drawParty() {
    // bunting across the party stretch
    const y0 = 150;
    ctx.strokeStyle = 'rgba(42,36,64,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let wx = SEG.party.x0; wx <= SEG.party.x1; wx += 10) {
      const sx = wx - cam.x;
      if (sx < -40 || sx > VIEW_W + 40) continue;
      const y = y0 + Math.sin((wx - SEG.party.x0) * 0.012) * 14;
      if (wx === SEG.party.x0) ctx.moveTo(sx, y); else ctx.lineTo(sx, y);
    }
    ctx.stroke();

    for (let wx = SEG.party.x0 + 20; wx < SEG.party.x1; wx += 34) {
      const sx = wx - cam.x;
      if (sx < -30 || sx > VIEW_W + 30) continue;
      const y = y0 + Math.sin((wx - SEG.party.x0) * 0.012) * 14;
      ctx.fillStyle = ['#F0567A', '#F2B441', '#5B9BD5', '#5C8F4E'][Math.floor(hash(wx) * 4)];
      ctx.beginPath();
      ctx.moveTo(sx - 7, y); ctx.lineTo(sx + 7, y); ctx.lineTo(sx, y + 15);
      ctx.closePath(); ctx.fill();
    }

    for (const p of party) {
      if (p.taken) continue;
      const sx = p.x - cam.x;
      if (sx < -50 || sx > VIEW_W + 50) continue;
      // a soft halo so items read against the lawn
      const h = ctx.createRadialGradient(sx, p.y, 2, sx, p.y, 20);
      h.addColorStop(0, 'rgba(255,246,233,0.4)');
      h.addColorStop(1, 'rgba(255,246,233,0)');
      ctx.fillStyle = h;
      ctx.fillRect(sx - 22, p.y - 22, 44, 44);
      drawPartyItem(p);
    }
  }

  function drawGate() {
    const sx = GATE_X - cam.x;
    if (sx < -80 || sx > VIEW_W + 80) return;
    const open = partyLeft() === 0;

    ctx.save();
    if (open) ctx.globalAlpha = 0.35;

    // archway posts
    ctx.fillStyle = '#B9A488';
    ctx.fillRect(sx - 3, GROUND_Y - 150, 6, 150);
    ctx.fillRect(sx + 50, GROUND_Y - 150, 6, 150);
    ctx.fillStyle = '#9C8A70';
    ctx.fillRect(sx - 6, GROUND_Y - 154, 12, 6);
    ctx.fillRect(sx + 47, GROUND_Y - 154, 12, 6);

    // ribbon strung between them
    const droop = open ? 52 : 6;
    ctx.strokeStyle = '#F0567A';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, GROUND_Y - 144);
    ctx.quadraticCurveTo(sx + 26, GROUND_Y - 144 + droop, sx + 53, GROUND_Y - 144);
    ctx.stroke();
    ctx.lineCap = 'butt';

    if (!open) {
      ctx.fillStyle = 'rgba(255,246,233,0.94)';
      roundRect(ctx, sx - 26, GROUND_Y - 186, 104, 26, 6); ctx.fill();
      ctx.fillStyle = '#2A2440';
      ctx.font = '700 10px Karla, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${partyLeft()} more to find`, sx + 26, GROUND_Y - 169);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }

  function drawPhone() {
    const sx = PHONE_X - cam.x;
    if (sx < -80 || sx > VIEW_W + 80) return;

    // porch light pooling on the lawn at dusk
    const glow = ctx.createRadialGradient(sx, GROUND_Y - 78, 8, sx, GROUND_Y - 78, 96);
    glow.addColorStop(0, 'rgba(255,222,158,0.32)');
    glow.addColorStop(1, 'rgba(255,222,158,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx - 100, GROUND_Y - 178, 200, 200);

    // side table
    ctx.fillStyle = '#A97C50';
    roundRect(ctx, sx - 22, GROUND_Y - 44, 44, 7, 2); ctx.fill();
    ctx.fillStyle = '#8A6844';
    ctx.fillRect(sx - 17, GROUND_Y - 37, 5, 37);
    ctx.fillRect(sx + 12, GROUND_Y - 37, 5, 37);

    // the phone
    const lifted = player.holdingPhone;
    if (!lifted) {
      ctx.fillStyle = '#2A2440';
      roundRect(ctx, sx - 13, GROUND_Y - 60, 26, 16, 3); ctx.fill();
      ctx.fillStyle = '#FFF6E9';
      roundRect(ctx, sx - 10, GROUND_Y - 57, 20, 10, 2); ctx.fill();
      ctx.fillStyle = '#F2B441';
      roundRect(ctx, sx - 8, GROUND_Y - 55, 16, 6, 1); ctx.fill();

      if (game.phase === 'play') {
        const a = 0.45 + Math.sin(performance.now() * 0.005) * 0.3;
        ctx.fillStyle = `rgba(240,86,122,${a})`;
        ctx.font = '700 11px Karla, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Call Daniel', sx, GROUND_Y - 74);
        ctx.textAlign = 'left';
      }
    }

  }

  // --- Margot

  function drawMargot() {
    const sx = player.x - cam.x;
    const sy = player.y;
    const moving = Math.abs(player.vx) > 12;
    const air = !player.onGround;
    const stag = player.stumbleT > 0;

    // shadow
    ctx.fillStyle = 'rgba(42,36,64,0.2)';
    ctx.beginPath();
    ctx.ellipse(sx, GROUND_Y - 1, 11, 3.5, 0, 0, 6.3);
    ctx.fill();

    ctx.save();
    ctx.translate(sx, sy);

    if (player.invulnT > 0 && Math.floor(player.invulnT * 14) % 2 === 0) ctx.globalAlpha = 0.45;
    if (stag) ctx.rotate(-0.25 * player.facing);
    ctx.scale(player.facing, 1);

    const bob = moving && !air ? Math.sin(player.runPhase * 2) * 1.2 : 0;
    const swing = air ? 0.5 : (moving ? Math.sin(player.runPhase * 2) : 0);

    const SKIN  = '#F2C9A8';
    const NAVY  = '#2E3A59';
    const NAVY2 = '#3B4A70';
    const CREAM = '#FFF6E9';
    const HAIR  = '#E8C170';
    const HAIR2 = '#F5DA9B';
    const CORAL = '#F0567A';

    // --- legs
    const legLift = air ? 5 : 0;
    ctx.fillStyle = SKIN;
    // back leg
    ctx.save();
    ctx.translate(-2, -12 + bob);
    ctx.rotate(-swing * 0.6 + (air ? 0.5 : 0));
    ctx.fillRect(-2.5, 0, 5, 12 - legLift);
    ctx.fillStyle = '#2A2440';                     // heel
    ctx.fillRect(-3.5, 11 - legLift, 7, 3);
    ctx.restore();
    // front leg
    ctx.fillStyle = SKIN;
    ctx.save();
    ctx.translate(3, -12 + bob);
    ctx.rotate(swing * 0.6 - (air ? 0.3 : 0));
    ctx.fillRect(-2.5, 0, 5, 12 - legLift);
    ctx.fillStyle = '#2A2440';
    ctx.fillRect(-3.5, 11 - legLift, 7, 3);
    ctx.restore();

    // --- skirt
    ctx.fillStyle = NAVY2;
    ctx.beginPath();
    ctx.moveTo(-8, -22 + bob);
    ctx.lineTo(8, -22 + bob);
    ctx.lineTo(9.5, -10 + bob);
    ctx.lineTo(-9.5, -10 + bob);
    ctx.closePath();
    ctx.fill();

    // --- torso / blazer
    ctx.fillStyle = CREAM;                          // blouse
    ctx.fillRect(-5, -32 + bob, 10, 12);
    ctx.fillStyle = NAVY;                           // blazer body
    ctx.beginPath();
    ctx.moveTo(-8, -33 + bob);
    ctx.lineTo(-3.5, -33 + bob);
    ctx.lineTo(-2, -24 + bob);
    ctx.lineTo(-8.5, -21 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(8, -33 + bob);
    ctx.lineTo(3.5, -33 + bob);
    ctx.lineTo(2, -24 + bob);
    ctx.lineTo(8.5, -21 + bob);
    ctx.closePath();
    ctx.fill();
    // lapel notch
    ctx.fillStyle = NAVY2;
    ctx.beginPath();
    ctx.moveTo(-3.5, -33 + bob); ctx.lineTo(0, -27 + bob); ctx.lineTo(3.5, -33 + bob);
    ctx.closePath();
    ctx.fill();
    // scarf
    ctx.fillStyle = CORAL;
    ctx.fillRect(-4, -34 + bob, 8, 3);

    // --- arms
    ctx.fillStyle = NAVY;
    // back arm swings
    ctx.save();
    ctx.translate(-6, -31 + bob);
    ctx.rotate(swing * 0.8 + (air ? -0.9 : 0));
    ctx.fillRect(-2, 0, 4, 12);
    ctx.fillStyle = SKIN;
    ctx.fillRect(-2, 11, 4, 3);
    ctx.restore();
    // front arm — holds the phone
    ctx.fillStyle = NAVY;
    ctx.save();
    ctx.translate(6, -31 + bob);
    if (player.holdingPhone) {
      ctx.rotate(-1.9);                              // up to her ear
      ctx.fillRect(-2, 0, 4, 10);
      ctx.fillStyle = SKIN;
      ctx.fillRect(-2, 9, 4, 3);
      ctx.fillStyle = '#2A2440';
      roundRect(ctx, -3, 10, 6, 9, 1.5); ctx.fill();
    } else {
      ctx.rotate(-swing * 0.8 + (air ? 0.7 : 0.15));
      ctx.fillRect(-2, 0, 4, 12);
      ctx.fillStyle = SKIN;
      ctx.fillRect(-2, 11, 4, 3);
      ctx.fillStyle = '#2A2440';                     // phone in hand, always
      roundRect(ctx, -2.5, 12, 5, 8, 1.5); ctx.fill();
      ctx.fillStyle = '#8FD3F4';
      ctx.fillRect(-1.5, 13, 3, 5);
    }
    ctx.restore();

    // --- head
    ctx.fillStyle = SKIN;
    ctx.beginPath();
    ctx.arc(1, -39 + bob, 6.6, 0, 6.3);
    ctx.fill();

    // ponytail (behind)
    ctx.fillStyle = HAIR;
    ctx.save();
    ctx.translate(-5, -41 + bob);
    ctx.rotate(swing * 0.35 - 0.25);
    ctx.beginPath();
    ctx.ellipse(-4, 5, 4, 9, 0.3, 0, 6.3);
    ctx.fill();
    ctx.restore();

    // hair cap + fringe
    ctx.fillStyle = HAIR;
    ctx.beginPath();
    ctx.arc(1, -40 + bob, 7.1, Math.PI * 0.98, Math.PI * 2.15);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-3.4, -40 + bob, 3.6, 5.6, 0.25, 0, 6.3);
    ctx.fill();
    ctx.fillStyle = HAIR2;
    ctx.beginPath();
    ctx.ellipse(2.5, -44 + bob, 4.2, 2.2, -0.25, 0, 6.3);
    ctx.fill();

    // face
    ctx.fillStyle = '#2A2440';
    if (stag) {
      // dazed
      ctx.fillRect(4.4, -40.5 + bob, 2.6, 1);
      ctx.fillRect(4.4, -39.5 + bob, 1, 1);
    } else {
      ctx.beginPath(); ctx.arc(5.2, -40 + bob, 0.95, 0, 6.3); ctx.fill();
    }
    ctx.fillStyle = CORAL;
    ctx.beginPath();
    ctx.ellipse(5.6, -36.4 + bob, 1.5, 0.9, 0, 0, 6.3);
    ctx.fill();

    ctx.restore();

    // stumble stars
    if (stag) {
      for (let i = 0; i < 3; i++) {
        const a = performance.now() * 0.006 + i * 2.1;
        ctx.fillStyle = '#F2B441';
        ctx.beginPath();
        ctx.arc(sx + Math.cos(a) * 13, sy - PH - 8 + Math.sin(a) * 5, 2, 0, 6.3);
        ctx.fill();
      }
    }
  }

  function drawEffects() {
    for (const p of puffs) {
      const k = 1 - p.t / p.life;
      ctx.globalAlpha = k;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - cam.x, p.y, p.r * k, 0, 6.3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    for (const f of floaters) {
      const k = 1 - f.t / f.life;
      ctx.globalAlpha = clamp(k * 1.6, 0, 1);
      ctx.font = '700 12px Karla, sans-serif';
      ctx.fillStyle = 'rgba(255,246,233,0.9)';
      ctx.fillText(f.text, f.x - cam.x + 1, f.y + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x - cam.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function drawRunBanner() {
    if (activeSegment() !== 'run' || game.phase !== 'play') return;
    const km = runKm();
    ctx.fillStyle = 'rgba(255,246,233,0.92)';
    roundRect(ctx, VIEW_W / 2 - 54, VIEW_H - 52, 108, 34, 9); ctx.fill();
    ctx.textAlign = 'center';
    ctx.font = '700 8px Karla, sans-serif';
    ctx.fillStyle = '#6B6285';
    ctx.fillText('OF 16', VIEW_W / 2, VIEW_H - 40);
    ctx.font = '800 17px "Bricolage Grotesque", sans-serif';
    ctx.fillStyle = '#2A2440';
    ctx.fillText(`${km.toFixed(1)} km`, VIEW_W / 2, VIEW_H - 24);
    // progress bar
    ctx.fillStyle = 'rgba(42,36,64,0.12)';
    roundRect(ctx, VIEW_W / 2 - 44, VIEW_H - 20, 88, 3, 1.5); ctx.fill();
    ctx.fillStyle = '#F0567A';
    roundRect(ctx, VIEW_W / 2 - 44, VIEW_H - 20, 88 * (km / 16), 3, 1.5); ctx.fill();
    ctx.textAlign = 'left';
  }

  function segmentTitle() {
    const s = activeSegment();
    const names = {
      home: 'Tuesday, 5:42 am',
      run: 'The 16 km run',
      magpies: 'Magpie season',
      meetings: 'Back-to-back',
      party: 'The birthday party',
      call: 'At last',
    };
    return names[s] || '';
  }

  let lastSeg = '';
  let segBannerT = 0;

  function drawSegmentBanner(dt) {
    const s = activeSegment();
    if (s !== lastSeg) { lastSeg = s; segBannerT = 2.4; }
    if (segBannerT <= 0) return;
    segBannerT -= dt;
    const k = clamp(segBannerT / 0.5, 0, 1) * clamp((2.4 - segBannerT) / 0.3, 0, 1);
    ctx.globalAlpha = k;
    ctx.font = '800 22px "Bricolage Grotesque", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,246,233,0.92)';
    ctx.fillText(segmentTitle(), VIEW_W / 2 + 1, 79);
    ctx.fillStyle = '#2A2440';
    ctx.fillText(segmentTitle(), VIEW_W / 2, 78);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function render(dt) {
    resize();
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    ctx.save();
    if (game.shake > 0) {
      ctx.translate((Math.random() - 0.5) * game.shake * 9, (Math.random() - 0.5) * game.shake * 9);
    }

    drawBackground();
    drawMidground();
    drawOfficeInterior();
    drawGround();
    drawKmMarkers();
    drawHurdles();
    drawPlatforms();
    drawParty();
    drawGate();
    drawPhone();
    drawMeetings();
    drawMagpies();
    drawMargot();
    drawEffects();

    ctx.restore();

    drawRunBanner();
    drawSegmentBanner(dt);
  }

  // ---------------------------------------------------------------- hud/ui

  const el = {
    hud: document.getElementById('hud'),
    tasks: document.getElementById('tasks'),
    clock: document.getElementById('clock'),
    btnSound: document.getElementById('btnSound'),
    screenTitle: document.getElementById('screenTitle'),
    screenWin: document.getElementById('screenWin'),
    btnStart: document.getElementById('btnStart'),
    btnAgain: document.getElementById('btnAgain'),
    winTime: document.getElementById('winTime'),
    winBest: document.getElementById('winBest'),
    winStumbles: document.getElementById('winStumbles'),
    winNote: document.getElementById('winNote'),
    bestNote: document.getElementById('bestNote'),
  };

  const TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5 9.5 18 20 6.5"/></svg>';

  function buildTasks() {
    el.tasks.innerHTML = tasks.map(t =>
      `<span class="task" data-id="${t.id}"><span class="box">${TICK}</span>${t.label}<b class="sub" data-sub="${t.id}"></b></span>`
    ).join('');
  }

  function syncHud() {
    const seg = activeSegment();
    for (const t of tasks) {
      const node = el.tasks.querySelector(`[data-id="${t.id}"]`);
      if (!node) continue;
      node.dataset.done = t.done ? '1' : '0';
      const isActive =
        (t.id === 'run' && seg === 'run') ||
        (t.id === 'magpies' && seg === 'magpies') ||
        (t.id === 'meetings' && seg === 'meetings') ||
        (t.id === 'party' && seg === 'party');
      node.dataset.active = (!t.done && isActive) ? '1' : '0';

      const sub = node.querySelector(`[data-sub="${t.id}"]`);
      if (!sub) continue;
      if (t.id === 'meetings') sub.textContent = t.done ? '' : `${MEETING_DEFS.length - meetingsLeft()}/${MEETING_DEFS.length}`;
      else if (t.id === 'party') sub.textContent = t.done ? '' : `${PARTY_DEFS.length - partyLeft()}/${PARTY_DEFS.length}`;
      else if (t.id === 'run') sub.textContent = t.done ? '' : (seg === 'run' ? `${runKm().toFixed(1)}km` : '');
      else sub.textContent = '';
    }
    el.clock.textContent = fmtClock(game.time + game.penalty);
  }

  function show(which) {
    el.screenTitle.hidden = which !== 'title';
    el.screenWin.hidden = which !== 'win';
    el.hud.dataset.on = (which === 'none') ? '1' : '0';
  }

  function toggleSound() {
    Sound.on = !Sound.on;
    saveMuted(!Sound.on);
    el.btnSound.textContent = Sound.on ? 'Sound on' : 'Sound off';
    if (Sound.on) Sound.ensure();
  }

  function startGame() {
    Sound.ensure();
    resetLevel();
    lastSeg = '';
    segBannerT = 0;
    game.phase = 'play';
    show('none');
    syncHud();
  }

  function showTitle() {
    game.phase = 'title';
    show('title');
    const best = loadBest();
    if (best) {
      el.bestNote.hidden = false;
      el.bestNote.textContent = `Your best day so far: ${fmtPrecise(best.time)}.`;
    } else {
      el.bestNote.hidden = true;
    }
  }

  // ---------------------------------------------------------------- loop

  let last = performance.now();
  let acc = 0;
  const DT = 1 / 120;

  function frame(now) {
    const raw = Math.min(0.05, (now - last) / 1000);
    last = now;
    readInput();

    if (game.phase === 'play' || game.phase === 'finale') {
      acc += raw;
      let guard = 0;
      while (acc >= DT && guard++ < 8) {
        acc -= DT;
        if (game.phase === 'play') {
          game.time += DT;
          updatePlayer(DT);
          updateHurdles();
          updateMagpies(DT);
          updateParty(DT);
          updateTasks();
          if (player.x > PHONE_X - 26 && tasks.every(t => t.done)) {
            game.phase = 'finale';
            game.finaleT = 0;
            player.vx = 0;
          }
        } else {
          updateFinale(DT);
        }
        updateEffects(DT);
      }
      input.jumpPressed = false;

      // camera
      const targetX = clamp(player.x - VIEW_W * 0.42, 0, LEVEL_W - VIEW_W);
      cam.x += (targetX - cam.x) * Math.min(1, raw * 8);
      syncHud();
    } else {
      input.jumpPressed = false;
      updateEffects(raw);
      cam.x += (clamp(player.x - VIEW_W * 0.42, 0, LEVEL_W - VIEW_W) - cam.x) * Math.min(1, raw * 8);
    }

    render(raw);
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- boot

  function boot() {
    const coarse = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (coarse) document.body.dataset.touch = '1';

    bindPad(document.getElementById('padLeft'), 'left');
    bindPad(document.getElementById('padRight'), 'right');
    bindPad(document.getElementById('padJump'), 'jump');

    el.btnStart.addEventListener('click', startGame);
    el.btnAgain.addEventListener('click', startGame);
    el.btnSound.addEventListener('click', toggleSound);
    el.btnSound.textContent = Sound.on ? 'Sound on' : 'Sound off';

    buildTasks();
    resetLevel();
    resize();
    showTitle();
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
