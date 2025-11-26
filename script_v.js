/* ==========================================================
   Meta Media Hub - script_v.js (STABLE + MANUAL FOCUS BOX)
========================================================== */

const $ = id => document.getElementById(id);

/* ====================
   AUTH + NAVIGATION (UNCHANGED)
==================== */
const pwModal = $("pwModal");
const pwInput = $("pwInput");
const pwBtn = $("pwBtn");
const pwMsg = $("pwMsg");
const statusText = $("statusText");

const AUTH_KEY = "mm_auth_v3";
const PASSWORD = "Meta@123";

function saveAuth(v){ v ? localStorage.setItem(AUTH_KEY,"true") : localStorage.removeItem(AUTH_KEY); }
function isAuthed(){ return localStorage.getItem(AUTH_KEY)==="true"; }

function showSection(name){
  ["home","imageSection","enhancerSection"].forEach(id=>{
    const el=$(id); if(el) el.style.display="none";
  });
  if(name==="home") $("home").style.display="flex";
  if(name==="resize") $("imageSection").style.display="block";
  if(name==="enhance") $("enhancerSection").style.display="block";
}

function unlock(){
  if(pwInput.value===PASSWORD){
    saveAuth(true);
    pwModal.style.display="none";
    statusText.textContent="Unlocked";
    showSection("home");
  } else pwMsg.textContent="Incorrect password";
}
pwBtn.onclick=unlock;
pwInput.onkeydown=e=>{ if(e.key==="Enter") unlock(); };
if(isAuthed()){ pwModal.style.display="none"; statusText.textContent="Unlocked"; showSection("home"); }

$("btnImage").onclick=()=>showSection("resize");
$("btnEnhancer").onclick=()=>showSection("enhance");
$("backHomeFromImage").onclick=()=>showSection("home");
$("backHomeFromEnhancer").onclick=()=>showSection("home");

/* =========================
   IMAGE RESIZER + AI SCAN (UNCHANGED)
========================= */
let imageFiles=[];
let imageDetectionMap={};
let cocoModel=null;
let hasHuman=false;

/* ✅ Manual Focus Box State */
let manualFocusEnabled=false;
let manualFocusBox=null;

const dropImage=$("dropImage");
const imageInput=$("imageInput");
const imageFileList=$("imageFileList");
const smartBanner=$("smartBanner");
const bannerIcon=$("bannerIcon");
const bannerText=$("bannerText");
const imgStatus=$("imgStatus");

const imgWidth=$("imgWidth");
const imgHeight=$("imgHeight");
const imgQuality=$("imgQuality");
const imgQualityVal=$("imgQualityVal");
const imgPreviewBtn=$("imgPreviewBtn");
const imgProcessBtn=$("imgProcessBtn");
const focusBtn=$("focusBtn");

/* ================= PREVIEW MODAL ================= */
const previewModal=$("previewModal");
const closePreview=$("closePreview");
const previewBefore=$("previewBefore");
const previewAfter=$("previewAfter");
const previewContainer=document.querySelector(".preview-container");

let focusBoxEl=document.createElement("div");
focusBoxEl.className="focus-box";
previewContainer.appendChild(focusBoxEl);

if(closePreview) closePreview.onclick=()=>previewModal.style.display="none";

dropImage.onclick=()=>imageInput.click();
imageInput.onchange=async e=>{
  imageFiles=Array.from(e.target.files).filter(f=>f.type.startsWith("image/"));
  await handleNewImages();
};

/* ---- AI MODEL ---- */
async function loadCoco(){
  if(!cocoModel){
    imgStatus.textContent="Loading AI model…";
    cocoModel=await cocoSsd.load();
  }
}

async function detectPerson(img){
  await loadCoco();
  const preds=await cocoModel.detect(img);
  return preds.some(p=>p.class==="person");
}

/* ---- HANDLE NEW IMAGES ---- */
async function handleNewImages(){
  imageDetectionMap={};
  smartBanner.style.display="block";
  bannerIcon.textContent="⏳";
  bannerText.textContent="Scanning images…";
  imgStatus.textContent="Scanning…";

  let found=0;

  for(const file of imageFiles){
    const img=new Image();
    const url=URL.createObjectURL(file);
    img.src=url;
    await img.decode();

    const human=await detectPerson(img);
    imageDetectionMap[file.name]=human?"person":"none";
    if(human) found++;

    URL.revokeObjectURL(url);
  }

  hasHuman=found>0;
  bannerIcon.textContent=hasHuman?"🟢":"⚪";
  bannerText.innerHTML=hasHuman?`Human found in ${found} image(s)`:`No humans detected`;

  /* ✅ AUTO MANUAL FOCUS DISABLE WHEN HUMAN */
  if(hasHuman){
    focusBtn.disabled=true;
    focusBtn.style.opacity=0.4;
    manualFocusBox=null;
    focusBoxEl.style.display="none";
  }else{
    focusBtn.disabled=false;
    focusBtn.style.opacity=1;
  }

  imgStatus.textContent="Scan complete.";
  refreshImageList();
}

function refreshImageList(){
  if(!imageFiles.length){
    imageFileList.textContent="No files uploaded.";
    return;
  }
  imageFileList.innerHTML=imageFiles.map((f,i)=>{
    return `<div>${i+1}. ${f.name} — ${imageDetectionMap[f.name]}</div>`;
  }).join("");
}

/* =====================
   ✅ MANUAL FOCUS DRAW
===================== */
let drawStart=null;

focusBtn.onclick=()=>{
  if(hasHuman) return alert("Manual focus disabled. Human detected.");
  manualFocusEnabled=true;
  alert("Drag on preview AFTER image to select focus area.");
};

previewContainer.addEventListener("mousedown",e=>{
  if(!manualFocusEnabled || hasHuman) return;
  drawStart={x:e.offsetX,y:e.offsetY};
  focusBoxEl.style.left=drawStart.x+"px";
  focusBoxEl.style.top=drawStart.y+"px";
  focusBoxEl.style.width="0px";
  focusBoxEl.style.height="0px";
  focusBoxEl.style.display="block";
});

previewContainer.addEventListener("mousemove",e=>{
  if(!drawStart) return;
  const w=e.offsetX-drawStart.x;
  const h=e.offsetY-drawStart.y;
  focusBoxEl.style.width=w+"px";
  focusBoxEl.style.height=h+"px";
});

document.addEventListener("mouseup",()=>{
  if(!drawStart) return;
  manualFocusBox={
    x:parseInt(focusBoxEl.style.left),
    y:parseInt(focusBoxEl.style.top),
    width:parseInt(focusBoxEl.style.width),
    height:parseInt(focusBoxEl.style.height)
  };
  drawStart=null;
  manualFocusEnabled=false;
});

/* ======================
   CENTER-COVER DRAW (SAFE BIAS)
====================== */
function drawCover(ctx,img,w,h){
  const scale=Math.max(w/img.width,h/img.height);
  const sw=img.width*scale;
  const sh=img.height*scale;
  let ox=(w-sw)/2;
  let oy=(h-sh)/2;

  if(manualFocusBox && !hasHuman){
    const fx=(manualFocusBox.x+manualFocusBox.width/2)/previewContainer.clientWidth;
    const fy=(manualFocusBox.y+manualFocusBox.height/2)/previewContainer.clientHeight;
    ox=w*(0.5-fx);
    oy=h*(0.5-fy);
  }

  ctx.drawImage(img,ox,oy,sw,sh);
}

/* ======================
   PREVIEW (UNCHANGED)
====================== */
imgPreviewBtn.onclick=async ()=>{
  if(!imageFiles.length) return alert("Upload images first.");
  const file=imageFiles[0];
  const img=new Image();
  const url=URL.createObjectURL(file);
  img.src=url;
  await img.decode();

  const w=parseInt(imgWidth.value)||img.width;
  const h=parseInt(imgHeight.value)||img.height;

  const canvas=document.createElement("canvas");
  canvas.width=w;
  canvas.height=h;
  const ctx=canvas.getContext("2d");

  drawCover(ctx,img,w,h);

  previewBefore.src=url;
  previewAfter.src=canvas.toDataURL("image/jpeg",0.9);
  previewModal.style.display="flex";
};

/* ======================
   PROCESS & DOWNLOAD ZIP (UNCHANGED)
====================== */
imgProcessBtn.onclick=async ()=>{
  if(!imageFiles.length) return alert("Upload images first.");

  const q=(parseInt(imgQuality.value)||90)/100;
  const zip=new JSZip();

  for(const file of imageFiles){
    const img=new Image();
    const url=URL.createObjectURL(file);
    img.src=url;
    await img.decode();

    const w=parseInt(imgWidth.value)||img.width;
    const h=parseInt(imgHeight.value)||img.height;

    const canvas=document.createElement("canvas");
    canvas.width=w;
    canvas.height=h;
    const ctx=canvas.getContext("2d");

    drawCover(ctx,img,w,h);

    const blob=await (await fetch(canvas.toDataURL("image/jpeg",q))).blob();
    zip.file(file.name.replace(/\.[^/.]+$/,"")+"_resized.jpg",blob);

    URL.revokeObjectURL(url);
  }

  const zipBlob=await zip.generateAsync({type:"blob"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(zipBlob);
  a.download="resized_images.zip";
  a.click();

  imgStatus.textContent="Done. ZIP downloaded.";
};

imgQuality.oninput=()=>imgQualityVal.textContent=imgQuality.value+"%";
