import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  BarChart3, BookOpen, ClipboardList, FileSpreadsheet,
  LogOut, User, LayoutDashboard, Download, FileText, GitBranch, CheckCircle,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { useApp } from "../AppContext";

const NAV = [
  { to: "/dashboard",       icon: LayoutDashboard, label: "Dashboard",           step: null },
  { to: "/course",          icon: BookOpen,        label: "1. Course Details",    step: 1 },
  { to: "/attainment-type", icon: ClipboardList,   label: "2. Attainment Type",   step: 2 },
  { to: "/questions",       icon: FileText,        label: "3. Questions & CO-PO", step: 3 },
  { to: "/wk-mapping",      icon: GitBranch,       label: "4. WK Mapping",        step: 4 },
  { to: "/marks",           icon: FileSpreadsheet, label: "5. Marks Entry",       step: 5 },
  { to: "/survey",          icon: User,            label: "6. Indirect Survey",   step: 6 },
  { to: "/report",          icon: BarChart3,       label: "7. Report",            step: 7 },
  { to: "/export",          icon: Download,        label: "8. Export",            step: 8 },
];

function stepDone(step, courseData, report) {
  if (!step) return false;
  const checks = [
    null,
    (cd) => !!(cd.course?.courseName && cd.course?.courseCode),
    (cd) => Object.values(cd.evaluationPolicy || {}).reduce((s, v) => s + v, 0) === 100,
    (cd) => (cd.assessments?.[0]?.questions?.length > 0) || cd.wkMappingDone,
    (cd) => !!cd.wkMappingDone,
    (cd) => cd.students?.length > 0,
    (cd) => { if (!cd.attainmentModes?.indirect) return true; return Object.values(cd.indirectSurvey?.responses || {}).some((r) => Object.values(r).some((v) => v > 0)); },
    (cd, r) => !!r,
    (cd, r) => !!r,
  ];
  return checks[step]?.(courseData, report) ?? false;
}

export default function Layout({ children }) {
  const { faculty, logout, courseData, report } = useApp();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="app-shell" style={{ gridTemplateColumns: collapsed ? "60px 1fr" : "260px 1fr" }}>
      <aside
        className="sidebar"
        style={{
          width: collapsed ? 60 : 260,
          transition: "width 0.2s ease",
          overflow: "hidden",
          padding: collapsed ? "16px 8px" : "24px 18px",
        }}
      >
        {/* Brand + toggle */}
        <div className="brand-block" style={{ justifyContent: collapsed ? "center" : "flex-start" }}>
          {!collapsed && (
            <>
              <div className="brand-mark">NBA</div>
              <div>
                <strong>Accreditation</strong>
                <small>CO-PO System</small>
              </div>
            </>
          )}
          {collapsed && <div className="brand-mark">N</div>}
        </div>

        {/* Collapse toggle button */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          style={{
            background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 6,
            color: "#fff", cursor: "pointer", padding: "6px",
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "100%", marginBottom: 8,
          }}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!collapsed && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600 }}></span>}
        </button>

        <nav className="sidebar-nav">
          {NAV.map(({ to, icon: Icon, label, step }) => {
            const done = stepDone(step, courseData, report);
            return (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
                title={collapsed ? label : undefined}
                style={{ justifyContent: collapsed ? "center" : "flex-start", padding: collapsed ? "10px 0" : "9px 12px" }}
              >
                <Icon size={15} />
                {!collapsed && <span style={{ flex: 1 }}>{label}</span>}
                {!collapsed && done && <CheckCircle size={13} color="#2a9d8f" />}
                {collapsed && done && (
                  <span style={{ position: "absolute", top: 6, right: 6, width: 7, height: 7, borderRadius: "50%", background: "#2a9d8f" }} />
                )}
              </NavLink>
            );
          })}
        </nav>

        {!collapsed && courseData?.course?.courseName && (
          <div className="sidebar-course-badge">
            <span className="eyebrow">Active Course</span>
            <strong>{courseData.course.courseName}</strong>
            {courseData.course.courseCode && <small>{courseData.course.courseCode}</small>}
          </div>
        )}

        <div className="faculty-box" style={{ alignItems: collapsed ? "center" : "flex-start" }}>
          <User size={16} />
          {!collapsed && (
            <>
              <strong>{faculty?.name || "Faculty"}</strong>
              <span>{faculty?.email}</span>
            </>
          )}
          <button
            className="secondary logout-button"
            onClick={handleLogout}
            title="Logout"
            style={{ padding: collapsed ? "6px" : undefined }}
          >
            <LogOut size={15} />
            {!collapsed && " Logout"}
          </button>
        </div>
      </aside>

      <main className="workspace">{children}</main>
    </div>
  );
}
