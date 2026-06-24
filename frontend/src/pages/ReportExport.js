import React from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useApp } from "../AppContext";
import { COURSE_FIELDS, NBA_POS, WK_LIST, derivePOsFromWKs } from "../constants";

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
    const res = await fetch(LOGO_SRC);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
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
  const pos = courseData.pos || [];
  const cos = courseData.cos || [];

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

    drawBorder();

    const logoBoxH = 28;
    const logoY = M + 3;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.25);
    doc.rect(innerX, logoY, innerW, logoBoxH);

    if (logoData) {
      const logoW = Math.min(innerW - 18, (logoBoxH - 6) * LOGO_RATIO);
      const logoH = logoW / LOGO_RATIO;
      doc.addImage(logoData, "PNG", innerX + (innerW - logoW) / 2, logoY + (logoBoxH - logoH) / 2, logoW, logoH);
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...HDR_COLOR);
      doc.text("Institution Logo", pageW / 2, logoY + logoBoxH / 2 + 2, { align: "center" });
      doc.setTextColor(0, 0, 0);
    }

    const titleY = logoY + logoBoxH + 2;
    doc.setFillColor(...HDR_COLOR);
    doc.rect(innerX, titleY, innerW, 14, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text("CO-PO ATTAINMENT REPORT", pageW / 2, titleY + 10, { align: "center" });
    doc.setTextColor(0, 0, 0);

    const generatedY = titleY + 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      `Generated: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}`,
      pageW - innerX,
      generatedY,
      { align: "right" }
    );
    doc.setTextColor(0, 0, 0);

    let y = sectionTitle("1. Report Overview", generatedY + 4);
    table({
      startY: y,
      head: [["Field", "Value"]],
      body: COURSE_FIELDS.map(([key, label]) => [label, tv(course[key])]),
      columnStyles: {
        0: { cellWidth: 48, fontStyle: "bold" },
        1: { cellWidth: innerW - 48 },
      },
    });

    y = sectionTitle("2. CO Attainment Summary", nextY());
    table({
      startY: y,
      head: [["CO", "Target %", "Achieved %", "Level", "Status"]],
      body: (report.coResults || []).map((r) => {
        const achieved = num(r.attainmentPercentage) >= num(r.target);
        return [r.co, pct(r.target), pct(r.attainmentPercentage), tv(r.score), achieved ? "Achieved" : "Not Achieved"];
      }),
      styles: { halign: "center" },
      columnStyles: {
        0: { cellWidth: 20, fontStyle: "bold" },
        1: { cellWidth: 30 },
        2: { cellWidth: 34 },
        3: { cellWidth: 26 },
        4: { cellWidth: innerW - 110 },
      },
    });

    y = sectionTitle("3. PO Attainment Summary", nextY());
    table({
      startY: y,
      head: [["PO", "Mapped COs", "Attainment %", "Level", "Remarks"]],
      body: pos.map((po) => {
        const mappedCOs = cos
          .filter((co) => num(report.mapping?.[co.id]?.[po]) > 0)
          .map((co) => co.id);
        const score = report.poScores?.[po] ?? 0;
        return [po, mappedCOs.join(", ") || "-", poPercent(score), tv(score), mappedCOs.length ? levelText(score) : "No mapping"];
      }),
      columnStyles: {
        0: { cellWidth: 18, fontStyle: "bold", halign: "center" },
        1: { cellWidth: 42 },
        2: { cellWidth: 30, halign: "center" },
        3: { cellWidth: 22, halign: "center" },
        4: { cellWidth: innerW - 112 },
      },
    });

    y = sectionTitle("4. CO-PO Mapping Matrix", nextY());
    const coColW = 16;
    const poColW = Math.max(7.5, (innerW - coColW) / Math.max(pos.length, 1));
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
        0: { cellWidth: coColW, fontStyle: "bold", halign: "left" },
        ...Object.fromEntries(pos.map((_, i) => [i + 1, { cellWidth: poColW }])),
      },
    });

    y = sectionTitle("5. Direct PO Attainment", nextY());
    table({
      startY: y,
      head: [["PO", "PO Name", "Direct Score"]],
      body: pos.map((po) => [
        po,
        NBA_POS.find((p) => p.id === po)?.label || "",
        tv(report.directPoScores?.[po]),
      ]),
      columnStyles: {
        0: { cellWidth: 16, fontStyle: "bold", halign: "center" },
        1: { cellWidth: innerW - 44 },
        2: { cellWidth: 28, halign: "center" },
      },
    });

    if (courseData.attainmentModes?.indirect && report.indirect?.coResults?.length) {
      y = sectionTitle("6. Indirect Attainment", nextY());
      table({
        startY: y,
        head: [["CO", "VH", "H", "M", "L", "VL", "Total", "Grading Index", "Score"]],
        body: report.indirect.coResults.map((r) => [
          r.co,
          r.counts?.VH ?? 0,
          r.counts?.H ?? 0,
          r.counts?.M ?? 0,
          r.counts?.L ?? 0,
          r.counts?.VL ?? 0,
          r.total,
          r.gradingIndex,
          r.score,
        ]),
        styles: { halign: "center", fontSize: 7.5 },
        columnStyles: { 0: { cellWidth: 14, fontStyle: "bold" } },
      });
    }

    const coWks = courseData.wkMapping?.coWks;
    if (coWks) {
      y = sectionTitle("7. GAPC 4.0 / WK Mapping", nextY());
      const wkIds = WK_LIST.filter((wk) => /^WK[1-8]$/.test(wk.id)).map((wk) => wk.id);
      const wkColW = Math.max(13, (innerW - 16) / Math.max(wkIds.length, 1));
      table({
        startY: y,
        head: [["CO", ...wkIds]],
        body: cos.map((co) => [
          co.id,
          ...wkIds.map((wk) => (coWks[co.id]?.[wk] ? "Y" : "-")),
        ]),
        styles: { halign: "center", fontSize: 7.5 },
        columnStyles: {
          0: { cellWidth: 16, fontStyle: "bold", halign: "left" },
          ...Object.fromEntries(wkIds.map((_, i) => [i + 1, { cellWidth: wkColW }])),
        },
      });

      y = sectionTitle("8. WK-based CO-PO Matrix", nextY());
      table({
        startY: y,
        head: [["CO", ...pos]],
        body: cos.map((co) => {
          const selectedWks = WK_LIST.filter((wk) => coWks[co.id]?.[wk.id]).map((wk) => wk.id);
          const derivedPOs = derivePOsFromWKs(selectedWks, courseData.psoWkMap);
          return [
            co.id,
            ...pos.map((po) => (derivedPOs.includes(po) ? String(report.mapping?.[co.id]?.[po] ?? 0) : "-")),
          ];
        }),
        styles: { halign: "center", fontSize: 7.1, cellPadding: 1.35 },
        columnStyles: {
          0: { cellWidth: coColW, fontStyle: "bold", halign: "left" },
          ...Object.fromEntries(pos.map((_, i) => [i + 1, { cellWidth: poColW }])),
        },
      });
    }

    const achievedCOs = (report.coResults || [])
      .filter((r) => num(r.attainmentPercentage) >= num(r.target))
      .map((r) => r.co);
    const lowCOs = (report.coResults || [])
      .filter((r) => num(r.attainmentPercentage) < num(r.target))
      .map((r) => r.co);

    y = sectionTitle("9. Final Remarks", nextY());
    table({
      startY: y,
      head: [["Remarks"]],
      body: [
        [achievedCOs.length ? `${achievedCOs.join(", ")} achieved the expected target level.` : "No CO has achieved the expected target level."],
        [lowCOs.length ? `${lowCOs.join(", ")} require improvement and additional learning support.` : "All listed COs meet the target level."],
        [num(report.summary?.averageCOScore) >= 2 ? "Overall course attainment is satisfactory." : "Overall course attainment needs focused improvement."],
      ],
      styles: { fontSize: 8.5 },
      columnStyles: { 0: { cellWidth: innerW } },
    });

    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p += 1) {
      doc.setPage(p);
      drawBorder();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(
        `${tv(course.courseName)} | ${tv(course.courseCode)} | Faculty: ${tv(course.faculty)}`,
        innerX,
        pageH - M + 4,
        { maxWidth: innerW - 28 }
      );
      doc.text(`Page ${p} of ${totalPages}`, pageW - innerX, pageH - M + 4, { align: "right" });
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
            ["Full Report (PDF)", "Complete attainment report as PDF", exportFullPDF, "var(--blue)"],
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
