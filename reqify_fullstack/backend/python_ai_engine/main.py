import json
import torch
import torch.nn as nn
from transformers import RobertaModel, RobertaTokenizer, RobertaForSequenceClassification
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager
from typing import List, Optional, Dict, Any
import os
from datetime import datetime
import pickle
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.linear_model import LogisticRegression
from modules.CompletenessChecker.completeness_checker import EnhancedAnalyzer
from modules.ConflictDetector.conflict_detector import MultiStrategyDetector, Detection, IssueType
from modules.Prioritizer.prioritizer import MoscowPrioritizer, HybridPrioritizer

# ============================================================================
# 1. PASTE MODEL 2 (NFR) CLASS DEFINITION
# ============================================================================
class EnhancedRobertaClassifier(nn.Module):
    """Enhanced RoBERTa with strong regularization"""
    def __init__(self, num_classes, model_name='roberta-base', dropout_rate=0.5):
        super(EnhancedRobertaClassifier, self).__init__()
        self.roberta = RobertaModel.from_pretrained(model_name)
        self.hidden_size = self.roberta.config.hidden_size
        self.dropout1 = nn.Dropout(dropout_rate)
        self.dense1 = nn.Linear(self.hidden_size, self.hidden_size)
        self.layer_norm1 = nn.LayerNorm(self.hidden_size)
        self.dropout2 = nn.Dropout(dropout_rate)
        self.dense2 = nn.Linear(self.hidden_size, 256)
        self.layer_norm2 = nn.LayerNorm(256)
        self.dropout3 = nn.Dropout(dropout_rate)
        self.classifier = nn.Linear(256, num_classes)
        
    def forward(self, input_ids, attention_mask):
        outputs = self.roberta(input_ids=input_ids, attention_mask=attention_mask)
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
        logits = self.classifier(x)
        return logits

# ============================================================================
# 2. DEFINE API DATA MODELS (UPDATED WITH METADATA)
# ============================================================================
class TextInput(BaseModel):
    text: str
    filename: Optional[str] = None
    timestamp: Optional[str] = None
    uploader: Optional[str] = None

class RequirementInput(BaseModel):
    text: str
    id: str = ""
    filename: Optional[str] = None
    timestamp: Optional[str] = None
    uploader: Optional[str] = None

class BatchRequirementInput(BaseModel):
    requirements: List[RequirementInput]

# This dictionary will hold our loaded models
model_cache = {}

# ============================================================================
# HELPER FUNCTION: SAVE RESULTS TO FILE (✅ FIXED)
# ============================================================================
def save_analysis_results(results, analysis_type="single"):
    """Save analysis results to local file with new naming convention"""
    try:
        # Create results directory if it doesn't exist
        results_dir = "./analysis_results"
        os.makedirs(results_dir, exist_ok=True)
        
        # --- NEW FILENAME LOGIC ---

        # 1. Get Uploader and Extract Username
        username = "unknown_user" # Default
        if isinstance(results, list) and len(results) > 0:
            uploader_email = results[0].get("uploader", "unknown_user@gmail.com")
            username = uploader_email.split('@')[0] if '@' in uploader_email else uploader_email
        elif isinstance(results, dict): # Fallback for single results
             uploader_email = results.get("uploader", "unknown_user@gmail.com")
             username = uploader_email.split('@')[0] if '@' in uploader_email else uploader_email
        
        # 2. Map Analysis Name
        # ✅ FIXED: Added new mapping for nfr subcategorization
        name_map = {
            "batch_requirements": "extraction",
            "batch_complete_classification": "classification",
            "batch_nfr_subcategorization": "nfr_subcategorization" 
        }
        analysis_name = name_map.get(analysis_type, analysis_type) # Fallback to original type
        
        # 3. Implement Counting to find next available number
        count = 1
        base_filename = f"{username}_{analysis_name}_{count}.json"
        filename = os.path.join(results_dir, base_filename)
        
        while os.path.exists(filename):
            count += 1
            base_filename = f"{username}_{analysis_name}_{count}.json"
            filename = os.path.join(results_dir, base_filename)
            
        # --- End of NEW LOGIC ---

        # Prepare data to save
        save_data = {
            "timestamp": datetime.now().isoformat(),
            "analysis_type": analysis_type,
            "filename_generated": base_filename, # Add the new filename to the log
            "total_requirements": len(results) if isinstance(results, list) else 1,
            "results": results if isinstance(results, list) else [results]
        }
        
        # Save to file
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(save_data, f, indent=2, ensure_ascii=False)
        
        print(f"✓ Results saved: {filename}")
        return filename
    except Exception as e:
        print(f"✗ Error saving results: {str(e)}")
        return None

# ============================================================================
# 3. LOAD MODELS ON STARTUP
# ============================================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # This code runs ONCE when the server starts
    print("Loading models... Please wait.")
    
    # Set device
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    
    model_cache["device"] = device

    # --- Load Model 1 (FR/NFR Classifier) ---
    print("Loading Model 1 (FR/NFR)...")
    model_1_path = "./modules/BasicClassifier"
    model_cache["tokenizer_1"] = RobertaTokenizer.from_pretrained(model_1_path)
    model_cache["model_1"] = RobertaForSequenceClassification.from_pretrained(model_1_path).to(device).eval()
    model_cache["labels_1"] = {0: "FR", 1: "NFR"}
    print("Model 1 loaded.")

    # --- Load Model 2 (NFR Type Classifier) ---
    print("Loading Model 2 (NFR Type)...")
    model_2_path = "./modules/SubCategorizer/best_model.pt"
    label_map_path = "./modules/SubCategorizer/label_mapping.json"
    
    # Load label mapping to get num_classes
    with open(label_map_path, 'r') as f:
        label_mapping = json.load(f)
    
    num_classes = len(label_mapping)
    model_cache["labels_2"] = {int(v): k for k, v in label_mapping.items()}
    
    # Initialize the model class
    model_2 = EnhancedRobertaClassifier(
        num_classes=num_classes,
        model_name='./modules/BasicClassifier',
        dropout_rate=0.5
    )
    
    # Load the saved weights (state_dict)
    checkpoint = torch.load(model_2_path, map_location=device, weights_only=False)
    
    model_2.load_state_dict(checkpoint['model_state_dict'])
    model_2.to(device)
    model_2.eval()
    
    model_cache["model_2"] = model_2
    model_cache["tokenizer_2"] = RobertaTokenizer.from_pretrained('./modules/BasicClassifier')
    print("Model 2 loaded.")
    
    # --- Load NLP Parser (NEW: AdvancedHybridExtractor) ---
    print("Loading NLP Parser...")
    from modules.RequirementExtractor.extractor import AdvancedHybridExtractor
    model_cache["nlp_parser"] = AdvancedHybridExtractor()
    print("NLP Parser loaded.")

    # --- Load Ambiguity Models (NEW) ---
    print("Loading Ambiguity Models...")
    try:
        # 1. Binary Classification Model (RoBERTa)
        ambiguity_model_path = "../../../reall"
        model_cache["ambiguity_tokenizer"] = RobertaTokenizer.from_pretrained(ambiguity_model_path)
        model_cache["ambiguity_model"] = RobertaForSequenceClassification.from_pretrained(ambiguity_model_path).to(device).eval()
        print("Ambiguity Binary Model loaded.")

        # 2. Type Classification Model (SetFit/Pickle)
        pickle_path = "./modules/AmbigoutyChecker/improved_ambiguity_model_2.pkl"
        with open(pickle_path, 'rb') as f:
            model_data = pickle.load(f)
            model_cache["ambiguity_classifiers"] = model_data['classifiers']
            model_cache["ambiguity_thresholds"] = model_data['thresholds']
        
        print("Downloading/loading SentenceTransformer 'all-MiniLM-L6-v2'... (first run may take a few minutes to download ~90MB)")
        model_cache["ambiguity_embedder"] = SentenceTransformer("all-MiniLM-L6-v2")
        print("SentenceTransformer loaded.")
        model_cache["ambiguity_type_names"] = ['lexical', 'syntactic', 'semantic', 'pragmatic', 'referential']
        print("Ambiguity Type Model loaded.")
        
    except Exception as e:
        print(f"Error loading ambiguity models: {e}")
        # Don't fail startup if ambiguity model fails, just log it

    # --- Load Completeness Checker (NEW) ---
    print("Loading Completeness Checker...")
    try:
        model_cache["completeness_analyzer"] = EnhancedAnalyzer()
        print("Completeness Checker loaded.")
    except Exception as e:
        print(f"Error loading Completeness Checker: {e}")

    # --- Load Conflict Detector (NEW) ---
    print("Loading Conflict Detector...")
    try:
        # Initialize with auto domain detection enabled by default
        model_cache["conflict_detector"] = MultiStrategyDetector(domain='auto')
        print("Conflict Detector loaded.")
    except Exception as e:
        print(f"Error loading Conflict Detector: {e}")

    # --- Load Conflict Detector (NEW) ---
    print("Loading Conflict Detector...")
    try:
        # Initialize with auto domain detection enabled by default
        model_cache["conflict_detector"] = MultiStrategyDetector(domain='auto')
        print("Conflict Detector loaded.")
    except Exception as e:
        print(f"Error loading Conflict Detector: {e}")

    # --- Load Prioritizers (NEW) ---
    print("Loading Prioritizers...")
    try:
        model_cache["moscow_prioritizer"] = MoscowPrioritizer()
        model_cache["hybrid_prioritizer"] = HybridPrioritizer()
        print("Prioritizers loaded.")
    except Exception as e:
        print(f"Error loading Prioritizers: {e}")
    
    print("="*30)
    print("All models loaded. API is ready.")
    print("="*30)
    
    yield

    # This code runs when the server shuts down
    print("Shutting down and clearing models...")
    model_cache.clear()

# ============================================================================
# 4. INITIALIZE FASTAPI APP
# ============================================================================
app = FastAPI(
    title="Reqify - Requirement Analysis API",
    description="Serves FR/NFR classification, NFR type classification, and NLP requirement parsing.",
    lifespan=lifespan
)

# ============================================================================
# CORS CONFIGURATION - CRITICAL FOR REACT FRONTEND
# ============================================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# 5. DEFINE API ENDPOINTS
# ============================================================================

@app.get("/")
def read_root():
    return {"message": "Welcome to Reqify API. Go to /docs to see endpoints."}

@app.post("/predict/fr-nfr")
async def predict_fr_nfr(item: TextInput):
    """
    Predicts if a requirement is Functional (FR) or Non-Functional (NFR).
    Uses the 'best_model'.
    """
    try:
        tokenizer = model_cache["tokenizer_1"]
        model = model_cache["model_1"]
        labels = model_cache["labels_1"]
        device = model_cache["device"]

        # Tokenize
        inputs = tokenizer(item.text, return_tensors="pt", truncation=True, padding=True).to(device)

        # Predict
        with torch.no_grad():
            outputs = model(**inputs)
            logits = outputs.logits
            
        probs = torch.softmax(logits, dim=1)
        confidence, pred_index = torch.max(probs, dim=1)
        
        predicted_class = labels[pred_index.item()]

        result = {
            "text": item.text,
            "prediction": predicted_class,
            "confidence": round(confidence.item(), 4),
            "filename": item.filename,
            "timestamp": item.timestamp,
            "uploader": item.uploader
        }
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict/nfr-type")
async def predict_nfr_type(item: TextInput):
    """
    Predicts the specific NFR type (e.g., Performance, Security).
    Uses the 'NFR_Model2'.
    """
    try:
        tokenizer = model_cache["tokenizer_2"]
        model = model_cache["model_2"]
        labels = model_cache["labels_2"]
        device = model_cache["device"]

        # Tokenize
        inputs = tokenizer(item.text, return_tensors="pt", truncation=True, padding=True, max_length=128).to(device)

        # Predict
        with torch.no_grad():
            logits = model(input_ids=inputs['input_ids'], attention_mask=inputs['attention_mask'])
            
        probs = torch.softmax(logits, dim=1)
        confidence, pred_index = torch.max(probs, dim=1)
        
        predicted_class = labels[pred_index.item()]

        result = {
            "text": item.text,
            "prediction": predicted_class,
            "confidence": round(confidence.item(), 4),
            "filename": item.filename,
            "timestamp": item.timestamp,
            "uploader": item.uploader
        }
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# 6. NLP PARSER ENDPOINTS (UPDATED WITH METADATA)
# ============================================================================

@app.post("/analyze/requirement")
async def analyze_requirement(item: RequirementInput):
    """
    Analyzes a single requirement and extracts structural elements using AdvancedHybridExtractor.
    Returns: All extracted components including atomicity validation and metadata
    """
    try:
        parser = model_cache.get("nlp_parser")
        if not parser:
            raise HTTPException(status_code=503, detail="NLP Parser not loaded")
            
        # Extract components using new parser
        result = parser.extract_components(item.text, item.id)
        
        # Convert to dictionary with all fields INCLUDING METADATA
        result_dict = {
            "requirement_id": result.requirement_id,
            "original_requirement": result.original_requirement,
            "segmented_statement": result.segmented_statement,
            "localization": result.localization,
            "localization_lemmatized": result.localization_lemmatized,
            "localization_cleaned": result.localization_cleaned,
            "actor": result.actor,
            "actor_lemmatized": result.actor_lemmatized,
            "actor_cleaned": result.actor_cleaned,
            "action": result.action,
            "action_lemmatized": result.action_lemmatized,
            "action_cleaned": result.action_cleaned,
            "target": result.target,
            "target_lemmatized": result.target_lemmatized,
            "target_cleaned": result.target_cleaned,
            "constraint": result.constraint,
            "constraint_lemmatized": result.constraint_lemmatized,
            "constraint_cleaned": result.constraint_cleaned,
            "confidence": result.confidence,
            "extraction_method": result.extraction_method,
            "is_atomic": result.is_atomic,
            "atomicity_score": result.atomicity_score,
            "atomicity_violations": result.atomicity_violations,
            # ✅ ADD METADATA FIELDS
            "filename": item.filename or "Unknown",
            "timestamp": item.timestamp or datetime.now().isoformat(),
            "uploader": item.uploader or "Unknown"
        }
        
        return result_dict
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/batch")
async def analyze_batch_requirements(batch: BatchRequirementInput):
    """
    Analyzes multiple requirements in batch using AdvancedHybridExtractor.
    Accepts a list of requirements and returns analyzed results for all.
    """
    try:
        parser = model_cache.get("nlp_parser")
        if not parser:
            raise HTTPException(status_code=503, detail="NLP Parser not loaded")
            
        results = []
        
        for req in batch.requirements:
            result = parser.extract_components(req.text, req.id)
            results.append({
                "requirement_id": result.requirement_id,
                "original_requirement": result.original_requirement,
                "segmented_statement": result.segmented_statement,
                "localization": result.localization,
                "localization_lemmatized": result.localization_lemmatized,
                "localization_cleaned": result.localization_cleaned,
                "actor": result.actor,
                "actor_lemmatized": result.actor_lemmatized,
                "actor_cleaned": result.actor_cleaned,
                "action": result.action,
                "action_lemmatized": result.action_lemmatized,
                "action_cleaned": result.action_cleaned,
                "target": result.target,
                "target_lemmatized": result.target_lemmatized,
                "target_cleaned": result.target_cleaned,
                "constraint": result.constraint,
                "constraint_lemmatized": result.constraint_lemmatized,
                "constraint_cleaned": result.constraint_cleaned,
                "confidence": result.confidence,
                "extraction_method": result.extraction_method,
                "is_atomic": result.is_atomic,
                "atomicity_score": result.atomicity_score,
                "atomicity_violations": result.atomicity_violations,
                # ✅ ADD METADATA FIELDS
                "filename": req.filename or "Unknown",
                "timestamp": req.timestamp or datetime.now().isoformat(),
                "uploader": req.uploader or "Unknown"
            })
        
        # ✅ FIXED: Save KEPT for batch endpoint
        save_analysis_results(results, "batch_requirements")
        
        return {"results": results, "total_analyzed": len(results)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# 7. COMBINED CLASSIFICATION WITH STRUCTURE ANALYSIS (UPDATED WITH METADATA)
# ============================================================================

@app.post("/classify/complete")
async def classify_complete_requirement(item: RequirementInput):
    """
    Performs complete analysis on a requirement:
    1. FR/NFR Classification
    2. NFR Type (if NFR)
    3. Structural Analysis with AdvancedHybridExtractor (Actor, Action, Target, etc.)
    4. Atomicity Validation
    5. Metadata tracking
    
    Returns all results in a single response.
    """
    try:
        tokenizer_1 = model_cache["tokenizer_1"]
        model_1 = model_cache["model_1"]
        labels_1 = model_cache["labels_1"]
        
        tokenizer_2 = model_cache["tokenizer_2"]
        model_2 = model_cache["model_2"]
        labels_2 = model_cache["labels_2"]
        
        parser = model_cache.get("nlp_parser")
        device = model_cache["device"]
        
        if not parser:
            raise HTTPException(status_code=503, detail="NLP Parser not loaded")

        # Step 1: FR/NFR Classification
        inputs_1 = tokenizer_1(item.text, return_tensors="pt", truncation=True, padding=True).to(device)
        
        with torch.no_grad():
            outputs_1 = model_1(**inputs_1)
            logits_1 = outputs_1.logits
            
        probs_1 = torch.softmax(logits_1, dim=1)
        confidence_1, pred_index_1 = torch.max(probs_1, dim=1)
        fr_nfr_class = labels_1[pred_index_1.item()]
        fr_nfr_confidence = round(confidence_1.item(), 4)

        # Step 2: NFR Type Classification (if NFR)
        nfr_type = None
        nfr_type_confidence = None
        
        if fr_nfr_class == "NFR":
            inputs_2 = tokenizer_2(item.text, return_tensors="pt", truncation=True, padding=True, max_length=128).to(device)
            
            with torch.no_grad():
                logits_2 = model_2(input_ids=inputs_2['input_ids'], attention_mask=inputs_2['attention_mask'])
                
            probs_2 = torch.softmax(logits_2, dim=1)
            confidence_2, pred_index_2 = torch.max(probs_2, dim=1)
            nfr_type = labels_2[pred_index_2.item()]
            nfr_type_confidence = round(confidence_2.item(), 4)

        # Step 3: Structural Analysis with AdvancedHybridExtractor
        structure = parser.extract_components(item.text, item.id)
        
        # Combine all results INCLUDING METADATA
        complete_result = {
            "requirement_id": structure.requirement_id,
            "requirement_text": structure.original_requirement,
            "fr_nfr_class": fr_nfr_class,
            "fr_nfr_confidence": fr_nfr_confidence,
            "nfr_type": nfr_type,
            "nfr_type_confidence": nfr_type_confidence,
            "localization": structure.localization,
            "localization_lemmatized": structure.localization_lemmatized,
            "localization_cleaned": structure.localization_cleaned,
            "actor": structure.actor,
            "actor_lemmatized": structure.actor_lemmatized,
            "actor_cleaned": structure.actor_cleaned,
            "action": structure.action,
            "action_lemmatized": structure.action_lemmatized,
            "action_cleaned": structure.action_cleaned,
            "target": structure.target,
            "target_lemmatized": structure.target_lemmatized,
            "target_cleaned": structure.target_cleaned,
            "constraint": structure.constraint,
            "constraint_lemmatized": structure.constraint_lemmatized,
            "constraint_cleaned": structure.constraint_cleaned,
            "confidence": structure.confidence,
            "extraction_method": structure.extraction_method,
            "is_atomic": structure.is_atomic,
            "atomicity_score": structure.atomicity_score,
            "atomicity_violations": structure.atomicity_violations,
            # ✅ ADD METADATA FIELDS
            "filename": item.filename or "Unknown",
            "timestamp": item.timestamp or datetime.now().isoformat(),
            "uploader": item.uploader or "Unknown"
        }
        
        return complete_result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# 8. ✅ FIXED: BATCH COMPLETE ENDPOINT (FOR FR/NFR CLASSIFIER PAGE)
# ============================================================================
@app.post("/classify/batch-complete")
async def classify_batch_complete(batch: BatchRequirementInput):
    """
    ✅ FIXED: This endpoint now ONLY performs FR/NFR classification
    and structural analysis. It does NOT perform NFR sub-categorization.
    This is the endpoint your first classifier page should call.
    """
    try:
        tokenizer_1 = model_cache["tokenizer_1"]
        model_1 = model_cache["model_1"]
        labels_1 = model_cache["labels_1"]
        
        # --- NFR MODEL 2 (tokenizer_2, model_2, labels_2) REMOVED FROM THIS ENDPOINT ---
        
        parser = model_cache.get("nlp_parser")
        device = model_cache["device"]
        
        if not parser:
            raise HTTPException(status_code=503, detail="NLP Parser not loaded")

        results = []
        
        for req in batch.requirements:
            # Step 1: FR/NFR Classification
            inputs_1 = tokenizer_1(req.text, return_tensors="pt", truncation=True, padding=True).to(device)
            
            with torch.no_grad():
                outputs_1 = model_1(**inputs_1)
                logits_1 = outputs_1.logits
                
            probs_1 = torch.softmax(logits_1, dim=1)
            confidence_1, pred_index_1 = torch.max(probs_1, dim=1)
            fr_nfr_class = labels_1[pred_index_1.item()]
            fr_nfr_confidence = round(confidence_1.item(), 4)

            # --- STEP 2 (NFR Sub-typing) REMOVED ---
            
            # --- THIS LOGIC BLOCK IS NOW COMMENTED OUT ---
            # if fr_nfr_class == "NFR":
            #     ... (NFR model 2 logic was here) ...
            # --- END OF REMOVED BLOCK ---

            # Step 3: Structural Analysis with AdvancedHybridExtractor
            structure = parser.extract_components(req.text, req.id)
            
            # Combine all results - nfr_type and nfr_type_confidence keys are now fully removed
            results.append({
                "requirement_id": structure.requirement_id,
                "requirement_text": structure.original_requirement,
                "fr_nfr_class": fr_nfr_class,
                "fr_nfr_confidence": fr_nfr_confidence,
                # "nfr_type": nfr_type,                 <- REMOVED
                # "nfr_type_confidence": nfr_type_confidence, <- REMOVED
                "localization": structure.localization,
                "localization_lemmatized": structure.localization_lemmatized,
                "localization_cleaned": structure.localization_cleaned,
                "actor": structure.actor,
                "actor_lemmatized": structure.actor_lemmatized,
                "actor_cleaned": structure.actor_cleaned,
                "action": structure.action,
                "action_lemmatized": structure.action_lemmatized,
                "action_cleaned": structure.action_cleaned,
                "target": structure.target,
                "target_lemmatized": structure.target_lemmatized,
                "target_cleaned": structure.target_cleaned,
                "constraint": structure.constraint,
                "constraint_lemmatized": structure.constraint_lemmatized,
                "constraint_cleaned": structure.constraint_cleaned,
                "confidence": structure.confidence,
                "extraction_method": structure.extraction_method,
                "is_atomic": structure.is_atomic,
                "atomicity_score": structure.atomicity_score,
                "atomicity_violations": structure.atomicity_violations,
                "filename": req.filename or "Unknown",
                "timestamp": req.timestamp or datetime.now().isoformat(),
                "uploader": req.uploader or "Unknown"
            })
        
        # Save results with the "classification" file name
        save_analysis_results(results, "batch_complete_classification")
        
        return {"results": results, "total_analyzed": len(results)}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# 9. AMBIGUITY DETECTION ENDPOINT (NEW)
# ============================================================================

def calculate_ai_ambiguity_score(text, is_ambiguous, confidence):
    """Scoring with corrected thresholds"""
    
    embedder = model_cache.get("ambiguity_embedder")
    classifiers = model_cache.get("ambiguity_classifiers")
    thresholds = model_cache.get("ambiguity_thresholds")
    TYPE_NAMES = model_cache.get("ambiguity_type_names")
    
    if not embedder or not classifiers:
        return None

    if not is_ambiguous:
        return {
            'ambiguity_score': 0.0, 'severity': 'CLEAR',
            'justification': 'Classified as unambiguous.',
            'types_detected': [], 'type_scores': {},
            'clarity_scores': {}, 'ai_signals': {}
        }

    embedding = embedder.encode([text])
    predictions = np.array([clf.predict_proba(embedding)[:, 1] for clf in classifiers]).flatten()

    type_scores = {TYPE_NAMES[i]: float(predictions[i]) for i in range(5)}

    # Use CORRECTED thresholds
    detected_types = [TYPE_NAMES[i] for i in range(5) if predictions[i] > thresholds[TYPE_NAMES[i]]]

    if detected_types:
        avg_type_score = np.mean([predictions[i] for i in range(5) if TYPE_NAMES[i] in detected_types])
    else:
        avg_type_score = np.mean(predictions)

    final_score = 0.70 * avg_type_score + 0.30 * confidence
    final_score = max(0.0, min(1.0, final_score))

    if detected_types:
        justification = f"Detected {len(detected_types)} type(s): {', '.join([t.capitalize() for t in detected_types])}"
    else:
        top_idx = np.argmax(predictions)
        justification = f"Weak signals (highest: {TYPE_NAMES[top_idx].capitalize()} at {predictions[top_idx]:.0%}, needs {thresholds[TYPE_NAMES[top_idx]]:.0%})"

    if avg_type_score > 0.6:
        justification += " - high clarity deficit"
    justification += "."

    severity = 'LOW' if final_score < 0.4 else 'MEDIUM' if final_score < 0.7 else 'HIGH'

    return {
        'ambiguity_score': round(final_score, 2),
        'severity': severity,
        'justification': justification,
        'types_detected': detected_types,
        'type_scores': {k: round(v, 2) for k, v in type_scores.items()},
        'type_thresholds': {k: round(v, 2) for k, v in thresholds.items()},
        'clarity_scores': {
            'not_specific': round(min(avg_type_score * 0.8, 1.0), 2),
            'not_measurable': round(min(avg_type_score * 0.9, 1.0), 2),
            'not_testable': round(min(avg_type_score * 0.85, 1.0), 2)
        },
        'ai_signals': {
            'avg_type_score': round(float(avg_type_score), 2),
            'num_detected': len(detected_types)
        }
    }

@app.post("/analyze/ambiguity")
async def analyze_ambiguity(item: TextInput):
    """
    Analyzes a requirement for ambiguity using RoBERTa (binary) and SetFit (types).
    """
    try:
        tokenizer = model_cache.get("ambiguity_tokenizer")
        model = model_cache.get("ambiguity_model")
        device = model_cache.get("device")
        
        if not tokenizer or not model:
            raise HTTPException(status_code=503, detail="Ambiguity models not loaded")

        # 1. Binary Classification
        inputs = tokenizer(item.text, return_tensors="pt", truncation=True, padding=True, max_length=128).to(device)
        
        with torch.no_grad():
            outputs = model(**inputs)
            logits = outputs.logits
            
        probs = torch.softmax(logits, dim=1)
        prediction = torch.argmax(probs, dim=1).item()
        confidence = probs[0][prediction].item()
        is_ambiguous = bool(prediction)

        # 2. Type Detection & Scoring
        score_result = calculate_ai_ambiguity_score(item.text, is_ambiguous, confidence)
        
        result = {
            "text": item.text,
            "is_ambiguous": is_ambiguous,
            "confidence": round(confidence, 4),
            "analysis": score_result,
            "filename": item.filename,
            "timestamp": item.timestamp,
            "uploader": item.uploader
        }
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# 10. ✅ UNCHANGED: NFR SUB-CATEGORIZATION ENDPOINT
# ============================================================================
@app.post("/subcategorize/batch-nfr")
async def subcategorize_batch_nfr(batch: BatchRequirementInput):
    """
    This endpoint is for the NFR Subcategorizer page.
    It correctly runs ALL models (FR/NFR, NFR-Type, and Parser)
    and saves the file with the "nfr_subcategorization" name.
    THIS FUNCTION IS UNCHANGED AND WORKS AS INTENDED.
    """
    try:
        tokenizer_1 = model_cache["tokenizer_1"]
        model_1 = model_cache["model_1"]
        labels_1 = model_cache["labels_1"]
        
        tokenizer_2 = model_cache["tokenizer_2"]
        model_2 = model_cache["model_2"]
        labels_2 = model_cache["labels_2"]
        
        parser = model_cache.get("nlp_parser")
        device = model_cache["device"]
        
        if not parser:
            raise HTTPException(status_code=503, detail="NLP Parser not loaded")

        results = []
        
        for req in batch.requirements:
            # FR/NFR Classification
            inputs_1 = tokenizer_1(req.text, return_tensors="pt", truncation=True, padding=True).to(device)
            
            with torch.no_grad():
                outputs_1 = model_1(**inputs_1)
                logits_1 = outputs_1.logits
                
            probs_1 = torch.softmax(logits_1, dim=1)
            confidence_1, pred_index_1 = torch.max(probs_1, dim=1)
            fr_nfr_class = labels_1[pred_index_1.item()]
            fr_nfr_confidence = round(confidence_1.item(), 4)

            # NFR Type Classification (if NFR)
            nfr_type = None
            nfr_type_confidence = None
            
            # This endpoint IS supposed to run this block
            if fr_nfr_class == "NFR":
                inputs_2 = tokenizer_2(req.text, return_tensors="pt", truncation=True, padding=True, max_length=128).to(device)
                
                with torch.no_grad():
                    logits_2 = model_2(input_ids=inputs_2['input_ids'], attention_mask=inputs_2['attention_mask'])
                    
                probs_2 = torch.softmax(logits_2, dim=1)
                confidence_2, pred_index_2 = torch.max(probs_2, dim=1)
                nfr_type = labels_2[pred_index_2.item()]
                nfr_type_confidence = round(confidence_2.item(), 4)

            # Structural Analysis with AdvancedHybridExtractor
            structure = parser.extract_components(req.text, req.id)
            
            # Combine all results INCLUDING METADATA
            results.append({
                "requirement_id": structure.requirement_id,
                "requirement_text": structure.original_requirement,
                "fr_nfr_class": fr_nfr_class,
                "fr_nfr_confidence": fr_nfr_confidence,
                "nfr_type": nfr_type,
                "nfr_type_confidence": nfr_type_confidence,
                "localization": structure.localization,
                "localization_lemmatized": structure.localization_lemmatized,
                "localization_cleaned": structure.localization_cleaned,
                "actor": structure.actor,
                "actor_lemmatized": structure.actor_lemmatized,
                "actor_cleaned": structure.actor_cleaned,
                "action": structure.action,
                "action_lemmatized": structure.action_lemmatized,
                "action_cleaned": structure.action_cleaned,
                "target": structure.target,
                "target_lemmatized": structure.target_lemmatized,
                "target_cleaned": structure.target_cleaned,
                "constraint": structure.constraint,
                "constraint_lemmatized": structure.constraint_lemmatized,
                "constraint_cleaned": structure.constraint_cleaned,
                "confidence": structure.confidence,
                "extraction_method": structure.extraction_method,
                "is_atomic": structure.is_atomic,
                "atomicity_score": structure.atomicity_score,
                "atomicity_violations": structure.atomicity_violations,
                # ✅ ADD METADATA FIELDS
                "filename": req.filename or "Unknown",
                "timestamp": req.timestamp or datetime.now().isoformat(),
                "uploader": req.uploader or "Unknown"
            })
        
        # Save with the "nfr_subcategorization" file name
        save_analysis_results(results, "batch_nfr_subcategorization")
        
        return {"results": results, "total_analyzed": len(results)}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# 11. COMPLETENESS CHECKER ENDPOINT (NEW)
# ============================================================================

class CompletenessInput(BaseModel):
    requirements: str
    domain: str
    filename: Optional[str] = None
    timestamp: Optional[str] = None
    uploader: Optional[str] = None

@app.post("/analyze/completeness")
async def analyze_completeness(item: CompletenessInput):
    """
    Analyzes requirements completeness against a domain knowledge base.
    """
    try:
        analyzer = model_cache.get("completeness_analyzer")
        if not analyzer:
            raise HTTPException(status_code=503, detail="Completeness Analyzer not loaded")
            
        result = analyzer.analyze(item.requirements, item.domain)
        
        # Add metadata to result
        result["filename"] = item.filename
        result["timestamp"] = item.timestamp
        result["uploader"] = item.uploader
        
        # Save results
        save_analysis_results(result, "completeness_analysis")
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# 12. CONFLICT DETECTOR ENDPOINT (NEW)
# ============================================================================

class ConflictInput(BaseModel):
    requirements: List[str]
    domain: Optional[str] = 'auto'
    filename: Optional[str] = None
    timestamp: Optional[str] = None
    uploader: Optional[str] = None

# Helper to convert numpy types to native python types
def convert_to_serializable(obj):
    if isinstance(obj, np.generic):
        return obj.item()
    if isinstance(obj, dict):
        return {k: convert_to_serializable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [convert_to_serializable(i) for i in obj]
    return obj

@app.post("/analyze/conflicts")
async def analyze_conflicts(item: ConflictInput):
    """
    Analyzes requirements for conflicts, duplicates, and inconsistencies.
    """
    try:
        detector = model_cache.get("conflict_detector")
        if not detector:
            raise HTTPException(status_code=503, detail="Conflict Detector not loaded")
            
        # Set domain if provided and not auto
        if item.domain != 'auto':
            detector.set_domain(item.domain)
            
        # Analyze
        detections = detector.analyze_requirements(item.requirements, verbose=False, auto_detect_domain=(item.domain == 'auto'))
        
        # Format results
        results = []
        for d in detections:
            results.append({
                "req1_id": d.req1_id,
                "req2_id": d.req2_id,
                "req1_text": d.req1,
                "req2_text": d.req2,
                "issue_type": d.issue_type.value,
                "confidence": float(d.confidence),
                "evidence": convert_to_serializable(d.evidence)
            })
            
        response_data = {
            "total_issues": len(results),
            "detections": results,
            "domain_used": detector.nlp_utils.domain,
            "filename": item.filename,
            "timestamp": item.timestamp,
            "uploader": item.uploader
        }
        
        # Save results
        save_analysis_results(response_data, "conflict_analysis")
        
        return response_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# 13. PRIORITIZATION ENDPOINT (NEW)
# ============================================================================

class PrioritizerInput(BaseModel):
    requirements: List[str]
    ambiguity_data: Optional[Dict] = None
    conflict_data: Optional[Dict] = None
    filename: Optional[str] = None
    timestamp: Optional[str] = None
    uploader: Optional[str] = None

@app.post("/analyze/prioritize")
async def analyze_prioritize(item: PrioritizerInput):
    """
    Analyzes and prioritizes requirements using MoSCoW and hybrid scoring.
    """
    try:
        moscow = model_cache.get("moscow_prioritizer")
        hybrid = model_cache.get("hybrid_prioritizer")
        if not moscow or not hybrid:
            raise HTTPException(status_code=503, detail="Prioritizers not loaded")
            
        # 1. MoSCoW Prioritization
        moscow_results = moscow.prioritize_requirements(item.requirements)
        
        # 2. Hybrid Refinement
        refined_results = hybrid.refine_prioritization(
            moscow_results,
            ambiguity_data=item.ambiguity_data,
            conflict_data=item.conflict_data
        )
        
        response_data = {
            "total_prioritized": len(refined_results),
            "results": refined_results,
            "filename": item.filename,
            "timestamp": item.timestamp,
            "uploader": item.uploader
        }
        
        save_analysis_results(response_data, "prioritization_analysis")
        
        return response_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# 14. GENERIC RESULT SAVER ENDPOINT
# ============================================================================

class SaveResultInput(BaseModel):
    module_name: str
    data: Any

@app.post("/save-results")
async def save_results(item: SaveResultInput):
    """
    Generic endpoint to allow the frontend to save final analysis results
    for any module (e.g., Ambiguity, Impact Analyzer, Risk Estimator).
    """
    try:
        save_analysis_results(item.data, item.module_name)
        return {"message": f"Successfully saved {item.module_name} results"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
