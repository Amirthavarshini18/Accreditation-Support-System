import * as XLSX from "xlsx";

function colWidths(n) {
  return [{ wch: 6 }, { wch: 16 }, { wch: 24 }, ...Array(n).fill({ wch: 10 })];
}

function buildSheet(coRow, labelRow, maxRow, qCount) {
  // Merge SI/RollNo/Name into cols A-C of the label row — avoids a duplicate header row
  const mergedLabelRow = ["SI", "RollNo", "Name", ...labelRow.slice(3), "Total"];
  const dataRows = Array.from({ length: 5 }, (_, i) => [
    i + 1,
    `ROLLNO${String(i + 1).padStart(3, "0")}`,
    `Student ${i + 1}`,
    ...Array(qCount).fill(""),
    "",
  ]);
  const ws = XLSX.utils.aoa_to_sheet([
    [...coRow, ""],
    mergedLabelRow,
    [...maxRow, ""],
    ...dataRows,
  ]);
  ws["!cols"] = [...colWidths(qCount), { wch: 10 }];
  return ws;
}

export function downloadIATemplate() {
  // CO row — columns 1-3 empty, then CO per question
  const cos   = ["", "", "", "CO1", "CO1", "CO1", "CO2", "CO2", "CO3", "CO4", "CO4"];
  const labels= ["", "", "", "T1Q1", "T1Q2", "A1",  "T1Q3", "A2",  "T1Q4", "T1Q5", "T1Q6"];
  const maxRow= ["", "", "",  5,      5,      5,     5,      5,     5,      5,      5    ];
  const qCount = cos.filter(Boolean).length;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSheet(cos, labels, maxRow, qCount), "IA");

  const instr = XLSX.utils.aoa_to_sheet([
    ["Row 1 (CO row)",      "Leave col A-C empty. From col D onward put CO id per question (e.g. CO1). Multi-CO: CO1,CO2"],
    ["Row 2 (Label row)",   "Leave col A-C empty. From col D onward put question label (e.g. T1Q1, A1)."],
    ["Row 3 (Max marks)",   "Leave col A-C empty. From col D onward put numeric max marks for each question."],
    ["Row 4 onward (data)", "Col A = serial number (1,2,3…), Col B = Register No., Col C = Student Name, Col D+ = marks."],
    [],
    ["Notes:"],
    ["Assignment questions starting with A (A1, A2…) are auto-weighted at 0.75."],
    ["Do NOT add a Total column — the system computes totals automatically."],
  ]);
  instr["!cols"] = [{ wch: 22 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, instr, "Instructions");

  XLSX.writeFile(wb, "Template_IA_Marks.xlsx");
}

export function downloadESETemplate() {
  const cos    = ["", "", "", "CO1", "CO1", "CO2", "CO2", "CO3", "CO3", "CO4"];
  const labels = ["", "", "", "Q1",  "Q2",  "Q3",  "Q4",  "Q5",  "Q6",  "Q7"];
  const maxRow = ["", "", "",  10,    10,    10,    10,    10,    10,    10  ];
  const qCount = cos.filter(Boolean).length;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSheet(cos, labels, maxRow, qCount), "ESE");

  const instr = XLSX.utils.aoa_to_sheet([
    ["Row 1 (CO row)",      "Leave col A-C empty. From col D onward put CO id per question (e.g. CO1). Multi-CO: CO1,CO2"],
    ["Row 2 (Label row)",   "Leave col A-C empty. From col D onward put question label (e.g. Q1, Q2)."],
    ["Row 3 (Max marks)",   "Leave col A-C empty. From col D onward put numeric max marks for each question."],
    ["Row 4 onward (data)", "Col A = serial number (1,2,3…), Col B = Register No., Col C = Student Name, Col D+ = marks."],
    [],
    ["Notes:"],
    ["Do NOT add a Total column — the system computes totals automatically."],
  ]);
  instr["!cols"] = [{ wch: 22 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, instr, "Instructions");

  XLSX.writeFile(wb, "Template_ESE_Marks.xlsx");
}

export function downloadCATemplate() {
  // CA: one or few questions, each may map to multiple COs (comma-separated in CO cell)
  const cos    = ["", "", "", "CO1,CO2,CO3,CO4", "CO1,CO2"];
  const labels = ["", "", "", "Quiz1",            "Assignment1"];
  const maxRow = ["", "", "",  20,                 10          ];
  const qCount = cos.filter(Boolean).length;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSheet(cos, labels, maxRow, qCount), "CA");

  const instr = XLSX.utils.aoa_to_sheet([
    ["Row 1 (CO row)",      "Leave col A-C empty. For multi-CO questions write CO ids comma-separated: CO1,CO2,CO3,CO4"],
    ["Row 2 (Label row)",   "Leave col A-C empty. From col D onward put question label (e.g. Quiz1)."],
    ["Row 3 (Max marks)",   "Leave col A-C empty. From col D onward put numeric max marks for the question."],
    ["Row 4 onward (data)", "Col A = serial number (1,2,3…), Col B = Register No., Col C = Student Name, Col D+ = marks."],
    [],
    ["Notes:"],
    ["When multiple COs share one column the marks are split equally across all listed COs."],
    ["Example: 15/20 for CO1,CO2,CO3,CO4 → each CO gets 3.75"],
  ]);
  instr["!cols"] = [{ wch: 22 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, instr, "Instructions");

  XLSX.writeFile(wb, "Template_CA_Marks.xlsx");
}
