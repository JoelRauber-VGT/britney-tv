/* ════════════════════════════════════════════════════════════════
 * ROBOTER · Orchestrator + Render-Loop (Main-Thread)
 *
 * Aufgabenteilung für einen flüssigen Kiosk:
 *  · Training  → läuft im Web Worker (worker.js), nebenläufig
 *  · Main-Thread → führt nur die aktuelle Policy θ auf dem sichtbaren
 *    Arm aus (30-Hz-Sim) und rendert. θ kommt per postMessage vom Worker.
 *
 * Fallback: gibt es keinen (Modul-)Worker, wird zeitgescheibt im
 * Main-Thread trainiert — langsamer, aber lauffähig.
 * ════════════════════════════════════════════════════════════════ */

import { Scene } from './scene.js';
import { MLP } from './net.js';
import { Reacher } from './reacher.js';

const ARCH = [13, 24, 3];   // muss zur Trainer-Architektur (hidden 24) passen

export function startRobot({ canvas, pretrained = null, onStats = null } = {}) {
  const net = new MLP(ARCH);                          // Display-Policy
  if (pretrained && pretrained.length === net.nParams) net.p.set(pretrained);

  const display = new Reacher();
  display.reset();
  const scene = new Scene(canvas, display);

  let stats = { gen: 0, perf: 0, hits: 0, hitsAvg: 0, best: 0 };

  // ── Training in den Worker auslagern (mit Fallback) ──
  let worker = null;
  let fallback = null;
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const m = e.data;
      net.p.set(m.theta);
      stats = { gen: m.gen, perf: m.perf, hits: m.hits, hitsAvg: m.hitsAvg, best: m.best };
    };
    worker.postMessage({ type: 'init', pretrained });
  } catch (err) {
    console.warn('[britney] Web Worker nicht verfügbar — Training im Main-Thread (Fallback).', err);
    import('./trainer.js').then(({ Trainer }) => { fallback = new Trainer({ pretrained }); });
  }

  // ── Render-Loop ──
  const stepDt = 1 / 30;
  let acc = 0, frame = 0, last = performance.now();

  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (frame < 3) scene.resize();   // Flex-Layout im 1. Frame evtl. noch nicht final

    if (fallback && frame % 4 === 0) {
      fallback.train();
      net.p.set(fallback.best);
      stats = fallback.stats();
    }

    acc += dt;
    while (acc >= stepDt) {
      display.step(net.forward(display.obs()));
      if (display.t >= display.maxStep) display.reset();
      acc -= stepDt;
    }

    scene.update(now);
    scene.render();
    if (onStats && frame % 12 === 0) onStats(stats);
    frame++;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  return {
    net, scene, display,
    get stats() { return stats; },
    /* Aktuell gelernte Gewichte als Array — in rl/pretrained.js einfrieren. */
    dumpWeights: () => Array.from(net.p, (x) => +x.toFixed(4)),
  };
}
