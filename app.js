/* ============================================================
   Khane mein kya — UI shell
   Wires up moods / cuisine / chips / textarea / shuffle.
   Scoring + picking logic preserved from original.
   ============================================================ */

const state = {
  cuisine: "any",
  veg: new Set(),
  grain: new Set(),
  pulse: new Set(),
  text: "",
};
const tweaks = /*EDITMODE-BEGIN*/{
  "palette": "terracotta",
  "density": "cozy",
  "days": "1"
}/*EDITMODE-END*/;

let current = {};     // single-day pick:  slot -> item
let multiDay = [];    // 3-day mode: array of { dateLabel, dateMono, picks }

/* ============================================================
   RATINGS  (persisted in localStorage)
   Shape: { "Dish name": "like" | "skip" }
   Liked dishes get a strong score boost. Skipped dishes are filtered
   out unless the rest of the pool is empty.
   ============================================================ */
const RATINGS_KEY = "kmk:ratings:v1";
const RATINGS = (() => {
  try { return JSON.parse(localStorage.getItem(RATINGS_KEY) || "{}"); }
  catch { return {}; }
})();

function saveRatings() {
  try { localStorage.setItem(RATINGS_KEY, JSON.stringify(RATINGS)); }
  catch {}
}

function setRating(dishName, value) {
  // Tapping the same rating again clears it (toggle)
  if (RATINGS[dishName] === value) delete RATINGS[dishName];
  else RATINGS[dishName] = value;
  saveRatings();
}

function ratingCounts() {
  let liked = 0, skipped = 0;
  for (const k in RATINGS) {
    if (RATINGS[k] === "like") liked++;
    else if (RATINGS[k] === "skip") skipped++;
  }
  return { liked, skipped };
}

function clearAllRatings() {
  for (const k in RATINGS) delete RATINGS[k];
  saveRatings();
}

function updateFeedbackSummary() {
  const rc = ratingCounts();
  const block = document.querySelector('.feedback-summary');
  if (rc.liked === 0 && rc.skipped === 0) {
    if (block) block.remove();
    return;
  }
  if (!block) {
    // Re-render result to bring the summary in
    if (!document.getElementById('result').classList.contains('hidden')) renderResult();
    return;
  }
  block.querySelector('.fb-like').textContent = `♥ ${rc.liked} liked`;
  block.querySelector('.fb-skip').textContent = `✕ ${rc.skipped} skipped`;
}

/* ============================================================
   MOOD PRESETS (new)
   Each preset configures cuisine + free-text. Tap toggles.
   ============================================================ */
const MOODS = [
  { id: "any",     label: "Anything",       sub: "no filters",      glyph: "any",     cuisine: "any",      text: "" },
  { id: "light",   label: "Light & easy",   sub: "soup · khichdi",  glyph: "light",   cuisine: "any",      text: "something light" },
  { id: "quick",   label: "Weeknight rush", sub: "≤ 20 min",        glyph: "quick",   cuisine: "any",      text: "something quick, no soaking" },
  { id: "south",   label: "South Indian",   sub: "dosa · sambar",   glyph: "south",   cuisine: "Indian",   text: "south indian" },
  { id: "italian", label: "Pasta night",    sub: "italian",         glyph: "italian", cuisine: "Italian",  text: "" },
  { id: "asian",   label: "Asian flavour",  sub: "noodles · stir",  glyph: "asian",   cuisine: "Asian",    text: "" },
  { id: "fest",    label: "Weekend treat",  sub: "indulgent",       glyph: "fest",    cuisine: "any",      text: "weekend treat" },
];

const GLYPHS = {
  any:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="6"/></svg>',
  light:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 18s3-4 9-4 9 4 9 4"/><path d="M12 4v3"/></svg>',
  quick:   '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>',
  aaji:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3 4 9v4c0 5 4 8 8 8s8-3 8-8V9l-8-6z"/></svg>',
  south:   '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4" fill="#fff" opacity="0.4"/></svg>',
  italian: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12c2-2 4-2 4 0s-2 2 0 4M10 8c2-2 4-2 4 0s-2 2 0 4 2 2 4 0"/></svg>',
  asian:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M5 8l14 8M5 16l14-8"/></svg>',
  fest:    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 6.5L21 9l-5 4.5 1.5 7L12 17l-5.5 3.5L8 13.5 3 9l6.6-.5z"/></svg>',
};

const CUISINE_SWATCHES = {
  any:         "linear-gradient(45deg, #b3411d, #d99417, #5d7a3a, #6b3a4f)",
  Indian:      "#d35a2a",
  Asian:       "#5d7a3a",
  Mexican:     "#c43a3f",
  Italian:     "#6b3a4f",
  Continental: "#d99417",
};

const CUISINES = [
  { c: "any",         label: "Any" },
  { c: "Indian",      label: "Indian" },
  { c: "Asian",       label: "Asian" },
  { c: "Mexican",     label: "Mexican" },
  { c: "Italian",     label: "Italian" },
  { c: "Continental", label: "Continental" },
];

/* ============================================================
   HELPERS
   ============================================================ */
function titleCase(s) { return s.replace(/\b\w/g, c => c.toUpperCase()); }

function tomorrowDate(offset = 1) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
}
function fmtDate(d) {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}
function fmtDateMono(d) {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: '2-digit' }).toUpperCase();
}

/* Estimate cook time + effort from dish characteristics. New, lightweight. */
function effortFor(item) {
  const n = item.n.toLowerCase();
  if (/sandwich|toast|fruit|cereal|granola|nut mix|chaat|salad|sprouts|makhana|bhel|sukha|parfait|smoothie|chia pudding|pbj/.test(n)) return 10;
  if (/upma|poha|khichdi|chilla|tikki|paratha|porridge|pancake|wrap|roll|hummus|tabouleh|sevai|akki/.test(n)) return 20;
  if (/biryani|dosa|^idly|^idli|^adai|pesarattu|risotto|lasagna|enchilada|sushi|spring roll|momo|stuffed|fajita/.test(n)) return 45;
  if (/soup|rasam|sambar/.test(n)) return 25;
  return 30;
}

/* ============================================================
   RENDER: moods, cuisines, chips
   ============================================================ */
function renderMoods() {
  const wrap = document.getElementById('moods');
  wrap.innerHTML = '';
  MOODS.forEach(m => {
    const el = document.createElement('div');
    el.className = 'mood';
    el.dataset.id = m.id;
    el.innerHTML = `
      <div class="glyph" style="color: var(--terracotta)">${GLYPHS[m.glyph]}</div>
      <div>
        <div class="label">${m.label}</div>
        <div class="sub">${m.sub}</div>
      </div>`;
    el.onclick = () => applyMood(m);
    wrap.appendChild(el);
  });
}

function applyMood(m) {
  // Toggle visual selection
  document.querySelectorAll('.mood').forEach(x => x.classList.toggle('on', x.dataset.id === m.id));
  // Apply cuisine
  state.cuisine = m.cuisine;
  document.querySelectorAll('#cuisine .cui').forEach(x =>
    x.classList.toggle('on', x.dataset.c === m.cuisine));
  // Apply text (overwrites — moods are starting points)
  state.text = m.text;
  document.getElementById('freetext').value = m.text;
}

function renderCuisines() {
  const wrap = document.getElementById('cuisine');
  wrap.innerHTML = '';
  CUISINES.forEach(c => {
    const el = document.createElement('div');
    el.className = 'cui' + (c.c === state.cuisine ? ' on' : '');
    el.dataset.c = c.c;
    el.innerHTML = `
      <div class="swatch" style="background: ${CUISINE_SWATCHES[c.c]}"></div>
      <div class="name">${c.label}</div>`;
    el.onclick = () => {
      state.cuisine = c.c;
      document.querySelectorAll('#cuisine .cui').forEach(x => x.classList.remove('on'));
      el.classList.add('on');
    };
    wrap.appendChild(el);
  });
}

function makeChips(container, options, set, countId) {
  container.innerHTML = '';
  let inMore = false;
  let moreWrap = null;
  const countEl = countId ? document.getElementById(countId) : null;

  const updateCount = () => {
    if (!countEl) return;
    if (set.size) { countEl.textContent = `${set.size} selected`; countEl.classList.add('show'); }
    else { countEl.classList.remove('show'); }
  };

  for (const opt of options) {
    if (opt === "_more_") {
      inMore = true;
      moreWrap = document.createElement('span');
      moreWrap.className = 'hidden-chips';
      moreWrap.dataset.more = container.id + '-more';
      container.appendChild(moreWrap);
      continue;
    }
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = titleCase(opt);
    chip.dataset.val = opt;
    chip.onclick = () => {
      if (set.has(opt)) { set.delete(opt); chip.classList.remove('on'); }
      else { set.add(opt); chip.classList.add('on'); }
      updateCount();
    };
    (inMore ? moreWrap : container).appendChild(chip);
  }
  updateCount();
}

/* ============================================================
   SCORING + PICKING (unchanged from original)
   ============================================================ */
function parseText(t) {
  const s = t.toLowerCase();
  return {
    raw: s,
    noSoak: /\b(quick|fast|no\s*soak|easy|simple|in a hurry)\b/.test(s),
    noRice: /\bno\s*rice\b/.test(s),
    noWheat: /\b(no\s*wheat|no\s*roti|no\s*chapati|gluten)\b/.test(s),
    light: /\b(light|sick|kid is sick|fever|bland|comfort)\b/.test(s),
    southIndian: /\b(south|south\s*indian|tamil|udupi|mangalore)\b/.test(s),
    northIndian: /\b(north\s*indian|punjabi)\b/.test(s),
    tokens: s.split(/[^a-z]+/).filter(w => w.length > 2),
  };
}

function passesHard(item, t) {
  if (t.noSoak && item.soak) return false;
  if (t.noRice && (item.grain || []).includes("rice")) return false;
  if (t.noWheat && (item.grain || []).includes("wheat")) return false;
  if (t.light && item.dairy === "heavy") return false;
  if (RATINGS[item.n] === "skip") return false;        // filter out skipped dishes
  return true;
}

function score(item, slotKey, t) {
  let s = 0;
  if (state.cuisine !== "any" && (slotKey === "lunch" || slotKey === "dinner")) {
    if (item.cuisine !== state.cuisine) return -1;
  }
  if (state.veg.size && (item.veg || []).some(v => state.veg.has(v))) s += 3;
  if (state.grain.size && (item.grain || []).some(g => state.grain.has(g))) s += 3;
  if (state.pulse.size && (item.pulse || []).some(p => state.pulse.has(p))) s += 3;

  if (t.tokens.length) {
    const hay = (item.n + " " + (item.veg||[]).join(" ") + " " + (item.grain||[]).join(" ") + " " + (item.pulse||[]).join(" ")).toLowerCase();
    for (const tok of t.tokens) if (hay.includes(tok)) s += 1;
  }
  if (t.southIndian && /dosa|idly|idli|rasam|sambar|pongal|upma|appam/i.test(item.n)) s += 4;
  if (t.northIndian && /roti|paratha|paneer|chhole|rajma|kati|dal makhani|biryani/i.test(item.n)) s += 4;
  if (t.light && /soup|khichdi|rasam|porridge|fruit|salad/i.test(item.n)) s += 2;

  // Liked dishes get a strong boost — but soft, not absolute.
  if (RATINGS[item.n] === "like") s += 5;
  return s;
}

function weightedRandom(scored) {
  if (!scored.length) return null;
  const weights = scored.map(x => 1 + Math.max(0, x.s) * 1.5);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < scored.length; i++) {
    r -= weights[i];
    if (r <= 0) return scored[i].item;
  }
  return scored[scored.length - 1].item;
}

function pickForSlot(slotKey, t, excludeNames = []) {
  const ex = new Set(excludeNames);
  const candidates = MENU
    .filter(m => m.slot === slotKey)
    .filter(m => passesHard(m, t))
    .filter(m => !ex.has(m.n))
    .map(m => ({ item: m, s: score(m, slotKey, t) }))
    .filter(x => x.s >= 0);
  if (!candidates.length) {
    // First fallback: drop the chosen-already filter, keep the skipped filter.
    let loose = MENU.filter(m => m.slot === slotKey && !ex.has(m.n) && RATINGS[m.n] !== "skip");
    // Last-resort: ignore skips too, so we always return something.
    if (!loose.length) loose = MENU.filter(m => m.slot === slotKey && !ex.has(m.n));
    if (!loose.length) return null;
    return loose[Math.floor(Math.random() * loose.length)];
  }
  return weightedRandom(candidates);
}

function pickAll() {
  const t = parseText(state.text);
  const picks = {};
  for (const s of SLOTS) picks[s.key] = pickForSlot(s.key, t);
  return picks;
}

function pickMultiDay(days) {
  // For each slot, avoid repeating across days.
  const t = parseText(state.text);
  const out = [];
  const used = { breakfast: [], tiffin: [], lunch: [], snack: [], dinner: [] };
  for (let i = 0; i < days; i++) {
    const picks = {};
    for (const s of SLOTS) {
      const item = pickForSlot(s.key, t, used[s.key]);
      picks[s.key] = item;
      if (item) used[s.key].push(item.n);
    }
    const d = tomorrowDate(i + 1);
    out.push({ dateLabel: fmtDate(d), dateMono: fmtDateMono(d), picks });
  }
  return out;
}

function rerollSlot(slotKey, dayIdx = null) {
  const t = parseText(state.text);
  if (dayIdx === null) {
    const prev = current[slotKey] ? [current[slotKey].n] : [];
    current[slotKey] = pickForSlot(slotKey, t, prev);
  } else {
    const day = multiDay[dayIdx];
    const excludes = multiDay.map(d => d.picks[slotKey]?.n).filter(Boolean);
    day.picks[slotKey] = pickForSlot(slotKey, t, excludes);
  }
  renderResult();
}

/* ============================================================
   RENDER: the result menu card
   ============================================================ */
function dishMeta(item) {
  const time = effortFor(item);
  const pills = [];
  pills.push(`<span class="pill"><span class="swatch" style="background:${CUISINE_SWATCHES[item.cuisine]}"></span>${item.cuisine}</span>`);
  pills.push(`<span class="pill time">${time} min</span>`);
  if (item.protein === "high") pills.push(`<span class="pill protein-high">high protein</span>`);
  else if (item.protein === "med") pills.push(`<span class="pill">med protein</span>`);
  if (item.dairy === "heavy") pills.push(`<span class="pill">heavy dairy</span>`);
  else if (item.dairy === "light") pills.push(`<span class="pill">light dairy</span>`);
  return pills.join("");
}

function dishIngs(item) {
  const ings = [...(item.veg||[]), ...(item.grain||[]), ...(item.pulse||[])];
  if (!ings.length) return "";
  return `<div class="ings">${ings.slice(0, 6).join(" · ")}</div>`;
}

const SOURCE_LABELS = {
  chefandherkitchen: { name: "The Chef and Her Kitchen", url: "http://www.chefandherkitchen.com" },
  hebbarskitchen:    { name: "Hebbar's Kitchen",         url: "https://hebbarskitchen.com" },
};

function dishSource(item) {
  if (!item.src) return "";
  const s = SOURCE_LABELS[item.src];
  if (!s) return "";
  return `<div class="src">via <a href="${s.url}" target="_blank" rel="noopener">${s.name}</a></div>`;
}

function dishRating(item) {
  const r = RATINGS[item.n];
  return `
    <div class="rate" data-dish="${item.n.replace(/"/g, '&quot;')}">
      <button class="rate-btn ${r === 'like' ? 'on like' : ''}" data-act="like" aria-label="Liked">
        <span class="rate-icon">♥</span> Liked
      </button>
      <button class="rate-btn ${r === 'skip' ? 'on skip' : ''}" data-act="skip" aria-label="Not for me">
        <span class="rate-icon">✕</span> Not for me
      </button>
    </div>`;
}

/* Recipe URL resolution.
   - If the item has its own `url`, use that.
   - Else if the item has `src`, do a site-scoped Google search of that blog.
   - Else (original items): route by cuisine. Indian dishes search the
     Andhra/Karnataka home-cooking sources. Global cuisines (Italian /
     Mexican / Asian / Continental) search Indian chefs who do global
     adaptations — Sanjeev Kapoor and Ranveer Brar. */
function searchQuery(item) {
  // Strip "+ Roti / + Rice / (variant)" suffixes for cleaner search
  return item.n.split(/\s*[+(/]/)[0].trim();
}

function recipeUrl(item) {
  if (item.url) return item.url;
  const q = encodeURIComponent(searchQuery(item));
  if (item.src === "chefandherkitchen") {
    return `https://www.google.com/search?q=site%3Achefandherkitchen.com+${q}`;
  }
  if (item.src === "hebbarskitchen") {
    return `https://www.google.com/search?q=site%3Ahebbarskitchen.com+${q}`;
  }
  if (item.cuisine === "Indian") {
    return `https://www.google.com/search?q=${q}+recipe+(site%3Achefandherkitchen.com+OR+site%3Ahebbarskitchen.com+OR+site%3Aindianhealthyrecipes.com)`;
  }
  // Global cuisines — Indian chefs adapting global dishes
  return `https://www.google.com/search?q=${q}+recipe+(%22Sanjeev+Kapoor%22+OR+%22Ranveer+Brar%22)`;
}

function renderSlotsList(picks, dayIdx) {
  let html = "";
  SLOTS.forEach((s, i) => {
    const item = picks[s.key];
    const idxNum = String(i + 1).padStart(2, '0');
    if (!item) {
      html += `
        <div class="slot">
          <div class="idx">${idxNum}</div>
          <div>
            <div class="slot-label">${s.label}</div>
            <div class="empty">No match — try loosening filters.</div>
          </div>
          <div></div>
        </div>`;
      return;
    }
    const soakBadge = item.soak ? `<span class="soak-tag">soak tonight</span>` : '';
    const rerollAttr = dayIdx === null ? `data-slot="${s.key}"` : `data-slot="${s.key}" data-day="${dayIdx}"`;
    html += `
      <div class="slot">
        <div class="idx">${idxNum}</div>
        <div>
          <div class="slot-label">${s.label}</div>
          <div class="dish">${item.n}${soakBadge}</div>
          <div class="meta">${dishMeta(item)}</div>
          ${dishIngs(item)}
          ${dishSource(item)}
          ${dishRating(item)}
        </div>
        <div class="slot-actions">
          <a class="recipe-btn" href="${recipeUrl(item)}" target="_blank" rel="noopener">
            Recipe →
          </a>
          <button class="reroll" ${rerollAttr}>
            <span class="icon">↻</span> swap
          </button>
        </div>
      </div>`;
  });
  return html;
}

function collectSoakItems() {
  const items = [];
  if (tweaks.days === "1") {
    for (const s of SLOTS) {
      const it = current[s.key];
      if (it && it.soak) items.push(it.n);
    }
  } else {
    multiDay.forEach((day, di) => {
      for (const s of SLOTS) {
        const it = day.picks[s.key];
        if (it && it.soak && di === 0) items.push(it.n); // only tonight's soak matters
      }
    });
  }
  return items;
}

function renderResult() {
  const result = document.getElementById('result');
  result.classList.remove('hidden');
  const isMulti = tweaks.days === "3";

  let inner = `
    <div class="menu-head">
      <div class="kicker">Your plan</div>
      <h2>${isMulti ? "The next three days" : "Tomorrow's menu"}</h2>
      <div class="menu-date">${isMulti ? `${multiDay[0]?.dateMono || ''} → ${multiDay[multiDay.length-1]?.dateMono || ''}` : (current.__date || '')}</div>
      <div class="ornament"><span class="dia"></span></div>
    </div>`;

  const soaks = collectSoakItems();
  if (soaks.length) {
    inner += `
      <div class="soak-banner show">
        <div class="moon"></div>
        <div class="txt">
          <span class="lbl">Tonight</span>
          <b>Soak ${soaks.join(", ")}</b> before bed so it's ready for tomorrow.
        </div>
      </div>`;
  }

  if (!isMulti) {
    inner += `<div class="slots">${renderSlotsList(current, null)}</div>`;
  } else {
    multiDay.forEach((day, i) => {
      inner += `
        <div class="day-divider">
          <div class="dlabel">${day.dateLabel}</div>
          <div class="ddate">Day ${i + 1} of 3</div>
        </div>
        <div class="slots">${renderSlotsList(day.picks, i)}</div>`;
    });
  }

  // Feedback summary footer
  const rc = ratingCounts();
  if (rc.liked || rc.skipped) {
    inner += `
      <div class="feedback-summary">
        <div class="fb-counts">
          <span class="fb-like">♥ ${rc.liked} liked</span>
          <span class="fb-sep">·</span>
          <span class="fb-skip">✕ ${rc.skipped} skipped</span>
        </div>
        <button class="fb-clear" id="fb-clear-btn">Clear all ratings</button>
      </div>`;
  }

  result.innerHTML = inner;

  // Wire up rerolls
  result.querySelectorAll('.reroll').forEach(b => {
    const slot = b.dataset.slot;
    const day = b.dataset.day;
    b.onclick = () => rerollSlot(slot, day === undefined ? null : Number(day));
  });

  // Wire up rating buttons (event delegation per rate row)
  result.querySelectorAll('.rate').forEach(row => {
    const dish = row.dataset.dish;
    row.querySelectorAll('.rate-btn').forEach(btn => {
      btn.onclick = () => {
        setRating(dish, btn.dataset.act);
        // Update visual state in place — both buttons in this row
        const cur = RATINGS[dish];
        row.querySelectorAll('.rate-btn').forEach(b => {
          b.classList.remove('on', 'like', 'skip');
          if (cur && b.dataset.act === cur) b.classList.add('on', cur);
        });
        // Refresh the feedback summary line at the bottom
        updateFeedbackSummary();
      };
    });
  });

  // Wire up "Clear all ratings"
  const clearBtn = document.getElementById('fb-clear-btn');
  if (clearBtn) clearBtn.onclick = () => {
    if (!confirm('Clear all dish ratings? This cannot be undone.')) return;
    clearAllRatings();
    // Re-render so chips reset visually
    renderResult();
  };

  // Smooth scroll into view (avoid scrollIntoView — known to misbehave)
  setTimeout(() => {
    const top = result.getBoundingClientRect().top + window.scrollY - 20;
    window.scrollTo({ top, behavior: 'smooth' });
  }, 50);
}

/* ============================================================
   TWEAKS PANEL — host wiring
   ============================================================ */
function applyTweaks() {
  document.body.dataset.palette = tweaks.palette;
  document.body.dataset.density = tweaks.density;
  document.querySelectorAll('[data-tweak]').forEach(group => {
    const key = group.dataset.tweak;
    group.querySelectorAll('.tweaks-opt').forEach(o => {
      o.classList.toggle('on', o.dataset.val === String(tweaks[key]));
    });
  });
}

function setTweak(key, val) {
  tweaks[key] = val;
  applyTweaks();
  try {
    window.parent.postMessage({type: '__edit_mode_set_keys', edits: { [key]: val }}, '*');
  } catch (e) {}
  // If days mode changed and result is open, regenerate
  if (key === 'days' && !document.getElementById('result').classList.contains('hidden')) {
    runShuffle();
  }
}

function initTweaksPanel() {
  // Register listener BEFORE announcing availability
  window.addEventListener('message', (ev) => {
    if (!ev.data || typeof ev.data !== 'object') return;
    if (ev.data.type === '__activate_edit_mode') {
      document.getElementById('tweaks').classList.add('show');
    } else if (ev.data.type === '__deactivate_edit_mode') {
      document.getElementById('tweaks').classList.remove('show');
    }
  });
  // Announce
  try { window.parent.postMessage({type: '__edit_mode_available'}, '*'); } catch (e) {}

  // Close
  document.getElementById('tweaks-close').onclick = () => {
    document.getElementById('tweaks').classList.remove('show');
    try { window.parent.postMessage({type: '__edit_mode_dismissed'}, '*'); } catch (e) {}
  };

  // Wire options
  document.querySelectorAll('[data-tweak]').forEach(group => {
    const key = group.dataset.tweak;
    group.querySelectorAll('.tweaks-opt').forEach(o => {
      o.onclick = () => setTweak(key, o.dataset.val);
    });
  });

  applyTweaks();
}

/* ============================================================
   SHUFFLE + RESET
   ============================================================ */
function runShuffle() {
  if (tweaks.days === "3") {
    multiDay = pickMultiDay(3);
    current = {};
  } else {
    current = pickAll();
    current.__date = fmtDate(tomorrowDate(1));
    multiDay = [];
  }
  renderResult();
}

/* ============================================================
   INIT
   ============================================================ */
document.getElementById('datestamp').textContent = `Planning for ${fmtDate(tomorrowDate(1))}`;

renderMoods();
renderCuisines();
makeChips(document.getElementById('veg'),   VEG_OPTIONS,   state.veg,   'veg-count');
makeChips(document.getElementById('grain'), GRAIN_OPTIONS, state.grain, 'grain-count');
makeChips(document.getElementById('pulse'), PULSE_OPTIONS, state.pulse, null);

// Show-more toggles
document.querySelectorAll('.more-toggle').forEach(t => {
  t.onclick = () => {
    const tgt = t.dataset.target;
    const el = document.querySelector(`[data-more="${tgt}"]`);
    if (!el) return;
    el.classList.toggle('show');
    t.textContent = el.classList.contains('show')
      ? t.textContent.replace('↓','↑').replace('Show more','Hide')
      : t.textContent.replace('↑','↓').replace('Hide','Show more');
  };
});

// Free text + helpers
document.querySelectorAll('.text-help').forEach(h => {
  h.onclick = () => {
    const ta = document.getElementById('freetext');
    const add = h.dataset.add;
    ta.value = (ta.value.trim() ? ta.value.trim() + ", " : "") + add;
    state.text = ta.value;
  };
});
document.getElementById('freetext').oninput = e => state.text = e.target.value;

// Reset
document.getElementById('reset').onclick = () => {
  state.cuisine = "any";
  state.veg.clear(); state.grain.clear(); state.pulse.clear();
  state.text = "";
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
  document.querySelectorAll('.mood').forEach(c => c.classList.remove('on'));
  document.querySelectorAll('#cuisine .cui').forEach(x => x.classList.toggle('on', x.dataset.c === 'any'));
  document.getElementById('freetext').value = "";
  document.getElementById('result').classList.add('hidden');
  ['veg-count', 'grain-count'].forEach(id => document.getElementById(id).classList.remove('show'));
  window.scrollTo({top: 0, behavior: 'smooth'});
};

document.getElementById('shuffle').onclick = runShuffle;

initTweaksPanel();
