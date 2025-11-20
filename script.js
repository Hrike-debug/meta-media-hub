/* ------------------------------
   Utilities + small helpers
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
  } catch(e){ /* ignore */ }
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
  const current = localStorage.getItem(THEME_KEY) || "dark";
  applyTheme(current === "dark" ? "light" : "dark");
});
(function initTheme(){
  const saved = localStorage.getItem(THEME_KEY) || "dark";
  applyTheme(saved);
})();

/* ------------------------------
   Auth & UI navigation
   ------------------------------ */
const pwModal = $("pwModal"), pwInput = $("pwInput"), pwBtn = $("pwBtn"), pwMsg = $("pwMsg"), statusText = $("statusText");
const AUTH_KEY = "mm_auth_v1", PASSWORD = "Meta@123";

function saveAuth(v){ v ? localStorage.setItem(AUTH_KEY,"true") : localStorage.removeItem(AUTH_KEY); }
function isAuthed(){ return localStorage.getItem(AUTH_KEY) === "true"; }

function showSection(name){
  $("home").style.display = name==="home" ? "flex" : "none";
  $("imageSection").style.display = name==="image" ? "block" : "none";
  $("videoSection").style.display = name==="video" ? "block" : "none";
  statusText.textContent = name==="home" ? "Choose workflow" : (name==="image" ? "Image tools" : "Video tools");
}

async function unlock(){
  if(pwInput.value === PASSWORD){
    saveAuth(true);
    pwInput.value = "";
    pwMsg.textContent = "";
    pwModal.style.display = "none";
    showSection("home");
    statusText.textContent = "Unlocked";
  } else {
    pwMsg.textContent = "Incorrect password";
  }
}

pwBtn.addEventListener("click", unlock);
pwInput.addEventListener("keydown", e => { if(e.key === "Enter") unlock(); });

if (isAuthed()){
  pwModal.style.display = "none";
  showSection("home");
}

/* Home navigation */
$("btnImage").addEventListener("click", ()=> showSection("image"));
$("btnVideo").addEventListener("click", ()=> showSection("video"));
$("backHomeFromImage").addEventListener("click", ()=> showSection("home"));
$("backHomeFromVideo").addEventListener("click", ()=> showSection("home"));

/* ------------------------------
   Image tool variables
   ------------------------------ */
let imageFiles = [];
let imageDetectionMap = {};
let imageFocusMap = {}; // stores { xRel, yRel } center per filename
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

/* Drag & drop */
dropImage.addEventListener("click", () => imageInput.click());
imageInput.addEventListener("change", async e => {
  imageFiles = Array.from(e.target.files);
  await handleNewImages();
});
dropImage.addEventListener("dragover", e => { e.preventDefault(); dropImage.style.background='rgba(255,255,255,0.05)'; });
dropImage.addEventListener("dragleave", e => { dropImage.style.background=''; });
dropImage.addEventListener("drop", async e => {
  e.preventDefault(); dropImage.style.background=''; imageFiles = Array.from(e.dataTransfer.files); await handleNewImages();
});

/* Display list */
function refreshImageList(){
  if(!imageFiles.length){
    imageFileList.innerHTML = "No files uploaded.";
    smartBanner.style.display = "none";
    return;
  }

  imageFileList.innerHTML = imageFiles.map((f,i) => {
    const st = imageDetectionMap[f.name] || "unknown";
    let icon = "⏳", label = "Scanning…";
    if(st==="person"){ icon="👤"; label="Human Found"; }
    else if(st==="none"){ icon="❌"; label="No Person"; }

    return `
      <div style="display:flex;gap:8px;align-items:center">
        <span class="file-icon">${icon}</span>
        <div>
          <strong>${i+1}.</strong> ${f.name}
          <div style="color:var(--muted);font-size:12px">${label} • ${Math.round(f.size/1024)} KB</div>
        </div>
      </div>`;
  }).join("");
}

/* ------------------------------
   Coco model (smart detection)
   ------------------------------ */
async function loadModel(){
  if(cocoModel) return cocoModel;
  try{
    imgStatus.textContent = "Downloading detection model...";
    cocoModel = await cocoSsd.load();
    imgStatus.textContent = "Model ready";
    return cocoModel;
  }catch(err){
    console.error("Model load failed", err);
    imgStatus.textContent = "Model load failed";
    throw err;
  }
}

async function detectPerson(imgEl){
  try{
    await loadModel();
    const preds = await cocoModel.detect(imgEl);
    return preds.some(p => p.class === "person");
  }catch(e){
    console.error("detectPerson error:", e);
    return false;
  }
}

/* ------------------------------
   Main: handle new images
   ------------------------------ */
async function handleNewImages(){
  imageDetectionMap = {};
  imageFiles.forEach(f => imageDetectionMap[f.name] = "unknown");

  refreshImageList();

  imgStatus.textContent = "Scanning images...";
  smartBanner.style.display = "flex";
  bannerIcon.textContent = "⏳";
  bannerText.textContent = "Scanning uploaded images...";

  let found = 0;

  for(const file of imageFiles){
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;

    await new Promise(resolve => {
      img.onload = resolve;
      img.onerror = resolve;
    });

    const hasPerson = await detectPerson(img);
    URL.revokeObjectURL(url);

    if(hasPerson){
      imageDetectionMap[file.name] = "person";
      found++;
    } else {
      imageDetectionMap[file.name] = "none";
    }

    refreshImageList();
  }

  if(found > 0){
    bannerIcon.textContent = "🟢";
    bannerText.innerHTML = `<strong>Smart Human Detection:</strong><br>People detected in ${found} of ${imageFiles.length} image(s).`;
    aiSwitch.classList.add("active");
    smartBanner.classList.remove("off");
  } else {
    bannerIcon.textContent = "⚪";
    bannerText.innerHTML = `<strong>Smart Human Detection:</strong><br>No people found.`;
    aiSwitch.classList.remove("active");
    smartBanner.classList.add("off");
  }

  updateSwitchLabel();
  imgStatus.textContent = "Scan complete";
}

/* Switch UI */
function updateSwitchLabel(){
  const on = aiSwitch.classList.contains("active");
  const labelOn = aiSwitch.querySelector(".label-on");
  const labelOff = aiSwitch.querySelector(".label-off");
  if(labelOn) labelOn.style.display = on ? "inline" : "none";
  if(labelOff) labelOff.style.display = on ? "none" : "inline";
}
aiSwitch.addEventListener("click", ()=>{ aiSwitch.classList.toggle("active"); updateSwitchLabel(); });

/* ------------------------------
   Crop math + person box detection
   ------------------------------ */
function computeCrop(imgW,imgH,tw,th, personBox, manual){
  const scale = Math.max(tw / imgW, th / imgH);
  const sW = Math.round(tw / scale);
  const sH = Math.round(th / scale);

  let cx = imgW/2, cy = imgH/2;
  if(manual){ cx = manual.xRel * imgW; cy = manual.yRel * imgH; }
  else if(personBox){ cx = personBox.x + personBox.width/2; cy = personBox.y + personBox.height/2; }

  let sx = Math.round(cx - sW/2);
  let sy = Math.round(cy - sH/2);

  if(sx < 0) sx = 0;
  if(sy < 0) sy = 0;
  if(sx + sW > imgW) sx = imgW - sW;
  if(sy + sH > imgH) sy = imgH - sH;

  return { sx, sy, sW, sH };
}

async function detectPersonBox(imgEl){
  try{
    await loadModel();
    const preds = await cocoModel.detect(imgEl);
    const persons = preds.filter(p => p.class === "person");
    if(!persons.length) return null;

    let best = persons[0];
    let area = best.bbox[2] * best.bbox[3];
    for(const p of persons){
      const a = p.bbox[2] * p.bbox[3];
      if(a > area){ best = p; area = a; }
    }
    const [x,y,w,h] = best.bbox;
    return { x, y, width: w, height: h };
  }catch(e){
    console.error("detectPersonBox error", e);
    return null;
  }
}

/* Crop -> blob */
function cropToBlob(imgEl, tw, th, crop, quality){
  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(imgEl, crop.sx, crop.sy, crop.sW, crop.sH, 0, 0, tw, th);
  return new Promise(res => canvas.toBlob(b => res(b), "image/jpeg", Math.max(0.01, Math.min(1, quality/100))));
}

/* Process & zip */
imgProcessBtn.addEventListener("click", async () => {
  if(!imageFiles.length) return alert("Upload images first");

  const tw = parseInt(imgWidth.value);
  const th = parseInt(imgHeight.value);
  const q  = parseInt(imgQuality.value) || 90;
  const useSmart = aiSwitch.classList.contains("active");

  if(!tw || !th) return alert("Enter width & height");

  imgStatus.textContent = "Starting...";
  imgProgress.style.width = "0%";

  const zip = new JSZip();
  let index = 0;

  for(const file of imageFiles){
    index++;
    imgStatus.textContent = `Processing ${index}/${imageFiles.length}: ${file.name}`;

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    await new Promise(r => { img.onload = r; img.onerror = r; });

    const manual = imageFocusMap[file.name] || null;
    let personBox = null;
    if(useSmart && !manual){
      personBox = await detectPersonBox(img);
    }

    const crop = computeCrop(img.naturalWidth, img.naturalHeight, tw, th, personBox, manual);
    const blob = await cropToBlob(img, tw, th, crop, q);
    zip.file(`resized_${file.name.replace(/\.[^/.]+$/,"")}.jpg`, blob);

    URL.revokeObjectURL(url);

    imgProgress.style.width = (index / imageFiles.length * 100) + "%";
  }

  imgStatus.textContent = "Preparing ZIP...";
  const zipBlob = await zip.generateAsync({type:"blob"});
  createDownload(zipBlob, "resized_images.zip");
  imgStatus.textContent = "Done!";
});

/* Preview slider */
const previewModal = $("previewModal"), beforeImg = $("beforeImg"), afterImg = $("afterImg"), afterLayer = $("afterLayer"), handle = $("handle"), previewTitle = $("previewTitle"), previewInfo = $("previewInfo");

$("imgPreviewBtn").addEventListener("click", async () => {
  if(!imageFiles.length) return alert("Upload images first");
  const file = imageFiles[0];
  const tw = parseInt(imgWidth.value) || 800;
  const th = parseInt(imgHeight.value) || 600;
  const q  = parseInt(imgQuality.value) || 90;
  const useSmart = aiSwitch.classList.contains("active");

  imgStatus.textContent = "Preparing preview...";

  revokeIfBlobUrl(beforeImg);
  revokeIfBlobUrl(afterImg);

  const img = new Image();
  const fileUrl = URL.createObjectURL(file);
  img.src = fileUrl;
  await new Promise(r => { img.onload = r; img.onerror = r; });

  const manual = imageFocusMap[file.name] || null;
  let person = null;
  if(useSmart && !manual){
    person = await detectPersonBox(img);
  }

  const crop = computeCrop(img.naturalWidth, img.naturalHeight, tw, th, person, manual);
  const blob = await cropToBlob(img, tw, th, crop, q);

  beforeImg.src = fileUrl;
  afterImg.src = URL.createObjectURL(blob);

  previewTitle.textContent = file.name;
  previewInfo.textContent = `${tw}×${th} • ${q}%`;

  previewModal.style.display = "flex";
  previewModal.setAttribute("aria-hidden", "false");
  afterLayer.style.width = "50%";
  handle.style.left = "50%";
});

/* close preview */
$("closePreview").addEventListener("click", () => {
  previewModal.style.display = "none";
  previewModal.setAttribute("aria-hidden", "true");
  revokeIfBlobUrl(beforeImg);
  revokeIfBlobUrl(afterImg);
});

/* draggable slider */
(function(){
  const wrap = $("previewArea");
  let dragging = false;

  function setPct(pct){
    pct = Math.min(100, Math.max(0, pct));
    afterLayer.style.width = pct + "%";
    handle.style.left = pct + "%";
  }

  handle.addEventListener("mousedown", ()=>{ dragging=true; document.body.style.cursor='ew-resize'; });
  document.addEventListener("mouseup", ()=>{ dragging=false; document.body.style.cursor=''; });
  document.addEventListener("mousemove", e => {
    if(!dragging) return;
    const rect = wrap.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setPct(pct);
  });
})();

/* ------------------------------
   Manual focus system (Rectangle)
   ------------------------------ */
const focusModal = $("focusModal"),
      focusPreview = $("focusPreview"),
      focusRect = $("focusRect"),
      focusCanvas = $("focusCanvas"),
      focusSelect = $("focusSelect"),
      saveFocusBtn = $("saveFocus"),
      clearFocusBtn = $("clearFocus"),
      closeFocusBtn = $("closeFocus");

let rectState = { visible:false, left:0, top:0, width:160, height:120 };
let dragState = { dragging:false, resizing:false, startX:0, startY:0, startLeft:0, startTop:0, startW:0, startH:0 };

function openFocusModal(){
  focusModal.style.display = "flex";
  focusModal.setAttribute("aria-hidden","false");
  populateFocusSelect();
  // make sure rect hidden until image loaded
  focusRect.style.display = "none";
  rectState.visible = false;
}

function populateFocusSelect(){
  focusSelect.innerHTML = "";
  imageFiles.forEach((f,i)=>{
    const opt = document.createElement("option");
    opt.value = f.name;
    opt.textContent = `${i+1}. ${f.name}`;
    focusSelect.appendChild(opt);
  });
  // if no files, do nothing
  if(imageFiles.length) loadFocusImage();
}

function loadFocusImage(){
  const name = focusSelect.value;
  const file = imageFiles.find(f => f.name === name);
  if(!file) return;

  revokeIfBlobUrl(focusPreview);
  const url = URL.createObjectURL(file);
  focusPreview.src = url;

  focusPreview.onload = () => {
    // position rectangle centered by default (or restore saved center)
    const saved = imageFocusMap[name];
    const imgRect = focusPreview.getBoundingClientRect();
    // ensure we compute after layout
    requestAnimationFrame(() => {
      if(saved){
        // restore rectangle centered at saved center
        const w = Math.min( Math.round(imgRect.width * 0.25), imgRect.width );
        const h = Math.min( Math.round(imgRect.height * 0.25), imgRect.height );
        const cx = imgRect.left + saved.xRel * imgRect.width;
        const cy = imgRect.top + saved.yRel * imgRect.height;
        setRectFromCenter(cx, cy, w, h);
      } else {
        // default center
        const w = Math.max(80, Math.round(imgRect.width * 0.25));
        const h = Math.max(80, Math.round(imgRect.height * 0.25));
        setRectFromCenter(imgRect.left + imgRect.width/2, imgRect.top + imgRect.height/2, w, h);
      }
      focusRect.style.display = "block";
      rectState.visible = true;
    });
  };
}

function setRectFromCenter(cx, cy, w, h){
  const canvasRect = focusCanvas.getBoundingClientRect();
  // clamp into canvas
  let left = cx - w/2, top = cy - h/2;
  if(left < canvasRect.left) left = canvasRect.left;
  if(top < canvasRect.top) top = canvasRect.top;
  if(left + w > canvasRect.right) left = canvasRect.right - w;
  if(top + h > canvasRect.bottom) top = canvasRect.bottom - h;
  // place as absolute relative to canvas
  focusRect.style.left = (left - canvasRect.left) + "px";
  focusRect.style.top = (top - canvasRect.top) + "px";
  focusRect.style.width = w + "px";
  focusRect.style.height = h + "px";
}

focusSelect.addEventListener("change", loadFocusImage);

/* Drag & resize handlers for focusRect */
focusRect.addEventListener("mousedown", (e) => {
  if(e.target.classList.contains("focus-handle")) return; // handle separately
  dragState.dragging = true;
  dragState.startX = e.clientX; dragState.startY = e.clientY;
  const r = focusRect.getBoundingClientRect();
  const c = focusCanvas.getBoundingClientRect();
  dragState.startLeft = r.left - c.left;
  dragState.startTop = r.top - c.top;
  dragState.startW = r.width; dragState.startH = r.height;
  e.preventDefault();
});

focusRect.querySelector(".focus-handle").addEventListener("mousedown", (e) => {
  dragState.resizing = true;
  dragState.startX = e.clientX; dragState.startY = e.clientY;
  const r = focusRect.getBoundingClientRect();
  dragState.startW = r.width; dragState.startH = r.height;
  e.preventDefault();
});

document.addEventListener("mousemove", (e) => {
  if(!rectState.visible) return;
  const canvasRect = focusCanvas.getBoundingClientRect();
  if(dragState.dragging){
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    let newLeft = dragState.startLeft + dx;
    let newTop = dragState.startTop + dy;
    // clamp
    newLeft = Math.max(0, Math.min(canvasRect.width - dragState.startW, newLeft));
    newTop = Math.max(0, Math.min(canvasRect.height - dragState.startH, newTop));
    focusRect.style.left = newLeft + "px";
    focusRect.style.top = newTop + "px";
  }
  if(dragState.resizing){
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    let newW = Math.max(40, dragState.startW + dx);
    let newH = Math.max(40, dragState.startH + dy);
    // clamp to canvas size
    newW = Math.min(newW, canvasRect.width);
    newH = Math.min(newH, canvasRect.height);
    focusRect.style.width = newW + "px";
    focusRect.style.height = newH + "px";
  }
});

document.addEventListener("mouseup", () => {
  dragState.dragging = false;
  dragState.resizing = false;
});

function saveRectFocus(fileName){
  const rect = focusRect.getBoundingClientRect();
  const img = focusPreview.getBoundingClientRect();
  if(!img.width || !img.height) return;
  // center coords relative to displayed image
  const cx = rect.left + rect.width/2;
  const cy = rect.top + rect.height/2;
  const xRel = (cx - img.left) / img.width;
  const yRel = (cy - img.top) / img.height;
  imageFocusMap[fileName] = { xRel: Math.max(0, Math.min(1, xRel)), yRel: Math.max(0, Math.min(1, yRel)) };
}

saveFocusBtn.addEventListener("click", () => {
  const name = focusSelect.value;
  if(!name) return alert("Select an image first");
  saveRectFocus(name);
  alert("Focus saved (center of rectangle).");
});

clearFocusBtn.addEventListener("click", () => {
  const name = focusSelect.value;
  if(!name) return;
  delete imageFocusMap[name];
  alert("Focus cleared.");
  // reset default rectangle to center
  loadFocusImage();
});

closeFocusBtn.addEventListener("click", () => {
  focusModal.style.display = "none";
  focusModal.setAttribute("aria-hidden","true");
  revokeIfBlobUrl(focusPreview);
});

/* when user clicks canvas we also allow setting rectangle center to that point */
focusCanvas.addEventListener("dblclick", (e) => {
  // map to image center
  const imgRect = focusPreview.getBoundingClientRect();
  if(!imgRect.width) return;
  // calculate click point clamped to image
  let x = e.clientX; let y = e.clientY;
  if(x < imgRect.left) x = imgRect.left; if(x > imgRect.right) x = imgRect.right;
  if(y < imgRect.top) y = imgRect.top; if(y > imgRect.bottom) y = imgRect.bottom;
  // move rectangle center to this point
  const w = focusRect.getBoundingClientRect().width || Math.max(80, imgRect.width*0.25);
  const h = focusRect.getBoundingClientRect().height || Math.max(80, imgRect.height*0.25);
  setRectFromCenter(x, y, w, h);
});

/* focus button */
$("focusBtn").addEventListener("click", ()=>{ if(!imageFiles.length) return alert("Upload images first"); openFocusModal(); });


/* ------------------------------
   Video tools (FFmpeg) — CLEAN VERSION (Upload + Mute Only)
-------------------------------- */
const dropVideo = $("dropVideo");
const videoInput = $("videoInput");
const videoPreview = $("videoPreview");
const muteBtn = $("muteBtn");
const videoStatus = $("videoStatus");
const ffmpegStatus = $("ffmpegStatus");

let currentVideoFile = null;
let ffmpegReady = false;

const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ log: false });

/* Load FFmpeg only once */
async function loadFFmpeg() {
  if (!ffmpegReady) {
    ffmpegStatus.textContent = "Loading FFmpeg (first time 10–20 sec)…";
    try {
      await ffmpeg.load();
      ffmpegReady = true;
      ffmpegStatus.textContent = "Ready";
    } catch (err) {
      console.error("FFmpeg failed:", err);
      ffmpegStatus.textContent = "Load Error";
      alert("FFmpeg failed to load. Check internet/firewall.");
    }
  }
}

/* ------------------------------
   Upload Video
-------------------------------- */
dropVideo.addEventListener("click", () => videoInput.click());

videoInput.addEventListener("change", e => {
  handleVideo(e.target.files);
});

dropVideo.addEventListener("dragover", e => {
  e.preventDefault();
  dropVideo.style.background = "rgba(255,255,255,0.05)";
});

dropVideo.addEventListener("dragleave", () => {
  dropVideo.style.background = "";
});

dropVideo.addEventListener("drop", e => {
  e.preventDefault();
  dropVideo.style.background = "";
  handleVideo(e.dataTransfer.files);
});

function handleVideo(files) {
  if (!files.length) return;

  currentVideoFile = files[0];
  videoPreview.src = URL.createObjectURL(currentVideoFile);
  videoStatus.textContent = "Loaded: " + currentVideoFile.name;
}

/* ------------------------------
   Mute Video
-------------------------------- */
muteBtn.addEventListener("click", async () => {
  if (!currentVideoFile) return alert("Upload a video first.");

  await loadFFmpeg();

  videoStatus.textContent = "Muting…";

  // Read video into FFmpeg memory
  ffmpeg.FS("writeFile", "input.mp4", await fetchFile(currentVideoFile));

  // Run mute command
  await ffmpeg.run("-i", "input.mp4", "-c:v", "copy", "-an", "muted.mp4");

  // Get output
  const data = ffmpeg.FS("readFile", "muted.mp4");
  const blob = new Blob([data.buffer], { type: "video/mp4" });

  const outName = currentVideoFile.name.replace(/\.[^/.]+$/, "") + "_muted.mp4";
  createDownload(blob, outName);

  // Cleanup memory
  ffmpeg.FS("unlink", "input.mp4");
  ffmpeg.FS("unlink", "muted.mp4");

  videoStatus.textContent = "Muted video saved!";
});


/* ------------------------------
   UX small improvements
   ------------------------------ */
imgQuality.addEventListener("input", () => { imgQualityVal.textContent = imgQuality.value + "%"; });

/* Initialize UI */
updateSwitchLabel();
showSection("home");
