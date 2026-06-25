import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
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
    psoConfig: [
      { id: "PSO1", label: "", wks: [...PSO_WK_DEFAULTS.PSO1] },
      { id: "PSO2", label: "", wks: [...PSO_WK_DEFAULTS.PSO2] },
    ],
    piRubric: { t1: 10, t2: 34, t3: 68 },
    wkMappingDone: false,
    slotData: blankSlotData(),
  };
}

// ── localStorage cache helpers (per-faculty, fast restore on reload) ──────────
function lsKey(faculty, suffix) {
  return `acc_${faculty?.id || "guest"}_${suffix}`;
}
function lsSave(faculty, courseData, report) {
  if (!faculty) return;
  try {
    localStorage.setItem(lsKey(faculty, "courseData"), JSON.stringify(courseData));
    localStorage.setItem(lsKey(faculty, "report"), JSON.stringify(report));
  } catch (_) {}
}
function lsLoad(faculty, fallback) {
  if (!faculty) return { courseData: fallback, report: null };
  try {
    const cd = localStorage.getItem(lsKey(faculty, "courseData"));
    const rp = localStorage.getItem(lsKey(faculty, "report"));
    return {
      courseData: cd ? JSON.parse(cd) : fallback,
      report: rp ? JSON.parse(rp) : null,
    };
  } catch (_) {
    return { courseData: fallback, report: null };
  }
}
function lsClear(faculty) {
  if (!faculty) return;
  localStorage.removeItem(lsKey(faculty, "courseData"));
  localStorage.removeItem(lsKey(faculty, "report"));
}

export function AppProvider({ children }) {
  const [faculty, setFaculty] = useState(() => {
    const s = localStorage.getItem("faculty");
    return s ? JSON.parse(s) : null;
  });

  // Boot from localStorage cache immediately so the UI is responsive on reload
  const [courseData, setCourseData] = useState(() => {
    const f = (() => { const s = localStorage.getItem("faculty"); return s ? JSON.parse(s) : null; })();
    return lsLoad(f, initialState(f)).courseData;
  });

  const [report, setReport] = useState(() => {
    const f = (() => { const s = localStorage.getItem("faculty"); return s ? JSON.parse(s) : null; })();
    return lsLoad(f, initialState(f)).report;
  });

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  // ── Debounced server sync ──────────────────────────────────────────────────
  // Write to localStorage immediately on every change.
  // Debounce the server POST to avoid flooding on rapid state updates.
  const syncTimer = useRef(null);

  const syncToServer = useCallback((currentFaculty, currentCourseData, currentReport) => {
    if (!currentFaculty) return;
    // Always persist to localStorage immediately
    lsSave(currentFaculty, currentCourseData, currentReport);
  }, []);

  useEffect(() => {
    syncToServer(faculty, courseData, report);
  }, [faculty, courseData, report, syncToServer]);

  // ── login ──────────────────────────────────────────────────────────────────
  function login(facultyData) {
    localStorage.setItem("faculty", JSON.stringify(facultyData));
    setFaculty(facultyData);
    // Check if this faculty has a cached session already
    const cached = lsLoad(facultyData, null);
    if (cached.courseData && Object.keys(cached.courseData).length > 0) {
      setCourseData(cached.courseData);
      setReport(cached.report);
      setShowWelcome(false);
    } else {
      const fresh = initialState(facultyData);
      setCourseData(fresh);
      setReport(null);
      setShowWelcome(true);
    }
  }

  // ── logout ─────────────────────────────────────────────────────────────────
  async function logout() {
    if (faculty) {
      lsClear(faculty);
    }
    localStorage.removeItem("faculty");
    clearTimeout(syncTimer.current);
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
      showWelcome, setShowWelcome,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
