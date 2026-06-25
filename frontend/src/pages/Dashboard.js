import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen, ClipboardList, FileSpreadsheet, BarChart3, Download,
  User, GitBranch, CheckCircle, Circle, ArrowRight, TrendingUp,
  Users, Award, Target, Activity, ChevronRight, X, Info,
} from "lucide-react";
import { useApp } from "../AppContext";
import { downloadIATemplate, downloadESETemplate, downloadCATemplate } from "../utils/templateGenerator";

const STEPS = [
  {
    to: "/course", icon: BookOpen, step: 1,
    title: "Course Details",
    desc: "Course name, code, programme, faculty, COs with Bloom's taxonomy and SDG mapping.",
    color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe",
    check: (cd) => !!(cd.course?.courseName && cd.course?.courseCode),
  },
  {
    to: "/attainment-type", icon: ClipboardList, step: 2,
    title: "Attainment Type",
    desc: "Select direct/indirect modes and configure evaluation policy weightages.",
    color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe",
    check: (cd) => Object.values(cd.evaluationPolicy || {}).reduce((s, v) => s + v, 0) === 100,
  },
  {
    to: "/questions", icon: FileSpreadsheet, step: 3,
    title: "Questions & CO-PO",
    desc: "Map assessment questions to COs and define the CO-PO correlation matrix.",
    color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc",
    check: (cd) => (cd.assessments?.[0]?.questions?.length > 0) || cd.wkMappingDone,
  },
  {
    to: "/wk-mapping", icon: GitBranch, step: 4,
    title: "WK-based CO-PO",
    desc: "Washington Accord WK indicators → derive CO-PO mapping via Performance Indicators.",
    color: "#0d9488", bg: "#f0fdfa", border: "#99f6e4",
    check: (cd) => !!cd.wkMappingDone,
  },
  {
    to: "/marks", icon: Users, step: 5,
    title: "Marks Entry",
    desc: "Upload IA, ESE and CA Excel sheets. Auto-splits multi-CO questions.",
    color: "#059669", bg: "#ecfdf5", border: "#a7f3d0",
    check: (cd) => cd.students?.length > 0,
  },
  {
    to: "/survey", icon: User, step: 6,
    title: "Indirect Survey",
    desc: "Course exit survey responses for indirect attainment (VH/H/M/L/VL scale).",
    color: "#d97706", bg: "#fffbeb", border: "#fde68a",
    check: (cd) => {
      if (!cd.attainmentModes?.indirect) return true;
      return Object.values(cd.indirectSurvey?.responses || {}).some((r) =>
        Object.values(r).some((v) => v > 0)
      );
    },
  },
  {
    to: "/report", icon: BarChart3, step: 7,
    title: "View Report",
    desc: "Computed CO attainment, PO attainment, direct/indirect scores and rubric.",
    color: "#dc2626", bg: "#fef2f2", border: "#fecaca",
    check: (cd, report) => !!report,
  },
  {
    to: "/export", icon: Download, step: 8,
    title: "Export Report",
    desc: "Download complete attainment report as PDF with CO-PO mapping and PO scores.",
    color: "#9333ea", bg: "#faf5ff", border: "#e9d5ff",
    check: (cd, report) => !!report,
  },
];

function AnimatedCounter({ value, duration = 800 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const target = parseFloat(value) || 0;
    if (target === 0) { setDisplay(0); return; }
    const steps = 40;
    const inc = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += inc;
      if (current >= target) { setDisplay(target); clearInterval(timer); }
      else setDisplay(Math.round(current * 10) / 10);
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <>{display}</>;
}

function ProgressRing({ pct, size = 52, stroke = 5, color }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1s ease" }}
      />
    </svg>
  );
}

export default function Dashboard() {
  const { faculty, courseData, report, resetData } = useApp();
  const navigate = useNavigate();
  const [showReset, setShowReset] = useState(false);
  const [showGuide, setShowGuide] = useState(() => !localStorage.getItem("guideShown"));

  function closeGuide() {
    localStorage.setItem("guideShown", "1");
    setShowGuide(false);
  }

  const completedSteps = STEPS.filter((s) => s.check(courseData, report)).length;
  const progressPct = Math.round((completedSteps / STEPS.length) * 100);

  const totalStudents = courseData.students?.length ?? 0;
  const totalCOs = courseData.cos?.filter((c) => c.description).length ?? 0;
  const totalQuestions = courseData.assessments?.flatMap((a) => a.questions).length ?? 0;
  const avgCO = report?.summary?.averageCOScore ?? null;
  const avgPO = report?.summary?.averagePOScore ?? null;

  const hasAnything = !!(courseData.course?.courseName || totalStudents || report);

  // Find next incomplete step
  const nextStep = STEPS.find((s) => !s.check(courseData, report));

  return (
    <div className="dashboard-root">

      {/* ── Instruction / Welcome Modal ── */}
      {showGuide && (
        <div className="modal-overlay" onClick={closeGuide}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="modal-header">
              <div className="modal-badge">NBA</div>
              <p className="modal-subtitle">Getting Started</p>
              <h2>Welcome to the CO-PO Attainment System</h2>
              <p className="modal-intro">
                Follow the steps below to compute CO and PO attainment for your course.
                Before you begin, download the required Excel templates and fill in your student marks.
              </p>
            </div>

            {/* Workflow steps */}
            <ol className="modal-list">
              <li><strong>Course Details</strong> — Enter course name, code, programme, faculty and define COs with target grades.</li>
              <li><strong>Attainment Type</strong> — Choose direct/indirect modes and set IA / ESE / CA weightages (must sum to 100%).</li>
              <li><strong>Questions &amp; CO-PO</strong> — Map assessment questions to COs and fill the CO-PO correlation matrix.</li>
              <li><strong>Marks Entry</strong> — Upload IA, ESE and CA Excel sheets. Multi-CO questions are split automatically.</li>
              <li><strong>Report</strong> — Calculate CO attainment scores and PO attainment.</li>
              <li><strong>Export</strong> — Download the full professional PDF report with NITC branding.</li>
            </ol>

            {/* Template download section */}
            <div style={{
              background: "#f0fdf4",
              border: "1.5px solid #a7f3d0",
              borderRadius: 10,
              padding: "18px 20px",
              display: "grid",
              gap: 14,
            }}>
              <div>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: "#065f46" }}>
                  Download Sample Excel Templates
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#047857", lineHeight: 1.6 }}>
                  Before starting, download the required Excel templates and fill marks only in the given format.
                  Do <strong>not</strong> rename the CO header rows.
                </p>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {[
                  { label: "Download IA Template",  fn: downloadIATemplate,  desc: "Internal Assessment",       color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
                  { label: "Download ESE Template", fn: downloadESETemplate, desc: "End Semester Examination",  color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
                  { label: "Download CA Template",  fn: downloadCATemplate,  desc: "Continuous Assessment",     color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
                ].map(({ label, fn, desc, color, bg, border }) => (
                  <div key={label} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: bg, border: `1.5px solid ${border}`,
                    borderRadius: 8, padding: "10px 14px",
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{desc}</div>
                      <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Includes Instructions sheet</div>
                    </div>
                    <button
                      onClick={fn}
                      style={{
                        background: color, color: "#fff",
                        fontSize: 12, fontWeight: 700,
                        padding: "7px 14px", borderRadius: 6,
                        display: "flex", alignItems: "center", gap: 6,
                        flexShrink: 0,
                      }}
                    >
                      <Download size={13} />
                      {label}
                    </button>
                  </div>
                ))}
              </div>

              <p style={{ margin: 0, fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                Each template has an <strong>Instructions</strong> sheet explaining the exact format.
                Fill marks only in the data rows. Do not rename or reorder the CO or Question header rows.
              </p>
            </div>

            {/* Close button */}
            <button className="modal-btn" onClick={closeGuide}>
              Got it — Start with Course Details →
            </button>

            <p className="modal-footer-note">
              This guide won't show again. Click the
              <strong> ⓘ Guide</strong> button on the dashboard to reopen it anytime.
            </p>
          </div>
        </div>
      )}

      <div className="dash-hero">
        <div className="dash-hero-left">
          <h1 className="dash-title">
            Welcome back,<br />
            <span className="dash-name">{faculty?.name || "Faculty"}</span>
          </h1>
          {courseData.course?.courseName && (
            <div className="dash-course-pill">
              <BookOpen size={13} />
              <span>{courseData.course.courseName}</span>
              {courseData.course.courseCode && (
                <span className="dash-code-badge">{courseData.course.courseCode}</span>
              )}
            </div>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {nextStep && (
              <button
                className="dash-next-btn"
                onClick={() => navigate(nextStep.to)}
                style={{ background: nextStep.color }}
              >
                Continue: Step {nextStep.step} — {nextStep.title}
                <ArrowRight size={15} />
              </button>
            )}
            <button
              onClick={() => setShowGuide(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.3)",
                color: "#fff", fontSize: 13, fontWeight: 700,
                padding: "9px 16px", borderRadius: 8,
              }}
            >
              <Info size={14} /> Guide &amp; Templates
            </button>
          </div>
        </div>
      </div>

      {/* ── Live Metrics ── */}
      {hasAnything && (
        <div className="dash-metrics">
          {[
            { label: "Students", value: totalStudents, icon: Users, color: "#2563eb", bg: "#eff6ff" },
            { label: "Course Outcomes", value: totalCOs, icon: Target, color: "#7c3aed", bg: "#f5f3ff" },
            { label: "Questions", value: totalQuestions, icon: FileSpreadsheet, color: "#0891b2", bg: "#ecfeff" },
            ...(avgCO !== null ? [{ label: "Avg CO Score", value: avgCO, icon: TrendingUp, color: "#059669", bg: "#ecfdf5" }] : []),
            ...(avgPO !== null ? [{ label: "Avg PO Score", value: avgPO, icon: Award, color: "#d97706", bg: "#fffbeb" }] : []),
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="dash-metric-card" style={{ "--mc": color, "--mcbg": bg }}>
              <div className="dash-metric-icon"><Icon size={18} color={color} /></div>
              <div className="dash-metric-val">
                <AnimatedCounter value={value} />
              </div>
              <div className="dash-metric-lbl">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── About Banner ── */}
      <div className="dash-about">
        <div className="dash-about-icon"><BookOpen size={18} color="#2a9d8f" /></div>
        <div>
          <strong>About this system</strong>
          <p>
            NBA SAR 2025 system incorporating <em>GAPC 4.0</em>, Washington Knowledge indicators (WK1–WK9),
            Performance Indicators, Bloom's Taxonomy multi-level mapping, SDG alignment,
            and automated CO-PO attainment computation from IA, ESE and CA marks.
          </p>
        </div>
      </div>

      {/* ── Workflow Steps ── */}

      <div className="dash-steps-grid">
        {STEPS.map((s, i) => {
          const done = s.check(courseData, report);
          const isNext = !done && STEPS.slice(0, i).every((prev) => prev.check(courseData, report));
          const Icon = s.icon;
          return (
            <div
              key={s.to}
              className={`dash-step-card ${done ? "step-done" : ""} ${isNext ? "step-next" : ""}`}
              style={{
                "--sc": s.color, "--sbg": s.bg, "--sborder": s.border,
                cursor: "pointer",
              }}
              onClick={() => navigate(s.to)}
            >
              <div className="dsc-header">
                <div className="dsc-num-wrap" style={{ background: done ? s.color : s.bg, border: `1.5px solid ${s.border}` }}>
                  {done
                    ? <CheckCircle size={16} color="#fff" />
                    : <span style={{ color: s.color, fontWeight: 800, fontSize: 13 }}>{s.step}</span>
                  }
                </div>
                <div className="dsc-title-wrap">
                  <span className="dsc-step-label">Step {s.step}</span>
                  <span className="dsc-title">{s.title}</span>
                </div>
                {isNext && <span className="dsc-next-badge">Next</span>}
                {done && <CheckCircle size={16} color={s.color} style={{ marginLeft: "auto", flexShrink: 0 }} />}
              </div>

              <div className="dsc-icon-row">
                <div className="dsc-icon-bg" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                  <Icon size={22} color={s.color} />
                </div>
              </div>

              <p className="dsc-desc">{s.desc}</p>

              <div className="dsc-footer" style={{ color: s.color }}>
                <span>{done ? "View / Edit" : isNext ? "Start now" : "Go to step"}</span>
                <ChevronRight size={14} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── CO Attainment Preview (if report exists) ── */}
      {report?.coResults?.length > 0 && (
        <>
          <div className="dash-section-label">
            <span>CO Attainment Preview</span>
            <button className="secondary" style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => navigate("/report")}>
              Full Report →
            </button>
          </div>
          <div className="dash-co-grid">
            {report.coResults.map((r) => {
              const pct = r.attainmentPercentage ?? 0;
              const score = r.score ?? 0;
              const ok = pct >= (r.target ?? 50);
              return (
                <div key={r.co} className={`dash-co-card ${ok ? "co-ok" : "co-low"}`}>
                  <div className="dcc-header">
                    <strong>{r.co}</strong>
                    <span className={`dcc-badge ${ok ? "badge-ok" : "badge-low"}`}>
                      {ok ? "✓ Attained" : "✗ Below Target"}
                    </span>
                  </div>
                  <div className="dcc-bar-wrap">
                    <div className="dcc-bar-track">
                      <div
                        className="dcc-bar-fill"
                        style={{ width: `${Math.min(pct, 100)}%`, background: ok ? "#22c55e" : "#ef4444" }}
                      />
                      <div
                        className="dcc-target-line"
                        style={{ left: `${Math.min(r.target ?? 50, 100)}%` }}
                        title={`Target: ${r.target}%`}
                      />
                    </div>
                    <span className="dcc-pct">{pct}%</span>
                  </div>
                  <div className="dcc-meta">
                    <span>Target {r.target}%</span>
                    <span>{r.studentsAttained}/{r.totalStudents} students</span>
                    <span className="dcc-score">Score: {score}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Reset ── */}
      {hasAnything && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          {!showReset
            ? <button className="secondary" style={{ fontSize: 12 }} onClick={() => setShowReset(true)}>Reset Course Data</button>
            : (
              <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#dc2626" }}>
                Are you sure? This clears all data.
                <button style={{ background: "#dc2626", fontSize: 12, padding: "5px 12px" }} onClick={() => { resetData(); setShowReset(false); }}>Yes, Reset</button>
                <button className="secondary" style={{ fontSize: 12, padding: "5px 12px" }} onClick={() => setShowReset(false)}>Cancel</button>
              </div>
            )
          }
        </div>
      )}
    </div>
  );
}
