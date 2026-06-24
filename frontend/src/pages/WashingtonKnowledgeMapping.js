import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../AppContext";
import {
  WK_LIST, NBA_POS, PO_COMPETENCIES,
  derivePOsFromWKs, computeMappingValue,
} from "../constants";

const ALL_PO_IDS = Object.keys(PO_COMPETENCIES);

const SECTIONS = [
  { id: "wk",      label: "Step 1 — CO↔WK" },
  { id: "derived", label: "Step 2 — Derived Connections" },
  { id: "pi",      label: "Step 3 — Performance Indicators" },
  { id: "result",  label: "Step 4 — Result Matrix" },
];

function cellStyle(connected) {
  return {
    textAlign: "center", fontWeight: 700,
    background: connected ? "#d4edda" : "#f8f9fa",
    color: connected ? "#155724" : "#ccc",
  };
}

function valueBadge(v) {
  // null = below threshold → show "—"
  if (v === null || v === 0) {
    return (
      <span style={{
        display: "inline-block", minWidth: 28, padding: "2px 8px",
        borderRadius: 20, fontWeight: 800, fontSize: 13,
        background: "#f8f9fa", color: "#ccc", border: "1px solid #dee2e6",
      }}>—</span>
    );
  }
  const cfg = {
    3: { bg: "#d4edda", color: "#155724", border: "#82c891" },
    2: { bg: "#fff3cd", color: "#856404", border: "#ffd666" },
    1: { bg: "#f8d7da", color: "#721c24", border: "#f5a7ae" },
  }[v] || { bg: "#f8f9fa", color: "#6c757d", border: "#dee2e6" };
  return (
    <span style={{
      display: "inline-block", minWidth: 28, padding: "2px 8px",
      borderRadius: 20, fontWeight: 800, fontSize: 13,
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.border}`,
    }}>
      {v}
    </span>
  );
}

// ── Step 1: CO → WK checkbox table ────────────────────────────────────────────
function CoWkTable({ cos, coWks, onChange }) {
  return (
    <div className="panel wide">
      <div className="panel-title">
        <h2>Step 1 — CO to WK Connection</h2>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          Check each WK addressed by each CO
        </span>
      </div>
      <div className="table-wrap">
        <table className="matrix-table">
          <thead>
            <tr>
              <th style={{ textAlign: "left", minWidth: 80 }}>CO</th>
              {WK_LIST.map((wk) => (
                <th key={wk.id} title={wk.label} style={{ minWidth: 52 }}>{wk.id}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cos.map((co) => (
              <tr key={co.id}>
                <td style={{ fontWeight: 700, background: "#f0f4f8" }}>{co.id}</td>
                {WK_LIST.map((wk) => {
                  const checked = coWks[co.id]?.[wk.id] ?? false;
                  return (
                    <td key={wk.id} style={{ textAlign: "center", padding: 6, background: checked ? "#d4edda" : "#fff" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => onChange(co.id, wk.id, e.target.checked)}
                        style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#2a9d8f" }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "3px 20px" }}>
        {WK_LIST.map((wk) => (
          <div key={wk.id} style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.4 }}>
            <strong style={{ color: "var(--ink)" }}>{wk.id}:</strong> {wk.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Step 2: Derived CO-WK-PO table + Y/— binary matrix ───────────────────────
function CoWkPoTable({ cos, coWks, activePOs, psoWkMap }) {
  return (
    <div className="panel wide">
      <div className="panel-title">
        <h2>Step 2 — Derived Connection between COs, WKs and POs</h2>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Auto-computed from Step 1</span>
      </div>
      <div className="table-wrap">
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ minWidth: 70, background: "#d7e4f1", border: "1px solid var(--line)", padding: "8px 10px", textAlign: "left" }}>CO</th>
              <th style={{ minWidth: 180, background: "#d7e4f1", border: "1px solid var(--line)", padding: "8px 10px", textAlign: "left" }}>WKs Addressed</th>
              <th style={{ background: "#d7e4f1", border: "1px solid var(--line)", padding: "8px 10px", textAlign: "left" }}>Applicable POs / PSOs</th>
            </tr>
          </thead>
          <tbody>
            {cos.map((co) => {
              const checkedWks = WK_LIST.filter((wk) => coWks[co.id]?.[wk.id]).map((wk) => wk.id);
              const derived = derivePOsFromWKs(checkedWks, psoWkMap).filter((po) => activePOs.includes(po));
              return (
                <tr key={co.id}>
                  <td style={{ fontWeight: 700, border: "1px solid var(--line)", padding: "8px 10px", background: "#f0f4f8" }}>{co.id}</td>
                  <td style={{ border: "1px solid var(--line)", padding: "8px 10px", background: "#fff" }}>
                    {checkedWks.length ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {checkedWks.map((wk) => (
                          <span key={wk} style={{ background: "#e3f2fd", color: "#0d47a1", border: "1px solid #90caf9", borderRadius: 12, padding: "1px 8px", fontSize: 12, fontWeight: 700 }}>{wk}</span>
                        ))}
                      </div>
                    ) : <span style={{ color: "#ccc" }}>—</span>}
                  </td>
                  <td style={{ border: "1px solid var(--line)", padding: "8px 10px", background: "#fff" }}>
                    {derived.length ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {derived.map((po) => (
                          <span key={po} style={{ background: "#d4edda", color: "#155724", border: "1px solid #82c891", borderRadius: 12, padding: "1px 8px", fontSize: 12, fontWeight: 700 }}>{po}</span>
                        ))}
                      </div>
                    ) : <span style={{ color: "#ccc" }}>No WKs selected</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CoPoBinaryMatrix({ cos, coWks, activePOs, psoWkMap }) {
  return (
    <div className="panel wide">
      <div className="panel-title">
        <h2>Mapping between COs and POs</h2>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Y = connected via shared WK&nbsp;|&nbsp;— = no connection</span>
      </div>
      <div className="table-wrap">
        <table className="matrix-table">
          <thead>
            <tr>
              <th style={{ textAlign: "left", minWidth: 70 }}>CO \ PO</th>
              {activePOs.map((po) => <th key={po} style={{ minWidth: 46 }}>{po}</th>)}
            </tr>
          </thead>
          <tbody>
            {cos.map((co) => {
              const checkedWks = WK_LIST.filter((wk) => coWks[co.id]?.[wk.id]).map((wk) => wk.id);
              const derived = derivePOsFromWKs(checkedWks, psoWkMap);
              return (
                <tr key={co.id}>
                  <td style={{ fontWeight: 700, background: "#f0f4f8" }}>{co.id}</td>
                  {activePOs.map((po) => (
                    <td key={po} style={cellStyle(derived.includes(po))}>
                      {derived.includes(po) ? "Y" : "—"}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Step 3: PI entry per PO, all connected COs side by side ──────────────────
function PoBlock({ po, poObj, cos, coWks, piAnswers, onPiChange, psoWkMap, piRubric }) {
  const competencies = PO_COMPETENCIES[po] || [];
  const allPIs = competencies.flatMap((c) => c.pis);

  const connectedCos = cos.filter((co) => {
    const wks = WK_LIST.filter((wk) => coWks[co.id]?.[wk.id]).map((wk) => wk.id);
    return derivePOsFromWKs(wks, psoWkMap).includes(po);
  });

  if (connectedCos.length === 0) return null;

  const coStats = connectedCos.map((co) => {
    const answers = piAnswers[co.id]?.[po] || {};
    return { co: co.id, ...computeMappingValue(answers, competencies, piRubric) };
  });

  return (
    <div style={{ marginBottom: 24, border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ background: "#1e2a36", color: "#fff", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <strong style={{ fontSize: 15 }}>{po}</strong>
          <span style={{ fontSize: 13, marginLeft: 10, color: "rgba(255,255,255,0.75)" }}>{poObj?.label}</span>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {coStats.map(({ co, x, value }) => (
            <span key={co} style={{ fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
              {co}: <strong style={{ color: "#fff" }}>X={x.toFixed(1)}%</strong> {valueBadge(value)}
            </span>
          ))}
        </div>
      </div>
      <div style={{ background: "#f8fafc", padding: "6px 16px", fontSize: 12, color: "var(--muted)", borderBottom: "1px solid var(--line)" }}>
        X = (Number of Yes) / (Number of PIs) × 100&nbsp;|&nbsp;Total PIs = {allPIs.length}&nbsp;|&nbsp;
        Rubric: {piRubric.t1}–{piRubric.t2 - 1} → 1&nbsp; {piRubric.t2}–{piRubric.t3 - 1} → 2&nbsp; {piRubric.t3}–100 → 3
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ background: "#d7e4f1", border: "1px solid var(--line)", padding: "7px 10px", minWidth: 80, textAlign: "center" }}>Competency</th>
              <th style={{ background: "#d7e4f1", border: "1px solid var(--line)", padding: "7px 10px", minWidth: 60, textAlign: "center" }}>PI</th>
              <th style={{ background: "#d7e4f1", border: "1px solid var(--line)", padding: "7px 10px", textAlign: "left" }}>Performance Indicator</th>
              {connectedCos.map((co) => (
                <th key={co.id} style={{ background: "#b8cde2", border: "1px solid var(--line)", padding: "7px 14px", minWidth: 70, textAlign: "center" }}>{co.id}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {competencies.map((comp) =>
              comp.pis.map((pi, piIdx) => (
                <tr key={pi.id} style={{ background: piIdx % 2 === 0 ? "#fff" : "#fafbfc" }}>
                  {piIdx === 0 && (
                    <td rowSpan={comp.pis.length} style={{
                      border: "1px solid var(--line)", padding: "8px 10px",
                      verticalAlign: "middle", textAlign: "center",
                      fontWeight: 700, fontSize: 12, color: "var(--blue)",
                      background: "#eef4f8", minWidth: 80,
                    }}>
                      {comp.id}
                    </td>
                  )}
                  <td style={{ border: "1px solid var(--line)", padding: "7px 10px", textAlign: "center", fontWeight: 700, color: "var(--muted)", fontSize: 12, minWidth: 60 }}>
                    {pi.id}
                  </td>
                  <td style={{ border: "1px solid var(--line)", padding: "7px 10px" }}>{pi.label}</td>
                  {connectedCos.map((co) => {
                    const checked = piAnswers[co.id]?.[po]?.[pi.id] ?? false;
                    return (
                      <td key={co.id} style={{
                        border: "1px solid var(--line)", padding: "7px 10px",
                        textAlign: "center", background: checked ? "#f0fff4" : "#fff",
                      }}>
                        <label style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer", fontWeight: 700, fontSize: 12, color: checked ? "#155724" : "#721c24" }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => onPiChange(co.id, po, pi.id, e.target.checked)}
                            style={{ width: 14, height: 14, accentColor: "#2a9d8f", cursor: "pointer" }}
                          />
                          {checked ? "Yes" : "No"}
                        </label>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
            <tr>
              <td colSpan={3} style={{ border: "1px solid var(--line)", padding: "7px 10px", fontWeight: 800, background: "#d7e4f1", textAlign: "right" }}>
                X = (Yes / {allPIs.length}) × 100
              </td>
              {coStats.map(({ co, x }) => (
                <td key={co} style={{ border: "1px solid var(--line)", padding: "7px 10px", fontWeight: 800, background: "#d7e4f1", textAlign: "center" }}>
                  {x.toFixed(2)}
                </td>
              ))}
            </tr>
            <tr>
              <td colSpan={3} style={{ border: "1px solid var(--line)", padding: "7px 10px", fontWeight: 800, background: "#b8cde2", textAlign: "right" }}>
                Mapping Value (Rubric)
              </td>
              {coStats.map(({ co, value }) => (
                <td key={co} style={{ border: "1px solid var(--line)", padding: "7px 10px", textAlign: "center", background: "#b8cde2" }}>
                  {valueBadge(value)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Step 4: Final CO-PO matrix ────────────────────────────────────────────────
function ResultMatrix({ cos, coWks, piAnswers, activePOs, psoWkMap, piRubric }) {
  const matrix = useMemo(() => {
    return cos.map((co) => {
      const wks = WK_LIST.filter((wk) => coWks[co.id]?.[wk.id]).map((wk) => wk.id);
      const derived = derivePOsFromWKs(wks, psoWkMap);
      const row = {};
      activePOs.forEach((po) => {
        if (!derived.includes(po)) { row[po] = null; return; }  // not connected → null → "—"
        const comps = PO_COMPETENCIES[po] || [];
        const answers = piAnswers[co.id]?.[po] || {};
        const { value } = computeMappingValue(answers, comps, piRubric);
        row[po] = value; // null when below t1, 1/2/3 otherwise
      });
      return { co: co.id, row };
    });
  }, [cos, coWks, piAnswers, activePOs, psoWkMap, piRubric]);

  return (
    <div className="panel wide">
      <div className="panel-title">
        <h2>Step 4 — Final CO-PO Mapping Matrix</h2>
        <span style={{ fontSize: 12, color: "var(--muted)", display: "flex", gap: 8, alignItems: "center" }}>
          Auto-computed&nbsp;|&nbsp;
          {[["3", "#d4edda", "#155724"], ["2", "#fff3cd", "#856404"], ["1", "#f8d7da", "#721c24"], ["—", "#f8f9fa", "#6c757d"]].map(([lbl, bg, color]) => (
            <span key={lbl} style={{ background: bg, color, border: `1px solid ${color}`, borderRadius: 4, padding: "1px 7px", fontWeight: 700, fontSize: 12 }}>{lbl}</span>
          ))}
        </span>
      </div>
      <div className="table-wrap">
        <table className="matrix-table">
          <thead>
            <tr>
              <th style={{ textAlign: "left", minWidth: 70, background: "#1e2a36", color: "#fff" }}>CO \ PO</th>
              {activePOs.map((po) => (
                <th key={po} style={{ minWidth: 46, background: "#1e2a36", color: "#fff" }}>{po}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map(({ co, row }) => (
              <tr key={co}>
                <td style={{ fontWeight: 800, background: "#f0f4f8" }}>{co}</td>
                {activePOs.map((po) => {
                  const v = row[po];
                  // null = not connected or below threshold → show "—" with grey bg
                  const isBlank = v === null;
                  const bg = v === 3 ? "#d4edda" : v === 2 ? "#fff3cd" : v === 1 ? "#f8d7da" : "#f8f9fa";
                  return (
                    <td key={po} style={{ textAlign: "center", fontWeight: 800, background: bg, color: isBlank ? "#ccc" : "inherit" }}>
                      {isBlank ? "—" : v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function WKMapping() {
  const { courseData, setCourseData } = useApp();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("wk");

  const { coWks, piAnswers } = courseData.wkMapping;
  const activePOs = courseData.pos;
  const psoWkMap = courseData.psoWkMap;
  const piRubric = courseData.piRubric ?? { t1: 10, t2: 34, t3: 68 };

  function updateRubric(key, val) {
    setCourseData((prev) => ({ ...prev, piRubric: { ...prev.piRubric, [key]: Number(val) || 0 } }));
  }

  const activePOsWithConnections = useMemo(() => {
    return ALL_PO_IDS.filter((po) =>
      activePOs.includes(po) &&
      courseData.cos.some((co) => {
        const wks = WK_LIST.filter((wk) => coWks[co.id]?.[wk.id]).map((wk) => wk.id);
        return derivePOsFromWKs(wks, psoWkMap).includes(po);
      })
    );
  }, [activePOs, courseData.cos, coWks, psoWkMap]);

  function handleWkChange(coId, wkId, checked) {
    setCourseData((prev) => ({
      ...prev,
      wkMapping: {
        ...prev.wkMapping,
        coWks: {
          ...prev.wkMapping.coWks,
          [coId]: { ...prev.wkMapping.coWks[coId], [wkId]: checked },
        },
      },
    }));
  }

  function handlePiChange(coId, poId, piId, checked) {
    setCourseData((prev) => ({
      ...prev,
      wkMapping: {
        ...prev.wkMapping,
        piAnswers: {
          ...prev.wkMapping.piAnswers,
          [coId]: {
            ...prev.wkMapping.piAnswers[coId],
            [poId]: {
              ...prev.wkMapping.piAnswers[coId]?.[poId],
              [piId]: checked,
            },
          },
        },
      },
    }));
  }

  // Only callable from Step 4 — builds final mapping and writes wkMappingDone
  function applyToMapping() {
    const newMapping = {};
    courseData.cos.forEach((co) => {
      const wks = WK_LIST.filter((wk) => coWks[co.id]?.[wk.id]).map((wk) => wk.id);
      const derived = derivePOsFromWKs(wks, psoWkMap);
      newMapping[co.id] = {};
      activePOs.forEach((po) => {
        if (!derived.includes(po)) {
          // Not connected via WK — store null so report shows "—", not 0
          newMapping[co.id][po] = null;
          return;
        }
        const comps = PO_COMPETENCIES[po] || [];
        const answers = piAnswers[co.id]?.[po] || {};
        const { value } = computeMappingValue(answers, comps, piRubric);
        // value is null when below t1, or 1/2/3 — never store 0
        newMapping[co.id][po] = value;
      });
    });
    setCourseData((prev) => ({ ...prev, mapping: newMapping, wkMappingDone: true }));
    navigate("/marks");
  }

  return (
    <div>
      <header className="topbar">
        <div>
          <p className="eyebrow">Step 3b — Washington Accord</p>
          <h1>WK-based CO-PO Mapping</h1>
        </div>
        <div className="top-actions">
          <button className="secondary" onClick={() => navigate("/questions")}>← Back</button>
          {/* Final apply only shown on Step 4 so faculty must complete all steps */}
          {activeSection === "result" && (
            <button onClick={applyToMapping}>Apply Mapping &amp; Next: Marks →</button>
          )}
        </div>
      </header>

      {/* Step tabs */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4 }}>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            style={{
              padding: "7px 18px", borderRadius: 6, fontWeight: 700, fontSize: 13,
              background: activeSection === s.id ? "var(--blue)" : "#edf4f6",
              color: activeSection === s.id ? "#fff" : "var(--blue)",
              border: "1px solid var(--line)",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {activeSection === "wk" && (
        <>
          {/* Rubric editor */}
          <div className="panel wide">
            <div className="panel-title">
              <h2>PI Rubric Thresholds</h2>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>Set the % cutoffs for mapping values 1, 2, 3 — adjust per course</span>
            </div>
            <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
              {[["t1", "≥ % for Level 1"], ["t2", "≥ % for Level 2"], ["t3", "≥ % for Level 3"]].map(([key, label]) => (
                <label key={key} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600 }}>
                  {label}
                  <input
                    type="number" min={0} max={100}
                    value={piRubric[key]}
                    onChange={(e) => updateRubric(key, e.target.value)}
                    style={{ width: 72, textAlign: "center", fontWeight: 800, fontSize: 15 }}
                  />
                </label>
              ))}
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
                Current rubric: X ≥ {piRubric.t3}% → 3 &nbsp;|&nbsp; X ≥ {piRubric.t2}% → 2 &nbsp;|&nbsp; X ≥ {piRubric.t1}% → 1 &nbsp;|&nbsp; X &lt; {piRubric.t1}% → — (not mapped)
              </div>
            </div>
          </div>
          <CoWkTable cos={courseData.cos} coWks={coWks} onChange={handleWkChange} />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
            <button onClick={() => setActiveSection("derived")}>
              Next: Step 2 — Derived Connections →
            </button>
          </div>
        </>
      )}

      {activeSection === "derived" && (
        <>
          <CoWkPoTable cos={courseData.cos} coWks={coWks} activePOs={activePOs} psoWkMap={psoWkMap} />
          <CoPoBinaryMatrix cos={courseData.cos} coWks={coWks} activePOs={activePOs} psoWkMap={psoWkMap} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <button className="secondary" onClick={() => setActiveSection("wk")}>← Step 1</button>
            <button onClick={() => setActiveSection("pi")}>Next: Step 3 — Performance Indicators →</button>
          </div>
        </>
      )}

      {activeSection === "pi" && (
        <div className="panel wide">
          <div className="panel-title">
            <h2>Step 3 — Performance Indicator Entry (PO by PO)</h2>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              For each PO, mark Yes/No for every PI across all connected COs.
            </span>
          </div>
          {activePOsWithConnections.length === 0 ? (
            <div className="notice">
              No CO-PO connections found — complete Step 1 first by selecting WKs for each CO.
            </div>
          ) : (
            activePOsWithConnections.map((po) => {
              const poObj = NBA_POS.find((p) => p.id === po);
              return (
                <PoBlock
                  key={po}
                  po={po}
                  poObj={poObj}
                  cos={courseData.cos}
                  coWks={coWks}
                  piAnswers={piAnswers}
                  onPiChange={handlePiChange}
                  psoWkMap={psoWkMap}
                  piRubric={piRubric}
                />
              );
            })
          )}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
            <button className="secondary" onClick={() => setActiveSection("derived")}>← Step 2</button>
            <button onClick={() => setActiveSection("result")}>Next: Step 4 — Result Matrix →</button>
          </div>
        </div>
      )}

      {activeSection === "result" && (
        <>
          <ResultMatrix
            cos={courseData.cos}
            coWks={coWks}
            piAnswers={piAnswers}
            activePOs={activePOs}
            psoWkMap={psoWkMap}
            piRubric={piRubric}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <button className="secondary" onClick={() => setActiveSection("pi")}>← Step 3</button>
            <button onClick={applyToMapping}>Apply Mapping &amp; Next: Marks →</button>
          </div>
        </>
      )}
    </div>
  );
}
