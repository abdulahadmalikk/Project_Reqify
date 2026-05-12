import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import axios from 'axios';
import './Classifier.css';
import './Prioritizer.css';

// ─── helpers ───────────────────────────────────────────────
const CATEGORIES = ['Must Have', 'Should Have', 'Could Have', "Won't Have"];

const CATEGORY_META = {
    'Must Have': { cls: 'p-must', emoji: '🔴' },
    'Should Have': { cls: 'p-should', emoji: '🟡' },
    'Could Have': { cls: 'p-could', emoji: '🔵' },
    "Won't Have": { cls: 'p-wont', emoji: '⚫' },
    'Unclassified': { cls: 'p-wont', emoji: '⚪' },
};

const scoreCls = (rating) => ({
    'Excellent': 'p-score-excellent',
    'Good': 'p-score-good',
    'Fair': 'p-score-fair',
    'Poor': 'p-score-poor',
}[rating] || 'p-score-fair');

// ─── component ─────────────────────────────────────────────
export default function Prioritizer({ userEmail, onLogout }) {
    const { isDark, toggleTheme } = useTheme();
    const navigate = useNavigate();

    const [requirements, setRequirements] = useState([]);
    const [result, setResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [collapsed, setCollapsed] = useState({});
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    // ── load state from localStorage ──
    useEffect(() => {
        const classRaw = localStorage.getItem('reqify_classification_results');
        if (classRaw) {
            try {
                const parsed = JSON.parse(classRaw);
                const texts = Array.isArray(parsed)
                    ? parsed.map(r => r.requirement_text || r.original_requirement || r.text).filter(Boolean)
                    : [];
                setRequirements(texts);
            } catch (_) { }
        }

        const saved = localStorage.getItem('reqify_prioritizer_results');
        if (saved) {
            try { setResult(JSON.parse(saved)); } catch (_) { }
        }
    }, []);

    // ── analyze ──
    const analyze = async () => {
        if (!requirements.length) {
            alert('No requirements found. Run the Classifier first.');
            return;
        }
        setIsLoading(true);
        try {
            const ambRaw = JSON.parse(localStorage.getItem('reqify_ambiguity_results') || '[]');
            const confRaw = JSON.parse(localStorage.getItem('reqify_conflict_results') || '{"detections":[]}');

            const payload = {
                requirements,
                ambiguity_data: {
                    results: ambRaw.map(r => ({
                        requirement: r.text || r.original_requirement || '',
                        ambiguity_score: r.analysis?.ambiguity_score || 0,
                    })),
                },
                conflict_data: {
                    results: [{ detections: confRaw.detections || [] }],
                },
                timestamp: new Date().toISOString(),
                uploader: userEmail,
            };

            const { data } = await axios.post('http://localhost:8000/analyze/prioritize', payload);
            setResult(data);
            localStorage.setItem('reqify_prioritizer_results', JSON.stringify(data));
        } catch (err) {
            console.error(err);
            alert('Prioritization failed. Is the API running on port 8000?');
        } finally {
            setIsLoading(false);
        }
    };

    // ── clear ──
    const clear = () => {
        localStorage.removeItem('reqify_prioritizer_results');
        setResult(null);
        setShowClearConfirm(false);
    };

    // ── group results ──
    const grouped = result?.results
        ? CATEGORIES.concat(['Unclassified']).reduce((acc, cat) => {
            const items = result.results.filter(r => r.moscow_category === cat);
            if (items.length) acc[cat] = items;
            return acc;
        }, {})
        : {};

    // ── summary stats ──
    const statsCategories = result?.results
        ? CATEGORIES.reduce((acc, cat) => {
            acc[cat] = result.results.filter(r => r.moscow_category === cat).length;
            return acc;
        }, {})
        : {};

    const toggleCollapse = (cat) =>
        setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }));

    // ───────────────────────────────────────────────────────
    return (
        <div className={`classifier-container ${isDark ? 'dark' : 'light'}`}>

            {/* ── Navbar ── */}
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
                        <button className="nav-link active">Prioritization</button>
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

            {/* ── Main ── */}
            <main className="classifier-content">
                {/* Header row */}
                <div className="content-header">
                    <div>
                        <h2>AI Prioritization</h2>
                        <p className="subtitle">MoSCoW ranking refined by ambiguity &amp; conflict scores</p>
                    </div>

                    {result ? (
                        <button className="clear-btn" onClick={() => setShowClearConfirm(true)}>
                            Clear Results
                        </button>
                    ) : (
                        <button
                            className="analyze-btn p-analyze-btn"
                            onClick={analyze}
                            disabled={isLoading || !requirements.length}
                        >
                            {isLoading
                                ? <><span className="spinner-small" /> Prioritizing…</>
                                : <><span>⚡</span> Prioritize {requirements.length} Req{requirements.length !== 1 ? 's' : ''}</>
                            }
                        </button>
                    )}
                </div>

                {/* ── No result yet ── */}
                {!result && !isLoading && (
                    <div className="p-ready">
                        <h3>Ready to prioritize {requirements.length} requirement{requirements.length !== 1 ? 's' : ''}</h3>
                        <p>
                            Ambiguity &amp; conflict data will be used automatically if you have already run those analyses.
                            Click the button above to start.
                        </p>
                    </div>
                )}

                {/* ── Results ── */}
                {result && (
                    <>
                        {/* Summary cards */}
                        <div className="p-summary">
                            <div className="p-summary-card">
                                <span className="ps-label">Total</span>
                                <span className="ps-value">{result.total_prioritized}</span>
                            </div>
                            {CATEGORIES.map(cat => (
                                <div key={cat} className="p-summary-card" style={{
                                    borderTop: `3px solid ${cat === 'Must Have' ? '#ef4444' :
                                        cat === 'Should Have' ? '#f59e0b' :
                                            cat === 'Could Have' ? '#3b82f6' : '#6b7280'
                                        }`
                                }}>
                                    <span className="ps-label">{cat}</span>
                                    <span className="ps-value">{statsCategories[cat] || 0}</span>
                                </div>
                            ))}
                        </div>

                        {/* Category sections */}
                        {Object.entries(grouped).map(([cat, items]) => {
                            const meta = CATEGORY_META[cat] || CATEGORY_META['Unclassified'];
                            const open = !collapsed[cat];
                            const avgScore = (items.reduce((a, r) => a + r.final_score, 0) / items.length).toFixed(1);

                            return (
                                <div key={cat} className={`p-section ${meta.cls}`}>
                                    {/* Section header */}
                                    <div className="p-section-head" onClick={() => toggleCollapse(cat)}>
                                        <div className="p-section-title">
                                            <span className="p-tier-dot" />
                                            <span className="p-tier-label">{meta.emoji} {cat}</span>
                                            <span className="p-tier-count">{items.length} req{items.length !== 1 ? 's' : ''}</span>
                                            <span className="p-tier-count" style={{ marginLeft: 2 }}>avg {avgScore}/100</span>
                                        </div>
                                        <span className={`p-collapse-icon ${open ? 'open' : ''}`}>▼</span>
                                    </div>

                                    {/* Rows */}
                                    {open && items.map((req, i) => (
                                        <div key={i} className="p-row">
                                            {/* Left */}
                                            <div className="p-row-left">
                                                <span className="p-row-id">
                                                    #{req.final_rank} &nbsp;·&nbsp; {req.req_id} &nbsp;·&nbsp; {req.category_rank} in category
                                                </span>
                                                <span className="p-row-text">{req.requirement}</span>

                                                {/* Issue tags — only shown when real issues exist */}
                                                {(req.has_ambiguity || req.has_conflict) && (
                                                    <div className="p-row-tags">
                                                        {req.has_ambiguity && (
                                                            <span className="p-tag p-tag-ambiguity">⚠ Ambiguous</span>
                                                        )}
                                                        {req.has_conflict && (
                                                            <span className="p-tag p-tag-conflict">✗ Conflict</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Right — score pill */}
                                            <div className={`p-score-pill ${scoreCls(req.quality_rating)}`}>
                                                <span className="p-score-num">{req.final_score.toFixed(0)}</span>
                                                <span className="p-score-label">{req.quality_rating}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </>
                )}
            </main>

            {/* ── Clear confirm modal ── */}
            {showClearConfirm && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Clear Results?</h3>
                        <p>Prioritization results will be removed. You can always re-run the analysis.</p>
                        <div className="modal-actions">
                            <button onClick={() => setShowClearConfirm(false)} className="cancel-btn">Cancel</button>
                            <button onClick={clear} className="confirm-btn">Clear</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
