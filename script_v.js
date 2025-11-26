/* ==========================================================
   Meta Media Hub - script_v.js
   - Auth / Sections
   - Theme modal
   - Image Resizer (scan + resize + ZIP)
   - AI Enhancer (Upscale, Sharpen-Pro, Denoise, HDR, OCR)
   - Privacy Blur (programmatic stub – no drawing)
   - Preview & Download
   All operations run in-browser. No server calls.
   ========================================================== */

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ====================
   AUTH + SECTION LOGIC
   ==================== */
const pwModal = $("pwModal");
const pwInput = $("pwInput");
const pwBtn = $("pwBtn");
const pwMsg = $("pwMsg");
const statusText = $("statusText");

const AUTH_KEY = "mm_auth_v3";
const PASSWORD = "Meta@123";

function saveAuth(v) {
  if (v) localStorage.setItem(AUTH_KEY, "true");
  else localStorage.removeItem(AUTH_KEY);
}
function isAuthed() {
  return localStorage.getItem(AUTH_KEY) === "true";
}

function showSection(name) {
  const home = $("home");
  const imageSection = $("imageSection");
  const enhancerSection = $("enhancerSection");

  if (home) home.style.display = name === "home" ? "flex" : "none";
  if (imageSection) imageSection.style.display = name === "resize" ? "block" : "none";
  if (enhancerSection) enhancerSection.style.display = name === "enhance" ? "block" : "none";

  if (home) home.classList.toggle("active", name === "home");
  if (imageSection) imageSection.classList.toggle("active", name === "resize");
  if (enhancerSection) enhancerSection.classList.toggle("active", name === "enhance");
}

/* =========================
   IMAGE RESIZER (scan + ZIP)
   ========================= */

async function processImages(previewOnly = false) {
  if (!imageFiles.length) {
    alert("Upload images first.");
    return;
  }
  if (imgStatus) imgStatus.textContent = "Processing images…";

  const tW = parseInt(imgWidth?.value || "0", 10) || 0;
  const tH = parseInt(imgHeight?.value || "0", 10) || 0;
  const q = imgQuality ? (parseInt(imgQuality.value, 10) || 90) / 100 : 0.9;

  const zip = new JSZip();
  let processed = 0;

  for (const file of imageFiles) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    await img.decode().catch(() => {});

    /* ✅ FIXED TARGET BOX (NO PROPORTIONAL RECALC HERE) */
    let w = tW || img.naturalWidth;
    let h = tH || img.naturalHeight;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    /* ✅ UNIVERSAL CENTER COVER SCALE (NO STRETCH) */
    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;
    const targetW = w;
    const targetH = h;

    const scale = Math.max(targetW / imgW, targetH / imgH);

    const scaledW = imgW * scale;
    const scaledH = imgH * scale;

    const offsetX = (targetW - scaledW) / 2;
    const offsetY = (targetH - scaledH) / 2;

    ctx.drawImage(img, offsetX, offsetY, scaledW, scaledH);

    const dataUrl = canvas.toDataURL("image/jpeg", q);

    if (previewOnly) {
      const wPrev = window.open("");
      if (!wPrev) {
        alert("Popup blocked — allow popups to preview.");
      } else {
        wPrev.document.write(
          `<title>Preview</title><img src="${dataUrl}" style="max-width:100%;height:auto;display:block;margin:0 auto;">`
        );
        wPrev.document.close();
      }
      URL.revokeObjectURL(url);
      if (imgStatus) imgStatus.textContent = "Preview opened for first image.";
      return;
    }

    const blob = dataURLToBlob(dataUrl);
    const base = file.name.replace(/\.[^/.]+$/, "");
    zip.file(base + "_resized.jpg", blob);

    processed++;
    if (imgProgress) imgProgress.style.width =
      ((processed / imageFiles.length) * 100).toFixed(1) + "%";
    URL.revokeObjectURL(url);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(zipBlob);
  a.download = "resized_images.zip";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  if (imgStatus) imgStatus.textContent = "Done. ZIP downloaded.";
}

/* ============================
   Utility: download dataURL
   ============================ */
function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
