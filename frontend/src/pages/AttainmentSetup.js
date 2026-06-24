import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../AppContext";

function NumInput({ value, onChange, min = 0, max = 100, style }) {
  const [display, setDisplay] = useState(String(value ?? ""));
  React.useEffect(() => { setDisplay(String(value ?? "")); }, [value]);
  return (
    <input
      type="number" min={min} max={max}
      value={display}
      style={style}
      onChange={(e) => setDisplay(e.target.value)}
      onBlur={() => {
        const n = display === "" ? min : Math.min(max, Math.max(min, Number(display)));
        const final = isNaN(n) ? min : n;
        setDisplay(String(final));
        onChange(final);
      }}
    />
  );
}

export default function AttainmentType() {
  const { courseData, setCourseData } = useApp();
  const navigate = useNavigate();
  const directStudentCount = courseData.students?.length || 0;

  function toggleMode(key) {
    setCourseData((prev) => ({
      ...prev,
      attainmentModes: { ...prev.attainmentModes, [key]: !prev.attainmentModes[key] },
    }));
  }

  function updatePolicy(key, value) {
    setCourseData((prev) => ({
      ...prev,
      evaluationPolicy: { ...prev.evaluationPolicy, [key]: value },
    }));
  }

  const policyTotal = Object.values(courseData.evaluationPolicy).reduce((s, v) => s + v, 0);
  const policyValid = policyTotal === 100;

  return (
    <div>
      <header className="topbar">
        <div>
          <p className="eyebrow">Step 2</p>
          <h1>Attainment Type & Evaluation Policy</h1>
        </div>
        <div className="top-actions">
          <button className="secondary" onClick={() => navigate("/course")}>← Back</button>
          <button onClick={() => navigate("/questions")} disabled={!policyValid}>Next: Questions →</button>
        </div>
      </header>

      <div className="content-grid">
        <div className="panel">
          <div className="panel-title"><h2>Attainment Mode</h2></div>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
            Select the method(s) used to compute CO attainment for this course.
          </p>
          <label className="check-row">
            <input type="checkbox" checked={courseData.attainmentModes.direct} onChange={() => toggleMode("direct")} />
            Direct Attainment — from student marks in assessments
          </label>
          <label className="check-row">
            <input type="checkbox" checked={courseData.attainmentModes.indirect} onChange={() => toggleMode("indirect")} />
            Indirect Attainment — from course exit survey responses
          </label>
          {courseData.attainmentModes.indirect && (
            <div className="notice" style={{ marginTop: 8 }}>
              {directStudentCount > 0
                ? <>Survey response entries will be capped at <strong>{directStudentCount}</strong> students (from uploaded Excel).</>
                : <>Upload the direct attainment Excel first to auto-set the response limit.</>}
            </div>
          )}
          {courseData.attainmentModes.direct && courseData.attainmentModes.indirect && (
            <div className="notice" style={{ marginTop: 12 }}>
              Both modes selected: Final PO score = 80% Direct + 20% Indirect
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-title">
            <h2>Evaluation Policy (%)</h2>
            <span style={{ fontSize: 13, color: policyTotal === 100 ? "var(--teal)" : "#e53e3e", fontWeight: 700 }}>
              Total: {policyTotal}%
            </span>
          </div>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
            Weightage of each assessment component. Should sum to 100%.
          </p>
          <div className="profile-grid compact-grid">
            {Object.entries(courseData.evaluationPolicy).map(([key, value]) => (
              <label key={key}>
                {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                <NumInput
                  value={value}
                  min={0} max={100}
                  onChange={(n) => updatePolicy(key, n)}
                />
              </label>
            ))}
          </div>
          {policyTotal !== 100 && (
            <div className="notice error-notice" style={{ marginTop: 12 }}>
              Weightages must sum to 100%. Current total: {policyTotal}%
            </div>
          )}
        </div>

        <div className="panel wide">
          <div className="panel-title"><h2>Attainment Rubric</h2></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Attainment Level</th>
                  <th>% of Students Achieving Target</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>3</td><td>≥ 85%</td><td>High attainment</td></tr>
                <tr><td>2</td><td>50% – 84%</td><td>Moderate attainment (linear interpolation)</td></tr>
                <tr><td>1</td><td>30% – 49%</td><td>Low attainment (linear interpolation)</td></tr>
                <tr><td>0</td><td>&lt; 30%</td><td>Not attained</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
