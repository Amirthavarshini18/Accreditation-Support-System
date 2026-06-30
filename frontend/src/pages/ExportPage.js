import React from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useApp } from "../AppContext";
import { SCALE_LABELS, GRADING_POLICY } from "../constants";

function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Convert image to base64 data URL using fetch (avoids canvas CORS issues)
function loadImageAsDataURL(src) {
  return new Promise((resolve, reject) => {
    fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      })
      .catch(reject);
  });
}

export default function ExportPage() {
  const { courseData, report } = useApp();
  const navigate = useNavigate();

  if (!report) {
    return (
      <div>
        <header className="topbar">
          <div><p className="eyebrow">Step 7</p><h1>Export Report</h1></div>
          <button className="secondary" onClick={() => navigate("/report")}>← Back to Report</button>
        </header>
        <div className="panel wide" style={{ textAlign: "center", padding: "48px 0" }}>
          <p style={{ color: "var(--muted)" }}>No report generated yet. Please calculate attainment first.</p>
          <button onClick={() => navigate("/report")} style={{ marginTop: 16 }}>Go to Report</button>
        </div>
      </div>
    );
  }

  const course = report.course || courseData.course || {};

  function exportCOCSV() {
    const header = ["CO", "Description", "Target %", "Students Attained", "Total Students", "% Attained", "Score"];
    const rows = (report.coResults || []).map((r) => [
      r.co, r.description || "", r.target, r.studentsAttained, r.totalStudents, r.attainmentPercentage, r.score,
    ]);
    downloadCSV(`CO_Attainment_${course.courseCode || "report"}.csv`, [header, ...rows]);
  }

  function exportPOCSV() {
    const header = ["PO", "Direct Score", "Indirect Score", "Final Score"];
    const rows = courseData.pos.map((po) => [
      po,
      report.directPoScores?.[po] ?? "—",
      report.indirect?.poScores?.[po] ?? "—",
      report.poScores?.[po] ?? "—",
    ]);
    downloadCSV(`PO_Attainment_${course.courseCode || "report"}.csv`, [header, ...rows]);
  }

  function exportMappingCSV() {
    const header = ["CO", ...courseData.pos];
    const rows = courseData.cos.map((co) => [
      co.id,
      ...courseData.pos.map((po) => report.mapping?.[co.id]?.[po] ?? 0),
    ]);
    downloadCSV(`CO_PO_Mapping_${course.courseCode || "report"}.csv`, [header, ...rows]);
  }

  function exportStudentMarksCSV() {
    const questions = courseData.assessments.flatMap((a) => a.questions);
    const header = ["Sl.", "Roll No.", "Name", "Section", ...questions.map((q) => `${q.label || q.id}(${q.co})`), "Total"];
    const rows = courseData.students.map((s, i) => {
      const marks = questions.map((q) => s.rawMarks?.[q.id] ?? s.marks?.[q.id] ?? 0);
      const total = marks.reduce((a, b) => a + Number(b), 0);
      return [i + 1, s.registerNumber, s.name, s.section, ...marks, total];
    });
    downloadCSV(`Student_Marks_${course.courseCode || "report"}.csv`, [header, ...rows]);
  }

  async function exportFullPDF() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();   // 210
    const pageH = doc.internal.pageSize.getHeight();  // 297
    const ML = 14;   // left margin
    const MR = 14;   // right margin
    const TW = pageW - ML - MR;  // usable width = 182

    // Helper: section heading
    function sectionHeading(label, y) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(20, 60, 140);
      doc.setFillColor(235, 242, 255);
      doc.rect(ML, y - 4, TW, 7, "F");
      doc.text(label, ML + 2, y + 1);
      doc.setTextColor(0, 0, 0);
      return y + 8;
    }

    // Helper: ensure space on current page, else add new page
    function ensureSpace(y, needed) {
      if (y + needed > pageH - 16) {
        doc.addPage();
        return 15;
      }
      return y;
    }

    let Y = 14;

    // ── HEADER ──────────────────────────────────────────────────
    const LOGO_W = 24;
    const LOGO_H = 24;
    let logoOk = false;
    try {
      const dataURL = await loadImageAsDataURL("/college_logo.png");
      if (dataURL && dataURL.startsWith("data:")) {
        doc.addImage(dataURL, "PNG", ML, Y, LOGO_W, LOGO_H);
        logoOk = true;
      }
    } catch (e) { console.warn("Logo:", e); }

    const txtX = logoOk ? ML + LOGO_W + 5 : ML;
    const txtW = pageW - txtX - MR;

    doc.setDrawColor(20, 60, 140);
    doc.setLineWidth(0.6);
    doc.line(ML, Y - 1, pageW - MR, Y - 1);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(20, 60, 140);
    doc.text("National Institute of Technology Calicut", txtX, Y + 6, { maxWidth: txtW });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const deptText = course.specialization
      ? `Department of ${course.specialization}`
      : "Department of Computer Science and Engineering";
    doc.text(deptText, txtX, Y + 13, { maxWidth: txtW });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text("CO-PO Attainment Report", txtX, Y + 19, { maxWidth: txtW });

    Y = Y + Math.max(LOGO_H, 22) + 3;

    doc.setDrawColor(20, 60, 140);
    doc.setLineWidth(0.6);
    doc.line(ML, Y, pageW - MR, Y);
    doc.setTextColor(0, 0, 0);
    Y += 7;

    // ── COURSE INFORMATION ───────────────────────────────────────
    Y = sectionHeading("1. Course Information", Y);

    const courseRows = [
      ["Course Name", course.courseName || "—"],
      ["Course Code", course.courseCode || "—"],
      ["Programme", course.programme || "—"],
      ["Specialization / Department", course.specialization || "—"],
      ["Academic Year", course.academicYear || "—"],
      ["Semester", course.semester || "—"],
      ["Course Year", course.courseYear || "—"],
      ["Course Semester", course.courseSemester || "—"],
      ["Credits", course.credits || "—"],
      ["Faculty Name", course.faculty || "—"],
    ].filter(([, v]) => v && v !== "—");

    autoTable(doc, {
      startY: Y,
      body: courseRows,
      styles: { fontSize: 9, cellPadding: 2.5 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 60, fillColor: [245, 247, 250] },
        1: { cellWidth: TW - 60 },
      },
      theme: "grid",
      margin: { left: ML, right: MR },
    });
    Y = doc.lastAutoTable.finalY + 8;

    // ── EVALUATION POLICY ─────────────────────────────────────
    Y = ensureSpace(Y, 50);
    Y = sectionHeading("2. Evaluation Policy", Y);

    autoTable(doc, {
      startY: Y,
      head: [["Component", "Weightage (%)"]],
      body: [
        ["Internal Assessment (IA)", courseData.evaluationPolicy.interimTest],
        ["End Semester Examination (ESE)", courseData.evaluationPolicy.endExam],
        ["Continuous Assessment (CA)", courseData.evaluationPolicy.continuousEvaluation],
        ["Other", courseData.evaluationPolicy.other || 0],
      ],
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold", fontSize: 9 },
      columnStyles: { 0: { cellWidth: 120 }, 1: { halign: "center", cellWidth: TW - 120 } },
      theme: "grid",
      margin: { left: ML, right: MR },
    });
    Y = doc.lastAutoTable.finalY + 8;

    // ── GRADING POLICY ────────────────────────────────────────
    Y = ensureSpace(Y, 70);
    Y = sectionHeading("3. Grading Policy", Y);

    autoTable(doc, {
      startY: Y,
      head: [["Grade", "Min (%)", "Max (%)"]],
      body: GRADING_POLICY.map((g) => [g.grade, g.lower, g.upper]),
      styles: { fontSize: 9, cellPadding: 2.5, halign: "center" },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold", fontSize: 9 },
      theme: "grid",
      margin: { left: ML, right: MR },
      tableWidth: 80,
    });
    Y = doc.lastAutoTable.finalY + 8;

    // ── COURSE OUTCOMES ───────────────────────────────────────
    Y = ensureSpace(Y, 50);
    Y = sectionHeading("4. Course Outcomes (COs)", Y);

    autoTable(doc, {
      startY: Y,
      head: [["CO", "CO Statement", "Target %", "Grade", "Bloom's", "SDGs"]],
      body: courseData.cos.map((co) => [
        co.id,
        co.description || "—",
        co.target ?? 55,
        co.targetGrade || "C",
        (Array.isArray(co.blooms) ? co.blooms : []).join(", ") || "—",
        (Array.isArray(co.sdgs) ? co.sdgs : []).join(", ") || "—",
      ]),
      styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold", fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 12, halign: "center", fontStyle: "bold" },
        1: { cellWidth: 74 },
        2: { cellWidth: 16, halign: "center" },
        3: { cellWidth: 14, halign: "center" },
        4: { cellWidth: 34 },
        5: { cellWidth: 32 },
      },
      theme: "grid",
      margin: { left: ML, right: MR },
    });
    Y = doc.lastAutoTable.finalY + 8;

    // ── CO ATTAINMENT RESULTS ──────────────────────────────────
    doc.addPage();
    Y = 14;
    Y = sectionHeading("5. CO Attainment Results", Y);

    autoTable(doc, {
      startY: Y,
      head: [["CO", "CO Statement", "Target %", "Attained", "Total", "% Attained", "Score"]],
      body: (report.coResults || []).map((r) => [
        r.co,
        r.description || "—",
        r.target,
        r.studentsAttained,
        r.totalStudents,
        typeof r.attainmentPercentage === "number" ? r.attainmentPercentage.toFixed(2) : "—",
        typeof r.score === "number" ? r.score.toFixed(2) : "—",
      ]),
      styles: { fontSize: 8.5, cellPadding: 2.5, overflow: "linebreak" },
      headStyles: { fillColor: [22, 160, 133], textColor: 255, fontStyle: "bold", fontSize: 8.5 },
      columnStyles: {
        0: { cellWidth: 12, halign: "center", fontStyle: "bold" },
        1: { cellWidth: 72 },
        2: { cellWidth: 16, halign: "center" },
        3: { cellWidth: 16, halign: "center" },
        4: { cellWidth: 14, halign: "center" },
        5: { cellWidth: 22, halign: "center" },
        6: { cellWidth: 22, halign: "center" },
      },
      theme: "grid",
      margin: { left: ML, right: MR },
    });
    Y = doc.lastAutoTable.finalY + 8;

    // ── CO-PO MAPPING MATRIX ─────────────────────────────────
    Y = ensureSpace(Y, 50);
    Y = sectionHeading("6. CO-PO Mapping Matrix", Y);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Correlation: 0 = None  |  1 = Low  |  2 = Medium  |  3 = High", ML, Y);
    doc.setTextColor(0, 0, 0);
    Y += 5;

    const poList = courseData.pos;
    const eachPOW = Math.min(14, Math.floor((TW - 20) / poList.length));
    autoTable(doc, {
      startY: Y,
      head: [["CO \\ PO", ...poList]],
      body: courseData.cos.map((co) => [
        co.id,
        ...poList.map((po) => report.mapping?.[co.id]?.[po] ?? 0),
      ]),
      styles: { fontSize: 8, cellPadding: 2, halign: "center" },
      headStyles: { fillColor: [52, 73, 94], textColor: 255, fontStyle: "bold", fontSize: 8 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 20, fillColor: [236, 240, 241], halign: "center" },
        ...Object.fromEntries(poList.map((_, i) => [i + 1, { cellWidth: eachPOW }])),
      },
      theme: "grid",
      margin: { left: ML, right: MR },
    });
    Y = doc.lastAutoTable.finalY + 8;

    // ── PO ATTAINMENT ──────────────────────────────────────────
    Y = ensureSpace(Y, 60);
    Y = sectionHeading("7. Programme Outcome (PO) Attainment", Y);

    autoTable(doc, {
      startY: Y,
      head: [["PO", "Direct Score", "Indirect Score", "Final Score"]],
      body: poList.map((po) => [
        po,
        typeof report.directPoScores?.[po] === "number" ? report.directPoScores[po].toFixed(2) : "—",
        typeof report.indirect?.poScores?.[po] === "number" ? report.indirect.poScores[po].toFixed(2) : "—",
        typeof report.poScores?.[po] === "number" ? report.poScores[po].toFixed(2) : "—",
      ]),
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [142, 68, 173], textColor: 255, fontStyle: "bold", fontSize: 9 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 20 },
        1: { halign: "center", cellWidth: 40 },
        2: { halign: "center", cellWidth: 40 },
        3: { halign: "center", cellWidth: 40 },
      },
      theme: "grid",
      margin: { left: ML, right: MR },
    });
    Y = doc.lastAutoTable.finalY + 8;

    // ── INDIRECT SURVEY ──────────────────────────────────────
    if (courseData.attainmentModes.indirect && report.indirect?.coResults?.length) {
      Y = ensureSpace(Y, 60);
      Y = sectionHeading("8. Indirect Survey Attainment", Y);
      autoTable(doc, {
        startY: Y,
        head: [["CO", ...SCALE_LABELS, "Total", "Grading Index", "Score"]],
        body: report.indirect.coResults.map((r) => [
          r.co,
          ...SCALE_LABELS.map((l) => r.counts?.[l] ?? 0),
          r.total,
          typeof r.gradingIndex === "number" ? r.gradingIndex.toFixed(2) : "—",
          typeof r.score === "number" ? r.score.toFixed(2) : "—",
        ]),
        styles: { fontSize: 9, cellPadding: 2.5, halign: "center" },
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold", fontSize: 9 },
        columnStyles: { 0: { fontStyle: "bold", halign: "left", cellWidth: 16 } },
        theme: "grid",
        margin: { left: ML, right: MR },
      });
      Y = doc.lastAutoTable.finalY + 8;
    }

    // ── WK MAPPING ──────────────────────────────────────────────
    const coWks = courseData.wkMapping?.coWks || {};
    const wkIds = Object.keys(coWks[courseData.cos[0]?.id] || {});
    if (wkIds.length > 0) {
      doc.addPage();
      Y = 14;
      Y = sectionHeading("9. WK Indicator Mapping (CO → Washington Knowledge)", Y);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 100, 100);
      doc.text("Y = Yes (mapped)  |  N = No (not mapped)", ML, Y);
      doc.setTextColor(0, 0, 0);
      Y += 5;

      autoTable(doc, {
        startY: Y,
        head: [["CO", ...wkIds]],
        body: courseData.cos.map((co) => [
          co.id,
          ...wkIds.map((wk) => (coWks[co.id]?.[wk] ? "Y" : "N")),
        ]),
        styles: { fontSize: 8, cellPadding: 2, halign: "center" },
        headStyles: { fillColor: [39, 174, 96], textColor: 255, fontStyle: "bold", fontSize: 8 },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 16, fillColor: [236, 240, 241] },
        },
        didDrawCell: (data) => {
          if (data.section === "body" && data.column.index > 0) {
            const val = data.cell.raw;
            if (val === "Y") {
              doc.setFillColor(220, 252, 231);
              doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");
              doc.setTextColor(22, 101, 52);
              doc.setFont("helvetica", "bold");
              doc.setFontSize(8);
              doc.text("Y", data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1, { align: "center" });
              doc.setTextColor(0, 0, 0);
              doc.setFont("helvetica", "normal");
            }
          }
        },
        theme: "grid",
        margin: { left: ML, right: MR },
      });
      Y = doc.lastAutoTable.finalY + 8;
    }

    // ── STUDENT MARKS SUMMARY ────────────────────────────────
    if (courseData.students.length > 0) {
      doc.addPage();
      Y = 14;
      Y = sectionHeading("10. Student Marks Summary", Y);

      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(
        `${courseData.students.length} students total. Showing all students with CO-wise attained marks.`,
        ML, Y
      );
      doc.setTextColor(0, 0, 0);
      Y += 5;

      const coIds = courseData.cos.map((c) => c.id);
      const coSummary = courseData.coSummary || [];

      autoTable(doc, {
        startY: Y,
        head: [["Sl.", "Roll No.", "Name", ...coIds.flatMap((c) => [`${c} Max`, `${c} Att.`])]],
        body: courseData.students.map((s, i) => [
          i + 1,
          s.registerNumber || "—",
          s.name || "—",
          ...coIds.flatMap((coId) => {
            const coEntry = coSummary.find((x) => x.co === coId);
            const row = coEntry?.rows?.[i];
            return [
              coEntry?.totalMarks ?? "—",
              row?.marksAttained ?? "—",
            ];
          }),
        ]),
        styles: { fontSize: 7, cellPadding: 1.5, overflow: "linebreak" },
        headStyles: { fillColor: [52, 73, 94], textColor: 255, fontStyle: "bold", fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 22 },
          2: { cellWidth: 32 },
        },
        theme: "grid",
        margin: { left: ML, right: MR },
      });
      Y = doc.lastAutoTable.finalY + 8;
    }

    // ── FOOTER on every page ─────────────────────────────────
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(140, 140, 140);
      doc.line(ML, pageH - 12, pageW - MR, pageH - 12);
      doc.text(
        `${course.courseName || "CO-PO Attainment Report"} — ${course.courseCode || ""} — ${course.academicYear || ""}`,
        ML, pageH - 8
      );
      doc.text(`Page ${p} of ${totalPages} | Generated ${new Date().toLocaleDateString()}`, pageW - MR, pageH - 8, { align: "right" });
    }

    doc.save(`Attainment_Report_${course.courseCode || "NITC"}.pdf`);
  }

  return (
    <div>
      <header className="topbar">
        <div>
          <p className="eyebrow">Step 7</p>
          <h1>Export Report</h1>
        </div>
        <button className="secondary" onClick={() => navigate("/report")}>← Back to Report</button>
      </header>

      <div className="panel wide">
        <div className="panel-title"><h2>Course: {course.courseName || "—"}</h2></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {[
            ["CO Attainment (CSV)", "Download CO-wise attainment scores", exportCOCSV, "#16a085"],
            ["PO Attainment (CSV)", "Download PO-wise attainment scores", exportPOCSV, "#16a085"],
            ["CO-PO Mapping (CSV)", "Download the CO-PO correlation matrix", exportMappingCSV, "#16a085"],
            ["Student Marks (CSV)", "Download all student marks data", exportStudentMarksCSV, "#2980b9"],
            ["Full Report (PDF)", "Professional PDF with NITC logo and all details", exportFullPDF, "#8e44ad"],
          ].map(([title, desc, fn, color]) => (
            <div key={title} className="workflow-card" style={{ borderTopColor: color }}>
              <h2 style={{ fontSize: 16 }}>{title}</h2>
              <p>{desc}</p>
              <button onClick={fn} style={{ background: color }}>Download</button>
            </div>
          ))}
        </div>
      </div>

      <div className="panel wide">
        <div className="panel-title"><h2>Print Report</h2></div>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          Use your browser's print function to print or save the report as PDF with full formatting.
        </p>
        <button onClick={() => window.print()}>🖨 Print / Save as PDF</button>
      </div>
    </div>
  );
}
