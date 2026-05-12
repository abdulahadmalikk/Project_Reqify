import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import axios from 'axios';
import './Dashboard.css';
import './Classifier.css';

const uploadMessageStyles = `
:root {
  --color-success-light: #d4edda;
  --color-success-dark: #155724;
  --color-success: #c3e6cb;
  
  --color-danger-light: #f8d7da;
  --color-danger-dark: #721c24;
  --color-danger: #f5c6cb;

  --color-warning-light: #fff3cd;
  --color-warning-dark: #856404;
  --color-warning: #ffeeba;
}

.theme-dark {
  --color-success-light: #1c2b22;
  --color-success-dark: #a3e9b6;
  --color-success: #2a4a34;
  
  --color-danger-light: #2d1b1f;
  --color-danger-dark: #f5b9bd;
  --color-danger: #5a2a2f;

  --color-warning-light: #2e2817;
  --color-warning-dark: #fde6a8;
  --color-warning: #5c491a;
}

.upload-message {
  width: 100%;
  padding: 12px 16px;
  margin-top: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  font-size: 0.9rem;
  font-weight: 500;
  box-sizing: border-box;
}

.upload-message .file-icon {
  margin-right: 10px;
  font-size: 1.2rem;
  line-height: 1;
}

.upload-message.success {
  background-color: var(--color-success-light);
  color: var(--color-success-dark);
  border: 1px solid var(--color-success);
}

.upload-message.error {
  background-color: var(--color-danger-light);
  color: var(--color-danger-dark);
  border: 1px solid var(--color-danger);
}

.upload-message.notification {
  background-color: var(--color-warning-light);
  color: var(--color-warning-dark);
  border: 1px solid var(--color-warning);
}

/* Non-Atomic Badge Styles */
.non-atomic-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background-color: var(--color-warning-light);
  color: var(--color-warning-dark);
  border: 1px solid var(--color-warning);
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-left: 12px;
}

.non-atomic-badge svg {
  width: 14px;
  height: 14px;
}

.atomicity-details {
  margin-top: 12px;
  margin-bottom: 16px;
  padding: 12px;
  background-color: var(--color-warning-light);
  border: 1px solid var(--color-warning);
  border-radius: 8px;
}

.atomicity-details-title {
  font-weight: 600;
  color: var(--color-warning-dark);
  margin-bottom: 8px;
  font-size: 0.9rem;
}

.atomicity-violations {
  list-style: none;
  padding: 0;
  margin: 0;
}

.atomicity-violations li {
  padding: 6px 0;
  color: var(--color-warning-dark);
  font-size: 0.85rem;
  display: flex;
  align-items: start;
  gap: 8px;
}

.atomicity-violations li:before {
  content: "⚠";
  flex-shrink: 0;
}

.result-card.non-atomic {
  border-left: 4px solid var(--color-warning);
}

/* Confirmation Modal Styles */
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

function Dashboard({ userEmail, onLogout }) {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const [requirements, setRequirements] = useState([{ id: '', text: '' }]);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('input');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [fileNotification, setFileNotification] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const resultsPerPage = 5;
  const MAX_REQUIREMENTS = 500;

  useEffect(() => {
    const savedResults = localStorage.getItem('reqify_saved_results');
    if (savedResults) {
      try {
        const parsed = JSON.parse(savedResults);
        const limitedResults = parsed.slice(0, MAX_REQUIREMENTS);
        
        const resultsWithMetadata = limitedResults.map(result => {
          if (!result.filename || !result.timestamp || !result.uploader) {
            return {
              ...result,
              filename: result.filename || 'Unknown',
              timestamp: result.timestamp || new Date().toISOString(),
              uploader: result.uploader || userEmail
            };
          }
          return result;
        });
        
        setResults(resultsWithMetadata);
        
        if (parsed.length > MAX_REQUIREMENTS) {
          alert(`Note: Only the first ${MAX_REQUIREMENTS} requirements were loaded. Total requirements in storage: ${parsed.length}`);
        }
      } catch (error) {
        console.error('Error loading saved results:', error);
      }
    }
  }, [userEmail]);

  useEffect(() => {
    if (results.length > 0) {
      localStorage.setItem('reqify_saved_results', JSON.stringify(results));
    }
  }, [results]);

  const addRequirement = () => {
    if (requirements.length >= MAX_REQUIREMENTS) {
      alert(`Maximum limit of ${MAX_REQUIREMENTS} requirements reached.`);
      return;
    }
    setRequirements([...requirements, { id: '', text: '' }]);
  };

  const removeRequirement = (index) => {
    if (requirements.length > 1) {
      setRequirements(requirements.filter((_, i) => i !== index));
    }
  };

  const updateRequirement = (index, field, value) => {
    const updated = [...requirements];
    updated[index][field] = value;
    setRequirements(updated);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    setFileError(null);
    setFileNotification(null);

    if (!file) {
      setUploadedFile(null);
      return;
    }

    const validTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/pdf',
      'text/csv',
      'text/plain'
    ];

    if (!validTypes.includes(file.type) && !file.name.match(/\.(docx?|pdf|csv|txt)$/i)) {
      setFileError('Invalid file type. Please upload a CSV or TXT file.');
      setUploadedFile(null);
      event.target.value = null;
      return;
    }

    setUploadedFile(file);
    setIsLoading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target.result;
        
        if (file.type === 'text/plain' || file.type === 'text/csv') {
          const lines = content.split('\n').filter(line => line.trim());
          
          if (lines.length > MAX_REQUIREMENTS) {
            setFileNotification(`Warning: File has ${lines.length} requirements. Only the first ${MAX_REQUIREMENTS} will be imported.`);
          }
          
          const limitedLines = lines.slice(0, MAX_REQUIREMENTS);
          const extractedReqs = limitedLines.map((line, index) => ({
            id: `REQ-${index + 1}`,
            text: line.trim()
          }));
          setRequirements(extractedReqs.length > 0 ? extractedReqs : [{ id: '', text: '' }]);
        } else {
          setFileNotification(`File uploaded: ${file.name}. Advanced extraction for this file type is coming soon!`);
        }
        
        setIsLoading(false);
      };

      if (file.type === 'text/plain' || file.type === 'text/csv') {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    } catch (error) {
      console.error('Error processing file:', error);
      setFileError('Error processing file. Please try again.');
      setUploadedFile(null);
      setIsLoading(false);
    }
  };

  const analyzeRequirements = async () => {
    const validReqs = requirements.filter(r => r.text.trim());
    
    if (validReqs.length === 0) {
      alert('Please enter at least one requirement');
      return;
    }

    if (validReqs.length > MAX_REQUIREMENTS) {
      alert(`You can only analyze up to ${MAX_REQUIREMENTS} requirements at once. Please remove some requirements.`);
      return;
    }

    setIsLoading(true);
    setResults([]);

    const timestamp = new Date().toISOString();
    const filename = uploadedFile ? uploadedFile.name : 'Manual Entry';

    const batchPayload = {
      requirements: validReqs.map((req, index) => ({
        text: req.text,
        id: req.id || `REQ-${index + 1}`,
        filename: filename,
        timestamp: timestamp,
        uploader: userEmail
      }))
    };

    try {
      const response = await axios.post('http://localhost:8000/analyze/batch', batchPayload);
      setResults(response.data.results);
      setActiveTab('results');
      setCurrentPage(1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Error analyzing requirements:', error);
      alert('Error analyzing requirements. Please check if the API is running on port 8000.');
    } finally {
      setIsLoading(false);
    }
  };

  const clearSavedResults = () => {
    setShowClearConfirm(true);
  };

  const confirmClearResults = () => {
    localStorage.removeItem('reqify_saved_results');
    setResults([]);
    setActiveTab('input');
    setShowClearConfirm(false);
  };

  const cancelClearResults = () => {
    setShowClearConfirm(false);
  };

  const exportToCSV = () => {
    if (results.length === 0) return;
    const headers = ['Requirement ID', 'Requirement Text', 'Actor', 'Action', 'Target', 'Localization', 'Constraint'];
    const rows = results.map(r => [
      r.requirement_id,
      r.original_requirement,
      r.actor,
      r.action,
      r.target,
      r.localization,
      r.constraint
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reqify_analysis_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const exportToJSON = () => {
    if (results.length === 0) return;
    const exportData = results.map(result => ({
      requirement_id: result.requirement_id,
      original_requirement: result.original_requirement,
      actor: result.actor,
      action: result.action,
      target: result.target,
      localization: result.localization,
      constraint: result.constraint
    }));
    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reqify_analysis_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  // Helper function to safely get atomicity violations as array
  const getViolationsArray = (violations) => {
    if (!violations) return [];
    if (Array.isArray(violations)) return violations;
    if (typeof violations === 'string') return [violations];
    return [String(violations)];
  };

  const hasValidRequirements = requirements.some(r => r.text.trim());
  const indexOfLastResult = currentPage * resultsPerPage;
  const indexOfFirstResult = indexOfLastResult - resultsPerPage;
  const currentResults = results.slice(indexOfFirstResult, indexOfLastResult);
  const totalPages = Math.ceil(results.length / resultsPerPage);
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="dashboard">
      <style>{uploadMessageStyles}</style>

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
              <h3 className="modal-title">Clear All Results?</h3>
            </div>
            <p className="modal-message">
              Are you sure you want to clear all saved results? This action cannot be undone.
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
                  <button className="nav-link active">Dashboard</button>
                  <button onClick={() => navigate('/classifier')} className="nav-link">Classifier</button>
                  <button onClick={() => navigate('/nfr-classifier')} className="nav-link">NFR Analysis</button>
                  <button onClick={() => navigate('/ambiguity-analysis')} className="nav-link">Ambiguity</button>
                  <button onClick={() => navigate('/completeness-checker')} className="nav-link">Completeness</button>
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

      <div className="dashboard-content fade-in">
        <div className="tabs">
          <button 
            className={activeTab === 'input' ? 'tab active' : 'tab'}
            onClick={() => {
              setActiveTab('input');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <span className="tab-icon">📝</span>
            Input Requirements
          </button>
          <button 
            className={activeTab === 'results' ? 'tab active' : 'tab'}
            onClick={() => {
              setActiveTab('results');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            disabled={results.length === 0}
          >
            <span className="tab-icon">📊</span>
            Analysis Results
            <span className="tab-badge">{results.length}</span>
          </button>
        </div>

        {activeTab === 'input' && (
          <div className="input-section slide-in">
            <div className="section-header">
              <h2>Import or Enter Requirements</h2>
              <p>Upload a file or manually enter requirements for structure analysis</p>
            </div>

            {hasValidRequirements && (
              <div className="analyze-button-container">
                <button 
                  onClick={analyzeRequirements} 
                  className="btn-analyze"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner"></span>
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <span>Analyze Requirements</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </>
                  )}
                </button>
              </div>
            )}

            <div className="upload-section">
              <div className="upload-box">
                <input
                  type="file"
                  id="file-upload"
                  accept=".doc,.docx,.pdf,.csv,.txt"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <label htmlFor="file-upload" className="upload-label">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  <span className="upload-title">Click to upload requirements file</span>
                  <span className="upload-hint">Supports:CSV, TXT (Max {MAX_REQUIREMENTS} requirements)</span>
                </label>
                
                {fileError && (
                  <div className="upload-message error">
                    <span className="file-icon">✗</span>
                    <span>{fileError}</span>
                  </div>
                )}
                
                {fileNotification && !fileError && (
                  <div className="upload-message notification">
                    <span className="file-icon">ℹ️</span>
                    <span>{fileNotification}</span>
                  </div>
                )}

                {uploadedFile && !fileError && !fileNotification && (
                  <div className="upload-message success">
                    <span className="file-icon">✓</span>
                    <span>Uploaded: {uploadedFile.name}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="divider">
              <span>OR ENTER MANUALLY</span>
            </div>

            {requirements.map((req, index) => (
              <div key={index} className="requirement-input">
                <div className="input-row">
                  <input
                    type="text"
                    placeholder={`Requirement ID (optional, e.g., REQ-${index + 1})`}
                    value={req.id}
                    onChange={(e) => updateRequirement(index, 'id', e.target.value)}
                    className="req-id-input"
                  />
                  {requirements.length > 1 && (
                    <button 
                      onClick={() => removeRequirement(index)}
                      className="remove-btn"
                      title="Remove requirement"
                    >
                      ×
                    </button>
                  )}
                </div>
                <textarea
                  placeholder="Enter requirement text..."
                  value={req.text}
                  onChange={(e) => updateRequirement(index, 'text', e.target.value)}
                  rows="3"
                  className="req-text-input"
                />
              </div>
            ))}

            <div className="action-buttons">
              <button 
                onClick={addRequirement} 
                className="btn-secondary"
                disabled={requirements.length >= MAX_REQUIREMENTS}
              >
                <span>+</span>
                Add Another Requirement
              </button>
            </div>
          </div>
        )}

        {activeTab === 'results' && results.length > 0 && (
          <div className="results-section slide-in">
            <div className="results-header">
              <h2>Analysis Results</h2>
              <div className="export-buttons">
                <button onClick={clearSavedResults} className="btn-clear">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  Clear Results
                </button>
                <button onClick={exportToCSV} className="btn-export">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  Export CSV
                </button>
                <button onClick={exportToJSON} className="btn-export">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  Export JSON
                </button>
              </div>
            </div>

            <div className="info-banner">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              <span>
                Requirements extracted successfully! Click the <strong>"📊 Classify Requirements"</strong> button in the navbar to classify them.
              </span>
            </div>

            {currentResults.map((result, index) => {
              return (
                <div key={index} className="result-card">
                  <div className="result-header">
                    <h3>
                      {result.requirement_id}
                    </h3>
                  </div>

                  <div className="result-text">
                    <strong>Requirement:</strong> {result.original_requirement}
                  </div>

                  <div className="result-grid">
                    <div className="result-item">
                      <label>Actor</label>
                      <div className="value">{result.actor}</div>
                    </div>

                    <div className="result-item">
                      <label>Action</label>
                      <div className="value">{result.action}</div>
                    </div>

                    <div className="result-item">
                      <label>Target</label>
                      <div className="value">{result.target}</div>
                    </div>

                    <div className="result-item full-width">
                      <label>Localization</label>
                      <div className="value">{result.localization}</div>
                    </div>

                    <div className="result-item full-width">
                      <label>Constraint</label>
                      <div className="value">{result.constraint}</div>
                    </div>
                  </div>
                </div>
              );
            })}

            {totalPages > 1 && (
              <div className="pagination">
                <button 
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="page-btn"
                >
                  ← Previous
                </button>
                
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => paginate(i + 1)}
                    className={currentPage === i + 1 ? 'page-btn active' : 'page-btn'}
                  >
                    {i + 1}
                  </button>
                ))}

                <button 
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="page-btn"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;