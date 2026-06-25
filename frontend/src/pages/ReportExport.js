import React from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useApp } from "../AppContext";
import { COURSE_FIELDS, NBA_POS, SDG_LIST, WK_LIST, derivePOsFromWKs, PO_COMPETENCIES, computeMappingValue } from "../constants";

const LOGO_SRC = `${process.env.PUBLIC_URL || ""}/LOG.png`;
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

    y = sectionTitle("5. Assessment-wise Analysis (per Slot)", nextY());
    table({
      startY: y,
      head: [["Assessment", "Max Marks", "Average Mark", "Average %", "Attainment Level"]],
      body: (report.assessments || []).map((a) => {
        const physCols = [];
        const seen = new Set();
        for (const q of (a.questions || [])) {
          const key = q.label || q.id;
          if (!seen.has(key)) { seen.add(key); physCols.push(q); }
        }
        const maxM = physCols.reduce((s, c) => s + num(c.rawMaxMarks ?? c.maxMarks), 0);
        const students = report.students || [];
        const totals = students.map((st) =>
          physCols.reduce((s, c) => {
            const sp = c.splitCount || 1;
            return s + Math.round(num((st.rawMarks || st.marks || {})[c.id]) * sp * 100) / 100;
          }, 0)
        );
        const avg = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
        const avgPct = maxM ? (avg / maxM) * 100 : 0;
        return [
          a.name || a.id,
          Math.round(maxM * 100) / 100,
          Math.round(avg * 100) / 100,
          pct(avgPct),
          num((avgPct / 100) * 3).toFixed(2),
        ];
      }),
      columnStyles: {
        0: { cellWidth: 52 },
        1: { cellWidth: 24, halign: "center" },
        2: { cellWidth: 28, halign: "center" },
        3: { cellWidth: 24, halign: "center" },
        4: { cellWidth: innerW - 128, halign: "center" },
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

    // ── Step 3: PI Entry Records (PO by PO) ───────────────────────────────────
    const piAnswers = courseData.wkMapping?.piAnswers;
    const piRubric = courseData.piRubric ?? { t1: 10, t2: 34, t3: 68 };
    if (piAnswers && coWks) {
      const activePOsWithConn = Object.keys(PO_COMPETENCIES).filter((po) =>
        pos.includes(po) &&
        cos.some((co) => {
          const wks = WK_LIST.filter((wk) => coWks[co.id]?.[wk.id]).map((wk) => wk.id);
          return derivePOsFromWKs(wks, courseData.psoWkMap).includes(po);
        })
      );

      if (activePOsWithConn.length) {
        y = sectionTitle("8. Performance Indicator Entry — Step 3 (PO by PO)", nextY());

        for (const po of activePOsWithConn) {
          const competencies = PO_COMPETENCIES[po] || [];
          const allPIs = competencies.flatMap((c) => c.pis);
          const connectedCos = cos.filter((co) => {
            const wks = WK_LIST.filter((wk) => coWks[co.id]?.[wk.id]).map((wk) => wk.id);
            return derivePOsFromWKs(wks, courseData.psoWkMap).includes(po);
          });
          if (!connectedCos.length || !allPIs.length) continue;

          // PO header row
          if (y + 20 > bottomLimit) y = addPage();
          doc.setFillColor(30, 42, 54);
          doc.rect(innerX, y, innerW, 7, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(255, 255, 255);
          doc.text(`${po} — ${NBA_POS.find((p) => p.id === po)?.label || ""}`, innerX + 3, y + 5);
          // X scores on right
          const coStats = connectedCos.map((co) => {
            const answers = piAnswers[co.id]?.[po] || {};
            const { x, value } = computeMappingValue(answers, competencies, piRubric);
            return { co: co.id, x, value };
          });
          const statsText = coStats.map(({ co, x, value }) => `${co}: X=${x.toFixed(1)}% → ${value ?? "—"}`).join("   ");
          doc.setFontSize(7);
          doc.text(statsText, pageW - innerX - 3, y + 5, { align: "right", maxWidth: innerW * 0.5 });
          doc.setTextColor(0, 0, 0);
          y += 9;

          // rubric note
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6.5);
          doc.setTextColor(100, 116, 139);
          doc.text(
            `Total PIs: ${allPIs.length}  |  Rubric: ≥${piRubric.t1}%→1  ≥${piRubric.t2}%→2  ≥${piRubric.t3}%→3`,
            innerX + 2, y + 3
          );
          doc.setTextColor(0, 0, 0);
          y += 6;

          // PI table
          const piHead = [["Comp.", "PI ID", "Performance Indicator", ...connectedCos.map((co) => co.id)]];
          const piBody = [];
          competencies.forEach((comp) => {
            comp.pis.forEach((pi) => {
              piBody.push([
                comp.id,
                pi.id,
                pi.label,
                ...connectedCos.map((co) => {
                  const checked = piAnswers[co.id]?.[po]?.[pi.id] ?? false;
                  return checked ? "Yes" : "No";
                }),
              ]);
            });
          });
          // Summary rows
          piBody.push([
            "", "", "X = (Yes / Total) × 100",
            ...coStats.map(({ x }) => `${x.toFixed(2)}`),
          ]);
          piBody.push([
            "", "", "Mapping Value (Rubric)",
            ...coStats.map(({ value }) => (value != null ? String(value) : "—")),
          ]);

          const coColWidth = Math.min(18, (innerW - 14 - 22 - 60) / Math.max(connectedCos.length, 1));
          table({
            startY: y,
            head: piHead,
            body: piBody,
            styles: { fontSize: 6.5, cellPadding: 1.2 },
            headStyles: { fillColor: [55, 90, 127], fontSize: 7 },
            columnStyles: {
              0: { cellWidth: 14, halign: "center", fontStyle: "bold" },
              1: { cellWidth: 22, halign: "center" },
              2: { cellWidth: innerW - 36 - coColWidth * connectedCos.length },
              ...Object.fromEntries(connectedCos.map((_, i) => [
                i + 3,
                { cellWidth: coColWidth, halign: "center", fontStyle: "bold" },
              ])),
            },
            didParseCell: (data) => {
              const isLast2 = data.row.index >= piBody.length - 2;
              if (isLast2) {
                data.cell.styles.fillColor = [215, 228, 241];
                data.cell.styles.fontStyle = "bold";
              }
              if (data.column.index >= 3 && !isLast2) {
                const val = data.cell.raw;
                data.cell.styles.fillColor = val === "Yes" ? [240, 255, 244] : [255, 245, 245];
                data.cell.styles.textColor = val === "Yes" ? [21, 87, 36] : [114, 28, 36];
              }
            },
          });
          y = nextY(4);
        }
      }
    }

    // ── CO to SDG Mapping ─────────────────────────────────────────────────────
    y = sectionTitle("9. CO to SDG Mapping", nextY());
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

    // ── SDG Impact Analysis ───────────────────────────────────────────────────
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
      y = sectionTitle("10. SDG Impact Analysis", nextY());
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

    // ── Graphical Analytics (inline bar charts) ─────────────────────────────
    function drawBarChart(opts) {
      // opts: { title, data, labelKey, valueKey, maxValue, color, y }
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
      // axis
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.2);
      doc.line(chartX + 8, cy, chartX + 8, cy + chartH);
      doc.line(chartX + 8, cy + chartH, chartX + chartW, cy + chartH);
      // y-axis labels
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.5);
      doc.setTextColor(120, 120, 120);
      [0, 25, 50, 75, 100].forEach((tick) => {
        const ty = cy + chartH - (tick / maxVal) * chartH;
        if (ty >= cy && ty <= cy + chartH) {
          doc.text(String(tick), chartX + 6, ty + 0.8, { align: "right" });
          doc.setDrawColor(220, 220, 220);
          doc.line(chartX + 8, ty, chartX + chartW, ty);
        }
      });
      // bars
      bars.forEach((d, i) => {
        const val = Math.min(num(d[opts.valueKey]), maxVal);
        const bh = maxVal > 0 ? (val / maxVal) * chartH : 0;
        const bx = chartX + 10 + i * (barW + gap);
        const by = cy + chartH - bh;
        const [r, g, b] = opts.color || [42, 157, 143];
        doc.setFillColor(r, g, b);
        if (bh > 0) doc.rect(bx, by, barW, bh, "F");
        // value label on top
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5);
        doc.setTextColor(60, 60, 60);
        if (bh > 0) doc.text(String(Math.round(val)), bx + barW / 2, by - 1, { align: "center" });
        // x label
        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.5);
        doc.setTextColor(60, 60, 60);
        const lbl = String(d[opts.labelKey]);
        doc.text(lbl, bx + barW / 2, cy + chartH + 4, { align: "center", maxWidth: barW + gap });
      });
      doc.setTextColor(0, 0, 0);
      return cy + chartH + 10;
    }

    function drawGroupedBarChart(opts) {
      // opts: { title, data, labelKey, keys, colors, maxValue, y }
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
      // legend
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

    y = nextY(4);
    if (y + 60 > bottomLimit) y = addPage();
    y = sectionTitle("11. Graphical Analytics", y);

    // Chart 1 — CO Attainment (grouped: Target vs Achieved)
    const coChartData = (report.coResults || []).map((r) => ({
      co: r.co, Target: num(r.target), Achieved: num(r.attainmentPercentage),
    }));
    y = drawGroupedBarChart({
      title: "CO Attainment — Target vs Achieved (%)",
      data: coChartData, labelKey: "co",
      keys: ["Target", "Achieved"],
      colors: [[233, 166, 58], [42, 157, 143]],
      maxValue: 100, y,
    });

    // Chart 2 — PO Attainment
    const activePOs = pos;
    const poChartData = activePOs.map((po) => ({
      po, attainment: Math.round((Math.min(3, Math.max(0, num(report.poScores?.[po]))) / 3) * 100),
    }));
    y = drawBarChart({
      title: "PO Attainment (%)",
      data: poChartData, labelKey: "po", valueKey: "attainment",
      maxValue: 100, color: [34, 87, 122], y,
    });

    // Chart 3 — Assessment Performance (full names on x-axis)
    const assessmentChartData = (report.assessments || []).map((a) => {
      const physCols = [];
      const seen = new Set();
      for (const q of (a.questions || [])) {
        const key = q.label || q.id;
        if (!seen.has(key)) { seen.add(key); physCols.push(q); }
      }
      const maxM = physCols.reduce((s, c) => s + num(c.rawMaxMarks ?? c.maxMarks), 0);
      const students = report.students || [];
      const totals = students.map((st) =>
        physCols.reduce((s, c) => {
          const sp = c.splitCount || 1;
          return s + Math.round(num((st.rawMarks || st.marks || {})[c.id]) * sp * 100) / 100;
        }, 0)
      );
      const avg = totals.length ? totals.reduce((x, v) => x + v, 0) / totals.length : 0;
      const avgPct = maxM ? (avg / maxM) * 100 : 0;
      return { name: a.name || a.id, averagePercent: Math.round(avgPct * 100) / 100 };
    });
    y = drawBarChart({
      title: "Assessment Performance — Average % per Assessment",
      data: assessmentChartData, labelKey: "name", valueKey: "averagePercent",
      maxValue: 100, color: [109, 93, 252], y,
    });

    // Chart 4 — Mark Distribution
    const allPhysCols = [];
    const seenAll = new Set();
    for (const a of (report.assessments || [])) {
      for (const q of (a.questions || [])) {
        const key = `${a.id}|||${q.label || q.id}`;
        if (!seenAll.has(key)) { seenAll.add(key); allPhysCols.push(q); }
      }
    }
    const totalMax = allPhysCols.reduce((s, c) => s + num(c.rawMaxMarks ?? c.maxMarks), 0);
    const buckets = ["0-39","40-49","50-59","60-69","70-84","85-100"].map((range) => ({ range, count: 0 }));
    (report.students || []).forEach((st) => {
      const tot = allPhysCols.reduce((s, c) => {
        const sp = c.splitCount || 1;
        return s + Math.round(num((st.rawMarks || st.marks || {})[c.id]) * sp * 100) / 100;
      }, 0);
      const pct2 = totalMax ? (tot / totalMax) * 100 : 0;
      const idx = pct2 >= 85 ? 5 : pct2 >= 70 ? 4 : pct2 >= 60 ? 3 : pct2 >= 50 ? 2 : pct2 >= 40 ? 1 : 0;
      buckets[idx].count += 1;
    });
    y = drawBarChart({
      title: "Mark Distribution — Number of Students per Score Range",
      data: buckets, labelKey: "range", valueKey: "count",
      maxValue: Math.max(...buckets.map((b) => b.count), 1),
      color: [138, 203, 74], y,
    });

    y = sectionTitle("12. Final Remarks", nextY());
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
