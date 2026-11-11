// App.jsx
// Loads and saves spaces and cycles (the artifact's database when available,
// sample data otherwise) and switches screens.
function useLedger() {
  const [state, setState] = useState({ mode: "loading", spaces: [], cycles: [], slow: false });
  const dbRef = useRef(null);

  useEffect(() => {
    let alive = true, unsubs = [];
    const sample = () => {
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem("growledger") || "null"); } catch (e) {}
      setState({ mode: saved ? "local" : "sample", spaces: saved?.spaces || SEED_SPACES, cycles: saved?.cycles || SEED_CYCLES, slow: false });
    };
    if (!window.claude || !window.claude.use) { sample(); return; }
    const timer = setTimeout(() => alive && setState((s) => (s.mode === "loading" ? { ...s, slow: true } : s)), 10000);

    window.claude.use("db").then((db) => {
      if (!alive) return;
      if (!db) { clearTimeout(timer); sample(); return; }
      dbRef.current = db;
      const got = {};
      const sub = (name) => db.collection(name).onSnapshot((snap) => {
        got[name] = true;
        const rows = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        if (got.spaces && got.cycles) clearTimeout(timer);
        setState((s) => ({ ...s, [name]: rows, mode: got.spaces && got.cycles ? "live" : s.mode, slow: got.spaces && got.cycles ? false : s.slow }));
      }, () => { clearTimeout(timer); setState((s) => ({ ...s, mode: "error" })); });
      unsubs = [sub("spaces"), sub("cycles")];
    }).catch(() => { clearTimeout(timer); sample(); });

    return () => { alive = false; clearTimeout(timer); unsubs.forEach((u) => u()); };
  }, []);

  // One write; retries once on a transient outage
  async function write(kind, id, data) {
    const db = dbRef.current;
    if (!db) {
      setState((s) => {
        const next = { ...s, mode: "local", [kind]: data === null ? s[kind].filter((r) => r.id !== id)
          : s[kind].some((r) => r.id === id) ? s[kind].map((r) => (r.id === id ? { ...data, id } : r)) : [...s[kind], { ...data, id }] };
        try { localStorage.setItem("growledger", JSON.stringify({ spaces: next.spaces, cycles: next.cycles })); } catch (e) {}
        return next;
      });
      return;
    }
    const ref = db.collection(kind).doc(id);
    const run = () => (data === null ? ref.delete() : ref.set(data));
    try { await run(); }
    catch (e) {
      if (e && e.code === "unavailable") { await new Promise((r) => setTimeout(r, 600 + Math.random() * 800)); await run(); }
      else throw e;
    }
  }
  return { ...state, write };
}

function App({ screen, onNavigate }) {
  const ledger = useLedger();
  const { spaces, cycles, mode } = ledger;
  const [crop, setCrop] = useState("Basil");
  const [spaceId, setSpaceId] = useState("all");
  const [notice, setNotice] = useState(null);
  const [readOnly, setReadOnly] = useState(false);

  const crops = [...new Set([...CROPS, ...cycles.map((c) => c.crop), crop])];
  const sortedSpaces = [...spaces].sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  // Runs writes in order; returns true when everything saved
  async function run(ops, message) {
    try {
      for (const [kind, id, data] of ops) await ledger.write(kind, id, data);
      if (message) setNotice({ text: message });
      return true;
    } catch (e) {
      if (e && e.code === "invalid_argument") {
        setReadOnly(true);
        setNotice({ text: "You can view this ledger but not change it. Ask the owner for Contributor access.", warn: true });
      } else if (e && e.code === "quota_exceeded") {
        setNotice({ text: "The ledger is full. Delete old cycles to make room.", warn: true });
      } else {
        setNotice({ text: "Couldn't save just now. Check your connection and try again.", warn: true });
      }
      return false;
    }
  }

  async function addCycles(list, message) {
    const ok = await run(list.map(({ id, ...rest }) => ["cycles", id, rest]), message);
    if (ok) { setCrop(list[0].crop); setSpaceId(list[0].spaceId || "all"); onNavigate("dashboard"); }
    return ok;
  }
  const saveSpace = ({ id, ...rest }) =>
    run([["spaces", id, rest]], `${rest.name} saved.`);
  const deleteSpace = (space) => run([
    ...cycles.filter((c) => c.spaceId === space.id).map(({ id, ...rest }) => ["cycles", id, { ...rest, spaceId: "" }]),
    ["spaces", space.id, null],
  ], `${space.name} deleted.`).then((ok) => { if (ok && spaceId === space.id) setSpaceId("all"); return ok; });

  const switchMode = (m) => onNavigate(m === "csv" ? "import" : "log");
  const status = mode === "live" ? ["live", "Saved to this ledger"]
    : mode === "local" ? ["live", "Saved in this browser"]
    : mode === "sample" ? ["warn", "Sample data · your first change saves it in this browser"]
    : mode === "error" ? ["warn", "Can't reach saved data"]
    : ["", ledger.slow ? "Still connecting to saved data…" : "Loading…"];

  return (
    <div className="app">
      <header className="app-head">
        <div className="logo"><span className="logo-mark">G</span>GrowLedger <span className="sub" style={{ fontFamily: "var(--font-body)", fontWeight: 400 }}>· Riverside Greens</span></div>
        <span className={"status " + status[0]}><i></i>{status[1]}</span>
      </header>

      {notice && <div className={"notice" + (notice.warn ? " warn" : "")} role="status">{notice.text}</div>}

      {mode === "loading" ? (
        <Box><div className="empty"><p>{ledger.slow ? "Your saved data can't be reached yet. It will appear when the connection returns." : "Loading your ledger…"}</p></div></Box>
      ) : (
        <>
          {screen === "dashboard" && (
            <Dashboard cycles={cycles} spaces={sortedSpaces} crop={crop} crops={crops} spaceId={spaceId}
                       onCropChange={setCrop} onSpaceChange={setSpaceId}
                       onNewCycle={() => onNavigate("log")} onSpaces={() => onNavigate("spaces")} />
          )}
          {screen === "log" && (
            <CycleForm spaces={sortedSpaces} onModeChange={switchMode} readOnly={readOnly}
                       onSave={(c) => addCycles([c], `Saved. ${c.crop} cycle added at ${fmtMoney(costPerUnit(c))} per ${c.unit}.`)} />
          )}
          {screen === "import" && (
            <CsvImport spaces={sortedSpaces} onModeChange={switchMode} readOnly={readOnly}
                       onImport={(list) => addCycles(list, `Imported ${list.length} cycles.`)} />
          )}
          {screen === "spaces" && (
            <GrowSpaces spaces={sortedSpaces} cycles={cycles} readOnly={readOnly}
                        onSave={saveSpace} onDelete={deleteSpace}
                        onOpen={(s) => { setSpaceId(s.id); const c = cycles.find((x) => x.spaceId === s.id); if (c) setCrop(c.crop); onNavigate("dashboard"); }} />
          )}
        </>
      )}
    </div>
  );
}
