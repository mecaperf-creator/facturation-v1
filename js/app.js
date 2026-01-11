
const screen = document.getElementById('screen');
const progress = document.getElementById('progress');
const BRAND_MODELS = {"PEUGEOT": ["108", "208", "308", "2008", "3008", "508", "Partner", "Expert", "Boxer"], "CITROËN": ["C1", "C3", "C4", "C5", "Berlingo", "Jumpy", "Jumper", "DS3"], "RENAULT": ["Clio", "Mégane", "Captur", "Scénic", "Twingo", "Kangoo", "Trafic", "Master"], "VOLKSWAGEN": ["Polo", "Golf", "Passat", "Tiguan", "Touran", "Transporter"], "AUDI": ["A1", "A3", "A4", "A6", "Q2", "Q3", "Q5"], "BMW": ["Série 1", "Série 3", "Série 5", "X1", "X3", "X5"], "MERCEDES": ["Classe A", "Classe B", "Classe C", "Classe E", "GLA", "GLC", "Vito", "Sprinter"], "FORD": ["Fiesta", "Focus", "Puma", "Kuga", "Transit", "Tourneo"], "OPEL": ["Corsa", "Astra", "Mokka", "Insignia", "Vivaro"], "TOYOTA": ["Yaris", "Corolla", "C-HR", "RAV4", "Proace"], "NISSAN": ["Micra", "Qashqai", "Juke", "X-Trail", "NV200"], "HYUNDAI": ["i10", "i20", "i30", "Tucson", "Kona"], "KIA": ["Picanto", "Rio", "Ceed", "Sportage", "Niro"], "SKODA": ["Fabia", "Octavia", "Superb", "Kodiaq", "Kamiq"], "SEAT": ["Ibiza", "Leon", "Arona", "Ateca"], "FIAT": ["500", "Panda", "Tipo", "Ducato"], "TESLA": ["Model 3", "Model Y", "Model S", "Model X"], "AUTRE": []};

const DEFAULT_STATE = {
  vehicule: { immat:'', immat_raw:'', km:'', marque:'', modele:'', mecano:'' },
  controles: { points100_done:false, photo_points100_id:null },
  or_a5: { photo_a5_id:null, ocr_text:'' },
  bl: { required:false, photo_bl_ids:[], ocr_text:'' },
};

let state = JSON.parse(JSON.stringify(DEFAULT_STATE));
let stepIndex = 0;

const steps = [
  'immat','immat_confirm','km','marque','modele','mecano',
  'points100','photo_points100',
  'photo_a5','ocr_a5',
  'pieces_question','photo_bl','ocr_bl',
  'recap'
];

function setProgress() {
  progress.textContent = `Étape ${stepIndex+1}/${steps.length}`;
}

function renderCard(innerHtml) {
  screen.innerHTML = `<div class="card">${innerHtml}</div>`;
}

function showError(msg) {
  const el = document.createElement('div');
  el.className = 'error';
  el.textContent = msg;
  screen.appendChild(el);
}

function next() {
  stepIndex = Math.min(stepIndex + 1, steps.length - 1);
  persist();
  render();
}
function back() {
  stepIndex = Math.max(stepIndex - 1, 0);
  persist();
  render();
}

// ✅ Normalisation SIV FR : AA-123-AA
function normalizeImmat(v) {
  // Normalisation SIV FR : AA-123-AA
  const raw = (v || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  const siv = /^([A-Z]{2})([0-9]{3})([A-Z]{2})$/;
  const m = raw.match(siv);
  if (!m) return null;

  return `${m[1]}-${m[2]}-${m[3]}`;
}

function uid(prefix='f') {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(16).slice(2);
}

async function persist() {
  await saveState({ state, stepIndex });
}

async function restore() {
  const saved = await loadState();
  if(saved && saved.state) {
    state = saved.state;
    stepIndex = saved.stepIndex || 0;
  }
}

async function getFileBlob(fileId) {
  return await idbGet('files', fileId);
}
async function setFileBlob(fileId, blob) {
  await idbSet('files', fileId, blob);
}

async function renderThumb(fileId) {
  if(!fileId) return '';
  const blob = await getFileBlob(fileId);
  if(!blob) return '';
  const url = URL.createObjectURL(blob);
  return `<img class="thumb" src="${url}" alt="photo"/>`;
}

function cameraInputHtml(acceptMultiple=false) {
  const multiple = acceptMultiple ? 'multiple' : '';
  return `
    <input id="cam" type="file" accept="image/*" ${multiple} capture="environment" />
    <div class="small">Astuce : si la caméra ne s’ouvre pas, choisis “Appareil photo”.</div>
  `;
}

async function handleSinglePhoto(targetKey) {
  const input = document.getElementById('cam');
  if(!input.files || input.files.length === 0) return;
  const file = input.files[0];
  const id = uid(targetKey);
  await setFileBlob(id, file);
  if(targetKey === 'points100') state.controles.photo_points100_id = id;
  if(targetKey === 'a5') state.or_a5.photo_a5_id = id;
  await persist();
  render();
}

async function handleMultiPhotoBL() {
  const input = document.getElementById('cam');
  if(!input.files || input.files.length === 0) return;
  for (const file of input.files) {
    const id = uid('bl');
    await setFileBlob(id, file);
    state.bl.photo_bl_ids.push(id);
  }
  await persist();
  render();
}

async function shareToDriveSingle(label, fileId) {
  if(!fileId) return alert('Aucune photo à partager.');
  const blob = await getFileBlob(fileId);
  if(!blob) return alert('Photo introuvable.');

  const filename = `${state.vehicule.immat || 'vehicule'}_${label}.jpg`;
  const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });

  if(navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({
      title: 'Envoyer sur Google Drive',
      text: 'Choisir Google Drive dans la liste.',
      files: [file]
    });
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    alert("Partage direct non disponible ici. Le fichier a été téléchargé : vous pouvez ensuite l'envoyer dans Google Drive.");
  }
}

async function shareToDriveBLAll() {
  const ids = state.bl.photo_bl_ids || [];
  if(ids.length === 0) return alert('Aucune photo BL à partager.');

  const files = [];
  for (let i=0; i<ids.length; i++) {
    const blob = await getFileBlob(ids[i]);
    if(!blob) continue;
    const filename = `${state.vehicule.immat || 'vehicule'}_BL_${String(i+1).padStart(2,'0')}.jpg`;
    files.push(new File([blob], filename, { type: blob.type || 'image/jpeg' }));
  }

  if(navigator.share && navigator.canShare && navigator.canShare({ files })) {
    await navigator.share({
      title: 'Envoyer sur Google Drive',
      text: 'Choisir Google Drive dans la liste.',
      files
    });
  } else {
    alert("Partage multi-fichiers non disponible ici. Astuce : partage page par page, ou utilise Android/Chrome. On améliorera ensuite.");
  }
}

function badgeOk(cond) {
  return cond ? '<span class="badge ok">OK</span>' : '<span class="badge warn">À faire</span>';
}

function render() {
  setProgress();
  renderBottomBar();
  const step = steps[stepIndex];

  if(step === 'immat') {
    renderCard(`
      <h2>Immatriculation (obligatoire)</h2>
      <label>Immat</label>
      <input id="immat" placeholder="AB123CD ou AB-123-CD" value="${state.vehicule.immat_raw || state.vehicule.immat}"/>
      <div class="small">Format final : <b>AB-123-CD</b></div>
      <div class="actions">
        <button class="secondary" onclick="resetAll()">Nouveau dossier</button>
        <button onclick="saveImmat()">Suivant</button>
      </div>
    `);
  }

  else if(step === 'immat_confirm') {
    renderCard(`
      <h2>Validation immatriculation</h2>
      <div class="small">Format final :</div>
      <div style="font-size:28px;font-weight:900;letter-spacing:1px;margin:10px 0">${state.vehicule.immat || '—'}</div>
      <div class="small">Si c’est incorrect, clique sur “Modifier”.</div>
      <div class="actions">
        <button class="ghost" onclick="back()">Modifier</button>
        <button onclick="next()">Valider</button>
      </div>
    `);
  }

  else if(step === 'km') {
    renderCard(`
      <h2>Kilométrage (obligatoire)</h2>
      <label>KM</label>
      <input id="km" type="number" placeholder="128450" value="${state.vehicule.km}"/>
      <div class="actions">
        <button class="ghost" onclick="back()">Retour</button>
        <button onclick="saveKm()">Suivant</button>
      </div>
    `);
  }
  else if(step === 'marque') {
    const brandOptions = Object.keys(BRAND_MODELS).map(b => `<option value="${b}">${b}</option>`).join('');
    renderCard(`
      <h2>Marque (obligatoire)</h2>
      <label>Choisir la marque</label>
      <select id="marque" onchange="onBrandChange()">
        <option value="">— Sélectionner —</option>
        ${brandOptions}
      </select>
      <div id="marqueAutreWrap" style="display:none;margin-top:10px">
        <label>Marque (autre)</label>
        <input id="marqueAutre" placeholder="Ex: DACIA, VOLVO..." />
      </div>
      <div class="actions">
        <button class="ghost" onclick="back()">Retour</button>
        <button onclick="saveBrand()">Suivant</button>
      </div>
    `);

    const sel = document.getElementById('marque');
    sel.value = (state.vehicule.marque && BRAND_MODELS[state.vehicule.marque] !== undefined) ? state.vehicule.marque : (state.vehicule.marque ? 'AUTRE' : '');
    if(sel.value === 'AUTRE') {
      document.getElementById('marqueAutreWrap').style.display='block';
      document.getElementById('marqueAutre').value = state.vehicule.marque;
    }
  }
  else if(step === 'modele') {
    const brand = (state.vehicule.marque||'').toUpperCase();
    const models = BRAND_MODELS[brand] || [];
    const modelOptions = models.map(m => `<option value="${m}">${m}</option>`).join('');
    const useDropdown = models.length > 0 && brand !== 'AUTRE';

    renderCard(`
      <h2>Modèle (obligatoire)</h2>
      <div class="small">Marque : <b>${state.vehicule.marque || '—'}</b></div>
      ${useDropdown ? `
        <label>Choisir le modèle</label>
        <select id="modele">
          <option value="">— Sélectionner —</option>
          ${modelOptions}
        </select>
      ` : `
        <label>Modèle</label>
        <input id="modeleTxt" placeholder="Ex: Classe A, Duster..." value="${state.vehicule.modele}"/>
      `}
      <div class="actions">
        <button class="ghost" onclick="back()">Retour</button>
        <button onclick="saveModel(${useDropdown})">Suivant</button>
      </div>
    `);

    if(useDropdown) document.getElementById('modele').value = state.vehicule.modele || '';
  }
  else if(step === 'mecano') {
    renderCard(`
      <h2>Mécano (obligatoire)</h2>
      <button onclick="setMecano('SYLVAIN')">SYLVAIN</button>
      <button class="secondary" onclick="askOtherMecano()">AUTRE</button>
      <div class="small">Actuel : <b>${state.vehicule.mecano || '—'}</b></div>
      <div class="actions">
        <button class="ghost" onclick="back()">Retour</button>
        <button onclick="validateMecano()">Suivant</button>
      </div>
    `);
  }
  else if(step === 'points100') {
    renderCard(`
      <h2>100 points de contrôle</h2>
      <div class="small">Obligatoire : bouton + photo.</div>
      <div class="small">Statut : ${badgeOk(state.controles.points100_done)}</div>
      <button onclick="mark100()">✅ 100 points effectués (0,50 h)</button>
      <div class="actions">
        <button class="ghost" onclick="back()">Retour</button>
        <button onclick="goIf100()">Suivant</button>
      </div>
    `);
  }
  else if(step === 'photo_points100') {
    const ok = !!state.controles.photo_points100_id;
    renderCard(`
      <h2>Photo fiche 100 points (obligatoire)</h2>
      <div class="small">Statut : ${badgeOk(ok)}</div>
      <label>Prendre la photo</label>
      ${cameraInputHtml(false)}
      <div class="actions">
        <button class="ghost" onclick="back()">Retour</button>
        <button onclick="validatePhoto100()">Suivant</button>
      </div>
      <hr>
      <button class="secondary" onclick="shareToDriveSingle('100points', state.controles.photo_points100_id)">📤 Envoyer sur Google Drive</button>
      <div id="thumbWrap"></div>
    `);
    document.getElementById('cam').onchange = () => handleSinglePhoto('points100');
    (async()=>{
      document.getElementById('thumbWrap').innerHTML = await renderThumb(state.controles.photo_points100_id);
    })();
  }
  else if(step === 'photo_a5') {
    const ok = !!state.or_a5.photo_a5_id;
    renderCard(`
      <h2>Photo fiche A5 (obligatoire)</h2>
      <div class="small">Statut : ${badgeOk(ok)}</div>
      <label>Prendre la photo</label>
      ${cameraInputHtml(false)}
      <div class="actions">
        <button class="ghost" onclick="back()">Retour</button>
        <button onclick="validatePhotoA5()">Suivant</button>
      </div>
      <hr>
      <button class="secondary" onclick="shareToDriveSingle('A5', state.or_a5.photo_a5_id)">📤 Envoyer sur Google Drive</button>
      <div id="thumbWrap"></div>
    `);
    document.getElementById('cam').onchange = () => handleSinglePhoto('a5');
    (async()=>{
      document.getElementById('thumbWrap').innerHTML = await renderThumb(state.or_a5.photo_a5_id);
    })();
  }
  else if(step === 'ocr_a5') {
    renderCard(`
      <h2>Travaux (saisie rapide)</h2>
      <div class="small">OCR sera branché ensuite. Pour l’instant : saisir/corriger.</div>
      <label>Travaux / éléments montés</label>
      <textarea id="a5txt" placeholder="Ex: Triangle suspension G 1h\nTriangle suspension D 1h">${state.or_a5.ocr_text || ''}</textarea>
      <div class="actions">
        <button class="ghost" onclick="back()">Retour</button>
        <button onclick="saveA5Text()">Suivant</button>
      </div>
    `);
  }
  else if(step === 'pieces_question') {
    renderCard(`
      <h2>Pièces achetées ?</h2>
      <div class="small">Si NON : pas de BL requis.</div>
      <div class="row">
        <button onclick="setPieces(true)">Oui</button>
        <button class="secondary" onclick="setPieces(false)">Non</button>
      </div>
      <div class="actions">
        <button class="ghost" onclick="back()">Retour</button>
      </div>
    `);
  }
  else if(step === 'photo_bl') {
    const count = (state.bl.photo_bl_ids||[]).length;
    renderCard(`
      <h2>Photo BL fournisseur (obligatoire si pièces)</h2>
      <div class="small">Photos : <b>${count}</b></div>
      <label>Prendre 1 ou plusieurs pages</label>
      ${cameraInputHtml(true)}
      <div class="actions">
        <button class="ghost" onclick="back()">Retour</button>
        <button onclick="validatePhotoBL()">Suivant</button>
      </div>
      <hr>
      <button class="secondary" onclick="shareToDriveBLAll()">📤 Envoyer les BL sur Google Drive</button>
      <div id="thumbWrap"></div>
    `);
    document.getElementById('cam').onchange = () => handleMultiPhotoBL();
    (async()=>{
      const ids = state.bl.photo_bl_ids||[];
      if(ids.length>0) {
        document.getElementById('thumbWrap').innerHTML = await renderThumb(ids[0]) + (ids.length>1 ? `<div class="small">+ ${ids.length-1} autre(s) page(s)</div>` : '');
      }
    })();
  }
  else if(step === 'ocr_bl') {
    renderCard(`
      <h2>BL (saisie rapide)</h2>
      <div class="small">OCR sera branché ensuite. Pour l’instant : saisir/colle les lignes.</div>
      <label>Lignes BL</label>
      <textarea id="bltxt" placeholder="Ex: Plaquettes AR — 28,58 €">${state.bl.ocr_text || ''}</textarea>
      <div class="actions">
        <button class="ghost" onclick="back()">Retour</button>
        <button onclick="saveBLText()">Suivant</button>
      </div>
    `);
  }
  else if(step === 'recap') {
    renderCard(`
      <h2>Récap</h2>
      <div class="small">Véhicule : ${badgeOk(!!state.vehicule.modele && !!state.vehicule.mecano)}</div>
      <div class="small">100 points : ${badgeOk(!!state.controles.photo_points100_id)}</div>
      <div class="small">A5 : ${badgeOk(!!state.or_a5.photo_a5_id)}</div>
      <div class="small">BL requis : <b>${state.bl.required ? 'OUI' : 'NON'}</b></div>
      <div class="small">BL photos : <b>${(state.bl.photo_bl_ids||[]).length}</b></div>
      <hr>
      <pre>${JSON.stringify(state.vehicule, null, 2)}</pre>
      <div class="actions">
        <button class="ghost" onclick="back()">Retour</button>
        <button class="secondary" onclick="resetAll()">Nouveau dossier</button>
      </div>
    `);
  }
}

function saveImmat() {
  const v = normalizeImmat(document.getElementById('immat').value);
  if(!v) return showError('Immatriculation invalide. Format attendu : AB-123-CD');
  state.vehicule.immat = v;
  next();
}
function saveKm() {
  const v = (document.getElementById('km').value || '').trim();
  if(!v) return showError('Kilométrage obligatoire.');
  state.vehicule.km = v;
  next();
}
function onBrandChange() {
  const sel = document.getElementById('marque');
  document.getElementById('marqueAutreWrap').style.display = (sel.value === 'AUTRE') ? 'block' : 'none';
}
function saveBrand() {
  const sel = (document.getElementById('marque').value || '').trim();
  if(!sel) return showError('Marque obligatoire.');
  if(sel === 'AUTRE') {
    const other = (document.getElementById('marqueAutre').value || '').trim();
    if(!other) return showError('Merci d’indiquer la marque (autre).');
    state.vehicule.marque = other.toUpperCase();
  } else {
    state.vehicule.marque = sel;
  }
  state.vehicule.modele = '';
  next();
}
function saveModel(useDropdown) {
  let v = '';
  if(useDropdown) v = (document.getElementById('modele').value || '').trim();
  else v = (document.getElementById('modeleTxt').value || '').trim();
  if(!v) return showError('Modèle obligatoire.');
  state.vehicule.modele = v;
  next();
}
function setMecano(name) { state.vehicule.mecano = name; persist(); render(); }
function askOtherMecano() {
  const n = prompt('Prénom du mécano ?');
  if(n) state.vehicule.mecano = n.trim().toUpperCase();
  persist(); render();
}
function validateMecano() {
  if(!state.vehicule.mecano) return showError('Mécano obligatoire.');
  next();
}
function mark100() { state.controles.points100_done = true; persist(); render(); }
function goIf100() {
  if(!state.controles.points100_done) return showError('Merci de valider “100 points effectués”.');
  next();
}
function validatePhoto100() {
  if(!state.controles.photo_points100_id) return showError('Photo 100 points obligatoire.');
  next();
}
function validatePhotoA5() {
  if(!state.or_a5.photo_a5_id) return showError('Photo A5 obligatoire.');
  next();
}
function saveA5Text() {
  state.or_a5.ocr_text = (document.getElementById('a5txt').value || '');
  next();
}
function setPieces(val) {
  state.bl.required = val;
  if(val) stepIndex = steps.indexOf('photo_bl');
  else stepIndex = steps.indexOf('recap');
  persist(); render();
}
function validatePhotoBL() {
  if(state.bl.required && (!state.bl.photo_bl_ids || state.bl.photo_bl_ids.length===0)) {
    return showError('Photo BL obligatoire si pièces achetées = OUI.');
  }
  next();
}
function saveBLText() {
  state.bl.ocr_text = (document.getElementById('bltxt').value || '');
  next();
}

async function resetAll() {
  state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  stepIndex = 0;
  await resetAllStorage();
  await persist();
  render();
}

(async function init() {
  await restore();
  await persist();
  render();
})();

function renderBottomBar() {
  const bar = document.getElementById('bottomBar');
  if(!bar) return;
  bar.innerHTML = `
    <button class="ghost" onclick="resumeDraft()">🔁 Reprendre dossier</button>
    <button class="danger" onclick="resetAll()">➕ Nouveau dossier</button>
  `;
}
async function resumeDraft() {
  await restore();
  render();
}
