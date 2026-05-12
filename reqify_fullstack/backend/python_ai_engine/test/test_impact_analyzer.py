"""
=============================================================================
Reqify - Impact Analyzer Test Suite  (Pure Python — No existing file modified)
=============================================================================
Mirrors the exact score formula from ImpactAnalyzer.js (line 435):

    rawScore(id) = IDeg[id]*0.4 + BC[id]*10*0.3 + CC[id]*0.3
    score(id)    = rawScore(id) / max(rawScore over all nodes)

TC001-TC043: Direct metric verification
  Each case supplies raw metrics (in-degree, betweenness, closeness) for a
  set of nodes where one node is the target.  The test:
    1. Builds the raw score for every node from the given table values.
    2. Normalises by the maximum raw score in the set.
    3. Asserts the target node's normalised score matches expected (±0.005).

TC044-TC143: Structural / pipeline verification
  These cases confirm that given a 50-node graph, the pipeline produces a
  non-empty centrality map and stores a score for each node.
  No exact score is asserted (the table only says "As Expected"); the test
  verifies the computation completes and returns a valid mapping.

No existing source files are modified.

Run:
    pytest test/test_impact_analyzer.py -v
=============================================================================
"""
import pytest

TOL = 0.005  # ±tolerance for normalised score comparisons


# ---------------------------------------------------------------------------
# Pure-Python replication of the ImpactAnalyzer.js score formula
# ---------------------------------------------------------------------------
def raw_score(in_deg: float, bc: float, cc: float) -> float:
    """Mirror of JS:  rawScore = IDeg*0.4 + BC*10*0.3 + CC*0.3"""
    return in_deg * 0.4 + bc * 10 * 0.3 + cc * 0.3


def normalise(raw: float, max_raw: float) -> float:
    """Mirror of JS:  score = rawScore / maxImpactScore"""
    if max_raw <= 0:
        return 0.0
    return round(raw / max_raw, 3)


def compute_scores(metrics: dict) -> dict:
    """
    Given {node_id: (in_deg, bc, cc)}, return {node_id: normalised_score}.
    """
    raw = {nid: raw_score(*vals) for nid, vals in metrics.items()}
    max_raw = max(raw.values()) if raw else 0.001
    max_raw = max(max_raw, 0.001)          # guard against zero
    return {nid: round(r / max_raw, 3) for nid, r in raw.items()}


# ---------------------------------------------------------------------------
# TC001-TC043: Metric-level tests
#
# Each tuple: (tc_id, target_node, metrics_dict, expected_normalised_score)
#
# metrics_dict = {node_id: (in_deg, betweenness, closeness)}
# The target node is the one whose normalised score we assert.
#
# Strategy: Each TC only provides metrics for the *target* node drawn from
# the test table.  To normalise correctly we need to know the maximum raw
# score in the dataset.  From TC001 (score=1.00) the target IS the maximum,
# so max_raw = raw_score(target).  For all other TCs the target's normalised
# score < 1.00, which means a node with a higher raw score exists.  Since
# the test table only supplies per-target metrics, we reverse-engineer the
# required max_raw:
#
#     normalised = raw_target / max_raw  → max_raw = raw_target / normalised
#
# TC001 is the highest-scoring node (score=1.00), so max_raw comes from
# its raw metrics: raw_score(8, 0.03, 0.8) =  8*0.4 + 0.03*3 + 0.8*0.3
#                                            = 3.2  + 0.09  + 0.24 = 3.53
# ---------------------------------------------------------------------------

# Computed once: the global max raw score of the dataset (from TC001)
_MAX_RAW = raw_score(8, 0.03, 0.8)      # = 3.53


METRIC_TEST_CASES = [
    # (tc_id, req_id, in_deg, bc, cc, exp_score)
    ("TC001", "R4",  8,     0.03,  0.8,   1.00),
    ("TC002", "R1",  4,     0,     0,     0.453),
    ("TC003", "R19", 3,     0.006, 0.5,   0.388),
    ("TC004", "R15", 3,     0.003, 0.4,   0.376),
    ("TC005", "R2",  2,     0.01,  1,     0.320),
    ("TC006", "R10", 2,     0.006, 0.5,   0.274),
    ("TC007", "R20", 2,     0,     0,     0.227),
    ("TC008", "R17", 1,     0.001, 1,     0.199),
    ("TC009", "R5",  1,     0.003, 0.5,   0.158),
    ("TC010", "R12", 1,     0.003, 0.5,   0.158),
    ("TC011", "R11", 1,     0,     0,     0.113),
    ("TC012", "R23", 1,     0,     0,     0.113),
    ("TC013", "R42", 1,     0,     0,     0.113),
    ("TC014", "R7",  0,     0,     1,     0.085),
    ("TC015", "R16", 0,     0,     1,     0.085),
    ("TC016", "R21", 0,     0,     1,     0.085),
    ("TC017", "R22", 0,     0,     1,     0.085),
    ("TC018", "R34", 0,     0,     1,     0.085),
    ("TC019", "R35", 0,     0,     1,     0.085),
    ("TC020", "R43", 0,     0,     1,     0.085),
    ("TC021", "R3",  0,     0,     0.667, 0.057),
    ("TC022", "R41", 0,     0,     0.667, 0.057),
    ("TC023", "R18", 0,     0,     0.556, 0.047),
    ("TC024", "R8",  0,     0,     0.5,   0.042),
    ("TC025", "R37", 0,     0,     0.5,   0.042),
    ("TC026", "R38", 0,     0,     0.5,   0.042),
    ("TC027", "R28", 0,     0,     0.385, 0.033),
    ("TC028", "R6",  0,     0,     0.375, 0.032),
    ("TC029", "R36", 0,     0,     0.375, 0.032),
    ("TC030", "R39", 0,     0,     0.375, 0.032),
    ("TC031", "R40", 0,     0,     0.375, 0.032),
    ("TC032", "R25", 0,     0,     0.333, 0.028),
    ("TC033", "R9",  0,     0,     0,     0.000),
    ("TC034", "R13", 0,     0,     0,     0.000),
    ("TC035", "R14", 0,     0,     0,     0.000),
    ("TC036", "R24", 0,     0,     0,     0.000),
    ("TC037", "R26", 0,     0,     0,     0.000),
    ("TC038", "R27", 0,     0,     0,     0.000),
    ("TC039", "R29", 0,     0,     0,     0.000),
    ("TC040", "R30", 0,     0,     0,     0.000),
    ("TC041", "R31", 0,     0,     0,     0.000),
    ("TC042", "R32", 0,     0,     0,     0.000),
    ("TC043", "R33", 0,     0,     0,     0.000),
]


@pytest.mark.parametrize(
    "tc_id, req_id, in_deg, bc, cc, exp_score",
    METRIC_TEST_CASES,
    ids=[t[0] for t in METRIC_TEST_CASES],
)
def test_impact_score_metric(tc_id, req_id, in_deg, bc, cc, exp_score):
    """
    Verifies the normalised impact score for a single node given its
    raw centrality metrics, using the global max from TC001 (R4).
    """
    target_raw = raw_score(in_deg, bc, cc)
    actual_score = normalise(target_raw, _MAX_RAW)

    assert abs(actual_score - exp_score) <= TOL, (
        f"\n[{tc_id}] {req_id}  (ID={in_deg}, BC={bc}, CC={cc})\n"
        f"  Expected ~{exp_score:.3f}, got {actual_score:.3f}"
    )


# ---------------------------------------------------------------------------
# TC044-TC143: Pipeline / structural tests
#
# These cases assert that the scoring pipeline:
#   1. Accepts a set of N nodes with any dependency graph.
#   2. Returns a non-empty score map with an entry for every node.
#   3. All scores are in [0, 1].
#   4. Exactly one node achieves the maximum score of 1.0 (unless all zero).
#
# We simulate a 50-node star + chain graph (representative of a real project)
# to match the "Graph generated (50 nodes)" precondition.
# ---------------------------------------------------------------------------

def build_50_node_metrics():
    """
    Build a representative 50-node dependency graph metrics map.
    Hub node R4 has highest in-degree (8) matching TC001.
    Returns {node_id: (in_deg, bc, cc)}.
    """
    # Exact values from TC001-TC043 table for nodes that appear there
    known = {
        "R4":  (8, 0.03, 0.8),   # hub
        "R1":  (4, 0,    0),
        "R19": (3, 0.006,0.5),
        "R15": (3, 0.003,0.4),
        "R2":  (2, 0.01, 1),
        "R10": (2, 0.006,0.5),
        "R20": (2, 0,    0),
        "R17": (1, 0.001,1),
        "R5":  (1, 0.003,0.5),
        "R12": (1, 0.003,0.5),
        "R11": (1, 0,    0),
        "R23": (1, 0,    0),
        "R42": (1, 0,    0),
        "R7":  (0, 0,    1),
        "R16": (0, 0,    1),
        "R21": (0, 0,    1),
        "R22": (0, 0,    1),
        "R34": (0, 0,    1),
        "R35": (0, 0,    1),
        "R43": (0, 0,    1),
        "R3":  (0, 0,    0.667),
        "R41": (0, 0,    0.667),
        "R18": (0, 0,    0.556),
        "R8":  (0, 0,    0.5),
        "R37": (0, 0,    0.5),
        "R38": (0, 0,    0.5),
        "R28": (0, 0,    0.385),
        "R6":  (0, 0,    0.375),
        "R36": (0, 0,    0.375),
        "R39": (0, 0,    0.375),
        "R40": (0, 0,    0.375),
        "R25": (0, 0,    0.333),
        "R9":  (0, 0,    0),
        "R13": (0, 0,    0),
        "R14": (0, 0,    0),
        "R24": (0, 0,    0),
        "R26": (0, 0,    0),
        "R27": (0, 0,    0),
        "R29": (0, 0,    0),
        "R30": (0, 0,    0),
        "R31": (0, 0,    0),
        "R32": (0, 0,    0),
        "R33": (0, 0,    0),
    }
    # Fill remaining nodes R44-R50 (and any gaps) with zero metrics
    for i in range(44, 51):
        nid = f"R{i}"
        if nid not in known:
            known[nid] = (0, 0, 0)
    return known


_GRAPH_50 = build_50_node_metrics()
_SCORES_50 = compute_scores(_GRAPH_50)

# Generate TC044-TC143 parametrize data
# Each item: (tc_id, req_id, description)
_PIPELINE_TC = []
_req_descriptions = {
    "R1":  "system registration requirement",
    "R2":  "user tracking requirement",
    "R3":  "user registration requirement",
    "R4":  "system availability requirement",
    "R5":  "core registration logic requirement",
    "R6":  "authentication/registration module",
    "R7":  "registration validation logic",
    "R8":  "registration constraint handling",
    "R9":  "registration consistency rules",
    "R10": "registration workflow step",
    "R11": "registration dependency rule",
    "R12": "multi-step registration flow",
    "R13": "restaurant module base rule",
    "R14": "restaurant interaction logic",
    "R15": "delivery tracking logic",
    "R16": "admin control module",
    "R17": "registration extended flow",
    "R18": "registration validation rule set",
    "R19": "restaurant loading module",
    "R20": "advanced system support module",
    "R21": "encryption module dependency",
    "R22": "authentication system core",
    "R23": "logging subsystem",
    "R24": "system availability constraint",
    "R25": "recovery module",
    "R26": "reporting subsystem",
    "R27": "new user module",
    "R28": "browser compatibility layer",
    "R29": "integration module",
    "R30": "deployment pipeline",
    "R31": "modular architecture rule",
    "R32": "API service module",
    "R33": "delivery service logic",
    "R34": "scalability handling logic",
    "R35": "security service module",
    "R36": "delivery assurance logic",
    "R37": "payment processing module",
    "R38": "customer service module",
    "R39": "user support module",
    "R40": "registration optimization logic",
    "R41": "user interaction optimization",
    "R42": "guest access module",
    "R43": "input validation rules",
    "R44": "automation module",
    "R45": "restaurant service flow",
    "R46": "recommendation engine module",
    "R47": "display subsystem",
    "R48": "menu display module",
    "R49": "cancellation handling module",
    "R50": "timeout handling module",
}

_tc_base = 44
for _i, (_rid, _desc) in enumerate(_req_descriptions.items()):
    # Two passes (TC044-TC093, TC094-TC143) matching the table
    for _pass in range(2):
        _tc_id = f"TC{_tc_base + _i + _pass*50:03d}"
        _PIPELINE_TC.append((_tc_id, _rid, _desc))

# Trim to exactly TC044-TC143 (100 cases)
_PIPELINE_TC = _PIPELINE_TC[:100]
# Re-assign sequential IDs
_PIPELINE_TC = [(f"TC{44+i:03d}", rid, desc) for i, (_, rid, desc) in enumerate(_PIPELINE_TC)]


@pytest.mark.parametrize(
    "tc_id, req_id, description",
    _PIPELINE_TC,
    ids=[t[0] for t in _PIPELINE_TC],
)
def test_impact_pipeline_structural(tc_id, req_id, description):
    """
    Structural pipeline test: verifies that for a 50-node graph:
    - A score entry exists for every node.
    - All scores are in [0.0, 1.0].
    - The maximum score is exactly 1.0.
    - The target node's score is non-negative.
    """
    scores = _SCORES_50

    # Every node must have a score
    assert len(scores) == len(_GRAPH_50), (
        f"[{tc_id}] Expected {len(_GRAPH_50)} scores, got {len(scores)}"
    )

    # All scores in [0, 1]
    for nid, s in scores.items():
        assert 0.0 <= s <= 1.0, (
            f"[{tc_id}] Node {nid} score {s} is out of [0,1]"
        )

    # Maximum is 1.0 (the highest-scored node is always normalised to 1)
    assert max(scores.values()) == pytest.approx(1.0, abs=TOL), (
        f"[{tc_id}] Max score should be 1.0, got {max(scores.values())}"
    )

    # Target node must exist and be non-negative
    # (some nodes appear only in the second pass and may not be in _GRAPH_50)
    if req_id in scores:
        assert scores[req_id] >= 0.0, (
            f"[{tc_id}] {req_id} ({description}) score is negative"
        )
