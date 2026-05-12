"""
=============================================================================
Reqify - NFR Sub-Categorizer Test Suite  (Direct Model — No API)
=============================================================================
Loads EnhancedRobertaClassifier directly from:
    modules/SubCategorizer/best_model.pt
    modules/SubCategorizer/label_mapping.json
    modules/BasicClassifier/   (tokenizer + base weights)

Run from the python_ai_engine directory:
    pytest test/test_nfr_subcategorizer.py -v

Or from the test/ directory:
    cd test
    pytest test_nfr_subcategorizer.py -v
=============================================================================
"""

import os
import sys
import json
import torch
import torch.nn as nn
import pytest
from transformers import RobertaModel, RobertaTokenizer

# ---------------------------------------------------------------------------
# Path setup – ensure python_ai_engine is on sys.path
# ---------------------------------------------------------------------------
THIS_DIR    = os.path.dirname(os.path.abspath(__file__))
ENGINE_DIR  = os.path.abspath(os.path.join(THIS_DIR, ".."))
if ENGINE_DIR not in sys.path:
    sys.path.insert(0, ENGINE_DIR)

TOKENIZER_DIR  = os.path.join(ENGINE_DIR, "modules", "BasicClassifier")
MODEL_PT       = os.path.join(ENGINE_DIR, "modules", "SubCategorizer", "best_model.pt")
LABEL_MAP_PATH = os.path.join(ENGINE_DIR, "modules", "SubCategorizer", "label_mapping.json")


# ---------------------------------------------------------------------------
# EnhancedRobertaClassifier – exact copy from main.py (DO NOT MODIFY main.py)
# ---------------------------------------------------------------------------
class EnhancedRobertaClassifier(nn.Module):
    """Enhanced RoBERTa with strong regularization (mirrors main.py definition)."""
    def __init__(self, num_classes, model_name="roberta-base", dropout_rate=0.5):
        super(EnhancedRobertaClassifier, self).__init__()
        self.roberta    = RobertaModel.from_pretrained(model_name)
        self.hidden_size = self.roberta.config.hidden_size
        self.dropout1   = nn.Dropout(dropout_rate)
        self.dense1     = nn.Linear(self.hidden_size, self.hidden_size)
        self.layer_norm1 = nn.LayerNorm(self.hidden_size)
        self.dropout2   = nn.Dropout(dropout_rate)
        self.dense2     = nn.Linear(self.hidden_size, 256)
        self.layer_norm2 = nn.LayerNorm(256)
        self.dropout3   = nn.Dropout(dropout_rate)
        self.classifier = nn.Linear(256, num_classes)

    def forward(self, input_ids, attention_mask):
        outputs      = self.roberta(input_ids=input_ids, attention_mask=attention_mask)
        pooled_output = outputs.pooler_output
        x = self.dropout1(pooled_output)
        x = self.dense1(x)
        x = self.layer_norm1(x)
        x = torch.relu(x)
        x = self.dropout2(x)
        x = self.dense2(x)
        x = self.layer_norm2(x)
        x = torch.relu(x)
        x = self.dropout3(x)
        return self.classifier(x)


# ---------------------------------------------------------------------------
# Session-scoped fixture – model loaded ONCE per test run
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def subcategorizer():
    """Load the NFR-type EnhancedRobertaClassifier model from disk."""
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\n[fixture] Using device: {device}")

    # Load label mapping
    with open(LABEL_MAP_PATH, "r") as f:
        label_mapping = json.load(f)
    labels = {int(v): k for k, v in label_mapping.items()}
    num_classes = len(label_mapping)
    print(f"[fixture] Labels ({num_classes}): {labels}")

    # Load tokenizer
    print(f"[fixture] Loading tokenizer from: {TOKENIZER_DIR}")
    tokenizer = RobertaTokenizer.from_pretrained(TOKENIZER_DIR)

    # Initialise model architecture then load saved weights
    print(f"[fixture] Loading model weights from: {MODEL_PT}")
    model = EnhancedRobertaClassifier(
        num_classes=num_classes,
        model_name=TOKENIZER_DIR,   # uses local BasicClassifier weights
        dropout_rate=0.5
    )
    checkpoint = torch.load(MODEL_PT, map_location=device, weights_only=False)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.to(device)
    model.eval()
    print("[fixture] NFR Sub-Categorizer model ready.\n")

    return tokenizer, model, labels, device


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------
def predict_nfr_type(text: str, tokenizer, model, labels, device) -> str:
    """Run inference and return the NFR type label string."""
    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding=True,
        max_length=128
    ).to(device)

    with torch.no_grad():
        logits = model(
            input_ids=inputs["input_ids"],
            attention_mask=inputs["attention_mask"]
        )

    probs      = torch.softmax(logits, dim=1)
    pred_index = torch.argmax(probs, dim=1).item()
    return labels[pred_index]


# ---------------------------------------------------------------------------
# Test data – (tc_id, description, requirement_text, expected_prediction)
# ---------------------------------------------------------------------------
TEST_CASES = [
    # ── E-Commerce NFRs ───────────────────────────────────────────────────
    ("TC001", "Verify Performance classification of REQ-16",
     "The system shall respond to product search queries within 2 seconds under normal load.",
     "Performance"),
    ("TC002", "Verify Performance classification of REQ-17",
     "The system shall support at least 500 concurrent users without performance degradation.",
     "Performance"),
    ("TC003", "Verify Security classification of REQ-18",
     "The system shall encrypt all payment and personal data using AES-256 encryption.",
     "Security"),
    ("TC004", "Verify Reliability classification of REQ-20",
     "The system shall be available 99.9% of the time on a monthly basis.",
     "Reliability"),
    ("TC005", "Verify Reliability classification of REQ-21",
     "The system shall recover from any server failure within 5 minutes without data loss.",
     "Reliability"),
    ("TC006", "Verify Usability classification of REQ-22",
     "The system shall provide a responsive web interface accessible on desktop and mobile browsers.",
     "Usability"),
    ("TC007", "Verify Usability classification of REQ-23",
     "The system shall allow new users to complete their first purchase within 10 minutes without external help.",
     "Usability"),
    ("TC008", "Verify Portability classification of REQ-24",
     "The system shall run on Chrome, Firefox, Safari, and Edge browsers without functional differences.",
     "Portability"),
    ("TC009", "Verify Compatibility classification of REQ-25",
     "The system shall integrate with third-party payment gateways including Stripe and PayPal.",
     "Compatibility"),
    ("TC010", "Verify Portability classification of REQ-26",
     "The system shall be deployable on AWS, Azure, and Google Cloud without code changes.",
     "Portability"),
    ("TC011", "Verify Maintainability classification of REQ-27",
     "The system shall follow modular architecture to allow addition of new modules without affecting existing ones.",
     "Maintainability"),
    ("TC012", "Verify Security classification of REQ-28",
     "The system shall log all user actions including login, purchase, and profile updates for audit purposes.",
     "Security"),
    ("TC013", "Verify Usability classification of REQ-30",
     "The system should handle many users simultaneously without issues.",
     "Usability"),
    ("TC014", "Verify Usability classification of REQ-31",
     "The system shall provide a user-friendly and intuitive shopping experience.",
     "Usability"),
    ("TC015", "Verify Maintainability classification of REQ-32",
     "The system shall ensure products are delivered in a reasonable time.",
     "Maintainability"),
    ("TC016", "Verify Reliability classification of REQ-33",
     "The system shall bank all transaction data securely in the backend.",
     "Reliability"),
    ("TC017", "Verify Security classification of REQ-35",
     "The system should support registration by using email and password.",
     "Security"),
    ("TC018", "Verify Usability classification of REQ-38",
     "The system shall require all users to register and log in before accessing checkout.",
     "Usability"),
    ("TC019", "Verify Reliability classification of REQ-40",
     "The system shall process refund requests within 7 to 10 business days after approval.",
     "Reliability"),
    ("TC020", "Verify Performance classification of REQ-41",
     "The system shall support a maximum of 200 concurrent users at peak load.",
     "Performance"),
    # ── Generic NFR patterns ──────────────────────────────────────────────
    ("TC021", "Verify Performance classification",
     "The system shall respond to search queries within 200ms.",
     "Performance"),
    ("TC022", "Verify Performance classification",
     "The application shall handle 1000 concurrent users without degradation.",
     "Performance"),
    ("TC023", "Verify Security classification",
     "All user passwords must be hashed using bcrypt.",
     "Security"),
    ("TC024", "Verify Security classification",
     "The system shall use SSL/TLS for all communications.",
     "Security"),
    ("TC025", "Verify Usability classification",
     "The interface shall be intuitive enough for new users to learn within 10 minutes.",
     "Usability"),
    ("TC026", "Verify Usability classification",
     "The system shall provide clear error messages for invalid inputs.",
     "Usability"),
    ("TC027", "Verify Reliability classification",
     "The system shall have an availability of 99.99 percent during business hours.",
     "Reliability"),
    ("TC028", "Verify Reliability classification",
     "The system shall recover from a crash within 2 minutes.",
     "Reliability"),
    ("TC029", "Verify Maintainability classification",
     "The code shall follow the PEP 8 style guide for Python.",
     "Maintainability"),
    ("TC030", "Verify Portability classification",
     "The application shall run on both Windows and macOS.",
     "Portability"),
    ("TC031", "Verify Portability classification",
     "The database shall be migratable to a different cloud provider without code changes.",
     "Portability"),
    # ── Food Delivery NFRs ────────────────────────────────────────────────
    ("TC032", "Verify Performance classification of REQ-32",
     "The system shall load restaurant listings within 3 seconds under normal network conditions.",
     "Performance"),
    ("TC033", "Verify Performance classification of REQ-33",
     "The system shall support at least 1000 concurrent users without performance degradation.",
     "Performance"),
    ("TC034", "Verify Security classification of REQ-34",
     "The system shall encrypt all payment and personal data using AES-256 encryption.",
     "Security"),
    ("TC035", "Verify Security classification of REQ-35",
     "The system shall log all user actions including login, order placement, and payment for audit purposes.",
     "Security"),
    ("TC036", "Verify Reliability classification of REQ-36",
     "The system shall be available 99.9% of the time on a monthly basis.",
     "Reliability"),
    ("TC037", "Verify Reliability classification of REQ-37",
     "The system shall recover from any server failure within 5 minutes without data loss.",
     "Reliability"),
    ("TC038", "Verify Usability classification of REQ-38",
     "The system shall provide a responsive mobile-first interface accessible on Android and iOS.",
     "Usability"),
    ("TC039", "Verify Usability classification of REQ-39",
     "The system shall allow new users to place their first order within 5 minutes without external help.",
     "Usability"),
    ("TC040", "Verify Portability classification of REQ-40",
     "The system shall run on Chrome, Firefox, Safari, and Edge browsers without functional differences.",
     "Portability"),
    ("TC041", "Verify Portability classification of REQ-41",
     "The system shall be deployable on AWS, Azure, and Google Cloud without code changes.",
     "Portability"),
    ("TC042", "Verify Maintainability classification of REQ-42",
     "The system shall follow modular architecture to allow addition of new features without affecting existing modules.",
     "Maintainability"),
    ("TC043", "Verify Maintainability classification of REQ-43",
     "The system shall provide API documentation for all endpoints to support future integrations.",
     "Maintainability"),
    ("TC044", "Verify Performance classification of REQ-44",
     "The system should handle a large number of simultaneous orders without slowing down.",
     "Performance"),
    ("TC045", "Verify Usability classification of REQ-45",
     "The system shall provide a smooth and pleasant ordering experience for all users.",
     "Usability"),
    ("TC046", "Verify Reliability classification of REQ-46",
     "The system shall ensure delivery agents reach customers in a reasonable amount of time.",
     "Reliability"),
    ("TC047", "Verify Reliability classification of REQ-47",
     "The system shall process payments in a secure and efficient manner at all times.",
     "Reliability"),
    ("TC048", "Verify Performance classification of REQ-48",
     "The system shall support a maximum of 300 concurrent users at peak load.",
     "Performance"),
]


# ---------------------------------------------------------------------------
# Parametrised test function
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "tc_id, description, requirement_text, expected_prediction",
    TEST_CASES,
    ids=[tc[0] for tc in TEST_CASES],
)
def test_nfr_type_classification(
    subcategorizer, tc_id, description, requirement_text, expected_prediction
):
    """
    Directly calls the loaded EnhancedRobertaClassifier (no API).
    Asserts the NFR-type prediction matches the expected category.
    """
    tokenizer, model, labels, device = subcategorizer
    actual = predict_nfr_type(requirement_text, tokenizer, model, labels, device)

    assert actual == expected_prediction, (
        f"\n[{tc_id}] {description}\n"
        f"  Requirement : {requirement_text}\n"
        f"  Expected    : {expected_prediction}\n"
        f"  Got         : {actual}"
    )
