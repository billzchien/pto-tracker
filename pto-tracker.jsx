import { useState, useEffect, useCallback, useMemo } from "react";

const STORAGE_KEY = "bill-pto-2026-v2";
const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const ALL_HOLIDAYS = {
  "2026-01-01": "New Year's Day",
  "2026-05-25": "Memorial Day",
  "2026-07-03": "Independence Day (observed)",
  "2026-09-07": "Labor Day",
  "2026-11-26": "Thanksgiving Day",
  "2026-11-27": "Day after Thanksgiving",
  "2026-12-24": "Day before Christmas",
  "2026-12-25": "Christmas Day",
  "2027-01-01": "New Year's Day",
  "2027-05-31": "Memorial Day",
  "2027-07-05": "Independence Day (observed)",
  "2027-09-06": "Labor Day",
  "2027-11-25": "Thanksgiving Day",
  "2027-11-26": "Day after Thanksgiving",
  "2027-12-24": "Day before Christmas",
  "2027-12-27": "Christmas Day (observed)",
};

const FY_END = new Date(2026, 7, 31);
const ACCRUAL_RATE_PRE5 = 7.0;
const ACCRUAL_RATE_POST5 = 7.67;
const MILESTONE_DATE = new Date(2026, 7, 2);
const HOURS_PER_DAY = 8;
const CUL_DAYS_TOTAL = 2;

function getPayPeriodEndDates() {
  const dates = [];
  // FY2026: Sep 1, 2025 - Aug 31, 2026
  const start1 = new Date(2025, 8, 1);
  const interval = 365 / 24;
  for (let i = 0; i < 24; i++) {
    const d = new Date(start1);
    d.setDate(d.getDate() + Math.round(interval * (i + 1)));
    dates.push(d);
  }
  // FY2027: Sep 1, 2026 - Aug 31, 2027
  const start2 = new Date(2026, 8, 1);
  for (let i = 0; i < 24; i++) {
    const d = new Date(start2);
    d.setDate(d.getDate() + Math.round(interval * (i + 1)));
    dates.push(d);
  }
  return dates;
}
const PAY_PERIOD_ENDS = getPayPeriodEndDates();

function dkey(y, m, d) {
  return y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
}
function daysIn(y, m) { return new Date(y, m + 1, 0).getDate(); }
function dayOfWeek(y, m, d) { return new Date(y, m, d).getDay(); }
function isWknd(y, m, d) { var w = dayOfWeek(y, m, d); return w === 0 || w === 6; }
function isHol(key) { return key in ALL_HOLIDAYS; }

var DEFAULT_DATA = {
  "2026-01-27": "PTO", "2026-01-28": "PTO", "2026-01-29": "PTO", "2026-01-30": "PTO",
  "2026-02-02": "PTO", "2026-02-03": "PTO", "2026-02-04": "PTO", "2026-02-05": "PTO", "2026-02-06": "PTO",
  "2026-02-09": "PTO", "2026-02-10": "PTO", "2026-02-11": "PTO", "2026-02-12": "PTO", "2026-02-13": "PTO",
  "2026-02-16": "CUL", "2026-02-17": "CUL",
};

var mono = "'JetBrains Mono', 'SF Mono', monospace";
var sans = "'DM Sans', 'Helvetica Neue', sans-serif";

var C = {
  bg: "#FAFAF8", surface: "#FFFFFF", surfAlt: "#F5F5F0",
  border: "#E8E6E1", borderLt: "#F0EEEA",
  text: "#1A1A18", textSec: "#7A7A72", textMut: "#B0AEA6",
  used: "#9CA3AF", usedBg: "#F3F4F6", usedBdr: "#D1D5DB",
  hol: "#D97706", holBg: "#FFFBEB", holBdr: "#FDE68A",
  plan: "#10B981", planBg: "#ECFDF5", planBdr: "#A7F3D0",
  planCul: "#A855F7", planCulBg: "#FAF5FF", planCulBdr: "#E9D5FF",
  wknd: "#F7F6F3",
  neg: "#EF4444", negBg: "#FEF2F2",
  pos: "#10B981", posBg: "#ECFDF5",
  accent: "#2563EB",
};

var TC = {
  PTO: { bg: C.usedBg, border: C.usedBdr, text: C.used, label: "USED" },
  CUL: { bg: C.usedBg, border: C.usedBdr, text: C.used, label: "USED" },
  HOL: { bg: C.holBg, border: C.holBdr, text: C.hol, label: "HOL" },
  PLAN: { bg: C.planBg, border: C.planBdr, text: C.plan, label: "PLAN" },
  PLAN_CUL: { bg: C.planCulBg, border: C.planCulBdr, text: C.planCul, label: "PLAN" },
};

export default function PTOTracker() {
  var [days, setDays] = useState(DEFAULT_DATA);
  var [viewYear, setViewYear] = useState(2026);
  var [loaded, setLoaded] = useState(false);
  var [active, setActive] = useState(null);
  var [showProj, setShowProj] = useState(false);
  var [showOpps, setShowOpps] = useState(false);
  var [previewDates, setPreviewDates] = useState([]);
  var [showSettings, setShowSettings] = useState(false);
  var [bal, setBal] = useState(-12);
  var [balDate, setBalDate] = useState("2026-04-01");
  var [toast, setToast] = useState(null);

  useEffect(function() {
    async function load() {
      try {
        var r = await window.storage.get(STORAGE_KEY);
        if (r && r.value) {
          var p = JSON.parse(r.value);
          if (p.days) setDays(p.days);
          if (p.bal !== undefined) setBal(p.bal);
          if (p.balDate) setBalDate(p.balDate);
        }
      } catch(e) {}
      setLoaded(true);
    }
    load();
  }, []);

  useEffect(function() {
    if (!loaded) return;
    async function save() {
      try { await window.storage.set(STORAGE_KEY, JSON.stringify({ days: days, bal: bal, balDate: balDate })); }
      catch(e) {}
    }
    save();
  }, [days, bal, balDate, loaded]);

  var notify = useCallback(function(msg) {
    setToast(msg);
    setTimeout(function() { setToast(null); }, 2000);
  }, []);

  var toggle = useCallback(function(key, type) {
    setDays(function(prev) {
      var cur = prev[key] || "";
      var next = cur === type ? "" : type;
      var u = Object.assign({}, prev);
      if (next === "") { delete u[key]; } else { u[key] = next; }
      return u;
    });
    setActive(null);
  }, []);

  var stats = useMemo(function() {
    var ptoUsed = 0, ptoPlanned = 0, culUsed = 0, culPlanned = 0;
    var asOf = new Date(balDate);
    var entries = Object.entries(days);

    // FY for the viewing year (e.g. viewYear=2026 means FY2026 = Sep 2025 - Aug 2026)
    var fyStart = new Date(viewYear - 1, 8, 1);
    var fyEnd = new Date(viewYear, 7, 31);

    entries.forEach(function(entry) {
      var k = entry[0], t = entry[1];
      var d = new Date(k);
      var y = d.getFullYear();
      var inFY = d >= fyStart && d <= fyEnd;
      if (t === "PTO" && inFY) ptoUsed++;
      if (t === "PLAN" && inFY) ptoPlanned++;
      if (t === "CUL" && y === viewYear) culUsed++;
      if (t === "PLAN_CUL" && y === viewYear) culPlanned++;
    });

    var ptoAfter = 0;
    entries.forEach(function(entry) {
      var k = entry[0], t = entry[1];
      if (t === "PTO" || t === "PLAN") {
        var d = new Date(k);
        if (d > asOf && d >= fyStart && d <= fyEnd) ptoAfter++;
      }
    });

    var futAcc = 0;
    PAY_PERIOD_ENDS.forEach(function(pp) {
      if (pp > asOf && pp <= fyEnd) {
        futAcc += pp >= MILESTONE_DATE ? ACCRUAL_RATE_POST5 : ACCRUAL_RATE_PRE5;
      }
    });

    var eoy = bal + futAcc - ptoAfter * HOURS_PER_DAY;
    var avail = Math.floor((bal + futAcc) / HOURS_PER_DAY) - ptoAfter;

    var feasibility = {};
    var allFut = entries
      .filter(function(e) { return (e[1] === "PTO" || e[1] === "PLAN") && new Date(e[0]) > asOf; })
      .sort(function(a, b) { return a[0] < b[0] ? -1 : 1; });

    allFut.forEach(function(entry) {
      var pd = entry[0], pt = entry[1];
      if (pt !== "PLAN") return;
      var planD = new Date(pd);
      var acc = 0;
      PAY_PERIOD_ENDS.forEach(function(pp) {
        if (pp > asOf && pp <= planD) acc += pp >= MILESTONE_DATE ? ACCRUAL_RATE_POST5 : ACCRUAL_RATE_PRE5;
      });
      var usedBy = 0;
      allFut.forEach(function(e) { if (new Date(e[0]) > asOf && new Date(e[0]) <= planD) usedBy++; });
      feasibility[pd] = (bal + acc - usedBy * HOURS_PER_DAY) >= 0;
    });

    // End of viewing calendar year projection
    var EOCY = new Date(viewYear, 11, 31);
    
    // Phase 1: Accrual from balance date through end of FY containing balance date
    var balFYEnd = new Date(asOf.getFullYear() + (asOf.getMonth() >= 8 ? 1 : 0), 7, 31);
    var accToBalFYEnd = 0;
    PAY_PERIOD_ENDS.forEach(function(pp) {
      if (pp > asOf && pp <= balFYEnd) {
        accToBalFYEnd += pp >= MILESTONE_DATE ? ACCRUAL_RATE_POST5 : ACCRUAL_RATE_PRE5;
      }
    });
    
    var ptoBeforeBalFYEnd = 0;
    Object.entries(days).forEach(function(entry) {
      var k = entry[0], t = entry[1];
      if (t === "PTO" || t === "PLAN") {
        var d = new Date(k);
        if (d > asOf && d <= balFYEnd) ptoBeforeBalFYEnd++;
      }
    });
    
    var balanceAtFYEnd = bal + accToBalFYEnd - ptoBeforeBalFYEnd * HOURS_PER_DAY;
    var carriedOver = Math.min(balanceAtFYEnd, 200);
    
    // Phase 2: Accrual from Sep 1 (after FY end) through EOCY
    var accSepToEOCY = 0;
    PAY_PERIOD_ENDS.forEach(function(pp) {
      if (pp > balFYEnd && pp <= EOCY) {
        accSepToEOCY += ACCRUAL_RATE_POST5;
      }
    });
    
    var ptoSepToEOCY = 0;
    Object.entries(days).forEach(function(entry) {
      var k = entry[0], t = entry[1];
      if (t === "PTO" || t === "PLAN") {
        var d = new Date(k);
        if (d > balFYEnd && d <= EOCY) ptoSepToEOCY++;
      }
    });
    
    // If EOCY is before FY end, just use direct calculation
    var eocyDays;
    if (EOCY <= balFYEnd) {
      var directAcc = 0;
      var directPTO = 0;
      PAY_PERIOD_ENDS.forEach(function(pp) {
        if (pp > asOf && pp <= EOCY) directAcc += pp >= MILESTONE_DATE ? ACCRUAL_RATE_POST5 : ACCRUAL_RATE_PRE5;
      });
      Object.entries(days).forEach(function(entry) {
        var k = entry[0], t = entry[1];
        if (t === "PTO" || t === "PLAN") {
          var d = new Date(k);
          if (d > asOf && d <= EOCY) directPTO++;
        }
      });
      eocyDays = Math.floor((bal + directAcc) / HOURS_PER_DAY) - directPTO;
    } else {
      eocyDays = Math.floor((carriedOver + accSepToEOCY) / HOURS_PER_DAY) - ptoSepToEOCY;
    }

    return {
      ptoUsed: ptoUsed, ptoPlanned: ptoPlanned,
      culUsed: culUsed, culPlanned: culPlanned,
      culRemaining: CUL_DAYS_TOTAL - culUsed - culPlanned,
      balHrs: bal, futAcc: futAcc, eoy: eoy,
      eoyDays: eoy / HOURS_PER_DAY, avail: avail,
      eocyDays: eocyDays,
      feasibility: feasibility,
    };
  }, [days, bal, balDate, viewYear]);

  var opps = useMemo(function() {
    var r = [];
    Object.entries(ALL_HOLIDAYS).forEach(function(entry) {
      var k = entry[0], name = entry[1];
      var parts = k.split("-").map(Number);
      var holDate = new Date(parts[0], parts[1] - 1, parts[2]);
      var w = holDate.getDay();
      var note = "";
      var ptoDates = [];
      
      function addDate(daysOffset) {
        var d = new Date(holDate);
        d.setDate(d.getDate() + daysOffset);
        var dwk = d.getDay();
        // Skip if weekend
        if (dwk === 0 || dwk === 6) return;
        var dk2 = dkey(d.getFullYear(), d.getMonth(), d.getDate());
        // Skip if already a holiday
        if (isHol(dk2)) return;
        ptoDates.push(dk2);
      }
      
      if (w === 1) { note = "Take Fri before for 4-day weekend"; addDate(-3); }
      else if (w === 5) { note = "Take Mon after for 4-day weekend"; addDate(3); }
      else if (w === 2) { note = "Take Mon for 4-day weekend"; addDate(-1); }
      else if (w === 4) { note = "Take Fri for 4-day weekend"; addDate(1); }
      else if (w === 3) { note = "Take Mon-Tue for 5-day weekend"; addDate(-2); addDate(-1); }
      
      if (note && ptoDates.length > 0) r.push({ date: k, name: name, note: note, dow: WEEKDAYS[w], ptoDates: ptoDates });
    });
    return r.sort(function(a, b) { return a.date < b.date ? -1 : 1; });
  }, []);

  function getDayTC(key, dtype) {
    if (!dtype) return null;
    if (dtype === "PLAN") {
      var feas = stats.feasibility[key];
      if (feas === true) return { bg: C.posBg, border: C.pos + "44", text: C.pos, label: "PLAN" };
      if (feas === false) return { bg: C.negBg, border: C.neg + "44", text: C.neg, label: "PLAN" };
    }
    return TC[dtype] || null;
  }

  function DayCell(props) {
    var year = props.year, month = props.month, day = props.day, compact = props.compact;
    var key = dkey(year, month, day);
    var type = days[key] || "";
    var hol = isHol(key);
    var wk = isWknd(year, month, day);
    var dtype = hol ? "HOL" : type;
    var tc = getDayTC(key, dtype);
    var isAct = active === key;
    var isPreview = previewDates.indexOf(key) !== -1;
    var now = new Date();
    var isToday = now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;
    var sz = compact ? 28 : 44;

    // Preview overrides display
    if (isPreview && !type && !hol) {
      tc = { bg: C.planBg, border: C.plan, text: C.plan, label: "PLAN" };
    }

    return (
      <div
        onClick={function() { if (!hol && !wk) setActive(isAct ? null : key); }}
        style={{
          position: "relative", width: sz, height: sz,
          display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: 6, cursor: hol || wk ? "default" : "pointer",
          fontSize: compact ? 10 : 12, fontFamily: mono,
          fontWeight: isToday ? 700 : tc ? 600 : 400,
          color: tc ? tc.text : wk ? C.textMut : C.text,
          background: tc ? tc.bg : wk ? C.wknd : "transparent",
          border: isToday ? "2px solid " + C.accent : isPreview ? "2px dashed " + C.plan : tc ? "1px solid " + tc.border : "1px solid transparent",
          transition: "all 0.15s", userSelect: "none",
        }}
      >
        {dtype && !compact && tc ? (
          <span style={{ fontSize: 9, letterSpacing: 0.5 }}>{tc.label}</span>
        ) : day}
        {isAct ? (
          <div onClick={function(e) { e.stopPropagation(); }} style={{
            position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)",
            marginTop: 4, background: C.surface, border: "1px solid " + C.border,
            borderRadius: 8, padding: 4, display: "flex", gap: 3, zIndex: 100,
            boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          }}>
            {[
              { t: "PTO", l: "Used PTO", c: TC.PTO },
              { t: "CUL", l: "Used CUL", c: TC.CUL },
              { t: "PLAN", l: "Plan PTO", c: TC.PLAN },
              { t: "PLAN_CUL", l: "Plan CUL", c: TC.PLAN_CUL },
            ].map(function(item) {
              return (
                <button key={item.t}
                  onClick={function() { toggle(key, item.t); notify(item.l + (type === item.t ? " removed" : " added")); }}
                  style={{
                    padding: "4px 8px", fontSize: 9, fontFamily: mono, fontWeight: 600,
                    border: "1px solid " + item.c.border, borderRadius: 5,
                    background: type === item.t ? item.c.text : item.c.bg,
                    color: type === item.t ? "#fff" : item.c.text,
                    cursor: "pointer", letterSpacing: 0.3, whiteSpace: "nowrap",
                  }}>
                  {item.l}
                </button>
              );
            })}
            {type ? (
              <button onClick={function() { toggle(key, type); notify("Cleared"); }}
                style={{ padding: "4px 6px", fontSize: 10, fontFamily: mono, border: "1px solid " + C.border,
                  borderRadius: 5, background: C.surfAlt, color: C.textSec, cursor: "pointer" }}>
                ✕
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  function NavBtn(props) {
    return (
      <button onClick={props.onClick} style={Object.assign({ padding: "4px 8px", fontSize: 14, fontFamily: mono, background: C.surface, border: "1px solid " + C.border, borderRadius: 6, cursor: "pointer", color: C.text }, props.extraStyle || {})}>
        {props.children}
      </button>
    );
  }

  if (!loaded) return <div style={{ padding: 40, fontFamily: sans, color: C.textSec, textAlign: "center" }}>Loading...</div>;

  var balColor = stats.balHrs < 0 ? C.neg : C.pos;

  return (
    <div style={{ fontFamily: sans, color: C.text, background: C.bg, minHeight: "100vh", padding: "24px 28px", position: "relative" }}
      onClick={function() { setActive(null); }}>

      {toast ? <div style={{ position: "fixed", top: 16, right: 16, background: C.text, color: C.bg, padding: "8px 16px", borderRadius: 8, fontSize: 12, fontFamily: mono, zIndex: 1000 }}>{toast}</div> : null}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, fontFamily: sans, letterSpacing: -0.5 }}>PTO Tracker</h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textSec, fontFamily: mono }}>FY2026 · CL8</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <NavBtn onClick={function(e) { e.stopPropagation(); setShowOpps(!showOpps); setShowProj(false); }}
            extraStyle={{ background: showOpps ? C.accent : C.surface, color: showOpps ? "#fff" : C.text, border: "1px solid " + (showOpps ? C.accent : C.border), fontSize: 12, padding: "6px 14px" }}>
            Opportunities
          </NavBtn>
          <NavBtn onClick={function(e) { e.stopPropagation(); setShowProj(!showProj); setShowOpps(false); }}
            extraStyle={{ background: showProj ? C.accent : C.surface, color: showProj ? "#fff" : C.text, border: "1px solid " + (showProj ? C.accent : C.border), fontSize: 12, padding: "6px 14px" }}>
            Projection
          </NavBtn>
          <NavBtn onClick={function(e) { e.stopPropagation(); setShowSettings(!showSettings); }}
            extraStyle={{ fontSize: 12, padding: "6px 14px" }}>
            Settings
          </NavBtn>
        </div>
      </div>

      {showSettings ? (
        <div onClick={function(e) { e.stopPropagation(); }} style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Balance Settings</div>
          <div style={{ display: "flex", gap: 20, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div>
              <label style={{ fontSize: 11, color: C.textSec, fontFamily: mono, display: "block", marginBottom: 4 }}>Balance as of date</label>
              <input type="date" value={balDate} onChange={function(e) { setBalDate(e.target.value); }}
                style={{ padding: "6px 10px", fontSize: 13, fontFamily: mono, border: "1px solid " + C.border, borderRadius: 6, background: C.surfAlt }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.textSec, fontFamily: mono, display: "block", marginBottom: 4 }}>Balance (hours)</label>
              <input type="number" value={bal} onChange={function(e) { setBal(parseFloat(e.target.value) || 0); }}
                style={{ padding: "6px 10px", fontSize: 13, fontFamily: mono, border: "1px solid " + C.border, borderRadius: 6, width: 80, background: C.surfAlt }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.textSec, fontFamily: mono, display: "block", marginBottom: 4 }}>View Year</label>
              <select value={viewYear} onChange={function(e) { setViewYear(parseInt(e.target.value)); }}
                style={{ padding: "6px 10px", fontSize: 13, fontFamily: mono, border: "1px solid " + C.border, borderRadius: 6, background: C.surfAlt }}>
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </select>
            </div>
            <NavBtn onClick={function() { setDays(Object.assign({}, DEFAULT_DATA)); setBal(-12); setBalDate("2026-04-01"); notify("Reset to defaults"); }}
              extraStyle={{ fontSize: 11, padding: "6px 14px", background: C.surfAlt, color: C.textSec }}>
              Reset to Defaults
            </NavBtn>
            <NavBtn onClick={function() {
              var cleaned = {};
              Object.entries(days).forEach(function(e) { if (e[1] !== "PLAN" && e[1] !== "PLAN_CUL") cleaned[e[0]] = e[1]; });
              setDays(cleaned); notify("Planned days cleared");
            }} extraStyle={{ fontSize: 11, padding: "6px 14px", background: C.planBg, color: C.plan, border: "1px solid " + C.planBdr }}>
              Clear Planned Days
            </NavBtn>
          </div>
        </div>
      ) : null}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        {/* Current Balance - narrow */}
        <div style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 10, padding: "16px 20px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontFamily: mono, color: C.textSec, textTransform: "uppercase", letterSpacing: 1 }}>Current Balance</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 32, fontWeight: 700, fontFamily: mono, color: balColor, lineHeight: 1 }}>
              {stats.balHrs}<span style={{ fontSize: 13, fontWeight: 400, marginLeft: 2 }}>hrs</span>
            </div>
            <div style={{ fontSize: 11, fontFamily: mono, color: C.textMut, marginTop: 4 }}>
              {"as of " + new Date(balDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </div>
          </div>
          <div style={{ fontSize: 11, fontFamily: mono, color: C.textSec, borderTop: "1px solid " + C.borderLt, paddingTop: 10, marginTop: 14 }}>
            {(stats.balHrs / HOURS_PER_DAY).toFixed(1) + " days"}
          </div>
        </div>

        {/* Projected PTO - simplified */}
        <div style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 10, padding: "16px 20px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontFamily: mono, color: C.textSec, textTransform: "uppercase", letterSpacing: 1 }}>Projected PTO</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 32, fontWeight: 700, fontFamily: mono, color: stats.eocyDays >= 0 ? C.pos : C.neg, lineHeight: 1 }}>
              {stats.eocyDays}<span style={{ fontSize: 13, fontWeight: 400, marginLeft: 2 }}>days</span>
            </div>
            <div style={{ fontSize: 11, fontFamily: mono, color: C.textMut, marginTop: 4 }}>
              by Dec 31
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 11, fontFamily: mono, color: C.textSec, borderTop: "1px solid " + C.borderLt, paddingTop: 10, marginTop: 14, flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: C.used, display: "inline-block" }} />{stats.ptoUsed} used
            </span>
            {stats.ptoPlanned > 0 ? (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: C.plan, display: "inline-block" }} />{stats.ptoPlanned} planned
              </span>
            ) : null}
          </div>
        </div>

        {/* Cultural Days */}
        <div style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 10, padding: "16px 20px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontFamily: mono, color: C.textSec, textTransform: "uppercase", letterSpacing: 1 }}>Cultural Days</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 32, fontWeight: 700, fontFamily: mono, color: stats.culRemaining > 0 ? C.pos : C.textMut, lineHeight: 1 }}>
              {stats.culRemaining}<span style={{ fontSize: 13, fontWeight: 400, marginLeft: 2 }}>days</span>
            </div>
            <div style={{ fontSize: 11, fontFamily: mono, color: C.textMut, marginTop: 4 }}>
              {"as of " + new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 11, fontFamily: mono, color: C.textSec, borderTop: "1px solid " + C.borderLt, paddingTop: 10, marginTop: 14, flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: C.used, display: "inline-block" }} />{stats.culUsed} used
            </span>
            {stats.culPlanned > 0 ? (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ color: C.textMut }}>·</span>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: C.planCul, display: "inline-block" }} />{stats.culPlanned} planned
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Projections */}
      {showProj ? (
        <div style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 10, padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Accrual Projection</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontFamily: mono, color: C.textSec, marginBottom: 2 }}>Current rate (pre-Aug 2)</div>
              <div style={{ fontSize: 16, fontFamily: mono, fontWeight: 600 }}>{ACCRUAL_RATE_PRE5 + " hrs/pay period"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontFamily: mono, color: C.textSec, marginBottom: 2 }}>After Aug 2 (5yr milestone)</div>
              <div style={{ fontSize: 16, fontFamily: mono, fontWeight: 600, color: C.pos }}>{ACCRUAL_RATE_POST5 + " hrs/pay period"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontFamily: mono, color: C.textSec, marginBottom: 2 }}>Future accrual remaining</div>
              <div style={{ fontSize: 16, fontFamily: mono, fontWeight: 600 }}>{stats.futAcc.toFixed(1) + " hrs (" + (stats.futAcc / 8).toFixed(1) + " days)"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontFamily: mono, color: C.textSec, marginBottom: 2 }}>Projected EOY balance (Aug 31)</div>
              <div style={{ fontSize: 16, fontFamily: mono, fontWeight: 600, color: stats.eoy >= 0 ? C.pos : C.neg }}>{stats.eoy.toFixed(1) + " hrs (" + stats.eoyDays.toFixed(1) + " days)"}</div>
            </div>
          </div>
        </div>
      ) : null}

      {showOpps ? (
        <div style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 10, padding: 20, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Long Weekend Opportunities</div>
            {previewDates.length > 0 ? (
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={function() {
                  var u = Object.assign({}, days);
                  previewDates.forEach(function(k) { u[k] = "PLAN"; });
                  setDays(u);
                  setPreviewDates([]);
                  notify("Plan applied");
                }} style={{ padding: "6px 12px", fontSize: 11, fontFamily: mono, fontWeight: 600, background: C.plan, color: "#fff", border: "1px solid " + C.plan, borderRadius: 6, cursor: "pointer" }}>
                  Apply Plan
                </button>
                <button onClick={function() { setPreviewDates([]); }}
                  style={{ padding: "6px 12px", fontSize: 11, fontFamily: mono, fontWeight: 500, background: C.surfAlt, color: C.textSec, border: "1px solid " + C.border, borderRadius: 6, cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            ) : null}
          </div>
          <div style={{ fontSize: 11, fontFamily: mono, color: C.textSec, marginBottom: 12 }}>
            Click an opportunity to preview the dates in the calendar. Click Apply to commit.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {opps.filter(function(o) {
              if (new Date(o.date) < new Date()) return false;
              // Skip if all suggested PTO dates are already marked
              var allMarked = o.ptoDates.every(function(d) { return days[d] === "PTO" || days[d] === "CUL"; });
              return !allMarked;
            }).map(function(o) {
              var isPreviewing = o.ptoDates.length > 0 && o.ptoDates.every(function(d) { return previewDates.indexOf(d) !== -1; });
              return (
                <button key={o.date}
                  onClick={function() {
                    if (isPreviewing) {
                      setPreviewDates([]);
                    } else {
                      setPreviewDates(o.ptoDates);
                      // Jump calendar to the year of this opportunity
                      var oppYear = parseInt(o.date.split("-")[0]);
                      if (oppYear !== viewYear) setViewYear(oppYear);
                    }
                  }}
                  style={{
                    background: isPreviewing ? C.planBg : C.surfAlt,
                    border: "1px solid " + (isPreviewing ? C.plan : C.borderLt),
                    borderRadius: 8, padding: "10px 14px", fontSize: 11, fontFamily: mono,
                    maxWidth: 280, textAlign: "left", cursor: "pointer",
                  }}>
                  <div style={{ fontWeight: 600, color: C.text, marginBottom: 2 }}>{o.name}</div>
                  <div style={{ color: C.textSec, fontSize: 10 }}>{o.date + " (" + o.dow + ")"}</div>
                  <div style={{ color: isPreviewing ? C.plan : C.textSec, marginTop: 4, fontWeight: isPreviewing ? 600 : 400 }}>{o.note}</div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Calendar */}
      <div style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 12, padding: 24 }} onClick={function(e) { e.stopPropagation(); }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <NavBtn onClick={function() { setViewYear(viewYear - 1); }}>{"←"}</NavBtn>
            <span style={{ fontSize: 16, fontWeight: 600, fontFamily: sans }}>{viewYear}</span>
            <NavBtn onClick={function() { setViewYear(viewYear + 1); }}>{"→"}</NavBtn>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
            {MONTHS.map(function(mName, mi) {
              var dim = daysIn(viewYear, mi);
              var fd = dayOfWeek(viewYear, mi, 1);
              var cells = [];
              for (var i = 0; i < fd; i++) cells.push(<div key={"e" + i} style={{ width: 28, height: 28 }} />);
              for (var d = 1; d <= dim; d++) cells.push(<DayCell key={dkey(viewYear, mi, d)} year={viewYear} month={mi} day={d} compact={true} />);
              return (
                <div key={mName}>
                  <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                    {mName}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 28px)", gap: 2 }}>
                    {WEEKDAYS.map(function(w) {
                      return <div key={w} style={{ width: 28, height: 16, fontSize: 8, fontFamily: mono, color: C.textMut, textAlign: "center", textTransform: "uppercase", letterSpacing: 0.5 }}>{w[0]}</div>;
                    })}
                    {cells}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
        {[
          { label: "Used Days", bg: C.usedBg, bdr: C.usedBdr, txt: C.used, sw: "USED" },
          { label: "Company Holiday", bg: C.holBg, bdr: C.holBdr, txt: C.hol, sw: "HOL" },
          { label: "Planned PTO", bg: C.planBg, bdr: C.planBdr, txt: C.plan, sw: "PLAN" },
          { label: "Planned CUL", bg: C.planCulBg, bdr: C.planCulBdr, txt: C.planCul, sw: "PLAN" },
        ].map(function(item) {
          return (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, background: item.bg, border: "1px solid " + item.bdr, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontFamily: mono, fontWeight: 600, color: item.txt }}>{item.sw}</div>
              <span style={{ fontSize: 11, fontFamily: mono, color: C.textSec }}>{item.label}</span>
            </div>
          );
        })}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 16, height: 16, borderRadius: 4, background: C.wknd, border: "1px solid " + C.border }} />
          <span style={{ fontSize: 11, fontFamily: mono, color: C.textSec }}>Weekend</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 16, height: 16, borderRadius: 4, border: "2px solid " + C.accent }} />
          <span style={{ fontSize: 11, fontFamily: mono, color: C.textSec }}>Today</span>
        </div>
      </div>

      <div style={{ marginTop: 20, fontSize: 10, fontFamily: mono, color: C.textMut, lineHeight: 1.6 }}>
        {"Click a weekday to mark · Holidays are auto-marked · Data saves automatically"}
        <br />
        {"Carryover cap: 200 hrs · FY runs Sep 1 \u2013 Aug 31 · Cultural days reset Jan 1"}
      </div>

      <style>{"\
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');\
        * { box-sizing: border-box; }\
        button:hover { opacity: 0.85; }\
      "}</style>
    </div>
  );
}
