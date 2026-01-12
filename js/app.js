(function(){
  'use strict';

  window.addEventListener('error', function(e){
    showFatal("Erreur JS: " + (e && e.message ? e.message : "inconnue"));
  });
  window.addEventListener('unhandledrejection', function(e){
    showFatal("Erreur Promise: " + (e && e.reason ? String(e.reason) : "inconnue"));
  });

  const STORAGE_KEY = 'FACTU_DOSSIER_V1_4_5';
  const TVA = 0.20;
  const TAUX_HORAIRE = 60.00;
  const MARGE_PIECES = 0.10;

  const DEFAULT_STATE = {
    version: '1.4.5',
    created_at: new Date().toISOString(),
    etape: 1,
    vehicule: { immat_raw:'', immat:'', km:'', marque:'', modele:'', mecano:'SYLVAIN' },
    controle100: { fait:false, photo:null },
    a5: { photo:null, texte:'' },
    bl: { photos: [], lignes:'' },
    divers: { autres_interventions:'' },
    facture: { lignes: [] }
  };

  let SAVED_STATE = null;


  const marques = [
    'AUDI','BMW','CITROEN','DACIA','FIAT','FORD','HONDA','HYUNDAI','KIA','MAZDA','MERCEDES','MINI','NISSAN',
    'OPEL','PEUGEOT','RENAULT','SEAT','SKODA','TOYOTA','VOLKSWAGEN','VOLVO','AUTRE'
  ];

  function structuredClone(obj){ return JSON.parse(JSON.stringify(obj)); }

  function loadState(){
    try{
      const s = localStorage.getItem(STORAGE_KEY);
      if(!s) { SAVED_STATE = null; return structuredClone(DEFAULT_STATE); }
      // On démarre toujours à l'étape 1 (immatriculation).
      // Le dossier précédent reste accessible via "Reprendre dossier".
      SAVED_STATE = Object.assign(structuredClone(DEFAULT_STATE), JSON.parse(s));
      return structuredClone(DEFAULT_STATE);
    }catch(e){
      SAVED_STATE = null;
      return structuredClone(DEFAULT_STATE);
    }
  }
  function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function resetState(){ state = structuredClone(DEFAULT_STATE); saveState(); render(); }

  function normalizeImmat(raw){
    const up = (raw||'').toUpperCase().replace(/\s+/g,'').replace(/-/g,'');
    const m = up.match(/^([A-Z]{2})(\d{3})([A-Z]{2})$/);
    if(m) return `${m[1]}-${m[2]}-${m[3]}`;
    return up;
  }

  function euro(n){
    const x = (Math.round((Number(n)||0)*100)/100).toFixed(2);
    return x.replace('.',',') + ' €';
  }
  function num2(n){ return (Math.round((Number(n)||0)*100)/100).toFixed(2); }

  function priceWithMargin(achatHT){
    return Math.round((Number(achatHT)*(1+MARGE_PIECES))*100)/100;
  }

  function showFatal(msg){
    const root = document.getElementById('app');
    if(!root) return;
    root.innerHTML = `
      <div class="container">
        <h1>Facturation Atelier</h1>
        <p class="sub">Erreur de chargement</p>
        <div class="card">
          <div class="pill no">Bloqué</div>
          <p style="margin-top:10px"><b>${escapeHtml(msg)}</b></p>
          <p class="small">Astuce : rafraîchir (⌘R) puis réessayer. Si ça persiste, envoyer une capture de la console.</p>
        </div>
      </div>`;
  }
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  async function ensureTesseract(){
    if(window.Tesseract) return window.Tesseract;
    await new Promise((resolve, reject)=>{
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.onload = resolve;
      script.onerror = ()=>reject(new Error('Impossible de charger Tesseract.js (réseau).'));
      document.head.appendChild(script);
    });
    return window.Tesseract;
  }
  async function runOCRFromFile(file){
    const T = await ensureTesseract();
    const { data } = await T.recognize(file, 'fra');
    return (data && data.text) ? data.text : '';
  }

  let state = loadState();

  function goto(n){
    state.etape = n;
    saveState();
    render();
    window.scrollTo({top:0, behavior:'smooth'});
  }
  function next(){ if(state.etape < 14) goto(state.etape + 1); }
  function prev(){ if(state.etape > 1) goto(state.etape - 1); }

  function vehicleOK(){
    const v = state.vehicule;
    return !!(v.immat && v.km && v.marque && v.modele && v.mecano);
  }
  function recapBadges(){
    return { vehicule: vehicleOK(), c100: state.controle100.fait, a5: !!state.a5.photo, blReq: true, blPhotos: state.bl.photos.length };
  }

  function render(){
    const root = document.getElementById('app');
    if(!root) return;
    const et = state.etape;
    root.innerHTML = `
      <div class="container">
        <h1>Facturation Atelier</h1>
        <p class="sub">Étape ${et}/14</p>
        ${renderStep(et)}
      </div>
      <div class="footerbar">
        <div class="inner">
          <button class="btn secondary" id="btnResume">Reprendre dossier</button>
          <button class="btn danger" id="btnNew">Nouveau dossier</button>
        </div>
      </div>
    `;
    document.getElementById('btnNew').addEventListener('click', resetState);
    document.getElementById('btnResume').addEventListener('click', ()=>goto(state.etape || 1));
    hookStep(et);
  }

  function renderStep(et){
    switch(et){
      case 1: return stepImmat();
      case 2: return stepKm();
      case 3: return stepMarque();
      case 4: return stepModele();
      case 5: return stepMecano();
      case 6: return stepControle100();
      case 7: return stepControlePhoto();
      case 8: return stepA5Photo();
      case 9: return stepA5Travaux();
      case 10:return stepAutres();
      case 11:return stepBLPhoto();
      case 12:return stepBLTexte();
      case 13:return stepGenerer();
      case 14:return stepRecap();
      default: return stepRecap();
    }
  }

  function navButtons(nextLabel='Suivant', prevLabel='Retour', canNext=true){
    return `
      <div class="btnbar">
        <button class="btn secondary" id="btnPrev">${prevLabel}</button>
        <button class="btn" id="btnNext" ${canNext?'':'disabled style="opacity:.5;cursor:not-allowed"'}>${nextLabel}</button>
      </div>`;
  }

  function stepImmat(){
    return `
      <div class="card">
        <h2 style="margin:0 0 8px">Immatriculation</h2>
        <div class="small">Format final automatique : AA-123-AA. Tu valides ensuite.</div>
        <label>Immat (saisie libre)</label>
        <input id="immat" placeholder="ex: ev957na ou EV-957-NA" value="${escapeHtml(state.vehicule.immat_raw || '')}" />
        <label>Immat proposée</label>
        <input id="immatFmt" disabled value="${escapeHtml(state.vehicule.immat || '')}" />
        ${navButtons('Valider', 'Retour', true)}
      </div>`;
  }
  function stepKm(){
    return `
      <div class="card">
        <h2 style="margin:0 0 8px">Kilométrage</h2>
        <label>Km</label>
        <input id="km" inputmode="numeric" placeholder="ex: 139634" value="${escapeHtml(state.vehicule.km || '')}" />
        ${navButtons('Suivant', 'Retour', true)}
      </div>`;
  }
  function stepMarque(){
    const opts = marques.map(m=>`<option ${state.vehicule.marque===m?'selected':''} value="${m}">${m}</option>`).join('');
    return `
      <div class="card">
        <h2 style="margin:0 0 8px">Marque</h2>
        <label>Choisir la marque</label>
        <select id="marque">${opts}</select>
        ${navButtons('Suivant', 'Retour', !!state.vehicule.marque)}
      </div>`;
  }
  function stepModele(){
    return `
      <div class="card">
        <h2 style="margin:0 0 8px">Modèle</h2>
        <label>Modèle</label>
        <input id="modele" placeholder="ex: Classe A / Série 1 / 308…" value="${escapeHtml(state.vehicule.modele || '')}" />
        ${navButtons('Suivant', 'Retour', !!state.vehicule.modele)}
      </div>`;
  }
  function stepMecano(){
    const cur = state.vehicule.mecano || 'SYLVAIN';
    return `
      <div class="card">
        <h2 style="margin:0 0 8px">Mécano</h2>
        <div class="row">
          <button class="btn dark" id="mSyl" style="flex:1">${cur==='SYLVAIN'?'✅ ':''}SYLVAIN</button>
          <button class="btn secondary" id="mAutre" style="flex:1">${cur!=='SYLVAIN'?'✅ ':''}AUTRE</button>
        </div>
        <div id="autreWrap" class="${cur==='SYLVAIN'?'hidden':''}">
          <label>Prénom (autre)</label>
          <input id="mecanoAutre" value="${escapeHtml(cur==='SYLVAIN'?'':cur)}" placeholder="ex: THELMA" />
        </div>
        ${navButtons('Suivant', 'Retour', !!state.vehicule.mecano)}
      </div>`;
  }
  function stepControle100(){
    return `
      <div class="card">
        <h2 style="margin:0 0 8px">100 points de contrôle</h2>
        <div class="photo">
          <div>
            <div><b>Contrôle 100 points effectué</b></div>
            <div class="small">À facturer : 0,50 h au taux horaire (${num2(TAUX_HORAIRE)} €/h).</div>
          </div>
          <label style="display:flex;align-items:center;gap:10px;margin:0">
            <input type="checkbox" id="c100" ${state.controle100.fait?'checked':''} />
            Oui
          </label>
        </div>
        ${navButtons('Suivant', 'Retour', state.controle100.fait)}
      </div>`;
  }
  function stepControlePhoto(){
    const has = !!state.controle100.photo;
    return `
      <div class="card">
        <h2 style="margin:0 0 8px">Photo fiche 100 points (archive)</h2>
        <div class="small">Optionnel pour l’instant, mais recommandé.</div>
        <div class="btnbar">
          <label class="btn dark" style="flex:1;text-align:center">
            📷 Ajouter photo
            <input class="hidden" id="photoC100" type="file" accept="image/*" capture="environment">
          </label>
          <button class="btn secondary" id="btnClearC100" style="flex:1" ${has?'':'disabled style="opacity:.5"'}>Supprimer</button>
        </div>
        <div class="small" style="margin-top:10px">${has?'✅ Photo ajoutée':'Aucune photo'}</div>
        ${navButtons('Suivant', 'Retour', true)}
      </div>`;
  }
  function stepA5Photo(){
    const has = !!state.a5.photo;
    return `
      <div class="card">
        <h2 style="margin:0 0 8px">Photo OR A5</h2>
        <div class="btnbar">
          <label class="btn dark" style="flex:1;text-align:center">
            📷 Ajouter photo A5
            <input class="hidden" id="photoA5" type="file" accept="image/*" capture="environment">
          </label>
          <button class="btn secondary" id="btnClearA5" style="flex:1" ${has?'':'disabled style="opacity:.5"'}>Supprimer</button>
        </div>

        <div style="margin-top:12px" class="photo">
          <div>
            <div><b>OCR (optionnel)</b></div>
            <div class="small">Ne bloque jamais l’app. Nécessite Internet.</div>
          </div>
          <label class="btn dark" style="margin:0;flex:1;text-align:center">
            🔎 OCR sur A5
            <input class="hidden" id="ocrA5File" type="file" accept="image/*">
          </label>
        </div>

        <div class="small" style="margin-top:10px">${has?'✅ Photo A5 ajoutée':'Aucune photo A5'}</div>
        ${navButtons('Suivant', 'Retour', has)}
      </div>`;
  }
  function stepA5Travaux(){
    return `
      <div class="card">
        <h2 style="margin:0 0 8px">Travaux / éléments montés</h2>
        <div class="small">Saisir/corriger. L’OCR peut remplir ce champ.</div>
        <label>Travaux</label>
        <textarea id="a5txt" placeholder="Ex:\nTriangle suspension G 1h\nTriangle suspension D 1h\nPlaquettes AR\nBalais AV/AR">${escapeHtml(state.a5.texte||'')}</textarea>
        ${navButtons('Suivant', 'Retour', true)}
      </div>`;
  }
  function stepAutres(){
    return `
      <div class="card">
        <h2 style="margin:0 0 8px">Autre intervention (optionnel)</h2>
        <div class="small">Ex: démontage accessoires, faisceau, permutation pneus, etc.</div>
        <textarea id="autres" placeholder="Décris ici si besoin…">${escapeHtml(state.divers.autres_interventions||'')}</textarea>
        ${navButtons('Suivant', 'Retour', true)}
      </div>`;
  }
  function stepBLPhoto(){
    const c = state.bl.photos.length;
    return `
      <div class="card">
        <h2 style="margin:0 0 8px">Photos BL / factures pièces</h2>
        <div class="small">Tu peux ajouter plusieurs pages. (BL = pièces achetées)</div>

        <div class="btnbar">
          <label class="btn dark" style="flex:1;text-align:center">
            📷 Ajouter BL (page)
            <input class="hidden" id="photoBL" type="file" accept="image/*" capture="environment" multiple>
          </label>
          <button class="btn secondary" id="btnClearBL" style="flex:1" ${c?'' :'disabled style="opacity:.5"'}>Tout supprimer</button>
        </div>

        <div style="margin-top:12px" class="photo">
          <div>
            <div><b>OCR (optionnel)</b></div>
            <div class="small">OCR sur la 1ère page BL, puis coller/corriger dans “Lignes BL”.</div>
          </div>
          <label class="btn dark" style="margin:0;flex:1;text-align:center">
            🔎 OCR sur BL
            <input class="hidden" id="ocrBLFile" type="file" accept="image/*">
          </label>
        </div>

        <div class="small" style="margin-top:10px">Pages ajoutées : <b>${c}</b></div>
        ${navButtons('Suivant', 'Retour', c>0)}
      </div>`;
  }
  function stepBLTexte(){
    return `
      <div class="card">
        <h2 style="margin:0 0 8px">Lignes BL (saisie rapide)</h2>
        <div class="small">1 ligne = 1 pièce facturable : “Désignation — MontantHT”. On prend le montant après remise.</div>
        <label>Lignes</label>
        <textarea id="bllignes" placeholder="Ex:\nPlaquettes AR — 28,58\nDisques AR — 70,08\nBalais AV — 13,20">${escapeHtml(state.bl.lignes||'')}</textarea>
        ${navButtons('Générer facture', 'Retour', true)}
      </div>`;
  }

  function parseBLLines(text){
    const lines = (text||'').split('\n').map(l=>l.trim()).filter(Boolean);
    const out = [];
    for(const l of lines){
      const m = l.match(/^(.*?)(?:—|-|:)\s*([0-9]+(?:[.,][0-9]{1,2})?)\s*$/);
      if(!m) continue;
      const des = m[1].trim();
      const amt = parseFloat(m[2].replace(',','.'));
      if(!des || isNaN(amt)) continue;
      out.push({designation: des, achat_ht: Math.round(amt*100)/100});
    }
    return out;
  }

  function buildFacture(){
    const lignes = [];
    if(state.controle100.fait){
      lignes.push({ type:'MO', designation:'Contrôle 100 points', qte: 0.50, pu_ht: TAUX_HORAIRE, mt_ht: Math.round((0.50*TAUX_HORAIRE)*100)/100 });
    }
    const a5 = (state.a5.texte||'').toLowerCase();
    if(a5.includes('triangle') && a5.includes('1h')){
      const count = (a5.match(/triangle/g)||[]).length || 1;
      for(let i=0;i<count;i++){
        lignes.push({ type:'MO', designation:'Triangle suspension (barème)', qte: 1.00, pu_ht: TAUX_HORAIRE, mt_ht: Math.round((1.00*TAUX_HORAIRE)*100)/100 });
      }
    }
    if(a5.includes('frein') && (a5.includes('plaquette') || a5.includes('plaquettes')) && a5.includes('avant')){
      lignes.push({ type:'MO', designation:'Freins AV (disques + plaquettes) — barème', qte: 2.00, pu_ht: TAUX_HORAIRE, mt_ht: Math.round((2.00*TAUX_HORAIRE)*100)/100 });
    }
    const bl = parseBLLines(state.bl.lignes);
    bl.forEach(p=>{
      const vente = priceWithMargin(p.achat_ht);
      lignes.push({ type:'PIECE', designation:p.designation, qte:1, pu_ht: vente, mt_ht: vente });
    });
    if(state.divers.autres_interventions && state.divers.autres_interventions.trim()){
      lignes.push({ type:'NOTE', designation:`Autre intervention: ${state.divers.autres_interventions.trim()}`, qte:'', pu_ht:'', mt_ht:'' });
    }
    state.facture.lignes = lignes;
  }

  function totals(){
    const lignes = state.facture.lignes || [];
    let ht=0;
    for(const l of lignes){
      const v = Number(l.mt_ht);
      if(!isNaN(v)) ht += v;
    }
    ht = Math.round(ht*100)/100;
    const tva = Math.round((ht*TVA)*100)/100;
    const ttc = Math.round((ht+tva)*100)/100;
    return {ht, tva, ttc};
  }

  function stepGenerer(){
    try{ buildFacture(); saveState(); }catch(e){}
    const t = totals();
    const rows = (state.facture.lignes||[]).map(l=>{
      const q = (l.qte===''||l.qte===null||l.qte===undefined) ? '' : (typeof l.qte==='number'? num2(l.qte) : l.qte);
      const pu = (typeof l.pu_ht==='number') ? euro(l.pu_ht) : (l.pu_ht||'');
      const mt = (typeof l.mt_ht==='number') ? euro(l.mt_ht) : (l.mt_ht||'');
      return `<tr>
        <td>${escapeHtml(l.designation||'')}</td>
        <td style="text-align:right">${escapeHtml(String(q))}</td>
        <td style="text-align:right">${escapeHtml(String(pu))}</td>
        <td style="text-align:right"><b>${escapeHtml(String(mt))}</b></td>
      </tr>`;
    }).join('');

    return `
      <div class="card">
        <h2 style="margin:0 0 8px">Générer facture (aperçu)</h2>
        <div class="small">Règles : pièces = achat HT (après remise) +10% ; TVA 20% ; MO ${num2(TAUX_HORAIRE)} €/h.</div>

        <div style="overflow:auto;margin-top:12px">
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr>
                <th style="text-align:left;border-bottom:1px solid var(--border);padding:8px 6px">Désignation</th>
                <th style="text-align:right;border-bottom:1px solid var(--border);padding:8px 6px">Qté/Temps</th>
                <th style="text-align:right;border-bottom:1px solid var(--border);padding:8px 6px">PU HT</th>
                <th style="text-align:right;border-bottom:1px solid var(--border);padding:8px 6px">Mt HT</th>
              </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="4" class="small" style="padding:10px">Aucune ligne</td></tr>'}</tbody>
          </table>
        </div>

        <hr/>
        <div class="row">
          <div class="col"><div class="small">Total HT</div><div style="font-size:22px;font-weight:900">${euro(t.ht)}</div></div>
          <div class="col"><div class="small">TVA 20%</div><div style="font-size:22px;font-weight:900">${euro(t.tva)}</div></div>
          <div class="col"><div class="small">Total TTC</div><div style="font-size:22px;font-weight:900">${euro(t.ttc)}</div></div>
        </div>

        <div class="btnbar" style="margin-top:16px">
          <button class="btn secondary" id="btnEdit">Modifier lignes BL/A5</button>
          <button class="btn" id="btnRecap">Continuer</button>
        </div>
      </div>
    `;
  }

  function stepRecap(){
    const r = recapBadges();
    const j = escapeHtml(JSON.stringify({
      immat: state.vehicule.immat,
      immat_raw: state.vehicule.immat_raw,
      km: state.vehicule.km,
      marque: state.vehicule.marque,
      modele: state.vehicule.modele,
      mecano: state.vehicule.mecano,
      bl_photos: state.bl.photos.length
    }, null, 2));
    return `
      <div class="card">
        <h2 style="margin:0 0 8px">Récap</h2>
        <div class="row" style="gap:8px;margin-bottom:12px">
          <span>Véhicule :</span> <span class="pill ${r.vehicule?'ok':'no'}">${r.vehicule?'OK':'MANQUANT'}</span>
          <span>100 points :</span> <span class="pill ${r.c100?'ok':'no'}">${r.c100?'OK':'NON'}</span>
          <span>A5 :</span> <span class="pill ${r.a5?'ok':'no'}">${r.a5?'OK':'NON'}</span>
          <span>BL photos :</span> <span class="pill ${r.blPhotos>0?'ok':'no'}">${r.blPhotos}</span>
        </div>

        <pre style="white-space:pre-wrap;background:#0b0b0f;color:#e5e7eb;padding:12px;border-radius:12px;overflow:auto">${j}</pre>

        <div class="btnbar">
          <button class="btn secondary" id="btnBackGen">Retour</button>
          <button class="btn dark" id="btnNew2">Nouveau dossier</button>
        </div>
      </div>`;
  }

  function hookStep(et){
    const prevBtn = document.getElementById('btnPrev');
    const nextBtn = document.getElementById('btnNext');
    if(prevBtn) prevBtn.addEventListener('click', prev);

    if(nextBtn) nextBtn.addEventListener('click', async ()=>{
      if(et===1){
        const raw = document.getElementById('immat').value.trim();
        const fmt = normalizeImmat(raw);
        state.vehicule.immat_raw = raw;
        state.vehicule.immat = fmt;
        saveState();
        document.getElementById('immatFmt').value = fmt;
        if(!fmt || fmt.length<5){ alert("Immatriculation invalide. Saisis au moins AA123AA."); return; }
        if(!confirm("Valider l'immatriculation : " + fmt + " ?")) return;
        next(); return;
      }
      if(et===2){
        const km = document.getElementById('km').value.replace(/\s+/g,'').trim();
        state.vehicule.km = km; saveState();
        if(!km){ alert("Kilométrage obligatoire."); return; }
        next(); return;
      }
      if(et===3){
        state.vehicule.marque = document.getElementById('marque').value; saveState();
        if(!state.vehicule.marque){ alert("Marque obligatoire."); return; }
        next(); return;
      }
      if(et===4){
        state.vehicule.modele = document.getElementById('modele').value.trim(); saveState();
        if(!state.vehicule.modele){ alert("Modèle obligatoire."); return; }
        next(); return;
      }
      if(et===5){
        if(state.vehicule.mecano && state.vehicule.mecano.trim()){ next(); return; }
        alert("Prénom mécano obligatoire."); return;
      }
      if(et===6){
        state.controle100.fait = document.getElementById('c100').checked; saveState();
        if(!state.controle100.fait){ alert("Tu dois cocher '100 points effectué'."); return; }
        next(); return;
      }
      if(et===8){
        if(!state.a5.photo){ alert("Photo A5 obligatoire."); return; }
        next(); return;
      }
      if(et===9){
        state.a5.texte = document.getElementById('a5txt').value; saveState(); next(); return;
      }
      if(et===10){
        state.divers.autres_interventions = document.getElementById('autres').value; saveState(); next(); return;
      }
      if(et===11){
        if(state.bl.photos.length<1){ alert("Au moins 1 photo BL obligatoire."); return; }
        next(); return;
      }
      if(et===12){
        state.bl.lignes = document.getElementById('bllignes').value; saveState(); next(); return;
      }
      if(et===13){ goto(14); return; }
      next();
    });

    if(et===1){
      const immat = document.getElementById('immat');
      const fmt = document.getElementById('immatFmt');
      immat.addEventListener('input', ()=>{
        const raw = immat.value.trim();
        const out = normalizeImmat(raw);
        state.vehicule.immat_raw = raw;
        state.vehicule.immat = out;
        fmt.value = out;
        saveState();
      });
    }

    if(et===5){
      const mSyl = document.getElementById('mSyl');
      const mAutre = document.getElementById('mAutre');
      const inpt = document.getElementById('mecanoAutre');
      mSyl.addEventListener('click', ()=>{ state.vehicule.mecano='SYLVAIN'; saveState(); render(); });
      mAutre.addEventListener('click', ()=>{ state.vehicule.mecano=(inpt&&inpt.value.trim())?inpt.value.trim().toUpperCase():'AUTRE'; saveState(); render(); });
      if(inpt){
        inpt.addEventListener('input', ()=>{ const v=inpt.value.trim().toUpperCase(); state.vehicule.mecano=v||'AUTRE'; saveState(); });
      }
    }

    if(et===6){
      const c100 = document.getElementById('c100');
      c100.addEventListener('change', ()=>{ state.controle100.fait=c100.checked; saveState(); render(); });
    }

    if(et===7){
      const inp = document.getElementById('photoC100');
      const clear = document.getElementById('btnClearC100');
      inp.addEventListener('change', async ()=>{
        const f = inp.files && inp.files[0];
        if(!f) return;
        state.controle100.photo = await fileToDataUrl(f);
        saveState(); render();
      });
      if(clear) clear.addEventListener('click', ()=>{ state.controle100.photo=null; saveState(); render(); });
    }

    if(et===8){
      const inp = document.getElementById('photoA5');
      const clear = document.getElementById('btnClearA5');
      const ocrFile = document.getElementById('ocrA5File');
      inp.addEventListener('change', async ()=>{
        const f = inp.files && inp.files[0];
        if(!f) return;
        state.a5.photo = await fileToDataUrl(f);
        saveState(); render();
      });
      if(clear) clear.addEventListener('click', ()=>{ state.a5.photo=null; saveState(); render(); });
      ocrFile.addEventListener('change', async ()=>{
        const f = ocrFile.files && ocrFile.files[0];
        if(!f) return;
        try{
          toast("OCR en cours…");
          const txt = await runOCRFromFile(f);
          state.a5.texte = (state.a5.texte ? (state.a5.texte+"\n") : "") + txt.trim();
          saveState();
          alert("OCR terminé. Texte ajouté dans 'Travaux'.");
        }catch(e){
          alert("OCR impossible: " + (e && e.message ? e.message : e));
        }finally{
          ocrFile.value='';
        }
      });
    }

    if(et===11){
      const inp = document.getElementById('photoBL');
      const clear = document.getElementById('btnClearBL');
      const ocrFile = document.getElementById('ocrBLFile');
      inp.addEventListener('change', async ()=>{
        const files = Array.from(inp.files || []);
        if(!files.length) return;
        for(const f of files){ state.bl.photos.push(await fileToDataUrl(f)); }
        saveState(); render();
      });
      if(clear) clear.addEventListener('click', ()=>{ state.bl.photos=[]; saveState(); render(); });
      ocrFile.addEventListener('change', async ()=>{
        const f = ocrFile.files && ocrFile.files[0];
        if(!f) return;
        try{
          toast("OCR en cours…");
          const txt = await runOCRFromFile(f);
          state.bl.lignes = (state.bl.lignes ? (state.bl.lignes+"\n") : "") + txt.trim();
          saveState();
          alert("OCR terminé. Vérifie/corrige dans 'Lignes BL'.");
        }catch(e){
          alert("OCR impossible: " + (e && e.message ? e.message : e));
        }finally{
          ocrFile.value='';
        }
      });
    }

    if(et===13){
      const edit = document.getElementById('btnEdit');
      const recap = document.getElementById('btnRecap');
      if(edit) edit.addEventListener('click', ()=>goto(9));
      if(recap) recap.addEventListener('click', ()=>goto(14));
    }

    if(et===14){
      const back = document.getElementById('btnBackGen');
      const n2 = document.getElementById('btnNew2');
      if(back) back.addEventListener('click', ()=>goto(13));
      if(n2) n2.addEventListener('click', resetState);
    }
  }

  // Étape 3 — Marque : mise à jour immédiate pour activer "Suivant"
  if(et===3){
    const sel = document.getElementById('marque');
    if(sel){
      sel.addEventListener('change', ()=>{
        state.vehicule.marque = sel.value || '';
        // Si la marque change, on réinitialise le modèle
        state.vehicule.modele = '';
        saveState();
        render();
      });
    }
  }

  // Étape 4 — Modèle : mise à jour immédiate pour activer "Suivant"
  if(et===4){
    const sel = document.getElementById('modele');
    if(sel){
      sel.addEventListener('change', ()=>{
        state.vehicule.modele = sel.value || '';
        saveState();
        render();
      });
    }
  }

  function toast(msg){
    try{
      const t = document.createElement('div');
      t.textContent = msg;
      t.style.position='fixed';
      t.style.left='50%';
      t.style.bottom='88px';
      t.style.transform='translateX(-50%)';
      t.style.background='#111827';
      t.style.color='#fff';
      t.style.padding='10px 12px';
      t.style.borderRadius='999px';
      t.style.fontWeight='800';
      t.style.zIndex='99999';
      document.body.appendChild(t);
      setTimeout(()=>t.remove(), 1800);
    }catch{}
  }

  async function fileToDataUrl(file){
    return await new Promise((resolve, reject)=>{
      const r = new FileReader();
      r.onload = ()=>resolve(r.result);
      r.onerror = ()=>reject(new Error('Lecture photo impossible'));
      r.readAsDataURL(file);
    });
  }

  window.addEventListener('load', function(){
    try{
      if(!state || !state.version) state = loadState();
      if(!state.etape) state.etape = 1;
      saveState();
      render();
    }catch(e){
      showFatal(e && e.message ? e.message : String(e));
    }
  });
})();