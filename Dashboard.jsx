// Dashboard.jsx  (Screen 1)
function Dashboard({ cycles, spaces, crop, crops, spaceId, onCropChange, onSpaceChange, onNewCycle, onSpaces }) {
  const history = cyclesForCrop(cycles, crop, spaceId);
  const latest = history[history.length - 1];
  const spaceById = Object.fromEntries(spaces.map((s) => [s.id, s]));
  const spaceName = spaceId === "all" ? "All spaces" : spaceId === "" ? "Unassigned" : (spaceById[spaceId]?.name || "Unknown space");

  const header = (
    <div className="row screen-title">
      <div>
        <h2>{crop} · {spaceName}</h2>
        <p className="sub">{history.length} {history.length === 1 ? "cycle" : "cycles"} logged</p>
      </div>
      <div className="row">
        <select aria-label="Crop" className="pick" value={crop} onChange={(e) => onCropChange(e.target.value)}>
          {crops.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select aria-label="Grow space" className="pick" value={spaceId} onChange={(e) => onSpaceChange(e.target.value)}>
          <option value="all">All spaces</option>
          {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          <option value="">Unassigned</option>
        </select>
        <button className="btn" onClick={onNewCycle}>+ New cycle</button>
      </div>
    </div>
  );

  if (!latest) {
    return (
      <>
        {header}
        <Box>
          <div className="empty">
            <p>No {crop.toLowerCase()} cycles in {spaceName.toLowerCase()} yet.</p>
            <button className="btn" onClick={onNewCycle}>+ Log a cycle</button>
          </div>
        </Box>
      </>
    );
  }

  const prior = history.slice(-1 - HISTORY_WINDOW, -1);
  const vsAverage = prior.length ? pctChange(costPerUnit(latest), average(prior.map(costPerUnit))) : null;
  const flags = history.map((_, i) => findFlag(history, i)).filter(Boolean);
  const latestFlag = flags[flags.length - 1];
  const latestSpace = spaceById[latest.spaceId];
  const perSqft = yieldPerSqft(latest, latestSpace);

  // Same crop, every space side by side
  const allForCrop = cycles.filter((c) => c.crop === crop);
  const groups = [...spaces.map((s) => s.id), ""].map((id) => {
    const list = allForCrop.filter((c) => (c.spaceId || "") === id);
    const space = spaceById[id];
    return {
      id, name: space ? space.name : "Unassigned", count: list.length,
      avgCost: average(list.map(costPerUnit)),
      avgSqft: space ? average(list.map((c) => yieldPerSqft(c, space))) : null,
    };
  }).filter((g) => g.count > 0);

  return (
    <>
      {header}
      <div className="tiles">
        <Box>
          <div className="tile-label">Cost/{latest.unit}, latest</div>
          <div className="tile-value">{fmtMoney(costPerUnit(latest))}</div>
          <div className="tile-foot">{fmtMoney(totalCost(latest))} total</div>
        </Box>
        <Box>
          <div className="tile-label">Vs. {prior.length}-cycle avg</div>
          <div className={"tile-value " + (vsAverage === null ? "" : vsAverage <= 0 ? "good" : "bad")}>
            {vsAverage === null ? "—" : fmtPct(vsAverage)}
          </div>
          <div className="tile-foot">lower is better</div>
        </Box>
        <Box>
          <div className="tile-label">Yield, latest</div>
          <div className="tile-value">{fmtNum(latest.yieldAmount, 1)} {latest.unit}</div>
          <div className="tile-foot">{fmtDate(latest.start)} – {fmtDate(latest.end)}</div>
        </Box>
        <Box>
          <div className="tile-label">Yield per sq ft</div>
          <div className="tile-value">{perSqft === null ? "—" : fmtNum(perSqft, 2)}</div>
          <div className="tile-foot">{latestSpace ? `${latest.unit}/sq ft · ${latestSpace.name}` : "assign a grow space"}</div>
        </Box>
      </div>

      <Box label="Cost per unit by cycle">
        <div className="chart">
          <CostChart history={history} flagged={flags.map((f) => f.cycleNumber)} unit={latest.unit} />
        </div>
      </Box>

      {latestFlag && (
        <Box label="Deviation flag" tone="flag">
          <div className="flag">
            <p className="flag-title">Cycle {latestFlag.cycleNumber} · {fmtDate(latestFlag.cycle.start)}</p>
            <p>
              {latestFlag.driver.label} cost per unit was up {Math.round(latestFlag.driver.change)}% vs.{" "}
              {latestFlag.priorCount === 1 ? "your previous cycle" : `your last ${latestFlag.priorCount} cycles`}{" "}
              (total cost per {latest.unit} {fmtPct(latestFlag.change)}).
            </p>
            {latestFlag.note && <p className="note">Your note that cycle: “{latestFlag.note}”</p>}
          </div>
        </Box>
      )}

      <Box label={`${crop} by grow space`}>
        {groups.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Space</th><th className="num">Cycles</th><th className="num">Avg cost/unit</th><th className="num">Avg yield/sq ft</th></tr></thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id || "none"} className={"clickable" + (spaceId === g.id ? " current" : "")}
                      onClick={() => onSpaceChange(spaceId === g.id ? "all" : g.id)}>
                    <td>{g.name}</td><td className="num">{g.count}</td>
                    <td className="num">{fmtMoney(g.avgCost)}</td>
                    <td className="num">{g.avgSqft === null ? "—" : fmtNum(g.avgSqft, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="sub">No cycles yet.</p>}
        <div className="actions" style={{ marginTop: 10 }}>
          <button className="btn ghost small" onClick={onSpaces}>Manage grow spaces</button>
        </div>
      </Box>
    </>
  );
}

function CostChart({ history, flagged, unit }) {
  const W = 560, H = 230, left = 44, right = 12, top = 26, bottom = 30;
  const values = history.map(costPerUnit);
  const yMax = Math.max(2, Math.ceil((Math.max(...values) * 1.15) / 2) * 2);
  const step = yMax > 20 ? Math.ceil(yMax / 10 / 2) * 2 : 2;
  const ticks = [];
  for (let t = 0; t <= yMax; t += step) ticks.push(t);

  const plotW = W - left - right, plotH = H - top - bottom;
  const band = plotW / values.length;
  const barW = Math.min(64, band * 0.55);
  const y = (v) => top + plotH - (v / yMax) * plotH;
  const showEvery = Math.ceil(values.length / 8);

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Cost per ${unit} by cycle`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={left} x2={W - right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray="3 4" />
            <text x={left - 8} y={y(t) + 4} textAnchor="end">${t}</text>
          </g>
        ))}
        {values.map((v, i) => {
          const x = left + band * i + (band - barW) / 2;
          const isFlagged = flagged.includes(i + 1);
          return (
            <g key={i}>
              <rect x={x} y={y(v)} width={barW} height={y(0) - y(v)} rx="3" fill={isFlagged ? "var(--soil)" : "var(--leaf)"} />
              {values.length <= 12 && <text className="val" x={x + barW / 2} y={y(v) - 7} textAnchor="middle">{v.toFixed(2)}</text>}
              {i % showEvery === 0 && <text x={x + barW / 2} y={H - 10} textAnchor="middle">#{i + 1}</text>}
            </g>
          );
        })}
      </svg>
      <div className="legend">
        <span><i style={{ background: "var(--leaf)" }}></i>Normal</span>
        <span><i style={{ background: "var(--soil)" }}></i>Flagged (10%+ above average)</span>
      </div>
    </>
  );
}
