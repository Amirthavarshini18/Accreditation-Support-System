import React, { createContext, useContext, useState } from "react";
import {
  NBA_POS, DEFAULT_EVAL_POLICY, DEFAULT_TARGET_GRADE, DEFAULT_TARGET_PCT,
  WK_LIST, PO_COMPETENCIES, PSO_WK_DEFAULTS,
} from "./constants";

const AppContext = createContext(null);

function blankCourse(facultyName = "") {
  return {
    courseName: "", courseCode: "", academicYear: "", semester: "",
    programme: "", specialization: "", courseYear: "", courseSemester: "",
    credits: "", faculty: facultyName,
  };
}

export function blankWkMapping(cos) {
  const coWks = Object.fromEntries(
    cos.map((co) => [co.id, Object.fromEntries(WK_LIST.map((wk) => [wk.id, false]))])
  );
  const piAnswers = Object.fromEntries(
    cos.map((co) => [
      co.id,
      Object.fromEntries(
        Object.keys(PO_COMPETENCIES).map((po) => [
          po,
          Object.fromEntries(
            PO_COMPETENCIES[po].flatMap((c) => c.pis).map((pi) => [pi.id, false])
          ),
        ])
      ),
    ])
  );
  return { coWks, piAnswers };
}

// Blank slot data for marks entry — persisted in context so navigation doesn't lose uploads
function blankSlotData() {
  return { IA: null, ESE: null, CA: null };
}

function initialState(faculty) {
  const cos = ["CO1", "CO2", "CO3", "CO4", "CO5"].map((id) => ({
    id, description: "", target: DEFAULT_TARGET_PCT, targetGrade: DEFAULT_TARGET_GRADE, sdgs: [], blooms: [],
  }));
  const pos = NBA_POS.map((p) => p.id);
  return {
    course: blankCourse(faculty?.name || ""),
    attainmentModes: { direct: true, indirect: false },
    cos,
    pos,
    mapping: Object.fromEntries(
      cos.map((co) => [co.id, Object.fromEntries(pos.map((po) => [po, 0]))])
    ),
    evaluationPolicy: { ...DEFAULT_EVAL_POLICY },
    assessments: [],
    students: [],
    coSummary: [],
    indirectSurvey: {
      scale: { VH: 5, H: 4, M: 3, L: 2, VL: 1 },
      responses: Object.fromEntries(cos.map((co) => [co.id, { VH: 0, H: 0, M: 0, L: 0, VL: 0 }])),
    },
    wkMapping: blankWkMapping(cos),
    psoWkMap: { PSO1: [...PSO_WK_DEFAULTS.PSO1], PSO2: [...PSO_WK_DEFAULTS.PSO2] },
    // Custom PSOs defined by faculty: [{ id: "PSO1", label: "", wks: [] }]
    psoConfig: [
      { id: "PSO1", label: "", wks: [...PSO_WK_DEFAULTS.PSO1] },
      { id: "PSO2", label: "", wks: [...PSO_WK_DEFAULTS.PSO2] },
    ],
    // PI rubric thresholds set by faculty: low/mid/high cutoffs for value 1/2/3
    piRubric: { t1: 10, t2: 34, t3: 68 },
    wkMappingDone: false,
    slotData: blankSlotData(),
  };
}

export function AppProvider({ children }) {
  const [faculty, setFaculty] = useState(() => {
    const saved = localStorage.getItem("faculty");
    return saved ? JSON.parse(saved) : null;
  });
  const [courseData, setCourseData] = useState(() => initialState(null));
  const [report, setReport] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function login(facultyData) {
    localStorage.setItem("faculty", JSON.stringify(facultyData));
    setFaculty(facultyData);
    setCourseData(initialState(facultyData));
    setReport(null);
  }

  function logout() {
    localStorage.removeItem("faculty");
    setFaculty(null);
    setReport(null);
    setStatus("");
    setError("");
    setCourseData(initialState(null));
  }

  function resetData() {
    setCourseData(initialState(faculty));
    setReport(null);
    setStatus("");
    setError("");
  }

  return (
    <AppContext.Provider value={{
      faculty, login, logout,
      courseData, setCourseData,
      report, setReport,
      status, setStatus,
      error, setError,
      loading, setLoading,
      resetData,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
