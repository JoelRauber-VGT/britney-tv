/* ════════════════════════════════════════════════════════════════
 * BRITNEY DASHBOARD · NEWS-WIDGET (Mitte, bei CONFIG.center === 'news')
 *
 * Liest data/news.json (geschrieben von news_pipeline/) und rotiert die
 * Karten mit weichem Crossfade.
 *  - Zwei gestapelte Karten-Ebenen: die nächste Karte wird hinten gefüllt,
 *    ihr Bild vorab dekodiert, dann blenden beide über (nur opacity).
 *  - Alle Bewegung läuft über die Web Animations API (transform/opacity →
 *    GPU). Die globale "animation: none"-Regel in style.css bleibt dadurch
 *    für den Rest der Seite unangetastet.
 *  - news.json wird alle N Minuten neu geladen; neue Daten greifen erst beim
 *    nächsten Kartenwechsel. Kaputte/fehlende Datei → letzte Daten bleiben.
 *  - Genau ein Rotations-Timeout + ein Reload-Intervall (24/7 ohne Leaks).
 *
 * Test in der Konsole:  britney.nextNews()
 * ════════════════════════════════════════════════════════════════ */

(() => {
  if (CONFIG.center === 'video') return;
  const root = document.getElementById('news');
  if (!root) return;

  const N = CONFIG.news;
  const ROTATE_MS = N.rotateSeconds * 1000;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FADE_MS = reduced ? 200 : N.fadeMs;
  const SLUG = { 'KI weltweit': 'ki', 'Energie': 'energie', 'KI × Energie': 'ki-energie' };
  const srcUrl = new URL(N.src, location.href);

  /* Zweite Ebene als Klon der ersten */
  const a = root.querySelector('.news__card');
  const b = a.cloneNode(true);
  b.dataset.layer = 'b';
  a.after(b);
  const layers = [a, b];
  for (const l of layers) l.style.opacity = '0';
  let front = 1;                 /* erste Karte landet so auf Ebene a */

  const fill = root.querySelector('.news__progress-fill');
  const preloader = new Image();

  let items = null;              /* aktuell angezeigte Daten */
  let pending = null;            /* neu geladen, wartet auf nächsten Wechsel */
  let idx = -1;
  let showing = null;            /* 'card' | 'empty' | null */
  let timer = null;
  let token = 0;                 /* verwirft veraltete async-Wechsel */

  /* ── Daten ── */
  function valid(json) {
    if (!json || !Array.isArray(json.items)) return null;
    const list = json.items.filter((it) =>
      it && it.id && it.title && SLUG[it.category]);
    return list.length ? list : null;
  }

  async function load() {
    try {
      const res = await fetch(`${srcUrl.href}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const list = valid(await res.json());
      if (!list) return;
      pending = list;
      if (showing === 'empty') advance();  /* aus dem Leer-Zustand sofort starten */
    } catch (_) { /* Netz/JSON kaputt → letzte gültige Daten bleiben stehen */ }
  }

  /* ── Formatierung ── */
  function relTime(iso) {
    const ms = Date.now() - new Date(iso).getTime();
    if (!isFinite(ms)) return '';
    const m = Math.round(ms / 60000);
    if (m < 1) return 'gerade eben';
    if (m < 60) return `vor ${m} Min.`;
    const h = Math.round(m / 60);
    if (h < 24) return `vor ${h} Std.`;
    const d = Math.round(h / 24);
    return d === 1 ? 'vor 1 Tag' : `vor ${d} Tagen`;
  }
  const isNew = (iso) => Date.now() - new Date(iso).getTime() < N.newHours * 3600_000;
  const resolve = (rel) => new URL(rel, srcUrl).href;

  /* ── Bild laden, mit Timeout; bei Fehler Kategorie-Verlauf aus der CSS ── */
  function setImage(img, media, url) {
    media.classList.remove('is-fallback');
    if (!url) { media.classList.add('is-fallback'); img.removeAttribute('src'); return Promise.resolve(); }
    img.src = url;
    const ready = img.decode().catch(() => media.classList.add('is-fallback'));
    return Promise.race([ready, new Promise((r) => setTimeout(r, 4000))]);
  }

  /* ── Karte in eine Ebene schreiben ── */
  function fillCard(layer, it, pos, total) {
    const q = (s) => layer.querySelector(s);
    layer.dataset.cat = SLUG[it.category];
    q('.news__pill').textContent = it.category;
    q('.news__badge').hidden = !isNew(it.published_at);
    q('.news__pos').textContent = `${pos} / ${total}`;
    q('.news__title').textContent = it.title;
    q('.news__summary').textContent = it.summary || '';
    q('.news__source').textContent = it.source || '';
    q('.news__time').textContent = relTime(it.published_at);
    const qr = q('.news__qr');
    qr.hidden = !it.qr;
    if (it.qr) {
      const qi = qr.querySelector('img');
      qi.onerror = () => { qr.hidden = true; };
      qi.src = resolve(it.qr);
    }
    fitText(layer);
    return setImage(q('.news__img'), q('.news__media'), it.image && resolve(it.image));
  }

  /* Lange Titel + Texte dürfen den Fuss (QR) nie über den Fortschrittsbalken
     drücken: Summary zeilenweise kürzen, bis alles in die Karte passt. So bleibt
     der Abstand QR-Code → Balken auf jeder Karte gleich. */
  const MAX_SUMMARY_LINES = 6;
  function fitText(layer) {
    const body = layer.querySelector('.news__body');
    const sum = layer.querySelector('.news__summary');
    let lines = MAX_SUMMARY_LINES;
    sum.style.webkitLineClamp = lines;
    while (body.scrollHeight > body.clientHeight + 1 && lines > 2) {
      sum.style.webkitLineClamp = --lines;
    }
  }

  function fillEmpty(layer) {
    const q = (s) => layer.querySelector(s);
    layer.dataset.cat = 'empty';
    q('.news__pill').textContent = 'News';
    q('.news__badge').hidden = true;
    q('.news__pos').textContent = '';
    q('.news__title').textContent = 'Die nächsten Meldungen sind unterwegs';
    q('.news__summary').textContent =
      'Hier erscheinen laufend kuratierte Neuigkeiten zu künstlicher Intelligenz und Energie.';
    q('.news__source').textContent = 'Britney · News';
    q('.news__time').textContent = '';
    q('.news__qr').hidden = true;
    fitText(layer);
    return setImage(q('.news__img'), q('.news__media'), null);
  }

  /* ── Überblenden: alte Ebene raus, neue rein; Ken-Burns + Fortschritt ── */
  /* Aufräumen passiert deterministisch zu Beginn jedes Wechsels (nicht per
     onfinish — das feuert z. B. in verdeckten Tabs nicht zuverlässig). So hängen
     nie mehr als ~5 Animationen am Widget, egal wie lange der Kiosk läuft. */
  function crossfade(next, prev, withProgress) {
    const opts = { duration: FADE_MS, easing: 'ease-in-out', fill: 'forwards' };
    /* verdeckte Ebene: alles Alte (Fade-out, Ken-Burns) weg */
    for (const an of next.getAnimations({ subtree: true })) an.cancel();
    next.style.opacity = '0';
    /* sichtbare Ebene: Fade-in ist durch → Endwert fixieren, Ken-Burns läuft weiter */
    if (prev._fade) { prev._fade.cancel(); prev._fade = null; }
    prev.style.opacity = prev._shown ? '1' : '0';

    next.style.zIndex = '2';
    prev.style.zIndex = '1';
    next._fade = next.animate([{ opacity: 0 }, { opacity: 1 }], opts);
    prev._fade = prev.animate([{ opacity: +prev.style.opacity }, { opacity: 0 }], opts);
    next._shown = true;
    prev._shown = false;

    if (!reduced) {
      next.querySelector('.news__img').animate(
        [{ transform: 'scale(1.0) translate3d(0,0,0)' },
         { transform: 'scale(1.08) translate3d(-1.5%,-1%,0)' }],
        { duration: ROTATE_MS + FADE_MS * 2, easing: 'linear', fill: 'forwards' });
    }

    for (const an of fill.getAnimations()) an.cancel();
    fill.parentElement.hidden = !withProgress;
    if (withProgress) {
      fill.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
        { duration: ROTATE_MS, easing: 'linear', fill: 'forwards' });
    }
  }

  /* ── Nächste Karte ── */
  async function advance() {
    clearTimeout(timer);
    timer = null;
    const my = ++token;

    if (pending) {
      const curId = items && idx >= 0 ? items[idx].id : null;
      items = pending;
      pending = null;
      /* nach Reload an der gleichen Meldung weitermachen, sonst von vorn */
      idx = curId ? items.findIndex((it) => it.id === curId) : -1;
    }

    const next = layers[1 - front];
    const prev = layers[front];

    if (!items) {
      if (showing !== 'empty') {
        await fillEmpty(next);
        if (my !== token) return;
        crossfade(next, prev, false);
        front = 1 - front;
        showing = 'empty';
      }
      timer = setTimeout(advance, ROTATE_MS);
      return;
    }

    idx = (idx + 1) % items.length;
    await fillCard(next, items[idx], idx + 1, items.length);
    if (my !== token) return;
    crossfade(next, prev, true);
    front = 1 - front;
    showing = 'card';

    /* Bild der übernächsten Karte vorladen */
    const up = items[(idx + 1) % items.length];
    if (up && up.image) preloader.src = resolve(up.image);

    timer = setTimeout(advance, ROTATE_MS);
  }

  /* ── Start ── */
  load().finally(() => { if (!showing) advance(); });
  setInterval(load, N.reloadMinutes * 60_000);
  /* Webfont kommt evtl. nach der ersten Messung → dann und bei Grössenänderung neu einpassen */
  if (document.fonts) document.fonts.ready.then(() => layers.forEach(fitText));
  window.addEventListener('resize', () => layers.forEach(fitText));

  if (window.britney) window.britney.nextNews = advance;
})();
