import React from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useApp } from "../AppContext";
import { COURSE_FIELDS, NBA_POS, SDG_LIST, WK_LIST, derivePOsFromWKs, PO_COMPETENCIES, computeMappingValue } from "../constants";

const LOGO_SRC = `${process.env.PUBLIC_URL || ""}/college_logo.png`;
const LOGO_RATIO = 483 / 104;

const M = 16;
const PAD = 4;
const BORDER_W = 0.55;
const HDR_COLOR = [15, 56, 96];
const SECTION_COLOR = [30, 100, 160];
const MUTED = [100, 116, 139];

function tv(value) {
  return value === undefined || value === null || value === "" ? "-" : String(value);
}

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pct(value) {
  return `${Math.round(num(value) * 100) / 100}%`;
}

function poPercent(score) {
  return `${Math.round((Math.min(3, Math.max(0, num(score))) / 3) * 100)}%`;
}

function levelText(score) {
  const value = num(score);
  if (value >= 2.5) return "High";
  if (value >= 1.5) return "Moderate";
  if (value > 0) return "Low";
  return "Not mapped";
}

async function loadLogo() {
  try {
    const res = await fetch(LOGO_SRC, { cache: "no-store" });
    if (!res.ok) return null;

    // IMPORTANT: jsPDF expects a real PNG base64, not an HTML error page.
    // If the server returns HTML (e.g., 404), the decoded "PNG" will fail with
    // "wrong PNG signature".
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("png")) {
      const text = await res.text().catch(() => "");
      console.warn("Logo fetch returned non-PNG content-type:", contentType);
      if (text) console.warn("Logo fetch body preview:", text.slice(0, 200));
      return null;
    }

    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}


function downloadCSV(filename, rows) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = filename;
  a.click();
}

export default function ExportPage() {
  const { courseData, report } = useApp();
  const navigate = useNavigate();

  if (!report) {
    return (
      <div>
        <header className="topbar">
          <div><p className="eyebrow">Step 7</p><h1>Export Report</h1></div>
          <button className="secondary" onClick={() => navigate("/report")}>Back to Report</button>
        </header>
        <div className="panel wide" style={{ textAlign: "center", padding: "48px 0" }}>
          <p style={{ color: "var(--muted)" }}>No report generated yet. Please calculate attainment first.</p>
          <button onClick={() => navigate("/report")} style={{ marginTop: 16 }}>Go to Report</button>
        </div>
      </div>
    );
  }

  const course = report.course || courseData.course || {};
  // Only include COs that have been actually entered (have a description)
  const cos = (courseData.cos || []).filter((co) => co.description && co.description.trim() !== "");
  // Only include POs that are in the report results (actually used in computation)
  const _allPos = courseData.pos || [];
  const _usedPos = new Set([
    ...Object.keys(report.poScores || {}),
    ...(report.coResults || []).flatMap((r) => Object.keys(report.mapping?.[r.co] || {}).filter((po) => (report.mapping[r.co][po] || 0) > 0)),
  ]);
  const pos = _allPos.filter((po) => _usedPos.has(po) || _allPos.length <= 3);

  // Slot data refs for PDF export
  const slotDataRef = courseData.slotData || { IA: null, ESE: null, CA: null };
  const evalPolicyRef = courseData.evaluationPolicy || {};
  const slotMeta = [
    { key: "IA",  label: "Internal Assessment" },
    { key: "ESE", label: "End Semester Examination" },
    { key: "CA",  label: "Continuous Assessment" },
  ];
  const hasAnySlot = slotMeta.some(({ key }) => slotDataRef[key]);

  function exportCOCSV() {
    downloadCSV(`CO_Attainment_${course.courseCode || "report"}.csv`, [
      ["CO", "Description", "Target %", "Students Attained", "Total Students", "% Attained", "Score"],
      ...(report.coResults || []).map((r) => [
        r.co,
        r.description || "",
        r.target,
        r.studentsAttained,
        r.totalStudents,
        r.attainmentPercentage,
        r.score,
      ]),
    ]);
  }

  function exportPOCSV() {
    downloadCSV(`PO_Attainment_${course.courseCode || "report"}.csv`, [
      ["PO", "Direct Score", "Indirect Score", "Final Score"],
      ...pos.map((po) => [
        po,
        report.directPoScores?.[po] ?? "-",
        report.indirect?.poScores?.[po] ?? "-",
        report.poScores?.[po] ?? "-",
      ]),
    ]);
  }

  function exportMappingCSV() {
    downloadCSV(`CO_PO_Mapping_${course.courseCode || "report"}.csv`, [
      ["CO", ...pos],
      ...cos.map((co) => [co.id, ...pos.map((po) => report.mapping?.[co.id]?.[po] ?? 0)]),
    ]);
  }
  
  async function exportFullPDF() {
    const logoData = await loadLogo();
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const borderW = pageW - M * 2;
    const innerX = M + PAD;
    const innerW = borderW - PAD * 2;
    const bottomLimit = pageH - M - 12;

    function drawBorder() {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(BORDER_W);
      doc.rect(M, M, borderW, pageH - M * 2);
    }

    function addPage() {
      doc.addPage();
      drawBorder();
      return M + 8;
    }

    function sectionTitle(title, y) {
      if (y + 12 > bottomLimit) y = addPage();
      doc.setFillColor(...SECTION_COLOR);
      doc.rect(innerX, y, innerW, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(title, innerX + 3, y + 5, { maxWidth: innerW - 6 });
      doc.setTextColor(0, 0, 0);
      return y + 9;
    }

    function table(opts) {
      autoTable(doc, {
        ...opts,
        margin: { left: innerX, right: innerX, top: M + 8, bottom: M + 11 },
        pageBreak: "auto",
        rowPageBreak: "avoid",
        showHead: "everyPage",
        tableLineColor: [0, 0, 0],
        tableLineWidth: 0.2,
        styles: {
          fontSize: 8,
          cellPadding: 1.7,
          lineColor: [0, 0, 0],
          lineWidth: 0.15,
          textColor: [0, 0, 0],
          overflow: "linebreak",
          ...(opts.styles || {}),
        },
        headStyles: {
          fillColor: HDR_COLOR,
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
          ...(opts.headStyles || {}),
        },
        alternateRowStyles: { fillColor: [245, 248, 252] },
        didDrawPage: () => drawBorder(),
      });
    }

    function nextY(extra = 5) {
      return (doc.lastAutoTable?.finalY || M + 8) + extra;
    }

    // ── PAGE 1: Cover Page ─────────────────────────────────────────────────
    drawBorder();

    // Top accent bar
    doc.setFillColor(...HDR_COLOR);
    doc.rect(innerX, M + 4, innerW, 4, "F");

    // Logo box
    const logoBoxH = 28;
    const logoY = M + 12;
    doc.setDrawColor(...HDR_COLOR);
    doc.setLineWidth(0.4);
    doc.rect(innerX, logoY, innerW, logoBoxH);
    if (logoData) {
      const logoW = Math.min(innerW - 20, (logoBoxH - 6) * LOGO_RATIO);
      const logoH = logoW / LOGO_RATIO;
      doc.addImage(logoData, "PNG", innerX + (innerW - logoW) / 2, logoY + (logoBoxH - logoH) / 2, logoW, logoH);
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...HDR_COLOR);
      doc.text("[ Institution Logo ]", pageW / 2, logoY + logoBoxH / 2 + 2, { align: "center" });
      doc.setTextColor(0, 0, 0);
    }

    // Main title banner
    const titleY = logoY + logoBoxH + 4;
    doc.setFillColor(...HDR_COLOR);
    doc.rect(innerX, titleY, innerW, 14, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text("CO-PO ATTAINMENT REPORT", pageW / 2, titleY + 6, { align: "center" });
    doc.setFontSize(9);
    doc.text("Outcome Based Education (OBE) — Accreditation Support System", pageW / 2, titleY + 12, { align: "center" });

    // Sub-banner
    const subY = titleY + 14;
    doc.setFillColor(220, 232, 245);
    doc.rect(innerX, subY, innerW, 7, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...HDR_COLOR);
    doc.text(
      `${tv(course.programme)}  |  ${tv(course.specialization)}  |  Academic Year: ${tv(course.academicYear)}`,
      pageW / 2, subY + 5, { align: "center" }
    );
    doc.setTextColor(0, 0, 0);

    // Cover details block
    const coverTableY = subY + 11;
    const coverFields = [
      ["Course Name",    tv(course.courseName)],
      ["Course Code",    tv(course.courseCode)],
      ["Academic Year",  tv(course.academicYear)],
      ["Programme",      tv(course.programme)],
      ["Specialization", tv(course.specialization)],
      ["Faculty Name",   tv(course.faculty)],
      ["Semester",       tv(course.semester || course.courseSemester)],
      ["Course Year",    tv(course.courseYear)],
      ["Credits",        tv(course.credits)],
    ];
    const coverLabelW = 52;
    const coverRowH = 7.5;
    coverFields.forEach(([label, value], i) => {
      const ry = coverTableY + i * coverRowH;
      doc.setFillColor(...(i % 2 === 0 ? [240, 245, 252] : [255, 255, 255]));
      doc.rect(innerX, ry, innerW, coverRowH, "F");
      doc.setDrawColor(190, 210, 230);
      doc.setLineWidth(0.15);
      doc.rect(innerX, ry, innerW, coverRowH);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...HDR_COLOR);
      doc.text(label, innerX + 3, ry + coverRowH - 2.2);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
      doc.text(value, innerX + coverLabelW + 3, ry + coverRowH - 2.2, { maxWidth: innerW - coverLabelW - 6 });
    });

    // Generation date box
    const genBoxY = coverTableY + coverFields.length * coverRowH + 6;
    doc.setFillColor(245, 250, 255);
    doc.setDrawColor(...HDR_COLOR);
    doc.setLineWidth(0.3);
    doc.rect(innerX, genBoxY, innerW, 8, "F");
    doc.rect(innerX, genBoxY, innerW, 8);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(
      `Report Generated: ${new Date().toLocaleString("en-IN", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
      pageW / 2, genBoxY + 5.2, { align: "center" }
    );
    doc.setTextColor(0, 0, 0);

    // Bottom accent on cover
    doc.setFillColor(...HDR_COLOR);
    doc.rect(innerX, pageH - M - 8, innerW, 4, "F");

    // ── PAGE 2: Table of Contents ──────────────────────────────────────────
    doc.addPage();
    drawBorder();
    doc.setFillColor(...HDR_COLOR);
    doc.rect(innerX, M + 4, innerW, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text("TABLE OF CONTENTS", pageW / 2, M + 11, { align: "center" });
    doc.setTextColor(0, 0, 0);

    const tocEntries = [
      ["Section 1",  "Course Information"],
      ["Section 2",  "Evaluation Policy & Attainment Mode"],
      ["Section 3",  "Course Outcomes (CO)"],
      ["Section 4",  "Programme Outcomes & PSO Configuration"],
      ["Section 5",  "Assessment Files Summary"],
      ["Section 6",  "Survey Responses (Indirect Attainment)"],
      ["Section 7",  "Washington Accord Knowledge (WK) Mapping"],
      ["Section 8",  "Performance Indicator Entry (PO by PO)"],
      ["Section 9",  "CO to SDG Mapping & SDG Impact Analysis"],
      ["Section 10", "CO Attainment Summary (Direct)"],
      ["Section 11", "Indirect Attainment Summary"],
      ["Section 12", "Overall CO Attainment"],
      ["Section 13", "CO-PO Mapping Matrix"],
      ["Section 14", "CO-PSO Mapping Matrix"],
      ["Section 15", "PO Attainment"],
      ["Section 16", "PSO Attainment"],
      ["Section 17", "Graphical Analytics"],
      ["Section 18", "Final Summary & Remarks"],
    ];
    let tocY = M + 18;
    const tocNumW = 24;
    const tocTitleW = innerW - tocNumW - 16;
    tocEntries.forEach(([secNum, title], i) => {
      const ry = tocY + i * 8;
      doc.setFillColor(...(i % 2 === 0 ? [245, 248, 252] : [255, 255, 255]));
      doc.rect(innerX, ry, innerW, 8, "F");
      doc.setDrawColor(210, 220, 235);
      doc.setLineWidth(0.1);
      doc.rect(innerX, ry, innerW, 8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...HDR_COLOR);
      doc.text(secNum, innerX + 3, ry + 5.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
      doc.text(title, innerX + tocNumW, ry + 5.5, { maxWidth: tocTitleW });
      doc.setTextColor(...MUTED);
      doc.setFontSize(7);
      doc.text("...................", innerX + tocNumW + tocTitleW, ry + 5.5, { align: "right" });
    });
    doc.setTextColor(0, 0, 0);

    // ── PAGE 3+: Content Sections ──────────────────────────────────────────
    doc.addPage();
    drawBorder();

    // Section 1 — Course Information
    let y = sectionTitle("SECTION 1 — Course Information", M + 8);
    table({
      startY: y,
      head: [["Field", "Value"]],
      body: COURSE_FIELDS.map(([key, label]) => [label, tv(course[key])]),
      columnStyles: {
        0: { cellWidth: 55, fontStyle: "bold", fillColor: [240, 245, 252] },
        1: { cellWidth: innerW - 55 },
      },
    });

    // ── SECTION 2: Evaluation Policy & Attainment Mode ───────────────────────
    y = sectionTitle("SECTION 2 — Evaluation Policy & Attainment Mode", nextY());

    // Attainment modes row
    const modesDirect = courseData.attainmentModes?.direct ? "Direct Attainment (Student Marks)" : null;
    const modesIndirect = courseData.attainmentModes?.indirect ? "Indirect Attainment (Exit Survey)" : null;
    const modesText = [modesDirect, modesIndirect].filter(Boolean).join("  +  ") || "Not configured";
    const bothModes = courseData.attainmentModes?.direct && courseData.attainmentModes?.indirect;

    table({
      startY: y,
      head: [["Setting", "Value"]],
      body: [
        ["Attainment Mode(s) Selected", modesText],
        ["Weightage Split (if both modes)", bothModes ? "80% Direct + 20% Indirect" : "N/A (single mode)"],
      ],
      columnStyles: {
        0: { cellWidth: 70, fontStyle: "bold", fillColor: [240, 245, 252] },
        1: { cellWidth: innerW - 70 },
      },
    });

    // Evaluation policy weightages
    y = sectionTitle("Evaluation Policy Weightages", nextY(2));
    const evalPolicy = courseData.evaluationPolicy || {};
    table({
      startY: y,
      head: [["Assessment Component", "Weightage (%)", "Note"]],
      body: [
        ["Internal Assessment (IA)",        tv(evalPolicy.interimTest),        "Interim / Internal Test"],
        ["End Semester Examination (ESE)",   tv(evalPolicy.endExam),            "End Semester Exam"],
        ["Continuous Assessment (CA)",       tv(evalPolicy.continuousEvaluation), "Assignments, Quizzes, etc."],
        ["Other",                            tv(evalPolicy.other),              "Any additional component"],
        
      ],
      columnStyles: {
        0: { cellWidth: 75, fontStyle: "bold" },
        1: { cellWidth: 28, halign: "center" },
        2: { cellWidth: innerW - 103 },
      },
      didParseCell: (data) => {
        if (data.row.index === 4) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [220, 232, 245];
        }
      },
    });

    // Attainment rubric
    y = sectionTitle("Attainment Rubric (Used for CO Level Calculation)", nextY(2));
    table({
      startY: y,
      head: [["Attainment Level", "% of Students Achieving Target Grade", "Interpretation"]],
      body: [
        ["3 — High",     "≥ 85%",       "High attainment"],
        ["2 — Moderate", "50% – 84%",  "Moderate attainment (linear interpolation)"],
        ["1 — Low",      "30% – 49%",  "Low attainment (linear interpolation)"],
        ["0 — Not Attained", "< 30%",  "Not attained"],
      ],
      columnStyles: {
        0: { cellWidth: 35, fontStyle: "bold", halign: "center" },
        1: { cellWidth: 55, halign: "center" },
        2: { cellWidth: innerW - 90 },
      },
    });

    // ── SECTION 3: Course Outcomes ────────────────────────────────────────────
    if (nextY() + 30 > bottomLimit) { doc.addPage(); drawBorder(); y = sectionTitle("SECTION 3 — Course Outcomes (CO)", M + 8); }
    else { y = sectionTitle("SECTION 3 — Course Outcomes (CO)", nextY()); }
    table({
      startY: y,
      head: [["CO", "CO Statement / Description", "Target Grade", "Target %", "Mapped SDGs", "Bloom's Level"]],
      body: cos.map((co) => [
        co.id,
        co.description || "-",
        co.targetGrade || "-",
        pct(co.target ?? 0),
        (co.sdgs || []).join(", ") || "-",
        (Array.isArray(co.blooms) ? co.blooms : []).join(", ") || "-",
      ]),
      columnStyles: {
        0: { cellWidth: 13, fontStyle: "bold", halign: "center" },
        1: { cellWidth: 65 },
        2: { cellWidth: 20, halign: "center" },
        3: { cellWidth: 18, halign: "center" },
        4: { cellWidth: 28 },
        5: { cellWidth: innerW - 144 },
      },
    });

    // ── SECTION 4: Programme Outcomes & PSO Configuration ────────────────────
    if (nextY() + 40 > bottomLimit) { doc.addPage(); drawBorder(); y = M + 8; }
    else { y = nextY(5); }
    y = sectionTitle("SECTION 4 — Programme Outcomes & PSO Configuration", y);
    y = sectionTitle("4a — Selected Programme Outcomes (PO)", y);
    table({
      startY: y,
      head: [["PO", "PO Name / Label"]],
      body: (courseData.pos || []).map((po) => [
        po,
        NBA_POS.find((p) => p.id === po)?.label || "-",
      ]),
      columnStyles: {
        0: { cellWidth: 16, fontStyle: "bold", halign: "center" },
        1: { cellWidth: innerW - 16 },
      },
    });

    // PSO Configuration
    const psoConfig = (courseData.psoConfig || []).filter((p) => p.label && p.label.trim() !== "");
    if (psoConfig.length) {
      y = sectionTitle("4b — PSO Configuration (Faculty Entry)", nextY(4));
      table({
        startY: y,
        head: [["PSO ID", "Label / Description", "WK Indicators Mapped"]],
        body: psoConfig.map((pso) => [
          pso.id,
          pso.label || "-",
          (pso.wks || []).join(", ") || "-",
        ]),
        columnStyles: {
          0: { cellWidth: 18, fontStyle: "bold", halign: "center" },
          1: { cellWidth: 80 },
          2: { cellWidth: innerW - 98 },
        },
      });
    }

    // ─ SECTION 5: Assessment Files Summary ──────────────────────────────────
    if (hasAnySlot) {
      doc.addPage();
      drawBorder();
      y = sectionTitle("SECTION 5 — Assessment Files Summary", M + 8);
    slotMeta.forEach(({ key, label }) => {
      const slot = slotDataRef[key];
      if (!slot) return;
      y = sectionTitle(`${label} — ${slot.fileName || key}`, nextY() + 3 > bottomLimit - 20 ? addPage() : nextY(2));
      const seenCols = new Set();
      const physCols = [];
      for (const q of (slot.questions || [])) {
        const colKey = q.label || q.id;
        if (!seenCols.has(colKey)) {
          seenCols.add(colKey);
          physCols.push({
            label: colKey,
            rawMaxMarks: q.rawMaxMarks ?? q.maxMarks,
            cos: (slot.questions || []).filter((x) => (x.label || x.id) === colKey).map((x) => x.co),
          });
        }
      }
      const slotMax = physCols.reduce((s, c) => s + num(c.rawMaxMarks), 0);
      const weightage = key === "IA" ? evalPolicyRef.interimTest
        : key === "ESE" ? evalPolicyRef.endExam
        : evalPolicyRef.continuousEvaluation;
      table({
        startY: y,
        head: [["Attribute", "Value"]],
        body: [
          ["File Name",          slot.fileName || "-"],
          ["Number of Students", String(slot.students?.length || 0)],
          ["Number of Questions",String(physCols.length)],
          ["Total Maximum Marks",String(slotMax)],
          ["Weightage (%)",       tv(weightage)],
          ["COs Covered",        [...new Set(physCols.flatMap((c) => c.cos))].join(", ") || "-"],
        ],
        columnStyles: {
          0: { cellWidth: 55, fontStyle: "bold", fillColor: [240, 245, 252] },
          1: { cellWidth: innerW - 55 },
        },
      });
      if (physCols.length) {
        y = sectionTitle(`${key} — Question to CO Distribution`, nextY(4));
        table({
          startY: y,
          head: [["Question", "Max Marks", "Mapped CO(s)"]],
          body: physCols.map((c) => [c.label, tv(c.rawMaxMarks), c.cos.join(", ") || "-"]),
          columnStyles: {
            0: { cellWidth: 40, fontStyle: "bold" },
            1: { cellWidth: 28, halign: "center" },
            2: { cellWidth: innerW - 68 },
          },
        });
      }
    });
    } // end hasAnySlot

    // ── SECTION 6: Survey Responses ───────────────────────────────────────────
    if (courseData.attainmentModes?.indirect) {
      doc.addPage();
      drawBorder();
    y = sectionTitle("SECTION 6 — Survey Responses (Indirect Attainment)", M + 8);
    const survey = courseData.indirectSurvey || {};
    const surveyScale = survey.scale || { VH: 5, H: 4, M: 3, L: 2, VL: 1 };
    const surveyResponses = survey.responses || {};
    table({
      startY: y,
      head: [["Scale", "VH", "H", "M", "L", "VL"]],
      body: [["Score Weight", surveyScale.VH, surveyScale.H, surveyScale.M, surveyScale.L, surveyScale.VL]],
      styles: { halign: "center" },
      columnStyles: { 0: { cellWidth: 40, fontStyle: "bold", fillColor: [240, 245, 252] } },
    });
    y = sectionTitle("Survey Response Counts per CO", nextY(4));
    table({
      startY: y,
      head: [["CO", "CO Description", "VH", "H", "M", "L", "VL", "Total", "Grading Index"]],
      body: cos.map((co) => {
        const r = surveyResponses[co.id] || { VH: 0, H: 0, M: 0, L: 0, VL: 0 };
        const total = ["VH","H","M","L","VL"].reduce((s, k) => s + num(r[k]), 0);
        const gi = total > 0
          ? (["VH","H","M","L","VL"].reduce((s, k) => s + num(r[k]) * num(surveyScale[k]), 0) / total).toFixed(2)
          : "0.00";
        return [co.id, co.description || "-", r.VH ?? 0, r.H ?? 0, r.M ?? 0, r.L ?? 0, r.VL ?? 0, total, gi];
      }),
      styles: { halign: "center" },
      columnStyles: {
        0: { cellWidth: 13, fontStyle: "bold" },
        1: { cellWidth: 52, halign: "left" },
        2: { cellWidth: (innerW - 65) / 7, halign: "center" },
        3: { cellWidth: (innerW - 65) / 7, halign: "center" },
        4: { cellWidth: (innerW - 65) / 7, halign: "center" },
        5: { cellWidth: (innerW - 65) / 7, halign: "center" },
        6: { cellWidth: (innerW - 65) / 7, halign: "center" },
        7: { cellWidth: (innerW - 65) / 7, halign: "center" },
        8: { cellWidth: (innerW - 65) / 7, halign: "center" },
      },
    });
    } // end indirect survey

    // SECTION 7: Washington Accord Knowledge Mapping
    const coWks = courseData.wkMapping?.coWks;
    const hasWkData = coWks && cos.some((co) => WK_LIST.some((wk) => coWks[co.id]?.[wk.id]));
    if (hasWkData) {
      doc.addPage();
      drawBorder();
      y = sectionTitle("SECTION 7 — Washington Accord Knowledge (WK) Mapping", M + 8);
      const piRubricForWK = courseData.piRubric ?? { t1: 10, t2: 34, t3: 68 };

      // ── Compact shared options to keep all sub-tables on one page ──
      const sec7TableOpts = {
        pageBreak: "avoid",
        rowPageBreak: "avoid",
        styles: { fontSize: 6.5, cellPadding: 1.1 },
        headStyles: { fontSize: 6.5, cellPadding: 1.1 },
      };

      y = sectionTitle("PI Rubric Thresholds", y + 2);
      autoTable(doc, {
        ...sec7TableOpts,
        startY: y,
        margin: { left: innerX, right: innerX, top: M + 8, bottom: M + 11 },
        tableLineColor: [0, 0, 0],
        tableLineWidth: 0.2,
        styles: { ...sec7TableOpts.styles, lineColor: [0, 0, 0], lineWidth: 0.15, textColor: [0, 0, 0], overflow: "linebreak" },
        headStyles: { fillColor: HDR_COLOR, textColor: [255, 255, 255], fontStyle: "bold", ...sec7TableOpts.headStyles },
        alternateRowStyles: { fillColor: [245, 248, 252] },
        didDrawPage: () => drawBorder(),
        head: [["Rubric Level", "Threshold (% of Yes PIs)", "Meaning"]],
        body: [
          ["Level 1 (Low)",    `>= ${piRubricForWK.t1}%`, `X >= ${piRubricForWK.t1}% -> Mapping Value = 1`],
          ["Level 2 (Medium)", `>= ${piRubricForWK.t2}%`, `X >= ${piRubricForWK.t2}% -> Mapping Value = 2`],
          ["Level 3 (High)",   `>= ${piRubricForWK.t3}%`, `X >= ${piRubricForWK.t3}% -> Mapping Value = 3`],
          ["Not Mapped",       `< ${piRubricForWK.t1}%`,  `X < ${piRubricForWK.t1}% -> Shown as ( - )`],
        ],
        columnStyles: {
          0: { cellWidth: 35, fontStyle: "bold" },
          1: { cellWidth: 45, halign: "center" },
          2: { cellWidth: innerW - 80 },
        },
      });

      const wkIds = WK_LIST.filter((wk) => /^WK[1-9]$/.test(wk.id)).map((wk) => wk.id);
      const wkColW = Math.max(13, (innerW - 16) / Math.max(wkIds.length, 1));
      y = sectionTitle("CO vs WK Mapping Matrix (Faculty Entry)", (doc.lastAutoTable?.finalY ?? y) + 2);
      autoTable(doc, {
        ...sec7TableOpts,
        startY: y,
        margin: { left: innerX, right: innerX, top: M + 8, bottom: M + 11 },
        tableLineColor: [0, 0, 0],
        tableLineWidth: 0.2,
        styles: { ...sec7TableOpts.styles, halign: "center", lineColor: [0, 0, 0], lineWidth: 0.15, textColor: [0, 0, 0], overflow: "linebreak" },
        headStyles: { fillColor: HDR_COLOR, textColor: [255, 255, 255], fontStyle: "bold", ...sec7TableOpts.headStyles },
        alternateRowStyles: { fillColor: [245, 248, 252] },
        didDrawPage: () => drawBorder(),
        head: [["CO", ...wkIds]],
        body: cos.map((co) => [co.id, ...wkIds.map((wk) => (coWks[co.id]?.[wk] ? "Y" : "-"))]),
        columnStyles: {
          0: { cellWidth: 16, fontStyle: "bold", halign: "left" },
          ...Object.fromEntries(wkIds.map((_, i) => [i + 1, { cellWidth: wkColW }])),
        },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index > 0 && data.cell.raw === "Y") {
            data.cell.styles.fillColor = [212, 237, 218];
            data.cell.styles.textColor = [21, 87, 36];
            data.cell.styles.fontStyle = "bold";
          }
        },
      });

      y = sectionTitle("Washington Knowledge (WK) Indicators — Reference", (doc.lastAutoTable?.finalY ?? y) + 2);
      autoTable(doc, {
        ...sec7TableOpts,
        startY: y,
        margin: { left: innerX, right: innerX, top: M + 8, bottom: M + 11 },
        tableLineColor: [0, 0, 0],
        tableLineWidth: 0.2,
        styles: { ...sec7TableOpts.styles, lineColor: [0, 0, 0], lineWidth: 0.15, textColor: [0, 0, 0], overflow: "linebreak" },
        headStyles: { fillColor: HDR_COLOR, textColor: [255, 255, 255], fontStyle: "bold", ...sec7TableOpts.headStyles },
        alternateRowStyles: { fillColor: [245, 248, 252] },
        didDrawPage: () => drawBorder(),
        head: [["WK", "Description"]],
        body: WK_LIST.filter((wk) => /^WK[1-9]$/.test(wk.id)).map((wk) => [wk.id, wk.label]),
        columnStyles: {
          0: { cellWidth: 14, fontStyle: "bold", halign: "center" },
          1: { cellWidth: innerW - 14 },
        },
      });

      const coColW = 16;
      const poColW = Math.max(7.5, (innerW - coColW) / Math.max(pos.length, 1));
      const derivedMatrixBody = cos.map((co) => {
        const selectedWks = WK_LIST.filter((wk) => coWks[co.id]?.[wk.id]).map((wk) => wk.id);
        const derivedPOs = derivePOsFromWKs(selectedWks, courseData.psoWkMap);
        return [co.id, ...pos.map((po) => (derivedPOs.includes(po) ? String(report.mapping?.[co.id]?.[po] ?? 0) : "-"))];
      });
      const hasDerivedData = derivedMatrixBody.some((row) => row.slice(1).some((cell) => cell !== "-"));
      if (hasDerivedData) {
        doc.addPage();
        drawBorder();
        y = sectionTitle("SECTION 7b — WK-based CO-PO Derived Matrix", M + 8);
        table({
          startY: y,
          head: [["CO", ...pos]],
          body: derivedMatrixBody,
          styles: { halign: "center", fontSize: 7.1, cellPadding: 1.35 },
          columnStyles: {
            0: { cellWidth: coColW, fontStyle: "bold", halign: "left" },
            ...Object.fromEntries(pos.map((_, i) => [i + 1, { cellWidth: poColW }])),
          },
        });
      }
    }

    // SECTION 8: Performance Indicator Entry
    const coWks2 = courseData.wkMapping?.coWks;
    const piAnswers = courseData.wkMapping?.piAnswers;
    const piRubric = courseData.piRubric ?? { t1: 10, t2: 34, t3: 68 };
    if (piAnswers && coWks2) {
      const activePOsWithConn = Object.keys(PO_COMPETENCIES).filter((po) =>
        pos.includes(po) &&
        cos.some((co) => {
          const wks = WK_LIST.filter((wk) => coWks2[co.id]?.[wk.id]).map((wk) => wk.id);
          return derivePOsFromWKs(wks, courseData.psoWkMap).includes(po);
        })
      );
      if (activePOsWithConn.length) {
        doc.addPage();
        drawBorder();
        y = sectionTitle("SECTION 8 - Performance Indicator Entry (PO by PO)", M + 8);

        // Rubric legend row
        doc.setFillColor(240, 245, 252);
        doc.rect(innerX, y, innerW, 6, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(60, 80, 100);
        doc.text(
          `Rubric: L1 (>=${piRubric.t1}% Yes) = 1  |  L2 (>=${piRubric.t2}% Yes) = 2  |  L3 (>=${piRubric.t3}% Yes) = 3  |  Below ${piRubric.t1}% = Not Mapped `,
          innerX + 3, y + 4
        );
        doc.setTextColor(0, 0, 0);
        y += 8;

        for (const po of activePOsWithConn) {
          const competencies = PO_COMPETENCIES[po] || [];
          const allPIs = competencies.flatMap((c) => c.pis);
          const connectedCos = cos.filter((co) => {
            const wks = WK_LIST.filter((wk) => coWks2[co.id]?.[wk.id]).map((wk) => wk.id);
            return derivePOsFromWKs(wks, courseData.psoWkMap).includes(po);
          });
          if (!connectedCos.length || !allPIs.length) continue;
          if (y + 24 > bottomLimit) y = addPage();

          // PO header bar
          doc.setFillColor(15, 56, 96);
          doc.rect(innerX, y, innerW, 8, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(255, 255, 255);
          doc.text(`${po}  -  ${NBA_POS.find((p) => p.id === po)?.label || ""}`, innerX + 3, y + 5.5);
          doc.setTextColor(0, 0, 0);
          y += 10;

          // CO summary info row
          const coStats = connectedCos.map((co) => {
            const answers = piAnswers[co.id]?.[po] || {};
            const { x, value } = computeMappingValue(answers, competencies, piRubric);
            return { co: co.id, x, value };
          });
          doc.setFillColor(225, 235, 245);
          doc.rect(innerX, y, innerW, 6, "F");
          doc.setDrawColor(180, 200, 220);
          doc.setLineWidth(0.15);
          doc.rect(innerX, y, innerW, 6);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6.5);
          doc.setTextColor(30, 50, 80);
          const summaryParts = coStats.map(({ co, x, value }) =>
            `${co}: ${allPIs.filter((pi) => piAnswers[co]?.[po]?.[pi.id]).length} / ${allPIs.length} Yes  (X = ${x.toFixed(1)}%)   Mapping = ${value != null ? value : "\xe2\x80\x94"}`
          );
          doc.text(`Connected COs:  ${summaryParts.join("     ")}`, innerX + 3, y + 4);
          doc.setTextColor(0, 0, 0);
          y += 8;

          // Build PI table body with competency group header rows
          const coColWidth = Math.max(14, Math.min(20, (innerW - 14 - 24 - 70) / Math.max(connectedCos.length, 1)));
          const piDescW = innerW - 14 - 24 - coColWidth * connectedCos.length;
          const piHead = [["Comp. ID", "PI ID", "Performance Indicator Description", ...connectedCos.map((co) => co.id)]];
          const piBody = [];

          competencies.forEach((comp) => {
            // Competency group header row
            piBody.push([
              { content: `${comp.id}   ${comp.label}`, colSpan: 3 + connectedCos.length, styles: { fontStyle: "bold", fillColor: [220, 230, 245], textColor: [15, 56, 96], fontSize: 7 } },
            ]);
            (comp.pis || []).forEach((pi) => {
              if (!pi?.id) return;
              piBody.push([
                pi.id.split(".").slice(0, 2).join("."),
                pi.id,
                pi.label || "-",
                ...connectedCos.map((co) => (piAnswers[co.id]?.[po]?.[pi.id] === true) ? "Yes" : "No"),
              ]);
            });
          });

          // Summary rows
          piBody.push([
            { content: "X = (Yes PIs / Total PIs) \xc3\x97 100", colSpan: 3, styles: { fontStyle: "bold", fillColor: [210, 225, 242], textColor: [15, 56, 96], halign: "right" } },
            ...coStats.map(({ x }) => ({ content: `${x.toFixed(1)}%`, styles: { fontStyle: "bold", fillColor: [210, 225, 242], textColor: [15, 56, 96], halign: "center" } })),
          ]);
          piBody.push([
            { content: "Mapping Value (Rubric Result)", colSpan: 3, styles: { fontStyle: "bold", fillColor: [195, 215, 240], textColor: [10, 40, 80], halign: "right" } },
            ...coStats.map(({ value }) => ({
              content: value != null ? String(value) :"\xe2\x80\x94",
              styles: { fontStyle: "bold", fontSize: 9, fillColor: [195, 215, 240], textColor: value != null ? [21, 87, 36] : [114, 28, 36], halign: "center" },
            })),
          ]);

          autoTable(doc, {
            startY: y,
            head: piHead,
            body: piBody,
            margin: { left: innerX, right: innerX, top: M + 8, bottom: M + 11 },
            pageBreak: "auto",
            rowPageBreak: "avoid",
            showHead: "everyPage",
            tableLineColor: [0, 0, 0],
            tableLineWidth: 0.2,
            styles: { fontSize: 7, cellPadding: 1.4, lineColor: [180, 200, 220], lineWidth: 0.15, textColor: [20, 20, 20], overflow: "linebreak" },
            headStyles: { fillColor: [30, 80, 140], fontSize: 7.5, textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
            alternateRowStyles: { fillColor: [248, 251, 255] },
            didDrawPage: () => drawBorder(),
            columnStyles: {
              0: { cellWidth: 14, halign: "center", fontStyle: "bold", fillColor: [240, 245, 252] },
              1: { cellWidth: 24, halign: "center" },
              2: { cellWidth: piDescW },
              ...Object.fromEntries(connectedCos.map((_, i) => [i + 3, { cellWidth: coColWidth, halign: "center", fontStyle: "bold" }])),
            },
            didParseCell: (data) => {
              if (data.section === "body" && data.column.index >= 3 && typeof data.cell.raw === "string") {
                const val = data.cell.raw;
                if (val === "Yes") {
                  data.cell.styles.fillColor = [212, 237, 218];
                  data.cell.styles.textColor = [21, 87, 36];
                  data.cell.styles.fontStyle = "bold";
                } else if (val === "No") {
                  data.cell.styles.fillColor = [255, 235, 235];
                  data.cell.styles.textColor = [114, 28, 36];
                }
              }
            },
          });
          y = (doc.lastAutoTable?.finalY ?? y) + 6;
        }
      }
    }

    // SECTION 9: CO to SDG Mapping
    if (y + 40 > bottomLimit) { doc.addPage(); drawBorder(); y = M + 8; }
    else { y += 5; }
    y = sectionTitle("SECTION 9 — CO to SDG Mapping", y);
    table({
      startY: y,
      head: [["CO", "CO Statement", "Mapped SDGs", "Bloom's Level"]],
      body: cos.map((co) => [
        co.id,
        co.description || "-",
        (co.sdgs || []).join(", ") || "-",
        (Array.isArray(co.blooms) ? co.blooms : []).join(", ") || "-",
      ]),
      columnStyles: {
        0: { cellWidth: 14, fontStyle: "bold", halign: "center" },
        1: { cellWidth: 60 },
        2: { cellWidth: 36 },
        3: { cellWidth: innerW - 110 },
      },
    });

    const sdgRows = SDG_LIST.map((sdg) => {
      const sdgId = sdg.split(":")[0];
      const relCOs = cos.filter((co) => (co.sdgs || []).some((s) => s.toUpperCase() === sdgId));
      if (!relCOs.length) return null;
      const relPOs = pos.filter((po) => relCOs.some((co) => num(report.mapping?.[co.id]?.[po]) > 0));
      const avgScore = relCOs.reduce((sum, co) => {
        const r = (report.coResults || []).find((x) => x.co === co.id);
        return sum + num(r?.score);
      }, 0) / relCOs.length;
      return [sdg, relCOs.map((c) => c.id).join(", "), relPOs.join(", ") || "-", levelText(avgScore)];
    }).filter(Boolean);

    if (sdgRows.length) {
      y = sectionTitle("SECTION 9b — SDG Impact Analysis", nextY(4));
      table({
        startY: y,
        head: [["Mapped SDG", "Related COs", "Related POs", "Contribution Level"]],
        body: sdgRows,
        columnStyles: {
          0: { cellWidth: 52 },
          1: { cellWidth: 28, halign: "center" },
          2: { cellWidth: 36 },
          3: { cellWidth: innerW - 116, halign: "center" },
        },
      });
    }

    // SECTION 10: CO Attainment Summary (Direct)
    const validCOResults = (report.coResults || []).filter((r) => num(r.maxMarks) > 0);
    const achievedCOs = validCOResults.filter((r) => num(r.attainmentPercentage) >= num(r.target)).map((r) => r.co);
    const lowCOs = validCOResults.filter((r) => num(r.attainmentPercentage) < num(r.target)).map((r) => r.co);
    doc.addPage();
    drawBorder();
    y = sectionTitle("SECTION 10 — CO Attainment Summary (Direct)", M + 8);
    table({
      startY: y,
      head: [["CO", "CO Description", "Target %", "Achieved %", "Level", "Status"]],
      body: validCOResults.map((r) => {
        const achieved = num(r.attainmentPercentage) >= num(r.target);
        const coDesc = cos.find((c) => c.id === r.co)?.description || "-";
        return [r.co, coDesc, pct(r.target), pct(r.attainmentPercentage), tv(r.score), achieved ? "Achieved" : "Not Achieved"];
      }),
      styles: { halign: "center" },
      columnStyles: {
        0: { cellWidth: 13, fontStyle: "bold", halign: "center" },
        1: { cellWidth: 55, halign: "left" },
        2: { cellWidth: 22, halign: "center" },
        3: { cellWidth: 24, halign: "center" },
        4: { cellWidth: 18, halign: "center" },
        5: { cellWidth: innerW - 132, halign: "center" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 5) {
          const val = data.cell.raw;
          data.cell.styles.fillColor = val === "Achieved" ? [212, 237, 218] : [255, 220, 220];
          data.cell.styles.textColor = val === "Achieved" ? [21, 87, 36] : [114, 28, 36];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    // SECTION 11: Indirect Attainment Summary
    if (courseData.attainmentModes?.indirect && report.indirect?.coResults?.length) {
      doc.addPage();
      drawBorder();
      y = sectionTitle("SECTION 11 — Indirect Attainment Summary", M + 8);
      table({
        startY: y,
        head: [["CO", "VH", "H", "M", "L", "VL", "Total", "Grading Index", "Score"]],
        body: report.indirect.coResults.map((r) => [
          r.co,
          r.counts?.VH ?? 0, r.counts?.H ?? 0, r.counts?.M ?? 0,
          r.counts?.L ?? 0, r.counts?.VL ?? 0,
          r.total, r.gradingIndex, r.score,
        ]),
        styles: { halign: "center", fontSize: 7.5 },
        columnStyles: { 0: { cellWidth: 14, fontStyle: "bold" } },
      });
    }

    // SECTION 12: Overall CO Attainment
    doc.addPage();
    drawBorder();
    y = sectionTitle("SECTION 12 — Overall CO Attainment", M + 8);
    table({
      startY: y,
      head: [["CO", "CO Description", "Direct Att.", "Indirect Att.", "Final Att.", "Target %", "Status"]],
      body: validCOResults.map((r) => {
        const coDesc = cos.find((c) => c.id === r.co)?.description || "-";
        const directAtt = tv(r.directAttainment ?? r.score);
        const indirectAtt = tv(report.indirect?.coResults?.find((x) => x.co === r.co)?.score);
        const finalAtt = tv(r.score);
        const achieved = num(r.attainmentPercentage) >= num(r.target);
        return [r.co, coDesc, directAtt, indirectAtt, finalAtt, pct(r.target), achieved ? "Achieved" : "Not Achieved"];
      }),
      styles: { halign: "center" },
      columnStyles: {
        0: { cellWidth: 13, fontStyle: "bold", halign: "center" },
        1: { cellWidth: 50, halign: "left" },
        2: { cellWidth: 20, halign: "center" },
        3: { cellWidth: 22, halign: "center" },
        4: { cellWidth: 20, halign: "center" },
        5: { cellWidth: 20, halign: "center" },
        6: { cellWidth: innerW - 145, halign: "center" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 6) {
          const val = data.cell.raw;
          data.cell.styles.fillColor = val === "Achieved" ? [212, 237, 218] : [255, 220, 220];
          data.cell.styles.textColor = val === "Achieved" ? [21, 87, 36] : [114, 28, 36];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    // SECTION 13: CO-PO Mapping Matrix
    doc.addPage();
    drawBorder();
    y = sectionTitle("SECTION 13 — CO-PO Mapping Matrix", M + 8);
    const mapCoColW = 16;
    const mapPoColW = Math.max(7.5, (innerW - mapCoColW) / Math.max(pos.length, 1));
    table({
      startY: y,
      head: [["CO", ...pos]],
      body: cos.map((co) => [
        co.id,
        ...pos.map((po) => {
          const value = report.mapping?.[co.id]?.[po] ?? 0;
          return value === 0 ? "-" : String(value);
        }),
      ]),
      styles: { halign: "center", fontSize: 7.1, cellPadding: 1.35 },
      columnStyles: {
        0: { cellWidth: mapCoColW, fontStyle: "bold", halign: "left" },
        ...Object.fromEntries(pos.map((_, i) => [i + 1, { cellWidth: mapPoColW }])),
      },
    });

    // SECTION 14: CO-PSO Mapping Matrix
    const psoList = (courseData.psoConfig || []).map((p) => p.id);
    if (psoList.length) {
      doc.addPage();
      drawBorder();
      y = sectionTitle("SECTION 14 — CO-PSO Mapping Matrix", M + 8);
      const psoColW = Math.max(14, (innerW - 18) / Math.max(psoList.length, 1));
      table({
        startY: y,
        head: [["CO", ...psoList]],
        body: cos.map((co) => [
          co.id,
          ...psoList.map((pso) => {
            const val = report.mapping?.[co.id]?.[pso] ?? 0;
            return val === 0 ? "-" : String(val);
          }),
        ]),
        styles: { halign: "center", fontSize: 7.5 },
        columnStyles: {
          0: { cellWidth: 18, fontStyle: "bold", halign: "left" },
          ...Object.fromEntries(psoList.map((_, i) => [i + 1, { cellWidth: psoColW }])),
        },
      });
    }

    // SECTION 15: PO Attainment
    doc.addPage();
    drawBorder();
    y = sectionTitle("SECTION 15 — PO Attainment", M + 8);
    table({
      startY: y,
      head: [["PO", "PO Label", "Mapped COs", "Attainment %", "Level", "Remarks"]],
      body: pos.filter((p) => !p.startsWith("PSO")).map((po) => {
        const mappedCOs = cos.filter((co) => num(report.mapping?.[co.id]?.[po]) > 0).map((co) => co.id);
        const score = report.poScores?.[po] ?? 0;
        return [
          po,
          NBA_POS.find((p) => p.id === po)?.label || "-",
          mappedCOs.join(", ") || "-",
          poPercent(score),
          tv(score),
          mappedCOs.length ? levelText(score) : "No mapping",
        ];
      }),
      columnStyles: {
        0: { cellWidth: 14, fontStyle: "bold", halign: "center" },
        1: { cellWidth: 48 },
        2: { cellWidth: 30 },
        3: { cellWidth: 24, halign: "center" },
        4: { cellWidth: 16, halign: "center" },
        5: { cellWidth: innerW - 132 },
      },
    });

    // SECTION 16: PSO Attainment
    if (psoList.length) {
      doc.addPage();
      drawBorder();
      y = sectionTitle("SECTION 16 — PSO Attainment", M + 8);
      table({
        startY: y,
        head: [["PSO", "PSO Description", "Mapped COs", "Attainment %", "Level"]],
        body: (courseData.psoConfig || []).map((pso) => {
          const mappedCOs = cos.filter((co) => num(report.mapping?.[co.id]?.[pso.id]) > 0).map((co) => co.id);
          const score = report.poScores?.[pso.id] ?? 0;
          return [pso.id, pso.label || "-", mappedCOs.join(", ") || "-", poPercent(score), levelText(score)];
        }),
        columnStyles: {
          0: { cellWidth: 18, fontStyle: "bold", halign: "center" },
          1: { cellWidth: 65 },
          2: { cellWidth: 32 },
          3: { cellWidth: 26, halign: "center" },
          4: { cellWidth: innerW - 141, halign: "center" },
        },
      });
    }

    // SECTION 17: Graphical Analytics
    function drawBarChart(opts) {
      let cy = opts.y;
      if (cy + 55 > bottomLimit) cy = addPage();
      cy = sectionTitle(opts.title, cy);
      const chartH = 38;
      const chartX = innerX + 2;
      const chartW = innerW - 4;
      const bars = opts.data.filter((d) => d[opts.labelKey]);
      if (!bars.length) return cy + 4;
      const barW = Math.min(18, (chartW - 10) / bars.length - 2);
      const gap = (chartW - 10 - bars.length * barW) / Math.max(bars.length - 1, 1);
      const maxVal = opts.maxValue || Math.max(...bars.map((d) => num(d[opts.valueKey])), 1);
      doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.2);
      doc.line(chartX + 8, cy, chartX + 8, cy + chartH);
      doc.line(chartX + 8, cy + chartH, chartX + chartW, cy + chartH);
      doc.setFont("helvetica", "normal"); doc.setFontSize(5.5); doc.setTextColor(120, 120, 120);
      [0, 25, 50, 75, 100].forEach((tick) => {
        const ty = cy + chartH - (tick / maxVal) * chartH;
        if (ty >= cy && ty <= cy + chartH) {
          doc.text(String(tick), chartX + 6, ty + 0.8, { align: "right" });
          doc.setDrawColor(220, 220, 220);
          doc.line(chartX + 8, ty, chartX + chartW, ty);
        }
      });
      bars.forEach((d, i) => {
        const val = Math.min(num(d[opts.valueKey]), maxVal);
        const bh = maxVal > 0 ? (val / maxVal) * chartH : 0;
        const bx = chartX + 10 + i * (barW + gap);
        const by = cy + chartH - bh;
        const [r, g, b] = opts.color || [42, 157, 143];
        doc.setFillColor(r, g, b);
        if (bh > 0) doc.rect(bx, by, barW, bh, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(5); doc.setTextColor(60, 60, 60);
        if (bh > 0) doc.text(String(Math.round(val)), bx + barW / 2, by - 1, { align: "center" });
        doc.setFont("helvetica", "normal"); doc.setFontSize(5.5); doc.setTextColor(60, 60, 60);
        doc.text(String(d[opts.labelKey]), bx + barW / 2, cy + chartH + 4, { align: "center", maxWidth: barW + gap });
      });
      doc.setTextColor(0, 0, 0);
      return cy + chartH + 10;
    }

    function drawGroupedBarChart(opts) {
      let cy = opts.y;
      if (cy + 55 > bottomLimit) cy = addPage();
      cy = sectionTitle(opts.title, cy);
      const chartH = 38;
      const chartX = innerX + 2;
      const chartW = innerW - 4;
      const bars = opts.data.filter((d) => d[opts.labelKey]);
      if (!bars.length) return cy + 4;
      const groupW = (chartW - 10) / bars.length;
      const singleW = Math.min(10, groupW / opts.keys.length - 1);
      const maxVal = opts.maxValue || Math.max(...bars.flatMap((d) => opts.keys.map((k) => num(d[k]))), 1);
      doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.2);
      doc.line(chartX + 8, cy, chartX + 8, cy + chartH);
      doc.line(chartX + 8, cy + chartH, chartX + chartW, cy + chartH);
      doc.setFont("helvetica", "normal"); doc.setFontSize(5.5); doc.setTextColor(120, 120, 120);
      [0, 25, 50, 75, 100].forEach((tick) => {
        const ty = cy + chartH - (tick / maxVal) * chartH;
        if (ty >= cy && ty <= cy + chartH) {
          doc.text(String(tick), chartX + 6, ty + 0.8, { align: "right" });
          doc.setDrawColor(220, 220, 220);
          doc.line(chartX + 8, ty, chartX + chartW, ty);
        }
      });
      bars.forEach((d, gi) => {
        const gx = chartX + 10 + gi * groupW;
        opts.keys.forEach((k, ki) => {
          const val = Math.min(num(d[k]), maxVal);
          const bh = maxVal > 0 ? (val / maxVal) * chartH : 0;
          const bx = gx + ki * (singleW + 1);
          const by = cy + chartH - bh;
          const [r, g, b] = opts.colors[ki] || [100, 100, 200];
          doc.setFillColor(r, g, b);
          if (bh > 0) doc.rect(bx, by, singleW, bh, "F");
        });
        doc.setFont("helvetica", "normal"); doc.setFontSize(5.5); doc.setTextColor(60, 60, 60);
        doc.text(String(d[opts.labelKey]), gx + (opts.keys.length * (singleW + 1)) / 2, cy + chartH + 4, { align: "center" });
      });
      let lx = chartX + 10;
      opts.keys.forEach((k, ki) => {
        const [r, g, b] = opts.colors[ki] || [100, 100, 200];
        doc.setFillColor(r, g, b);
        doc.rect(lx, cy + chartH + 7, 4, 3, "F");
        doc.setFont("helvetica", "normal"); doc.setFontSize(5.5); doc.setTextColor(60, 60, 60);
        doc.text(k, lx + 5, cy + chartH + 9.5);
        lx += 22;
      });
      doc.setTextColor(0, 0, 0);
      return cy + chartH + 16;
    }

    doc.addPage();
    drawBorder();
    y = sectionTitle("SECTION 17 — Graphical Analytics", M + 8);

    const coChartData = validCOResults.map((r) => ({ co: r.co, Target: num(r.target), Achieved: num(r.attainmentPercentage) }));
    y = drawGroupedBarChart({ title: "CO Attainment — Target vs Achieved (%)", data: coChartData, labelKey: "co", keys: ["Target", "Achieved"], colors: [[233, 166, 58], [42, 157, 143]], maxValue: 100, y });

    const poChartData = pos.map((po) => ({ po, attainment: Math.round((Math.min(3, Math.max(0, num(report.poScores?.[po]))) / 3) * 100) }));
    y = drawBarChart({ title: "PO Attainment (%)", data: poChartData, labelKey: "po", valueKey: "attainment", maxValue: 100, color: [34, 87, 122], y });

    const assessmentChartData = (report.assessments || []).map((a) => {
      const physCols = []; const seen = new Set();
      for (const q of (a.questions || [])) { const key = q.label || q.id; if (!seen.has(key)) { seen.add(key); physCols.push(q); } }
      const maxM = physCols.reduce((s, c) => s + num(c.rawMaxMarks ?? c.maxMarks), 0);
      const totals = (report.students || []).map((st) => physCols.reduce((s, c) => s + Math.round(num((st.rawMarks || st.marks || {})[c.id]) * (c.splitCount || 1) * 100) / 100, 0));
      const avg = totals.length ? totals.reduce((x, v) => x + v, 0) / totals.length : 0;
      return { name: a.name || a.id, averagePercent: Math.round(maxM ? (avg / maxM) * 100 * 100 : 0) / 100 };
    });
    y = drawBarChart({ title: "Assessment Performance — Average % per Assessment", data: assessmentChartData, labelKey: "name", valueKey: "averagePercent", maxValue: 100, color: [109, 93, 252], y });

    const allPhysCols = []; const seenAll = new Set();
    for (const a of (report.assessments || [])) {
      for (const q of (a.questions || [])) {
        const key = `${a.id}|||${q.label || q.id}`;
        if (!seenAll.has(key)) { seenAll.add(key); allPhysCols.push(q); }
      }
    }
    const totalMax = allPhysCols.reduce((s, c) => s + num(c.rawMaxMarks ?? c.maxMarks), 0);
    const buckets = ["0-39","40-49","50-59","60-69","70-84","85-100"].map((range) => ({ range, count: 0 }));
    (report.students || []).forEach((st) => {
      const tot = allPhysCols.reduce((s, c) => s + Math.round(num((st.rawMarks || st.marks || {})[c.id]) * (c.splitCount || 1) * 100) / 100, 0);
      const p2 = totalMax ? (tot / totalMax) * 100 : 0;
      const idx = p2 >= 85 ? 5 : p2 >= 70 ? 4 : p2 >= 60 ? 3 : p2 >= 50 ? 2 : p2 >= 40 ? 1 : 0;
      buckets[idx].count += 1;
    });
    y = drawBarChart({ title: "Mark Distribution — Students per Score Range", data: buckets, labelKey: "range", valueKey: "count", maxValue: Math.max(...buckets.map((b) => b.count), 1), color: [138, 203, 74], y });

    // SECTION 18: Final Summary & Remarks
    doc.addPage();
    drawBorder();
    y = sectionTitle("SECTION 18 — Final Summary & Remarks", M + 8);
    const avgCO = report.summary?.averageCOScore ?? 0;
    const avgPO = report.summary?.averagePOScore ?? 0;
    const totalStudents = report.summary?.totalStudents ?? (report.students?.length ?? 0);
    const numCOs = validCOResults.length;
    const numPOs = pos.filter((p) => !p.startsWith("PSO")).length;
    const numPSOs = (courseData.psoConfig?.length ?? 0);
    const achievedCount = validCOResults.filter((r) => num(r.attainmentPercentage) >= num(r.target)).length;
    table({
      startY: y,
      head: [["Summary Item", "Value"]],
      body: [
        ["Total Students",         String(totalStudents)],
        ["Number of COs",          String(numCOs)],
        ["Number of POs",          String(numPOs)],
        ["Number of PSOs",         String(numPSOs)],
        ["Average CO Attainment",  num(avgCO).toFixed(2)],
        ["Average PO Attainment",  num(avgPO).toFixed(2)],
        ["COs Achieved Target",    `${achievedCount} / ${numCOs}`],
        ["COs Not Achieved",       `${numCOs - achievedCount} / ${numCOs}`],
        ["Overall Status",         num(avgCO) >= 2 ? "Satisfactory" : "Needs Improvement"],
      ],
      columnStyles: {
        0: { cellWidth: 65, fontStyle: "bold", fillColor: [240, 245, 252] },
        1: { cellWidth: innerW - 65 },
      },
    });
    y = sectionTitle("Remarks", nextY(3));
    table({
      startY: y,
      head: [["Observation"]],
      body: [
        [achievedCOs.length ? `${achievedCOs.join(", ")} achieved the expected target level.` : "No CO achieved the expected target level."],
        [lowCOs.length ? `${lowCOs.join(", ")} require improvement and additional learning support.` : "All COs meet the target level."],
        [num(avgCO) >= 2 ? "Overall course attainment is satisfactory." : "Overall course attainment needs focused improvement."],
      ],
      styles: { fontSize: 8.5 },
      columnStyles: { 0: { cellWidth: innerW } },
    });

    // Footer: page numbers (cover = page 1, ToC = page 2, content starts page 3)
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p += 1) {
      doc.setPage(p);
      drawBorder();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      if (p === 1) {
        doc.text("NBA Accreditation Support System — OBE Report", pageW / 2, pageH - M + 4, { align: "center" });
      } else {
        doc.text(
          `${tv(course.courseName)} | ${tv(course.courseCode)} | Faculty: ${tv(course.faculty)}`,
          innerX, pageH - M + 4, { maxWidth: innerW - 28 }
        );
        const label = p === 2 ? "Table of Contents" : `Page ${p - 2} of ${totalPages - 2}`;
        doc.text(label, pageW - innerX, pageH - M + 4, { align: "right" });
      }
      doc.setTextColor(0, 0, 0);
    }

    doc.save(`Attainment_Report_${course.courseCode || "report"}.pdf`);
  }
  
  return (
    <div>
      <header className="topbar">
        <div>
          <p className="eyebrow">Step 7</p>
          <h1>Export Report</h1>
        </div>
        <button className="secondary" onClick={() => navigate("/report")}>Back to Report</button>
      </header>
      <div className="panel wide">
        <div className="panel-title"><h2>Course: {course.courseName || "-"}</h2></div>
        <div className="export-card-grid">
          {[
            ["CO Attainment (CSV)", "CO-wise attainment scores", exportCOCSV, "var(--teal)"],
            ["PO Attainment (CSV)", "PO-wise attainment scores", exportPOCSV, "var(--teal)"],
            ["CO-PO Mapping (CSV)", "CO-PO correlation matrix", exportMappingCSV, "var(--teal)"],
            ["Full Report (PDF)", "Complete accreditation report as PDF", exportFullPDF, "var(--blue)"],
          ].map(([title, desc, fn, color]) => (
            <div key={title} className="workflow-card" style={{ borderTopColor: color }}>
              <h2 style={{ fontSize: 16 }}>{title}</h2>
              <p>{desc}</p>
              <button onClick={fn} style={{ background: color }}>Download</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}