import React, { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Trash2, CheckCircle, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import axios from "axios";
import { useApp } from "../AppContext";
import { API_BASE, SLOT_TO_POLICY } from "../constants";

function NumInput({ value, onChange, onBlur, min = 0, max = 100, style }) {
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
        onBlur?.();
      }}
    />
  );
}

const ASSESSMENT_SLOTS = [
  {
    key: "IA",
    label: "Internal Assessment",
    short: "IA",
    color: "#2563eb",
    bg: "#eff6ff",
    border: "#bfdbfe",
    desc: "Upload the Internal Assessment marks sheet (.xlsx)",
  },
  {
    key: "ESE",
    label: "End Semester Examination",
    short: "ESE",
    color: "#7c3aed",
    bg: "#f5f3ff",
    border: "#ddd6fe",
    desc: "Upload the End Semester Exam marks sheet (.xlsx)",
  },
  {
    key: "CA",
    label: "Continuous Assessment",
    short: "CA",
    color: "#059669",
    bg: "#ecfdf5",
    border: "#a7f3d0",
    desc: "Upload the Continuous Assessment marks sheet (.xlsx)",
  },
];

// Derive unique physical columns from questions list (multi-CO questions share one column)
function physicalColumns(questions) {
  const seen = new Set();
  const cols = [];
  for (const q of questions) {
    // Use label as the display key; uid may have __CO suffix for multi-CO
    const colKey = q.label || q.id;
    if (!seen.has(colKey)) {
      seen.add(colKey);
      cols.push({
        label: colKey,
        rawMaxMarks: q.rawMaxMarks ?? q.maxMarks,
        // All CO ids this column maps to
        cos: questions.filter((x) => (x.label || x.id) === colKey).map((x) => x.co),
        // All uids for this column (to read split marks)
        uids: questions.filter((x) => (x.label || x.id) === colKey).map((x) => x.id),
        splitCount: questions.filter((x) => (x.label || x.id) === colKey).length,
      });
    }
  }
  return cols;
}

// Get the raw mark for a physical column from student rawMarks
// For multi-CO: sum the split values back to get original raw
function getRawMark(student, col) {
  if (col.splitCount === 1) {
    return student.rawMarks?.[col.uids[0]] ?? student.marks?.[col.uids[0]] ?? 0;
  }
  // sum splits * splitCount to recover original
  const splitVal = student.rawMarks?.[col.uids[0]] ?? 0;
  return parseFloat((splitVal * col.splitCount).toFixed(4));
}

function mergeAll(slots, slotData, weightages, courseData) {
  const filled = slots.filter((s) => slotData[s.key]);
  if (!filled.length) return null;

  const allAssessments = filled.map((s) => ({
    id: s.key,
    name: s.label,
    weightage: weightages[s.key],
    questions: slotData[s.key].questions,
  }));

  // Merge students by registerNumber to handle different counts per slot
  const studentMap = {};
  const studentOrder = [];
  filled.forEach((s) => {
    slotData[s.key].students.forEach((st) => {
      const reg = st.registerNumber || "";
      if (!studentMap[reg]) {
        studentMap[reg] = { registerNumber: reg, name: st.name, section: st.section || "", marks: {}, rawMarks: {} };
        studentOrder.push(reg);
      }
      Object.assign(studentMap[reg].marks, st.marks || {});
      Object.assign(studentMap[reg].rawMarks, st.rawMarks || {});
    });
  });
  const mergedStudents = studentOrder.map((reg) => studentMap[reg]);

  // Merge coSummary — align rows by registerNumber
  const coMap = {};
  filled.forEach((s) => {
    (slotData[s.key].coSummary || []).forEach((coEntry) => {
      if (!coMap[coEntry.co]) coMap[coEntry.co] = { co: coEntry.co, totalMarks: 0, rowsByReg: {} };
      coMap[coEntry.co].totalMarks = parseFloat((coMap[coEntry.co].totalMarks + coEntry.totalMarks).toFixed(2));
      coEntry.rows.forEach((row) => {
        const reg = row.registerNumber || "";
        if (!coMap[coEntry.co].rowsByReg[reg]) {
          coMap[coEntry.co].rowsByReg[reg] = { registerNumber: reg, name: row.name, totalMarks: coEntry.totalMarks, marksAttained: 0 };
        }
        coMap[coEntry.co].rowsByReg[reg].marksAttained = parseFloat(
          (coMap[coEntry.co].rowsByReg[reg].marksAttained + (row.marksAttained || 0)).toFixed(2)
        );
      });
    });
  });

  const mergedCoSummary = Object.values(coMap)
    .map((entry) => ({
      co: entry.co,
      totalMarks: entry.totalMarks,
      rows: studentOrder.map((reg) => entry.rowsByReg[reg] || {
        registerNumber: reg,
        name: studentMap[reg]?.name || "",
        totalMarks: entry.totalMarks,
        marksAttained: 0,
      }),
    }))
    .sort((a, b) => (parseInt(a.co.replace("CO", "")) || 0) - (parseInt(b.co.replace("CO", "")) || 0));

  // IMPORTANT: always keep ALL of courseData.cos — never filter it down.
  // Only add truly new COs found in Excel that weren't in courseData.cos at all.
  const uploadedCoIds = new Set(allAssessments.flatMap((a) => a.questions.map((q) => q.co)));
  const existingIds = new Set(courseData.cos.map((c) => c.id));
  const newCos = [...uploadedCoIds]
    .filter((id) => !existingIds.has(id))
    .map((id) => ({ id, description: "", target: 50, targetGrade: "C", sdgs: [] }))
    .sort((a, b) => (parseInt(a.id.replace("CO", "")) || 0) - (parseInt(b.id.replace("CO", "")) || 0));
  const cos = [...courseData.cos, ...newCos];

  // Only add mapping entries for brand-new COs — never overwrite existing WK-computed values
  const mapping = { ...courseData.mapping };
  newCos.forEach((co) => {
    if (!mapping[co.id]) {
      mapping[co.id] = Object.fromEntries(courseData.pos.map((po) => [po, 0]));
    }
  });

  return { allAssessments, mergedStudents, mergedCoSummary, cos, mapping };
}

function downloadTemplate(slot, cos) {
  const coIds = cos.map((c) => c.id);

  // 2 sample questions per CO
  const sampleQuestions = coIds.flatMap((coId, ci) =>
    Array.from({ length: 2 }, (_, qi) => ({
      label: `Q${ci * 2 + qi + 1}`,
      co: coId,
      maxMarks: 10,
    }))
  );

  const qCols = sampleQuestions.length;

  /*
   * Parser expects (within the first 20 rows):
   *   Row A  — CO row      : col1-3 empty, col4+ = CO ids (e.g. CO1)
   *   Row A+1 — Label row  : col1-3 empty, col4+ = question labels (e.g. Q1)
   *   Row A+2 — MaxMarks   : col1-3 empty, col4+ = numeric max marks
   *   Row A+3+ — Data rows : col1 = numeric serial, col2 = reg no, col3 = name, col4+ = marks
   *
   * Scoring in the parser requires co_count>=1, max_count>=1, data_count>=2.   *
   */
  const empty3 = ["", "", ""];

  const coRow      = [...empty3, ...sampleQuestions.map((q) => q.co)];
  const labelRow   = [...empty3, ...sampleQuestions.map((q) => q.label)];
  const maxRow     = [...empty3, ...sampleQuestions.map((q) => q.maxMarks)];
  const headerNote = ["SlNo", "RegisterNumber", "StudentName", ...Array(qCols).fill("(fill marks)")];

  // 5 blank student rows with numeric serial in col1
  const dataRows = Array.from({ length: 5 }, (_, i) => [
    i + 1,
    `ROLLNO${String(i + 1).padStart(3, "0")}`,
    `Student ${i + 1}`,
    ...Array(qCols).fill(""),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([
    coRow,
    labelRow,
    maxRow,
    headerNote,
    ...dataRows,
  ]);

  ws["!cols"] = [
    { wch: 6 }, { wch: 18 }, { wch: 26 },
    ...sampleQuestions.map(() => ({ wch: 10 })),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, slot.short);
  XLSX.writeFile(wb, `Template_${slot.short}_Marks.xlsx`);
}

export default function MarksEntry() {
  const { courseData, setCourseData, setError, setStatus, setLoading, loading } = useApp();
  const navigate = useNavigate();

  const [slotData, setSlotData] = useState(() => courseData.slotData || { IA: null, ESE: null, CA: null });
  const [slotLoading, setSlotLoading] = useState({ IA: false, ESE: false, CA: false });

  const weightages = {
    IA: courseData.evaluationPolicy.interimTest,
    ESE: courseData.evaluationPolicy.endExam,
    CA: courseData.evaluationPolicy.continuousEvaluation,
  };
  // Match AttainmentType: sum all policy fields including 'other'
  const totalWeight = Object.values(courseData.evaluationPolicy).reduce((s, v) => s + v, 0);
  const weightValid = totalWeight === 100;

  function handleWeightChange(key, n) {
    const policyKey = SLOT_TO_POLICY[key];
    setCourseData((prev) => ({
      ...prev,
      evaluationPolicy: { ...prev.evaluationPolicy, [policyKey]: n },
    }));
  }

  // Per-slot physical columns for the marks table
  const slotCols = useMemo(() => {
    const result = {};
    ASSESSMENT_SLOTS.forEach((s) => {
      result[s.key] = slotData[s.key] ? physicalColumns(slotData[s.key].questions) : [];
    });
    return result;
  }, [slotData]);

  const applyMerge = useCallback(
    (newSlotData, newWeightages) => {
      setCourseData((prev) => {
        const result = mergeAll(ASSESSMENT_SLOTS, newSlotData, newWeightages, prev);
        if (!result) return { ...prev, assessments: [], students: [], coSummary: [] };
        return {
          ...prev,
          cos: result.cos,
          mapping: result.mapping,
          assessments: result.allAssessments,
          students: result.mergedStudents,
          coSummary: result.mergedCoSummary,
        };
      });
    },
    [setCourseData]
  );

  async function handleUpload(slotKey, e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSlotLoading((prev) => ({ ...prev, [slotKey]: true }));
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("uploadType", slotKey);
      fd.append("questionIds", "[]");
      const res = await axios.post(`${API_BASE}/upload/students/`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (!res.data.success) throw new Error(res.data.message || "Upload failed");

      const entry = {
        fileName: file.name,
        questions: res.data.questions || [],
        students: res.data.students || [],
        coSummary: res.data.coSummary || [],
      };
      setSlotData((prev) => {
        const newSlotData = { ...prev, [slotKey]: entry };
        setCourseData((cd) => ({ ...cd, slotData: newSlotData }));
        applyMerge(newSlotData, {
          IA: courseData.evaluationPolicy.interimTest,
          ESE: courseData.evaluationPolicy.endExam,
          CA: courseData.evaluationPolicy.continuousEvaluation,
        });
        return newSlotData;
      });
      setStatus(`${file.name} uploaded — ${res.data.message}`);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Upload failed");
    } finally {
      setSlotLoading((prev) => ({ ...prev, [slotKey]: false }));
      e.target.value = "";
    }
  }

  function handleRemove(slotKey) {
    setSlotData((prev) => {
      const newSlotData = { ...prev, [slotKey]: null };
      setCourseData((cd) => ({ ...cd, slotData: newSlotData }));
      applyMerge(newSlotData, weightages);
      return newSlotData;
    });
  }

  function handleWeightBlur() {
    if (weightValid) applyMerge(slotData, weightages);
  }

  const uploadedCount = Object.values(slotData).filter(Boolean).length;
  const filledSlots = ASSESSMENT_SLOTS.filter((s) => slotData[s.key]);

  return (
    <div>
      <header className="topbar">
        <div>
          <p className="eyebrow">Step 4</p>
          <h1>Student Marks Entry</h1>
        </div>
        <div className="top-actions">
          <button className="secondary" onClick={() => navigate(courseData.wkMappingDone ? "/wk-mapping" : "/questions")}>← Back</button>
          <button
            onClick={() => navigate(courseData.attainmentModes.indirect ? "/survey" : "/report")}
            disabled={uploadedCount === 0 || !weightValid}
          >
            {courseData.attainmentModes.indirect ? "Next: Survey →" : "Next: Report →"}
          </button>
        </div>
      </header>

      {/* Weightage inputs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 12 }}>
        {ASSESSMENT_SLOTS.map((slot) => (
          <div key={slot.key} style={{
            background: "#fff", border: `1.5px solid ${weightValid ? slot.border : "#fca5a5"}`,
            borderRadius: 10, padding: "12px 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: slot.color }}>{slot.short} Weightage</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <NumInput
                min={0} max={100}
                value={weightages[slot.key]}
                onChange={(n) => handleWeightChange(slot.key, n)}
                onBlur={handleWeightBlur}
                style={{
                  width: 64, padding: "4px 8px", borderRadius: 6, fontSize: 14, fontWeight: 700,
                  border: `1.5px solid ${weightValid ? slot.border : "#fca5a5"}`,
                  color: slot.color, textAlign: "center",
                }}
              />
              <span style={{ fontSize: 13, color: "#64748b" }}>%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Weight validation bar */}
      <div style={{
        marginBottom: 20, padding: "8px 16px", borderRadius: 8, fontSize: 13,
        background: weightValid ? "#f0fdf4" : "#fef2f2",
        border: `1px solid ${weightValid ? "#bbf7d0" : "#fca5a5"}`,
        color: weightValid ? "#166534" : "#dc2626",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        {weightValid
          ? <><CheckCircle size={15} /> Weightages sum to 100% — valid</>
          : <>⚠ Weightages sum to <strong>{totalWeight}%</strong> — must equal 100% before proceeding</>}
      </div>

      {/* Upload cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 24 }}>
        {ASSESSMENT_SLOTS.map((slot) => {
          const data = slotData[slot.key];
          const busy = slotLoading[slot.key];
          const cols = slotCols[slot.key];
          return (
            <div key={slot.key} style={{
              background: data ? slot.bg : "#fff",
              border: `2px solid ${data ? slot.color : slot.border}`,
              borderRadius: 14, padding: 24,
              display: "flex", flexDirection: "column", gap: 14,
            }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: slot.bg, border: `1.5px solid ${slot.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <FileSpreadsheet size={20} color={slot.color} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#1e293b" }}>{slot.label}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Weightage: {weightages[slot.key]}%</div>
                </div>
                {data && <CheckCircle size={20} color={slot.color} style={{ marginLeft: "auto" }} />}
              </div>

              <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{slot.desc}</p>

              {/* File info */}
              {data ? (
                <div style={{ background: "#fff", border: `1px solid ${slot.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
                  <div style={{ fontWeight: 600, color: "#1e293b", marginBottom: 4, wordBreak: "break-all" }}>{data.fileName}</div>
                  <div style={{ color: "#64748b", marginBottom: 6 }}>
                    {data.students.length} students · {cols.length} question{cols.length !== 1 ? "s" : ""}
                  </div>
                  {/* Show each physical column with its CO mapping */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {cols.map((col) => (
                      <div key={col.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                        <span style={{ fontWeight: 600, color: "#1e293b", minWidth: 60 }}>{col.label}</span>
                        <span style={{ color: "#94a3b8" }}>/{col.rawMaxMarks}</span>
                        <span style={{ color: "#94a3b8", margin: "0 2px" }}>→</span>
                        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                          {col.cos.map((co) => (
                            <span key={co} style={{
                              fontSize: 10, fontWeight: 700, padding: "1px 6px",
                              borderRadius: 20, background: slot.bg, color: slot.color,
                              border: `1px solid ${slot.border}`,
                            }}>{co}</span>
                          ))}
                        </div>
                        {col.splitCount > 1 && (
                          <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 600 }}>
                            ÷{col.splitCount}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{
                  border: `1.5px dashed ${slot.border}`, borderRadius: 8, padding: "18px 12px",
                  textAlign: "center", color: "#94a3b8", fontSize: 13,
                }}>
                  No file uploaded yet
                </div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                <label style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 6, padding: "8px 0", borderRadius: 8,
                  cursor: busy ? "not-allowed" : "pointer",
                  background: slot.color, color: "#fff", fontSize: 13, fontWeight: 600,
                  opacity: busy ? 0.7 : 1,
                }}>
                  <Upload size={14} />
                  {busy ? "Uploading..." : data ? "Replace File" : "Upload Excel"}
                  <input
                    type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }}
                    onChange={(e) => handleUpload(slot.key, e)}
                    disabled={busy || loading}
                  />
                </label>
                {data && (
                  <button
                    onClick={() => handleRemove(slot.key)}
                    style={{
                      padding: "8px 12px", borderRadius: 8, border: `1px solid ${slot.border}`,
                      background: "#fff", cursor: "pointer", color: "#ef4444",
                      display: "flex", alignItems: "center",
                    }}
                    title="Remove file"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Status bar */}
      {uploadedCount > 0 && (
        <div style={{
          background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10,
          padding: "12px 18px", marginBottom: 20, fontSize: 13, color: "#166534",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <CheckCircle size={16} />
          <strong>{uploadedCount} of 3</strong> file{uploadedCount > 1 ? "s" : ""} uploaded.
          {uploadedCount === 3
            ? " All assessments uploaded — computation uses all three."
            : " Upload remaining files or proceed with available data."}
          <span style={{ marginLeft: "auto" }}>
            {courseData.students.length} students
          </span>
        </div>
      )}

      {/* Per-assessment marks tables */}
      {filledSlots.map((slot) => {
        const data = slotData[slot.key];
        const cols = slotCols[slot.key];
        if (!data || !cols.length) return null;
        return (
          <div key={slot.key} className="panel wide" style={{ marginBottom: 20 }}>
            <div className="panel-title">
              <h2 style={{ color: slot.color }}>{slot.label} — Marks</h2>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                {data.students.length} students · {cols.length} question{cols.length !== 1 ? "s" : ""}
                {cols.some((c) => c.splitCount > 1) && (
                  <span style={{ marginLeft: 8, color: "#f59e0b", fontWeight: 600 }}>
                    ⚡ Contains multi-CO questions (marks split equally)
                  </span>
                )}
              </span>
            </div>
            <div className="table-wrap marks-wrap">
              <table className="raw-marks-table">
                <thead>
                  {/* Row 1: CO labels (show all COs for multi-CO columns) */}
                  <tr>
                    <th rowSpan={3}>Sl.</th>
                    <th rowSpan={3}>Roll No.</th>
                    <th rowSpan={3}>Name</th>
                    {cols.map((col) => (
                      <th key={`co-${col.label}`} style={{ color: slot.color }}>
                        {col.cos.join(", ")}
                      </th>
                    ))}
                  </tr>
                  {/* Row 2: Question labels */}
                  <tr>
                    {cols.map((col) => (
                      <th key={`lbl-${col.label}`} style={{ fontSize: 11 }}>
                        {col.label}
                        {col.splitCount > 1 && (
                          <span style={{ color: "#f59e0b", marginLeft: 3 }}>÷{col.splitCount}</span>
                        )}
                      </th>
                    ))}
                  </tr>
                  {/* Row 3: Max marks (raw, not split) */}
                  <tr>
                    {cols.map((col) => (
                      <th key={`max-${col.label}`} style={{ fontSize: 11 }}>{col.rawMaxMarks}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.students.map((student, si) => (
                    <tr key={si}>
                      <td>{si + 1}</td>
                      <td>{student.registerNumber || "—"}</td>
                      <td>{student.name || "—"}</td>
                      {cols.map((col) => (
                        <td key={`m-${col.label}`}>
                          {getRawMark(student, col)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* CO split breakdown for this assessment */}
            {cols.some((c) => c.splitCount > 1) && (
              <div style={{
                marginTop: 12, padding: "10px 14px", background: "#fffbeb",
                border: "1px solid #fde68a", borderRadius: 8, fontSize: 12, color: "#92400e",
              }}>
                <strong>Split breakdown:</strong>{" "}
                {cols.filter((c) => c.splitCount > 1).map((c) => (
                  <span key={c.label} style={{ marginRight: 12 }}>
                    {c.label} (/{c.rawMaxMarks}) → {c.cos.map((co) => `${co}: /${(c.rawMaxMarks / c.splitCount).toFixed(2)}`).join(", ")}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Combined CO summary */}
      {courseData.coSummary?.length > 0 && (() => {
        // Build target lookup from courseData.cos
        const coTargetMap = Object.fromEntries(
          courseData.cos.map((c) => [c.id, { target: c.target || 50, grade: c.targetGrade || "C" }])
        );
        return (
          <div className="panel wide">
            <div className="panel-title">
              <h2>Combined CO-wise Summary</h2>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                Marks attained per CO across all uploaded assessments
              </span>
            </div>
            <div className="table-wrap marks-wrap">
              <table className="co-summary-table">
                <thead>
                  <tr>
                    <th rowSpan={2}>Sl.</th>
                    <th rowSpan={2}>Roll No.</th>
                    <th rowSpan={2}>Name</th>
                    {courseData.coSummary.map((co) => (
                      <th colSpan={5} key={co.co}
                        style={{ textAlign: "center", borderBottom: "1px solid #e2e8f0" }}>
                        {co.co}
                        <span style={{ fontWeight: 400, fontSize: 11, marginLeft: 4 }}>
                          (Target: {coTargetMap[co.co]?.grade || "C"} ≥{coTargetMap[co.co]?.target || 50}%)
                        </span>
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {courseData.coSummary.map((co) => (
                      <React.Fragment key={co.co}>
                        <th style={{ fontSize: 10 }}>Total Marks</th>
                        <th style={{ fontSize: 10 }}>Marks Attained</th>
                        <th style={{ fontSize: 10 }}>% Marks</th>
                        <th style={{ fontSize: 10 }}>Grade</th>
                        <th style={{ fontSize: 10 }}>Attained</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({
                    length: Math.max(...courseData.coSummary.map((co) => co.rows.length), 0),
                  }).map((_, ri) => {
                    const baseRow = courseData.coSummary[0]?.rows[ri];
                    return (
                      <tr key={ri}>
                        <td>{ri + 1}</td>
                        <td>{baseRow?.registerNumber || "—"}</td>
                        <td>{baseRow?.name || "—"}</td>
                        {courseData.coSummary.map((co) => {
                          const row = co.rows[ri];
                          const pct = co.totalMarks > 0
                            ? Math.round((row?.marksAttained ?? 0) / co.totalMarks * 100 * 100) / 100
                            : 0;
                          const tgt = coTargetMap[co.co]?.target || 50;
                          const attained = pct >= tgt ? 1 : 0;
                          // Grade from GRADING_POLICY
                          const grade = pct >= 85 ? "S" : pct >= 75 ? "A" : pct >= 65 ? "B"
                            : pct >= 55 ? "C" : pct >= 45 ? "D" : pct >= 35 ? "E" : "F";
                          return (
                            <React.Fragment key={co.co}>
                              <td>{co.totalMarks}</td>
                              <td style={{ fontWeight: 600 }}>{row?.marksAttained ?? "—"}</td>
                              <td>{pct}%</td>
                              <td style={{ fontWeight: 700, color: pct >= tgt ? "#16a34a" : "#dc2626" }}>{grade}</td>
                              <td style={{
                                fontWeight: 700,
                                color: attained ? "#16a34a" : "#dc2626",
                                textAlign: "center",
                              }}>{attained}</td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
