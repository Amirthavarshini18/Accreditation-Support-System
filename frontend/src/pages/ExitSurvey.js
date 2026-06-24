import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../AppContext";
import { SCALE_LABELS } from "../constants";

function NumInput({ value, onChange, min = 0, max, style }) {
  const [display, setDisplay] = useState(String(value ?? ""));
  React.useEffect(() => { setDisplay(String(value ?? "")); }, [value]);
  return (
    <input
      type="number" min={min}
      value={display}
      style={style}
      onChange={(e) => setDisplay(e.target.value)}
      onBlur={() => {
        let n = display === "" ? min : Math.max(min, Number(display));
        if (max !== undefined) n = Math.min(max, n);
        const final = isNaN(n) ? min : n;
        setDisplay(String(final));
        onChange(final);
      }}
    />
  );
}

export default function IndirectSurvey() {
  const { courseData, setCourseData } = useApp();
  const navigate = useNavigate();
  const maxStudents = courseData.students?.length || null;

  // Guard: ensure indirectSurvey.responses has an entry for every CO
  const safeResponses = React.useMemo(() => {
    const existing = courseData.indirectSurvey.responses || {};
    const result = {};
    courseData.cos.forEach((co) => {
      result[co.id] = existing[co.id] || { VH: 0, H: 0, M: 0, L: 0, VL: 0 };
    });
    return result;
  }, [courseData.cos, courseData.indirectSurvey.responses]);

  function updateResponse(coId, label, value) {
    setCourseData((prev) => ({
      ...prev,
      indirectSurvey: {
        ...prev.indirectSurvey,
        responses: {
          ...prev.indirectSurvey.responses,
          [coId]: { ...(prev.indirectSurvey.responses[coId] || { VH: 0, H: 0, M: 0, L: 0, VL: 0 }), [label]: value },
        },
      },
    }));
  }

  return (
    <div>
      <header className="topbar">
        <div>
          <p className="eyebrow">Step 5</p>
          <h1>Course Exit Survey (Indirect Attainment)</h1>
        </div>
        <div className="top-actions">
          <button className="secondary" onClick={() => navigate("/marks")}>← Back</button>
          <button onClick={() => navigate("/report")}>Next: Report →</button>
        </div>
      </header>

      <div className="panel wide">
        <div className="panel-title"><h2>Survey Responses</h2></div>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
          Enter the number of students who responded at each scale level for each CO.
          Scale: VH = Very High (5), H = High (4), M = Medium (3), L = Low (2), VL = Very Low (1).
          {maxStudents ? (
            <span style={{ marginLeft: 8, color: "#2563eb", fontWeight: 600 }}>
              Total responses per CO must not exceed {maxStudents} students (from uploaded Excel)
            </span>
          ) : null}
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>CO</th>
                {SCALE_LABELS.map((l) => <th key={l}>{l} ({courseData.indirectSurvey.scale[l]})</th>)}
                <th>Total Responses</th>
              </tr>
            </thead>
            <tbody>
              {courseData.cos.map((co) => {
                const resp = safeResponses[co.id];
                const total = SCALE_LABELS.reduce((s, l) => s + (Number(resp[l]) || 0), 0);
                const overLimit = maxStudents && total > maxStudents;
                return (
                  <tr key={co.id}>
                    <td><strong>{co.id}</strong>{co.description && <small style={{ display: "block", color: "var(--muted)" }}>{co.description}</small>}</td>
                    {SCALE_LABELS.map((l) => (
                      <td key={l}>
                        <NumInput
                          min={0}
                          max={maxStudents ? maxStudents - SCALE_LABELS.filter((x) => x !== l).reduce((s, x) => s + (Number(resp[x]) || 0), 0) : undefined}
                          value={resp[l] ?? 0}
                          onChange={(n) => updateResponse(co.id, l, n)}
                        />
                      </td>
                    ))}
                    <td>
                      <strong style={{ color: overLimit ? "#dc2626" : undefined }}>{total}</strong>
                      {overLimit && <small style={{ display: "block", color: "#dc2626" }}>Exceeds {maxStudents}</small>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
