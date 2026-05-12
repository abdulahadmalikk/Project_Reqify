import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import axios from 'axios';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import './Classifier.css';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend
);

const modalStyles = `
/* Confirmation Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
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
  border-radius: 16px;
  padding: 32px;
  max-width: 440px;
  width: 90%;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  animation: slideUp 0.3s ease;
  border: 1px solid var(--border-color);
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
  gap: 16px;
  margin-bottom: 20px;
}

.modal-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.modal-icon svg {
  width: 28px;
  height: 28px;
  stroke: #dc2626;
  stroke-width: 2.5;
}

.modal-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.02em;
}

.modal-message {
  color: var(--text-secondary);
  font-size: 15px;
  line-height: 1.7;
  margin-bottom: 28px;
  padding-left: 4px;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.modal-btn {
  padding: 12px 24px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  letter-spacing: 0.01em;
}

.modal-btn-cancel {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1.5px solid var(--border-color);
}

.modal-btn-cancel:hover {
  background: var(--bg-tertiary);
  transform: translateY(-1px);
}

.modal-btn-confirm {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  color: white;
  border: 1.5px solid #dc2626;
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.25);
}

.modal-btn-confirm:hover {
  background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%);
  border-color: #b91c1c;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(220, 38, 38, 0.35);
}
`;

function NFRClassifier({ userEmail, onLogout }) {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const [nfrRequirements, setNfrRequirements] = useState([]);
  const [subcategorizedResults, setSubcategorizedResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('select');
  const [selectedNFRs, setSelectedNFRs] = useState([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const resultsPerPage = 5;

  useEffect(() => {
    const savedClassifications = localStorage.getItem('reqify_classification_results');
    if (savedClassifications) {
      try {
        const parsed = JSON.parse(savedClassifications);
        const nfrs = parsed.filter(r => r.fr_nfr_class === 'NFR');
        setNfrRequirements(nfrs);
      } catch (error) {
        console.error('Error loading NFR requirements:', error);
      }
    }
  }, []);

  useEffect(() => {
    const savedSubcategorized = localStorage.getItem('reqify_nfr_subcategorized');
    if (savedSubcategorized) {
      try {
        const parsed = JSON.parse(savedSubcategorized);
        setSubcategorizedResults(parsed);
      } catch (error) {
        console.error('Error loading subcategorized results:', error);
      }
    }
  }, []);

  useEffect(() => {
    if (subcategorizedResults.length > 0) {
      localStorage.setItem('reqify_nfr_subcategorized', JSON.stringify(subcategorizedResults));
    }
  }, [subcategorizedResults]);

  const toggleNFRSelection = (reqId) => {
    setSelectedNFRs(prev => {
      if (prev.includes(reqId)) {
        return prev.filter(id => id !== reqId);
      } else {
        return [...prev, reqId];
      }
    });
  };

  const selectAllNFRs = () => {
    if (selectedNFRs.length === nfrRequirements.length) {
      setSelectedNFRs([]);
    } else {
      setSelectedNFRs(nfrRequirements.map(req => req.requirement_id));
    }
  };

  const subcategorizeNFRs = async () => {
    const nfrsToSubcategorize = nfrRequirements.filter(
      req => selectedNFRs.includes(req.requirement_id)
    );

    if (nfrsToSubcategorize.length === 0) {
      alert('Please select at least one NFR to subcategorize');
      return;
    }

    setIsLoading(true);

    const batchPayload = {
      requirements: nfrsToSubcategorize.map(req => ({
        text: req.requirement_text,
        id: req.requirement_id,
        filename: req.filename || 'Unknown',
        timestamp: req.timestamp || new Date().toISOString(),
        uploader: req.uploader || userEmail
      }))
    };

    try {
      const response = await axios.post(
        'http://localhost:8000/subcategorize/batch-nfr',
        batchPayload
      );

      const results = response.data.results;

      setSubcategorizedResults(results);
      setActiveTab('results');
      setCurrentPage(1);

      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);

      const savedClassifications = localStorage.getItem('reqify_classification_results');
      if (savedClassifications) {
        const allClassifications = JSON.parse(savedClassifications);

        const updated = allClassifications.map(r => {
          const subcategorized = results.find(s => s.requirement_id === r.requirement_id);
          if (subcategorized) {
            return subcategorized;
          }
          return r;
        });
        localStorage.setItem('reqify_classification_results', JSON.stringify(updated));
      }
    } catch (error) {
      console.error('Error subcategorizing NFRs:', error);
      alert('Error subcategorizing NFRs. Please check if the API is running on port 8000.');
    } finally {
      setIsLoading(false);
    }
  };

  const clearSubcategorizedResults = () => {
    setShowClearConfirm(true);
  };

  const confirmClearResults = () => {
    localStorage.removeItem('reqify_nfr_subcategorized');
    setSubcategorizedResults([]);
    setSelectedNFRs([]);
    setActiveTab('select');
    setShowClearConfirm(false);
  };

  const cancelClearResults = () => {
    setShowClearConfirm(false);
  };

  const exportToCSV = () => {
    if (subcategorizedResults.length === 0) return;

    const headers = [
      'Requirement ID',
      'Requirement Text',
      'FR/NFR Classification',
      'FR/NFR Confidence',
      'NFR Type',
      'NFR Type Confidence',
      'Filename',
      'Timestamp',
      'Uploader'
    ];

    const rows = subcategorizedResults.map(r => [
      r.requirement_id,
      r.requirement_text,
      r.fr_nfr_class,
      r.fr_nfr_confidence,
      r.nfr_type,
      r.nfr_type_confidence,
      r.filename,
      r.timestamp,
      r.uploader
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reqify_nfr_subcategorized_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const exportToJSON = () => {
    if (subcategorizedResults.length === 0) return;

    const jsonContent = JSON.stringify(subcategorizedResults, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reqify_nfr_subcategorized_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const indexOfLastResult = currentPage * resultsPerPage;
  const indexOfFirstResult = indexOfLastResult - resultsPerPage;
  const currentResults = subcategorizedResults.slice(indexOfFirstResult, indexOfLastResult);
  const totalPages = Math.ceil(subcategorizedResults.length / resultsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const getNFRTypeStats = () => {
    const typeCounts = {};
    subcategorizedResults.forEach(r => {
      if (r.nfr_type) {
        typeCounts[r.nfr_type] = (typeCounts[r.nfr_type] || 0) + 1;
      }
    });
    return typeCounts;
  };

  const getChartData = () => {
    const stats = getNFRTypeStats();
    const labels = Object.keys(stats);
    const data = Object.values(stats);

    const colors = [
      'rgba(99, 102, 241, 0.85)',
      'rgba(236, 72, 153, 0.85)',
      'rgba(34, 197, 94, 0.85)',
      'rgba(251, 146, 60, 0.85)',
      'rgba(14, 165, 233, 0.85)',
      'rgba(168, 85, 247, 0.85)',
      'rgba(234, 179, 8, 0.85)',
      'rgba(239, 68, 68, 0.85)',
      'rgba(6, 182, 212, 0.85)',
      'rgba(132, 204, 22, 0.85)',
    ];

    const borderColors = colors.map(color => color.replace('0.85', '1'));

    return {
      labels: labels,
      datasets: [
        {
          label: 'NFR Type Count',
          data: data,
          backgroundColor: colors.slice(0, labels.length),
          borderColor: borderColors.slice(0, labels.length),
          borderWidth: 2,
          hoverOffset: 8,
        }
      ]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          color: isDark ? '#e5e7eb' : '#374151',
          font: {
            family: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
            size: 14,
            weight: '500'
          },
          padding: 20,
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 12,
          boxHeight: 12
        }
      },
      title: {
        display: true,
        text: 'NFR Type Distribution',
        color: isDark ? '#f9fafb' : '#111827',
        font: {
          size: 20,
          weight: '700',
          family: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
        },
        padding: {
          bottom: 30,
          top: 20
        }
      },
      tooltip: {
        backgroundColor: isDark ? 'rgba(17, 24, 39, 0.97)' : 'rgba(255, 255, 255, 0.97)',
        titleColor: isDark ? '#f9fafb' : '#111827',
        bodyColor: isDark ? '#e5e7eb' : '#374151',
        borderColor: isDark ? 'rgba(75, 85, 99, 0.5)' : 'rgba(209, 213, 219, 0.8)',
        borderWidth: 1.5,
        padding: 16,
        displayColors: true,
        titleFont: {
          size: 15,
          weight: '700',
          family: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
        },
        bodyFont: {
          size: 14,
          weight: '500',
          family: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
        },
        cornerRadius: 12,
        boxPadding: 6,
        callbacks: {
          label: function (context) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return ` ${label}: ${value} (${percentage}%)`;
          }
        }
      }
    },
    layout: {
      padding: {
        top: 20,
        bottom: 20,
        left: 20,
        right: 20
      }
    },
    animation: {
      animateRotate: true,
      animateScale: true,
      duration: 1000,
      easing: 'easeInOutQuart'
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
              <h3 className="modal-title">Clear All Results?</h3>
            </div>
            <p className="modal-message">
              Are you sure you want to clear all subcategorization results? This action cannot be undone.
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
                  <button className="nav-link active">NFR Analysis</button>
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
            Select NFRs
            <span className="tab-badge">{nfrRequirements.length}</span>
          </button>
          <button
            className={activeTab === 'results' ? 'tab active' : 'tab'}
            onClick={() => {
              setActiveTab('results');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            disabled={subcategorizedResults.length === 0}
          >
            <span className="tab-icon">📊</span>
            Subcategorization Results
            <span className="tab-badge">{subcategorizedResults.length}</span>
          </button>
        </div>

        {activeTab === 'select' && (
          <div className="select-section slide-in">
            <div className="section-header">
              <h2>Select NFRs to Subcategorize</h2>
              <p>Choose NFR requirements for detailed subcategorization.</p>
            </div>

            {nfrRequirements.length === 0 ? (
              <div className="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
                <h3>No NFRs Found</h3>
                <p>Please use the FR/NFR Classifier to classify requirements first.</p>
                <button onClick={() => navigate('/classifier')} className="btn-primary">
                  <span>←</span>
                  Go to FR/NFR Classifier
                </button>
              </div>
            ) : (
              <>
                {selectedNFRs.length > 0 && (
                  <div className="classify-button-container">
                    <button
                      onClick={subcategorizeNFRs}
                      className="btn-classify"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <span className="spinner"></span>
                          <span>Subcategorizing...</span>
                        </>
                      ) : (
                        <>
                          <span>Subcategorize {selectedNFRs.length} NFR{selectedNFRs.length !== 1 ? 's' : ''}</span>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="9 18 15 12 9 6"></polyline>
                          </svg>
                        </>
                      )}
                    </button>
                  </div>
                )}

                <div className="selection-controls">
                  <button onClick={selectAllNFRs} className="btn-select-all">
                    {selectedNFRs.length === nfrRequirements.length ? (
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
                    <strong>{selectedNFRs.length}</strong> of <strong>{nfrRequirements.length}</strong> selected
                  </span>
                </div>

                <div className="requirements-list">
                  {nfrRequirements.map((req, index) => (
                    <div
                      key={index}
                      className={`requirement-card ${selectedNFRs.includes(req.requirement_id) ? 'selected' : ''}`}
                      onClick={() => toggleNFRSelection(req.requirement_id)}
                    >
                      <div className="card-header">
                        <input
                          type="checkbox"
                          checked={selectedNFRs.includes(req.requirement_id)}
                          onChange={() => toggleNFRSelection(req.requirement_id)}
                          onClick={(e) => e.stopPropagation()}
                          className="custom-checkbox"
                        />
                        <h3>{req.requirement_id}</h3>
                        <span className="badge badge-nfr">NFR</span>
                      </div>
                      <p className="requirement-text">{req.requirement_text}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'results' && subcategorizedResults.length > 0 && (
          <div className="results-section slide-in">
            <div className="results-header">
              <h2>NFR Subcategorization Results</h2>
              <div className="export-buttons">
                <button onClick={clearSubcategorizedResults} className="btn-clear">
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

            <div className="stats-chart">
              <div className="chart-wrapper">
                <Pie data={getChartData()} options={chartOptions} />
              </div>
            </div>

            {currentResults.map((result, index) => (
              <div key={index} className="result-card">
                <div className="result-header">
                  <h3>{result.requirement_id}</h3>
                  <div className="classification-badges">
                    <span className="badge badge-nfr">NFR</span>
                    <span className="badge badge-nfr-type">{result.nfr_type}</span>
                  </div>
                </div>

                <div className="result-text">
                  <strong>Requirement:</strong> {result.requirement_text}
                </div>

                <div className="classification-details">
                  <div className="classification-item">
                    <label>NFR Type</label>
                    <div className="classification-value">
                      <span className="class-name">{result.nfr_type}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}

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

export default NFRClassifier;