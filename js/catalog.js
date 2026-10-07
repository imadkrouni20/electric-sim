/* ==================== Catalogs ==================== */

var WALL_CATALOG = [
  {id:'socket',     name:'مقبس',          icon:'🔌', color:'#f59e0b', w:0.086, h:0.086, circuit:'sockets',   power:100},
  {id:'socket2',    name:'مقبس مزدوج',    icon:'🔌', color:'#f97316', w:0.16,  h:0.086, circuit:'sockets',   power:150},
  {id:'socket_wp',  name:'مقبس ضد الماء',  icon:'💧', color:'#3b82f6', w:0.10,  h:0.10,  circuit:'bathroom',  power:100},
  {id:'switch',     name:'مفتاح',         icon:'🔘', color:'#ef4444', w:0.086, h:0.086, circuit:'lighting'},
  {id:'switch2',    name:'مفتاح مزدوج',   icon:'🔘', color:'#dc2626', w:0.16,  h:0.086, circuit:'lighting'},
  {id:'vav',        name:'فا وفين',       icon:'🔄', color:'#fb923c', w:0.16,  h:0.086, circuit:'lighting'},
  {id:'panel',      name:'لوحة توزيع',    icon:'📦', color:'#3b82f6', w:0.5,   h:0.6},
  {id:'breaker',    name:'قاطع',          icon:'⚡', color:'#a855f7', w:0.036, h:0.09},
  {id:'junction',   name:'علبة تفريع',    icon:'⬛', color:'#6b7280', w:0.09,  h:0.09},
  {id:'sconce',     name:'مصباح جداري',   icon:'💡', color:'#fbbf24', w:0.15,  h:0.25,  circuit:'lighting', power:40},
  {id:'tv',         name:'مأخذ تلفاز',    icon:'📺', color:'#10b981', w:0.086, h:0.086, circuit:'sockets',  power:50},
  {id:'net',        name:'مأخذ شبكة',     icon:'🌐', color:'#3b82f6', w:0.086, h:0.086},
  {id:'phone',      name:'مأخذ هاتف',     icon:'📞', color:'#10b981', w:0.086, h:0.086},
  {id:'thermo',     name:'ثرموستات',      icon:'🌡', color:'#ef4444', w:0.086, h:0.086},
  {id:'doorbell',   name:'جرس',           icon:'🔔', color:'#ef4444', w:0.08,  h:0.08,  circuit:'lighting', power:20},
  {id:'emergency',  name:'إنارة طوارئ',   icon:'🚨', color:'#22c55e', w:0.12,  h:0.12,  circuit:'emergency',power:60},
  {id:'oven',       name:'فرن',           icon:'🔥', color:'#dc2626', w:0.12,  h:0.12,  circuit:'kitchen',  power:3000},
  {id:'ac',         name:'مكيف',          icon:'❄',  color:'#38bdf8', w:0.15,  h:0.15,  circuit:'hvac',     power:2000},
  {id:'water_heater',name:'سخان ماء',     icon:'♨',  color:'#f97316', w:0.12,  h:0.12,  circuit:'bathroom', power:2500}
];

var CEIL_CATALOG = [
  {id:'lamp',      name:'مصباح سقفي',   icon:'💡', color:'#fbbf24', circuit:'lighting', power:60},
  {id:'chand',     name:'ثريا',         icon:'✨', color:'#f59e0b', circuit:'lighting', power:200},
  {id:'spot',      name:'سبوت',         icon:'🔆', color:'#f97316', circuit:'lighting', power:30},
  {id:'panel_led', name:'إضاءة مخفية',  icon:'〰',  color:'#a855f7', circuit:'lighting', power:80},
  {id:'fan',       name:'مروحة',        icon:'🌀', color:'#38bdf8', circuit:'lighting', power:80},
  {id:'smoke',     name:'كاشف دخان',    icon:'🚨', color:'#ef4444'},
  {id:'heat',      name:'كاشف حرارة',   icon:'🌡', color:'#dc2626'},
  {id:'ac_ceil',   name:'مكيف سقفي',    icon:'❄',  color:'#38bdf8', circuit:'hvac',     power:2000},
  {id:'speaker',   name:'مكبر صوت',     icon:'🔊', color:'#334155'}
];

var ROOM_TYPES = [
  {id:'bedroom',  name:'غرفة نوم',   color:'#dbeafe', icon:'🛏'},
  {id:'living',   name:'صالة',       color:'#fed7aa', icon:'🛋'},
  {id:'kitchen',  name:'مطبخ',       color:'#fef3c7', icon:'🍳'},
  {id:'bathroom', name:'حمام',       color:'#bfdbfe', icon:'🚿'},
  {id:'hallway',  name:'مدخل',       color:'#fef9c3', icon:'🚪'},
  {id:'office',   name:'مكتب',       color:'#e9d5ff', icon:'💼'},
  {id:'storage',  name:'مخزن',       color:'#e5e7eb', icon:'📦'},
  {id:'stairs',   name:'درج',        color:'#f3f4f6', icon:'🪜'},
  {id:'balcony',  name:'شرفة',       color:'#bbf7d0', icon:'🌿'},
  {id:'garage',   name:'مرآب',       color:'#d1d5db', icon:'🚗'},
  {id:'dining',   name:'غرفة طعام',  color:'#fbcfe8', icon:'🍽'},
  {id:'kids',     name:'غرفة أطفال', color:'#fef3c7', icon:'🧸'}
];

var FURNITURE = {
  bedroom: [
    {type:'bed',      name:'سرير',        w:1.6, h:2.0, icon:'🛏'},
    {type:'wardrobe', name:'خزانة',       w:0.6, h:1.8, icon:'🚪'},
    {type:'nightstand',name:'طاولة سرير', w:0.5, h:0.5, icon:'🪑'}
  ],
  living: [
    {type:'sofa',   name:'كنبة',    w:2.0, h:0.9, icon:'🛋'},
    {type:'table',  name:'طاولة',   w:1.2, h:0.8, icon:'🪑'},
    {type:'tv_unit',name:'خزانة TV',w:1.6, h:0.5, icon:'📺'}
  ],
  kitchen: [
    {type:'counter',name:'طاولة مطبخ', w:2.4, h:0.6, icon:'🍽'},
    {type:'fridge', name:'ثلاجة',      w:0.7, h:0.7, icon:'🧊'},
    {type:'stove',  name:'موقد',       w:0.6, h:0.6, icon:'🔥'},
    {type:'sink',   name:'حوض',        w:0.8, h:0.6, icon:'🚰'}
  ],
  bathroom: [
    {type:'toilet', name:'مرحاض',  w:0.4, h:0.7, icon:'🚽'},
    {type:'shower', name:'دش',     w:0.9, h:0.9, icon:'🚿'},
    {type:'basin',  name:'مغسلة',  w:0.6, h:0.5, icon:'🧼'},
    {type:'bathtub',name:'حوض',    w:1.7, h:0.75,icon:'🛁'}
  ],
  office: [
    {type:'desk',     name:'مكتب',    w:1.4, h:0.7, icon:'🪑'},
    {type:'bookshelf',name:'رف كتب',  w:1.0, h:0.3, icon:'📚'}
  ],
  dining: [
    {type:'dining_table',name:'طاولة طعام', w:1.8, h:1.0, icon:'🍽'},
    {type:'chair',       name:'كرسي',      w:0.5, h:0.5, icon:'🪑'}
  ],
  kids: [
    {type:'bed',name:'سرير صغير',  w:1.0, h:1.9, icon:'🛏'},
    {type:'toy',name:'صندوق ألعاب',w:0.8, h:0.5, icon:'🧸'}
  ],
  garage: [
    {type:'car',name:'سيارة', w:4.5, h:2.0, icon:'🚗'}
  ],
  balcony: [
    {type:'plant',name:'نبات',w:0.5, h:0.5, icon:'🌿'}
  ]
};

function findCatalogItem(id){
  for(var i = 0; i < WALL_CATALOG.length; i++) if(WALL_CATALOG[i].id === id) return WALL_CATALOG[i];
  for(var j = 0; j < CEIL_CATALOG.length; j++) if(CEIL_CATALOG[j].id === id) return CEIL_CATALOG[j];
  return null;
}
