
(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const STORAGE_KEY = "factu_atelier_v1_regen";
  const BRANDS = {"AUDI": ["A1", "A3", "A4", "A5", "A6", "Q2", "Q3", "Q5", "Q7", "AUTRE"], "BMW": ["Série 1", "Série 2", "Série 3", "Série 4", "Série 5", "X1", "X3", "X5", "AUTRE"], "MERCEDES": ["Classe A", "Classe B", "Classe C", "Classe E", "GLA", "GLC", "AUTRE"], "PEUGEOT": ["108", "208", "2008", "308", "3008", "508", "AUTRE"], "RENAULT": ["Clio", "Captur", "Megane", "Scenic", "Kadjar", "Austral", "AUTRE"], "CITROEN": ["C1", "C3", "C4", "C5", "Berlingo", "AUTRE"], "VOLKSWAGEN": ["Polo", "Golf", "T-Roc", "Tiguan", "Passat", "AUTRE"], "TOYOTA": ["Yaris", "Corolla", "C-HR", "RAV4", "AUTRE"], "OPEL": ["Corsa", "Astra", "Mokka", "Grandland", "AUTRE"], "FORD": ["Fiesta", "Focus", "Puma", "Kuga", "AUTRE"], "AUTRE": ["AUTRE"]};

  const state = loadState();

  const steps = [
    { key: "immat",   title: "Immatriculation", render: renderImmat,   validate: validateImmat },
    { key: "km",      title: "Kilométrage",     render: renderKm,      validate: validateKm },
    { key: "marque",  title: "Marque",          render: renderMarque,  validate: validateMarque },
    { key: "modele",  title: "Modèle",          render: renderModele,  validate: validateModele },
    { key: "mecano",  title: "Mécano",          render: renderMecano,  validate: validateMecano },
    { key: "p100",    title: "100 points",      render: render100,     validate: validate100 },
    { key: "photos",  title: "Photos",          render: renderPhotos,  validate: validatePhotos },
    { key: "recap",   title: "Récap",           render: renderRecap,   validate: () => ({ ok:true }) },
  ];

  if (typeof state.stepIndex !== "number") state.stepIndex = 0;

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return freshState();
      const s = JSON.parse(raw);
      s.photos = s.photos || { a5:null, or:null, bl1:null };
      if(typeof s.stepIndex !== "number") s.stepIndex = 0;
      return s;
    }catch(e){
      return freshState();
    }
  }

  function freshState(){
    return {
      stepIndex: 0,
      immat_raw: "",
      immat: "",
      km: "",
      marque: "",
      modele: "",
      mecano: "SYLVAIN",
      p100_done: false,
      photos: { a5:null, or:null, bl1:null }
    };
  }

  function saveState(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function setStep(i){
    state.stepIndex = Math.max(0, Math.min(i, steps.length-1));
    saveState();
    render();
    window.scrollTo({top:0, behavior:"smooth"});
  }

  function newDossier(){
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }

  function resumeDossier(){
    render();
    window.scrollTo({top:0, behavior:"smooth"});
  }

  function safeText(v){ return (v ?? "").toString(); }

  function normalizeImmat(input){
    const s = safeText(input).toUpperCase().replace(/[^A-Z0-9]/g,"");
    const m = s.match(/^([A-Z]{2})(\d{3})([A-Z]{2})/);
    if(!m) return { formatted: "", ok:false };
    return { formatted: `${m[1]}-${m[2]}-${m[3]}`, ok:true };
  }

  function makeLayout(innerHtml){
    const stepNo = state.stepIndex + 1;
    const total = steps.length;
    return `
      <div class="container">
        <h1>Facturation Atelier</h1>
        <p class="sub">Étape ${stepNo}/${total}</p>
        <div class="card">${innerHtml}</div>
      </div>

      <div class="bottombar">
        <div class="inner">
          <button class="btn secondary" id="btnResume">Reprendre dossier</button>
          <button class="btn danger" id="btnNew">Nouveau dossier</button>
        </div>
      </div>
    `;
  }

  function render(){
    const step = steps[state.stepIndex];
    $("#app").innerHTML = makeLayout(step.render());
    hookBottomBar();
    hookStepCommon(step);
    hookStepSpecific(step);
  }

  function hookBottomBar(){
    $("#btnNew").addEventListener("click", () => {
      if(confirm("Créer un nouveau dossier ? (Cela efface les données locales)")){
        newDossier();
      }
    });
    $("#btnResume").addEventListener("click", resumeDossier);
  }

  function hookStepCommon(step){
    const btnPrev = $("#btnPrev");
    const btnNext = $("#btnNext");
    const errBox = $("#errBox");

    const update = () => {
      const res = step.validate();
      if(btnNext) btnNext.disabled = !res.ok;
      if(errBox){
        errBox.style.display = res.ok ? "none" : "block";
        errBox.textContent = res.ok ? "" : res.msg;
      }
    };

    if(btnPrev){
      btnPrev.addEventListener("click", () => setStep(state.stepIndex - 1));
    }
    if(btnNext){
      btnNext.addEventListener("click", () => {
        const res = step.validate();
        if(!res.ok){ update(); return; }
        if(step.key === "recap"){
          setStep(0);
          return;
        }
        setStep(state.stepIndex + 1);
      });
    }

    window.__stepUpdate = update;
    update();
  }

  function hookStepSpecific(step){
    if(step.key === "immat"){
      const el = $("#immat");
      if(el){
        el.addEventListener("input", () => {
          const n = normalizeImmat(el.value);
          state.immat_raw = el.value;
          state.immat = n.formatted;
          saveState();
          render(); // refresh badge
        });
      }
    }
    if(step.key === "km"){
      const el = $("#km");
      if(el){
        el.addEventListener("input", () => {
          const v = el.value.replace(/[^\d]/g,"");
          if(v !== el.value) el.value = v;
          state.km = v;
          saveState();
          window.__stepUpdate && window.__stepUpdate();
        });
      }
    }
    if(step.key === "marque"){
      const el = $("#marque");
      if(el){
        el.addEventListener("change", () => {
          const prev = state.marque;
          state.marque = el.value || "";
          if(state.marque !== prev) state.modele = "";
          saveState();
          window.__stepUpdate && window.__stepUpdate();
        });
      }
    }
    if(step.key === "modele"){
      const el = $("#modele");
      if(el){
        el.addEventListener("change", () => {
          state.modele = el.value || "";
          saveState();
          window.__stepUpdate && window.__stepUpdate();
        });
      }
    }
    if(step.key === "mecano"){
      const el = $("#mecano");
      if(el){
        el.addEventListener("change", () => {
          state.mecano = el.value || "SYLVAIN";
          saveState();
          window.__stepUpdate && window.__stepUpdate();
        });
      }
    }
    if(step.key === "p100"){
      const el = $("#p100");
      if(el){
        el.addEventListener("change", () => {
          state.p100_done = !!el.checked;
          saveState();
          window.__stepUpdate && window.__stepUpdate();
        });
      }
    }
    if(step.key === "photos"){
      ["a5","or","bl1"].forEach((k)=>{
        const input = $(`#photo_${k}`);
        if(input && !input.__bound){
          input.__bound = true;
          input.addEventListener("change", async () => {
            const file = input.files && input.files[0];
            if(!file) return;
            const dataUrl = await fileToDataUrl(file, 1400);
            state.photos[k] = dataUrl;
            saveState();
            render();
          });
        }
      });
    }
  }

  function btnBar(){
    const prevDisabled = state.stepIndex === 0 ? "disabled" : "";
    return `
      <div class="btnbar">
        <button class="btn secondary" id="btnPrev" ${prevDisabled}>Retour</button>
        <button class="btn primary" id="btnNext">Suivant</button>
      </div>
      <div class="error" id="errBox" style="display:none"></div>
    `;
  }

  function renderImmat(){
    return `
      <h2>Immatriculation</h2>
      <label>Immatriculation (obligatoire)</label>
      <input id="immat" placeholder="Ex: EV957NA ou EV-957-NA" value="${escapeHtml(state.immat_raw || "")}" />
      <div class="help">Format final : AA-123-AA. On met en majuscules automatiquement.</div>

      <div class="kv">
        <span class="badge gray">Actuel : <strong>${escapeHtml(state.immat || "—")}</strong></span>
      </div>

      ${btnBar()}
    `;
  }

  function validateImmat(){
    const el = $("#immat");
    if(el){
      state.immat_raw = el.value;
      const n = normalizeImmat(el.value);
      state.immat = n.formatted;
      saveState();
    }
    if(!state.immat){
      return { ok:false, msg:"Saisir une immatriculation valide (AA-123-AA)." };
    }
    return { ok:true };
  }

  function renderKm(){
    return `
      <h2>Kilométrage</h2>
      <label>Km (obligatoire)</label>
      <input id="km" inputmode="numeric" placeholder="Ex: 139634" value="${escapeHtml(state.km || "")}" />
      <div class="help">Saisir uniquement des chiffres.</div>
      ${btnBar()}
    `;
  }

  function validateKm(){
    const el = $("#km");
    if(el){
      const v = el.value.replace(/[^\d]/g,"");
      if(v !== el.value) el.value = v;
      state.km = v;
      saveState();
    }
    if(!state.km || state.km.length < 2){
      return { ok:false, msg:"Saisir un kilométrage." };
    }
    return { ok:true };
  }

  function renderMarque(){
    const options = Object.keys(BRANDS)
      .sort((a,b)=>a.localeCompare(b,"fr"))
      .map(b => `<option value="${escapeAttr(b)}" ${b===state.marque?"selected":""}>${escapeHtml(b)}</option>`)
      .join("");
    return `
      <h2>Marque</h2>
      <label>Choisir la marque</label>
      <select id="marque">
        <option value="" ${state.marque ? "" : "selected"}>—</option>
        ${options}
      </select>
      ${btnBar()}
    `;
  }

  function validateMarque(){
    const el = $("#marque");
    if(el){
      const prev = state.marque;
      state.marque = el.value || "";
      if(state.marque !== prev) state.modele = "";
      saveState();
    }
    if(!state.marque){
      return { ok:false, msg:"Sélectionner une marque." };
    }
    return { ok:true };
  }

  function renderModele(){
    const brand = state.marque || "";
    const models = BRANDS[brand] || ["AUTRE"];
    const options = models.map(m => `<option value="${escapeAttr(m)}" ${m===state.modele?"selected":""}>${escapeHtml(m)}</option>`).join("");
    return `
      <h2>Modèle</h2>
      <label>Choisir le modèle</label>
      <select id="modele">
        <option value="" ${state.modele ? "" : "selected"}>—</option>
        ${options}
      </select>
      ${btnBar()}
    `;
  }

  function validateModele(){
    const el = $("#modele");
    if(el){
      state.modele = el.value || "";
      saveState();
    }
    if(!state.modele){
      return { ok:false, msg:"Sélectionner un modèle." };
    }
    return { ok:true };
  }

  function renderMecano(){
    const v = state.mecano || "SYLVAIN";
    return `
      <h2>Mécano</h2>
      <label>Choisir le mécano</label>
      <select id="mecano">
        <option value="SYLVAIN" ${v==="SYLVAIN"?"selected":""}>SYLVAIN</option>
        <option value="AUTRE" ${v==="AUTRE"?"selected":""}>AUTRE</option>
      </select>
      ${btnBar()}
    `;
  }

  function validateMecano(){
    const el = $("#mecano");
    if(el){
      state.mecano = el.value || "SYLVAIN";
      saveState();
    }
    if(!state.mecano){
      return { ok:false, msg:"Sélectionner un mécano." };
    }
    return { ok:true };
  }

  function render100(){
    return `
      <h2>100 points de contrôle</h2>
      <label>
        <input id="p100" type="checkbox" ${state.p100_done ? "checked" : ""} />
        100 points effectués (obligatoire)
      </label>
      <div class="help">Cette étape est obligatoire pour continuer.</div>
      ${btnBar()}
    `;
  }

  function validate100(){
    const el = $("#p100");
    if(el){
      state.p100_done = !!el.checked;
      saveState();
    }
    if(!state.p100_done){
      return { ok:false, msg:"Cocher “100 points effectués”." };
    }
    return { ok:true };
  }

  function renderPhotos(){
    return `
      <h2>Photos</h2>
      <div class="help">iOS compatible : ouvre le sélecteur/caméra selon l’appareil.</div>
      ${photoRow("A5 (fiche)", "a5")}
      ${photoRow("OR (ordre de réparation)", "or")}
      ${photoRow("BL (page 1)", "bl1")}
      ${btnBar()}
    `;
  }

  function photoRow(label, key){
    const has = !!(state.photos && state.photos[key]);
    const preview = has ? `<img alt="preview" src="${state.photos[key]}" style="max-width:100%;border-radius:12px;border:1px solid var(--border);margin-top:8px" />` : "";
    return `
      <label>${escapeHtml(label)}</label>
      <input type="file" accept="image/*" capture="environment" id="photo_${escapeAttr(key)}" />
      <div class="help">${has ? "✅ Photo enregistrée" : "Aucune photo"}</div>
      ${preview}
      <div style="height:10px"></div>
    `;
  }

  function validatePhotos(){
    return { ok:true };
  }

  function renderRecap(){
    const photosCount = ["a5","or","bl1"].filter(k => state.photos && state.photos[k]).length;
    return `
      <h2>Récap</h2>
      <div class="kv">
        <span class="badge">Véhicule : OK</span>
        <span class="badge">${state.p100_done ? "100 points : OK" : "100 points : KO"}</span>
        <span class="badge gray">Photos : ${photosCount}/3</span>
      </div>
      <pre>${escapeHtml(JSON.stringify({
        immat: state.immat,
        km: state.km,
        marque: state.marque,
        modele: state.modele,
        mecano: state.mecano,
        p100_done: state.p100_done,
        photos: photosCount
      }, null, 2))}</pre>

      <div class="btnbar">
        <button class="btn secondary" id="btnPrev">Retour</button>
        <button class="btn primary" id="btnNext">Terminer</button>
      </div>
      <div class="help">“Terminer” revient à l’immatriculation (sans effacer).</div>
      <div class="error" id="errBox" style="display:none"></div>
    `;
  }

  async function fileToDataUrl(file, maxW){
    const img = await loadImage(file);
    const canvas = document.createElement("canvas");
    const ratio = img.width > maxW ? (maxW / img.width) : 1;
    canvas.width = Math.round(img.width * ratio);
    canvas.height = Math.round(img.height * ratio);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  }

  function loadImage(file){
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = reject;
      img.src = url;
    });
  }

  function escapeHtml(str){
    return safeText(str)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }
  function escapeAttr(str){
    return escapeHtml(str).replaceAll('"',"&quot;");
  }

  render();

})();
