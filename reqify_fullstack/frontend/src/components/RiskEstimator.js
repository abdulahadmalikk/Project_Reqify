import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import axios from 'axios';
import './RiskEstimator.css';
import './Classifier.css';

export default function RiskEstimator({ userEmail, onLogout }) {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();

  const [reqData, setReqData] = useState([]);
  const [stats, setStats] = useState({ total: 0, high: 0, med: 0, low: 0, topRiskId: '' });
  
  useEffect(() => {
    // 1. Gather all required outputs from Modules 1, 3, and 6
    const classRaw = localStorage.getItem('reqify_classification_results');
    const ambRaw = localStorage.getItem('reqify_ambiguity_results');
    const impRaw = localStorage.getItem('reqify_impact_results');

    let baseReqs = [];
    let ambScores = {};
    let impactGraph = { nodes: [], edges: [] };

    if (classRaw) {
      try {
        const parsed = JSON.parse(classRaw);
        baseReqs = Array.isArray(parsed) ? parsed : [];
      } catch (e) { console.error('Error parsing classification results:', e); }
    }

    if (ambRaw) {
      try {
        const parsed = JSON.parse(ambRaw);
        if (Array.isArray(parsed)) {
          parsed.forEach(r => {
             // Store the direct score (0-1) from module 3
             if (r.requirement_id && r.analysis && typeof r.analysis.ambiguity_score === 'number') {
                 ambScores[r.requirement_id] = r.analysis.ambiguity_score;
             }
          });
        }
      } catch (e) { console.error('Error parsing ambiguity results:', e); }
    }

    if (impRaw) {
      try {
        const parsed = JSON.parse(impRaw);
        if (parsed.nodes && parsed.edges) {
          impactGraph = parsed;
        }
      } catch (e) { console.error('Error parsing impact graph:', e); }
    }

    // 2. Precompute Graph Metrics (Signal 1 & Dimension 3)
    const inDeg = {};
    const outDeg = {};
    // Betweenness Centrality (approximation based on degrees for simplicity, or we can use generic node pass-throughs)
    const nodeScores = {};
    
    impactGraph.nodes.forEach(n => {
        inDeg[n.id] = 0;
        outDeg[n.id] = 0;
        nodeScores[n.id] = 0;
    });

    impactGraph.edges.forEach(e => {
        if (outDeg[e.from] !== undefined) outDeg[e.from]++;
        if (inDeg[e.to] !== undefined) inDeg[e.to]++;
        if (nodeScores[e.to] !== undefined && nodeScores[e.from] !== undefined) {
             // simple centrality boost for being a bridge
             nodeScores[e.from] += 0.5;
             nodeScores[e.to] += 0.5;
        }
    });

    // Find Max Dependency Count for Normalization
    let maxDependencies = 1;
    Object.keys(inDeg).forEach(id => {
       const totalDeps = inDeg[id] + outDeg[id];
       if (totalDeps > maxDependencies) maxDependencies = totalDeps;
    });

    // 3. Process Requirements into Risk Reports
    const processed = baseReqs.map((req, i) => {
        const id = req.requirement_id || `REQ-${i}`;
        const text = req.requirement_text || req.original_requirement || req.text || "";

        // ----- DIMENSION 1: AMBIGUITY RISK -----
        const ambScore = ambScores[id] !== undefined ? ambScores[id] : 0;

        // ----- DIMENSION 3: DEPENDENCY RISK -----
        // Use precomputed normalized Impact Score if available, else fallback
        let graphId = id;
        if (inDeg[`R${i+1}`] !== undefined || (impactGraph.rawScoreMap && impactGraph.rawScoreMap[`R${i+1}`] !== undefined)) {
            graphId = `R${i+1}`;
        } else if (inDeg[id.toUpperCase()] !== undefined || (impactGraph.rawScoreMap && impactGraph.rawScoreMap[id.toUpperCase()] !== undefined)) {
            graphId = id.toUpperCase();
        }

        const totalDeps = (inDeg[graphId] || 0) + (outDeg[graphId] || 0);
        let origScore = totalDeps;
        let depScore = totalDeps / maxDependencies;
        
        if (impactGraph.rawScoreMap && impactGraph.scoreMap && impactGraph.rawScoreMap[graphId] !== undefined) {
             origScore = +(impactGraph.rawScoreMap[graphId].toFixed(3));
             depScore = impactGraph.scoreMap[graphId];
        }

        // ----- DIMENSION 2: VOLATILITY RISK -----
        // Proxy 1: Centrality Score (normalized up to 1 approx)
        const centralityProxy = Math.min(((inDeg[graphId] || 0) * 0.4 + (nodeScores[graphId] || 0) * 0.6) / (maxDependencies || 1), 1.0);
        // Proxy 2: Ambiguity Proxy
        const ambiguityProxy = ambScore;
        // Proxy 3: Linguistic Markers
        const markers = ["tbd", "tbc", "might", "could", "pending", "approximately", "subject to change"];
        let markerCount = 0;
        markers.forEach(m => {
            const regex = new RegExp(`\\b${m}\\b`, 'gi');
            const matches = text.match(regex);
            if (matches) markerCount += matches.length;
        });
        const linguisticProxy = Math.min(markerCount / 3, 1.0); // 3+ markers is highly unstable
        
        // Average the 3 proxies for overall Volatility
        const volScore = (centralityProxy + ambiguityProxy + linguisticProxy) / 3;

        // ----- AGGREGATION: RISK INDEX -----
        const w1 = 0.40;
        const w2 = 0.35;
        const w3 = 0.25;
        const riskIndex = (w1 * ambScore) + (w2 * volScore) + (w3 * depScore);

        // Assign Categorical Level
        let riskLevel = "LOW";
        if (riskIndex >= 0.66) riskLevel = "HIGH";
        else if (riskIndex >= 0.36) riskLevel = "MEDIUM";

        return {
            id,
            text,
            origScore: origScore,
            ambScore,
            volScore,
            depScore,
            riskIndex,
            riskLevel
        };
    });

    // Sort by descending Risk Index
    processed.sort((a, b) => b.riskIndex - a.riskIndex);
    setReqData(processed);

    // Compute Summary Stats
    const summary = {
        total: processed.length,
        high: processed.filter(r => r.riskLevel === 'HIGH').length,
        med: processed.filter(r => r.riskLevel === 'MEDIUM').length,
        low: processed.filter(r => r.riskLevel === 'LOW').length,
        topRiskId: processed.length > 0 ? processed[0].id : '-'
    };
    setStats(summary);

    // Save to backend
    axios.post('http://localhost:8000/save-results', {
        module_name: 'risk_estimation',
        data: {
          results: processed,
          summary: summary
        }
    }).catch(err => console.error("Error saving risk results:", err));

  }, []);

  const downloadReport = () => {
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "Requirement ID,Text,Dependency Score,Ambiguity Score,Volatility Score,Risk Index,Risk Level\n";

      reqData.forEach(row => {
         const cleanText = row.text.replace(/"/g, '""').replace(/\n/g, ' ');
         const line = `"${row.id}","${cleanText}",${row.depScore.toFixed(3)},${row.ambScore.toFixed(3)},${row.volScore.toFixed(3)},${row.riskIndex.toFixed(3)},"${row.riskLevel}"`;
         csvContent += line + "\n";
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "Reqify_Risk_Report.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const getBadgeColor = (level) => {
      if (level === 'HIGH') return { req: 'var(--error-text)', bg: 'rgba(239, 68, 68, 0.15)' };
      if (level === 'MEDIUM') return { req: 'var(--warning-text)', bg: 'rgba(234, 179, 8, 0.15)' };
      return { req: 'var(--success-text)', bg: 'rgba(34, 197, 94, 0.15)' };
  };

  return (
    <div className="risk-estimator">
      <nav className="classifier-nav">
          <div className="nav-left">
              <div className="logo"><h1>REQIFY</h1></div>
              <div className="nav-links">
                  <button onClick={() => navigate('/dashboard')} className="nav-link">Dashboard</button>
                  <button onClick={() => navigate('/classifier')} className="nav-link">Classifier</button>
                  <button onClick={() => navigate('/nfr-classifier')} className="nav-link">NFR Analysis</button>
                  <button onClick={() => navigate('/ambiguity-analysis')} className="nav-link">Ambiguity</button>
                  <button onClick={() => navigate('/completeness-checker')} className="nav-link">Completeness</button>
                  <button onClick={() => navigate('/conflict-detector')} className="nav-link">Conflicts</button>
                  <button onClick={() => navigate('/prioritizer')} className="nav-link">Prioritization</button>
                  <button onClick={() => navigate('/impact-analyzer')} className="nav-link">Impact Analyzer</button>
                  <button className="nav-link active">Risk Estimator</button>
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

      <div className="risk-container fade-in">
        <div className="risk-header">
            <div>
                <h2>Requirement Risk Estimator</h2>
                <p>Estimates project risk using Ambiguity, Volatility, and structural Dependency markers.</p>
            </div>
            <button className="btn-export" onClick={downloadReport}>
               <svg style={{marginRight: '6px'}} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                 <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
               </svg>
               Export Report
            </button>
        </div>

        <div className="stats-row">
            <div className="stat-card">
               <span className="stat-title">Total Analyzed</span>
               <span className="stat-value">{stats.total}</span>
            </div>
            <div className="stat-card">
               <span className="stat-title">High Risk</span>
               <span className="stat-value" style={{color: 'var(--error-text)'}}>{stats.high}</span>
            </div>
            <div className="stat-card">
               <span className="stat-title">Medium Risk</span>
               <span className="stat-value" style={{color: 'var(--warning-text)'}}>{stats.med}</span>
            </div>
            <div className="stat-card">
               <span className="stat-title">Critical Target</span>
               <span className="stat-value" style={{color: 'var(--error-text)', fontSize: '1.4rem'}}>{stats.topRiskId}</span>
            </div>
        </div>

        {reqData.length > 0 ? (
            <div className="table-container">
            <table className="risk-table">
                <thead>
                    <tr>
                        <th style={{width: '90px'}}>Requirement ID</th>
                        <th style={{width: '35%'}}>Requirement</th>
                        <th>Dependency Score</th>
                        <th>Ambiguity Score</th>
                        <th>Volatility Score</th>
                        <th>Risk Index</th>
                        <th>Risk Level</th>
                    </tr>
                </thead>
                <tbody>
                    {reqData.map((row) => {
                        const colors = getBadgeColor(row.riskLevel);
                        return (
                            <tr key={row.id}>
                                <td style={{fontWeight: 600, color: 'var(--text-primary)'}}>{row.id}</td>
                                <td><div className="text-clamp">{row.text}</div></td>
                                <td>{(row.depScore).toFixed(3)}</td>
                                <td>{(row.ambScore).toFixed(3)}</td>
                                <td>{(row.volScore).toFixed(3)}</td>
                                <td style={{fontWeight: 700}}>{(row.riskIndex).toFixed(3)}</td>
                                <td>
                                    <span className="risk-badge" style={{color: colors.req, backgroundColor: colors.bg}}>
                                        {row.riskLevel}
                                    </span>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
            </div>
        ) : (
            <div className="empty-state">
                No requirement data found. Please run the Classifier, Ambiguity Analyzer, and Impact Analyzer modules first.
            </div>
        )}
      </div>
    </div>
  );
}
