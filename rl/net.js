/* ════════════════════════════════════════════════════════════════
 * WINZIGES MLP · nur Forward-Pass
 *
 * Bewusst abhängigkeitsfrei (Float32Array, keine Lib) — läuft auf
 * jedem Raspberry Pi. Die Gewichte liegen als ein flacher Vektor
 * (`p`), damit Evolution Strategies sie direkt perturbieren kann.
 * tanh in allen Schichten → Aktionen sind von Natur aus in [-1, 1].
 * ════════════════════════════════════════════════════════════════ */

export class MLP {
  constructor(sizes /* z.B. [13, 24, 3] */) {
    this.sizes = sizes;
    this.layers = [];
    let n = 0;
    for (let l = 0; l < sizes.length - 1; l++) {
      const win = sizes[l], wout = sizes[l + 1];
      this.layers.push({ win, wout, wOff: n, bOff: n + win * wout });
      n += win * wout + wout;
    }
    this.nParams = n;
    this.p = new Float32Array(n);              // Scratch-Gewichte für den Forward
    const m = Math.max(...sizes);
    this._a = new Float32Array(m);
    this._b = new Float32Array(m);
  }

  /* input: Array/Float32Array der Länge sizes[0] → Float32Array-View der Ausgabe.
     Achtung: das Ergebnis liegt in einem geteilten Puffer — sofort verwenden. */
  forward(input) {
    let cur = this._a, nxt = this._b;
    for (let i = 0; i < this.sizes[0]; i++) cur[i] = input[i];
    for (let l = 0; l < this.layers.length; l++) {
      const { win, wout, wOff, bOff } = this.layers[l];
      for (let o = 0; o < wout; o++) {
        let s = this.p[bOff + o];
        const base = wOff + o * win;
        for (let i = 0; i < win; i++) s += this.p[base + i] * cur[i];
        nxt[o] = Math.tanh(s);
      }
      const t = cur; cur = nxt; nxt = t;
    }
    return cur.subarray(0, this.sizes[this.sizes.length - 1]);
  }
}
