// 14-1 신수의 부름 in the meadow (habitat.js makes it, ui/myth.js drives it: set(stage, lit, wait)). The faint fire prints at the
// board's far edge, the burnt hoofprints round a campfire, the altar's flames, and the 불갈기 천리마 once it came: it wanders and
// trots, lies down by the altar at night, rears now and then (mane flared), runs a lap of the meadow in the morning
// with the horses after it (fire hoofprints that fade behind it), steams in the rain; friends come and stand round it.
// cut(): its coming, ≤10 s (down from the sky onto the altar, a landing, a rear); a tap or skip() ends it.
import * as THREE from 'three';
import { loadMyth, makeMyth, MS, dot } from '../animals/mythic.js';
import { loadModel, makeFigure } from '../animals/figure.js'; // 158
import { SP } from '../game/rules.js';
import { blocked, free } from '../animals/crowd.js';
import { blobSlot } from '../animals/walk.js';
import { hourNow } from './daylight.js';
import { calm } from '../config.js';
import { sfx, toy } from '../ui/sound.js';
import { MYTH_FAM } from '../ui/toy-sound.js';

const lay = g => g.rotateX(-Math.PI / 2);
const HOOF = lay(new THREE.RingGeometry(0.17, 0.34, 18, 1, Math.PI + 0.55, Math.PI * 2 - 1.1)), SPOT = lay(new THREE.CircleGeometry(0.13, 10)); // a hoofprint: its heel open behind
const flat = (color, opacity, add) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, ...add && { blending: THREE.AdditiveBlending } });
const smooth = k => (k = Math.min(1, Math.max(0, k))) * k * (3 - 2 * k), wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const SPD = { walk: 2.2, trot: 3.8, run: 7.5 }, CYC = { walk: 3.4, trot: 3.6, run: 6 }; // m/s, m a stride
const L = MS.legs, S = MS.s, FEET = [[L.x[0], L.z], [L.x[1], -L.z], [L.x[0], -L.z], [L.x[1], L.z]].map(([x, z]) => [x * S, z * S]);

export function mythLayer({ scene, ctx, U, ui, open, nearest, gather, idle, placed, room, view, puff }) {
  const { heightAt, walkable, pathClear } = ctx, up = new THREE.Vector3(0, 1, 0), gp = new THREE.Plane(), at = new THREE.Vector3();
  const of = id => [...placed.values()].find(e => e.prop === id), save = ([x, z]) => [+(x / U).toFixed(4), +(z / U).toFixed(4)];
  const inBoard = (x, z) => x > open[0] + 4 && x < open[1] - 4 && z > open[2] + 4 && z < open[3] - 4;
  // a trail of prints, left right left, each along its way
  const steps = (x, z, yaw, n, step, bend) => { const o = []; for (let i = 0; i < n; i++) { const s = i % 2 ? 0.36 : -0.36;
    o.push([x + Math.sin(yaw) * s, z + Math.cos(yaw) * s, yaw]); x += Math.cos(yaw) * step; z -= Math.sin(yaw) * step; yaw += bend; } return o; };
  const trail = (pts, parts) => { const g = new THREE.Group(); g.userData.pts = pts = pts.filter(([x, z]) => walkable(x, z));
    for (const [x, z, yaw] of pts) for (const [geo, m, r] of parts) { const o = new THREE.Mesh(geo, m); o.position.set(x, heightAt(x, z) + 0.05, z); o.rotation.y = yaw; o.renderOrder = r; g.add(o); }
    scene.add(g); return g; };
  const faint = [flat('#6b4326', 0.28), flat('#ff8a2a', 0.4, true)], burnt = [flat('#2a1810', 0.8), flat('#ff6a1a', 0.6, true)];
  let prints = null, trace = null, traceAt = '';
  // fire hoofprints behind it when it runs: 24 in one draw, additive (black: gone)
  const fx = new THREE.InstancedMesh(HOOF, flat('#ffffff', 0.9, true), 24), fxT = new Float32Array(24).fill(9), fxL = new Float32Array(24).fill(3.5), o3 = new THREE.Object3D(), col = new THREE.Color(); let fxI = 0;
  fx.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(72), 3); fx.frustumCulled = false; fx.renderOrder = 2; scene.add(fx);
  const stamp = (x, z, yaw, life = 3.5) => { fxI = (fxI + 1) % 24; fxT[fxI] = 0; fxL[fxI] = life; o3.position.set(x, heightAt(x, z) + 0.05, z); o3.rotation.set(0, yaw, 0); o3.updateMatrix(); fx.setMatrixAt(fxI, o3.matrix); fx.instanceMatrix.needsUpdate = true; }; // life: s till it fades (157 C ?m89: a walking step's ember, brief)

  // ---- the 신수 ----
  let F = null, me = null, solid = [], steam = null, stage = null, lit = 0, wait = false, cutS = null, lapped = false, loading = null;
  const body = { x: 0, z: 0, yaw: 0, r: MS.r, seg: MS.seg }, sh = new THREE.Object3D(); sh.rotation.x = -Math.PI / 2; let blob = null;
  const beside = (x, z, d) => nearest((px, pz) => walkable(px, pz) && free(ctx.crowd, body, px, pz) && Math.hypot(px - x, pz - z) > d, [x + d * 0.7, z + d * 0.7]);
  const homeAt = () => { const A = of('myth_altar'); return A ? beside(A.spot.x, A.spot.z, 3.6) : beside((open[0] + open[1]) / 2, (open[2] + open[3]) / 2, 0); };
  const retry = () => setTimeout(() => { loading = null; }, 3e4); // 168: a failed load (offline) is forgotten after 30 s, so a later one asks again (ui/myth.js asks every 0.8 s)
  const spawn = () => loading ??= loadMyth().then(() => {
    F = makeMyth(); F.obj.rotation.order = 'YXZ'; F.obj.visible = false; scene.add(F.obj); F.obj.traverse(o => { if (o.isMesh && !o.material.transparent) solid.push(o); });
    const N = 14, pos = new Float32Array(N * 3), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); // 14-1: steam off its back in the rain
    steam = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.3, map: dot('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)'), transparent: true, depthWrite: false, opacity: 0 }));
    steam.frustumCulled = false; steam.userData.seed = Array.from({ length: N }, () => [Math.random(), -1.6 + 3 * Math.random(), (Math.random() - 0.5) * 0.9]); F.obj.add(steam);
    blob = blobSlot(scene); const [x, z] = homeAt(); me = { x, z, yaw: -0.6, st: 'stand', t: 0, dur: 2, ph: 0, rear: 0, lie: 0, pk: 0, gait: 'still', callAt: 20, stuck: 0, step: 0 }; place();
  });
  const place = () => { Object.assign(body, { x: me.x, z: me.z, yaw: me.yaw }); F.obj.position.set(me.x, heightAt(me.x, me.z), me.z); F.obj.rotation.y = me.yaw; };
  const shown = () => !!F && (cutS || (stage === 'guest' || stage === 'home') && !wait);
  const stand = (a, b) => Object.assign(me, { st: 'stand', t: 0, dur: a + Math.random() * (b - a), gait: 'still' });
  const go = (x, z, gait, then = null) => Object.assign(me, { st: 'go', tx: x, tz: z, gait, then, t: 0, stuck: 0 });
  function think(t) {
    if (ctx.night > 0.6) { const A = of('myth_altar'), [x, z] = A ? beside(A.spot.x, A.spot.z, 3.6) : [me.x, me.z]; return go(x, z, 'walk', 'lie'); } // night: lies down by the altar
    const h = hourNow(); if (h < 6 || h >= 10) lapped = false; else if (!lapped) { lapped = true; if (lap()) return; } // morning: a lap of the meadow
    const r = Math.random();
    if (r < 0.16) return Object.assign(me, { st: 'rear', t: 0, dur: 2.4 });
    if (r < 0.32 && t > me.callAt) { me.callAt = t + 45; gather(me.x, me.z, 3, 'rest', 4.4); return stand(4, 7); } // friends come and stand round it
    for (let k = 0; k < 8; k++) { const a = Math.random() * Math.PI * 2, d = 5 + Math.random() * 7, x = me.x + Math.cos(a) * d, z = me.z + Math.sin(a) * d;
      if (inBoard(x, z) && pathClear(me.x, me.z, x, z)) return go(x, z, Math.random() < 0.35 ? 'trot' : 'walk'); }
    stand(2, 4);
  }
  // the lap: round the middle of the board (the points it can go straight between, from the nearest), the horses after it
  function lap() {
    const cx = (open[0] + open[1]) / 2, cz = (open[2] + open[3]) / 2, rx = (open[1] - open[0]) / 2 - 7, rz = (open[3] - open[2]) / 2 - 7, a0 = Math.atan2(me.z - cz, me.x - cx), wp = [];
    for (let i = 0; i <= 12; i++) { const a = a0 + i / 12 * Math.PI * 2, p = [cx + Math.cos(a) * rx, cz + Math.sin(a) * rz], q = wp.at(-1) ?? [me.x, me.z];
      if (!walkable(...p) || !pathClear(...q, ...p)) break; wp.push(p); }
    if (wp.length < 5) return false;
    me.lap = { wp, i: 0 }; go(...wp[0], 'run');
    const D = a => Math.hypot(a.position.x - me.x, a.position.z - me.z), tail = (a, i) => a.send(...wp[i], 'rest', { fast: true, dur: 0.3, done: ok => ok && me.lap && i + 1 < wp.length && tail(a, i + 1) });
    for (const a of idle().filter(a => a.rec.species === 'horse' && D(a) < 40).sort((p, q) => D(p) - D(q)).slice(0, 3)) tail(a, 0);
    return true;
  }
  function arrived() {
    if (me.lap && ++me.lap.i < me.lap.wp.length) return go(...me.lap.wp[me.lap.i], 'run');
    if (me.lap) { me.lap = null; me.pk = 1; return stand(3, 5); }
    if (me.then === 'lie') return Object.assign(me, { st: 'lie', t: 0, gait: 'still' });
    stand(2, 6);
  }
  function move(dt, t) {
    me.t += dt;
    if (me.st === 'stand' && me.t > me.dur) think(t);
    else if (me.st === 'lie') { if (ctx.night < 0.3) me.st = 'up'; }
    else if (me.st === 'up') { if (me.lie <= 0) stand(1, 2); }
    else if (me.st === 'rear') { me.ph += dt * 0.9; if (me.t > me.dur) stand(2, 4); }
    else if (me.st === 'go') {
      const dx = me.tx - me.x, dz = me.tz - me.z, d = Math.hypot(dx, dz), turn = wrap(Math.atan2(-dz, dx) - me.yaw);
      me.yaw += Math.max(-3 * dt, Math.min(3 * dt, turn));
      if (d < (me.gait === 'run' ? 1.5 : 0.6)) arrived();
      else { const v = Math.min(d, SPD[me.gait] * dt * (Math.abs(turn) > 1 ? 0.3 : 1)), nx = me.x + Math.cos(me.yaw) * v, nz = me.z - Math.sin(me.yaw) * v;
        if (walkable(nx, nz) && !blocked(ctx.crowd, body, nx, nz, me.yaw)) { me.x = nx; me.z = nz; me.stuck = 0; } else if ((me.stuck += dt) > 0.8) { me.lap = null; stand(1, 3); }
        if (SPD[me.gait]) me.ph += dt * SPD[me.gait] / CYC[me.gait]; // stuck → stand() just made gait 'still' (no SPD): skip, else ph turns NaN and the legs freeze for good (report 157c)
        if (me.gait === 'run' && (me.step -= dt) < 0) { me.step = 0.13; const [fx0, fz0] = FEET[me.ph * 4 & 3], c = Math.cos(me.yaw), s = Math.sin(me.yaw); stamp(me.x + c * fx0 + s * fz0, me.z - s * fx0 + c * fz0, me.yaw); }
        else if (SPD[me.gait] && me.gait !== 'run' && (me.ph * 4 | 0) !== me.foot) { me.foot = me.ph * 4 | 0; const [fx0, fz0] = FEET[me.foot & 3], c = Math.cos(me.yaw), s = Math.sin(me.yaw); stamp(me.x + c * fx0 + s * fz0, me.z - s * fx0 + c * fz0, me.yaw, 1.2); } } // 157 C: walking, a brief ember at each step
    }
    me.lie = Math.max(0, Math.min(1, me.lie + (me.st === 'lie' ? 0.8 : -0.8) * dt));
    me.rear = me.st === 'rear' ? smooth(me.t / 0.5) * smooth((me.dur - me.t) / 0.6) : 0;
  }
  // its coming: down from the sky onto the altar, a landing (dust, a 톡), a rear, then it looks round at the camera
  function cutTick(dt, t) {
    const c = cutS, T = c.T; c.t = Math.max(c.t + dt, (performance.now() - c.at) / 1e3); // the wall clock: slow frames don't stretch it past T
    const k = smooth((c.t - 0.8) / 3.6), [x0, z0] = c.from, y = 24 * (1 - k) ** 1.6;
    me.x = x0 + (c.lx - x0) * k; me.z = z0 + (c.lz - z0) * k; me.gait = k < 1 ? 'run' : 'still';
    if (k < 1) { me.yaw = Math.atan2(-(c.lz - z0), c.lx - x0); me.ph += dt * 1.2; }
    else if (!c.down) { c.down = true; puff(me.x, me.z, '#ffd9a0'); puff(me.x, me.z, '#ff9a4a'); if (!toy(MYTH_FAM.firemane, 'drop', { r: 0.39 })) sfx('place'); } // 260 C: its 팅 as it lands
    me.rear = smooth((c.t - 4.7) / 0.5) * smooth((T - 1.4 - c.t) / 0.6); if (me.rear) me.ph += dt * 0.9;
    if (c.t > T - 1.6) me.yaw += wrap(-ctx.az + 0.7 - me.yaw) * Math.min(1, dt * 2.5); // 3/4 to the camera
    place(); F.obj.position.y += y;
    if (c.t >= T) { cutS = null; stand(2, 4); c.done?.(); }
  }
  return {
    set(s, n, w) { stage = s; lit = n; wait = !!w;
      if (s === 'prints' && !prints) { const [x, z] = nearest((x, z) => walkable(x, z) && walkable(x, z + 4), [(open[0] + open[1]) / 2 + 6, open[2] + 5]); prints = trail(steps(x - 2, z, -1.2, 11, 1.15, 0.3), [[HOOF, faint[0], 2], [HOOF, faint[1], 3]]); }
      if (prints) prints.visible = s === 'prints';
      const C = s === 'trace' && of('campfire'), key = C ? `${C.spot.x},${C.spot.z}` : '';
      if (key !== traceAt) { if (trace) scene.remove(trace); trace = null; traceAt = key;
        if (C) { const a0 = Math.random() * 6, pts = Array.from({ length: 11 }, (_, i) => { const a = a0 + i * 0.5, R = 2.5 + i * 0.12; return [C.spot.x + Math.cos(a) * R, C.spot.z + Math.sin(a) * R, Math.atan2(-Math.cos(a), -Math.sin(a))]; });
          trace = trail(pts, [[HOOF, burnt[0], 2], [SPOT, burnt[1], 3]]); } }
      if ((s === 'guest' || s === 'home') && !w) spawn().catch(retry); // 168: offline, its model never fetched: asked again next time (an unhandled rejection before, and no 신수 till a reload)
    },
    // a tap (before the props'): during its coming, skip; on it (no animal in front), a pet; the altar; the prints
    tap(ray, hit, e) {
      if (cutS) { cutS.t = cutS.T; return true; }
      const near = h => h && !(hit && hit.distance < h.distance);
      if (shown() && F.obj.visible && near(ray.intersectObjects(solid, false)[0])) { me.pk = 1; if (me.st === 'lie') me.st = 'up'; ui.onMyth?.('pet', [e.clientX, e.clientY]); return true; }
      const A = of('myth_altar'); if (A && near(ray.intersectObject(A.obj, true)[0])) { ui.onMyth?.('altar'); return true; }
      for (const [g, k, R] of [[prints, 'prints', 1.8], [trace, 'trace', 2.2]]) { if (!g?.visible || !g.userData.pts.length) continue; const [x0, z0] = g.userData.pts[0];
        gp.set(up, -heightAt(x0, z0)); if (!ray.ray.intersectPlane(gp, at)) continue;
        const p = g.userData.pts.find(([x, z]) => Math.hypot(x - at.x, z - at.z) < R); if (!p) continue;
        ui.onMyth?.(k, save(k === 'prints' ? room(0.9, p[0], p[1]) : room(1.6, p[0] + 3, p[1] + 3))); return true; }
      return false;
    },
    tick(dt, t) {
      const A = of('myth_altar'); A?.obj.userData.lit?.(['called', 'guest', 'home'].includes(stage) ? 3 : stage === 'altar' || stage === 'ready' ? lit : 0);
      const n = ctx.night, pulse = 0.75 + 0.25 * Math.sin(t * 2.2);
      faint[1].opacity = (0.2 + 0.45 * n) * pulse; burnt[1].opacity = (0.4 + 0.5 * n) * pulse;
      for (let i = 0; i < 24; i++) { const k = Math.max(0, 1 - (fxT[i] += dt) / fxL[i]); fx.setColorAt(i, col.setRGB(k, 0.5 * k, 0.16 * k)); } fx.instanceColor.needsUpdate = true;
      if (!F) return;
      const on = shown(); F.obj.visible = on; if (on) ctx.crowd.add(body); else ctx.crowd.delete(body);
      if (!on) return void blob.set(sh, 0);
      if (cutS) cutTick(dt, t); else { move(dt, t); place(); }
      me.pk = Math.max(0, me.pk - dt);
      F.pose({ gait: me.gait, ph: me.ph, lie: me.lie, rear: me.rear, flare: Math.max(me.pk, me.gait === 'run' ? 0.4 : 0) });
      F.tick(t, n);
      const rain = Math.min(1, ctx.rain || 0), sp = steam.geometry.attributes.position; steam.visible = rain > 0.05; steam.material.opacity = 0.55 * rain;
      if (steam.visible) steam.userData.seed.forEach(([o, x, z], i) => { const k = (t / 2.4 + o) % 1; sp.setXYZ(i, x - k * 0.6, 3.5 + k * 2.4, z + 0.3 * Math.sin(t + i)); }), sp.needsUpdate = true;
      const lift = F.obj.position.y - heightAt(me.x, me.z), lx = (body.seg[1] - body.seg[0] + 2 * body.r) / 3.47, lz = body.r / 0.56, f = Math.max(0.3, 1 - lift / 12); // its blob, as walk.js's
      sh.position.set(me.x, heightAt(me.x, me.z) + 0.05, me.z); sh.scale.set(lx * f, lz * f, 1); sh.rotation.z = me.yaw; blob.set(sh, f);
    },
    async cut(done) { // its coming (ui/myth.js: the line and 건너뛰기); onto the altar if it is out
      await spawn().catch(retry); if (!me) return void done?.(); const A = of('myth_altar'), [lx, lz] = A ? beside(A.spot.x, A.spot.z, 3.6) : homeAt();
      cutS = { t: 0, at: performance.now(), T: calm() ? 6.5 : 8.5, lx, lz, from: [lx - 18, lz - 12], done }; Object.assign(me, { st: 'stand', lap: null, lie: 0, x: lx, z: lz }); place();
      view(lx, lz + 2, 34, 1.05);
    },
    skip() { if (cutS) cutS.t = cutS.T; },
    cutting: () => !!cutS,
    lap: () => !!me && !cutS && lap(), // a test's way in (the morning lap)
    get fig() { return F && { obj: F.obj, me }; },
  };
}

// 158 유니콘·백록 (?m89 시범; ui/myth.js drives it as the firemane's layer: set(stage, wait, find)). Its prints, its 발견 and the
// spot its window opens from till it comes (the snow has no altar): pearl hoofprints with a small rainbow at their end / white deer
// prints on the snow going off toward the board's far edge, fading; the jade glint beside the 5th (백록's 3rd clue); the figure once
// it came (MYTHIC152 fig: makeFigure on its look): walks slowly about, lies down at night. cut(): its coming, ≤8 s (the unicorn down
// from the sky, wings out; the white deer walking in along its prints). dispose(): its own geometries and materials, the figure's
// skeleton and blob (its look's materials are the page's, as every figure's)
export function guestLayer(m, { scene, ctx, ui, open, nearest, view, puff }) {
  const { heightAt, walkable, pathClear } = ctx, uni = !!m.dawn, mine = [], keep = x => (mine.push(x), x), g = new THREE.Group(), prints = new THREE.Group(); g.add(prints); scene.add(g);
  const up = new THREE.Vector3(0, 1, 0), gp = new THREE.Plane(), hp = new THREE.Vector3(), c3 = new THREE.Vector3();
  const add = (geo, mat, x, z, yaw, r = 2) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, heightAt(x, z) + 0.05, z); o.rotation.y = yaw; o.renderOrder = r; prints.add(o); return o; };
  const mats = uni ? [keep(flat('#f6eefa', 0.85)), keep(flat('#ffc8ec', 0.35, true))] : [keep(flat('#8fa6bf', 0.55)), keep(flat('#8fa6bf', 0.22))];
  const geos = uni ? [keep(HOOF.clone())] : [-1, 1].map(k => keep(lay(new THREE.CircleGeometry(0.1, 8)).scale(1.6, 1, 1).translate(0.03, 0, 0.075 * k))); // cloven: two halves
  const pts = []; let glint = null, dead = false;
  { const cx = (open[0] + open[1]) / 2, cz = (open[2] + open[3]) / 2;
    const trail = (x, z) => { const o = []; let yaw = uni ? 0.35 : 1.4; // the deer's toward the far edge (-z)
      for (let i = 0; i < 10; i++) { const s = i % 2 ? 0.3 : -0.3; o.push([x + Math.sin(yaw) * s, z + Math.cos(yaw) * s, yaw]); x += Math.cos(yaw) * 1.1; z -= Math.sin(yaw) * 1.1; yaw += uni ? -0.1 : 0.06; } return o; };
    const ok = t => t.every(([x, z]) => walkable(x, z)), [x0, z0] = nearest((x, z) => ok(trail(x, z)), uni ? [cx - 8, cz + 6] : [cx + 4, open[2] + 16]); // the whole trail on land (the snow's far edge is water)
    pts.push(...trail(x0, z0).filter(([x, z]) => walkable(x, z)));
    pts.forEach(([x, z, yaw], i) => { if (uni) { add(geos[0], mats[0], x, z, yaw); add(geos[0], mats[1], x, z, yaw, 3); } else for (const geo of geos) add(geo, mats[i < pts.length - 3 ? 0 : 1], x, z, yaw); });
    const [ex, ez, ey] = pts.at(-1) ?? [x0, z0, 0];
    if (uni) { const arc = keep(new THREE.TorusGeometry(1, 0.06, 6, 28, Math.PI)); // the small rainbow over the last print
      ['#ffb3c8', '#fff0a0', '#a8dcff'].forEach((c, i) => { const o = add(arc, keep(new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.75, depthWrite: false })), ex, ez, ey + Math.PI / 2, 3); o.scale.setScalar(0.85 + 0.12 * i); o.position.y -= 0.05; }); }
    else { glint = new THREE.Mesh(keep(new THREE.OctahedronGeometry(0.16)), keep(new THREE.MeshBasicMaterial({ color: '#7fe8c8', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));
      const [jx, jz, jy] = pts[Math.min(4, pts.length - 1)] ?? [ex, ez, ey], gx0 = jx + Math.sin(jy) * 1.0, gz0 = jz + Math.cos(jy) * 1.0, by = walkable(gx0, gz0), gx = by ? gx0 : jx, gz = by ? gz0 : jz; // beside the 5th print, clear of the trees the last ones go into
      glint.position.set(gx, heightAt(gx, gz) + 0.3, gz); glint.visible = false; g.add(glint); } }
  // ---- the 신수 ----
  let F = null, me = null, blob = null, loading = null, stage = null, wait = false, cutS = null;
  const sh = new THREE.Object3D(); sh.rotation.x = -Math.PI / 2;
  const homeAt = () => { const [x, z] = pts[0] ?? [(open[0] + open[1]) / 2, (open[2] + open[3]) / 2]; return nearest((a, b) => walkable(a, b) && Math.hypot(a - x, b - z) > 2, [x - 2, z + 2]); };
  const place = () => { F.obj.position.set(me.x, heightAt(me.x, me.z), me.z); F.obj.rotation.y = me.yaw; };
  const retry = () => setTimeout(() => { loading = null; }, 3e4); // 168: as the 신수's: a failed load is asked again after 30 s
  const spawn = () => loading ??= loadModel(SP[m.fig.sp].model).then(() => { if (dead) return;
    F = makeFigure(m.fig.sp, m.fig.v, 'adult'); F.obj.visible = false; g.add(F.obj); blob = blobSlot(scene);
    const [x, z] = homeAt(); me = { x, z, yaw: -0.6, st: 'stand', t: 0, dur: 2, ph: 0, lie: 0, gait: 'still', hx: x, hz: z }; place(); });
  const shown = () => !!me && (!!cutS || (stage === 'guest' || stage === 'home') && !wait);
  const stand = (a, b) => Object.assign(me, { st: 'stand', t: 0, dur: a + Math.random() * (b - a), gait: 'still' });
  function think() {
    if (ctx.night > 0.6) return Object.assign(me, { st: 'lie', t: 0, gait: 'still' }); // night: lies down where it is
    if (Math.random() < 0.3) return stand(3, 6);
    for (let k = 0; k < 8; k++) { const a = Math.random() * Math.PI * 2, d = 3 + Math.random() * 6, x = me.hx + Math.cos(a) * d, z = me.hz + Math.sin(a) * d;
      if (walkable(x, z) && pathClear(me.x, me.z, x, z)) return Object.assign(me, { st: 'go', tx: x, tz: z, gait: 'walk', t: 0 }); }
    stand(2, 4);
  }
  function move(dt) {
    me.t += dt;
    if (me.st === 'stand' && me.t > me.dur) think();
    else if (me.st === 'lie' && ctx.night < 0.3) stand(1, 2);
    else if (me.st === 'go') { const dx = me.tx - me.x, dz = me.tz - me.z, d = Math.hypot(dx, dz), turn = wrap(Math.atan2(-dz, dx) - me.yaw);
      me.yaw += Math.max(-2 * dt, Math.min(2 * dt, turn));
      if (d < 0.5 || me.t > 20) stand(2, 6);
      else { const v = Math.min(d, 1.3 * dt * (Math.abs(turn) > 1 ? 0.3 : 1)), nx = me.x + Math.cos(me.yaw) * v, nz = me.z - Math.sin(me.yaw) * v;
        if (walkable(nx, nz)) { me.x = nx; me.z = nz; } else stand(1, 3); me.ph += dt * 0.75; } }
    me.lie = Math.max(0, Math.min(1, me.lie + (me.st === 'lie' ? 0.8 : -0.8) * dt));
  }
  function cutTick(dt) { // the unicorn glides down onto its spot; the white deer walks in along its prints
    const c = cutS; c.t = Math.max(c.t + dt, (performance.now() - c.at) / 1e3); const k = smooth((c.t - 0.6) / (c.T - 2.4)), [x0, z0] = c.from;
    me.x = x0 + (c.lx - x0) * k; me.z = z0 + (c.lz - z0) * k; me.gait = k < 1 ? 'walk' : 'still'; if (k < 1) { me.yaw = Math.atan2(-(c.lz - z0), c.lx - x0); me.ph += dt * 0.75; }
    else if (!c.down) { c.down = true; puff(me.x, me.z, uni ? '#ffe6f4' : '#ffffff'); if (!toy('glass', 'drop')) sfx('place'); } // 260 C: the unicorn's / deer's 땡
    if (c.t > c.T - 1.6) me.yaw += wrap(-ctx.az + 0.7 - me.yaw) * Math.min(1, dt * 2.5); // 3/4 to the camera
    place(); if (uni) F.obj.position.y += 14 * (1 - k) ** 1.6;
    if (c.t >= c.T) { cutS = null; stand(2, 4); c.done?.(); }
  }
  const ground = (ray, y) => (gp.set(up, -y), ray.ray.intersectPlane(gp, hp)); // the tap's point on the ground at y
  return {
    id: m.id,
    set(s, w, find) { stage = s; wait = !!w; prints.visible = ['prints', 'altar', 'ready', 'called'].includes(s); if (glint) glint.visible = !!find; if ((s === 'guest' || s === 'home') && !w) spawn().catch(retry); },
    // a tap: during its coming, skip; on it (no animal in front), a pet; the glint; the prints (its 발견, then its window)
    tap(ray, hit, e) {
      if (cutS) { cutS.t = cutS.T; return true; }
      if (shown() && F.obj.visible) { c3.set(me.x, F.obj.position.y + 1.1, me.z);
        if (ray.ray.distanceToPoint(c3) < 1.3 && !(hit && hit.distance < ray.ray.origin.distanceTo(c3))) { if (me.st === 'lie') stand(1, 2); ui.onMyth?.('pet', [e.clientX, e.clientY], m.id); return true; } }
      if (glint?.visible && ground(ray, glint.position.y - 0.3) && Math.hypot(hp.x - glint.position.x, hp.z - glint.position.z) < 1.4) { ui.onMyth?.('find', null, m.id); return true; }
      if (!hit && prints.visible && pts.length && ground(ray, heightAt(pts[0][0], pts[0][1])) && pts.some(([x, z]) => Math.hypot(x - hp.x, z - hp.z) < 1.8)) { ui.onMyth?.('prints', null, m.id); return true; }
      return false;
    },
    tick(dt, t) {
      const pulse = 0.8 + 0.2 * Math.sin(t * 2); if (uni) mats[1].opacity = (0.25 + 0.4 * ctx.night) * pulse;
      if (glint?.visible) { glint.rotation.y = t * 1.5; glint.material.opacity = 0.55 + 0.4 * pulse; }
      if (!F) return;
      const on = shown(); F.obj.visible = on; if (!on) return void blob.set(sh, 0);
      if (cutS) cutTick(dt); else { move(dt); place(); }
      F.pose({ sq: 1, rot: 0, gait: me.gait, ph: me.ph, lie: me.lie, wings: cutS && uni ? 1 : 0 });
      const lift = F.obj.position.y - heightAt(me.x, me.z), f = Math.max(0.3, 1 - lift / 12);
      sh.position.set(me.x, heightAt(me.x, me.z) + 0.05, me.z); sh.scale.set(2.2 * f, f, 1); sh.rotation.z = me.yaw; blob.set(sh, f);
    },
    async cut(done) {
      await spawn().catch(retry); if (dead || !me) return void done?.(); const [lx, lz] = homeAt(), [ex, ez] = pts.at(-1) ?? [lx + 10, lz];
      cutS = { t: 0, at: performance.now(), T: calm() ? 6 : 7.5, lx, lz, from: uni ? [lx - 12, lz - 8] : [ex, ez], done }; Object.assign(me, { st: 'stand', lie: 0, x: cutS.from[0], z: cutS.from[1], hx: lx, hz: lz }); place();
      view(lx, lz + 2, 30, 1.05);
    },
    skip() { if (cutS) cutS.t = cutS.T; },
    cutting: () => !!cutS,
    get fig() { return me && F && { obj: F.obj, me }; },
    dispose() { dead = true; scene.remove(g); for (const x of mine) x.dispose(); F?.skeleton?.dispose(); blob?.free(); },
  };
}
