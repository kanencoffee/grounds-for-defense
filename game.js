// Grounds for Defense — Phaser MVP
const W = 1024, H = 640;

const TOWER_DEFS = {
  drip:     { name:'Drip',     cost:50,  range:130, dmg:6,   fireRate:220, color:0x8b5a2b, proj:0xf5e8d6 },
  espresso: { name:'Espresso', cost:150, range:240, dmg:60,  fireRate:1800,color:0x4a2c14, proj:0xd97706, charge:1500, pierce:true },
  frother:  { name:'Frother',  cost:75,  range:140, dmg:0,   fireRate:1200,color:0xf5e8d6, proj:0xffffff, root:2000 },
  cold:     { name:'Cold Brew',cost:100, range:130, dmg:0,   fireRate:0,   color:0x4a6fa5, proj:0x88bbee, slow:0.6, aura:true },
};

const ENEMY_DEFS = {
  disciple:   { hp:30,  speed:42, color:0xc9a77a, bounty:5,  size:14 },
  evangelist: { hp:20,  speed:80, color:0x9bc46f, bounty:8,  size:13, slowImmuneMs:3000 },
  demon:      { hp:120, speed:24, color:0x6f5b9b, bounty:20, size:20 },
  baron:      { hp:500, speed:30, color:0x8b3a3a, bounty:200,size:26, regen:4, armor:0.3 },
};

// Path waypoints (zigzag)
const PATH_PTS = [
  [-20,140],[260,140],[260,300],[540,300],[540,160],[820,160],[820,440],[180,440],[180,560],[1044,560],
];

// Tower slots (x,y) — placed beside path
const SLOTS = [
  [180,90],[180,200],[340,240],[460,240],[610,90],[610,220],[740,90],[890,260],[890,400],[700,500],[420,500],[260,500],[120,640-90],[420,400],[610,400]
];

const WAVE_PLAN = [
  // wave: array of {type, count, gap, delay}
  [{type:'disciple',count:8,gap:800,delay:0}],
  [{type:'disciple',count:12,gap:600,delay:0}],
  [{type:'disciple',count:10,gap:500,delay:0},{type:'evangelist',count:4,gap:700,delay:6000}],
  [{type:'evangelist',count:10,gap:500,delay:0}],
  [{type:'disciple',count:14,gap:450,delay:0},{type:'demon',count:1,gap:0,delay:5000}],
  [{type:'evangelist',count:12,gap:400,delay:0},{type:'disciple',count:6,gap:500,delay:3000}],
  [{type:'demon',count:3,gap:3500,delay:0},{type:'disciple',count:14,gap:380,delay:1500}],
  [{type:'disciple',count:18,gap:350,delay:0},{type:'evangelist',count:8,gap:450,delay:2000}],
  [{type:'evangelist',count:14,gap:280,delay:0},{type:'demon',count:4,gap:2500,delay:1000},{type:'disciple',count:10,gap:300,delay:8000}],
  [{type:'baron',count:1,gap:0,delay:0},{type:'demon',count:3,gap:2500,delay:5000},{type:'evangelist',count:10,gap:400,delay:8000}],
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
    this.baseSpeed = def.speed;
    this.path = path;
    this.t = 0; // 0..1 along path
    this.alive = true;
    this.rooted = 0; this.rootedSource = 0;
    this.slowMult = 1;
    this.spawnTime = scene.time.now;
    const start = path.getPoint(0);
    this.gfx = scene.add.circle(start.x, start.y, def.size, def.color).setStrokeStyle(2, 0x1a1108);
    this.hpBar = scene.add.rectangle(start.x - def.size, start.y - def.size - 6, def.size*2, 4, 0xff4444).setOrigin(0,0.5);
    this.hpBg = scene.add.rectangle(start.x - def.size, start.y - def.size - 6, def.size*2, 4, 0x1a1108).setOrigin(0,0.5);
    this.hpBg.setDepth(4); this.hpBar.setDepth(5); this.gfx.setDepth(6);
  }
  takeDamage(d) {
    if (!this.alive) return;
    if (this.def.armor) d *= (1 - this.def.armor);
    this.hp -= d;
    if (this.hp <= 0) this.die(true);
  }
  die(killed) {
    this.alive = false;
    if (killed) this.scene.addBeans(this.def.bounty);
    this.gfx.destroy(); this.hpBar.destroy(); this.hpBg.destroy();
  }
  update(dt) {
    if (!this.alive) return;
    // root
    if (this.rooted > this.scene.time.now) {
      // skip movement
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
    // visual root tint
    this.gfx.setStrokeStyle(2, this.rooted > this.scene.time.now ? 0xffffff : 0x1a1108);
    // reset slow for next frame; auras re-apply
    this.slowMult = 1;
  }
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
    this.charging = false;
    this.totalSpent = this.def.cost;
    const c = this.def.color;
    this.body = scene.add.circle(x, y, 18, c).setStrokeStyle(2, 0x1a1108).setDepth(3);
    this.label = scene.add.text(x, y, this.def.name[0], {fontSize:'16px', color:'#1a1108', fontStyle:'bold'}).setOrigin(0.5).setDepth(4);
    this.rangeRing = scene.add.circle(x, y, this.range, c, 0.08).setStrokeStyle(1, c, 0.3).setDepth(2).setVisible(false);
    this.body.setInteractive({ useHandCursor: true });
    this.body.on('pointerdown', () => scene.openTowerActions(this));
    this.body.on('pointerover', () => this.rangeRing.setVisible(true));
    this.body.on('pointerout', () => this.rangeRing.setVisible(false));
  }
  update(dt) {
    const now = this.scene.time.now;
    if (this.def.aura) {
      // Cold Brew: slow all enemies in range
      for (const e of this.scene.enemies) {
        if (!e.alive) continue;
        if (e.def.slowImmuneMs && now - e.spawnTime < e.def.slowImmuneMs) continue;
        const dx=e.gfx.x-this.x, dy=e.gfx.y-this.y;
        if (dx*dx+dy*dy < this.range*this.range) e.slowMult = Math.min(e.slowMult, this.def.slow);
      }
      return;
    }
    if (now - this.lastFire < this.fireRate) return;
    const target = this.findTarget();
    if (!target) return;
    this.lastFire = now;
    if (this.def.charge) {
      // Espresso: charge then pierce line
      this.body.setFillStyle(0xd97706);
      this.scene.time.delayedCall(this.def.charge, () => {
        this.body.setFillStyle(this.def.color);
        if (!this.scene.scene.isActive()) return;
        this.firePierce();
      });
    } else {
      this.fireProjectile(target);
    }
  }
  findTarget() {
    let best=null, bestT=-1;
    for (const e of this.scene.enemies) {
      if (!e.alive) continue;
      const dx=e.gfx.x-this.x, dy=e.gfx.y-this.y;
      if (dx*dx+dy*dy > this.range*this.range) continue;
      if (e.t > bestT) { bestT = e.t; best = e; }
    }
    return best;
  }
  fireProjectile(target) {
    const proj = this.scene.add.circle(this.x, this.y, 5, this.def.proj).setDepth(7);
    const dx=target.gfx.x-this.x, dy=target.gfx.y-this.y;
    const dist=Math.sqrt(dx*dx+dy*dy);
    const dur = Math.max(80, dist*2);
    this.scene.tweens.add({
      targets: proj, x: target.gfx.x, y: target.gfx.y, duration: dur,
      onUpdate: ()=>{ if(target.alive){ proj.x = proj.x; } },
      onComplete: ()=>{
        proj.destroy();
        if (this.def.root && target.alive) {
          target.rooted = this.scene.time.now + this.def.root;
        }
        if (this.dmg>0 && target.alive) target.takeDamage(this.dmg);
      }
    });
  }
  firePierce() {
    // line from tower in direction of furthest target along path within range
    const target = this.findTarget();
    if (!target) return;
    const dx=target.gfx.x-this.x, dy=target.gfx.y-this.y;
    const ang=Math.atan2(dy,dx);
    const len=this.range+40;
    const ex=this.x+Math.cos(ang)*len, ey=this.y+Math.sin(ang)*len;
    const beam = this.scene.add.line(0,0, this.x,this.y, ex,ey, this.def.proj, 1).setLineWidth(6).setOrigin(0).setDepth(7);
    this.scene.tweens.add({ targets: beam, alpha: 0, duration: 280, onComplete:()=>beam.destroy() });
    // hit all enemies near the line
    for (const e of this.scene.enemies) {
      if (!e.alive) continue;
      const d = distPointToSegment(e.gfx.x, e.gfx.y, this.x, this.y, ex, ey);
      if (d < 18) e.takeDamage(this.dmg);
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
    this.body.setStrokeStyle(3, 0xf0c987);
    this.rangeRing.setRadius(this.range);
    return true;
  }
  sell() {
    const refund = Math.floor(this.totalSpent * 0.6);
    this.scene.addBeans(refund);
    this.body.destroy(); this.label.destroy(); this.rangeRing.destroy();
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
  create(){
    window.scene = this;
    this.cameras.main.setBackgroundColor('#3d2817');
    // build path
    this.path = new Phaser.Curves.Path(PATH_PTS[0][0], PATH_PTS[0][1]);
    for (let i=1;i<PATH_PTS.length;i++) this.path.lineTo(PATH_PTS[i][0], PATH_PTS[i][1]);
    // draw path
    const g = this.add.graphics().setDepth(1);
    g.lineStyle(36, 0x6b4423, 1); this.path.draw(g);
    g.lineStyle(28, 0x8b5a2b, 1); this.path.draw(g);
    // sacred roaster (end)
    const last = PATH_PTS[PATH_PTS.length-1];
    this.add.rectangle(last[0]-30, last[1], 70, 90, 0xd4a574).setStrokeStyle(3, 0xf0c987).setDepth(2);
    this.add.text(last[0]-30, last[1], '☕', {fontSize:'42px'}).setOrigin(0.5).setDepth(3);
    // slots
    this.slots = SLOTS.map(([x,y], i)=>{
      const c = this.add.circle(x, y, 14, 0x1a1108, 0.4).setStrokeStyle(2, 0xf0c987, 0.6).setDepth(2);
      c.setInteractive({ useHandCursor: true });
      c.on('pointerdown', ()=> this.openTowerPicker(i));
      return { x, y, idx:i, gfx:c, tower:null };
    });

    this.enemies = [];
    this.towers = [];
    this.beans = 200;
    this.hp = 20;
    this.wave = 0;
    this.maxWaves = WAVE_PLAN.length;
    this.spawning = false;
    this.waveActive = false;
    this.gameOver = false;
    this.perfectShotReady = true;
    this.perfectShotArmed = false;
    this.perfectShotCdEnd = 0;

    this.updateHUD();
    this.bindDOM();

    // overlay welcome
    showOverlay('Grounds for Defense', 'Click a slot to place a tower. Drip is cheap and reliable. Defend the Sacred Roaster from the Decaf Cult!', 'Begin', ()=>hideOverlay());

    // global click for perfect shot
    this.input.on('pointerdown', (p, targets)=>{
      if (!this.perfectShotArmed) return;
      // find nearest enemy to click
      let best=null, bestD=40*40;
      for(const e of this.enemies){
        if(!e.alive) continue;
        const dx=e.gfx.x-p.worldX, dy=e.gfx.y-p.worldY;
        const d=dx*dx+dy*dy;
        if(d<bestD){bestD=d; best=e;}
      }
      if (best){
        best.takeDamage(500);
        const ring = this.add.circle(best.gfx.x,best.gfx.y,8,0xf0c987).setDepth(8);
        this.tweens.add({targets:ring, scale:6, alpha:0, duration:400, onComplete:()=>ring.destroy()});
        this.perfectShotArmed = false;
        this.perfectShotReady = false;
        this.perfectShotCdEnd = this.time.now + 45000;
        document.getElementById('ability-btn').classList.remove('armed');
        this.updateHUD();
      }
    });
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
      if (this.selectedTower){ this.selectedTower.upgrade(); this.updateHUD(); hide('tower-actions'); }
    };
    document.getElementById('sell-btn').onclick = ()=> {
      if (this.selectedTower){ this.selectedTower.sell(); this.updateHUD(); hide('tower-actions'); }
    };
  }
  openTowerPicker(slotIdx){
    const slot = this.slots[slotIdx];
    if (slot.tower){ this.openTowerActions(slot.tower); return; }
    this.pendingSlot = slotIdx;
    show('tower-picker');
  }
  openTowerActions(tower){
    this.selectedTower = tower;
    document.getElementById('upgrade-btn').textContent = tower.level>=2 ? 'Maxed' : `Upgrade (${Math.floor(tower.def.cost*1.5)}¢)`;
    document.getElementById('upgrade-btn').disabled = tower.level>=2;
    document.getElementById('sell-btn').textContent = `Sell (+${Math.floor(tower.totalSpent*0.6)}¢)`;
    show('tower-actions');
  }
  placeTower(type){
    const def = TOWER_DEFS[type];
    if (this.beans < def.cost){ flash('Not enough beans!'); return; }
    const slot = this.slots[this.pendingSlot];
    this.beans -= def.cost;
    const t = new Tower(this, slot.idx, slot.x, slot.y, type);
    this.towers.push(t);
    slot.tower = t;
    slot.gfx.setVisible(false);
    hide('tower-picker');
    this.updateHUD();
  }
  removeTower(t){
    const slot = this.slots[t.slotIndex];
    slot.tower = null; slot.gfx.setVisible(true);
    this.towers = this.towers.filter(x=>x!==t);
  }
  startNextWave(){
    if (this.spawning || this.waveActive || this.gameOver) return;
    if (this.wave >= this.maxWaves) return;
    this.wave++;
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
        const ev = this.time.addEvent({
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
    btn.textContent = this.wave===0 ? 'Start Wave' : (this.waveActive ? 'Wave Active...' : (this.wave>=this.maxWaves?'Done':'Next Wave'));
  }
  win(){ this.gameOver=true; showOverlay('☕ The Brew is Saved!','You defeated the Decaf Baron and protected the Sacred Roaster. The world will know the taste of joy.','Play Again',()=>location.reload()); }
  lose(){ this.gameOver=true; showOverlay('💀 The Roaster Goes Cold','The Decaf Cult has won. Flavor is lost. Try again?','Retry',()=>location.reload()); }
  update(time, dt){
    if (this.gameOver) return;
    for (const t of this.towers) t.update(dt);
    for (const e of this.enemies) e.update(dt);
    this.enemies = this.enemies.filter(e=>e.alive);
    if (this.waveActive && !this.spawning && this.enemies.length===0){
      this.waveActive = false;
      this.addBeans(25);
      if (this.wave >= this.maxWaves) this.win();
      this.updateHUD();
    }
    // ability cooldown
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
function flash(msg){
  const t = document.getElementById('hud-beans');
  const orig = t.style.color; t.style.color='#ff6b6b';
  setTimeout(()=>{t.style.color=orig;},400);
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W, height: H,
  backgroundColor: '#3d2817',
  scene: [GameScene],
});
