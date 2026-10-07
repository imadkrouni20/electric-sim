/* ==================== Data Model ==================== */
var PROJ = null;
var STORAGE_KEY = 'elec-sim-v1';
var LAST_KEY = 'elec-sim-last';

/* ---------- Create ---------- */
function createProject(o){
  o = o || {};
  return {
    id: o.id || uid('proj'),
    name: o.name || 'مشروع جديد',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
    system: o.system || 'single',           /* single | three */
    building: {
      length: o.length || 14,
      width: o.width || 12,
      height: o.height || 3,
      floors: o.floors || 1,
      wallThickness: o.wallThickness || 0.2,
      wallColor: o.wallColor || '#f0efe8',
      floorColor: o.floorColor || '#8b7355',
      ceilColor: o.ceilColor || '#ffffff'
    },
    /* Panels: array of electrical distribution boards */
    panels: [],
    /* Rooms per floor with walls inside */
    floors: o.floorsData || [],
    /* Global settings */
    _currentFloor: 0,
    _powerOn: true,
    _mainBreakerOn: true
  };
}

function makePanel(o){
  o = o || {};
  return {
    id: o.id || uid('panel'),
    name: o.name || 'اللوحة الرئيسية',
    x: o.x || 0.5,
    y: o.y || 0.5,
    floor: o.floor || 0,
    wall: o.wall || null,          /* wall id if on wall */
    type: o.type || 'main',         /* main | sub */
    parentPanel: o.parentPanel || null,
    mainBreaker: o.mainBreaker || 63,
    circuits: []
  };
}

function makeCircuit(o){
  o = o || {};
  return {
    id: o.id || uid('circ'),
    name: o.name || 'دائرة',
    type: o.type || 'lighting',     /* from CIRCUIT_TYPES */
    section: o.section || 1.5,
    breaker: o.breaker || 10,
    maxDrop: o.maxDrop || 3,
    color: o.color || '#fbbf24',
    components: [],                  /* component ids */
    length: 0,                       /* computed */
    load: 0,                         /* computed W */
    current: 0,                      /* computed A */
    dropPercent: 0                   /* computed */
  };
}

function makeFloor(level){
  return {
    level: level,
    rooms: [],
    walls: [],
    stairs: []
  };
}

function makeRoom(o){
  return {
    id: o.id || uid('room'),
    type: o.type || 'bedroom',
    name: o.name || 'غرفة',
    x: o.x, y: o.y, w: o.w, h: o.h,
    floor: o.floor || 0,
    color: o.color || '#e8f0ff',
    furniture: o.furniture || []
  };
}

function makeWall(o){
  return {
    id: o.id || uid('wall'),
    floor: o.floor || 0,
    x1: o.x1, y1: o.y1,
    x2: o.x2, y2: o.y2,
    thickness: o.thickness || 0.2,
    manual: !!o.manual,
    openings: [],
    faces: {
      '1':  { side: 1,  components: [] },
      '-1': { side: -1, components: [] }
    }
  };
}

function makeOpening(o){
  return {
    id: o.id || uid('op'),
    type: o.type,                    /* door | window */
    subtype: o.subtype || 'single',
    t: o.t, w: o.w, h: o.h, sill: o.sill || 0,
    side: o.side || 1,
    color: o.color || '#8b5a2b',
    glassColor: o.glassColor || '#a8d8ff'
  };
}

function makeStair(o){
  return {
    id: o.id || uid('stair'),
    floor: o.floor || 0,
    x: o.x, y: o.y, w: o.w, h: o.h,
    type: o.type || 'straight',
    steps: o.steps || 12,
    color: o.color || '#a08060'
  };
}

function makeFurniture(o){
  return {
    id: o.id || uid('fur'),
    type: o.type,
    x: o.x, y: o.y, w: o.w, h: o.h,
    rot: o.rot || 0,
    color: o.color || '#c8b89a'
  };
}

/* ---------- Components ---------- */
function makeComp(o){
  return {
    id: o.id || uid('cp'),
    type: o.type,                    /* socket, switch, lamp, panel, etc */
    name: o.name,
    icon: o.icon,
    color: o.color,
    t: o.t,                          /* position on wall 0-1 */
    h: o.h,                          /* height from floor */
    side: o.side || 1,
    circuit: o.circuit || null,      /* circuit id */
    power: o.power || 0,
    on: o.on !== undefined ? o.on : true,
    applianceType: o.applianceType || null,
    panelId: o.panelId || null,
    meta: o.meta || {}
  };
}

function makeCeilComp(o){
  return {
    id: o.id || uid('cc'),
    type: o.type,
    name: o.name,
    icon: o.icon,
    color: o.color,
    rx: o.rx || 0.5,
    rz: o.rz || 0.5,
    circuit: o.circuit || null,
    power: o.power || 0,
    on: o.on !== undefined ? o.on : true,
    panelId: o.panelId || null
  };
}

/* ---------- Helpers ---------- */
function currentFloor(){
  if(!PROJ || !PROJ.floors.length) return null;
  return PROJ.floors[PROJ._currentFloor || 0];
}

function currentFloorLevel(){
  return PROJ ? (PROJ._currentFloor || 0) : 0;
}

function getRoomAt(x, y, floorIdx){
  var f = (floorIdx !== undefined) ? PROJ.floors[floorIdx] : currentFloor();
  if(!f) return null;
  for(var i=0; i<f.rooms.length; i++){
    var r = f.rooms[i];
    if(x >= r.x && x <= r.x+r.w && y >= r.y && y <= r.y+r.h) return r;
  }
  return null;
}

function getWallAt(x, y, tol, floorIdx){
  tol = tol || 0.3;
  var f = (floorIdx !== undefined) ? PROJ.floors[floorIdx] : currentFloor();
  if(!f) return null;
  var best = null, bd = tol;
  for(var i=0; i<f.walls.length; i++){
    var w = f.walls[i];
    var dx = w.x2-w.x1, dy = w.y2-w.y1;
    var L2 = dx*dx + dy*dy;
    if(L2 < 0.0001) continue;
    var t = clamp(((x-w.x1)*dx + (y-w.y1)*dy)/L2, 0, 1);
    var px = w.x1 + t*dx, py = w.y1 + t*dy;
    var d = dist(x, y, px, py);
    if(d < bd){ bd = d; best = { wall:w, t:t, px:px, py:py }; }
  }
  return best;
}

function wallLength(w){ return dist(w.x1, w.y1, w.x2, w.y2); }
function wallAngle(w){ return Math.atan2(w.y2-w.y1, w.x2-w.x1); }
function wallNormal(w){
  var dx = w.x2-w.x1, dy = w.y2-w.y1;
  var L = Math.hypot(dx, dy) || 1;
  return { x: -dy/L, y: dx/L, ux: dx/L, uy: dy/L };
}

function wallComp3DPos(comp, wall, floorLevel){
  var n = wallNormal(wall);
  var cx = wall.x1 + comp.t*(wall.x2-wall.x1);
  var cy = wall.y1 + comp.t*(wall.y2-wall.y1);
  var sd = comp.side || 1;
  var off = wall.thickness/2 + 0.04;
  return {
    x: cx + n.x*off*sd,
    y: floorLevel*PROJ.building.height + comp.h,
    z: cy + n.y*off*sd,
    angle: -Math.atan2(n.uy, n.ux),
    side: sd
  };
}

function ceilComp3DPos(comp, room, floorLevel){
  return {
    x: room.x + comp.rx*room.w,
    y: (floorLevel+1)*PROJ.building.height - 0.02,
    z: room.y + comp.rz*room.h
  };
}

/* Collect all components in the project with world positions */
function collectAllComps(){
  var out = [];
  if(!PROJ) return out;
  for(var fi=0; fi<PROJ.floors.length; fi++){
    var fd = PROJ.floors[fi];
    for(var wi=0; wi<fd.walls.length; wi++){
      var w = fd.walls[wi];
      ['1','-1'].forEach(function(sk){
        var face = w.faces[sk];
        if(!face) return;
        for(var ci=0; ci<face.components.length; ci++){
          var c = face.components[ci];
          var p = wallComp3DPos(c, w, fd.level);
          out.push({
            kind: 'wallComp',
            comp: c, wall: w, floorLevel: fd.level,
            pos: { x:p.x, y:p.y, z:p.z },
            circuit: c.circuit,
            power: c.power || 0,
            on: c.on !== false
          });
        }
      });
    }
    for(var ri=0; ri<fd.rooms.length; ri++){
      var room = fd.rooms[ri];
      var cc = room.ceilingComponents || [];
      for(var k=0; k<cc.length; k++){
        var x = cc[k];
        var p2 = ceilComp3DPos(x, room, fd.level);
        out.push({
          kind: 'ceilComp',
          comp: x, room: room, floorLevel: fd.level,
          pos: { x:p2.x, y:p2.y, z:p2.z },
          circuit: x.circuit,
          power: x.power || 0,
          on: x.on !== false
        });
      }
    }
  }
  return out;
}

function findComponentById(id){
  var all = collectAllComps();
  for(var i=0; i<all.length; i++){
    if(all[i].comp.id === id) return all[i];
  }
  return null;
}

function getAllCircuits(){
  if(!PROJ) return [];
  var circuits = [];
  for(var pi=0; pi<PROJ.panels.length; pi++){
    var p = PROJ.panels[pi];
    for(var ci=0; ci<p.circuits.length; ci++){
      var c = p.circuits[ci];
      c.panelId = p.id;
      circuits.push(c);
    }
  }
  return circuits;
}

function findCircuitById(id){
  var all = getAllCircuits();
  for(var i=0; i<all.length; i++) if(all[i].id === id) return all[i];
  return null;
}

/* ==================== Storage ==================== */
function loadAllProjects(){
  try {
    var s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : {};
  } catch(e){ return {}; }
}

function saveAllProjects(all){
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return true;
  } catch(e){
    console.error(e);
    return false;
  }
}

function saveCurrent(){
  if(!PROJ) return false;
  try {
    PROJ.updatedAt = Date.now();
    var all = loadAllProjects();
    all[PROJ.id] = clone(PROJ);
    var ok = saveAllProjects(all);
    if(ok) localStorage.setItem(LAST_KEY, PROJ.id);
    return ok;
  } catch(e){ return false; }
}

function doSave(){
  if(!PROJ){ toast('لا يوجد مشروع'); return; }
  toast(saveCurrent() ? '💾 تم الحفظ' : '⚠️ فشل');
}

function deleteProjectById(id){
  var all = loadAllProjects();
  delete all[id];
  saveAllProjects(all);
  if(localStorage.getItem(LAST_KEY) === id) localStorage.removeItem(LAST_KEY);
}

function getLastProjectId(){ return localStorage.getItem(LAST_KEY); }

function exportProject(){
  if(!PROJ) return;
  var data = JSON.stringify(PROJ, null, 2);
  var blob = new Blob([data], {type: 'application/json'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = (PROJ.name || 'project') + '.json';
  a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  toast('📤 تم التصدير');
}

function importProj(file){
  if(!file) return;
  var reader = new FileReader();
  reader.onload = function(e){
    try {
      var p = JSON.parse(e.target.result);
      if(!p.id) p.id = uid('proj');
      if(p._currentFloor === undefined) p._currentFloor = 0;
      PROJ = p;
      saveCurrent();
      renderProjectsList();
      go('plan');
      toast('📥 تم الاستيراد');
    } catch(err){ alert('ملف غير صالح'); }
  };
  reader.readAsText(file);
}

/* ==================== Auto-Design Engine ==================== */
/* Auto-assign circuits and create panel structure */
function autoDesignCircuits(){
  if(!PROJ) return;
  /* Ensure at least one panel exists */
  if(PROJ.panels.length === 0){
    PROJ.panels.push(makePanel({
      name: 'اللوحة الرئيسية',
      x: 0.5, y: 0.5,
      floor: 0
    }));
  }
  var mainPanel = PROJ.panels[0];

  /* Collect all components */
  var all = collectAllComps();

  /* Group by floor */
  var floorGroups = {};
  all.forEach(function(item){
    if(item.comp.type === 'panel') return;
    var fl = item.floorLevel;
    if(!floorGroups[fl]) floorGroups[fl] = { lights: [], sockets: [], kitchen: [], bathroom: [], hvac: [], washing: [], emergency: [], outdoor: [] };
    var type = item.comp.type;
    var appliance = item.comp.applianceType || '';
    if(['lamp', 'chand', 'spot', 'panel_led', 'sconce', 'doorbell'].indexOf(type) >= 0){
      floorGroups[fl].lights.push(item);
    } else if(type === 'emergency'){
      floorGroups[fl].emergency.push(item);
    } else if(type === 'oven' || appliance === 'kitchen'){
      floorGroups[fl].kitchen.push(item);
    } else if(type === 'water_heater' || appliance === 'bathroom'){
      floorGroups[fl].bathroom.push(item);
    } else if(type === 'ac' || type === 'ac_ceil'){
      floorGroups[fl].hvac.push(item);
    } else if(type === 'washing_machine'){
      floorGroups[fl].washing.push(item);
    } else if(type === 'socket' || type === 'socket2' || type === 'tv' || type === 'net'){
      floorGroups[fl].sockets.push(item);
    } else if(type === 'outdoor'){
      floorGroups[fl].outdoor.push(item);
    } else {
      floorGroups[fl].sockets.push(item);
    }
  });

  /* Clear existing circuits */
  mainPanel.circuits = [];

  /* Create circuits */
  var circuitsCreated = [];
  Object.keys(floorGroups).forEach(function(fl){
    var g = floorGroups[fl];
    var floorName = 'ط' + (+fl+1);

    if(g.lights.length){
      var c1 = makeCircuit({
        name: 'إنارة ' + floorName,
        type: 'lighting',
        section: CIRCUIT_TYPES.lighting.section,
        breaker: CIRCUIT_TYPES.lighting.breaker,
        color: CIRCUIT_TYPES.lighting.color
      });
      c1.components = g.lights.map(function(x){ return x.comp.id; });
      c1.floor = +fl;
      mainPanel.circuits.push(c1);
      circuitsCreated.push(c1);
    }
    if(g.sockets.length){
      var c2 = makeCircuit({
        name: 'مقابس ' + floorName,
        type: 'sockets',
        section: CIRCUIT_TYPES.sockets.section,
        breaker: CIRCUIT_TYPES.sockets.breaker,
        color: CIRCUIT_TYPES.sockets.color
      });
      c2.components = g.sockets.map(function(x){ return x.comp.id; });
      c2.floor = +fl;
      mainPanel.circuits.push(c2);
      circuitsCreated.push(c2);
    }
    if(g.kitchen.length){
      var ck = makeCircuit({
        name: 'مطبخ ' + floorName,
        type: 'kitchen',
        section: CIRCUIT_TYPES.kitchen.section,
        breaker: CIRCUIT_TYPES.kitchen.breaker,
        color: CIRCUIT_TYPES.kitchen.color
      });
      ck.components = g.kitchen.map(function(x){ return x.comp.id; });
      ck.floor = +fl;
      mainPanel.circuits.push(ck);
      circuitsCreated.push(ck);
    }
    if(g.bathroom.length){
      var cb = makeCircuit({
        name: 'حمام ' + floorName,
        type: 'bathroom',
        section: CIRCUIT_TYPES.bathroom.section,
        breaker: CIRCUIT_TYPES.bathroom.breaker,
        color: CIRCUIT_TYPES.bathroom.color
      });
      cb.components = g.bathroom.map(function(x){ return x.comp.id; });
      cb.floor = +fl;
      mainPanel.circuits.push(cb);
      circuitsCreated.push(cb);
    }
    if(g.hvac.length){
      var ch = makeCircuit({
        name: 'تكييف ' + floorName,
        type: 'hvac',
        section: CIRCUIT_TYPES.hvac.section,
        breaker: CIRCUIT_TYPES.hvac.breaker,
        color: CIRCUIT_TYPES.hvac.color
      });
      ch.components = g.hvac.map(function(x){ return x.comp.id; });
      ch.floor = +fl;
      mainPanel.circuits.push(ch);
      circuitsCreated.push(ch);
    }
    if(g.washing.length){
      var cw = makeCircuit({
        name: 'غسالة ' + floorName,
        type: 'washing',
        section: CIRCUIT_TYPES.washing.section,
        breaker: CIRCUIT_TYPES.washing.breaker,
        color: CIRCUIT_TYPES.washing.color
      });
      cw.components = g.washing.map(function(x){ return x.comp.id; });
      cw.floor = +fl;
      mainPanel.circuits.push(cw);
      circuitsCreated.push(cw);
    }
    if(g.emergency.length){
      var ce = makeCircuit({
        name: 'طوارئ ' + floorName,
        type: 'emergency',
        section: CIRCUIT_TYPES.emergency.section,
        breaker: CIRCUIT_TYPES.emergency.breaker,
        color: CIRCUIT_TYPES.emergency.color
      });
      ce.components = g.emergency.map(function(x){ return x.comp.id; });
      ce.floor = +fl;
      mainPanel.circuits.push(ce);
      circuitsCreated.push(ce);
    }
    if(g.outdoor.length){
      var co = makeCircuit({
        name: 'خارجي ' + floorName,
        type: 'outdoor',
        section: CIRCUIT_TYPES.outdoor.section,
        breaker: CIRCUIT_TYPES.outdoor.breaker,
        color: CIRCUIT_TYPES.outdoor.color
      });
      co.components = g.outdoor.map(function(x){ return x.comp.id; });
      co.floor = +fl;
      mainPanel.circuits.push(co);
      circuitsCreated.push(co);
    }
  });

  /* Assign circuit IDs back to components */
  circuitsCreated.forEach(function(c){
    c.components.forEach(function(cid){
      var item = findComponentById(cid);
      if(item) item.comp.circuit = c.id;
    });
  });

  /* Compute loads and cable sizing */
  computeCircuitLoads();

  /* Compute main breaker */
  var totalPower = 0;
  mainPanel.circuits.forEach(function(c){ totalPower += c.load || 0; });
  var mainInfo = calcMainBreaker(totalPower);
  mainPanel.mainBreaker = mainInfo.breaker;
  mainPanel.totalPower = totalPower;
  mainPanel.demandPower = mainInfo.demandPower;
  mainPanel.totalCurrent = mainInfo.current;
  mainPanel.diversityFactor = mainInfo.diversityFactor;

  return circuitsCreated.length;
}

/* Compute load, current, voltage drop for each circuit */
function computeCircuitLoads(){
  if(!PROJ) return;
  var panels = PROJ.panels;
  for(var pi=0; pi<panels.length; pi++){
    var p = panels[pi];
    for(var ci=0; ci<p.circuits.length; ci++){
      var c = p.circuits[ci];
      var totalPower = 0;
      var totalLen = 0;
      var comps = [];

      /* Sum power and compute distances */
      for(var k=0; k<c.components.length; k++){
        var item = findComponentById(c.components[k]);
        if(!item) continue;
        comps.push(item);
        totalPower += item.power || 0;
      }

      /* Approximate length: MST from panel to all comps */
      if(comps.length > 0){
        var panelNode = {
          pos: {
            x: p.x * PROJ.building.length,
            y: p.floor * PROJ.building.height + 1.2,
            z: p.y * PROJ.building.width
          }
        };
        var nodes = [panelNode].concat(comps.map(function(it){ return { pos: it.pos }; }));
        /* Simple MST approximation */
        var totalEdges = 0;
        var visited = [0];
        var unvisited = [];
        for(var i=1; i<nodes.length; i++) unvisited.push(i);
        while(unvisited.length > 0){
          var best = Infinity, bestIdx = -1, bestFrom = -1;
          for(var vi=0; vi<visited.length; vi++){
            for(var ui=0; ui<unvisited.length; ui++){
              var d = dist3(nodes[visited[vi]].pos, nodes[unvisited[ui]].pos);
              if(d < best){ best = d; bestIdx = ui; bestFrom = visited[vi]; }
            }
          }
          if(bestIdx >= 0){
            visited.push(unvisited[bestIdx]);
            totalEdges += best;
            unvisited.splice(bestIdx, 1);
          } else break;
        }
        totalLen = totalEdges * 1.15; /* +15% for vertical runs and detours */
      }

      c.load = totalPower;
      c.length = totalLen;
      c.threePhase = PROJ.system === 'three';

      /* Calculate current */
      if(c.threePhase){
        c.current = totalPower / (Math.sqrt(3) * ELEC.LINE_VOLTAGE * ELEC.COS_PHI);
      } else {
        c.current = totalPower / (ELEC.PHASE_VOLTAGE * ELEC.COS_PHI);
      }
      if(totalPower === 0) c.current = 0;

      /* Select cable based on current + length */
      var maxDrop = CIRCUIT_TYPES[c.type] ? CIRCUIT_TYPES[c.type].maxDrop : 3;
      if(c.current > 0.1){
        var sel = selectCable(c.current, totalLen, maxDrop, c.threePhase);
        c.section = sel.section;
        c.dropPercent = sel.dropPercent;
        c.dropVolts = sel.dropVolts;
        c.ampacity = sel.amp;
        c.cableWarning = sel.warning || null;
        c.breaker = sel.breaker;
      } else {
        c.section = CIRCUIT_TYPES[c.type] ? CIRCUIT_TYPES[c.type].section : 1.5;
        c.breaker = CIRCUIT_TYPES[c.type] ? CIRCUIT_TYPES[c.type].breaker : 10;
        c.dropPercent = 0;
        c.dropVolts = 0;
        c.ampacity = 20;
      }
    }
  }
}
