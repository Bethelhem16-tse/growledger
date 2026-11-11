// GrowSpaces.jsx  (Screen 4)
// Rooms, racks and tents. Each cycle belongs to one space, so the dashboard
// can compare cost per unit and yield per square foot across spaces.
const BLANK_SPACE = { name: "", type: "Grow room", areaSqft: "", lights: "", watts: "", hours: "18", rate: "0.11", notes: "" };

function validateSpace(f) {
  const e = {};
  if (!f.name.trim()) e.name = "Give the space a name.";
  if (!(Number(f.areaSqft) > 0)) e.areaSqft = "Enter the growing area in sq ft.";
  if (Number(f.hours) < 0 || Number(f.hours) > 24) e.hours = "Hours must be between 0 and 24.";
  if (Number(f.lights) < 0) e.lights = "Cannot be negative.";
  if (Number(f.watts) < 0) e.watts = "Cannot be negative.";
  if (Number(f.rate) < 0) e.rate = "Cannot be negative.";
  return e;
}

function SpaceForm({ initial, onCancel, onSave }) {
  const [f, setF] = useState(initial);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const errors = validateSpace(f);
  const set = (k, v) => setF({ ...f, [k]: v });
  const err = (k) => show && errors[k];
  const preview = kwhPerDay(f);

  async function submit(e) {
    e.preventDefault();
    if (Object.keys(errors).length) { setShow(true); return; }
    setSaving(true);
    const ok = await onSave({
      ...f, name: f.name.trim(), notes: f.notes.trim(),
      areaSqft: Number(f.areaSqft), lights: Number(f.lights) || 0, watts: Number(f.watts) || 0,
      hours: Number(f.hours) || 0, rate: Number(f.rate) || 0,
    });
    if (!ok) setSaving(false);
  }

  const num = (k, label, props = {}) => (
    <div className="field">
      <label htmlFor={"sp-" + k}>{label}</label>
      <input id={"sp-" + k} type="number" min="0" value={f[k]} aria-invalid={!!err(k)}
             onChange={(e) => set(k, e.target.value)} {...props} />
      {err(k) && <span className="err">{errors[k]}</span>}
    </div>
  );

  return (
    <Box label={initial.id ? `Edit ${initial.name}` : "New grow space"}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: 12 }}>
        <div className="fields">
          <div className="field">
            <label htmlFor="sp-name">Name</label>
            <input id="sp-name" value={f.name} placeholder="Room B" aria-invalid={!!err("name")}
                   onChange={(e) => set("name", e.target.value)} />
            {err("name") && <span className="err">{errors.name}</span>}
          </div>
          <div className="field">
            <label htmlFor="sp-type">Type</label>
            <select id="sp-type" value={f.type} onChange={(e) => set("type", e.target.value)}>
              {SPACE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          {num("areaSqft", "Growing area (sq ft)", { step: "1" })}
          {num("lights", "Light fixtures", { step: "1" })}
          {num("watts", "Watts per fixture", { step: "1" })}
          {num("hours", "Lights on (hours/day)", { step: "0.5", max: "24" })}
          {num("rate", "Electricity rate ($/kWh)", { step: "0.01" })}
        </div>
        <div className="field">
          <label htmlFor="sp-notes">Notes</label>
          <textarea id="sp-notes" value={f.notes} placeholder="System type, location, anything that sets it apart"
                    onChange={(e) => set("notes", e.target.value)} />
        </div>
        <div className="light-calc">
          Lighting draw: <b>{fmtNum(preview, 1)} kWh/day</b> · about <b>{fmtMoney(lightingCost(f, 21))}</b> per 21-day cycle
        </div>
        <div className="actions">
          <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn" disabled={saving}>{saving ? "Saving…" : initial.id ? "Save changes" : "Add space"}</button>
        </div>
      </form>
    </Box>
  );
}

function SpaceCard({ space, cycles, readOnly, onEdit, onDelete, onOpen }) {
  const [confirming, setConfirming] = useState(false);
  const list = cycles.filter((c) => c.spaceId === space.id).sort((a, b) => a.start.localeCompare(b.start));
  const latest = list[list.length - 1];
  const crops = [...new Set(list.map((c) => c.crop))];
  const avgCost = average(list.map(costPerUnit));
  const avgSqft = average(list.map((c) => yieldPerSqft(c, space)));
  const avgDays = Math.round(average(list.map(cycleDays)) || 21);

  return (
    <Box>
      <div className="space">
        <div className="space-head">
          <div>
            <h3>{space.name}</h3>
            <p className="sub">{list.length} {list.length === 1 ? "cycle" : "cycles"}{crops.length ? " · " + crops.join(", ") : ""}</p>
          </div>
          <span className="chip">{space.type}</span>
        </div>
        <dl className="spec">
          <div><dt>Area</dt><dd>{fmtNum(space.areaSqft)} <small>sq ft</small></dd></div>
          <div><dt>Lights</dt><dd>{space.lights} × {space.watts}<small>W</small></dd></div>
          <div><dt>Avg cost/unit</dt><dd>{avgCost === null ? "—" : fmtMoney(avgCost)}</dd></div>
          <div><dt>Avg yield/sq ft</dt><dd>{avgSqft === null ? "—" : fmtNum(avgSqft, 2)}</dd></div>
        </dl>
        {space.notes && <p className="space-note">{space.notes}</p>}
        <div className="light-calc">
          {space.hours}/{24 - space.hours} schedule · <b>{fmtNum(kwhPerDay(space), 1)} kWh/day</b> · lights cost about{" "}
          <b>{fmtMoney(lightingCost(space, avgDays))}</b> per {avgDays}-day cycle at ${space.rate}/kWh
          {latest && <> · last run {fmtDate(latest.end)}</>}
        </div>
        {confirming ? (
          <div className="confirm" role="alert">
            <span>Delete {space.name}?{list.length ? ` Its ${list.length} cycles stay in your ledger as Unassigned.` : ""}</span>
            <div className="actions">
              <button className="btn ghost small" onClick={() => setConfirming(false)}>Cancel</button>
              <button className="btn danger small" onClick={() => onDelete(space)}>Delete space</button>
            </div>
          </div>
        ) : (
          <div className="actions">
            {list.length > 0 && <button className="btn ghost small" onClick={() => onOpen(space)}>View on dashboard</button>}
            {!readOnly && <button className="btn ghost small" onClick={() => onEdit(space)}>Edit</button>}
            {!readOnly && <button className="btn ghost small danger" onClick={() => setConfirming(true)}>Delete</button>}
          </div>
        )}
      </div>
    </Box>
  );
}

function GrowSpaces({ spaces, cycles, readOnly, onSave, onDelete, onOpen }) {
  const [editing, setEditing] = useState(null); // null | space object (new = no id)
  const unassigned = cycles.filter((c) => !c.spaceId || !spaces.some((s) => s.id === c.spaceId)).length;
  const totalArea = spaces.reduce((s, x) => s + (Number(x.areaSqft) || 0), 0);
  const totalKwh = spaces.reduce((s, x) => s + kwhPerDay(x), 0);

  async function save(space) {
    const ok = await onSave({ ...space, id: space.id || newId("s") });
    if (ok) setEditing(null);
    return ok;
  }

  return (
    <>
      <div className="row screen-title">
        <div>
          <h2>Grow spaces</h2>
          <p className="sub">{spaces.length} spaces · {fmtNum(totalArea)} sq ft · {fmtNum(totalKwh, 1)} kWh/day of lighting</p>
        </div>
        {!readOnly && !editing && <button className="btn" onClick={() => setEditing({ ...BLANK_SPACE })}>+ Add space</button>}
      </div>

      {editing && <SpaceForm key={editing.id || "new"} initial={editing} onCancel={() => setEditing(null)} onSave={save} />}

      {unassigned > 0 && (
        <div className="notice warn">{unassigned} {unassigned === 1 ? "cycle has" : "cycles have"} no grow space, so {unassigned === 1 ? "it's" : "they're"} left out of per-sq-ft numbers.</div>
      )}

      {spaces.length ? (
        <div className="spaces">
          {spaces.map((s) => (
            <SpaceCard key={s.id} space={s} cycles={cycles} readOnly={readOnly}
                       onEdit={(sp) => setEditing({ ...sp, areaSqft: String(sp.areaSqft), lights: String(sp.lights), watts: String(sp.watts), hours: String(sp.hours), rate: String(sp.rate), notes: sp.notes || "" })}
                       onDelete={onDelete} onOpen={onOpen} />
          ))}
        </div>
      ) : !editing && (
        <Box>
          <div className="empty">
            <p>No grow spaces yet. Add a room, rack or tent to compare yield per square foot.</p>
            {!readOnly && <button className="btn" onClick={() => setEditing({ ...BLANK_SPACE })}>+ Add your first space</button>}
          </div>
        </Box>
      )}
    </>
  );
}
