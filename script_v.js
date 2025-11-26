/* ---------------------------------------------------------
   Meta Media Hub — Option B (Draggable Split Slider + Annotator)
   Clean, Production-Ready Version
--------------------------------------------------------- */

const $ = id => document.getElementById(id);
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

/* ---------------------------------------------------------
   AUTH
--------------------------------------------------------- */
const PASSWORD = "Meta@123";
const AUTH_KEY = "mm_auth";

const pwModal = $("pwModal");
const pwInput = $("pwInput");
const pwBtn = $("pwBtn");
const pwMsg = $("pwMsg");
const statusText = $("statusText");

function isAuthed() { return localStorage.getItem(AUTH_KEY) === "true"; }
function saveAuth() { localStorage.setItem(AUTH_KEY,"true"); }

function unlock() {
  if (pwInput.value === PASSWORD) {
    saveAuth();
    pwModal.style.display = "none";
    statusText.textContent = "Unlocked";
    showSection("home");
  } else {
    pwMsg.textContent = "Incorrect password";
  }
}

on(pwBtn, "click", unlock);
on(pwInput, "keydown", e => { if(e.key === "Enter") unlock(); });

/* fixed password init */
if (isAuthed()) {
    pwModal.style.display = "none";
    statusText.textContent = "Unlocked";
    showSection("home");
} else {
    pwModal.style.display = "flex";  
    statusText.textContent = "Locked";
}


/* ---------------------------------------------------------
   NAVIGATION
--------------------------------------------------------- */
function showSection(sec) {
  $("home").style.display = sec === "home" ? "flex" : "none";
  $("enhancerSection").style.display = sec === "enhance" ? "block" : "none";
}

on($("btnImage"), "click", ()=> alert("Image Tools is disabled in this version."));
on($("btnEnhancer"), "click", ()=> showSection("enhance"));
on($("backHomeFromEnhancer"), "click", ()=> showSection("home"));

on($("aboutBtn"), "click", ()=> $("aboutModal").style.display = "flex");
on($("closeAbout"), "click", ()=> $("aboutModal").style.display = "none");

/* ---------------------------------------------------------
   TOOLTIP SYSTEM
--------------------------------------------------------- */
const tooltip = document.createElement("div");
tooltip.className = "tooltip-box";
tooltip.style.display = "none";
document.body.appendChild(tooltip);

function attachTips() {
  document.querySelectorAll("[data-tip]").forEach(el=>{
    el.addEventListener("mouseenter", ()=>{
      tooltip.textContent = el.dataset.tip;
      tooltip.style.display = "block";
      const r = el.getBoundingClientRect();
      tooltip.style.top = r.bottom + 8 + "px";
      tooltip.style.left = r.left + "px";
    });
    el.addEventListener("mouseleave", ()=> tooltip.style.display = "none");
  });
}

attachTips();

/* ---------------------------------------------------------
   IMAGE LOADING
--------------------------------------------------------- */
const enhanceCanvas = document.createElement("canvas");
const enhanceCtx = enhanceCanvas.getContext("2d");

const dropEnhance = $("dropEnhance");
const enhanceInput = $("enhanceInput");
const enhFileInfo = $("enhFileInfo");

const beforeImg = $("beforeImg");
const afterImg = $("afterImg");

let currentImageFile = null;

async function loadEnhImage(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();

  enhanceCanvas.width = img.naturalWidth;
  enhanceCanvas.height = img.naturalHeight;
  enhanceCtx.drawImage(img,0,0);

  beforeImg.src = url;
  afterImg.src = url;

  currentImageFile = file;
  enhFileInfo.textContent = `${file.name} — ${img.naturalWidth}×${img.naturalHeight}px`;

  resetActions();
  refreshSplit();
}

dropEnhance.onclick = ()=> enhanceInput.click();
enhanceInput.onchange = e => {
  const f = e.target.files[0];
  if (f) loadEnhImage(f);
};

dropEnhance.addEventListener("dragover", e=>{ e.preventDefault(); });
dropEnhance.addEventListener("drop", e=>{
  e.preventDefault();
  const f = e.dataTransfer.files[0];
  if (f) loadEnhImage(f);
});

/* ---------------------------------------------------------
   SPLIT SLIDER
--------------------------------------------------------- */
const splitAfter = $("splitAfter");
const splitHandle = $("splitHandle");
const splitContainer = $("splitContainer");

let splitPos = 0.5;

function refreshSplit() {
  const W = splitContainer.offsetWidth;
  const handleX = splitPos * W;

  splitAfter.style.width = handleX + "px";
  splitHandle.style.left = (handleX - splitHandle.offsetWidth/2) + "px";
}

refreshSplit();

let sliding = false;

splitHandle.addEventListener("mousedown", ()=> sliding = true);
document.addEventListener("mouseup", ()=> sliding = false);
document.addEventListener("mousemove", e=>{
  if (!sliding) return;
  const r = splitContainer.getBoundingClientRect();
  splitPos = (e.clientX - r.left) / r.width;
  splitPos = Math.max(0.05, Math.min(0.95, splitPos));
  refreshSplit();
});

/* ---------------------------------------------------------
   ANNOTATOR (INLINE + MODAL)
--------------------------------------------------------- */
let actions = [];
let activeTool = null;
let inlineCtx = $("annoCanvas").getContext("2d");

function resetActions() {
  actions = [];
  redrawInline();
}

/* TOOL BUTTONS */
document.querySelectorAll(".annot-btn").forEach(btn=>{
  btn.onclick = ()=>{
    document.querySelectorAll(".annot-btn").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    activeTool = btn.dataset.tool;
  };
});

/* INLINE DRAW */
let drawing = false;
let sx=0, sy=0;

$("annoCanvas").addEventListener("mousedown", e=>{
  if (!activeTool) return;
  drawing = true;
  const r = e.target.getBoundingClientRect();
  sx = e.clientX - r.left;
  sy = e.clientY - r.top;

  if (activeTool === "text") {
    const txt = prompt("Enter text:");
    if (txt) {
      actions.push({tool:"text", x:sx, y:sy, text:txt});
      redrawInline();
    }
    drawing = false;
  } else if (activeTool === "free") {
    actions.push({tool:"free", pts:[{x:sx,y:sy}]});
  } else {
    actions.push({tool:activeTool, x:sx, y:sy, x2:sx, y2:sy});
  }
});

$("annoCanvas").addEventListener("mousemove", e=>{
  if (!drawing) return;
  const r = e.target.getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;

  const a = actions[actions.length-1];

  if (a.tool === "free") {
    a.pts.push({x,y});
  } else {
    a.x2 = x;
    a.y2 = y;
  }

  redrawInline();
});

document.addEventListener("mouseup", ()=> drawing=false);

/* DRAW INLINE */
function redrawInline() {
  const c = $("annoCanvas");
  inlineCtx.clearRect(0,0,c.width,c.height);

  actions.forEach(a=> drawAction(inlineCtx,a));
}

function drawAction(ctx, a) {
  ctx.save();
  ctx.strokeStyle = "#ff7a3c";
  ctx.fillStyle = "#ff7a3c";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (a.tool === "rect") {
    ctx.strokeRect(a.x, a.y, a.x2-a.x, a.y2-a.y);
  }
  if (a.tool === "highlight") {
    ctx.globalAlpha = 0.25;
    ctx.fillRect(a.x, a.y, a.x2-a.x, a.y2-a.y);
  }
  if (a.tool === "blur") {
    ctx.globalAlpha = 0.5;
    ctx.fillRect(a.x, a.y, a.x2-a.x, a.y2-a.y);
  }
  if (a.tool === "arrow") {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(a.x2, a.y2);
    ctx.stroke();
  }
  if (a.tool === "text") {
    ctx.font = "20px Inter";
    ctx.fillText(a.text, a.x, a.y);
  }
  if (a.tool === "free") {
    ctx.beginPath();
    ctx.moveTo(a.pts[0].x, a.pts[0].y);
    for (let i=1;i<a.pts.length;i++) ctx.lineTo(a.pts[i].x, a.pts[i].y);
    ctx.stroke();
  }

  ctx.restore();
}

/* ---------------------------------------------------------
   ANNOTATOR MODAL
--------------------------------------------------------- */
const modal = $("annotatorModal");
$("openAnnotatorBtn").onclick = ()=> openAnnotator();
$("miniAnnotateOpen").onclick = ()=> openAnnotator();
$("annotatorCancel").onclick = ()=> modal.style.display = "none";

function openAnnotator() {
  modal.style.display = "flex";
  redrawModalCanvas();
}

/* FULL MODAL DRAWING */
let modalDrawing=false, mx=0, my=0;

const modalCanvas = $("annotCanvasFull");
const modalCtx = modalCanvas.getContext("2d");

modalCanvas.addEventListener("mousedown", e=>{
  if (!activeTool) return;
  modalDrawing = true;
  const r = modalCanvas.getBoundingClientRect();
  mx = e.clientX - r.left;
  my = e.clientY - r.top;

  if (activeTool === "text") {
    const txt = prompt("Enter text:");
    if (txt) actions.push({tool:"text",x:mx,y:my,text:txt});
    modalDrawing=false;
    redrawModalCanvas();
    return;
  }

  if (activeTool === "free") {
    actions.push({tool:"free",pts:[{x:mx,y:my}]});
  } else {
    actions.push({tool:activeTool, x:mx, y:my, x2:mx, y2:my});
  }
  redrawModalCanvas();
});

modalCanvas.addEventListener("mousemove", e=>{
  if (!modalDrawing) return;

  const r = modalCanvas.getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;

  const a = actions[actions.length-1];

  if (a.tool === "free") a.pts.push({x,y});
  else { a.x2=x; a.y2=y; }

  redrawModalCanvas();
});

document.addEventListener("mouseup", ()=> modalDrawing=false);

/* REDRAW MODAL */
function redrawModalCanvas() {
  modalCtx.clearRect(0,0,modalCanvas.width,modalCanvas.height);
  actions.forEach(a=> drawAction(modalCtx,a));
}

/* ---------------------------------------------------------
   MERGE ANNOTATIONS INTO FINAL IMAGE
--------------------------------------------------------- */
$("annotatorApply").onclick = ()=>{
  modal.style.display = "none";
  redrawInline();
};

$("annApply").onclick = ()=>{
  mergeAnnotations();
  afterImg.src = enhanceCanvas.toDataURL("image/jpeg", 0.92);
  resetActions();
};

function mergeAnnotations() {
  const W = enhanceCanvas.width;
  const H = enhanceCanvas.height;

  const tmp = document.createElement("canvas");
  tmp.width = W; tmp.height = H;
  const tctx = tmp.getContext("2d");

  tctx.drawImage(enhanceCanvas,0,0);

  const disp = $("annoCanvas").getBoundingClientRect();
  const scaleX = W / disp.width;
  const scaleY = H / disp.height;

  actions.forEach(a=>{
    tctx.save();
    tctx.strokeStyle="#ff7a3c";
    tctx.fillStyle="#ff7a3c";
    tctx.lineWidth=4;

    if (a.tool==="rect") {
      tctx.strokeRect(a.x*scaleX, a.y*scaleY, (a.x2-a.x)*scaleX, (a.y2-a.y)*scaleY);
    }

    if (a.tool==="highlight") {
      tctx.globalAlpha=0.25;
      tctx.fillRect(a.x*scaleX, a.y*scaleY, (a.x2-a.x)*scaleX, (a.y2-a.y)*scaleY);
    }

    if (a.tool==="text") {
      tctx.font = 28*scaleX + "px Inter";
      tctx.fillText(a.text, a.x*scaleX, a.y*scaleY);
    }

    if (a.tool==="arrow") {
      tctx.beginPath();
      tctx.moveTo(a.x*scaleX, a.y*scaleY);
      tctx.lineTo(a.x2*scaleX, a.y2*scaleY);
      tctx.stroke();
    }

    if (a.tool==="free") {
      tctx.beginPath();
      tctx.moveTo(a.pts[0].x*scaleX, a.pts[0].y*scaleY);
      for (let i=1;i<a.pts.length;i++)
        tctx.lineTo(a.pts[i].x*scaleX, a.pts[i].y*scaleY);
      tctx.stroke();
    }

    if (a.tool==="blur") {
      const x = Math.min(a.x,a.x2)*scaleX;
      const y = Math.min(a.y,a.y2)*scaleY;
      const w = Math.abs(a.x2-a.x)*scaleX;
      const h = Math.abs(a.y2-a.y)*scaleY;

      let region = tctx.getImageData(x,y,w,h);
      for (let i=0;i<6;i++) region = gaussianBlur(region);
      tctx.putImageData(region,x,y);
    }
    tctx.restore();
  });

  enhanceCtx.drawImage(tmp,0,0);
}

/* ---------------------------------------------------------
   FILTERS
--------------------------------------------------------- */
function gaussianBlur(imgData){
  const w=imgData.width, h=imgData.height;
  const src=imgData.data;
  const out=new Uint8ClampedArray(src.length);
  const k=[0.12,0.24,0.28,0.24,0.12];
  const half=2;

  // H
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      let r=0,g=0,b=0,a=255;
      for(let i=-half;i<=half;i++){
        let xx=Math.min(w-1,Math.max(0,x+i));
        let idx=(y*w+xx)*4;
        r+=src[idx]*k[i+half];
        g+=src[idx+1]*k[i+half];
        b+=src[idx+2]*k[i+half];
      }
      let o=(y*w+x)*4;
      out[o]=r; out[o+1]=g; out[o+2]=b; out[o+3]=a;
    }
  }

  // V
  const out2=new Uint8ClampedArray(src.length);
  for(let x=0;x<w;x++){
    for(let y=0;y<h;y++){
      let r=0,g=0,b=0,a=255;
      for(let i=-half;i<=half;i++){
        let yy=Math.min(h-1,Math.max(0,y+i));
        let idx=(yy*w+x)*4;
        r+=out[idx]*k[i+half];
        g+=out[idx+1]*k[i+half];
        b+=out[idx+2]*k[i+half];
      }
      let o=(y*w+x)*4;
      out2[o]=r; out2[o+1]=g; out2[o+2]=b; out2[o+3]=a;
    }
  }

  imgData.data.set(out2);
  return imgData;
}

/* ---------------------------------------------------------
   PREVIEW BUTTON
--------------------------------------------------------- */
$("enhPreviewBtn").onclick = ()=>{
  afterImg.src = enhanceCanvas.toDataURL("image/jpeg",0.92);
  $("enhStatus").textContent = "Preview updated.";
};

/* ---------------------------------------------------------
   ENHANCE & DOWNLOAD
--------------------------------------------------------- */
$("enhRunBtn").onclick = ()=>{
  mergeAnnotations();
  const out = enhanceCanvas.toDataURL("image/jpeg",0.92);

  const a = document.createElement("a");
  a.href = out;
  a.download = currentImageFile ?
    currentImageFile.name.replace(/\.[^.]+$/, "_enh.jpg") :
    "enhanced.jpg";
  a.click();

  $("enhStatus").textContent = "Downloaded.";
};

