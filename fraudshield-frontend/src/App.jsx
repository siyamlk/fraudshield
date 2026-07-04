import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Shield, Sun, Moon, Sunrise, Sunset, ChevronDown, Check,
  Activity, ShoppingCart, ShoppingBag, Fuel, Globe, Home as HomeIcon, Film,
  Plane, UtensilsCrossed, Dumbbell, PawPrint, Scissors, Receipt, MapPin,
  Shuffle, ArrowUp, ArrowDown, Search, ChevronRight, Heart,
} from "lucide-react";


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

/* ================= DATA ================= */

const CATEGORIES = [
  { id: "grocery_pos", label: "Grocery (POS)", icon: ShoppingCart },
  { id: "gas_transport", label: "Gas & Transport", icon: Fuel },
  { id: "misc_net", label: "Misc (Online)", icon: Globe },
  { id: "grocery_net", label: "Grocery (Online)", icon: ShoppingCart },
  { id: "shopping_net", label: "Shopping (Online)", icon: ShoppingBag },
  { id: "home", label: "Home", icon: HomeIcon },
  { id: "entertainment", label: "Entertainment", icon: Film },
  { id: "shopping_pos", label: "Shopping (POS)", icon: ShoppingBag },
  { id: "travel", label: "Travel", icon: Plane },
  { id: "food_dining", label: "Food & Dining", icon: UtensilsCrossed },
  { id: "health_fitness", label: "Health & Fitness", icon: Dumbbell },
  { id: "kids_pets", label: "Kids & Pets", icon: PawPrint },
  { id: "personal_care", label: "Personal Care", icon: Scissors },
  { id: "misc_pos", label: "Misc (POS)", icon: Receipt },
];

/* City list is no longer hardcoded — it's fetched from GET /cities on mount,
   which is backed by the model's real city_reference.json data. */

const EXAMPLES = [
  { amt: 14, hour: 2, age: 41, cat: "grocery_pos", gender: "M", city: "Dallas, TX" },
  { amt: 47.32, hour: 14, age: 29, cat: "food_dining", gender: "F", city: "Phoenix, AZ" },
  { amt: 1120.5, hour: 3, age: 67, cat: "gas_transport", gender: "M", city: "Houston, TX" },
  { amt: 62.1, hour: 11, age: 35, cat: "shopping_pos", gender: "F", city: "Detroit, MI" },
];

const FEATURE_LABELS = {
  amt: "Transaction amount",
  category: "Merchant category",
  merchant: "Merchant",
  gender: "Gender",
  city: "City",
  state: "State",
  zip: "ZIP code",
  lat: "Customer location",
  long: "Customer location",
  city_pop: "City population",
  job: "Occupation",
  unix_time: "Transaction timestamp",
  merch_lat: "Merchant location",
  merch_long: "Merchant location",
  transaction_hour: "Hour of transaction",
  transaction_month: "Month",
  transaction_day: "Day of month",
  transaction_weekday: "Day of week",
  age: "Customer age",
};

function factorText(f) {
  const label = FEATURE_LABELS[f.feature] || f.feature;
  return f.direction === "up"
    ? `${label} increases fraud risk`
    : `${label} decreases fraud risk`;
}
/* ================= HELPERS ================= */

function hourMeta(h) {
  h = parseInt(h, 10);
  let label;
  if (h === 0) label = "12 AM";
  else if (h < 12) label = h + " AM";
  else if (h === 12) label = "12 PM";
  else label = h - 12 + " PM";
  let Icon = Sun;
  if (h >= 0 && h < 5) Icon = Moon;
  else if (h >= 5 && h < 8) Icon = Sunrise;
  else if (h >= 8 && h < 18) Icon = Sun;
  else if (h >= 18 && h < 21) Icon = Sunset;
  else Icon = Moon;
  return { label, Icon };
}

function inr(n) {
  return "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

/* ================= SMALL HOOKS ================= */

function useCountUp(target, active, duration = 1300) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf;
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min((t - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(step);
      else setVal(target);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active, target, duration]);
  return val;
}

/* ================= PRESENTATIONAL BITS ================= */

function MetricCard({ label, target, decimals = 4, sub, active }) {
  const val = useCountUp(target, active);
  return (
    <div className="az-metric">
      <div className="az-metric-label">{label}</div>
      <div className="az-metric-value">{val.toFixed(decimals)}</div>
      <div className="az-metric-sub">{sub}</div>
    </div>
  );
}

function Curve({ id, points, colorVar, label, score, xLabel, yLabel }) {
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);
  const W = 300, H = 220, pad = 40;
  const toX = (x) => pad + x * (W - 2 * pad);
  const toY = (y) => H - pad - y * (H - 2 * pad);
  const d = "M" + points.map((p) => `${toX(p[0])},${toY(p[1])}`).join(" L");
  const fillD = d + ` L${toX(points[points.length - 1][0])},${toY(0)} L${toX(points[0][0])},${toY(0)} Z`;

  const onMove = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    let nearest = points[0], nd = Infinity;
    points.forEach((p) => {
      const dist = Math.abs(toX(p[0]) - mx);
      if (dist < nd) { nd = dist; nearest = p; }
    });
    setHover(nearest);
  };

  return (
    <div className="az-curve-card">
      <div className="az-curve-head">
        <span className="az-curve-title">{label}</span>
        <span className="az-curve-score">{score}</span>
      </div>
      <svg
        ref={svgRef}
        className="az-curve-svg"
        viewBox={`0 0 ${W} ${H}`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <clipPath id={`plot-clip-${id}`}>
            <rect x={pad} y={pad} width={W - 2 * pad} height={H - 2 * pad} />
          </clipPath>
        </defs>
        <path d={`M${pad},${pad} L${pad},${H - pad} L${W - pad},${H - pad}`} stroke="currentColor" opacity="0.15" fill="none" />
        {id === "roc" && (
          <line x1={toX(0)} y1={toY(0)} x2={toX(1)} y2={toY(1)} stroke="currentColor" opacity="0.15" strokeDasharray="4,4" />
        )}
        <g clipPath={`url(#plot-clip-${id})`}>
          <path d={fillD} fill={`var(${colorVar})`} opacity="0.08" />
          {hover && (() => {
            const r = 4.5, safe = r + 1; // +1 accounts for the stroke width
            const cx = Math.min(Math.max(toX(hover[0]), pad + safe), W - pad - safe);
            const cy = Math.min(Math.max(toY(hover[1]), pad + safe), H - pad - safe);
            return <circle cx={cx} cy={cy} r={r} fill={`var(${colorVar})`} stroke="var(--surface)" strokeWidth="2" />;
          })()}
        </g>
        <path d={d} stroke={`var(${colorVar})`} strokeWidth="2.25" fill="none" strokeLinecap="round" strokeLinejoin="round" />
<text
  x={W / 2}
  y={H - 5}
  textAnchor="middle"
  fontSize="10"
  fill="currentColor"
  opacity="0.6"
>
  {xLabel}
</text><text
  x="12"
  y={H / 2}
  textAnchor="middle"
  transform={`rotate(-90 12 ${H / 2})`}
  fontSize="10"
  fill="currentColor"
  opacity="0.6"
>
  {yLabel}
</text>{/* x-axis */}
<text x={toX(0)} y={H - pad + 15} textAnchor="middle" fontSize="7">0</text>
<text x={toX(0.5)} y={H - pad + 15} textAnchor="middle" fontSize="7">0.5</text>
<text x={toX(1)} y={H - pad + 15} textAnchor="middle" fontSize="7">1</text>

{/* y-axis */}
<text x={pad - 10} y={toY(0)} textAnchor="end" fontSize="7">0</text>
<text x={pad - 10} y={toY(0.5)} textAnchor="end" fontSize="7">0.5</text>
<text x={pad - 10} y={toY(1)} textAnchor="end" fontSize="7">1</text>
      </svg>
      <div className="az-curve-tooltip">
        {hover ? `${xLabel}: ${hover[0].toFixed(2)}  →  ${yLabel}: ${hover[1].toFixed(3)}` : "Hover the curve to inspect a threshold"}
      </div>
    </div>
  );
}
/* ================= MAIN APP ================= */

export default function FraudShieldApp() {
  const [theme, setTheme] = useState("light");
  const [amount, setAmount] = useState(2500);
  const [hour, setHour] = useState(10);
  const [age, setAge] = useState(34);
  const [category, setCategory] = useState(CATEGORIES.find((c) => c.id === "shopping_pos"));
  const [gender, setGender] = useState("M");
  const [cities, setCities] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [city, setCity] = useState(null);
  const [catOpen, setCatOpen] = useState(false);
  const [catQuery, setCatQuery] = useState("");
  const [cityOpen, setCityOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState("");

  const [status, setStatus] = useState("idle"); // idle | loading | done
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState(null);
  const [expandOpen, setExpandOpen] = useState(false);
  const [tab, setTab] = useState("model");

  const [feed, setFeed] = useState([]);
  const [pulsePoints, setPulsePoints] = useState(Array(40).fill(80));
  const [metricsOn, setMetricsOn] = useState(false);
  const [modelMetrics, setModelMetrics] = useState(null);

  const rootRef = useRef(null);
  const catRef = useRef(null);
  const cityRef = useRef(null);

  const loadingSteps = [
    "Validating transaction",
    "Preprocessing input features",
    "Running XGBoost inference",
    "Generating SHAP explanation",
    "Finalizing risk assessment",
  ];

  /* metrics count up once visible */
  useEffect(() => {
    const t = setTimeout(() => setMetricsOn(true), 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    fetch(`${API_BASE_URL}/metrics`)
      .then((res) => res.json())
      .then(setModelMetrics)
      .catch((err) => console.error("Failed to load metrics:", err));
  }, []);

  /* cities come from the backend's real city_reference data, not a
     hardcoded frontend list */
  useEffect(() => {
    fetch(`${API_BASE_URL}/cities`)
      .then((res) => res.json())
      .then((data) => {
        setCities(data);
        if (data.length > 0) setCity(data[0]);
      })
      .catch((err) => console.error("Failed to load cities:", err))
      .finally(() => setCitiesLoading(false));
  }, []);
  /* close dropdowns on outside click */
  useEffect(() => {
    function onClick(e) {
      if (catRef.current && !catRef.current.contains(e.target)) setCatOpen(false);
      if (cityRef.current && !cityRef.current.contains(e.target)) setCityOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  /* live feed — each tick asks the backend for one real transaction that
     was actually scored by the trained model (GET /live-feed), instead of
     faking probabilities/fraud flags with Math.random() on the client. */
  const addFeedRow = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/live-feed`);
      if (!res.ok) throw new Error("live-feed request failed");
      const data = await res.json();
      const ts = new Date(data.timestamp).toLocaleTimeString("en-US", {
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
      });
      setFeed((f) => [
        { id: Math.random().toString(36).slice(2), merch: data.merchant, amt: data.amount, isFraud: data.is_fraud, ts },
        ...f,
      ].slice(0, 4));

      // Pulse chart tracks the model's real fraud_probability for each
      // simulated transaction, rather than a random jitter/spike.
      setPulsePoints((pts) => {
        const next = pts.slice(1);
        next.push(20 + data.fraud_probability * 125);
        return next;
      });
    } catch (err) {
      console.error("Failed to load live feed:", err);
    }
  }, []);

  useEffect(() => {
    addFeedRow();
    const iv = setInterval(addFeedRow, 2600);
    return () => clearInterval(iv);
  }, [addFeedRow]);

  const runPredict = async () => {
  if (status === "loading" || !city) return;
  setStatus("loading");
  setLoadingStep(0);
  let step = 0;
  const iv = setInterval(() => {
    step++;
    if (step < loadingSteps.length) setLoadingStep(step);
  }, 420);

  try {
    const response = await fetch(`${API_BASE_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(amount),
        hour: Number(hour),
        age: Number(age),
        category: category.id,
        gender: gender,
        city: city.name,
      }),
    });

    if (!response.ok) throw new Error("Backend returned an error");
    const data = await response.json();

    clearInterval(iv);
    setLoadingStep(loadingSteps.length);
    setTimeout(() => {
  setResult({
  prob: data.fraud_probability,
  isFraud: data.is_fraud,
  topFactors: data.top_factors || [],
});
  setStatus("done");
}, 260);
  } catch (err) {
    clearInterval(iv);
    console.error("Prediction failed:", err);
    setStatus("idle");
    alert("Couldn't reach the backend. Make sure your FastAPI server is running (uvicorn main:app --reload).");
  }
};

  const useExample = () => {
    const ex = EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)];
    setAmount(ex.amt);
    setHour(ex.hour);
    setAge(ex.age);
    setCategory(CATEGORIES.find((c) => c.id === ex.cat) || CATEGORIES[0]);
    setGender(ex.gender);
    // Fallback guards against EXAMPLES referencing a city not present in
    // the fetched cities list (which would otherwise cause setCity(undefined)
    // and a crash on the next predict call).
    if (cities.length > 0) {
      setCity(cities.find((c) => c.name === ex.city) || cities[0]);
    }
  };


  const filteredCats = useMemo(
    () => CATEGORIES.filter((c) => c.label.toLowerCase().includes(catQuery.toLowerCase())),
    [catQuery]
  );

  const filteredCities = useMemo(
    () => cities.filter((c) => c.name.toLowerCase().includes(cityQuery.toLowerCase())),
    [cities, cityQuery]
  );

  const pulsePath = pulsePoints.map((y, i) => `${(i * 400) / 39},${y}`).join(" ");

  let level = "low";
  if (result) {
    if (result.prob >= 0.6) level = "high";
    else if (result.prob >= 0.25) level = "medium";
  }
  return (
    <div className={`az-root az-${theme}`} data-theme={theme} ref={rootRef}>
      <style>{CSS}</style>

      <nav className="az-nav">
        <div className="az-wrap az-nav-inner">
          <div className="az-brand">
            <svg className="az-brand-mark" viewBox="0 0 32 32" fill="none">
              <path d="M16 2L28 7V15C28 22.5 22.8 27.8 16 30C9.2 27.8 4 22.5 4 15V7L16 2Z" fill="url(#az-g1)" />
              <path d="M11 16.5L14.3 19.8L21 12.5" stroke="var(--surface)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="az-g1" x1="4" y1="2" x2="28" y2="30">
                  <stop stopColor="var(--accent)" />
                  <stop offset="1" stopColor="var(--accent-2)" />
                </linearGradient>
              </defs>
            </svg>
            FraudShield
          </div>

          <div className="az-nav-links">
            <a className="az-nav-link" onClick={() => document.getElementById("az-simulator")?.scrollIntoView({ behavior: "smooth" })}>Transaction Analysis</a>
            <a className="az-nav-link" onClick={() => document.getElementById("az-model")?.scrollIntoView({ behavior: "smooth" })}>Model Performance</a>
            <a className="az-nav-link" onClick={() => document.getElementById("az-stats")?.scrollIntoView({ behavior: "smooth" })}>About</a>
          </div>

          <div className="az-nav-right">
            <div className="az-nav-status">
              <Activity size={13} className="az-status-icon" />
              Pipeline live
            </div>
            <a className="az-btn az-btn-ghost az-github-btn" href="https://github.com/siyamlk/credit_card_fraud_prediction" target="_blank" rel="noopener noreferrer">
              View Source →
            </a>
            <button
              className="az-theme-toggle"
              aria-label="Toggle theme"
              onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            >
              <span className="az-toggle-knob">
                {theme === "light" ? <Sun size={12} /> : <Moon size={12} />}
              </span>
            </button>
          </div>
        </div>
      </nav>

      <section className="az-hero">
        <div className="az-wrap az-hero-grid">
          <div>
            <div className="az-eyebrow">Real-time transaction scoring</div>
            <h1 className="az-headline">
              Catch fraud in<br />
              <span className="az-accent-text">milliseconds</span>, not months.
            </h1>
            <p className="az-hero-sub">
              FraudShield scores every card transaction against a tuned XGBoost model trained on over a million real
              transactions — then explains exactly why, using SHAP.
            </p>
            <div className="az-badges">
              {["XGBoost", "scikit-learn", "pandas", "FastAPI", "React", "SHAP"].map((b) => (
                <span className="az-badge" key={b}>{b}</span>
              ))}
            </div>
            <div className="az-hero-ctas">
              <button
                className="az-btn az-btn-primary"
                onClick={() => document.getElementById("az-simulator")?.scrollIntoView({ behavior: "smooth" })}
              >
                Make a prediction
              </button>
              <button
                className="az-btn az-btn-ghost"
                onClick={() => document.getElementById("az-stats")?.scrollIntoView({ behavior: "smooth" })}
              >
                View dataset
              </button>
            </div>
          </div>

          <div className="az-pulse-card">
            <div className="az-pulse-card-head">
              <div className="az-pulse-card-title">Risk Pulse — Live Feed</div>
              <div className="az-pulse-live">
                <span className="az-pulse-dot" /> streaming
              </div>
            </div>
            <div className="az-pulse-svg-wrap">
              <svg viewBox="0 0 400 160" width="100%" height="100%" preserveAspectRatio="none">
                <polyline fill="none" stroke="url(#az-pulseGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={pulsePath} />
                <defs>
                  <linearGradient id="az-pulseGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="var(--accent)" />
                    <stop offset="50%" stopColor="var(--accent-2)" />
                    <stop offset="100%" stopColor="var(--accent)" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="az-pulse-feed">
              {feed.map((row) => (
                <div className="az-feed-row" key={row.id}>
                  <span className="az-feed-ts">{row.ts}</span>
                  <span className="az-feed-merch">{row.merch}</span>
                  <span className="az-feed-amt">{inr(row.amt)}</span>
                  <span className={`az-feed-tag ${row.isFraud ? "risk" : "ok"}`}>
                    {row.isFraud ? "Flagged" : "Approved"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="az-metrics-section">
        <div className="az-wrap az-metrics-grid">
          <MetricCard label="ROC-AUC" target={modelMetrics?.roc_auc ?? 0} sub="tuned XGBoost" active={metricsOn && !!modelMetrics} />
<MetricCard label="Avg Precision" target={modelMetrics?.average_precision ?? 0} sub="PR-AUC" active={metricsOn && !!modelMetrics} />
<MetricCard label="F1-Score" target={modelMetrics?.f1_score ?? 0} sub="fraud class" active={metricsOn && !!modelMetrics} />
<MetricCard label="Precision" target={modelMetrics?.precision ?? 0} sub={`recall ${modelMetrics?.recall ? (modelMetrics.recall * 100).toFixed(2) : "—"}%`} active={metricsOn && !!modelMetrics} />
          <div className="az-metric">
            <div className="az-metric-label">Pipeline</div>
            <div className="az-metric-value az-metric-status">
              <span className="az-status-dot" /> Ready
            </div>
            <div className="az-metric-sub">preprocess → model → SHAP</div>
          </div>
        </div>
      </section>

      <section className="az-sim-section" id="az-simulator">
        <div className="az-wrap">
          <div className="az-section-head">
            <div className="az-section-eyebrow">Transaction Simulator</div>
            <h2 className="az-section-title">Score a transaction</h2>
            <p className="az-section-desc">
              Build a transaction using the controls below and receive an instant fraud risk assessment powered by
              XGBoost, along with an interpretable explanation using SHAP.
            </p>
          </div>

          <div className="az-sim-grid">
            <div className="az-panel">
              <div className="az-field">
                <div className="az-field-label" style={{ alignItems: "center" }}>
                  <span>Transaction amount</span>
                  <span className="az-amount-input-wrap">
                    <span className="az-amount-prefix">₹</span>
                    <input
                      type="text" inputMode="decimal" value={amount}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9.]/g, "");
                        if (raw === "") { setAmount(0); return; }
                        const n = Number(raw);
                        if (!Number.isNaN(n)) setAmount(Math.min(n, 500000));
                      }}
                      onBlur={(e) => {
                        const n = Number(e.target.value.replace(/[^0-9.]/g, ""));
                        setAmount(Math.max(1, Math.min(Number.isNaN(n) ? 1 : n, 500000)));
                      }}
                      className="az-amount-input"
                    />
                  </span>
                </div>
                <input
                  type="range" min="1" max="100000" step="1" value={Math.min(amount, 100000)}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="az-range"
                />
                <div className="az-range-ticks"><span>₹1</span><span>₹1,00,000</span></div>
              </div>

              <div className="az-field">
                <div className="az-field-label">
                  <span>Hour of transaction</span>
                  <span className="az-field-value az-field-value-icon">
                    {(() => { const { Icon, label } = hourMeta(hour); return (<><Icon size={14} />{label}</>); })()}
                  </span>
                </div>
                <input
                  type="range" min="0" max="23" step="1" value={hour}
                  onChange={(e) => setHour(Number(e.target.value))}
                  className="az-range"
                />
                <div className="az-range-ticks"><span>12 AM</span><span>11 PM</span></div>
              </div>

              <div className="az-field">
                <div className="az-field-label">
                  <span>Customer age</span>
                  <span className="az-field-value">{age}</span>
                </div>
                <input
                  type="range" min="18" max="90" step="1" value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  className="az-range"
                />
                <div className="az-range-ticks"><span>18</span><span>90</span></div>
              </div>

              <div className="az-field">
                <div className="az-field-label"><span>Merchant category</span></div>
                <div className="az-dropdown" ref={catRef}>
                  <button type="button" className="az-dropdown-input" onClick={() => setCatOpen((o) => !o)}>
                    <span className="az-dropdown-input-label">
                      <category.icon size={15} /> {category.label}
                    </span>
                    <ChevronDown size={15} className={`az-chev ${catOpen ? "open" : ""}`} />
                  </button>
                  {catOpen && (
                    <div className="az-dropdown-list">
                      <div className="az-dropdown-search-wrap">
                        <Search size={13} className="az-search-icon" />
                        <input
                          className="az-dropdown-search"
                          placeholder="Search category…"
                          value={catQuery}
                          onChange={(e) => setCatQuery(e.target.value)}
                          autoFocus
                        />
                      </div>
                      {filteredCats.map((c) => (
                        <div
                          key={c.id}
                          className={`az-dropdown-item ${c.id === category.id ? "selected" : ""}`}
                          onClick={() => { setCategory(c); setCatOpen(false); setCatQuery(""); }}
                        >
                          <c.icon size={15} /> {c.label}
                          {c.id === category.id && <Check size={14} className="az-check" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="az-field">
                <div className="az-field-label"><span>Gender</span></div>
                <div className="az-gender-row">
                  {["M", "F"].map((g) => (
                    <button
                      type="button" key={g}
                      className={`az-gender-opt ${gender === g ? "selected" : ""}`}
                      onClick={() => setGender(g)}
                    >
                      {g === "M" ? "Male" : "Female"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="az-field">
                <div className="az-field-label"><span>Location</span></div>
                <div className="az-dropdown" ref={cityRef}>
                  <button
                    type="button"
                    className="az-dropdown-input"
                    onClick={() => setCityOpen((o) => !o)}
                    disabled={citiesLoading || !city}
                  >
                    <span className="az-dropdown-input-label">
                      <MapPin size={15} /> {citiesLoading ? "Loading cities…" : city ? city.name : "No cities available"}
                    </span>
                    <ChevronDown size={15} className={`az-chev ${cityOpen ? "open" : ""}`} />
                  </button>
                  {cityOpen && city && (
                    <div className="az-dropdown-list">
                      <div className="az-dropdown-search-wrap">
                        <Search size={13} className="az-search-icon" />
                        <input
                          className="az-dropdown-search"
                          placeholder="Search city…"
                          value={cityQuery}
                          onChange={(e) => setCityQuery(e.target.value)}
                          autoFocus
                        />
                      </div>
                      {filteredCities.map((c) => (
                        <div
                          key={c.name}
                          className={`az-dropdown-item ${c.name === city.name ? "selected" : ""}`}
                          onClick={() => { setCity(c); setCityOpen(false); setCityQuery(""); }}
                        >
                          <MapPin size={15} /> {c.name}
                          {c.name === city.name && <Check size={14} className="az-check" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button" className="az-example-btn" onClick={useExample} disabled={cities.length === 0}>
                  <Shuffle size={14} /> Use example transaction
                </button>
              </div>

              <button
                type="button"
                className="az-btn az-btn-primary az-predict-btn"
                onClick={runPredict}
                disabled={status === "loading" || !city}
              >
                <Shield size={16} /> Analyze Transaction
              </button>
            </div>

            <div className="az-panel az-result-panel">
              {status === "idle" && (
                <div className="az-result-empty">
                  <div className="az-empty-icon"><Shield size={26} strokeWidth={1.6} /></div>
                  <div className="az-empty-title">Ready to analyze a transaction</div>
                  <div className="az-empty-sub">
                    Fill in the transaction details and click <b>Analyze Transaction</b> to generate a real-time
                    fraud risk assessment.
                  </div>
                </div>
              )}

              {status === "loading" && (
                <div className="az-loading-state">
                  <div className="az-loading-icon"><Shield size={22} strokeWidth={1.6} /></div>
                  <div className="az-loading-checklist">
                    {loadingSteps.map((s, i) => (
                      <div
                        key={s}
                        className={`az-loading-row ${i < loadingStep ? "done" : i === loadingStep ? "active" : "pending"}`}
                      >
                        <span className="az-loading-mark">
                          {i < loadingStep ? <Check size={13} /> : i === loadingStep ? <span className="az-loading-dot" /> : null}
                        </span>
                        <span className="az-loading-text">{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {status === "done" && result && (
                <div className="az-result-content">
                  <div className={`az-decision-card ${level}`}>
                    <div className="az-decision-header">
                      <div className={`az-risk-icon ${level}`}><Shield size={20} /></div>
                      <div>
                        <span className={`az-risk-badge ${level}`}>
                          {level === "high" ? "High Risk" : level === "medium" ? "Medium Risk" : "Low Risk"}
                        </span>
                        <div className="az-risk-subtitle">
                          {level === "high"
                            ? "Manual Review Recommended"
                            : level === "medium"
                            ? "Additional Verification Suggested"
                            : "Transaction Approved"}
                        </div>
                      </div>
                    </div>

                    <div className="az-gauge-block">
                      <div className="az-gauge-labels">
                        <span>Low</span>
                        <span className="az-risk-prob">{(result.prob * 100).toFixed(1)}%</span>
                        <span>High</span>
                      </div>
                      <div className="az-gauge-track">
                        <div className={`az-gauge-fill ${level}`} style={{ width: `${result.prob * 100}%` }} />
                        <div className="az-gauge-marker" style={{ left: `${result.prob * 100}%` }} />
                      </div>
                      <div className="az-gauge-caption">Fraud Probability</div>
                    </div>

                    <div className="az-decision-divider" />
                    <div className="az-stat-row">
  <div className="az-decision-label">Prediction</div>
  <div className="az-decision-text">
    {result.isFraud ? "Fraud" : "Legitimate"}
  </div>
</div>

                    <div className="az-stat-row">
                      <div className="az-decision-label">Decision</div>
                      <div className="az-decision-text">
                        {level === "high"
                          ? "This transaction should be flagged for manual review."
                          : level === "medium"
                          ? "This transaction should be monitored for additional verification."
                          : "This transaction can be processed automatically."}
                      </div>
                    </div>
                  </div>

                  <div className="az-reasons-block">
  <div className="az-block-title">Top Contributing Factors</div>
  {result.topFactors.slice(0, 3).map((f, i) => (
    <div className="az-reason-card" key={i}>
      {f.direction === "up"
        ? <ArrowUp size={14} className="az-reason-check" />
        : <ArrowDown size={14} className="az-reason-check" />}
      <div className="az-factor-text">{factorText(f)}</div>
    </div>
  ))}
</div>

                  <div className="az-expand-section">
                    <button type="button" className="az-expand-header" onClick={() => setExpandOpen((o) => !o)}>
                      <span>About this prediction</span>
                      <ChevronDown size={16} className={`az-chev ${expandOpen ? "open" : ""}`} />
                    </button>
                    {expandOpen && (
                      <div className="az-expand-body">
                        <div className="az-segmented">
                          {["model", "cv", "shap"].map((t) => (
                            <button
                              type="button" key={t}
                              className={`az-segmented-btn ${tab === t ? "active" : ""}`}
                              onClick={() => setTab(t)}
                            >
                              {t === "model" ? "Pipeline" : t === "cv" ? "Performance" : "Explainability"}
                            </button>
                          ))}
                        </div>

                        {tab === "model" && (
                          <div className="az-info-grid">
                            <div className="az-info-card">
                              <div className="az-info-card-label">Algorithm</div>
                              <div className="az-info-card-value">XGBoost Classifier</div>
                            </div>
                            <div className="az-info-card">
                              <div className="az-info-card-label">Pipeline</div>
                              <div className="az-info-card-value">Preprocess → Model → SHAP</div>
                            </div>
                            <div className="az-info-card">
                              <div className="az-info-card-label">Training samples</div>
                              <div className="az-info-card-value">838,860</div>
                            </div>
                            <div className="az-info-card">
                              <div className="az-info-card-label">Features</div>
                              <div className="az-info-card-value">19 raw signals</div>
                            </div>
                            <div className="az-info-card">
                              <div className="az-info-card-label">Output</div>
                              <div className="az-info-card-value">Fraud probability (0–1)</div>
                            </div>
                          </div>
                        )}

                       {tab === "cv" && (
  <div className="az-info-grid">
    <div className="az-info-card">
      <div className="az-info-card-label">Validation</div>
      <div className="az-info-card-value">5-fold cross-validation</div>
    </div>
    <div className="az-info-card">
      <div className="az-info-card-label">ROC-AUC</div>
      <div className="az-info-card-value az-mono">{modelMetrics?.roc_auc ?? "—"}</div>
    </div>
    <div className="az-info-card">
      <div className="az-info-card-label">Average precision</div>
      <div className="az-info-card-value az-mono">{modelMetrics?.average_precision ?? "—"}</div>
    </div>
    <div className="az-info-card">
      <div className="az-info-card-label">F1 score</div>
      <div className="az-info-card-value az-mono">{modelMetrics?.f1_score ?? "—"}</div>
    </div>
  </div>
)}

                       {tab === "shap" && (
  <div className="az-shap-block">
    <div className="az-block-title">Top contributing factors</div>
    <div className="az-shap-bars">
      {(() => {
        const maxAbs = Math.max(...result.topFactors.map((f) => Math.abs(f.shap_value)), 0.0001);
        return result.topFactors.map((f) => (
          <div className="az-shap-row" key={f.feature}>
            <div className="az-shap-row-label">
              {f.direction === "up" ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
              <span className="az-shap-row-name">{FEATURE_LABELS[f.feature] || f.feature}</span>
              <span className={`az-shap-row-value ${f.direction}`}>
                {f.shap_value > 0 ? "+" : ""}
                {f.shap_value.toFixed(3)}
              </span>
            </div>
            <div className="az-shap-track">
              <div
                className={`az-shap-fill ${f.direction}`}
                style={{ width: `${(Math.abs(f.shap_value) / maxAbs) * 100}%` }}
              />
            </div>
          </div>
        ));
      })()}
    </div>
    <p className="az-shap-note">
      Positive contributions increase fraud probability while negative contributions reduce it.
    </p>
  </div>
)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="az-pipeline-section" id="az-model">
        <div className="az-wrap">
          <div className="az-pipeline-title">How the prediction is generated</div>
          <div className="az-pipeline-flow">
            {["Transaction", "Preprocessing", "XGBoost", "SHAP Explainability", "Fraud Prediction"].map((step, i, arr) => (
              <div className="az-pipeline-step-wrap" key={step}>
                <div className="az-pipeline-step">{step}</div>
                {i < arr.length - 1 && <ChevronRight size={16} className="az-pipeline-arrow" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="az-curves-section">
        <div className="az-wrap">
          <div className="az-section-head">
            <div className="az-section-eyebrow">Model Evaluation</div>
            <h2 className="az-section-title">Validation curves</h2>
            <p className="az-section-desc">Curves computed from the tuned model&rsquo;s validation performance. Hover to inspect thresholds.</p>
          </div>
          <div className="az-curves-grid">
            {modelMetrics && (
              <>
                <Curve
  id="roc"
  points={modelMetrics.roc_points}
  colorVar="--accent"
  label="ROC Curve"
  score={`AUC ${modelMetrics.roc_auc}`}
  xLabel="False Positive Rate"
  yLabel="True Positive Rate"
/>
                <Curve id="pr" points={modelMetrics.pr_points} colorVar="--accent-2" label="Precision–Recall Curve" score={`AP ${modelMetrics.average_precision}`} xLabel="Recall" yLabel="Precision" />
              </>
            )}
          </div>
        </div>
      </section>

      <section className="az-stats-section" id="az-stats">
        <div className="az-wrap">
          <div className="az-section-head">
            <div className="az-section-eyebrow">Training Data</div>
            <h2 className="az-section-title">Dataset statistics</h2>
          </div>
          <div className="az-stats-grid">
            <div className="az-stat-card"><div className="az-stat-value">1,048,575</div><div className="az-stat-label">Total transactions</div></div>
            <div className="az-stat-card"><div className="az-stat-value">6,006</div><div className="az-stat-label">Confirmed fraud cases</div></div>
            <div className="az-stat-card"><div className="az-stat-value">0.57%</div><div className="az-stat-label">Fraud rate</div></div>
          </div>
        </div>
      </section>

      <section className="az-scope-section">
        <div className="az-wrap">
          <div className="az-scope-card">
            <div className="az-scope-head">
              <Activity size={14} />
              <span>Model Scope</span>
            </div>
            <p className="az-scope-text">
              Predictions are generated using patterns learned from the training dataset.
            </p>
            <div className="az-scope-support-label">Supported Inputs</div>
            <div className="az-scope-grid">
              <div className="az-scope-item"><Check size={13} /> Cities from dataset</div>
              <div className="az-scope-item"><Check size={13} /> Merchant categories</div>
              <div className="az-scope-item"><Check size={13} /> Transaction types</div>
            </div>
          </div>
        </div>
      </section>

      <footer className="az-footer">
        <div className="az-wrap az-footer-inner">
          <span className="az-footer-name">
            Built by Siya Malik <Heart size={12} className="az-footer-heart" />
          </span>
          <span className="az-footer-links">
            <a href="https://github.com/siyamlk/credit_card_fraud_prediction" target="_blank" rel="noopener noreferrer">GitHub</a>
            <span className="az-footer-dot">·</span>
            <a href="https://www.linkedin.com/in/siya-m-704141219" target="_blank" rel="noopener noreferrer">LinkedIn</a>
          </span>
        </div>
      </footer>

    </div>
  );
}

/* ================= CSS ================= */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

.az-root{
  --bg:#F5F5F0;
  --bg-2:#EFEFE8;
  --surface:#F5F5F0;
  --surface-raised:#FAFAF6;
  --border:rgba(30,28,20,0.12);
  --border-strong:rgba(30,28,20,0.22);
  --ink:#241F17;
  --ink-soft:#6B6350;
  --ink-faint:#948B72;
  --accent:#2E5C4E;
  --accent-2:#8A6B3B;
  --accent-soft:rgba(46,92,78,0.09);
  --danger:#9C3E30;
  --danger-soft:rgba(156,62,48,0.10);
  --warning:#9C6F22;
  --warning-soft:rgba(156,111,34,0.12);
  --safe:#3B7350;
  --safe-soft:rgba(59,115,80,0.10);
  --shadow-sm:0 1px 2px rgba(30,28,20,0.06);
  --shadow-md:0 4px 16px rgba(30,28,20,0.07);
  --shadow-lg:0 14px 36px rgba(30,28,20,0.11);
  --radius:10px;
  --radius-sm:7px;
  font-family:'JetBrains Mono',monospace;
  background:var(--bg);
  color:var(--ink);
  min-height:100vh;
  position:relative;
  -webkit-font-smoothing:antialiased;
  transition:background 0.3s ease, color 0.3s ease;
}
.az-root.az-dark{
  --bg:#1B1712;
  --bg-2:#221C15;
  --surface:#262019;
  --surface-raised:#2C2519;
  --border:rgba(232,222,200,0.09);
  --border-strong:rgba(232,222,200,0.17);
  --ink:#E4DAC0;
  --ink-soft:#A69C84;
  --ink-faint:#726A56;
  --accent:#7C9E8E;
  --accent-2:#B49B6C;
  --accent-soft:rgba(124,158,142,0.13);
  --danger:#B3806F;
  --danger-soft:rgba(179,128,111,0.15);
  --warning:#B1946A;
  --warning-soft:rgba(177,148,106,0.15);
  --safe:#7FA98C;
  --safe-soft:rgba(127,169,140,0.15);
  --shadow-sm:0 1px 2px rgba(0,0,0,0.35);
  --shadow-md:0 6px 18px rgba(0,0,0,0.35);
  --shadow-lg:0 16px 40px rgba(0,0,0,0.5);
}
.az-root *{box-sizing:border-box;}
.az-wrap{margin:0 auto; padding:0 28px;}
.az-mono{font-family:'IBM Plex Mono',monospace;}

/* NAV */
.az-nav{position:sticky; top:0; z-index:50; background:color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter:blur(10px); border-bottom:1px solid var(--border);}
.az-nav-inner{display:flex; align-items:center; justify-content:space-between; padding:15px 28px; gap:20px;}
.az-nav-links{display:flex; align-items:center; gap:24px;}
.az-nav-link{font-size:13.5px; font-weight:500; color:var(--ink-soft); cursor:pointer; transition:color 0.15s ease;}
.az-nav-link:hover{color:var(--ink);}
.az-github-btn{padding:8px 14px; font-size:12.5px; text-decoration:none;}
.az-brand{display:flex; align-items:center; gap:10px; font-family:'JetBrains Mono',monospace; font-weight:700; font-size:19px; letter-spacing:-0.01em;}
.az-brand-mark{width:30px; height:30px; flex-shrink:0;}
.az-nav-right{display:flex; align-items:center; gap:16px;}
.az-nav-status{display:flex; align-items:center; gap:6px; font-size:12.5px; color:var(--ink-soft); font-family:'IBM Plex Mono',monospace;}
.az-status-icon{color:var(--safe);}
.az-theme-toggle{width:42px; height:24px; border-radius:20px; background:var(--surface); border:1px solid var(--border-strong); position:relative; cursor:pointer; display:flex; align-items:center; padding:2px;}
.az-toggle-knob{width:18px; height:18px; border-radius:50%; background:var(--surface-raised); border:1px solid var(--border-strong); color:var(--ink-soft); display:flex; align-items:center; justify-content:center; transition:transform 0.25s ease; transform:translateX(0);}
.az-dark .az-toggle-knob{transform:translateX(18px); color:var(--accent);}

/* HERO */
.az-hero{padding:64px 0 36px;}
.az-hero-grid{display:grid; grid-template-columns:1.05fr 0.95fr; gap:48px; align-items:center;}
.az-eyebrow{display:inline-flex; align-items:center; gap:8px; font-family:'IBM Plex Mono',monospace; font-size:12px; letter-spacing:0.05em; color:var(--accent); background:var(--accent-soft); border:1px solid color-mix(in srgb, var(--accent) 28%, transparent); padding:6px 12px; border-radius:100px; margin-bottom:22px; text-transform:uppercase;}
.az-headline{font-family:'JetBrains Mono',monospace; font-weight:800; font-size:48px; line-height:1.08; letter-spacing:-0.01em; margin-bottom:20px;}
.az-accent-text{background:linear-gradient(100deg, var(--accent), var(--accent-2)); -webkit-background-clip:text; background-clip:text; color:transparent;}
.az-hero-sub{font-size:16.5px; color:var(--ink-soft); line-height:1.65; max-width:480px; margin-bottom:26px;}
.az-badges{display:flex; flex-wrap:wrap; gap:8px; margin-bottom:32px;}
.az-badge{font-family:'IBM Plex Mono',monospace; font-size:12px; padding:6px 12px; border-radius:6px; background:var(--surface); border:1px solid var(--border); color:var(--ink-soft);}

.az-btn{
  font-family:'JetBrains Mono',monospace; font-weight:600; font-size:13.5px; letter-spacing:0.005em;
  padding:10px 18px; border-radius:6px; border:1px solid transparent; cursor:pointer;
  display:inline-flex; align-items:center; justify-content:center; gap:7px;
  transition:background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, transform 0.1s ease;
}
.az-btn:active{transform:scale(0.98);}
.az-btn-primary{background:var(--accent); color:var(--surface-raised); box-shadow:var(--shadow-sm);}
.az-btn-primary:hover{background:color-mix(in srgb, var(--accent) 91%, black); box-shadow:var(--shadow-md);}
.az-btn-primary:active{background:color-mix(in srgb, var(--accent) 84%, black); box-shadow:var(--shadow-sm);}
.az-btn-ghost{background:var(--surface); color:var(--ink); border:1px solid var(--border-strong);}
.az-btn-ghost:hover{background:var(--bg-2); border-color:var(--ink-faint);}
.az-hero-ctas{display:flex; gap:10px; flex-wrap:wrap;}

.az-pulse-card{background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); box-shadow:var(--shadow-lg); padding:24px 22px 18px; transition:transform 0.2s ease, box-shadow 0.2s ease;}
.az-pulse-card:hover{transform:translateY(-2px);}
.az-pulse-card-head{display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;}
.az-pulse-card-title{font-family:'IBM Plex Mono',monospace; font-size:11.5px; color:var(--ink-faint); text-transform:uppercase; letter-spacing:0.05em;}
.az-pulse-live{font-family:'IBM Plex Mono',monospace; font-size:11px; color:var(--safe); display:flex; align-items:center; gap:5px;}
.az-pulse-dot{width:6px; height:6px; border-radius:50%; background:var(--safe);}
.az-status-dot{display:inline-block; width:7px; height:7px; border-radius:50%; background:var(--safe); margin-right:6px;}
.az-pulse-svg-wrap{width:100%; height:150px; margin:8px 0 2px; color:var(--ink);}
.az-pulse-feed{display:flex; flex-direction:column; gap:8px; margin-top:8px;}
.az-feed-row{display:flex; align-items:center; gap:9px; font-family:'IBM Plex Mono',monospace; font-size:11.5px; padding:8px 10px; border-radius:7px; background:var(--bg-2); border:1px solid var(--border); overflow:hidden; animation:az-feed-in 0.35s ease;}
@keyframes az-feed-in{from{opacity:0; transform:translateY(-6px);} to{opacity:1; transform:translateY(0);}}
.az-feed-ts{color:var(--ink-faint); flex-shrink:0; font-size:10.5px;}
.az-feed-merch{overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;}
.az-feed-amt{color:var(--ink-soft); flex-shrink:0;}
.az-feed-tag{padding:2px 8px; border-radius:5px; font-size:10px; font-weight:600; flex-shrink:0;}
.az-feed-tag.ok{background:var(--safe-soft); color:var(--safe);}
.az-feed-tag.risk{background:var(--danger-soft); color:var(--danger);}

/* METRICS */
.az-metrics-section{padding:10px 0 52px;}
.az-metrics-grid{display:grid; grid-template-columns:repeat(5,1fr); gap:12px;}
.az-metric{background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-sm); padding:18px 16px; box-shadow:var(--shadow-sm); transition:transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;}
.az-metric:hover{transform:translateY(-2px); box-shadow:var(--shadow-md); border-color:var(--border-strong);}
.az-metric-label{font-size:11.5px; color:var(--ink-faint); font-family:'IBM Plex Mono',monospace; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:9px;}
.az-metric-value{font-family:'IBM Plex Mono',monospace; font-weight:600; font-size:24px; letter-spacing:-0.01em;}
.az-metric-status{font-size:16px; color:var(--safe); display:flex; align-items:center;}
.az-metric-sub{font-size:11px; color:var(--safe); margin-top:6px; font-family:'IBM Plex Mono',monospace;}

/* SECTION HEAD */
.az-section-head{margin-bottom:26px;}
.az-section-eyebrow{font-family:'IBM Plex Mono',monospace; font-size:11.5px; color:var(--accent); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:8px;}
.az-section-title{font-family:'JetBrains Mono',monospace; font-weight:700; font-size:28px; letter-spacing:-0.01em;}
.az-section-desc{color:var(--ink-soft); font-size:14.5px; margin-top:8px; max-width:560px;}

/* SIMULATOR */
.az-sim-section{padding:20px 0 64px;}
.az-sim-grid{display:grid; grid-template-columns:1fr 1fr; gap:24px; align-items:start;}
.az-panel{background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); box-shadow:var(--shadow-md); padding:30px;}
.az-field{margin-bottom:26px;}
.az-field-label{display:flex; justify-content:space-between; align-items:baseline; margin-bottom:11px;}
.az-field-label span:first-child{font-size:13px; font-weight:600; color:var(--ink);}
.az-field-value{font-family:'IBM Plex Mono',monospace; font-size:13.5px; color:var(--accent); font-weight:600;}
.az-field-value-icon{display:flex; align-items:center; gap:5px;}

.az-amount-input-wrap{display:flex; align-items:center; gap:2px; padding:3px 9px; border-radius:6px; border:1px solid var(--border-strong); background:var(--bg-2); transition:border-color 0.15s ease;}
.az-amount-input-wrap:focus-within{border-color:var(--accent);}
.az-amount-prefix{font-family:'IBM Plex Mono',monospace; font-size:13px; color:var(--ink-faint);}
.az-amount-input{width:84px; border:none; background:transparent; outline:none; font-family:'IBM Plex Mono',monospace; font-size:13px; font-weight:600; color:var(--ink); text-align:right; padding:4px 0;}
.az-range{-webkit-appearance:none; appearance:none; width:100%; height:5px; border-radius:4px; background:var(--bg-2); outline:none; accent-color:var(--accent);}
.az-range::-webkit-slider-thumb{-webkit-appearance:none; width:18px; height:18px; border-radius:50%; background:var(--accent); cursor:pointer; border:3px solid var(--surface); box-shadow:var(--shadow-sm);}
.az-range::-moz-range-thumb{width:18px; height:18px; border-radius:50%; border:3px solid var(--surface); background:var(--accent); cursor:pointer;}
.az-range-ticks{display:flex; justify-content:space-between; margin-top:6px; font-size:10.5px; color:var(--ink-faint); font-family:'IBM Plex Mono',monospace;}

.az-dropdown{position:relative;}
.az-dropdown-input{width:100%; padding:11px 13px; border-radius:7px; border:1px solid var(--border-strong); background:var(--bg-2); color:var(--ink); font-family:'JetBrains Mono',monospace; font-size:13.5px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; transition:border-color 0.15s ease;}
.az-dropdown-input:hover{border-color:var(--accent);}
.az-dropdown-input-label{display:flex; align-items:center; gap:8px;}
.az-chev{transition:transform 0.15s ease; color:var(--ink-faint);}
.az-chev.open{transform:rotate(180deg);}
.az-dropdown-list{position:absolute; top:calc(100% + 6px); left:0; right:0; max-height:230px; overflow-y:auto; background:var(--surface-raised); border:1px solid var(--border-strong); border-radius:9px; box-shadow:var(--shadow-lg); z-index:20; padding:6px;}
.az-dropdown-search-wrap{position:relative; margin-bottom:6px;}
.az-search-icon{position:absolute; left:9px; top:50%; transform:translateY(-50%); color:var(--ink-faint);}
.az-dropdown-search{width:100%; padding:8px 10px 8px 30px; border-radius:7px; border:1px solid var(--border); background:var(--bg-2); color:var(--ink); font-size:13px; font-family:'JetBrains Mono',monospace; outline:none;}
.az-dropdown-item{padding:9px 10px; border-radius:6px; font-size:13px; cursor:pointer; display:flex; align-items:center; gap:9px;}
.az-dropdown-item:hover{background:var(--accent-soft);}
.az-dropdown-item.selected{background:var(--accent-soft); color:var(--accent); font-weight:600;}
.az-check{margin-left:auto;}

.az-gender-row{display:flex; gap:8px;}
.az-gender-opt{flex:1; padding:10px; border-radius:7px; border:1px solid var(--border-strong); background:var(--bg-2); color:var(--ink); text-align:center; font-size:13px; font-weight:500; cursor:pointer; font-family:'JetBrains Mono',monospace; transition:border-color 0.15s ease, background-color 0.15s ease;}
.az-gender-opt:hover{border-color:var(--ink-faint);}
.az-gender-opt.selected{background:var(--accent-soft); border-color:var(--accent); color:var(--accent); font-weight:600;}

.az-example-btn{width:100%; margin-top:10px; padding:10px; border-radius:7px; border:1px dashed var(--border-strong); background:transparent; color:var(--ink-soft); font-size:12.5px; cursor:pointer; font-family:'JetBrains Mono',monospace; display:flex; align-items:center; justify-content:center; gap:7px; transition:border-color 0.15s ease, color 0.15s ease;}
.az-example-btn:hover{border-color:var(--accent); color:var(--accent);}

.az-predict-btn{width:100%; padding:13px 20px; margin-top:6px; font-size:14px;}
.az-predict-btn:disabled{opacity:0.6; cursor:default; box-shadow:none;}

/* RESULT PANEL */
.az-result-panel{min-height:500px; display:flex; flex-direction:column;}
.az-result-empty{flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:14px; padding:40px 24px;}
.az-empty-icon{width:56px; height:56px; border-radius:14px; display:flex; align-items:center; justify-content:center; background:var(--accent-soft); color:var(--accent);}
.az-empty-title{font-size:15.5px; font-weight:700; color:var(--ink); font-family:'JetBrains Mono',monospace;}
.az-empty-sub{font-size:13.5px; color:var(--ink-soft); line-height:1.6; max-width:300px;}
.az-loading-state{flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:22px; padding:40px 24px;}
.az-loading-icon{width:48px; height:48px; border-radius:12px; display:flex; align-items:center; justify-content:center; background:var(--accent-soft); color:var(--accent); animation:az-pulse-icon 1.6s ease-in-out infinite;}
@keyframes az-pulse-icon{0%,100%{opacity:1;}50%{opacity:0.55;}}
.az-loading-checklist{display:flex; flex-direction:column; gap:11px; width:100%; max-width:280px;}
.az-loading-row{display:flex; align-items:center; gap:10px; font-size:13px; font-family:'IBM Plex Mono',monospace; color:var(--ink-faint); opacity:0; transform:translateY(4px); animation:az-row-in 0.35s ease forwards;}
.az-loading-row.active, .az-loading-row.done{opacity:1; transform:translateY(0); animation:none;}
.az-loading-row.pending{animation-delay:0.05s;}
@keyframes az-row-in{to{opacity:1; transform:translateY(0);}}
.az-loading-mark{width:16px; height:16px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; border:1.5px solid var(--border-strong);}
.az-loading-row.done .az-loading-mark{background:var(--safe-soft); border-color:var(--safe); color:var(--safe);}
.az-loading-row.active .az-loading-mark{border-color:var(--accent);}
.az-loading-dot{width:6px; height:6px; border-radius:50%; background:var(--accent); animation:az-dot-blink 0.9s ease-in-out infinite;}
@keyframes az-dot-blink{0%,100%{opacity:1;}50%{opacity:0.3;}}
.az-loading-row.done .az-loading-text{color:var(--ink-soft);}
.az-loading-row.active .az-loading-text{color:var(--ink); font-weight:600;}
.az-result-content{display:flex; flex-direction:column; gap:20px;}

/* DECISION CARD */
.az-decision-card{border-radius:10px; padding:22px; border:1px solid var(--border); background:var(--bg-2);}
.az-decision-header{display:flex; align-items:center; gap:13px; margin-bottom:20px;}
.az-risk-icon{width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;}
.az-risk-icon.high{background:var(--danger-soft); color:var(--danger);}
.az-risk-icon.medium{background:var(--warning-soft); color:var(--warning);}
.az-risk-icon.low{background:var(--safe-soft); color:var(--safe);}
.az-risk-badge{font-size:11.5px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; padding:4px 10px; border-radius:100px; white-space:nowrap; display:inline-block; margin-bottom:5px;}
.az-risk-badge.high{background:var(--danger-soft); color:var(--danger);}
.az-risk-badge.medium{background:var(--warning-soft); color:var(--warning);}
.az-risk-badge.low{background:var(--safe-soft); color:var(--safe);}
.az-risk-subtitle{font-size:13.5px; font-weight:600; color:var(--ink);}
.az-gauge-block{margin-bottom:4px;}
.az-gauge-labels{display:flex; align-items:baseline; justify-content:space-between; margin-bottom:8px;}
.az-gauge-labels > span:first-child, .az-gauge-labels > span:last-child{font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--ink-faint); font-family:'IBM Plex Mono',monospace;}
.az-risk-prob{font-family:'IBM Plex Mono',monospace; font-weight:700; font-size:26px; letter-spacing:-0.02em; line-height:1; color:var(--ink);}
.az-gauge-track{position:relative; width:100%; height:8px; border-radius:6px; background:var(--border); overflow:visible;}
.az-gauge-fill{height:100%; border-radius:6px; transition:width 0.9s cubic-bezier(.2,.8,.2,1); overflow:hidden;}
.az-gauge-fill.high{background:var(--danger);}
.az-gauge-fill.medium{background:var(--warning);}
.az-gauge-fill.low{background:var(--safe);}
.az-gauge-marker{position:absolute; top:50%; width:14px; height:14px; border-radius:50%; background:var(--surface-raised); border:2.5px solid var(--ink); transform:translate(-50%,-50%); transition:left 0.9s cubic-bezier(.2,.8,.2,1); box-shadow:var(--shadow-sm);}
.az-gauge-caption{font-size:10.5px; color:var(--ink-faint); text-align:center; margin-top:9px; font-family:'IBM Plex Mono',monospace; text-transform:uppercase; letter-spacing:0.05em;}
.az-decision-divider{height:1px; background:var(--border); margin:18px 0 14px;}
.az-stat-row{margin-bottom:16px;}
.az-decision-label{font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--ink-faint); font-family:'IBM Plex Mono',monospace; margin-bottom:6px;}
.az-decision-text{font-size:14px; color:var(--ink); line-height:1.55;}

.az-block-title{font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--ink-faint); margin-bottom:11px; font-family:'IBM Plex Mono',monospace;}
.az-reasons-block{margin-top:2px;}
.az-reason-card{display:flex; align-items:center; gap:10px; padding:11px 13px; border-radius:8px; background:var(--surface); border:1px solid var(--border); margin-bottom:7px; transition:transform 0.15s ease, border-color 0.15s ease;}
.az-reason-card:hover{transform:translateX(2px); border-color:var(--border-strong);}
.az-reason-check{color:var(--accent); flex-shrink:0;}
.az-factor-text{font-size:13px; flex:1; color:var(--ink);}

.az-expand-section{margin-top:2px;}
.az-expand-header{width:100%; background:none; border:none; display:flex; justify-content:space-between; align-items:center; cursor:pointer; padding:14px 0; border-top:1px solid var(--border); font-size:13px; font-weight:600; color:var(--ink); font-family:'JetBrains Mono',monospace;}
.az-expand-body{padding-bottom:4px; padding-top:2px;}

/* SEGMENTED TABS */
.az-segmented{display:inline-flex; padding:3px; border-radius:8px; background:var(--bg-2); border:1px solid var(--border); margin-bottom:18px; gap:2px;}
.az-segmented-btn{padding:7px 14px; border-radius:6px; border:none; background:transparent; color:var(--ink-soft); font-size:12.5px; font-weight:500; cursor:pointer; font-family:'JetBrains Mono',monospace; transition:background-color 0.15s ease, color 0.15s ease;}
.az-segmented-btn.active{background:var(--surface-raised); color:var(--ink); font-weight:600; box-shadow:var(--shadow-sm);}

/* INFO CARDS (Model / Cross-validation) */
.az-info-grid{display:grid; grid-template-columns:repeat(2,1fr); gap:8px;}
.az-info-card{padding:12px 14px; border-radius:8px; background:var(--surface); border:1px solid var(--border); transition:transform 0.15s ease, box-shadow 0.15s ease;}
.az-info-card:hover{transform:translateY(-1px); box-shadow:var(--shadow-sm);}
.az-info-card-label{font-size:10.5px; color:var(--ink-faint); text-transform:uppercase; letter-spacing:0.04em; font-family:'IBM Plex Mono',monospace; margin-bottom:5px;}
.az-info-card-value{font-size:13px; font-weight:600; color:var(--ink); line-height:1.35;}

/* SHAP BARS */
.az-shap-block{padding-top:2px;}
.az-shap-bars{display:flex; flex-direction:column; gap:12px; margin-bottom:16px;}
.az-shap-row-label{display:flex; align-items:center; gap:6px; font-size:12.5px; color:var(--ink); margin-bottom:5px;}
.az-shap-row-name{flex:1;}
.az-shap-row-value{font-family:'IBM Plex Mono',monospace; font-size:12px; font-weight:600;}
.az-shap-row-value.up{color:var(--danger);}
.az-shap-row-value.down{color:var(--safe);}
.az-shap-track{height:7px; border-radius:5px; background:var(--bg-2); overflow:hidden;}
.az-shap-fill{height:100%; border-radius:5px;}
.az-shap-fill.up{background:var(--danger);}
.az-shap-fill.down{background:var(--safe);}
.az-shap-note{font-size:12.5px; color:var(--ink-soft); line-height:1.6; padding-top:12px; border-top:1px solid var(--border);}

/* CURVES */
.az-curves-section{padding:10px 0 52px;}
.az-curves-grid{display:grid; grid-template-columns:1fr 1fr; gap:20px;}
.az-curve-card{background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); box-shadow:var(--shadow-sm); padding:28px; transition:transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;}
.az-curve-card:hover{transform:translateY(-2px); box-shadow:var(--shadow-md); border-color:var(--border-strong);}
.az-curve-card:hover .az-curve-svg path[stroke]{filter:brightness(1.08);}
.az-curve-head{display:flex; justify-content:space-between; align-items:baseline; margin-bottom:10px;}
.az-curve-title{font-size:13.5px; font-weight:600;}
.az-curve-score{font-family:'IBM Plex Mono',monospace; font-size:12px; color:var(--accent);}
.az-curve-svg{
  width:100%;
  height:auto;
  color:var(--ink);
}

.az-dark .az-curve-svg text{
  fill:#fff;
}
.az-curve-tooltip{font-family:'IBM Plex Mono',monospace; font-size:11.5px; color:var(--ink-faint); margin-top:8px; text-align:center;}
.az-curve-svg{overflow:visible;}
.az-curve-point-label{font-family:'IBM Plex Mono',monospace; font-size:8px; fill:var(--ink-faint); pointer-events:none;}
/* STATS */
.az-stats-section{padding:10px 0 56px;}
.az-stats-grid{display:grid; grid-template-columns:repeat(3,1fr); gap:16px;}
.az-stat-card{background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:26px; text-align:center; box-shadow:var(--shadow-sm); transition:transform 0.2s ease, box-shadow 0.2s ease;}
.az-stat-card:hover{transform:translateY(-2px); box-shadow:var(--shadow-md);}
.az-stat-value{font-family:'JetBrains Mono',monospace; font-weight:800; font-size:32px; color:var(--accent); letter-spacing:-0.01em;}
.az-stat-label{font-size:12.5px; color:var(--ink-soft); margin-top:8px; font-family:'IBM Plex Mono',monospace; text-transform:uppercase; letter-spacing:0.03em;}

/* PIPELINE */
.az-pipeline-section{padding:8px 0 52px;}
.az-pipeline-title{font-family:'JetBrains Mono',monospace; font-weight:700; font-size:18px; letter-spacing:-0.005em; color:var(--ink); margin-bottom:20px; text-align:center;}
.az-pipeline-flow{display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:6px 4px;}
.az-pipeline-step-wrap{display:flex; align-items:center; gap:4px;}
.az-pipeline-step{padding:11px 18px; border-radius:8px; background:var(--surface); border:1px solid var(--border); font-size:12.5px; font-weight:600; color:var(--ink); white-space:nowrap; box-shadow:var(--shadow-sm); transition:transform 0.15s ease, border-color 0.15s ease;}
.az-pipeline-step:hover{transform:translateY(-1px); border-color:var(--accent);}
.az-pipeline-arrow{color:var(--ink-faint); flex-shrink:0;}

/* MODEL SCOPE */
.az-scope-section{padding:0 0 48px;}
.az-scope-card{background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:22px 26px; max-width:640px; margin:0 auto;}
.az-scope-head{display:flex; align-items:center; gap:8px; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--ink-faint); font-family:'IBM Plex Mono',monospace; margin-bottom:10px;}
.az-scope-text{font-size:13.5px; color:var(--ink-soft); line-height:1.6; margin-bottom:16px;}
.az-scope-support-label{font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--ink-faint); font-family:'IBM Plex Mono',monospace; margin-bottom:10px;}
.az-scope-grid{display:flex; flex-wrap:wrap; gap:10px;}
.az-scope-item{display:flex; align-items:center; gap:6px; font-size:12.5px; color:var(--ink); background:var(--accent-soft); border:1px solid color-mix(in srgb, var(--accent) 22%, transparent); padding:6px 11px; border-radius:100px;}
.az-scope-item svg{color:var(--accent); flex-shrink:0;}

/* FOOTER */
.az-footer{border-top:1px solid var(--border); padding:22px 0;}
.az-footer-inner{display:flex; align-items:center; justify-content:space-between; font-size:12.5px; color:var(--ink-faint);}
.az-footer-name{display:inline-flex; align-items:center; gap:5px;}
.az-footer-heart{color:var(--danger); position:relative; top:0.5px;}
.az-footer-links{display:flex; align-items:center; gap:8px;}
.az-footer-links a{color:var(--ink-faint); text-decoration:none; transition:color 0.15s ease;}
.az-footer-links a:hover{color:var(--accent);}
.az-footer-dot{color:var(--ink-faint);}

@media (max-width:920px){
  .az-nav-links{display:none;}
  .az-hero-grid, .az-sim-grid, .az-curves-grid{grid-template-columns:1fr;}
  .az-metrics-grid{grid-template-columns:repeat(2,1fr);}
  .az-stats-grid{grid-template-columns:1fr;}
  .az-headline{font-size:34px;}
  .az-info-grid{grid-template-columns:1fr;}
}

@media (max-width:640px){
  .az-wrap{padding:0 16px;}
  .az-nav-inner{padding:13px 16px;}
  .az-nav-status{display:none;}
  .az-brand{font-size:16px;}
  .az-brand-mark{width:26px; height:26px;}
  .az-github-btn{padding:7px 11px; font-size:11.5px;}
  .az-hero{padding:36px 0 24px;}
  .az-headline{font-size:27px;}
  .az-hero-sub{font-size:14.5px;}
  .az-hero-ctas{flex-direction:column; align-items:stretch;}
  .az-metrics-grid{grid-template-columns:1fr 1fr; gap:8px;}
  .az-metric{padding:14px 12px;}
  .az-metric-value{font-size:19px;}
  .az-panel{padding:20px 16px;}
  .az-section-title{font-size:22px;}
  .az-decision-header{gap:10px;}
  .az-risk-icon{width:34px; height:34px;}
  .az-pipeline-step{padding:9px 13px; font-size:11.5px;}
  .az-footer-inner{flex-wrap:wrap; gap:8px; justify-content:center; text-align:center;}
  .az-scope-card{padding:18px;}
}
`;
