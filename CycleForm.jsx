// CycleForm.jsx  (Screen 2)
// Manual entry for one grow cycle. Goal: log a full cycle in under a minute.
function blankForm(spaces) {
  return {
    crop: "Basil", spaceId: spaces[0]?.id || "", start: "", end: "", yieldAmount: "", unit: "lb",
    costs: { energy: "", labor: "", nutrients: "", other: "" }, notes: "",
  };
}

function validate(form) {
  const errors = {};
  if (!form.start) errors.start = "Pick a start date.";
  if (!form.end) errors.end = "Pick an end date.";
  if (form.start && form.end && form.end <= form.start) errors.end = "End date must be after the start date.";
  if (!(Number(form.yieldAmount) > 0)) errors.yieldAmount = "Enter a yield above 0.";
  for (const cat of COST_CATEGORIES) {
    if (Number(form.costs[cat.key]) < 0) errors[cat.key] = "Costs cannot be negative.";
  }
  return errors;
}

function CycleForm({ spaces, onSave, onModeChange, readOnly }) {
  const [form, setForm] = useState(() => blankForm(spaces));
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const errors = validate(form);

  const set = (field, value) => setForm({ ...form, [field]: value });
  const setCost = (key, value) => setForm({ ...form, costs: { ...form.costs, [key]: value } });

  const draft = { ...form, yieldAmount: Number(form.yieldAmount) };
  const space = spaces.find((s) => s.id === form.spaceId);
  const days = cycleDays(form);
  const expectedEnergy = space && days ? lightingCost(space, days) : null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (Object.keys(errors).length) { setShowErrors(true); return; }
    const costs = {};
    COST_CATEGORIES.forEach((cat) => (costs[cat.key] = Number(form.costs[cat.key]) || 0));
    setSaving(true);
    const ok = await onSave({ ...form, id: newId("c"), yieldAmount: Number(form.yieldAmount), costs, notes: form.notes.trim() });
    if (!ok) setSaving(false);
  }

  const err = (key) => showErrors && errors[key];

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: "grid", gap: 16 }}>
      <div className="row screen-title">
        <div>
          <h2>Log a new cycle</h2>
          <p className="sub">Manual entry, or import a CSV from a spreadsheet</p>
        </div>
        <EntryModeSwitch mode="manual" onChange={onModeChange} />
      </div>

      <Box label="Cycle details">
        <div className="fields">
          <div className="field">
            <label htmlFor="crop">Crop type</label>
            <select id="crop" value={form.crop} onChange={(e) => set("crop", e.target.value)}>
              {CROPS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="space">Grow space</label>
            <SpaceSelect id="space" spaces={spaces} value={form.spaceId} onChange={(v) => set("spaceId", v)} />
            {space && <span className="hint">{fmtNum(space.areaSqft)} sq ft · {space.lights} lights</span>}
          </div>
          <div className="field">
            <label htmlFor="start">Start date</label>
            <input id="start" type="date" value={form.start} aria-invalid={!!err("start")}
                   onChange={(e) => set("start", e.target.value)} />
            {err("start") && <span className="err">{errors.start}</span>}
          </div>
          <div className="field">
            <label htmlFor="end">Harvest date</label>
            <input id="end" type="date" value={form.end} aria-invalid={!!err("end")}
                   onChange={(e) => set("end", e.target.value)} />
            {err("end") ? <span className="err">{errors.end}</span> : days > 0 && <span className="hint">{days}-day cycle</span>}
          </div>
          <div className="field">
            <label htmlFor="yield">Yield amount</label>
            <div className="inline">
              <input id="yield" type="number" min="0" step="0.1" value={form.yieldAmount} placeholder="0"
                     aria-invalid={!!err("yieldAmount")} onChange={(e) => set("yieldAmount", e.target.value)} />
              <select id="unit" aria-label="Yield unit" value={form.unit} onChange={(e) => set("unit", e.target.value)}>
                <option>lb</option><option>kg</option><option>g</option>
              </select>
            </div>
            {err("yieldAmount") && <span className="err">{errors.yieldAmount}</span>}
          </div>
        </div>
      </Box>

      <Box label="Costs">
        <div className="fields">
          {COST_CATEGORIES.map((cat) => (
            <div className="field" key={cat.key}>
              <label htmlFor={"cost-" + cat.key}>{cat.label}</label>
              <div className="money">
                <span>$</span>
                <input id={"cost-" + cat.key} type="number" min="0" step="0.01" value={form.costs[cat.key]} placeholder="0"
                       aria-invalid={!!err(cat.key)} onChange={(e) => setCost(cat.key, e.target.value)} />
              </div>
              {err(cat.key) && <span className="err">{errors[cat.key]}</span>}
              {cat.key === "energy" && expectedEnergy !== null && !err(cat.key) && (
                <span className="hint">Lights alone: about {fmtMoney(expectedEnergy)}</span>
              )}
            </div>
          ))}
        </div>
      </Box>

      <Box label="Notes · the flag quotes this">
        <div className="field">
          <label htmlFor="notes">What changed this cycle?</label>
          <textarea id="notes" value={form.notes} placeholder="New nutrient supplier, lighting change, pest issue…"
                    onChange={(e) => set("notes", e.target.value)} />
        </div>
      </Box>

      <Box label="Live preview">
        <div className="preview">
          <span>Total cost <b>{fmtMoney(totalCost(draft))}</b></span>
          <span>Cost per {form.unit} <b>{draft.yieldAmount > 0 ? fmtMoney(costPerUnit(draft)) : "—"}</b></span>
          {space && draft.yieldAmount > 0 && <span>Yield per sq ft <b>{fmtNum(yieldPerSqft(draft, space), 2)}</b></span>}
        </div>
      </Box>

      <div className="actions">
        {readOnly && <p className="msg">You can view this ledger but not add cycles.</p>}
        <button type="submit" className="btn" disabled={saving || readOnly}>{saving ? "Saving…" : "Save cycle"}</button>
      </div>
    </form>
  );
}
