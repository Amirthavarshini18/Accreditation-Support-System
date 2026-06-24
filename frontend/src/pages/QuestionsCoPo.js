import React from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { useApp } from "../AppContext";
import { NBA_POS, WK_LIST } from "../constants";

export default function QuestionsMapping() {
  const { courseData, setCourseData } = useApp();
  const navigate = useNavigate();

  const assessment = courseData.assessments[0] ?? { id: "assessment-1", name: "Assessment 1", weightage: 100, questions: [] };

  React.useEffect(() => {
    if (!courseData.assessments[0]) {
      setCourseData((prev) => prev.assessments[0] ? prev : {
        ...prev,
        assessments: [{ id: "assessment-1", name: "Assessment 1", weightage: 100, questions: [] }],
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function syncQuestions(questions) {
    setCourseData((prev) => {
      const qIds = questions.map((q) => q.id);
      return {
        ...prev,
        assessments: [{ ...(prev.assessments[0] ?? { id: "assessment-1", name: "Assessment 1", weightage: 100 }), questions }],
        students: prev.students.map((s) => ({
          ...s,
          marks: Object.fromEntries(qIds.map((id) => [id, s.marks?.[id] ?? 0])),
        })),
      };
    });
  }

  function setQuestion(idx, key, value) {
    syncQuestions(
      assessment.questions.map((q, i) =>
        i === idx ? { ...q, [key]: key === "maxMarks" ? Number(value) || 0 : value } : q
      )
    );
  }

  function addQuestion() {
    const id = `Q${assessment.questions.length + 1}`;
    syncQuestions([...assessment.questions, { id, label: id, co: courseData.cos[0]?.id || "CO1", maxMarks: 5 }]);
  }

  function removeQuestion(idx) {
    syncQuestions(assessment.questions.filter((_, i) => i !== idx));
  }

  // Add/remove POs — only PO1–PO11, PSOs managed separately
  function togglePO(poId) {
    setCourseData((prev) => {
      const included = prev.pos.includes(poId);
      const pos = included ? prev.pos.filter((p) => p !== poId) : [...prev.pos, poId];
      const mapping = { ...prev.mapping };
      prev.cos.forEach((co) => {
        mapping[co.id] = { ...mapping[co.id] };
        if (!included) mapping[co.id][poId] = 0;
        else delete mapping[co.id][poId];
      });
      return { ...prev, pos, mapping };
    });
  }

  const psoConfig = courseData.psoConfig ?? [];

  function updatePso(idx, changes) {
    setCourseData((prev) => {
      const prevConfig = prev.psoConfig ?? [];
      const oldId = prevConfig[idx]?.id;
      const updated = prevConfig.map((p, i) => i === idx ? { ...p, ...changes } : p);
      const newId = updated[idx]?.id;

      // Only sync pos/mapping/psoWkMap when the ID actually changed and is non-empty
      const psoIds = updated.map((p) => p.id).filter(Boolean);
      const oldPsoIds = prevConfig.map((p) => p.id).filter(Boolean);
      const basePos = prev.pos.filter((p) => !oldPsoIds.includes(p));
      const pos = [...basePos, ...psoIds];
      const psoWkMap = Object.fromEntries(updated.map((p) => [p.id, p.wks ?? []]));

      const mapping = {};
      prev.cos.forEach((co) => {
        const coMap = { ...prev.mapping[co.id] };
        // Remove old PSO keys
        oldPsoIds.forEach((id) => { delete coMap[id]; });
        // Add updated PSO keys, preserve value if ID unchanged
        psoIds.forEach((id) => {
          coMap[id] = (id === newId && oldId && id !== oldId)
            ? (prev.mapping[co.id]?.[oldId] ?? 0)
            : (coMap[id] ?? prev.mapping[co.id]?.[id] ?? 0);
        });
        mapping[co.id] = coMap;
      });

      return { ...prev, psoConfig: updated, pos, psoWkMap, mapping };
    });
  }

  function addPso() {
    setCourseData((prev) => {
      const prevConfig = prev.psoConfig ?? [];
      const newId = `PSO${prevConfig.length + 1}`;
      const updated = [...prevConfig, { id: newId, label: "", wks: [] }];
      const oldPsoIds = prevConfig.map((p) => p.id).filter(Boolean);
      const basePos = prev.pos.filter((p) => !oldPsoIds.includes(p));
      const pos = [...basePos, ...updated.map((p) => p.id).filter(Boolean)];
      const psoWkMap = Object.fromEntries(updated.map((p) => [p.id, p.wks ?? []]));
      const mapping = { ...prev.mapping };
      prev.cos.forEach((co) => { mapping[co.id] = { ...mapping[co.id], [newId]: 0 }; });
      return { ...prev, psoConfig: updated, pos, psoWkMap, mapping };
    });
  }

  function removePso(idx) {
    setCourseData((prev) => {
      const prevConfig = prev.psoConfig ?? [];
      const removed = prevConfig[idx]?.id;
      const updated = prevConfig.filter((_, i) => i !== idx);
      const oldPsoIds = prevConfig.map((p) => p.id).filter(Boolean);
      const basePos = prev.pos.filter((p) => !oldPsoIds.includes(p));
      const pos = [...basePos, ...updated.map((p) => p.id).filter(Boolean)];
      const psoWkMap = Object.fromEntries(updated.map((p) => [p.id, p.wks ?? []]));
      const mapping = { ...prev.mapping };
      prev.cos.forEach((co) => { const m = { ...mapping[co.id] }; if (removed) delete m[removed]; mapping[co.id] = m; });
      return { ...prev, psoConfig: updated, pos, psoWkMap, mapping };
    });
  }

  return (
    <div>
      <header className="topbar">
        <div>
          <p className="eyebrow">Step 3</p>
          <h1>Questions & CO-PO Mapping</h1>
        </div>
        <div className="top-actions">
          <button className="secondary" onClick={() => navigate("/attainment-type")}>← Back</button>
          <button onClick={() => navigate("/wk-mapping")}>Next: WK Mapping →</button>
        </div>
      </header>

      {/* Assessment Questions */}
      <div className="panel wide">

        <div className="table-wrap">
          <table>
            <tbody>
              {assessment.questions.map((q, idx) => (
                <tr key={`${q.id}-${idx}`}>
                  <td>
                    <input value={q.id} onChange={(e) => setQuestion(idx, "id", e.target.value)} />
                  </td>
                  <td>
                    <input value={q.label} onChange={(e) => setQuestion(idx, "label", e.target.value)} />
                  </td>
                  <td>
                    <select value={q.co} onChange={(e) => setQuestion(idx, "co", e.target.value)}>
                      {courseData.cos.map((co) => <option key={co.id}>{co.id}</option>)}
                    </select>
                  </td>
                  <td>
                    <input type="number" value={q.maxMarks} onChange={(e) => setQuestion(idx, "maxMarks", e.target.value)} />
                  </td>
                  <td>
                    <button className="icon-button secondary" onClick={() => removeQuestion(idx)}>
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PO Selection — PO1–PO11 only */}
      <div className="panel wide">
        <div className="panel-title"><h2>Programme Outcomes (POs) — GAPC 4.0</h2></div>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
          Select the POs applicable to this course. CO-PO mapping values will be
          auto-computed from WK indicators and Performance Indicators in the next step.
        </p>
        <div className="po-select-grid">
          {NBA_POS.filter((po) => !po.id.startsWith("PSO")).map((po) => (
            <label key={po.id} className="check-row po-check">
              <input
                type="checkbox"
                checked={courseData.pos.includes(po.id)}
                onChange={() => togglePO(po.id)}
              />
              <span><strong>{po.id}</strong> — {po.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* PSO Configuration — faculty-defined */}
      <div className="panel wide">
        <div className="panel-title">
          <h2>Programme Specific Outcomes (PSOs)</h2>
          <button className="secondary" onClick={addPso}><Plus size={14} /> Add PSO</button>
        </div>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
          Define PSOs specific to this course and select which Washington Knowledge indicators (WKs) they map to.
        </p>
        {psoConfig.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>No PSOs added yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 80 }}>PSO ID</th>
                  <th>Label / Description</th>
                  <th>WK Indicators</th>
                  <th style={{ width: 50 }}>Del</th>
                </tr>
              </thead>
              <tbody>
                {psoConfig.map((pso, idx) => (
                  <tr key={idx}>
                    <td>
                      <input
                        value={pso.id}
                        onChange={(e) => updatePso(idx, { id: e.target.value })}
                        style={{ width: 70 }}
                      />
                    </td>
                    <td>
                      <input
                        value={pso.label}
                        onChange={(e) => updatePso(idx, { label: e.target.value })}
                        placeholder={`Describe ${pso.id}...`}
                      />
                    </td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {WK_LIST.map((wk) => {
                          const checked = pso.wks.includes(wk.id);
                          return (
                            <label key={wk.id} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, cursor: "pointer",
                              background: checked ? "#d4edda" : "#f8f9fa", border: `1px solid ${checked ? "#82c891" : "#dee2e6"}`,
                              borderRadius: 12, padding: "2px 8px", fontWeight: 700, color: checked ? "#155724" : "#6c757d" }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const wks = e.target.checked ? [...pso.wks, wk.id] : pso.wks.filter((w) => w !== wk.id);
                                  updatePso(idx, { wks });
                                }}
                                style={{ width: 12, height: 12, accentColor: "#2a9d8f" }}
                              />
                              {wk.id}
                            </label>
                          );
                        })}
                      </div>
                    </td>
                    <td>
                      <button className="icon-button secondary" onClick={() => removePso(idx)}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
