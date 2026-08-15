const cfg = window.KAIDA_CONFIG || {};
const $ = s => document.querySelector(s);
const fmt = n => new Intl.NumberFormat('en-US',{style:'currency',currency:cfg.CURRENCY||'USD'}).format(Number(n||0));
const esc = s => String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

function apiReady(){return cfg.API_URL && !cfg.API_URL.includes('PASTE_YOUR_')}
async function callApi(action,payload={}){
  if(!apiReady()) throw new Error('The KAIDA backend has not been connected yet. Add your Apps Script Web App URL to config.js.');
  const res = await fetch(cfg.API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,...payload})});
  if(!res.ok) throw new Error('Unable to reach the KAIDA backend.');
  const data = await res.json();
  if(!data.ok) throw new Error(data.error||'Request failed.');
  return data;
}
function show(el,msg,type=''){el.className='notice'+(type?' '+type:'');el.textContent=msg;el.classList.remove('hidden')}

document.addEventListener('DOMContentLoaded',()=>{
  const menu=$('#menuBtn'), links=$('#navLinks'); if(menu) menu.onclick=()=>links.classList.toggle('open');
  document.querySelectorAll('[data-reg-fee]').forEach(e=>e.textContent=fmt(cfg.REGISTRATION_FEE||50));
  document.querySelectorAll('[data-monthly-dues]').forEach(e=>e.textContent=fmt(cfg.MONTHLY_DUES||10));
  const finance=$('#financeWhatsApp');
  if(finance && cfg.FINANCE_WHATSAPP){finance.href=`https://wa.me/${String(cfg.FINANCE_WHATSAPP).replace(/\D/g,'')}?text=${encodeURIComponent('Hello KAIDA Finance, I have a question about my registration fee or monthly dues.')}`}
  if(finance && !cfg.FINANCE_WHATSAPP) finance.classList.add('hidden');
  const q=new URLSearchParams(location.search), token=q.get('t');
  if(token && $('#token')){$('#token').value=token; loadAccount(token);}
  $('#accountForm')?.addEventListener('submit',e=>{e.preventDefault();loadAccount($('#token').value.trim())});
  $('#paymentForm')?.addEventListener('submit',submitPayment);
  $('#registrationForm')?.addEventListener('submit',submitRegistration);
});

async function loadAccount(token){
  const note=$('#accountNotice'), out=$('#accountResult'); out.classList.add('hidden');
  if(!token){show(note,'Enter the secure access code from your KAIDA WhatsApp message.','error');return}
  try{
    show(note,'Loading your KAIDA account…');
    const {member,payments}=await callApi('memberAccount',{token});
    note.classList.add('hidden'); out.classList.remove('hidden');
    const paid=Number(member.amountPaid||0), due=Number(member.amountDue||0), bal=Number(member.balance||0);
    out.innerHTML=`<h3>${esc(member.name||member.memberId)}</h3><p class="hint">${esc(member.memberId)}${member.chiefdom?` · ${esc(member.chiefdom)}`:''}${member.town?` · ${esc(member.town)}`:''}</p><div class="account-summary"><div class="metric"><span>Total expected</span><strong>${fmt(due)}</strong></div><div class="metric"><span>Verified payments</span><strong>${fmt(paid)}</strong></div><div class="metric balance"><span>Balance</span><strong>${fmt(bal)}</strong></div><div class="metric"><span>Status</span><strong class="status ${bal<=0?'paid':''}">${bal<=0?'PAID':'BALANCE DUE'}</strong></div></div><div class="timeline"><h4>Verified payment history</h4>${(payments||[]).length?(payments.map(p=>`<div class="payment-row"><div><strong>${fmt(p.amount)}</strong><br><small>${esc(p.category)} · ${esc(p.method||'')}</small></div><small>${esc(p.date||'')}</small></div>`).join('')):'<p class="hint">No verified payments are recorded yet.</p>'}</div>`;
    $('#paymentToken').value=token;
  }catch(err){show(note,err.message,'error')}
}
async function submitPayment(e){e.preventDefault();const note=$('#paymentNotice');const form=new FormData(e.target);try{show(note,'Submitting your payment confirmation…');const data=await callApi('submitPayment',Object.fromEntries(form.entries()));show(note,`Submitted. Confirmation ${data.paymentId}. KAIDA Finance will verify it before it changes your balance.`,'success');e.target.reset();$('#paymentToken').value=$('#token').value.trim();}catch(err){show(note,err.message,'error')}}
async function submitRegistration(e){e.preventDefault();const note=$('#registrationNotice');const form=new FormData(e.target);try{show(note,'Submitting your registration…');const data=await callApi('submitRegistration',Object.fromEntries(form.entries()));show(note,`Registration received. Reference ${data.registrationId}. KAIDA will review it and send your secure member link by WhatsApp.`,'success');e.target.reset();}catch(err){show(note,err.message,'error')}}
