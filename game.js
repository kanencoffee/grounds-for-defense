// Grounds for Defense — Phaser, Phase 2 (sprites + polish + expanded roster)
const W = 1024, H = 640;

const TOWER_DEFS = {
  drip:      { name:'Drip',       cost:50,  range:130, dmg:6,   fireRate:220, sprite:'t_drip',     proj:0xf5e8d6, blurb:'Old reliable. Fast weak shots.' },
  espresso:  { name:'Espresso',   cost:150, range:240, dmg:60,  fireRate:1800,sprite:'t_espresso', proj:0xd97706, charge:1500, pierce:true, blurb:'Charges, then fires a piercing line shot.' },
  frother:   { name:'Frother',    cost:75,  range:140, dmg:0,   fireRate:1200,sprite:'t_frother',  proj:0xffffff, root:2000, blurb:'Roots target. No damage.' },
  cold:      { name:'Cold Brew',  cost:100, range:130, dmg:0,   fireRate:0,   sprite:'t_cold',     proj:0x88bbee, slow:0.55, aura:true, blurb:'Slow aura, all enemies in range.' },
  grinder:   { name:'Grinder',    cost:120, range:110, dmg:0,   fireRate:300, sprite:'t_grinder',  proj:0x6b4423, shred:0.3, blurb:'Shreds armor; targets take +30% from all sources.' },
  pourover:  { name:'Pour-Over',  cost:200, range:160, dmg:18,  fireRate:600, sprite:'t_pourover', proj:0xd97706, splash:50, blurb:'Splash damage, area denial.' },
  aeropress: { name:'Aeropress',  cost:130, range:170, dmg:14,  fireRate:280, sprite:'t_aeropress',proj:0xc0c0c0, knockback:6, blurb:'Rapid shots; knocks enemies back.' },
};

const ENEMY_DEFS = {
  disciple:   { hp:30,  speed:42, sprite:'e_disciple', bounty:5,  size:18 },
  evangelist: { hp:20,  speed:80, sprite:'e_evangelist',bounty:8, size:17, slowImmuneMs:3000 },
  demon:      { hp:140, speed:24, sprite:'e_demon',    bounty:22, size:24 },
  zealot:     { hp:50,  speed:48, sprite:'e_zealot',   bounty:10, size:18, splitInto:'disciple', splitCount:2 },
  wraith:     { hp:60,  speed:60, sprite:'e_wraith',   bounty:15, size:18, phaseEvery:5000, phaseDur:2500 },
  baron:      { hp:600, speed:30, sprite:'e_baron',    bounty:250,size:30, regen:5, armor:0.25 },
};

const PATH_PTS = [
  [-30,140],[260,140],[260,300],[540,300],[540,160],[820,160],[820,440],[180,440],[180,560],[1054,560],
];

const SLOTS = [
  [180,90],[180,200],[340,240],[460,240],[610,90],[610,220],[740,90],[890,260],[890,400],[700,500],[420,500],[260,500],[120,520],[420,400],[610,400]
];

const WAVE_PLAN = [
  [{type:'disciple',count:8,gap:800,delay:0}],
  [{type:'disciple',count:12,gap:600,delay:0}],
  [{type:'disciple',count:10,gap:500,delay:0},{type:'evangelist',count:4,gap:700,delay:6000}],
  [{type:'evangelist',count:10,gap:500,delay:0},{type:'zealot',count:3,gap:1200,delay:3000}],
  [{type:'zealot',count:5,gap:900,delay:0},{type:'demon',count:1,gap:0,delay:5000}],
  [{type:'evangelist',count:12,gap:400,delay:0},{type:'wraith',count:2,gap:1500,delay:3000}],
  [{type:'demon',count:3,gap:3500,delay:0},{type:'zealot',count:6,gap:600,delay:1500},{type:'wraith',count:2,gap:1500,delay:8000}],
  [{type:'wraith',count:5,gap:1200,delay:0},{type:'disciple',count:18,gap:300,delay:1000}],
  [{type:'evangelist',count:14,gap:280,delay:0},{type:'demon',count:4,gap:2500,delay:1000},{type:'zealot',count:8,gap:500,delay:8000}],
  [{type:'baron',count:1,gap:0,delay:0},{type:'demon',count:3,gap:2500,delay:5000},{type:'wraith',count:4,gap:1500,delay:7000},{type:'evangelist',count:14,gap:300,delay:11000}],
];

class Enemy {
  constructor(scene, type, path) {
    const def = ENEMY_DEFS[type];
    this.scene = scene;
    this.type = type;
    this.def = def;
    this.maxHp = def.hp;
    this.hp = def.hp;
    this.speed = def.speed;
    this.path = path;
    this.t = 0;
    this.alive = true;
    this.rooted = 0;
    this.slowMult = 1;
    this.shredMult = 1; // damage taken multiplier
    this.spawnTime = scene.time.now;
    this.lastPhaseChange = scene.time.now;
    this.phasing = false;
    const start = path.getPoint(0);
    this.gfx = scene.add.image(start.x, start.y, def.sprite).setDepth(6);
    const scale = (def.size*2) / 56;
    this.gfx.setScale(scale);
    this.baseScale = scale;
    this.hpBg = scene.add.rectangle(start.x - def.size, start.y - def.size - 6, def.size*2, 4, 0x1a1108).setOrigin(0,0.5).setDepth(7);
    this.hpBar = scene.add.rectangle(start.x - def.size, start.y - def.size - 6, def.size*2, 4, 0xff5544).setOrigin(0,0.5).setDepth(8);
    // wobble
    this.wobble = scene.tweens.add({ targets: this.gfx, angle: { from: -4, to: 4 }, duration: 280, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  takeDamage(d, source) {
    if (!this.alive) return;
    if (this.def.armor) d *= (1 - this.def.armor);
    d *= this.shredMult;
    this.hp -= d;
    // damage number
    this.scene.spawnDamageText(this.gfx.x, this.gfx.y - this.def.size, Math.round(d));
    if (d > 0) Audio.sfx.hit();
    // hit flash
    this.gfx.setTint(0xffffff);
    this.scene.time.delayedCall(80, ()=> this.alive && this.gfx.clearTint());
    if (this.hp <= 0) this.die(true);
  }
  knockback(amount){
    if (!this.alive) return;
    const back = amount / Math.max(1, this.path.getLength());
    this.t = Math.max(0, this.t - back);
  }
  die(killed) {
    if (!this.alive) return;
    this.alive = false;
    this.wobble && this.wobble.stop();
    if (killed) {
      this.scene.addBeans(this.def.bounty);
      this.scene.spawnPoof(this.gfx.x, this.gfx.y, 0xf0c987);
      Audio.sfx.enemyDie();
      // split mechanic
      if (this.def.splitInto) {
        for (let i=0; i<this.def.splitCount; i++) {
          const child = new Enemy(this.scene, this.def.splitInto, this.path);
          child.t = Math.max(0.01, this.t - 0.005 * i);
          this.scene.enemies.push(child);
        }
      }
    }
    this.gfx.destroy(); this.hpBar.destroy(); this.hpBg.destroy();
  }
  update(dt) {
    if (!this.alive) return;
    const now = this.scene.time.now;
    // phasing (wraith)
    if (this.def.phaseEvery && now - this.lastPhaseChange > (this.phasing ? this.def.phaseDur : this.def.phaseEvery)) {
      this.phasing = !this.phasing;
      this.lastPhaseChange = now;
      this.gfx.setAlpha(this.phasing ? 0.25 : 1);
    }
    // movement
    if (this.rooted > now) {
      // rooted, no move
    } else {
      const v = (this.speed * this.slowMult) / this.path.getLength();
      this.t += v * (dt/1000);
    }
    // regen
    if (this.def.regen) this.hp = Math.min(this.maxHp, this.hp + this.def.regen*(dt/1000));
    if (this.t >= 1) { this.scene.enemyReachedEnd(this); return; }
    const p = this.path.getPoint(this.t);
    this.gfx.setPosition(p.x, p.y);
    this.hpBg.setPosition(p.x - this.def.size, p.y - this.def.size - 6);
    this.hpBar.setPosition(p.x - this.def.size, p.y - this.def.size - 6);
    this.hpBar.width = this.def.size*2 * Math.max(0, this.hp/this.maxHp);
    // root tint
    if (this.rooted > now) this.gfx.setTint(0xaaccff);
    // reset auras for next frame
    this.slowMult = 1;
    this.shredMult = 1;
  }
  isTargetable(){ return this.alive && !this.phasing; }
}

class Tower {
  constructor(scene, slotIndex, x, y, type) {
    this.scene = scene;
    this.slotIndex = slotIndex;
    this.x = x; this.y = y;
    this.type = type;
    this.def = TOWER_DEFS[type];
    this.level = 1;
    this.dmg = this.def.dmg;
    this.range = this.def.range;
    this.fireRate = this.def.fireRate;
    this.lastFire = 0;
    this.totalSpent = this.def.cost;
    // glow base
    this.glow = scene.add.circle(x, y, 28, 0xf0c987, 0.15).setDepth(2);
    this.body = scene.add.image(x, y, this.def.sprite).setDepth(3).setDisplaySize(48, 48);
    this.rangeRing = scene.add.circle(x, y, this.range, 0xf0c987, 0.05).setStrokeStyle(1.5, 0xf0c987, 0.4).setDepth(2).setVisible(false);
    this.body.setInteractive({ useHandCursor: true, pixelPerfect: false });
    this.body.on('pointerdown', () => scene.openTowerActions(this));
    this.body.on('pointerover', () => this.rangeRing.setVisible(true));
    this.body.on('pointerout', () => this.rangeRing.setVisible(false));
    // idle bob
    scene.tweens.add({ targets: this.body, y: y - 2, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  update(dt) {
    const now = this.scene.time.now;
    if (this.def.aura || this.def.shred) {
      for (const e of this.scene.enemies) {
        if (!e.alive) continue;
        const dx=e.gfx.x-this.x, dy=e.gfx.y-this.y;
        if (dx*dx+dy*dy >= this.range*this.range) continue;
        if (this.def.aura) {
          if (e.def.slowImmuneMs && now - e.spawnTime < e.def.slowImmuneMs) continue;
          e.slowMult = Math.min(e.slowMult, this.def.slow);
        }
        if (this.def.shred) {
          // grinder still counts as a fire-rate ticker for visuals
          e.shredMult = Math.max(e.shredMult, 1 + this.def.shred);
        }
      }
      // grinder also does small dmg over time pulse via fireRate
      if (this.def.shred && now - this.lastFire >= this.fireRate) {
        this.lastFire = now;
        const t = this.findTarget();
        if (t) {
          Audio.sfx.grinder();
          // grind visual: short line to target
          const beam = this.scene.add.line(0,0,this.x,this.y,t.gfx.x,t.gfx.y,this.def.proj,1).setLineWidth(2).setOrigin(0).setDepth(7);
          this.scene.tweens.add({targets:beam,alpha:0,duration:200,onComplete:()=>beam.destroy()});
        }
      }
      return;
    }
    if (now - this.lastFire < this.fireRate) return;
    const target = this.findTarget();
    if (!target) return;
    this.lastFire = now;
    if (this.def.charge) {
      this.glow.setFillStyle(0xd97706, 0.4);
      Audio.sfx.espressoChg();
      this.scene.time.delayedCall(this.def.charge, () => {
        this.glow.setFillStyle(0xf0c987, 0.15);
        if (!this.scene.scene.isActive()) return;
        Audio.sfx.espressoFire();
        this.firePierce();
      });
    } else {
      const sfxKey = this.type === 'aeropress' ? 'aeropress' : (this.type === 'frother' ? 'frother' : (this.type === 'pourover' ? 'pourover' : 'drip'));
      Audio.sfx[sfxKey] && Audio.sfx[sfxKey]();
      this.fireProjectile(target);
    }
  }
  findTarget() {
    let best=null, bestT=-1;
    for (const e of this.scene.enemies) {
      if (!e.isTargetable()) continue;
      const dx=e.gfx.x-this.x, dy=e.gfx.y-this.y;
      if (dx*dx+dy*dy > this.range*this.range) continue;
      if (e.t > bestT) { bestT = e.t; best = e; }
    }
    return best;
  }
  fireProjectile(target) {
    // muzzle flash
    const flash = this.scene.add.circle(this.x, this.y, 12, 0xfff5d6, 0.8).setDepth(7);
    this.scene.tweens.add({targets:flash, scale:0.2, alpha:0, duration:120, onComplete:()=>flash.destroy()});
    // projectile
    const proj = this.scene.add.circle(this.x, this.y, 5, this.def.proj).setDepth(7);
    proj.setStrokeStyle(1, 0x1a1108);
    const dx=target.gfx.x-this.x, dy=target.gfx.y-this.y;
    const dist=Math.sqrt(dx*dx+dy*dy);
    const dur = Math.max(80, dist*1.8);
    this.scene.tweens.add({
      targets: proj, x: target.gfx.x, y: target.gfx.y, duration: dur,
      onComplete: ()=>{
        proj.destroy();
        if (!target.alive) return;
        if (this.def.root) target.rooted = this.scene.time.now + this.def.root;
        if (this.def.knockback) target.knockback(this.def.knockback);
        if (this.dmg>0) {
          target.takeDamage(this.dmg);
          this.scene.spawnSparks(target.gfx.x, target.gfx.y);
        }
        // splash (pour-over)
        if (this.def.splash) {
          Audio.sfx.splash();
          for (const e of this.scene.enemies) {
            if (e===target || !e.alive) continue;
            const ddx=e.gfx.x-target.gfx.x, ddy=e.gfx.y-target.gfx.y;
            if (ddx*ddx+ddy*ddy < this.def.splash*this.def.splash) e.takeDamage(this.dmg*0.5);
          }
          const ring = this.scene.add.circle(target.gfx.x, target.gfx.y, 8, 0xd97706, 0.4).setDepth(6);
          this.scene.tweens.add({targets:ring, radius: this.def.splash, alpha:0, duration:400, onUpdate:()=>ring.setRadius(ring.radius)});
          this.scene.tweens.add({targets:ring, scale: this.def.splash/8, alpha:0, duration:400, onComplete:()=>ring.destroy()});
        }
      }
    });
  }
  firePierce() {
    const target = this.findTarget();
    if (!target) return;
    const dx=target.gfx.x-this.x, dy=target.gfx.y-this.y;
    const ang=Math.atan2(dy,dx);
    const len=this.range+40;
    const ex=this.x+Math.cos(ang)*len, ey=this.y+Math.sin(ang)*len;
    const beam = this.scene.add.line(0,0, this.x,this.y, ex,ey, this.def.proj, 1).setLineWidth(8).setOrigin(0).setDepth(7);
    this.scene.tweens.add({ targets: beam, alpha: 0, duration: 320, onComplete:()=>beam.destroy() });
    this.scene.shake(120, 0.004);
    for (const e of this.scene.enemies) {
      if (!e.isTargetable()) continue;
      const d = distPointToSegment(e.gfx.x, e.gfx.y, this.x, this.y, ex, ey);
      if (d < 22) {
        e.takeDamage(this.dmg);
        this.scene.spawnSparks(e.gfx.x, e.gfx.y);
      }
    }
  }
  upgrade() {
    if (this.level >= 2) return false;
    const cost = Math.floor(this.def.cost * 1.5);
    if (!this.scene.spendBeans(cost)) return false;
    this.level = 2;
    this.dmg = Math.floor(this.dmg * 1.5);
    this.range = Math.floor(this.range * 1.15);
    this.totalSpent += cost;
    this.glow.setFillStyle(0xf0c987, 0.3);
    this.body.setDisplaySize(54, 54);
    this.rangeRing.setRadius(this.range);
    return true;
  }
  sell() {
    const refund = Math.floor(this.totalSpent * 0.6);
    this.scene.addBeans(refund);
    this.glow.destroy(); this.body.destroy(); this.rangeRing.destroy();
    this.scene.removeTower(this);
  }
}

function distPointToSegment(px,py, ax,ay, bx,by){
  const dx=bx-ax, dy=by-ay;
  const l2=dx*dx+dy*dy; if(!l2) return Math.hypot(px-ax,py-ay);
  let t=((px-ax)*dx+(py-ay)*dy)/l2; t=Math.max(0,Math.min(1,t));
  return Math.hypot(px-(ax+t*dx), py-(ay+t*dy));
}

class GameScene extends Phaser.Scene {
  constructor(){ super('Game'); }
  preload(){
    const SVGS = [
      ['t_drip','assets/tower-drip.png',64],
      ['t_espresso','assets/tower-espresso.png',64],
      ['t_frother','assets/tower-frother.png',64],
      ['t_cold','assets/tower-cold.png',64],
      ['t_grinder','assets/tower-grinder.png',64],
      ['t_pourover','assets/tower-pourover.png',64],
      ['t_aeropress','assets/tower-aeropress.png',64],
      ['e_disciple','assets/enemy-disciple.png',56],
      ['e_evangelist','assets/enemy-evangelist.png',56],
      ['e_demon','assets/enemy-demon.png',64],
      ['e_zealot','assets/enemy-zealot.png',56],
      ['e_wraith','assets/enemy-wraith.png',56],
      ['e_baron','assets/enemy-baron.png',72],
      ['bean','assets/bean.png',16],
      ['barista','assets/barista.png',96],
    ];
    for (const [k,u,s] of SVGS) this.load.image(k, u);
  }
  create(){
    window.scene = this;
    this.cameras.main.setBackgroundColor('#2b1d12');
    // background grain
    const bg = this.add.graphics().setDepth(0);
    bg.fillStyle(0x3d2817,1); bg.fillRect(0,0,W,H);
    for (let i=0;i<200;i++){ bg.fillStyle(0x2b1d12,0.3); bg.fillCircle(Math.random()*W,Math.random()*H,Math.random()*1.5+0.3); }
    // path
    this.path = new Phaser.Curves.Path(PATH_PTS[0][0], PATH_PTS[0][1]);
    for (let i=1;i<PATH_PTS.length;i++) this.path.lineTo(PATH_PTS[i][0], PATH_PTS[i][1]);
    const g = this.add.graphics().setDepth(1);
    g.lineStyle(40, 0x1a1108, 0.5); this.path.draw(g);
    g.lineStyle(34, 0x6b4423, 1); this.path.draw(g);
    g.lineStyle(28, 0x8b5a2b, 1); this.path.draw(g);
    g.lineStyle(2, 0xa07842, 0.6); this.path.draw(g);
    // the barista (player avatar at end of path)
    const last = PATH_PTS[PATH_PTS.length-1];
    this.barista = this.add.image(last[0]-50, last[1]-10, 'barista').setDepth(2).setDisplaySize(96,120);
    this.tweens.add({ targets: this.barista, scale: { from: 0.8, to: 0.84 }, duration: 1800, yoyo:true, repeat:-1, ease:'Sine.easeInOut' });
    // slots
    this.slots = SLOTS.map(([x,y], i)=>{
      const ring = this.add.circle(x, y, 18, 0x000000, 0.35).setStrokeStyle(2, 0xf0c987, 0.7).setDepth(2);
      const dot = this.add.circle(x, y, 4, 0xf0c987, 0.8).setDepth(2);
      ring.setInteractive({ useHandCursor: true });
      ring.on('pointerdown', ()=> this.openTowerPicker(i));
      ring.on('pointerover', ()=> { ring.setStrokeStyle(2, 0xfff5d6, 1); dot.setFillStyle(0xfff5d6,1);});
      ring.on('pointerout', ()=> { ring.setStrokeStyle(2, 0xf0c987, 0.7); dot.setFillStyle(0xf0c987,0.8);});
      return { x, y, idx:i, ring, dot, tower:null };
    });

    this.enemies = [];
    this.towers = [];
    this.beans = 250;
    this.hp = 20;
    this.wave = 0;
    this.maxWaves = WAVE_PLAN.length;
    this.spawning = false;
    this.waveActive = false;
    this.gameOver = false;
    this.perfectShotReady = true;
    this.perfectShotArmed = false;
    this.perfectShotCdEnd = 0;

    // particle textures (simple white circle for blending)
    const pgfx = this.add.graphics();
    pgfx.fillStyle(0xffffff, 1).fillCircle(8, 8, 8);
    pgfx.generateTexture('p_dot', 16, 16);
    pgfx.destroy();

    this.updateHUD();
    this.bindDOM();
    showOverlay('Grounds for Defense','Bad coffee marches on the Barista: stale beans, pre-ground bags, reheated milk, watery weak cups, burnt charcoal beans, and the K-Pod Tyrant himself. Defend the counter.\n\n© 2026 Kanen Coffee, LLC. All Rights Reserved.','Begin', ()=>{ hideOverlay(); Audio.ensureCtx && Audio.ensureCtx(); Audio.startMusic && Audio.startMusic(); });

    this.input.on('pointerdown', (p)=>{
      if (!this.perfectShotArmed) return;
      let best=null, bestD=50*50;
      for(const e of this.enemies){
        if(!e.alive) continue;
        const dx=e.gfx.x-p.worldX, dy=e.gfx.y-p.worldY;
        const d=dx*dx+dy*dy; if(d<bestD){bestD=d; best=e;}
      }
      if (best){
        best.takeDamage(500);
        Audio.sfx.perfectShot();
        this.shake(280, 0.012);
        const ring = this.add.circle(best.gfx.x,best.gfx.y,10,0xf0c987).setDepth(8);
        this.tweens.add({targets:ring, scale:8, alpha:0, duration:500, onComplete:()=>ring.destroy()});
        this.spawnPoof(best.gfx.x, best.gfx.y, 0xfff5d6);
        this.perfectShotArmed = false;
        this.perfectShotReady = false;
        this.perfectShotCdEnd = this.time.now + 45000;
        document.getElementById('ability-btn').classList.remove('armed');
        this.updateHUD();
      }
    });
  }
  shake(dur, intensity){ this.cameras.main.shake(dur, intensity); }
  spawnPoof(x,y,color){
    const parts = this.add.particles(x, y, 'p_dot', {
      speed: { min: 60, max: 180 }, lifespan: 500, scale: { start: 0.6, end: 0 },
      tint: color, quantity: 12, blendMode: 'ADD', emitting: false
    }).setDepth(8);
    parts.explode(12);
    this.time.delayedCall(600, ()=>parts.destroy());
  }
  spawnSparks(x,y){
    const parts = this.add.particles(x, y, 'p_dot', {
      speed: { min: 30, max: 100 }, lifespan: 200, scale: { start: 0.3, end: 0 },
      tint: 0xfff5d6, quantity: 4, blendMode: 'ADD', emitting: false
    }).setDepth(8);
    parts.explode(4);
    this.time.delayedCall(300, ()=>parts.destroy());
  }
  spawnDamageText(x,y,d){
    const t = this.add.text(x + (Math.random()*16-8), y, String(d), { fontSize:'14px', fontStyle:'bold', color:'#fff5d6', stroke:'#1a1108', strokeThickness:3 }).setOrigin(0.5).setDepth(9);
    this.tweens.add({ targets:t, y: y-22, alpha:0, duration:600, onComplete:()=>t.destroy() });
  }
  bindDOM(){
    document.getElementById('start-wave').onclick = ()=> this.startNextWave();
    document.getElementById('ability-btn').onclick = ()=>{
      if (!this.perfectShotReady) return;
      this.perfectShotArmed = !this.perfectShotArmed;
      document.getElementById('ability-btn').classList.toggle('armed', this.perfectShotArmed);
    };
    document.querySelectorAll('#tower-picker [data-tower]').forEach(b=>{
      b.onclick = ()=> this.placeTower(b.dataset.tower);
    });
    document.querySelectorAll('.picker .cancel').forEach(b=>{
      b.onclick = ()=> { hide('tower-picker'); hide('tower-actions'); this.pendingSlot=null; this.selectedTower=null; };
    });
    document.getElementById('upgrade-btn').onclick = ()=> {
      if (this.selectedTower){ if(this.selectedTower.upgrade()) Audio.sfx.upgrade(); else Audio.sfx.error(); this.updateHUD(); hide('tower-actions'); }
    };
    document.getElementById('sell-btn').onclick = ()=> {
      if (this.selectedTower){ this.selectedTower.sell(); Audio.sfx.sell(); this.updateHUD(); hide('tower-actions'); }
    };
    document.getElementById('mute-btn').onclick = ()=> {
      const newMuted = !Audio.isMuted();
      Audio.setMute(newMuted);
      document.getElementById('mute-btn').textContent = newMuted ? '🔇' : '🔊';
      if (!newMuted) Audio.startMusic();
    };
  }
  openTowerPicker(slotIdx){
    const slot = this.slots[slotIdx];
    if (slot.tower){ this.openTowerActions(slot.tower); return; }
    this.pendingSlot = slotIdx;
    // update picker affordability
    document.querySelectorAll('#tower-picker [data-tower]').forEach(b=>{
      const def = TOWER_DEFS[b.dataset.tower];
      b.disabled = this.beans < def.cost;
    });
    show('tower-picker');
  }
  openTowerActions(tower){
    this.selectedTower = tower;
    document.getElementById('tower-info').textContent = `${tower.def.name} L${tower.level} — ${tower.def.blurb}`;
    document.getElementById('upgrade-btn').textContent = tower.level>=2 ? 'Maxed' : `Upgrade (${Math.floor(tower.def.cost*1.5)}¢)`;
    document.getElementById('upgrade-btn').disabled = tower.level>=2 || this.beans < Math.floor(tower.def.cost*1.5);
    document.getElementById('sell-btn').textContent = `Sell (+${Math.floor(tower.totalSpent*0.6)}¢)`;
    show('tower-actions');
  }
  placeTower(type){
    const def = TOWER_DEFS[type];
    if (this.beans < def.cost){ flash(); Audio.sfx.error(); return; }
    const slot = this.slots[this.pendingSlot];
    this.beans -= def.cost;
    const t = new Tower(this, slot.idx, slot.x, slot.y, type);
    this.towers.push(t);
    slot.tower = t;
    slot.ring.setVisible(false); slot.dot.setVisible(false);
    hide('tower-picker');
    this.updateHUD();
    Audio.sfx.place();
    // place poof
    this.spawnPoof(slot.x, slot.y, 0xf0c987);
  }
  removeTower(t){
    const slot = this.slots[t.slotIndex];
    slot.tower = null; slot.ring.setVisible(true); slot.dot.setVisible(true);
    this.towers = this.towers.filter(x=>x!==t);
  }
  startNextWave(){
    if (this.spawning || this.waveActive || this.gameOver) return;
    if (this.wave >= this.maxWaves) return;
    this.wave++;
    Audio.sfx.waveStart();
    Audio.startMusic(this.wave);
    const plan = WAVE_PLAN[this.wave-1];
    this.spawning = true; this.waveActive = true;
    let pending = plan.length;
    plan.forEach(group=>{
      this.time.delayedCall(group.delay, ()=>{
        let i=0;
        if (group.count===1){
          this.spawnEnemy(group.type);
          if(--pending===0) this.spawning=false;
          return;
        }
        this.time.addEvent({
          delay: group.gap, repeat: group.count-1,
          callback: ()=>{
            this.spawnEnemy(group.type);
            i++;
            if (i>=group.count){ if(--pending===0) this.spawning=false; }
          }
        });
      });
    });
    this.updateHUD();
  }
  spawnEnemy(type){
    this.enemies.push(new Enemy(this, type, this.path));
  }
  enemyReachedEnd(e){
    e.die(false);
    this.hp = Math.max(0, this.hp - 1);
    this.shake(150, 0.008);
    this.cameras.main.flash(120, 200, 30, 30);
    Audio.sfx.enemyReachEnd();
    this.updateHUD();
    if (this.hp<=0) this.lose();
  }
  addBeans(n){ this.beans+=n; this.updateHUD(); }
  spendBeans(n){ if(this.beans<n) return false; this.beans-=n; this.updateHUD(); return true; }
  updateHUD(){
    document.getElementById('hud-beans').textContent = this.beans;
    document.getElementById('hud-wave').textContent = `${this.wave} / ${this.maxWaves}`;
    document.getElementById('hud-hp').textContent = this.hp;
    const btn=document.getElementById('start-wave');
    btn.disabled = this.spawning || this.waveActive || this.gameOver || this.wave>=this.maxWaves;
    btn.textContent = this.wave===0 ? 'Start Wave' : (this.waveActive ? 'Wave Active' : (this.wave>=this.maxWaves?'Done':'Next Wave'));
  }
  win(){ this.gameOver=true; Audio.sfx.win(); Audio.stopMusic(); this.cameras.main.flash(600, 240, 200, 100); showOverlay('☕ The Counter Holds!','You crushed the K-Pod Tyrant. The Barista lives to pull another shot. Specialty coffee endures.','Play Again',()=>location.reload()); }
  lose(){ this.gameOver=true; Audio.sfx.lose(); Audio.stopMusic(); this.cameras.main.flash(600, 30, 30, 30); showOverlay('💀 The Barista Falls','Bad coffee overran the counter. The world drinks brown water now. Try again?','Retry',()=>location.reload()); }
  update(time, dt){
    if (this.gameOver) return;
    for (const t of this.towers) t.update(dt);
    for (const e of this.enemies) e.update(dt);
    this.enemies = this.enemies.filter(e=>e.alive);
    if (this.waveActive && !this.spawning && this.enemies.length===0){
      this.waveActive = false;
      this.addBeans(30 + this.wave*5);
      if (this.wave >= this.maxWaves) this.win(); else Audio.sfx.waveClear();
      this.updateHUD();
    }
    if (!this.perfectShotReady && time >= this.perfectShotCdEnd){
      this.perfectShotReady = true;
      document.getElementById('ability-btn').textContent = '☕ Perfect Shot';
    } else if (!this.perfectShotReady) {
      const s = Math.ceil((this.perfectShotCdEnd-time)/1000);
      document.getElementById('ability-btn').textContent = `☕ Perfect Shot (${s}s)`;
    }
  }
}

function show(id){ document.getElementById(id).classList.remove('hidden'); }
function hide(id){ document.getElementById(id).classList.add('hidden'); }
function showOverlay(title, msg, btnText, cb){
  document.getElementById('overlay-title').textContent = title;
  document.getElementById('overlay-msg').textContent = msg;
  const b = document.getElementById('overlay-btn');
  b.textContent = btnText;
  b.onclick = ()=>{ hide('overlay'); cb && cb(); };
  show('overlay');
}
function hideOverlay(){ hide('overlay'); }
function flash(){
  const t = document.getElementById('hud-beans');
  const orig = t.style.color; t.style.color='#ff6b6b';
  setTimeout(()=>{t.style.color=orig;},400);
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W, height: H,
  backgroundColor: '#2b1d12',
  scene: [GameScene],
});
