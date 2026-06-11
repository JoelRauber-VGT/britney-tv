/* ════════════════════════════════════════════════════════════════
 * REACHER · kinematischer 3-DOF-Roboterarm
 *
 * Keine Physik-Engine nötig: der Arm wird rein kinematisch integriert
 * (Gelenkwinkel + Winkelgeschwindigkeit). Aufgabe: die Fingerspitze
 * an ein leuchtendes Ziel führen. Wird das Ziel getroffen, springt es
 * an eine neue erreichbare Stelle → die Aufgabe hört nie auf.
 *
 * Gelenke:  a0 = Basis-Drehung (um Y)
 *           a1 = Schulter-Neigung
 *           a2 = Ellbogen (relativ zur Schulter)
 * ════════════════════════════════════════════════════════════════ */

/* Seedbarer RNG (mulberry32) — für faire ES-Vergleiche brauchen alle
   Kandidaten einer Generation dieselbe Ziel-Abfolge. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Reacher {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.L1 = 1.15;            // Oberarm
    this.L2 = 1.05;            // Unterarm
    this.h0 = 0.62;            // Schulterhöhe über der Basis
    this.dt = 1 / 30;
    this.maxStep = 120;        // 4 s Episode bei 30 Hz
    this.maxVel = 3.2;         // rad/s
    this.reach = this.L1 + this.L2;
    this.hitR = 0.3;           // Trefferradius (großzügig → häufige, sichtbare Treffer)
    this.obsDim = 13;
    this.actDim = 3;
    this.reset();
  }

  _r(a, b) { return a + (b - a) * this.rng(); }

  randomTarget() {
    const yaw = this._r(-Math.PI, Math.PI);
    const rad = this._r(0.6, this.reach * 0.82);   // gut im Arbeitsraum, selten am Rand
    const pitch = this._r(-0.1, 1.1);
    const r = rad * Math.cos(pitch);
    this.tx = r * Math.cos(yaw);
    this.tz = r * Math.sin(yaw);
    this.ty = this.h0 + rad * Math.sin(pitch);
  }

  reset() {
    this.a0 = this._r(-Math.PI, Math.PI);
    this.a1 = this._r(0.2, 1.0);
    this.a2 = this._r(-1.6, -0.3);
    this.v0 = this.v1 = this.v2 = 0;
    this.t = 0;
    this.hits = 0;
    this.justHit = false;
    this.randomTarget();
    this._fk();
    this.prevDist = this.dist();
    return this.obs();
  }

  /* Vorwärtskinematik → Ellbogen- und Fingerspitzen-Position in Weltkoordinaten */
  _fk() {
    const r1 = this.L1 * Math.cos(this.a1);
    const y1 = this.h0 + this.L1 * Math.sin(this.a1);
    const ph2 = this.a1 + this.a2;
    const r2 = r1 + this.L2 * Math.cos(ph2);
    const y2 = y1 + this.L2 * Math.sin(ph2);
    const c = Math.cos(this.a0), s = Math.sin(this.a0);
    this.ex = r1 * c; this.ez = r1 * s; this.ey = y1;   // Ellbogen
    this.fx = r2 * c; this.fz = r2 * s; this.fy = y2;   // Fingerspitze
  }

  dist() {
    const dx = this.fx - this.tx, dy = this.fy - this.ty, dz = this.fz - this.tz;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  obs() {
    return [
      Math.cos(this.a0), Math.sin(this.a0),
      Math.cos(this.a1), Math.sin(this.a1),
      Math.cos(this.a2), Math.sin(this.a2),
      this.v0 / this.maxVel, this.v1 / this.maxVel, this.v2 / this.maxVel,
      (this.tx - this.fx) / this.reach,
      (this.ty - this.fy) / this.reach,
      (this.tz - this.fz) / this.reach,
      this.dist() / this.reach,
    ];
  }

  step(act) {
    this.v0 = act[0] * this.maxVel;
    this.v1 = act[1] * this.maxVel;
    this.v2 = act[2] * this.maxVel;
    this.a0 += this.v0 * this.dt;
    this.a1 += this.v1 * this.dt;
    this.a2 += this.v2 * this.dt;
    // Gelenkgrenzen: nicht durch den Boden, grobe Selbstkollisions-Vermeidung
    this.a1 = Math.max(-0.15, Math.min(1.6, this.a1));
    this.a2 = Math.max(-2.4, Math.min(0.15, this.a2));
    this._fk();

    const d = this.dist();
    // Potential-based shaping: dichte Belohnung fürs Annähern (telescopiert zu
    // Start- minus End-Distanz) + kleiner Aktionsaufwand-Malus → glatte Bewegung.
    let reward = (this.prevDist - d) - 0.002 * (Math.abs(act[0]) + Math.abs(act[1]) + Math.abs(act[2]));
    this.justHit = false;
    if (d < this.hitR) {
      reward += 2.0;                 // Treffer-Bonus (dominiert die Fitness → wirklich treffen)
      this.hits++;
      this.justHit = true;
      this.randomTarget();
      this._fk();
      this.prevDist = this.dist();   // Bezug auf das neue Ziel
    } else {
      this.prevDist = d;
    }
    this.t++;
    return { obs: this.obs(), reward, done: this.t >= this.maxStep, hit: this.justHit };
  }
}
