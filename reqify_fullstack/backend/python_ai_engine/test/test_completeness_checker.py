"""
=============================================================================
Reqify - Completeness Checker Test Suite  (Direct Module — No API)
=============================================================================
Imports EnhancedAnalyzer directly from:
    modules/CompletenessChecker/completeness_checker.py

For each test case, analyzer.analyze(requirements, domain) is called and
the result is checked for:
  - Module coverage  (specific module name must be in covered_modules)
  - Overall status   (status == "complete" and coverage 100%)
  - Missing modules  (missing_modules list must be empty)

Domain key mapping used in the module:
    "ecommerce"                  → E-Commerce (TC001-TC010)
    "learning_management_system" → LMS        (TC011-TC019)
    "food_delivery"              → Food       (TC020-TC027)

Run from the python_ai_engine directory:
    pytest test/test_completeness_checker.py -v
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

from modules.CompletenessChecker.completeness_checker import EnhancedAnalyzer


# ---------------------------------------------------------------------------
# Requirement sets (fed directly to the analyzer)
# ---------------------------------------------------------------------------

ECOMMERCE_REQS = [
    # FR — Product Catalog & Search
    "The system shall allow registered users to browse product catalog by category.",
    "The system shall allow registered users to search products by keyword with filter support.",
    # FR — Shopping Cart
    "The system shall allow registered users to add products to shopping cart with quantity selection.",
    "The system shall allow registered users to remove items from shopping cart at any time.",
    # FR — Order Placement & Checkout
    "The system shall allow registered users to place orders using saved payment methods with order confirmation.",
    "The system shall allow registered users to apply discount coupons during checkout with validity check.",
    "The system shall allow registered users to complete payment using credit card, debit card, or digital wallet.",
    # FR — Payment & Gateways
    "The system shall integrate with third-party payment gateways including Stripe and PayPal.",
    # FR — Wishlist
    "The system shall allow registered users to add products to wishlist for later purchase.",
    # FR — Inventory
    "The system shall allow admin users to manage product inventory by updating stock levels.",
    # FR — Order Tracking
    "The system shall allow registered users to track order status in real time after purchase.",
    "The system shall allow admin users to process refund requests within 3 business days.",
    # FR — Reviews
    "The system shall allow registered users to submit product reviews after order delivery.",
    "The system shall allow registered users to view order history from their account dashboard.",
    "The system shall allow admin users to generate sales reports by date range.",
    "The system shall allow registered users to manage their shipping addresses in account settings.",
    # NFR
    "The system shall respond to product search queries within 2 seconds under normal load.",
    "The system shall support at least 500 concurrent users without performance degradation.",
    "The system shall encrypt all payment and personal data using AES-256 encryption.",
    "The system shall authenticate all users using JWT tokens with 24-hour expiration.",
    "The system shall be available 99.9% of the time on a monthly basis.",
    "The system shall recover from any server failure within 5 minutes without data loss.",
    "The system shall provide a responsive web interface accessible on desktop and mobile browsers.",
    "The system shall allow new users to complete their first purchase within 10 minutes without external help.",
    "The system shall run on Chrome, Firefox, Safari, and Edge browsers without functional differences.",
    "The system shall be deployable on AWS, Azure, and Google Cloud without code changes.",
    "The system shall follow modular architecture to allow addition of new modules without affecting existing ones.",
    "The system shall log all user actions including login, purchase, and profile updates for audit purposes.",
    # Additional reqs
    "The system shall process orders quickly and efficiently.",
    "The system should handle many users simultaneously without issues.",
    "The system shall provide a user-friendly and intuitive shopping experience.",
    "The system shall ensure products are delivered in a reasonable time.",
    "The system shall bank all transaction data securely in the backend.",
    "The system shall allow users register using email and password.",
    "The system should support registration by using email and password.",
    "The registered user shall be able to view past orders from their profile page.",
    "The system shall allow guest users to checkout without creating an account.",
    "The system shall require all users to register and log in before accessing checkout.",
    "The system shall process all refund requests within 24 hours of submission.",
    "The system shall process refund requests within 7 to 10 business days after approval.",
    "The system shall support a maximum of 200 concurrent users at peak load.",
    "The system shall display product prices in USD only across all pages.",
    "The system shall allow users to view product prices in their local currency based on location.",
]

LMS_REQS = [
    # Course Management
    "The system shall allow admin users to create and manage courses with title, description, and category.",
    # Enrollment
    "The system shall allow registered students to enroll in courses after completing payment or free registration.",
    "The system shall allow registered students to access course content after successful enrollment.",
    # Assessment & Quizzes
    "The system shall allow instructors to create quizzes and assignments with configurable deadlines.",
    "The system shall allow registered students to attempt quizzes within the allowed time limit and submission window.",
    # Grading
    "The system shall allow instructors to grade student assignments and provide written feedback.",
    "The system shall allow registered students to view their grades and feedback from the course dashboard.",
    # Assignment Submission
    "The system shall allow registered students to submit assignments before the deadline with file upload support.",
    # Discussion Forums
    "The system shall allow registered students to participate in course discussion forums by posting and replying.",
    # Content Delivery
    "The system shall allow instructors to upload course content including videos, PDFs, and presentations.",
    "The system shall allow registered students to browse and search available courses by category and keyword.",
    "The system shall allow registered students to track their course progress with completion percentage.",
    # Live Classes
    "The system shall allow instructors to schedule and host live classes with registered enrolled students.",
    # Certificates
    "The system shall allow registered students to download course completion certificates after finishing all requirements.",
    # Other functional
    "The system shall allow admin users to manage user accounts including students and instructors.",
    "The system shall allow instructors to send announcements to all enrolled students of a course.",
    "The system shall allow registered students to save courses to a wishlist for later enrollment.",
    "The system shall allow admin users to generate reports on course enrollment and student performance.",
    # NFR
    "The system shall load course content pages within 3 seconds under normal network conditions.",
    "The system shall support at least 2000 concurrent users without performance degradation.",
    "The system shall encrypt all user data and payment information using AES-256 encryption.",
    "The system shall authenticate all users using JWT tokens with 24-hour expiration.",
    "The system shall log all user actions including login, enrollment, and submission for audit purposes.",
    "The system shall be available 99.9% of the time on a monthly basis.",
    "The system shall recover from any server failure within 5 minutes without loss of student progress data.",
    "The system shall provide a responsive interface accessible on desktop, tablet, and mobile browsers.",
    "The system shall allow new students to enroll in their first course within 5 minutes without external help.",
    "The system shall run on Chrome, Firefox, Safari, and Edge browsers without functional differences.",
    "The system shall integrate with third-party video streaming services including YouTube and Vimeo.",
    "The system shall be deployable on AWS, Azure, and Google Cloud without code changes.",
    "The system shall follow modular architecture to allow addition of new modules without affecting existing features.",
    "The system shall provide API documentation for all endpoints to support future third-party integrations.",
    # Additional
    "The system shall allow learners to sign up for available courses after making payment.",
    "The system shall allow students to register for a course upon successful fee submission.",
    "The system shall allow registered students to view their assessment scores from the learning portal.",
    "The system shall allow students to access their quiz and assignment results from the course page.",
    "The system shall allow guest users to access and view full course content without registration.",
    "The system shall require all users to register and log in before accessing any course content.",
    "The system shall automatically pass all students who complete 100 percent of course videos.",
    "The system shall require students to pass all quizzes and assignments before receiving course completion certification.",
    "The system shall support a maximum of 500 concurrent users at peak load.",
    "The system shall display all course prices in USD only across all pages.",
    "The system shall display course prices in the local currency of the student based on their detected location.",
    "The system shall automatically issue course completion certificates immediately after the final quiz submission.",
    "The system shall issue course completion certificates only after instructor manual approval of all submitted assignments.",
]

FOOD_REQS = [
    # Restaurant & Menu
    "The system shall allow registered users to browse nearby restaurants by location and cuisine type.",
    "The system shall allow registered users to view restaurant menus with item descriptions and prices.",
    "The system shall allow admin users to manage restaurant listings and verify partner restaurants.",
    "The system shall allow restaurant owners to manage their menu by adding, updating, or removing items.",
    "The system shall allow restaurant owners to accept or reject incoming orders within 2 minutes.",
    # Order Placement
    "The system shall allow registered users to place food orders using saved payment methods with order confirmation.",
    "The system shall allow registered users to schedule orders for a future delivery time with confirmation.",
    # Payment Processing
    "The system shall allow registered users to complete payment using credit card, debit card, cash on delivery, or digital wallet.",
    # Delivery Tracking
    "The system shall allow registered users to track delivery status in real time after order placement.",
    "The system shall allow delivery agents to update delivery status at each checkpoint in real time.",
    # Cart Management
    "The system shall allow registered users to add food items to cart with quantity and customization options.",
    "The system shall allow registered users to remove items from cart before checkout.",
    # Rating & Reviews
    "The system shall allow registered users to rate and review restaurants after order delivery.",
    # Promotions & Discounts
    "The system shall allow registered users to apply promo codes during checkout with validity check.",
    # Order History
    "The system shall allow registered users to view order history from their account dashboard.",
    "The system shall allow registered users to reorder from previous orders with a single action.",
    # Customer support
    "The system shall allow registered users to contact customer support through in-app chat after order placement.",
    # NFR
    "The system shall load restaurant listings within 3 seconds under normal network conditions.",
    "The system shall support at least 1000 concurrent users without performance degradation.",
    "The system shall encrypt all payment and personal data using AES-256 encryption.",
    "The system shall log all user actions including login, order placement, and payment for audit purposes.",
    "The system shall authenticate all users using JWT tokens with 24-hour expiration.",
    "The system shall be available 99.9% of the time on a monthly basis.",
    "The system shall recover from any server failure within 5 minutes without data loss.",
    "The system shall provide a responsive mobile-first interface accessible on Android and iOS.",
    "The system shall allow new users to place their first order within 5 minutes without external help.",
    "The system shall run on Chrome, Firefox, Safari, and Edge browsers without functional differences.",
    "The system shall integrate with third-party mapping services including Google Maps for delivery tracking.",
    "The system shall be deployable on AWS, Azure, and Google Cloud without code changes.",
    "The system shall follow modular architecture to allow addition of new features without affecting existing modules.",
    "The system shall provide API documentation for all endpoints to support future integrations.",
    # Additional
    "The system shall allow customers to add meals to their basket before placing an order.",
    "The system shall allow users to put food items into cart prior to checkout.",
    "The system shall allow registered users to view their past food orders from their profile.",
    "The system shall allow users to access previous order history from the account section.",
    "The system shall allow guest users to place food orders without creating an account.",
    "The system shall require all users to register and log in before accessing the ordering feature.",
    "The system shall automatically assign the nearest available delivery agent to every new order.",
    "The system shall allow restaurant owners to choose and assign their own preferred delivery agents.",
    "The system shall support a maximum of 300 concurrent users at peak load.",
    "The system shall display all menu prices in USD only across all restaurant pages.",
    "The system shall display menu prices in the local currency of the user based on their detected location.",
    "The system shall cancel unaccepted orders automatically after 5 minutes of no restaurant response.",
    "The system shall wait up to 15 minutes before cancelling orders that have not been accepted by the restaurant.",
]


# ---------------------------------------------------------------------------
# Session-scoped fixture – analyzer with spaCy en_core_web_lg loaded ONCE
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def analyzer():
    """Initialise EnhancedAnalyzer once per test session (loads spaCy lg model)."""
    print("\n[fixture] Initialising EnhancedAnalyzer (spaCy en_core_web_lg)...")
    ana = EnhancedAnalyzer()
    print("[fixture] Analyzer ready.\n")
    return ana


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------
def covered_module_names(result: dict):
    """Return the set of covered module names from an analyze() result."""
    return {m["name"] for m in result.get("covered_modules", [])}


# ---------------------------------------------------------------------------
# Test data: (tc_id, description, domain_key, requirements, check_fn)
#
# check_fn receives (result) and returns (passed: bool, message: str)
# ---------------------------------------------------------------------------

def _module_covered(module_name):
    """Return a check function that asserts a specific module is covered."""
    def check(result):
        names = covered_module_names(result)
        passed = module_name in names
        msg = (
            f"Module '{module_name}' NOT found in covered_modules.\n"
            f"  Covered: {sorted(names)}"
        ) if not passed else ""
        return passed, msg
    return check

def _status_complete(result):
    pct   = result["coverage"]["percentage"]
    status = result["status"]
    missing_count = result["coverage"]["missing"]
    passed = (status == "complete" and pct == 100.0 and missing_count == 0)
    msg = (
        f"Expected status=complete, coverage=100%, missing=0.\n"
        f"  Got: status={status}, coverage={pct}%, missing={missing_count}"
    ) if not passed else ""
    return passed, msg

def _missing_empty(result):
    missing = result.get("missing_modules", [])
    passed = len(missing) == 0
    msg = (
        f"Expected no missing modules, but got {len(missing)}: "
        f"{[m['name'] for m in missing]}"
    ) if not passed else ""
    return passed, msg


TEST_CASES = [
    # ── E-Commerce (TC001-TC010) ──────────────────────────────────────────
    ("TC001", "Verify Product Catalog module coverage",
     "ecommerce", ECOMMERCE_REQS, _module_covered("Product Catalog")),

    ("TC002", "Verify Shopping Cart module coverage",
     "ecommerce", ECOMMERCE_REQS, _module_covered("Shopping Cart")),

    ("TC003", "Verify Order Placement module coverage",
     "ecommerce", ECOMMERCE_REQS, _module_covered("Order Placement")),

    ("TC004", "Verify Payment Processing module coverage",
     "ecommerce", ECOMMERCE_REQS, _module_covered("Payment Processing")),

    ("TC005", "Verify Wishlist module coverage",
     "ecommerce", ECOMMERCE_REQS, _module_covered("Wishlist")),

    ("TC006", "Verify Inventory Management module coverage",
     "ecommerce", ECOMMERCE_REQS, _module_covered("Inventory Management")),

    ("TC007", "Verify Order Tracking module coverage",
     "ecommerce", ECOMMERCE_REQS, _module_covered("Order Tracking")),

    ("TC008", "Verify User Reviews module coverage",
     "ecommerce", ECOMMERCE_REQS, _module_covered("User Reviews")),

    ("TC009", "Verify overall completeness status as Complete",
     "ecommerce", ECOMMERCE_REQS, _status_complete),

    ("TC010", "Verify no missing modules reported",
     "ecommerce", ECOMMERCE_REQS, _missing_empty),

    # ── LMS (TC011-TC019) ─────────────────────────────────────────────────
    ("TC011", "Verify Course Management module coverage",
     "learning_management_system", LMS_REQS, _module_covered("Course Management")),

    ("TC012", "Verify Enrollment module coverage",
     "learning_management_system", LMS_REQS, _module_covered("Enrollment")),

    ("TC013", "Verify Assessment & Quizzes module coverage",
     "learning_management_system", LMS_REQS, _module_covered("Assessment & Quizzes")),

    ("TC014", "Verify Grading module coverage",
     "learning_management_system", LMS_REQS, _module_covered("Grading")),

    ("TC015", "Verify Assignment Submission module coverage",
     "learning_management_system", LMS_REQS, _module_covered("Assignment Submission")),

    ("TC016", "Verify Discussion Forums module coverage",
     "learning_management_system", LMS_REQS, _module_covered("Discussion Forums")),

    ("TC017", "Verify Content Delivery module coverage",
     "learning_management_system", LMS_REQS, _module_covered("Content Delivery")),

    ("TC018", "Verify Live Classes module coverage",
     "learning_management_system", LMS_REQS, _module_covered("Live Classes")),

    ("TC019", "Verify Certificates module coverage",
     "learning_management_system", LMS_REQS, _module_covered("Certificates")),

    # ── Food Delivery (TC020-TC027) ───────────────────────────────────────
    ("TC020", "Verify Order Placement module coverage (Food Delivery)",
     "food_delivery", FOOD_REQS, _module_covered("Order Placement")),

    ("TC021", "Verify Payment Processing module coverage (Food Delivery)",
     "food_delivery", FOOD_REQS, _module_covered("Payment Processing")),

    ("TC022", "Verify Delivery Tracking module coverage",
     "food_delivery", FOOD_REQS, _module_covered("Delivery Tracking")),

    ("TC023", "Verify Cart Management module coverage",
     "food_delivery", FOOD_REQS, _module_covered("Cart Management")),

    ("TC024", "Verify Rating & Reviews module coverage",
     "food_delivery", FOOD_REQS, _module_covered("Rating & Reviews")),

    ("TC025", "Verify Order History module coverage",
     "food_delivery", FOOD_REQS, _module_covered("Order History")),

]


# ---------------------------------------------------------------------------
# Parametrised test function
# ---------------------------------------------------------------------------

# Cache analyze() results per domain to avoid re-running multiple times
_RESULT_CACHE: dict = {}

@pytest.mark.parametrize(
    "tc_id, description, domain, requirements, check_fn",
    TEST_CASES,
    ids=[tc[0] for tc in TEST_CASES],
)
def test_completeness(
    analyzer, tc_id, description, domain, requirements, check_fn
):
    """
    Directly calls EnhancedAnalyzer.analyze() (no API).
    Checks module coverage or overall completeness status.
    """
    # Use cached result if we already analyzed this domain+requirements combo
    cache_key = (domain, id(requirements))
    if cache_key not in _RESULT_CACHE:
        _RESULT_CACHE[cache_key] = analyzer.analyze(requirements, domain)

    result = _RESULT_CACHE[cache_key]

    passed, message = check_fn(result)
    assert passed, (
        f"\n[{tc_id}] {description}\n"
        f"  Domain   : {domain}\n"
        f"  {message}"
    )
