import { useState, useMemo } from 'react';
import { query, useLightdash } from '@lightdash/query-sdk';
import {
  ComposedChart, Line, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import lightdashIcon from './design/images/lightdash-icon.svg';

// ── Queries (module scope) ─────────────────────────────────────────────────
const revenueQuery = query('dbt_orders')
  .label('Revenue by Month')
  .dimensions(['order_date_month'])
  .metrics(['sum_of_basket_total', 'sum_of_profit', 'count_distinct_order_id'])
  .sorts([{ field: 'order_date_month', direction: 'asc' }])
  .limit(60);

const channelQuery = query('dbt_orders')
  .label('Revenue by Partner Channel')
  .dimensions(['partner_name', 'order_date_month'])
  .metrics(['sum_of_basket_total', 'count_distinct_order_id'])
  .sorts([{ field: 'order_date_month', direction: 'asc' }])
  .limit(3000);

// ── Statistical utilities ──────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function linReg(xs, ys) {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0, r2: 0 };
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  const ssTot = ys.reduce((s, y) => s + (y - my) ** 2, 0);
  const ssRes = ys.reduce((s, y, i) => s + (y - (slope * xs[i] + intercept)) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
  return { slope, intercept, r2 };
}

function movingAvg(vals, w) {
  return vals.map((_, i) => {
    const lo = Math.max(0, i - Math.floor(w / 2));
    const hi = Math.min(vals.length, lo + w);
    const sl = vals.slice(lo, hi);
    return sl.reduce((a, b) => a + b, 0) / sl.length;
  });
}

function stddev(arr) {
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

function zScore(ci) {
  if (ci >= 0.99) return 2.576;
  if (ci >= 0.95) return 1.960;
  if (ci >= 0.90) return 1.645;
  return 1.282;
}

// ── ARIMA-lite: AR(p) with drift via least squares ─────────────────────────
function gaussianSolve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    [M[col], M[piv]] = [M[piv], M[col]];
    if (Math.abs(M[col][col]) < 1e-9) continue;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
    }
  }
  return M.map((row, i) => (Math.abs(row[i]) < 1e-9 ? 0 : row[n] / row[i]));
}

function fitAR(X, y) {
  const nFeat = X[0].length;
  const XtX = Array.from({ length: nFeat }, () => new Array(nFeat).fill(0));
  const Xty = new Array(nFeat).fill(0);
  for (let i = 0; i < X.length; i++) {
    for (let a = 0; a < nFeat; a++) {
      Xty[a] += X[i][a] * y[i];
      for (let b = 0; b < nFeat; b++) XtX[a][b] += X[i][a] * X[i][b];
    }
  }
  for (let a = 0; a < nFeat; a++) XtX[a][a] += 1e-6; // ridge term for numerical stability
  return gaussianSolve(XtX, Xty); // [intercept, phi1, phi2, phi3, ...]
}

function fmtMoney(v) {
  if (v == null || isNaN(v)) return '—';
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

// ── XGBoost (gradient boosted regression trees) ────────────────────────────
function makeFeatures(mon, lag1, lag2, lag3, withSeasonality) {
  const rad = (mon / 12) * 2 * Math.PI;
  const f = [lag1, lag2, lag3];
  if (withSeasonality) f.push(Math.sin(rad), Math.cos(rad), Math.sin(2 * rad), Math.cos(2 * rad));
  return f;
}

function buildTree(X, y, depth, minLeaf) {
  const n = y.length;
  if (n === 0) return { leaf: true, value: 0 };
  const sum = y.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  if (depth === 0 || n <= minLeaf * 2) return { leaf: true, value: mean };
  const nF = X[0].length;
  let bestGain = 1e-12, bestFi = -1, bestThresh = 0;
  const totalSSR = y.reduce((s, v) => s + (v - mean) ** 2, 0);
  for (let fi = 0; fi < nF; fi++) {
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => X[a][fi] - X[b][fi]);
    let lSum = 0, lSS = 0, lN = 0;
    let rSum = sum, rSS = y.reduce((s, v) => s + v * v, 0), rN = n;
    for (let k = 0; k < n - 1; k++) {
      const v = y[order[k]];
      lN++; lSum += v; lSS += v * v;
      rN--; rSum -= v; rSS -= v * v;
      if (X[order[k]][fi] === X[order[k + 1]][fi]) continue;
      if (lN < minLeaf || rN < minLeaf) continue;
      const gain = totalSSR - (lSS - lSum * lSum / lN) - (rSS - rSum * rSum / rN);
      if (gain > bestGain) { bestGain = gain; bestFi = fi; bestThresh = (X[order[k]][fi] + X[order[k + 1]][fi]) / 2; }
    }
  }
  if (bestFi === -1) return { leaf: true, value: mean };
  const lIdx = [], rIdx = [];
  for (let i = 0; i < n; i++) (X[i][bestFi] <= bestThresh ? lIdx : rIdx).push(i);
  return {
    leaf: false, fi: bestFi, thresh: bestThresh,
    left:  buildTree(lIdx.map(i => X[i]), lIdx.map(i => y[i]), depth - 1, minLeaf),
    right: buildTree(rIdx.map(i => X[i]), rIdx.map(i => y[i]), depth - 1, minLeaf),
  };
}

function predictTree(node, x) {
  if (node.leaf) return node.value;
  return x[node.fi] <= node.thresh ? predictTree(node.left, x) : predictTree(node.right, x);
}

function trainGBM(X, y, nTrees, lr, maxDepth, minLeaf) {
  const n = y.length;
  const base = y.reduce((a, b) => a + b, 0) / n;
  const preds = new Array(n).fill(base);
  const trees = [];
  for (let t = 0; t < nTrees; t++) {
    const residuals = y.map((yi, i) => yi - preds[i]);
    const tree = buildTree(X, residuals, maxDepth, minLeaf);
    trees.push(tree);
    for (let i = 0; i < n; i++) preds[i] += lr * predictTree(tree, X[i]);
  }
  return { trees, base, lr };
}

function predictGBM({ trees, base, lr }, x) {
  return trees.reduce((p, t) => p + lr * predictTree(t, x), base);
}

const TREE_OPTIONS = [
  { label: '25 trees',  nTrees: 25  },
  { label: '50 trees',  nTrees: 50  },
  { label: '100 trees', nTrees: 100 },
  { label: '150 trees', nTrees: 150 },
  { label: '200 trees', nTrees: 200 },
  { label: '300 trees', nTrees: 300 },
];

const METHOD_OPTIONS = [
  { value: 'linear',        label: 'Linear Regression'   },
  { value: 'moving_avg',    label: 'Moving Average'       },
  { value: 'exp_smoothing', label: 'Exp. Smoothing'       },
  { value: 'holt_winters',  label: 'Holt-Winters'         },
  { value: 'arima',         label: 'ARIMA (AR)'           },
  { value: 'xgboost',       label: 'XGBoost'              },
];

// ── Sub-components ─────────────────────────────────────────────────────────
function ParamSlider({ label, value, min, max, step, onChange, display, hint }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--ld-slate)]">{label}</span>
        <span className="text-xs font-mono bg-[var(--ld-purple-tint)] text-[var(--ld-purple)] px-2 py-0.5 rounded-md border border-[var(--ld-purple)]/20">
          {display ?? value}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="param-range"
      />
      {hint && <p className="text-[10px] text-[var(--ld-gray-6)]">{hint}</p>}
    </div>
  );
}

const HORIZON_TICKS = [1, 6, 12, 18, 24];

function HorizonSlider({ value, min, max, step, onChange }) {
  const pct = ((value - min) / (max - min)) * 100;
  const bubblePct = Math.min(94, Math.max(6, pct));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--ld-slate)] flex items-center gap-1">
          <span className="text-sm">🔭</span> Forecast Horizon
        </span>
        <span className="text-xs font-mono font-semibold text-[var(--ld-purple)]">
          {value} {value === 1 ? 'month' : 'months'}
        </span>
      </div>

      <div className="relative pt-7">
        {/* Floating value bubble that tracks the thumb */}
        <div
          className="absolute top-0 -translate-x-1/2 transition-[left] duration-100 ease-out pointer-events-none"
          style={{ left: `${bubblePct}%` }}
        >
          <div className="flex flex-col items-center">
            <div className="px-1.5 py-0.5 rounded-md text-[10px] font-bold text-white shadow-md whitespace-nowrap bg-[var(--ld-purple)]">
              {value}mo
            </div>
            <div className="w-1.5 h-1.5 rotate-45 -mt-[3px] bg-[var(--ld-purple)]" />
          </div>
        </div>

        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="horizon-range"
          style={{ '--pct': `${pct}%` }}
        />

        <div className="relative h-3 mt-0.5">
          {HORIZON_TICKS.map(t => (
            <span
              key={t}
              className="absolute -translate-x-1/2 text-[9px] text-[var(--ld-gray-5)] font-mono"
              style={{ left: `${((t - min) / (max - min)) * 100}%` }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-[var(--ld-gray-6)]">Further out → wider confidence band</p>
    </div>
  );
}

function KpiCard({ title, value, sub, delta, color }) {
  const palette = {
    blue:    'border-blue-200 bg-blue-50/40',
    violet:  'border-[var(--ld-purple)]/25 bg-[var(--ld-purple-tint)]',
    emerald: 'border-emerald-200 bg-emerald-50/40',
    amber:   'border-amber-200 bg-amber-50/40',
    pink:    'border-[var(--ld-border)] bg-[var(--ld-surface)]',
  }[color] ?? 'border-[var(--ld-border)] bg-[var(--ld-surface)]';

  const valColor = {
    blue: 'text-blue-700', violet: 'text-[var(--ld-purple)]',
    emerald: 'text-emerald-700', amber: 'text-amber-700',
    pink: 'text-[var(--ld-ink)]',
  }[color] ?? 'text-[var(--ld-ink)]';

  return (
    <div className={cn('rounded-[var(--ld-radius)] border shadow-[var(--ld-shadow)] p-4 space-y-1', palette)}>
      <p className="ld-metric-label">{title}</p>
      <p className={cn('ld-metric tabular-nums', valColor)}>{value}</p>
      {sub && <p className="text-[11px] text-[var(--ld-gray-6)]">{sub}</p>}
      {delta !== undefined && (
        <p className={cn('text-[11px] font-medium', delta >= 0 ? 'text-emerald-600' : 'text-red-600')}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}% vs prev
        </p>
      )}
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const entries = payload.filter(p => p.value != null && p.name !== 'CI Base');
  if (!entries.length) return null;
  const pt = payload[0]?.payload;
  const isPartial = pt?.isPartial;
  const soFar = pt?.soFar;
  const fraction = pt?.fraction;
  return (
    <div className="bg-[var(--ld-surface)] border border-[var(--ld-border)] rounded-[var(--ld-radius)] px-3 py-2.5 shadow-[var(--ld-shadow)] text-xs min-w-36">
      <p className="font-semibold text-[var(--ld-slate)] mb-2 border-b border-[var(--ld-border)] pb-1">
        {label}
        {isPartial && <span className="ml-1.5 text-amber-500 font-normal">in progress</span>}
      </p>
      {entries.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-1 last:mb-0">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color ?? p.fill }} />
          <span className="text-[var(--ld-gray-6)]">{p.name}:</span>
          <span className="font-mono text-[var(--ld-ink)] ml-auto pl-2">
            {typeof p.value === 'number' ? fmtMoney(p.value) : p.value}
          </span>
        </div>
      ))}
      {isPartial && soFar != null && (
        <div className="mt-1.5 pt-1.5 border-t border-[var(--ld-border)] space-y-0.5">
          <div className="flex justify-between gap-4">
            <span className="text-[var(--ld-gray-5)]">Collected so far:</span>
            <span className="font-mono text-[var(--ld-gray-7)]">{fmtMoney(soFar)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[var(--ld-gray-5)]">Month elapsed:</span>
            <span className="font-mono text-[var(--ld-gray-7)]">{Math.round(fraction * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

const SMOOTH_OPTIONS = [
  { label: '7 days',    days: 7    },
  { label: '14 days',   days: 14   },
  { label: '1 month',   days: 30   },
  { label: '2 months',  days: 60   },
  { label: '3 months',  days: 90   },
  { label: '6 months',  days: 180  },
  { label: '1 year',    days: 365  },
  { label: '2 years',   days: 730  },
  { label: '3 years',   days: 1095 },
  { label: '5 years',   days: 1825 },
  { label: '10 years',  days: 3650 },
  { label: '20 years',  days: 7300 },
];

const CHART_THEME = {
  grid: '#dee2e6',
  axis: '#868e96',
  tick: '#868e96',
};

// Lightdash data-viz categorical palette (from brand.css --ld-viz-*)
const LD_VIZ = ['#7262ff', '#3b5bdb', '#de7f0b', '#2b8a3e', '#4170cb', '#868e96'];

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [forecastMonths, setForecastMonths]   = useState(12);
  const [smoothIdx,      setSmoothIdx]        = useState(4); // default: 3 months
  const [dampening,      setDampening]        = useState(1.0);
  const [seasonality,    setSeasonality]      = useState(true);
  const [ciLevel,        setCiLevel]          = useState('0.95');
  const [tab,            setTab]              = useState('forecast');
  const [method,         setMethod]           = useState('linear');
  const [nTreesIdx,      setNTreesIdx]        = useState(2); // 100 trees default

  const smoothDays   = SMOOTH_OPTIONS[smoothIdx].days;
  const smoothWindow = Math.max(1, Math.round(smoothDays / 30));

  const { data, loading, error, columns, format } = useLightdash(revenueQuery);
  const { data: chData, loading: chLoading, error: chError } = useLightdash(channelQuery);

  // ── Parse & sort raw rows ──────────────────────────────────────────────
  const points = useMemo(() => {
    if (!data?.length) return null;
    const today = new Date();
    const sorted = data
      .map((row) => {
        const raw = row.order_date_month;
        const d = raw instanceof Date ? raw : new Date(String(raw));
        if (isNaN(d.getTime())) return null;
        const rev = Number(row.sum_of_basket_total) || 0;
        const pro = Number(row.sum_of_profit) || 0;
        const ord = Number(row.count_distinct_order_id) || 0;
        return { d, mon: d.getMonth(), yr: d.getFullYear(), rev, pro, ord };
      })
      .filter(Boolean)
      .sort((a, b) => a.d - b.d)
      .map((p, idx) => ({ ...p, i: idx }));
    // Flag the last point if it falls in the current calendar month (incomplete data)
    const last = sorted[sorted.length - 1];
    if (last && last.yr === today.getFullYear() && last.mon === today.getMonth()) {
      const daysInMonth = new Date(last.yr, last.mon + 1, 0).getDate();
      const fraction = Math.min(today.getDate() / daysInMonth, 1);
      const projected = fraction > 0 ? Math.round(last.rev / fraction) : last.rev;
      sorted[sorted.length - 1] = { ...last, partial: true, fraction, projected };
    }
    return sorted;
  }, [data]);

  // ── Build model ────────────────────────────────────────────────────────
  const model = useMemo(() => {
    if (!points?.length) return null;
    const n = points.length;
    const revs = points.map(p => p.partial ? p.projected : p.rev);
    const xs   = points.map(p => p.i);
    const ci   = Number(ciLevel);
    const z    = zScore(ci);
    const mean = revs.reduce((a, b) => a + b, 0) / n || 1;
    const lastPt = points[n - 1];

    // Seasonal indices (shared by all methods)
    const sSum = new Array(12).fill(0), sCnt = new Array(12).fill(0);
    points.forEach(p => { sSum[p.mon] += p.rev; sCnt[p.mon]++; });
    const rawIdx = sSum.map((s, i) => sCnt[i] > 0 ? (s / sCnt[i]) / mean : 1);
    const idxAvg = rawIdx.reduce((a, b) => a + b, 0) / 12;
    const sIdx   = rawIdx.map(v => v / (idxAvg || 1));
    const SI = mon => seasonality ? sIdx[mon] : 1;

    let fitted = new Array(n).fill(0);
    let forecastBase = [];
    let extraStats = {};
    let statLag = 0; // skip first N points when computing error metrics

    if (method === 'linear') {
      const reg = linReg(xs, revs);
      fitted = points.map(p => Math.max(0, (reg.slope * p.i + reg.intercept) * SI(p.mon)));
      forecastBase = Array.from({ length: forecastMonths }, (_, fi) => {
        const futDate = new Date(lastPt.d); futDate.setMonth(futDate.getMonth() + fi + 1);
        const futMon = futDate.getMonth(), futYr = futDate.getFullYear();
        const dSlope = reg.slope * Math.pow(dampening, fi / 12);
        const pred = Math.max(0, (dSlope * (n + fi) + reg.intercept) * SI(futMon));
        return { futMon, futYr, pred };
      });
      extraStats = { reg, trendPct: (reg.slope / mean) * 100 };

    } else if (method === 'moving_avg') {
      const maVals = points.map((_, i) => {
        const sl = revs.slice(Math.max(0, i - smoothWindow + 1), i + 1);
        return sl.reduce((a, b) => a + b, 0) / sl.length;
      });
      fitted = maVals.map((v, i) => Math.max(0, v * SI(points[i].mon)));
      const maReg = linReg(xs.slice(-Math.min(n, smoothWindow * 2)), maVals.slice(-Math.min(n, smoothWindow * 2)));
      const lastMA = maVals[n - 1];
      forecastBase = Array.from({ length: forecastMonths }, (_, fi) => {
        const futDate = new Date(lastPt.d); futDate.setMonth(futDate.getMonth() + fi + 1);
        const futMon = futDate.getMonth(), futYr = futDate.getFullYear();
        const dampedSlope = maReg.slope * Math.pow(dampening, fi / 12);
        const pred = Math.max(0, (lastMA + dampedSlope * (fi + 1)) * SI(futMon));
        return { futMon, futYr, pred };
      });
      extraStats = { trendPct: (maReg.slope / mean) * 100 };

    } else if (method === 'exp_smoothing') {
      const alpha = 0.3, beta = 0.1;
      let lt = revs[0], bt = n > 1 ? (revs[1] - revs[0]) : 0;
      fitted = [Math.max(0, revs[0] * SI(points[0].mon))];
      for (let i = 1; i < n; i++) {
        const ltPrev = lt, btPrev = bt;
        lt = alpha * revs[i] + (1 - alpha) * (ltPrev + btPrev);
        bt = beta * (lt - ltPrev) + (1 - beta) * btPrev;
        fitted.push(Math.max(0, (ltPrev + btPrev) * SI(points[i].mon)));
      }
      forecastBase = Array.from({ length: forecastMonths }, (_, fi) => {
        const futDate = new Date(lastPt.d); futDate.setMonth(futDate.getMonth() + fi + 1);
        const futMon = futDate.getMonth(), futYr = futDate.getFullYear();
        const dampedB = bt * Math.pow(dampening, fi / 12);
        const pred = Math.max(0, (lt + dampedB * (fi + 1)) * SI(futMon));
        return { futMon, futYr, pred };
      });
      extraStats = { trendPct: (bt / mean) * 100, alpha, beta };

    } else if (method === 'holt_winters') {
      if (n < 12) return null; // needs at least one full seasonal cycle
      const hwAlpha = 0.3, hwBeta = 0.1, hwGamma = 0.2;
      // Seed the seasonal component (additive) from the shared multiplicative index
      const seasComp = new Array(12).fill(0);
      if (seasonality) {
        for (let m = 0; m < 12; m++) seasComp[m] = (sIdx[m] - 1) * mean;
      }
      let level = revs[0] - seasComp[points[0].mon];
      let trend = n > 1 ? (revs[1] - revs[0]) : 0;
      fitted = [Math.max(0, level + seasComp[points[0].mon])];
      for (let i = 1; i < n; i++) {
        const mon = points[i].mon;
        const levelPrev = level, trendPrev = trend, seasPrev = seasComp[mon];
        fitted.push(Math.max(0, levelPrev + trendPrev + seasPrev));
        level = hwAlpha * (revs[i] - seasPrev) + (1 - hwAlpha) * (levelPrev + trendPrev);
        trend = hwBeta * (level - levelPrev) + (1 - hwBeta) * trendPrev;
        if (seasonality) seasComp[mon] = hwGamma * (revs[i] - level) + (1 - hwGamma) * seasPrev;
      }
      forecastBase = Array.from({ length: forecastMonths }, (_, fi) => {
        const futDate = new Date(lastPt.d); futDate.setMonth(futDate.getMonth() + fi + 1);
        const futMon = futDate.getMonth(), futYr = futDate.getFullYear();
        const dampedTrend = trend * Math.pow(dampening, fi / 12);
        const pred = Math.max(0, level + dampedTrend * (fi + 1) + seasComp[futMon]);
        return { futMon, futYr, pred };
      });
      extraStats = { trendPct: (trend / mean) * 100, hwAlpha, hwBeta, hwGamma };

    } else if (method === 'arima') {
      const P = 3; // AR order
      if (n < P + 3) return null;
      statLag = P;
      // Deseasonalize with the shared seasonal index so the AR model fits the trend/noise only
      const deseason = points.map((p, i) => seasonality ? revs[i] / (sIdx[p.mon] || 1) : revs[i]);
      const X = [], y = [];
      for (let i = P; i < n; i++) {
        X.push([1, deseason[i - 1], deseason[i - 2], deseason[i - 3]]);
        y.push(deseason[i]);
      }
      const coeffs = fitAR(X, y); // [intercept, phi1, phi2, phi3]
      fitted = points.map((p, i) => {
        if (i < P) return revs[i];
        const predDeseason = coeffs[0] + coeffs[1] * deseason[i - 1] + coeffs[2] * deseason[i - 2] + coeffs[3] * deseason[i - 3];
        return Math.max(0, predDeseason * (seasonality ? (sIdx[p.mon] || 1) : 1));
      });
      const lagBuf = deseason.slice(-P).reverse(); // [t-1, t-2, t-3]
      forecastBase = Array.from({ length: forecastMonths }, (_, fi) => {
        const futDate = new Date(lastPt.d); futDate.setMonth(futDate.getMonth() + fi + 1);
        const futMon = futDate.getMonth(), futYr = futDate.getFullYear();
        const predDeseason = coeffs[0] + coeffs[1] * lagBuf[0] + coeffs[2] * lagBuf[1] + coeffs[3] * lagBuf[2];
        const dampedDeseason = coeffs[0] + (predDeseason - coeffs[0]) * Math.pow(dampening, fi / 12);
        const pred = Math.max(0, dampedDeseason * (seasonality ? (sIdx[futMon] || 1) : 1));
        lagBuf.unshift(predDeseason); lagBuf.pop();
        return { futMon, futYr, pred };
      });
      const fittedTail = fitted.slice(P);
      const momDeltas = fittedTail.slice(1).map((f, i) => f - fittedTail[i]);
      extraStats = {
        trendPct: momDeltas.length ? (momDeltas.reduce((a, b) => a + b, 0) / momDeltas.length / mean) * 100 : 0,
        arCoeffs: coeffs,
      };

    } else if (method === 'xgboost') {
      const LAG = 3, LR = 0.05, MAX_DEPTH = 3;
      if (n < LAG + 2) return null;
      statLag = LAG;
      const nTrees = TREE_OPTIONS[nTreesIdx].nTrees;
      const revsNorm = revs.map(v => v / mean);
      const X = [], y = [];
      for (let i = LAG; i < n; i++) {
        X.push(makeFeatures(points[i].mon, revsNorm[i-1], revsNorm[i-2], revsNorm[i-3], seasonality));
        y.push(revsNorm[i]);
      }
      const gbm = trainGBM(X, y, nTrees, LR, MAX_DEPTH, 1);
      fitted = points.map((p, i) => {
        if (i < LAG) return revs[i];
        return Math.max(0, predictGBM(gbm, makeFeatures(p.mon, revsNorm[i-1], revsNorm[i-2], revsNorm[i-3], seasonality)) * mean);
      });
      const lagBuf = [...revsNorm.slice(-LAG)].reverse();
      forecastBase = Array.from({ length: forecastMonths }, (_, fi) => {
        const futDate = new Date(lastPt.d); futDate.setMonth(futDate.getMonth() + fi + 1);
        const futMon = futDate.getMonth(), futYr = futDate.getFullYear();
        const predNorm = predictGBM(gbm, makeFeatures(futMon, lagBuf[0], lagBuf[1], lagBuf[2], seasonality));
        const pred = Math.max(0, predNorm * mean);
        lagBuf.unshift(predNorm); lagBuf.pop();
        return { futMon, futYr, pred };
      });
      const fittedTail = fitted.slice(LAG);
      const momDeltas = fittedTail.slice(1).map((f, i) => f - fittedTail[i]);
      extraStats = {
        trendPct: momDeltas.length ? (momDeltas.reduce((a,b) => a+b,0) / momDeltas.length / mean) * 100 : 0,
        nTrees,
      };
    }

    // Error metrics (skip statLag trivial points for XGBoost)
    const residuals = revs.map((r, i) => r - fitted[i]);
    const validRes  = residuals.slice(statLag);
    const validRevs = revs.slice(statLag);
    const validMean = validRevs.reduce((a,b) => a+b,0) / validRevs.length;
    const resSd = stddev(validRes);
    const mae   = validRes.reduce((s, r) => s + Math.abs(r), 0) / validRes.length;
    const rmse  = Math.sqrt(validRes.reduce((s, r) => s + r * r, 0) / validRes.length);
    const ssTot = validRevs.reduce((s, r) => s + (r - validMean) ** 2, 0);
    const ssRes = validRes.reduce((s, r) => s + r * r, 0);
    const r2    = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);

    // Forecast with CI
    const forecast = forecastBase.map(({ futMon, futYr, pred }, fi) => {
      const margin = z * resSd * (1 + fi * 0.04);
      return {
        label: `${MONTHS[futMon]} '${String(futYr).slice(2)}`,
        fullLabel: `${MONTHS[futMon]} ${futYr}`,
        mon: futMon, predicted: pred,
        lower: Math.max(0, pred - margin),
        upper: pred + margin,
      };
    });

    const histSeries = points.map((p, i) => ({
      name:      `${MONTHS[p.mon]} '${String(p.yr).slice(2)}`,
      actual:    p.partial ? p.projected : p.rev,
      soFar:     p.partial ? p.rev : undefined,
      isPartial: p.partial || false,
      fraction:  p.partial ? p.fraction : undefined,
      fitted:    fitted[i],
      profit:    p.pro,
      residual:  i < statLag || p.partial ? null : residuals[i],
    }));

    return { r2, mae, rmse, resSd, sIdx, histSeries, forecast, mean, ...extraStats };
  }, [points, method, smoothWindow, nTreesIdx, dampening, seasonality, ciLevel, forecastMonths]);

  // ── Chart datasets ─────────────────────────────────────────────────────
  const forecastChartData = useMemo(() => {
    if (!model) return [];
    const hist = model.histSeries.map(p => ({
      name: p.name, actual: p.actual, fitted: p.fitted,
      soFar: p.soFar, isPartial: p.isPartial, fraction: p.fraction,
      forecast: null, ciBase: null, bandW: null,
    }));
    const fc = model.forecast.map(p => ({
      name: p.label, actual: null, fitted: null,
      forecast: p.predicted,
      ciBase: p.lower,
      bandW: p.upper - p.lower,
    }));
    return [...hist, ...fc];
  }, [model]);

  const seasonalData = useMemo(() =>
    model ? MONTHS.map((m, i) => ({ name: m, index: +model.sIdx[i].toFixed(3) })) : []
  , [model]);

  const residualData = useMemo(() => model?.histSeries ?? [], [model]);

  // ── Channel breakdown (partner mix) ────────────────────────────────────
  const channelStats = useMemo(() => {
    if (!chData?.length) return null;
    const byPartner = new Map();
    chData.forEach((row) => {
      const name = row.partner_name || 'Unknown';
      const raw = row.order_date_month;
      const d = raw instanceof Date ? raw : new Date(String(raw));
      if (isNaN(d.getTime())) return;
      const rev = Number(row.sum_of_basket_total) || 0;
      const ord = Number(row.count_distinct_order_id) || 0;
      if (!byPartner.has(name)) byPartner.set(name, []);
      byPartner.get(name).push({ d, rev, ord });
    });
    const partners = Array.from(byPartner.entries()).map(([name, rows]) => {
      const sorted = rows.slice().sort((a, b) => a.d - b.d);
      const n = sorted.length;
      const totalRev = sorted.reduce((s, r) => s + r.rev, 0);
      const totalOrd = sorted.reduce((s, r) => s + r.ord, 0);
      const half = Math.max(1, Math.floor(n / 2));
      const early = sorted.slice(0, half);
      const late = sorted.slice(n - half);
      const earlyAvg = early.reduce((s, r) => s + r.rev, 0) / early.length;
      const lateAvg = late.reduce((s, r) => s + r.rev, 0) / late.length;
      const growth = earlyAvg > 0 ? ((lateAvg - earlyAvg) / earlyAvg) * 100 : 0;
      const aov = totalOrd > 0 ? totalRev / totalOrd : 0;
      return { name, totalRev, totalOrd, aov, growth, months: n };
    });
    partners.sort((a, b) => b.totalRev - a.totalRev);
    return partners;
  }, [chData]);

  const topPartners = useMemo(() => channelStats?.slice(0, 8) ?? [], [channelStats]);

  const movers = useMemo(() => {
    const eligible = channelStats?.filter(p => p.months >= 2) ?? [];
    if (!eligible.length) return { grower: null, decliner: null };
    const grower   = eligible.reduce((best, p) => p.growth > best.growth ? p : best, eligible[0]);
    const decliner = eligible.reduce((worst, p) => p.growth < worst.growth ? p : worst, eligible[0]);
    return { grower, decliner: decliner !== grower ? decliner : null };
  }, [channelStats]);

  // ── Derived KPIs ───────────────────────────────────────────────────────
  const totalRev    = points?.reduce((s, p) => s + p.rev, 0) ?? 0;
  const avgMonthly  = points?.length ? totalRev / points.length : 0;
  const peakPoint   = points?.length ? points.reduce((best, p) => p.rev > best.rev ? p : best, points[0]) : null;
  const peakLabel   = peakPoint ? `${MONTHS[peakPoint.mon]} ${peakPoint.yr}` : '—';
  const nextFc      = model?.forecast[0]?.predicted ?? 0;
  const totalOrders   = points?.reduce((s, p) => s + p.ord, 0) ?? 0;
  const avgOrderValue = totalOrders > 0 ? totalRev / totalOrders : 0;
  const lastPoint     = points?.[points.length - 1];
  const partialMonth  = lastPoint?.partial ? lastPoint : null;
  const lastActual    = partialMonth ? (partialMonth.projected ?? 0) : (lastPoint?.rev ?? 0);
  const momDelta      = lastActual > 0 ? ((nextFc - lastActual) / lastActual) * 100 : undefined;
  const lastTickIdx = model ? model.histSeries.length - 1 : null;
  const dividerName = lastTickIdx != null ? forecastChartData[lastTickIdx]?.name : null;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[var(--ld-bg)] text-[var(--ld-ink)] flex flex-col">

      {/* Header */}
      <header className="flex-shrink-0 border-b border-[var(--ld-border)] px-6 py-3.5 flex items-center justify-between bg-[var(--ld-surface)]">
        <div className="flex items-center gap-3">
          <img src={lightdashIcon} alt="Lightdash" className="w-8 h-8 rounded-[var(--ld-radius)] shadow-[var(--ld-shadow)]" />
          <div>
            <h1 className="text-sm font-bold text-[var(--ld-slate)] tracking-tight">Revenue Forecast</h1>
            <p className="text-[10px] text-[var(--ld-gray-6)] tracking-wide">Statistical Predictive Analytics · dbt_orders</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {points && (
            <Badge variant="outline" className="border-[var(--ld-border)] text-[var(--ld-gray-6)] text-[10px] h-6">
              {points.length} months
            </Badge>
          )}
          {model && (
            <Badge variant="outline"
              className={cn('text-[10px] h-6', model.r2 > 0.7
                ? 'border-emerald-300 text-emerald-600'
                : 'border-amber-300 text-amber-600'
              )}>
              R² {(model.r2 * 100).toFixed(1)}%
            </Badge>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0 border-r border-[var(--ld-border)] bg-[var(--ld-surface)] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-5">

            {points && (
              <section className="rounded-[var(--ld-radius)] border border-[var(--ld-purple)]/20 bg-[var(--ld-purple-tint)] p-3">
                <p className="ld-metric-label">Avg Order Value</p>
                <p className="text-xl font-bold text-[var(--ld-purple)] mt-1 tabular-nums">{fmtMoney(avgOrderValue)}</p>
                <p className="text-[10px] text-[var(--ld-gray-6)] mt-0.5">across {totalOrders.toLocaleString()} orders</p>
              </section>
            )}

            <section className="space-y-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--ld-gray-6)]">Parameters</p>
              <div className="space-y-1.5">
                <Label className="text-[10px] text-[var(--ld-gray-6)] uppercase tracking-widest">Method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="h-8 bg-[var(--ld-surface)] border-[var(--ld-border)] text-[var(--ld-ink)] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--ld-surface)] border-[var(--ld-border)]">
                    {METHOD_OPTIONS.map(m => (
                      <SelectItem key={m.value} value={m.value} className="text-[var(--ld-ink)] text-xs focus:bg-[var(--ld-gray-1)] focus:text-[var(--ld-ink)]">
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <HorizonSlider
                value={forecastMonths} min={1} max={24} step={1}
                onChange={setForecastMonths}
              />
              {method === 'moving_avg' && (
                <ParamSlider
                  label="MA Window"
                  value={smoothIdx} min={0} max={SMOOTH_OPTIONS.length - 1} step={1}
                  onChange={setSmoothIdx}
                  display={SMOOTH_OPTIONS[smoothIdx].label}
                  hint="Trailing window for averaging"
                />
              )}
              {method === 'xgboost' && (
                <ParamSlider
                  label="Estimators"
                  value={nTreesIdx} min={0} max={TREE_OPTIONS.length - 1} step={1}
                  onChange={setNTreesIdx}
                  display={TREE_OPTIONS[nTreesIdx].label}
                  hint="Number of boosting trees"
                />
              )}
              {method !== 'xgboost' && (
                <ParamSlider
                  label="Trend Dampening"
                  value={dampening} min={0.3} max={1.5} step={0.05}
                  onChange={setDampening}
                  display={`${dampening.toFixed(2)}×`}
                  hint="Reduces trend strength over horizon"
                />
              )}
            </section>

            <Separator className="bg-[var(--ld-border)]" />

            <section className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--ld-gray-6)]">Options</p>
              <div className="flex items-center justify-between py-1">
                <div>
                  <Label className="text-xs text-[var(--ld-ink)]">Seasonality</Label>
                  <p className="text-[10px] text-[var(--ld-gray-6)]">Monthly seasonal adjustment</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={seasonality}
                  onClick={() => setSeasonality(v => !v)}
                  className={cn(
                    'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ld-purple)] focus-visible:ring-offset-2',
                    seasonality ? 'bg-[var(--ld-purple)]' : 'bg-[var(--ld-gray-3)]'
                  )}
                >
                  <span className={cn(
                    'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-md ring-0 transition-transform duration-200',
                    seasonality ? 'translate-x-5' : 'translate-x-0'
                  )} />
                </button>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] text-[var(--ld-gray-6)] uppercase tracking-widest">Confidence Interval</Label>
                <Select value={ciLevel} onValueChange={setCiLevel}>
                  <SelectTrigger className="h-8 bg-[var(--ld-surface)] border-[var(--ld-border)] text-[var(--ld-ink)] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--ld-surface)] border-[var(--ld-border)]">
                    {[['0.80','80% CI'],['0.90','90% CI'],['0.95','95% CI'],['0.99','99% CI']].map(([v, l]) => (
                      <SelectItem key={v} value={v} className="text-[var(--ld-ink)] text-xs focus:bg-[var(--ld-gray-1)] focus:text-[var(--ld-ink)]">
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            {model && (
              <>
                <Separator className="bg-[var(--ld-border)]" />
                <section className="space-y-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--ld-gray-6)]">Model Stats</p>
                  {[
                    { k: 'R² Score',   v: `${(model.r2 * 100).toFixed(2)}%`, hi: model.r2 > 0.7 },
                    { k: 'MAE',        v: fmtMoney(model.mae) },
                    { k: 'RMSE',       v: fmtMoney(model.rmse) },
                    { k: 'Residual σ', v: fmtMoney(model.resSd) },
                    model.trendPct != null && { k: 'MoM Trend', v: `${model.trendPct > 0 ? '+' : ''}${model.trendPct.toFixed(2)}%` },
                    method === 'linear'        && { k: 'Intercept', v: fmtMoney(model.reg?.intercept) },
                    method === 'exp_smoothing' && { k: 'Alpha / Beta', v: `${model.alpha ?? 0.3} / ${model.beta ?? 0.1}` },
                    method === 'holt_winters'  && { k: 'α / β / γ', v: `${model.hwAlpha ?? 0.3} / ${model.hwBeta ?? 0.1} / ${model.hwGamma ?? 0.2}` },
                    method === 'arima'         && { k: 'AR(3) Coeffs', v: model.arCoeffs ? model.arCoeffs.map(c => c.toFixed(2)).join(', ') : '—' },
                    method === 'xgboost'       && { k: 'Trees', v: String(model.nTrees ?? '—') },
                  ].filter(Boolean).map(({ k, v, hi }) => (
                    <div key={k} className="flex items-center justify-between">
                      <span className="text-[11px] text-[var(--ld-gray-6)]">{k}</span>
                      <span className={cn('text-[11px] font-mono',
                        hi === true ? 'text-emerald-600' :
                        hi === false ? 'text-amber-600' : 'text-[var(--ld-ink)]'
                      )}>{v}</span>
                    </div>
                  ))}
                </section>
              </>
            )}
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto p-5 space-y-4">

          {loading && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {[0,1,2,3].map(i => <Skeleton key={i} className="h-24 bg-[var(--ld-gray-2)] rounded-[var(--ld-radius)]" />)}
              </div>
              <Skeleton className="h-96 bg-[var(--ld-gray-2)] rounded-[var(--ld-radius)]" />
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-64 text-red-600 text-sm">
              Error: {error.message}
            </div>
          )}

          {!loading && !error && model && (
            <>
              {/* KPI row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard
                  title="Total Revenue"
                  value={fmtMoney(totalRev)}
                  sub={`across ${points.length} months`}
                  color="pink"
                />
                <KpiCard
                  title="Peak Month"
                  value={fmtMoney(peakPoint?.rev ?? 0)}
                  sub={peakLabel}
                  color="violet"
                />
                <KpiCard
                  title="Next Month Forecast"
                  value={fmtMoney(nextFc)}
                  delta={momDelta}
                  color="emerald"
                />
                <KpiCard
                  title="Model Accuracy"
                  value={`${(model.r2 * 100).toFixed(1)}%`}
                  sub={`R²  ·  MAE ${fmtMoney(model.mae)}`}
                  color="amber"
                />
              </div>

              {/* Chart card */}
              <div className="rounded-[var(--ld-radius)] border border-[var(--ld-border)] bg-[var(--ld-surface)] shadow-[var(--ld-shadow)] overflow-hidden">
                <Tabs value={tab} onValueChange={setTab}>
                  <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--ld-border)]">
                    <TabsList className="bg-[var(--ld-gray-1)] border border-[var(--ld-border)] h-8 p-0.5">
                      {[['forecast','Forecast'],['channels','Channels'],['seasonality','Seasonality'],['residuals','Residuals'],['data','Data']].map(([v, l]) => (
                        <TabsTrigger
                          key={v} value={v}
                          className="text-[11px] h-7 px-3 data-[state=active]:bg-[var(--ld-purple)] data-[state=active]:text-white text-[var(--ld-gray-6)] rounded"
                        >
                          {l}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    <div className="flex items-center gap-2">
                      {partialMonth && (
                        <span className="text-[10px] text-amber-600 border border-amber-200 bg-amber-50 rounded px-1.5 py-0.5">
                          {MONTHS[partialMonth.mon]} projected · {fmtMoney(partialMonth.projected)} ({Math.round(partialMonth.fraction * 100)}% elapsed)
                        </span>
                      )}
                      <p className="text-[10px] text-[var(--ld-gray-6)]">
                        {METHOD_OPTIONS.find(m => m.value === method)?.label} · {seasonality ? 'seasonal' : 'no seasonal'} · {(Number(ciLevel)*100).toFixed(0)}% CI
                      </p>
                    </div>
                  </div>

                  {/* ── Forecast tab ───────────────────────────────────── */}
                  <TabsContent value="forecast" className="m-0 p-5">
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={forecastChartData} margin={{ top: 8, right: 8, bottom: 0, left: 10 }}>
                          <defs>
                            <linearGradient id="ciGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%"   stopColor={LD_VIZ[2]} stopOpacity={0.18} />
                              <stop offset="100%" stopColor={LD_VIZ[2]} stopOpacity={0.03} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} vertical={false} />
                          <XAxis
                            dataKey="name" tick={{ fill: CHART_THEME.tick, fontSize: 10 }}
                            axisLine={{ stroke: CHART_THEME.grid }} tickLine={false}
                            interval={Math.max(0, Math.floor(forecastChartData.length / 12) - 1)}
                          />
                          <YAxis
                            tick={{ fill: CHART_THEME.tick, fontSize: 10 }}
                            axisLine={false} tickLine={false} width={58}
                            tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`}
                          />
                          <Tooltip content={<ChartTooltip />} />
                          <Legend
                            iconType="circle" iconSize={6}
                            formatter={v => <span style={{ fontSize: 10, color: '#868e96' }}>{v}</span>}
                            wrapperStyle={{ paddingTop: 8 }}
                          />
                          {/* CI band: transparent base + colored band */}
                          <Area dataKey="ciBase"  name="CI Base"   stroke="none" fill="transparent" stackId="ci" legendType="none" connectNulls />
                          <Area dataKey="bandW"   name="95% CI"    stroke="none" fill="url(#ciGrad)" stackId="ci" connectNulls />
                          {/* Lines */}
                          <Line
                            dataKey="actual" name="Actual" stroke={LD_VIZ[1]} strokeWidth={2}
                            dot={(props) => props.payload?.isPartial
                              ? <circle key={props.index} cx={props.cx} cy={props.cy} r={5} fill="white" stroke="#f59e0b" strokeWidth={2.5} />
                              : <g key={props.index} />
                            }
                            activeDot={{ r: 4 }} connectNulls={false}
                          />
                          <Line dataKey="fitted"  name="Fitted"    stroke={LD_VIZ[5]} strokeWidth={1.5} dot={false} strokeDasharray="4 3" connectNulls={false} />
                          <Line dataKey="forecast" name="Forecast" stroke={LD_VIZ[2]} strokeWidth={2}   dot={{ r: 2, fill: LD_VIZ[2] }} strokeDasharray="6 3" connectNulls={false} />
                          {/* Forecast start marker */}
                          {dividerName && (
                            <ReferenceLine
                              x={dividerName}
                              stroke="#dee2e6"
                              strokeDasharray="3 3"
                              label={{ value: '▶ forecast', position: 'insideTopRight', fill: '#868e96', fontSize: 9, offset: 4 }}
                            />
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Forecast table */}
                    <div className="mt-4 rounded-[var(--ld-radius)] border border-[var(--ld-border)] overflow-hidden">
                      <div className="grid grid-cols-5 bg-[var(--ld-gray-1)] px-4 py-2 border-b border-[var(--ld-border)]">
                        {['Period','Forecast','Lower','Upper','vs Avg'].map(h => (
                          <span key={h} className="text-[10px] font-semibold text-[var(--ld-gray-6)] uppercase tracking-wider">{h}</span>
                        ))}
                      </div>
                      <div className="max-h-44 overflow-y-auto">
                        {model.forecast.map((p, i) => (
                          <div key={i} className={cn(
                            'grid grid-cols-5 px-4 py-2 border-b border-[var(--ld-border)] transition-colors hover:bg-[var(--ld-gray-1)]',
                            i === 0 && 'bg-[var(--ld-purple-tint)]'
                          )}>
                            <span className="text-[11px] text-[var(--ld-ink)]">{p.fullLabel}</span>
                            <span className="text-[11px] font-mono text-[var(--ld-purple)]">{fmtMoney(p.predicted)}</span>
                            <span className="text-[11px] font-mono text-[var(--ld-gray-6)]">{fmtMoney(p.lower)}</span>
                            <span className="text-[11px] font-mono text-[var(--ld-gray-6)]">{fmtMoney(p.upper)}</span>
                            <span className={cn('text-[11px] font-mono',
                              p.predicted >= avgMonthly ? 'text-emerald-600' : 'text-red-600'
                            )}>
                              {avgMonthly > 0 ? `${((p.predicted - avgMonthly) / avgMonthly * 100).toFixed(1)}%` : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  {/* ── Channels tab ───────────────────────────────────── */}
                  <TabsContent value="channels" className="m-0 p-5">
                    <p className="text-[11px] text-[var(--ld-gray-6)] mb-4">
                      Revenue split by fulfillment partner. Trend compares each partner's earliest active months to their most recent.
                    </p>

                    {chLoading && (
                      <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-5 w-5 animate-spin text-[var(--ld-gray-4)]" />
                      </div>
                    )}

                    {chError && (
                      <div className="flex items-center justify-center h-64 text-red-600 text-sm">
                        Error: {chError.message}
                      </div>
                    )}

                    {!chLoading && !chError && channelStats && (
                      <>
                        {(movers.grower || movers.decliner) && (
                          <div className="grid grid-cols-2 gap-3 mb-4">
                            {movers.grower && (
                              <div className="rounded-[var(--ld-radius)] border border-emerald-200 bg-emerald-50/40 p-4">
                                <p className="ld-metric-label">Fastest Growing Partner</p>
                                <p className="text-lg font-bold text-emerald-700 mt-1 truncate">{movers.grower.name}</p>
                                <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
                                  ▲ {movers.grower.growth.toFixed(1)}% · {fmtMoney(movers.grower.totalRev)} total
                                </p>
                              </div>
                            )}
                            {movers.decliner && (
                              <div className="rounded-[var(--ld-radius)] border border-red-200 bg-red-50/40 p-4">
                                <p className="ld-metric-label">Steepest Decline</p>
                                <p className="text-lg font-bold text-red-700 mt-1 truncate">{movers.decliner.name}</p>
                                <p className="text-[11px] text-red-600 font-medium mt-0.5">
                                  ▼ {Math.abs(movers.decliner.growth).toFixed(1)}% · {fmtMoney(movers.decliner.totalRev)} total
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topPartners} layout="vertical" margin={{ top: 4, right: 30, bottom: 0, left: 10 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} horizontal={false} />
                              <XAxis
                                type="number" tick={{ fill: CHART_THEME.tick, fontSize: 10 }}
                                axisLine={false} tickLine={false}
                                tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
                              />
                              <YAxis
                                type="category" dataKey="name" width={110}
                                tick={{ fill: CHART_THEME.tick, fontSize: 10 }} axisLine={false} tickLine={false}
                              />
                              <Tooltip
                                formatter={(v) => [fmtMoney(Number(v)), 'Revenue']}
                                labelFormatter={(label, payload) => {
                                  const g = payload?.[0]?.payload?.growth;
                                  return `${label}${g != null ? ` · ${g >= 0 ? '▲' : '▼'} ${Math.abs(g).toFixed(1)}%` : ''}`;
                                }}
                                contentStyle={{ background: '#ffffff', border: '1px solid #dee2e6', borderRadius: 8, fontSize: 11 }}
                                labelStyle={{ color: '#394b59' }}
                                cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                              />
                              <Bar dataKey="totalRev" radius={[0, 4, 4, 0]}>
                                {topPartners.map((d, i) => (
                                  <Cell key={i} fill={d.growth >= 0 ? LD_VIZ[0] : '#f59e0b'} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        <div className="mt-4 rounded-[var(--ld-radius)] border border-[var(--ld-border)] overflow-hidden">
                          <div className="grid grid-cols-5 bg-[var(--ld-gray-1)] px-4 py-2 border-b border-[var(--ld-border)]">
                            {['Partner','Revenue','Orders','AOV','Trend'].map(h => (
                              <span key={h} className="text-[10px] font-semibold text-[var(--ld-gray-6)] uppercase tracking-wider">{h}</span>
                            ))}
                          </div>
                          <div className="max-h-52 overflow-y-auto">
                            {channelStats.map((p) => (
                              <div key={p.name} className="grid grid-cols-5 px-4 py-2 border-b border-[var(--ld-border)] hover:bg-[var(--ld-gray-1)]">
                                <span className="text-[11px] text-[var(--ld-ink)] truncate">{p.name}</span>
                                <span className="text-[11px] font-mono text-[var(--ld-ink)]">{fmtMoney(p.totalRev)}</span>
                                <span className="text-[11px] font-mono text-[var(--ld-gray-6)]">{p.totalOrd}</span>
                                <span className="text-[11px] font-mono text-[var(--ld-gray-6)]">{fmtMoney(p.aov)}</span>
                                <span className={cn('text-[11px] font-mono', p.growth >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                                  {p.growth >= 0 ? '▲' : '▼'} {Math.abs(p.growth).toFixed(1)}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </TabsContent>

                  {/* ── Seasonality tab ────────────────────────────────── */}
                  <TabsContent value="seasonality" className="m-0 p-5">
                    <p className="text-[11px] text-[var(--ld-gray-6)] mb-4">
                      Monthly seasonal indices computed from historical averages. Values &gt; 1.0 indicate above-average months.
                    </p>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={seasonalData} margin={{ top: 8, right: 8, bottom: 0, left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} vertical={false} />
                          <XAxis dataKey="name" tick={{ fill: CHART_THEME.tick, fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis
                            tick={{ fill: CHART_THEME.tick, fontSize: 10 }}
                            axisLine={false} tickLine={false}
                            tickFormatter={v => v.toFixed(2)} domain={[0, 'auto']}
                          />
                          <Tooltip
                            formatter={v => [v.toFixed(3), 'Seasonal Index']}
                            contentStyle={{ background: '#ffffff', border: '1px solid #dee2e6', borderRadius: 8, fontSize: 11 }}
                            labelStyle={{ color: '#394b59' }}
                            cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                          />
                          <ReferenceLine y={1} stroke="#ced4da" strokeDasharray="4 2" label={{ value: 'baseline', position: 'insideTopLeft', fill: '#868e96', fontSize: 9 }} />
                          <Bar dataKey="index" radius={[4,4,0,0]}>
                            {seasonalData.map((d, i) => (
                              <rect key={i} fill={d.index >= 1 ? LD_VIZ[0] : '#ced4da'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 grid grid-cols-6 gap-2">
                      {seasonalData.map(d => (
                        <div key={d.name} className={cn(
                          'rounded-[var(--ld-radius)] border p-2 text-center',
                          d.index >= 1 ? 'border-[var(--ld-purple)]/20 bg-[var(--ld-purple-tint)]' : 'border-[var(--ld-border)] bg-[var(--ld-surface)]'
                        )}>
                          <p className="text-[10px] text-[var(--ld-gray-6)]">{d.name}</p>
                          <p className={cn('text-sm font-mono font-bold mt-0.5',
                            d.index >= 1 ? 'text-[var(--ld-purple)]' : 'text-[var(--ld-gray-5)]'
                          )}>{d.index.toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  {/* ── Residuals tab ──────────────────────────────────── */}
                  <TabsContent value="residuals" className="m-0 p-5">
                    <p className="text-[11px] text-[var(--ld-gray-6)] mb-4">
                      Residuals = actual − fitted. Patterns indicate where the linear model under/over-fits.
                      σ = {fmtMoney(model.resSd)}
                    </p>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={residualData} margin={{ top: 8, right: 8, bottom: 0, left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} vertical={false} />
                          <XAxis
                            dataKey="name" tick={{ fill: CHART_THEME.tick, fontSize: 10 }}
                            axisLine={false} tickLine={false}
                            interval={Math.max(0, Math.floor(residualData.length / 8) - 1)}
                          />
                          <YAxis
                            yAxisId="rev" orientation="left"
                            tick={{ fill: CHART_THEME.tick, fontSize: 10 }} axisLine={false} tickLine={false} width={55}
                            tickFormatter={v => `$${(v/1000).toFixed(0)}k`}
                          />
                          <YAxis
                            yAxisId="res" orientation="right"
                            tick={{ fill: CHART_THEME.tick, fontSize: 10 }} axisLine={false} tickLine={false} width={55}
                            tickFormatter={v => `$${(v/1000).toFixed(0)}k`}
                          />
                          <Tooltip
                            formatter={(v, n) => [fmtMoney(Number(v)), n]}
                            contentStyle={{ background: '#ffffff', border: '1px solid #dee2e6', borderRadius: 8, fontSize: 11 }}
                            labelStyle={{ color: '#394b59' }}
                            cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                          />
                          <Legend
                            iconType="circle" iconSize={6}
                            formatter={v => <span style={{ fontSize: 10, color: '#868e96' }}>{v}</span>}
                          />
                          <ReferenceLine yAxisId="res" y={0} stroke="#ced4da" />
                          <Bar yAxisId="res" dataKey="residual" name="Residual" fill="#f59e0b" opacity={0.6} radius={[2,2,0,0]} />
                          <Line yAxisId="rev" dataKey="actual" name="Actual"  stroke={LD_VIZ[0]} strokeWidth={1.5} dot={false} />
                          <Line yAxisId="rev" dataKey="fitted" name="Fitted"  stroke={LD_VIZ[5]} strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </TabsContent>

                  {/* ── Data tab ───────────────────────────────────────── */}
                  <TabsContent value="data" className="m-0 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[11px] text-[var(--ld-gray-6)]">
                        Raw query results · {data?.length ?? 0} rows
                      </p>
                      <Button
                        variant="outline" size="sm"
                        className="h-7 text-[11px] border-[var(--ld-border)] text-[var(--ld-slate)] hover:bg-[var(--ld-gray-1)]"
                        onClick={() => {
                          if (!columns?.length || !data?.length) return;
                          const header = columns.map(c => c.label).join(',');
                          const rows = data.map(row =>
                            columns.map(c => `"${String(format(row, c.name)).replace(/"/g, '""')}"`).join(',')
                          );
                          navigator.clipboard.writeText([header, ...rows].join('\n'));
                        }}
                      >
                        <Copy className="h-3 w-3 mr-1.5" />
                        Copy CSV
                      </Button>
                    </div>
                    <ScrollArea className="max-h-[520px] rounded-[var(--ld-radius)] border border-[var(--ld-border)]">
                      <Table>
                        <TableHeader className="sticky top-0 bg-[var(--ld-gray-1)] z-10">
                          <TableRow className="border-[var(--ld-border)]">
                            {columns?.map(col => (
                              <TableHead key={col.name} className="text-[11px] font-semibold text-[var(--ld-gray-6)] uppercase tracking-wider h-9 whitespace-nowrap">
                                {col.label}
                              </TableHead>
                            ))}
                            <TableHead className="text-[11px] font-semibold text-[var(--ld-gray-6)] uppercase tracking-wider h-9">
                              Status
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {points?.map((pt, i) => {
                            const row = data?.[data.findIndex(r => {
                              const d = r.order_date_month instanceof Date ? r.order_date_month : new Date(String(r.order_date_month));
                              return d.getFullYear() === pt.yr && d.getMonth() === pt.mon;
                            })];
                            return (
                              <TableRow
                                key={i}
                                className={cn('border-[var(--ld-border)] hover:bg-[var(--ld-gray-1)] cursor-pointer', pt.partial && 'bg-amber-50/60')}
                              >
                                {columns?.map(col => (
                                  <TableCell
                                    key={col.name}
                                    className="text-[12px] text-[var(--ld-ink)] py-2.5 whitespace-nowrap"
                                    title="Click to copy"
                                    onClick={() => row && navigator.clipboard.writeText(format(row, col.name))}
                                  >
                                    {row ? format(row, col.name) : '—'}
                                  </TableCell>
                                ))}
                                <TableCell className="py-2.5">
                                  {pt.partial ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                                      In progress · {Math.round(pt.fraction * 100)}%
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-[var(--ld-gray-4)]">Complete</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
