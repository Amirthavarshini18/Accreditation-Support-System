export const API_BASE = "http://127.0.0.1:8000/api";

export const NBA_POS = [
  { id: "PO1",  label: "Engineering Knowledge" },
  { id: "PO2",  label: "Problem Analysis" },
  { id: "PO3",  label: "Design / Development of Solutions" },
  { id: "PO4",  label: "Conduct Investigations of Complex Problems" },
  { id: "PO5",  label: "Engineering Tool Usage" },
  { id: "PO6",  label: "The Engineer and the World" },
  { id: "PO7",  label: "Ethics" },
  { id: "PO8",  label: "Individual and Collaborative Team Work" },
  { id: "PO9",  label: "Communication" },
  { id: "PO10", label: "Project Management and Finance" },
  { id: "PO11", label: "Life-Long Learning" },
  { id: "PSO1", label: "Research and Development" },
  { id: "PSO2", label: "Sustainable Development" },
];

// Washington Knowledge indicators (full descriptions per Washington Accord)
export const WK_LIST = [
  { id: "WK1", label: "A systematic, theory-based understanding of the natural sciences applicable to the discipline and awareness of relevant social sciences" },
  { id: "WK2", label: "Conceptually-based mathematics, numerical analysis, data analysis, statistics and formal aspects of computer and information science to support detailed analysis and modelling" },
  { id: "WK3", label: "A systematic, theory-based formulation of engineering fundamentals required in the engineering discipline" },
  { id: "WK4", label: "Engineering specialist knowledge that provides theoretical frameworks and bodies of knowledge for the accepted practice areas in the engineering discipline" },
  { id: "WK5", label: "Knowledge of efficient resource use, environmental impacts, whole-life cost, reuse of resources, net zero carbon, and similar concepts supporting engineering design and operations" },
  { id: "WK6", label: "Knowledge of engineering practice (technology) in the practice areas in the engineering discipline" },
  { id: "WK7", label: "Knowledge of the role of engineering in society and identified issues in engineering practice, including the professional responsibility of an engineer to public safety and sustainable development" },
  { id: "WK8", label: "Engagement with selected knowledge in the current research literature; awareness of the power of critical thinking and creative approaches to evaluate emerging issues" },
  { id: "WK9", label: "Ethics, inclusive behaviour and conduct. Knowledge of professional ethics, responsibilities, and norms of engineering practice. Awareness of the need for diversity and inclusive attitude" },
];

// Fixed PO→WK relationships per Washington Accord (PO1–PO11)
// PO4, PO7–PO11 have no WK-based derivation (they are assessed directly)
export const PO_WK_MAP_FIXED = {
  PO1:  ["WK1", "WK2", "WK3", "WK4"],
  PO2:  ["WK1", "WK2", "WK3", "WK4"],
  PO3:  ["WK5"],
  PO4:  ["WK8"],
  PO5:  ["WK2", "WK6"],
  PO6:  ["WK1", "WK5", "WK7"],
  PO7:  ["WK9"],
  PO8:  [],
  PO9:  [],
  PO10: [],
  PO11: ["WK8"],
};

// Default PSO WK mappings — configurable per course by faculty
// PSO1 maps WK1–WK4 per spec; PSO2 maps WK5–WK8
export const PSO_WK_DEFAULTS = {
  PSO1: ["WK1", "WK2", "WK3", "WK4"],
  PSO2: ["WK5", "WK6", "WK7", "WK8"],
};

// Full PO_WK_MAP used for derivation — PSO values are injected at runtime from courseData.psoWkMap
export const PO_WK_MAP = {
  ...PO_WK_MAP_FIXED,
  ...PSO_WK_DEFAULTS,
};

// Performance Indicators per PO (exact text from Washington Accord / NBA spec)
export const PO_COMPETENCIES = {
  PO1: [
    { id: "1.1", label: "Demonstrate competence in mathematical modelling", pis: [
      { id: "1.1.1", label: "Apply mathematical techniques such as calculus, linear algebra, and statistics to solve problems" },
      { id: "1.1.2", label: "Apply advanced mathematical techniques to model and solve civil engineering problems" },
    ]},
    { id: "1.2", label: "Demonstrate competence in basic sciences", pis: [
      { id: "1.2.1", label: "Apply laws of natural science to an engineering problem" },
    ]},
    { id: "1.3", label: "Demonstrate competence in engineering fundamentals", pis: [
      { id: "1.3.1", label: "Apply fundamental civil engineering concepts to solve engineering problems" },
    ]},
    { id: "1.4", label: "Demonstrate competence in specialized engineering knowledge to the program", pis: [
      { id: "1.4.1", label: "Apply civil engineering concepts to solve engineering problems" },
    ]},
  ],
  PO2: [
    { id: "2.1", label: "Demonstrate an ability to identify and formulate complex engineering problem", pis: [
      { id: "2.1.1", label: "Articulate problem statements and identify objectives" },
      { id: "2.1.2", label: "Identify engineering systems, variables, and parameters to solve the problems" },
      { id: "2.1.3", label: "Identify the mathematical, engineering and other relevant knowledge that applies to a given problem" },
    ]},
    { id: "2.2", label: "Demonstrate an ability to formulate a solution plan and methodology for an engineering problem with due considerations for sustainable development", pis: [
      { id: "2.2.1", label: "Reframe complex problems into interconnected sub-problems" },
      { id: "2.2.2", label: "Identify, assemble and evaluate information and resources" },
      { id: "2.2.3", label: "Identify existing processes/solution methods for solving the problem, including forming justified approximations and assumptions" },
      { id: "2.2.4", label: "Compare and contrast alternative solution processes to select the best process that can also satisfy the technical, socio-economic and environmental dimensions of sustainability" },
    ]},
    { id: "2.3", label: "Demonstrate an ability to formulate and interpret a model", pis: [
      { id: "2.3.1", label: "Combine scientific principles and engineering concepts to formulate model/s (mathematical or otherwise) of a system or process that is appropriate in terms of applicability and required accuracy" },
      { id: "2.3.2", label: "Identify assumptions (mathematical and physical) necessary to allow modeling of a system at the level of accuracy required" },
    ]},
    { id: "2.4", label: "Demonstrate an ability to execute a solution process and analyze results", pis: [
      { id: "2.4.1", label: "Apply engineering mathematics and computations to solve mathematical models" },
      { id: "2.4.2", label: "Produce and validate results through skillful use of contemporary engineering tools and models" },
      { id: "2.4.3", label: "Identify sources of error in the solution process, and limitations of the solution" },
    ]},
  ],
  PO3: [
    { id: "3.1", label: "Demonstrate an ability to define a complex/open-ended problem in engineering terms", pis: [
      { id: "3.1.1", label: "Recognize that need analysis is key to good problem definition" },
      { id: "3.1.2", label: "Elicit and document engineering requirements from stakeholders" },
      { id: "3.1.3", label: "Synthesize engineering requirements from a review of the state-of-the-art" },
      { id: "3.1.4", label: "Extract engineering requirements from relevant engineering Codes and Standards such as ASME, ASTM, BIS, ISO and ASHRAE" },
      { id: "3.1.5", label: "Explore and synthesize engineering requirements considering health, safety risks, environmental, cultural and societal issues" },
      { id: "3.1.6", label: "Determine design objectives, functional requirements and arrive at specifications" },
    ]},
    { id: "3.2", label: "Demonstrate an ability to generate a diverse set of alternative design solutions", pis: [
      { id: "3.2.1", label: "Apply formal idea generation tools to develop multiple engineering design solutions" },
      { id: "3.2.2", label: "Build models/prototypes to develop a diverse set of design solutions" },
      { id: "3.2.3", label: "Identify suitable criteria for the evaluation of alternate design solutions" },
    ]},
    { id: "3.3", label: "Demonstrate an ability to select an optimal design scheme for further development", pis: [
      { id: "3.3.1", label: "Apply formal decision-making tools to select optimal engineering design solutions for further development" },
      { id: "3.3.2", label: "Consult with domain experts and stakeholders to select candidate engineering design solution for further development" },
    ]},
    { id: "3.4", label: "Demonstrate an ability to advance an engineering design with consideration for public health and safety, whole-life cost, net-zero", pis: [
      { id: "3.4.1", label: "Refine a conceptual design into a detailed design within the existing constraints, with consideration for public health and safety, whole-life cost, net-zero carbon, culture, society and environment" },
    ]},
  ],
  PO4: [
    { id: "4.1", label: "Demonstrate an ability to conduct investigations of technical issues consistent with their level of knowledge and understanding", pis: [
      { id: "4.1.1", label: "Define a problem, its scope and importance for purposes of investigation" },
      { id: "4.1.2", label: "Examine the relevant methods, tools and techniques of experiment design, system calibration, data acquisition, analysis and presentation" },
      { id: "4.1.3", label: "Apply appropriate instrumentation and/or software tools to make measurements of physical quantities" },
      { id: "4.1.4", label: "Establish a relationship between measured data and underlying physical principles" },
    ]},
    { id: "4.2", label: "Demonstrate an ability to design experiments to solve open-ended problems", pis: [
      { id: "4.2.1", label: "Design and develop an experimental approach, specify appropriate equipment and procedures" },
      { id: "4.2.2", label: "Understand the importance of the statistical design of experiments and choose an appropriate experimental design plan based on the study objectives" },
    ]},
    { id: "4.3", label: "Demonstrate an ability to analyze data and reach a valid conclusion", pis: [
      { id: "4.3.1", label: "Use appropriate procedures, tools and techniques to conduct experiments and collect data" },
      { id: "4.3.2", label: "Analyze data for trends and correlations, stating possible errors and limitations" },
      { id: "4.3.3", label: "Represent data in tabular/graphical formats, so as to facilitate analysis and explanation of data, and drawing of conclusions" },
    ]},
  ],
  PO5: [
    { id: "5.1", label: "Demonstrate an ability to identify/create modern engineering tools, techniques and resources", pis: [
      { id: "5.1.1", label: "Identify modern engineering tools such as computer-aided drafting, modeling and analysis; techniques and resources for engineering activities" },
      { id: "5.1.2", label: "Create/adapt/modify/extend tools and techniques to solve engineering problems" },
    ]},
    { id: "5.2", label: "Demonstrate an ability to select and apply discipline specific tools, techniques and resources", pis: [
      { id: "5.2.1", label: "Identify the strengths and limitations of tools for (i) acquiring information, (ii) modeling and simulating, (iii) monitoring system performance, and (iv) creating engineering designs" },
      { id: "5.2.2", label: "Demonstrate proficiency in using discipline-specific tools" },
    ]},
    { id: "5.3", label: "Demonstrate an ability to evaluate the suitability and limitations of tools used to solve an engineering problem", pis: [
      { id: "5.3.1", label: "Discuss limitations and validate tools, techniques and resources" },
      { id: "5.3.2", label: "Verify the credibility of results from tool use with reference to the accuracy and limitations, and the assumptions inherent in their use" },
    ]},
  ],
  PO6: [
    { id: "6.1", label: "Demonstrate an ability to describe engineering roles in a broader context, e.g. pertaining to the environment, health, safety, legal and public welfare", pis: [
      { id: "6.1.1", label: "Identify and describe various engineering roles; particularly for its impact on sustainability with reference to economy, health, safety, legal framework, culture and environment" },
    ]},
    { id: "6.2", label: "Demonstrate an understanding of professional engineering regulations, legislation and standards", pis: [
      { id: "6.2.1", label: "Interpret legislation, regulations, codes, and standards relevant to your discipline and explain its contribution to the protection of the public and public interest at the global, regional and local level" },
    ]},
    { id: "6.3", label: "Demonstrate an understanding of the impact of engineering and industrial practices on social, environmental and in economic contexts", pis: [
      { id: "6.3.1", label: "Identify risks/impacts in the life-cycle of an engineering product or activity" },
      { id: "6.3.2", label: "Understand the relationship between the technical, socio-economic and environmental dimensions of sustainability" },
    ]},
  ],
  PO7: [
    { id: "7.1", label: "Demonstrate an ability to recognize ethical dilemmas", pis: [
      { id: "7.1.1", label: "Identify situations of unethical professional conduct and propose ethical alternatives in the norms for engineering practice" },
      { id: "7.1.2", label: "Understand the need for diversity by reason of ethnicity, gender, age, physical ability etc. with mutual understanding and respect and inclusive attitudes" },
    ]},
    { id: "7.2", label: "Demonstrate an ability to apply the Code of Ethics", pis: [
      { id: "7.2.1", label: "Identify tenets of the ASME professional code of ethics" },
      { id: "7.2.2", label: "Examine and apply moral and ethical principles to known case studies" },
    ]},
  ],
  PO8: [
    { id: "8.1", label: "Demonstrate an ability to form a team and define a role for each member", pis: [
      { id: "8.1.1", label: "Recognize a variety of working and learning preferences; appreciate the value of diversity on a team" },
      { id: "8.1.2", label: "Implement the norms of practice (e.g. rules, roles, charters, agendas, etc.) of effective team work, to accomplish a goal" },
    ]},
    { id: "8.2", label: "Demonstrate effective individual and team operations — communication, problem-solving, conflict resolution and leadership skills", pis: [
      { id: "8.2.1", label: "Demonstrate effective communication, problem-solving, conflict resolution and leadership skills" },
      { id: "8.2.2", label: "Treat other team members respectfully" },
      { id: "8.2.3", label: "Listen to other members" },
      { id: "8.2.4", label: "Maintain composure in difficult situations" },
    ]},
    { id: "8.3", label: "Demonstrate success in a team-based project", pis: [
      { id: "8.3.1", label: "Present results as a team, with smooth integration of contributions from all individual efforts" },
    ]},
  ],
  PO9: [
    { id: "9.1", label: "Demonstrate an ability to comprehend technical literature and document project work", pis: [
      { id: "9.1.1", label: "Read, understand and interpret technical and non-technical information" },
      { id: "9.1.2", label: "Produce clear, well-constructed, and well-supported written engineering documents" },
      { id: "9.1.3", label: "Create flow in a document or presentation — a logical progression of ideas so that the main point is clear" },
    ]},
    { id: "9.2", label: "Demonstrate competence in listening, speaking, and presentation", pis: [
      { id: "9.2.1", label: "Listen to and comprehend information, instructions, and viewpoints of others" },
      { id: "9.2.2", label: "Deliver effective oral presentations to technical and non-technical audiences" },
    ]},
    { id: "9.3", label: "Demonstrate the ability to integrate different modes of communication", pis: [
      { id: "9.3.1", label: "Create engineering-standard figures, reports and drawings to complement writing and presentations" },
      { id: "9.3.2", label: "Use a variety of media effectively to convey a message in a document or a presentation" },
    ]},
  ],
  PO10: [
    { id: "10.1", label: "Demonstrate an ability to evaluate the economic and financial performance of an engineering activity", pis: [
      { id: "10.1.1", label: "Describe various economic and financial costs/benefits of an engineering activity" },
      { id: "10.1.2", label: "Analyze different forms of financial statements to evaluate the financial status of an engineering project" },
    ]},
    { id: "10.2", label: "Demonstrate an ability to compare and contrast the costs/benefits of alternate proposals for an engineering activity", pis: [
      { id: "10.2.1", label: "Analyze and select the most appropriate proposal based on economic and financial considerations" },
    ]},
    { id: "10.3", label: "Demonstrate an ability to plan/manage an engineering activity within time and budget constraints", pis: [
      { id: "10.3.1", label: "Identify the tasks required to complete an engineering activity, and the resources required to complete the tasks" },
      { id: "10.3.2", label: "Use project management tools to schedule an engineering project, so it is completed on time and on budget" },
    ]},
  ],
  PO11: [
    { id: "11.1", label: "Demonstrate an ability to identify gaps in knowledge and a strategy to close these gaps", pis: [
      { id: "11.1.1", label: "Describe the rationale for the requirement for continuing professional development" },
      { id: "11.1.2", label: "Identify deficiencies or gaps in knowledge and demonstrate an ability to source information to close this gap" },
    ]},
    { id: "11.2", label: "Demonstrate an ability to identify changing trends in engineering knowledge and practice", pis: [
      { id: "11.2.1", label: "Identify historic points of technological advance in engineering that required practitioners to seek education in order to stay updated with the current technologies" },
      { id: "11.2.2", label: "Recognize the need and be able to clearly explain why it is vitally important to keep current regarding new developments in your field" },
    ]},
    { id: "11.3", label: "Demonstrate an ability to identify and access sources for new information", pis: [
      { id: "11.3.1", label: "Source and comprehend technical literature and other credible sources of information" },
      { id: "11.3.2", label: "Analyze sourced technical and popular information for feasibility, viability, sustainability, etc." },
    ]},
  ],
  PSO1: [
    { id: "PSO1.1", label: "Problem Identification & Formulation: Ability to recognize civil engineering and infrastructure problems and frame them into researchable questions", pis: [
      { id: "PSO1.1.1", label: "Articulate clear research objectives and hypotheses" },
      { id: "PSO1.1.2", label: "Demonstrate ability to review and synthesize literature to define gaps" },
    ]},
    { id: "PSO1.2", label: "Research Methodology Application: Ability to design experiments, adopt analytical methods, and apply modern tools for investigation", pis: [
      { id: "PSO1.2.1", label: "Design appropriate experimental setups or computational models" },
      { id: "PSO1.2.2", label: "Select and apply suitable statistical/analytical tools" },
    ]},
    { id: "PSO1.3", label: "Solution Development & Validation: Ability to propose innovative solutions and validate them through simulation, modelling, or experimental studies", pis: [
      { id: "PSO1.3.1", label: "Develop prototypes, models, or frameworks addressing civil engineering challenges" },
      { id: "PSO1.3.2", label: "Validate solutions using experimental data, simulations, or case studies" },
    ]},
    { id: "PSO1.4", label: "Knowledge Creation & Dissemination: Ability to generate new knowledge, publish findings, and contribute to the advancement of civil engineering practices", pis: [
      { id: "PSO1.4.1", label: "Prepare technical reports, theses, or publications in peer-reviewed journals/conferences" },
      { id: "PSO1.4.2", label: "Present research outcomes effectively to academic and professional audiences" },
    ]},
  ],
  PSO2: [
    { id: "PSO2.1", label: "Teamwork & Collaboration: Ability to work effectively in multi-disciplinary teams, respecting diverse perspectives", pis: [
      { id: "PSO2.1.1", label: "Participates actively in group projects with peers from different disciplines" },
      { id: "PSO2.1.2", label: "Demonstrates respect for diverse viewpoints and integrates them into solutions" },
    ]},
    { id: "PSO2.2", label: "Application of Civil Engineering Principles: Ability to apply core civil engineering knowledge to address sustainability challenges", pis: [
      { id: "PSO2.2.1", label: "Apply structural, transportation, water resources, environmental and geotechnical knowledge to sustainable design" },
      { id: "PSO2.2.2", label: "Use engineering fundamentals to solve real-world sustainability problems" },
    ]},
    { id: "PSO2.3", label: "Integration of Sustainability Concepts: Ability to incorporate environmental, social, and economic sustainability principles into engineering solutions", pis: [
      { id: "PSO2.3.1", label: "Design solutions that minimize environmental impact and optimize resource use" },
      { id: "PSO2.3.2", label: "Consider social equity and economic feasibility in project outcomes" },
    ]},
    { id: "PSO2.4", label: "Communication & Leadership: Ability to communicate ideas clearly and demonstrate leadership in collaborative projects", pis: [
      { id: "PSO2.4.1", label: "Prepare clear technical reports and presentations for diverse audiences" },
      { id: "PSO2.4.2", label: "Take initiative in coordinating tasks and guiding team members" },
    ]},
    { id: "PSO2.5", label: "Ethical & Responsible Practice: Ability to uphold professional ethics and responsibility in sustainable development initiatives", pis: [
      { id: "PSO2.5.1", label: "Adheres to codes of conduct and professional ethics in project execution" },
      { id: "PSO2.5.2", label: "Demonstrate awareness of long-term societal and environmental impacts" },
    ]},
  ],
};

/**
 * Derive POs from checked WKs using the effective PO→WK map.
 * psoWkMap: { PSO1: [...], PSO2: [...] } from courseData (course-specific overrides)
 */
export function derivePOsFromWKs(coWks, psoWkMap) {
  const effectiveMap = {
    ...PO_WK_MAP_FIXED,
    PSO1: psoWkMap?.PSO1 ?? PSO_WK_DEFAULTS.PSO1,
    PSO2: psoWkMap?.PSO2 ?? PSO_WK_DEFAULTS.PSO2,
  };
  return Object.entries(effectiveMap)
    .filter(([, wks]) => wks.length > 0 && wks.some((wk) => coWks.includes(wk)))
    .map(([po]) => po);
}

/**
 * Compute mapping strength X and rubric value for one CO-PO pair.
 * X = (Number of Yes / Total PIs) × 100
 * Rubric thresholds from piRubric: t1→1, t2→2, t3→3
 * Returns null (not 0) when X is below t1 — caller must show "—" for null.
 */
export function computeMappingValue(piAnswers, competencies, rubric) {
  const { t1 = 10, t2 = 34, t3 = 68 } = rubric ?? {};
  const allPIs = competencies.flatMap((c) => c.pis);
  if (!allPIs.length) return { x: 0, value: null };
  const yesCount = allPIs.filter((pi) => piAnswers[pi.id] === true).length;
  const x = (yesCount / allPIs.length) * 100;
  let value = null;          // null means "below threshold" → display as "—"
  if (x >= t3) value = 3;
  else if (x >= t2) value = 2;
  else if (x >= t1) value = 1;
  return { x: Math.round(x * 100) / 100, value };
}

export const SDG_LIST = [
  "SDG1: No Poverty", "SDG2: Zero Hunger", "SDG3: Good Health",
  "SDG4: Quality Education", "SDG5: Gender Equality", "SDG6: Clean Water",
  "SDG7: Affordable Energy", "SDG8: Decent Work", "SDG9: Industry & Innovation",
  "SDG10: Reduced Inequalities", "SDG11: Sustainable Cities", "SDG12: Responsible Consumption",
  "SDG13: Climate Action", "SDG14: Life Below Water", "SDG15: Life on Land",
  "SDG16: Peace & Justice", "SDG17: Partnerships",
];

export const SCALE_LABELS = ["VH", "H", "M", "L", "VL"];

export const COURSE_FIELDS = [
  ["courseName",     "Course Name",              "e.g. Highway Engineering"],
  ["courseCode",     "Course Code",              "e.g. CE401"],
  ["academicYear",   "Academic Year",            "e.g. 2025-26"],
  ["semester",       "Semester",                 "e.g. 4"],
  ["programme",      "Programme",                "e.g. B.Tech"],
  ["specialization", "Specialization",           "e.g. Civil Engineering"],
  ["courseYear",     "Course Year",              "e.g. II"],
  ["courseSemester", "Course Semester",          "e.g. IV"],
  ["credits",        "Credits",                  "e.g. 3"],
  ["faculty",        "Faculty Name",             "e.g. Dr. A. Kumar"],
];

export const DEFAULT_EVAL_POLICY = {
  interimTest: 35,
  endExam: 50,
  continuousEvaluation: 15,
  other: 0,
};

export const SLOT_TO_POLICY = { IA: "interimTest", ESE: "endExam", CA: "continuousEvaluation" };

export const GRADING_POLICY = [
  { grade: "S", lower: 85, upper: 100 },
  { grade: "A", lower: 75, upper: 84 },
  { grade: "B", lower: 65, upper: 74 },
  { grade: "C", lower: 55, upper: 64 },
  { grade: "D", lower: 45, upper: 54 },
  { grade: "E", lower: 35, upper: 44 },
  { grade: "F", lower: 0,  upper: 34 },
];

export const DEFAULT_TARGET_GRADE = "C";
export const DEFAULT_TARGET_PCT  = 55;

export function gradeToTarget(grade) {
  const entry = GRADING_POLICY.find((g) => g.grade === grade);
  return entry ? entry.lower : DEFAULT_TARGET_PCT;
}

export const BLOOMS_LEVELS = [
  { id: "Remember",    color: "#e3f2fd", border: "#90caf9", text: "#0d47a1" },
  { id: "Understand",  color: "#e8f5e9", border: "#a5d6a7", text: "#1b5e20" },
  { id: "Apply",       color: "#fff8e1", border: "#ffe082", text: "#f57f17" },
  { id: "Analyse",     color: "#fce4ec", border: "#f48fb1", text: "#880e4f" },
  { id: "Evaluate",    color: "#f3e5f5", border: "#ce93d8", text: "#4a148c" },
  { id: "Create",      color: "#e0f7fa", border: "#80deea", text: "#006064" },
];

export const ATTAINMENT_RUBRIC = [
  { level: 3, percentage: 85 },
  { level: 2, percentage: 50 },
  { level: 1, percentage: 30 },
];
