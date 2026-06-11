/* ════════════════════════════════════════════════════════════════
 * TRAINING-WORKER
 *
 * Das ES-Training läuft hier in einem eigenen Thread — so bleibt der
 * Main-Thread (Display + WebGL-Render) auf dem Raspberry Pi flüssig,
 * auch wenn eine Generation 64×120 Forward-Pässe kostet.
 *
 * Der Worker trainiert in kleinen Batches und postet danach die
 * aktuellen Gewichte θ + Lernstatus zurück; `setTimeout(…, 0)` gibt
 * den Thread frei (responsiv, moderate CPU/Thermik).
 * Kein three.js-Import hier → keine importmap nötig.
 * ════════════════════════════════════════════════════════════════ */

import { Trainer } from './trainer.js';

let trainer = null;

self.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') {
    trainer = new Trainer({ pretrained: m.pretrained });
    loop();
  }
};

function loop() {
  if (!trainer) return;
  for (let i = 0; i < 3; i++) trainer.train();          // kleines Batch
  const s = trainer.stats();
  const theta = new Float32Array(trainer.best);         // beste Policy → Display
  self.postMessage(
    { theta, gen: s.gen, perf: s.perf, hits: s.hits, hitsAvg: s.hitsAvg, best: s.best },
    [theta.buffer],
  );
  setTimeout(loop, 0);
}
