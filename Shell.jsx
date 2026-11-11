const SCREENS = [
  { key: "dashboard", label: "Dashboard", file: "src-dashboard" },
  { key: "log", label: "Log a cycle", file: "src-form" },
  { key: "import", label: "Import CSV", file: "src-csv" },
  { key: "spaces", label: "Grow spaces", file: "src-spaces" },
];
const FILES = [
  { id: "src-dashboard", name: "Dashboard.jsx", caption: "Screen 1: stat tiles, trend chart, latest flag and the per-space comparison." },
  { id: "src-form", name: "CycleForm.jsx", caption: "Screen 2: manual entry with grow space, validation, live cost per unit and a lighting estimate." },
  { id: "src-csv", name: "CsvImport.jsx", caption: "Screen 3: file upload, CSV parsing and column matching." },
  { id: "src-spaces", name: "GrowSpaces.jsx", caption: "Screen 4: add, edit and delete grow spaces, with lighting kWh and cost per space." },
  { id: "src-shared", name: "shared.jsx", caption: "Data model, cost and lighting math, and the flagging engine." },
  { id: "src-app", name: "App.jsx", caption: "Loading and saving data, and navigation between screens." },
];

const TOKEN = /(\/\/[^\n]*)|(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\\n])*")|(<\/?[A-Za-z][\w.]*)|\b(const|let|function|return|if|else|for|of|new|async|await|true|false|null)\b|\b(\d+(?:\.\d+)?)\b/g;
const CLASSES = ["", "t-com", "t-str", "t-tag", "t-kw", "t-num"];
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function highlight(line) {
  let out = "", last = 0, m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(line))) {
    out += esc(line.slice(last, m.index));
    const group = m.slice(1).findIndex((g) => g !== undefined) + 1;
    out += `<span class="${CLASSES[group]}">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + esc(line.slice(last));
}

function CodeViewer({ fileId, onFile }) {
  const [copied, setCopied] = useState(false);
  const file = FILES.find((f) => f.id === fileId);
  const source = document.getElementById(fileId).textContent.replace(/^\n+|\s+$/g, "");
  const html = source.split("\n").map((l) => `<span class="ln">${highlight(l) || " "}</span>`).join("");

  function copy() {
    navigator.clipboard.writeText(source).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })
      .catch(() => window.getSelection().selectAllChildren(document.getElementById("code-pre")));
  }

  return (
    <div className="code">
      <div className="code-tabs" role="group" aria-label="Source files">
        {FILES.map((f) => (
          <button key={f.id} aria-pressed={f.id === fileId} onClick={() => onFile(f.id)}>{f.name}</button>
        ))}
        <button className="copy" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
      </div>
      <div className="code-caption">{file.caption}</div>
      <div className="code-body"><pre id="code-pre" dangerouslySetInnerHTML={{ __html: html }} /></div>
    </div>
  );
}

const screenFromHash = () => {
  const h = (location.hash || "").slice(1);
  return SCREENS.some((s) => s.key === h) ? h : "dashboard";
};

function Shell() {
  const [screen, setScreenState] = useState(screenFromHash);
  const [view, setView] = useState("screen");
  const [fileId, setFileId] = useState("src-dashboard");
  const current = SCREENS.find((s) => s.key === screen);

  const setScreen = (key) => {
    setScreenState(key);
    try { if (location.hash !== "#" + key) location.hash = key; } catch (e) {}
  };
  useEffect(() => {
    const onHash = () => setScreenState(screenFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => { setFileId(current.file); }, [screen]);

  return (
    <>
      <div className="bar">
        <div>
          <div className="eyebrow">Senior project · Frontend build</div>
          <h1>GrowLedger</h1>
          <p>Cost per unit for every grow cycle, by crop and grow space.</p>
        </div>
        <div className="controls">
          <div className="seg" role="group" aria-label="Screen">
            {SCREENS.map((s, i) => (
              <button key={s.key} aria-pressed={screen === s.key} onClick={() => setScreen(s.key)}>
                <span className="num">{i + 1}</span>{s.label}
              </button>
            ))}
          </div>
          <div className="seg" role="group" aria-label="View">
            {["screen", "split", "code"].map((v) => (
              <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>
                {v === "split" ? "App + code" : v === "screen" ? "App" : "Code"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={"stage" + (view === "split" ? " split" : "")}>
        <div className="frame" hidden={view === "code"}>
          <App screen={screen} onNavigate={setScreen} />
        </div>
        {view !== "screen" && <CodeViewer fileId={fileId} onFile={setFileId} />}
      </div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Shell />);
