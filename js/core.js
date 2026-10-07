/* ==================== Core — Utilities + Electrical Engineering ==================== */
var UID = 0;
function uid(p){ return (p||'id') + '_' + (++UID) + '_' + Date.now().toString(36); }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function snap(v, s){ s = s||0.1; return Math.round(v/s)*s; }
function dist(x1,y1,x2,y2){ return Math.hypot(x2-x1, y2-y1); }
function dist3(a,b){ return Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z); }
function clone(o){ return JSON.parse(JSON.stringify(o)); }
function hexToInt(h){ return parseInt((h||'#888888').replace('#',''),16); }
function fmt(n, d){ d = d===undefined ? 2 : d; return (+n).toFixed(d); }

function toast(msg, type){
  var t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg;
  t.classList.toggle('warn', type==='warn');
  t.classList.add('show');
  clearTimeout(window._toastT);
  window._toastT = setTimeout(function(){ t.classList.remove('show'); }, 2200);
}

function showHint(id, msg){
  var h = document.getElementById(id);
  if(!h) return;
  h.textContent = msg; h.classList.add('show');
  clearTimeout(window['_h_'+id]);
  window['_h_'+id] = setTimeout(function(){ h.classList.remove('show'); }, 2400);
}

/* ==================== Electrical Engineering ==================== */
var ELEC = {
  PHASE_VOLTAGE: 230,
  LINE_VOLTAGE: 400,
  FREQ: 50,
  COS_PHI: 0.9,
  COPPER_RHO: 0.0175,           /* Ω·mm²/m at 20°C */
  ALUMINUM_RHO: 0.028,
  MAX_VOLTAGE_DROP_PCT: 3,      /* 3% per IEC for lighting, 5% for sockets */
  MAX_VOLTAGE_DROP_LIGHT: 3,
  MAX_VOLTAGE_DROP_SOCKET: 5,
  AMBIENT_TEMP: 30
};

/* Ampacity per IEC 60364 — copper, PVC, method C (clipped direct) */
var AMPACITY_TABLE = [
  { section: 1.5,  amp: 17.5, breaker: 10,  maxLoad: 2300 },
  { section: 2.5,  amp: 24,   breaker: 16,  maxLoad: 3680 },
  { section: 4,    amp: 32,   breaker: 20,  maxLoad: 4600 },
  { section: 6,    amp: 41,   breaker: 25,  maxLoad: 5750 },
  { section: 10,   amp: 57,   breaker: 32,  maxLoad: 7360 },
  { section: 16,   amp: 76,   breaker: 40,  maxLoad: 9200 },
  { section: 25,   amp: 101,  breaker: 50,  maxLoad: 11500 },
  { section: 35,   amp: 125,  breaker: 63,  maxLoad: 14375 }
];

var BREAKER_SIZES = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125];

/* Standard circuit definitions — matching IEC */
var CIRCUIT_TYPES = {
  lighting: {
    name: 'إنارة',
    icon: '💡',
    color: '#fbbf24',
    section: 1.5,
    breaker: 10,
    maxDrop: 3,
    sockets_max: 8,
    description: 'دوائر الإنارة الداخلية'
  },
  sockets: {
    name: 'مقابس عامة',
    icon: '🔌',
    color: '#f59e0b',
    section: 2.5,
    breaker: 16,
    maxDrop: 5,
    sockets_max: 8,
    description: 'مقابس الغرف والصالات'
  },
  kitchen: {
    name: 'مطبخ',
    icon: '🍳',
    color: '#ef4444',
    section: 4,
    breaker: 20,
    maxDrop: 5,
    dedicated: true,
    description: 'مقابس المطبخ (فرن، ميكروويف، غلاية)'
  },
  bathroom: {
    name: 'حمام',
    icon: '🚿',
    color: '#38bdf8',
    section: 2.5,
    breaker: 16,
    maxDrop: 5,
    dedicated: true,
    description: 'سخان الماء والمقابس'
  },
  hvac: {
    name: 'تكييف',
    icon: '❄',
    color: '#0ea5e9',
    section: 4,
    breaker: 20,
    maxDrop: 5,
    dedicated: true,
    description: 'وحدات التكييف'
  },
  washing: {
    name: 'غسالة',
    icon: '🧺',
    color: '#a855f7',
    section: 2.5,
    breaker: 16,
    maxDrop: 5,
    dedicated: true,
    description: 'غسالة ملابس'
  },
  emergency: {
    name: 'إنارة طوارئ',
    icon: '🚨',
    color: '#22c55e',
    section: 1.5,
    breaker: 10,
    maxDrop: 3,
    dedicated: true,
    description: 'إضاءة الطوارئ والمخارج'
  },
  outdoor: {
    name: 'خارجي',
    icon: '🌿',
    color: '#84cc16',
    section: 2.5,
    breaker: 16,
    maxDrop: 5,
    description: 'إضاءة حديقة ومقابس خارجية'
  }
};

/* ==================== Calculations ==================== */

/* Single-phase current: I = P / (U × cosφ) */
function calcCurrent(power, voltage, cosPhi, threePhase){
  voltage = voltage || ELEC.PHASE_VOLTAGE;
  cosPhi = cosPhi || ELEC.COS_PHI;
  if(threePhase){
    return power / (Math.sqrt(3) * voltage * cosPhi);
  }
  return power / (voltage * cosPhi);
}

/* Voltage drop single phase: ΔU = 2 × ρ × L × I / S */
function calcVoltageDrop(current, length, section, material){
  var rho = material === 'aluminum' ? ELEC.ALUMINUM_RHO : ELEC.COPPER_RHO;
  var dU = (2 * rho * length * current) / section;
  var dUPercent = (dU / ELEC.PHASE_VOLTAGE) * 100;
  return { volts: dU, percent: dUPercent };
}

/* Voltage drop three phase: ΔU = √3 × ρ × L × I / S */
function calcVoltageDrop3P(current, length, section, material){
  var rho = material === 'aluminum' ? ELEC.ALUMINUM_RHO : ELEC.COPPER_RHO;
  var dU = (Math.sqrt(3) * rho * length * current) / section;
  var dUPercent = (dU / ELEC.LINE_VOLTAGE) * 100;
  return { volts: dU, percent: dUPercent };
}

/* Select appropriate cable section based on current + length + voltage drop */
function selectCable(current, length, maxDropPercent, threePhase){
  var drops = [];
  for(var i=0; i<AMPACITY_TABLE.length; i++){
    var c = AMPACITY_TABLE[i];
    if(c.amp < current) continue;
    var vd;
    if(threePhase){
      vd = calcVoltageDrop3P(current, length, c.section);
    } else {
      vd = calcVoltageDrop(current, length, c.section);
    }
    drops.push({
      section: c.section,
      amp: c.amp,
      drop: vd,
      breaker: c.breaker
    });
    if(vd.percent <= maxDropPercent){
      return {
        section: c.section,
        amp: c.amp,
        dropPercent: vd.percent,
        dropVolts: vd.volts,
        breaker: c.breaker,
        ok: true
      };
    }
  }
  /* If none passed, return largest */
  if(drops.length){
    var last = drops[drops.length - 1];
    return {
      section: last.section,
      amp: last.amp,
      dropPercent: last.drop.percent,
      dropVolts: last.drop.volts,
      breaker: last.breaker,
      ok: false,
      warning: 'هبوط الجهد مرتفع — قصر المسافة أو زد المقطع'
    };
  }
  return { section: 1.5, amp: 17.5, breaker: 10, ok: false, warning: 'الحمل كبير جداً' };
}

/* Select breaker: next size above current, considering inrush */
function selectBreaker(current, type){
  var factor = 1;
  if(type === 'hvac' || type === 'kitchen') factor = 1.25;
  if(type === 'lighting') factor = 1.1;
  var needed = current * factor;
  for(var i=0; i<BREAKER_SIZES.length; i++){
    if(BREAKER_SIZES[i] >= needed){
      /* Don't pick breaker larger than 2x the current for safety */
      if(BREAKER_SIZES[i] > current * 2.5 && i > 0) return BREAKER_SIZES[i-1];
      return BREAKER_SIZES[i];
    }
  }
  return BREAKER_SIZES[BREAKER_SIZES.length-1];
}

/* Main breaker: diversity factor 0.7 for residential */
function calcMainBreaker(totalPower){
  var diversityFactor = 0.7;
  var demandPower = totalPower * diversityFactor;
  var current = calcCurrent(demandPower, ELEC.PHASE_VOLTAGE, ELEC.COS_PHI, false);
  return {
    demandPower: demandPower,
    current: current,
    breaker: selectBreaker(current, 'panel'),
    diversityFactor: diversityFactor
  };
}

/* Cable weight per meter (kg/m) — approximate for copper */
function cableWeight(section){
  var density = 8.96; /* g/cm³ */
  var areaCm2 = section / 100;
  var kgPerM = areaCm2 * density * 10 / 1000 * 2; /* ×2 for phase+neutral approx */
  return kgPerM;
}

/* Total copper weight for cable run */
function copperWeight(section, length){
  return cableWeight(section) * length * 10;
}
