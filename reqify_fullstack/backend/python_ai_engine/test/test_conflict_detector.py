"""
=============================================================================
Reqify - Conflict Detector Test Suite  (Direct Module — No API)
=============================================================================
Imports MultiStrategyDetector directly from:
    modules/ConflictDetector/conflict_detector.py

For each test case, analyze_pair(req1, req2, 0, 1) is called and the
returned Detection's issue_type is compared against the expected value.

Expected label mapping:
    "Duplicate"     → IssueType.DUPLICATE
    "Inconsistency" → IssueType.INCONSISTENCY
    "Conflict"      → IssueType.CONFLICT

Run from the python_ai_engine directory:
    pytest test/test_conflict_detector.py -v

Note: First run takes ~60-90s to load SentenceTransformer + BART NLI model.
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

from modules.ConflictDetector.conflict_detector import (
    MultiStrategyDetector,
    IssueType,
)


# ---------------------------------------------------------------------------
# Session-scoped fixture – detector loaded ONCE per test run
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def detector():
    """Initialise MultiStrategyDetector once for the whole test session."""
    print("\n[fixture] Initialising MultiStrategyDetector (domain=auto)...")
    det = MultiStrategyDetector(domain="auto")
    print("[fixture] Detector ready.\n")
    return det


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------
def detect_pair(req1: str, req2: str, det: MultiStrategyDetector) -> str:
    """
    Run analyze_pair and return the detected issue type string:
    'duplicate' | 'inconsistency' | 'conflict' | 'none'
    """
    detections = det.analyze_pair(req1, req2, 0, 1)
    if not detections:
        return "none"
    return detections[0].issue_type.value   # e.g. "duplicate"


# ---------------------------------------------------------------------------
# Test data
# (tc_id, description, req1, req2, expected_type)
# expected_type must match IssueType.value strings exactly (lowercase)
# ---------------------------------------------------------------------------
TEST_CASES = [
    # ── E-Commerce Pairs ──────────────────────────────────────────────────
    ("TC001", "Verify inconsistency detection between REQ-5 and REQ-12",
     "The system shall allow registered users to track order status in real time after purchase.",
     "The system shall allow registered users to view order history from their account dashboard.",
     "inconsistency"),

    ("TC002", "Verify inconsistency detection between REQ-5 and REQ-36",
     "The system shall allow registered users to track order status in real time after purchase.",
     "The registered user shall be able to view past orders from their profile page.",
     "inconsistency"),

    ("TC003", "Verify inconsistency detection between REQ-10 and REQ-39",
     "The system shall allow admin users to process refund requests within 3 business days.",
     "The system shall process all refund requests within 24 hours of submission.",
     "inconsistency"),

    ("TC004", "Verify inconsistency detection between REQ-10 and REQ-40",
     "The system shall allow admin users to process refund requests within 3 business days.",
     "The system shall process refund requests within 7 to 10 business days after approval.",
     "inconsistency"),

    ("TC005", "Verify inconsistency detection between REQ-12 and REQ-36",
     "The system shall allow registered users to view order history from their account dashboard.",
     "The registered user shall be able to view past orders from their profile page.",
     "inconsistency"),

    ("TC006", "Verify conflict detection between REQ-12 and REQ-37",
     "The system shall allow registered users to view order history from their account dashboard.",
     "The system shall allow guest users to checkout without creating an account.",
     "conflict"),

    ("TC007", "Verify conflict detection between REQ-13 and REQ-37",
     "The system shall allow admin users to generate sales reports by date range.",
     "The system shall allow guest users to checkout without creating an account.",
     "conflict"),

    ("TC008", "Verify conflict detection between REQ-14 and REQ-37",
     "The system shall allow registered users to manage their shipping addresses in account settings.",
     "The system shall allow guest users to checkout without creating an account.",
     "conflict"),

    ("TC009", "Verify duplicate detection between REQ-17 and REQ-30",
     "The system shall support at least 500 concurrent users without performance degradation.",
     "The system should handle many users simultaneously without issues.",
     "duplicate"),

    ("TC010", "Verify inconsistency detection between REQ-17 and REQ-41",
     "The system shall support at least 500 concurrent users without performance degradation.",
     "The system shall support a maximum of 200 concurrent users at peak load.",
     "inconsistency"),

    ("TC011", "Verify duplicate detection between REQ-34 and REQ-35",
     "The system shall allow users register using email and password.",
     "The system should support registration by using email and password.",
     "duplicate"),

    ("TC012", "Verify conflict detection between REQ-36 and REQ-37",
     "The registered user shall be able to view past orders from their profile page.",
     "The system shall allow guest users to checkout without creating an account.",
     "conflict"),

    ("TC013", "Verify inconsistency detection between REQ-39 and REQ-40",
     "The system shall process all refund requests within 24 hours of submission.",
     "The system shall process refund requests within 7 to 10 business days after approval.",
     "inconsistency"),

    ("TC014", "Verify inconsistency detection between REQ-42 and REQ-43",
     "The system shall display product prices in USD only across all pages.",
     "The system shall allow users to view product prices in their local currency based on location.",
     "inconsistency"),

    # ── Food Delivery Pairs ───────────────────────────────────────────────
    ("TC015", "Verify inconsistency detection between REQ-19 and REQ-45",
     "The system shall support at least 1000 concurrent users without performance degradation.",
     "The system shall support a maximum of 300 concurrent users at peak load.",
     "inconsistency"),

    ("TC016", "Verify inconsistency detection between REQ-46 and REQ-47",
     "The system shall display all menu prices in USD only across all restaurant pages.",
     "The system shall display menu prices in the local currency of the user based on their detected location.",
     "inconsistency"),

    ("TC017", "Verify inconsistency detection between REQ-48 and REQ-49",
     "The system shall cancel unaccepted orders automatically after 5 minutes of no restaurant response.",
     "The system shall wait up to 15 minutes before cancelling orders that have not been accepted by the restaurant.",
     "inconsistency"),

    ("TC018", "Verify inconsistency detection between REQ-9 and REQ-39",
     "The system shall allow registered users to view order history from their account dashboard.",
     "The system shall allow registered users to view their past food orders from their profile.",
     "inconsistency"),

    ("TC019", "Verify inconsistency detection between REQ-9 and REQ-40",
     "The system shall allow registered users to view order history from their account dashboard.",
     "The system shall allow users to access previous order history from the account section.",
     "inconsistency"),

    ("TC020", "Verify duplicate detection between REQ-2 and REQ-38",
     "The system shall allow registered users to add food items to cart with quantity and customization options.",
     "The system shall allow users to put food items into cart prior to checkout.",
     "duplicate"),

    ("TC021", "Verify inconsistency detection between REQ-37 and REQ-41",
     "The system shall allow customers to add meals to their basket before placing an order.",
     "The system shall allow guest users to place food orders without creating an account.",
     "inconsistency"),

    ("TC022", "Verify inconsistency detection between REQ-20 and REQ-46",
     "The system shall support at least 2000 concurrent users without performance degradation.",
     "The system shall support a maximum of 500 concurrent users at peak load.",
     "inconsistency"),

    # ── E-Learning Pairs ──────────────────────────────────────────────────
    ("TC023", "Verify inconsistency detection between REQ-47 and REQ-48",
     "The system shall display all course prices in USD only across all pages.",
     "The system shall display course prices in the local currency of the student based on their detected location.",
     "inconsistency"),

    ("TC024", "Verify conflict detection between REQ-49 and REQ-50",
     "The system shall automatically issue course completion certificates immediately after the final quiz submission.",
     "The system shall issue course completion certificates only after instructor manual approval of all submitted assignments.",
     "conflict"),

    ("TC025", "Verify inconsistency detection between REQ-10 and REQ-40",
     "The system shall allow registered students to view their grades and feedback from the course dashboard.",
     "The system shall allow registered students to view their assessment scores from the learning portal.",
     "inconsistency"),

    ("TC026", "Verify inconsistency detection between REQ-10 and REQ-41",
     "The system shall allow registered students to view their grades and feedback from the course dashboard.",
     "The system shall allow students to access their quiz and assignment results from the course page.",
     "inconsistency"),

    ("TC027", "Verify duplicate detection between REQ-4 and REQ-38",
     "The system shall allow registered students to enroll in courses after completing payment or free registration.",
     "The system shall allow learners to sign up for available courses after making payment.",
     "duplicate"),

    ("TC028", "Verify duplicate detection between REQ-4 and REQ-39",
     "The system shall allow registered students to enroll in courses after completing payment or free registration.",
     "The system shall allow students to register for a course upon successful fee submission.",
     "duplicate"),

    ("TC029", "Verify duplicate detection between REQ-38 and REQ-39",
     "The system shall allow learners to sign up for available courses after making payment.",
     "The system shall allow students to register for a course upon successful fee submission.",
     "duplicate"),

    # ── Repeated/Additional Pairs ─────────────────────────────────────────
    ("TC030", "Verify inconsistency detection between REQ-5 and REQ-12 (repeat)",
     "The system shall allow registered users to track order status in real time after purchase.",
     "The system shall allow registered users to view order history from their account dashboard.",
     "inconsistency"),

    ("TC031", "Verify inconsistency detection between REQ-5 and REQ-36 (repeat)",
     "The system shall allow registered users to track order status in real time after purchase.",
     "The registered user shall be able to view past orders from their profile page.",
     "inconsistency"),

    ("TC032", "Verify inconsistency detection between REQ-10 and REQ-39 (repeat)",
     "The system shall allow admin users to process refund requests within 3 business days.",
     "The system shall process all refund requests within 24 hours of submission.",
     "inconsistency"),

    # ── E-Learning Extended Pairs ─────────────────────────────────────────
    ("TC033", "Verify conflict detection between REQ-1 and REQ-2",
     "The system shall allow admin users to create and manage courses with title, description, and category.",
     "The system shall allow instructors to upload course content including videos, PDFs, and presentations.",
     "conflict"),

    ("TC034", "Verify conflict detection between REQ-1 and REQ-3",
     "The system shall allow admin users to create and manage courses with title, description, and category.",
     "The system shall allow registered students to browse and search available courses by category and keyword.",
     "conflict"),

    ("TC035", "Verify conflict detection between REQ-1 and REQ-6",
     "The system shall allow admin users to create and manage courses with title, description, and category.",
     "The system shall allow instructors to schedule and host live classes with registered enrolled students.",
     "conflict"),

    ("TC036", "Verify inconsistency detection between REQ-1 and REQ-8",
     "The system shall allow admin users to create and manage courses with title, description, and category.",
     "The system shall allow registered students to view their grades and feedback from the course dashboard.",
     "inconsistency"),

    ("TC037", "Verify detection between REQ-1 and REQ-15",
     "The system shall allow admin users to create and manage courses with title, description, and category.",
     "The system shall allow guest users to access and view full course content without registration.",
     "none"),

    ("TC038", "Verify conflict detection between REQ-4 and REQ-6",
     "The system shall allow instructors to upload course content including videos, PDFs, and presentations.",
     "The system shall allow instructors to schedule and host live classes with registered enrolled students.",
     "conflict"),

    ("TC039", "Verify conflict detection between REQ-4 and REQ-9",
     "The system shall allow instructors to upload course content including videos, PDFs, and presentations.",
     "The system shall allow instructors to send announcements to all enrolled students of a course.",
     "conflict"),

    ("TC040", "Verify conflict detection between REQ-7 and REQ-15",
     "The system shall allow registered students to enroll in courses after completing payment or free registration.",
     "The system shall allow guest users to access and view full course content without registration.",
     "conflict"),

    ("TC041", "Verify inconsistency detection between REQ-7 and REQ-11",
     "The system shall allow registered students to enroll in courses after completing payment or free registration.",
     "The system shall allow registered students to track their course progress with completion percentage.",
     "inconsistency"),

    ("TC042", "Verify duplicate detection between REQ-7 and REQ-12",
     "The system shall allow registered students to enroll in courses after completing payment or free registration.",
     "The system shall allow students to register for a course upon successful fee submission.",
     "duplicate"),

    ("TC043", "Verify conflict detection between REQ-7 and REQ-15 (repeat)",
     "The system shall allow registered students to enroll in courses after completing payment or free registration.",
     "The system shall allow guest users to access and view full course content without registration.",
     "conflict"),

    ("TC044", "Verify conflict detection between REQ-10 and REQ-16",
     "The system shall allow registered students to access course content after successful enrollment.",
     "The system shall allow guest users to access and view full course content without registration.",
     "conflict"),

    ("TC045", "Verify conflict detection between REQ-10 and REQ-17",
     "The system shall allow registered students to access course content after successful enrollment.",
     "The system shall require all users to register and log in before accessing any course content.",
     "conflict"),

    ("TC046", "Verify inconsistency detection between REQ-11 and REQ-20",
     "The system shall allow registered students to track their course progress with completion percentage.",
     "The system shall allow registered students to view their assessment scores from the learning portal.",
     "inconsistency"),

    ("TC047", "Verify inconsistency detection between REQ-13 and REQ-18",
     "The system shall allow registered students to attempt quizzes within the allowed time limit and submission window.",
     "The system shall allow students to access their quiz and assignment results from the course page.",
     "inconsistency"),

    ("TC048", "Verify inconsistency detection between REQ-14 and REQ-21",
     "The system shall allow instructors to grade student assignments and provide written feedback.",
     "The system shall allow registered students to view their grades and feedback from the course dashboard.",
     "inconsistency"),

    ("TC049", "Verify inconsistency detection between REQ-18 and REQ-19",
     "The system shall allow registered students to view their grades and feedback from the course dashboard.",
     "The system shall allow registered students to participate in course discussion forums by posting and replying.",
     "inconsistency"),

    ("TC050", "Verify conflict detection between REQ-15 and REQ-17",
     "The system shall allow guest users to access and view full course content without registration.",
     "The system shall require all users to register and log in before accessing any course content.",
     "conflict"),

    ("TC051", "Verify inconsistency detection between REQ-22 and REQ-23",
     "The system shall display all course prices in USD only across all pages.",
     "The system shall display course prices in the local currency of the student based on their detected location.",
     "inconsistency"),
]

# Map expected string → user-friendly label for error messages
LABEL_DISPLAY = {
    "duplicate":     "Duplicate",
    "inconsistency": "Inconsistency",
    "conflict":      "Conflict",
    "none":          "None",
}


# ---------------------------------------------------------------------------
# Parametrised test function
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "tc_id, description, req1, req2, expected_type",
    TEST_CASES,
    ids=[tc[0] for tc in TEST_CASES],
)
def test_conflict_detection(
    detector, tc_id, description, req1, req2, expected_type
):
    """
    Directly calls MultiStrategyDetector.analyze_pair() (no API).
    Asserts the detected issue type matches expected (duplicate/inconsistency/conflict).
    """
    actual_type = detect_pair(req1, req2, detector)

    assert actual_type == expected_type, (
        f"\n[{tc_id}] {description}\n"
        f"  REQ-1    : {req1}\n"
        f"  REQ-2    : {req2}\n"
        f"  Expected : {LABEL_DISPLAY.get(expected_type, expected_type)}\n"
        f"  Got      : {LABEL_DISPLAY.get(actual_type, actual_type)}"
    )
