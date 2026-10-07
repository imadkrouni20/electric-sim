/* ==================== Plan Editor — Part A ==================== */
var planCanvas, planCtx;
var planView = { ox: 0, oy: 0, s: 30, baseS: 30 };
var planTool = 'select';
var planDrag = null, planMove = null, planSel = null;
var wallPt1 = null, longPressTimer = null;
var planShowDims = true, planShowCircuits = true;

function initPlan(){
  planCanvas = document.getElementById('planCanvas');
  var r = planCanvas.getBoundingClientRect();
  planCanvas.width = r.width * 2;
  planCanvas.height = r.height * 2;
  planCanvas.style.width = r.width + 'px';
  planCanvas.style.height = r.height + 'px';
  planCtx = planCanvas.getContext('2d');
  planCtx.setTransform(2, 0, 0, 2, 0, 0);
  fitPlanView();
  bindPlanEvents();
  buildPlanDock();
  renderPlan();
}

function fitPlanView(){
  if(!PROJ) return;
  var r = planCanvas.getBoundingClientRect();
  var pad = 70;
  var b = PROJ.building;
  planView.baseS = Math.min((r.width - 2*pad) / b.length, (r.height - 2*pad) / b.width);
  planView.s = planView.baseS;
  planView.ox = (r.width - b.length * planView.s) / 2;
  planView.oy = (r.height - b.width * planView.s) / 2;
}

function w2s(x, y){ return [planView.ox + x * planView.s, planView.oy + y * planView.s]; }
function s2w(px, py){ return [(px - planView.ox) / planView.s, (py - planView.oy) / planView.s]; }
function snapv(v){ return snap(v, 0.1); }

function buildPlanDock(){
  var dock = document.getElementById('planDock');
  if(!dock) return;
  var tools = [
    { id:'select',    ico:'👆', label:'تحديد' },
    { id:'room',      ico:'🏠', label:'غرفة' },
    { id:'wall',      ico:'🧱', label:'حيط' },
    { id:'door',      ico:'🚪', label:'باب' },
    { id:'window',    ico:'🪟', label:'نافذة' },
    { id:'stair',     ico:'🪜', label:'سلم' },
    { id:'furniture', ico:'🛋', label:'أثاث' },
    { id:'del',       ico:'🗑', label:'حذف' }
  ];
  dock.innerHTML = '';
  tools.forEach(function(t){
    var b = document.createElement('button');
    b.className = 'dock-btn' + (planTool === t.id ? ' active' : '');
    b.innerHTML = '<span class="ico">' + t.ico + '</span>' + t.label;
    b.onclick = function(){
      setPlanTool(t.id);
      buildPlanDock();
    };
    dock.appendChild(b);
  });
}

function setPlanTool(t){
  planTool = t;
  planDrag = null;
  wallPt1 = null;
  renderPlan();
  var tips = {
    select: 'اضغط للتحريك • ضغط مطوّل للخصائص',
    room: 'اسحب لإنشاء غرفة',
    wall: 'اضغط على حيطين لتوصيلهما',
    door: 'اضغط على حيط لإضافة باب',
    window: 'اضغط على حيط لإضافة نافذة',
    stair: 'اسحب لرسم سلم',
    furniture: 'اضغط داخل غرفة',
    del: 'اضغط لحذف عنصر'
  };
  showHint('planHint', tips[t] || '');
}

function bindPlanEvents(){
  var cv = planCanvas;
  var pointers = {};
  var pinchDist = 0;
  var downX = 0, downY = 0, downT = 0;

  cv.addEventListener('pointerdown', function(e){
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var n = Object.keys(pointers).length;
    if(n === 1){
      downX = e.clientX; downY = e.clientY; downT = Date.now();
      var r = cv.getBoundingClientRect();
      var w = s2w(e.clientX - r.left, e.clientY - r.top);

      if(planTool === 'room' || planTool === 'stair'){
        planDrag = {
          tool: planTool,
          x1: snapv(w[0]), y1: snapv(w[1]),
          curX: snapv(w[0]), curY: snapv(w[1])
        };
      } else if(planTool === 'select'){
        var hit = hitTestPlan(w[0], w[1]);
        if(hit){
          planMove = {
            hit: hit,
            startWx: w[0], startWy: w[1],
            orig: cloneShallow(hit.obj)
          };
          planSel = hit;
          longPressTimer = setTimeout(function(){
            if(planMove && planMove.hit === hit){
              planMove = null;
              showProperties(hit);
            }
          }, 700);
          renderPlan();
        } else {
          planSel = null;
          planMove = {
            pan: true,
            startCX: e.clientX, startCY: e.clientY,
            startOx: planView.ox, startOy: planView.oy
          };
        }
      }
    } else if(n === 2){
      var arr = Object.values(pointers);
      pinchDist = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
      planMove = null;
      if(longPressTimer){ clearTimeout(longPressTimer); longPressTimer = null; }
    }
  });

  cv.addEventListener('pointermove', function(e){
    if(pointers[e.pointerId]) pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var n = Object.keys(pointers).length;

    if(n === 2){
      var arr = Object.values(pointers);
      var d = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
      if(pinchDist > 0){
        planView.s = clamp(planView.s * (d / pinchDist), 6, 250);
        pinchDist = d;
      }
      renderPlan();
      return;
    }

    if(!planDrag && !planMove) return;
    var r = cv.getBoundingClientRect();
    var w = s2w(e.clientX - r.left, e.clientY - r.top);

    if(planDrag){
      planDrag.curX = snapv(w[0]);
      planDrag.curY = snapv(w[1]);
      /* magnetic alignment to room edges */
      var f = currentFloor();
      if(f){
        f.rooms.forEach(function(rm){
          [rm.x, rm.x + rm.w].forEach(function(cx){
            if(Math.abs(planDrag.curX - cx) < 0.25) planDrag.curX = cx;
          });
          [rm.y, rm.y + rm.h].forEach(function(cy){
            if(Math.abs(planDrag.curY - cy) < 0.25) planDrag.curY = cy;
          });
        });
      }
      renderPlan();
      return;
    }

    if(planMove){
      var dx = e.clientX - downX, dy = e.clientY - downY;
      if(Math.abs(dx) + Math.abs(dy) > 8 && longPressTimer){
        clearTimeout(longPressTimer); longPressTimer = null;
      }
      if(planMove.pan){
        planView.ox = planMove.startOx + (e.clientX - planMove.startCX);
        planView.oy = planMove.startOy + (e.clientY - planMove.startCY);
      } else if(planMove.hit){
        moveObjPlan(planMove.hit, planMove.orig, w[0] - planMove.startWx, w[1] - planMove.startWy);
      }
      renderPlan();
    }
  });

  cv.addEventListener('pointerup', function(e){
    var existed = !!pointers[e.pointerId];
    delete pointers[e.pointerId];
    if(Object.keys(pointers).length < 2) pinchDist = 0;
    if(longPressTimer){ clearTimeout(longPressTimer); longPressTimer = null; }

    var tapTime = Date.now() - downT;
    var movedDist = Math.hypot(e.clientX - downX, e.clientY - downY);

    if(movedDist < 10 && tapTime < 400){
      var r = cv.getBoundingClientRect();
      var w = s2w(e.clientX - r.left, e.clientY - r.top);
      if(planTool === 'select' && !planSel){
        handlePlanTap(w[0], w[1]);
      } else if(planTool !== 'select' && planTool !== 'room' && planTool !== 'stair'){
        handlePlanTap(w[0], w[1]);
      }
    }

    if(planDrag){
      var f = currentFloor();
      var dx = planDrag.curX - planDrag.x1;
      var dy = planDrag.curY - planDrag.y1;

      if(planDrag.tool === 'room' && Math.abs(dx) > 0.5 && Math.abs(dy) > 0.5){
        var rx = Math.min(planDrag.x1, planDrag.curX);
        var ry = Math.min(planDrag.y1, planDrag.curY);
        showRoomPicker(function(type){
          var room = makeRoom({
            type: type.id, name: type.name,
            x: rx, y: ry,
            w: Math.abs(dx), h: Math.abs(dy),
            floor: currentFloorLevel(),
            color: type.color
          });
          /* auto-add furniture */
          if(typeof autoFurnishRoom === 'function') autoFurnishRoom(room);
          f.rooms.push(room);
          rebuildWallsFromRooms();
          renderPlan();
        });
      } else if(planDrag.tool === 'stair' && Math.abs(dx) > 0.5 && Math.abs(dy) > 0.5){
        f.stairs.push(makeStair({
          x: Math.min(planDrag.x1, planDrag.curX),
          y: Math.min(planDrag.y1, planDrag.curY),
          w: Math.abs(dx), h: Math.abs(dy),
          floor: currentFloorLevel()
        }));
        renderPlan();
      }
      planDrag = null;
    }
    planMove = null;
  });

  cv.addEventListener('pointercancel', function(e){
    delete pointers[e.pointerId];
    pinchDist = 0;
    if(longPressTimer){ clearTimeout(longPressTimer); longPressTimer = null; }
    planDrag = null; planMove = null;
  });

  cv.addEventListener('wheel', function(e){
    e.preventDefault();
    planView.s = clamp(planView.s * (e.deltaY > 0 ? 0.9 : 1.1), 6, 250);
    renderPlan();
  }, { passive: false });
}

function cloneShallow(o){
  if(!o) return null;
  var c = {};
  for(var k in o) if(typeof o[k] !== 'object' || o[k] === null) c[k] = o[k];
  return c;
}

function moveObjPlan(hit, orig, dWx, dWy){
  var o = hit.obj;
  if(hit.kind === 'room'){
    o.x = Math.max(0, snapv(orig.x + dWx));
    o.y = Math.max(0, snapv(orig.y + dWy));
    o.x = Math.min(o.x, PROJ.building.length - o.w);
    o.y = Math.min(o.y, PROJ.building.width - o.h);
    rebuildWallsFromRooms();
  } else if(hit.kind === 'stair'){
    o.x = snapv(orig.x + dWx);
    o.y = snapv(orig.y + dWy);
  } else if(hit.kind === 'furniture'){
    o.x = snapv(orig.x + dWx);
    o.y = snapv(orig.y + dWy);
  } else if(hit.kind === 'wall'){
    var dx1 = o.x2 - o.x1, dy1 = o.y2 - o.y1;
    o.x1 = snapv(orig.x1 + dWx);
    o.y1 = snapv(orig.y1 + dWy);
    o.x2 = o.x1 + dx1;
    o.y2 = o.y1 + dy1;
  } else if(hit.kind === 'opening'){
    var wl = hit.wall;
    var L = wallLength(wl);
    var n = wallNormal(wl);
    var dAlong = dWx * n.ux + dWy * n.uy;
    o.t = clamp(orig.t + dAlong / L, 0.05, 0.95);
  }
}

function hitTestPlan(wx, wy){
  var f = currentFloor();
  if(!f) return null;
  /* furniture */
  for(var ri = 0; ri < f.rooms.length; ri++){
    var room = f.rooms[ri];
    for(var fi = 0; fi < room.furniture.length; fi++){
      var fn = room.furniture[fi];
      if(wx >= fn.x && wx <= fn.x + fn.w && wy >= fn.y && wy <= fn.y + fn.h){
        return { kind: 'furniture', obj: fn, room: room };
      }
    }
  }
  /* stairs */
  for(var si = 0; si < f.stairs.length; si++){
    var s = f.stairs[si];
    if(wx >= s.x && wx <= s.x + s.w && wy >= s.y && wy <= s.y + s.h){
      return { kind: 'stair', obj: s };
    }
  }
  /* walls + openings */
  var wr = getWallAt(wx, wy, 0.25);
  if(wr){
    for(var oi = 0; oi < wr.wall.openings.length; oi++){
      var o = wr.wall.openings[oi];
      var cx = wr.wall.x1 + o.t * (wr.wall.x2 - wr.wall.x1);
      var cy = wr.wall.y1 + o.t * (wr.wall.y2 - wr.wall.y1);
      if(Math.hypot(wx - cx, wy - cy) < o.w / 2 + 0.2){
        return { kind: 'opening', obj: o, wall: wr.wall };
      }
    }
    return { kind: 'wall', obj: wr.wall };
  }
  /* rooms */
  for(var ri2 = 0; ri2 < f.rooms.length; ri2++){
    var room2 = f.rooms[ri2];
    if(wx >= room2.x && wx <= room2.x + room2.w && wy >= room2.y && wy <= room2.y + room2.h){
      return { kind: 'room', obj: room2 };
    }
  }
  return null;
}

/* ==================== Part B — Operations ==================== */
function handlePlanTap(wx, wy){
  if(!PROJ) return;
  var f = currentFloor();
  if(!f) return;

  if(planTool === 'wall'){
    var wr = getWallAt(wx, wy, 0.35);
    if(!wr){ showHint('planHint', 'اضغط على حيط'); return; }
    handleWallPoint(wr);
    return;
  }

  if(planTool === 'door' || planTool === 'window'){
    var wr2 = getWallAt(wx, wy, 0.3);
    if(!wr2){ showHint('planHint', 'لم تلمس حيط'); return; }
    showOpeningDialog(wr2.wall, wr2.t, planTool);
    return;
  }

  if(planTool === 'furniture'){
    var room2 = getRoomAt(wx, wy);
    if(!room2){ showHint('planHint', 'اضغط داخل غرفة'); return; }
    showFurniturePicker(room2);
    return;
  }

  if(planTool === 'del'){
    var hit = hitTestPlan(wx, wy);
    if(!hit) return;
    if(hit.kind === 'room'){
      f.rooms = f.rooms.filter(function(r){ return r !== hit.obj; });
      rebuildWallsFromRooms();
    }
    else if(hit.kind === 'opening'){
      hit.wall.openings = hit.wall.openings.filter(function(x){ return x !== hit.obj; });
    }
    else if(hit.kind === 'wall' && hit.obj.manual){
      f.walls = f.walls.filter(function(w){ return w !== hit.obj; });
    }
    else if(hit.kind === 'stair'){
      f.stairs = f.stairs.filter(function(s){ return s !== hit.obj; });
    }
    else if(hit.kind === 'furniture'){
      hit.room.furniture = hit.room.furniture.filter(function(x){ return x !== hit.obj; });
    }
    renderPlan();
    return;
  }
}

function handleWallPoint(wr){
  var wall = wr.wall;
  var L = wallLength(wall);
  var d = wr.t * L;
  var html = '<p style="color:#8899aa;font-size:12px;margin-bottom:10px">طول الحيط: <b style="color:#00d9ff">' + L.toFixed(2) + 'م</b></p>';
  html += '<label>المسافة من بداية الحيط (م)</label>';
  html += '<input id="wpDist" type="number" step="0.1" min="0" max="' + L.toFixed(2) + '" value="' + d.toFixed(2) + '">';
  var title = wallPt1 ? 'النقطة الثانية' : 'النقطة الأولى';
  openModal(title, html, function(){
    var dd = clamp(+document.getElementById('wpDist').value, 0, L);
    var t = dd / L;
    var px = wall.x1 + t * (wall.x2 - wall.x1);
    var py = wall.y1 + t * (wall.y2 - wall.y1);
    closeModal();
    if(!wallPt1){
      wallPt1 = { x: px, y: py, wall: wall, t: t };
      showHint('planHint', '✔ النقطة الأولى — اضغط الحيط الثاني');
      renderPlan();
    } else {
      if(dist(px, py, wallPt1.x, wallPt1.y) < 0.2){
        showHint('planHint', 'النقطتان متقاربتان');
        wallPt1 = null;
        return;
      }
      currentFloor().walls.push(makeWall({
        x1: wallPt1.x, y1: wallPt1.y, x2: px, y2: py,
        floor: currentFloorLevel(),
        manual: true
      }));
      wallPt1 = null;
      renderPlan();
      showHint('planHint', '✔ تم إنشاء الحيط');
    }
  });
}

function showRoomPicker(cb){
  var html = '<div class="room-grid">';
  ROOM_TYPES.forEach(function(t){
    html += '<button data-rt="' + t.id + '" style="background:' + t.color + ';color:#000">';
    html += '<span class="ico">' + t.icon + '</span>';
    html += '<span>' + t.name + '</span></button>';
  });
  html += '</div>';
  openModal('اختر نوع الغرفة', html);
  document.getElementById('modalBody').onclick = function(e){
    var b = e.target.closest('[data-rt]');
    if(!b) return;
    var type = ROOM_TYPES.find(function(x){ return x.id === b.dataset.rt; });
    closeModal();
    cb(type);
  };
}

function showOpeningDialog(wall, t, type){
  var isDoor = type === 'door';
  var L = wallLength(wall);
  var html = '<label>المسافة من البداية (م)</label>';
  html += '<input id="odDist" type="number" step="0.1" value="' + (t * L).toFixed(2) + '">';
  html += '<label>العرض (م)</label>';
  html += '<input id="odW" type="number" step="0.1" value="' + (isDoor ? 0.9 : 1.2) + '">';
  html += '<label>الارتفاع (م)</label>';
  html += '<input id="odH" type="number" step="0.1" value="' + (isDoor ? 2.1 : 1.4) + '">';
  if(!isDoor){
    html += '<label>العتبة (م)</label>';
    html += '<input id="odSill" type="number" step="0.1" value="0.9">';
  }
  html += '<label>الوجه</label>';
  html += '<select id="odSide"><option value="1">الوجه A</option><option value="-1">الوجه B</option></select>';
  openModal(isDoor ? 'إضافة باب' : 'إضافة نافذة', html, function(){
    var d = +document.getElementById('odDist').value;
    var op = makeOpening({
      type: type,
      t: clamp(d / L, 0.02, 0.98),
      w: +document.getElementById('odW').value,
      h: +document.getElementById('odH').value,
      sill: isDoor ? 0 : +document.getElementById('odSill').value,
      side: +document.getElementById('odSide').value
    });
    for(var i = 0; i < wall.openings.length; i++){
      var ex = wall.openings[i];
      if(Math.abs((ex.t - op.t) * L) < (ex.w + op.w) / 2){
        showHint('planHint', 'تداخل مع فتحة أخرى');
        return;
      }
    }
    wall.openings.push(op);
    closeModal();
    renderPlan();
  });
}

function showFurniturePicker(room){
  var list = FURNITURE[room.type] || FURNITURE.living || [];
  if(!list.length){ showHint('planHint', 'لا أثاث لهذا النوع'); return; }
  var html = '<div class="room-grid">';
  list.forEach(function(f){
    html += '<button data-fn="' + f.type + '" style="background:rgba(255,255,255,0.08);color:#e8eef7">';
    html += '<span class="ico">' + f.icon + '</span>';
    html += '<span>' + f.name + '</span></button>';
  });
  html += '</div>';
  openModal('اختر أثاث', html);
  document.getElementById('modalBody').onclick = function(e){
    var b = e.target.closest('[data-fn]');
    if(!b) return;
    var item = list.find(function(x){ return x.type === b.dataset.fn; });
    room.furniture.push(makeFurniture({
      type: item.type,
      x: room.x + 0.3, y: room.y + 0.3,
      w: item.w, h: item.h
    }));
    closeModal();
    renderPlan();
  };
}

function showProperties(hit){
  var o = hit.obj, html = '';
  if(hit.kind === 'room'){
    html = '<label>الاسم</label><input id="pN" value="' + o.name + '">';
    html += '<label>الطول (م)</label><input id="pW" type="number" step="0.1" value="' + o.w.toFixed(2) + '">';
    html += '<label>العرض (م)</label><input id="pH" type="number" step="0.1" value="' + o.h.toFixed(2) + '">';
    html += '<label>اللون</label><input id="pC" type="color" value="' + o.color + '">';
  } else if(hit.kind === 'wall'){
    html = '<label>الطول (م)</label><input id="pLen" type="number" step="0.1" value="' + wallLength(o).toFixed(2) + '">';
    html += '<label>السماكة (م)</label><input id="pTh" type="number" step="0.01" value="' + o.thickness + '">';
  } else if(hit.kind === 'opening'){
    html = '<label>العرض (م)</label><input id="oW" type="number" step="0.1" value="' + o.w.toFixed(2) + '">';
    html += '<label>الارتفاع (م)</label><input id="oH" type="number" step="0.1" value="' + o.h.toFixed(2) + '">';
    if(o.type === 'window'){
      html += '<label>العتبة (م)</label><input id="oSill" type="number" step="0.1" value="' + (o.sill || 0.9) + '">';
    }
  } else if(hit.kind === 'stair'){
    html = '<label>عدد الدرجات</label><input id="sN" type="number" value="' + (o.steps || 12) + '">';
  } else if(hit.kind === 'furniture'){
    html = '<label>الطول (م)</label><input id="fW" type="number" step="0.1" value="' + o.w.toFixed(2) + '">';
    html += '<label>العرض (م)</label><input id="fH" type="number" step="0.1" value="' + o.h.toFixed(2) + '">';
  }

  openModal('الخصائص', html, function(){
    if(hit.kind === 'room'){
      o.name = document.getElementById('pN').value || o.name;
      o.w = Math.max(0.5, +document.getElementById('pW').value);
      o.h = Math.max(0.5, +document.getElementById('pH').value);
      o.color = document.getElementById('pC').value;
      rebuildWallsFromRooms();
    } else if(hit.kind === 'wall'){
      var nl = +document.getElementById('pLen').value;
      var ol = wallLength(o);
      var k = nl / ol;
      var cx = (o.x1 + o.x2) / 2, cy = (o.y1 + o.y2) / 2;
      o.x1 = cx + (o.x1 - cx) * k; o.x2 = cx + (o.x2 - cx) * k;
      o.y1 = cy + (o.y1 - cy) * k; o.y2 = cy + (o.y2 - cy) * k;
      o.thickness = +document.getElementById('pTh').value;
    } else if(hit.kind === 'opening'){
      o.w = +document.getElementById('oW').value;
      o.h = +document.getElementById('oH').value;
      if(o.type === 'window') o.sill = +document.getElementById('oSill').value;
    } else if(hit.kind === 'stair'){
      o.steps = +document.getElementById('sN').value;
    } else if(hit.kind === 'furniture'){
      o.w = +document.getElementById('fW').value;
      o.h = +document.getElementById('fH').value;
    }
    closeModal();
    renderPlan();
  });

  var actions = document.querySelector('.modal-actions');
  var del = document.createElement('button');
  del.textContent = '🗑';
  del.className = 'btn-del';
  del.onclick = function(){
    var f = currentFloor();
    if(hit.kind === 'room'){ f.rooms = f.rooms.filter(function(x){ return x !== o; }); rebuildWallsFromRooms(); }
    else if(hit.kind === 'wall'){ f.walls = f.walls.filter(function(x){ return x !== o; }); }
    else if(hit.kind === 'opening'){ hit.wall.openings = hit.wall.openings.filter(function(x){ return x !== o; }); }
    else if(hit.kind === 'stair'){ f.stairs = f.stairs.filter(function(x){ return x !== o; }); }
    else if(hit.kind === 'furniture'){ hit.room.furniture = hit.room.furniture.filter(function(x){ return x !== o; }); }
    planSel = null;
    closeModal();
    renderPlan();
  };
  actions.insertBefore(del, actions.firstChild);
}

function rebuildWallsFromRooms(){
  var f = currentFloor();
  if(!f) return;
  var manual = f.walls.filter(function(w){ return w.manual; });
  var ws = {};
  f.rooms.forEach(function(r){
    var edges = [
      [r.x, r.y, r.x + r.w, r.y],
      [r.x, r.y + r.h, r.x + r.w, r.y + r.h],
      [r.x, r.y, r.x, r.y + r.h],
      [r.x + r.w, r.y, r.x + r.w, r.y + r.h]
    ];
    edges.forEach(function(e){
      var a = [Math.round(e[0] * 100) / 100, Math.round(e[1] * 100) / 100];
      var b = [Math.round(e[2] * 100) / 100, Math.round(e[3] * 100) / 100];
      if(a[0] > b[0] || (a[0] === b[0] && a[1] > b[1])){
        var tmp = a; a = b; b = tmp;
      }
      var k = a[0] + '_' + a[1] + '_' + b[0] + '_' + b[1];
      if(!ws[k]) ws[k] = { x1: a[0], y1: a[1], x2: b[0], y2: b[1] };
    });
  });
  var oldAuto = f.walls.filter(function(w){ return !w.manual; });
  var newAuto = [];
  Object.keys(ws).forEach(function(k){
    var c = ws[k];
    var old = null;
    for(var i = 0; i < oldAuto.length; i++){
      var ow = oldAuto[i];
      if(Math.abs(ow.x1 - c.x1) < 0.01 && Math.abs(ow.y1 - c.y1) < 0.01 &&
         Math.abs(ow.x2 - c.x2) < 0.01 && Math.abs(ow.y2 - c.y2) < 0.01){
        old = ow; break;
      }
    }
    newAuto.push(old || makeWall({
      x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2,
      floor: currentFloorLevel(),
      thickness: PROJ.building.wallThickness,
      manual: false
    }));
  });
  f.walls = newAuto.concat(manual);
}

/* ==================== Part C — Rendering ==================== */
function renderPlan(){
  if(!planCanvas || !planCtx || !PROJ) return;
  var r = planCanvas.getBoundingClientRect();
  var ctx = planCtx;
  ctx.clearRect(0, 0, r.width, r.height);
  ctx.fillStyle = '#0a0e1a';
  ctx.fillRect(0, 0, r.width, r.height);

  /* grid */
  drawPlanGrid(r.width, r.height);

  /* building outline */
  var b = PROJ.building;
  var p1 = w2s(0, 0), p2 = w2s(b.length, b.width);
  ctx.fillStyle = 'rgba(20,25,40,0.4)';
  ctx.fillRect(p1[0], p1[1], p2[0] - p1[0], p2[1] - p1[1]);
  ctx.strokeStyle = 'rgba(0,217,255,0.4)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(p1[0], p1[1], p2[0] - p1[0], p2[1] - p1[1]);
  ctx.setLineDash([]);

  var f = currentFloor();
  if(!f) return;

  /* rooms */
  f.rooms.forEach(function(room){ drawRoomPlan(room); });

  /* walls */
  f.walls.forEach(function(w){ drawWallPlan(w); });

  /* stairs */
  f.stairs.forEach(function(s){ drawStairPlan(s); });

  /* dimensions */
  if(planShowDims) drawDimensions(f);

  /* electrical symbols */
  if(planShowCircuits){
    var allComps = collectAllComps();
    allComps.forEach(function(item){
      if(item.floorLevel !== PROJ._currentFloor) return;
      drawElecSymbol(item);
    });
  }

  /* wallPt1 marker */
  if(wallPt1){
    var wp = w2s(wallPt1.x, wallPt1.y);
    ctx.fillStyle = '#ff9500';
    ctx.beginPath();
    ctx.arc(wp[0], wp[1], 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /* drag preview */
  if(planDrag){
    var pa = w2s(planDrag.x1, planDrag.y1);
    var pb = w2s(planDrag.curX, planDrag.curY);
    ctx.strokeStyle = '#ff9500';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    if(planDrag.tool === 'room' || planDrag.tool === 'stair'){
      ctx.strokeRect(pa[0], pa[1], pb[0] - pa[0], pb[1] - pa[1]);
      ctx.fillStyle = '#ff9500';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      var dw = Math.abs(planDrag.curX - planDrag.x1);
      var dh = Math.abs(planDrag.curY - planDrag.y1);
      ctx.fillText(dw.toFixed(2) + '×' + dh.toFixed(2) + 'م', (pa[0] + pb[0]) / 2, pa[1] - 8);
    }
    ctx.setLineDash([]);
  }

  /* info panel */
  drawPlanInfo(r.width, r.height, f);
}

function drawPlanGrid(W, H){
  var ctx = planCtx;
  var gridSize = Math.max(10, planView.s * 0.5);
  if(gridSize < 10) gridSize = 10;
  ctx.strokeStyle = 'rgba(0,217,255,0.04)';
  ctx.lineWidth = 0.5;
  for(var x = planView.ox % gridSize; x < W; x += gridSize){
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for(var y = planView.oy % gridSize; y < H; y += gridSize){
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
}

function drawRoomPlan(room){
  var ctx = planCtx;
  var p = w2s(room.x, room.y);
  var pw = room.w * planView.s;
  var ph = room.h * planView.s;
  var isSel = planSel && planSel.kind === 'room' && planSel.obj === room;

  /* fill */
  ctx.fillStyle = room.color;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(p[0], p[1], pw, ph);
  ctx.globalAlpha = 1;

  /* border */
  ctx.strokeStyle = isSel ? '#ff00ff' : 'rgba(0,0,0,0.35)';
  ctx.lineWidth = isSel ? 3 : 1;
  ctx.strokeRect(p[0], p[1], pw, ph);

  /* furniture */
  room.furniture.forEach(function(fn){
    drawFurniturePlan(fn);
  });

  /* room label */
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(room.name, p[0] + pw / 2, p[1] + ph / 2 - 14);
  ctx.font = '11px Arial';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillText(room.w.toFixed(1) + '×' + room.h.toFixed(1) + 'م', p[0] + pw / 2, p[1] + ph / 2 + 2);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.font = '10px Arial';
  ctx.fillText((room.w * room.h).toFixed(1) + ' م²', p[0] + pw / 2, p[1] + ph / 2 + 16);
}

function drawFurniturePlan(fn){
  var ctx = planCtx;
  var p = w2s(fn.x, fn.y);
  var pw = fn.w * planView.s;
  var ph = fn.h * planView.s;
  if(pw < 4 || ph < 4) return;

  var isSel = planSel && planSel.kind === 'furniture' && planSel.obj === fn;

  /* fill */
  ctx.fillStyle = fn.color || '#a08060';
  ctx.globalAlpha = 0.75;
  ctx.fillRect(p[0], p[1], pw, ph);
  ctx.globalAlpha = 1;

  /* border */
  ctx.strokeStyle = isSel ? '#ff00ff' : 'rgba(0,0,0,0.5)';
  ctx.lineWidth = isSel ? 2 : 0.8;
  ctx.strokeRect(p[0], p[1], pw, ph);

  /* simple icon */
  var item = null;
  for(var cat in FURNITURE){
    var arr = FURNITURE[cat];
    for(var i = 0; i < arr.length; i++){
      if(arr[i].type === fn.type){ item = arr[i]; break; }
    }
    if(item) break;
  }
  if(item && planView.s > 20){
    ctx.font = Math.min(20, planView.s * 0.35) + 'px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.7;
    ctx.fillText(item.icon, p[0] + pw / 2, p[1] + ph / 2);
    ctx.globalAlpha = 1;
  }
}

function drawWallPlan(w){
  var ctx = planCtx;
  var p1 = w2s(w.x1, w.y1);
  var p2 = w2s(w.x2, w.y2);
  var th = Math.max(4, w.thickness * planView.s);
  var isSel = planSel && planSel.kind === 'wall' && planSel.obj === w;

  /* wall body */
  ctx.strokeStyle = isSel ? '#ff00ff' : '#1a1a1a';
  ctx.lineWidth = isSel ? th + 3 : th;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(p1[0], p1[1]);
  ctx.lineTo(p2[0], p2[1]);
  ctx.stroke();

  /* openings */
  var L = wallLength(w);
  var dx = p2[0] - p1[0], dy = p2[1] - p1[1];
  var ul = Math.hypot(dx, dy);
  if(ul < 0.01) return;
  var ux = dx / ul, uy = dy / ul;
  var nx = -uy, ny = ux;

  w.openings.forEach(function(o){
    var cx = p1[0] + ux * (o.t * ul);
    var cy = p1[1] + uy * (o.t * ul);
    var ow = o.w * planView.s;
    var hx1 = cx - ux * ow / 2, hy1 = cy - uy * ow / 2;
    var hx2 = cx + ux * ow / 2, hy2 = cy + uy * ow / 2;

    /* clear */
    ctx.strokeStyle = '#0a0e1a';
    ctx.lineWidth = th + 5;
    ctx.beginPath();
    ctx.moveTo(hx1, hy1);
    ctx.lineTo(hx2, hy2);
    ctx.stroke();

    var isOSel = planSel && planSel.kind === 'opening' && planSel.obj === o;

    if(o.type === 'door'){
      ctx.strokeStyle = isOSel ? '#ff00ff' : '#00d9ff';
      ctx.lineWidth = isOSel ? 3 : 2;
      var rw = o.w * planView.s;
      var ex = hx1 + nx * rw, ey = hy1 + ny * rw;
      ctx.beginPath();
      ctx.moveTo(hx1, hy1);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.beginPath();
      var a1 = Math.atan2(uy, ux);
      var a2 = Math.atan2(ny, nx);
      ctx.arc(hx1, hy1, rw, Math.min(a1, a2), Math.max(a1, a2), false);
      ctx.stroke();
    } else {
      ctx.strokeStyle = isOSel ? '#ff00ff' : '#ff9500';
      ctx.lineWidth = 3;
      var off = 2;
      ctx.beginPath();
      ctx.moveTo(hx1 + nx * off, hy1 + ny * off);
      ctx.lineTo(hx2 + nx * off, hy2 + ny * off);
      ctx.moveTo(hx1 - nx * off, hy1 - ny * off);
      ctx.lineTo(hx2 - nx * off, hy2 - ny * off);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(hx1, hy1);
      ctx.lineTo(hx2, hy2);
      ctx.strokeStyle = isOSel ? '#ff00ff' : 'rgba(255,149,0,0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  });
}

function drawStairPlan(s){
  var ctx = planCtx;
  var p = w2s(s.x, s.y);
  var pw = s.w * planView.s;
  var ph = s.h * planView.s;
  var isSel = planSel && planSel.kind === 'stair' && planSel.obj === s;

  ctx.fillStyle = s.color;
  ctx.globalAlpha = 0.8;
  ctx.fillRect(p[0], p[1], pw, ph);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = isSel ? '#ff00ff' : '#000';
  ctx.lineWidth = isSel ? 3 : 1.5;
  ctx.strokeRect(p[0], p[1], pw, ph);

  /* steps */
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 0.8;
  var n = s.steps || 12;
  for(var i = 1; i < n; i++){
    var y = p[1] + (i / n) * ph;
    ctx.beginPath();
    ctx.moveTo(p[0], y);
    ctx.lineTo(p[0] + pw, y);
    ctx.stroke();
  }
  /* arrow */
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 2;
  var cx = p[0] + pw / 2;
  ctx.beginPath();
  ctx.moveTo(cx, p[1] + ph * 0.85);
  ctx.lineTo(cx, p[1] + ph * 0.15);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 5, p[1] + ph * 0.22);
  ctx.lineTo(cx, p[1] + ph * 0.15);
  ctx.lineTo(cx + 5, p[1] + ph * 0.22);
  ctx.stroke();
}

function drawElecSymbol(item){
  var ctx = planCtx;
  var p = w2s(item.pos.x, item.pos.z);
  var size = 8;
  var color = item.comp.color || '#ffd700';
  if(item.comp.circuit){
    var c = findCircuitById(item.comp.circuit);
    if(c) color = c.color;
  }

  /* glow */
  ctx.beginPath();
  ctx.arc(p[0], p[1], size + 3, 0, Math.PI * 2);
  ctx.fillStyle = color + '40';
  ctx.fill();

  /* body */
  ctx.beginPath();
  ctx.arc(p[0], p[1], size, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();

  /* icon */
  if(planView.s > 18){
    ctx.font = 'bold ' + (size + 2) + 'px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(item.comp.icon || '·', p[0], p[1] + 1);
  }
}

function drawDimensions(f){
  var ctx = planCtx;
  ctx.fillStyle = 'rgba(0,217,255,0.7)';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  /* building dimensions */
  var b = PROJ.building;
  var p1 = w2s(0, 0), p2 = w2s(b.length, b.width);
  var offset = 35;
  /* top */
  ctx.strokeStyle = 'rgba(0,217,255,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(p1[0], p1[1] - offset);
  ctx.lineTo(p2[0], p1[1] - offset);
  ctx.stroke();
  ctx.fillText(b.length.toFixed(2) + 'م', (p1[0] + p2[0]) / 2, p1[1] - offset - 8);

  /* left */
  ctx.beginPath();
  ctx.moveTo(p1[0] - offset, p1[1]);
  ctx.lineTo(p1[0] - offset, p2[1]);
  ctx.stroke();
  ctx.save();
  ctx.translate(p1[0] - offset - 8, (p1[1] + p2[1]) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(b.width.toFixed(2) + 'م', 0, 0);
  ctx.restore();
}

function drawPlanInfo(W, H, f){
  var ctx = planCtx;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(8, H - 44, 200, 36);
  ctx.fillStyle = '#8899aa';
  ctx.font = '11px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('الطابق: ' + (PROJ._currentFloor + 1) + '/' + PROJ.building.floors, 16, H - 38);
  ctx.fillText('الزوم: ' + (planView.s / planView.baseS * 100).toFixed(0) + '% • الغرف: ' + f.rooms.length, 16, H - 24);
}

/* ==================== Auto-furnish ==================== */
function autoFurnishRoom(room){
  var list = FURNITURE[room.type];
  if(!list || !list.length) return;
  /* place one item of each type depending on room size */
  var maxItems = Math.min(list.length, Math.floor(room.w * room.h / 4));
  if(maxItems < 1) maxItems = 1;
  for(var i = 0; i < maxItems; i++){
    var item = list[i];
    if(item.w > room.w - 0.4 || item.h > room.h - 0.4) continue;
    room.furniture.push(makeFurniture({
      type: item.type,
      x: room.x + 0.3 + (i * 0.6) % Math.max(0.4, room.w - item.w - 0.3),
      y: room.y + 0.3,
      w: item.w, h: item.h
    }));
  }
}

/* ==================== Toggle helpers ==================== */
function togglePlanDims(){
  planShowDims = !planShowDims;
  renderPlan();
  toast(planShowDims ? '📏 القياسات ظاهرة' : '📏 القياسات مخفية');
}
function togglePlanCircuits(){
  planShowCircuits = !planShowCircuits;
  renderPlan();
  toast(planShowCircuits ? '⚡ المكونات ظاهرة' : '⚡ المكونات مخفية');
}
