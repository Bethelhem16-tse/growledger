// shared.jsx
// Data model, cost math, lighting math and the flagging engine used by every screen.
const { useState, useEffect, useRef } = React;

const COST_CATEGORIES = [
  { key: "energy", label: "Energy" },
  { key: "labor", label: "Labor" },
  { key: "nutrients", label: "Nutrients" },
  { key: "other", label: "Other" },
];

const CROPS = ["Basil", "Lettuce", "Microgreens", "Strawberries"];
const SPACE_TYPES = ["Grow room", "Vertical rack", "Grow tent", "Greenhouse bay"];

const HISTORY_WINDOW = 3;  // compare against the last 3 cycles of the same crop
const FLAG_THRESHOLD = 10; // flag when cost per unit rises 10% or more

// Example data, used only when this page can't reach its saved data
const SEED_SPACES = [
  { id: "s1", name: "Room A", type: "Grow room", areaSqft: 320, lights: 24, watts: 300, hours: 18, rate: 0.11,
    notes: "NFT channels, 4 rows. Main basil room." },
  { id: "s2", name: "Rack 2", type: "Vertical rack", areaSqft: 96, lights: 12, watts: 150, hours: 16, rate: 0.11,
    notes: "Five-tier rack by the loading door." },
];
const SEED_CYCLES = [
  { id: "c1", crop: "Basil", spaceId: "s1", start: "2026-05-06", end: "2026-05-27", yieldAmount: 138, unit: "lb",
    costs: { energy: 300, labor: 380, nutrients: 105, other: 40 }, notes: "Baseline run on the 18/6 lighting schedule." },
  { id: "c2", crop: "Basil", spaceId: "s1", start: "2026-06-03", end: "2026-06-24", yieldAmount: 120, unit: "lb",
    costs: { energy: 308, labor: 386, nutrients: 100, other: 40 }, notes: "Lighting schedule changed on day 12." },
  { id: "c3", crop: "Basil", spaceId: "s1", start: "2026-07-01", end: "2026-07-22", yieldAmount: 142, unit: "lb",
    costs: { energy: 290, labor: 380, nutrients: 105, other: 40 }, notes: "Reverted to the original lighting schedule." },
];

// ---------- cost math ----------
function totalCost(cycle) {
  return COST_CATEGORIES.reduce((sum, cat) => sum + (Number(cycle.costs?.[cat.key]) || 0), 0);
}
function costPerUnit(cycle) {
  return cycle.yieldAmount > 0 ? totalCost(cycle) / cycle.yieldAmount : 0;
}
function categoryPerUnit(cycle, key) {
  return cycle.yieldAmount > 0 ? (Number(cycle.costs?.[key]) || 0) / cycle.yieldAmount : 0;
}
function average(numbers) {
  return numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : null;
}
function pctChange(value, base) {
  return base ? ((value - base) / base) * 100 : null;
}
function cycleDays(cycle) {
  if (!cycle.start || !cycle.end) return 0;
  const ms = new Date(cycle.end + "T00:00") - new Date(cycle.start + "T00:00");
  return Math.max(0, Math.round(ms / 86400000));
}

// ---------- lighting math ----------
// kWh per day = fixtures × watts × hours on ÷ 1000
function kwhPerDay(space) {
  return ((Number(space.lights) || 0) * (Number(space.watts) || 0) * (Number(space.hours) || 0)) / 1000;
}
function lightingCost(space, days) {
  return kwhPerDay(space) * days * (Number(space.rate) || 0);
}
function yieldPerSqft(cycle, space) {
  return space && space.areaSqft > 0 ? cycle.yieldAmount / space.areaSqft : null;
}

// Every crop keeps its own history: basil never compares against lettuce
function cyclesForCrop(cycles, crop, spaceId) {
  return cycles
    .filter((c) => c.crop === crop && (spaceId === "all" || (c.spaceId || "") === spaceId))
    .sort((a, b) => a.start.localeCompare(b.start));
}

// ---------- flagging engine ----------
function findFlag(history, index) {
  if (index === 0) return null;
  const cycle = history[index];
  const prior = history.slice(Math.max(0, index - HISTORY_WINDOW), index);
  const change = pctChange(costPerUnit(cycle), average(prior.map(costPerUnit)));
  if (change === null || change < FLAG_THRESHOLD) return null;

  let driver = null;
  for (const cat of COST_CATEGORIES) {
    const before = average(prior.map((p) => categoryPerUnit(p, cat.key)));
    const catChange = pctChange(categoryPerUnit(cycle, cat.key), before);
    if (catChange !== null && (!driver || catChange > driver.change)) {
      driver = { ...cat, change: catChange };
    }
  }
  return { cycleNumber: index + 1, cycle, change, driver, priorCount: prior.length, note: cycle.notes };
}

// ---------- formatting ----------
const fmtMoney = (n) => "$" + n.toFixed(2);
const fmtPct = (n) => (n > 0 ? "+" : "") + n.toFixed(1) + "%";
const fmtNum = (n, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
const newId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ---------- shared UI ----------
function Box({ label, tone, children }) {
  return (
    <section className={"wf" + (label ? " labeled" : "") + (tone ? " " + tone : "")}>
      {label && <span className="wf-tag">{label}</span>}
      {children}
    </section>
  );
}

function EntryModeSwitch({ mode, onChange }) {
  return (
    <div className="mode" role="group" aria-label="Entry method">
      <button type="button" aria-pressed={mode === "manual"} onClick={() => onChange("manual")}>Manual entry</button>
      <button type="button" aria-pressed={mode === "csv"} onClick={() => onChange("csv")}>Import CSV</button>
    </div>
  );
}

function SpaceSelect({ id, spaces, value, onChange, label }) {
  return (
    <select id={id} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Unassigned</option>
      {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  );
}
