/* ----------------------------------------------------
   Meta Media Hub — Image Tools + AI Enhancer
---------------------------------------------------- */

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
   THEME TOGGLE
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

applyTheme(localStorage.getItem(THEME_KEY) || "dark");

/* ------------------------------
   AUTH
------------------------------ */

const pwModal = $("pwModal");
const pwInput = $("pwInput");
const pwBtn = $("pwBtn");
const pwMsg = $("pwMsg");
const statusText = $("statusText");
const AUTH_KEY = "mm_auth_v1";
const PASSWORD = "Meta@123";

function saveAuth(v) {
  v ? localStorage.setItem(AUTH_KEY, "true") : localStorage.removeItem(AUTH_KEY);
}
function isAuthed() {
  return localStorage.getItem(AUTH_KEY) === "true";
}

async function unlock() {
  if (pwInput.value === PASSWORD) {
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
pwInput.addEventListener("keydown", e => { if (e.key === "Enter") unlock(); });

if (isAuthed()) {
  pwModal.style.display = "none";
  showSection("home");
}

/* ------------------------------
   SECTION NAVIGATION
------------------------------ */

const homeSection = $("home");
const imageSection = $("imageSection");
const enhancerSection = $("enhancerSection");

function activateSection(sec) {
  [homeSection, imageSection, enhancerSection].forEach(s => {
    if (!s) return;
    s.classList.remove("active");
    s.style.display = "none";
  });
  if (!sec) return;
  sec.style.display = sec === homeSection ? "flex" : "block";
  // small delay for transition
  requestAnimationFrame(() => sec.classList.add("active"));
}

function showSection(name) {
  if (name === "home") {
    activateSection(homeSection);
    statusText.textContent = "Choose tool";
  } else if (name === "image") {
    activateSection(imageSection);
    statusText.textContent = "Image tools";
  } else if (name === "enhancer") {
    activateSection(enhancerSection);
    statusText.textContent = "AI Enhancer";
  }
}

$("btnImage").addEventListener("click", () => showSection("image"));
$("btnEnhancer").addEventListener("click", () => showSection("enhancer"));
$("backHomeFromImage").addEventListener("click", () => showSection("home"));
$("backHomeFromEnhancer").addEventListener("click", () => showSection("home"));

/* ------------------------------
   IMAGE TOOLS (RESIZER)
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

/* Drag & drop for resizer */

dropImage.addEventListener("click", () => imageInput.click());

imageInput.addEventListener("change", async e => {
  imageFiles = Array.from(e.target.files);
  await handleNewImages();
});

dropImage.addEventListener("dragover", e => {
  e.preventDefault();
  dropImage.style.background = "rgba(255,255,255,0.04)";
});

dropImage.addEventListener("dragleave", () => {
  dropImage.style.background = "transparent";
});

dropImage.addEventListener("drop", async e => {
  e.preventDefault();
  dropImage.style.background = "transparent";
  imageFiles = Array.from(e.dataTransfer.files);
  await handleNewImages();
});

/* file list UI */

function refreshImageList() {
  if (!imageFiles.length) {
    imageFileList.innerHTML = "No files uploaded.";
    smartBanner.style.display = "none";
    return;
  }

  imageFileList.innerHTML = imageFiles.map((f, i) => {
    const st = imageDetectionMap[f.name] || "unknown";
    let icon = "⏳", label = "Scanning…";
    if (st === "person") { icon = "👤"; label = "Human Found"; }
    else if (st === "none") { icon = "❌"; label = "No Person"; }

    return `
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px;">
        <span class="file-icon">${icon}</span>
        <div>
          <strong>${i + 1}.</strong> ${f.name}
          <div style="font-size:12px;color:var(--muted);">
            ${label} • ${(f.size / 1024).toFixed(1)} KB
          </div>
        </div>
      </div>
    `;
  }).join("");
}

/* Model load & detection */

async function loadModel() {
  if (cocoModel) return cocoModel;
  imgStatus.textContent = "Downloading detection model…";
  cocoModel = await cocoSsd.load();
  imgStatus.textContent = "Model ready";
  return cocoModel;
}

async function detectPerson(imgEl) {
  try {
    await loadModel();
    const preds = await cocoModel.detect(imgEl);
    return preds.some(p => p.class === "person");
  } catch {
    return false;
  }
}

async function detectPersonBox(imgEl) {
  try {
    await loadModel();
    const preds = await cocoModel.detect(imgEl);
    const persons = preds.filter(p => p.class === "person");
    if (!persons.length) return null;

    let best = persons[0];
    let area = best.bbox[2] * best.bbox[3];
    for (const p of persons) {
      const a = p.bbox[2] * p.bbox[3];
      if (a > area) { best = p; area = a; }
    }
    const [x, y, w, h] = best.bbox;
    return { x, y, width: w, height: h };
  } catch {
    return null;
  }
}

/* handle new images (scan for people) */

async function handleNewImages() {
  imageDetectionMap = {};
  imageFiles.forEach(f => imageDetectionMap[f.name] = "unknown");

  refreshImageList();
  imgStatus.textContent = "Scanning images...";
  smartBanner.style.display = "flex";
  bannerIcon.textContent = "⏳";
  bannerText.textContent = "Scanning uploaded images...";

  let found = 0;

  for (const file of imageFiles) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;

    await new Promise(r => { img.onload = r; img.onerror = r; });

    const hasPerson = await detectPerson(img);
    URL.revokeObjectURL(url);

    if (hasPerson) {
      imageDetectionMap[file.name] = "person";
      found++;
    } else {
      imageDetectionMap[file.name] = "none";
    }

    refreshImageList();
  }

  if (found) {
    bannerIcon.textContent = "🟢";
    bannerText.innerHTML = `<strong>Smart Human Detection:</strong><br>People detected in ${found} of ${imageFiles.length} image(s).`;
    aiSwitch.classList.add("active");
  } else {
    bannerIcon.textContent = "⚪";
    bannerText.innerHTML = `<strong>Smart Human Detection:</strong><br>No people found.`;
    aiSwitch.classList.remove("active");
  }

  updateSwitchLabel();
  imgStatus.textContent = "Scan complete";
}

/* smart switch label */

function updateSwitchLabel() {
  const on = aiSwitch.classList.contains("active");
  const onLabel = aiSwitch.querySelector(".label-on");
  const offLabel = aiSwitch.querySelector(".label-off");
  if (onLabel) onLabel.style.display = on ? "inline" : "none";
  if (offLabel) offLabel.style.display = on ? "none" : "inline";
}

aiSwitch.addEventListener("click", () => {
  aiSwitch.classList.toggle("active");
  updateSwitchLabel();
});

/* cropping math */

function computeCrop(imgW, imgH, tw, th, personBox, manual) {
  const scale = Math.max(tw / imgW, th / imgH);
  const sW = Math.round(tw / scale);
  const sH = Math.round(th / scale);

  let cx = imgW / 2, cy = imgH / 2;
  if (manual) {
    cx = manual.xRel * imgW;
    cy = manual.yRel * imgH;
  } else if (personBox) {
    cx = personBox.x + personBox.width / 2;
    cy = personBox.y + personBox.height / 2;
  }

  let sx = Math.round(cx - sW / 2);
  let sy = Math.round(cy - sH / 2);

  if (sx < 0) sx = 0;
  if (sy < 0) sy = 0;
  if (sx + sW > imgW) sx = imgW - sW;
  if (sy + sH > imgH) sy = imgH - sH;

  return { sx, sy, sW, sH };
}

/* crop -> blob (no AI in resizer) */

function cropToBlob(imgEl, tw, th, crop, quality) {
  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(
    imgEl,
    crop.sx, crop.sy, crop.sW, crop.sH,
    0, 0, tw, th
  );
  return new Promise(res =>
    canvas.toBlob(
      b => res(b),
      "image/jpeg",
      Math.max(0.1, Math.min(1, quality / 100))
    )
  );
}

/* process all -> zip */

imgProcessBtn.addEventListener("click", async () => {
  if (!imageFiles.length) return alert("Upload images first.");

  const tw = parseInt(imgWidth.value, 10);
  const th = parseInt(imgHeight.value, 10);
  const q = parseInt(imgQuality.value, 10) || 90;

  if (!tw || !th) return alert("Enter width & height.");

  imgStatus.textContent = "Starting...";
  imgProgress.style.width = "0%";

  const zip = new JSZip();
  let index = 0;

  for (const file of imageFiles) {
    index++;
    imgStatus.textContent = `Processing ${index}/${imageFiles.length}: ${file.name}`;

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;

    await new Promise(r => { img.onload = r; img.onerror = r; });

    const manual = imageFocusMap[file.name] || null;
    let personBox = null;
    if (aiSwitch.classList.contains("active") && !manual) {
      personBox = await detectPersonBox(img);
    }

    const crop = computeCrop(img.naturalWidth, img.naturalHeight, tw, th, personBox, manual);
    const blob = await cropToBlob(img, tw, th, crop, q);
    zip.file(`resized_${file.name.replace(/\.[^.]+$/, "")}.jpg`, blob);
    URL.revokeObjectURL(url);

    imgProgress.style.width = `${(index / imageFiles.length) * 100}%`;
  }

  imgStatus.textContent = "Preparing ZIP...";
  const zipBlob = await zip.generateAsync({ type: "blob" });
  createDownload(zipBlob, "resized_images.zip");
  imgStatus.textContent = "Done!";
});

/* ------------------------------
   PREVIEW MODAL
------------------------------ */

const previewModal = $("previewModal");
const beforeImg = $("beforeImg");
const afterImg = $("afterImg");
const afterLayer = $("afterLayer");
const handle = $("handle");
const previewTitle = $("previewTitle");
const previewInfo = $("previewInfo");
const previewArea = $("previewArea");

$("imgPreviewBtn").addEventListener("click", async () => {
  if (!imageFiles.length) return alert("Upload images first.");
  const file = imageFiles[0];

  const tw = parseInt(imgWidth.value, 10) || 800;
  const th = parseInt(imgHeight.value, 10) || 600;
  const q = parseInt(imgQuality.value, 10) || 90;

  imgStatus.textContent = "Preparing preview...";

  revokeIfBlobUrl(beforeImg);
  revokeIfBlobUrl(afterImg);

  const img = new Image();
  const fileUrl = URL.createObjectURL(file);
  img.src = fileUrl;

  await new Promise(r => { img.onload = r; img.onerror = r; });

  const manual = imageFocusMap[file.name] || null;
  let personBox = null;
  if (aiSwitch.classList.contains("active") && !manual) {
    personBox = await detectPersonBox(img);
  }

  const crop = computeCrop(img.naturalWidth, img.naturalHeight, tw, th, personBox, manual);
  const blob = await cropToBlob(img, tw, th, crop, q);

  beforeImg.src = fileUrl;
  afterImg.src = URL.createObjectURL(blob);

  previewTitle.textContent = file.name;
  previewInfo.textContent = `${tw}×${th} • ${q}%`;

  previewModal.style.display = "flex";
  afterLayer.style.width = "50%";
  handle.style.left = "50%";
});

$("closePreview").addEventListener("click", () => {
  previewModal.style.display = "none";
  revokeIfBlobUrl(beforeImg);
  revokeIfBlobUrl(afterImg);
});

/* preview slider drag */

(function () {
  let dragging = false;

  handle.addEventListener("mousedown", () => {
    dragging = true;
    document.body.style.cursor = "ew-resize";
  });

  document.addEventListener("mouseup", () => {
    dragging = false;
    document.body.style.cursor = "";
  });

  document.addEventListener("mousemove", e => {
    if (!dragging) return;
    const rect = previewArea.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    const clamped = Math.max(0, Math.min(100, pct));
    afterLayer.style.width = clamped + "%";
    handle.style.left = clamped + "%";
  });
})();

/* ------------------------------
   MANUAL FOCUS MODAL
------------------------------ */

const focusModal = $("focusModal");
const focusPreview = $("focusPreview");
const focusRect = $("focusRect");
const focusCanvas = $("focusCanvas");
const focusSelect = $("focusSelect");
const saveFocusBtn = $("saveFocus");
const clearFocusBtn = $("clearFocus");
const closeFocusBtn = $("closeFocus");
const focusBtn = $("focusBtn");

let rectVisible = false;
let dragState = { dragging: false, resizing: false, startX: 0, startY: 0, startLeft: 0, startTop: 0, startW: 0, startH: 0 };

focusBtn.addEventListener("click", () => {
  if (!imageFiles.length) return alert("Upload images first.");
  openFocusModal();
});

function openFocusModal() {
  focusModal.style.display = "flex";
  populateFocusSelect();
  focusRect.style.display = "none";
  rectVisible = false;
}

function populateFocusSelect() {
  focusSelect.innerHTML = "";
  imageFiles.forEach((f, i) => {
    const opt = document.createElement("option");
    opt.value = f.name;
    opt.textContent = `${i + 1}. ${f.name}`;
    focusSelect.appendChild(opt);
  });
  if (imageFiles.length) loadFocusImage();
}

function loadFocusImage() {
  const name = focusSelect.value;
  const file = imageFiles.find(f => f.name === name);
  if (!file) return;

  revokeIfBlobUrl(focusPreview);
  const url = URL.createObjectURL(file);
  focusPreview.src = url;

  focusPreview.onload = () => {
    const imgRect = focusPreview.getBoundingClientRect();
    requestAnimationFrame(() => {
      const saved = imageFocusMap[name];
      const w = Math.max(80, imgRect.width * 0.25);
      const h = Math.max(80, imgRect.height * 0.25);

      const cx = saved ? imgRect.left + saved.xRel * imgRect.width : imgRect.left + imgRect.width / 2;
      const cy = saved ? imgRect.top + saved.yRel * imgRect.height : imgRect.top + imgRect.height / 2;

      setRectFromCenter(cx, cy, w, h);
      focusRect.style.display = "block";
      rectVisible = true;
    });
  };
}

focusSelect.addEventListener("change", loadFocusImage);

function setRectFromCenter(cx, cy, w, h) {
  const c = focusCanvas.getBoundingClientRect();
  let left = cx - w / 2, top = cy - h / 2;

  if (left < c.left) left = c.left;
  if (top < c.top) top = c.top;
  if (left + w > c.right) left = c.right - w;
  if (top + h > c.bottom) top = c.bottom - h;

  focusRect.style.left = (left - c.left) + "px";
  focusRect.style.top = (top - c.top) + "px";
  focusRect.style.width = w + "px";
  focusRect.style.height = h + "px";
}

/* drag & resize focus rect */

focusRect.addEventListener("mousedown", e => {
  if (e.target.classList.contains("focus-handle")) return;
  const r = focusRect.getBoundingClientRect();
  const c = focusCanvas.getBoundingClientRect();
  dragState.dragging = true;
  dragState.startX = e.clientX;
  dragState.startY = e.clientY;
  dragState.startLeft = r.left - c.left;
  dragState.startTop = r.top - c.top;
  dragState.startW = r.width;
  dragState.startH = r.height;
  e.preventDefault();
});

focusRect.querySelector(".focus-handle").addEventListener("mousedown", e => {
  dragState.resizing = true;
  dragState.startX = e.clientX;
  dragState.startY = e.clientY;
  const r = focusRect.getBoundingClientRect();
  dragState.startW = r.width;
  dragState.startH = r.height;
  e.preventDefault();
});

document.addEventListener("mousemove", e => {
  if (!rectVisible) return;
  const c = focusCanvas.getBoundingClientRect();

  if (dragState.dragging) {
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    let L = dragState.startLeft + dx;
    let T = dragState.startTop + dy;
    L = Math.max(0, Math.min(c.width - dragState.startW, L));
    T = Math.max(0, Math.min(c.height - dragState.startH, T));
    focusRect.style.left = L + "px";
    focusRect.style.top = T + "px";
  }

  if (dragState.resizing) {
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    let W = Math.max(40, dragState.startW + dx);
    let H = Math.max(40, dragState.startH + dy);
    W = Math.min(W, c.width);
    H = Math.min(H, c.height);
    focusRect.style.width = W + "px";
    focusRect.style.height = H + "px";
  }
});

document.addEventListener("mouseup", () => {
  dragState.dragging = false;
  dragState.resizing = false;
});

function saveRectFocus(name) {
  const rect = focusRect.getBoundingClientRect();
  const img = focusPreview.getBoundingClientRect();
  if (!img.width || !img.height) return;

  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const xRel = (cx - img.left) / img.width;
  const yRel = (cy - img.top) / img.height;

  imageFocusMap[name] = {
    xRel: Math.max(0, Math.min(1, xRel)),
    yRel: Math.max(0, Math.min(1, yRel))
  };
}

saveFocusBtn.addEventListener("click", () => {
  const name = focusSelect.value;
  if (!name) return alert("Select an image first.");
  saveRectFocus(name);
  alert("Focus saved.");
});

clearFocusBtn.addEventListener("click", () => {
  const name = focusSelect.value;
  if (!name) return;
  delete imageFocusMap[name];
  loadFocusImage();
});

closeFocusBtn.addEventListener("click", () => {
  focusModal.style.display = "none";
  revokeIfBlobUrl(focusPreview);
});

/* double click reposition */

focusCanvas.addEventListener("dblclick", e => {
  const imgRect = focusPreview.getBoundingClientRect();
  if (!imgRect.width) return;
  let x = e.clientX, y = e.clientY;
  if (x < imgRect.left) x = imgRect.left;
  if (x > imgRect.right) x = imgRect.right;
  if (y < imgRect.top) y = imgRect.top;
  if (y > imgRect.bottom) y = imgRect.bottom;

  const r = focusRect.getBoundingClientRect();
  setRectFromCenter(x, y, r.width || 100, r.height || 100);
});

/* ------------------------------
   AI IMAGE ENHANCER SECTION
------------------------------ */

const dropEnhance = $("dropEnhance");
const enhanceInput = $("enhanceInput");
const enhFileInfo = $("enhFileInfo");

const enhUpscale2x = $("enhUpscale2x");
const enhUpscale4x = $("enhUpscale4x");
const enhFaceEnhance = $("enhFaceEnhance");
const enhDenoise = $("enhDenoise");

const enhQuality = $("enhQuality");
const enhQualityVal = $("enhQualityVal");
const enhPreviewBtn = $("enhPreviewBtn");
const enhRunBtn = $("enhRunBtn");
const enhStatus = $("enhStatus");
const enhProgress = $("enhProgress");

let enhanceFile = null;

/* drag & drop for enhancer */

dropEnhance.addEventListener("click", () => enhanceInput.click());

enhanceInput.addEventListener("change", e => {
  handleEnhanceFile(e.target.files);
});

dropEnhance.addEventListener("dragover", e => {
  e.preventDefault();
  dropEnhance.style.background = "rgba(255,255,255,0.04)";
});
dropEnhance.addEventListener("dragleave", () => {
  dropEnhance.style.background = "transparent";
});
dropEnhance.addEventListener("drop", e => {
  e.preventDefault();
  dropEnhance.style.background = "transparent";
  handleEnhanceFile(e.dataTransfer.files);
});

function handleEnhanceFile(files) {
  if (!files.length) return;
  enhanceFile = files[0];
  enhFileInfo.textContent = `Selected: ${enhanceFile.name} • ${(enhanceFile.size / 1024).toFixed(1)} KB`;
  enhStatus.textContent = "Ready to enhance.";
}

/* AI settings */

function getEnhSettings() {
  const s = {
    upscale2x: !!enhUpscale2x.checked,
    upscale4x: !!enhUpscale4x.checked,
    faceEnhance: !!enhFaceEnhance.checked,
    denoise: !!enhDenoise.checked
  };
  // prefer 4x if both
  if (s.upscale2x && s.upscale4x) s.upscale2x = false;
  const any = s.upscale2x || s.upscale4x || s.faceEnhance || s.denoise;
  return any ? s : null;
}

/* AI enhancement pipeline helpers */

function applyEnhancementsToCanvas(canvas, ctx, aiSettings) {
  const w = canvas.width;
  const h = canvas.height;
  let imageData = ctx.getImageData(0, 0, w, h);
  let data = imageData.data;

  const clamp = v => v < 0 ? 0 : (v > 255 ? 255 : v);

  // base small contrast/brightness tweak
  const contrast = 1.05;
  const brightness = 3;
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const idx = i + c;
      let v = data[idx];
      v = (v - 128) * contrast + 128 + brightness;
      data[idx] = clamp(v);
    }
  }

  // optional denoise (light blur)
  if (aiSettings.denoise) {
    imageData = gaussianBlur(imageData, w, h);
    data = imageData.data;
  }

  // sharpen (for faceEnhance and denoise)
  if (aiSettings.denoise || aiSettings.faceEnhance) {
    imageData = sharpen(imageData, w, h);
  }

  // upscale if requested (simple resize placeholder)
  if (aiSettings.upscale2x || aiSettings.upscale4x) {
    const scale = aiSettings.upscale4x ? 4 : 2;
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tctx = tempCanvas.getContext("2d");
    tctx.putImageData(imageData, 0, 0);

    const newW = w * scale;
    const newH = h * scale;
    canvas.width = newW;
    canvas.height = newH;
    ctx = canvas.getContext("2d");
    ctx.drawImage(tempCanvas, 0, 0, newW, newH);
  } else {
    ctx.putImageData(imageData, 0, 0);
  }
}

/* simple blur */

function gaussianBlur(imageData, w, h) {
  const src = imageData.data;
  const out = new Uint8ClampedArray(src.length);

  const kernel = [1, 2, 1,
                  2, 4, 2,
                  1, 2, 1];
  const idx = (x, y) => (y * w + x) * 4;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let r = 0, g = 0, b = 0, a = 0, kSum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const ix = x + kx;
          const iy = y + ky;
          const wgt = kernel[(ky + 1) * 3 + (kx + 1)];
          const base = idx(ix, iy);
          r += src[base] * wgt;
          g += src[base + 1] * wgt;
          b += src[base + 2] * wgt;
          a += src[base + 3] * wgt;
          kSum += wgt;
        }
      }
      const o = idx(x, y);
      out[o] = r / kSum;
      out[o + 1] = g / kSum;
      out[o + 2] = b / kSum;
      out[o + 3] = a / kSum;
    }
  }

  imageData.data.set(out);
  return imageData;
}

/* simple sharpen */

function sharpen(imageData, w, h) {
  const src = imageData.data;
  const out = new Uint8ClampedArray(src.length);

  const kernel = [ 0, -1,  0,
                  -1,  5, -1,
                   0, -1,  0 ];
  const idx = (x, y) => (y * w + x) * 4;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const ix = x + kx;
          const iy = y + ky;
          const wgt = kernel[(ky + 1) * 3 + (kx + 1)];
          const base = idx(ix, iy);
          r += src[base] * wgt;
          g += src[base + 1] * wgt;
          b += src[base + 2] * wgt;
          a += src[base + 3] * wgt;
        }
      }
      const o = idx(x, y);
      out[o] = Math.max(0, Math.min(255, r));
      out[o + 1] = Math.max(0, Math.min(255, g));
      out[o + 2] = Math.max(0, Math.min(255, b));
      out[o + 3] = Math.max(0, Math.min(255, a));
    }
  }

  imageData.data.set(out);
  return imageData;
}

/* enhancer quality slider */

enhQuality.addEventListener("input", () => {
  enhQualityVal.textContent = enhQuality.value + "%";
});

/* Enhance & Download */

async function runEnhancer(previewOnly = false) {
  if (!enhanceFile) {
    alert("Upload an image first.");
    return;
  }

  const aiSettings = getEnhSettings();
  if (!aiSettings) {
    if (!confirm("No AI options selected. Apply default light sharpening & contrast?")) {
      return;
    }
  }

  const q = parseInt(enhQuality.value, 10) || 92;

  enhStatus.textContent = "Preparing image...";
  enhProgress.style.width = "10%";

  const img = new Image();
  const url = URL.createObjectURL(enhanceFile);
  img.src = url;

  await new Promise(r => { img.onload = r; img.onerror = r; });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  enhStatus.textContent = "Applying smart enhancements...";
  enhProgress.style.width = "60%";

  if (aiSettings) {
    applyEnhancementsToCanvas(canvas, ctx, aiSettings);
  }

  enhStatus.textContent = "Encoding output...";
  enhProgress.style.width = "90%";

  const blob = await new Promise(res =>
    canvas.toBlob(
      b => res(b),
      "image/jpeg",
      Math.max(0.1, Math.min(1, q / 100))
    )
  );

  URL.revokeObjectURL(url);

  if (previewOnly) {
    // reuse preview modal
    revokeIfBlobUrl(beforeImg);
    revokeIfBlobUrl(afterImg);

    beforeImg.src = URL.createObjectURL(enhanceFile);
    afterImg.src = URL.createObjectURL(blob);

    previewTitle.textContent = enhanceFile.name + " (Enhanced Preview)";
    previewInfo.textContent = `${canvas.width}×${canvas.height} • ${q}%`;
    previewModal.style.display = "flex";
    afterLayer.style.width = "50%";
    handle.style.left = "50%";

    enhStatus.textContent = "Preview ready.";
    enhProgress.style.width = "100%";
  } else {
    const outName = enhanceFile.name.replace(/\.[^.]+$/, "") + "_enhanced.jpg";
    createDownload(blob, outName);
    enhStatus.textContent = "Enhanced image downloaded.";
    enhProgress.style.width = "100%";
  }
}

/* enhancer buttons */

enhPreviewBtn.addEventListener("click", () => runEnhancer(true));
enhRunBtn.addEventListener("click", () => runEnhancer(false));

/* ------------------------------
   MISC
------------------------------ */

imgQuality.addEventListener("input", () => {
  imgQualityVal.textContent = imgQuality.value + "%";
});

/* INIT */

updateSwitchLabel();
if (!isAuthed()) {
  // keep modal visible
} else {
  showSection("home");
}
