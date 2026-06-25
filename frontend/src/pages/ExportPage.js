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

// Convert image to base64 data URL
function loadImageAsDataURL(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      try {
        const dataURL = canvas.toDataURL("image/png");
        resolve(dataURL);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = reject;
    img.src = src;
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
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    let currentY = 15;

    // ============================================================
    // HEADER with NITC Logo
    // ============================================================
    const logoX = 14;
    const logoY = currentY;
    const logoW = 28;
    const logoH = 28;
    let logoLoaded = false;

    try {
      const logoDataURL = await loadImageAsDataURL("/college_logo.png");
      doc.addImage(logoDataURL, "PNG", logoX, logoY, logoW, logoH);
      logoLoaded = true;
    } catch (err) {
      console.warn("Logo load failed:", err);
    }

    const textX = logoLoaded ? logoX + logoW + 6 : logoX;
    const textMaxWidth = pageWidth - textX - 14;

    // Draw top border line
    doc.setDrawColor(30, 80, 150);
    doc.setLineWidth(0.8);
    doc.line(14, currentY - 2, pageWidth - 14, currentY - 2);

    // Institution name — bold, large
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(20, 60, 140);
    doc.text("National Institute of Technology Calicut", textX, currentY + 7, { maxWidth: textMaxWidth });

    // Department
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    const dept = course.specialization
      ? `Department of ${course.specialization}`
      : "Department of Computer Science and Engineering";
    doc.text(dept, textX, currentY + 14, { maxWidth: textMaxWidth });

    // Report subtitle
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("Course Outcome & Programme Outcome Attainment Report", textX, currentY + 20, { maxWidth: textMaxWidth });

    currentY += logoH + 4;

    // Bottom border line
    doc.setDrawColor(30, 80, 150);
    doc.setLineWidth(0.8);
    doc.line(14, currentY, pageWidth - 14, currentY);
    doc.setTextColor(0, 0, 0);
    currentY += 8;

    // ============================================================
    // COURSE DETAILS (all entered by faculty)
    // ============================================================
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Course Information", 15, currentY);
    currentY += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const courseDetails = [
      ["Course Name", course.courseName],
      ["Course Code", course.courseCode],
      ["Programme", course.programme],
      ["Specialization", course.specialization],
      ["Academic Year", course.academicYear],
      ["Semester", course.semester],
      ["Course Year", course.courseYear],
      ["Course Semester", course.courseSemester],
      ["Credits", course.credits],
      ["Faculty Name", course.faculty],
    ];

    courseDetails.forEach(([label, value]) => {
      if (value) {
        doc.setFont("helvetica", "bold");
        doc.text(label + ":", 15, currentY);
        doc.setFont("helvetica", "normal");
        doc.text(String(value), 70, currentY);
        currentY += 6;
      }
    });

    currentY += 5;

    // ============================================================
    // EVALUATION POLICY
    // ============================================================
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Evaluation Policy", 15, currentY);
    currentY += 5;

    autoTable(doc, {
      startY: currentY,
      head: [["Component", "Weightage (%)"]],
      body: [
        ["Internal Assessment", courseData.evaluationPolicy.interimTest],
        ["End Semester Examination", courseData.evaluationPolicy.endExam],
        ["Continuous Assessment", courseData.evaluationPolicy.continuousEvaluation],
        ["Other", courseData.evaluationPolicy.other || 0],
      ],
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 100 }, 1: { halign: "center", cellWidth: 40 } },
      margin: { left: 15, right: 15 },
    });

    currentY = doc.lastAutoTable.finalY + 10;

    // ============================================================
    // GRADING POLICY
    // ============================================================
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Grading Policy", 15, currentY);
    currentY += 5;

    autoTable(doc, {
      startY: currentY,
      head: [["Grade", "Minimum (%)", "Maximum (%)"]],
      body: GRADING_POLICY.map((g) => [g.grade, g.lower, g.upper]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
      columnStyles: { 0: { halign: "center" }, 1: { halign: "center" }, 2: { halign: "center" } },
      margin: { left: 15, right: 15 },
    });

    currentY = doc.lastAutoTable.finalY + 10;

    // ============================================================
    // COURSE OUTCOMES with Targets
    // ============================================================
    if (currentY > pageHeight - 60) {
      doc.addPage();
      currentY = 15;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Course Outcomes (COs)", 15, currentY);
    currentY += 5;

    autoTable(doc, {
      startY: currentY,
      head: [["CO", "Description", "Target (%)", "Target Grade"]],
      body: courseData.cos.map((co) => [
        co.id,
        co.description || "—",
        co.target ?? 55,
        co.targetGrade || "C",
      ]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 15 }, 1: { cellWidth: 110 }, 2: { halign: "center", cellWidth: 20 }, 3: { halign: "center", cellWidth: 20 } },
      margin: { left: 15, right: 15 },
    });

    currentY = doc.lastAutoTable.finalY + 10;

    // ============================================================
    // NEW PAGE: CO ATTAINMENT RESULTS
    // ============================================================
    doc.addPage();
    currentY = 15;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("CO Attainment Results", 15, currentY);
    currentY += 7;

    autoTable(doc, {
      startY: currentY,
      head: [["CO", "Description", "Target (%)", "Students Attained", "Total Students", "% Attained", "Attainment Score"]],
      body: (report.coResults || []).map((r) => [
        r.co,
        r.description || "—",
        r.target,
        r.studentsAttained,
        r.totalStudents,
        r.attainmentPercentage.toFixed(2),
        r.score.toFixed(2),
      ]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [22, 160, 133], textColor: 255, fontStyle: "bold" },
      columnStyles: { 1: { cellWidth: 60 }, 2: { halign: "center" }, 3: { halign: "center" }, 4: { halign: "center" }, 5: { halign: "center" }, 6: { halign: "center" } },
      margin: { left: 15, right: 15 },
    });

    currentY = doc.lastAutoTable.finalY + 10;

    // ============================================================
    // CO-PO MAPPING MATRIX
    // ============================================================
    if (currentY > pageHeight - 60) {
      doc.addPage();
      currentY = 15;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("CO-PO Mapping Matrix", 15, currentY);
    currentY += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("(Correlation: 0 = None, 1 = Low, 2 = Medium, 3 = High)", 15, currentY);
    currentY += 5;

    autoTable(doc, {
      startY: currentY,
      head: [["CO \\ PO", ...courseData.pos]],
      body: courseData.cos.map((co) => [
        co.id,
        ...courseData.pos.map((po) => report.mapping?.[co.id]?.[po] ?? 0),
      ]),
      styles: { fontSize: 8, cellPadding: 2, halign: "center" },
      headStyles: { fillColor: [52, 73, 94], textColor: 255, fontStyle: "bold" },
      columnStyles: { 0: { fontStyle: "bold", fillColor: [236, 240, 241] } },
      margin: { left: 15, right: 15 },
    });

    currentY = doc.lastAutoTable.finalY + 10;

    // ============================================================
    // PO ATTAINMENT SCORES
    // ============================================================
    if (currentY > pageHeight - 60) {
      doc.addPage();
      currentY = 15;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Programme Outcome (PO) Attainment", 15, currentY);
    currentY += 7;

    autoTable(doc, {
      startY: currentY,
      head: [["PO", "Direct Score", "Indirect Score", "Final Score"]],
      body: courseData.pos.map((po) => [
        po,
        report.directPoScores?.[po]?.toFixed(2) ?? "—",
        report.indirect?.poScores?.[po]?.toFixed(2) ?? "—",
        report.poScores?.[po]?.toFixed(2) ?? "—",
      ]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [142, 68, 173], textColor: 255, fontStyle: "bold" },
      columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "center" }, 2: { halign: "center" }, 3: { halign: "center" } },
      margin: { left: 15, right: 15 },
    });

    currentY = doc.lastAutoTable.finalY + 10;

    // ============================================================
    // INDIRECT SURVEY (if applicable)
    // ============================================================
    if (courseData.attainmentModes.indirect && report.indirect?.coResults?.length) {
      if (currentY > pageHeight - 60) {
        doc.addPage();
        currentY = 15;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Indirect Survey Attainment", 15, currentY);
      currentY += 7;

      autoTable(doc, {
        startY: currentY,
        head: [["CO", ...SCALE_LABELS, "Total Responses", "Grading Index", "Score"]],
        body: report.indirect.coResults.map((r) => [
          r.co,
          ...SCALE_LABELS.map((l) => r.counts?.[l] ?? 0),
          r.total,
          r.gradingIndex.toFixed(2),
          r.score.toFixed(2),
        ]),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
        columnStyles: { 0: { fontStyle: "bold" } },
        margin: { left: 15, right: 15 },
      });

      currentY = doc.lastAutoTable.finalY + 10;
    }

    // ============================================================
    // STUDENT MARKS SUMMARY (Sample - first 20 students)
    // ============================================================
    if (courseData.students.length > 0) {
      doc.addPage();
      currentY = 15;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Student Marks Summary (Sample)", 15, currentY);
      currentY += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Showing first 20 of ${courseData.students.length} students. Full data available in CSV export.`, 15, currentY);
      currentY += 5;

      const sampleStudents = courseData.students.slice(0, 20);
      autoTable(doc, {
        startY: currentY,
        head: [["Sl.", "Roll No.", "Name", "Total Marks"]],
        body: sampleStudents.map((s, i) => {
          const questions = courseData.assessments.flatMap((a) => a.questions);
          const total = questions.reduce((sum, q) => sum + (s.rawMarks?.[q.id] ?? s.marks?.[q.id] ?? 0), 0);
          return [i + 1, s.registerNumber, s.name, total.toFixed(2)];
        }),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [52, 73, 94], textColor: 255, fontStyle: "bold" },
        columnStyles: { 0: { halign: "center", cellWidth: 10 }, 1: { cellWidth: 30 }, 2: { cellWidth: 60 }, 3: { halign: "center", cellWidth: 25 } },
        margin: { left: 15, right: 15 },
      });
    }

    // ============================================================
    // FOOTER on all pages
    // ============================================================
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Generated on ${new Date().toLocaleDateString()} | Page ${i} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: "center" }
      );
    }

    doc.save(`Attainment_Report_${course.courseCode || "NIT_Calicut"}.pdf`);
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
