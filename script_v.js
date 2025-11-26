// script_v.js — Meta Media Hub (Option B) — Modal is primary annotator
(() => {
  const $ = id => document.getElementById(id);
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

  /* --------- CONFIG / AUTH --------- */
  const PASSWORD = "Meta@123";
  const AUTH_KEY = "mm_auth";
  const pwModal = $("pwModal"), pwInput = $("pwInput"), pwBtn = $("pwBtn"), pwClose = $("pwClose"), pwMsg = $("pwMsg");
  const statusText = $("statusText");

  function isAuthed(){ return localStorage.getItem(AUTH_KEY) === "true"; }
  function setAuthed(v){
    if(v) localStorage.setItem(AUTH_KEY, "true");
    else localStorage.removeItem(AUTH_KEY);
  }

  async function unlock(){
    if(!pwInput) return;
    if(pwInput.value === PASSWORD){
      setAuthed(true);
      if(pwModal) pwModal.style.display = "none";
      if(statusText) statusText.textContent = "Unlocked";
      showSection("home");
    } else {
      if(pwMsg) pwMsg.textContent = "Incorrect password";
    }
  }

  on(pwBtn, "click", unlock);
  on(pwInput, "keydown", e => { if(e.key === "Enter") unlock(); });
  // allow close button to dismiss modal without unlocking (keeps locked)
  if(pwClose) on(pwClose, "click", ()=> { if(pwModal) pwModal.style.display = "none"; });

  if(isAuthed()){ if(pwModal) pwModal.style.display = "none"; if(statusText) statusText.textContent = "Unlocked"; }
  else { if(pwModal) pwModal.style.display = "flex"; if(statusText) statusText.textContent = "Locked"; }

  /* --------- NAV / UI wiring --------- */
  function showSection(name){
    const home = $("home"), enh = $("enhancerSection");
    if(home) home.style.display = (name === "home") ? "flex" : "none";
    if(enh) enh.style.display = (name === "enhance") ? "block" : "none";
  }
  on($("btnImage"), "click", ()=> alert("Image Tools disabled in this build."));
  on($("btnEnhancer"), "click", ()=> showSection("enhance"));
  on($("backHomeFromEnhancer"), "click", ()=> showSection("home"));
  on($("aboutBtn"), "click", ()=> { const m = $("aboutModal"); if(m) m.style.display = "flex"; });
  on($("annotClose"), "click", ()=> { const m = $("annotModal"); if(m) m.style.display = "none"; });

  /* --------- ELEMENT REFS --------- */
  const dropEnhance = $("dropEnhance");
  const enhanceInput = $("enhanceInput");
  const enhFileInfo = $("enhFileInfo");
  const beforeImg = $("beforeImg");
  const afterImg = $("afterImg");
  const splitContainer = $("splitContainer");
  const splitAfter = $("afterClip");
  const splitHandle = $("splitHandle");
  const splitAnnotCanvas = $("splitAnnotCanvas");
  const miniApply = $("miniApply");

  // modal annotator elements
  const annotModal = $("annotModal");
  const annotFullCanvas = $("annotFullCanvas");
  const annotFullBase = $("annotFullBase") || $("annotFullBase"); // not used, but safe
  const annotColor = $("annotColor");
  const annotSize = $("annotSize");
  const annotApply = $("annotApply");
  const annotZoomFit = $("annotZoomFit");
  const annotZoom100 = $("annotZoom100");
  const annotClearAll = $("annotClearAll");
  const annotFullWrap = $("annotFullWrap");
  const annotFullBaseImg = $("annotFullBase");

  const enhPreviewBtn = $("enhPreviewBtn");
  const enhRunBtn = $("enhRunBtn");
  const enhStatus = $("enhStatus");
  const enhQuality = $("enhQuality");

  /* --------- NATURAL (HIDDEN) CANVAS that stores high-res image --------- */
  const naturalCanvas = document.createElement("canvas");
  const naturalCtx = naturalCanvas.getContext("2d");
  let naturalFile = null; // File object if user loaded one

  /* --------- ACTION MODEL & TOOL STATE (Modal is authoritative) --------- */
  let actions = []; // array of action objects
  let redoStack = [];
  let activeTool = null;

  /* --------- UTILS: safe element checks --------- */
  function safeGet(el, fallback){ return el || fallback; }

  /* --------- LOAD DEFAULT IMAGE (from existing <img> src in HTML) --------- */
  async function loadDefaultFromImg(imgEl){
    if(!imgEl || !imgEl.src) return;
    const url = imgEl.src;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    await img.decode().catch(()=>{});
    naturalCanvas.width = img.naturalWidth;
    naturalCanvas.height = img.naturalHeight;
    naturalCtx.clearRect(0,0,naturalCanvas.width,naturalCanvas.height);
    naturalCtx.drawImage(img,0,0);
  }

  // initialize from the current beforeImg src
  loadDefaultFromImg(beforeImg).catch(()=>{});

  /* --------- IMAGE INPUT / DROP HANDLING --------- */
  async function handleFileLoad(file){
    if(!file) return;
    naturalFile = file;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode().catch(()=>{});
    naturalCanvas.width = img.naturalWidth;
    naturalCanvas.height = img.naturalHeight;
    naturalCtx.clearRect(0,0,naturalCanvas.width,naturalCanvas.height);
    naturalCtx.drawImage(img,0,0);
    // set preview imgs (before/after) to same file
    beforeImg.src = url;
    afterImg.src = url;
    if(enhFileInfo) enhFileInfo.textContent = `${file.name} — ${img.naturalWidth}×${img.naturalHeight}px`;
    URL.revokeObjectURL(url);
    actions = []; redoStack = [];
    syncInlineToModal();
    refreshSplit();
    if(enhStatus) enhStatus.textContent = "Image loaded.";
  }

  if(enhanceInput){
    enhanceInput.addEventListener("change", e=>{
      const f = e.target.files && e.target.files[0];
      if(f) handleFileLoad(f);
    });
  }
  if(dropEnhance){
    dropEnhance.addEventListener("dragover", e=> { e.preventDefault(); dropEnhance.classList.add("dragover"); });
    dropEnhance.addEventListener("dragleave", e=> { dropEnhance.classList.remove("dragover"); });
    dropEnhance.addEventListener("drop", e=>{
      e.preventDefault(); dropEnhance.classList.remove("dragover");
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if(f) handleFileLoad(f);
    });
    // click to open file
    dropEnhance.addEventListener("click", ()=> { if(enhanceInput) enhanceInput.click(); });
  }

  /* --------- SPLIT SLIDER LOGIC --------- */
  let splitPos = 0.5;
  function refreshSplit(){
    if(!splitContainer || !splitAfter || !splitHandle) return;
    const W = splitContainer.clientWidth || splitContainer.offsetWidth;
    const handleX = Math.max(0, Math.min(W, Math.round(splitPos * W)));
    splitAfter.style.width = handleX + "px";
    // place handle centered on handleX
    const handleHalf = splitHandle.offsetWidth ? splitHandle.offsetWidth/2 : 12;
    splitHandle.style.left = Math.max(0, handleX - handleHalf) + "px";
    // sync inline canvas size/position
    ensureSplitAnnotCanvasSize();
    drawInlineFromActions();
  }
  refreshSplit();

  let isSliding = false;
  on(splitHandle, "mousedown", ()=> isSliding = true);
  document.addEventListener("mouseup", ()=> isSliding = false);
  document.addEventListener("mousemove", e=>{
    if(!isSliding || !splitContainer) return;
    const r = splitContainer.getBoundingClientRect();
    splitPos = (e.clientX - r.left) / Math.max(1, r.width);
    splitPos = Math.max(0.02, Math.min(0.98, splitPos));
    refreshSplit();
  });

  // make responsive
  window.addEventListener("resize", refreshSplit);

  /* --------- INLINE SPLIT CANVAS (preview overlay) --------- */
  function ensureSplitAnnotCanvasSize(){
    if(!splitAnnotCanvas || !splitContainer) return;
    const rect = splitContainer.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const w = Math.max(20, Math.floor(rect.width));
    const h = Math.max(20, Math.floor(rect.height));
    splitAnnotCanvas.style.width = w + "px";
    splitAnnotCanvas.style.height = h + "px";
    splitAnnotCanvas.width = Math.floor(w * ratio);
    splitAnnotCanvas.height = Math.floor(h * ratio);
    const ctx = splitAnnotCanvas.getContext("2d");
    ctx.setTransform(ratio,0,0,ratio,0,0);
  }
  ensureSplitAnnotCanvasSize();

  /* --------- MODAL ANNOTATOR (primary) --------- */
  // ensure modal canvas size equals its container
  function ensureModalCanvasSize(){
    if(!annotFullCanvas || !annotFullWrap) return;
    const rect = annotFullWrap.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const w = Math.max(100, Math.floor(rect.width));
    const h = Math.max(100, Math.floor(rect.height));
    annotFullCanvas.style.width = w + "px";
    annotFullCanvas.style.height = h + "px";
    annotFullCanvas.width = Math.floor(w * ratio);
    annotFullCanvas.height = Math.floor(h * ratio);
    const ctx = annotFullCanvas.getContext("2d");
    ctx.setTransform(ratio,0,0,ratio,0,0);
    drawModalFromActions();
  }
  window.addEventListener("resize", ensureModalCanvasSize);
  ensureModalCanvasSize();

  /* --------- Drawing helpers (used by both modal and inline replay) --------- */
  function drawActionOn(ctx, action){
    if(!ctx || !action) return;
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const color = action.color || (annotColor ? annotColor.value : "#ff7a3c");
    const size = (action.size || (annotSize ? parseInt(annotSize.value||4) : 4));
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(1, size);

    if(action.tool === "rect"){
      ctx.setLineDash([6,6]);
      ctx.strokeRect(action.x, action.y, action.x2 - action.x, action.y2 - action.y);
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.12;
      ctx.fillRect(action.x, action.y, action.x2 - action.x, action.y2 - action.y);
      ctx.globalAlpha = 1;
    } else if(action.tool === "highlight"){
      ctx.globalAlpha = 0.25;
      ctx.fillRect(action.x, action.y, action.x2 - action.x, action.y2 - action.y);
      ctx.globalAlpha = 1;
    } else if(action.tool === "blur"){
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(action.x, action.y, action.x2 - action.x, action.y2 - action.y);
      ctx.globalAlpha = 1;
      ctx.setLineDash([6,4]);
      ctx.strokeRect(action.x, action.y, action.x2 - action.x, action.y2 - action.y);
      ctx.setLineDash([]);
    } else if(action.tool === "arrow"){
      ctx.beginPath();
      ctx.moveTo(action.x, action.y);
      ctx.lineTo(action.x2, action.y2);
      ctx.stroke();
      // arrow head
      const ang = Math.atan2(action.y2 - action.y, action.x2 - action.x);
      const headlen = Math.max(8, ctx.lineWidth * 2.2);
      ctx.beginPath();
      ctx.moveTo(action.x2, action.y2);
      ctx.lineTo(action.x2 - headlen * Math.cos(ang - Math.PI/7), action.y2 - headlen * Math.sin(ang - Math.PI/7));
      ctx.lineTo(action.x2 - headlen * Math.cos(ang + Math.PI/7), action.y2 - headlen * Math.sin(ang + Math.PI/7));
      ctx.closePath();
      ctx.fill();
    } else if(action.tool === "text"){
      const s = Math.max(12, (action.size || 4) * 3);
      ctx.font = `${s}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = color;
      ctx.fillText(action.text || "", action.x, action.y);
    } else if(action.tool === "free"){
      const pts = action.pts || [];
      if(pts.length){
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* --------- Modal drawing (primary editor) --------- */
  let modalIsDrawing = false;
  let modalStartX = 0, modalStartY = 0;
  function modalPointerDown(e){
    if(!annotFullCanvas) return;
    if(!activeTool) return;
    modalIsDrawing = true;
    const r = annotFullCanvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    modalStartX = x; modalStartY = y;
    const color = annotColor ? annotColor.value : "#ff7a3c";
    const size = annotSize ? parseInt(annotSize.value||4) : 4;

    if(activeTool === "text"){
      const txt = prompt("Enter text:");
      if(txt){
        actions.push({ tool:"text", x, y, x2:x, y2:y, text: txt, color, size });
      }
      modalIsDrawing = false;
      drawModalFromActions();
      drawInlineFromActions();
      return;
    }

    if(activeTool === "free"){
      actions.push({ tool:"free", pts:[{x,y}], color, size });
    } else {
      actions.push({ tool:activeTool, x, y, x2:x, y2:y, color, size });
    }
    drawModalFromActions();
  }
  function modalPointerMove(e){
    if(!modalIsDrawing) return;
    const r = annotFullCanvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const cur = actions[actions.length - 1];
    if(!cur) return;
    if(cur.tool === "free") cur.pts.push({x,y});
    else { cur.x2 = x; cur.y2 = y; }
    drawModalFromActions();
  }
  function modalPointerUp(e){
    if(modalIsDrawing){
      modalIsDrawing = false;
      drawModalFromActions();
      drawInlineFromActions();
    }
  }
  if(annotFullCanvas){
    // mouse
    on(annotFullCanvas, "mousedown", modalPointerDown);
    on(document, "mousemove", modalPointerMove);
    on(document, "mouseup", modalPointerUp);
    // touch
    on(annotFullCanvas, "touchstart", (ev)=> { ev.preventDefault(); modalPointerDown(ev.touches[0]); });
    on(document, "touchmove", (ev)=> { if(modalIsDrawing) modalPointerMove(ev.touches[0]); }, {passive:false});
    on(document, "touchend", modalPointerUp);
  }

  /* --------- Redraw modal and inline from actions --------- */
  function drawModalFromActions(){
    if(!annotFullCanvas) return;
    ensureModalCanvasSize();
    const ctx = annotFullCanvas.getContext("2d");
    const w = annotFullCanvas.width / (window.devicePixelRatio || 1);
    const h = annotFullCanvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0,0,w,h);
    // draw background (preview of current natural image scaled to fit modal canvas)
    if(naturalCanvas.width && annotFullBaseImg && annotFullBaseImg.src){
      // draw the modal preview image: fit natural to modal area while preserving aspect
      const img = new Image();
      img.src = annotFullBaseImg.src;
      img.onload = () => {
        // draw image to fit container
        ctx.clearRect(0,0,w,h);
        const sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
        // calculate fit (contain)
        const ratioImg = sw/sh, ratioBox = w/h;
        let dw, dh, dx, dy;
        if(ratioImg > ratioBox){
          dw = w; dh = Math.round(w / ratioImg); dx = 0; dy = Math.round((h - dh)/2);
        } else {
          dh = h; dw = Math.round(h * ratioImg); dy = 0; dx = Math.round((w - dw)/2);
        }
        ctx.drawImage(img, 0, 0, sw, sh, dx, dy, dw, dh);
        // we do NOT persist the background into actions; annotations are on top
        actions.forEach(a => drawActionOn(ctx, a));
      };
    } else {
      ctx.clearRect(0,0,w,h);
      actions.forEach(a => drawActionOn(ctx, a));
    }
  }

  function drawInlineFromActions(){
    if(!splitAnnotCanvas || !splitContainer) return;
    ensureSplitAnnotCanvasSize();
    const ctx = splitAnnotCanvas.getContext("2d");
    const w = splitAnnotCanvas.width / (window.devicePixelRatio || 1);
    const h = splitAnnotCanvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0,0,w,h);
    // draw actions scaled to inline canvas from modal display coordinates
    // We must map modal-display coords -> inline-display coords.
    // For simplicity: actions were recorded in modal-display coords; we'll assume modal and inline are similarly proportional.
    // We scale relative to modal size vs inline size.
    const modalRect = annotFullCanvas ? annotFullCanvas.getBoundingClientRect() : { width: w, height: h };
    const scaleX = (w) / Math.max(1, modalRect.width);
    const scaleY = (h) / Math.max(1, modalRect.height);

    actions.forEach(a=>{
      // clone and transform
      const aa = JSON.parse(JSON.stringify(a));
      if(aa.x !== undefined){ aa.x = aa.x * scaleX; aa.y = aa.y * scaleY; }
      if(aa.x2 !== undefined){ aa.x2 = aa.x2 * scaleX; aa.y2 = aa.y2 * scaleY; }
      if(aa.pts){
        aa.pts = aa.pts.map(p => ({ x: p.x * scaleX, y: p.y * scaleY }));
      }
      drawActionOn(ctx, aa);
    });
  }

  /* --------- TOOLBAR (modal tool buttons) --------- */
  document.querySelectorAll(".annot-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      document.querySelectorAll(".annot-btn").forEach(x=>x.classList.remove("active"));
      btn.classList.add("active");
      activeTool = btn.dataset ? btn.dataset.tool : btn.getAttribute("data-tool");
    });
  });

  /* Undo / Clear */
  on($("annotUndo"), "click", ()=> {
    if(actions.length) redoStack.push(actions.pop());
    drawModalFromActions(); drawInlineFromActions();
  });
  on($("annotClear"), "click", ()=> { actions = []; redoStack = []; drawModalFromActions(); drawInlineFromActions(); });
  on($("annotClearAll"), "click", ()=> { actions = []; redoStack = []; drawModalFromActions(); drawInlineFromActions(); });

  /* Modal open */
  on($("openAnnotatorBtn"), "click", ()=> {
    if(annotModal) { annotModal.style.display = "flex"; ensureModalCanvasSize(); drawModalFromActions(); }
  });
  on($("miniApply"), "click", ()=> {
    // apply annotations into naturalCanvas and update After preview
    mergeAnnotationsIntoNatural();
    // set afterImg to new image
    afterImg.src = naturalCanvas.toDataURL("image/jpeg", 0.92);
    // clear actions (we consider them merged)
    actions = []; redoStack = [];
    drawModalFromActions(); drawInlineFromActions();
    if(enhStatus) enhStatus.textContent = "Annotations merged to After.";
  });

  /* Apply & Close (modal) */
  on(annotApply, "click", ()=>{
    if(annotModal) annotModal.style.display = "none";
    drawInlineFromActions();
  });

  /* --------- MERGE: annotations into naturalCanvas (high-res) --------- */
  function mergeAnnotationsIntoNatural(){
    if(!naturalCanvas.width) {
      // if no natural source loaded, try to create from beforeImg
      if(beforeImg && beforeImg.src){
        const tmp = new Image();
        tmp.src = beforeImg.src;
        // can't draw synchronously if not loaded; create & draw when loaded
        tmp.onload = () => {
          naturalCanvas.width = tmp.naturalWidth;
          naturalCanvas.height = tmp.naturalHeight;
          naturalCtx.clearRect(0,0,naturalCanvas.width,naturalCanvas.height);
          naturalCtx.drawImage(tmp,0,0);
          _mergeUsingScaling();
        };
        return;
      } else return;
    }
    _mergeUsingScaling();
  }

  function _mergeUsingScaling(){
    // draw current natural onto tmp then overlay shapes mapped from modal display coords -> natural pixel coords
    const tmp = document.createElement("canvas");
    tmp.width = naturalCanvas.width;
    tmp.height = naturalCanvas.height;
    const tctx = tmp.getContext("2d");
    tctx.drawImage(naturalCanvas, 0, 0);

    // modal display rect and natural size mapping:
    const modalRect = annotFullCanvas ? annotFullCanvas.getBoundingClientRect() : { width: tmp.width, height: tmp.height };
    const scaleX = tmp.width / Math.max(1, modalRect.width);
    const scaleY = tmp.height / Math.max(1, modalRect.height);

    actions.forEach(a=>{
      tctx.save();
      tctx.strokeStyle = a.color || (annotColor ? annotColor.value : "#ff7a3c");
      tctx.fillStyle = a.color || (annotColor ? annotColor.value : "#ff7a3c");
      tctx.lineWidth = Math.max(1, (a.size || (annotSize ? parseInt(annotSize.value||4) : 4)) * Math.max(scaleX, scaleY));
      if(a.tool === "rect"){
        tctx.strokeRect(a.x * scaleX, a.y * scaleY, (a.x2 - a.x) * scaleX, (a.y2 - a.y) * scaleY);
        tctx.globalAlpha = 0.12;
        tctx.fillRect(a.x * scaleX, a.y * scaleY, (a.x2 - a.x) * scaleX, (a.y2 - a.y) * scaleY);
        tctx.globalAlpha = 1;
      } else if(a.tool === "highlight"){
        tctx.globalAlpha = 0.25;
        tctx.fillRect(a.x * scaleX, a.y * scaleY, (a.x2 - a.x) * scaleX, (a.y2 - a.y) * scaleY);
        tctx.globalAlpha = 1;
      } else if(a.tool === "arrow"){
        tctx.beginPath();
        tctx.moveTo(a.x * scaleX, a.y * scaleY);
        tctx.lineTo(a.x2 * scaleX, a.y2 * scaleY);
        tctx.stroke();
        // arrow head
        const ang = Math.atan2((a.y2 - a.y) * scaleY, (a.x2 - a.x) * scaleX);
        const headlen = Math.max(8, tctx.lineWidth * 2.2);
        tctx.beginPath();
        tctx.moveTo(a.x2 * scaleX, a.y2 * scaleY);
        tctx.lineTo(a.x2 * scaleX - headlen * Math.cos(ang - Math.PI/7), a.y2 * scaleY - headlen * Math.sin(ang - Math.PI/7));
        tctx.lineTo(a.x2 * scaleX - headlen * Math.cos(ang + Math.PI/7), a.y2 * scaleY - headlen * Math.sin(ang + Math.PI/7));
        tctx.fill();
      } else if(a.tool === "text"){
        const s = Math.max(12, (a.size || 4) * 3) * scaleX;
        tctx.font = `${s}px Inter, system-ui, sans-serif`;
        tctx.fillText(a.text || "", a.x * scaleX, a.y * scaleY);
      } else if(a.tool === "free"){
        const pts = a.pts || [];
        if(pts.length){
          tctx.beginPath();
          tctx.moveTo(pts[0].x * scaleX, pts[0].y * scaleY);
          for(let i=1;i<pts.length;i++) tctx.lineTo(pts[i].x * scaleX, pts[i].y * scaleY);
          tctx.stroke();
        }
      } else if(a.tool === "blur"){
        // extract region, blur, put back
        const rx = Math.round(Math.min(a.x, a.x2) * scaleX);
        const ry = Math.round(Math.min(a.y, a.y2) * scaleY);
        const rw = Math.max(1, Math.round(Math.abs(a.x2 - a.x) * scaleX));
        const rh = Math.max(1, Math.round(Math.abs(a.y2 - a.y) * scaleY));
        try {
          let region = tctx.getImageData(rx, ry, rw, rh);
          for(let p=0;p<6;p++) region = gaussianBlur(region);
          tctx.putImageData(region, rx, ry);
        } catch(err){
          console.warn("blur merge failed", err);
        }
      }
      tctx.restore();
    });

    // commit tmp to naturalCanvas
    naturalCtx.clearRect(0,0,naturalCanvas.width,naturalCanvas.height);
    naturalCtx.drawImage(tmp, 0, 0);
  }

  /* --------- gaussian blur (simple separable) --------- */
  function gaussianBlur(imgData){
    const w = imgData.width, h = imgData.height;
    const src = imgData.data;
    const tmp = new Uint8ClampedArray(src.length);
    const out = new Uint8ClampedArray(src.length);
    const kernel = [0.1201,0.2339,0.2920,0.2339,0.1201];
    const half = 2;
    // horiz
    for(let y=0;y<h;y++){
      for(let x=0;x<w;x++){
        let r=0,g=0,b=0,a=0;
        for(let k=-half;k<=half;k++){
          const xx = Math.min(w-1, Math.max(0, x+k));
          const idx = (y*w + xx)*4;
          const wt = kernel[k+half];
          r += src[idx]*wt; g += src[idx+1]*wt; b += src[idx+2]*wt; a += src[idx+3]*wt;
        }
        const o = (y*w + x)*4;
        tmp[o]=r; tmp[o+1]=g; tmp[o+2]=b; tmp[o+3]=a;
      }
    }
    // vert
    for(let x=0;x<w;x++){
      for(let y=0;y<h;y++){
        let r=0,g=0,b=0,a=0;
        for(let k=-half;k<=half;k++){
          const yy = Math.min(h-1, Math.max(0, y+k));
          const idx = (yy*w + x)*4;
          const wt = kernel[k+half];
          r += tmp[idx]*wt; g += tmp[idx+1]*wt; b += tmp[idx+2]*wt; a += tmp[idx+3]*wt;
        }
        const o = (y*w + x)*4;
        out[o] = Math.round(r); out[o+1] = Math.round(g); out[o+2] = Math.round(b); out[o+3] = Math.round(a);
      }
    }
    imgData.data.set(out);
    return imgData;
  }

  /* --------- Preview & Enhance actions --------- */
  on(enhPreviewBtn, "click", ()=>{
    // quick preview: use naturalCanvas (original) as JPEG for afterImg
    if(naturalCanvas.width){
      afterImg.src = naturalCanvas.toDataURL("image/jpeg", (enhQuality ? parseInt(enhQuality.value)/100 : 0.92));
      if(enhStatus) enhStatus.textContent = "Preview updated.";
    } else {
      if(enhStatus) enhStatus.textContent = "No image loaded.";
      alert("Load an image first.");
    }
  });

  on(enhRunBtn, "click", ()=>{
    // in this build we consider "Enhance & Download" as: merge annotations (if any) then download naturalCanvas as jpeg
    mergeAnnotationsIntoNatural();
    const out = naturalCanvas.toDataURL("image/jpeg", (enhQuality ? parseInt(enhQuality.value)/100 : 0.92));
    const a = document.createElement("a");
    a.href = out;
    a.download = naturalFile ? (naturalFile.name.replace(/\.[^/.]+$/,"") + "_enh.jpg") : "enhanced.jpg";
    document.body.appendChild(a);
    a.click();
    a.remove();
    if(enhStatus) enhStatus.textContent = "Downloaded.";
  });

  /* --------- Sync Helpers --------- */
  // On init, draw inline using any existing actions (likely none)
  function syncInlineToModal(){
    drawModalFromActions();
    drawInlineFromActions();
  }
  syncInlineToModal();

  /* expose debug on window (optional) */
  window.__MM = {
    actions,
    naturalCanvas,
    refreshSplit,
    mergeAnnotationsIntoNatural,
    drawModalFromActions,
    drawInlineFromActions
  };

  // initial ensure sizes & draw
  setTimeout(() => { ensureModalCanvasSize(); ensureSplitAnnotCanvasSize(); refreshSplit(); }, 80);

})();

