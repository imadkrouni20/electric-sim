/* ==================== App — Part A: Navigation & Projects ==================== */

function go(page){
  document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
  var el = document.getElementById('page-' + page);
  if(el) el.classList.add('active');

  if(page === 'plan'){
    setTimeout(function(){ initPlan(); renderPlan(); buildPlanDock(); }, 50);
  }
  if(page === 'three'){
    setTimeout(function(){ initThree3D(); }, 50);
  }
  if(page === 'wall' && typeof curWall !== 'undefined' && curWall){
    setTimeout(function(){ fitWallCanvas(); renderWall(); }, 50);
  }
  if(page === 'ceil' && typeof curRoom !== 'undefined' && curRoom){
    setTimeout(function(){ fitCeilCanvas(); renderCeil(); }, 50);
  }
  if(page === 'panel'){
    setTimeout(renderPanelView, 50);
  }
  if(page === 'report'){
    setTimeout(renderReport, 50);
  }
}

/* ==================== Projects List ==================== */
function renderProjectsList(){
  var all = loadAllProjects();
  var box = document.getElementById('projList');
  if(!box) return;
  box.innerHTML = '';
  var keys = Object.keys(all);
  if(!keys.length){
    box.innerHTML = '<p style="text-align:center;color:#6b7280;padding:30px 10px;font-size:13px">لا مشاريع بعد</p>';
    return;
  }
  keys.sort(function(a, b){ return (all[b].updatedAt || 0) - (all[a].updatedAt || 0); });
  keys.forEach(function(k){
    var p = all[k];
    var d = new Date(p.updatedAt || p.createdAt || Date.now());
    var str = d.toLocaleDateString('ar') + ' • ' + d.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
    var card = document.createElement('div');
    card.className = 'proj-card';
    card.innerHTML =
      '<div class="info">' +
        '<div class="name">' + (p.name || 'بدون اسم') + '</div>' +
        '<div class="meta">' + (p.building ? p.building.length + '×' + p.building.width + 'م • ' + p.building.floors + ' طوابق' : '') + ' • ' + str + '</div>' +
      '</div>' +
      '<div class="actions">' +
        '<button class="minibtn" data-act="open" data-id="' + k + '">↗</button>' +
        '<button class="minibtn danger" data-act="del" data-id="' + k + '">🗑</button>' +
      '</div>';
    box.appendChild(card);
  });
  box.onclick = function(e){
    var b = e.target.closest('button');
    if(!b) return;
    var id = b.dataset.id;
    if(b.dataset.act === 'open'){
      var all2 = loadAllProjects();
      PROJ = all2[id];
      if(PROJ._currentFloor === undefined) PROJ._currentFloor = 0;
      if(PROJ._powerOn === undefined) PROJ._powerOn = true;
      powerOn = PROJ._powerOn;
      go('plan');
    } else if(b.dataset.act === 'del'){
      if(confirm('حذف المشروع "' + (loadAllProjects()[id].name) + '" ؟')){
        deleteProjectById(id);
        renderProjectsList();
      }
    }
  };
}

function newProject(){
  PROJ = createProject({ name: 'مشروعي ' + new Date().toLocaleDateString('ar') });
  PROJ.floors = [makeFloor(0)];
  PROJ._currentFloor = 0;
  /* reset form */
  document.getElementById('fName').value = PROJ.name;
  document.getElementById('fLen').value = 14;
  document.getElementById('fWid').value = 12;
  document.getElementById('fHei').value = 3;
  document.getElementById('fFloors').value = 1;
  document.getElementById('fRX').value = 2;
  document.getElementById('fRY').value = 2;
  document.getElementById('fThick').value = 0.2;
  document.getElementById('fSystem').value = 'single';
  go('setup');
}

function deleteProject(){
  if(!PROJ) return;
  if(confirm('حذف المشروع الحالي؟')){
    deleteProjectById(PROJ.id);
    PROJ = null;
    go('home');
    renderProjectsList();
  }
}

function applySetup(){
  if(!PROJ) return;
  var name = document.getElementById('fName').value || 'مشروع';
  var L = +document.getElementById('fLen').value;
  var W = +document.getElementById('fWid').value;
  var H = +document.getElementById('fHei').value;
  var floors = +document.getElementById('fFloors').value;
  var rx = +document.getElementById('fRX').value;
  var ry = +document.getElementById('fRY').value;
  var th = +document.getElementById('fThick').value;
  var sys = document.getElementById('fSystem').value;

  if(L < 4 || W < 4 || H < 2.5 || floors < 1 || rx < 1 || ry < 1){
    toast('تحقق من القيم', 'warn');
    return;
  }

  PROJ.name = name;
  PROJ.system = sys;
  PROJ.building.length = L;
  PROJ.building.width = W;
  PROJ.building.height = H;
  PROJ.building.floors = floors;
  PROJ.building.wallThickness = th;
  PROJ.building.wallColor = document.getElementById('fWallC').value;
  PROJ.building.floorColor = document.getElementById('fFloorC').value;
  PROJ.building.ceilColor = document.getElementById('fCeilC').value;

  /* create floors and rooms */
  PROJ.floors = [];
  var rw = L / rx;
  var rh = W / ry;
  var roomTypesSequence = ['bedroom', 'living', 'kitchen', 'bathroom', 'office', 'dining'];

  for(var f = 0; f < floors; f++){
    var fd = makeFloor(f);
    for(var i = 0; i < rx; i++){
      for(var j = 0; j < ry; j++){
        var typeId = roomTypesSequence[(i * ry + j) % roomTypesSequence.length];
        var rt = ROOM_TYPES.find(function(x){ return x.id === typeId; });
        var room = makeRoom({
          type: rt.id,
          name: rt.name + ' ' + (f + 1) + '-' + (i + 1) + (j + 1),
          x: i * rw,
          y: j * rh,
          w: rw,
          h: rh,
          floor: f,
          color: rt.color
        });
        autoFurnishRoom(room);
        fd.rooms.push(room);
      }
    }
    PROJ.floors.push(fd);
  }

  /* build walls */
  PROJ._currentFloor = 0;
  for(var k = 0; k < PROJ.floors.length; k++){
    var sv = PROJ._currentFloor;
    PROJ._currentFloor = k;
    rebuildWallsFromRooms();
    PROJ._currentFloor = sv;
  }
  PROJ._currentFloor = 0;

  /* create main panel */
  PROJ.panels = [makePanel({
    name: 'اللوحة الرئيسية',
    x: 0.05,
    y: 0.5,
    floor: 0
  })];

  saveCurrent();
  go('plan');
  toast('✔ تم إنشاء المخطط');
}

/* ==================== Part B — Auto-Design Engine ==================== */

/* Per-room electrical templates (realistic for a home in North Africa) */
var ROOM_ELEC_TEMPLATES = {
  bedroom: [
    { type: 'ceiling', compId: 'lamp', rx: 0.5, rz: 0.5, power: 60 },
    { type: 'wall', compId: 'switch', t: 0.05, h: 1.4, side: 1 },
    { type: 'wall', compId: 'socket', t: 0.3, h: 0.3, side: 1 },
    { type: 'wall', compId: 'socket', t: 0.7, h: 0.3, side: 1 },
    { type: 'wall', compId: 'tv', t: 0.9, h: 1.2, side: 1 }
  ],
  living: [
    { type: 'ceiling', compId: 'chand', rx: 0.5, rz: 0.5, power: 200 },
    { type: 'wall', compId: 'switch2', t: 0.05, h: 1.4, side: 1 },
    { type: 'wall', compId: 'socket', t: 0.25, h: 0.3, side: 1 },
    { type: 'wall', compId: 'socket', t: 0.5, h: 0.3, side: 1 },
    { type: 'wall', compId: 'socket', t: 0.75, h: 0.3, side: 1 },
    { type: 'wall', compId: 'tv', t: 0.9, h: 1.2, side: 1 }
  ],
  kitchen: [
    { type: 'ceiling', compId: 'panel_led', rx: 0.5, rz: 0.5, power: 80 },
    { type: 'wall', compId: 'switch', t: 0.1, h: 1.4, side: 1 },
    { type: 'wall', compId: 'socket', t: 0.3, h: 1.2, side: 1 },
    { type: 'wall', compId: 'oven', t: 0.5, h: 1.2, side: 1 },
    { type: 'wall', compId: 'socket', t: 0.7, h: 1.2, side: 1 },
    { type: 'wall', compId: 'socket', t: 0.9, h: 0.3, side: 1 }
  ],
  bathroom: [
    { type: 'ceiling', compId: 'spot', rx: 0.4, rz: 0.5, power: 30 },
    { type: 'ceiling', compId: 'spot', rx: 0.6, rz: 0.5, power: 30 },
    { type: 'wall', compId: 'switch', t: 0.05, h: 1.2, side: 1 },
    { type: 'wall', compId: 'socket', t: 0.5, h: 0.9, side: 1 },
    { type: 'wall', compId: 'water_heater', t: 0.85, h: 2.0, side: 1 }
  ],
  hallway: [
    { type: 'ceiling', compId: 'lamp', rx: 0.5, rz: 0.5, power: 40 },
    { type: 'wall', compId: 'vav', t: 0.1, h: 1.4, side: 1 },
    { type: 'wall', compId: 'socket', t: 0.5, h: 0.3, side: 1 }
  ],
  office: [
    { type: 'ceiling', compId: 'lamp', rx: 0.5, rz: 0.5, power: 80 },
    { type: 'wall', compId: 'switch', t: 0.05, h: 1.4, side: 1 },
    { type: 'wall', compId: 'socket2', t: 0.5, h: 0.3, side: 1 },
    { type: 'wall', compId: 'net', t: 0.7, h: 0.3, side: 1 }
  ],
  storage: [
    { type: 'ceiling', compId: 'lamp', rx: 0.5, rz: 0.5, power: 30 },
    { type: 'wall', compId: 'switch', t: 0.05, h: 1.4, side: 1 }
  ],
  stairs: [
    { type: 'ceiling', compId: 'spot', rx: 0.5, rz: 0.3, power: 30 },
    { type: 'ceiling', compId: 'spot', rx: 0.5, rz: 0.7, power: 30 }
  ],
  balcony: [
    { type: 'ceiling', compId: 'lamp', rx: 0.5, rz: 0.5, power: 40 },
    { type: 'wall', compId: 'socket', t: 0.5, h: 0.3, side: 1 }
  ],
  garage: [
    { type: 'ceiling', compId: 'lamp', rx: 0.3, rz: 0.5, power: 60 },
    { type: 'ceiling', compId: 'lamp', rx: 0.7, rz: 0.5, power: 60 },
    { type: 'wall', compId: 'switch', t: 0.05, h: 1.4, side: 1 },
    { type: 'wall', compId: 'socket', t: 0.5, h: 0.3, side: 1 }
  ],
  dining: [
    { type: 'ceiling', compId: 'chand', rx: 0.5, rz: 0.5, power: 120 },
    { type: 'wall', compId: 'switch', t: 0.05, h: 1.4, side: 1 },
    { type: 'wall', compId: 'socket', t: 0.3, h: 0.3, side: 1 },
    { type: 'wall', compId: 'socket', t: 0.7, h: 0.3, side: 1 }
  ],
  kids: [
    { type: 'ceiling', compId: 'lamp', rx: 0.5, rz: 0.5, power: 50 },
    { type: 'wall', compId: 'switch', t: 0.05, h: 1.2, side: 1 },
    { type: 'wall', compId: 'socket', t: 0.4, h: 0.3, side: 1 },
    { type: 'wall', compId: 'socket', t: 0.7, h: 0.3, side: 1 }
  ]
};

/* Fill each room with components based on templates */
function applyAutoDesign(){
  if(!PROJ) return 0;
  var count = 0;

  PROJ.floors.forEach(function(fd){
    /* for each room, get its 4 walls */
    var wallsByRoom = findWallsAroundRoom(fd);
    fd.rooms.forEach(function(room){
      var template = ROOM_ELEC_TEMPLATES[room.type] || ROOM_ELEC_TEMPLATES.bedroom;

      /* get walls containing this room's edges */
      var roomWalls = wallsByRoom[room.id] || [];

      /* Remove existing components in this room's walls related to this room (avoid duplicates) */
      /* For simplicity, only add if no component exists yet in any of the room's walls */
      var existingCount = 0;
      roomWalls.forEach(function(w){
        ['1','-1'].forEach(function(sk){
          existingCount += w.faces[sk].components.length;
        });
      });
      if(existingCount > 0) return;

      var wallIndex = 0;
      template.forEach(function(tmpl){
        if(tmpl.type === 'ceiling'){
          var catalogItem = findCatalogItem(tmpl.compId);
          if(!catalogItem) return;
          var cc = makeCeilComp({
            type: catalogItem.id,
            name: catalogItem.name,
            icon: catalogItem.icon,
            color: catalogItem.color,
            rx: tmpl.rx, rz: tmpl.rz,
            power: tmpl.power || catalogItem.power || 0,
            circuit: catalogItem.circuit
          });
          if(!room.ceilingComponents) room.ceilingComponents = [];
          room.ceilingComponents.push(cc);
          count++;
        } else {
          /* wall component — use the closest wall to the room at t=0.5 */
          if(!roomWalls.length) return;
          var w = roomWalls[wallIndex % roomWalls.length];
          wallIndex++;
          var catalogItem2 = findCatalogItem(tmpl.compId);
          if(!catalogItem2) return;
          var side = tmpl.side || 1;
          /* Adjust t to fit inside the wall that bounds this room */
          var t = tmpl.t;
          if(t > 0.95) t = 0.95;
          var comp = makeComp({
            type: catalogItem2.id,
            name: catalogItem2.name,
            icon: catalogItem2.icon,
            color: catalogItem2.color,
            t: t,
            h: tmpl.h,
            side: side,
            power: tmpl.power || catalogItem2.power || 0,
            circuit: catalogItem2.circuit
          });
          w.faces[String(side)].components.push(comp);
          count++;
        }
      });
    });
  });

  /* now run the auto circuit designer */
  var circuits = autoDesignCircuits();
  toast('⚡ ' + count + ' مكون • ' + circuits + ' دائرة');
  return count;
}

/* Find walls that surround each room */
function findWallsAroundRoom(fd){
  var result = {};
  fd.rooms.forEach(function(r){
    result[r.id] = [];
    fd.walls.forEach(function(w){
      /* Check if wall is on any of the 4 room edges */
      var roomEdges = [
        { x1: r.x, y1: r.y, x2: r.x + r.w, y2: r.y },             /* top */
        { x1: r.x, y1: r.y + r.h, x2: r.x + r.w, y2: r.y + r.h },  /* bottom */
        { x1: r.x, y1: r.y, x2: r.x, y2: r.y + r.h },              /* left */
        { x1: r.x + r.w, y1: r.y, x2: r.x + r.w, y2: r.y + r.h }   /* right */
      ];
      for(var e = 0; e < roomEdges.length; e++){
        var re = roomEdges[e];
        if(nearlyEqual(re.x1, w.x1) && nearlyEqual(re.y1, w.y1) &&
           nearlyEqual(re.x2, w.x2) && nearlyEqual(re.y2, w.y2)){
          result[r.id].push(w);
          break;
        }
        /* also try reversed */
        if(nearlyEqual(re.x1, w.x2) && nearlyEqual(re.y1, w.y2) &&
           nearlyEqual(re.x2, w.x1) && nearlyEqual(re.y2, w.y1)){
          result[r.id].push(w);
          break;
        }
      }
    });
  });
  return result;
}

function nearlyEqual(a, b, eps){
  eps = eps || 0.05;
  return Math.abs(a - b) < eps;
}

/* Called from UI */
function autoDesign(){
  if(!PROJ){ toast('افتح مشروعاً', 'warn'); return; }
  var count = applyAutoDesign();
  if(count === 0){
    toast('جميع الغرف تحتوي مكونات مسبقاً', 'warn');
  }
  build3D();
  rebuildWires3D();
  renderPanelView();
}

/* ==================== Part C — Panel View + Report + Boot ==================== */

function renderPanelView(){
  var box = document.getElementById('panelView');
  if(!box) return;
  if(!PROJ || !PROJ.panels.length){
    box.innerHTML = '<p style="color:#8899aa;padding:30px;text-align:center">لا توجد لوحة — استخدم 🧠 للتصميم الآلي</p>';
    return;
  }

  var panel = PROJ.panels[0];
  var html = '';

  /* Panel info */
  html += '<h3>📊 اللوحة الرئيسية</h3>';
  html += '<div class="row"><span>الاسم</span><span>' + panel.name + '</span></div>';
  html += '<div class="row"><span>النظام</span><span>' + (PROJ.system === 'three' ? '3 أطوار 400V' : 'أحادي الطور 230V') + '</span></div>';
  html += '<div class="row"><span>عدد الدوائر</span><span>' + panel.circuits.length + '</span></div>';
  if(panel.totalPower){
    html += '<div class="row"><span>الحمل الكلي</span><span>' + (panel.totalPower / 1000).toFixed(2) + ' kW</span></div>';
    html += '<div class="row"><span>بعد معامل التعدد</span><span>' + (panel.demandPower / 1000).toFixed(2) + ' kW</span></div>';
    html += '<div class="row"><span>التيار المحسوب</span><span>' + panel.totalCurrent.toFixed(1) + ' A</span></div>';
    html += '<div class="row tot"><span>القاطع الرئيسي</span><span>' + panel.mainBreaker + ' A</span></div>';
  }

  /* Circuits */
  html += '<h3>🔌 الدوائر</h3>';
  if(!panel.circuits.length){
    html += '<p style="color:#6b7280;font-size:12px;padding:10px">لا دوائر — استخدم 🧠 للتصميم الآلي</p>';
  } else {
    panel.circuits.forEach(function(c, i){
      var typeInfo = CIRCUIT_TYPES[c.type] || {};
      var dropClass = c.dropPercent > (c.maxDrop || 5) ? 'warn' : 'ok';
      html += '<div class="panel-slot" style="border-right-color:' + (c.color || typeInfo.color || '#00d9ff') + '">';
      html += '<div class="pos">' + (i + 1) + '</div>';
      html += '<div class="info">';
      html += '<div class="name">' + c.name + '</div>';
      html += '<div class="meta">' +
        (c.components.length) + ' مكوّن • ' +
        (c.load / 1000).toFixed(2) + ' kW • ' +
        c.section + ' mm² • ' +
        c.length.toFixed(1) + ' م • ' +
        'ΔU ' + (c.dropPercent || 0).toFixed(2) + '%' +
      '</div>';
      html += '</div>';
      html += '<div class="rating">' + c.breaker + 'A</div>';
      html += '</div>';
    });
  }

  box.innerHTML = html;
}

/* ==================== Report ==================== */
function renderReport(){
  var box = document.getElementById('reportView');
  if(!box || !PROJ) return;
  var html = '';

  /* Project info */
  html += '<h3>📋 ملخص المشروع</h3>';
  html += '<div class="row"><span>الاسم</span><span>' + PROJ.name + '</span></div>';
  html += '<div class="row"><span>الأبعاد</span><span>' + PROJ.building.length + '×' + PROJ.building.width + '×' + PROJ.building.height + 'م</span></div>';
  html += '<div class="row"><span>عدد الطوابق</span><span>' + PROJ.building.floors + '</span></div>';
  html += '<div class="row"><span>النظام الكهربائي</span><span>' + (PROJ.system === 'three' ? 'ثلاثي الأطوار' : 'أحادي الطور') + '</span></div>';

  /* Count all components */
  var counts = {};
  var totalWallComps = 0, totalCeilComps = 0;
  collectAllComps().forEach(function(item){
    var n = item.comp.name;
    counts[n] = (counts[n] || 0) + 1;
    if(item.kind === 'wallComp') totalWallComps++;
    else totalCeilComps++;
  });

  html += '<h3>🔧 المكونات</h3>';
  html += '<div class="row"><span>مكونات الجدران</span><span>' + totalWallComps + '</span></div>';
  html += '<div class="row"><span>مكونات الأسقف</span><span>' + totalCeilComps + '</span></div>';
  Object.keys(counts).sort().forEach(function(name){
    html += '<div class="row"><span>' + name + '</span><span>' + counts[name] + '</span></div>';
  });

  /* Circuits report */
  html += '<h3>⚡ الدوائر الكهربائية</h3>';
  var circuits = getAllCircuits();
  if(!circuits.length){
    html += '<p style="color:#6b7280;font-size:12px;padding:10px">شغّل التصميم الآلي أولاً</p>';
  } else {
    var totalCable = 0, totalPower = 0;
    circuits.forEach(function(c, i){
      totalCable += c.length * (c.section > 2.5 ? 3 : 2);
      totalPower += c.load;
      var ok = c.dropPercent <= (c.maxDrop || 5);
      var cls = ok ? 'ok' : 'warn';
      html += '<div class="row ' + cls + '">';
      html += '<span>' + c.name + ' — ' + c.breaker + 'A / ' + c.section + 'mm²</span>';
      html += '<span>' + c.length.toFixed(1) + 'م • ΔU ' + (c.dropPercent || 0).toFixed(2) + '%</span>';
      html += '</div>';
    });
    html += '<div class="row tot"><span>إجمالي طول الكابلات</span><span>' + totalCable.toFixed(1) + ' م</span></div>';
    html += '<div class="row tot"><span>إجمالي الحمل</span><span>' + (totalPower / 1000).toFixed(2) + ' kW</span></div>';
  }

  /* Cable shopping list */
  html += '<h3>🛒 قائمة المواد</h3>';
  var cableBySection = {};
  circuits.forEach(function(c){
    var wires = (c.type === 'lighting' || c.type === 'emergency') ? 2 : 3;
    cableBySection[c.section] = (cableBySection[c.section] || 0) + c.length * wires;
  });
  Object.keys(cableBySection).sort(function(a, b){ return +a - +b; }).forEach(function(s){
    html += '<div class="row"><span>كابل ' + s + ' mm² (phase+neutre+terre)</span><span>' + cableBySection[s].toFixed(1) + ' م</span></div>';
  });

  /* Breaker shopping list */
  var breakerCounts = {};
  circuits.forEach(function(c){
    breakerCounts[c.breaker] = (breakerCounts[c.breaker] || 0) + 1;
  });
  Object.keys(breakerCounts).sort(function(a, b){ return +a - +b; }).forEach(function(b){
    html += '<div class="row"><span>قاطع ' + b + 'A</span><span>' + breakerCounts[b] + '</span></div>';
  });

  if(PROJ.panels[0] && PROJ.panels[0].mainBreaker){
    html += '<div class="row"><span>القاطع الرئيسي</span><span>' + PROJ.panels[0].mainBreaker + 'A</span></div>';
  }

  /* Electrical outlets list */
  var outletCounts = {};
  collectAllComps().forEach(function(item){
    var t = item.comp.type;
    if(['socket','socket2','socket_wp','tv','net','phone','thermo'].indexOf(t) >= 0){
      outletCounts[t] = (outletCounts[t] || 0) + 1;
    }
  });
  if(Object.keys(outletCounts).length){
    html += '<h3>🔌 المقابس</h3>';
    Object.keys(outletCounts).forEach(function(t){
      var item = findCatalogItem(t);
      html += '<div class="row"><span>' + (item ? item.name : t) + '</span><span>' + outletCounts[t] + '</span></div>';
    });
  }

  box.innerHTML = html;
}

function exportReport(){
  if(!PROJ) return;
  var box = document.getElementById('reportView');
  var text = box ? box.innerText : '';
  var blob = new Blob([text], { type: 'text/plain' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = (PROJ.name || 'report') + '-report.txt';
  a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  toast('📤 تم التصدير');
}

/* ==================== Modal ==================== */
function openModal(title, html, okFn){
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = html;
  document.getElementById('modal').classList.add('show');
  var ok = document.getElementById('modalOk');
  /* reset actions to default (cancel + ok) */
  var actions = document.querySelector('.modal-actions');
  actions.innerHTML = '<button onclick="closeModal()">إلغاء</button><button class="btn-ok" id="modalOk">تأكيد</button>';
  var newOk = document.getElementById('modalOk');
  newOk.onclick = okFn || closeModal;
}

function closeModal(){
  document.getElementById('modal').classList.remove('show');
}

/* ==================== Boot ==================== */
function boot(){
  /* hide joysticks */
  var jl = document.getElementById('joyL');
  var jr = document.getElementById('joyR');
  if(jl) jl.style.display = 'none';
  if(jr) jr.style.display = 'none';

  renderProjectsList();

  /* auto-open last project */
  var last = getLastProjectId();
  if(last){
    var all = loadAllProjects();
    if(all[last]){
      PROJ = all[last];
      if(PROJ._currentFloor === undefined) PROJ._currentFloor = 0;
      if(PROJ._powerOn === undefined) PROJ._powerOn = true;
      powerOn = PROJ._powerOn;
    }
  }
}

window.addEventListener('load', boot);
