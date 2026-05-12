"""
=============================================================================
Reqify - Ambiguity Checker Test Suite  (Direct Model — No API)
=============================================================================
Uses the binary RoBERTa ambiguity model directly from:
    reall/   (RobertaForSequenceClassification: Clear vs Ambiguous)

Expected values map as:
    "Clear"     → is_ambiguous == False
    "Ambiguous" → is_ambiguous == True
    (severity High / Medium is not checked here — only Clear vs Ambiguous)

Run from the python_ai_engine directory:
    pytest test/test_ambiguity_checker.py -v

Or from the test/ directory:
    pytest test_ambiguity_checker.py -v
=============================================================================
"""

import os
import sys
import torch
import pytest
from transformers import RobertaTokenizer, RobertaForSequenceClassification

# ---------------------------------------------------------------------------
# Path setup
# ---------------------------------------------------------------------------
THIS_DIR   = os.path.dirname(os.path.abspath(__file__))
ENGINE_DIR = os.path.abspath(os.path.join(THIS_DIR, ".."))
# reall/ is three levels up from python_ai_engine (matches main.py path)
REALL_DIR  = os.path.abspath(os.path.join(ENGINE_DIR, "..", "..", "..", "reall"))

if ENGINE_DIR not in sys.path:
    sys.path.insert(0, ENGINE_DIR)


# ---------------------------------------------------------------------------
# Session-scoped fixture – loaded ONCE per test run
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def ambiguity_model():
    """Load the binary ambiguity RoBERTa model from reall/ directory."""
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\n[fixture] Using device: {device}")
    print(f"[fixture] Loading ambiguity model from: {REALL_DIR}")

    tokenizer = RobertaTokenizer.from_pretrained(REALL_DIR)
    model     = RobertaForSequenceClassification.from_pretrained(REALL_DIR)
    model.to(device)
    model.eval()
    print("[fixture] Ambiguity model ready.\n")

    return tokenizer, model, device


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------
def predict_ambiguity(text: str, tokenizer, model, device) -> bool:
    """
    Returns True  → Ambiguous
            False → Clear
    Model label 0 = Clear, label 1 = Ambiguous  (standard binary convention).
    """
    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=128
    ).to(device)

    with torch.no_grad():
        outputs = model(**inputs)
        logits  = outputs.logits

    probs      = torch.softmax(logits, dim=1)
    prediction = torch.argmax(probs, dim=1).item()
    return bool(prediction)   # 0 → False (Clear), 1 → True (Ambiguous)


# ---------------------------------------------------------------------------
# Test data
# (tc_id, description, requirement_text, is_ambiguous_expected)
# True  = Ambiguous
# False = Clear
# ---------------------------------------------------------------------------
TEST_CASES = [
    # ── E-Commerce Domain ─────────────────────────────────────────────────
    ("TC001", "Verify clear detection of REQ-1",
     "The system shall allow registered users to browse product catalog by category.",
     False),
    ("TC002", "Verify clear detection of REQ-2",
     "The system shall allow registered users to add products to shopping cart with quantity selection.",
     False),
    ("TC003", "Verify clear detection of REQ-3",
     "The system shall allow registered users to remove items from shopping cart at any time.",
     False),
    ("TC004", "Verify clear detection of REQ-4",
     "The system shall allow registered users to place orders using saved payment methods with order confirmation.",
     False),
    ("TC005", "Verify clear detection of REQ-5",
     "The system shall allow registered users to track order status in real time after purchase.",
     False),
    ("TC006", "Verify clear detection of REQ-6",
     "The system shall allow registered users to submit product reviews after order delivery.",
     False),
    ("TC007", "Verify clear detection of REQ-7",
     "The system shall allow registered users to add products to wishlist for later purchase.",
     False),
    ("TC008", "Verify clear detection of REQ-8",
     "The system shall allow registered users to apply discount coupons during checkout with validity check.",
     False),
    ("TC009", "Verify clear detection of REQ-9",
     "The system shall allow admin users to manage product inventory by updating stock levels.",
     False),
    ("TC010", "Verify clear detection of REQ-10",
     "The system shall allow admin users to process refund requests within 3 business days.",
     False),
    ("TC011", "Verify clear detection of REQ-11",
     "The system shall allow registered users to search products by keyword with filter support.",
     False),
    ("TC012", "Verify clear detection of REQ-12",
     "The system shall allow registered users to view order history from their account dashboard.",
     False),
    ("TC013", "Verify clear detection of REQ-13",
     "The system shall allow admin users to generate sales reports by date range.",
     False),
    ("TC014", "Verify clear detection of REQ-14",
     "The system shall allow registered users to manage their shipping addresses in account settings.",
     False),
    ("TC015", "Verify clear detection of REQ-15",
     "The system shall allow registered users to complete payment using credit card, debit card, or digital wallet.",
     False),
    ("TC016", "Verify clear detection of REQ-16",
     "The system shall respond to product search queries within 2 seconds under normal load.",
     False),
    ("TC017", "Verify clear detection of REQ-17",
     "The system shall support at least 500 concurrent users without performance degradation.",
     False),
    ("TC018", "Verify clear detection of REQ-18",
     "The system shall encrypt all payment and personal data using AES-256 encryption.",
     False),
    ("TC019", "Verify clear detection of REQ-19",
     "The system shall authenticate all users using JWT tokens with 24-hour expiration.",
     False),
    ("TC020", "Verify clear detection of REQ-20",
     "The system shall be available 99.9% of the time on a monthly basis.",
     False),
    ("TC021", "Verify clear detection of REQ-21",
     "The system shall recover from any server failure within 5 minutes without data loss.",
     False),
    ("TC022", "Verify clear detection of REQ-22",
     "The system shall provide a responsive web interface accessible on desktop and mobile browsers.",
     False),
    ("TC023", "Verify clear detection of REQ-23",
     "The system shall allow new users to complete their first purchase within 10 minutes without external help.",
     False),
    ("TC024", "Verify clear detection of REQ-24",
     "The system shall run on Chrome, Firefox, Safari, and Edge browsers without functional differences.",
     False),
    ("TC025", "Verify clear detection of REQ-25",
     "The system shall integrate with third-party payment gateways including Stripe and PayPal.",
     False),
    ("TC026", "Verify clear detection of REQ-26",
     "The system shall be deployable on AWS, Azure, and Google Cloud without code changes.",
     False),
    ("TC027", "Verify ambiguity detection of REQ-27",
     "The system shall follow modular architecture to allow addition of new modules without affecting existing ones.",
     True),
    ("TC028", "Verify clear detection of REQ-28",
     "The system shall log all user actions including login, purchase, and profile updates for audit purposes.",
     False),
    ("TC029", "Verify ambiguity detection of REQ-29",
     "The system shall process orders quickly and efficiently.",
     True),
    ("TC030", "Verify ambiguity detection of REQ-30",
     "The system should handle many users simultaneously without issues.",
     True),
    ("TC031", "Verify ambiguity detection of REQ-31",
     "The system shall provide a user-friendly and intuitive shopping experience.",
     True),
    ("TC032", "Verify ambiguity detection of REQ-32",
     "The system shall ensure products are delivered in a reasonable time.",
     True),
    ("TC033", "Verify clear detection of REQ-33",
     "The system shall bank all transaction data securely in the backend.",
     False),
    ("TC034", "Verify clear detection of REQ-34",
     "The system shall allow users register using email and password.",
     False),
    ("TC035", "Verify clear detection of REQ-35",
     "The system should support registration by using email and password.",
     False),
    ("TC036", "Verify clear detection of REQ-36",
     "The registered user shall be able to view past orders from their profile page.",
     False),
    ("TC037", "Verify clear detection of REQ-37",
     "The system shall allow guest users to checkout without creating an account.",
     False),
    ("TC038", "Verify clear detection of REQ-38",
     "The system shall require all users to register and log in before accessing checkout.",
     False),
    ("TC039", "Verify clear detection of REQ-39",
     "The system shall process all refund requests within 24 hours of submission.",
     False),
    ("TC040", "Verify clear detection of REQ-40",
     "The system shall process refund requests within 7 to 10 business days after approval.",
     False),
    ("TC041", "Verify clear detection of REQ-41",
     "The system shall support a maximum of 200 concurrent users at peak load.",
     False),
    ("TC042", "Verify clear detection of REQ-42",
     "The system shall display product prices in USD only across all pages.",
     False),
    ("TC043", "Verify clear detection of REQ-43",
     "The system shall allow users to view product prices in their local currency based on location.",
     False),
    # ── Food Delivery Domain ───────────────────────────────────────────────
    ("TC044", "Verify clear detection of REQ-44",
     "The system shall allow registered users to browse nearby restaurants by location and cuisine type.",
     False),
    ("TC045", "Verify clear detection of REQ-45",
     "The system shall allow registered users to view restaurant menus with item descriptions and prices.",
     False),
    ("TC046", "Verify clear detection of REQ-46",
     "The system shall allow registered users to add food items to cart with quantity and customization options.",
     False),
    ("TC047", "Verify clear detection of REQ-47",
     "The system shall allow registered users to remove items from cart before checkout.",
     False),
    ("TC048", "Verify clear detection of REQ-48",
     "The system shall allow registered users to place food orders using saved payment methods with order confirmation.",
     False),
    ("TC049", "Verify clear detection of REQ-49",
     "The system shall allow registered users to track delivery status in real time after order placement.",
     False),
    ("TC050", "Verify clear detection of REQ-50",
     "The system shall allow registered users to rate and review restaurants after order delivery.",
     False),
    ("TC051", "Verify clear detection of REQ-51",
     "The system shall allow registered users to apply promo codes during checkout with validity check.",
     False),
    ("TC052", "Verify clear detection of REQ-52",
     "The system shall allow registered users to schedule orders for a future delivery time with confirmation.",
     False),
    ("TC053", "Verify clear detection of REQ-53",
     "The system shall allow registered users to view order history from their account dashboard.",
     False),
    ("TC054", "Verify clear detection of REQ-54",
     "The system shall allow registered users to manage saved delivery addresses in account settings.",
     False),
    ("TC055", "Verify clear detection of REQ-55",
     "The system shall allow registered users to reorder from previous orders with a single action.",
     False),
    ("TC056", "Verify clear detection of REQ-56",
     "The system shall allow restaurant owners to manage their menu by adding, updating, or removing items.",
     False),
    ("TC057", "Verify clear detection of REQ-57",
     "The system shall allow restaurant owners to accept or reject incoming orders within 2 minutes.",
     False),
    ("TC058", "Verify clear detection of REQ-58",
     "The system shall allow delivery agents to update delivery status at each checkpoint in real time.",
     False),
    ("TC059", "Verify clear detection of REQ-59",
     "The system shall allow admin users to manage restaurant listings and verify partner restaurants.",
     False),
    ("TC060", "Verify clear detection of REQ-60",
     "The system shall allow registered users to complete payment using credit card, debit card, cash on delivery, or digital wallet.",
     False),
    ("TC061", "Verify clear detection of REQ-61",
     "The system shall allow registered users to contact customer support through in-app chat after order placement.",
     False),
    ("TC062", "Verify clear detection of REQ-62",
     "The system shall load restaurant listings within 3 seconds under normal network conditions.",
     False),
    ("TC063", "Verify clear detection of REQ-63",
     "The system shall support at least 1000 concurrent users without performance degradation.",
     False),
    ("TC064", "Verify clear detection of REQ-64",
     "The system shall encrypt all payment and personal data using AES-256 encryption.",
     False),
    ("TC065", "Verify clear detection of REQ-65",
     "The system shall authenticate all users using JWT tokens with 24-hour expiration.",
     False),
    ("TC066", "Verify clear detection of REQ-66",
     "The system shall log all user actions including login, order placement, and payment for audit purposes.",
     False),
    ("TC067", "Verify clear detection of REQ-67",
     "The system shall be available 99.9% of the time on a monthly basis.",
     False),
    ("TC068", "Verify clear detection of REQ-68",
     "The system shall recover from any server failure within 5 minutes without data loss.",
     False),
    ("TC069", "Verify clear detection of REQ-69",
     "The system shall provide a responsive mobile-first interface accessible on Android and iOS.",
     False),
    ("TC070", "Verify clear detection of REQ-70",
     "The system shall allow new users to place their first order within 5 minutes without external help.",
     False),
    ("TC071", "Verify clear detection of REQ-71",
     "The system shall run on Chrome, Firefox, Safari, and Edge browsers without functional differences.",
     False),
    ("TC072", "Verify clear detection of REQ-72",
     "The system shall integrate with third-party mapping services including Google Maps for delivery tracking.",
     False),
    ("TC073", "Verify clear detection of REQ-73",
     "The system shall be deployable on AWS, Azure, and Google Cloud without code changes.",
     False),
    ("TC074", "Verify ambiguity detection of REQ-74",
     "The system shall follow modular architecture to allow addition of new features without affecting existing modules.",
     True),
    ("TC075", "Verify clear detection of REQ-75",
     "The system shall provide API documentation for all endpoints to support future integrations.",
     False),
    ("TC076", "Verify ambiguity detection of REQ-76",
     "The system shall deliver food orders as fast as possible to nearby customers.",
     True),
    ("TC077", "Verify ambiguity detection of REQ-77",
     "The system should handle a large number of simultaneous orders without slowing down.",
     True),
    ("TC078", "Verify ambiguity detection of REQ-78",
     "The system shall provide a smooth and pleasant ordering experience for all users.",
     True),
    ("TC079", "Verify ambiguity detection of REQ-79",
     "The system shall ensure delivery agents reach customers in a reasonable amount of time.",
     True),
    ("TC080", "Verify ambiguity detection of REQ-80",
     "The system shall process payments in a secure and efficient manner at all times.",
     True),
    ("TC081", "Verify clear detection of REQ-81",
     "The system shall allow customers to add meals to their basket before placing an order.",
     False),
    ("TC082", "Verify clear detection of REQ-82",
     "The system shall allow users to put food items into cart prior to checkout.",
     False),
    ("TC083", "Verify clear detection of REQ-83",
     "The system shall allow registered users to view their past food orders from their profile.",
     False),
    ("TC084", "Verify clear detection of REQ-84",
     "The system shall allow users to access previous order history from the account section.",
     False),
    ("TC085", "Verify clear detection of REQ-85",
     "The system shall allow guest users to place food orders without creating an account.",
     False),
    ("TC086", "Verify clear detection of REQ-86",
     "The system shall require all users to register and log in before accessing the ordering feature.",
     False),
    ("TC087", "Verify clear detection of REQ-87",
     "The system shall automatically assign the nearest available delivery agent to every new order.",
     False),
    ("TC088", "Verify clear detection of REQ-88",
     "The system shall allow restaurant owners to choose and assign their own preferred delivery agents.",
     False),
    ("TC089", "Verify clear detection of REQ-89",
     "The system shall support a maximum of 300 concurrent users at peak load.",
     False),
    ("TC090", "Verify clear detection of REQ-90",
     "The system shall display all menu prices in USD only across all restaurant pages.",
     False),
    ("TC091", "Verify clear detection of REQ-91",
     "The system shall display menu prices in the local currency of the user based on their detected location.",
     False),
    ("TC092", "Verify clear detection of REQ-92",
     "The system shall cancel unaccepted orders automatically after 5 minutes of no restaurant response.",
     False),
    ("TC093", "Verify clear detection of REQ-93",
     "The system shall wait up to 15 minutes before cancelling orders that have not been accepted by the restaurant.",
     False),
    # ── E-Learning Domain ──────────────────────────────────────────────────
    ("TC094", "Verify clear detection of REQ-94",
     "The system shall allow admin users to create and manage courses with title, description, and category.",
     False),
    ("TC095", "Verify clear detection of REQ-95",
     "The system shall allow instructors to upload course content including videos, PDFs, and presentations.",
     False),
    ("TC096", "Verify clear detection of REQ-96",
     "The system shall allow registered students to browse and search available courses by category and keyword.",
     False),
    ("TC097", "Verify clear detection of REQ-97",
     "The system shall allow registered students to enroll in courses after completing payment or free registration.",
     False),
    ("TC098", "Verify clear detection of REQ-98",
     "The system shall allow registered students to access course content after successful enrollment.",
     False),
    ("TC099", "Verify clear detection of REQ-99",
     "The system shall allow registered students to track their course progress with completion percentage.",
     False),
    ("TC100", "Verify clear detection of REQ-100",
     "The system shall allow instructors to create quizzes and assignments with configurable deadlines.",
     False),
    ("TC101", "Verify clear detection of REQ-101",
     "The system shall allow registered students to attempt quizzes within the allowed time limit and submission window.",
     False),
    ("TC102", "Verify ambiguity detection of REQ-102",
     "The system shall allow instructors to grade student assignments and provide written feedback.",
     True),
    ("TC103", "Verify clear detection of REQ-103",
     "The system shall allow registered students to view their grades and feedback from the course dashboard.",
     False),
    ("TC104", "Verify clear detection of REQ-104",
     "The system shall allow registered students to participate in course discussion forums by posting and replying.",
     False),
    ("TC105", "Verify clear detection of REQ-105",
     "The system shall allow instructors to schedule and host live classes with registered enrolled students.",
     False),
    ("TC106", "Verify clear detection of REQ-106",
     "The system shall allow registered students to download course completion certificates after finishing all requirements.",
     False),
    ("TC107", "Verify clear detection of REQ-107",
     "The system shall allow admin users to manage user accounts including students and instructors.",
     False),
    ("TC108", "Verify clear detection of REQ-108",
     "The system shall allow registered students to submit assignments before the deadline with file upload support.",
     False),
    ("TC109", "Verify clear detection of REQ-109",
     "The system shall allow instructors to send announcements to all enrolled students of a course.",
     False),
    ("TC110", "Verify clear detection of REQ-110",
     "The system shall allow registered students to save courses to a wishlist for later enrollment.",
     False),
    ("TC111", "Verify clear detection of REQ-111",
     "The system shall allow admin users to generate reports on course enrollment and student performance.",
     False),
    ("TC112", "Verify clear detection of REQ-112",
     "The system shall load course content pages within 3 seconds under normal network conditions.",
     False),
    ("TC113", "Verify clear detection of REQ-113",
     "The system shall support at least 2000 concurrent users without performance degradation.",
     False),
    ("TC114", "Verify clear detection of REQ-114",
     "The system shall encrypt all user data and payment information using AES-256 encryption.",
     False),
    ("TC115", "Verify clear detection of REQ-115",
     "The system shall authenticate all users using JWT tokens with 24-hour expiration.",
     False),
    ("TC116", "Verify clear detection of REQ-116",
     "The system shall log all user actions including login, enrollment, and submission for audit purposes.",
     False),
    ("TC117", "Verify clear detection of REQ-117",
     "The system shall be available 99.9% of the time on a monthly basis.",
     False),
    ("TC118", "Verify clear detection of REQ-118",
     "The system shall recover from any server failure within 5 minutes without loss of student progress data.",
     False),
    ("TC119", "Verify clear detection of REQ-119",
     "The system shall provide a responsive interface accessible on desktop, tablet, and mobile browsers.",
     False),
    ("TC120", "Verify clear detection of REQ-120",
     "The system shall allow new students to enroll in their first course within 5 minutes without external help.",
     False),
    ("TC121", "Verify clear detection of REQ-121",
     "The system shall run on Chrome, Firefox, Safari, and Edge browsers without functional differences.",
     False),
    ("TC122", "Verify clear detection of REQ-122",
     "The system shall integrate with third-party video streaming services including YouTube and Vimeo.",
     False),
    ("TC123", "Verify clear detection of REQ-123",
     "The system shall be deployable on AWS, Azure, and Google Cloud without code changes.",
     False),
    ("TC124", "Verify clear detection of REQ-124",
     "The system shall follow modular architecture to allow addition of new modules without affecting existing features.",
     False),
    ("TC125", "Verify clear detection of REQ-125",
     "The system shall provide API documentation for all endpoints to support future third-party integrations.",
     False),
    ("TC126", "Verify ambiguity detection of REQ-126",
     "The system shall deliver course content quickly and smoothly to all students.",
     True),
    ("TC127", "Verify ambiguity detection of REQ-127",
     "The system should handle a large number of students accessing courses at the same time without issues.",
     True),
    ("TC128", "Verify ambiguity detection of REQ-128",
     "The system shall provide an engaging and interactive learning experience for all users.",
     True),
    ("TC129", "Verify ambiguity detection of REQ-129",
     "The system shall ensure instructors can easily manage their course materials without difficulty.",
     True),
    ("TC130", "Verify ambiguity detection of REQ-130",
     "The system shall process student payments in a secure and timely manner during enrollment.",
     True),
    ("TC131", "Verify clear detection of REQ-131",
     "The system shall allow learners to sign up for available courses after making payment.",
     False),
    ("TC132", "Verify clear detection of REQ-132",
     "The system shall allow students to register for a course upon successful fee submission.",
     False),
    ("TC133", "Verify clear detection of REQ-133",
     "The system shall allow registered students to view their assessment scores from the learning portal.",
     False),
    ("TC134", "Verify clear detection of REQ-134",
     "The system shall allow students to access their quiz and assignment results from the course page.",
     False),
    ("TC135", "Verify clear detection of REQ-135",
     "The system shall allow guest users to access and view full course content without registration.",
     False),
    ("TC136", "Verify clear detection of REQ-136",
     "The system shall require all users to register and log in before accessing any course content.",
     False),
    ("TC137", "Verify clear detection of REQ-137",
     "The system shall automatically pass all students who complete 100 percent of course videos.",
     False),
    ("TC138", "Verify clear detection of REQ-138",
     "The system shall require students to pass all quizzes and assignments before receiving course completion certification.",
     False),
    ("TC139", "Verify clear detection of REQ-139",
     "The system shall support a maximum of 500 concurrent users at peak load.",
     False),
    ("TC140", "Verify clear detection of REQ-140",
     "The system shall display all course prices in USD only across all pages.",
     False),
    ("TC141", "Verify clear detection of REQ-141",
     "The system shall display course prices in the local currency of the student based on their detected location.",
     False),
    ("TC142", "Verify clear detection of REQ-142",
     "The system shall automatically issue course completion certificates immediately after the final quiz submission.",
     False),
    ("TC143", "Verify clear detection of REQ-143",
     "The system shall issue course completion certificates only after instructor manual approval of all submitted assignments.",
     False),
]


# ---------------------------------------------------------------------------
# Parametrised test function
# ---------------------------------------------------------------------------
LABEL_MAP = {True: "Ambiguous", False: "Clear"}

@pytest.mark.parametrize(
    "tc_id, description, requirement_text, is_ambiguous_expected",
    TEST_CASES,
    ids=[tc[0] for tc in TEST_CASES],
)
def test_ambiguity_detection(
    ambiguity_model, tc_id, description, requirement_text, is_ambiguous_expected
):
    """
    Directly calls the RoBERTa ambiguity binary model (no API).
    Asserts Clear/Ambiguous prediction matches expected value.
    """
    tokenizer, model, device = ambiguity_model
    actual_flag = predict_ambiguity(requirement_text, tokenizer, model, device)

    assert actual_flag == is_ambiguous_expected, (
        f"\n[{tc_id}] {description}\n"
        f"  Requirement : {requirement_text}\n"
        f"  Expected    : {LABEL_MAP[is_ambiguous_expected]}\n"
        f"  Got         : {LABEL_MAP[actual_flag]}"
    )
