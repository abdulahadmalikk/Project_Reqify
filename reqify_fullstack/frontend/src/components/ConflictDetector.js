import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import axios from 'axios';
import './Classifier.css'; // Reusing existing styles
import './ConflictDetector.css'; // New styles

const ConflictMatrixModal = ({ isOpen, onClose, requirements, detections }) => {
    const [matrixData, setMatrixData] = useState([]);

    useEffect(() => {
        if (isOpen && requirements.length > 0 && detections) {
            generateMatrix();
        }
    }, [isOpen, requirements, detections]);

    const generateMatrix = () => {
        const size = requirements.length;
        const matrix = Array(size).fill(null).map(() => Array(size).fill(null));

        // Initialize diagonal
        for (let i = 0; i < size; i++) matrix[i][i] = { type: 'SELF' };

        // Determine a mapping from Requirement ID (or Text) to Index because detections refer to IDs
        // Assuming requirements array has { id: '...', text: '...' }
        // And Detections use IDs. Let's map ID -> Index
        const idToIndex = {};
        requirements.forEach((req, idx) => {
            idToIndex[req.id] = idx;
        });

        detections.forEach(d => {
            // Note: d.req1_id might be "REQ-1" or just "1" depending on backend.
            // If backend returns indices or IDs, we need to match them.
            // Let's assume detections return IDs that match requirement.id

            // Check if req1_id and req2_id exist in our map
            const i = idToIndex[d.req1_id]; // or d.req1_id if it's an index
            const j = idToIndex[d.req2_id];

            // Fallback: if d.req1_id is not in map (maybe inconsistent ID formats), try finding by text?
            // Ideally IDs should match. If not, we might have an issue.

            if (i !== undefined && j !== undefined) {
                let code = 'C';
                if (d.issue_type === 'duplicate') code = 'D';
                else if (d.issue_type === 'inconsistency') code = 'I';

                const cellData = { type: d.issue_type, code, ...d };
                matrix[i][j] = cellData;
                matrix[j][i] = cellData;
            } else {
                // If IDs don't match directly, let's try mapping by index if detections just return 0, 1, 2...
                // Only do this if req1_id is an integer (or string int) < size
                const idx1 = parseInt(d.req1_id);
                const idx2 = parseInt(d.req2_id);
                if (!isNaN(idx1) && !isNaN(idx2) && idx1 < size && idx2 < size) {
                    let code = 'C';
                    if (d.issue_type === 'duplicate') code = 'D';
                    else if (d.issue_type === 'inconsistency') code = 'I';

                    const cellData = { type: d.issue_type, code, ...d };
                    matrix[idx1][idx2] = cellData;
                    matrix[idx2][idx1] = cellData;
                }
            }
        });
        setMatrixData(matrix);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" style={{ maxWidth: '900px', width: '95%', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: '16px', borderBottom: '1px solid #e5e7eb', position: 'relative', width: '100%' }}>
                    <h3 className="modal-title" style={{ margin: 0 }}>Conflict Matrix</h3>
                    <button onClick={onClose} style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: '28px', cursor: 'pointer', color: 'var(--text-primary)', padding: '0 8px', lineHeight: 1 }}>&times;</button>
                </div>

                <div style={{ padding: '0 20px 20px', overflow: 'auto', flex: 1 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: `auto repeat(${requirements.length}, minmax(60px, 1fr))`, gap: '1px', background: 'var(--border-color)', border: '1px solid var(--border-color)' }}>
                        {/* Header Row */}
                        <div style={{ background: 'var(--bg-secondary)', padding: '12px', fontWeight: 'bold', position: 'sticky', top: 0, left: 0, zIndex: 10 }}>ID</div>
                        {requirements.map((r, i) => (
                            <div key={i} style={{ background: 'var(--bg-secondary)', padding: '12px', textAlign: 'center', fontWeight: 'bold', position: 'sticky', top: 0, zIndex: 1, fontSize: '13px' }}>
                                REQ-{i + 1}
                            </div>
                        ))}

                        {/* Matrix Rows */}
                        {matrixData.map((row, i) => (
                            <React.Fragment key={i}>
                                {/* Row Label */}
                                <div style={{ background: 'var(--bg-secondary)', padding: '12px', fontWeight: 'bold', position: 'sticky', left: 0, zIndex: 5, fontSize: '13px', borderRight: '1px solid var(--border-color)' }}>
                                    REQ-{i + 1}
                                </div>
                                {/* Cells */}
                                {row.map((cell, j) => (
                                    <div key={j} style={{
                                        padding: '12px',
                                        textAlign: 'center',
                                        backgroundColor: !cell ? 'var(--bg-primary)' :
                                            cell.type === 'SELF' ? 'var(--bg-tertiary)' :
                                                cell.type === 'duplicate' ? 'var(--error-bg)' : 'var(--warning-bg)',
                                        color: !cell ? 'inherit' :
                                            cell.type === 'SELF' ? 'transparent' :
                                                cell.type === 'duplicate' ? 'var(--error-text)' : 'var(--warning-text)',
                                        fontWeight: cell && cell.type !== 'SELF' ? 'bold' : 'normal',
                                        cursor: cell && cell.type !== 'SELF' ? 'pointer' : 'default',
                                        fontSize: '13px'
                                    }}
                                        title={cell && cell.type !== 'SELF' ? `${cell.type.toUpperCase()}: ${cell.req1_text} vs ${cell.req2_text}\nConfidence: ${(cell.confidence * 100).toFixed(1)}%` : ''}
                                    >
                                        {cell ? (cell.type === 'SELF' ? '-' : cell.code) : ''}
                                    </div>
                                ))}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                <div style={{ marginTop: '15px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '12px' }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>Legend:</div>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                            <span style={{ width: '12px', height: '12px', background: '#3b82f6', borderRadius: '2px' }}></span> Duplicate (D)
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                            <span style={{ width: '12px', height: '12px', background: '#f59e0b', borderRadius: '2px' }}></span> Conflict (C)
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                            <span style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '2px' }}></span> Inconsistency (I)
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

function ConflictDetector({ userEmail, onLogout }) {
    const { isDark, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [requirements, setRequirements] = useState([]);
    const [selectedReqs, setSelectedReqs] = useState(new Set());
    const [analysisResult, setAnalysisResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('select'); // 'select' or 'results'
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [selectedDomain, setSelectedDomain] = useState('ecommerce');
    const [showMatrixModal, setShowMatrixModal] = useState(false);

    // Load requirements from previous stages
    useEffect(() => {
        const loadRequirements = () => {
            // Try loading from Completeness Analysis first (most recent)
            const completenessResults = localStorage.getItem('reqify_completeness_results');
            if (completenessResults) {
                const parsed = JSON.parse(completenessResults);
                // Completeness results might be just analysis, we need the input requirements
                // If not stored directly, fall back to NFR/Ambiguity results
            }

            // Fallback to Ambiguity Results
            const ambiguityResults = localStorage.getItem('reqify_ambiguity_results');
            if (ambiguityResults) {
                const parsed = JSON.parse(ambiguityResults);
                if (Array.isArray(parsed)) {
                    setRequirements(parsed.map(r => ({
                        id: r.id || Math.random().toString(36).substr(2, 9),
                        text: r.text || r.original_requirement,
                        source: 'Ambiguity Analysis'
                    })));
                    return;
                }
            }



            // Fallback to Classification
            const classificationResults = localStorage.getItem('reqify_classification_results');
            if (classificationResults) {
                const parsed = JSON.parse(classificationResults);
                if (Array.isArray(parsed)) {
                    setRequirements(parsed.map(r => ({
                        id: r.requirement_id || Math.random().toString(36).substr(2, 9),
                        text: r.requirement_text || r.original_requirement,
                        source: 'Classification'
                    })));
                }
            }
        };

        loadRequirements();

        // Check for existing conflict results
        const savedResults = localStorage.getItem('reqify_conflict_results');
        if (savedResults) {
            setAnalysisResult(JSON.parse(savedResults));
            // setActiveTab('results'); // Removed to prioritize Selection view
        }
    }, []);

    const handleSelectAll = () => {
        if (selectedReqs.size === requirements.length) {
            setSelectedReqs(new Set());
        } else {
            setSelectedReqs(new Set(requirements.map(r => r.id)));
        }
    };

    const handleSelectReq = (id) => {
        const newSelected = new Set(selectedReqs);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedReqs(newSelected);
    };

    const analyzeConflicts = async () => {
        if (selectedReqs.size < 2) {
            alert('Please select at least 2 requirements to check for conflicts.');
            return;
        }

        setIsLoading(true);
        try {
            const selectedTexts = requirements
                .filter(r => selectedReqs.has(r.id))
                .map(r => r.text);

            const response = await axios.post('http://localhost:8000/analyze/conflicts', {
                requirements: selectedTexts,
                domain: selectedDomain,
                timestamp: new Date().toISOString(),
                uploader: userEmail
            });

            setAnalysisResult(response.data);
            localStorage.setItem('reqify_conflict_results', JSON.stringify(response.data));
            setActiveTab('results');
        } catch (error) {
            console.error('Error analyzing conflicts:', error);
            alert('Error analyzing conflicts. Please check if the API is running on port 8000.');
        } finally {
            setIsLoading(false);
        }
    };

    const clearResults = () => {
        setAnalysisResult(null);
        localStorage.removeItem('reqify_conflict_results');
        setActiveTab('select');
        setShowClearConfirm(false);
    };

    const getIssueColor = (type) => {
        switch (type) {
            case 'conflict': return '#ef4444'; // Red
            case 'duplicate': return '#3b82f6'; // Blue
            case 'inconsistency': return '#f59e0b'; // Amber
            default: return '#6b7280';
        }
    };

    const getIssueIcon = (type) => {
        switch (type) {
            case 'conflict': return '✗';
            case 'duplicate': return '✓';
            case 'inconsistency': return '⚠';
            default: return '?';
        }
    };

    return (
        <div className={`classifier-container ${isDark ? 'dark' : 'light'}`}>
            {/* Navbar */}
            <nav className="classifier-nav">
                <div className="nav-left">
                    <div className="logo">
                        <h1>REQIFY</h1>
                    </div>
                    <div className="nav-links">
                        <button onClick={() => navigate('/dashboard')} className="nav-link">Dashboard</button>
                        <button onClick={() => navigate('/classifier')} className="nav-link">Classifier</button>
                        <button onClick={() => navigate('/nfr-classifier')} className="nav-link">NFR Analysis</button>
                        <button onClick={() => navigate('/ambiguity-analysis')} className="nav-link">Ambiguity</button>
                        <button onClick={() => navigate('/completeness-checker')} className="nav-link">Completeness</button>
                        <button className="nav-link active">Conflicts</button>
                        <button onClick={() => navigate('/prioritizer')} className="nav-link">Prioritization</button>
                        <button onClick={() => navigate('/impact-analyzer')} className="nav-link">Impact Analyzer</button>
                        <button onClick={() => navigate('/risk-estimator')} className="nav-link">Risk Estimator</button>
                    </div>
                </div>
                <div className="nav-right">
                    <button onClick={toggleTheme} className="theme-toggle" title="Toggle theme">
                        {isDark ? '☀️' : '🌙'}
                    </button>
                    <div className="user-info">
                        <span className="user-avatar">{userEmail.charAt(0).toUpperCase()}</span>
                        <span className="user-email">{userEmail}</span>
                    </div>
                    <button onClick={onLogout} className="logout-btn" title="Logout">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                    </button>
                </div>
            </nav>

            <main className="classifier-content">
                <div className="content-header">
                    <div>
                        <h2>Conflict, Duplicate & Inconsistency Analyzer</h2>
                        <p className="subtitle">Detect contradictions, duplicates, and inconsistencies in your requirements</p>
                    </div>
                    {analysisResult && (
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={() => setShowMatrixModal(true)}
                                className="clear-btn"
                                style={{ background: 'var(--accent-primary)', color: 'white', border: 'none' }}
                            >
                                Generate Matrix
                            </button>
                            <button
                                onClick={() => setShowClearConfirm(true)}
                                className="clear-btn"
                            >
                                Clear Results
                            </button>
                        </div>
                    )}
                </div>

                {/* Matrix Modal */}
                {analysisResult && (
                    <ConflictMatrixModal
                        isOpen={showMatrixModal}
                        onClose={() => setShowMatrixModal(false)}
                        // Filter requirements to match those analyzed if needed, or pass all requirements if analysisResult includes all
                        // Assuming analysisResult corresponds to the "selectedReqs"
                        requirements={requirements.filter(r => selectedReqs.has(r.id))}
                        detections={analysisResult.detections}
                    />
                )}

                {/* Tabs */}
                <div className="tabs">
                    <button
                        className={`tab ${activeTab === 'select' ? 'active' : ''}`}
                        onClick={() => setActiveTab('select')}
                    >
                        Selection ({selectedReqs.size})
                    </button>
                    <button
                        className={`tab ${activeTab === 'results' ? 'active' : ''}`}
                        onClick={() => setActiveTab('results')}
                        disabled={!analysisResult}
                    >
                        Results {analysisResult && `(${analysisResult.total_issues})`}
                    </button>
                </div>

                {/* Selection Tab */}
                {
                    activeTab === 'select' && (
                        <div className="tab-content">
                            <div className="controls-bar">
                                <div className="left-controls">
                                    <label className="checkbox-container">
                                        <input
                                            type="checkbox"
                                            checked={requirements.length > 0 && selectedReqs.size === requirements.length}
                                            onChange={handleSelectAll}
                                        />
                                        <span className="checkmark"></span>
                                        Select All ({requirements.length})
                                    </label>

                                    <div className="domain-selector" style={{ marginLeft: '20px' }}>
                                        <label style={{ marginRight: '10px', fontSize: '14px', color: 'var(--text-secondary)' }}>Domain:</label>
                                        <select
                                            value={selectedDomain}
                                            onChange={(e) => setSelectedDomain(e.target.value)}
                                            className="domain-select"
                                            style={{
                                                padding: '8px 12px',
                                                borderRadius: '6px',
                                                border: '1px solid var(--border-color)',
                                                background: 'var(--bg-secondary)',
                                                color: 'var(--text-primary)',
                                                fontSize: '14px'
                                            }}
                                        >
                                            <option value="ecommerce">E-Commerce</option>
                                            <option value="healthcare">Healthcare</option>
                                            <option value="finance">Finance</option>
                                            <option value="education">Education</option>
                                            <option value="hrms">HRMS</option>
                                            <option value="crm">CRM</option>
                                            <option value="logistics">Logistics</option>
                                            <option value="hotel">Hotel Management</option>
                                            <option value="telecom">Telecom</option>
                                            <option value="insurance">Insurance</option>
                                            <option value="banking">Banking</option>
                                            <option value="restaurant">Restaurant</option>
                                        </select>
                                    </div>
                                </div>

                                <button
                                    className="analyze-btn"
                                    onClick={analyzeConflicts}
                                    disabled={selectedReqs.size < 2 || isLoading}
                                >
                                    {isLoading ? (
                                        <>
                                            <span className="spinner-small"></span>
                                            Analyzing...
                                        </>
                                    ) : (
                                        <>
                                            <span>⚡</span>
                                            Find Conflicts
                                        </>
                                    )}
                                </button>
                            </div>

                            <div className="requirements-list">
                                {requirements.length === 0 ? (
                                    <div className="empty-state">
                                        <p>No requirements found. Please run previous analyses first.</p>
                                    </div>
                                ) : (
                                    requirements.map((req) => (
                                        <div
                                            key={req.id}
                                            className={`req-item ${selectedReqs.has(req.id) ? 'selected' : ''}`}
                                            onClick={() => handleSelectReq(req.id)}
                                        >
                                            <div className="req-checkbox">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedReqs.has(req.id)}
                                                    onChange={() => { }} // Handled by parent div click
                                                />
                                                <span className="checkmark"></span>
                                            </div>
                                            <div className="req-text">{req.text}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )
                }

                {/* Results Tab */}
                {
                    activeTab === 'results' && analysisResult && (
                        <div className="tab-content">
                            <div className="results-summary-cards">
                                <div className="summary-card" style={{ borderLeft: '4px solid #ef4444' }}>
                                    <div className="card-label">Conflicts</div>
                                    <div className="card-value">
                                        {analysisResult.detections.filter(d => d.issue_type === 'conflict').length}
                                    </div>
                                </div>
                                <div className="summary-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                                    <div className="card-label">Inconsistencies</div>
                                    <div className="card-value">
                                        {analysisResult.detections.filter(d => d.issue_type === 'inconsistency').length}
                                    </div>
                                </div>
                                <div className="summary-card" style={{ borderLeft: '4px solid #3b82f6' }}>
                                    <div className="card-label">Duplicates</div>
                                    <div className="card-value">
                                        {analysisResult.detections.filter(d => d.issue_type === 'duplicate').length}
                                    </div>
                                </div>
                                <div className="summary-card">
                                    <div className="card-label">Domain Used</div>
                                    <div className="card-value" style={{ fontSize: '1.2rem', textTransform: 'uppercase' }}>
                                        {analysisResult.domain_used}
                                    </div>
                                </div>
                            </div>

                            <div className="issues-list">
                                {analysisResult.detections.length === 0 ? (
                                    <div className="empty-results">
                                        <div className="success-icon">✓</div>
                                        <h3>No Issues Detected!</h3>
                                        <p>Your requirements appear to be consistent and conflict-free.</p>
                                    </div>
                                ) : (
                                    analysisResult.detections.map((issue, index) => (
                                        <div key={index} className="issue-card" style={{ borderLeft: `4px solid ${getIssueColor(issue.issue_type)}` }}>
                                            <div className="issue-header">
                                                <div className="issue-type-badge" style={{
                                                    backgroundColor: `${getIssueColor(issue.issue_type)}20`,
                                                    color: getIssueColor(issue.issue_type)
                                                }}>
                                                    <span style={{ marginRight: '6px' }}>{getIssueIcon(issue.issue_type)}</span>
                                                    {issue.issue_type.toUpperCase()}
                                                </div>
                                            </div>

                                            <div className="issue-pair">
                                                <div className="req-box">
                                                    <div className="req-label">Requirement A</div>
                                                    <div className="req-content">{issue.req1_text}</div>
                                                </div>
                                                <div className="issue-connector">
                                                    vs
                                                </div>
                                                <div className="req-box">
                                                    <div className="req-label">Requirement B</div>
                                                    <div className="req-content">{issue.req2_text}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )
                }
            </main >

            {/* Clear Confirmation Modal */}
            {
                showClearConfirm && (
                    <div className="modal-overlay">
                        <div className="modal-content">
                            <h3>Clear Results?</h3>
                            <p>Are you sure you want to clear the current analysis results?</p>
                            <div className="modal-actions">
                                <button onClick={() => setShowClearConfirm(false)} className="cancel-btn">Cancel</button>
                                <button onClick={clearResults} className="confirm-btn">Clear</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

export default ConflictDetector;
