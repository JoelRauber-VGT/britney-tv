/* ════════════════════════════════════════════════════════════════
 * SZENE · three.js-Visualisierung des Reachers
 *
 * Look passend zu tokens.css: dunkles Violett-Papier, Signal-Orange
 * als einziger Akzent. Bewusst ohne Postprocessing (kein EffectComposer)
 * — Emissive-Materialien + PointLights geben das Glühen, bleibt damit
 * auf dem Pi günstig. Kamera orbitet langsam für „lebendiges" Bild.
 * ════════════════════════════════════════════════════════════════ */

import {
  Scene as ThreeScene, PerspectiveCamera, WebGLRenderer, Fog,
  AmbientLight, DirectionalLight, PointLight, GridHelper,
  CylinderGeometry, SphereGeometry, TorusGeometry, MeshStandardMaterial,
  Mesh, Vector3, Quaternion,
} from 'three';

const PAPER  = 0x141019;   // Hintergrund (dunkles Violett)
const ACCENT = 0xf0883e;   // Signal-Orange
const VIOLET = 0xb48ad8;   // Sekundärakzent
const INK    = 0xd9d2e0;   // Arm-Metall

const UP = new Vector3(0, 1, 0);
const _a = new Vector3(), _b = new Vector3(), _dir = new Vector3(), _q = new Quaternion();

/* Ein Glied als Zylinder, das pro Frame zwischen zwei Punkten gespannt wird. */
class Link {
  constructor(scene, radius, mat) {
    this.mesh = new Mesh(new CylinderGeometry(radius, radius, 1, 14), mat);
    scene.add(this.mesh);
  }
  set(ax, ay, az, bx, by, bz) {
    _a.set(ax, ay, az); _b.set(bx, by, bz);
    _dir.subVectors(_b, _a);
    const len = _dir.length() || 1e-4;
    _dir.normalize();
    _q.setFromUnitVectors(UP, _dir);
    this.mesh.quaternion.copy(_q);
    this.mesh.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    this.mesh.scale.y = len;
  }
}

export class Scene {
  constructor(canvas, env) {
    this.env = env;

    const scene = new ThreeScene();
    // Hintergrund transparent lassen → die CSS-Blooms scheinen hinter dem Arm durch
    scene.fog = new Fog(PAPER, 7, 14);
    this.scene = scene;

    this.camera = new PerspectiveCamera(36, 1, 0.1, 100);
    this.target = new Vector3(0, env.h0 + 0.35, 0);

    this.renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    if ('outputColorSpace' in this.renderer) this.renderer.outputColorSpace = 'srgb';

    // ── Licht ──
    scene.add(new AmbientLight(0x6a5a86, 0.9));
    const key = new DirectionalLight(0xffffff, 1.1);
    key.position.set(3, 6, 4);
    scene.add(key);
    const rim = new DirectionalLight(VIOLET, 0.7);
    rim.position.set(-4, 2, -3);
    scene.add(rim);

    // ── Boden-Raster für Tiefe ──
    const grid = new GridHelper(14, 28, VIOLET, 0x2a2336);
    grid.material.transparent = true;
    grid.material.opacity = 0.32;
    scene.add(grid);

    // ── Arm ──
    const metal  = new MeshStandardMaterial({ color: INK, metalness: 0.6, roughness: 0.35 });
    const violet = new MeshStandardMaterial({ color: VIOLET, metalness: 0.5, roughness: 0.4 });
    this.post  = new Link(scene, 0.075, metal);   // Basis → Schulter
    this.upper = new Link(scene, 0.072, metal);   // Schulter → Ellbogen
    this.fore  = new Link(scene, 0.058, violet);  // Ellbogen → Fingerspitze

    const joint = new MeshStandardMaterial({ color: INK, metalness: 0.7, roughness: 0.3 });
    this.baseDisc = new Mesh(new CylinderGeometry(0.34, 0.4, 0.12, 24), joint);
    this.baseDisc.position.y = 0.06;
    scene.add(this.baseDisc);
    this.shoulder = this._ball(scene, 0.13, joint);
    this.elbow    = this._ball(scene, 0.11, joint);

    // ── Fingerspitze (Effektor) + Ziel: glühend ──
    this.tipMat = new MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 1.4, roughness: 0.4 });
    this.tip = this._ball(scene, 0.09, this.tipMat);
    this.tipLight = new PointLight(ACCENT, 6, 4, 2);
    scene.add(this.tipLight);

    this.targetMat = new MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 2.0, roughness: 0.5 });
    this.goal = new Mesh(new SphereGeometry(env.hitR * 0.9, 20, 20), this.targetMat);
    scene.add(this.goal);
    this.halo = new Mesh(new TorusGeometry(env.hitR * 1.5, 0.012, 8, 32), this.targetMat);
    scene.add(this.halo);
    this.goalLight = new PointLight(ACCENT, 5, 4, 2);
    scene.add(this.goalLight);

    this.flash = 0;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  _ball(scene, r, mat) {
    const m = new Mesh(new SphereGeometry(r, 18, 18), mat);
    scene.add(m);
    return m;
  }

  resize() {
    const w = this.renderer.domElement.clientWidth  || innerWidth;
    const h = this.renderer.domElement.clientHeight || innerHeight;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));   // Pi-schonend
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  update(now) {
    const e = this.env;
    const t = now * 0.001;

    // Kamera orbitet langsam, leicht von oben
    const ang = t * 0.08;
    const dist = 6.2;
    this.camera.position.set(Math.sin(ang) * dist, 2.4 + Math.sin(t * 0.21) * 0.3, Math.cos(ang) * dist);
    this.camera.lookAt(this.target);

    // Arm-Glieder aus der Kinematik
    this.post.set(0, 0.1, 0, 0, e.h0, 0);
    this.upper.set(0, e.h0, 0, e.ex, e.ey, e.ez);
    this.fore.set(e.ex, e.ey, e.ez, e.fx, e.fy, e.fz);
    this.shoulder.position.set(0, e.h0, 0);
    this.elbow.position.set(e.ex, e.ey, e.ez);
    this.tip.position.set(e.fx, e.fy, e.fz);
    this.tipLight.position.set(e.fx, e.fy, e.fz);

    // Ziel pulsiert; Treffer-Blitz
    if (e.justHit) this.flash = 1;
    this.flash *= 0.9;
    const pulse = 1 + Math.sin(t * 4) * 0.12 + this.flash * 0.8;
    this.goal.position.set(e.tx, e.ty, e.tz);
    this.goal.scale.setScalar(pulse);
    this.goalLight.position.set(e.tx, e.ty, e.tz);
    this.goalLight.intensity = 4 + this.flash * 8;
    this.halo.position.set(e.tx, e.ty, e.tz);
    this.halo.rotation.x = t * 0.9;
    this.halo.rotation.y = t * 1.3;
    this.tipMat.emissiveIntensity = 1.2 + this.flash * 2;
  }

  render() { this.renderer.render(this.scene, this.camera); }
}
