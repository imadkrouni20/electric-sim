/* ==================== Ceiling Editor ==================== */
var ceilCanvas, ceilCtx, curRoom = null, ceilSel = null, ceilDrag = null, ceilLongT = null;
var CEIL_PAD = 40;

function initCeilEditor(){
  ceilCanvas = document.getElementById('ceilCanvas');
  if(!ceilCanvas) return;
  bindCeilEvents();
}

function openCeilEditor(room, floorLevel){
  curRoom = room;
  if(!curRoom.ceilingComponents) curRoom.ceilingComponents = [];
  ceilSel = null;
  document.getElementById('ceilTitle').textContent = room.name;
  go('ceil');
  setTimeout(function(){ fitCeilCanvas(); renderCeil(); buildCeilDock(); }, 60);
}

function fitCeilCanvas(){
  var cv = ceilCanvas;
  if(!cv) return;
  var r = cv.getBoundingClientRect();
  cv.width = r.width * 2;
  cv.height = r.height * 2;
  cv.style.width = r.width + 'px';
  cv.style.height = r.height + 'px';
  ceilCtx = cv.getContext('2d');
  ceilCtx.setTransform(2, 0, 0, 2, 0, 0);
}

function buildCeilDock(){
  var dock = document.getElementById('ceilDock');
  if(!dock) return;
  dock.innerHTML = '';
  CEIL_CATALOG.forEach(function(item){
    var b = document.createElement('button');
    b.className = 'dock-btn';
    b.innerHTML = '<span class="ico">' + item.icon + '</span>' + item.name.split(' ')[0];
    b.onclick = function(){ addCeilComp(item); };
    dock.appendChild(b);
  });
}

function addCeilComp(item){
  if(!curRoom) return;
  var n = curRoom.ceilingComponents.length;
  var cols = 3;
  var rx = ((n % cols) + 0.5) / cols;
  var rz = (Math.floor(n / cols) + 0.5) / Math.max(1, Math.ceil((n + 1) / cols));
  var c = makeCeilComp({
    type: item.id, name: item.name, icon: item.icon, color: item.color,
    rx: rx, rz: rz,
    circuit: item.circuit || null, power: item.power || 0
  });
  curRoom.ceilingComponents.push(c);
  ceilSel = c;
  renderCeil();
  toast('✔ ' + item.name);
}

function renderCeil(){
  if(!ceilCanvas || !ceilCtx || !curRoom) return;
  var r = ceilCanvas.getBoundingClientRect();
  var W = r.width, H = r.height;
  var ctx = ceilCtx;
  ctx.fillStyle = '#f8f9fb';
  ctx.fillRect(0, 0, W, H);
  var pad = CEIL_PAD;
  var pw = W - pad * 2;
  var ph = H - pad * 2 - 80;

  ctx.fillStyle = '#fff';
  ctx.fillRect(pad, pad, pw, ph);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 3;
  ctx.strokeRect(pad, pad, pw, ph);

  /* dimensions */
  ctx.fillStyle = '#666';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(curRoom.w.toFixed(1) + 'م', W / 2, pad + ph + 8);

  /* components */
  curRoom.ceilingComponents.forEach(function(c){
    var x = pad + c.rx * pw;
    var y = pad + c.rz * ph;
    var isSel = (ceilSel === c);
    if(isSel){
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fillStyle = c.color;
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.icon, x, y + 1);
  });

  ctx.fillStyle = '#00d9ff';
  ctx.font = 'bold 13px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(curRoom.ceilingComponents.length + ' مكون', pad, 8);
}

function hitCeil(px, py){
  if(!curRoom) return null;
  var r = ceilCanvas.getBoundingClientRect();
  var pad = CEIL_PAD;
  var pw = r.width - pad * 2;
  var ph = r.height - pad * 2 - 80;
  for(var i = curRoom.ceilingComponents.length - 1; i >= 0; i--){
    var c = curRoom.ceilingComponents[i];
    var x = pad + c.rx * pw;
    var y = pad + c.rz * ph;
    if(Math.hypot(px - x, py - y) < 22) return c;
  }
  return null;
}

function bindCeilEvents(){
  var cv = ceilCanvas;
  if(!cv || cv._bound) return;
  cv._bound = true;

  cv.addEventListener('pointerdown', function(e){
    var r = cv.getBoundingClientRect();
    var px = e.clientX - r.left, py = e.clientY - r.top;
    var hit = hitCeil(px, py);
    if(hit){
      ceilSel = hit;
      ceilDrag = hit;
      ceilLongT = setTimeout(function(){
        if(ceilDrag){
          if(confirm('حذف "' + hit.name + '" ؟')){
            curRoom.ceilingComponents = curRoom.ceilingComponents.filter(function(x){ return x !== hit; });
            ceilSel = null;
            renderCeil();
            toast('🗑 تم الحذف');
          }
          ceilDrag = null;
          ceilLongT = null;
        }
      }, 700);
      renderCeil();
    }
  });

  cv.addEventListener('pointermove', function(e){
    if(!ceilDrag) return;
    if(ceilLongT){ clearTimeout(ceilLongT); ceilLongT = null; }
    var r = cv.getBoundingClientRect();
    var pad = CEIL_PAD;
    var pw = r.width - pad * 2;
    var ph = r.height - pad * 2 - 80;
    var px = clamp(e.clientX - r.left, pad, r.width - pad);
    var py = clamp(e.clientY - r.top, pad, pad + ph);
    ceilDrag.rx = (px - pad) / pw;
    ceilDrag.rz = (py - pad) / ph;
    renderCeil();
  });

  cv.addEventListener('pointerup', function(){
    if(ceilLongT){ clearTimeout(ceilLongT); ceilLongT = null; }
    ceilDrag = null;
  });

  cv.addEventListener('pointercancel', function(){
    if(ceilLongT){ clearTimeout(ceilLongT); ceilLongT = null; }
    ceilDrag = null;
  });
}
