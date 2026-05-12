import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from '../contexts/ThemeContext';
import axios from 'axios';
import './Classifier.css';
import cytoscape from 'cytoscape';

const _f = document.createElement("link");
_f.rel = "stylesheet";
_f.href = "https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap";
document.head.appendChild(_f);

// ── Palettes ──────────────────────────────────────────────────────────────────
const PALETTE = {
    dark: {
        bg: "var(--bg-secondary)", card: "var(--bg-primary)", panel: "var(--bg-tertiary)", inp: "var(--bg-secondary)",
        hover: "var(--border-color)", bdr: "var(--border-color)", txt: "var(--text-primary)", sub: "var(--text-secondary)", mut: "var(--text-tertiary)",
        acc: "var(--accent-primary)", accAlt: "var(--accent-secondary)", glow: "transparent",
        nBase: "var(--bg-primary)", nStroke: "var(--border-hover)", edgeC: "var(--border-color)",
        grid: "var(--bg-secondary)", shadow: "var(--shadow-md)",
        HIGH_c: "var(--error-text)", HIGH_bg: "var(--error-bg)", HIGH_b: "var(--error-text)",
        MED_c: "var(--warning-text)", MED_bg: "var(--warning-bg)", MED_b: "var(--warning-text)",
        LOW_c: "var(--success-text)", LOW_bg: "var(--success-bg)", LOW_b: "var(--success-text)",
        SEL_c: "var(--accent-primary)", SEL_bg: "var(--info-bg)", SEL_b: "var(--accent-primary)",
    },
    light: {
        bg: "var(--bg-secondary)", card: "var(--bg-primary)", panel: "var(--bg-tertiary)", inp: "var(--bg-secondary)",
        hover: "var(--border-color)", bdr: "var(--border-color)", txt: "var(--text-primary)", sub: "var(--text-secondary)", mut: "var(--text-tertiary)",
        acc: "var(--accent-primary)", accAlt: "var(--accent-secondary)", glow: "transparent",
        nBase: "var(--bg-primary)", nStroke: "var(--border-hover)", edgeC: "var(--border-color)",
        grid: "var(--bg-secondary)", shadow: "var(--shadow-md)",
        HIGH_c: "var(--error-text)", HIGH_bg: "var(--error-bg)", HIGH_b: "var(--error-text)",
        MED_c: "var(--warning-text)", MED_bg: "var(--warning-bg)", MED_b: "var(--warning-text)",
        LOW_c: "var(--success-text)", LOW_bg: "var(--success-bg)", LOW_b: "var(--success-text)",
        SEL_c: "var(--accent-primary)", SEL_bg: "var(--info-bg)", SEL_b: "var(--accent-primary)",
    }
};
function sevColors(P, sev) {
    if (sev === "HIGH") return { c: P.HIGH_c, bg: P.HIGH_bg, b: P.HIGH_b };
    if (sev === "MED") return { c: P.MED_c, bg: P.MED_bg, b: P.MED_b };
    return { c: P.LOW_c, bg: P.LOW_bg, b: P.LOW_b };
}

// ══════════════════════════════════════════════════════════════════════════════
// ADJACENCY MATRIX ENGINE  (all graph algorithms run through this)
// ══════════════════════════════════════════════════════════════════════════════
function buildAdjMatrix(nodes, edges) {
    const ids = nodes.map(n => n.id);
    const idx = {};                          // id → index
    ids.forEach((id, i) => { idx[id] = i; });
    const n = ids.length;
    // adj[i][j] = 1 means node i depends on node j (edge i→j)
    const adj = Array.from({ length: n }, () => new Array(n).fill(0));
    edges.forEach(e => {
        if (idx[e.from] != null && idx[e.to] != null)
            adj[idx[e.from]][idx[e.to]] = 1;
    });
    return { ids, idx, adj, n };
}

function matrixInDeg(M) {
    const { ids, adj, n } = M;
    const deg = {};
    ids.forEach((id, j) => {
        let s = 0;
        for (let i = 0; i < n; i++) s += adj[i][j];  // column sum = in-degree
        deg[id] = s;
    });
    return deg;
}

function matrixOutDeg(M) {
    const { ids, adj, n } = M;
    const deg = {};
    ids.forEach((id, i) => {
        let s = 0;
        for (let j = 0; j < n; j++) s += adj[i][j];  // row sum = out-degree
        deg[id] = s;
    });
    return deg;
}

// BFS using adjacency matrix — returns distance map from src
function matrixBFS(M, srcIdx) {
    const { adj, n } = M;
    const dist = new Array(n).fill(-1);
    dist[srcIdx] = 0;
    const queue = [srcIdx];
    while (queue.length) {
        const v = queue.shift();
        for (let w = 0; w < n; w++) {
            if (adj[v][w] === 1 && dist[w] === -1) {
                dist[w] = dist[v] + 1;
                queue.push(w);
            }
        }
    }
    return dist;
}

// Betweenness Centrality via Brandes algorithm on adjacency matrix
function matrixBetweenness(M) {
    const { ids, adj, n } = M;
    const bc = new Array(n).fill(0);
    for (let s = 0; s < n; s++) {
        const stack = [], pred = Array.from({ length: n }, () => []);
        const sigma = new Array(n).fill(0); sigma[s] = 1;
        const dist = new Array(n).fill(-1); dist[s] = 0;
        const queue = [s];
        while (queue.length) {
            const v = queue.shift(); stack.push(v);
            for (let w = 0; w < n; w++) {
                if (adj[v][w] !== 1) continue;
                if (dist[w] < 0) { dist[w] = dist[v] + 1; queue.push(w); }
                if (dist[w] === dist[v] + 1) { sigma[w] += sigma[v]; pred[w].push(v); }
            }
        }
        const delta = new Array(n).fill(0);
        while (stack.length) {
            const w = stack.pop();
            for (const v of pred[w]) delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
            if (w !== s) bc[w] += delta[w];
        }
    }
    const norm = (n - 1) * (n - 2);
    const result = {};
    ids.forEach((id, i) => { result[id] = norm > 0 ? +(bc[i] / norm).toFixed(3) : 0; });
    return result;
}

// Closeness Centrality using BFS distance matrix
function matrixCloseness(M) {
    const { ids, n } = M;
    const result = {};
    for (let i = 0; i < n; i++) {
        const dist = matrixBFS(M, i);
        let sum = 0, reachable = 0;
        for (let j = 0; j < n; j++) {
            if (j !== i && dist[j] >= 0) { sum += dist[j]; reachable++; }
        }
        result[ids[i]] = reachable > 0 ? +(reachable / sum).toFixed(3) : 0;
    }
    return result;
}

// Impact propagation using REVERSE adjacency matrix BFS
// Returns { impacted:{id:depth}, waves:[[hop1ids],[hop2ids],...] }
function matrixImpact(M, targetId) {
    const { ids, idx, adj, n } = M;
    const si = idx[targetId];
    if (si == null) return { impacted: {}, waves: [] };
    // reverse BFS: find all nodes that depend on targetId (upstream)
    const dist = new Array(n).fill(-1);
    dist[si] = 0;
    const queue = [si];
    const waves = [];
    while (queue.length) {
        const v = queue.shift();
        for (let w = 0; w < n; w++) {
            if (adj[w][v] === 1 && dist[w] === -1) {   // w→v means w depends on v
                dist[w] = dist[v] + 1;
                if (!waves[dist[w] - 1]) waves[dist[w] - 1] = [];
                waves[dist[w] - 1].push(ids[w]);
                queue.push(w);
            }
        }
    }
    const impacted = {};
    ids.forEach((id, i) => { if (i !== si && dist[i] > 0) impacted[id] = dist[i]; });
    return { impacted, waves: waves.filter(w => w && w.length > 0) };
}

function getSev(depth, indeg, outdeg) {
    // HIGH: direct dependent (hop 1) that is itself highly connected (in OR out >= 2)
    if (depth === 1 && (indeg >= 2 || outdeg >= 2)) return "HIGH";
    if (depth <= 2) return "MED";
    return "LOW";
}


function parseReqLines(txt) {
    return txt.split("\n").map(l => l.trim()).filter(Boolean).map((line, i) => {
        const ci = line.indexOf(":");
        if (ci > 0) return { id: line.slice(0, ci).trim().toUpperCase(), label: line.slice(ci + 1).trim() };
        const si = line.indexOf(" ");
        if (si > 0) { const f = line.slice(0, si).trim().toUpperCase(); if (f.length <= 6 && /^[A-Z0-9_-]+$/.test(f)) return { id: f, label: line.slice(si + 1).trim() }; }
        return { id: `R${i + 1}`, label: line };
    });
}
function parseDepLines(txt, nodeIds) {
    const set = new Set(), result = [];
    for (const raw of txt.split("\n").map(l => l.trim()).filter(Boolean)) {
        const sep = raw.includes("->") ? "->" : ":";
        const parts = raw.split(sep); if (parts.length < 2) continue;
        const from = parts[0].trim().toUpperCase(); if (!nodeIds.includes(from)) continue;
        for (const to of parts[1].split(",").map(s => s.trim().toUpperCase()).filter(t => nodeIds.includes(t) && t !== from)) {
            const k = `${from}→${to}`; if (!set.has(k)) { set.add(k); result.push({ from, to }); }
        }
    }
    return result;
}

// ── UI atoms ──────────────────────────────────────────────────────────────────
function DepSelector({ nodeId, nodes, selected, onChange, P }) {
    const [open, setOpen] = useState(false);
    const available = nodes.filter(n => n.id !== nodeId);
    const selNodes = selected.map(id => nodes.find(n => n.id === id)).filter(Boolean);

    return (
        <div style={{ position: "relative", width: "100%", fontFamily: "'JetBrains Mono',monospace", fontSize: 13 }}>
            <div onClick={() => setOpen(!open)} style={{ background: P.inp, border: `1.5px solid ${open ? P.acc : P.bdr}`, borderRadius: 8, padding: "8px 12px", cursor: "pointer", display: "flex", flexWrap: "wrap", gap: 6, minHeight: 40, alignItems: "center" }}>
                {selNodes.length === 0 ? <span style={{ color: P.mut }}>No dependencies...</span> : selNodes.map(n => (
                    <span key={n.id} style={{ background: P.acc + "22", color: P.acc, padding: "2px 6px", borderRadius: 4, display: "flex", alignItems: "center", gap: 4 }}>
                        {n.id} <span style={{ cursor: "pointer", opacity: 0.7 }} onClick={(e) => { e.stopPropagation(); onChange(selected.filter(x => x !== n.id)); }}>✕</span>
                    </span>
                ))}
                <div style={{ marginLeft: "auto", color: P.mut }}>{open ? "▲" : "▼"}</div>
            </div>
            {open && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: P.card, border: `1.5px solid ${P.bdr}`, borderRadius: 8, maxHeight: 180, overflowY: "auto", zIndex: 100, boxShadow: P.shadow }}>
                    {available.map(n => {
                        const isSel = selected.includes(n.id);
                        return (
                            <div key={n.id} onClick={(e) => {
                                e.stopPropagation();
                                if (isSel) onChange(selected.filter(x => x !== n.id));
                                else onChange([...selected, n.id]);
                            }} style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", background: isSel ? P.inp : "transparent", borderBottom: `1px solid ${P.bdr}55` }}>
                                <div style={{ width: 14, height: 14, border: `1.5px solid ${isSel ? P.acc : P.mut}`, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", background: isSel ? P.acc : "transparent" }}>
                                    {isSel && <span style={{ color: "#fff", fontSize: 10 }}>✓</span>}
                                </div>
                                <span style={{ fontWeight: 700, color: isSel ? P.acc : P.txt }}>{n.id}</span>
                                <span style={{ color: P.sub, fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.label}</span>
                            </div>
                        );
                    })}
                    {available.length === 0 && <div style={{ padding: "10px", color: P.mut, textAlign: "center", fontSize: 12 }}>No other requirements available</div>}
                </div>
            )}
        </div>
    );
}

function SevBadge({ sev, P }) {
    const col = sevColors(P, sev);
    return <span style={{ display: "inline-flex", alignItems: "center", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: col.c, background: col.bg, border: `1.5px solid ${col.b}`, borderRadius: 5, padding: "2px 7px", fontFamily: "'JetBrains Mono',monospace" }}>{sev}</span>;
}
function Modal({ title, P, onClose, children, wide }) {
    return (
        <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)", padding: 16 }}>
            <div style={{ background: P.card, border: `1.5px solid ${P.bdr}`, borderRadius: 16, padding: 28, width: "100%", maxWidth: wide ? 700 : 500, maxHeight: "90vh", overflowY: "auto", boxShadow: P.shadow, fontFamily: "'Syne',sans-serif", animation: "mfin 0.2s ease" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <span style={{ fontSize: 17, fontWeight: 800, color: P.txt }}>{title}</span>
                    <button onClick={onClose} style={{ background: "none", border: "none", color: P.mut, fontSize: 18, cursor: "pointer" }}>✕</button>
                </div>
                {children}
            </div>
        </div>
    );
}
function Stepper({ steps, current, P }) {
    return (
        <div style={{ display: "flex", alignItems: "center", marginBottom: 32 }}>
            {steps.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 38, height: 38, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", background: i < current ? `linear-gradient(135deg,${P.acc},${P.accAlt})` : i === current ? P.card : P.bg, border: `2px solid ${i <= current ? P.acc : P.bdr}`, color: i < current ? "#fff" : i === current ? P.acc : P.mut, boxShadow: i === current ? `0 0 18px ${P.glow}` : "none" }}>{i < current ? "✓" : i + 1}</div>
                        <span style={{ fontSize: 11, fontWeight: i === current ? 700 : 400, color: i === current ? P.acc : P.mut }}>{s}</span>
                    </div>
                    {i < steps.length - 1 && <div style={{ width: 64, height: 2, background: i < current ? P.acc : P.bdr, margin: "0 10px", marginBottom: 22, borderRadius: 2 }} />}
                </div>
            ))}
        </div>
    );
}

// ── Export Report (plain-text / copy) ─────────────────────────────────────────
function buildReport(nodes, edges, IDeg, ODeg, BC, CC, score, impacted, waves, simAction, sel) {
    const lines = [];
    const ts = new Date().toLocaleString();
    lines.push("═══════════════════════════════════════════════════════════");
    lines.push("  REQIFY — CHANGE IMPACT ANALYSIS REPORT");
    lines.push(`  Generated: ${ts}`);
    lines.push("═══════════════════════════════════════════════════════════");
    lines.push("");
    lines.push("── GRAPH SUMMARY ──────────────────────────────────────────");
    lines.push(`  Nodes : ${nodes.length}    Edges : ${edges.length}`);
    lines.push("");
    lines.push("── CENTRALITY METRICS ─────────────────────────────────────");
    lines.push(`  ${"Node".padEnd(6)} ${"Label".padEnd(28)} ${"In-Deg".padEnd(8)} ${"Out-Deg".padEnd(9)} ${"Betw.".padEnd(8)} ${"Close.".padEnd(8)} Score`);
    lines.push("  " + "─".repeat(78));
    [...nodes].sort((a, b) => score(b.id) - score(a.id)).forEach(n => {
        lines.push(`  ${n.id.padEnd(6)} ${n.label.slice(0, 28).padEnd(28)} ${String(IDeg[n.id] || 0).padEnd(8)} ${String(ODeg[n.id] || 0).padEnd(9)} ${String(BC[n.id] || 0).padEnd(8)} ${String(CC[n.id] || 0).padEnd(8)} ${score(n.id)}`);
    });
    lines.push("");
    if (sel && simAction) {
        lines.push("── SIMULATION RESULT ───────────────────────────────────────");
        lines.push(`  Target : ${sel}   Action : ${simAction.toUpperCase()}`);
        lines.push(`  Affected requirements : ${Object.keys(impacted).length}`);
        if (waves.length > 0) {
            lines.push("");
            lines.push("  Propagation Waves:");
            waves.forEach((wave, wi) => {
                lines.push(`    Hop ${wi + 1}: ${wave.join(", ")}`);
            });
        }
        if (Object.keys(impacted).length > 0) {
            lines.push("");
            lines.push("  Impact Details:");
            Object.entries(impacted).sort((a, b) => a[1] - b[1]).forEach(([id, depth]) => {
                const sev = getSev(depth, IDeg[id] || 0, ODeg[id] || 0);
                const n = nodes.find(x => x.id === id);
                lines.push(`    ${id.padEnd(6)} ${(n?.label || "").slice(0, 30).padEnd(32)} Hops:${depth}  Sev:${sev.padEnd(7)} ${sev === "HIGH" ? "⚠ Full regression test" : sev === "MED" ? "↻ Review integrations" : "✓ Spot-check"}`);
            });
        }
    }
    lines.push("");
    lines.push("── ADJACENCY MATRIX REPRESENTATION ─────────────────────────");
    const ids = nodes.map(n => n.id);
    const header = "        " + ids.map(id => id.padEnd(6)).join(" ");
    lines.push("  " + header);
    ids.forEach(from => {
        const row = ids.map(to => edges.find(e => e.from === from && e.to === to) ? "1     " : "0     ").join(" ");
        lines.push(`  ${from.padEnd(6)}  ${row}`);
    });
    lines.push("");
    lines.push("═══════════════════════════════════════════════════════════");
    return lines.join("\n");
}

// ═════════════════════════════════════════════════════════════════════════════
// APP
// ═════════════════════════════════════════════════════════════════════════════
export default function ImpactAnalyzer({ userEmail, onLogout }) {
    const { isDark, toggleTheme } = useTheme();
    const theme = isDark ? "dark" : "light";
    const P = PALETTE[theme];
    const navigate = useNavigate();

    // wizard
    const [step, setStep] = useState(0);
    const [reqTxt, setReqTxt] = useState("");
    const [depMap, setDepMap] = useState({});
    const [wizErr, setWizErr] = useState("");

    useEffect(() => {
        const classRaw = localStorage.getItem('reqify_classification_results');
        if (classRaw) {
            try {
                const parsed = JSON.parse(classRaw);
                const texts = Array.isArray(parsed)
                    ? parsed.map((r, i) => {
                        const txt = r.requirement_text || r.original_requirement || r.text || "";
                        return `R${i + 1}: ${txt.trim()}`;
                    }).filter(t => t.length > 4) // filter out blank ones
                    : [];
                if (texts.length > 0) setReqTxt(texts.join("\n"));
            } catch (_) { }
        }
    }, []);

    // graph
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [history, setHistory] = useState([]);

    useEffect(() => {
        if (nodes.length > 0) {
            const rawScoreMap = {};
            const scoreMap = {};
            nodes.forEach(n => {
                rawScoreMap[n.id] = typeof score === 'function' && typeof rawScore === 'function' ? rawScore(n.id) : 0;
            });
            // We can't use rawScore safely in this hook if it's not defined before it. 
            // So I'll compute them locally in the hook.
            const M_loc = buildAdjMatrix(nodes, edges);
            const inDeg = matrixInDeg(M_loc);
            const bc = matrixBetweenness(M_loc);
            const cc = matrixCloseness(M_loc);
            let maxS = 0.001;
            nodes.forEach(n => {
                const s = ((inDeg[n.id] || 0) * 0.4 + (bc[n.id] || 0) * 10 * 0.3 + (cc[n.id] || 0) * 0.3);
                rawScoreMap[n.id] = s;
                if (s > maxS) maxS = s;
            });
            nodes.forEach(n => {
                 scoreMap[n.id] = rawScoreMap[n.id] / maxS;
            });
            localStorage.setItem('reqify_impact_results', JSON.stringify({ nodes, edges, rawScoreMap, scoreMap }));
            
            // Auto-save to backend
            axios.post('http://localhost:8000/save-results', {
                module_name: 'impact_analysis',
                data: { nodes, edges, rawScoreMap, scoreMap }
            }).catch(e => console.error('Error saving impact analysis to backend:', e));
        }
    }, [nodes, edges]);

    // simulation
    const [sel, setSel] = useState(null);
    const [simReady, setSimReady] = useState(false);
    const [simDone, setSimDone] = useState(false);
    const [simAction, setSimAction] = useState("");
    const [impacted, setImpacted] = useState({});
    const [waves, setWaves] = useState([]);
    const [activeWave, setActiveWave] = useState(-1);

    const [pendingModify, setPendingModify] = useState(null);


    // filter
    const [sevFilter, setSevFilter] = useState("ALL"); // "ALL"|"HIGH"|"MED"|"LOW"

    // modals
    const [modal, setModal] = useState(null);
    const [mStep, setMStep] = useState(1);
    const [mLabel, setMLabel] = useState("");
    const [mDepList, setMDepList] = useState([]);
    const [aStep, setAStep] = useState(1);
    const [aId, setAId] = useState("");
    const [aLabel, setALabel] = useState("");
    const [aDepList, setADepList] = useState([]);


    const cyContainerRef = useRef(null);
    const cyCore = useRef(null);

    // ── Adjacency Matrix & all metrics ────────────────────────────────────────
    const M = buildAdjMatrix(nodes, edges);
    const IDeg = matrixInDeg(M);
    const ODeg = matrixOutDeg(M);
    const BC = matrixBetweenness(M);
    const CC = matrixCloseness(M);
    const rawScore = id => ((IDeg[id] || 0) * 0.4 + (BC[id] || 0) * 10 * 0.3 + (CC[id] || 0) * 0.3);
    let maxImpactScore = 0.001;
    nodes.forEach(n => {
        const s = rawScore(n.id);
        if (s > maxImpactScore) maxImpactScore = s;
    });
    const score = id => +(rawScore(id) / maxImpactScore).toFixed(3);
    const nmap = Object.fromEntries(nodes.map(n => [n.id, n]));
    const impList = Object.entries(impacted).sort((a, b) => a[1] - b[1]);
    let cntH = 0, cntM = 0, cntL = 0;
    impList.forEach(([id, d]) => { const sv = getSev(d, IDeg[id] || 0, ODeg[id] || 0); if (sv === "HIGH") cntH++; else if (sv === "MED") cntM++; else cntL++; });

    // sorted + filtered for left panel
    const allSorted = [...nodes].sort((a, b) => score(b.id) - score(a.id));
    const filteredNodes = sevFilter === "ALL"
        ? allSorted
        : allSorted.filter(n => {
            if (!simDone || impacted[n.id] == null) return false;
            return getSev(impacted[n.id], IDeg[n.id] || 0, ODeg[n.id] || 0) === sevFilter;
        });

    // ── Cytoscape init: rebuild when graph data changes
    useEffect(() => {
        if (step < 2 || !cyContainerRef.current || nodes.length === 0) return;
        if (cyCore.current) { cyCore.current.destroy(); cyCore.current = null; }

        const bg    = isDark ? '#1e2235' : '#f0f4f8';
        const nodeBg = isDark ? '#252a42' : '#ffffff';
        const nodeStr = '#6c8ebf';
        const txtCol = isDark ? '#dce5f5' : '#1a1d2e';
        const edgeCol = '#6c8ebf';

        cyCore.current = cytoscape({
            container: cyContainerRef.current,
            elements: [
                ...nodes.map(n => ({ data: { id: n.id, label: n.id } })),
                ...edges.map(e => ({ data: { id: `${e.from}__${e.to}`, source: e.from, target: e.to } }))
            ],
            style: [
                { selector: 'node', style: {
                    'label': 'data(label)', 'text-valign': 'center', 'text-halign': 'center',
                    'font-family': 'JetBrains Mono, monospace', 'font-size': '11px', 'font-weight': '700',
                    'width': 36, 'height': 36,
                    'background-color': nodeBg,
                    'border-width': 1.5, 'border-color': nodeStr, 'color': txtCol,
                    'cursor': 'pointer', 'transition-property': 'background-color border-color color border-width',
                    'transition-duration': '0.2s'
                }},
                { selector: 'edge', style: {
                    'width': 1.8, 'line-color': edgeCol,
                    'target-arrow-color': edgeCol, 'target-arrow-shape': 'triangle',
                    'curve-style': 'bezier', 'opacity': 0.85, 'arrow-scale': 0.9,
                    'transition-property': 'line-color target-arrow-color width opacity',
                    'transition-duration': '0.2s'
                }},
                { selector: 'node.cy-sel', style: {
                    'background-color': isDark ? '#162340' : '#dbeafe',
                    'border-color': 'var(--accent-primary)', 'border-width': 3,
                    'color': 'var(--accent-primary)', 'font-size': '12px'
                }},
                { selector: 'edge.cy-sel', style: {
                    'line-color': 'var(--accent-primary)', 'target-arrow-color': 'var(--accent-primary)',
                    'width': 2.5, 'opacity': 1
                }},
                { selector: 'node.cy-high', style: {
                    'background-color': isDark ? '#3a1020' : '#ffe4e6',
                    'border-color': 'var(--error-text)', 'border-width': 2.5, 'color': 'var(--error-text)'
                }},
                { selector: 'node.cy-med', style: {
                    'background-color': isDark ? '#3a2800' : '#fef9c3',
                    'border-color': 'var(--warning-text)', 'border-width': 2.5, 'color': 'var(--warning-text)'
                }},
                { selector: 'node.cy-low', style: {
                    'background-color': isDark ? '#0f2e18' : '#dcfce7',
                    'border-color': 'var(--success-text)', 'border-width': 2.5, 'color': 'var(--success-text)'
                }},
                { selector: 'edge.cy-high', style: { 'line-color': 'var(--error-text)', 'target-arrow-color': 'var(--error-text)', 'width': 2, 'opacity': 1 }},
                { selector: 'edge.cy-med',  style: { 'line-color': 'var(--warning-text)', 'target-arrow-color': 'var(--warning-text)', 'width': 2, 'opacity': 1 }},
                { selector: 'edge.cy-low',  style: { 'line-color': 'var(--success-text)', 'target-arrow-color': 'var(--success-text)', 'width': 2, 'opacity': 1 }},
            ],
            layout: {
                name: 'cose', animate: false, randomize: false,
                nodeRepulsion: () => 10000, idealEdgeLength: () => 90,
                edgeElasticity: () => 100, gravity: 1, numIter: 1000,
                initialTemp: 200, coolingFactor: 0.95, minTemp: 1.0
            },
            userZoomingEnabled: true, userPanningEnabled: true, boxSelectionEnabled: false
        });

        cyCore.current.on('tap', 'node', evt => {
            const id = evt.target.id();
            setSel(id); setImpacted({}); setSimDone(false); setSimReady(false); setSimAction(''); setWaves([]);
        });
        cyCore.current.on('tap', evt => {
            if (evt.target === cyCore.current) {
                setSel(null); setImpacted({}); setSimDone(false); setSimReady(false); setSimAction(''); setWaves([]);
            }
        });

        return () => { if (cyCore.current) { cyCore.current.destroy(); cyCore.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodes, edges, step, isDark]);

    // ── Style sync: update cytoscape node/edge classes when sim state changes
    useEffect(() => {
        const cy = cyCore.current;
        if (!cy) return;
        cy.nodes().removeClass('cy-sel cy-high cy-med cy-low');
        cy.edges().removeClass('cy-sel cy-high cy-med cy-low');
        if (sel) {
            cy.$id(sel).addClass('cy-sel');
            cy.edges(`[source = "${sel}"], [target = "${sel}"]`).addClass('cy-sel');
        }
        if (simDone) {
            const visibleWave = waves.slice(0, activeWave + 1).flat();
            visibleWave.forEach(id => {
                const depth = impacted[id]; if (depth == null) return;
                const sev = getSev(depth, IDeg[id] || 0, ODeg[id] || 0).toLowerCase();
                cy.$id(id).addClass(`cy-${sev}`);
                cy.edges(`[source = "${id}"], [target = "${id}"]`).addClass(`cy-${sev}`);
            });
        }
    }, [sel, impacted, simDone, activeWave, waves, IDeg, ODeg]);

    // wave animation
    useEffect(() => {
        if (!simDone || waves.length === 0) return;
        setActiveWave(-1); let i = -1;
        const t = setInterval(() => { i++; setActiveWave(i); if (i >= waves.length - 1) clearInterval(t); }, 500);
        return () => clearInterval(t);
    }, [simDone, waves]);

    // wizard
    function wizStep0() {
        setWizErr("");
        const raw = reqTxt.trim();
        if (!raw) { setWizErr("Requirements cannot be empty."); return; }
        const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) { setWizErr("Enter at least 2 requirements."); return; }
        // Validate each line format
        for (const line of lines) {
            const ci = line.indexOf(":");
            const si = line.indexOf(" ");
            const hasColon = ci > 0;
            const hasSpace = si > 0;
            if (!hasColon && !hasSpace) { setWizErr(`Invalid format: "${line}"\nUse  R1: Label  or  R1 Label`); return; }
            const id = hasColon ? line.slice(0, ci).trim() : line.slice(0, si).trim();
            if (!/^[A-Z0-9_-]+$/i.test(id)) { setWizErr(`Invalid ID "${id}" — only letters, numbers, _ and - allowed.`); return; }
            if (id.length > 8) { setWizErr(`ID "${id}" is too long — max 8 characters.`); return; }
            const label = hasColon ? line.slice(ci + 1).trim() : line.slice(si + 1).trim();
            if (!label) { setWizErr(`Missing label for "${id}".`); return; }
        }
        const parsed = parseReqLines(reqTxt);
        const seen = new Set();
        for (const p of parsed) {
            if (seen.has(p.id.toUpperCase())) { setWizErr(`Duplicate ID: "${p.id}" — each requirement must have a unique ID.`); return; }
            seen.add(p.id.toUpperCase());
        }
        const initialMap = {};
        parsed.forEach(p => { initialMap[p.id] = []; });
        setDepMap(initialMap);
        setNodes(parsed); setStep(1);
    }
    function wizStep1() {
        setWizErr("");
        const newEdges = [];
        for (const from of Object.keys(depMap)) {
            for (const to of depMap[from]) {
                 newEdges.push({ from, to });
            }
        }
        setEdges(newEdges); setStep(2);
    }

    function pushHistory() { setHistory(h => [...h, { nodes: [...nodes], edges: [...edges] }]); }
    function clearSim() { setSel(null); setImpacted({}); setSimDone(false); setSimReady(false); setSimAction(""); setWaves([]); setActiveWave(-1); setPendingModify(null); }

    // ── REMOVE
    function prepRemove() { if (!sel) return; setSimAction("remove"); setSimReady(true); setSimDone(false); setImpacted({}); }
    function runRemoveSim() {
        const { impacted: imp, waves: ws } = matrixImpact(M, sel);
        setImpacted(imp); setWaves(ws); setSimDone(true); setSimReady(false);
    }
    function confirmRemove() {
        // Snapshot BEFORE state
        const beforeSnap = { nodes: [...nodes], edges: [...edges], IDeg: { ...IDeg }, ODeg: { ...ODeg }, BC: { ...BC }, CC: { ...CC }, scoreMap: Object.fromEntries(nodes.map(n => [n.id, score(n.id)])) };
        // Compute AFTER metrics on pruned graph
        const newNodes = nodes.filter(n => n.id !== sel);
        const newEdges = edges.filter(e => e.from !== sel && e.to !== sel);
        const newM = buildAdjMatrix(newNodes, newEdges);
        const aIDeg = matrixInDeg(newM), aODeg = matrixOutDeg(newM), aBC = matrixBetweenness(newM), aCC = matrixCloseness(newM);
        const aScore = id => +((aIDeg[id] || 0) * 0.4 + (aBC[id] || 0) * 10 * 0.3 + (aCC[id] || 0) * 0.3).toFixed(2);
        pushHistory();
        setNodes(newNodes); setEdges(newEdges);
        clearSim();
    }

    // ── MODIFY
    const [modErr, setModErr] = useState("");
    function openModify() {
        if (!sel) return;
        setMStep(1); setMLabel(nmap[sel]?.label || ""); setModErr("");
        setMDepList(edges.filter(e => e.from === sel).map(e => e.to));
        setModal("modify"); setSimAction("modify"); setSimReady(true);
    }
    function runModifySim() {
        setModErr("");
        if (!mLabel.trim()) { setModErr("Label cannot be empty."); return; }
        if (mLabel.trim().length < 2) { setModErr("Label must be at least 2 characters."); return; }
        const newNodes = nodes.map(n => n.id === sel ? { ...n, label: mLabel.trim() } : n);
        const newEdges = [...edges.filter(e => e.from !== sel), ...mDepList.map(to => ({ from: sel, to }))];
        const newM = buildAdjMatrix(newNodes, newEdges);
        const { impacted: imp, waves: ws } = matrixImpact(newM, sel);
        setPendingModify({ nodes: newNodes, edges: newEdges });
        setImpacted(imp); setWaves(ws); setSimDone(true); setSimReady(false); setModal(null);
    }
    function confirmModify() {
        if (!pendingModify) return;
        pushHistory();
        setNodes(pendingModify.nodes); setEdges(pendingModify.edges);
        setPendingModify(null); clearSim();
    }

    // ── ADD
    const [addErr, setAddErr] = useState("");
    function openAdd() { setAStep(1); setAId(""); setALabel(""); setADepList([]); setAddErr(""); setModal("add"); setSimAction("add"); }
    function addProceedToDeps() {
        setAddErr("");
        const id = aId.trim().toUpperCase();
        if (!id) { setAddErr("Requirement ID is required."); return; }
        if (!/^[A-Z0-9_-]+$/.test(id)) { setAddErr("ID must contain only letters, numbers, _ or -."); return; }
        if (id.length > 8) { setAddErr("ID must be 8 characters or fewer."); return; }
        if (!aLabel.trim()) { setAddErr("Label is required."); return; }
        if (aLabel.trim().length < 2) { setAddErr("Label must be at least 2 characters."); return; }
        if (nodes.find(n => n.id === id)) { setAddErr(`ID "${id}" already exists. Choose a different ID.`); return; }
        setAId(id); setADepList([]); setAStep(2);
    }
    function runAddSim() {
        setAddErr("");
        const id = aId.trim().toUpperCase();
        const newNode = { id, label: aLabel.trim() };
        const newNodes = [...nodes, newNode];
        const newEdges = [...edges, ...aDepList.map(to => ({ from: id, to }))];
        const newM = buildAdjMatrix(newNodes, newEdges);
        const { impacted: imp, waves: ws } = matrixImpact(newM, id);
        pushHistory();
        setNodes(newNodes); setEdges(newEdges); setSel(id);
        setImpacted(imp); setWaves(ws); setSimDone(true); setSimReady(false); setModal(null); setSimAction("add");
    }

    function undoLast() {
        if (!history.length) return;
        const prev = history[history.length - 1];
        setNodes(prev.nodes); setEdges(prev.edges);
        setHistory(h => h.slice(0, -1)); clearSim();
    }

    function doExport() {
        const txt = buildReport(nodes, edges, IDeg, ODeg, BC, CC, score, impacted, waves, simAction, sel);
        const blob = new Blob([txt], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "reqify-report.txt"; a.click();
        URL.revokeObjectURL(url);
    }



    const B = { fontFamily: "'JetBrains Mono',monospace", cursor: "pointer", border: "none", borderRadius: 8, fontWeight: 700, letterSpacing: "0.05em", transition: "all 0.15s" };
    const INP = { background: P.inp, border: `1.5px solid ${P.bdr}`, borderRadius: 8, color: P.txt, fontFamily: "'JetBrains Mono',monospace", fontSize: 14, padding: "10px 12px", width: "100%", boxSizing: "border-box", outline: "none" };

    // ════════════════════════════════════════════════════════════════════════════
    // WIZARD
    // ════════════════════════════════════════════════════════════════════════════
    if (step < 2) return (
        <div className={`classifier-container ${isDark ? 'dark' : 'light'}`}>
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
                        <button className="nav-link active">Impact Analyzer</button>
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
            <main className="classifier-content">
                <style>{`
        @keyframes mfin{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}
        @keyframes fin{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        input:focus,textarea:focus,select:focus{outline:none!important;border-color:${P.acc}!important;box-shadow:0 0 0 3px ${P.glow}!important;}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:${P.bdr};border-radius:2px}
      `}</style>
                <div className="content-header">
                    <div>
                        <h2>Impact Analyzer</h2>
                        <p className="subtitle">Map requirement dependencies &amp; simulate change propagation</p>
                    </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", fontFamily: "'Syne',sans-serif" }}>
                    <Stepper steps={["Requirements", "Dependencies", "Analyze"]} current={step} P={P} />
                    <div style={{ background: P.card, border: `1.5px solid ${P.bdr}`, borderRadius: 18, padding: 32, width: "100%", maxWidth: 600, boxShadow: P.shadow }}>
                        {step === 0 && <>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                <div style={{ fontSize: 20, fontWeight: 800, color: P.txt }}>Define Requirements</div>
                                <label style={{ fontFamily: "'JetBrains Mono',monospace", cursor: "pointer", borderRadius: 8, fontWeight: 700, letterSpacing: "0.05em", transition: "all 0.15s", background: P.inp, color: P.acc, padding: "6px 12px", border: `1.5px solid ${P.acc}66`, fontSize: 13 }}>
                                    Import Requirements
                                    <input type="file" accept=".txt,.csv,.json" style={{ display: "none" }} onChange={(e) => {
                                        const file = e.target.files[0];
                                        if(!file) return;
                                        const reader = new FileReader();
                                        reader.onload = ev => setReqTxt(ev.target.result);
                                        reader.readAsText(file);
                                        e.target.value = '';
                                    }} />
                                </label>
                            </div>
                            <div style={{ fontSize: 14, color: P.sub, marginBottom: 18, lineHeight: 1.8 }}>
                                One per line:&nbsp;
                                <code style={{ color: P.acc, background: P.inp, padding: "1px 6px", borderRadius: 4, fontSize: 13 }}>R1: Login</code>&nbsp;
                                <code style={{ color: P.acc, background: P.inp, padding: "1px 6px", borderRadius: 4, fontSize: 13 }}>R1 Login</code>
                            </div>
                            <textarea value={reqTxt} onChange={e => setReqTxt(e.target.value)} placeholder={"R1: User Registration\nR2: User Login\nR3: Validate Credentials"} style={{ ...INP, height: 200, resize: "vertical", lineHeight: 1.9 }} />
                            {wizErr && <div style={{ color: P.HIGH_c, fontSize: 13, marginTop: 8, fontFamily: "'JetBrains Mono',monospace" }}>⚠ {wizErr}</div>}
                            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                                <button onClick={wizStep0} style={{ ...B, flex: 1, padding: "12px 0", fontSize: 15, background: `linear-gradient(135deg,${P.acc},${P.accAlt})`, color: "#fff", boxShadow: `0 4px 18px ${P.glow}` }}>Next → Map Dependencies</button>
                            </div>
                        </>}
                        {step === 1 && <>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                <div style={{ fontSize: 20, fontWeight: 800, color: P.txt }}>Map Dependencies</div>
                                <label style={{ fontFamily: "'JetBrains Mono',monospace", cursor: "pointer", borderRadius: 8, fontWeight: 700, letterSpacing: "0.05em", transition: "all 0.15s", background: P.inp, color: P.acc, padding: "6px 12px", border: `1.5px solid ${P.acc}66`, fontSize: 13 }}>
                                    Import Dependencies
                                    <input type="file" accept=".txt,.json,.csv" style={{ display: "none" }} onChange={(e) => {
                                        const file = e.target.files[0];
                                        if(!file) return;
                                        setWizErr("");
                                        const reader = new FileReader();
                                        reader.onload = ev => {
                                            try {
                                                const text = ev.target.result;
                                                const newMap = { ...depMap };
                                                if (file.name.endsWith('.json')) {
                                                    const parsed = JSON.parse(text);
                                                    Object.keys(parsed).forEach(fromKey => {
                                                        const from = fromKey.trim().toUpperCase();
                                                        if (nodes.find(n => n.id === from)) {
                                                            const toArray = Array.isArray(parsed[fromKey]) ? parsed[fromKey] : [parsed[fromKey]];
                                                            toArray.forEach(toVal => {
                                                                const to = String(toVal).trim().toUpperCase();
                                                                if (nodes.find(n => n.id === to) && from !== to) {
                                                                    if (!newMap[from]) newMap[from] = [];
                                                                    if (!newMap[from].includes(to)) newMap[from].push(to);
                                                                }
                                                            });
                                                        }
                                                    });
                                                } else {
                                                    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
                                                    for (const line of lines) {
                                                        let cleanLine = line;
                                                        const sep = cleanLine.includes("->") ? "->" : (cleanLine.includes(":") ? ":" : (cleanLine.includes(",") ? "," : ""));
                                                        if (!sep) continue;
                                                        const parts = cleanLine.split(sep);
                                                        const from = parts[0].replace(/"/g, '').trim().toUpperCase();
                                                        if (!nodes.find(n => n.id === from)) continue;
                                                        const toNodes = parts.slice(1).join(sep).split(",").map(s => s.replace(/"/g, '').trim().toUpperCase());
                                                        toNodes.forEach(to => {
                                                            if (nodes.find(n => n.id === to) && from !== to) {
                                                                if (!newMap[from]) newMap[from] = [];
                                                                if (!newMap[from].includes(to)) newMap[from].push(to);
                                                            }
                                                        });
                                                    }
                                                }
                                                setDepMap(newMap);
                                            } catch(err) {
                                                setWizErr("Failed to parse file.");
                                            }
                                        };
                                        reader.readAsText(file);
                                        e.target.value = '';
                                    }} />
                                </label>
                            </div>
                            <div style={{ fontSize: 13, color: P.mut, marginBottom: 14, fontFamily: "'JetBrains Mono',monospace" }}>
                                Select requirements that each requirement depends on.
                            </div>
                            <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingRight: 8 }}>
                                {nodes.map(n => (
                                    <div key={n.id} style={{ background: P.inp, border: `1.5px solid ${P.bdr}`, borderRadius: 10, padding: 12 }}>
                                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
                                            <span style={{ fontSize: 15, fontWeight: 800, color: P.acc, fontFamily: "'JetBrains Mono',monospace" }}>{n.id}</span>
                                            <span style={{ fontSize: 13, color: P.txt, fontWeight: 600 }}>{n.label}</span>
                                        </div>
                                        <DepSelector nodeId={n.id} nodes={nodes} P={P} selected={depMap[n.id] || []} onChange={v => setDepMap(m => ({ ...m, [n.id]: v }))} />
                                    </div>
                                ))}
                            </div>
                            {wizErr && <div style={{ color: P.HIGH_c, fontSize: 13, marginTop: 8, fontFamily: "'JetBrains Mono',monospace" }}>⚠ {wizErr}</div>}
                            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                                <button onClick={() => { setStep(0); setWizErr(""); }} style={{ ...B, padding: "11px 16px", fontSize: 13, background: P.inp, border: `1.5px solid ${P.bdr}`, color: P.sub }}>← Back</button>
                                <button onClick={wizStep1} style={{ ...B, flex: 1, padding: "12px 0", fontSize: 15, background: `linear-gradient(135deg,${P.acc},${P.accAlt})`, color: "#fff", boxShadow: `0 4px 18px ${P.glow}` }}>Build Graph &amp; Analyze →</button>
                            </div>
                        </>}
                    </div>
                </div>
            </main>
        </div>
    );

    // ════════════════════════════════════════════════════════════════════════════
    // ANALYZER
    // ════════════════════════════════════════════════════════════════════════════
    return (
        <div style={{ height: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Syne',sans-serif", background: P.bg, color: P.txt, overflow: "hidden", transition: "all 0.2s" }}>
            <style>{`
        @keyframes mfin{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}
        @keyframes fin{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pop{from{opacity:0;transform:scale(0.93)}to{opacity:1;transform:scale(1)}}
        @keyframes pulse{0%,100%{opacity:0.7;transform:scale(1)}50%{opacity:1;transform:scale(1.04)}}
        .hb:hover{filter:brightness(1.15);transform:translateY(-1px);}
        .nr{cursor:pointer;transition:background 0.12s;}
        .ng{cursor:grab;} .ng:active{cursor:grabbing;}
        input:focus,textarea:focus,select:focus{outline:none!important;border-color:${P.acc}!important;box-shadow:0 0 0 3px ${P.glow}!important;}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:${P.bdr};border-radius:2px}
      `}</style>

            {/* MODIFY MODAL */}
            {modal === "modify" && (
                <Modal title={`✎  Modify  ${sel}`} P={P} onClose={() => setModal(null)}>
                    {mStep === 1 && <>
                        <p style={{ fontSize: 14, color: P.sub, margin: "0 0 16px", lineHeight: 1.7 }}>Update label for <b style={{ color: P.acc }}>{sel}</b>.</p>
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 11, color: P.mut, letterSpacing: "0.12em", fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>NEW LABEL</div>
                            <input value={mLabel} onChange={e => { setMLabel(e.target.value); setModErr(""); }} style={{ background: P.inp, border: `1.5px solid ${modErr && !mLabel.trim() ? P.HIGH_c : P.bdr}`, borderRadius: 8, color: P.txt, fontSize: 14, padding: "10px 12px", width: "100%", boxSizing: "border-box" }} />
                        </div>
                        {modErr && <div style={{ color: P.HIGH_c, fontSize: 12, marginBottom: 10, fontFamily: "'JetBrains Mono',monospace", background: P.HIGH_bg, border: `1px solid ${P.HIGH_b}`, borderRadius: 6, padding: "7px 10px" }}>⚠ {modErr}</div>}
                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => { setModal(null); setModErr(""); }} style={{ ...B, padding: "11px 18px", fontSize: 13, background: P.inp, border: `1.5px solid ${P.bdr}`, color: P.sub }}>Cancel</button>
                            <button onClick={() => { if (!mLabel.trim()) { setModErr("Label cannot be empty."); return; } if (mLabel.trim().length < 2) { setModErr("Label must be at least 2 characters."); return; } setModErr(""); setMStep(2); }} style={{ ...B, flex: 1, padding: "12px 0", fontSize: 14, background: `linear-gradient(135deg,${P.acc},${P.accAlt})`, color: "#fff" }}>Next → Update Dependencies</button>
                        </div>
                    </>}
                    {mStep === 2 && <>
                        <p style={{ fontSize: 14, color: P.sub, margin: "0 0 10px", lineHeight: 1.7 }}>Update dependencies for <b style={{ color: P.acc }}>{sel}</b>:</p>
                        <DepSelector nodeId={sel} nodes={nodes} P={P} selected={mDepList} onChange={setMDepList} />
                        {modErr && <div style={{ color: P.HIGH_c, fontSize: 12, marginTop: 8, fontFamily: "'JetBrains Mono',monospace", background: P.HIGH_bg, border: `1px solid ${P.HIGH_b}`, borderRadius: 6, padding: "7px 10px" }}>⚠ {modErr}</div>}
                        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                            <button onClick={() => { setMStep(1); setModErr(""); }} style={{ ...B, padding: "11px 16px", fontSize: 13, background: P.inp, border: `1.5px solid ${P.bdr}`, color: P.sub }}>← Back</button>
                            <button onClick={runModifySim} style={{ ...B, flex: 1, padding: "12px 0", fontSize: 14, background: `linear-gradient(135deg,${P.acc},${P.accAlt})`, color: "#fff" }}>▶ Run Simulation &amp; Show Impact</button>
                        </div>
                    </>}
                </Modal>
            )}

            {/* ADD MODAL */}
            {modal === "add" && (
                <Modal title="＋  Add New Requirement" P={P} onClose={() => { setModal(null); setAddErr(""); }}>
                    {aStep === 1 && <>
                        <p style={{ fontSize: 14, color: P.sub, margin: "0 0 18px", lineHeight: 1.7 }}>Define the new requirement's ID and label.</p>
                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 11, color: P.mut, letterSpacing: "0.12em", fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>REQUIREMENT ID &nbsp;<span style={{ color: P.mut, fontWeight: 400 }}>letters, numbers, _ or - · max 8 chars</span></div>
                            <input value={aId} onChange={e => { setAId(e.target.value.toUpperCase()); setAddErr(""); }} placeholder="e.g. R11" style={{ background: P.inp, border: `1.5px solid ${addErr && !aId.trim() ? P.HIGH_c : P.bdr}`, borderRadius: 8, color: P.txt, fontSize: 14, padding: "10px 12px", width: "100%", boxSizing: "border-box" }} />
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 11, color: P.mut, letterSpacing: "0.12em", fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>LABEL / DESCRIPTION &nbsp;<span style={{ color: P.mut, fontWeight: 400 }}>min 2 characters</span></div>
                            <input value={aLabel} onChange={e => { setALabel(e.target.value); setAddErr(""); }} placeholder="e.g. Reset Password" style={{ background: P.inp, border: `1.5px solid ${addErr && !aLabel.trim() ? P.HIGH_c : P.bdr}`, borderRadius: 8, color: P.txt, fontSize: 14, padding: "10px 12px", width: "100%", boxSizing: "border-box" }} />
                        </div>
                        {addErr && <div style={{ color: P.HIGH_c, fontSize: 12, marginBottom: 10, fontFamily: "'JetBrains Mono',monospace", background: P.HIGH_bg, border: `1px solid ${P.HIGH_b}`, borderRadius: 6, padding: "7px 10px" }}>⚠ {addErr}</div>}
                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => { setModal(null); setAddErr(""); }} style={{ ...B, padding: "11px 18px", fontSize: 13, background: P.inp, border: `1.5px solid ${P.bdr}`, color: P.sub }}>Cancel</button>
                            <button onClick={addProceedToDeps} style={{ ...B, flex: 1, padding: "12px 0", fontSize: 14, background: `linear-gradient(135deg,${P.acc},${P.accAlt})`, color: "#fff" }}>Next → Map Dependencies</button>
                        </div>
                    </>}
                    {aStep === 2 && <>
                        <p style={{ fontSize: 14, color: P.sub, margin: "0 0 10px", lineHeight: 1.7 }}>Which nodes does <b style={{ color: P.acc }}>{aId}</b> depend on?</p>
                        <DepSelector nodeId={aId} nodes={nodes} P={P} selected={aDepList} onChange={setADepList} />
                        {addErr && <div style={{ color: P.HIGH_c, fontSize: 12, marginTop: 8, fontFamily: "'JetBrains Mono',monospace", background: P.HIGH_bg, border: `1px solid ${P.HIGH_b}`, borderRadius: 6, padding: "7px 10px" }}>⚠ {addErr}</div>}
                        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                            <button onClick={() => { setAStep(1); setAddErr(""); }} style={{ ...B, padding: "11px 16px", fontSize: 13, background: P.inp, border: `1.5px solid ${P.bdr}`, color: P.sub }}>← Back</button>
                            <button onClick={runAddSim} style={{ ...B, flex: 1, padding: "12px 0", fontSize: 14, background: `linear-gradient(135deg,${P.LOW_c},${P.acc})`, color: "#fff" }}>＋ Add &amp; Update Graph</button>
                        </div>
                    </>}
                </Modal>
            )}

            {/* ── NAVBAR ─────────────────────────────────────────────────────────── */}
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
                        <button className="nav-link active">Impact Analyzer</button>
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

            {/* ── TOOLBAR ────────────────────────────────────────────────────────── */}
            <div style={{ background: P.card, borderBottom: `1.5px solid ${P.bdr}`, padding: "0 16px", height: 46, display: "flex", alignItems: "center", gap: 8, flexShrink: 0, zIndex: 9 }}>
                {/* Target */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: P.inp, border: `1.5px solid ${P.bdr}`, borderRadius: 8, padding: "0 10px", height: 32, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: P.mut, fontFamily: "'JetBrains Mono',monospace", flexShrink: 0 }}>TARGET</span>
                    <select value={sel || ""} onChange={e => { setSel(e.target.value || null); setImpacted({}); setSimDone(false); setSimReady(false); setSimAction(""); setWaves([]); }}
                        style={{ background: "transparent", border: "none", color: sel ? P.acc : P.sub, fontWeight: 700, fontSize: 13, padding: "0 4px", cursor: "pointer", width: 90, fontFamily: "'JetBrains Mono',monospace" }}>
                        <option value="">— node —</option>
                        {allSorted.map(n => <option key={n.id} value={n.id} title={n.label}>{n.id}</option>)}
                    </select>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 4, background: P.inp, border: `1.5px solid ${P.bdr}`, borderRadius: 9, padding: 3 }}>
                    <button className="hb" onClick={() => sel && openModify()}
                        style={{ ...B, padding: "5px 12px", fontSize: 12, borderRadius: 7, background: simAction === "modify" ? P.acc : "transparent", color: simAction === "modify" ? "#fff" : sel ? P.sub : P.mut, opacity: sel ? 1 : 0.45 }}>
                        ✎ Modify
                    </button>
                    <button className="hb" onClick={() => sel && prepRemove()}
                        style={{ ...B, padding: "5px 12px", fontSize: 12, borderRadius: 7, background: simAction === "remove" ? P.HIGH_c : "transparent", color: simAction === "remove" ? "#fff" : sel ? P.sub : P.mut, opacity: sel ? 1 : 0.45 }}>
                        ✕ Remove
                    </button>
                    <button className="hb" onClick={openAdd}
                        style={{ ...B, padding: "5px 12px", fontSize: 12, borderRadius: 7, background: simAction === "add" ? P.LOW_c : "transparent", color: simAction === "add" ? "#fff" : P.sub }}>
                        ＋ Add
                    </button>
                </div>

                {/* Run Simulation */}
                {simAction === "remove" && simReady && !simDone && (
                    <button className="hb" onClick={runRemoveSim}
                        style={{ ...B, padding: "7px 18px", fontSize: 13, background: `linear-gradient(135deg,${P.acc},${P.accAlt})`, color: "#fff", boxShadow: `0 3px 16px ${P.glow}`, animation: "pulse 1.5s ease infinite" }}>
                        ▶ Run Simulation
                    </button>
                )}
                {simAction === "remove" && simDone && (
                    <button className="hb" onClick={confirmRemove}
                        style={{ ...B, padding: "6px 14px", fontSize: 12, background: P.HIGH_bg, border: `1.5px solid ${P.HIGH_c}`, color: P.HIGH_c }}>
                        ✕ Confirm Delete
                    </button>
                )}
                {simAction === "modify" && simDone && pendingModify && (
                    <button className="hb" onClick={confirmModify}
                        style={{ ...B, padding: "6px 14px", fontSize: 12, background: P.SEL_bg, border: `1.5px solid ${P.acc}`, color: P.acc }}>
                        ✓ Confirm Modify
                    </button>
                )}

                {/* Export & Undo & Clear */}
                <button className="hb" onClick={doExport}
                    style={{ ...B, padding: "6px 11px", fontSize: 12, background: P.inp, border: `1.5px solid ${P.bdr}`, color: P.sub }}>
                    ↓ Export
                </button>
                {history.length > 0 && (
                    <button className="hb" onClick={undoLast}
                        style={{ ...B, padding: "6px 11px", fontSize: 12, background: P.inp, border: `1.5px solid ${P.bdr}`, color: P.sub }}>
                        ↩ Undo
                    </button>
                )}
                {(simDone || sel) && (
                    <button className="hb" onClick={clearSim}
                        style={{ ...B, padding: "6px 11px", fontSize: 12, background: P.inp, border: `1.5px solid ${P.bdr}`, color: P.sub }}>
                        ✕ Clear
                    </button>
                )}

                <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                    {[[nodes.length, "Nodes", P.acc], [edges.length, "Edges", P.accAlt]].map(([v, l, c]) => (
                        <div key={l} style={{ background: P.inp, border: `1.5px solid ${P.bdr}`, borderRadius: 7, padding: "2px 10px", textAlign: "center" }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: c, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>{v}</div>
                            <div style={{ fontSize: 9, color: P.mut, fontFamily: "'JetBrains Mono',monospace" }}>{l}</div>
                        </div>
                    ))}
                    <button className="hb" onClick={() => { setStep(0); setNodes([]); setEdges([]); setHistory([]); clearSim(); setReqTxt(""); setDepMap({}); }} style={{ ...B, padding: "6px 10px", fontSize: 12, background: P.inp, border: `1.5px solid ${P.bdr}`, color: P.sub }}>← Restart</button>
                </div>
            </div>

            {/* ── BODY ──────────────────────────────────────────────────────────────── */}
            <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>

                {/* ══ LEFT PANEL ══════════════════════════════════════════════════════ */}
                <div style={{ width: 256, background: P.panel, borderRight: `1.5px solid ${P.bdr}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>

                    {/* ── METRICS block — always on top ─────────────────────────────── */}
                    <div style={{ flexShrink: 0, borderBottom: `1.5px solid ${P.bdr}`, padding: "10px 12px", background: P.card }}>
                        <div style={{ fontSize: 10, color: P.mut, letterSpacing: "0.12em", fontFamily: "'JetBrains Mono',monospace", marginBottom: 8, fontWeight: 700 }}>
                            METRICS{sel ? ` · ${sel}` : ""}
                        </div>
                        {sel && nmap[sel] ? (
                            <>
                                {/* 2×2 grid */}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 6 }}>
                                    {[
                                        ["In-Deg", IDeg[sel] || 0, P.HIGH_c],
                                        ["Out-Deg", ODeg[sel] || 0, P.MED_c],
                                        ["Betw.", BC[sel] || 0, P.acc],
                                        ["Close.", CC[sel] || 0, P.LOW_c],
                                    ].map(([l, v, c]) => (
                                        <div key={l} style={{ background: P.inp, border: `1px solid ${P.bdr}`, borderRadius: 7, padding: "7px 8px", textAlign: "center" }}>
                                            <div style={{ fontSize: 18, fontWeight: 800, color: c, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>{v}</div>
                                            <div style={{ fontSize: 10, color: P.mut, fontFamily: "'JetBrains Mono',monospace", marginTop: 2 }}>{l}</div>
                                        </div>
                                    ))}
                                </div>
                                {/* Score bar */}
                                <div style={{ background: P.inp, border: `1.5px solid ${P.acc}44`, borderRadius: 7, padding: "6px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: 11, color: P.mut, fontFamily: "'JetBrains Mono',monospace" }}>Score</span>
                                    <span style={{ fontSize: 22, fontWeight: 800, color: P.acc, fontFamily: "'JetBrains Mono',monospace" }}>{score(sel)}</span>
                                </div>
                                {/* Node label */}
                                <div style={{ marginTop: 6, fontSize: 12, color: P.sub, padding: "0 2px", fontStyle: "italic" }}>{nmap[sel].label}</div>
                            </>
                        ) : (
                            <div style={{ fontSize: 12, color: P.mut, padding: "4px 2px", fontFamily: "'JetBrains Mono',monospace" }}>
                                Select a node to see its metrics
                            </div>
                        )}
                    </div>

                    {/* ── Filter bar ────────────────────────────────────────────────── */}
                    <div style={{ flexShrink: 0, borderBottom: `1px solid ${P.bdr}`, padding: "7px 10px", display: "flex", gap: 4, alignItems: "center" }}>
                        <span style={{ fontSize: 10, color: P.mut, fontFamily: "'JetBrains Mono',monospace", marginRight: 2 }}>FILTER</span>
                        {["ALL", "HIGH", "MED", "LOW"].map(f => {
                            const active = sevFilter === f;
                            const fc = f === "HIGH" ? P.HIGH_c : f === "MED" ? P.MED_c : f === "LOW" ? P.LOW_c : P.acc;
                            const fbg = f === "HIGH" ? P.HIGH_bg : f === "MED" ? P.MED_bg : f === "LOW" ? P.LOW_bg : P.inp;
                            return (
                                <button key={f} onClick={() => setSevFilter(f)}
                                    style={{
                                        ...B, padding: "4px 9px", fontSize: 10, borderRadius: 5,
                                        background: active ? fbg : "transparent",
                                        border: `1.5px solid ${active ? fc : P.bdr}`,
                                        color: active ? fc : P.mut
                                    }}>
                                    {f}
                                </button>
                            );
                        })}
                    </div>

                    {/* ── Ranking list ──────────────────────────────────────────────── */}
                    <div style={{ padding: "6px 6px 4px", borderBottom: `1px solid ${P.bdr}`, flexShrink: 0 }}>
                        <div style={{ fontSize: 10, color: P.mut, letterSpacing: "0.14em", fontFamily: "'JetBrains Mono',monospace", padding: "0 4px" }}>
                            CRITICALITY RANKING {sevFilter !== "ALL" && `· ${sevFilter}`}
                        </div>
                    </div>
                    <div style={{ flex: 1, overflowY: "auto", padding: "6px 6px" }}>
                        {(sevFilter === "ALL" ? allSorted : filteredNodes).map((n, i) => {
                            const isImp = impacted[n.id] != null;
                            const sevLabel = isImp ? getSev(impacted[n.id], IDeg[n.id] || 0, ODeg[n.id] || 0) : null;
                            const nc = n.id === sel
                                ? { c: P.SEL_c, bg: P.SEL_bg }
                                : isImp ? sevColors(P, sevLabel) : { c: P.nStroke, bg: P.nBase };
                            return (
                                <div key={n.id} className="nr" onClick={() => { setSel(n.id); setImpacted({}); setSimDone(false); setSimReady(false); setSimAction(""); setWaves([]); }}
                                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 8, marginBottom: 2, background: sel === n.id ? P.hover : "transparent", border: `1px solid ${sel === n.id ? P.acc : isImp ? nc.c + "55" : "transparent"}` }}>
                                    <span style={{ fontSize: 10, color: P.mut, width: 16, flexShrink: 0, fontFamily: "'JetBrains Mono',monospace" }}>{i + 1}</span>
                                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: nc.c, flexShrink: 0, boxShadow: sel === n.id ? `0 0 8px ${nc.c}` : "none" }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: P.txt, fontFamily: "'JetBrains Mono',monospace" }}>{n.id}</div>
                                        <div style={{ fontSize: 11, color: P.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.label}</div>
                                    </div>
                                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: sel === n.id ? P.acc : P.sub, fontFamily: "'JetBrains Mono',monospace" }}>{score(n.id)}</div>
                                        {isImp && sevLabel && <SevBadge sev={sevLabel} P={P} />}
                                    </div>
                                </div>
                            );
                        })}
                        {sevFilter !== "ALL" && filteredNodes.length === 0 && (
                            <div style={{ textAlign: "center", padding: "24px 10px", color: P.mut, fontSize: 12 }}>
                                {simDone ? "No nodes with this severity" : "Run a simulation first"}
                            </div>
                        )}
                    </div>
                </div>

                {/* ══ CENTER: Graph (Cytoscape) ════════════════════════════════════════ */}
                <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                    {/* Subtle dot-grid background */}
                    <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(circle, ${P.bdr} 1px, transparent 1px)`, backgroundSize: "28px 28px", opacity: 0.5, pointerEvents: "none" }} />
                    {/* Cytoscape container */}
                    <div ref={cyContainerRef} style={{ width: "100%", height: "100%", position: "relative" }} />
                    {/* Legend */}
                    <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", background: P.card, border: `1.5px solid ${P.bdr}`, borderRadius: 10, padding: "8px 16px", display: "flex", gap: 14, alignItems: "center", boxShadow: P.shadow, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, whiteSpace: "nowrap", zIndex: 10 }}>
                        {[['var(--accent-primary)', 'Selected'], ['var(--error-text)', 'High'], ['var(--warning-text)', 'Medium'], ['var(--success-text)', 'Low']].map(([c, l]) => (
                            <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
                                <span style={{ color: P.sub }}>{l}</span>
                            </div>
                        ))}
                        <span style={{ color: P.mut }}>· scroll=zoom · drag=pan</span>
                    </div>
                    {/* Remove banner */}
                    {simReady && !simDone && simAction === "remove" && (
                        <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", background: P.HIGH_bg, border: `1.5px solid ${P.HIGH_c}`, borderRadius: 10, padding: "10px 22px", display: "flex", alignItems: "center", gap: 12, boxShadow: P.shadow, animation: "fin 0.2s ease", zIndex: 10 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: P.HIGH_c, fontFamily: "'JetBrains Mono',monospace" }}>Staged: removing <b>{sel}</b></span>
                            <button className="hb" onClick={runRemoveSim} style={{ ...B, padding: "8px 20px", fontSize: 14, background: P.HIGH_c, color: "#fff" }}>▶ Run Simulation</button>
                        </div>
                    )}
                </div>

                {/* ══ RIGHT PANEL ══════════════════════════════════════════════════════ */}
                <div style={{ width: 300, background: P.panel, borderLeft: `1.5px solid ${P.bdr}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    {/* Panel header */}
                    <div style={{ background: P.card, borderBottom: `1.5px solid ${P.bdr}`, padding: "13px 16px", flexShrink: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: P.acc, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.06em" }}>▶ SIMULATION</span>
                    </div>
                    <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                        {!sel && !simDone && (
                            <div style={{ textAlign: "center", padding: "32px 10px", color: P.mut }}>
                                <div style={{ fontSize: 36, opacity: 0.18, marginBottom: 12 }}>⬡</div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: P.sub, marginBottom: 8 }}>No simulation running</div>
                                <div style={{ fontSize: 13, color: P.mut, lineHeight: 1.9 }}>
                                    1. Click a node or use <b style={{ color: P.acc }}>TARGET</b><br />
                                    2. Choose <b style={{ color: P.acc }}>✎</b> <b style={{ color: P.HIGH_c }}>✕</b> <b style={{ color: P.LOW_c }}>＋</b> action<br />
                                    3. Click <b style={{ color: P.acc }}>▶ Run Simulation</b>
                                </div>
                            </div>
                        )}
                        {sel && !simDone && !simReady && (
                            <div style={{ background: P.inp, border: `1.5px solid ${P.bdr}`, borderRadius: 10, padding: 14, textAlign: "center" }}>
                                <div style={{ fontSize: 15, fontWeight: 700, color: P.acc, fontFamily: "'JetBrains Mono',monospace", marginBottom: 8 }}>{sel} selected</div>
                                <div style={{ fontSize: 13, color: P.sub, lineHeight: 2 }}>
                                    <b style={{ color: P.acc }}>✎ Modify</b> → dialog to update &amp; see impact<br />
                                    <b style={{ color: P.HIGH_c }}>✕ Remove</b> → stage for simulation<br />
                                    <b style={{ color: P.LOW_c }}>＋ Add</b> → add a new requirement
                                </div>
                            </div>
                        )}
                        {sel && simReady && !simDone && simAction === "remove" && (
                            <div style={{ background: P.HIGH_bg, border: `1.5px solid ${P.HIGH_b}`, borderRadius: 10, padding: 14, textAlign: "center", animation: "fin 0.2s ease" }}>
                                <div style={{ fontSize: 13, color: P.HIGH_c, lineHeight: 1.8, marginBottom: 12 }}>
                                    Staged: removing <b style={{ fontFamily: "'JetBrains Mono',monospace" }}>{sel}</b><br />
                                    <span style={{ fontSize: 12, color: P.sub }}>Click ▶ Run Simulation to trace all impacted requirements.</span>
                                </div>
                                <button className="hb" onClick={runRemoveSim} style={{ ...B, padding: "10px 28px", fontSize: 14, background: P.HIGH_c, color: "#fff" }}>▶ Run Simulation</button>
                            </div>
                        )}
                        {simDone && (
                            <div style={{ animation: "pop 0.22s ease" }}>
                                {/* Summary */}
                                <div style={{ background: P.card, border: `1.5px solid ${P.acc}44`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
                                    <div style={{ fontSize: 10, color: P.mut, fontFamily: "'JetBrains Mono',monospace", marginBottom: 8, letterSpacing: "0.1em" }}>SIMULATION RESULT</div>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                        <div>
                                            <span style={{ fontSize: 22, fontWeight: 800, color: P.acc, fontFamily: "'JetBrains Mono',monospace" }}>{sel}</span>
                                            &nbsp;
                                            <span style={{
                                                fontSize: 11, fontWeight: 700, letterSpacing: "0.07em",
                                                color: simAction === "remove" ? P.HIGH_c : simAction === "modify" ? P.SEL_c : P.LOW_c,
                                                background: simAction === "remove" ? P.HIGH_bg : simAction === "modify" ? P.SEL_bg : P.LOW_bg,
                                                border: `1.5px solid ${simAction === "remove" ? P.HIGH_b : simAction === "modify" ? P.SEL_b : P.LOW_b}`,
                                                borderRadius: 5, padding: "2px 8px", fontFamily: "'JetBrains Mono',monospace"
                                            }}>
                                                {simAction.toUpperCase()}
                                            </span>
                                        </div>
                                        <div style={{ textAlign: "right" }}>
                                            <div style={{ fontSize: 26, fontWeight: 800, color: P.txt, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>{Object.keys(impacted).length}</div>
                                            <div style={{ fontSize: 10, color: P.mut, fontFamily: "'JetBrains Mono',monospace" }}>affected</div>
                                        </div>
                                    </div>
                                    {Object.keys(impacted).length > 0 && (
                                        <div style={{ display: "flex", gap: 6 }}>
                                            {[[P.HIGH_c, P.HIGH_bg, P.HIGH_b, cntH, "HIGH"], [P.MED_c, P.MED_bg, P.MED_b, cntM, "MED"], [P.LOW_c, P.LOW_bg, P.LOW_b, cntL, "LOW"]].map(([c, bg, b, cnt, lbl]) => (
                                                <div key={lbl} style={{ flex: 1, background: bg, border: `1px solid ${b}`, borderRadius: 6, padding: "6px 0", textAlign: "center" }}>
                                                    <div style={{ fontSize: 18, fontWeight: 800, color: c, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>{cnt}</div>
                                                    <div style={{ fontSize: 9, color: c, fontFamily: "'JetBrains Mono',monospace", opacity: 0.85 }}>{lbl}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {/* Propagation waves */}
                                {waves.length > 0 && (
                                    <div style={{ background: P.inp, border: `1.5px solid ${P.bdr}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                                        <div style={{ fontSize: 10, color: P.mut, letterSpacing: "0.12em", fontFamily: "'JetBrains Mono',monospace", marginBottom: 10, fontWeight: 700 }}>PROPAGATION WAVES</div>
                                        {waves.map((wave, wi) => (
                                            <div key={wi} style={{ marginBottom: 8 }}>
                                                <div style={{ fontSize: 11, color: P.acc, fontFamily: "'JetBrains Mono',monospace", marginBottom: 5, fontWeight: 700 }}>Hop {wi + 1} — {wave.length} node(s)</div>
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                                    {wave.map(id => {
                                                        const sv = getSev(impacted[id] || 1, IDeg[id] || 0, ODeg[id] || 0);
                                                        const c = sv === "HIGH" ? P.HIGH_c : sv === "MED" ? P.MED_c : P.LOW_c;
                                                        const bg = sv === "HIGH" ? P.HIGH_bg : sv === "MED" ? P.MED_bg : P.LOW_bg;
                                                        const b = sv === "HIGH" ? P.HIGH_b : sv === "MED" ? P.MED_b : P.LOW_b;
                                                        return (
                                                            <div key={id} style={{ background: bg, border: `1.5px solid ${b}`, borderRadius: 7, padding: "4px 10px" }}>
                                                                <span style={{ fontSize: 12, fontWeight: 800, color: c, fontFamily: "'JetBrains Mono',monospace" }}>{id}</span>
                                                                <div style={{ fontSize: 9, color: P.sub }}>{nmap[id]?.label?.slice(0, 12)}{(nmap[id]?.label?.length || 0) > 12 ? "…" : ""}</div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {/* No impact */}
                                {Object.keys(impacted).length === 0 && (
                                    <div style={{ background: P.LOW_bg, border: `1.5px solid ${P.LOW_b}`, borderRadius: 10, padding: 16, textAlign: "center" }}>
                                        <div style={{ fontSize: 22, marginBottom: 6 }}>✓</div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: P.LOW_c }}>No Impact Detected</div>
                                        <div style={{ fontSize: 12, color: P.sub, marginTop: 4 }}>This change is fully isolated</div>
                                    </div>
                                )}
                                {/* Per-node cards */}
                                {impList.length > 0 && (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        {impList.map(([id, depth]) => {
                                            const sv = getSev(depth, IDeg[id] || 0, ODeg[id] || 0);
                                            const c = sv === "HIGH" ? P.HIGH_c : sv === "MED" ? P.MED_c : P.LOW_c;
                                            const bg = sv === "HIGH" ? P.HIGH_bg : sv === "MED" ? P.MED_bg : P.LOW_bg;
                                            const b = sv === "HIGH" ? P.HIGH_b : sv === "MED" ? P.MED_b : P.LOW_b;
                                            return (
                                                <div key={id} style={{ background: bg, border: `1.5px solid ${b}`, borderLeft: `4px solid ${c}`, borderRadius: 9, padding: "10px 12px", animation: "fin 0.2s ease", boxShadow: `0 2px 10px ${b}` }}>
                                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                                        <span style={{ fontSize: 16, fontWeight: 800, color: c, fontFamily: "'JetBrains Mono',monospace" }}>{id}</span>
                                                        <SevBadge sev={sv} P={P} />
                                                    </div>
                                                    <div style={{ fontSize: 12, color: P.sub, marginBottom: 8 }}>{nmap[id]?.label}</div>
                                                    <div style={{ display: "flex", borderTop: `1px solid ${b}`, paddingTop: 7 }}>
                                                        {[["HOPS", depth], ["IN-DEG", IDeg[id] || 0], ["OUT-DEG", ODeg[id] || 0], ["BC", BC[id] || 0]].map(([l, v], idx) => (
                                                            <div key={l} style={{ flex: 1, textAlign: "center", borderRight: idx < 3 ? `1px solid ${b}` : "none" }}>
                                                                <div style={{ fontSize: 15, fontWeight: 800, color: P.txt, fontFamily: "'JetBrains Mono',monospace" }}>{v}</div>
                                                                <div style={{ fontSize: 9, color: P.mut, fontFamily: "'JetBrains Mono',monospace" }}>{l}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: c, marginTop: 7, fontWeight: 600 }}>
                                                        {sv === "HIGH" && `⚠ Full regression test required${(IDeg[id] || 0) >= 2 ? " · high in-degree" : ""} ${(ODeg[id] || 0) >= 2 ? " · high out-degree" : ""}`}
                                                        {sv === "MED" && "↻ Review integration points"}
                                                        {sv === "LOW" && "✓ Spot-check sufficient"}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div >
    );
}