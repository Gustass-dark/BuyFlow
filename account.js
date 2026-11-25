'use strict';
let accountSession=null;
let accountBusy=false;
let revision=0;
const verifierKey='buyflow-oauth-verifier';
const accountStore='buyflow-account-tab';
const accountDialog=$('#accountDialog');
const accountReady=Boolean(buyflowProject.url&&buyflowProject.publishableKey);
const blankPlan=()=>({version:2,cats:[...categories],items:[],budgets:{}});
function switchPlan(plan){
 const productDialog=$('dialog');
 if(productDialog.open)productDialog.close();
 editing=null;filters={query:'',cat:'',priority:'',status:'',fav:false};state=plan;render();
}
async function request(path,body,token,method,extra={}){
 const response=await fetch(buyflowProject.url.replace(/\/$/,'')+path,{
  method:method||(body?'POST':'GET'),cache:'no-store',
  headers:{apikey:buyflowProject.publishableKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...extra},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 if(!response.ok){const err=new Error('HTTP '+response.status);err.status=response.status;throw err}
 const raw=await response.text();return raw?JSON.parse(raw):null;
}
function sessionFrom(data){
 if(!data.user?.id||!data.access_token||!data.refresh_token)throw new Error('Sessão inválida');
 return {user:data.user.id,email:data.user.email,token:data.access_token,refresh:data.refresh_token,expires:Date.now()+1000*data.expires_in};
}
function remember(session){sessionStorage.setItem(accountStore,JSON.stringify(session));accountSession=session}
async function currentToken(){
 if(accountSession.expires<Date.now()+60000){
  const renewed=sessionFrom(await request('/auth/v1/token?grant_type=refresh_token',{refresh_token:accountSession.refresh}));
  if(renewed.user!==accountSession.user)throw new Error('Conta diferente');
  remember(renewed);
 }
 return accountSession.token;
}
const planPath='/rest/v1/buyflow_plans';
function userFilter(){return '?user_id=eq.'+encodeURIComponent(accountSession.user)}
async function readOnline(){
 const rows=await request(planPath+userFilter()+'&select=plan,revision',null,await currentToken());
 const plan=rows[0]?.plan??blankPlan();
 if(!validateBackup(plan))throw new Error('Planejamento inválido');
 revision=rows[0]?.revision||0;switchPlan(plan);
 $('#syncLabel').textContent=accountSession.email;
}
let loaded=false;
async function saveOnline(next){
 if(!loaded){await notifyUser('Abra Minha conta e recarregue seu planejamento antes de editar.');return false}
 accountBusy=true;
 try{
  const token=await currentToken(),data={revision:revision+1,plan:next};
  const rows=revision
   ?await request(planPath+userFilter()+'&revision=eq.'+revision,data,token,'PATCH',{Prefer:'return=representation'})
   :await request(planPath,{...data,user_id:accountSession.user},token,'POST',{Prefer:'return=representation'});
  if(!rows?.length){const err=new Error('Conflito');err.status=409;throw err}
  revision=rows[0].revision;state=next;return true;
 }catch(err){
  if(err.status===409){await notifyUser('Outro dispositivo salvou uma alteração. A versão mais recente será carregada. Confira os dados e repita sua edição.');try{await readOnline()}catch{loaded=false}}
  else await notifyUser('Não foi possível confirmar o salvamento na conta. Verifique a conexão e tente novamente.');
  return false;
 }finally{accountBusy=false}
}
function accountPanel(msg=''){
 const body=$('#accountBody');
 body.innerHTML=accountSession
  ?'<p class="sub"></p><div class="actions"><button data-account="reload">Atualizar lista da conta</button><button data-account="import">Importar lista deste navegador</button><button data-account="logout">Sair</button></div>'
  :'<p class="sub">Acesse seu planejamento em qualquer computador com sua conta do GitHub.</p><button class="primary" data-account="github">Entrar com GitHub</button>';
 if(accountSession)body.querySelector('p').textContent=accountSession.email;
 const message=document.createElement('p');message.setAttribute('role','status');message.className='sub';message.textContent=msg;body.append(message);
}
async function loadAccount(){loaded=false;switchPlan(blankPlan());await readOnline();loaded=true}
async function accountTask(fn){if(accountBusy)return;accountBusy=true;try{await fn()}catch(e){accountPanel(e.status===429?'Limite de tentativas atingido. Aguarde antes de tentar novamente.':'Não foi possível concluir. Confira a conexão e tente entrar novamente.')}finally{accountBusy=false}}
$('#accountButton').hidden=!accountReady;
$('#accountButton').onclick=()=>{accountPanel();accountDialog.showModal()};
$('#accountClose').onclick=()=>accountDialog.close();
async function startGitHub(){
 const random=crypto.getRandomValues(new Uint8Array(48));
 const verifier=Array.from(random,b=>b.toString(16).padStart(2,'0')).join('');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));
 const challenge=btoa(String.fromCharCode(...new Uint8Array(digest))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
 const destination=new URL('/auth/v1/authorize',buyflowProject.url);
 destination.search=new URLSearchParams({provider:'github',redirect_to:location.origin+location.pathname,code_challenge:challenge,code_challenge_method:'s256'}).toString();
 sessionStorage.setItem(verifierKey,verifier);
 location.assign(destination.href);
}
accountDialog.addEventListener('click',async e=>{
 const act=e.target.closest('[data-account]')?.dataset.account;if(!act||accountBusy)return;
 if(act==='github'){await accountTask(startGitHub);return}
 if(act==='import'){
  const local=init();
  if(!validateBackup(local))return accountPanel('A lista local não pôde ser lida.');
  if(!await confirmChange('Importar lista local?', 'Os '+local.items.length+' produtos deste navegador vão substituir o planejamento de '+accountSession.email+'.', 'Substituir planejamento'))return;
  if(await saveOnline(local)){render();accountPanel('Lista importada para a conta.')}return;
 }
 await accountTask(async()=>{
  if(act==='reload'){await readOnline();loaded=true;accountPanel('Lista atualizada.')}
  if(act==='logout'){
   try{await request('/auth/v1/logout?scope=local',{},await currentToken())}finally{
    sessionStorage.removeItem(accountStore);accountSession=null;loaded=false;revision=0;
    switchPlan(init());$('#syncLabel').textContent='Salvo neste navegador';accountPanel();accountDialog.close()
   }
  }
 });
});
async function resumeAccount(){
 if(!accountReady)return;
 const url=new URL(location.href);
 const code=url.searchParams.get('code');
 const error=url.searchParams.has('error')||new URLSearchParams(url.hash.slice(1)).has('error');
 if(code||error){
  const verifier=sessionStorage.getItem(verifierKey);
  sessionStorage.removeItem(verifierKey);
  history.replaceState(null,'',url.pathname);
  accountDialog.showModal();
  if(error||!verifier){accountPanel('Entrada interrompida. Inicie o login novamente nesta aba.');return}
  await accountTask(async()=>{
   const session=sessionFrom(await request('/auth/v1/token?grant_type=pkce',{auth_code:code,code_verifier:verifier}));
   remember(session);await loadAccount();accountPanel('Você entrou com o GitHub.');
  });
  return;
 }
 const raw=sessionStorage.getItem(accountStore);
 if(raw)await accountTask(async()=>{accountSession=JSON.parse(raw);await loadAccount()});
}
resumeAccount();
