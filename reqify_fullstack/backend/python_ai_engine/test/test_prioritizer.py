"""
=============================================================================
Reqify - Prioritizer Test Suite  (Direct Module — No API)
=============================================================================
Imports MoscowPrioritizer and HybridPrioritizer directly from:
    modules/Prioritizer/prioritizer.py

How scoring works (reproduced from HybridPrioritizer):
    base_score        = {"Must Have": 100, "Should Have": 75, ...}
    ambiguity_penalty = ambiguity_score * 30
    conflict_penalty  = conflict_score  * 30
    final_score       = base_score - ambiguity_penalty - conflict_penalty

    quality_rating thresholds (ambiguity_score + conflict_score):
        < 0.30  → "Excellent"
        < 0.60  → "Good"
        < 1.00  → "Fair"
        >= 1.00 → "Poor"

Test approach:
  - For "clear, no issues" (TC001–TC023, TC039–TC078):
        ambiguity_score=0, conflict_score=0 → final_score=100, rating="Excellent"
  - For penalised cases (TC024–TC038):
        inject specific ambiguity/conflict scores to match the documented
        expected final_score from the test table.

Run from the python_ai_engine directory:
    pytest test/test_prioritizer.py -v
=============================================================================
"""

import os
import sys
import pytest

# ---------------------------------------------------------------------------
# Path setup
# ---------------------------------------------------------------------------
THIS_DIR   = os.path.dirname(os.path.abspath(__file__))
ENGINE_DIR = os.path.abspath(os.path.join(THIS_DIR, ".."))
if ENGINE_DIR not in sys.path:
    sys.path.insert(0, ENGINE_DIR)

from modules.Prioritizer.prioritizer import MoscowPrioritizer, HybridPrioritizer


# ---------------------------------------------------------------------------
# Session-scoped fixtures (both classes are pure Python — no heavy models)
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def moscow():
    return MoscowPrioritizer()


@pytest.fixture(scope="session")
def hybrid():
    return HybridPrioritizer()


# ---------------------------------------------------------------------------
# Helper: price_single_req
# Runs one requirement through the full pipeline and returns the refined dict.
# ambiguity_score and conflict_score are passed directly (no file I/O).
# ---------------------------------------------------------------------------
def prioritize_one(req_text: str, moscow_obj, hybrid_obj,
                   ambiguity_score: float = 0.0,
                   conflict_score: float = 0.0) -> dict:
    """
    Run a single requirement through MoscowPrioritizer then HybridPrioritizer.
    Ambiguity/Conflict scores are injected directly (no JSON files needed).
    """
    moscow_results = moscow_obj.prioritize_requirements([req_text])

    # Build minimal inline ambiguity/conflict dicts that the hybrid extractor
    # recognises, so we can control the penalty without any saved files.
    ambiguity_data: dict = {}
    conflict_data: dict  = {}

    if ambiguity_score > 0.0:
        ambiguity_data = {
            "results": [{"requirement": req_text, "ambiguity_score": ambiguity_score}]
        }

    if conflict_score > 0.0:
        conflict_data = {
            "results": [
                {
                    "detections": [
                        {
                            "req1_id": 0,
                            "req2_id": 1,
                            # Use issue_type that maps to weight 1.0 for precision
                            "issue_type": "contradiction",
                            "confidence": conflict_score,
                        }
                    ]
                }
            ]
        }

    refined = hybrid_obj.refine_prioritization(
        moscow_results,
        ambiguity_data=ambiguity_data,
        conflict_data=conflict_data,
    )
    return refined[0]


# ---------------------------------------------------------------------------
# TEST DATA
# (tc_id, description, requirement, expected_category,
#  expected_score, expected_rating, ambiguity_score, conflict_score)
#
# For "clear" cases: ambiguity=0, conflict=0 → score=100, rating=Excellent
# For penalised cases: scores are chosen so that:
#   final_score = 100 - amb*30 - conf*30  matches the documented expected value.
#
# TC024: score=88  → penalty=12 → conflict_score ≈ 0.40 (0.40*30=12)
# TC025: score=84  → penalty=16 → ambiguity_score ≈ 0.533
# TC026: score=81  → penalty=19 → ambiguity_score ≈ 0.633
# TC027: score=81  → penalty=19 → ambiguity_score ≈ 0.633
# TC028: score=81  → penalty=19 → ambiguity_score ≈ 0.633
# TC029: score=80  → penalty=20 → ambiguity_score ≈ 0.667
# TC030: score=80  → penalty=20 → ambiguity_score ≈ 0.667
# TC031: score=79  → penalty=21 → ambiguity_score ≈ 0.700
# TC032: score=79  → penalty=21 → ambiguity_score ≈ 0.700
# TC033: score=78  → penalty=22 → ambiguity_score ≈ 0.733
# TC034: score=78  → penalty=22 → ambiguity_score ≈ 0.733
# TC035: score=76  → penalty=24 → ambiguity_score ≈ 0.800
# TC036: score=74  → penalty=26 → ambiguity_score ≈ 0.867
# TC037: score=65  → penalty=35 → amb=0.583 + conf=0.583 (each*30=17.5 → 35)
# TC038: Should Have (score 75) with ambiguity flag
# ---------------------------------------------------------------------------

_CLEAR = dict(ambiguity_score=0.0, conflict_score=0.0)

TEST_CASES = [
    # ── TC001–TC023: Clear, no issues (Must Have, Score 100, Excellent) ──
    ("TC001", "REQ-001 clear",
     "The data shall be encrypted using AES-256.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC002", "REQ-004 clear",
     "The system shall send order emails within 10 minutes of purchase.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC003", "REQ-012 clear",
     "The system shall load the homepage within 2 seconds under normal network conditions.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC004", "REQ-013 clear",
     "The user shall update profile information including name, phone, and address.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC005", "REQ-014 clear",
     "The system shall allow password reset via an email link.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC006", "REQ-015 clear",
     "The user shall delete the account and all associated data permanently.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC007", "REQ-018 clear",
     "The system shall display product listings with images, descriptions, and prices.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC008", "REQ-019 clear",
     "The user shall search products by name, category, or keyword.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC009", "REQ-021 clear",
     "The user shall filter products by price range from $0 to $10,000.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC010", "REQ-022 clear",
     "The system shall allow users to filter products by cheap, medium, and expensive.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC011", "REQ-023 clear",
     "The user shall add products to the shopping cart with quantity selection.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC012", "REQ-024 clear",
     "The system shall update the total cart price automatically when items change.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC013", "REQ-026 clear",
     "The system shall save cart contents for 30 days.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC014", "REQ-027 clear",
     "The system shall maintain atleast 99.9% uptime.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC015", "REQ-028 clear",
     "The user shall save items to a wishlist for future purchase.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC016", "REQ-029 clear",
     "The user shall place orders using a selected shipping address.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC017", "REQ-030 clear",
     "The system shall generate a unique order ID for each transaction.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC018", "REQ-031 clear",
     "The user shall view order history including dates and statuses.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC019", "REQ-033 clear",
     "The system shall process payments using cards and digital wallets.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC020", "REQ-034 clear",
     "The system shall encrypt payment data using AES-256 and transmit using TLS 1.3.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC021", "REQ-035 clear",
     "The system shall store passwords using bcrypt (minimum 10 rounds).",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC022", "REQ-037 clear",
     "The system shall provide real-time order shipment tracking to customers.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC023", "REQ-038 clear",
     "The system shall support guest checkout without registration.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    # ── TC024–TC038: Penalised cases ─────────────────────────────────────
    # TC024: conflict flag → score 88 → conflict_penalty=12 → conf=0.40
    ("TC024", "REQ-003 conflict flag",
     "The system shall send order confirmation emails within 5 minutes.",
     "Must Have", 88, "Good", 0.0, 0.40),

    # TC025: ambiguity flag → score 84 → amb_penalty=16 → amb≈0.533
    ("TC025", "REQ-025 ambiguity flag",
     "The user shall remove items from the cart.",
     "Must Have", 84, "Good", 0.533, 0.0),

    # TC026: ambiguity flag → score 81 → amb_penalty=19 → amb≈0.633
    ("TC026", "REQ-020 ambiguity flag",
     "The system shall show product availability status in real time.",
     "Must Have", 81, "Fair", 0.633, 0.0),

    # TC027: ambiguity flag → score 81
    ("TC027", "REQ-010 ambiguity flag",
     "The system must not encrypt user data.",
     "Must Have", 81, "Fair", 0.633, 0.0),

    # TC028: ambiguity flag → score 81
    ("TC028", "REQ-032 ambiguity flag",
     "The system shall send confirmation emails immediately.",
     "Must Have", 81, "Fair", 0.633, 0.0),

    # TC029: ambiguity flag → score 80 → amb_penalty=20 → amb≈0.667
    ("TC029", "REQ-006 ambiguity flag",
     "The HR manager must dismiss personnel.",
     "Must Have", 80, "Fair", 0.667, 0.0),

    # TC030: ambiguity flag → score 80
    ("TC030", "REQ-009 ambiguity flag",
     "The system must encrypt all user data.",
     "Must Have", 80, "Fair", 0.667, 0.0),

    # TC031: ambiguity flag → score 79 → amb≈0.700
    ("TC031", "REQ-017 ambiguity flag",
     "The system shall verify emails as quickly as possible.",
     "Must Have", 79, "Fair", 0.700, 0.0),

    # TC032: ambiguity flag → score 79
    ("TC032", "REQ-036 ambiguity flag",
     "The system shall process payments instantly.",
     "Must Have", 79, "Fair", 0.700, 0.0),

    # TC033: ambiguity flag → score 78 → amb≈0.733
    ("TC033", "REQ-007 ambiguity flag",
     "The Physician must Book a Consultation for the Client.",
     "Must Have", 78, "Fair", 0.733, 0.0),

    # TC034: ambiguity flag → score 78
    ("TC034", "REQ-008 ambiguity flag",
     "The Doctor must Schedule a Visit for the Patient.",
     "Must Have", 78, "Fair", 0.733, 0.0),

    # TC035: ambiguity flag → score 76 → amb≈0.800
    ("TC035", "REQ-016 ambiguity flag",
     "The system shall provide a very easy registration experience.",
     "Must Have", 76, "Fair", 0.800, 0.0),

    # TC036: ambiguity flag → score 74 → amb≈0.867
    ("TC036", "REQ-011 ambiguity flag",
     "Developers must be able to perform updates without difficulty.",
     "Must Have", 74, "Fair", 0.867, 0.0),

    # TC037: ambiguity+conflict → score 65 → total_penalty=35
    #        amb=0.583, conf=0.583 → amb*30=17.5, conf*30=17.5 → 35
    ("TC037", "REQ-002 ambiguity+conflict",
     "The system shall be fast",
     "Must Have", 65, "Poor", 0.583, 0.583),

    # TC038: "can" has no MoSCoW keyword match → Unclassified, score=0
    ("TC038", "REQ-005 Unclassified (no keyword match)",
     "The HR manager can onboard new staff",
     "Unclassified", 0, "Excellent", 0.0, 0.0),

    # ── TC039–TC078: Food Delivery — clear, no issues ─────────────────────
    ("TC039", "REQ-004 food delivery clear",
     "The system shall allow registered users to remove items from cart before checkout.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC040", "REQ-005 food delivery clear",
     "The system shall allow registered users to place food orders using saved payment methods with order confirmation.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC041", "REQ-006 food delivery clear",
     "The system shall allow registered users to track delivery status in real time after order placement.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC042", "REQ-007 food delivery clear",
     "The system shall allow registered users to rate and review restaurants after order delivery.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC043", "REQ-008 food delivery clear",
     "The system shall allow registered users to apply promo codes during checkout with validity check.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC044", "REQ-009 food delivery clear",
     "The system shall allow registered users to schedule orders for a future delivery time with confirmation.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC045", "REQ-010 food delivery clear",
     "The system shall allow registered users to view order history from their account dashboard.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC046", "REQ-011 food delivery clear",
     "The system shall allow registered users to manage saved delivery addresses in account settings.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC047", "REQ-012 food delivery clear",
     "The system shall allow registered users to reorder from previous orders with a single action.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC048", "REQ-013 food delivery clear",
     "The system shall allow restaurant owners to manage their menu by adding, updating, or removing items.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC049", "REQ-014 food delivery clear",
     "The system shall allow restaurant owners to accept or reject incoming orders within 2 minutes.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC050", "REQ-015 food delivery clear",
     "The system shall allow delivery agents to update delivery status at each checkpoint in real time.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC051", "REQ-016 food delivery clear",
     "The system shall allow admin users to manage restaurant listings and verify partner restaurants.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC052", "REQ-017 food delivery clear",
     "The system shall allow registered users to complete payment using credit card, debit card, cash on delivery, or digital wallet.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC053", "REQ-018 food delivery clear",
     "The system shall allow registered users to contact customer support through in-app chat after order placement.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC054", "REQ-019 food delivery clear",
     "The system shall load restaurant listings within 3 seconds under normal network conditions.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC055", "REQ-020 food delivery clear",
     "The system shall support at least 1000 concurrent users without performance degradation.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC056", "REQ-021 food delivery clear",
     "The system shall encrypt all payment and personal data using AES-256 encryption.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC057", "REQ-022 food delivery clear",
     "The system shall authenticate all users using JWT tokens with 24-hour expiration.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC058", "REQ-023 food delivery clear",
     "The system shall log all user actions including login, order placement, and payment for audit purposes.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC059", "REQ-024 food delivery clear",
     "The system shall be available 99.9 percent of the time on a monthly basis.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC060", "REQ-025 food delivery clear",
     "The system shall recover from any server failure within 5 minutes without loss of student progress data.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC061", "REQ-026 food delivery clear",
     "The system shall provide a responsive interface accessible on desktop, tablet, and mobile browsers.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC062", "REQ-027 food delivery clear",
     "The system shall allow new students to enroll in their first course within 5 minutes without external help.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC063", "REQ-028 food delivery clear",
     "The system shall run on Chrome, Firefox, Safari, and Edge browsers without functional differences.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC064", "REQ-029 food delivery clear",
     "The system shall integrate with third-party video streaming services including YouTube and Vimeo.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC065", "REQ-030 food delivery clear",
     "The system shall be deployable on AWS, Azure, and Google Cloud without code changes.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC066", "REQ-032 food delivery clear",
     "The system shall provide API documentation for all endpoints to support future third-party integrations.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC067", "REQ-038 food delivery clear",
     "The system shall allow customers to add meals to their basket before placing an order.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC068", "REQ-039 food delivery clear",
     "The system shall allow users to put food items into cart prior to checkout.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC069", "REQ-040 food delivery clear",
     "The system shall allow registered users to view their past food orders from their profile.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC070", "REQ-041 food delivery clear",
     "The system shall allow users to access previous order history from the account section.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC071", "REQ-042 food delivery clear",
     "The system shall allow guest users to place food orders without creating an account.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC072", "REQ-044 food delivery clear",
     "The system shall automatically assign the nearest available delivery agent to every new order.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC073", "REQ-045 food delivery clear",
     "The system shall allow restaurant owners to choose and assign their own preferred delivery agents.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC074", "REQ-046 food delivery clear",
     "The system shall support a maximum of 300 concurrent users at peak load.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC075", "REQ-047 food delivery clear",
     "The system shall display all menu prices in USD only across all restaurant pages.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC076", "REQ-048 food delivery clear",
     "The system shall display menu prices in the local currency of the user based on their detected location.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC077", "REQ-049 food delivery clear",
     "The system shall cancel unaccepted orders automatically after 5 minutes of no restaurant response.",
     "Must Have", 100, "Excellent", 0.0, 0.0),

    ("TC078", "REQ-050 food delivery clear",
     "The system shall wait up to 15 minutes before cancelling orders that have not been accepted by the restaurant.",
     "Must Have", 100, "Excellent", 0.0, 0.0),
]


# ---------------------------------------------------------------------------
# Parametrised test function
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "tc_id, description, requirement, exp_category, exp_score, exp_rating, amb_score, conf_score",
    TEST_CASES,
    ids=[tc[0] for tc in TEST_CASES],
)
def test_prioritization(
    moscow, hybrid,
    tc_id, description, requirement,
    exp_category, exp_score, exp_rating,
    amb_score, conf_score,
):
    """
    Directly calls MoscowPrioritizer + HybridPrioritizer (no API).
    Asserts moscow_category, final_score (±2 tolerance), and quality_rating.
    """
    result = prioritize_one(requirement, moscow, hybrid, amb_score, conf_score)

    actual_category = result["moscow_category"]
    actual_score    = round(result["final_score"])
    actual_rating   = result["quality_rating"]

    errors = []

    if actual_category != exp_category:
        errors.append(
            f"  Category : expected '{exp_category}', got '{actual_category}'"
        )

    # Allow ±2 rounding tolerance for float arithmetic
    if abs(actual_score - exp_score) > 2:
        errors.append(
            f"  Score    : expected ~{exp_score}, got {actual_score}"
        )

    if actual_rating != exp_rating:
        errors.append(
            f"  Rating   : expected '{exp_rating}', got '{actual_rating}'"
        )

    assert not errors, (
        f"\n[{tc_id}] {description}\n"
        f"  Req: {requirement}\n" +
        "\n".join(errors)
    )
