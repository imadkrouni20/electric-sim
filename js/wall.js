/* ==================== Wall Editor ==================== */
var wallCanvas, wallCtx, curWall = null, curFace = 1;
var wallSelComp = null, wallDrag = null, wallLongT = null;
var WALL_PAD = 35;

function initWallEditor(){
  wallCanvas = document.getElementById('wallCanvas');
  if(!wallCanvas) return;
  bindWallEvents();
}

function openWallEditor(wall, side){
  curWall = wall;
  curFace = side || 1;
  wallSelComp = null;
  document.getElementById('faceA').classList.toggle('active', curFace === 1);
  document.getElementById('faceB').classList.toggle('active', curFace === -1);
  var L = wallLength(wall).toFixed(2);
  document.getElementById('wallTitle').textContent = 'حيط ' + L + 'م';
  go('wall');
  setTimeout(function(){ fitWallCanvas(); renderWall(); buildWallDock(); }, 60);
}

function setFace(s){
  curFace = s;
  wallSelComp = null;
  document.getElementById('faceA').classList.toggle('active', s === 1);
  document.getElementById('faceB').classList.toggle('active', s === -1);
  renderWall();
  buildWallDock();
}

function fitWallCanvas(){
  var cv = wallCanvas;
  if(!cv) return;
  var r = cv.getBoundingClientRect();
  cv.width = r.width * 2;
  cv.height = r.height * 2;
  cv.style.width = r.width + 'px';
  cv.style.height = r.height + 'px';
  wallCtx = cv.getContext('2d');
  wallCtx.setTransform(2, 0, 0, 2, 0, 0);
}

function buildWallDock(){
  var dock = document.getElementById('wallDock');
  if(!dock) return;
  dock.innerHTML = '';
  WALL_CATALOG.forEach(function(item){
    var b = document.createElement('button');
    b.className = 'dock-btn';
    b.innerHTML = '<span class="ico">' + item.icon + '</span>' + item.name.split(' ')[0];
    b.onclick = function(){ addWallComp(item); };
    dock.appendChild(b);
  });
}

function addWallComp(item){
  if(!curWall) return;
  var face = curWall.faces[String(curFace)];
  if(!face) return;
  var n = face.components.length;
  var t = 0.15 + ((n % 5) * 0.15);
  var h = 0.3 + Math.floor(n / 5) * 0.55;
  if(h > PROJ.building.height - 0.15) h = 0.3;
  var c = makeComp({
    type: item.id, name: item.name, icon: item.icon, color: item.color,
    t: t, h: h, side: curFace,
    circuit: item.circuit || null, power: item.power || 0
  });
  face.components.push(c);
  wallSelComp = c;
  renderWall();
  toast('✔ ' + item.name);
}

function renderWall(){
  if(!wallCanvas || !wallCtx || !curWall) return;
  var r = wallCanvas.getBoundingClientRect();
  var W = r.width, H = r.height;
  var ctx = wallCtx;
  ctx.fillStyle = '#f8f9fb';
  ctx.fillRect(0, 0, W, H);

  var wallW = W - WALL_PAD * 2;
  var wallH = H - WALL_PAD * 2 - 80;
  if(wallW < 50 || wallH < 50) return;
  var bh = PROJ.building.height;

  /* wall rectangle */
  ctx.fillStyle = '#fff';
  ctx.fillRect(WALL_PAD, WALL_PAD, wallW, wallH);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 3;
  ctx.strokeRect(WALL_PAD, WALL_PAD, wallW, wallH);
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(WALL_PAD - 5, WALL_PAD + wallH);
  ctx.lineTo(WALL_PAD + wallW + 5, WALL_PAD + wallH);
  ctx.stroke();

  /* height ruler */
  ctx.fillStyle = '#8899aa';
  ctx.font = '10px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for(var h = 0; h <= bh; h += 0.5){
    var yy = WALL_PAD + wallH - (h / bh) * wallH;
    ctx.strokeStyle = '#ccd2dd';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(WALL_PAD, yy);
    ctx.lineTo(WALL_PAD + (h % 1 === 0 ? 12 : 6), yy);
    ctx.stroke();
    if(h % 1 === 0) ctx.fillText(h.toFixed(0) + 'م', WALL_PAD - 24, yy);
  }

  /* openings */
  curWall.openings.forEach(function(o){ drawOpeningWall(o, wallW, wallH); });

  /* components */
  var face = curWall.faces[String(curFace)];
  if(face) face.components.forEach(function(c){ drawCompWall(c, wallW, wallH); });

  /* header */
  ctx.fillStyle = curFace === 1 ? '#00d9ff' : '#ff64a0';
  ctx.font = 'bold 13px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(curFace === 1 ? '🅰 الوجه A' : '🅱 الوجه B', WALL_PAD, 6);
  var cnt = face ? face.components.length : 0;
  ctx.fillStyle = '#666';
  ctx.font = '12px Arial';
  ctx.textAlign = 'right';
  ctx.fillText(cnt + ' مكون', W - WALL_PAD, 8);
}

function hToPx(h){
  var r = wallCanvas.getBoundingClientRect();
  var wallH = r.height - WALL_PAD * 2 - 80;
  return WALL_PAD + wallH - (h / PROJ.building.height) * wallH;
}
function pxToH(px){
  var r = wallCanvas.getBoundingClientRect();
  var wallH = r.height - WALL_PAD * 2 - 80;
  return ((WALL_PAD + wallH - px) / wallH) * PROJ.building.height;
}
function compPosWall(c){
  var r = wallCanvas.getBoundingClientRect();
  var wallW = r.width - WALL_PAD * 2;
  var wallH = r.height - WALL_PAD * 2 - 80;
  return [WALL_PAD + c.t * wallW, WALL_PAD + wallH - (c.h / PROJ.building.height) * wallH];
}

function drawOpeningWall(o, wallW, wallH){
  var ctx = wallCtx;
  var L = wallLength(curWall);
  var cx = WALL_PAD + o.t * wallW;
  var ow = o.w * (wallW / L);
  var hx1 = cx - ow / 2, hx2 = cx + ow / 2;
  var bottom = hToPx(o.sill);
  var top = hToPx(o.sill + o.h);
  if(o.type === 'door'){
    ctx.strokeStyle = o.color || '#8b5a2b';
    ctx.lineWidth = 3;
    ctx.strokeRect(hx1, top, hx2 - hx1, bottom - top);
    ctx.fillStyle = o.color || '#8b5a2b';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🚪', cx, (top + bottom) / 2);
  } else {
    ctx.fillStyle = o.glassColor || '#a8d8ff';
    ctx.fillRect(hx1, top, hx2 - hx1, bottom - top);
    ctx.strokeStyle = o.color || '#8b5a2b';
    ctx.lineWidth = 3;
    ctx.strokeRect(hx1, top, hx2 - hx1, bottom - top);
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx, bottom);
    ctx.stroke();
    ctx.fillStyle = '#3a5a80';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🪟', cx, (top + bottom) / 2);
  }
}

function drawCompWall(c, wallW, wallH){
  var ctx = wallCtx;
  var p = compPosWall(c);
  var x = p[0], y = p[1];
  var isSel = wallSelComp === c;
  var item = findCatalogItem(c.type) || {};
  var size = item.id === 'panel' ? 22 : 15;

  if(isSel){
    ctx.beginPath();
    ctx.arc(x, y, size + 8, 0, Math.PI * 2);
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fillStyle = c.color || '#f59e0b';
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold ' + (size + 2) + 'px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(c.icon || '?', x, y + 1);

  ctx.fillStyle = isSel ? '#ff00ff' : '#666';
  ctx.font = 'bold 10px Arial';
  ctx.textBaseline = 'bottom';
  ctx.fillText(c.h.toFixed(2) + 'م', x, y - size - 4);
}

function hitCompWall(px, py){
  if(!curWall) return null;
  var face = curWall.faces[String(curFace)];
  if(!face) return null;
  for(var i = face.components.length - 1; i >= 0; i--){
    var c = face.components[i];
    var p = compPosWall(c);
    if(Math.hypot(px - p[0], py - p[1]) < 22) return c;
  }
  return null;
}

function bindWallEvents(){
  var cv = wallCanvas;
  if(!cv || cv._bound) return;
  cv._bound = true;
  var downT = 0;

  cv.addEventListener('pointerdown', function(e){
    var r = cv.getBoundingClientRect();
    var px = e.clientX - r.left, py = e.clientY - r.top;
    downT = Date.now();
    var hit = hitCompWall(px, py);
    if(hit){
      wallSelComp = hit;
      wallDrag = { comp: hit, startT: Date.now() };
      wallLongT = setTimeout(function(){
        if(wallDrag && Date.now() - wallDrag.startT > 700){
          if(confirm('حذف "' + hit.name + '" ؟')){
            var face = curWall.faces[String(hit.side)];
            face.components = face.components.filter(function(x){ return x !== hit; });
            wallSelComp = null;
            renderWall();
            toast('🗑 تم الحذف');
          }
          wallDrag = null;
          wallLongT = null;
        }
      }, 700);
      renderWall();
    } else {
      wallSelComp = null;
      renderWall();
    }
  });

  cv.addEventListener('pointermove', function(e){
    if(!wallDrag) return;
    if(wallLongT){ clearTimeout(wallLongT); wallLongT = null; }
    var r = cv.getBoundingClientRect();
    var px = e.clientX - r.left, py = e.clientY - r.top;
    px = clamp(px, WALL_PAD, r.width - WALL_PAD);
    py = clamp(py, WALL_PAD, r.height - WALL_PAD - 80);
    var wallW = r.width - WALL_PAD * 2;
    wallDrag.comp.t = clamp((px - WALL_PAD) / wallW, 0.02, 0.98);
    wallDrag.comp.h = clamp(pxToH(py), 0.1, PROJ.building.height - 0.1);
    renderWall();
  });

  cv.addEventListener('pointerup', function(){
    if(wallLongT){ clearTimeout(wallLongT); wallLongT = null; }
    wallDrag = null;
  });

  cv.addEventListener('pointercancel', function(){
    if(wallLongT){ clearTimeout(wallLongT); wallLongT = null; }
    wallDrag = null;
  });
}
