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
    "pos": ["PO1", "PO2", "PO3", "PO4", "PO5", "PO6", "PO7", "PO8", "PO9", "PO10", "PO11", "PSO1", "PSO2"],
    "evaluationPolicy": {
        "interimTest": 35,
        "endExam": 50,
        "continuousEvaluation": 15,
        "other": 0,
    },
    "mapping": {
        "CO1": {"PO1": 1, "PO2": 1, "PO3": 0, "PO4": 0, "PO5": 1, "PO6": 0, "PO7": 0, "PO8": 0, "PO9": 0, "PO10": 0, "PO11": 0, "PSO1": 1, "PSO2": 1},
        "CO2": {"PO1": 1, "PO2": 1, "PO3": 0, "PO4": 0, "PO5": 1, "PO6": 0, "PO7": 0, "PO8": 0, "PO9": 0, "PO10": 0, "PO11": 0, "PSO1": 1, "PSO2": 1},
        "CO3": {"PO1": 1, "PO2": 1, "PO3": 0, "PO4": 0, "PO5": 1, "PO6": 1, "PO7": 0, "PO8": 0, "PO9": 0, "PO10": 0, "PO11": 0, "PSO1": 1, "PSO2": 1},
        "CO4": {"PO1": 1, "PO2": 1, "PO3": 1, "PO4": 0, "PO5": 1, "PO6": 1, "PO7": 0, "PO8": 0, "PO9": 0, "PO10": 0, "PO11": 0, "PSO1": 0, "PSO2": 1},
        "CO5": {"PO1": 0, "PO2": 0, "PO3": 0, "PO4": 0, "PO5": 0, "PO6": 0, "PO7": 0, "PO8": 0, "PO9": 0, "PO10": 0, "PO11": 0, "PSO1": 0, "PSO2": 0},
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
    Skips entries where weight is 0 or None (null from frontend means no mapping).
    """
    po_totals = {}
    po_weights = {}
    for co, po_map in mappings.items():
        co_score = co_scores.get(co, 0)
        for po, weight in po_map.items():
            # None = below threshold ("—" in UI), 0 = no connection — both skip
            if not weight:
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


def _build_co_marks_from_assessments(cos, assessments, students):
    """
    Build per-student raw CO marks by summing question marks across all assessments.

    Each question entry has:
      - id  (uid): the key used in student rawMarks / marks
      - co: which CO this question maps to
      - maxMarks: already-split max value (rawMaxMarks / splitCount)

    CO total marks  = sum of maxMarks for all questions mapped to that CO,
                      across all assessments.
    Student attained = sum of rawMarks[uid] for those same questions.

    Both sides are summed identically so the percentage is always correct.
    We store a lookup of (assessment_id, uid) -> question so we can also
    compute per-assessment totals if needed in future.
    """
    # Flat list of (assessment_id, uid, co, maxMarks) — one entry per question/CO pair
    question_entries = []
    for assessment in assessments:
        a_id = assessment.get("id", "")
        for q in assessment.get("questions", []):
            uid = q.get("id")
            if not uid:
                continue
            question_entries.append({
                "assessment_id": a_id,
                "uid": uid,
                "co": q.get("co"),
                # Use maxMarks (the already-split value) which maps 1-to-1 with rawMarks[uid].
                # Fall back to rawMaxMarks only if maxMarks is absent (None), not if it is 0.
                "maxMarks": safe_float(
                    q["maxMarks"] if q.get("maxMarks") is not None else q.get("rawMaxMarks")
                ),
            })

    # Per CO: total max marks = sum of all question maxMarks for that CO
    co_max = {}
    for co in cos:
        co_id = co.get("id")
        co_max[co_id] = round(
            sum(e["maxMarks"] for e in question_entries if e["co"] == co_id), 2
        )

    # Per student per CO: sum rawMarks[uid] for every question of that CO
    # rawMarks keys are the uid values from the question list.
    student_co_marks = []
    for student in students:
        raw_marks = student.get("rawMarks") or student.get("marks") or {}
        co_attained = {}
        for co in cos:
            co_id = co.get("id")
            attained = sum(
                safe_float(raw_marks.get(e["uid"]))
                for e in question_entries
                if e["co"] == co_id
            )
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
    pi_rubric = payload.get("piRubric", {"t1": 10, "t2": 34, "t3": 68})

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
                "obtained": round(obtained, 2),
                "maxMarks": round(max_marks, 2),
                "percentage": round(percentage, 2),
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
        po_weight = sum(
            safe_float(mappings.get(co.get("id"), {}).get(po) or 0)
            for co in cos
        )
        po_contributions[po] = {}
        for co in cos:
            co_id = co.get("id")
            raw_w = mappings.get(co_id, {}).get(po)
            weight = safe_float(raw_w) if raw_w is not None else 0
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
        "piRubric": pi_rubric,
    }
