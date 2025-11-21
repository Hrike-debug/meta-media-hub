/* ----------------------------------------------------
   Meta Media Hub — Image Tools Only (Video Removed)
   ---------------------------------------------------- */

/* ------------------------------
   Utilities
   ------------------------------ */
const $ = id => document.getElementById(id);

const createDownload = (blob, name) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
};

const revokeIfBlobUrl = (el) => {
  if (!el) return;
  try {
    if (el.src && el.src.startsWith("blob:")) URL.revokeObjectURL(el.src);
  } catch {}
};

/* ------------------------------
   Theme toggle
   ------------------------------ */
const themeToggle = $("themeToggle");
const THEME_KEY = "mm_theme_v1";

function applyTheme(theme) {
  if (theme === "light") document.documentElement.classList.add("theme-light");
  else document.documentElement.classList.remove("theme-light");
  themeToggle.textContent = theme === "light" ? "☀️" : "🌙";
  localStorage.setItem(THEME_KEY, theme);
}
themeToggle.addEventListener("click", () => {
  const cur = localStorage.getItem(THEME_KEY) || "dark";
  applyTheme(cur === "dark" ? "light" : "dark");
});
applyTheme(localStorage.getItem(THEME_KEY) || "dark");

/* ------------------------------
   Auth
   ------------------------------ */
const pwModal = $("pwModal"),
      pwInput = $("pwInput"),
      pwBtn = $("pwBtn"),
      pwMsg = $("pwMsg"),
      statusText = $("statusText");

const AUTH_KEY = "mm_auth_v1";
const PASSWORD = "Meta@123";

function saveAuth(v){ v ? localStorage.setItem(AUTH_KEY,"true") : localStorage.removeItem(AUTH_KEY); }
function isAuthed(){ return localStorage.getItem(AUTH_KEY)==="true"; }

async function unlock(){
  if(pwInput.value === PASSWORD){
    saveAuth(true);
    pwMsg.textContent = "";
    pwModal.style.display = "none";
    showSection("home");
    statusText.textContent = "Unlocked";
  } else {
    pwMsg.textContent = "Incorrect password";
  }
}
pwBtn.addEventListener("click", unlock);
pwInput.addEventListener("keydown", e => { if(e.key==="Enter") unlock(); });

if(isAuthed()){
  pwModal.style.display = "none";
  showSection("home");
}

/* ------------------------------
   UI Navigation (Video Removed)
   ------------------------------ */
function showSection(name){
  $("home").style.display = name==="home" ? "flex" : "none";
  $("imageSection").style.display = name==="image" ? "block" : "none";
  statusText.textContent =
    name==="home" ? "Choose workflow" :
    name==="image" ? "Image tools" : "";
}

$("btnImage").addEventListener("click", ()=> showSection("image"));
$("backHomeFromImage").addEventListener("click", ()=> showSection("home"));

/* ------------------------------
   Image Tool Variables
   ------------------------------ */
let imageFiles = [];
let imageDetectionMap = {};
let imageFocusMap = {};
let cocoModel = null;

const dropImage = $("dropImage");
const imageInput = $("imageInput");
const imageFileList = $("imageFileList");

const imgWidth = $("imgWidth");
const imgHeight = $("imgHeight");
const imgQuality = $("imgQuality");
const imgQualityVal = $("imgQualityVal");

const aiSwitch = $("imgAiToggle");
const imgPreviewBtn = $("imgPreviewBtn");
const imgProcessBtn = $("imgProcessBtn");
const imgStatus = $("imgStatus");
const imgProgress = $("imgProgress");

const smartBanner = $("smartBanner");
const bannerIcon = $("bannerIcon");
const bannerText = $("bannerText");

/* ------------------------------
   Image Upload
   ------------------------------ */
dropImage.addEventListener("click", () => imageInput.click());
imageInput.addEventListener("change", async e => {
  imageFiles = Array.from(e.target.files);
  await handleNewImages();
});

dropImage.addEventListener("dragover", e => { e.preventDefault(); dropImage.style.background='rgba(255,255,255,0.05)'; });
dropImage.addEventListener("dragleave", () => dropImage.style.background='');
dropImage.addEventListener("drop", async e => {
  e.preventDefault();
  dropImage.style.background='';
  imageFiles = Array.from(e.dataTransfer.files);
  await handleNewImages();
});

/* ------------------------------
   File List UI
   ------------------------------ */
function refreshImageList(){
  if(!imageFiles.length){
    imageFileList.innerHTML = "No files uploaded.";
    smartBanner.style.display = "none";
    return;
  }
  imageFileList.innerHTML = imageFiles.map((f,i)=>{
    const st = imageDetectionMap[f.name] || "unknown";
    const icon = st==="person" ? "👤" : st==="none" ? "❌" : "⏳";
    const label = st==="person" ? "Human Found" : st==="none" ? "No Person" : "Scanning…";
    return `
      <div style="display:flex;gap:8px;align-items:center">
        <span class="file-icon">${icon}</span>
        <div>
          <strong>${i+1}.</strong> ${f.name}
          <div class="small" style="color:var(--muted)">${label} • ${Math.round(f.size/1024)} KB</div>
        </div>
      </div>`;
  }).join("");
}

/* ------------------------------
   Smart Detection Model
   ------------------------------ */
async function loadModel(){
  if(cocoModel) return cocoModel;
  imgStatus.textContent = "Downloading detection model…";
  cocoModel = await cocoSsd.load();
  imgStatus.textContent = "Model ready";
  return cocoModel;
}

async function detectPerson(imgEl){
  try{
    await loadModel();
    const preds = await cocoModel.detect(imgEl);
    return preds.some(p => p.class==="person");
  } catch { return false; }
}

async function detectPersonBox(imgEl){
  try{
    await loadModel();
    const preds = await cocoModel.detect(imgEl);
    const persons = preds.filter(p => p.class === "person");
    if(!persons.length) return null;
    let best = persons[0], area = best.bbox[2]*best.bbox[3];
    for(const p of persons){
      const a = p.bbox[2]*p.bbox[3];
      if(a > area){ best = p; area = a; }
    }
    const [x,y,w,h] = best.bbox;
    return { x, y, width:w, height:h };
  } catch { return null; }
}

/* ------------------------------
   Handle New Images
   ------------------------------ */
async function handleNewImages(){
  imageDetectionMap = {};
  imageFiles.forEach(f=> imageDetectionMap[f.name]="unknown");

  refreshImageList();
  imgStatus.textContent = "Scanning images...";
  smartBanner.style.display="flex";
  bannerIcon.textContent = "⏳";
  bannerText.textContent = "Scanning uploaded images...";

  let found = 0;

  for(const file of imageFiles){
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;

    await new Promise(r => { img.onload=r; img.onerror=r; });

    const has = await detectPerson(img);
    URL.revokeObjectURL(url);

    imageDetectionMap[file.name] = has ? "person" : "none";
    if(has) found++;
    refreshImageList();
  }

  if(found){
    bannerIcon.textContent="🟢";
    bannerText.innerHTML = `<strong>Smart Human Detection:</strong><br>People detected in ${found} of ${imageFiles.length} image(s).`;
    aiSwitch.classList.add("active");
  } else {
    bannerIcon.textContent="⚪";
    bannerText.innerHTML=`<strong>Smart Human Detection:</strong><br>No people found.`;
    aiSwitch.classList.remove("active");
  }

  updateSwitchLabel();
  imgStatus.textContent="Scan complete";
}

/* ------------------------------
   Smart Switch
   ------------------------------ */
function updateSwitchLabel(){
  const on = aiSwitch.classList.contains("active");
  aiSwitch.querySelector(".label-on").style.display = on ? "inline" : "none";
  aiSwitch.querySelector(".label-off").style.display = on ? "none" : "inline";
}
aiSwitch.addEventListener("click", ()=>{ aiSwitch.classList.toggle("active"); updateSwitchLabel(); });

/* ------------------------------
   Crop Math
   ------------------------------ */
function computeCrop(imgW,imgH,tw,th, personBox, manual){
  const scale = Math.max(tw/imgW, th/imgH);
  const sW = Math.round(tw/scale);
  const sH = Math.round(th/scale);
  let cx = imgW/2, cy = imgH/2;

  if(manual){ cx = manual.xRel*imgW; cy = manual.yRel*imgH; }
  else if(personBox){ cx = personBox.x + personBox.width/2; cy = personBox.y+personBox.height/2; }

  let sx = Math.round(cx - sW/2);
  let sy = Math.round(cy - sH/2);

  if(sx<0) sx=0;
  if(sy<0) sy=0;
  if(sx+sW>imgW) sx = imgW-sW;
  if(sy+sH>imgH) sy = imgH-sH;

  return { sx, sy, sW, sH };
}

function cropToBlob(imgEl, tw, th, crop, quality){
  const c = document.createElement("canvas");
  c.width = tw; c.height = th;
  c.getContext("2d").drawImage(imgEl, crop.sx,crop.sy,crop.sW,crop.sH, 0,0,tw,th);
  return new Promise(res=> c.toBlob(b=>res(b),"image/jpeg",quality/100));
}

/* ------------------------------
   Process ZIP
   ------------------------------ */
imgProcessBtn.addEventListener("click", async()=>{
  if(!imageFiles.length) return alert("Upload images first");

  const tw = +imgWidth.value;
  const th = +imgHeight.value;
  const q = +imgQuality.value || 90;
  if(!tw || !th) return alert("Enter width & height");

  imgStatus.textContent="Starting...";
  imgProgress.style.width="0%";

  const zip = new JSZip();
  let i=0;

  for(const file of imageFiles){
    i++;
    imgStatus.textContent=`Processing ${i}/${imageFiles.length}: ${file.name}`;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;

    await new Promise(r => { img.onload=r; img.onerror=r; });

    const manual = imageFocusMap[file.name] || null;
    const person = aiSwitch.classList.contains("active") && !manual
        ? await detectPersonBox(img)
        : null;

    const crop = computeCrop(img.naturalWidth,img.naturalHeight, tw,th, person,manual);
    const blob = await cropToBlob(img, tw,th, crop, q);

    zip.file("resized_"+file.name.replace(/\.[^.]+$/, "")+".jpg", blob);
    URL.revokeObjectURL(url);
    imgProgress.style.width = (i/imageFiles.length*100)+"%";
  }

  imgStatus.textContent="Preparing ZIP...";
  const blob = await zip.generateAsync({type:"blob"});
  createDownload(blob,"resized_images.zip");
  imgStatus.textContent="Done!";
});

/* ------------------------------
   Preview Modal
   ------------------------------ */
const previewModal = $("previewModal"),
      beforeImg = $("beforeImg"),
      afterImg = $("afterImg"),
      afterLayer = $("afterLayer"),
      handle = $("handle"),
      previewTitle = $("previewTitle"),
      previewInfo = $("previewInfo");

$("imgPreviewBtn").addEventListener("click", async()=>{
  if(!imageFiles.length) return alert("Upload images first");

  const file = imageFiles[0];
  const tw = +imgWidth.value || 800;
  const th = +imgHeight.value || 600;
  const q = +imgQuality.value || 90;

  revokeIfBlobUrl(beforeImg);
  revokeIfBlobUrl(afterImg);

  const img = new Image();
  const url = URL.createObjectURL(file);
  img.src = url;

  await new Promise(r=>{ img.onload=r; img.onerror=r; });

  const manual = imageFocusMap[file.name] || null;
  const person = aiSwitch.classList.contains("active") && !manual
      ? await detectPersonBox(img)
      : null;

  const crop = computeCrop(img.naturalWidth,img.naturalHeight, tw,th, person,manual);
  const blob = await cropToBlob(img,tw,th,crop,q);

  beforeImg.src = url;
  afterImg.src = URL.createObjectURL(blob);

  previewTitle.textContent = file.name;
  previewInfo.textContent = `${tw}×${th} • ${q}%`;

  previewModal.style.display="flex";
  afterLayer.style.width="50%";
  handle.style.left="50%";
});

$("closePreview").addEventListener("click", ()=>{
  previewModal.style.display="none";
  revokeIfBlobUrl(beforeImg);
  revokeIfBlobUrl(afterImg);
});

/* Preview drag slider */
(function(){
  const wrap = $("previewArea");
  let drag=false;

  handle.addEventListener("mousedown", ()=>{ drag=true; document.body.style.cursor="ew-resize"; });
  document.addEventListener("mouseup", ()=>{ drag=false; document.body.style.cursor=""; });
  document.addEventListener("mousemove", e=>{
    if(!drag) return;
    const r = wrap.getBoundingClientRect();
    const pct = ((e.clientX - r.left) / r.width)*100;
    afterLayer.style.width = Math.max(0,Math.min(100,pct))+"%";
    handle.style.left = afterLayer.style.width;
  });
})();

/* ------------------------------
   Manual Focus Modal
   ------------------------------ */
const focusModal = $("focusModal"),
      focusPreview = $("focusPreview"),
      focusRect = $("focusRect"),
      focusCanvas = $("focusCanvas"),
      focusSelect = $("focusSelect"),
      saveFocusBtn = $("saveFocus"),
      clearFocusBtn = $("clearFocus"),
      closeFocusBtn = $("closeFocus");

let dragState = { dragging:false, resizing:false, startX:0,startY:0,startW:0,startH:0,startLeft:0,startTop:0 };
let rectVisible = false;

$("focusBtn").addEventListener("click", ()=>{
  if(!imageFiles.length) return alert("Upload images first");
  openFocusModal();
});

function openFocusModal(){
  focusModal.style.display="flex";
  populateFocusSelect();
  focusRect.style.display="none";
  rectVisible=false;
}

function populateFocusSelect(){
  focusSelect.innerHTML="";
  imageFiles.forEach((f,i)=>{
    const opt=document.createElement("option");
    opt.value=f.name;
    opt.textContent=(i+1)+". "+f.name;
    focusSelect.appendChild(opt);
  });
  if(imageFiles.length) loadFocusImage();
}

function loadFocusImage(){
  const name=focusSelect.value;
  const file=imageFiles.find(f=>f.name===name);
  if(!file) return;

  revokeIfBlobUrl(focusPreview);
  const url = URL.createObjectURL(file);
  focusPreview.src = url;

  focusPreview.onload = ()=>{
    const imgR = focusPreview.getBoundingClientRect();
    requestAnimationFrame(()=>{
      const saved=imageFocusMap[name];
      const w=Math.max(80,imgR.width*0.25);
      const h=Math.max(80,imgR.height*0.25);

      const cx = saved ? imgR.left + saved.xRel*imgR.width : imgR.left + imgR.width/2;
      const cy = saved ? imgR.top + saved.yRel*imgR.height: imgR.top + imgR.height/2;

      setRectFromCenter(cx,cy,w,h);
      focusRect.style.display="block";
      rectVisible=true;
    });
  };
}

function setRectFromCenter(cx,cy,w,h){
  const c = focusCanvas.getBoundingClientRect();
  let left=cx-w/2, top=cy-h/2;

  if(left<c.left) left=c.left;
  if(top<c.top) top=c.top;
  if(left+w>c.right) left=c.right-w;
  if(top+h>c.bottom) top=c.bottom-h;

  focusRect.style.left = (left-c.left)+"px";
  focusRect.style.top  = (top-c.top)+"px";
  focusRect.style.width=w+"px";
  focusRect.style.height=h+"px";
}

focusSelect.addEventListener("change", loadFocusImage);

/* Drag + Resize */
focusRect.addEventListener("mousedown", e=>{
  if(e.target.classList.contains("focus-handle")) return;

  dragState.dragging=true;
  dragState.startX=e.clientX; dragState.startY=e.clientY;

  const r = focusRect.getBoundingClientRect();
  const c = focusCanvas.getBoundingClientRect();

  dragState.startLeft=r.left-c.left;
  dragState.startTop=r.top-c.top;
  dragState.startW=r.width;
  dragState.startH=r.height;
  e.preventDefault();
});

focusRect.querySelector(".focus-handle").addEventListener("mousedown", e=>{
  dragState.resizing=true;
  dragState.startX=e.clientX;
  dragState.startY=e.clientY;
  const r=focusRect.getBoundingClientRect();
  dragState.startW=r.width;
  dragState.startH=r.height;
  e.preventDefault();
});

document.addEventListener("mousemove", e=>{
  if(!rectVisible) return;
  const c = focusCanvas.getBoundingClientRect();

  if(dragState.dragging){
    const dx=e.clientX-dragState.startX;
    const dy=e.clientY-dragState.startY;
    let L=dragState.startLeft+dx;
    let T=dragState.startTop+dy;

    L=Math.max(0,Math.min(c.width-dragState.startW, L));
    T=Math.max(0,Math.min(c.height-dragState.startH, T));

    focusRect.style.left=L+"px";
    focusRect.style.top=T+"px";
  }

  if(dragState.resizing){
    const dx=e.clientX-dragState.startX;
    const dy=e.clientY-dragState.startY;
    let W=Math.max(40,dragState.startW+dx);
    let H=Math.max(40,dragState.startH+dy);

    W=Math.min(W,c.width);
    H=Math.min(H,c.height);

    focusRect.style.width=W+"px";
    focusRect.style.height=H+"px";
  }
});

document.addEventListener("mouseup", ()=>{
  dragState.dragging=false;
  dragState.resizing=false;
});

/* Save/cancel focus */
saveFocusBtn.addEventListener("click", ()=>{
  const name=focusSelect.value;
  if(!name) return alert("Select an image first");

  const r=focusRect.getBoundingClientRect();
  const img=focusPreview.getBoundingClientRect();

  const cx=r.left+r.width/2;
  const cy=r.top+r.height/2;

  imageFocusMap[name] = {
    xRel:(cx-img.left)/img.width,
    yRel:(cy-img.top)/img.height
  };
  alert("Focus saved.");
});

clearFocusBtn.addEventListener("click", ()=>{
  const name=focusSelect.value;
  delete imageFocusMap[name];
  loadFocusImage();
});

closeFocusBtn.addEventListener("click", ()=>{
  focusModal.style.display="none";
  revokeIfBlobUrl(focusPreview);
});

/* Double-click focus reposition */
focusCanvas.addEventListener("dblclick", e=>{
  const imgR=focusPreview.getBoundingClientRect();
  let x=e.clientX, y=e.clientY;

  if(x<imgR.left) x=imgR.left;
  if(x>imgR.right) x=imgR.right;
  if(y<imgR.top) y=imgR.top;
  if(y>imgR.bottom) y=imgR.bottom;

  const r=focusRect.getBoundingClientRect();
  setRectFromCenter(x,y,r.width,r.height);
});

/* Quality slider UI */
imgQuality.addEventListener("input", ()=> imgQualityVal.textContent=imgQuality.value+"%");

/* Init */
updateSwitchLabel();
showSection("home");
