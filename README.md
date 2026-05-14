# Reqify — Intelligent Requirements Assurance & Impact Analysis Platform

Reqify is an AI-powered fullstack platform designed to automate the analysis, classification, and quality assurance of software requirements. It helps software engineers and analysts detect ambiguities, conflicts, and gaps in requirements while providing intelligent prioritization and impact analysis.

---

## Features

| Module | Description |
|---|---|
| **Requirement Extractor** | Parses raw requirements and extracts structured components (Actor, Action, Target, Constraint) |
| **FR/NFR Classifier** | Classifies requirements as Functional or Non-Functional using a fine-tuned transformer model |
| **NFR Sub-Categorizer** | Sub-categorizes NFRs into types (Performance, Security, Usability, etc.) |
| **Ambiguity Checker** | Detects vague, ambiguous, or unclear language in requirements |
| **Completeness Checker** | Identifies missing components and incomplete requirement statements |
| **Conflict Detector** | Detects contradictions, duplicates, and inconsistencies between requirements |
| **MoSCoW Prioritizer** | Classifies requirements using MoSCoW (Must/Should/Could/Won't) with hybrid scoring |
| **Impact Analyzer** | Analyzes the downstream impact of requirement changes using dependency graphs |
| **Risk Estimator** | Estimates implementation risk based on requirement complexity and ambiguity |

---

## Tech Stack

### Frontend
- **React.js** — Component-based UI
- **Vanilla CSS** — Custom styling with dark mode support
- **React Router** — Client-side routing
- **Axios** — HTTP client for API communication

### Backend
- **Express.js (Node.js)** — REST API server, authentication, and session management
- **MongoDB** — Database for storing users and analysis results
- **FastAPI (Python)** — AI Engine REST API
- **Uvicorn** — ASGI server for the Python AI engine

### AI / ML
- **Hugging Face Transformers** — Fine-tuned BERT/RoBERTa models for classification
- **SentenceTransformers** (`all-MiniLM-L6-v2`) — Semantic similarity for conflict detection
- **spaCy** (`en_core_web_sm`) — NLP parsing
- **scikit-learn** — Traditional ML models for ambiguity detection
- **Pint** — Unit-aware conflict detection

---

## Project Structure

```
Project_Reqify/
├── reqify_fullstack/
│   ├── frontend/                  # React frontend
│   │   └── src/
│   │       ├── components/        # All page components
│   │       ├── contexts/          # Theme context
│   │       └── App.js
│   └── backend/
│       ├── express_server/        # Node.js/Express backend
│       │   └── server.js
│       └── python_ai_engine/      # FastAPI AI engine
│           ├── main.py            # FastAPI entry point
│           ├── modules/
│           │   ├── BasicClassifier/
│           │   ├── SubCategorizer/
│           │   ├── AmbigoutyChecker/
│           │   ├── CompletenessChecker/
│           │   ├── ConflictDetector/
│           │   ├── Prioritizer/
│           │   └── RequirementExtractor/
│           └── venv_win/          # Python virtual environment (not committed)
├── requirement_samples/           # Sample CSV requirement files for testing
├── logo/                          # Project logo assets
└── start_reqify.bat               # Windows startup script
```

---

## Running the Project (Windows)

> All three services must be running simultaneously.

### 1. Python AI Engine (FastAPI)
```bash
cd reqify_fullstack/backend/python_ai_engine
.\venv_win\Scripts\activate
uvicorn main:app --port 8000
```

### 2. Express Backend (Node.js)
```bash
cd reqify_fullstack/backend/express_server
node server.js
```

### 3. React Frontend
```bash
cd reqify_fullstack/frontend
npm start
```

The frontend will be available at **http://localhost:3000**

---

## First-Time Setup

### Python AI Engine
```bash
cd reqify_fullstack/backend/python_ai_engine
python -m venv venv_win
.\venv_win\Scripts\activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

### Express Backend
```bash
cd reqify_fullstack/backend/express_server
npm install
```

### React Frontend
```bash
cd reqify_fullstack/frontend
npm install
```

> **Note:** On first run, the AI engine will download ML models (~300MB). Subsequent starts are fast as models are cached locally.

---

## Environment Variables

Create a `.env` file inside `reqify_fullstack/backend/express_server/`:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
PORT=5000
```

---

## Authors

Developed as a Final Year Project (FYP) — Intelligent Requirements Assurance & Impact Analysis Platform.
