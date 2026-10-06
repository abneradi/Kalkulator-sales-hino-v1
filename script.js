let DB=null, selected=null;
const $=id=>document.getElementById(id);
const rupiah=n=>{if(n===null||n===undefined||isNaN(n))return 'Tidak tersedia';return 'Rp '+Math.round(n).toLocaleString('id-ID')};
const num=v=>Number(String(v??'').replace(/[^0-9]/g,''))||0;
const dec=v=>{let x=parseFloat(String(v??'').replace(',','.'));return Number.isFinite(x)?x:0};

function fillSeries(){
  $('series').innerHTML=Object.keys(DB.body_options).map(x=>`<option>${x}</option>`).join('');
  fillTypes();
}
function fillTypes(){
  let s=$('series').value;
  let ms=DB.models.filter(x=>x.series===s);
  $('type').innerHTML=ms.map((x,i)=>`<option value="${i}">${x.type}</option>`).join('');
  fillBodies();
}
function fillBodies(){
  let s=$('series').value;
  $('body').innerHTML=DB.body_options[s].map(x=>`<option>${x}</option>`).join('');
  update();
}
function getModel(){
  let ms=DB.models.filter(x=>x.series===$('series').value);
  return ms[Number($('type').value)||0];
}

function updateVisual(){
  const series=$('series').value, type=$('type').value||'';
  const is500=series==='Hino 500';
  $('visualSeries').textContent=series.toUpperCase();
  $('visualType').textContent=type;
  $('unitImage').src=is500
    ? 'https://www.hino.co.id/assets/images/gso/hinobdn/asset21.png'
    : 'https://www.hino.co.id/assets/uploads/products/c60a15729ef206da7f96411d6c0f522b.png';
}

function update(){
  selected=getModel(); if(!selected)return;
  let body=$('body').value, plate=$('plate').value, bp=num($('bodyPrice').value);
  let bbn=selected.bbn?.[plate]?.[body];
  const source=$('offSource')?.value||'tengah';
  const offSpv=selected.off_spv??null;
  const offBm=selected.bm??null;
  const offTengah=selected.off_tengah??((offSpv!=null&&offBm!=null)?Math.round(((offSpv+offBm)/2)/500000)*500000:null);
  const off=source==='spv'?offSpv:source==='bm'?offBm:offTengah;
  let on=(off||0)+(bbn??0)+bp;
  let otr=(selected.pricelist_otr??null), totalOTR=otr===null?null:otr+bp;
  $('unitTitle').textContent=selected.series+' – '+selected.type+' – '+body+' – Plat '+plate;
  updateVisual();
  $('off').textContent=rupiah(off);
  $('offLabel').textContent=source==='spv'?'SPV':source==='bm'?'BM':'Tengah';
  $('offSpv').textContent=rupiah(offSpv);
  $('offBm').textContent=rupiah(offBm);
  $('offTengah').textContent=rupiah(offTengah);
  $('bbn').textContent=rupiah(bbn);
  $('karoseri').textContent=rupiah(bp);
  $('onNett').textContent=bbn===null?'Tidak dapat dihitung':rupiah(on);
  $('pricelist').textContent=rupiah(otr);
  $('otr').textContent=rupiah(totalOTR);
  $('discDealer').textContent=(bbn!==null&&otr!==null)?rupiah(totalOTR-on):'Tidak dapat dihitung';

  if(!$('otrLease').value && totalOTR!==null) $('otrLease').value=Math.round(totalOTR);
  updateSalesBridge(totalOTR,on,bbn);
  calcLease();
}

function updateSalesBridge(totalOTR,onNett,bbn){
  const otrLease=num($('otrLease')?.value)||totalOTR||0;
  const nett=(bbn!==null && onNett!==undefined)?onNett:0;
  const discount=(otrLease && nett)?Math.max(0,otrLease-nett):0;
  const tdp=num($('salesTdp')?.value);
  $('salesOtrLease').textContent=rupiah(otrLease);
  $('salesOnNett').textContent=rupiah(nett);
  $('salesDiskonDp').textContent=rupiah(discount);
  $('salesDpSetor').textContent=tdp?rupiah(Math.max(0,tdp-discount)):'-';
}

function hfiCalc(otr, dpPct, tenor, rate, subsidy){
  const dp=otr*dpPct/100;
  const principal=Math.max(0,otr-dp-subsidy);
  const tlo=dec($('hfiTlo').value)/100;

  // HFI package structure from the supplied simulation:
  // 24m: insurance year 2 = principal x 0.88%
  // 36m: insurance years 2+3 = principal x 1.65%
  let futureInsuranceRate = tenor===24 ? 0.0088 :
                            tenor===36 ? 0.0165 :
                            tlo*Math.max(0,(tenor-12)/12);
  const futureInsurance=principal*futureInsuranceRate;

  const tpl = tenor===24 ? 630000 : tenor===36 ? 930000 : num($('hfiTpl').value);
  const admin=num($('hfiAdmin').value);
  const provRate=dec($('hfiProvisi').value)/100;

  // Provisi in the HFI example is based on financing + insurance years 2/3.
  const provision=(principal+futureInsurance)*provRate;

  // Year-1 TLO is included in the first payment/process costs.
  const insYear1=otr*tlo;
  const process=insYear1+tpl+admin+provision;

  // HFI package is explicitly FLAT per year.
  const flatInterest=(principal+futureInsurance)*(rate/100)*(tenor/12);
  const installment=(principal+futureInsurance+flatInterest)/tenor;

  return {dp,principal,insYear1,futureInsurance,tpl,admin,provision,process,installment};
}
function imfiCalc(otr, dpPct, tenor, rate, subsidy){
  const dp=otr*dpPct/100;
  const principal=Math.max(0,otr-dp-subsidy);
  const tlo=num($('imfiTlo').value);
  const admin=num($('imfiAdmin').value);
  const fiducia=num($('imfiFiducia').value);
  const prov=principal*dec($('imfiProvisi').value)/100;
  const process=tlo+admin+fiducia+prov;
  const installment=tenor>0 ? principal*(1+(rate/100)*(tenor/12))/tenor : 0;
  return {dp,principal,tlo,admin,fiducia,provision:prov,process,installment};
}

function refreshSalesBridge(){
  const otrLease=num($('otrLease')?.value);
  const nett=num($('onNett')?.textContent);
  const discount=otrLease&&nett?Math.max(0,otrLease-nett):0;
  const tdp=num($('salesTdp')?.value);
  $('salesOtrLease').textContent=otrLease?rupiah(otrLease):'-';
  $('salesOnNett').textContent=nett?rupiah(nett):'-';
  $('salesDiskonDp').textContent=discount?rupiah(discount):'-';
  $('salesDpSetor').textContent=tdp?rupiah(Math.max(0,tdp-discount)):'-';
}

function calcLease(){
  const otr=num($('otrLease').value);
  const dpPct=dec($('dpPct').value);
  const tenor=Number($('tenor').value)||24;
  const rate=dec($('leaseRate').value);
  const subsidy=num($('subsidy').value);
  const finance=$('finance').value;
  const manual=num($('manualInstallment').value);
  refreshSalesBridge();

  if(!otr){ ['dpNominal','financePrincipal','firstInstallment','processCost','tdpTotal','dealerDisbursement'].forEach(id=>$(id).textContent='-'); $('installments').innerHTML=''; return; }

  let r=finance==='HFI'?hfiCalc(otr,dpPct,tenor,rate,subsidy):imfiCalc(otr,dpPct,tenor,rate,subsidy);
  const first=manual||r.installment;
  const tdp=r.dp+first+r.process;
  const dealer=otr-tdp;

  $('dpNominal').textContent=rupiah(r.dp);
  $('financePrincipal').textContent=rupiah(r.principal);
  $('firstInstallment').textContent=rupiah(first);
  $('processCost').textContent=rupiah(r.process);
  $('tdpTotal').textContent=rupiah(tdp);
  $('dealerDisbursement').textContent=rupiah(dealer);

  renderInstallments();
}

function renderInstallments(){
  const otr=num($('otrLease').value);
  if(!otr){$('installments').innerHTML='';return;}
  const finance=$('finance').value;
  const dpPct=dec($('dpPct').value);
  const subsidy=num($('subsidy').value);
  const manual=num($('manualInstallment').value);
  const tenors=finance==='HFI'?[24,36]:[24,36,47,48,60];
  const rate=dec($('leaseRate').value);

  $('installments').innerHTML=tenors.map(n=>{
    let r=finance==='HFI'?hfiCalc(otr,dpPct,n,rate,subsidy):imfiCalc(otr,dpPct,n,rate,subsidy);
    let a=manual||r.installment;
    return `<div class="inst"><span>${n} bulan</span><b>${rupiah(a)}</b></div>`;
  }).join('');
}


function syncHFIRate(){
  if($('finance').value==='HFI'){
    const t=Number($('tenor').value);
    $('leaseRate').value=t===36?'7.21':'6.44';
  }
}

function setFinanceUI(){
  const hfi=$('finance').value==='HFI';
  $('hfiFields').style.display=hfi?'block':'none';
  $('imfiFields').style.display=hfi?'none':'block';
  $('installmentHint').textContent=hfi?'Hino Finance':'IMFI';
  if(hfi){
    $('leaseRate').value=$('tenor')?.value==='36'?'7.21':'6.44';
    $('tenor').innerHTML='<option value="24">24</option><option value="36">36</option>';
    $('dpPct').value='20';
  }else{
    $('leaseRate').value='8.96';
    $('tenor').innerHTML='<option value="24">24</option><option value="36">36</option><option value="47">47</option><option value="48">48</option><option value="60">60</option>';
    $('dpPct').value='30';
  }
  $('manualInstallment').value='';
  syncHFIRate();
  calcLease();
}

$('series').addEventListener('change',fillTypes);
$('type').addEventListener('change',update);
$('body').addEventListener('change',update);
$('plate').addEventListener('change',update);
$('bodyPrice').addEventListener('input',update);
$('offSource').addEventListener('change',update);

['finance','otrLease','dpPct','tenor','leaseRate','subsidy','manualInstallment','hfiTlo','hfiTpl','hfiAdmin','hfiProvisi','imfiTlo','imfiAdmin','imfiFiducia','imfiProvisi','salesTdp'].forEach(id=>{
  $(id).addEventListener('input',calcLease);
  $(id).addEventListener('change',id==='finance'?setFinanceUI:(id==='tenor'?()=>{syncHFIRate();calcLease();}:calcLease));
});

fetch('data.json').then(r=>r.json()).then(d=>{DB=d;fillSeries();setFinanceUI();});
