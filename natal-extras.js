// AI Read My Chart: the birth-chart-only data block.
// Wraps computeChart from chart.js (left untouched, it serves the paid products), drops Human Design and
// Gene Keys, and adds the reading aids the prompt relies on, so the AI reads them rather than works them out.
import { computeChart } from "./chart.js";

const SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
const ELEMENT = ["Fire", "Earth", "Air", "Water"];
const RULER = ["Mars", "Venus", "Mercury", "Moon", "Sun", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Saturn", "Jupiter"];
const PLANETS = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];
const CLASSICAL = PLANETS.slice(0, 7);
const HOME = { Sun: [4], Moon: [3], Mercury: [2, 5], Venus: [1, 6], Mars: [0, 7], Jupiter: [8, 11], Saturn: [9, 10] };
const EXALTED = { Sun: 0, Moon: 1, Mercury: 5, Venus: 11, Mars: 9, Jupiter: 3, Saturn: 6 };

const pmod = (x, m) => ((x % m) + m) % m;
const signOf = (lon) => Math.floor(pmod(lon, 360) / 30);
const sep = (a, b) => Math.abs(pmod(a - b + 180, 360) - 180);
const near = (a, b, angle, orb) => Math.abs(sep(a, b) - angle) <= orb;
const tight = (o) => (o < 1 ? "exact" : o < 3 ? "tight" : "moderate");
const list = (a, none = "none") => (a.length ? a.join("; ") : none);

export function standing(planet, sign) {
  const notes = [];
  if (HOME[planet].includes(sign)) notes.push("at home (it rules this sign)");
  if (EXALTED[planet] === sign) notes.push("exalted (an honoured guest in this sign)");
  if (HOME[planet].some((s) => (s + 6) % 12 === sign)) notes.push("in detriment (opposite the sign it rules)");
  if ((EXALTED[planet] + 6) % 12 === sign) notes.push("in fall (opposite the sign that honours it)");
  return notes.length ? notes.join(" and ") : "neutral ground";
}

// Follows each planet to the ruler of its sign, again and again, until the chain settles or loops.
export function rulerChains(pos, skipMoon = false) {
  const next = {};
  for (const p of CLASSICAL) next[p] = RULER[signOf(pos[p])];
  const chains = {}, ends = {};
  for (const start of CLASSICAL) {
    if (skipMoon && start === "Moon") continue;
    const path = [start];
    let cur = start, end = null;
    for (;;) {
      if (skipMoon && cur === "Moon") { end = "Moon's sign unknown"; break; }
      const n = next[cur];
      if (n === cur) { end = cur; break; }
      if (path.includes(n)) {
        const loop = path.slice(path.indexOf(n)).sort();
        end = loop.join(" and ");
        break;
      }
      path.push(n);
      cur = n;
    }
    chains[start] = path;
    (ends[end] = ends[end] || []).push(start);
  }
  const mutual = [];
  CLASSICAL.forEach((a, i) => CLASSICAL.slice(i + 1).forEach((b) => {
    if (next[a] === b && next[b] === a && !(skipMoon && (a === "Moon" || b === "Moon"))) mutual.push([a, b]);
  }));
  return { chains, ends, mutual };
}

export function patterns(pos, names) {
  const found = { grandCross: [], tSquare: [], grandTrine: [], kite: [], yod: [] };
  const opp = (a, b) => near(pos[a], pos[b], 180, 6), sq = (a, b) => near(pos[a], pos[b], 90, 6);
  const tri = (a, b) => near(pos[a], pos[b], 120, 6), sx = (a, b) => near(pos[a], pos[b], 60, 4);
  const qx = (a, b) => near(pos[a], pos[b], 150, 3);
  const n = names.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const [a, b] = [names[i], names[j]];
    if (opp(a, b)) for (const c of names) {
      if (c !== a && c !== b && sq(c, a) && sq(c, b)) found.tSquare.push({ a, b, apex: c });
    }
    if (sx(a, b)) for (const c of names) {
      if (c !== a && c !== b && qx(c, a) && qx(c, b)) found.yod.push({ a, b, apex: c });
    }
    for (let k = j + 1; k < n; k++) {
      const c = names[k];
      if (tri(a, b) && tri(b, c) && tri(a, c)) {
        found.grandTrine.push([a, b, c]);
        for (const [x, y, z] of [[a, b, c], [b, a, c], [c, a, b]]) for (const d of names) {
          if (![a, b, c].includes(d) && opp(d, x) && sx(d, y) && sx(d, z)) found.kite.push({ trine: [a, b, c], tail: d, head: x });
        }
      }
      for (let l = k + 1; l < n; l++) {
        const d = names[l], four = [a, b, c, d];
        const opps = [[a, b, c, d], [a, c, b, d], [a, d, b, c]];
        if (opps.some(([p, q, r, s]) => opp(p, q) && opp(r, s) && sq(p, r) && sq(p, s) && sq(q, r) && sq(q, s))) found.grandCross.push(four);
      }
    }
  }
  found.tSquare = found.tSquare.filter((t) => !found.grandCross.some((g) => [t.a, t.b, t.apex].every((x) => g.includes(x))));
  return found;
}

function patternLines(f) {
  const out = [];
  f.grandCross.forEach((g) => out.push(`Grand cross (four planets pulling at right angles, holding the whole chart in tension): ${g.join(", ")}`));
  f.tSquare.forEach((t) => out.push(`T-square (two planets face to face, a third under pressure from both): ${t.a} opposite ${t.b}, both square ${t.apex}. ${t.apex} takes the pressure`));
  f.grandTrine.forEach((g) => out.push(`Grand trine (three planets in an easy closed circuit): ${g.join(", ")}`));
  f.kite.forEach((k) => out.push(`Kite (a grand trine given a direction by one planet opposite it): ${k.trine.join(", ")}, with ${k.tail} opposite ${k.head}`));
  f.yod.forEach((y) => out.push(`Yod (two planets in easy contact, both straining toward a third): ${y.a} sextile ${y.b}, both quincunx ${y.apex}. ${y.apex} is the point they strain toward`));
  return out;
}

function aids(res, opts) {
  const { pos, retro, asc, mc, house } = res.data;
  const timeKnown = opts.timeKnown;
  const skipMoon = !timeKnown && opts.moonSigns.length > 1;
  const where = (p) => `${SIGNS[signOf(pos[p])]}${timeKnown ? `, house ${house(pos[p])}` : ""}`;
  // Without a birth hour the Moon can be several degrees off, so it never counts toward contacts or patterns.
  const usable = PLANETS.filter((p) => timeKnown || p !== "Moon");
  const L = [];
  const say = (s) => L.push(s);

  say("## Reading aids (already calculated: read them as given, never recalculate them)");
  say("");

  if (timeKnown) {
    const isDay = /\bDay chart\./.test(res.text);
    const [helper, hard, tamer] = isDay ? ["Jupiter", "Mars", "Saturn"] : ["Venus", "Saturn", "Mars"];
    say(`### ${isDay ? "Day" : "Night"} chart`);
    say(`- ${isDay ? "The Sun was above the horizon at birth." : "The Sun was below the horizon at birth."} The planet that gives most: ${helper} (${where(helper)}). The planet whose lessons come hardest: ${hard} (${where(hard)}). The tamer of the two hard planets: ${tamer} (${where(tamer)}).`);
    say("");
  }

  say("### How each planet stands in its sign");
  for (const p of CLASSICAL) {
    if (skipMoon && p === "Moon") { say("- Moon: its sign depends on the birth time, so its standing is left out."); continue; }
    say(`- ${p} in ${SIGNS[signOf(pos[p])]}: ${standing(p, signOf(pos[p]))}`);
  }
  say("");

  const rc = rulerChains(pos, skipMoon);
  say("### Who answers to whom (each planet follows the ruler of its sign)");
  for (const p of CLASSICAL) if (rc.chains[p]) say(`- ${rc.chains[p].join(" > ")}`);
  const endings = Object.entries(rc.ends).sort((a, b) => b[1].length - a[1].length);
  const settled = endings.filter(([e]) => CLASSICAL.includes(e));
  if (settled.length === 1 && endings.length === 1) {
    say(`- Final authority: ${settled[0][0]}. Every chain ends there, because it sits in a sign it rules.`);
  } else {
    say(`- Where the chains end: ${endings.map(([e, s]) => `${e} (${s.length} planet${s.length > 1 ? "s" : ""})`).join("; ")}. No single planet has the last word.`);
  }
  say(`- Mutual reception (two planets each sitting in the sign the other rules, so they support each other): ${list(rc.mutual.map(([a, b]) => `${a} and ${b}`))}`);
  say("");

  if (timeKnown) {
    const angles = { Ascendant: asc, Descendant: asc + 180, Midheaven: mc, "Lowest point of the chart (IC)": mc + 180 };
    const onAngle = [];
    for (const p of PLANETS) for (const [a, lon] of Object.entries(angles)) {
      const d = sep(pos[p], lon);
      if (d <= 5) onAngle.push(`${p} on the ${a} (${tight(d)})`);
    }
    say("### Loudest positions");
    say(`- Planets in the four strongest houses (1, 4, 7, 10): ${list(PLANETS.filter((p) => [1, 4, 7, 10].includes(house(pos[p]))).map((p) => `${p} in house ${house(pos[p])}`))}`);
    say(`- Planets sitting right on an angle: ${list(onAngle)}`);
    say("");
  }

  say("### Close to the Sun");
  const sunNotes = [];
  for (const p of ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"]) {
    const d = sep(pos[p], pos.Sun);
    if (d <= 17 / 60) sunNotes.push(`${p} is in the heart of the Sun (cazimi), a position of unusual strength`);
    else if (d <= 8.5) sunNotes.push(`${p} is burned by the Sun (combust): strong inside, hard for others to see`);
    else if (d <= 15) sunNotes.push(`${p} is under the Sun's beams: partly hidden, it shows itself slowly`);
  }
  say(`- ${list(sunNotes, "No planet is hidden by the Sun.")}`);
  for (const p of ["Mercury", "Venus"]) say(`- ${p} is ${pmod(pos.Sun - pos[p], 360) < 180 ? "a morning star: it rose before the Sun" : "an evening star: it set after the Sun"}.`);
  say("");

  say("### Chart patterns (three or more planets locked together)");
  const pl = patternLines(patterns(pos, usable));
  if (pl.length) pl.forEach((x) => say(`- ${x}`));
  else say("- No major pattern. The planets work in pairs and small groups.");
  say("");

  say("### Slow planets: shared or personal");
  const targets = timeKnown ? { Sun: pos.Sun, Moon: pos.Moon, Ascendant: asc, Midheaven: mc } : { Sun: pos.Sun };
  const ASP = [["conjunction", 0, 5], ["opposition", 180, 5], ["square", 90, 4], ["trine", 120, 4], ["sextile", 60, 3]];
  for (const p of ["Uranus", "Neptune", "Pluto"]) {
    const hits = [];
    for (const [t, lon] of Object.entries(targets)) for (const [a, ang, orb] of ASP) {
      const o = Math.abs(sep(pos[p], lon) - ang);
      if (o <= orb) hits.push(`${a} ${t} (${tight(o)})`);
    }
    say(`- ${p}: ${hits.length ? `personal to you, through ${hits.join("; ")}` : "shared with your generation. Any contact it makes with your most personal points is wide"}`);
  }
  say("");

  say("### The nodal axis");
  const nn = pos["North Node"], sn = nn + 180;
  const onNodes = [], acrossNodes = [];
  for (const p of usable) {
    if (sep(pos[p], nn) <= 5) onNodes.push(`${p} on the North Node`);
    if (sep(pos[p], sn) <= 5) onNodes.push(`${p} on the South Node`);
    if (Math.abs(sep(pos[p], nn) - 90) <= 5) acrossNodes.push(p);
  }
  say(`- Ruler of the North Node's sign: ${RULER[signOf(nn)]} (${where(RULER[signOf(nn)])}). Ruler of the South Node's sign: ${RULER[signOf(sn)]} (${where(RULER[signOf(sn)])}).`);
  say(`- Planets on the axis: ${list(onNodes)}`);
  say(`- Planets square the axis (the step that has to be taken to move from one end to the other): ${list(acrossNodes)}`);
  say("");

  say("### Contacts of Chiron, Lilith and the Vertex");
  const others = { ...Object.fromEntries(usable.map((p) => [p, pos[p]])), "North Node": nn, ...(timeKnown ? { Ascendant: asc, Midheaven: mc } : {}) };
  const POINT_ASP = [["conjunction", 0, 5], ["opposition", 180, 5], ["square", 90, 3], ["trine", 120, 3], ["sextile", 60, 2]];
  for (const pt of ["Chiron", "Lilith", ...(timeKnown ? ["Vertex"] : [])]) {
    const lon = pt === "Vertex" ? res.data.vx : pos[pt];
    const hits = [];
    for (const [t, tl] of Object.entries(others)) for (const [a, ang, orb] of POINT_ASP) {
      const o = Math.abs(sep(lon, tl) - ang);
      if (o <= orb) hits.push([o, `${a} ${t} (${tight(o)})`]);
    }
    hits.sort((x, y) => x[0] - y[0]);
    say(`- ${pt}: ${list(hits.map((h) => h[1]), "no close contacts")}`);
  }
  say("");

  say("### Balance");
  const pts = timeKnown ? [...usable.map((p) => pos[p]), asc] : usable.map((p) => pos[p]);
  const outward = pts.filter((x) => signOf(x) % 2 === 0).length;
  say(`- Outward signs (fire and air): ${outward}. Inward signs (earth and water): ${pts.length - outward}.`);
  if (!timeKnown) {
    const counts = {};
    usable.forEach((p) => { const e = ELEMENT[signOf(pos[p]) % 4]; counts[e] = (counts[e] || 0) + 1; });
    say(`- Elements: ${ELEMENT.map((e) => `${e} ${counts[e] || 0}`).join(", ")}.`);
  }
  if (timeKnown) {
    const above = PLANETS.filter((p) => pmod(pos[p] - asc, 360) >= 180).length;
    const east = PLANETS.filter((p) => pmod(pos[p] - mc, 360) < 180).length;
    say(`- Above the horizon (public, visible): ${above}. Below the horizon (private, inner): ${10 - above}.`);
    say(`- Eastern side (you start things yourself): ${east}. Western side (life reaches you through other people): ${10 - east}.`);
  }
  const counts = usable.map((p) => { const m = res.text.match(new RegExp(`^- ${p} \\((\\d+)\\):`, "m")); return [p, m ? +m[1] : 0]; });
  const top = Math.max(...counts.map((c) => c[1]));
  say(`- Most connected planet: ${counts.filter((c) => c[1] === top).map((c) => c[0]).join(", ")} (${top} contacts).`);
  say(`- Planets with no major contact: ${list(counts.filter((c) => c[1] === 0).map((c) => c[0]))}`);
  say(`- Retrograde at birth: ${list([...PLANETS.slice(2), "Chiron"].filter((p) => retro[p]))}`);
  const edge = usable.filter((p) => { const d = pmod(pos[p], 30); return d < 1 || d >= 29; })
    .map((p) => `${p} at the ${pmod(pos[p], 30) < 1 ? "very start" : "very end"} of ${SIGNS[signOf(pos[p])]}`);
  say(`- Planets on the edge of a sign: ${list(edge)}`);
  return L.join("\n");
}

// Removes everything that depends on the birth hour from the chart text.
function withoutTime(text, moonSigns) {
  const uncertain = ["Ascendant", "Midheaven", "Part of Fortune", "Vertex", "Moon"];
  const blocks = text.split(/\n(?=## )/).filter((b) => !/^## (Angles|Houses, residents|Element and modality|Moon phase)/.test(b));
  return blocks.map((b, i) => {
    if (i === 0) return b.replace(/, \d\d:\d\d local time \([^)]*\)/, ", birth time unknown (positions calculated for 12:00 noon)")
      .replace(/ Universal Time [^\n]*/, "").replace(/ Tropical zodiac, Whole Sign houses\. (Day|Night) chart\./, " Tropical zodiac.");
    if (b.startsWith("## Planets")) {
      return b.replace("## Planets (sign, whole sign house)", "## Planets (sign)").replace(/, house \d+/g, "").split("\n").map((l) =>
        (l.startsWith("- Moon:") ? `- Moon: in ${moonSigns.join(" or ")}. The exact position depends on the hour of birth, so its contacts are left out.` : l)).join("\n");
    }
    if (b.startsWith("## Aspects")) {
      return b.split("\n").filter((l) => !uncertain.some((u) => l.startsWith(`- ${u} (`))).map((l) => {
        const m = l.match(/^(- [^(]+ )\((\d+)\): (.*)$/);
        if (!m) return l;
        const kept = m[3].split("; ").filter((a) => !uncertain.some((u) => a.includes(` ${u} (`)));
        return kept.length ? `${m[1]}(${kept.length}): ${kept.join("; ")}` : `${m[1]}(0): no major aspects`;
      }).join("\n");
    }
    return b;
  }).join("\n");
}

export function freeChart(E, person, { timeKnown = true } = {}) {
  const res = computeChart(E, person, { asteroids: "none", moonPhase: true, warningWhere: "in Chapter 1" });
  const natal = res.text.split("\n## Human Design")[0].trimEnd();
  let moonSigns = [SIGNS[signOf(res.data.pos.Moon)]];
  if (!timeKnown) {
    const at = (t) => SIGNS[signOf(computeChart(E, { ...person, time: t }, { asteroids: "none" }).data.pos.Moon)];
    moonSigns = [...new Set([at("00:00"), at("12:00"), at("23:59")])];
  }
  const base = timeKnown ? natal : "BIRTH TIME UNKNOWN: there is no Ascendant, Midheaven, house, Part of Fortune or Vertex in this data.\n\n" + withoutTime(natal, moonSigns);
  const phase = (natal.match(/## Moon phase at birth\n- ([A-Za-z ]+) \(/) || [])[1] || "";
  const scoped = { ...res, text: base };
  return {
    text: `${base}\n\n${aids(scoped, { timeKnown, moonSigns })}\n`,
    data: res.data,
    glance: {
      rising: timeKnown ? res.summary.rising : null,
      sun: res.summary.sun,
      moon: moonSigns.join(" or "),
      ruler: timeKnown ? RULER[res.data.ascSign] : null,
      phase: timeKnown ? phase : "",
      warning: timeKnown && res.summary.warning,
    },
  };
}
