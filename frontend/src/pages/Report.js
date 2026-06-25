import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, FileSpreadsheet, Printer, RotateCcw, Search } from "lucide-react";
import { useApp } from "../AppContext";
import {
  API_BASE,
  NBA_POS,
  SDG_LIST,
  WK_LIST,
} from "../constants";

const LOGO_SRC = `${process.env.PUBLIC_URL || ""}/LOG.png`;
const PO_IDS = Array.from({ length: 12 }, (_, i) => `PO${i + 1}`);
const REPORT_DATE = new Date().toLocaleDateString("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function tv(value) {
  return value === undefined || value === null || value === "" ? "-" : value;
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pct(value) {
  return `${Math.round(num(value) * 100) / 100}%`;
}

function scoreToPercent(score) {
  return Math.round((Math.max(0, Math.min(3, num(score))) / 3) * 100);
}

function levelLabel(score) {
  const s = num(score);
  if (s >= 2.5) return "High";
  if (s >= 1.5) return "Moderate";
  if (s > 0) return "Low";
  return "Not mapped";
}

function statusClass(ok) {
  return ok ? "status-ok" : "status-low";
}

function getPhysicalColumns(assessments) {
  // Deduplicate by (assessmentId, label) so multi-CO questions only count once
  // for max marks and raw total purposes.
  const seen = new Set();
  const cols = [];
  for (const assessment of assessments) {
    for (const q of (assessment.questions || [])) {
      const key = `${assessment.id}|||${q.label || q.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        cols.push({ ...q, assessmentId: assessment.id });
      }
    }
  }
  return cols;
}

function getStudentTotal(student, physicalCols) {
  // For multi-CO questions, all splits share the same physical column.
  // Sum rawMaxMarks once per physical column, and sum the raw mark via
  // the first matching uid (any split of the same column gives the same raw value
  // times splitCount back to the original, but we already stored splitMark per uid).
  // Simplest correct approach: use rawMarks keyed by the first uid for each physical col.
  const rawMarks = student.rawMarks || student.marks || {};
  return physicalCols.reduce((sum, col) => {
    // col.id is the uid for single-CO, or '<label>__<CO>' for multi-CO.
    // For multi-CO we need to recover the original mark = split * splitCount.
    const splitCount = col.splitCount || 1;
    const splitMark = num(rawMarks[col.id]);
    // Recover full-column raw mark and add it once
    return sum + Math.round(splitMark * splitCount * 100) / 100;
  }, 0);
}

function getColumnMaxMarks(physicalCols) {
  // Sum rawMaxMarks (the full column max) once per physical column.
  return physicalCols.reduce((sum, col) => sum + num(col.rawMaxMarks ?? col.maxMarks), 0);
}

function getAssessmentAnalytics(report) {
  const students = report.students || [];
  const assessments = report.assessments || [];
  return assessments.map((assessment) => {
    const physCols = getPhysicalColumns([assessment]);
    const maxMarks = getColumnMaxMarks(physCols);
    const totals = students.map((student) => getStudentTotal(student, physCols));
    const averageMark = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
    const averagePercent = maxMarks ? (averageMark / maxMarks) * 100 : 0;
    return {
      name: assessment.name || assessment.id || "Assessment",
      maxMarks: Math.round(maxMarks * 100) / 100,
      averageMark: Math.round(averageMark * 100) / 100,
      averagePercent: Math.round(averagePercent * 100) / 100,
      attainmentLevel: num((averagePercent / 100) * 3).toFixed(2),
    };
  });
}

function getMarkDistribution(report) {
  const students = report.students || [];
  const physCols = getPhysicalColumns(report.assessments || []);
  const maxMarks = getColumnMaxMarks(physCols);
  const buckets = [
    { range: "0-39", count: 0 },
    { range: "40-49", count: 0 },
    { range: "50-59", count: 0 },
    { range: "60-69", count: 0 },
    { range: "70-84", count: 0 },
    { range: "85-100", count: 0 },
  ];
  students.forEach((student) => {
    const percent = maxMarks ? (getStudentTotal(student, physCols) / maxMarks) * 100 : 0;
    const index = percent >= 85 ? 5 : percent >= 70 ? 4 : percent >= 60 ? 3 : percent >= 50 ? 2 : percent >= 40 ? 1 : 0;
    buckets[index].count += 1;
  });
  return buckets;
}

function getPoLabel(po) {
  return NBA_POS.find((item) => item.id === po)?.label || po;
}

function ReportSection({ title, eyebrow, children, className = "" }) {
  return (
    <section className={`report-section ${className}`}>
      <div className="report-section-title">
        <div>
          {eyebrow && <span>{eyebrow}</span>}
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function Report() {
  const { courseData, report, setReport, setError, setStatus } = useApp();
  const navigate = useNavigate();
  const [calculating, setCalculating] = useState(false);

  async function calculate() {
    setCalculating(true);
    setError("");
    try {
      const res = await axios.post(`${API_BASE}/compute/`, courseData);
      if (!res.data.success) throw new Error(res.data.message || "Calculation failed");
      setReport(res.data.report);
      setStatus("Attainment report calculated successfully.");
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Calculation failed");
    } finally {
      setCalculating(false);
    }
  }

  const derived = useMemo(() => {
    if (!report) return null;
    const coResults = report.coResults || [];
    const activePOs = PO_IDS.filter((po) => (courseData.pos || []).includes(po));
    const poRows = activePOs.map((po) => {
      const mappedCOs = (courseData.cos || [])
        .filter((co) => num(report.mapping?.[co.id]?.[po]) > 0)
        .map((co) => co.id);
      const score = report.poScores?.[po] ?? 0;
      return {
        po,
        label: getPoLabel(po),
        mappedCOs,
        percent: scoreToPercent(score),
        level: Number(num(score).toFixed(2)),
        remarks: mappedCOs.length ? `${levelLabel(score)} attainment` : "No active CO mapping",
      };
    });

    const assessmentRows = getAssessmentAnalytics(report);
    const coChart = coResults.map((item) => ({
      co: item.co,
      Target: num(item.target),
      Achieved: num(item.attainmentPercentage),
    }));
    const poChart = poRows.map((item) => ({
      po: item.po,
      attainment: item.percent,
    }));

    const wkRows = WK_LIST.filter((wk) => /^WK[1-8]$/.test(wk.id)).map((wk) => {
      const relatedCOs = (courseData.cos || []).filter((co) => courseData.wkMapping?.coWks?.[co.id]?.[wk.id]);
      const avgScore = relatedCOs.length
        ? relatedCOs.reduce((sum, co) => {
          const result = coResults.find((item) => item.co === co.id);
          return sum + num(result?.score);
        }, 0) / relatedCOs.length
        : 0;
      return {
        wk: wk.id,
        relatedCOs: relatedCOs.map((co) => co.id),
        contribution: scoreToPercent(avgScore),
      };
    });

    const sdgRows = SDG_LIST.map((sdg) => {
      const sdgId = sdg.split(":")[0];
      const relatedCOs = (courseData.cos || []).filter((co) => (co.sdgs || []).some((value) => value.toUpperCase() === sdgId));
      if (!relatedCOs.length) return null;
      const relatedPOs = activePOs.filter((po) => relatedCOs.some((co) => num(report.mapping?.[co.id]?.[po]) > 0));
      const avgScore = relatedCOs.reduce((sum, co) => {
        const result = coResults.find((item) => item.co === co.id);
        return sum + num(result?.score);
      }, 0) / relatedCOs.length;
      return {
        sdg,
        relatedCOs: relatedCOs.map((co) => co.id),
        relatedPOs,
        contribution: levelLabel(avgScore),
      };
    }).filter(Boolean);

    const achieved = coResults.filter((item) => num(item.attainmentPercentage) >= num(item.target));
    const notAchieved = coResults.filter((item) => num(item.attainmentPercentage) < num(item.target));
    const remarks = [
      achieved.length
        ? `${achieved.map((item) => item.co).join(", ")} achieved the expected target level.`
        : "No CO has achieved the expected target level yet.",
      notAchieved.length
        ? `${notAchieved.map((item) => item.co).join(", ")} require improvement and additional learning support.`
        : "All listed COs meet the target level.",
      num(report.summary?.averageCOScore) >= 2 ? "Overall course attainment is satisfactory." : "Overall course attainment needs focused improvement.",
    ];

    return {
      activePOs,
      poRows,
      assessmentRows,
      coChart,
      poChart,
      wkRows,
      sdgRows,
      markDistribution: getMarkDistribution(report),
      remarks,
    };
  }, [courseData, report]);

  return (
    <div className="report-page">
      <header className="report-header">
        <div className="report-logo-band">
          <img src={LOGO_SRC} alt="Institution Logo" />
        </div>
        <div className="report-header-main">
          <div>
            <p className="eyebrow">Step 6</p>
            <h1>CO-PO Attainment Report</h1>
          </div>
          <div className="top-actions">
            <button className="secondary" onClick={() => navigate(courseData.attainmentModes.indirect ? "/survey" : "/marks")}>
              <RotateCcw size={16} /> Back
            </button>
            <button onClick={calculate} disabled={calculating}>
              {calculating ? "Calculating..." : "Calculate Attainment"}
            </button>
            {report && (
              <>
                <button className="secondary" onClick={() => window.print()}>
                  <Printer size={16} /> Print
                </button>
                <button onClick={() => navigate("/export")}>
                  <Download size={16} /> Export
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {!report || !derived ? (
        <div className="panel wide report-empty">
          <p>Click "Calculate Attainment" to generate the report.</p>
        </div>
      ) : (
        <main className="report-document">
          <ReportSection title="Report Overview">
            <div className="overview-grid">
              {[
                ["Course Name", report.course?.courseName],
                ["Course Code", report.course?.courseCode],
                ["Academic Year", report.course?.academicYear],
                ["Semester", report.course?.courseSemester || report.course?.semester],
                ["Programme", report.course?.programme],
                ["Faculty Name", report.course?.faculty],
                ["Total Students", report.summary?.totalStudents],
                ["Report Generated Date", REPORT_DATE],
              ].map(([label, value]) => (
                <div className="overview-item" key={label}>
                  <span>{label}</span>
                  <strong>{tv(value)}</strong>
                </div>
              ))}
            </div>
          </ReportSection>

          <div className="report-metrics">
            {[
              ["Course Outcomes", report.summary?.totalCOs],
              ["Programme Outcomes", derived.activePOs.length],
              ["Average CO Level", report.summary?.averageCOScore],
              ["Average PO Level", report.summary?.averagePOScore],
            ].map(([label, value]) => (
              <div className="report-metric" key={label}>
                <span>{label}</span>
                <strong>{tv(value)}</strong>
              </div>
            ))}
          </div>

          <ReportSection title="CO Attainment Summary">
            <div className="table-wrap report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>CO</th>
                    <th>Target %</th>
                    <th>Achieved %</th>
                    <th>Attainment Level</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.coResults || []).map((item) => {
                    const achieved = num(item.attainmentPercentage) >= num(item.target);
                    return (
                      <tr key={item.co}>
                        <td><strong>{item.co}</strong></td>
                        <td>{pct(item.target)}</td>
                        <td>{pct(item.attainmentPercentage)}</td>
                        <td>{tv(item.score)}</td>
                        <td><span className={`status-pill ${statusClass(achieved)}`}>{achieved ? "Achieved" : "Not Achieved"}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ReportSection>

          <ReportSection title="PO Attainment Summary">
            <div className="table-wrap report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>PO</th>
                    <th>Mapped COs</th>
                    <th>Attainment %</th>
                    <th>Attainment Level</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {derived.poRows.map((item) => (
                    <tr key={item.po}>
                      <td><strong>{item.po}</strong></td>
                      <td>{item.mappedCOs.join(", ") || "-"}</td>
                      <td>{pct(item.percent)}</td>
                      <td>{item.level}</td>
                      <td>{item.remarks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ReportSection>

          <ReportSection title="CO-PO Mapping Matrix">
            <div className="mapping-legend">
              <span><b>—</b> Not mapped</span>
              <span><b>1</b> Low</span>
              <span><b>2</b> Medium</span>
              <span><b>3</b> High</span>
            </div>
            <div className="table-wrap report-table-wrap">
              <table className="report-table mapping-matrix">
                <thead>
                  <tr>
                    <th>CO / PO</th>
                    {derived.activePOs.map((po) => <th key={po}>{po}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {(courseData.cos || []).map((co) => (
                    <tr key={co.id}>
                      <th>{co.id}</th>
                      {derived.activePOs.map((po) => {
                        const raw = report.mapping?.[co.id]?.[po];
                        // null = not connected or below threshold; 0 legacy = also not mapped
                        const isBlank = raw === null || raw === undefined || raw === 0;
                        const value = isBlank ? null : num(raw);
                        return (
                          <td key={po} className={`map-level map-level-${value ?? 0}`}
                            style={{ color: isBlank ? "#ccc" : undefined, fontWeight: isBlank ? 400 : 800 }}>
                            {isBlank ? "—" : value}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ReportSection>

          <ReportSection title="Assessment-wise Analysis">
            <div className="table-wrap report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Assessment</th>
                    <th>Max Marks</th>
                    <th>Average Mark</th>
                    <th>Average %</th>
                    <th>Attainment Level</th>
                  </tr>
                </thead>
                <tbody>
                  {derived.assessmentRows.length ? derived.assessmentRows.map((item) => (
                    <tr key={item.name}>
                      <td>{item.name}</td>
                      <td>{item.maxMarks}</td>
                      <td>{item.averageMark}</td>
                      <td>{pct(item.averagePercent)}</td>
                      <td>{item.attainmentLevel}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5}>No assessment data available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </ReportSection>

          <ReportSection title="GAPC 4.0 / WK Mapping">
            <div className="table-wrap report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>WK</th>
                    <th>Related COs</th>
                    <th>Attainment Contribution</th>
                  </tr>
                </thead>
                <tbody>
                  {derived.wkRows.map((item) => (
                    <tr key={item.wk}>
                      <td><strong>{item.wk}</strong></td>
                      <td>{item.relatedCOs.join(", ") || "-"}</td>
                      <td>{item.relatedCOs.length ? pct(item.contribution) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ReportSection>

          <ReportSection title="CO to SDG Mapping">
            <div className="table-wrap report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>CO</th>
                    <th>CO Statement</th>
                    <th>Mapped SDGs</th>
                    <th>Bloom's Level</th>
                  </tr>
                </thead>
                <tbody>
                  {(courseData.cos || []).map((co) => (
                    <tr key={co.id}>
                      <td><strong>{co.id}</strong></td>
                      <td>{co.description || <span style={{ color: "var(--muted)" }}>—</span>}</td>
                      <td>
                        {(co.sdgs || []).length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {(co.sdgs || []).map((sdg) => (
                              <span key={sdg} style={{
                                background: "#e0f7fa", color: "#006064",
                                border: "1px solid #80deea", borderRadius: 12,
                                padding: "1px 8px", fontSize: 11, fontWeight: 700,
                              }}>{sdg}</span>
                            ))}
                          </div>
                        ) : <span style={{ color: "var(--muted)" }}>—</span>}
                      </td>
                      <td>
                        {(Array.isArray(co.blooms) ? co.blooms : []).length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {(Array.isArray(co.blooms) ? co.blooms : []).map((b) => (
                              <span key={b} style={{ fontSize: 11, fontWeight: 700, padding: "1px 8px", borderRadius: 12, background: "#f3e5f5", color: "#4a148c", border: "1px solid #ce93d8" }}>{b}</span>
                            ))}
                          </div>
                        ) : <span style={{ color: "var(--muted)" }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ReportSection>

          <ReportSection title="SDG Impact Analysis">
            <div className="table-wrap report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Mapped SDG</th>
                    <th>Related COs</th>
                    <th>Related POs</th>
                    <th>Contribution Level</th>
                  </tr>
                </thead>
                <tbody>
                  {derived.sdgRows.length ? derived.sdgRows.map((item) => (
                    <tr key={item.sdg}>
                      <td>{item.sdg}</td>
                      <td>{item.relatedCOs.join(", ")}</td>
                      <td>{item.relatedPOs.join(", ") || "-"}</td>
                      <td>{item.contribution}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4}>No SDGs mapped for this course.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </ReportSection>

          <ReportSection title="Graphical Analytics">
            <div className="chart-grid">
              <div className="chart-panel">
                <h3>CO Attainment</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={derived.coChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="co" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="Target" fill="#e9a63a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Achieved" fill="#2a9d8f" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-panel">
                <h3>PO Attainment</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={derived.poChart}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="po" />
                    <Radar dataKey="attainment" stroke="#22577a" fill="#22577a" fillOpacity={0.28} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-panel">
                <h3>Assessment Performance</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={derived.assessmentRows}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="averagePercent" name="Average %" fill="#6d5dfc" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-panel">
                <h3>Mark Distribution</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={derived.markDistribution}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="range" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8acb4a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </ReportSection>

          <ReportSection title="Final Remarks">
            <div className="remarks-box">
              {derived.remarks.map((remark) => <p key={remark}>{remark}</p>)}
            </div>
          </ReportSection>

          <ReportSection title="Export Options" className="export-section">
            <div className="export-actions">
              <button onClick={() => navigate("/export")}><Download size={16} /> Download PDF</button>
              <button className="secondary" onClick={() => navigate("/export")}><FileSpreadsheet size={16} /> Download Excel</button>
              <button className="secondary" onClick={() => window.print()}><Printer size={16} /> Print Report</button>
              <button className="secondary" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><Search size={16} /> Preview Report</button>
            </div>
          </ReportSection>
        </main>
      )}
    </div>
  );
}