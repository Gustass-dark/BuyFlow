'use strict';
const $=s=>document.querySelector(s);
const money=n=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Date().toLocaleDateString('sv-SE');
const uid=()=>crypto.randomUUID();
const safe=u=>{try{return ['https:','http:'].includes(new URL(u).protocol)?u:''}catch{return ''}};
const categories=['Setup e PC','Quarto','Roupas e tênis','Moto','Games','Eletrônicos','Livros','Esportes','Outros'];
const priorities=['Urgente','Alta','Média','Baixa'];
const statuses=['Pesquisando','Aguardando promoção','Planejado','Comprado','Desistência'];
const base=(name,cat,price,extra={})=>({id:uid(),name,cat,price,target:0,qty:1,saved:0,monthly:0,goal:false,priority:'Média',status:'Planejado',date:'',bought:'',notes:'',img:'',favorite:false,offers:[],log:[],...extra});
const key='meumural-v2';
function init(){
 const saved=localStorage.getItem(key);
 if(saved)return JSON.parse(saved);
 const old=JSON.parse(localStorage.getItem('meumural-v1')||'null');
 const mapped=[0,2,5,1,3,8];
 const items=old?old.map(x=>base(x.name,categories[mapped[x.cat]]||'Outros',x.price,{saved:x.saved,priority:x.pri,goal:x.saved>0||/entrada/i.test(x.name),status:x.status==='Comprado'?'Comprado':'Planejado'})):[];
 return {version:2,cats:[...categories],items,budgets:{}};
}
let state=init();
async function save(next){if(accountBusy)return false;if(accountSession)return saveOnline(next);try{localStorage.setItem(key,JSON.stringify(next));state=next;return true}catch{alert('Não foi possível salvar. Verifique o espaço disponível no navegador.');return false}}
const paths={dashboard:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',produtos:'m3 7 9-4 9 4-9 5z M3 7v10l9 5 9-5V7 M12 12v10',metas:'M21 12a9 9 0 1 1-9-9 M17 12a5 5 0 1 1-5-5 M12 12l9-9',orcamento:'M3 6h18v14H3z M3 6l14-4v4 M16 11h5v4h-5z',calendario:'M3 6h18v15H3z M7 3v6m10-6v6M3 11h18',historico:'M3 11a9 9 0 1 1 2 7M3 5v6h6 M12 7v6l4 2',categorias:'M3 5h7l2 3h9v12H3z',ferramentas:'M5 3h14v18H5z M8 7h8 M8 12h2m4 0h2m-8 5h2m4 0h2',check:'m4 12 5 5 11-12'};
const icon=k=>'<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="'+paths[k]+'"/></svg>';
const pages={dashboard:'Dashboard',produtos:'Lista de desejos',metas:'Metas financeiras',orcamento:'Orçamento mensal',calendario:'Calendário',historico:'Histórico de compras',categorias:'Categorias',ferramentas:'Ferramentas'};
const nav=()=>Object.keys(pages).includes(location.hash.slice(1))?location.hash.slice(1):'dashboard';
const active=x=>!['Comprado','Desistência'].includes(x.status);
const cost=x=>x.price*x.qty;
const goalCost=x=>(x.target||x.price)*x.qty;
const sum=(xs,fn)=>xs.reduce((n,x)=>n+fn(x),0);
const pct=(a,b)=>b?Math.min(100,Math.round(100*a/b)):0;
const ops=(values,selected)=>values.map(v=>'<option '+(v===selected?'selected':'')+'>'+esc(v)+'</option>').join('');
const action=(name,label,id='',cls='')=>'<button type="button" class="'+cls+'" data-act="'+name+'" data-id="'+esc(id)+'">'+label+'</button>';
const empty=t=>'<p class="empty">'+t+'</p>';
const bar=n=>'<div class="bar"><i style="width:'+n+'%"></i></div>';
const itemBy=id=>state.items.find(x=>x.id===id);
let month=today().slice(0,7);
let filters={query:'',cat:'',priority:'',status:'',fav:false};
function shoppingBudget(){
 const limit=state.budgets[month];
 const purchases=state.items.filter(x=>!x.goal&&x.status==='Comprado'&&x.bought.startsWith(month));
 const spent=sum(purchases,cost);
 return {limit,spent,balance:limit===undefined?null:Math.round((limit-spent)*100)/100};
}
function budgetSummary(){
 const {balance}=shoppingBudget();
 return '<div class="head"><div><strong>'+(balance===null?'Informe seu orçamento mensal':'Saldo para compras · '+money(balance))+'</strong> · <a class="link" href="#orcamento">Ajustar orçamento</a></div>'+monthField()+'</div>';
}
function fitLabel(x,balance){
 if(!active(x)||balance===null)return '';
 const gap=Math.round((cost(x)-balance)*100)/100;
 return '<p class="badge">'+(gap>0?'Acima do orçamento · faltam '+money(gap):'Dentro do orçamento')+'</p>';
}
function card(x,balance){
 const k=/mouse/i.test(x.name)?5:/headset|fone/i.test(x.name)?2:({'Setup e PC':0,'Roupas e tênis':1,'Quarto':3,'Moto':4}[x.cat]??5);
 const bg=['#464052','#75615d','#3b5554','#625c46','#425068','#535245'][k];
 const photo=safe(x.img)||(/^data:image\/(jpeg|webp|png);base64,/.test(x.img)?x.img:'');
 return '<article class="card"><div class="art" style="--bg:'+bg+'">'+svg(drawings[k])+(photo?'<img loading="lazy" alt="'+esc(x.name)+'" src="'+esc(photo)+'">':'')+action('fav',x.favorite?'★':'☆',x.id,'star '+(x.favorite?'yes':''))+'</div><div class="body"><small>'+esc(x.cat)+'</small><h3>'+action('edit',esc(x.name),x.id)+'</h3><div class="price">'+money(x.price)+'</div><small>'+(x.target?'Preço desejado · '+money(x.target):'Quantidade · '+x.qty)+'</small><div class="badges"><span class="badge">'+esc(x.status)+'</span><span class="badge">'+['🔴','🟠','🟡','🟢'][priorities.indexOf(x.priority)]+' '+esc(x.priority)+'</span></div>'+fitLabel(x,balance)+'</div></article>';
}
function dashboard(){
 const list=state.items.filter(x=>!x.goal&&active(x)),total=sum(list,cost);
 const {balance}=shoppingBudget();
 const tiles=[['produtos','Produtos desejados',list.length,'#c3adff'],['orcamento','Dentro do orçamento',balance===null?'—':list.filter(x=>Math.round((cost(x)-balance)*100)<=0).length,'#b3e6bb'],['check','Compras realizadas',state.items.filter(x=>!x.goal&&x.status==='Comprado').length,'#9ed8e6'],['metas','Metas em andamento',state.items.filter(x=>x.goal&&active(x)).length,'#efbe99']];
 return '<h1>Meu planejamento</h1>'+budgetSummary()+'<div class="hero"><div><div class="eyebrow">TOTAL DA LISTA DE DESEJOS</div><h2>'+money(total)+'</h2></div></div><div class="stats">'+tiles.map(([i,l,v,c])=>'<div class="box" style="--accent:'+c+'"><label>'+icon(i)+l+'</label><strong>'+v+'</strong></div>').join('')+'</div><div class="head"><h2>Lista de desejos</h2><a class="link" href="#produtos">Ver todos os produtos</a></div><div class="grid">'+(list.slice().sort((a,b)=>Number(b.favorite)-Number(a.favorite)).slice(0,3).map(x=>card(x,balance)).join('')||'<button class="first-item" data-act="new"><span aria-hidden="true">＋</span>Adicionar meu primeiro produto</button>')+'</div>';
}
function matches(){return state.items.filter(x=>!x.goal&&(!filters.cat||x.cat===filters.cat)&&(!filters.status||x.status===filters.status)&&(!filters.priority||x.priority===filters.priority)&&(!filters.fav||x.favorite)&&x.name.toLocaleLowerCase().includes(filters.query.toLocaleLowerCase()))}
function products(){return budgetSummary()+'<div class="filters"><input id="query" aria-label="Pesquisar produto" placeholder="Pesquisar produto" value="'+esc(filters.query)+'">'+[['cat','Categorias',state.cats],['priority','Prioridades',priorities],['status','Status',statuses]].map(([key,label,vals])=>'<select aria-label="'+label+'" data-filter="'+key+'"><option value="">'+label+'</option>'+ops(vals,filters[key])+'</select>').join('')+action('favorites',filters.fav?'★ Favoritos':'☆ Favoritos','','link')+'</div><div class="grid" id="results">'+results()+'</div>'}
function results(){const {balance}=shoppingBudget();return matches().map(x=>card(x,balance)).join('')||empty('Nenhum produto encontrado.')}
function goals(){return state.items.filter(x=>x.goal&&active(x)).map(x=>{const goal=goalCost(x),left=Math.max(0,goal-x.saved);return '<div class="panel"><div class="row"><h2>'+esc(x.name)+'</h2>'+action('edit','Atualizar meta',x.id)+'</div><p class="sub">Meta de '+money(goal)+'</p>'+bar(pct(x.saved,goal))+'<p>'+money(x.saved)+' guardados · Faltam '+money(left)+'</p><p class="muted">'+(left?x.monthly?money(x.monthly)+'/mês · estimativa de '+Math.ceil(left/x.monthly)+' mês(es)':'Informe um aporte mensal para calcular o prazo.':'Meta atingida')+'</p></div>'}).join('')||empty('Crie sua primeira meta para acompanhar o valor guardado e quanto pretende juntar por mês.')}
const dated=(date)=>date?date.split('-').reverse().join('/'):'Sem data';
function rows(xs,field){return xs.map(x=>'<div class="entry row"><div><strong>'+action('edit',esc(x.name),x.id,'link')+'</strong><small>'+dated(x[field])+' · '+esc(x.cat)+' · '+x.qty+' un.</small></div><b>'+money(cost(x))+'</b></div>').join('')||empty('Nenhuma compra neste período.')}
const monthField=()=>'<input id="month" aria-label="Selecionar mês" type="month" value="'+month+'">';
function finance(page){const plans=state.items.filter(x=>!x.goal&&active(x)&&x.date.startsWith(month)).sort((a,b)=>a.date.localeCompare(b.date));const {limit,spent,balance}=shoppingBudget(),planned=sum(plans,cost);
 if(page==='calendario')return '<div class="head"><h2>Compras previstas</h2>'+monthField()+'</div><div class="panel">'+rows(plans,'date')+'</div>';
 return '<div class="head"><h2>Resumo do mês</h2>'+monthField()+'</div><div class="panel"><div class="row"><label class="field">Disponível para compras no início do mês (R$)<input id="limit" type="number" required min="0" step=".01" value="'+(limit??'')+'"></label>'+action('limit','Salvar orçamento')+'</div><p>Compras realizadas no mês · '+money(spent)+'</p><strong>'+(balance===null?'Informe um valor para comparar os produtos.':'Saldo para compras · '+money(balance))+'</strong><p class="muted">Compras previstas · '+money(planned)+' · Os produtos da lista são comparados individualmente com o saldo.</p></div>'}
function categoriesPage(){return '<div class="panel">'+action('catadd','＋ Criar categoria')+state.cats.map(c=>'<div class="entry row"><div><strong>'+esc(c)+'</strong><small>'+state.items.filter(x=>x.cat===c).length+' produto(s)</small></div><div>'+action('catrename','Editar',c,'link')+action('catdel','Excluir',c,'link')+'</div></div>').join('')+'</div>'}
function toolsPage(){return '<section class="panel"><h2>Simulador de parcelas</h2><div class="fields"><label>Valor da compra (R$)<input id="simPrice" type="number" min=".01" step=".01" value="600"></label><label>Entrada (R$)<input id="down" type="number" min="0" value="0"></label><label>Número de parcelas<input id="months" type="number" min="1" max="600" value="6"></label><label>Juros ao mês (%)<input id="rate" type="number" min="0" step=".01" value="0"></label></div><strong id="simulation"></strong></section><section class="panel"><h2>Backup dos dados</h2><p class="sub">Leve sua lista, metas e orçamentos para outro navegador.</p>'+action('export','Exportar JSON')+' '+action('import','Importar JSON')+'<input hidden id="backup" type="file" accept=".json,application/json"></section>'}
function simulate(){const vals=['simPrice','down','months','rate'].map(k=>Number($('#'+k).value));const [p,d,n,r]=vals;let out='Revise os valores informados.';if(p>0&&d>=0&&d<=p&&Number.isInteger(n)&&n>0&&n<=600&&r>=0){const payment=r?(p-d)*(r/100)/(-Math.expm1(-n*Math.log1p(r/100))):(p-d)/n;out=n+' × '+money(payment)+' · Total com entrada: '+money(d+n*payment)}$('#simulation').textContent=out}
function render(){
 const page=nav();$('#new').textContent=page==='metas'?'＋ Nova meta':'＋ Novo produto';$('#crumb').textContent=pages[page];$('#nav').innerHTML=Object.entries(pages).map(([k,v])=>'<a class="'+(k===page?'on':'')+'" href="#'+k+'">'+icon(k)+v+'</a>').join('');
 const bought=state.items.filter(x=>x.status==='Comprado').sort((a,b)=>b.bought.localeCompare(a.bought));
 const views={dashboard,produtos:products,metas:goals,orcamento:()=>finance(page),calendario:()=>finance(page),historico:()=>'<div class="panel"><h2>Total gasto · '+money(sum(bought,cost))+'</h2>'+rows(bought,'bought')+'</div>',categorias:categoriesPage,ferramentas:toolsPage};
 $('#main').innerHTML=(page==='dashboard'?'':'<h1>'+pages[page]+'</h1>')+views[page]();
 document.querySelectorAll('.star').forEach(b=>b.setAttribute('aria-label','Alternar favorito: '+itemBy(b.dataset.id).name));
 const main=$('#main');
 if(main.dataset.page!==page){
  main.dataset.page=page;
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
   const blocks=main.querySelectorAll(':scope > h1, :scope > .sub, .hero, .stats > .box, :scope > .head, :scope > .grid, :scope > .panel, :scope > .filters');
   blocks.forEach((block,index)=>block.animate(
    [{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],
    {duration:280,delay:Math.min(index,6)*24,fill:'backwards',easing:'cubic-bezier(.2,.75,.2,1)'}
   ));
  }
 }
 if(page==='ferramentas')simulate();
}
const field=(label,k,type,value,attrs='')=>'<label>'+label+'<input name="'+k+'" type="'+type+'" value="'+esc(value)+'" '+attrs+'></label>';
const select=(label,k,vals,v)=>'<label>'+label+'<select name="'+k+'">'+ops(vals,v)+'</select></label>';
const offerRow=(o={})=>'<div class="offer"><input required aria-label="Nome da loja" placeholder="Loja" value="'+esc(o.store)+'"><input required type="url" aria-label="Link da oferta" placeholder="https://…" value="'+esc(o.url)+'"><input required type="number" step=".01" min=".01" aria-label="Preço da loja" placeholder="R$" value="'+esc(o.price)+'">'+action('removeoffer','×')+'</div>';
function compare(offers){return [...offers].sort((a,b)=>a.price-b.price).map((o,i)=>'<div class="entry row"><a target="_blank" rel="noopener noreferrer" href="'+esc(safe(o.url))+'">'+esc(o.store)+'</a><span>'+(i===0?'Menor preço · ':'')+money(o.price)+'</span></div>').join('')}
let editing=null;
function edit(id){
 editing=itemBy(id)||null; const x=editing||base('',state.cats[0],0,{goal:nav()==='metas'});
 $('#form').innerHTML='<div class="row"><h2>'+(x.goal?(editing?'Editar meta':'Nova meta'):(editing?'Editar produto':'Novo produto'))+'</h2>'+action('close','Fechar','','close')+'</div><div class="fields">'+field('Nome do produto','name','text',x.name,'required maxlength="120"')+select('Categoria','cat',state.cats,x.cat)+field('Preço atual por unidade (R$)','price','number',x.price||'','required min=".01" step=".01"')+field('Preço desejado por unidade (R$)','target','number',x.target||'','min=".01" step=".01"')+field('Quantidade','qty','number',x.qty,'required min="1" step="1"')+select('Prioridade','priority',priorities,x.priority)+select('Status','status',statuses,x.status)+field('Previsão de compra','date','date',x.date)+field('Data da compra realizada','bought','date',x.bought)+field('Imagem por URL','img','url',safe(x.img))+field('Ou enviar foto','photo','file','','accept="image/png,image/jpeg,image/webp"')+'<label class="wide">Observações<textarea name="notes" rows="2">'+esc(x.notes)+'</textarea></label><label><span><input type="checkbox" name="goal" '+(x.goal?'checked':'')+'> Acompanhar como meta financeira</span></label>'+field('Já guardado para a meta (R$)','saved','number',x.saved,'min="0" step=".01"')+field('Quanto pretende guardar por mês (R$)','monthly','number',x.monthly,'min="0" step=".01"')+'</div><h3>Comparador de lojas</h3><div id="comparison">'+compare(x.offers)+'</div><div id="offers">'+x.offers.map(offerRow).join('')+'</div>'+action('addoffer','＋ Adicionar oferta','','link')+'<h3 class="section-title">Histórico de preços</h3><div class="compact">'+(x.log.length?[...x.log].reverse().map(a=>'<div class="entry row"><span>'+dated(a.date)+' · '+esc(a.label)+'</span><b>'+money(a.price)+'</b></div>').join(''):'Os preços são registrados ao salvar o produto.')+'</div><div class="actions">'+(editing?action('delete','Excluir produto'):'')+'<button class="primary">Salvar produto</button></div>';
 const form=$('#form');
 function toggleGoalFields(){
  for(const name of ['saved','monthly'])form.elements[name].closest('label').style.display=form.elements.goal.checked?'':'none';
  form.querySelector('.primary').textContent=form.elements.goal.checked?'Salvar meta':'Salvar produto';
 }
 form.elements.goal.onchange=toggleGoalFields;
 toggleGoalFields();
 $('dialog').showModal();
}
async function photoData(file){const bitmap=await createImageBitmap(file);const scale=Math.min(1,700/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();return canvas.toDataURL('image/webp',.8)}
function readOffers(){return [...document.querySelectorAll('.offer')].map(row=>{const [store,url,price]=row.querySelectorAll('input');return {store:store.value.trim(),url:url.value.trim(),price:Number(price.value)}})}
$('#form').onsubmit=async e=>{
 e.preventDefault();const f=new FormData(e.target),v=k=>String(f.get(k)||'').trim(),n=k=>Number(v(k)),offers=readOffers();
 if(!v('name')||offers.some(o=>!safe(o.url)||!o.store)||v('img')&&!safe(v('img')))return alert('Confira o nome do produto, as lojas e os links HTTP ou HTTPS.');
 const submit=e.target.querySelector('.primary');submit.disabled=true;
 try{
 let img=v('img')||(editing?.img.startsWith('data:')?editing.img:'');const file=f.get('photo');if(file.size)img=await photoData(file);
 const old=editing,x=base(v('name'),v('cat'),n('price'),{id:old?.id||uid(),target:n('target'),qty:n('qty'),priority:v('priority'),status:v('status'),date:v('date'),bought:v('status')==='Comprado'?(v('bought')||today()):'',saved:n('saved'),goal:f.has('goal'),monthly:n('monthly'),notes:v('notes'),img,offers,favorite:old?.favorite||false,log:[...(old?.log||[])]});
 if(!old||old.price!==x.price||!old.log.length){if(old&&old.price!==x.price&&!old.log.length)x.log.push({label:'Preço anterior',date:'',price:old.price});x.log.push({label:'Produto',date:today(),price:x.price})}
 for(const o of offers){if(!old?.offers.some(a=>a.url===o.url&&a.store===o.store&&a.price===o.price))x.log.push({label:o.store,date:today(),price:o.price})}
 if(await save({...state,items:old?state.items.map(i=>i.id===old.id?x:i):[x,...state.items]})){$('dialog').close();render()}
 }catch{alert('Não foi possível ler a foto ou salvar o produto.')}finally{submit.disabled=false}
};
function validateBackup(s){
 const num=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
 const string=s=>typeof s==='string';const date=s=>string(s)&&(s===''||/^\d{4}-\d{2}-\d{2}$/.test(s));
 if(!s||s.version!==2||!Array.isArray(s.cats)||!s.cats.length||!s.cats.every(c=>string(c)&&c.trim())||new Set(s.cats).size!==s.cats.length||!Array.isArray(s.items)||!s.budgets||typeof s.budgets!=='object'||Array.isArray(s.budgets)||!Object.entries(s.budgets).every(([k,v])=>/^\d{4}-\d{2}$/.test(k)&&num(v)))return false;
 return new Set(s.items.map(x=>x.id)).size===s.items.length&&s.items.every(x=>x&&['id','name','notes','img'].every(k=>string(x[k]))&&x.name.trim()&&s.cats.includes(x.cat)&&priorities.includes(x.priority)&&statuses.includes(x.status)&&['target','saved','monthly','price','qty'].every(k=>num(x[k]))&&x.price>0&&Number.isInteger(x.qty)&&x.qty>0&&['goal','favorite'].every(k=>typeof x[k]==='boolean')&&date(x.date)&&date(x.bought)&&Array.isArray(x.offers)&&x.offers.every(o=>o&&string(o.store)&&safe(o.url)&&num(o.price))&&Array.isArray(x.log)&&x.log.every(o=>o&&string(o.label)&&date(o.date)&&num(o.price)));
}
async function importFile(file){try{const next=JSON.parse(await file.text());if(!validateBackup(next))throw Error();if(confirm('Substituir o planejamento aberto pelos dados do backup?')&&await save(next))render()}catch{alert('Arquivo de backup inválido. Os dados atuais foram preservados.')}}
async function manageCat(a,c){
 let cats=[...state.cats],items=state.items;
 if(a==='catdel'){if(cats.length===1)return alert('Mantenha pelo menos uma categoria.');cats=cats.filter(v=>v!==c);const destination=cats.includes('Outros')?'Outros':cats[0];if(!confirm('Excluir '+c+' e mover seus produtos para '+destination+'?'))return;items=items.map(x=>x.cat===c?{...x,cat:destination}:x)}
 else{const v=prompt('Nome da categoria',a==='catrename'?c:'')?.trim();if(!v||v===c)return;if(cats.some(n=>n.toLowerCase()===v.toLowerCase()))return alert('Essa categoria já existe.');if(a==='catadd')cats.push(v);else{cats=cats.map(n=>n===c?v:n);items=items.map(x=>x.cat===c?{...x,cat:v}:x)}}
 if(await save({...state,cats,items})){filters.cat='';render()}
}
document.addEventListener('click',async e=>{
 if($('#sidebar').classList.contains('show')&&!e.target.closest('#sidebar,#menu'))$('#sidebar').classList.remove('show');
 const b=e.target.closest('[data-act]');if(!b)return;const a=b.dataset.act,id=b.dataset.id;
 if(a==='new')edit(null);
 if(a==='edit')edit(id);
 if(a==='close')$('dialog').close();
 if(a==='delete'&&editing&&confirm('Excluir este produto e seu histórico?')&&await save({...state,items:state.items.filter(x=>x.id!==editing.id)})){$('dialog').close();render()}
 if(a==='addoffer')$('#offers').insertAdjacentHTML('beforeend',offerRow());
 if(a==='removeoffer'){b.closest('.offer').remove();updateCompare()}
 if(a==='fav'&&await save({...state,items:state.items.map(x=>x.id===id?{...x,favorite:!x.favorite}:x)})){
  render();
  const star=document.querySelector('.star[data-id="'+CSS.escape(id)+'"]');
  if(star){star.focus({preventScroll:true});star.classList.add('just-toggled')}
 }
 if(a==='favorites'){filters.fav=!filters.fav;render()}
 if(a.startsWith('cat'))manageCat(a,id);
 if(a==='limit'){const input=$('#limit');if(input.reportValidity()&&await save({...state,budgets:{...state.budgets,[month]:Number(input.value)}}))render()}
 if(a==='import')$('#backup').click();
 if(a==='export'){const u=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=u;link.download='buyflow-'+today()+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
});
function updateCompare(){$('#comparison').innerHTML=compare(readOffers().filter(o=>safe(o.url)&&o.store&&o.price>0))}
document.addEventListener('input',e=>{if(e.target.id==='query'){filters.query=e.target.value;$('#results').innerHTML=results()}if(e.target.closest('#offers'))updateCompare();if(['simPrice','down','months','rate'].includes(e.target.id))simulate()});
document.addEventListener('change',e=>{if(e.target.dataset.filter){filters[e.target.dataset.filter]=e.target.value;render()}if(e.target.id==='month'&&e.target.value){month=e.target.value;render()}if(e.target.id==='backup'&&e.target.files[0]){importFile(e.target.files[0]);e.target.value=''}});
document.addEventListener('error',e=>{if(e.target.tagName==='IMG')e.target.hidden=true},true);
$('#new').onclick=()=>edit(null);$('#menu').onclick=()=>$('#sidebar').classList.toggle('show');
$('#nav').onclick=()=>$('#sidebar').classList.remove('show');
window.onhashchange=()=>{render();window.scrollTo(0,0)};
window.addEventListener('storage',e=>{if(!accountSession&&!accountBusy&&e.key===key&&e.newValue){state=JSON.parse(e.newValue);render()}});
render();
