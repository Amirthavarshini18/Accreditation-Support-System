import math


DEFAULT_COURSE_DATA = {
    "course": {
        "courseName": "Professional Ethics and Sustainable Engineering",
        "courseCode": "PESE401",
        "academicYear": "2025-26",
        "semester": "4",
        "programme": "B.Tech",
        "specialization": "Computer Science and Engineering",
        "courseYear": "II",
        "courseSemester": "IV",
        "credits": "3",
        "faculty": "Faculty Coordinator",
    },
    "cos": [
        {"id": "CO1", "description": "Apply engineering knowledge to solve contextual problems.", "target": 60},
        {"id": "CO2", "description": "Analyse professional responsibilities using GAPC 4.0 attributes.", "target": 60},
        {"id": "CO3", "description": "Evaluate sustainable solutions mapped to SDGs.", "target": 60},
        {"id": "CO4", "description": "Communicate technical findings with ethical reasoning.", "target": 60},
        {"id": "CO5", "description": "Demonstrate independent learning and teamwork.", "target": 60},
    ],
    "pos": ["PO1", "PO2", "PO3", "PO4", "PO5", "PO6", "PO7", "PO8", "PO9", "PO10", "PO11"],
    "evaluationPolicy": {
        "interimTest": 35,
        "endExam": 50,
        "continuousEvaluation": 15,
        "other": 0,
    },
    "mapping": {
        "CO1": {"PO1": 3, "PO2": 2, "PO3": 3, "PO4": 2, "PO5": 0, "PO6": 0, "PO7": 0, "PO8": 0, "PO9": 0, "PO10": 0, "PO11": 0},
        "CO2": {"PO1": 3, "PO2": 3, "PO3": 3, "PO4": 2, "PO5": 0, "PO6": 0, "PO7": 0, "PO8": 0, "PO9": 0, "PO10": 0, "PO11": 0},
        "CO3": {"PO1": 3, "PO2": 1, "PO3": 3, "PO4": 2, "PO5": 1, "PO6": 0, "PO7": 0, "PO8": 0, "PO9": 0, "PO10": 0, "PO11": 0},
        "CO4": {"PO1": 3, "PO2": 3, "PO3": 3, "PO4": 2, "PO5": 1, "PO6": 0, "PO7": 0, "PO8": 0, "PO9": 0, "PO10": 0, "PO11": 0},
        "CO5": {"PO1": 0, "PO2": 0, "PO3": 0, "PO4": 0, "PO5": 0, "PO6": 0, "PO7": 0, "PO8": 0, "PO9": 0, "PO10": 0, "PO11": 0},
    },
    "assessments": [],
    "students": [],
    "indirectSurvey": {
        "scale": {"VH": 5, "H": 4, "M": 3, "L": 2, "VL": 1},
        "responses": {
            "CO1": {"VH": 0, "H": 0, "M": 0, "L": 0, "VL": 0},
            "CO2": {"VH": 0, "H": 0, "M": 0, "L": 0, "VL": 0},
            "CO3": {"VH": 0, "H": 0, "M": 0, "L": 0, "VL": 0},
            "CO4": {"VH": 0, "H": 0, "M": 0, "L": 0, "VL": 0},
            "CO5": {"VH": 0, "H": 0, "M": 0, "L": 0, "VL": 0},
        },
    },
}


def safe_float(value, default=0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def calculate_attainment_level(percentage):
    """
    Linear interpolation:
      >= 85%  -> 3
      50-85%  -> 2 + (pct - 50) / (85 - 50)
      30-50%  -> 1 + (pct - 30) / (50 - 30)
      < 30%   -> 0
    """
    if percentage >= 85:
        return 3
    elif percentage >= 50:
        return round(2 + (percentage - 50) / (85 - 50), 2)
    elif percentage >= 30:
        return round(1 + (percentage - 30) / (50 - 30), 2)
    return 0


def calculate_po_attainment(co_scores, mappings):
    """
    Weighted average: PO_score = sum(CO_score * mapping_weight) / sum(mapping_weight)
    """
    po_totals = {}
    po_weights = {}
    for co, po_map in mappings.items():
        co_score = co_scores.get(co, 0)
        for po, weight in po_map.items():
            if weight == 0:
                continue
            po_totals[po] = po_totals.get(po, 0) + co_score * weight
            po_weights[po] = po_weights.get(po, 0) + weight
    return {po: round(po_totals[po] / po_weights[po], 2) for po in po_totals}


def calculate_indirect_attainment(cos, pos, mappings, indirect_survey):
    scale = indirect_survey.get("scale", {"VH": 5, "H": 4, "M": 3, "L": 2, "VL": 1})
    responses = indirect_survey.get("responses", {})
    co_scores = {}
    co_results = []

    for co in cos:
        co_id = co.get("id")
        counts = responses.get(co_id, {})
        total = sum(safe_float(counts.get(label)) for label in scale)
        weighted_total = sum(
            safe_float(counts.get(label)) * safe_float(value)
            for label, value in scale.items()
        )
        grading_index = round(weighted_total / total, 2) if total else 0
        score = round((grading_index / max(scale.values())) * 3, 2) if scale else 0
        co_scores[co_id] = score
        co_results.append({
            "co": co_id,
            "counts": {label: safe_float(counts.get(label)) for label in scale},
            "total": total,
            "gradingIndex": grading_index,
            "score": score,
        })

    po_scores = calculate_po_attainment(co_scores, mappings)
    for po in pos:
        po_scores.setdefault(po, 0)

    return {"scale": scale, "coResults": co_results, "poScores": po_scores}


def _parse_co_ids(co_value):
    """Parse single or multi-CO value like 'CO1', 'CO1,CO2', 'CO1/CO2'."""
    parts = [p.strip().upper() for p in str(co_value or "").replace("/", ",").split(",") if p.strip()]
    return [p for p in parts if p.startswith("CO") and p[2:].isdigit()]


def _build_co_marks_from_assessments(cos, assessments, students):
    """
    Build per-student scaled CO marks from all assessments.

    The question 'id' field in each assessment is the uid produced by
    parse_marks_workbook (e.g. 'Quiz1__CO1').  Student rawMarks use the
    same uid as key, so lookup is direct.

    Assignment questions (label starts with 'A') carry 0.75 weight.
    Weightages are normalised to sum to 100.
    """
    def _q_weight(label):
        return 0.75 if str(label).strip().upper().startswith("A") else 1.0

    total_weight = sum(safe_float(a.get("weightage", 0)) for a in assessments) or 100

    # question_lookup: uid -> info dict
    question_lookup = {}
    for assessment in assessments:
        raw_weight = safe_float(assessment.get("weightage", 100))
        a_weight = raw_weight * 100 / total_weight  # normalised
        qs = assessment.get("questions", [])

        # effective total for this assessment = sum(splitMax * qWeight)
        # splitMax is already stored in maxMarks (raw / splitCount)
        effective_total = sum(
            safe_float(q.get("maxMarks") or q.get("rawMaxMarks")) * _q_weight(q.get("label") or q.get("id", ""))
            for q in qs
        )
        scale_factor = (a_weight / effective_total) if effective_total else 1.0

        for q in qs:
            uid = q.get("id")
            split_max = safe_float(q.get("maxMarks") or q.get("rawMaxMarks"))
            qw = _q_weight(q.get("label") or uid)
            question_lookup[uid] = {
                "co": q.get("co"),
                "splitMax": split_max,          # already split by CO count
                "scaledMax": round(split_max * qw * scale_factor, 4),
                "scaleFactor": scale_factor,
                "qWeight": qw,
            }

    # Per CO: total scaled max marks
    co_max = {}
    for co in cos:
        co_id = co.get("id")
        co_max[co_id] = round(
            sum(v["scaledMax"] for v in question_lookup.values() if v["co"] == co_id), 2
        )

    # Per student per CO: scaled marks attained
    student_co_marks = []
    for student in students:
        raw_marks = student.get("rawMarks") or student.get("marks") or {}
        co_attained = {}
        for co in cos:
            co_id = co.get("id")
            attained = 0.0
            for uid, qinfo in question_lookup.items():
                if qinfo["co"] != co_id:
                    continue
                # rawMarks[uid] already holds the split value (raw / splitCount)
                raw = safe_float(raw_marks.get(uid))
                attained += raw * qinfo["qWeight"] * qinfo["scaleFactor"]
            co_attained[co_id] = round(attained, 2)
        student_co_marks.append(co_attained)

    return co_max, student_co_marks


def calculate_course_attainment(payload):
    course = payload.get("course", {})
    cos = payload.get("cos", [])
    pos = payload.get("pos", [])
    assessments = payload.get("assessments", [])
    students = payload.get("students", [])
    mappings = payload.get("mapping", {})
    indirect_survey = payload.get("indirectSurvey", {})
    modes = payload.get("attainmentModes", {"direct": True, "indirect": True})

    total_students = len(students)

    # Build scaled CO marks
    co_max, student_co_marks = _build_co_marks_from_assessments(cos, assessments, students)

    co_results = []
    co_scores = {}

    for co in cos:
        co_id = co.get("id")
        target = safe_float(co.get("target"), 60)
        max_marks = co_max.get(co_id, 0)

        attained_count = 0
        student_breakup = []

        for i, student in enumerate(students):
            obtained = student_co_marks[i].get(co_id, 0) if i < len(student_co_marks) else 0
            percentage = round((obtained / max_marks) * 100, 2) if max_marks else 0
            achieved = percentage >= target
            if achieved:
                attained_count += 1
            student_breakup.append({
                "registerNumber": student.get("registerNumber", ""),
                "name": student.get("name", ""),
                "obtained": obtained,
                "maxMarks": max_marks,
                "percentage": percentage,
                "achieved": achieved,
            })

        attainment_percentage = round((attained_count / total_students) * 100, 2) if total_students else 0
        score = calculate_attainment_level(attainment_percentage)
        co_scores[co_id] = score

        co_results.append({
            "co": co_id,
            "description": co.get("description", ""),
            "target": target,
            "studentsAttained": attained_count,
            "totalStudents": total_students,
            "attainmentPercentage": attainment_percentage,
            "score": score,
            "maxMarks": max_marks,
            "studentBreakup": student_breakup,
        })

    direct_po_scores = calculate_po_attainment(co_scores, mappings) if modes.get("direct", True) else {}
    indirect = (
        calculate_indirect_attainment(cos, pos, mappings, indirect_survey)
        if modes.get("indirect", True)
        else {
            "scale": indirect_survey.get("scale", {"VH": 5, "H": 4, "M": 3, "L": 2, "VL": 1}),
            "coResults": [],
            "poScores": {},
        }
    )

    po_scores = {}
    for po in pos:
        direct_val = direct_po_scores.get(po, 0)
        indirect_val = indirect.get("poScores", {}).get(po, 0)
        if modes.get("direct", True) and modes.get("indirect", True):
            po_scores[po] = round(direct_val * 0.8 + indirect_val * 0.2, 2)
        elif modes.get("indirect", True):
            po_scores[po] = indirect_val
        else:
            po_scores[po] = direct_val

    # CO-PO contribution breakdown
    po_contributions = {}
    for po in pos:
        po_weight = sum(safe_float(mappings.get(co.get("id"), {}).get(po)) for co in cos)
        po_contributions[po] = {}
        for co in cos:
            co_id = co.get("id")
            weight = safe_float(mappings.get(co_id, {}).get(po))
            contribution = (co_scores.get(co_id, 0) * weight / po_weight) if po_weight else 0
            po_contributions[po][co_id] = round(contribution, 2)

    return {
        "course": course,
        "summary": {
            "totalStudents": total_students,
            "totalCOs": len(cos),
            "totalPOs": len(pos),
            "averageCOScore": round(sum(co_scores.values()) / len(co_scores), 2) if co_scores else 0,
            "averagePOScore": round(sum(po_scores.values()) / len(po_scores), 2) if po_scores else 0,
        },
        "coResults": co_results,
        "poScores": po_scores,
        "directPoScores": direct_po_scores,
        "indirect": indirect,
        "poContributions": po_contributions,
        "mapping": mappings,
        "pos": pos,
        "assessments": assessments,
        "students": students,
        "attainmentModes": modes,
        "attainmentRubric": [
            {"level": 3, "percentage": 85},
            {"level": 2, "percentage": 50},
            {"level": 1, "percentage": 30},
        ],
    }
