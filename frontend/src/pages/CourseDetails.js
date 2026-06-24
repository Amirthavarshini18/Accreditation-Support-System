import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp, blankWkMapping } from "../AppContext";
import {
  COURSE_FIELDS, GRADING_POLICY, gradeToTarget,
  DEFAULT_TARGET_GRADE, DEFAULT_TARGET_PCT,
  WK_LIST, PO_COMPETENCIES, BLOOMS_LEVELS, SDG_LIST,
} from "../constants";

const SEMESTER_OPTIONS = ["Monsoon Semester", "Winter Semester"];
const COURSE_YEAR_OPTIONS = ["I", "II", "III", "IV"];

// Controlled number input
function NumInput({ value, onChange, onBlur, min, max, style }) {
  const [display, setDisplay] = useState(String(value ?? ""));
  useEffect(() => { setDisplay(String(value ?? "")); }, [value]);
  return (
    <input
      type="number" min={min} max={max} value={display} style={style}
      onChange={(e) => setDisplay(e.target.value)}
      onBlur={() => {
        const n = display === "" ? (min ?? 0) : Math.min(max ?? Infinity, Math.max(min ?? -Infinity, Number(display)));
        const final = isNaN(n) ? (min ?? 0) : n;
        setDisplay(String(final));
        onChange(final);
        onBlur?.();
      }}
    />
  );
}

// Bloom's multi-select pills
function BloomsPills({ selected = [], onChange }) {
  const arr = Array.isArray(selected) ? selected : (selected ? [selected] : []);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {BLOOMS_LEVELS.map((b) => {
        const active = arr.includes(b.id);
        return (
          <button key={b.id} type="button"
            onClick={() => onChange(active ? arr.filter((x) => x !== b.id) : [...arr, b.id])}
            style={{
              padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
              cursor: "pointer", border: `1.5px solid ${active ? b.border : "#e2e8f0"}`,
              background: active ? b.color : "#f8fafc",
              color: active ? b.text : "#94a3b8",
            }}
          >{b.id}</button>
        );
      })}
    </div>
  );
}

// SDG multi-select dropdown
function SdgDropdown({ selected = [], onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (sdgId) => {
    const next = selected.includes(sdgId) ? selected.filter((s) => s !== sdgId) : [...selected, sdgId];
    onChange(next);
  };

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          border: "1px solid var(--line)", borderRadius: 6, padding: "7px 10px",
          background: "#fff", cursor: "pointer", fontSize: 13, minHeight: 36,
          display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center",
          color: selected.length ? "var(--ink)" : "#94a3b8",
        }}
      >
        {selected.length === 0 && <span>Select SDGs…</span>}
        {selected.map((s) => (
          <span key={s} style={{
            background: "#e0f7fa", color: "#006064", border: "1px solid #80deea",
            borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700,
          }}>{s}
            <span
              onClick={(e) => { e.stopPropagation(); toggle(s); }}
              style={{ marginLeft: 4, cursor: "pointer", fontWeight: 900 }}>×</span>
          </span>
        ))}
        <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{
          position: "absolute", zIndex: 999, top: "calc(100% + 4px)", left: 0, right: 0,
          background: "#fff", border: "1px solid var(--line)", borderRadius: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", maxHeight: 260, overflowY: "auto",
        }}>
          {SDG_LIST.map((sdg) => {
            const sdgId = sdg.split(":")[0];
            const active = selected.includes(sdgId);
            return (
              <div key={sdgId}
                onClick={() => toggle(sdgId)}
                style={{
                  padding: "8px 12px", cursor: "pointer", fontSize: 13,
                  background: active ? "#e0f7fa" : "#fff",
                  color: active ? "#006064" : "var(--ink)",
                  fontWeight: active ? 700 : 400,
                  borderBottom: "1px solid #f0f4f8",
                  display: "flex", alignItems: "center", gap: 8,
                }}
              >
                <span style={{
                  width: 16, height: 16, borderRadius: 4, border: "1.5px solid",
                  borderColor: active ? "#006064" : "#ccc",
                  background: active ? "#006064" : "#fff",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, color: "#fff", flexShrink: 0,
                }}>{active ? "✓" : ""}</span>
                {sdg}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Inline select that renders as a dropdown within a table cell
function InlineSelect({ value, onChange, options, placeholder }) {
  return (
    <select value={value || ""} onChange={(e) => onChange(e.target.value)}
      style={{ width: "100%", fontSize: 13 }}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export default function CourseDetails() {
  const { courseData, setCourseData } = useApp();
  const navigate = useNavigate();

  function update(key, value) {
    setCourseData((prev) => ({ ...prev, course: { ...prev.course, [key]: value } }));
  }

  function updateCO(idx, changes) {
    setCourseData((prev) => ({
      ...prev,
      cos: prev.cos.map((c, i) => i === idx ? { ...c, ...changes } : c),
    }));
  }

  function addCO() {
    setCourseData((prev) => {
      const newId = `CO${prev.cos.length + 1}`;
      const newCos = [
        ...prev.cos,
        { id: newId, description: "", target: DEFAULT_TARGET_PCT, targetGrade: DEFAULT_TARGET_GRADE, sdgs: [], blooms: [] },
      ];
      const coWks = {
        ...prev.wkMapping.coWks,
        [newId]: Object.fromEntries(WK_LIST.map((wk) => [wk.id, false])),
      };
      const piAnswers = {
        ...prev.wkMapping.piAnswers,
        [newId]: Object.fromEntries(
          Object.keys(PO_COMPETENCIES).map((po) => [
            po,
            Object.fromEntries(PO_COMPETENCIES[po].flatMap((c) => c.pis).map((pi) => [pi.id, false])),
          ])
        ),
      };
      return {
        ...prev,
        cos: newCos,
        mapping: { ...prev.mapping, [newId]: Object.fromEntries(prev.pos.map((po) => [po, 0])) },
        indirectSurvey: {
          ...prev.indirectSurvey,
          responses: { ...prev.indirectSurvey.responses, [newId]: { VH: 0, H: 0, M: 0, L: 0, VL: 0 } },
        },
        wkMapping: { coWks, piAnswers },
      };
    });
  }

  function removeCO() {
    setCourseData((prev) => {
      if (prev.cos.length <= 1) return prev;
      const removed = prev.cos[prev.cos.length - 1].id;
      const cos = prev.cos.slice(0, -1);
      const mapping = { ...prev.mapping };
      delete mapping[removed];
      const coWks = { ...prev.wkMapping.coWks };
      delete coWks[removed];
      const piAnswers = { ...prev.wkMapping.piAnswers };
      delete piAnswers[removed];
      const responses = { ...prev.indirectSurvey.responses };
      delete responses[removed];
      return {
        ...prev, cos, mapping,
        wkMapping: { coWks, piAnswers },
        indirectSurvey: { ...prev.indirectSurvey, responses },
      };
    });
  }

  const c = courseData.course;

  return (
    <div>
      <header className="topbar">
        <div>
          <p className="eyebrow">Step 1</p>
          <h1>Course Details</h1>
        </div>
        <button onClick={() => navigate("/attainment-type")}>Next: Attainment Type →</button>
      </header>

      {/* Course Information */}
      <div className="panel wide">
        <div className="panel-title"><h2>Course Information</h2></div>
        <div className="profile-grid">
          <label>Course Name
            <input value={c.courseName || ""} onChange={(e) => update("courseName", e.target.value)} placeholder="e.g. Highway Engineering" />
          </label>
          <label>Course Code
            <input value={c.courseCode || ""} onChange={(e) => update("courseCode", e.target.value)} placeholder="e.g. CE401" />
          </label>
          <label>Academic Year
            <input value={c.academicYear || ""} onChange={(e) => update("academicYear", e.target.value)} placeholder="e.g. 2025-26" />
          </label>
          <label>Semester
            <select value={c.semester || ""} onChange={(e) => update("semester", e.target.value)}>
              <option value="">Select semester…</option>
              {SEMESTER_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>Programme
            <input value={c.programme || ""} onChange={(e) => update("programme", e.target.value)} placeholder="e.g. B.Tech" />
          </label>
          <label>Specialization
            <input value={c.specialization || ""} onChange={(e) => update("specialization", e.target.value)} placeholder="e.g. Civil Engineering" />
          </label>
          <label>Course Year
            <select value={c.courseYear || ""} onChange={(e) => update("courseYear", e.target.value)}>
              <option value="">Select year…</option>
              {COURSE_YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label>Course Semester
            <input value={c.courseSemester || ""} onChange={(e) => update("courseSemester", e.target.value)} placeholder="e.g. VI" />
          </label>
          <label>Credits
            <input value={c.credits || ""} onChange={(e) => update("credits", e.target.value)} placeholder="e.g. 3" />
          </label>
          <label>Faculty Name
            <input value={c.faculty || ""} onChange={(e) => update("faculty", e.target.value)} placeholder="e.g. Dr. A. Kumar" />
          </label>
        </div>
      </div>

      {/* Course Outcomes */}
      <div className="panel wide">
        <div className="panel-title"><h2>Course Outcomes (COs)</h2></div>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
          Define each CO. Bloom's Taxonomy supports multiple levels — click to toggle. SDGs are selectable from the dropdown.
        </p>

        {/* Bloom's legend */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14, padding: "10px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, marginRight: 4, alignSelf: "center" }}>Bloom's Levels:</span>
          {BLOOMS_LEVELS.map((b) => (
            <span key={b.id} style={{ padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: b.color, color: b.text, border: `1px solid ${b.border}` }}>
              {b.id}
            </span>
          ))}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 60 }}>CO</th>
                <th>CO Statement</th>
                <th style={{ width: 200 }}>Bloom's Taxonomy</th>
                <th style={{ width: 130 }}>Target Grade</th>
                <th style={{ width: 90 }}>Target %</th>
                <th style={{ minWidth: 220 }}>SDGs</th>
              </tr>
            </thead>
            <tbody>
              {courseData.cos.map((co, idx) => (
                <tr key={co.id}>
                  <td><strong>{co.id}</strong></td>
                  <td>
                    <input
                      value={co.description}
                      onChange={(e) => updateCO(idx, { description: e.target.value })}
                      placeholder={`Describe ${co.id}...`}
                    />
                  </td>
                  <td style={{ verticalAlign: "middle" }}>
                    <BloomsPills
                      selected={Array.isArray(co.blooms) ? co.blooms : (co.blooms ? [co.blooms] : [])}
                      onChange={(val) => updateCO(idx, { blooms: val })}
                    />
                    {Array.isArray(co.blooms) && co.blooms.length > 0 && (
                      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3 }}>{co.blooms.join(" + ")}</div>
                    )}
                  </td>
                  <td>
                    <select
                      value={co.targetGrade || DEFAULT_TARGET_GRADE}
                      onChange={(e) => updateCO(idx, { targetGrade: e.target.value, target: gradeToTarget(e.target.value) })}
                    >
                      {GRADING_POLICY.map((g) => <option key={g.grade} value={g.grade}>{g.grade}</option>)}
                    </select>
                  </td>
                  <td>
                    <NumInput
                      value={co.target ?? DEFAULT_TARGET_PCT} min={0} max={100}
                      onChange={(n) => updateCO(idx, { target: n, targetGrade: null })}
                      style={{ width: 62, textAlign: "center" }}
                    />
                    <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 3 }}>%</span>
                  </td>
                  <td style={{ verticalAlign: "top", paddingTop: 8 }}>
                    <SdgDropdown
                      selected={co.sdgs || []}
                      onChange={(val) => updateCO(idx, { sdgs: val })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
          <button className="secondary" onClick={addCO}>+ Add CO</button>
          {courseData.cos.length > 1 && (
            <button className="secondary" onClick={removeCO}>− Remove Last CO</button>
          )}
        </div>
      </div>

      {/* CO-Bloom's summary */}
      {courseData.cos.some((co) => Array.isArray(co.blooms) && co.blooms.length > 0) && (
        <div className="panel wide">
          <div className="panel-title"><h2>CO &amp; Bloom's Taxonomy Summary</h2></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>CO</th><th>CO Statement</th><th>Bloom's Taxonomy</th></tr>
              </thead>
              <tbody>
                {courseData.cos.map((co) => (
                  <tr key={co.id}>
                    <td><strong>{co.id}</strong></td>
                    <td>{co.description || <span style={{ color: "var(--muted)" }}>—</span>}</td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {(Array.isArray(co.blooms) ? co.blooms : []).map((b) => {
                          const lvl = BLOOMS_LEVELS.find((x) => x.id === b);
                          return (
                            <span key={b} style={{ padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: lvl?.color || "#f0f0f0", color: lvl?.text || "#333", border: `1px solid ${lvl?.border || "#ccc"}` }}>{b}</span>
                          );
                        })}
                        {(!co.blooms || co.blooms.length === 0) && <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
