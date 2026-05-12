import { useState, useEffect, useRef, useCallback } from "react";

const _f = document.createElement("link");
_f.rel = "stylesheet";
_f.href = "https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap";
document.head.appendChild(_f);

// ── Palettes ──────────────────────────────────────────────────────────────────
const PALETTE = {
    dark: {
        bg: "#060a12", card: "#0c1220", panel: "#080e1a", inp: "#050810",
        hover: "#0f1c30", bdr: "#182840", txt: "#dde8f8", sub: "#6a8aaa", mut: "#2a3f58",
        acc: "#3b82f6", accAlt: "#7c3aed", glow: "rgba(59,130,246,0.22)",
        nBase: "#0f1e30", nStroke: "#1e3a5a", edgeC: "#1a3050",
        grid: "#0a1520", shadow: "0 4px 24px rgba(0,0,0,0.7)",
        HIGH_c: "#ff4d7a", HIGH_bg: "#1a0412", HIGH_b: "#ff4d7a40",
        MED_c: "#fbbf24", MED_bg: "#1a1200", MED_b: "#fbbf2440",
        LOW_c: "#10d98a", LOW_bg: "#001810", LOW_b: "#10d98a40",
        SEL_c: "#3b82f6", SEL_bg: "#050f20", SEL_b: "#3b82f640",
    },
    light: {
        bg: "#eef3fc", card: "#ffffff", panel: "#f5f8ff", inp: "#e8eef8",
        hover: "#dde8f8", bdr: "#c0d4ee", txt: "#0a1628", sub: "#3a5070", mut: "#90aac8",
        acc: "#2563eb", accAlt: "#7c3aed", glow: "rgba(37,99,235,0.15)",
        nBase: "#dde8f8", nStroke: "#7aaad8", edgeC: "#a8c4e0",
        grid: "#dde8f5", shadow: "0 4px 24px rgba(37,99,235,0.08)",
        HIGH_c: "#dc2626", HIGH_bg: "#fff0f0", HIGH_b: "#dc262640",
        MED_c: "#d97706", MED_bg: "#fffbeb", MED_b: "#d9770640",
        LOW_c: "#059669", LOW_bg: "#f0fdf9", LOW_b: "#05966940",
        SEL_c: "#2563eb", SEL_bg: "#eff6ff", SEL_b: "#2563eb40",
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

function autoLayout(nodes) {
    const cx = 430, cy = 280, r = Math.min(230, 80 + nodes.length * 20);
    return nodes.map((n, i) => {
        const a = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
        return { ...n, x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    });
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
export default function App() {
    const [theme, setTheme] = useState("dark");
    const P = PALETTE[theme];

    // wizard
    const [step, setStep] = useState(0);
    const [reqTxt, setReqTxt] = useState("");
    const [depTxt, setDepTxt] = useState("");
    const [wizErr, setWizErr] = useState("");

    // graph
    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [history, setHistory] = useState([]);

    // simulation
    const [sel, setSel] = useState(null);
    const [simReady, setSimReady] = useState(false);
    const [simDone, setSimDone] = useState(false);
    const [simAction, setSimAction] = useState("");
    const [impacted, setImpacted] = useState({});
    const [waves, setWaves] = useState([]);
    const [activeWave, setActiveWave] = useState(-1);

    // compare mode
    const [compareSnap, setCompareSnap] = useState(null);
    const [compareMode, setCompareMode] = useState(false);
    const [pendingModify, setPendingModify] = useState(null);

    // filter
    const [sevFilter, setSevFilter] = useState("ALL"); // "ALL"|"HIGH"|"MED"|"LOW"

    // modals
    const [modal, setModal] = useState(null);
    const [mStep, setMStep] = useState(1);
    const [mLabel, setMLabel] = useState("");
    const [mDeps, setMDeps] = useState("");
    const [aStep, setAStep] = useState(1);
    const [aId, setAId] = useState("");
    const [aLabel, setALabel] = useState("");
    const [aDeps, setADeps] = useState("");


    const [dragId, setDragId] = useState(null);
    const svgRef = useRef(null);

    // ── Adjacency Matrix & all metrics ────────────────────────────────────────
    const M = buildAdjMatrix(nodes, edges);
    const IDeg = matrixInDeg(M);
    const ODeg = matrixOutDeg(M);
    const BC = matrixBetweenness(M);
    const CC = matrixCloseness(M);
    const score = id => +((IDeg[id] || 0) * 0.4 + (BC[id] || 0) * 10 * 0.3 + (CC[id] || 0) * 0.3).toFixed(2);
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

    // drag
    const onMouseDown = useCallback((e, id) => { e.preventDefault(); e.stopPropagation(); setDragId(id); }, []);
    useEffect(() => {
        const mv = e => { if (!dragId || !svgRef.current) return; const r = svgRef.current.getBoundingClientRect(); setNodes(p => p.map(n => n.id === dragId ? { ...n, x: e.clientX - r.left, y: e.clientY - r.top } : n)); };
        const up = () => setDragId(null);
        window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
        return () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
    }, [dragId]);

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
        setDepTxt(parsed.map(p => `${p.id} -> `).join("\n"));
        setNodes(autoLayout(parsed)); setStep(1);
    }
    function wizStep1() {
        setWizErr("");
        const nodeIds = nodes.map(n => n.id);
        const lines = depTxt.split("\n").map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
            if (!line.includes("->") && !line.includes(":")) { setWizErr(`Invalid format: "${line}"\nUse  R1 -> R2, R3`); return; }
            const sep = line.includes("->") ? "->" : ":";
            const parts = line.split(sep);
            if (parts.length < 2) continue;
            const from = parts[0].trim().toUpperCase();
            if (!nodeIds.includes(from)) { setWizErr(`Unknown node "${from}" — only defined requirement IDs can be used.`); return; }
            const targets = parts[1].split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
            for (const to of targets) {
                if (to && !nodeIds.includes(to)) { setWizErr(`Unknown node "${to}" in dependency for ${from} — check your requirement IDs.`); return; }
                if (to === from) { setWizErr(`Self-dependency: "${from} -> ${from}" is not allowed.`); return; }
            }
        }
        setEdges(parseDepLines(depTxt, nodeIds)); setStep(2);
    }

    function pushHistory() { setHistory(h => [...h, { nodes: [...nodes], edges: [...edges] }]); }
    function clearSim() { setSel(null); setImpacted({}); setSimDone(false); setSimReady(false); setSimAction(""); setWaves([]); setActiveWave(-1); setCompareMode(false); setPendingModify(null); }

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
        // Store snap with after-metrics embedded so compare modal can diff them
        setCompareSnap({ ...beforeSnap, afterIDeg: aIDeg, afterODeg: aODeg, afterBC: aBC, afterScoreMap: Object.fromEntries(newNodes.map(n => [n.id, aScore(n.id)])) });
        pushHistory();
        setNodes(newNodes); setEdges(newEdges);
        clearSim();
    }

    // ── MODIFY
    const [modErr, setModErr] = useState("");
    function openModify() {
        if (!sel) return;
        setMStep(1); setMLabel(nmap[sel]?.label || ""); setModErr("");
        setMDeps(edges.filter(e => e.from === sel).map(e => `${sel} -> ${e.to}`).join("\n") || `${sel} -> `);
        setModal("modify"); setSimAction("modify"); setSimReady(true);
    }
    function runModifySim() {
        setModErr("");
        if (!mLabel.trim()) { setModErr("Label cannot be empty."); return; }
        if (mLabel.trim().length < 2) { setModErr("Label must be at least 2 characters."); return; }
        const nodeIds = nodes.map(n => n.id);
        const depLines = mDeps.split("\n").map(l => l.trim()).filter(l => l && !l.endsWith("->") && !l.endsWith(":"));
        for (const line of depLines) {
            if (!line.includes("->") && !line.includes(":")) { setModErr(`Invalid format: "${line}" — use  ${sel} -> R1, R2`); return; }
            const sep = line.includes("->") ? "->" : ":";
            const parts = line.split(sep); if (parts.length < 2) continue;
            const from = parts[0].trim().toUpperCase();
            if (from !== sel) { setModErr(`From-node must be "${sel}", got "${from}".`); return; }
            const targets = parts[1].split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
            for (const to of targets) {
                if (to && !nodeIds.includes(to)) { setModErr(`Unknown node "${to}" — only existing requirement IDs can be used.`); return; }
                if (to === sel) { setModErr(`Self-dependency: "${sel} -> ${sel}" is not allowed.`); return; }
            }
        }
        const newNodes = nodes.map(n => n.id === sel ? { ...n, label: mLabel.trim() } : n);
        const newEdges = [...edges.filter(e => e.from !== sel), ...parseDepLines(mDeps, newNodes.map(n => n.id))];
        const newM = buildAdjMatrix(newNodes, newEdges);
        const { impacted: imp, waves: ws } = matrixImpact(newM, sel);
        setCompareSnap({ nodes: [...nodes], edges: [...edges], IDeg: { ...IDeg }, ODeg: { ...ODeg }, BC: { ...BC }, CC: { ...CC }, scoreMap: Object.fromEntries(nodes.map(n => [n.id, score(n.id)])) });
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
    function openAdd() { setAStep(1); setAId(""); setALabel(""); setADeps(""); setAddErr(""); setModal("add"); setSimAction("add"); }
    function addProceedToDeps() {
        setAddErr("");
        const id = aId.trim().toUpperCase();
        if (!id) { setAddErr("Requirement ID is required."); return; }
        if (!/^[A-Z0-9_-]+$/.test(id)) { setAddErr("ID must contain only letters, numbers, _ or -."); return; }
        if (id.length > 8) { setAddErr("ID must be 8 characters or fewer."); return; }
        if (!aLabel.trim()) { setAddErr("Label is required."); return; }
        if (aLabel.trim().length < 2) { setAddErr("Label must be at least 2 characters."); return; }
        if (nodes.find(n => n.id === id)) { setAddErr(`ID "${id}" already exists. Choose a different ID.`); return; }
        setAId(id); setADeps(`${id} -> `); setAStep(2);
    }
    function runAddSim() {
        setAddErr("");
        const id = aId.trim().toUpperCase();
        const nodeIds = [...nodes.map(n => n.id), id];
        const depLines = aDeps.split("\n").map(l => l.trim()).filter(Boolean);
        for (const line of depLines) {
            if (!line.includes("->") && !line.includes(":")) { setAddErr(`Invalid format: "${line}" — use  ${id} -> R1, R2`); return; }
            const sep = line.includes("->") ? "->" : ":";
            const parts = line.split(sep); if (parts.length < 2) continue;
            const from = parts[0].trim().toUpperCase();
            if (from !== id) { setAddErr(`From-node must be "${id}", got "${from}".`); return; }
            const targets = parts[1].split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
            for (const to of targets) {
                if (to && !nodeIds.includes(to)) { setAddErr(`Unknown node "${to}" — only existing requirement IDs can be used.`); return; }
                if (to === id) { setAddErr(`Self-dependency: "${id} -> ${id}" is not allowed.`); return; }
            }
        }
        const newNode = { id, label: aLabel.trim(), x: 430 + (Math.random() - 0.5) * 200, y: 280 + (Math.random() - 0.5) * 200 };
        const newNodes = [...nodes, newNode];
        const newEdges = [...edges, ...parseDepLines(aDeps, newNodes.map(n => n.id))];
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

    // SVG helpers
    function getEdgePath(e) {
        const s = nmap[e.from], t = nmap[e.to]; if (!s || !t) return "";
        const dx = t.x - s.x, dy = t.y - s.y, len = Math.sqrt(dx * dx + dy * dy) || 1, R = 33;
        return `M${s.x + (dx / len) * R},${s.y + (dy / len) * R} L${t.x - (dx / len) * (R + 9)},${t.y - (dy / len) * (R + 9)}`;
    }
    function getEdgeStroke(e) {
        if (e.from === sel || e.to === sel) return P.acc;
        const fi = impacted[e.from] != null, ti = impacted[e.to] != null;
        if (!fi && !ti) return P.edgeC;
        const id = fi ? e.from : e.to;
        const depth = fi ? impacted[e.from] : impacted[e.to];
        const sv = getSev(depth, IDeg[id] || 0, ODeg[id] || 0);
        return sv === "HIGH" ? P.HIGH_c : sv === "MED" ? P.MED_c : P.LOW_c;
    }
    function getEdgeMarker(e) {
        if (e.from === sel || e.to === sel) return "url(#m_sel)";
        const fi = impacted[e.from] != null, ti = impacted[e.to] != null;
        if (!fi && !ti) return "url(#m_def)";
        const id = fi ? e.from : e.to;
        const depth = fi ? impacted[e.from] : impacted[e.to];
        const sv = getSev(depth, IDeg[id] || 0, ODeg[id] || 0);
        return sv === "HIGH" ? "url(#m_high)" : sv === "MED" ? "url(#m_med)" : "url(#m_low)";
    }
    function getNodeColors(id) {
        if (id === sel) return { c: P.SEL_c, bg: P.SEL_bg, b: P.SEL_b };
        if (impacted[id] != null) return sevColors(P, getSev(impacted[id], IDeg[id] || 0, ODeg[id] || 0));
        return { c: P.nStroke, bg: P.nBase, b: P.nStroke + "60" };
    }

    const B = { fontFamily: "'JetBrains Mono',monospace", cursor: "pointer", border: "none", borderRadius: 8, fontWeight: 700, letterSpacing: "0.05em", transition: "all 0.15s" };
    const INP = { background: P.inp, border: `1.5px solid ${P.bdr}`, borderRadius: 8, color: P.txt, fontFamily: "'JetBrains Mono',monospace", fontSize: 14, padding: "10px 12px", width: "100%", boxSizing: "border-box", outline: "none" };

    // ════════════════════════════════════════════════════════════════════════════
    // WIZARD
    // ════════════════════════════════════════════════════════════════════════════
    if (step < 2) return (
        <div style={{ minHeight: "100vh", background: P.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Syne',sans-serif", padding: 24, transition: "background 0.2s" }}>
            <style>{`
        @keyframes mfin{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}
        @keyframes fin{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        input:focus,textarea:focus,select:focus{outline:none!important;border-color:${P.acc}!important;box-shadow:0 0 0 3px ${P.glow}!important;}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:${P.bdr};border-radius:2px}
      `}</style>
            <button onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} style={{ ...B, position: "fixed", top: 18, right: 18, background: P.card, border: `1.5px solid ${P.bdr}`, color: P.txt, padding: "9px 18px", fontSize: 14 }}>{theme === "dark" ? "☀ Light" : "◑ Dark"}</button>
            <div style={{ textAlign: "center", marginBottom: 36 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
                    <div style={{ width: 50, height: 50, borderRadius: 14, background: `linear-gradient(135deg,${P.acc},${P.accAlt})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: `0 0 30px ${P.glow}` }}>⬡</div>
                    <div>
                        <div style={{ fontSize: 36, fontWeight: 800, color: P.txt, letterSpacing: "-0.02em", lineHeight: 1 }}>REQIFY</div>
                        <div style={{ fontSize: 11, color: P.mut, letterSpacing: "0.2em", fontFamily: "'JetBrains Mono',monospace" }}>CHANGE IMPACT ANALYZER</div>
                    </div>
                </div>
                <div style={{ fontSize: 14, color: P.sub }}>SE-4011 · Software Measurement &amp; Metrics</div>
            </div>
            <Stepper steps={["Requirements", "Dependencies", "Analyze"]} current={step} P={P} />
            <div style={{ background: P.card, border: `1.5px solid ${P.bdr}`, borderRadius: 18, padding: 32, width: "100%", maxWidth: 600, boxShadow: P.shadow }}>
                {step === 0 && <>
                    <div style={{ fontSize: 20, fontWeight: 800, color: P.txt, marginBottom: 6 }}>Define Requirements</div>
                    <div style={{ fontSize: 14, color: P.sub, marginBottom: 18, lineHeight: 1.8 }}>
                        One per line:&nbsp;
                        <code style={{ color: P.acc, background: P.inp, padding: "1px 6px", borderRadius: 4, fontSize: 13 }}>R1: Login</code>&nbsp;
                        <code style={{ color: P.acc, background: P.inp, padding: "1px 6px", borderRadius: 4, fontSize: 13 }}>R1 Login</code>
                    </div>
                    <textarea value={reqTxt} onChange={e => setReqTxt(e.target.value)} placeholder={"R1: User Registration\nR2: User Login\nR3: Validate Credentials"} style={{ ...INP, height: 200, resize: "vertical", lineHeight: 1.9 }} />
                    {wizErr && <div style={{ color: P.HIGH_c, fontSize: 13, marginTop: 8, fontFamily: "'JetBrains Mono',monospace" }}>⚠ {wizErr}</div>}
                    <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                        <button onClick={() => setReqTxt("R1: User Registration\nR2: User Login\nR3: Validate Credentials\nR4: Manage Session Token\nR5: View Dashboard\nR6: Fetch User Profile\nR7: Update Profile\nR8: Process Payment\nR9: Send Confirmation Email\nR10: Generate Invoice")} style={{ ...B, padding: "11px 16px", fontSize: 13, background: P.inp, border: `1.5px solid ${P.bdr}`, color: P.sub }}>Load Example</button>
                        <button onClick={wizStep0} style={{ ...B, flex: 1, padding: "12px 0", fontSize: 15, background: `linear-gradient(135deg,${P.acc},${P.accAlt})`, color: "#fff", boxShadow: `0 4px 18px ${P.glow}` }}>Next → Map Dependencies</button>
                    </div>
                </>}
                {step === 1 && <>
                    <div style={{ fontSize: 20, fontWeight: 800, color: P.txt, marginBottom: 6 }}>Map Dependencies</div>
                    <div style={{ fontSize: 14, color: P.sub, marginBottom: 14, lineHeight: 1.8 }}>
                        <code style={{ color: P.acc, background: P.inp, padding: "1px 6px", borderRadius: 4, fontSize: 13 }}>FROM → TO1, TO2</code>&nbsp;(A→B = "A depends on B")
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                        {nodes.map(n => <span key={n.id} style={{ fontSize: 12, background: P.inp, border: `1.5px solid ${P.bdr}`, borderRadius: 6, padding: "3px 10px", color: P.sub, fontFamily: "'JetBrains Mono',monospace" }}><b style={{ color: P.acc }}>{n.id}</b> {n.label}</span>)}
                    </div>
                    <textarea value={depTxt} onChange={e => setDepTxt(e.target.value)} style={{ ...INP, height: 220, resize: "vertical", lineHeight: 1.9 }} />
                    {wizErr && <div style={{ color: P.HIGH_c, fontSize: 13, marginTop: 8, fontFamily: "'JetBrains Mono',monospace" }}>⚠ {wizErr}</div>}
                    <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                        <button onClick={() => { setStep(0); setWizErr(""); }} style={{ ...B, padding: "11px 16px", fontSize: 13, background: P.inp, border: `1.5px solid ${P.bdr}`, color: P.sub }}>← Back</button>
                        <button onClick={wizStep1} style={{ ...B, flex: 1, padding: "12px 0", fontSize: 15, background: `linear-gradient(135deg,${P.acc},${P.accAlt})`, color: "#fff", boxShadow: `0 4px 18px ${P.glow}` }}>Build Graph &amp; Analyze →</button>
                    </div>
                </>}
            </div>
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
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
                            {nodes.filter(n => n.id !== sel).map(n => <span key={n.id} style={{ fontSize: 11, background: P.inp, border: `1px solid ${P.bdr}`, borderRadius: 5, padding: "2px 8px", color: P.sub, fontFamily: "'JetBrains Mono',monospace" }}><b style={{ color: P.acc }}>{n.id}</b> {n.label}</span>)}
                        </div>
                        <div style={{ fontSize: 11, color: P.mut, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>Format: <code style={{ color: P.acc, background: P.inp, padding: "1px 5px", borderRadius: 3 }}>{sel} -&gt; R1, R2</code> &nbsp;·&nbsp; leave empty if no dependencies</div>
                        <textarea value={mDeps} onChange={e => { setMDeps(e.target.value); setModErr(""); }} style={{ background: P.inp, border: `1.5px solid ${modErr ? P.HIGH_c : P.bdr}`, borderRadius: 8, color: P.txt, fontSize: 14, padding: "10px 12px", width: "100%", boxSizing: "border-box", height: 100, resize: "none", lineHeight: 1.8 }} />
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
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                            {nodes.map(n => <span key={n.id} style={{ fontSize: 11, background: P.inp, border: `1px solid ${P.bdr}`, borderRadius: 5, padding: "2px 8px", color: P.sub, fontFamily: "'JetBrains Mono',monospace" }}><b style={{ color: P.acc }}>{n.id}</b> {n.label}</span>)}
                        </div>
                        <div style={{ fontSize: 11, color: P.mut, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>Format: <code style={{ color: P.acc, background: P.inp, padding: "1px 5px", borderRadius: 3 }}>{aId} -&gt; R1, R2</code> &nbsp;·&nbsp; leave empty if no dependencies</div>
                        <textarea value={aDeps} onChange={e => { setADeps(e.target.value); setAddErr(""); }} placeholder={`${aId} -> R1, R3`} style={{ background: P.inp, border: `1.5px solid ${addErr ? P.HIGH_c : P.bdr}`, borderRadius: 8, color: P.txt, fontSize: 14, padding: "10px 12px", width: "100%", boxSizing: "border-box", height: 100, resize: "none", lineHeight: 1.8 }} />
                        {addErr && <div style={{ color: P.HIGH_c, fontSize: 12, marginTop: 8, fontFamily: "'JetBrains Mono',monospace", background: P.HIGH_bg, border: `1px solid ${P.HIGH_b}`, borderRadius: 6, padding: "7px 10px" }}>⚠ {addErr}</div>}
                        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                            <button onClick={() => { setAStep(1); setAddErr(""); }} style={{ ...B, padding: "11px 16px", fontSize: 13, background: P.inp, border: `1.5px solid ${P.bdr}`, color: P.sub }}>← Back</button>
                            <button onClick={runAddSim} style={{ ...B, flex: 1, padding: "12px 0", fontSize: 14, background: `linear-gradient(135deg,${P.LOW_c},${P.acc})`, color: "#fff" }}>＋ Add &amp; Update Graph</button>
                        </div>
                    </>}
                </Modal>
            )}

            {/* COMPARE MODAL */}
            {modal === "compare" && compareSnap && (
                <Modal title="⊞  Before vs After" P={P} onClose={() => setModal(null)} wide>
                    <div style={{ fontSize: 13, color: P.sub, marginBottom: 16 }}>
                        Showing metric changes after <b style={{ color: P.acc }}>{simAction}</b> on <b style={{ color: P.acc }}>{sel}</b>.
                        Only nodes whose scores or connectivity changed are listed.
                    </div>
                    {(() => {
                        // Use pre-computed after-metrics if embedded (Remove case), else use live state (Modify/Add)
                        const afterIDeg = compareSnap.afterIDeg || IDeg;
                        const afterODeg = compareSnap.afterODeg || ODeg;
                        const afterBC = compareSnap.afterBC || BC;
                        const afterSMap = compareSnap.afterScoreMap || Object.fromEntries(nodes.map(n => [n.id, score(n.id)]));
                        const beforeIds = compareSnap.nodes.map(n => n.id);
                        const afterIds = compareSnap.afterScoreMap ? Object.keys(compareSnap.afterScoreMap) : nodes.map(n => n.id);
                        const allIds = [...new Set([...beforeIds, ...afterIds])];
                        const rows = allIds.map(id => {
                            const bNode = compareSnap.nodes.find(n => n.id === id);
                            const aNode = afterIds.includes(id);
                            const bScore = compareSnap.scoreMap[id] ?? 0;
                            const aScore = afterSMap[id] ?? 0;
                            const delta = +(aScore - bScore).toFixed(2);
                            const bIDeg = compareSnap.IDeg[id] ?? 0;
                            const aIDeg = afterIDeg[id] ?? 0;
                            const bODeg = compareSnap.ODeg[id] ?? 0;
                            const aODeg = afterODeg[id] ?? 0;
                            const bBC = compareSnap.BC[id] ?? 0;
                            const aBC = afterBC[id] ?? 0;
                            const status = !bNode ? "ADDED" : !aNode ? "REMOVED" : Math.abs(delta) > 0.001 || bIDeg !== aIDeg || bODeg !== aODeg ? "CHANGED" : "SAME";
                            return { id, bNode, aNode, bScore, aScore, delta, bIDeg, aIDeg, bODeg, aODeg, bBC, aBC, status };
                        }).filter(r => r.status !== "SAME");

                        if (rows.length === 0) return (
                            <div style={{ textAlign: "center", padding: "28px", color: P.sub, background: P.inp, borderRadius: 10, border: `1px solid ${P.bdr}` }}>
                                <div style={{ fontSize: 22, marginBottom: 8 }}>✓</div>
                                <div style={{ fontWeight: 700, color: P.LOW_c }}>No metric changes detected</div>
                                <div style={{ fontSize: 12, marginTop: 4, color: P.mut }}>All centrality scores are identical before and after this change.</div>
                            </div>
                        );

                        return (
                            <>
                                {/* Column headers */}
                                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.1fr 1.1fr 0.8fr", gap: 6, marginBottom: 6, padding: "0 8px" }}>
                                    {["Node", "BEFORE", "AFTER", "Δ"].map(h => (
                                        <div key={h} style={{ fontSize: 10, color: P.mut, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.1em", fontWeight: 700 }}>{h}</div>
                                    ))}
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                    {rows.map(r => {
                                        const isAdded = r.status === "ADDED";
                                        const isRemoved = r.status === "REMOVED";
                                        const rowC = isAdded ? P.LOW_c : isRemoved ? P.HIGH_c : r.delta > 0 ? P.MED_c : P.acc;
                                        const rowBg = isAdded ? P.LOW_bg : isRemoved ? P.HIGH_bg : P.inp;
                                        const rowB = isAdded ? P.LOW_b : isRemoved ? P.HIGH_b : P.bdr;
                                        const label = r.bNode?.label || nmap[r.id]?.label || "";
                                        return (
                                            <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1.1fr 1.1fr 0.8fr", gap: 6, padding: "9px 10px", borderRadius: 8, background: rowBg, border: `1.5px solid ${rowC}44`, borderLeft: `4px solid ${rowC}`, animation: "fin 0.15s ease" }}>
                                                {/* Node */}
                                                <div>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                        <span style={{ fontSize: 13, fontWeight: 800, color: rowC, fontFamily: "'JetBrains Mono',monospace" }}>{r.id}</span>
                                                        {isAdded && <span style={{ fontSize: 9, background: P.LOW_b, color: P.LOW_c, borderRadius: 4, padding: "1px 5px", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>NEW</span>}
                                                        {isRemoved && <span style={{ fontSize: 9, background: P.HIGH_b, color: P.HIGH_c, borderRadius: 4, padding: "1px 5px", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>REMOVED</span>}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: P.sub, marginTop: 2 }}>{label.slice(0, 18)}{label.length > 18 ? "…" : ""}</div>
                                                </div>
                                                {/* BEFORE */}
                                                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>
                                                    {isAdded ? (
                                                        <span style={{ color: P.mut, fontSize: 11 }}>—</span>
                                                    ) : (
                                                        <>
                                                            <div style={{ fontWeight: 700, color: P.txt }}>{r.bScore}</div>
                                                            <div style={{ fontSize: 10, color: P.mut, marginTop: 2 }}>id:{r.bIDeg} od:{r.bODeg}</div>
                                                            <div style={{ fontSize: 10, color: P.mut }}>bc:{r.bBC}</div>
                                                        </>
                                                    )}
                                                </div>
                                                {/* AFTER */}
                                                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>
                                                    {isRemoved ? (
                                                        <span style={{ color: P.mut, fontSize: 11 }}>—</span>
                                                    ) : (
                                                        <>
                                                            <div style={{ fontWeight: 700, color: rowC }}>{r.aScore}</div>
                                                            <div style={{ fontSize: 10, color: P.mut, marginTop: 2 }}>id:{r.aIDeg} od:{r.aODeg}</div>
                                                            <div style={{ fontSize: 10, color: P.mut }}>bc:{r.aBC}</div>
                                                        </>
                                                    )}
                                                </div>
                                                {/* Delta */}
                                                <div style={{
                                                    fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 800,
                                                    color: isAdded ? P.LOW_c : isRemoved ? P.HIGH_c : r.delta > 0 ? P.MED_c : r.delta < 0 ? P.acc : P.mut,
                                                    display: "flex", alignItems: "center"
                                                }}>
                                                    {isAdded ? "＋" : isRemoved ? "✕" : r.delta > 0 ? `▲ +${r.delta}` : r.delta < 0 ? `▼ ${r.delta}` : "≈"}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div style={{ marginTop: 10, fontSize: 11, color: P.mut, padding: "0 4px" }}>
                                    {rows.length} node{rows.length !== 1 ? "s" : ""} affected · {rows.filter(r => r.status === "CHANGED").length} metric change{rows.filter(r => r.status === "CHANGED").length !== 1 ? "s" : ""} · {rows.filter(r => r.status === "ADDED").length} added · {rows.filter(r => r.status === "REMOVED").length} removed
                                </div>
                            </>
                        );
                    })()}
                </Modal>
            )}

            {/* ── HEADER ──────────────────────────────────────────────────────────── */}
            <div style={{ background: P.card, borderBottom: `1.5px solid ${P.bdr}`, padding: "0 18px", height: 54, display: "flex", alignItems: "center", gap: 10, flexShrink: 0, boxShadow: P.shadow, zIndex: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginRight: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg,${P.acc},${P.accAlt})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, boxShadow: `0 0 14px ${P.glow}` }}>⬡</div>
                    <span style={{ fontSize: 17, fontWeight: 800, color: P.txt, letterSpacing: "-0.02em" }}>REQIFY</span>
                </div>
                <div style={{ width: 1, height: 28, background: P.bdr, marginRight: 6 }} />

                {/* Target */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: P.inp, border: `1.5px solid ${P.bdr}`, borderRadius: 8, padding: "0 10px", height: 36 }}>
                    <span style={{ fontSize: 10, color: P.mut, fontFamily: "'JetBrains Mono',monospace", flexShrink: 0 }}>TARGET</span>
                    <select value={sel || ""} onChange={e => { setSel(e.target.value || null); setImpacted({}); setSimDone(false); setSimReady(false); setSimAction(""); setWaves([]); setCompareMode(false); }}
                        style={{ background: "transparent", border: "none", color: sel ? P.acc : P.sub, fontWeight: 700, fontSize: 13, padding: "0 4px", cursor: "pointer", minWidth: 160, fontFamily: "'JetBrains Mono',monospace" }}>
                        <option value="">— select node —</option>
                        {allSorted.map(n => <option key={n.id} value={n.id}>{n.id}: {n.label}</option>)}
                    </select>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 4, background: P.inp, border: `1.5px solid ${P.bdr}`, borderRadius: 9, padding: 4 }}>
                    <button className="hb" onClick={() => sel && openModify()}
                        style={{ ...B, padding: "7px 14px", fontSize: 13, borderRadius: 7, background: simAction === "modify" ? P.acc : "transparent", color: simAction === "modify" ? "#fff" : sel ? P.sub : P.mut, opacity: sel ? 1 : 0.45 }}>
                        ✎ Modify
                    </button>
                    <button className="hb" onClick={() => sel && prepRemove()}
                        style={{ ...B, padding: "7px 14px", fontSize: 13, borderRadius: 7, background: simAction === "remove" ? P.HIGH_c : "transparent", color: simAction === "remove" ? "#fff" : sel ? P.sub : P.mut, opacity: sel ? 1 : 0.45 }}>
                        ✕ Remove
                    </button>
                    <button className="hb" onClick={openAdd}
                        style={{ ...B, padding: "7px 14px", fontSize: 13, borderRadius: 7, background: simAction === "add" ? P.LOW_c : "transparent", color: simAction === "add" ? "#fff" : P.sub }}>
                        ＋ Add
                    </button>
                </div>

                {/* Run Simulation */}
                {simAction === "remove" && simReady && !simDone && (
                    <button className="hb" onClick={runRemoveSim}
                        style={{ ...B, padding: "9px 22px", fontSize: 14, background: `linear-gradient(135deg,${P.acc},${P.accAlt})`, color: "#fff", boxShadow: `0 3px 16px ${P.glow}`, animation: "pulse 1.5s ease infinite" }}>
                        ▶ Run Simulation
                    </button>
                )}
                {simAction === "remove" && simDone && (
                    <button className="hb" onClick={confirmRemove}
                        style={{ ...B, padding: "8px 16px", fontSize: 13, background: P.HIGH_bg, border: `1.5px solid ${P.HIGH_c}`, color: P.HIGH_c }}>
                        ✕ Confirm Delete
                    </button>
                )}
                {simAction === "modify" && simDone && pendingModify && (
                    <button className="hb" onClick={confirmModify}
                        style={{ ...B, padding: "8px 16px", fontSize: 13, background: P.SEL_bg, border: `1.5px solid ${P.acc}`, color: P.acc }}>
                        ✓ Confirm Modify
                    </button>
                )}

                {/* Compare */}
                {compareSnap && simDone && (
                    <button className="hb" onClick={() => setModal("compare")}
                        style={{ ...B, padding: "8px 14px", fontSize: 13, background: P.inp, border: `1.5px solid ${P.acc}66`, color: P.acc }}>
                        ⊞ Compare
                    </button>
                )}

                {/* Export */}
                <button className="hb" onClick={doExport}
                    style={{ ...B, padding: "8px 13px", fontSize: 12, background: P.inp, border: `1.5px solid ${P.bdr}`, color: P.sub }}>
                    ↓ Export
                </button>

                {/* Undo */}
                {history.length > 0 && (
                    <button className="hb" onClick={undoLast}
                        style={{ ...B, padding: "8px 14px", fontSize: 13, background: P.inp, border: `1.5px solid ${P.bdr}`, color: P.sub }}>
                        ↩ Undo
                    </button>
                )}
                {(simDone || sel) && (
                    <button className="hb" onClick={clearSim}
                        style={{ ...B, padding: "8px 13px", fontSize: 12, background: P.inp, border: `1.5px solid ${P.bdr}`, color: P.sub }}>
                        ✕ Clear
                    </button>
                )}

                <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                    {[[nodes.length, "Nodes", P.acc], [edges.length, "Edges", P.accAlt]].map(([v, l, c]) => (
                        <div key={l} style={{ background: P.inp, border: `1.5px solid ${P.bdr}`, borderRadius: 8, padding: "4px 12px", textAlign: "center" }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: c, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>{v}</div>
                            <div style={{ fontSize: 10, color: P.mut, fontFamily: "'JetBrains Mono',monospace" }}>{l}</div>
                        </div>
                    ))}
                    <button className="hb" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} style={{ ...B, padding: "8px 13px", fontSize: 14, background: P.inp, border: `1.5px solid ${P.bdr}`, color: P.txt }}>{theme === "dark" ? "☀" : "◑"}</button>
                    <button className="hb" onClick={() => { setStep(0); setNodes([]); setEdges([]); setHistory([]); clearSim(); setReqTxt(""); setDepTxt(""); }} style={{ ...B, padding: "8px 12px", fontSize: 12, background: P.inp, border: `1.5px solid ${P.bdr}`, color: P.sub }}>← Restart</button>
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
                            const nc = getNodeColors(n.id);
                            const isImp = impacted[n.id] != null;
                            const sevLabel = isImp ? getSev(impacted[n.id], IDeg[n.id] || 0, ODeg[n.id] || 0) : null;
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

                {/* ══ CENTER: Graph ════════════════════════════════════════════════════ */}
                <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
                        <defs>
                            <pattern id="gr" width="46" height="46" patternUnits="userSpaceOnUse"><path d="M46 0L0 0 0 46" fill="none" stroke={P.grid} strokeWidth="1" /></pattern>
                            <radialGradient id="vg" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="transparent" /><stop offset="100%" stopColor={P.bg} stopOpacity="0.4" /></radialGradient>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#gr)" />
                        <rect width="100%" height="100%" fill="url(#vg)" />
                    </svg>
                    <svg ref={svgRef} style={{ width: "100%", height: "100%", position: "relative" }}>
                        <defs>
                            {[["m_def", P.edgeC], ["m_sel", P.acc], ["m_high", P.HIGH_c], ["m_med", P.MED_c], ["m_low", P.LOW_c]].map(([id, c]) => (
                                <marker key={id} id={id} markerWidth="9" markerHeight="9" refX="6" refY="3.5" orient="auto">
                                    <path d="M0,0 L0,7 L9,3.5 z" fill={c} />
                                </marker>
                            ))}
                            <filter id="gn"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                            <filter id="gs"><feGaussianBlur stdDeviation="2.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                        </defs>
                        {edges.map((e, i) => {
                            const isSel = e.from === sel || e.to === sel;
                            const isImp = impacted[e.from] != null || impacted[e.to] != null;
                            return <path key={i} d={getEdgePath(e)} stroke={getEdgeStroke(e)} strokeWidth={isSel ? 2.5 : isImp ? 2 : 1.5} fill="none" markerEnd={getEdgeMarker(e)} opacity={isSel || isImp ? 1 : 0.33} />;
                        })}
                        {nodes.map(n => {
                            const nc = getNodeColors(n.id);
                            const isSel = n.id === sel;
                            const isImp = impacted[n.id] != null;
                            const sevLabel = isImp ? getSev(impacted[n.id], IDeg[n.id] || 0, ODeg[n.id] || 0) : null;
                            const waveIdx = waves.findIndex(w => w.includes(n.id));
                            const isAnim = isImp && waveIdx >= 0 && waveIdx <= activeWave;
                            const R = 32;
                            return (
                                <g key={n.id} className="ng" transform={`translate(${n.x},${n.y})`}
                                    onMouseDown={e => onMouseDown(e, n.id)}
                                    onClick={() => { setSel(n.id); setImpacted({}); setSimDone(false); setSimReady(false); setSimAction(""); setWaves([]); }}>
                                    {(isSel || isImp) && <circle r={R + 14} fill="none" stroke={nc.c} strokeWidth={1.5} opacity={0.2} strokeDasharray="6 5"><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="12s" repeatCount="indefinite" /></circle>}
                                    {isAnim && <circle r={R + 22} fill="none" stroke={nc.c} strokeWidth={2} opacity={0.3} strokeDasharray="10 6"><animateTransform attributeName="transform" type="rotate" from="0" to="-360" dur="5s" repeatCount="indefinite" /></circle>}
                                    {(isSel || isImp) && <circle r={R + 7} fill={nc.c} opacity={0.08} filter="url(#gs)" />}
                                    <circle r={R} fill={nc.bg} stroke={nc.c} strokeWidth={isSel ? 3 : 1.8} filter={isSel ? "url(#gn)" : "none"} />
                                    <text textAnchor="middle" y={-4} fontSize={13} fontWeight={800} fill={isSel ? P.acc : isImp ? nc.c : P.txt} style={{ userSelect: "none", fontFamily: "'JetBrains Mono',monospace" }}>{n.id}</text>
                                    <text textAnchor="middle" y={11} fontSize={9} fill={P.sub} style={{ userSelect: "none" }}>{n.label.length > 12 ? n.label.slice(0, 11) + "…" : n.label}</text>
                                    <text textAnchor="middle" y={R + 16} fontSize={11} fill={P.sub} style={{ userSelect: "none", fontWeight: 600 }}>{n.label.length > 20 ? n.label.slice(0, 19) + "…" : n.label}</text>
                                    {isImp && sevLabel && (
                                        <g transform={`translate(0,${-R - 22})`}>
                                            <rect x={-34} y={-11} width={68} height={18} rx={5} fill={nc.bg} stroke={nc.c} strokeWidth={1.5} />
                                            <text textAnchor="middle" dominantBaseline="middle" y={-2} fontSize={9} fontWeight={800} fill={nc.c} style={{ userSelect: "none", fontFamily: "'JetBrains Mono',monospace" }}>{sevLabel} · {impacted[n.id]} hop{impacted[n.id] > 1 ? "s" : ""}</text>
                                        </g>
                                    )}
                                    {isImp && waveIdx >= 0 && (
                                        <g transform={`translate(${-R + 3},${-R + 3})`}>
                                            <circle r={11} fill={nc.c} stroke={P.card} strokeWidth={2} />
                                            <text textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="#fff" fontWeight={800} style={{ fontFamily: "'JetBrains Mono',monospace" }}>+{waveIdx + 1}</text>
                                        </g>
                                    )}
                                    {(IDeg[n.id] || 0) > 0 && (
                                        <g transform={`translate(${R - 3},${-R + 3})`}>
                                            <circle r={11} fill={P.acc} stroke={P.card} strokeWidth={2} />
                                            <text textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="#fff" fontWeight={800} style={{ fontFamily: "'JetBrains Mono',monospace" }}>{IDeg[n.id]}</text>
                                        </g>
                                    )}
                                </g>
                            );
                        })}
                    </svg>
                    {/* Legend */}
                    <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", background: P.card, border: `1.5px solid ${P.bdr}`, borderRadius: 10, padding: "8px 16px", display: "flex", gap: 14, alignItems: "center", boxShadow: P.shadow, fontFamily: "'JetBrains Mono',monospace", fontSize: 11, whiteSpace: "nowrap" }}>
                        {[[P.acc, "Selected"], [P.HIGH_c, "High"], [P.MED_c, "Medium"], [P.LOW_c, "Low"], [P.acc, "+N=hop"]].map(([c, l]) => (
                            <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <div style={{ width: 8, height: 8, borderRadius: "50%", background: c, boxShadow: `0 0 5px ${c}88` }} />
                                <span style={{ color: P.sub }}>{l}</span>
                            </div>
                        ))}
                        <span style={{ color: P.mut }}>· drag</span>
                    </div>
                    {/* Remove banner */}
                    {simReady && !simDone && simAction === "remove" && (
                        <div style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", background: P.HIGH_bg, border: `1.5px solid ${P.HIGH_c}`, borderRadius: 10, padding: "10px 22px", display: "flex", alignItems: "center", gap: 12, boxShadow: P.shadow, animation: "fin 0.2s ease" }}>
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
        </div>
    );
}