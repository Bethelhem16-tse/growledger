// CsvImport.jsx  (Screen 3)
// Upload a spreadsheet and match its columns to GrowLedger fields.
const SAMPLE_NAME = "riverside_basil_cycles.csv";
const SAMPLE_CSV = `date_started,date_ended,yield_lbs,energy_cost,labor_cost,nutrient_cost,other_cost,notes
2026-01-07,2026-01-28,131,296,382,104,38,Winter run
2026-02-04,2026-02-25,135,301,379,102,40,
2026-03-04,2026-03-25,136,298,384,106,41,Switched nutrient supplier`;

const FIELDS = [
  { key: "start", label: "Start date", match: /start|begin|planted/i },
  { key: "end", label: "Harvest date", match: /end|finish|harvest/i },
  { key: "yieldAmount", label: "Yield amount", match: /yield|lbs|weight|kg/i },
  { key: "energy", label: "Energy", match: /energy|electric|power/i },
  { key: "labor", label: "Labor", match: /labou?r|wage/i },
  { key: "nutrients", label: "Nutrients", match: /nutri|feed|fert/i },
  { key: "other", label: "Other", match: /other|misc/i },
  { key: "notes", label: "Notes", match: /note|comment/i },
];

function parseCsv(text) {
  const rows = text.trim().split(/\r?\n/).map((line) => {
    const cells = []; let cell = "", quoted = false;
    for (const ch of line) {
      if (ch === '"') quoted = !quoted;
      else if (ch === "," && !quoted) { cells.push(cell.trim()); cell = ""; }
      else cell += ch;
    }
    cells.push(cell.trim());
    return cells;
  });
  return { headers: rows[0] || [], rows: rows.slice(1) };
}

function guessMapping(headers) {
  const used = new Set();
  return headers.map((h) => {
    const field = FIELDS.find((f) => !used.has(f.key) && f.match.test(h));
    if (field) used.add(field.key);
    return field ? field.key : "";
  });
}

function toIsoDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  return isNaN(d) ? "" : d.toISOString().slice(0, 10);
}

function CsvImport({ spaces, onImport, onModeChange, readOnly }) {
  const [file, setFile] = useState(null);
  const [mapping, setMapping] = useState([]);
  const [crop, setCrop] = useState("Basil");
  const [spaceId, setSpaceId] = useState(spaces[0]?.id || "");
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function load(name, text) {
    const parsed = parseCsv(text);
    if (parsed.headers.length < 2 || !parsed.rows.length) {
      setError("That file has no data rows. Check that the first row holds column names.");
      return;
    }
    setError("");
    setFile({ name, ...parsed });
    setMapping(guessMapping(parsed.headers));
  }

  async function readFile(f) {
    if (!f) return;
    if (!/\.csv$/i.test(f.name)) { setError("Choose a .csv file. Export it from Excel or Google Sheets first."); return; }
    load(f.name, await f.text());
  }

  const cycles = file ? file.rows.map((row, r) => {
    const get = (key) => { const i = mapping.indexOf(key); return i >= 0 ? row[i] || "" : ""; };
    const costs = {};
    COST_CATEGORIES.forEach((cat) => (costs[cat.key] = Number(get(cat.key)) || 0));
    return {
      id: "csv" + r, crop, spaceId, unit: "lb",
      start: toIsoDate(get("start")), end: toIsoDate(get("end")) || toIsoDate(get("start")),
      yieldAmount: Number(get("yieldAmount")) || 0, costs, notes: get("notes"),
    };
  }).filter((c) => c.start && c.yieldAmount > 0) : [];

  const missing = ["start", "yieldAmount"].filter((k) => !mapping.includes(k));

  async function doImport() {
    setSaving(true);
    const ok = await onImport(cycles.map((c) => ({ ...c, id: newId("c") })));
    if (!ok) setSaving(false);
  }

  return (
    <>
      <div className="row screen-title">
        <div>
          <h2>Import CSV</h2>
          <p className="sub">Upload a spreadsheet and match its columns to GrowLedger</p>
        </div>
        <EntryModeSwitch mode="csv" onChange={onModeChange} />
      </div>

      <Box label="File">
        <label className={"drop" + (dragOver ? " over" : "")}
               onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
               onDragLeave={() => setDragOver(false)}
               onDrop={(e) => { e.preventDefault(); setDragOver(false); readFile(e.dataTransfer.files[0]); }}>
          <input type="file" id="csv-file" accept=".csv,text/csv" onChange={(e) => readFile(e.target.files[0])} />
          <span className="file-name">{file ? file.name : "No file chosen"}</span>
          <small>Drag a file here, or click to browse{file ? `  ·  ${file.rows.length} rows found` : ""}</small>
        </label>
        <div className="actions" style={{ marginTop: 10, justifyContent: "flex-start" }}>
          <button className="btn ghost small" onClick={() => load(SAMPLE_NAME, SAMPLE_CSV)}>Use sample file</button>
        </div>
        {error && <p className="msg">{error}</p>}
      </Box>

      {file && (
        <Box label="Column matching">
          <div className="map">
            <div className="fields">
              <div className="field">
                <label htmlFor="csv-crop">Crop for these cycles</label>
                <select id="csv-crop" value={crop} onChange={(e) => setCrop(e.target.value)}>
                  {CROPS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="csv-space">Grow space</label>
                <SpaceSelect id="csv-space" spaces={spaces} value={spaceId} onChange={setSpaceId} />
              </div>
            </div>
            {file.headers.map((h, i) => (
              <div className="map-row" key={i}>
                <code title={h}>{h}</code>
                <span className="arrow">→</span>
                <select id={"map-" + i} aria-label={"Field for " + h} value={mapping[i]}
                        onChange={(e) => setMapping(mapping.map((m, j) => (j === i ? e.target.value : m)))}>
                  <option value="">Skip this column</option>
                  {FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </Box>
      )}

      {file && cycles.length > 0 && (
        <Box label="Preview">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Start</th><th className="num">Yield</th><th className="num">Total cost</th><th className="num">Cost/lb</th></tr></thead>
              <tbody>
                {cycles.map((c) => (
                  <tr key={c.id}>
                    <td>{fmtDate(c.start)}</td><td className="num">{c.yieldAmount} lb</td>
                    <td className="num">{fmtMoney(totalCost(c))}</td><td className="num">{fmtMoney(costPerUnit(c))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Box>
      )}

      {file && (
        <div className="actions">
          {missing.length > 0 && (
            <p className="msg">Match a column to {missing.map((k) => FIELDS.find((f) => f.key === k).label).join(" and ")} to import.</p>
          )}
          {readOnly && <p className="msg">You can view this ledger but not import cycles.</p>}
          <button className="btn" disabled={readOnly || saving || missing.length > 0 || !cycles.length} onClick={doImport}>
            {saving ? "Importing…" : `Import ${cycles.length} cycles`}
          </button>
        </div>
      )}
    </>
  );
}
