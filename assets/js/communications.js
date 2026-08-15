(function(){
  "use strict";
  const $ = id => document.getElementById(id);
  const state = { rows: [], filtered: [], selected: new Set(), batch: [], batchIndex: 0, adminKey: sessionStorage.getItem("kaidaCommsKey") || "" };

  function api(action, payload={}) { return window.KAIDA.callApi(action, { adminKey: state.adminKey, ...payload }); }
  function money(n){ return window.KAIDA.money(Number(n||0)); }
  function esc(s){ return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }
  function setNotice(id,text,kind="info"){ const el=$(id); el.textContent=text; el.className=`notice notice-${kind}`; el.hidden=!text; }
  function smsLink(phone,msg){ const p=String(phone||""); const sep=/iPhone|iPad|iPod/i.test(navigator.userAgent)?"&":"?"; return `sms:${encodeURIComponent(p)}${sep}body=${encodeURIComponent(msg)}`; }
  function waLink(phone,msg){ return `https://wa.me/${String(phone||"").replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`; }

  async function loadQueue(){
    state.adminKey=$("adminKey").value.trim() || state.adminKey;
    if(!state.adminKey){ setNotice("accessMessage","Enter the communications admin key.","warning"); return; }
    sessionStorage.setItem("kaidaCommsKey",state.adminKey);
    setNotice("accessMessage","Loading outstanding-member queue…","info");
    try{
      const data=await api("getCommunicationQueue");
      state.rows=data.members||[];
      $("dashboard").classList.remove("hidden");
      setNotice("accessMessage",`Loaded ${state.rows.length} outstanding members.`,"success");
      applyFilters();
    }catch(e){ setNotice("accessMessage",e.message,"error"); }
  }

  function applyFilters(){
    const q=$("searchBox").value.trim().toLowerCase(), debt=$("debtFilter").value, contact=$("contactFilter").value;
    state.filtered=state.rows.filter(r=>{
      const blob=`${r.name} ${r.phone} ${r.memberId}`.toLowerCase();
      if(q && !blob.includes(q)) return false;
      if(debt!=="all" && String(r.requestType).toLowerCase()!==debt) return false;
      if(contact==="never" && Number(r.reminderCount||0)>0) return false;
      if(contact==="followup" && Number(r.reminderCount||0)===0) return false;
      return true;
    });
    render();
  }

  function render(){
    const body=$("queueBody");
    body.innerHTML=state.filtered.map(r=>{
      const checked=state.selected.has(r.memberId)?"checked":"";
      return `<tr>
        <td><input class="rowPick" type="checkbox" data-id="${esc(r.memberId)}" ${checked}></td>
        <td><strong>${esc(r.name||"Name needed")}</strong><div class="small">${esc(r.memberId)}</div></td>
        <td>${esc(r.phone)}</td>
        <td class="money">${money(r.registrationDue)}</td>
        <td class="money">${money(r.duesDue)}</td>
        <td class="money">${money(r.totalDue)}</td>
        <td><span class="pill">${esc(labelType(r.requestType))}</span></td>
        <td>${esc(r.lastContact||"Never")}<div class="small">${esc(r.lastContactMethod||"")}</div></td>
        <td>${Number(r.reminderCount||0)}</td>
        <td><div class="actions">
          <a class="action-link primary" target="_blank" rel="noopener" href="${waLink(r.phone,r.message)}">WhatsApp</a>
          <a class="action-link secondary" href="${smsLink(r.phone,r.message)}">Text</a>
          <button class="muted editOne" data-id="${esc(r.memberId)}" type="button">Batch view</button>
        </div></td>
      </tr>`;
    }).join("") || `<tr><td colspan="10">No members match the current filters.</td></tr>`;
    document.querySelectorAll(".rowPick").forEach(cb=>cb.addEventListener("change",e=>{ e.target.checked?state.selected.add(e.target.dataset.id):state.selected.delete(e.target.dataset.id); updateStats(); }));
    document.querySelectorAll(".editOne").forEach(b=>b.addEventListener("click",()=>startBatch([b.dataset.id])));
    updateStats();
  }

  function updateStats(){
    $("statOutstanding").textContent=state.rows.length;
    $("statBalance").textContent=money(state.rows.reduce((a,r)=>a+Number(r.totalDue||0),0));
    $("statNever").textContent=state.rows.filter(r=>Number(r.reminderCount||0)===0).length;
    $("statSelected").textContent=state.selected.size;
  }
  function labelType(t){ return ({registration:"Registration",dues:"Dues",both:"Registration + Dues"})[String(t).toLowerCase()]||t; }

  function startBatch(ids){
    const chosen=ids?state.rows.filter(r=>ids.includes(r.memberId)):state.rows.filter(r=>state.selected.has(r.memberId));
    if(!chosen.length){ setNotice("mainMessage","Select at least one member first.","warning"); return; }
    state.batch=chosen; state.batchIndex=0; $("batchCard").hidden=false; showBatchMember(); $("batchCard").scrollIntoView({behavior:"smooth"});
  }
  function showBatchMember(){
    if(state.batchIndex>=state.batch.length){ $("batchCard").hidden=true; setNotice("mainMessage","Batch complete. Refresh the queue whenever you want to send another round.","success"); return; }
    const r=state.batch[state.batchIndex];
    $("batchTitle").textContent=`Member ${state.batchIndex+1} of ${state.batch.length}`;
    $("batchMember").innerHTML=`<strong>${esc(r.name||"Name needed")}</strong> · ${esc(r.phone)} · <span class="pill">${esc(labelType(r.requestType))}</span> · <strong>${money(r.totalDue)} due</strong>`;
    $("batchMessage").value=r.message;
    updateBatchLinks();
  }
  function updateBatchLinks(){
    const r=state.batch[state.batchIndex], msg=$("batchMessage").value;
    $("batchWhatsApp").href=waLink(r.phone,msg); $("batchSms").href=smsLink(r.phone,msg);
  }
  async function logAndNext(method){
    const r=state.batch[state.batchIndex], msg=$("batchMessage").value.trim();
    try{
      await api("logCommunication",{ memberId:r.memberId, method, message:msg, amountDue:r.totalDue, requestType:r.requestType });
      r.reminderCount=Number(r.reminderCount||0)+1; r.lastContact=new Date().toLocaleString(); r.lastContactMethod=method;
      state.batchIndex++; render(); showBatchMember();
    }catch(e){ setNotice("mainMessage",e.message,"error"); }
  }

  document.addEventListener("DOMContentLoaded",()=>{
    $("adminKey").value=state.adminKey;
    $("connectBtn").addEventListener("click",loadQueue);
    $("refreshBtn").addEventListener("click",loadQueue);
    ["searchBox","debtFilter","contactFilter"].forEach(id=>$(id).addEventListener(id==="searchBox"?"input":"change",applyFilters));
    $("selectVisibleBtn").addEventListener("click",()=>{state.filtered.forEach(r=>state.selected.add(r.memberId));render();});
    $("clearSelectedBtn").addEventListener("click",()=>{state.selected.clear();render();});
    $("selectAll").addEventListener("change",e=>{state.filtered.forEach(r=>e.target.checked?state.selected.add(r.memberId):state.selected.delete(r.memberId));render();});
    $("startBatchBtn").addEventListener("click",()=>startBatch());
    $("closeBatchBtn").addEventListener("click",()=>$("batchCard").hidden=true);
    $("batchMessage").addEventListener("input",updateBatchLinks);
    $("logWhatsAppBtn").addEventListener("click",()=>logAndNext("WHATSAPP"));
    $("logSmsBtn").addEventListener("click",()=>logAndNext("SMS"));
    $("skipBtn").addEventListener("click",()=>{state.batchIndex++;showBatchMember();});
    if(state.adminKey) loadQueue();
  });
})();
