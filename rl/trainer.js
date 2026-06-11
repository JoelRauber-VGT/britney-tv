/* ════════════════════════════════════════════════════════════════
 * EVOLUTION STRATEGIES · der Lern-Algorithmus
 *
 * Warum ES statt klassischem Policy-Gradient?
 *  · numerisch bombenstabil — explodiert nie, ideal für 24/7-Kiosk
 *  · gradientfrei, parallelisierbar, trivial mit Vortraining zu seeden
 *  · die „Fitness" mappt sauber auf den IQ-Stand
 *
 * Pro Generation werden `pop` perturbierte Policies in schnellen
 * Headless-Episoden bewertet (mirrored sampling: ±ε spart Varianz),
 * dann wird der Mittelpunkt θ in Richtung der besseren Kandidaten
 * verschoben (rang-basierte Fitness → robust gegen Ausreißer).
 * Eine Generation ist sehr billig (winziges Netz, kurze Episode),
 * daher zeitscheiben-tauglich für flüssiges Rendering auf dem Pi.
 * ════════════════════════════════════════════════════════════════ */

import { MLP } from './net.js';
import { Reacher, mulberry32 } from './reacher.js';

function randn() {
  // Box-Muller
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export class Trainer {
  constructor({ pop = 48, sigma = 0.1, lr = 0.05, hidden = 24, evals = 1, pretrained = null } = {}) {
    this.net = new MLP([13, hidden, 3]);
    this.theta = new Float32Array(this.net.nParams);
    if (pretrained && pretrained.length === this.net.nParams) {
      // Hybrid: mit vortrainierten Gewichten starten und live weiterlernen
      this.theta.set(pretrained);
    } else {
      for (let i = 0; i < this.theta.length; i++) this.theta[i] = randn() * 0.1;
    }

    this.pop = pop % 2 === 0 ? pop : pop + 1;   // gerade Zahl für mirrored sampling
    this.sigma = sigma;
    this.lr = lr;
    this.evals = Math.max(1, evals);   // Seeds pro Kandidat → weniger verrauschte Fitness
    this.gen = 0;
    this.iq = 0;            // 0..1 geglättete Leistung → vom HUD skaliert
    this.lastHits = 0;
    this.bestHits = 0;

    this._env = new Reacher();
    this._eps = [];
    for (let i = 0; i < this.pop; i++) this._eps.push(new Float32Array(this.net.nParams));
    this._cand = new Float32Array(this.net.nParams);

    // Elitismus per High-Water-Mark: θ exploriert frei, `best` ist die
    // angezeigte Policy und wird NUR hochgesetzt, wenn θ auf einem festen
    // Validierungs-Satz (getrennt von den Trainings-Zielen) besser ist.
    // → angezeigte Leistung steigt monoton, ohne abzudriften.
    this.best = new Float32Array(this.theta);
    this.acceptEvery = 8;
    this.valSeeds = [];
    for (let i = 0; i < 24; i++) this.valSeeds.push((900001 + i * 0x9e3779b9) >>> 0);

    this.bestScore = this._valScore(this.best);
    this.bestHits = this.bestScore;
    this.lastHits = this.bestScore;
    this.hitsEMA = this.bestScore;
    this.iq = 1 - Math.exp(-this.hitsEMA / 3);
  }

  /* Mittlere Trefferzahl von w auf dem festen Validierungs-Satz (Held-out). */
  _valScore(w) {
    let h = 0;
    for (let s = 0; s < this.valSeeds.length; s++) h += this._rollout(w, this.valSeeds[s]).hits;
    return h / this.valSeeds.length;
  }

  /* Mittlere Fitness von Gewichten w über mehrere Seeds. */
  _avgFit(w, seeds) {
    let f = 0;
    for (let s = 0; s < seeds.length; s++) f += this._rollout(w, seeds[s]).fit;
    return f / seeds.length;
  }

  /* Eine Headless-Episode mit Gewichten w; gibt {fit, hits} zurück. */
  _rollout(w, seed) {
    const env = this._env;
    env.rng = mulberry32(seed);
    env.reset();
    this.net.p.set(w);
    let fit = 0;
    for (let s = 0; s < env.maxStep; s++) {
      const a = this.net.forward(env.obs());
      const r = env.step(a);
      fit += r.reward;
    }
    return { fit, hits: env.hits };
  }

  /* Eine ES-Generation. */
  train() {
    const n = this.pop, half = n / 2, np = this.net.nParams;
    // pro Generation fixe Ziel-Sätze (alle Kandidaten fair gleich), evals Stück
    const seeds = [];
    for (let s = 0; s < this.evals; s++) {
      seeds.push((1013904223 + (this.gen * this.evals + s) * 1664525) >>> 0);
    }
    const fits = new Float32Array(n);

    for (let k = 0; k < half; k++) {
      const e = this._eps[k];
      for (let j = 0; j < np; j++) e[j] = randn();
      // +ε
      for (let j = 0; j < np; j++) this._cand[j] = this.theta[j] + this.sigma * e[j];
      fits[k] = this._avgFit(this._cand, seeds);
      // −ε (gespiegelt)
      for (let j = 0; j < np; j++) this._cand[j] = this.theta[j] - this.sigma * e[j];
      fits[k + half] = this._avgFit(this._cand, seeds);
    }

    // Rang-basierte Fitness in [-0.5, 0.5] (OpenAI-ES centered ranks)
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => fits[a] - fits[b]);
    const shaped = new Float32Array(n);
    for (let rank = 0; rank < n; rank++) shaped[order[rank]] = rank / (n - 1) - 0.5;

    // θ ← θ + lr/(n·σ) · Σ shaped_k · ε_k   (ε für k≥half ist −ε_{k-half})
    const scale = this.lr / (n * this.sigma);
    for (let j = 0; j < np; j++) {
      let g = 0;
      for (let k = 0; k < half; k++) g += (shaped[k] - shaped[k + half]) * this._eps[k][j];
      this.theta[j] += scale * g;
    }

    this.gen++;

    // High-Water-Mark: θ exploriert frei weiter; nur echte Verbesserungen auf
    // dem Held-out-Validierungs-Satz heben die angezeigte Beste an.
    if (this.gen % this.acceptEvery === 0) {
      const val = this._valScore(this.theta);
      if (val > this.bestScore) {
        this.best.set(this.theta);
        this.bestScore = val;
        this.bestHits = val;
        this.lastHits = val;
      }
      // IQ folgt der (monoton steigenden) Besten, sanft animiert
      this.hitsEMA += (this.bestScore - this.hitsEMA) * 0.2;
      this.iq = 1 - Math.exp(-this.hitsEMA / 3);
    }
  }

  /* Aktion der angezeigten besten Policy für den sichtbaren Live-Arm. */
  act(obs) {
    this.net.p.set(this.best);
    return this.net.forward(obs);
  }

  stats() {
    return { gen: this.gen, perf: this.iq, hits: this.lastHits, hitsAvg: this.hitsEMA, best: this.bestHits };
  }

  /* Beste gelernte Gewichte als Array — zum Einfrieren eines Vortrainings:
     in der Konsole `britney.robot.dumpWeights()` → in rl/pretrained.js kopieren. */
  dumpWeights() { return Array.from(this.best, (x) => +x.toFixed(4)); }
}
