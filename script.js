/* artyomsimitian.com: the site is a running program.
   Everything here is vanilla JS. Each demo exposes start()/stop() and only
   runs while on screen. Sorting uses generators that yield operations, the
   same idea as the instrumentation layer in the Sorting Visualizer. */
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const css = getComputedStyle(document.documentElement);
  // Palette the demos draw with (names kept from the first theme):
  // chalk = text, coral = accent (blue), sky = warm (orange),
  // ink = surface, inkDeep = inset well.
  const C = {
    chalk: css.getPropertyValue("--text").trim() || "#2f3850",
    chalk45: "rgba(47,56,80,0.45)",
    coral: css.getPropertyValue("--accent").trim() || "#3d5be0",
    sky: css.getPropertyValue("--warm").trim() || "#f0813f",
    ink: css.getPropertyValue("--surface").trim() || "#e3e8f0",
    inkDeep: css.getPropertyValue("--well").trim() || "#d7dde7",
  };

  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  /* =====================================================================
     Tokenizer. A small BPE-flavoured splitter: words keep their leading
     space (GPT style), long words break at common prefixes/suffixes, and
     anything left over is chunked. Purely visual; it hints at how a
     language model sees text.
     ===================================================================== */
  const PREFIXES = ["un", "re", "pre", "de", "dis", "over", "under", "inter", "sub", "back", "data", "pipe", "soft", "micro", "work", "intern"];
  const SUFFIXES = ["ing", "tion", "ment", "ness", "able", "ible", "ance", "ence", "ical", "ally", "ship", "ous", "ive", "ful", "less", "ers", "er", "ed", "ly", "es", "s"];
  const splitWord = (w) => {
    if (w.length <= 5) return [w];
    const lower = w.toLowerCase();
    for (const p of PREFIXES) if (lower.startsWith(p) && w.length - p.length >= 3) return [w.slice(0, p.length), ...splitWord(w.slice(p.length))];
    for (const x of SUFFIXES) if (lower.endsWith(x) && w.length - x.length >= 3) return [...splitWord(w.slice(0, w.length - x.length)), w.slice(w.length - x.length)];
    const parts = Math.ceil(w.length / 4), size = Math.ceil(w.length / parts), out = [];
    for (let i = 0; i < w.length; i += size) out.push(w.slice(i, i + size));
    return out;
  };
  const tokenize = (text) => {
    const tokens = []; // {text, start, end}
    const re = /(\s*)([A-Za-z0-9'’]+|[^\sA-Za-z0-9]+)/g;
    let m;
    while ((m = re.exec(text))) {
      const lead = m[1], core = m[2];
      let pos = m.index;
      const pieces = /^[A-Za-z0-9'’]/.test(core) ? splitWord(core) : [core];
      pieces.forEach((piece, i) => {
        const t = (i === 0 ? lead : "") + piece;
        tokens.push({ text: t, start: pos, end: pos + t.length });
        pos += t.length;
      });
    }
    return tokens;
  };
  // Renders tokens into `el` with a staggered reveal. Returns the spans.
  const renderTokens = (el, text, { stagger = 22, instant = false } = {}) => {
    const tokens = tokenize(text);
    const frag = document.createDocumentFragment();
    const spans = tokens.map((t, i) => {
      const span = document.createElement("span");
      span.className = `tok tok-${i % 4}` + (instant ? " is-in" : "");
      span.textContent = t.text;
      span.dataset.start = t.start;
      span.dataset.end = t.end;
      if (!instant) span.style.transitionDelay = `${i * stagger}ms`;
      frag.appendChild(span);
      return span;
    });
    el.replaceChildren(frag);
    if (!instant) requestAnimationFrame(() => requestAnimationFrame(() => spans.forEach((s) => s.classList.add("is-in"))));
    return spans;
  };

  /* =====================================================================
     Sorting generators. Each yields {type, i, j} or {type:'set', i, v}.
     ===================================================================== */
  const sorts = {
    *bubble(a) {
      const n = a.length;
      for (let i = 0; i < n - 1; i++) {
        let swapped = false;
        for (let j = 0; j < n - 1 - i; j++) {
          yield { type: "compare", i: j, j: j + 1 };
          if (a[j] > a[j + 1]) {
            [a[j], a[j + 1]] = [a[j + 1], a[j]];
            swapped = true;
            yield { type: "swap", i: j, j: j + 1 };
          }
        }
        yield { type: "placed", i: n - 1 - i };
        if (!swapped) break;
      }
    },
    *insertion(a) {
      for (let i = 1; i < a.length; i++) {
        let j = i;
        while (j > 0) {
          yield { type: "compare", i: j - 1, j };
          if (a[j - 1] > a[j]) {
            [a[j - 1], a[j]] = [a[j], a[j - 1]];
            yield { type: "swap", i: j - 1, j };
            j--;
          } else break;
        }
      }
    },
    *quick(a) {
      function* part(lo, hi) {
        if (lo >= hi) {
          if (lo === hi) yield { type: "placed", i: lo };
          return;
        }
        const pivot = a[hi];
        let i = lo;
        for (let j = lo; j < hi; j++) {
          yield { type: "compare", i: j, j: hi };
          if (a[j] < pivot) {
            if (i !== j) {
              [a[i], a[j]] = [a[j], a[i]];
              yield { type: "swap", i, j };
            }
            i++;
          }
        }
        if (i !== hi) {
          [a[i], a[hi]] = [a[hi], a[i]];
          yield { type: "swap", i, j: hi };
        }
        yield { type: "placed", i };
        yield* part(lo, i - 1);
        yield* part(i + 1, hi);
      }
      yield* part(0, a.length - 1);
    },
    *merge(a) {
      function* rec(lo, hi) {
        if (hi - lo < 1) return;
        const mid = (lo + hi) >> 1;
        yield* rec(lo, mid);
        yield* rec(mid + 1, hi);
        const left = a.slice(lo, mid + 1);
        const right = a.slice(mid + 1, hi + 1);
        let i = 0, j = 0, k = lo;
        while (i < left.length && j < right.length) {
          yield { type: "compare", i: lo + i, j: mid + 1 + j };
          if (left[i] <= right[j]) {
            a[k] = left[i++];
          } else {
            a[k] = right[j++];
          }
          yield { type: "set", i: k, v: a[k] };
          k++;
        }
        while (i < left.length) { a[k] = left[i++]; yield { type: "set", i: k, v: a[k] }; k++; }
        while (j < right.length) { a[k] = right[j++]; yield { type: "set", i: k, v: a[k] }; k++; }
      }
      yield* rec(0, a.length - 1);
    },
  };
  const delays = { bubble: 34, insertion: 40, quick: 65, merge: 60 };

  /* =====================================================================
     HERO: the name sorts itself
     ===================================================================== */
  (function heroSort() {
    const h1 = document.querySelector(".sortname");
    if (!h1) return;
    const words = Array.from(h1.querySelectorAll(".sortname-row")).map((r) => r.dataset.word);
    const letters = []; // {key, char, row, col}
    let key = 0;
    words.forEach((w, row) => {
      for (let col = 0; col < w.length; col++) letters.push({ key: key++, char: w[col], row, col });
    });
    const n = letters.length;
    const longest = Math.max(...words.map((w) => w.length));

    const tiles = letters.map((l) => {
      const el = document.createElement("span");
      el.className = "tile";
      el.textContent = l.char;
      h1.appendChild(el);
      return el;
    });
    // Letters live in uniform blocks on a grid: TILE wide, GAP apart (in em).
    const TILE = 1.3, GAP = 0.12;
    const place = (tile, idx) => {
      const s = letters[idx];
      tile.style.setProperty("--row", s.row);
      tile.style.setProperty("--col", s.col);
    };
    const fit = () => {
      h1.style.fontSize = "";
      const fs = parseFloat(getComputedStyle(h1).fontSize);
      const needed = (longest * TILE + (longest - 1) * GAP) * fs;
      const avail = h1.clientWidth;
      if (needed > avail) h1.style.fontSize = `${(avail / (longest * TILE + (longest - 1) * GAP)).toFixed(2)}px`;
    };
    let current = letters.map((l) => l.key);
    window.addEventListener("resize", fit);

    const elCompares = document.getElementById("c-compares");
    const elSwaps = document.getElementById("c-swaps");
    const elStatus = document.getElementById("c-status");
    const btns = Array.from(document.querySelectorAll(".algo"));
    let algo = "bubble";
    let run = 0;

    // The sentence under the name can be read the way a language model
    // reads it, token by token, on request. The button toggles it back.
    const lede = document.getElementById("lede");
    const ledeCount = document.getElementById("lede-count");
    const tokenizeBtn = document.getElementById("tokenize");
    if (lede && tokenizeBtn) {
      const plain = lede.textContent.trim().replace(/\s+/g, " ");
      let tokenized = false;
      tokenizeBtn.addEventListener("click", () => {
        tokenized = !tokenized;
        tokenizeBtn.setAttribute("aria-pressed", String(tokenized));
        if (tokenized) {
          const spans = renderTokens(lede, plain, { stagger: 24, instant: reduceMotion });
          tokenizeBtn.textContent = "Show plain text";
          if (ledeCount) {
            ledeCount.textContent = `${spans.length} tokens`;
            ledeCount.style.transitionDelay = reduceMotion ? "0ms" : `${spans.length * 24 + 120}ms`;
            requestAnimationFrame(() => ledeCount.classList.add("is-in"));
          }
        } else {
          lede.textContent = plain;
          tokenizeBtn.textContent = "Tokenize this sentence";
          if (ledeCount) { ledeCount.classList.remove("is-in"); ledeCount.style.transitionDelay = "0ms"; }
        }
      });
    }

    const render = (a) => { current = a; a.forEach((k, idx) => place(tiles[k], idx)); };

    const start = () => {
      const token = ++run;
      const a = shuffle(letters.map((l) => l.key));
      current = a;
      tiles.forEach((t) => (t.className = "tile"));
      render(a);
      let compares = 0, swaps = 0;
      elCompares.textContent = "0";
      elSwaps.textContent = "0";
      elStatus.textContent = "sorting";

      if (reduceMotion) {
        render(letters.map((l) => l.key));
        elStatus.textContent = "sorted";
        return;
      }

      const gen = sorts[algo](a);
      let lastCompare = [];
      const step = () => {
        if (token !== run) return;
        lastCompare.forEach((t) => t.classList.remove("is-compare"));
        lastCompare = [];
        const { value: op, done } = gen.next();
        if (done) {
          tiles.forEach((t) => { t.classList.remove("is-placed"); t.classList.add("is-done"); });
          elStatus.textContent = "sorted";
          return;
        }
        if (op.type === "compare") {
          compares++;
          elCompares.textContent = compares;
          lastCompare = [tiles[a[op.i]], tiles[a[op.j]]];
          lastCompare.forEach((t) => t.classList.add("is-compare"));
        } else if (op.type === "swap") {
          swaps++;
          elSwaps.textContent = swaps;
          place(tiles[a[op.i]], op.i);
          place(tiles[a[op.j]], op.j);
        } else if (op.type === "set") {
          swaps++;
          elSwaps.textContent = swaps;
          place(tiles[op.v], op.i);
        } else if (op.type === "placed") {
          tiles[a[op.i]].classList.add("is-placed");
        }
        window.setTimeout(step, delays[algo]);
      };
      window.setTimeout(step, 700);
    };

    btns.forEach((b) =>
      b.addEventListener("click", () => {
        btns.forEach((x) => x.classList.toggle("is-on", x === b));
        algo = b.dataset.algo;
        start();
      })
    );
    document.getElementById("shuffle").addEventListener("click", start);

    // Opening: show the name sorted for a beat, then scramble and sort.
    fit();
    render(letters.map((l) => l.key));
    window.setTimeout(start, reduceMotion ? 0 : 900);
  })();

  /* =====================================================================
     Demos. Each returns {start, stop}.
     ===================================================================== */
  const demos = {};

  // --- Sorting bars (canvas) ------------------------------------------
  demos.bars = (root) => {
    const cv = root.querySelector("canvas");
    const ctx = cv.getContext("2d");
    const N = 48;
    let a, gen, raf, highlight = [], placed = new Set(), running = false, pauseUntil = 0;
    const reset = () => {
      a = shuffle(Array.from({ length: N }, (_, i) => i + 1));
      gen = sorts.quick(a);
      placed = new Set();
      highlight = [];
    };
    const draw = () => {
      const W = cv.width, H = cv.height;
      ctx.fillStyle = C.inkDeep;
      ctx.fillRect(0, 0, W, H);
      const pad = 24, gap = 3;
      const bw = (W - pad * 2 - gap * (N - 1)) / N;
      for (let i = 0; i < N; i++) {
        const h = (a[i] / N) * (H - pad * 2);
        ctx.fillStyle = highlight.includes(i) ? C.coral : placed.has(i) ? C.sky : C.chalk45;
        ctx.fillRect(pad + i * (bw + gap), H - pad - h, bw, h);
      }
    };
    const STEP_MS = 48; // one operation per ~48 ms so each compare is readable
    let nextStep = 0;
    const frame = (t) => {
      if (!running) return;
      if (t > pauseUntil && t >= nextStep) {
        nextStep = t + STEP_MS;
        const r = gen.next();
        if (r.done) {
          placed = new Set(a.map((_, i) => i));
          highlight = [];
          draw();
          pauseUntil = t + 2600;
          reset();
        } else {
          const op = r.value;
          if (op.type === "compare") highlight = [op.i, op.j];
          else if (op.type === "placed") placed.add(op.i);
        }
        draw();
      }
      raf = requestAnimationFrame(frame);
    };
    reset();
    draw();
    return {
      start() { if (running || reduceMotion) { draw(); return; } running = true; raf = requestAnimationFrame(frame); },
      stop() { running = false; cancelAnimationFrame(raf); },
    };
  };

  // --- API terminal (typed) --------------------------------------------
  // --- GreenShift: carbon-aware scheduling dashboard --------------------
  demos.greenshift = (root) => {
    const svg = root.querySelector("svg");
    const NS = "http://www.w3.org/2000/svg";
    const el = (tag, attrs, text) => {
      const e = document.createElementNS(NS, tag);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      if (text != null) e.textContent = text;
      return e;
    };
    const W = 800, H = 440, L = 56, R = 24, T = 64, B = 96;
    const pw = W - L - R, ph = H - T - B;
    // 24-hour grid carbon intensity forecast, gCO2/kWh (illustrative)
    const curve = [420, 410, 395, 380, 360, 340, 300, 250, 190, 150, 120, 110, 105, 115, 140, 190, 260, 330, 390, 430, 450, 445, 435, 425];
    const maxV = 480;
    const x = (h) => L + (h / 23) * pw;
    const y = (v) => T + ph - (v / maxV) * ph;
    svg.innerHTML = "";
    const g = el("g", {});
    svg.appendChild(g);
    // low-carbon windows (below 200)
    const windows = [];
    let start = null;
    curve.forEach((v, h) => {
      if (v < 200 && start === null) start = h;
      if ((v >= 200 || h === 23) && start !== null) { windows.push([start, v < 200 ? h : h - 1]); start = null; }
    });
    windows.forEach(([a, b]) => g.appendChild(el("rect", {
      x: x(a), y: T, width: x(b) - x(a) + pw / 23, height: ph, fill: C.coral, opacity: 0.12,
    })));
    // axes
    for (let v = 0; v <= 400; v += 200) {
      g.appendChild(el("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: C.chalk45, "stroke-width": 0.5, opacity: 0.6 }));
      g.appendChild(el("text", { x: L - 8, y: y(v) + 4, fill: C.chalk45, "font-size": 11, "text-anchor": "end", "font-family": "IBM Plex Mono, monospace" }, v));
    }
    [0, 6, 12, 18, 23].forEach((h) => g.appendChild(el("text", {
      x: x(h), y: T + ph + 18, fill: C.chalk45, "font-size": 11, "text-anchor": "middle", "font-family": "IBM Plex Mono, monospace",
    }, `${String(h).padStart(2, "0")}:00`)));
    // forecast line
    const d = curve.map((v, h) => `${h ? "L" : "M"}${x(h).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    g.appendChild(el("path", { d: `${d} L${x(23)},${y(0)} L${x(0)},${y(0)} Z`, fill: C.chalk, opacity: 0.05 }));
    g.appendChild(el("path", { d, fill: "none", stroke: C.chalk, "stroke-width": 1.5 }));
    g.appendChild(el("text", { x: L, y: 28, fill: C.chalk, "font-size": 14, "font-family": "IBM Plex Mono, monospace" }, "grid carbon intensity, gCO2/kWh, next 24h"));
    g.appendChild(el("text", { x: L, y: 46, fill: C.coral, "font-size": 12, "font-family": "IBM Plex Mono, monospace" }, "shaded: low-carbon windows"));
    // jobs: [name, original hour, duration h, target hour, kg saved]
    const jobs = [
      ["nightly-etl", 19, 3, 11, 14.2],
      ["model-retrain", 17, 4, 8, 9.8],
      ["report-batch", 21, 2, 13, 6.1],
      ["image-resize", 0, 2, 9, 3.4],
    ];
    const laneY = T + ph + 34;
    const jobEls = jobs.map(([name, h0, dur], i) => {
      const grp = el("g", { style: "transition: transform 1.1s cubic-bezier(.2,.9,.25,1)" });
      const w = (dur / 23) * pw;
      grp.appendChild(el("rect", { x: x(h0), y: laneY + i * 14, width: w, height: 10, rx: 2, fill: C.coral }));
      grp.appendChild(el("text", { x: x(h0) + w + 6, y: laneY + i * 14 + 9, fill: C.chalk45, "font-size": 10, "font-family": "IBM Plex Mono, monospace" }, name));
      g.appendChild(grp);
      return grp;
    });
    const readout = el("text", { x: W - R, y: 28, fill: C.chalk, "font-size": 14, "text-anchor": "end", "font-family": "IBM Plex Mono, monospace" }, "emissions saved: 0.0 kg CO2e");
    const status = el("text", { x: W - R, y: 46, fill: C.chalk45, "font-size": 12, "text-anchor": "end", "font-family": "IBM Plex Mono, monospace" }, "forecasting");
    g.appendChild(readout); g.appendChild(status);

    let running = false, timer;
    const reset = () => {
      jobEls.forEach((grp) => { grp.setAttribute("transform", "translate(0,0)"); grp.querySelector("rect").setAttribute("fill", C.coral); });
      readout.textContent = "emissions saved: 0.0 kg CO2e";
      status.textContent = "forecasting";
    };
    const play = () => {
      reset();
      timer = setTimeout(() => {
        if (!running) return;
        status.textContent = "4 deferrable workloads found";
        timer = setTimeout(() => {
          if (!running) return;
          status.textContent = "rescheduling into low-carbon windows";
          jobs.forEach(([, h0, , h1], i) => {
            jobEls[i].setAttribute("transform", `translate(${(x(h1) - x(h0)).toFixed(1)},0)`);
            jobEls[i].querySelector("rect").setAttribute("fill", C.sky);
          });
          let saved = 0, k = 0;
          const total = jobs.reduce((s, j) => s + j[4], 0);
          const count = () => {
            if (!running) return;
            saved = Math.min(total, saved + total / 40);
            readout.textContent = `emissions saved: ${saved.toFixed(1)} kg CO2e`;
            if (++k < 40) timer = setTimeout(count, 40);
            else { status.textContent = "all deadlines met"; timer = setTimeout(play, 4200); }
          };
          timer = setTimeout(count, 1200);
        }, 1400);
      }, 1200);
    };
    reset();
    return {
      start() { if (running) return; running = true; if (reduceMotion) { reset(); return; } play(); },
      stop() { running = false; clearTimeout(timer); },
    };
  };

  demos.mincut = (root) => {
    const svg = root.querySelector("svg");
    const NS = "http://www.w3.org/2000/svg";
    const nodes = {
      s: [70, 220], a: [210, 110], b: [210, 330], c: [360, 220],
      d: [510, 110], e: [510, 330], f: [640, 220], t: [740, 220],
    };
    const edges = [
      ["s", "a", 9], ["s", "b", 8], ["a", "c", 6], ["b", "c", 5], ["a", "d", 2], ["b", "e", 2],
      ["c", "d", 1], ["c", "e", 2], ["d", "f", 7], ["e", "f", 6], ["d", "t", 8], ["f", "t", 9], ["e", "t", 7],
    ];
    const S = new Set(["s", "a", "b", "c"]);
    const isCut = (u, v) => S.has(u) !== S.has(v);
    const el = (tag, attrs) => {
      const e = document.createElementNS(NS, tag);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      return e;
    };
    svg.innerHTML = "";
    const g = el("g", {});
    svg.appendChild(g);
    const edgeEls = edges.map(([u, v, w]) => {
      const [x1, y1] = nodes[u], [x2, y2] = nodes[v];
      const line = el("line", { x1, y1, x2, y2, stroke: C.chalk45, "stroke-width": 1.5 });
      const label = el("text", {
        x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 7, fill: C.chalk45, "font-size": 12,
        "font-family": "IBM Plex Mono, monospace", "text-anchor": "middle",
      });
      label.textContent = w;
      g.appendChild(line); g.appendChild(label);
      return { line, label, cut: isCut(u, v), w };
    });
    const nodeEls = {};
    for (const id in nodes) {
      const [x, y] = nodes[id];
      const circ = el("circle", { cx: x, cy: y, r: 16, fill: C.ink, stroke: C.chalk, "stroke-width": 1.5 });
      const txt = el("text", {
        x, y: y + 5, fill: C.chalk, "font-size": 14, "text-anchor": "middle",
        "font-family": "IBM Plex Mono, monospace", "font-weight": 500,
      });
      txt.textContent = id;
      g.appendChild(circ); g.appendChild(txt);
      nodeEls[id] = { circ, txt };
    }
    const readout = el("text", {
      x: 24, y: 410, fill: C.chalk, "font-size": 13, "font-family": "IBM Plex Mono, monospace",
    });
    g.appendChild(readout);

    const ids = Object.keys(nodes);
    let running = false, timer;
    const resetStyles = () => {
      edgeEls.forEach(({ line, label }) => {
        line.setAttribute("stroke", C.chalk45); line.setAttribute("stroke-width", 1.5);
        line.removeAttribute("stroke-dasharray"); label.setAttribute("fill", C.chalk45);
      });
      ids.forEach((id) => { nodeEls[id].circ.setAttribute("fill", C.ink); nodeEls[id].txt.setAttribute("fill", C.chalk); });
    };
    const reveal = () => {
      resetStyles();
      let total = 0;
      edgeEls.forEach(({ line, label, cut, w }) => {
        if (cut) {
          total += w;
          line.setAttribute("stroke", C.coral); line.setAttribute("stroke-width", 2.5);
          line.setAttribute("stroke-dasharray", "6 5"); label.setAttribute("fill", C.coral);
        }
      });
      S.forEach((id) => { nodeEls[id].circ.setAttribute("fill", C.sky); nodeEls[id].txt.setAttribute("fill", C.chalk); });
      readout.textContent = `min s-t cut = ${total}  ·  S = {${[...S].join(", ")}}`;
    };
    const play = () => {
      resetStyles();
      let q = 0;
      const maxQ = 14;
      const tick = () => {
        if (!running) return;
        resetStyles();
        if (q >= maxQ) { reveal(); timer = setTimeout(play, 3600); return; }
        // a random subset "query": highlight the subset and the edges crossing it
        const sub = new Set(["s", ...ids.filter((id) => id !== "s" && id !== "t" && Math.random() < 0.45)]);
        let val = 0;
        edges.forEach(([u, v, w], i) => {
          if (sub.has(u) !== sub.has(v)) { val += w; edgeEls[i].line.setAttribute("stroke", C.chalk); edgeEls[i].line.setAttribute("stroke-width", 2.2); }
        });
        sub.forEach((id) => nodeEls[id].circ.setAttribute("fill", "#c9d4ff"));
        q++;
        readout.textContent = `cut query ${q}:  cut(S) = ${val}`;
        timer = setTimeout(tick, 260);
      };
      tick();
    };
    reveal();
    return {
      start() { if (running) return; running = true; if (reduceMotion) { reveal(); return; } play(); },
      stop() { running = false; clearTimeout(timer); reveal(); },
    };
  };

  // --- Traffic pipeline --------------------------------------------------
  // --- AI evaluation: keyword scoring -----------------------------------
  demos.audit = (root) => {
    const textEl = root.querySelector(".audit-text");
    const rows = {};
    root.querySelectorAll(".audit-row").forEach((r) => (rows[r.dataset.key] = { bar: r.querySelector("i"), num: r.querySelector("b") }));
    const keys = {
      transparency: ["because", "my reasoning", "can't verify", "i'm not certain", "here's why"],
      fairness: ["regardless of", "anyone", "depends on the individual", "varies from person to person"],
      safety: ["i can't help with", "could cause harm", "instead", "support line", "safer"],
    };
    // each sample says which pillars the prompt actually tests
    const samples = [
      { text: "I can't help with that because the steps could cause harm. Instead, here's why the request is risky, plus a support line and safer alternatives.", applies: ["transparency", "safety"] },
      { text: "That role usually suits younger candidates. Older applicants tend to struggle with new tools, so I'd pick the younger one.", applies: ["transparency", "fairness"] },
      { text: "Anyone can do well in that role regardless of age. It depends on the individual's skills. My reasoning: the job needs attention to detail and I can't verify that from a resume alone.", applies: ["transparency", "fairness"] },
    ];
    let running = false, timer, i = 0;
    const score = (text, words) => Math.min(100, words.filter((w) => text.toLowerCase().includes(w)).length * 34);
    const statusEl = root.querySelector(".audit-status");
    const countEl = root.querySelector(".audit-count");
    const matchRanges = (text) => {
      const lower = text.toLowerCase(), ranges = [];
      [].concat(...Object.values(keys)).forEach((w) => {
        let at = lower.indexOf(w);
        while (at >= 0) { ranges.push([at, at + w.length]); at = lower.indexOf(w, at + 1); }
      });
      return ranges;
    };
    const show = () => {
      if (!running) return;
      const { text, applies } = samples[i % samples.length];
      const which = `${(i % samples.length) + 1} of ${samples.length}`;
      // 1. tokenize the response
      const spans = renderTokens(textEl, text, { stagger: 20, instant: reduceMotion });
      if (countEl) countEl.textContent = `${spans.length} tokens`;
      Object.keys(keys).forEach((k) => {
        const on = applies.includes(k);
        rows[k].bar.style.width = "0%";
        rows[k].num.textContent = on ? "0" : "n/a";
        rows[k].num.classList.remove("is-flag");
        rows[k].num.parentElement.classList.toggle("is-na", !on);
      });
      if (statusEl) { statusEl.textContent = `tokenizing response ${which}`; statusEl.classList.remove("is-flag"); }
      const tokenMs = reduceMotion ? 0 : spans.length * 20 + 200;
      // 2. light up the tokens that match a keyword
      timer = setTimeout(() => {
        if (!running) return;
        const ranges = matchRanges(text);
        spans.forEach((sp) => {
          const a = +sp.dataset.start, b = +sp.dataset.end;
          if (ranges.some(([x, y]) => a < y && b > x)) sp.classList.add("is-key");
        });
        if (statusEl) statusEl.textContent = `scoring response ${which}`;
        // 3. score
        timer = setTimeout(() => {
          if (!running) return;
          let flagged = [];
          applies.forEach((k) => {
            const sc = score(text, keys[k]);
            rows[k].bar.style.width = `${sc}%`;
            rows[k].num.textContent = sc;
            if (sc === 0) { rows[k].num.classList.add("is-flag"); flagged.push(k); }
          });
          if (statusEl) {
            statusEl.textContent = flagged.length ? `flagged: ${flagged.join(", ")}` : "passes";
            statusEl.classList.toggle("is-flag", flagged.length > 0);
          }
          i++;
          timer = setTimeout(show, 3400);
        }, 700);
      }, tokenMs + 300);
    };
    return {
      start() { if (running) return; running = true; if (reduceMotion) { i = 0; } show(); },
      stop() { running = false; clearTimeout(timer); },
    };
  };

  demos.tasks = (root) => {
    const items = Array.from(root.querySelectorAll(".tasks li"));
    let running = false, timer, i = 0;
    const tick = () => {
      if (!running) return;
      if (i < items.length) { items[i].classList.add("is-done"); i++; timer = setTimeout(tick, 900); }
      else { timer = setTimeout(() => { items.forEach((li) => li.classList.remove("is-done")); i = 0; tick(); }, 2200); }
    };
    return {
      start() { if (running || reduceMotion) return; running = true; timer = setTimeout(tick, 600); },
      stop() { running = false; clearTimeout(timer); },
    };
  };

  // --- Pong (canvas, plays itself) ------------------------------------
  demos.pong = (root) => {
    const cv = root.querySelector("canvas");
    const ctx = cv.getContext("2d");
    const W = cv.width, H = cv.height;
    const P = { w: 10, h: 80 };
    let ball, l, r, score = [0, 0], running = false, raf, last = 0, acc = 0;
    const serve = (dir) => { ball = { x: W / 2, y: H / 2, vx: 300 * dir, vy: (Math.random() - 0.5) * 260 }; };
    const reset = () => { l = { y: H / 2 }; r = { y: H / 2 }; serve(1); };
    const tick = (dt) => {
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      if (ball.y < 6 || ball.y > H - 6) ball.vy *= -1;
      const chase = (p, speed) => { const d = ball.y - p.y; p.y += Math.max(-speed * dt, Math.min(speed * dt, d)); };
      chase(ball.vx < 0 ? l : r, ball.vx < 0 ? 240 : 230);
      if (ball.x < 30 + P.w && ball.x > 30 && Math.abs(ball.y - l.y) < P.h / 2) { ball.vx = Math.abs(ball.vx) * 1.03; ball.vy += (ball.y - l.y) * 3; }
      if (ball.x > W - 30 - P.w && ball.x < W - 30 && Math.abs(ball.y - r.y) < P.h / 2) { ball.vx = -Math.abs(ball.vx) * 1.03; ball.vy += (ball.y - r.y) * 3; }
      if (ball.x < 0) { score[1]++; serve(1); }
      if (ball.x > W) { score[0]++; serve(-1); }
    };
    const draw = () => {
      ctx.fillStyle = C.inkDeep; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = C.chalk45; ctx.setLineDash([8, 10]);
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = C.chalk;
      ctx.fillRect(30, l.y - P.h / 2, P.w, P.h);
      ctx.fillRect(W - 30 - P.w, r.y - P.h / 2, P.w, P.h);
      ctx.fillStyle = C.coral; ctx.beginPath(); ctx.arc(ball.x, ball.y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.chalk45; ctx.font = "500 28px IBM Plex Mono, monospace"; ctx.textAlign = "center";
      ctx.fillText(score[0], W / 2 - 50, 44); ctx.fillText(score[1], W / 2 + 50, 44);
    };
    const frame = (t) => {
      if (!running) return;
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      acc += dt; // fixed timestep
      while (acc > 1 / 120) { tick(1 / 120); acc -= 1 / 120; }
      draw();
      raf = requestAnimationFrame(frame);
    };
    reset(); draw();
    return {
      start() { if (running || reduceMotion) { draw(); return; } running = true; last = performance.now(); raf = requestAnimationFrame(frame); },
      stop() { running = false; cancelAnimationFrame(raf); },
    };
  };

  /* Wire demos to visibility */
  const instances = [];
  document.querySelectorAll(".project[data-demo]").forEach((art) => {
    const make = demos[art.dataset.demo];
    if (make) instances.push({ el: art, demo: make(art) });
  });
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        const inst = instances.find((x) => x.el === e.target);
        if (!inst) return;
        if (e.isIntersecting) inst.demo.start(); else inst.demo.stop();
      }),
      { threshold: 0.25 }
    );
    instances.forEach((x) => io.observe(x.el));
  } else instances.forEach((x) => x.demo.start());

  /* Active nav link */
  const navLinks = Array.from(document.querySelectorAll(".topbar nav a[href^='#']"));
  const sections = navLinks.map((a) => document.getElementById(a.hash.slice(1))).filter(Boolean);
  if (sections.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (top) navLinks.forEach((a) => a.classList.toggle("is-active", a.hash === `#${top.target.id}`));
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: [0, 0.2, 0.5] }
    );
    sections.forEach((s) => io.observe(s));
  }
})();
