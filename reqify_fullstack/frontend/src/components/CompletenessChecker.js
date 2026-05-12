import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import axios from 'axios';
import './Classifier.css'; // Reusing existing styles

const modalStyles = `
/* Confirmation Modal Styles - Reused */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  background: var(--bg-primary);
  border-radius: 12px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.modal-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: var(--color-danger-light);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.modal-icon svg {
  width: 24px;
  height: 24px;
  stroke: var(--color-danger-dark);
}

.modal-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.modal-message {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 24px;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.modal-btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.modal-btn-cancel {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.modal-btn-cancel:hover {
  background: var(--bg-tertiary);
}

.modal-btn-confirm {
  background: #dc2626;
  color: white;
  border: 1px solid #dc2626;
}

.modal-btn-confirm:hover {
  background: #b91c1c;
  border-color: #b91c1c;
}
`;

function CompletenessChecker({ userEmail, onLogout }) {
    const navigate = useNavigate();
    const { isDark, toggleTheme } = useTheme();
    const [requirements, setRequirements] = useState([]);
    const [analysisResult, setAnalysisResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('select');
    const [selectedReqs, setSelectedReqs] = useState([]);
    const [selectedDomain, setSelectedDomain] = useState('ecommerce');
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    const domains = [
        { id: 'ecommerce', name: 'E-Commerce System' },
        { id: 'food_delivery', name: 'Food Delivery System' },
        { id: 'learning_management_system', name: 'Learning Management System' }
    ];

    useEffect(() => {
        // Load requirements from previous stages
        const savedAmbiguity = localStorage.getItem('reqify_ambiguity_results');
        const savedClassifications = localStorage.getItem('reqify_classification_results');

        let reqsToLoad = [];
        if (savedAmbiguity) {
            try {
                const parsed = JSON.parse(savedAmbiguity);
                // Ambiguity results might be a list of objects with 'text' or 'requirement_text'
                reqsToLoad = parsed.map(r => ({
                    requirement_id: r.requirement_id,
                    requirement_text: r.text || r.requirement_text,
                    ...r
                }));
            } catch (e) { console.error(e); }
        } else if (savedClassifications) {
            try {
                reqsToLoad = JSON.parse(savedClassifications);
            } catch (e) { console.error(e); }
        }

        setRequirements(reqsToLoad);
    }, []);

    useEffect(() => {
        const savedAnalysis = localStorage.getItem('reqify_completeness_results');
        if (savedAnalysis) {
            try {
                setAnalysisResult(JSON.parse(savedAnalysis));
            } catch (error) {
                console.error('Error loading completeness results:', error);
            }
        }
    }, []);

    useEffect(() => {
        if (analysisResult) {
            localStorage.setItem('reqify_completeness_results', JSON.stringify(analysisResult));
        }
    }, [analysisResult]);

    const toggleReqSelection = (reqId) => {
        setSelectedReqs(prev => {
            if (prev.includes(reqId)) {
                return prev.filter(id => id !== reqId);
            } else {
                return [...prev, reqId];
            }
        });
    };

    const selectAllReqs = () => {
        if (selectedReqs.length === requirements.length) {
            setSelectedReqs([]);
        } else {
            setSelectedReqs(requirements.map(req => req.requirement_id));
        }
    };

    const analyzeCompleteness = async () => {
        const reqsToAnalyze = requirements.filter(
            req => selectedReqs.includes(req.requirement_id)
        );

        if (reqsToAnalyze.length === 0) {
            alert('Please select at least one requirement to analyze');
            return;
        }

        setIsLoading(true);

        try {
            // Combine all selected requirements into a single text block
            const combinedText = reqsToAnalyze.map(r => r.requirement_text).join('\n');

            const payload = {
                requirements: combinedText,
                domain: selectedDomain,
                filename: reqsToAnalyze[0].filename || 'Unknown',
                timestamp: new Date().toISOString(),
                uploader: userEmail
            };

            const response = await axios.post(
                'http://localhost:8000/analyze/completeness',
                payload
            );

            setAnalysisResult(response.data);
            setActiveTab('results');

            setTimeout(() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 100);

        } catch (error) {
            console.error('Error analyzing completeness:', error);
            alert('Error analyzing completeness. Please check if the API is running on port 8000.');
        } finally {
            setIsLoading(false);
        }
    };

    const clearAnalysisResults = () => {
        setShowClearConfirm(true);
    };

    const confirmClearResults = () => {
        localStorage.removeItem('reqify_completeness_results');
        setAnalysisResult(null);
        setSelectedReqs([]);
        setActiveTab('select');
        setShowClearConfirm(false);
    };

    const cancelClearResults = () => {
        setShowClearConfirm(false);
    };

    const getSeverityColor = (severity) => {
        switch (severity?.toLowerCase()) {
            case 'critical': return 'var(--error-text)';
            case 'medium': return 'var(--warning-text)';
            case 'low': return 'var(--success-text)';
            case 'none': return 'var(--success-text)';
            default: return 'var(--text-primary)';
        }
    };

    return (
        <div className="classifier">
            <style>{modalStyles}</style>

            {/* Clear Confirmation Modal */}
            {showClearConfirm && (
                <div className="modal-overlay" onClick={cancelClearResults}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                    <line x1="12" y1="9" x2="12" y2="13"></line>
                                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                </svg>
                            </div>
                            <h3 className="modal-title">Clear Results?</h3>
                        </div>
                        <p className="modal-message">
                            Are you sure you want to clear the completeness analysis results?
                        </p>
                        <div className="modal-actions">
                            <button className="modal-btn modal-btn-cancel" onClick={cancelClearResults}>
                                Cancel
                            </button>
                            <button className="modal-btn modal-btn-confirm" onClick={confirmClearResults}>
                                Clear Results
                            </button>
                        </div>
                    </div>
                </div>
            )}

      <nav className="classifier-nav">
          <div className="nav-left">
              <div className="logo"><h1>REQIFY</h1></div>
              <div className="nav-links">
                  <button onClick={() => navigate('/dashboard')} className="nav-link">Dashboard</button>
                  <button onClick={() => navigate('/classifier')} className="nav-link">Classifier</button>
                  <button onClick={() => navigate('/nfr-classifier')} className="nav-link">NFR Analysis</button>
                  <button onClick={() => navigate('/ambiguity-analysis')} className="nav-link">Ambiguity</button>
                  <button className="nav-link active">Completeness</button>
                  <button onClick={() => navigate('/conflict-detector')} className="nav-link">Conflicts</button>
                  <button onClick={() => navigate('/prioritizer')} className="nav-link">Prioritization</button>
                  <button onClick={() => navigate('/impact-analyzer')} className="nav-link">Impact Analyzer</button>
                  <button onClick={() => navigate('/risk-estimator')} className="nav-link">Risk Estimator</button>
              </div>
          </div>
          <div className="nav-right">
              <button onClick={toggleTheme} className="theme-toggle" title="Toggle theme">{isDark ? '☀️' : '🌙'}</button>
              <div className="user-info">
                  <span className="user-avatar">{userEmail?.charAt(0).toUpperCase()}</span>
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

            <div className="classifier-content fade-in">
                <div className="tabs">
                    <button
                        className={activeTab === 'select' ? 'tab active' : 'tab'}
                        onClick={() => {
                            setActiveTab('select');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                    >
                        <span className="tab-icon">✓</span>
                        Select Requirements
                        <span className="tab-badge">{requirements.length}</span>
                    </button>
                    <button
                        className={activeTab === 'results' ? 'tab active' : 'tab'}
                        onClick={() => {
                            setActiveTab('results');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        disabled={!analysisResult}
                    >
                        <span className="tab-icon">📊</span>
                        Analysis Results
                    </button>
                </div>

                {activeTab === 'select' && (
                    <div className="select-section slide-in">
                        <div className="section-header">
                            <h2>Select Requirements for Completeness Check</h2>
                            <p>Choose requirements and a domain to verify if all necessary modules are covered.</p>
                        </div>

                        {requirements.length === 0 ? (
                            <div className="empty-state">
                                <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                </svg>
                                <h3>No Requirements Found</h3>
                                <p>Please analyze requirements in previous steps first.</p>
                                <button onClick={() => navigate('/ambiguity-analysis')} className="btn-primary">
                                    <span>←</span>
                                    Go to Ambiguity Analysis
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="domain-selector" style={{ marginBottom: '20px', padding: '20px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
                                    <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>Select Domain:</label>
                                    <select
                                        value={selectedDomain}
                                        onChange={(e) => setSelectedDomain(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-color)',
                                            background: 'var(--bg-primary)',
                                            color: 'var(--text-primary)',
                                            fontSize: '16px'
                                        }}
                                    >
                                        {domains.map(d => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {selectedReqs.length > 0 && (
                                    <div className="classify-button-container">
                                        <button
                                            onClick={analyzeCompleteness}
                                            className="btn-classify"
                                            disabled={isLoading}
                                        >
                                            {isLoading ? (
                                                <>
                                                    <span className="spinner"></span>
                                                    <span>Analyzing...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>Check Completeness ({selectedReqs.length})</span>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <circle cx="11" cy="11" r="8"></circle>
                                                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                                    </svg>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}

                                <div className="selection-controls">
                                    <button onClick={selectAllReqs} className="btn-select-all">
                                        {selectedReqs.length === requirements.length ? (
                                            <>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                                </svg>
                                                Deselect All
                                            </>
                                        ) : (
                                            <>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polyline points="9 11 12 14 22 4"></polyline>
                                                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                                                </svg>
                                                Select All
                                            </>
                                        )}
                                    </button>
                                    <span className="selection-count">
                                        <strong>{selectedReqs.length}</strong> of <strong>{requirements.length}</strong> selected
                                    </span>
                                </div>

                                <div className="requirements-list">
                                    {requirements.map((req, index) => (
                                        <div
                                            key={index}
                                            className={`requirement-card ${selectedReqs.includes(req.requirement_id) ? 'selected' : ''}`}
                                            onClick={() => toggleReqSelection(req.requirement_id)}
                                        >
                                            <div className="card-header">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedReqs.includes(req.requirement_id)}
                                                    onChange={() => toggleReqSelection(req.requirement_id)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="custom-checkbox"
                                                />
                                                <h3>{req.requirement_id}</h3>
                                            </div>
                                            <p className="requirement-text">{req.requirement_text}</p>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'results' && analysisResult && (
                    <div className="results-section slide-in">
                        <div className="results-header">
                            <h2>Completeness Analysis Results</h2>
                            <div className="export-buttons">
                                <button onClick={clearAnalysisResults} className="btn-clear">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"></path>
                                    </svg>
                                    Clear Results
                                </button>
                            </div>
                        </div>

                        <div className="result-card" style={{ borderLeft: `4px solid ${getSeverityColor(analysisResult.severity)}` }}>
                            <div className="result-header">
                                <h3>Overall Coverage</h3>
                                <div className="classification-badges">
                                    <span className="badge" style={{
                                        backgroundColor: `rgba(${analysisResult.coverage.percentage >= 85 ? '34, 197, 94' : '239, 68, 68'}, 0.2)`,
                                        color: analysisResult.coverage.percentage >= 85 ? 'var(--success-text)' : 'var(--error-text)'
                                    }}>
                                        {analysisResult.status.toUpperCase()}
                                    </span>
                                    <span className="badge" style={{ color: getSeverityColor(analysisResult.severity), border: `1px solid ${getSeverityColor(analysisResult.severity)}` }}>
                                        SEVERITY: {analysisResult.severity.toUpperCase()}
                                    </span>
                                </div>
                            </div>

                            <div className="result-text">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                                        {analysisResult.coverage.percentage}% Coverage
                                    </div>
                                    <div>
                                        <strong>{analysisResult.coverage.covered}</strong> / {analysisResult.coverage.total} Modules Covered
                                    </div>
                                </div>

                                <div style={{ width: '100%', background: 'var(--bg-primary)', height: '12px', borderRadius: '6px', overflow: 'hidden', marginBottom: '20px' }}>
                                    <div style={{
                                        width: `${analysisResult.coverage.percentage}%`,
                                        background: analysisResult.coverage.percentage >= 85 ? 'var(--success-text)' : 'var(--error-text)',
                                        height: '100%'
                                    }}></div>
                                </div>
                            </div>

                            <div className="classification-details">
                                <div className="classification-item">
                                    <label>Covered Modules</label>
                                    <div className="classification-value">
                                        {analysisResult.covered_modules.length > 0 ? (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                {analysisResult.covered_modules.map((m, i) => {
                                                    // Handle both new 'confidence' and old 'score' fields
                                                    const scoreVal = m.confidence !== undefined ? m.confidence : m.score;
                                                    const scorePct = scoreVal !== undefined ? (scoreVal * 100).toFixed(0) : '?';

                                                    return (
                                                        <span key={i} className="badge" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--success-text)' }}>
                                                            {m.name} ({scorePct}%)
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <span>None</span>
                                        )}
                                    </div>
                                </div>

                                <div className="classification-item">
                                    <label>Missing Modules</label>
                                    <div className="classification-value">
                                        {analysisResult.missing_modules.length > 0 ? (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                {analysisResult.missing_modules.map((m, i) => (
                                                    <span key={i} className="badge" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--error-text)' }}>
                                                        {m.name}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span>None - All modules covered!</span>
                                        )}
                                    </div>
                                </div>


                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default CompletenessChecker;
