/* ===================================================
   HubVendasPro — script.js  (Supabase Edition)
   =================================================== */

/* ─── Supabase Config ─── */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://ykfvccrfylnlbooqdrvu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZnZjY3JmeWxubGJvb3FkcnZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDU2MjIsImV4cCI6MjA4ODIyMTYyMn0.aGoGx4g4u4cDinsHcm4QGcp6aL_KXs8VUsKXuyKBGdE";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ─── Estado global ─── */
let produtos  = [];
let historico = [];
let pedidosRT = [];
let clientes  = [];

let carrinho               = {};
let usuarioAtual           = null;  // objeto Supabase User
let editandoId             = null;
let editandoClienteId      = null;
let pagamentosSelecionados = ["dinheiro"];
let splitPagamento         = {};
let tipoDesconto           = "pct";
let categoriaAtiva         = "todas";
let filtroDashboard        = "hoje";
let filtroHistorico        = "hoje";
let tipoHistorico          = "completo";
let filtroRelatorio        = "hoje";
let vendaComprovanteAtual  = null;

let editarVendaIdx     = null;
let editarItens        = [];
let editarPagamentos   = ["dinheiro"];
let editarSplit        = {};
let editarTipoDesconto = "pct";
let idsPedidosRTConhecidos = new Set();
let audioContextPedidos = null;
let audioPedidosLiberado = false;

function chaveNotificacoesPedidos() { return usuarioAtual ? `hvp-notificacoes-pedidos-${usuarioAtual.id}` : "hvp-notificacoes-pedidos"; }
function notificacoesPedidosAtivas() { return localStorage.getItem(chaveNotificacoesPedidos()) === "1"; }
function fecharModaisAbertos() {
  document.querySelectorAll(".modal-overlay:not(.hidden)").forEach(modal => modal.classList.add("hidden"));
  vendaComprovanteAtual = null;
  editarVendaIdx = null;
}
window.addEventListener("popstate", fecharModaisAbertos);

const ICONE_PAGAMENTO = { dinheiro: "💵 Dinheiro", cartao: "💳 Cartão", pix: "⚡ Pix" };
const MENU_PADRAO = [
  { id: "dashboard",     icon: "📊", label: "Dashboard",    bnav: "Dash"      },
  { id: "vendas",        icon: "🛒", label: "Vendas",       bnav: "Vendas"    },
  { id: "admin",         icon: "📦", label: "Produtos",     bnav: "Produtos"  },
  { id: "clientes",      icon: "👥", label: "Clientes",     bnav: "Clientes"  },
  { id: "historico",     icon: "📋", label: "Histórico",    bnav: "Histórico" },
  { id: "atendimento",   icon: "📡", label: "Atendimento RT", bnav: "Atend.RT"},
  { id: "configuracoes", icon: "⚙️", label: "Configurações", bnav: "Config"   },
];

/* ─── Toast ─── */
function mostrarToast(msg, tipo="ok") {
  const ex = document.querySelector(".hvp-toast"); if (ex) ex.remove();
  const t = document.createElement("div"); t.className=`hvp-toast hvp-toast-${tipo}`; t.textContent=msg; document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("hvp-toast-show"));
  setTimeout(() => { t.classList.remove("hvp-toast-show"); setTimeout(() => t.remove(), 400); }, 3000);
}
function confirmar(msg) {
  return new Promise(res => {
    const o = document.createElement("div"); o.className="hvp-confirm-overlay";
    o.innerHTML=`<div class="hvp-confirm-box"><p class="hvp-confirm-msg">${msg}</p><div class="hvp-confirm-btns"><button class="btn-ghost hvp-confirm-nao">Cancelar</button><button class="btn-primary hvp-confirm-sim">Confirmar</button></div></div>`;
    document.body.appendChild(o);
    o.querySelector(".hvp-confirm-sim").onclick = () => { o.remove(); res(true); };
    o.querySelector(".hvp-confirm-nao").onclick = () => { o.remove(); res(false); };
  });
}

/* ─── Loading overlay ─── */
function mostrarLoading(msg="Carregando...") {
  let el = document.getElementById("hvp-loading");
  if (!el) {
    el = document.createElement("div"); el.id="hvp-loading";
    el.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:9999;display:flex;align-items:center;justify-content:center;";
    el.innerHTML=`<div style="background:var(--surface);border-radius:12px;padding:24px 32px;font-size:15px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:12px;box-shadow:0 8px 32px rgba(0,0,0,0.18)"><span style="font-size:22px">⏳</span><span id="hvp-loading-msg">${msg}</span></div>`;
    document.body.appendChild(el);
  } else { document.getElementById("hvp-loading-msg").textContent=msg; el.style.display="flex"; }
}
function esconderLoading() { const el=document.getElementById("hvp-loading"); if(el) el.style.display="none"; }

/* ─── Utils ─── */
function emailValido(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()); }
function fmt(v) { return v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function hojeStr()   { return new Date().toLocaleDateString("pt-BR"); }
function agoraHora() { return new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}); }
function parseDDMMYYYY(s) { if (!s) return null; const [d,m,y]=s.split("/"); return new Date(+y,+m-1,+d); }

function formatarTelefone(v) {
  v = v.replace(/\D/g,"");
  if (v.length===0) return "";
  if (v.length<=2) return `(${v}`;
  if (v.length<=6) return `(${v.slice(0,2)})${v.slice(2)}`;
  if (v.length<=10) return `(${v.slice(0,2)})${v.slice(2,6)}-${v.slice(6)}`;
  return `(${v.slice(0,2)})${v.slice(2,7)}-${v.slice(7,11)}`;
}
function formatarCpf(v) {
  v = v.replace(/\D/g,"");
  if (v.length===0) return "";
  if (v.length<=3) return v;
  if (v.length<=6) return `${v.slice(0,3)}.${v.slice(3)}`;
  if (v.length<=9) return `${v.slice(0,3)}.${v.slice(3,6)}.${v.slice(6)}`;
  return `${v.slice(0,3)}.${v.slice(3,6)}.${v.slice(6,9)}-${v.slice(9,11)}`;
}

function intervalo(f, idI, idF) {
  const ag=new Date(), meia=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
  if (f==="hoje")   return {de:meia(ag),ate:meia(ag)};
  if (f==="semana") { const d=new Date(ag); d.setDate(d.getDate()-6); return {de:meia(d),ate:meia(ag)}; }
  if (f==="mes")    { const d=new Date(ag); d.setDate(d.getDate()-29); return {de:meia(d),ate:meia(ag)}; }
  if (f==="custom") { const i=document.getElementById(idI)?.value, fi=document.getElementById(idF)?.value; return {de:i?new Date(i+"T00:00:00"):null,ate:fi?new Date(fi+"T00:00:00"):null}; }
  return {de:null,ate:null};
}
function vendaNoIntervalo(v,{de,ate}) {
  if (!de&&!ate) return true;
  const d=parseDDMMYYYY(v.data); if (!d) return false;
  if (de&&d<de) return false; if (ate&&d>ate) return false; return true;
}

/* ─────────────────────────────────────────
   SUPABASE — CARREGAR DADOS DO USUÁRIO
───────────────────────────────────────── */
async function carregarDadosUsuario() {
  mostrarLoading("Sincronizando dados...");
  // Timeout de segurança: se travar por mais de 10s, esconde o loading mesmo assim
  const timeoutId = setTimeout(() => {
    esconderLoading();
    mostrarToast("Tempo esgotado ao sincronizar. Recarregue a página.","erro");
  }, 10000);
  try {
    const uid = usuarioAtual.id;

    // Carrega tudo em paralelo
    const [prodRes, histRes, cliRes, cfgRes, rtRes] = await Promise.all([
      supabase.from("produtos").select("*").eq("user_id", uid),
      supabase.from("historico").select("*").eq("user_id", uid).order("created_at", { ascending: true }),
      supabase.from("clientes").select("*").eq("user_id", uid),
      supabase.from("config").select("*").eq("user_id", uid).maybeSingle(),
      supabase.from("pedidos_rt").select("*").eq("loja_user_id", uid).order("created_at", { ascending: true }),
    ]);

    if (prodRes.error) throw new Error("produtos: " + prodRes.error.message);
    if (histRes.error) throw new Error("historico: " + histRes.error.message);
    if (cliRes.error) throw new Error("clientes: " + cliRes.error.message);
    if (rtRes.error) throw new Error("pedidos_rt: " + rtRes.error.message);

    produtos = (prodRes.data || []).map(p => ({
      firestoreId: p.id,
      id:          p.internal_id || 0,
      skuId:       p.sku_id,
      nome:        p.nome,
      preco:       p.preco,
      custo:       Number(p.custo) || 0,
      estoque:     Number(p.estoque) || 0,
      categoria:   p.categoria || "",
      fotoKey:     p.foto_key || "",
      fotoUrl:     p.foto_url || "",
    }));

    historico = (histRes.data || []).map(h => ({
      firestoreId:  h.id,
      id:           h.internal_id,
      data:         h.data,
      hora:         h.hora,
      itens:        h.itens || [],
      subtotal:     h.subtotal,
      desconto:     h.desconto,
      total:        h.total,
      pagamento:    h.pagamento,
      pagamentos:   h.pagamentos || {},
      clienteId:    h.cliente_id,
      clienteNome:  h.cliente_nome || "",
      cancelada:    h.cancelada || false,
    }));
    pedidosRT = (rtRes.data || []).map(normalizarPedidoRT);

    clientes = (cliRes.data || []).map(c => ({
      firestoreId: c.id,
      id:          c.internal_id,
      nome:        c.nome || "",
      telefone:    c.telefone || "",
      cpf:         c.cpf || "",
      email:       c.email || "",
      endereco:    c.endereco || "",
    }));

    const cfgData = cfgRes.data;
    if (cfgData) {
      lojaConfigAtual = cfgData.loja_config || {nome:"",cor:"#00bf63",fonte:"jakarta",whatsapp:"",cupom_codigo:"",cupom_percentual:0};
      lojaConfigAtual._avatarUrl = cfgData.avatar_url || "";
      if (cfgData.tema) document.documentElement.setAttribute("data-theme", cfgData.tema);
      if (cfgData.menu_ordem) _menuOrdemLocal = cfgData.menu_ordem;
      catalogoSelecionado = cfgData.catalogo_produtos || [];
    }

  } catch(e) {
    console.error("Erro ao carregar dados:", e);
    mostrarToast("Erro ao carregar dados: " + e.message,"erro");
  } finally {
    clearTimeout(timeoutId);
    esconderLoading();
  }
}

/* ─────────────────────────────────────────
   SUPABASE — SALVAR / ATUALIZAR / DELETAR
───────────────────────────────────────── */

// Produtos
async function fbSalvarProduto(produto) {
  const uid = usuarioAtual.id;
  const payload = {
    user_id:     uid,
    internal_id: produto.id,
    sku_id:      produto.skuId,
    nome:        produto.nome,
    preco:       produto.preco,
    custo:       Number(produto.custo) || 0,
    estoque:     Math.max(0, Math.floor(Number(produto.estoque) || 0)),
    categoria:   produto.categoria || "",
    foto_key:    produto.fotoKey || "",
    foto_url:    produto.fotoUrl || "",
  };
  if (produto.firestoreId) {
    const { error } = await supabase.from("produtos").update(payload).eq("id", produto.firestoreId);
    if (error) throw new Error("Erro ao atualizar produto: " + error.message);
    return produto.firestoreId;
  } else {
    const { data, error } = await supabase.from("produtos").insert(payload).select().single();
    if (error) throw new Error("Erro ao inserir produto: " + error.message);
    return data.id;
  }
}
async function fbDeletarProduto(firestoreId) {
  try {
    const { error } = await supabase.from("produtos").delete().eq("id", firestoreId);
    if (error) throw error;
  } catch(e) { mostrarToast("Erro ao deletar produto.","erro"); }
}

// Histórico
async function fbSalvarVenda(venda) {
  try {
    const uid = usuarioAtual.id;
    const payload = {
      user_id:      uid,
      internal_id:  venda.id,
      data:         venda.data,
      hora:         venda.hora,
      itens:        venda.itens,
      subtotal:     venda.subtotal,
      desconto:     venda.desconto,
      total:        venda.total,
      pagamento:    venda.pagamento,
      pagamentos:   venda.pagamentos || {},
      cliente_id:   venda.clienteId || null,
      cliente_nome: venda.clienteNome || "",
      cancelada:    venda.cancelada || false,
    };
    if (venda.firestoreId) {
      const { error } = await supabase.from("historico").update(payload).eq("id", venda.firestoreId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from("historico").insert(payload).select().single();
      if (error) throw error;
      return data.id;
    }
  } catch(e) { mostrarToast("Erro ao salvar venda.","erro"); console.error(e); return null; }
}
async function fbAtualizarVenda(firestoreId, dados) {
  try {
    // Mapeia campos do padrão antigo para os nomes das colunas do Supabase
    const payload = {};
    if (dados.cancelada  !== undefined) payload.cancelada    = dados.cancelada;
    if (dados.itens      !== undefined) payload.itens        = dados.itens;
    if (dados.subtotal   !== undefined) payload.subtotal     = dados.subtotal;
    if (dados.desconto   !== undefined) payload.desconto     = dados.desconto;
    if (dados.total      !== undefined) payload.total        = dados.total;
    if (dados.pagamento  !== undefined) payload.pagamento    = dados.pagamento;
    if (dados.pagamentos !== undefined) payload.pagamentos   = dados.pagamentos;
    const { error } = await supabase.from("historico").update(payload).eq("id", firestoreId);
    if (error) throw error;
  } catch(e) { mostrarToast("Erro ao atualizar venda.","erro"); }
}

// Clientes
async function fbSalvarCliente(cliente) {
  try {
    const uid = usuarioAtual.id;
    const payload = {
      user_id:     uid,
      internal_id: cliente.id,
      nome:        cliente.nome || "",
      telefone:    cliente.telefone || "",
      cpf:         cliente.cpf || "",
      email:       cliente.email || "",
      endereco:    cliente.endereco || "",
    };
    if (cliente.firestoreId) {
      const { error } = await supabase.from("clientes").update(payload).eq("id", cliente.firestoreId);
      if (error) throw error;
      return cliente.firestoreId;
    } else {
      const { data, error } = await supabase.from("clientes").insert(payload).select().single();
      if (error) throw error;
      return data.id;
    }
  } catch(e) { mostrarToast("Erro ao salvar cliente.","erro"); console.error(e); return null; }
}
async function fbDeletarCliente(firestoreId) {
  try {
    const { error } = await supabase.from("clientes").delete().eq("id", firestoreId);
    if (error) throw error;
  } catch(e) { mostrarToast("Erro ao deletar cliente.","erro"); }
}

// Config geral
async function fbSalvarConfig(dados) {
  try {
    const uid = usuarioAtual.id;
    // Mapeia nomes do padrão antigo para colunas do Supabase
    const payload = { user_id: uid, updated_at: new Date().toISOString() };
    if (dados.tema       !== undefined) payload.tema        = dados.tema;
    if (dados.lojaConfig !== undefined) payload.loja_config = dados.lojaConfig;
    if (dados.menuOrdem  !== undefined) payload.menu_ordem  = dados.menuOrdem;
    if (dados.avatar_url !== undefined) payload.avatar_url  = dados.avatar_url;
    if (dados.catalogoProdutos !== undefined) payload.catalogo_produtos = dados.catalogoProdutos;
    const { error } = await supabase.from("config").upsert(payload, { onConflict: "user_id" });
    if (error) throw error;
  } catch(e) { console.error("Erro ao salvar config:", e); }
}

/* ─────────────────────────────────────────
   IndexedDB — IMAGENS LOCAIS
   Imagens ficam no IndexedDB local para performance.
───────────────────────────────────────── */
const DB_NAME = "hvp_images"; let db_idb = null;
function abrirDB() {
  return new Promise((res, rej) => {
    if (db_idb) { res(db_idb); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => { if (!e.target.result.objectStoreNames.contains("images")) e.target.result.createObjectStore("images"); };
    req.onsuccess = e => { db_idb = e.target.result; res(db_idb); };
    req.onerror   = e => rej(e);
  });
}
async function salvarImagem(k, b64) {
  try {
    const idb = await abrirDB();
    await new Promise((res,rej) => { const tx = idb.transaction("images","readwrite"); tx.objectStore("images").put(b64,k).onsuccess = () => res(true); tx.onerror = () => rej(); });
    return true;
  } catch { return false; }
}
async function carregarImagem(k) {
  try {
    const idb = await abrirDB();
    return await new Promise(res => { const req = idb.transaction("images","readonly").objectStore("images").get(k); req.onsuccess = () => res(req.result||null); req.onerror = () => res(null); });
  } catch { return null; }
}
async function removerImagem(k) {
  try {
    const idb = await abrirDB();
    await new Promise(res => { idb.transaction("images","readwrite").objectStore("images").delete(k); res(true); });
    return true;
  } catch { return false; }
}

/* ─────────────────────────────────────────
   NOME DA LOJA
───────────────────────────────────────── */
const LOJA_CORES=[{hex:"#00bf63",label:"Verde"},{hex:"#e53935",label:"Vermelho"},{hex:"#2563eb",label:"Azul"},{hex:"#f59e0b",label:"Amarelo"},{hex:"#8b5cf6",label:"Roxo"},{hex:"#ec4899",label:"Rosa"},{hex:"#0d9488",label:"Teal"},{hex:"#ea580c",label:"Laranja"},{hex:"#0d0d0d",label:"Preto"}];
const LOJA_FONTES=[{id:"jakarta",label:"Plus Jakarta Sans",css:"'Plus Jakarta Sans', sans-serif"},{id:"mono",label:"DM Mono",css:"'DM Mono', monospace"},{id:"serif",label:"Georgia (Serif)",css:"Georgia, serif"},{id:"rounded",label:"Verdana",css:"Verdana, sans-serif"}];
let lojaConfigAtual={nome:"",cor:"#00bf63",fonte:"jakarta",whatsapp:"",cupom_codigo:"",cupom_percentual:0};
let _menuOrdemLocal = null;
let catalogoSelecionado = [];   // array de firestoreId (uuid) dos produtos no catálogo público
let canalPedidosRT = null;      // referência do canal Realtime (Atendimento RT)
let timerFeedPedidosRT = null;
let timerPollingPedidosRT = null;

function salvarLojaConfig() {
  fbSalvarConfig({ lojaConfig: lojaConfigAtual });
}
function salvarNomeLoja() { lojaConfigAtual.nome=document.getElementById("nomeLoja").value.trim(); salvarLojaConfig(); aplicarNomeLoja(); atualizarPreviewLoja(); mostrarToast(lojaConfigAtual.nome?"✅ Nome da loja salvo!":"✅ Nome removido."); }
function salvarWhatsappLoja() { lojaConfigAtual.whatsapp=document.getElementById("whatsappLoja").value.trim(); salvarLojaConfig(); mostrarToast("✅ WhatsApp salvo! Ele é usado no catálogo público (Atendimento RT)."); }
function salvarCupomLoja() {
  const codigo = document.getElementById("cupomCodigoLoja")?.value.trim().toUpperCase() || "";
  const percentual = Math.min(100, Math.max(0, parseFloat(document.getElementById("cupomPercentualLoja")?.value) || 0));
  if (codigo && percentual <= 0) { mostrarToast("Informe uma porcentagem válida para o cupom.","erro"); return; }
  lojaConfigAtual.cupom_codigo = codigo;
  lojaConfigAtual.cupom_percentual = codigo ? percentual : 0;
  salvarLojaConfig();
  const codigoInput = document.getElementById("cupomCodigoLoja"); if (codigoInput) codigoInput.value = codigo;
  const percentualInput = document.getElementById("cupomPercentualLoja"); if (percentualInput) percentualInput.value = codigo ? percentual : "";
  mostrarToast(codigo ? "✅ Cupom salvo!" : "✅ Cupom removido.");
}
function selecionarCorLoja(hex,custom=false) { lojaConfigAtual.cor=hex; document.querySelectorAll(".color-swatch").forEach(s=>s.classList.toggle("ativo",s.dataset.cor===hex)); if (!custom) { const p=document.getElementById("lojaCorCustom"); if (p) p.value=hex; } salvarLojaConfig(); aplicarNomeLoja(); atualizarPreviewLoja(); }
function selecionarFonteLoja(id) { lojaConfigAtual.fonte=id; document.querySelectorAll(".btn-font-opcao").forEach(b=>b.classList.toggle("ativo",b.dataset.fonte===id)); salvarLojaConfig(); aplicarNomeLoja(); atualizarPreviewLoja(); }
function atualizarPreviewLoja() { const el=document.getElementById("lojaPreviewNome"); if (!el) return; const nome=document.getElementById("nomeLoja")?.value.trim()||lojaConfigAtual.nome; const fonte=LOJA_FONTES.find(f=>f.id===lojaConfigAtual.fonte)||LOJA_FONTES[0]; el.textContent=nome||"Nome da loja"; el.style.color=lojaConfigAtual.cor; el.style.fontFamily=fonte.css; }
function aplicarNomeLoja() {
  const {nome,cor,fonte:fid}=lojaConfigAtual, fonte=LOJA_FONTES.find(f=>f.id===fid)||LOJA_FONTES[0];
  const sb=document.getElementById("sidebarLojaBadge"), tb=document.getElementById("topbarLojaBadge");
  if (!nome) { if (sb) sb.style.display="none"; if (tb) tb.style.display="none"; return; }
  const est=`color:${cor};font-family:${fonte.css};border-color:${cor};background:${cor}18;`;
  if (sb) { sb.textContent=nome; sb.style.cssText=est; sb.style.display="block"; }
  if (tb) { tb.textContent=nome; tb.style.cssText=est; tb.style.display="inline-block"; }
}
function renderLojaConfigUI() {
  const sc=document.getElementById("lojaColorSwatches");
  if (sc) { sc.innerHTML=LOJA_CORES.map(c=>`<div class="color-swatch ${lojaConfigAtual.cor===c.hex?"ativo":""}" style="background:${c.hex}" data-cor="${c.hex}" title="${c.label}" onclick="selecionarCorLoja('${c.hex}')"></div>`).join(""); const p=document.getElementById("lojaCorCustom"); if (p) p.value=lojaConfigAtual.cor; }
  const fc=document.getElementById("lojaFontOpcoes");
  if (fc) fc.innerHTML=LOJA_FONTES.map(f=>`<button class="btn-font-opcao ${lojaConfigAtual.fonte===f.id?"ativo":""}" data-fonte="${f.id}" style="font-family:${f.css}" onclick="selecionarFonteLoja('${f.id}')">${f.label}</button>`).join("");
  atualizarPreviewLoja();
}

/* ─────────────────────────────────────────
   MENU ORDEM
───────────────────────────────────────── */
function getOrdemMenu() {
  const s = _menuOrdemLocal;
  if (s) { const todos=MENU_PADRAO.map(m=>m.id), extras=todos.filter(id=>!s.includes(id)); return [...s,...extras]; }
  return MENU_PADRAO.map(m=>m.id);
}
function salvarOrdemMenu(o) { _menuOrdemLocal=o; fbSalvarConfig({ menuOrdem: o }); }
function resetarOrdemMenu() { _menuOrdemLocal=null; fbSalvarConfig({ menuOrdem: null }); renderNavs(); renderMenuOrderList(); mostrarToast("Menu restaurado."); }
function getMenuOrdenado() { return getOrdemMenu().map(id=>MENU_PADRAO.find(m=>m.id===id)).filter(Boolean); }

function renderNavs(paginaAtiva) {
  const items=getMenuOrdenado(), pagina=paginaAtiva||document.querySelector(".page.active")?.id?.replace("page-","")||"vendas";
  const sn=document.getElementById("sidebarNav");
  if (sn) {
    sn.innerHTML="";
    items.forEach(item => {
      const b=document.createElement("button"); b.className=`nav-item${item.id===pagina?" active":""}`; b.id=`nav-${item.id}`; b.draggable=true;
      b.innerHTML=`<span class="nav-icon">${item.icon}</span><span class="nav-label">${item.label}</span><span class="nav-drag-handle">⠿</span>`;
      b.onclick=()=>navegarPara(item.id); sn.appendChild(b);
    }); initDragSidebar();
  }
  const bn=document.getElementById("bottomNav");
  if (bn) {
    bn.innerHTML="";
    items.filter(i=>i.id!=="configuracoes").slice(0,5).forEach(item => {
      const b=document.createElement("button"); b.className=`bnav-item${item.id===pagina?" active":""}`; b.id=`bnav-${item.id}`;
      if (item.id === "historico") {
        const menuAtivo = ["historico", "clientes", "configuracoes"].includes(pagina);
        b.className=`bnav-item bnav-more-trigger${menuAtivo?" active":""}`;
        b.id="bnav-mobile-more";
        b.innerHTML=`<span>☰</span><span>Mais</span>`;
        b.onclick=toggleMobileMoreMenu;
      } else {
        b.innerHTML=`<span>${item.icon}</span><span>${item.bnav}</span>`;
        b.onclick=()=>{fecharMobileMoreMenu();navegarPara(item.id);};
      }
      bn.appendChild(b);
    }); initDragBottomNav();
  }
}

function toggleMobileMoreMenu() {
  const menu=document.getElementById("mobileMoreMenu"); if (!menu) return;
  const aberto=menu.classList.toggle("aberto");
  menu.setAttribute("aria-hidden", String(!aberto));
}
function fecharMobileMoreMenu() {
  const menu=document.getElementById("mobileMoreMenu"); if (!menu) return;
  menu.classList.remove("aberto");
  menu.setAttribute("aria-hidden", "true");
}
document.addEventListener("click", e => {
  const menu=document.getElementById("mobileMoreMenu"), trigger=document.getElementById("bnav-mobile-more");
  if (menu?.classList.contains("aberto") && !menu.contains(e.target) && e.target!==trigger && !trigger?.contains(e.target)) fecharMobileMoreMenu();
});
document.addEventListener("keydown", e => { if (e.key === "Escape") fecharMobileMoreMenu(); });
document.querySelectorAll(".mobile-more-option").forEach(button => {
  button.addEventListener("click", () => { fecharMobileMoreMenu(); navegarPara(button.dataset.mobilePage); });
});
document.getElementById("mobileMoreClose")?.addEventListener("click", fecharMobileMoreMenu);

let dragSrcSidebar=null, dragSrcBnav=null, dragSrcConfig=null;
function initDragSidebar() {
  document.querySelectorAll("#sidebarNav .nav-item").forEach(el=>{
    el.addEventListener("dragstart",e=>{dragSrcSidebar=el;el.classList.add("dragging");e.dataTransfer.effectAllowed="move";});
    el.addEventListener("dragend",()=>{el.classList.remove("dragging");document.querySelectorAll("#sidebarNav .nav-item").forEach(n=>n.classList.remove("drag-over"));});
    el.addEventListener("dragover",e=>{e.preventDefault();document.querySelectorAll("#sidebarNav .nav-item").forEach(n=>n.classList.remove("drag-over"));if(el!==dragSrcSidebar)el.classList.add("drag-over");});
    el.addEventListener("drop",e=>{e.stopPropagation();if(el!==dragSrcSidebar){const all=[...document.querySelectorAll("#sidebarNav .nav-item")],fi=all.indexOf(dragSrcSidebar),ti=all.indexOf(el),nav=document.getElementById("sidebarNav");if(fi<ti)nav.insertBefore(dragSrcSidebar,el.nextSibling);else nav.insertBefore(dragSrcSidebar,el);const no=[...document.querySelectorAll("#sidebarNav .nav-item")].map(b=>b.id.replace("nav-",""));salvarOrdemMenu([...no,...MENU_PADRAO.map(m=>m.id).filter(id=>!no.includes(id))]);renderNavs();renderMenuOrderList();}});
  });
}
function initDragBottomNav() {
  document.querySelectorAll("#bottomNav .bnav-item").forEach(el=>{
    el.draggable=true;
    el.addEventListener("dragstart",e=>{dragSrcBnav=el;e.dataTransfer.effectAllowed="move";});
    el.addEventListener("dragover",e=>e.preventDefault());
    el.addEventListener("drop",e=>{e.stopPropagation();if(el!==dragSrcBnav){const all=[...document.querySelectorAll("#bottomNav .bnav-item")],fi=all.indexOf(dragSrcBnav),ti=all.indexOf(el),nav=document.getElementById("bottomNav");if(fi<ti)nav.insertBefore(dragSrcBnav,el.nextSibling);else nav.insertBefore(dragSrcBnav,el);const bo=[...document.querySelectorAll("#bottomNav .bnav-item")].map(b=>b.id.replace("bnav-",""));const so=[...document.querySelectorAll("#sidebarNav .nav-item")].map(b=>b.id.replace("nav-",""));const m=[...bo];so.forEach(id=>{if(!m.includes(id))m.push(id);});salvarOrdemMenu(m);renderNavs();renderMenuOrderList();}});
  });
}
function renderMenuOrderList() {
  const lista=document.getElementById("menuOrderList"); if (!lista) return;
  lista.innerHTML="";
  getMenuOrdenado().forEach(item=>{
    const div=document.createElement("div"); div.className="menu-order-item"; div.draggable=true; div.dataset.id=item.id;
    div.innerHTML=`<span class="menu-order-icon">${item.icon}</span><span>${item.label}</span><span class="menu-order-handle">⠿</span>`;
    div.addEventListener("dragstart",e=>{dragSrcConfig=div;div.classList.add("dragging");e.dataTransfer.effectAllowed="move";});
    div.addEventListener("dragend",()=>{div.classList.remove("dragging");lista.querySelectorAll(".menu-order-item").forEach(n=>n.classList.remove("drag-over"));});
    div.addEventListener("dragover",e=>{e.preventDefault();lista.querySelectorAll(".menu-order-item").forEach(n=>n.classList.remove("drag-over"));if(div!==dragSrcConfig)div.classList.add("drag-over");});
    div.addEventListener("drop",e=>{e.stopPropagation();if(div!==dragSrcConfig){const all=[...lista.querySelectorAll(".menu-order-item")],fi=all.indexOf(dragSrcConfig),ti=all.indexOf(div);if(fi<ti)lista.insertBefore(dragSrcConfig,div.nextSibling);else lista.insertBefore(dragSrcConfig,div);salvarOrdemMenu([...lista.querySelectorAll(".menu-order-item")].map(d=>d.dataset.id));renderNavs();}});
    lista.appendChild(div);
  });
}

/* ─────────────────────────────────────────
   NAVEGAÇÃO
───────────────────────────────────────── */
function navegarPara(pagina) {
  fecharModaisAbertos();
  if (pagina !== "atendimento" && timerPollingPedidosRT) { clearInterval(timerPollingPedidosRT); timerPollingPedidosRT = null; }
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.getElementById(`page-${pagina}`)?.classList.add("active");
  renderNavs(pagina);
  if (pagina==="dashboard")     renderDashboard();
  if (pagina==="vendas")        { renderProdutos(); popularSelectClientes(); }
  if (pagina==="admin")         { renderProdutosAdmin(); atualizarSugestoesCategorias(); }
  if (pagina==="clientes")      renderClientes();
  if (pagina==="historico")     renderHistorico();
  if (pagina==="atendimento")   renderAtendimentoRT();
  if (pagina==="configuracoes") renderConfiguracoes();
  if (pagina!=="atendimento" && canalPedidosRT) { supabase.removeChannel(canalPedidosRT); canalPedidosRT=null; }
}

/* ─────────────────────────────────────────
   AUTH — SUPABASE
───────────────────────────────────────── */
function toggleSenha(id,el) { const i=document.getElementById(id); if (i.type==="password"){i.type="text";el.textContent="🙈";}else{i.type="password";el.textContent="👁";} }

async function login() {
  const email=document.getElementById("email").value.trim(), senha=document.getElementById("senha").value;
  if (!email||!senha){mostrarToast("Preencha email e senha.","erro");return;}
  if (!emailValido(email)){mostrarToast("Email inválido.","erro");return;}
  mostrarLoading("Entrando...");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) {
    esconderLoading();
    mostrarToast("Email ou senha inválidos.","erro");
    return;
  }
  // Carrega dados manualmente (não depende do onAuthStateChange)
  usuarioAtual = data.user;
  await carregarDadosUsuario();
  entrarNoPainel(data.user);
}

async function registrar() {
  const email=document.getElementById("novoEmail").value.trim(), senha=document.getElementById("novaSenha").value, conf=document.getElementById("confirmarSenha").value;
  if (!email||!senha||!conf){mostrarToast("Preencha todos os campos.","erro");return;}
  if (!emailValido(email)){mostrarToast("Email inválido.","erro");return;}
  if (senha.length<6){mostrarToast("Mínimo 6 caracteres.","erro");return;}
  if (senha!==conf){mostrarToast("Senhas não coincidem.","erro");return;}
  mostrarLoading("Criando conta...");
  const { error } = await supabase.auth.signUp({ email, password: senha });
  if (error) {
    esconderLoading();
    if (error.message?.includes("already")) mostrarToast("Email já cadastrado.","erro");
    else mostrarToast("Erro ao criar conta. Tente novamente.","erro");
  } else {
    esconderLoading();
    mostrarToast("✅ Conta criada! Verifique seu e-mail para confirmar.");
    document.getElementById("novoEmail").value=""; document.getElementById("novaSenha").value=""; document.getElementById("confirmarSenha").value="";
    voltarLogin();
  }
}

async function logout() {
  await supabase.auth.signOut();
}

function mostrarRegistro(){document.getElementById("login").classList.add("hidden");document.getElementById("registro").classList.remove("hidden");}
function voltarLogin(){document.getElementById("registro").classList.add("hidden");document.getElementById("login").classList.remove("hidden");}

// ─── Função chamada ao fazer logout ou sessão expirada ───
function limparSessao() {
  if (canalPedidosRT) { supabase.removeChannel(canalPedidosRT); canalPedidosRT=null; }
  if (timerPollingPedidosRT) { clearInterval(timerPollingPedidosRT); timerPollingPedidosRT=null; }
  usuarioAtual = null;
  produtos=[]; historico=[]; pedidosRT=[]; clientes=[]; carrinho={};
  lojaConfigAtual={nome:"",cor:"#00bf63",fonte:"jakarta",whatsapp:""};
  _menuOrdemLocal=null;
  document.documentElement.setAttribute("data-theme","light");
  document.getElementById("appShell").classList.add("hidden");
  document.getElementById("authScreen").classList.remove("hidden");
  document.getElementById("email").value=""; document.getElementById("senha").value="";
  const sb=document.getElementById("sidebarLojaBadge"),tb=document.getElementById("topbarLojaBadge");
  if (sb) sb.style.display="none"; if (tb) tb.style.display="none";
  document.getElementById("login").classList.remove("hidden");
  document.getElementById("registro").classList.add("hidden");
}

// ─── Observador apenas para SIGNED_OUT ───
// Login e sessão inicial são tratados por iniciarApp() abaixo
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") limparSessao();
});

// ─── Inicialização: verifica sessão existente uma única vez ───
async function iniciarApp() {
  mostrarLoading("Carregando...");
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      usuarioAtual = session.user;
      await carregarDadosUsuario();
      entrarNoPainel(session.user);
    } else {
      limparSessao();
    }
  } catch(e) {
    console.error("[HVP] Erro na inicialização:", e);
    limparSessao();
  } finally {
    esconderLoading();
  }
}

// ─── Modo catálogo público (link para o cliente, sem login) ───
function slugify(str) {
  return (str || "loja").toString().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"") || "loja";
}
function detectarCatalogoId() {
  // Formato novo: #/nome-da-loja/uuid  (funciona em qualquer host estático, sem precisar de rewrite)
  const hashMatch = window.location.hash.match(/^#\/[^/]+\/([0-9a-fA-F-]{36})$/);
  if (hashMatch) return hashMatch[1];
  // Formato antigo (compatibilidade): ?catalogo=uuid
  return new URLSearchParams(window.location.search).get("catalogo");
}
const LOJA_CATALOGO_ID = detectarCatalogoId();

// Inicia quando o DOM estiver pronto
document.addEventListener("DOMContentLoaded", () => {
  if (LOJA_CATALOGO_ID) iniciarModoCatalogo();
  else iniciarApp();
});

function entrarNoPainel(user) {
  carrinho={}; pagamentosSelecionados=["dinheiro"]; splitPagamento={}; tipoDesconto="pct"; categoriaAtiva="todas"; filtroDashboard="hoje"; filtroHistorico="hoje"; filtroRelatorio="hoje";
  document.getElementById("authScreen").classList.add("hidden");
  document.getElementById("appShell").classList.remove("hidden");
  const av = lojaConfigAtual._avatarUrl || null;
  atualizarExibicaoAvatar(av, user.email[0].toUpperCase());
  document.getElementById("emailLogado").textContent=user.email;
  document.getElementById("total").innerText="0,00";
  aplicarNomeLoja();
  renderBotoesPagamento(); renderNavs("vendas");
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.getElementById("page-vendas")?.classList.add("active");
  renderProdutos(); popularSelectClientes();
}

/* ─────────────────────────────────────────
   CLIENTES
───────────────────────────────────────── */
function proximoIdCliente() {
  if (!clientes.length) return 1;
  return Math.max(...clientes.map(c=>c.id||0))+1;
}

async function salvarCliente() {
  const nome=document.getElementById("clienteNome").value.trim();
  const tel=document.getElementById("clienteTelefone").value.trim();
  const cpf=document.getElementById("clienteCpf").value.trim();
  const email=document.getElementById("clienteEmail").value.trim();
  const end=document.getElementById("clienteEndereco").value.trim();
  if (!nome&&!tel&&!cpf&&!email&&!end){mostrarToast("Preencha ao menos um campo.","erro");return;}
  const idx=clientes.findIndex(c=>c.id===editandoClienteId);
  if (editandoClienteId!==null&&idx!==-1) {
    clientes[idx]={...clientes[idx],nome,telefone:tel,cpf,email,endereco:end};
    await fbSalvarCliente(clientes[idx]);
    editandoClienteId=null;
    document.getElementById("clienteFormLabel").textContent="Novo cliente";
    document.getElementById("btnCancelarCliente").style.display="none";
    mostrarToast("✅ Cliente atualizado!");
  } else {
    const novoCliente={id:proximoIdCliente(),nome,telefone:tel,cpf,email,endereco:end};
    const fid = await fbSalvarCliente(novoCliente);
    if (fid) { novoCliente.firestoreId=fid; clientes.push(novoCliente); }
    mostrarToast("✅ Cliente cadastrado!");
  }
  limparCamposCliente(); renderClientes(); popularSelectClientes();
}

function limparCamposCliente() {
  ["clienteNome","clienteTelefone","clienteCpf","clienteEmail","clienteEndereco"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
}

function editarCliente(id) {
  const c=clientes.find(c=>c.id===id); if (!c) return;
  document.getElementById("clienteNome").value=c.nome||"";
  document.getElementById("clienteTelefone").value=c.telefone||"";
  document.getElementById("clienteCpf").value=c.cpf||"";
  document.getElementById("clienteEmail").value=c.email||"";
  document.getElementById("clienteEndereco").value=c.endereco||"";
  editandoClienteId=id;
  document.getElementById("clienteFormLabel").textContent=`Editando: ${c.nome||"cliente"}`;
  document.getElementById("btnCancelarCliente").style.display="inline-flex";
  document.querySelector("#page-clientes .section-card")?.scrollIntoView({behavior:"smooth"});
}
function cancelarEdicaoCliente() {
  editandoClienteId=null; limparCamposCliente();
  document.getElementById("clienteFormLabel").textContent="Novo cliente";
  document.getElementById("btnCancelarCliente").style.display="none";
}
async function excluirCliente(id) {
  const ok=await confirmar("Deseja excluir este cliente?"); if (!ok) return;
  const c=clientes.find(c=>c.id===id);
  if (c?.firestoreId) await fbDeletarCliente(c.firestoreId);
  clientes=clientes.filter(c=>c.id!==id);
  renderClientes(); popularSelectClientes(); mostrarToast("Cliente excluído.");
}

function renderClientes() {
  const lista=document.getElementById("listaClientes"); if (!lista) return;
  const busca=(document.getElementById("buscaClientes")?.value||"").toLowerCase().trim();
  const filtrados=clientes.filter(c=>{
    if (!busca) return true;
    return (c.nome||"").toLowerCase().includes(busca)||(c.telefone||"").includes(busca)||(c.cpf||"").includes(busca)||(c.email||"").toLowerCase().includes(busca);
  });
  if (!filtrados.length) { lista.innerHTML=`<div class="empty-state"><span>👥</span>${busca?"Nenhum cliente encontrado.":"Nenhum cliente cadastrado ainda."}</div>`; return; }
  lista.innerHTML=filtrados.map(c=>`
    <div class="cliente-card">
      <div class="cliente-avatar">${(c.nome||"?")[0].toUpperCase()}</div>
      <div class="cliente-info">
        <p class="cliente-nome">${c.nome||"<em>Sem nome</em>"}</p>
        <div class="cliente-detalhes">
          ${c.telefone?`<span>📱 ${c.telefone}</span>`:""}
          ${c.cpf?`<span>🪪 ${c.cpf}</span>`:""}
          ${c.email?`<span>✉️ ${c.email}</span>`:""}
          ${c.endereco?`<span>📍 ${c.endereco}</span>`:""}
        </div>
      </div>
      <div class="acoes-admin" style="flex-shrink:0">
        <button class="btn-sm btn-sm-edit" onclick="editarCliente(${c.id})">✏️ Editar</button>
        <button class="btn-sm btn-sm-del"  onclick="excluirCliente(${c.id})">🗑</button>
      </div>
    </div>`).join("");
}

function popularSelectClientes() {
  const sel=document.getElementById("clienteSelecionado"); if (!sel) return;
  const atual=sel.value;
  sel.innerHTML=`<option value="">— Venda sem cliente —</option>`+clientes.map(c=>`<option value="${c.id}">${c.nome||"Cliente #"+c.id}${c.telefone?" · "+c.telefone:""}</option>`).join("");
  if (atual) sel.value=atual;
}

/* ─────────────────────────────────────────
   CARRINHO E CÁLCULOS
───────────────────────────────────────── */
function calcularDesconto(sub) {
  const v=parseFloat(document.getElementById("descontoInput")?.value)||0;
  if (v<=0) return 0;
  return tipoDesconto==="pct" ? Math.min(sub, sub*(v/100)) : Math.min(sub,v);
}
function calcularSubtotal() {
  let t=0; for (const id in carrinho) { const p=produtos.find(p=>p.id===Number(id)); if (p) t+=p.preco*carrinho[id]; } return t;
}
function calcularTotalFinal() { const s=calcularSubtotal(), d=calcularDesconto(s); return Math.max(0,s-d); }

function atualizarTotal() {
  const sub=calcularSubtotal(), desc=calcularDesconto(sub), total=Math.max(0,sub-desc);
  const el=document.getElementById("total"); if (el) el.innerText=fmt(total);
  const prev=document.getElementById("descontoPreview");
  if (prev) prev.textContent=desc>0?`Subtotal R$ ${fmt(sub)}  –  Desconto R$ ${fmt(desc)}  =  R$ ${fmt(total)}`:"";
  const resumo=document.getElementById("finalizarResumo");
  if (resumo) { const q=Object.values(carrinho).reduce((a,b)=>a+b,0); resumo.innerHTML=q>0?`<strong>${q}</strong> ite${q>1?"ns":"m"} · Total: <strong>R$ ${fmt(total)}</strong>`:""; }
  renderCarrinho();
  if (pagamentosSelecionados.length>1) renderSplitPagamento();
}

function renderCarrinho() {
  const card=document.getElementById("carrinhoCard"), itensEl=document.getElementById("carrinhoItens"), footerEl=document.getElementById("carrinhoFooter");
  if (!card||!itensEl||!footerEl) return;
  const itensCarrinho=Object.entries(carrinho).filter(([,q])=>q>0);
  if (itensCarrinho.length===0) { card.style.display="none"; return; }
  card.style.display="block";
  const sub=calcularSubtotal(), desc=calcularDesconto(sub), tot=Math.max(0,sub-desc);
  itensEl.innerHTML=itensCarrinho.map(([id,qtd])=>{
    const p=produtos.find(p=>p.id===Number(id)); if (!p) return "";
    return `<div class="carrinho-item">
      <span class="carrinho-item-nome">#${String(p.skuId).padStart(4,"0")} ${p.nome}</span>
      <div class="carrinho-item-ctrl">
        <button class="btn-qtd sm" onclick="alterarQtd(${p.id},-1)">−</button>
        <span class="carrinho-item-qtd">${qtd}</span>
        <button class="btn-qtd sm" onclick="alterarQtd(${p.id},+1)">+</button>
      </div>
      <span class="carrinho-item-preco">R$ ${fmt(p.preco*qtd)}</span>
      <button class="carrinho-item-del" onclick="removerDoCarrinho(${p.id})">✕</button>
    </div>`;
  }).join("");
  footerEl.innerHTML=`
    <div class="carrinho-subtotal-row"><span>Subtotal</span><span class="mono">R$ ${fmt(sub)}</span></div>
    ${desc>0?`<div class="carrinho-subtotal-row desc"><span>Desconto</span><span class="mono red">− R$ ${fmt(desc)}</span></div>`:""}
    <div class="carrinho-subtotal-row total-row"><span>Total</span><span class="mono green">R$ ${fmt(tot)}</span></div>`;
}

function removerDoCarrinho(id) { delete carrinho[id]; atualizarTotal(); renderProdutos(); }
function limparCarrinho() { carrinho={}; atualizarTotal(); renderProdutos(); document.getElementById("carrinhoCard").style.display="none"; }

/* ─── Pagamento múltiplo ─── */
function togglePagamento(tipo) {
  const idx=pagamentosSelecionados.indexOf(tipo);
  if (idx===-1) { pagamentosSelecionados.push(tipo); }
  else { if (pagamentosSelecionados.length===1) { mostrarToast("Selecione ao menos uma forma de pagamento.","erro"); return; } pagamentosSelecionados.splice(idx,1); delete splitPagamento[tipo]; }
  renderBotoesPagamento(); renderSplitPagamento(); atualizarTotal();
}
function renderBotoesPagamento() {
  ["dinheiro","cartao","pix"].forEach(t => { const b=document.getElementById(`pag-${t}`); if (b) b.classList.toggle("ativo",pagamentosSelecionados.includes(t)); });
}
function renderSplitPagamento() {
  const c=document.getElementById("pagamentoSplit"); if (!c) return;
  if (pagamentosSelecionados.length<=1) { c.classList.add("hidden"); c.innerHTML=""; splitPagamento={}; return; }
  c.classList.remove("hidden");
  _renderSplitHTML(c, pagamentosSelecionados, splitPagamento, calcularTotalFinal(), "onSplitInput", "splitAviso");
}
function onSplitInput(tipo) { splitPagamento[tipo]=parseFloat(document.getElementById(`split-input-${tipo}`)?.value)||0; _atualizarResto(pagamentosSelecionados,splitPagamento,calcularTotalFinal(),"splitAviso"); }

function renderEditSplit() {
  const c=document.getElementById("editarPagamentoSplit"); if (!c) return;
  if (editarPagamentos.length<=1) { c.classList.add("hidden"); c.innerHTML=""; editarSplit={}; return; }
  c.classList.remove("hidden");
  _renderSplitHTML(c, editarPagamentos, editarSplit, _calcEditTotal(), "onEditSplitInput", "editSplitAviso");
}
function onEditSplitInput(tipo) { editarSplit[tipo]=parseFloat(document.getElementById(`split-input-${tipo}`)?.value)||0; _atualizarResto(editarPagamentos,editarSplit,_calcEditTotal(),"editSplitAviso"); atualizarEditarTotal(); }

function _renderSplitHTML(container, formas, splits, total, cbInput, cbAviso) {
  let html=`<p style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:.6px">Dividir valor (R$ ${fmt(total)})</p>`;
  formas.forEach((tipo,i) => {
    const isUlt=(i===formas.length-1);
    if (isUlt) { const soma=formas.filter((_,j)=>j!==i).reduce((a,t)=>a+(parseFloat(splits[t])||0),0), resto=Math.max(0,total-soma); html+=`<div class="pagamento-split-row"><span class="pagamento-split-label">${ICONE_PAGAMENTO[tipo]}</span><span class="pagamento-split-resto" id="split-resto-${tipo}">R$ ${fmt(resto)} (restante)</span></div>`; }
    else { const v=splits[tipo]!==undefined?splits[tipo]:""; html+=`<div class="pagamento-split-row"><span class="pagamento-split-label">${ICONE_PAGAMENTO[tipo]}</span><input type="number" class="pagamento-split-input" min="0" step="0.01" id="split-input-${tipo}" value="${v}" placeholder="0,00" oninput="${cbInput}('${tipo}')"></div>`; }
  });
  html+=`<div id="${cbAviso}" style="margin-top:4px"></div>`;
  container.innerHTML=html;
  _atualizarResto(formas, splits, total, cbAviso);
}
function _atualizarResto(formas, splits, total, avisoId) {
  const ultima=formas[formas.length-1], soma=formas.slice(0,-1).reduce((a,t)=>a+(parseFloat(splits[t])||0),0), resto=Math.max(0,total-soma);
  const restoEl=document.getElementById(`split-resto-${ultima}`); if (restoEl) restoEl.textContent=`R$ ${fmt(resto)} (restante)`;
  const aviso=document.getElementById(avisoId); if (!aviso) return;
  aviso.innerHTML=soma>total+.005?`<span class="pagamento-split-aviso">⚠️ A soma ultrapassa o total (R$ ${fmt(total)})</span>`:`<span class="pagamento-split-ok">✓ R$ ${fmt(soma)} + R$ ${fmt(total-soma)} = R$ ${fmt(total)}</span>`;
}
function getSplitFinal(formas, splits, total) {
  if (formas.length===1) return {[formas[0]]:total};
  const ultima=formas[formas.length-1], res={}; let soma=0;
  formas.slice(0,-1).forEach(t => { const v=Math.max(0,parseFloat(splits[t])||0); res[t]=v; soma+=v; });
  res[ultima]=Math.max(0,total-soma); return res;
}
function renderTagsPagamento(venda) {
  if (venda.pagamentos&&Object.keys(venda.pagamentos).length) {
    const tags=Object.entries(venda.pagamentos).filter(([,v])=>v>0).map(([t,v])=>`<span class="tag-pag-valor ${t}">${ICONE_PAGAMENTO[t]}: R$ ${fmt(v)}</span>`).join("");
    return `<div class="tags-pag-multi">${tags}</div>`;
  }
  const p=venda.pagamento||"dinheiro";
  return `<span class="tag-pag ${p}">${ICONE_PAGAMENTO[p]}</span>`;
}

/* ─── Desconto / Categoria ─── */
function setTipoDesconto(tipo) {
  tipoDesconto=tipo;
  document.querySelectorAll(".btn-desc-tipo").forEach(b=>b.classList.remove("ativo"));
  document.getElementById(`desc-tipo-${tipo}`)?.classList.add("ativo");
  const s=document.getElementById("descontoSufixo"); if (s) s.textContent=tipo==="pct"?"%":"R$";
  atualizarTotal();
}
function getCategorias() { return [...new Set(produtos.map(p=>p.categoria).filter(Boolean))].sort(); }
function renderCategoriaTabs() {
  const c=document.getElementById("categoriasTabs"); if (!c) return;
  const cats=getCategorias(); if (!cats.length){c.innerHTML="";return;}
  c.innerHTML=`<button class="btn-categoria ${categoriaAtiva==="todas"?"ativo":""}" onclick="selecionarCategoria('todas')">Todas</button>`+cats.map(cat=>`<button class="btn-categoria ${categoriaAtiva===cat?"ativo":""}" onclick="selecionarCategoria('${cat}')">${cat}</button>`).join("");
}
function selecionarCategoria(cat){categoriaAtiva=cat;renderCategoriaTabs();renderProdutos();}
function atualizarSugestoesCategorias(){const dl=document.getElementById("categoriasSugestoes");if(dl)dl.innerHTML=getCategorias().map(c=>`<option value="${c}">`).join("");}

/* ─── File input ─── */
function atualizarNomeArquivo(input) {
  const label=document.getElementById("fotoNomeArquivo"), pw=document.getElementById("fotoPrevisualizacao"), pi=document.getElementById("fotoPreviewImg");
  if (!input.files[0]) return;
  if (label) label.textContent=input.files[0].name;
  if (pw&&pi){const r=new FileReader();r.onload=e=>{pi.src=e.target.result;pw.style.display="block";};r.readAsDataURL(input.files[0]);}
}
function removerFotoProduto(){const i=document.getElementById("fotoProduto"),l=document.getElementById("fotoNomeArquivo"),pw=document.getElementById("fotoPrevisualizacao");if(i)i.value="";if(l)l.textContent="Escolher imagem...";if(pw)pw.style.display="none";}

/* ─────────────────────────────────────────
   PRODUTOS
───────────────────────────────────────── */
function proximoSkuId() {
  if (!produtos.length) return 1;
  return Math.max(...produtos.map(p=>p.skuId||0))+1;
}

let buscaTimeout=null;
function renderProdutos(){clearTimeout(buscaTimeout);buscaTimeout=setTimeout(_renderProdutos,150);}
function _renderProdutos() {
  renderCategoriaTabs();
  const lista=document.getElementById("listaProdutos"); lista.innerHTML="";
  if (!produtos.length){lista.innerHTML=`<div class="empty-state"><span>📦</span>Nenhum produto cadastrado.<br>Vá em <strong>Produtos</strong> para adicionar.</div>`;return;}
  const busca=(document.getElementById("buscaProdutos")?.value||"").toLowerCase().trim();
  const filtrados=produtos.filter(p=>{
    const mc=categoriaAtiva==="todas"||p.categoria===categoriaAtiva;
    const mb=!busca||p.nome.toLowerCase().includes(busca)||(p.categoria||"").toLowerCase().includes(busca)||(String(p.skuId)).includes(busca);
    return mc&&mb;
  });
  if (!filtrados.length){lista.innerHTML=`<div class="empty-state"><span>🔍</span>Nenhum produto encontrado.</div>`;return;}
  filtrados.forEach(prod=>{
    const qtd=carrinho[prod.id]||0;
    const imgSrc = prod.fotoUrl || prod._fotoCache || "";
    const imgTag = imgSrc ? `<img src="${imgSrc}" alt="${prod.nome}">` : (prod.fotoKey ? `<img src="" alt="${prod.nome}" data-foto-key="${prod.fotoKey}">` : "");
    const catTag=prod.categoria?`<span class="prod-categoria">${prod.categoria}</span>`:"";
    const card=document.createElement("div"); card.className="card-produto";
    card.innerHTML=`${imgTag}<span class="prod-sku">#${String(prod.skuId).padStart(4,"0")}</span>${catTag}<p class="prod-nome">${prod.nome}</p><p class="prod-preco">R$ ${fmt(prod.preco)}</p><p class="prod-estoque">Estoque: ${prod.estoque||0} un.</p>
      <div class="controle-qtd">
        <button class="btn-qtd" onclick="alterarQtd(${prod.id},-1)">−</button>
        <input class="input-qtd" type="number" min="0" value="${qtd}" onchange="definirQtd(${prod.id},this.value)">
        <button class="btn-qtd" onclick="alterarQtd(${prod.id},+1)">+</button>
      </div>`;
    lista.appendChild(card);
    if (!prod.fotoUrl && prod.fotoKey){carregarImagem(prod.fotoKey).then(b64=>{if(b64){prod._fotoCache=b64;lista.querySelectorAll(`img[data-foto-key="${prod.fotoKey}"]`).forEach(img=>img.src=b64);}});}
  });
  atualizarTotal();
}

function renderProdutosAdmin() {
  const lista=document.getElementById("listaProdutosAdmin"); lista.innerHTML="";
  if (!produtos.length){lista.innerHTML=`<div class="empty-state"><span>📦</span>Nenhum produto ainda.</div>`;return;}
  const busca=(document.getElementById("buscaProdutosAdmin")?.value||"").toLowerCase().trim();
  const filtrados=produtos.filter(prod=>!busca||(prod.nome||"").toLowerCase().includes(busca));
  if (!filtrados.length){lista.innerHTML=`<div class="empty-state"><span>🔍</span>Nenhum produto encontrado.</div>`;return;}
  filtrados.forEach(prod=>{
    const catTag=prod.categoria?`<span class="prod-categoria">${prod.categoria}</span>`:"";
    const imgSrcA = prod.fotoUrl || prod._fotoCache || "";
    const imgTag = imgSrcA ? `<img src="${imgSrcA}" alt="${prod.nome}">` : (prod.fotoKey ? `<img src="" alt="${prod.nome}" data-foto-key="${prod.fotoKey}">` : "");
    const card=document.createElement("div");card.className="card-produto";
    card.innerHTML=`${imgTag}<span class="prod-sku">#${String(prod.skuId).padStart(4,"0")}</span>${catTag}<p class="prod-nome">${prod.nome}</p><p class="prod-preco">R$ ${fmt(prod.preco)}</p><div class="prod-meta"><span>Custo: R$ ${fmt(prod.custo||0)}</span><span>Estoque: ${prod.estoque||0}</span></div>
      <div class="acoes-admin"><button class="btn-sm btn-sm-edit" onclick="editarProduto(${prod.id})">✏️ Editar</button><button class="btn-sm btn-sm-del" onclick="excluirProduto(${prod.id})">🗑 Excluir</button></div>`;
    lista.appendChild(card);
    if (!prod.fotoUrl && prod.fotoKey){carregarImagem(prod.fotoKey).then(b64=>{if(b64){prod._fotoCache=b64;lista.querySelectorAll(`img[data-foto-key="${prod.fotoKey}"]`).forEach(img=>img.src=b64);}});}
  });
}

function alterarQtd(id,delta){const nova=Math.max(0,(carrinho[id]||0)+delta);if(nova===0)delete carrinho[id];else carrinho[id]=nova;atualizarTotal();renderProdutos();}
function definirQtd(id,val){const nova=Math.max(0,Math.floor(Number(val)));if(nova===0)delete carrinho[id];else carrinho[id]=nova;atualizarTotal();renderProdutos();}

async function salvarProduto() {
  const nome=document.getElementById("nomeProduto").value.trim(), preco=Number(document.getElementById("precoProduto").value), custoInput=document.getElementById("custoProduto").value, estoqueInput=document.getElementById("estoqueProduto").value, custo=custoInput===""?0:Math.max(0,Number(custoInput)), estoque=estoqueInput===""?0:Math.max(0,Math.floor(Number(estoqueInput))), cat=document.getElementById("categoriaProduto").value.trim(), fi=document.getElementById("fotoProduto");
  if (!nome||isNaN(preco)||preco<=0){mostrarToast("Preencha nome e preço válidos.","erro");return;}
  mostrarLoading("Salvando produto...");
  try {
    // Upload de foto para o Supabase Storage (sincroniza entre dispositivos)
    let fotoUrl = null;
    if (fi && fi.files[0]) {
      const ext = fi.files[0].name.split(".").pop();
      const path = `${usuarioAtual.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("fotos").upload(path, fi.files[0], { upsert: true });
      if (!upErr) {
        const { data: urlData } = supabase.storage.from("fotos").getPublicUrl(path);
        fotoUrl = urlData.publicUrl;
      } else {
        console.warn("Erro no upload da foto:", upErr.message);
      }
    }
    const idx = produtos.findIndex(p => p.id === editandoId);
    if (editandoId !== null && idx !== -1) {
      produtos[idx].nome = nome; produtos[idx].preco = preco; produtos[idx].custo = custo; produtos[idx].estoque = estoque; produtos[idx].categoria = cat;
      if (fotoUrl) produtos[idx].fotoUrl = fotoUrl;
      await fbSalvarProduto(produtos[idx]);
      editandoId = null;
    } else {
      const novo = { id: Date.now(), skuId: proximoSkuId(), nome, preco, custo, estoque, categoria: cat, fotoUrl: fotoUrl || "", fotoKey: "" };
      const fid = await fbSalvarProduto(novo);
      if (fid) { novo.firestoreId = fid; produtos.push(novo); }
    }
    limparCampos(); renderProdutosAdmin(); atualizarSugestoesCategorias();
    document.getElementById("adminFormLabel").textContent = "Novo produto";
    document.getElementById("btnCancelarEdicao").style.display = "none";
    mostrarToast("✅ Produto salvo!");
  } catch(e) {
    console.error("Erro ao salvar produto:", e);
    mostrarToast("Erro ao salvar produto.","erro");
  } finally {
    esconderLoading();
  }
}

function editarProduto(id){
  const p=produtos.find(p=>p.id===id);if(!p)return;
  document.getElementById("nomeProduto").value=p.nome; document.getElementById("precoProduto").value=p.preco; document.getElementById("custoProduto").value=p.custo||""; document.getElementById("estoqueProduto").value=p.estoque||0; document.getElementById("categoriaProduto").value=p.categoria||"";
  if(p.fotoUrl){const pw=document.getElementById("fotoPrevisualizacao"),pi=document.getElementById("fotoPreviewImg"),lbl=document.getElementById("fotoNomeArquivo");if(pw&&pi){pi.src=p.fotoUrl;pw.style.display="block";}if(lbl)lbl.textContent="Foto atual";}
  else if(p.fotoKey){carregarImagem(p.fotoKey).then(b64=>{if(b64){const pw=document.getElementById("fotoPrevisualizacao"),pi=document.getElementById("fotoPreviewImg"),lbl=document.getElementById("fotoNomeArquivo");if(pw&&pi){pi.src=b64;pw.style.display="block";}if(lbl)lbl.textContent="Foto atual";}});}
  document.getElementById("adminFormLabel").textContent=`Editando: ${p.nome}`;
  document.getElementById("btnCancelarEdicao").style.display="inline-flex";
  editandoId=id;
  window.scrollTo({top:0, behavior:"smooth"});
}
function cancelarEdicao(){editandoId=null;limparCampos();document.getElementById("adminFormLabel").textContent="Novo produto";document.getElementById("btnCancelarEdicao").style.display="none";}
async function excluirProduto(id){
  const ok=await confirmar("Deseja excluir este produto?");if(!ok)return;
  const p=produtos.find(p=>p.id===id);
  if(p?.fotoKey) await removerImagem(p.fotoKey);
  if(p?.firestoreId) await fbDeletarProduto(p.firestoreId);
  produtos=produtos.filter(p=>p.id!==id); delete carrinho[id];
  atualizarTotal(); renderProdutosAdmin(); mostrarToast("Produto excluído.");
}
function limparCampos(){document.getElementById("nomeProduto").value="";document.getElementById("precoProduto").value="";document.getElementById("custoProduto").value="";document.getElementById("estoqueProduto").value="";document.getElementById("categoriaProduto").value="";removerFotoProduto();}

/* ─────────────────────────────────────────
   FINALIZAR PEDIDO
───────────────────────────────────────── */
async function finalizarPedido() {
  const itensIds=Object.keys(carrinho).filter(id=>carrinho[id]>0);
  if (!itensIds.length){mostrarToast("Carrinho vazio!","erro");return;}
  if (pagamentosSelecionados.length>1){
    const total=calcularTotalFinal(), soma=pagamentosSelecionados.slice(0,-1).reduce((a,t)=>a+(parseFloat(splitPagamento[t])||0),0);
    if (soma>total+.005){mostrarToast("⚠️ A soma dos pagamentos ultrapassa o total.","erro");return;}
  }
  const itens=itensIds.map(id=>{const p=produtos.find(p=>p.id===Number(id));return{nome:p.nome,skuId:p.skuId,quantidade:carrinho[id],preco:p.preco};});
  const semEstoque=itensIds.find(id=>{const p=produtos.find(p=>p.id===Number(id));return (p.estoque||0)<carrinho[id];});
  if (semEstoque){const p=produtos.find(p=>p.id===Number(semEstoque));mostrarToast(`Estoque insuficiente para ${p.nome}.` ,"erro");return;}
  itens.forEach(item=>{const p=produtos.find(prod=>prod.skuId===item.skuId);item.custo=p?.custo||0;});
  const sub=calcularSubtotal(), desc=calcularDesconto(sub), total=Math.max(0,sub-desc);
  const pagamentos=getSplitFinal(pagamentosSelecionados,splitPagamento,total);
  const clienteIdVal=document.getElementById("clienteSelecionado")?.value||"";
  const clienteObj=clienteIdVal?clientes.find(c=>c.id===Number(clienteIdVal)):null;
  const clienteNome=clienteObj?.nome||"";
  const venda={id:Date.now(),itens,subtotal:sub,desconto:desc,total,pagamentos,pagamento:pagamentosSelecionados[0],data:hojeStr(),hora:agoraHora(),cancelada:false,clienteId:clienteObj?.firestoreId||null,clienteNome};
  const fid = await fbSalvarVenda(venda);
  if (fid) { venda.firestoreId=fid; historico.push(venda); }
  await Promise.all(itensIds.map(async id=>{const p=produtos.find(prod=>prod.id===Number(id));p.estoque=Math.max(0,(p.estoque||0)-carrinho[id]);await fbSalvarProduto(p);}));

  // Reset
  carrinho={}; pagamentosSelecionados=["dinheiro"]; splitPagamento={}; tipoDesconto="pct";
  ["descontoInput"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
  document.getElementById("descontoPreview").textContent="";
  document.getElementById("total").innerText="0,00";
  renderBotoesPagamento();
  const sp=document.getElementById("pagamentoSplit");if(sp){sp.classList.add("hidden");sp.innerHTML="";}
  document.querySelectorAll(".btn-desc-tipo").forEach(b=>b.classList.remove("ativo"));
  document.getElementById("desc-tipo-pct")?.classList.add("ativo");
  document.getElementById("descontoSufixo").textContent="%";
  document.getElementById("carrinhoCard").style.display="none";
  if (document.getElementById("clienteSelecionado")) document.getElementById("clienteSelecionado").value="";
  renderProdutos();
  mostrarComprovante(venda);
}

/* ─────────────────────────────────────────
   COMPROVANTE
───────────────────────────────────────── */
function montarHTMLComprovante(venda) {
  const loja=lojaConfigAtual.nome||"HubVendasPro";
  const pagTxt=venda.pagamentos&&Object.keys(venda.pagamentos).length>1
    ?Object.entries(venda.pagamentos).filter(([,v])=>v>0).map(([t,v])=>`${ICONE_PAGAMENTO[t]}: R$ ${fmt(v)}`).join("<br>")
    :ICONE_PAGAMENTO[venda.pagamento||"dinheiro"];
  const itensHtml=venda.itens.map(i=>{
    const sku=i.skuId?`#${String(i.skuId).padStart(4,"0")} `:"";
    return `<tr><td>${sku}${typeof i==="string"?i:i.nome}</td><td class="c">${typeof i==="string"?1:i.quantidade}</td><td class="r">R$ ${fmt(typeof i==="string"?0:i.preco*i.quantidade)}</td></tr>`;
  }).join("");
  let clienteLinha="";
  if (venda.clienteNome) clienteLinha+=`<p class="cv-cliente">Cliente: <strong>${venda.clienteNome}</strong></p>`;
  if (venda.clienteId) { const cli=clientes.find(c=>c.id===venda.clienteId); if (cli?.cpf) clienteLinha+=`<p class="cv-cliente">CPF: <strong>${cli.cpf}</strong></p>`; }
  return `<div class="cupom" style="background:#fff;color:#000;">
    <div class="cupom-header">
      <div class="cupom-logo">${loja}</div>
      <div class="cupom-sub">Comprovante de Venda</div>
      <div class="cupom-info">${venda.data} às ${venda.hora||""}</div>
      ${clienteLinha}
    </div>
    <div class="cupom-divider">- - - - - - - - - - - - - - - - - - - - - -</div>
    <table class="cupom-itens"><thead><tr><th>Produto</th><th class="c">Qtd</th><th class="r">Valor</th></tr></thead><tbody>${itensHtml}</tbody></table>
    <div class="cupom-divider">- - - - - - - - - - - - - - - - - - - - - -</div>
    <div class="cupom-totais">
      <div class="cupom-linha"><span>Subtotal</span><span>R$ ${fmt(venda.subtotal||venda.total)}</span></div>
      ${venda.desconto>0?`<div class="cupom-linha desc"><span>Desconto</span><span>− R$ ${fmt(venda.desconto)}</span></div>`:""}
      <div class="cupom-linha total"><span>TOTAL</span><span>R$ ${fmt(venda.total)}</span></div>
    </div>
    <div class="cupom-divider">- - - - - - - - - - - - - - - - - - - - - -</div>
    <div class="cupom-pagamento"><strong>Pagamento:</strong><br>${pagTxt}</div>
    <div class="cupom-divider">- - - - - - - - - - - - - - - - - - - - - -</div>
    <div class="cupom-footer">HubVendasPro · Obrigado pela preferência!</div>
  </div>`;
}
function mostrarComprovante(venda) { vendaComprovanteAtual=venda; document.getElementById("comprovanteConteudo").innerHTML=montarHTMLComprovante(venda); document.getElementById("modalComprovante").classList.remove("hidden"); }
function fecharComprovante(){document.getElementById("modalComprovante").classList.add("hidden");vendaComprovanteAtual=null;}
function imprimirComprovante() {
  const html=montarHTMLComprovante(vendaComprovanteAtual);
  const w=window.open("","_blank","width=400,height=700");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:'Courier New',monospace;font-size:13px;margin:0;padding:16px;background:#fff;color:#000;}.cupom{max-width:320px;margin:0 auto;}.cupom-header{text-align:center;margin-bottom:10px;}.cupom-logo{font-size:18px;font-weight:900;}.cupom-sub,.cupom-info{font-size:11px;color:#555;}.cv-cliente{font-size:12px;margin:4px 0 0;}.cupom-divider{text-align:center;font-size:11px;color:#aaa;margin:8px 0;}.cupom-itens{width:100%;border-collapse:collapse;font-size:12px;}.cupom-itens th{text-align:left;border-bottom:1px solid #ccc;padding-bottom:4px;}.cupom-itens td{padding:3px 0;}.c,.th.c{text-align:center;}.r,.th.r{text-align:right;}.cupom-totais{font-size:13px;}.cupom-linha{display:flex;justify-content:space-between;padding:3px 0;}.cupom-linha.desc{color:#c00;}.cupom-linha.total{font-weight:900;font-size:15px;border-top:1px solid #000;padding-top:6px;margin-top:2px;}.cupom-pagamento{font-size:12px;margin:6px 0;}.cupom-footer{text-align:center;font-size:11px;color:#888;margin-top:10px;}@media print{body{padding:0;}@page{margin:10mm 5mm;}}</style></head><body>${html}<script>window.onload=()=>{window.print();}<\/script></body></html>`);
  w.document.close();
}
function baixarComprovantePDF() {
  if (typeof window.jspdf==="undefined"&&typeof jspdf==="undefined"){mostrarToast("PDF indisponível.","erro");imprimirComprovante();return;}
  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:"mm",format:[80,200]});
  const v=vendaComprovanteAtual, loja=lojaConfigAtual.nome||"HubVendasPro";
  let y=10; const lw=68;
  doc.setFont("Courier","bold");doc.setFontSize(14);doc.text(loja,40,y,{align:"center"});y+=6;
  doc.setFont("Courier","normal");doc.setFontSize(9);doc.text("Comprovante de Venda",40,y,{align:"center"});y+=4;
  doc.text(`${v.data} às ${v.hora||""}`,40,y,{align:"center"});y+=4;
  if (v.clienteNome){doc.text(`Cliente: ${v.clienteNome}`,40,y,{align:"center"});y+=4;}
  if (v.clienteId){const cli=clientes.find(c=>c.id===v.clienteId);if(cli?.cpf){doc.text(`CPF: ${cli.cpf}`,40,y,{align:"center"});y+=4;}}
  doc.text("- ".repeat(22),4,y);y+=5;
  doc.setFont("Courier","bold");doc.setFontSize(9);doc.text("Produto",4,y);doc.text("Qtd",52,y,{align:"center"});doc.text("Valor",76,y,{align:"right"});y+=4;
  doc.setFont("Courier","normal");
  v.itens.forEach(i=>{const sku=i.skuId?`#${String(i.skuId).padStart(4,"0")} `:"";const nm=(sku+(typeof i==="string"?i:i.nome)).substring(0,28);const q=typeof i==="string"?1:i.quantidade;const val=typeof i==="string"?0:i.preco*i.quantidade;doc.text(nm,4,y);doc.text(String(q),52,y,{align:"center"});doc.text(`R$${fmt(val)}`,76,y,{align:"right"});y+=4;});
  doc.text("- ".repeat(22),4,y);y+=5;
  doc.text("Subtotal",4,y);doc.text(`R$${fmt(v.subtotal||v.total)}`,76,y,{align:"right"});y+=4;
  if (v.desconto>0){doc.setTextColor(180,0,0);doc.text("Desconto",4,y);doc.text(`-R$${fmt(v.desconto)}`,76,y,{align:"right"});y+=4;doc.setTextColor(0,0,0);}
  doc.setFont("Courier","bold");doc.setFontSize(12);doc.text("TOTAL",4,y);doc.text(`R$${fmt(v.total)}`,76,y,{align:"right"});y+=6;
  doc.setFont("Courier","normal");doc.setFontSize(9);doc.text("- ".repeat(22),4,y);y+=5;
  const pags=v.pagamentos&&Object.keys(v.pagamentos).length?Object.entries(v.pagamentos).filter(([,val])=>val>0).map(([t,val])=>`${ICONE_PAGAMENTO[t]}: R$${fmt(val)}`).join(", "):ICONE_PAGAMENTO[v.pagamento||"dinheiro"];
  const pagLines=doc.splitTextToSize(`Pagamento: ${pags}`,lw);
  doc.text(pagLines,4,y);y+=pagLines.length*4+3;
  doc.text("- ".repeat(22),4,y);y+=5;
  doc.setTextColor(120,120,120);doc.text("HubVendasPro · Obrigado!",40,y,{align:"center"});
  doc.save(`comprovante_${v.data.replace(/\//g,"-")}_${v.hora?.replace(/:/g,"-")||"00-00"}.pdf`);
}

/* ─────────────────────────────────────────
   HISTÓRICO
───────────────────────────────────────── */
function normalizarPedidoRT(p) {
  const dataHora = p.created_at ? new Date(p.created_at) : new Date();
  return {
    ...p,
    data: dataHora.toLocaleDateString("pt-BR"),
    hora: dataHora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    itens: p.itens || [],
    subtotal: p.total || 0,
    desconto: 0,
    pagamentos: p.pagamentos || {},
    pagamento: p.pagamento || "dinheiro",
    clienteNome: p.cliente_nome || "",
    origem: "art",
    cancelada: p.status === "cancelado",
  };
}

function todosRegistros() { return [...historico, ...pedidosRT]; }
function setTipoHistorico(tipo) {
  tipoHistorico = tipo;
  ["art", "vendas", "completo"].forEach(n => document.getElementById(`historico-${n}`)?.classList.toggle("ativo", n === tipo));
  renderHistorico();
}
function setFiltroHistorico(f){filtroHistorico=f;["hoje","semana","mes","tudo","custom"].forEach(n=>{const b=document.getElementById(`filtro-${n}`);if(b)b.classList.remove("ativo");});document.getElementById(`filtro-${f}`)?.classList.add("ativo");renderHistorico();}
function setFiltroDashboard(f){filtroDashboard=f;["hoje","semana","mes","tudo","custom"].forEach(n=>document.getElementById(`dash-filtro-${n}`)?.classList.toggle("ativo",n===f));renderDashboard();}

function renderHistorico() {
  const lista=document.getElementById("listaHistorico");lista.innerHTML="";
  let balanco=0;
  const iv=intervalo(filtroHistorico,"filtroDataInicio","filtroDataFim");
  const filtradasVendas = tipoHistorico === "art" ? [] : historico.filter(v=>vendaNoIntervalo(v,iv));
  const filtradasArt = tipoHistorico === "vendas" ? [] : pedidosRT.filter(v=>vendaNoIntervalo(v,iv));
  const filtradas = [...filtradasVendas, ...filtradasArt].sort((a,b)=>parseDDMMYYYY(b.data)-parseDDMMYYYY(a.data));
  if (!filtradas.length){lista.innerHTML=`<div class="empty-state"><span>📋</span>Nenhuma venda neste período.</div>`;document.getElementById("balanco").innerText="0,00";return;}
  filtradas.forEach(venda=>{
    if (venda.origem === "art") {
      if (!venda.cancelada) balanco += venda.total || 0;
      const card = document.createElement("div");
      card.innerHTML = renderPedidoRTCard(venda);
      lista.appendChild(card.firstElementChild);
      return;
    }
    const index=historico.indexOf(venda);
    if (!venda.cancelada) balanco+=venda.total;
    let itensHtml="";
    venda.itens.forEach(item=>{const sku=item.skuId?`#${String(item.skuId).padStart(4,"0")} `:"";itensHtml+=typeof item==="string"?`<span class="item-historico">${item}</span>`:`<span class="item-historico">${sku}${item.nome} <strong>x${item.quantidade}</strong></span>`;});
    const pagHtml=venda.cancelada?renderTagsPagamento(venda):`<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${renderTagsPagamento(venda)}</div>`;
    const clienteLinha=venda.clienteNome?`<p class="venda-cliente">👤 ${venda.clienteNome}</p>`:"";
    const acaoHtml=venda.cancelada?`<span class="tag tag-cancelada">Cancelada</span>`:`<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn-invalidar" onclick="cancelarVenda(${index})">Cancelar venda</button><button class="btn-editar-venda" onclick="abrirEditarVenda(${index})">✏️ Editar</button><button class="btn-copiar" onclick="abrirComprovanteHistorico(${index})">🖨 Comprovante</button></div>`;
    const descHtml=venda.desconto>0?`<p class="venda-desconto-info">Subtotal R$ ${fmt(venda.subtotal||venda.total)} <span>– Desconto R$ ${fmt(venda.desconto)}</span></p>`:"";
    const hora=venda.hora?` às ${venda.hora}`:"";
    const card=document.createElement("div");card.className=`venda-card${venda.cancelada?" cancelada":""}`;
    card.innerHTML=`<div class="venda-header"><div class="venda-header-esq"><span class="venda-data">${venda.data}${hora}</span><span class="tag tag-origem-vendas">Venda</span>${venda.cancelada?`<span class="tag tag-cancelada">Cancelada</span>`:""}</div><span class="venda-total">R$ ${fmt(venda.total)}</span></div>${clienteLinha}${descHtml}<div class="venda-pagamento">${pagHtml}</div><div class="itens-historico">${itensHtml}</div><div style="margin-top:10px">${acaoHtml}</div>`;
    lista.appendChild(card);
  });
  document.getElementById("balanco").innerText=fmt(balanco);
}

function abrirComprovanteHistorico(index){mostrarComprovante(historico[index]);}

async function cancelarVenda(index){
  const ok=await confirmar("Deseja invalidar esta venda?");if(!ok)return;
  historico[index].cancelada=true;
  if (historico[index].firestoreId) await fbAtualizarVenda(historico[index].firestoreId,{cancelada:true});
  renderHistorico();
}

/* ─────────────────────────────────────────
   EDITAR VENDA
───────────────────────────────────────── */
function abrirEditarVenda(index) {
  const v=historico[index]; if (!v||v.cancelada) return;
  editarVendaIdx=index;
  document.getElementById("senhaAdminEditar").value="";
  document.getElementById("editarVendaStep1").classList.remove("hidden");
  document.getElementById("editarVendaStep2").classList.add("hidden");
  document.getElementById("modalEditarVenda").classList.remove("hidden");
}
function fecharEditarVenda(){document.getElementById("modalEditarVenda").classList.add("hidden");editarVendaIdx=null;}

async function confirmarSenhaAdmin() {
  const senha=document.getElementById("senhaAdminEditar").value;
  // Reautentica via Supabase
  const { error } = await supabase.auth.signInWithPassword({
    email: usuarioAtual.email,
    password: senha,
  });
  if (error) {
    mostrarToast("Senha incorreta.","erro");
  } else {
    document.getElementById("editarVendaStep1").classList.add("hidden");
    document.getElementById("editarVendaStep2").classList.remove("hidden");
    _carregarFormEditarVenda();
  }
}

function _carregarFormEditarVenda() {
  const v=historico[editarVendaIdx];
  editarItens=v.itens.map(i=>typeof i==="string"?{nome:i,skuId:null,quantidade:1,preco:0}:{...i});
  editarPagamentos=v.pagamentos?Object.keys(v.pagamentos).filter(k=>v.pagamentos[k]>0):[(v.pagamento||"dinheiro")];
  editarSplit={...v.pagamentos}||{};
  editarTipoDesconto="val";
  const descInput=document.getElementById("editarDescontoInput"); if (descInput) descInput.value=v.desconto||0;
  document.getElementById("editarDescontoSufixo").textContent="R$";
  ["edit-desc-tipo-pct","edit-desc-tipo-val"].forEach(id=>document.getElementById(id)?.classList.remove("ativo"));
  document.getElementById("edit-desc-tipo-val")?.classList.add("ativo");
  ["dinheiro","cartao","pix"].forEach(t=>{const b=document.getElementById(`edit-pag-${t}`);if(b)b.classList.toggle("ativo",editarPagamentos.includes(t));});
  const sel=document.getElementById("editarProdutoSelect");
  if (sel){sel.innerHTML=`<option value="">+ Adicionar produto ao pedido...</option>`+produtos.map(p=>`<option value="${p.id}">#${String(p.skuId).padStart(4,"0")} ${p.nome} – R$ ${fmt(p.preco)}</option>`).join("");sel.onchange=()=>{if(sel.value){_adicionarItemEditar(Number(sel.value));sel.value="";}};} 
  renderEditarItens(); renderEditSplit(); atualizarEditarTotal();
}
function _adicionarItemEditar(prodId) { const p=produtos.find(p=>p.id===prodId); if (!p) return; const ex=editarItens.find(i=>i.nome===p.nome); if (ex){ex.quantidade++;} else editarItens.push({nome:p.nome,skuId:p.skuId,quantidade:1,preco:p.preco}); renderEditarItens(); atualizarEditarTotal(); }
function renderEditarItens() {
  const lista=document.getElementById("editarItensList"); if (!lista) return;
  if (!editarItens.length){lista.innerHTML=`<p style="color:var(--text3);font-size:13px;padding:8px 0">Nenhum item. Adicione produtos acima.</p>`;return;}
  lista.innerHTML=editarItens.map((item,i)=>`<div class="editar-item-row"><span class="editar-item-nome">${item.skuId?`#${String(item.skuId).padStart(4,"0")} `:""}${item.nome}</span><div style="display:flex;align-items:center;gap:6px;flex-shrink:0"><button class="btn-qtd sm" onclick="editarItemQtd(${i},-1)">−</button><span style="min-width:24px;text-align:center;font-family:var(--mono);font-size:14px">${item.quantidade}</span><button class="btn-qtd sm" onclick="editarItemQtd(${i},+1)">+</button><span style="font-family:var(--mono);font-size:13px;color:var(--green-dark);min-width:70px;text-align:right">R$ ${fmt(item.preco*item.quantidade)}</span><button class="carrinho-item-del" onclick="removerItemEditar(${i})">✕</button></div></div>`).join("");
}
function editarItemQtd(i,delta){editarItens[i].quantidade=Math.max(1,editarItens[i].quantidade+delta);renderEditarItens();atualizarEditarTotal();}
function removerItemEditar(i){editarItens.splice(i,1);renderEditarItens();atualizarEditarTotal();}
function setEditTipoDesconto(tipo){editarTipoDesconto=tipo;["edit-desc-tipo-pct","edit-desc-tipo-val"].forEach(id=>document.getElementById(id)?.classList.remove("ativo"));document.getElementById(`edit-desc-tipo-${tipo}`)?.classList.add("ativo");document.getElementById("editarDescontoSufixo").textContent=tipo==="pct"?"%":"R$";atualizarEditarTotal();}
function toggleEditPagamento(tipo){const idx=editarPagamentos.indexOf(tipo);if(idx===-1){editarPagamentos.push(tipo);}else{if(editarPagamentos.length===1){mostrarToast("Ao menos uma forma necessária.","erro");return;}editarPagamentos.splice(idx,1);delete editarSplit[tipo];}["dinheiro","cartao","pix"].forEach(t=>{const b=document.getElementById(`edit-pag-${t}`);if(b)b.classList.toggle("ativo",editarPagamentos.includes(t));});renderEditSplit();atualizarEditarTotal();}
function _calcEditSubtotal(){return editarItens.reduce((a,i)=>a+i.preco*i.quantidade,0);}
function _calcEditDesconto(sub){const v=parseFloat(document.getElementById("editarDescontoInput")?.value)||0;if(v<=0)return 0;return editarTipoDesconto==="pct"?Math.min(sub,sub*(v/100)):Math.min(sub,v);}
function _calcEditTotal(){const s=_calcEditSubtotal(),d=_calcEditDesconto(s);return Math.max(0,s-d);}
function atualizarEditarTotal(){const t=_calcEditTotal();const el=document.getElementById("editarTotalPreview");if(el)el.textContent=`R$ ${fmt(t)}`;if(editarPagamentos.length>1)renderEditSplit();}

async function salvarEdicaoVenda(){
  if (!editarItens.length){mostrarToast("Adicione ao menos um item.","erro");return;}
  const sub=_calcEditSubtotal(), desc=_calcEditDesconto(sub), total=Math.max(0,sub-desc);
  if (editarPagamentos.length>1){const soma=editarPagamentos.slice(0,-1).reduce((a,t)=>a+(parseFloat(editarSplit[t])||0),0);if(soma>total+.005){mostrarToast("⚠️ A soma dos pagamentos ultrapassa o total.","erro");return;}}
  const pagamentos=getSplitFinal(editarPagamentos,editarSplit,total);
  const v=historico[editarVendaIdx];
  const dadosAtualizados={...v,itens:editarItens,subtotal:sub,desconto:desc,total,pagamentos,pagamento:editarPagamentos[0]};
  historico[editarVendaIdx]=dadosAtualizados;
  if (v.firestoreId) await fbAtualizarVenda(v.firestoreId,{itens:editarItens,subtotal:sub,desconto:desc,total,pagamentos,pagamento:editarPagamentos[0]});
  fecharEditarVenda();renderHistorico();mostrarToast("✅ Venda atualizada!");
}

/* ─────────────────────────────────────────
   DASHBOARD
───────────────────────────────────────── */
function renderDashboard() {
  ["hoje","semana","mes","tudo","custom"].forEach(n=>document.getElementById(`dash-filtro-${n}`)?.classList.toggle("ativo",n===filtroDashboard));
  const iv=intervalo(filtroDashboard,"dashFiltroDataInicio","dashFiltroDataFim");
  const registros=todosRegistros().filter(v=>vendaNoIntervalo(v,iv));
  const canceladas=registros.filter(v=>v.cancelada), vt=registros.filter(v=>!v.cancelada && (v.origem!=="art" || v.status==="atendido"));
  const rt=vt.reduce((a,v)=>a+(v.total||0),0), custoTotal=vt.reduce((a,v)=>a+(v.itens||[]).reduce((s,item)=>{const produto=produtos.find(p=>p.skuId===item.skuId||p.nome===item.nome);return s+(Number(item.custo??produto?.custo)||0)*(Number(item.quantidade)||1);},0),0), lucro=rt-custoTotal, descontos=vt.reduce((a,v)=>a+(v.desconto||0),0), ticket=vt.length?rt/vt.length:0;
  const periodoLabel={hoje:"Hoje",semana:"Últimos 7 dias",mes:"Últimos 30 dias",tudo:"Todo o período",custom:"Período personalizado"}[filtroDashboard];
  document.getElementById("kpiGrid").innerHTML=`<div class="kpi-card"><div class="kpi-icon">💰</div><div class="kpi-label">Faturamento</div><div class="kpi-value green">R$ ${fmt(rt)}</div></div><div class="kpi-card"><div class="kpi-icon">📈</div><div class="kpi-label">Lucro líquido</div><div class="kpi-value ${lucro<0?"red":"green"}">R$ ${fmt(lucro)}</div></div><div class="kpi-card"><div class="kpi-icon">🛒</div><div class="kpi-label">Vendas concluídas</div><div class="kpi-value">${vt.length}</div></div><div class="kpi-card"><div class="kpi-icon">🎯</div><div class="kpi-label">Ticket médio</div><div class="kpi-value">R$ ${fmt(ticket)}</div></div><div class="kpi-card"><div class="kpi-icon">❌</div><div class="kpi-label">Vendas canceladas</div><div class="kpi-value">${canceladas.length}</div></div><div class="kpi-card"><div class="kpi-icon">🏷️</div><div class="kpi-label">Descontos</div><div class="kpi-value">R$ ${fmt(descontos)}</div></div>`;
  document.getElementById("dashData").textContent=periodoLabel;
  renderBaixoEstoque();
  const ag=new Date(), dias=[];
  for(let i=6;i>=0;i--){const d=new Date(ag);d.setDate(d.getDate()-i);dias.push({label:d.toLocaleDateString("pt-BR",{weekday:"short",day:"2-digit"}),data:d.toLocaleDateString("pt-BR")});}
  const mx=Math.max(...dias.map(dia=>vt.filter(v=>v.data===dia.data).reduce((a,v)=>a+v.total,0)),1);
  document.getElementById("chartWrap").innerHTML=dias.map(dia=>{const val=vt.filter(v=>v.data===dia.data).reduce((a,v)=>a+v.total,0),h=Math.max(4,Math.round((val/mx)*100));return `<div class="chart-bar-group"><div class="chart-val">R$${fmt(val)}</div><div class="chart-bar" style="height:${h}px"></div><div class="chart-label">${dia.label}</div></div>`;}).join("");
  const ct={};vt.forEach(v=>v.itens.forEach(i=>{const nome=typeof i==="string"?i:i.nome,qtd=typeof i==="string"?1:i.quantidade,val=typeof i==="string"?0:i.preco*i.quantidade;if(!ct[nome])ct[nome]={qtd:0,val:0};ct[nome].qtd+=qtd;ct[nome].val+=val;}));
  const top=Object.entries(ct).sort((a,b)=>b[1].qtd-a[1].qtd).slice(0,5);
  const maxQtd=top[0]?.[1].qtd||1;
  document.getElementById("topProdutos").innerHTML=top.length===0?`<p style="color:var(--text3);font-size:14px">Nenhuma venda ainda.</p>`:top.map(([nome,d],i)=>{const w=Math.round((d.qtd/maxQtd)*100);return `<div class="pag-row produto-pag-row"><span class="top-rank">${i+1}</span><span class="pag-nome produto-pag-nome" title="${nome}">${nome}</span><div class="pag-bar-wrap"><div class="pag-bar" style="width:${w}%"></div></div><span class="pag-val produto-pag-val">${d.qtd} unid. · R$ ${fmt(d.val)}</span></div>`;}).join("");
  const pp={dinheiro:0,cartao:0,pix:0};
  vt.forEach(v=>{if(v.pagamentos)Object.entries(v.pagamentos).forEach(([t,val])=>{if(pp[t]!==undefined)pp[t]+=val;});else pp[v.pagamento||"dinheiro"]+=v.total;});
  const tpp=Object.values(pp).reduce((a,b)=>a+b,0)||1;
  document.getElementById("dashPagamentos").innerHTML=[{key:"dinheiro",label:"💵 Dinheiro"},{key:"cartao",label:"💳 Cartão"},{key:"pix",label:"⚡ Pix"}].map(({key,label})=>{const w=Math.round((pp[key]/tpp)*100);return `<div class="pag-row"><span class="pag-nome">${label}</span><div class="pag-bar-wrap"><div class="pag-bar" style="width:${w}%"></div></div><span class="pag-val">R$ ${fmt(pp[key])}</span></div>`;}).join("");
  const qtdVendas=vt.filter(v=>v.origem!=="art").length, qtdArt=vt.filter(v=>v.origem==="art").length;
  document.getElementById("dashOrigem").innerHTML=`<div class="pag-row"><span class="pag-nome">🛒 Vendas</span><div class="pag-bar-wrap"><div class="pag-bar" style="width:${Math.round((qtdVendas/(vt.length||1))*100)}%"></div></div><span class="pag-val">${qtdVendas} pedidos</span></div><div class="pag-row"><span class="pag-nome">📡 ART</span><div class="pag-bar-wrap"><div class="pag-bar" style="width:${Math.round((qtdArt/(vt.length||1))*100)}%"></div></div><span class="pag-val">${qtdArt} pedidos</span></div>`;
}

function produtosBaixoEstoque() { return produtos.filter(p=>(Number(p.estoque)||0)<=5).sort((a,b)=>(Number(a.estoque)||0)-(Number(b.estoque)||0)); }
function renderBaixoEstoque() {
  const baixos=produtosBaixoEstoque(), resumo=document.getElementById("baixoEstoqueResumo");
  if (!resumo) return;
  resumo.innerHTML=baixos.length?baixos.slice(0,5).map(p=>`<div class="baixo-estoque-row"><span class="baixo-estoque-nome">${p.nome}</span><strong>${p.estoque||0} un.</strong></div>`).join(""):`<p class="sem-baixo-estoque">Nenhum produto com estoque baixo.</p>`;
}
function abrirModalBaixoEstoque() {
  const lista=document.getElementById("baixoEstoqueLista"), baixos=produtosBaixoEstoque();
  lista.innerHTML=baixos.length?baixos.map(p=>`<button class="baixo-estoque-item" onclick="editarProdutoDoDashboard(${p.id})"><span><strong>${p.nome}</strong><small>Custo: R$ ${fmt(p.custo||0)} · Preço: R$ ${fmt(p.preco)}</small></span><b>${p.estoque||0} un.</b></button>`).join(""):`<p class="sem-baixo-estoque">Nenhum produto com estoque baixo.</p>`;
  document.getElementById("modalBaixoEstoque").classList.remove("hidden");
}
function fecharModalBaixoEstoque(){document.getElementById("modalBaixoEstoque")?.classList.add("hidden");}
function editarProdutoDoDashboard(id){fecharModalBaixoEstoque();navegarPara("admin");setTimeout(()=>editarProduto(id),0);}

/* ─────────────────────────────────────────
   RELATÓRIOS
───────────────────────────────────────── */
function setFiltroRelatorio(f){filtroRelatorio=f;document.querySelectorAll("[id^='rel-']").forEach(b=>b.classList.remove("ativo"));document.getElementById(`rel-${f}`)?.classList.add("ativo");renderRelatorios();}
function renderRelatorios() {
  const iv=intervalo(filtroRelatorio,"relDataInicio","relDataFim");
  const filtradas=historico.filter(v=>!v.cancelada&&vendaNoIntervalo(v,iv));
  const receita=filtradas.reduce((a,v)=>a+v.total,0), pedidos=filtradas.length, ticket=pedidos?receita/pedidos:0, descontos=filtradas.reduce((a,v)=>a+(v.desconto||0),0);
  document.getElementById("relKpiGrid").innerHTML=`<div class="kpi-card"><div class="kpi-icon">💰</div><div class="kpi-label">Receita</div><div class="kpi-value green">R$ ${fmt(receita)}</div></div><div class="kpi-card"><div class="kpi-icon">🛒</div><div class="kpi-label">Pedidos</div><div class="kpi-value">${pedidos}</div></div><div class="kpi-card"><div class="kpi-icon">🎯</div><div class="kpi-label">Ticket médio</div><div class="kpi-value">R$ ${fmt(ticket)}</div></div><div class="kpi-card"><div class="kpi-icon">🏷️</div><div class="kpi-label">Descontos</div><div class="kpi-value">R$ ${fmt(descontos)}</div></div>`;
  const pp={dinheiro:0,cartao:0,pix:0};
  filtradas.forEach(v=>{if(v.pagamentos)Object.entries(v.pagamentos).forEach(([t,val])=>{if(pp[t]!==undefined)pp[t]+=val;});else pp[v.pagamento||"dinheiro"]+=v.total;});
  const tpp=Object.values(pp).reduce((a,b)=>a+b,0)||1;
  document.getElementById("relPagamentos").innerHTML=[{key:"dinheiro",label:"💵 Dinheiro"},{key:"cartao",label:"💳 Cartão"},{key:"pix",label:"⚡ Pix"}].map(({key,label})=>{const w=Math.round((pp[key]/tpp)*100);return `<div class="pag-row"><span class="pag-nome">${label}</span><div class="pag-bar-wrap"><div class="pag-bar" style="width:${w}%"></div></div><span class="pag-val">R$ ${fmt(pp[key])}</span></div>`;}).join("");
  const ct={};filtradas.forEach(v=>v.itens.forEach(i=>{const nome=typeof i==="string"?i:i.nome,qtd=typeof i==="string"?1:i.quantidade,val=typeof i==="string"?0:i.preco*i.quantidade;if(!ct[nome])ct[nome]={qtd:0,val:0};ct[nome].qtd+=qtd;ct[nome].val+=val;}));
  const top=Object.entries(ct).sort((a,b)=>b[1].qtd-a[1].qtd).slice(0,5);
  document.getElementById("relTopProdutos").innerHTML=top.length===0?`<p style="color:var(--text3);font-size:14px">Sem dados.</p>`:top.map(([nome,d],i)=>`<div class="top-produto-row"><span class="top-rank">${i+1}</span><span class="top-nome">${nome}</span><span class="top-qtd">${d.qtd} unid.</span><span class="top-val">R$ ${fmt(d.val)}</span></div>`).join("");
  const listaEl=document.getElementById("relListaVendas");
  if (!filtradas.length){listaEl.innerHTML=`<p style="color:var(--text3);font-size:14px">Nenhuma venda neste período.</p>`;return;}
  listaEl.innerHTML=[...filtradas].reverse().map(venda=>{
    const idx=historico.indexOf(venda), hora=venda.hora?` às ${venda.hora}`:"";
    const itensTexto=venda.itens.map(i=>typeof i==="string"?i:`${i.nome} x${i.quantidade}`).join(", ");
    return `<div class="venda-export-card"><div class="venda-export-info"><strong>${venda.data}${hora}</strong> · ${itensTexto} · <strong>R$ ${fmt(venda.total)}</strong></div><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn-copiar" onclick="abrirComprovanteHistorico(${idx})">🖨 Comprovante</button><button class="btn-copiar" onclick="copiarPedido(${idx})">📋 Copiar</button></div></div>`;
  }).join("");
}

function exportarCSV() {
  const iv=intervalo(filtroRelatorio,"relDataInicio","relDataFim");
  const filtradas=historico.filter(v=>!v.cancelada&&vendaNoIntervalo(v,iv));
  if (!filtradas.length){mostrarToast("Nenhuma venda para exportar.","erro");return;}
  const linhas=[["ID","Data","Hora","Cliente","Itens","Subtotal","Desconto","Total","Pagamento"]];
  filtradas.forEach(v=>{
    const itens=v.itens.map(i=>typeof i==="string"?i:`${i.nome}(x${i.quantidade})`).join(" | ");
    let pagTxt=v.pagamentos&&Object.keys(v.pagamentos).length>1?Object.entries(v.pagamentos).filter(([,val])=>val>0).map(([t,val])=>`${ICONE_PAGAMENTO[t]}:R$${val.toFixed(2)}`).join("+"):ICONE_PAGAMENTO[v.pagamento||"dinheiro"];
    linhas.push([v.id,v.data,v.hora||"",v.clienteNome||"",itens,(v.subtotal||v.total).toFixed(2).replace(".",","),(v.desconto||0).toFixed(2).replace(".",","),v.total.toFixed(2).replace(".",","),pagTxt]);
  });
  const csv=linhas.map(l=>l.map(c=>`"${c}"`).join(";")).join("\n");
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"})); a.download=`hvp_${hojeStr().replace(/\//g,"-")}.csv`; a.click();
}

function exportarRelPDF() {
  if (typeof window.jspdf==="undefined"&&typeof jspdf==="undefined"){mostrarToast("PDF indisponível.","erro");return;}
  const {jsPDF}=window.jspdf;
  const iv=intervalo(filtroRelatorio,"relDataInicio","relDataFim");
  const filtradas=historico.filter(v=>!v.cancelada&&vendaNoIntervalo(v,iv));
  if (!filtradas.length){mostrarToast("Nenhuma venda no período.","erro");return;}
  const doc=new jsPDF({unit:"mm",format:"a4"});
  const loja=lojaConfigAtual.nome||"HubVendasPro";
  let y=15; const pgW=210, mg=15, cW=pgW-mg*2;
  doc.setFillColor(0,191,99); doc.rect(0,0,pgW,28,"F");
  doc.setTextColor(255,255,255); doc.setFont("Helvetica","bold"); doc.setFontSize(18); doc.text(loja,mg,13);
  doc.setFont("Helvetica","normal"); doc.setFontSize(10); doc.text("Relatorio de Vendas",mg,20);
  const pl=filtroRelatorio==="hoje"?"Hoje":filtroRelatorio==="semana"?"Ultimos 7 dias":filtroRelatorio==="mes"?"Ultimos 30 dias":filtroRelatorio==="tudo"?"Todo o periodo":"Periodo personalizado";
  doc.text(pl+" - Gerado em "+hojeStr(),pgW-mg,20,{align:"right"}); y=38;
  const receita=filtradas.reduce((a,v)=>a+v.total,0), pedidos=filtradas.length, ticket=pedidos?receita/pedidos:0, descontos=filtradas.reduce((a,v)=>a+(v.desconto||0),0);
  const kpis=[{label:"Receita Total",value:"R$ "+fmt(receita),cor:[0,191,99]},{label:"Pedidos",value:String(pedidos),cor:[13,13,13]},{label:"Ticket Medio",value:"R$ "+fmt(ticket),cor:[13,13,13]},{label:"Descontos",value:"R$ "+fmt(descontos),cor:[229,57,53]}];
  const kW=(cW-9)/4;
  kpis.forEach(function(k,i){const x=mg+i*(kW+3);doc.setFillColor(248,248,248);doc.roundedRect(x,y,kW,20,2,2,"F");doc.setDrawColor(220,220,220);doc.roundedRect(x,y,kW,20,2,2,"S");doc.setFont("Helvetica","bold");doc.setFontSize(9);doc.setTextColor(120,120,120);doc.text(k.label,x+kW/2,y+7,{align:"center"});doc.setFontSize(11);doc.setTextColor(k.cor[0],k.cor[1],k.cor[2]);doc.text(k.value,x+kW/2,y+15,{align:"center"});});
  y+=28;
  doc.setFont("Helvetica","bold");doc.setFontSize(11);doc.setTextColor(13,13,13);doc.text("Receita por Forma de Pagamento",mg,y);y+=6;
  const pp={dinheiro:0,cartao:0,pix:0};
  filtradas.forEach(function(v){if(v.pagamentos)Object.entries(v.pagamentos).forEach(function([t,val]){if(pp[t]!==undefined)pp[t]+=val;});else pp[v.pagamento||"dinheiro"]+=v.total;});
  const tpp=Object.values(pp).reduce((a,b)=>a+b,0)||1;
  [{key:"dinheiro",label:"Dinheiro",cor:[16,185,129]},{key:"cartao",label:"Cartao",cor:[37,99,235]},{key:"pix",label:"Pix",cor:[13,148,136]}].forEach(function(p){const pct=Math.round((pp[p.key]/tpp)*100),bW=Math.max(1,(cW-60)*pp[p.key]/tpp);doc.setFont("Helvetica","normal");doc.setFontSize(9);doc.setTextColor(120,120,120);doc.text(p.label,mg,y+3);doc.setFillColor(230,230,230);doc.roundedRect(mg+36,y-2,cW-60,5,2,2,"F");doc.setFillColor(p.cor[0],p.cor[1],p.cor[2]);doc.roundedRect(mg+36,y-2,bW,5,2,2,"F");doc.setTextColor(13,13,13);doc.text("R$ "+fmt(pp[p.key])+" ("+pct+"%)",pgW-mg,y+3,{align:"right"});y+=10;});
  y+=4;
  doc.setFont("Helvetica","bold");doc.setFontSize(11);doc.setTextColor(13,13,13);doc.text("Top Produtos",mg,y);y+=7;
  const ct={};filtradas.forEach(function(v){v.itens.forEach(function(i){const nome=typeof i==="string"?i:i.nome,qtd=typeof i==="string"?1:i.quantidade,val=typeof i==="string"?0:i.preco*i.quantidade;if(!ct[nome])ct[nome]={qtd:0,val:0};ct[nome].qtd+=qtd;ct[nome].val+=val;});});
  const top=Object.entries(ct).sort((a,b)=>b[1].qtd-a[1].qtd).slice(0,5);
  if(top.length){doc.setFillColor(0,191,99);doc.rect(mg,y-4,cW,7,"F");doc.setFont("Helvetica","bold");doc.setFontSize(9);doc.setTextColor(255,255,255);doc.text("#",mg+3,y);doc.text("Produto",mg+12,y);doc.text("Qtd",mg+cW-30,y,{align:"right"});doc.text("Receita",mg+cW,y,{align:"right"});y+=5;top.forEach(function([nome,d],i){if(i%2===0){doc.setFillColor(248,248,248);doc.rect(mg,y-4,cW,7,"F");}doc.setFont("Helvetica","bold");doc.setFontSize(9);doc.setTextColor(0,191,99);doc.text(String(i+1),mg+3,y);doc.setFont("Helvetica","normal");doc.setTextColor(13,13,13);doc.text(nome.substring(0,38),mg+12,y);doc.text(String(d.qtd)+" un.",mg+cW-30,y,{align:"right"});doc.setFont("Helvetica","bold");doc.setTextColor(0,191,99);doc.text("R$ "+fmt(d.val),mg+cW,y,{align:"right"});y+=7;});}else{doc.setFont("Helvetica","normal");doc.setFontSize(9);doc.setTextColor(120,120,120);doc.text("Sem dados.",mg,y);y+=6;}
  y+=6;
  if(clientes.length){if(y>230){doc.addPage();y=15;}doc.setFont("Helvetica","bold");doc.setFontSize(11);doc.setTextColor(13,13,13);doc.text("Clientes Cadastrados ("+clientes.length+")",mg,y);y+=7;doc.setFillColor(0,191,99);doc.rect(mg,y-4,cW,7,"F");doc.setFont("Helvetica","bold");doc.setFontSize(9);doc.setTextColor(255,255,255);doc.text("Nome",mg+3,y);doc.text("Telefone",mg+70,y);doc.text("CPF",mg+110,y);doc.text("Email",mg+145,y);y+=5;clientes.slice(0,20).forEach(function(c,i){if(y>270){doc.addPage();y=15;}if(i%2===0){doc.setFillColor(248,248,248);doc.rect(mg,y-4,cW,7,"F");}doc.setFont("Helvetica","normal");doc.setFontSize(8);doc.setTextColor(13,13,13);doc.text((c.nome||"-").substring(0,28),mg+3,y);doc.text((c.telefone||"-").substring(0,18),mg+70,y);doc.text((c.cpf||"-").substring(0,18),mg+110,y);doc.text((c.email||"-").substring(0,24),mg+145,y);y+=7;});if(clientes.length>20){doc.setFont("Helvetica","italic");doc.setFontSize(8);doc.setTextColor(120,120,120);y+=2;doc.text("... e mais "+(clientes.length-20)+" clientes.",mg,y);y+=5;}y+=4;}
  if(y>220){doc.addPage();y=15;}
  doc.setFont("Helvetica","bold");doc.setFontSize(11);doc.setTextColor(13,13,13);doc.text("Vendas do Periodo",mg,y);y+=7;doc.setFillColor(0,191,99);doc.rect(mg,y-4,cW,7,"F");doc.setFont("Helvetica","bold");doc.setFontSize(9);doc.setTextColor(255,255,255);doc.text("Data",mg+3,y);doc.text("Cliente",mg+28,y);doc.text("Itens",mg+70,y);doc.text("Desconto",mg+130,y,{align:"right"});doc.text("Total",mg+cW,y,{align:"right"});y+=5;
  [...filtradas].reverse().forEach(function(v,i){if(y>270){doc.addPage();y=15;}if(i%2===0){doc.setFillColor(248,248,248);doc.rect(mg,y-4,cW,7,"F");}const itensStr=v.itens.map(it=>typeof it==="string"?it:(it.nome+" x"+it.quantidade)).join(", ").substring(0,38);doc.setFont("Helvetica","normal");doc.setFontSize(8);doc.setTextColor(13,13,13);doc.text((v.data+(v.hora?" "+v.hora:"")),mg+3,y);doc.text((v.clienteNome||"-").substring(0,18),mg+28,y);doc.text(itensStr,mg+70,y);if(v.desconto>0){doc.setTextColor(229,57,53);doc.text("-R$ "+fmt(v.desconto),mg+130,y,{align:"right"});doc.setTextColor(13,13,13);}doc.setFont("Helvetica","bold");doc.setTextColor(0,191,99);doc.text("R$ "+fmt(v.total),mg+cW,y,{align:"right"});y+=7;});
  const totalPgs=doc.getNumberOfPages();for(let i=1;i<=totalPgs;i++){doc.setPage(i);doc.setFillColor(248,248,248);doc.rect(0,285,pgW,12,"F");doc.setFont("Helvetica","normal");doc.setFontSize(8);doc.setTextColor(120,120,120);doc.text("HubVendasPro - Relatorio gerado em "+hojeStr(),mg,292);doc.text("Pagina "+i+" de "+totalPgs,pgW-mg,292,{align:"right"});}
  doc.save("relatorio_hvp_"+hojeStr().replace(/\//g,"-")+".pdf");
  mostrarToast("✅ PDF gerado com sucesso!");
}

function copiarPedido(index) {
  const v=historico[index]; if (!v) return;
  const loja=lojaConfigAtual.nome||"HubVendasPro", hora=v.hora?`  Hora: ${v.hora}`:"";
  const itens=v.itens.map(i=>typeof i==="string"?`  - ${i}`:`  - ${i.nome} x${i.quantidade}  R$ ${fmt(i.preco*i.quantidade)}`).join("\n");
  const desc=v.desconto>0?`\nDesconto: -R$ ${fmt(v.desconto)}`:"";
  const pags=v.pagamentos&&Object.keys(v.pagamentos).length>1?Object.entries(v.pagamentos).filter(([,val])=>val>0).map(([t,val])=>`${ICONE_PAGAMENTO[t]}: R$ ${fmt(val)}`).join(" + "):ICONE_PAGAMENTO[v.pagamento||"dinheiro"];
  const texto=`🏪 *${loja} — Resumo do Pedido*\nData: ${v.data}${hora}\nPagamento: ${pags}\n\nItens:\n${itens}${desc}\n*Total: R$ ${fmt(v.total)}*`;
  navigator.clipboard.writeText(texto).then(()=>mostrarToast("✅ Copiado!")).catch(()=>prompt("Copie:",texto));
}

/* ═════════════════════════════════════════
   ATENDIMENTO RT — painel do lojista
═════════════════════════════════════════ */
function renderAtendimentoRT() {
  audioPedidosLiberado = notificacoesPedidosAtivas();
  renderSelecaoCatalogoRT();
  atualizarLinkCatalogoRT();
  carregarPedidosRTIniciais();
  subscribeRealtimeAtendimento();
  iniciarPollingPedidosRT();
}

function renderSelecaoCatalogoRT() {
  const lista = document.getElementById("catalogoSelecaoLista");
  if (!lista) return;
  const temProdutos = produtos.length > 0;
  document.getElementById("btnMarcarTodosCatalogo")?.toggleAttribute("disabled", !temProdutos);
  document.getElementById("btnDesmarcarTodosCatalogo")?.toggleAttribute("disabled", !temProdutos);
  if (!temProdutos) { lista.innerHTML = `<p style="color:var(--text3);font-size:13px;padding:8px 0">Cadastre produtos em "Produtos" antes de montar o catálogo.</p>`; return; }
  lista.innerHTML = produtos.map(p => `
    <label class="catalogo-check-item">
      <span class="catalogo-estoque-indicador ${(Number(p.estoque)||0)===0?"zerado":(Number(p.estoque)||0)<=5?"baixo":"normal"}" title="Estoque: ${Number(p.estoque)||0} unidade(s)"></span>
      <span class="catalogo-check-foto">${p.fotoUrl?`<img src="${p.fotoUrl}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ""}<span class="catalogo-check-placeholder" style="display:${p.fotoUrl?"none":"flex"}">📦</span></span>
      <input type="checkbox" ${catalogoSelecionado.includes(p.firestoreId)?"checked":""} onchange="toggleCatalogoProdutoRT('${p.firestoreId}',this.checked)">
      <span class="catalogo-check-nome">#${String(p.skuId).padStart(4,"0")} ${p.nome}</span>
      <span class="catalogo-check-preco">R$ ${fmt(p.preco)}</span>
    </label>`).join("");
}

function marcarTodosCatalogoRT() {
  catalogoSelecionado = produtos.map(p => p.firestoreId);
  fbSalvarConfig({ catalogoProdutos: catalogoSelecionado });
  renderSelecaoCatalogoRT();
  mostrarToast("✅ Todos os produtos foram adicionados ao catálogo.");
}

function desmarcarTodosCatalogoRT() {
  catalogoSelecionado = [];
  fbSalvarConfig({ catalogoProdutos: catalogoSelecionado });
  renderSelecaoCatalogoRT();
  mostrarToast("✅ Todos os produtos foram removidos do catálogo.");
}

function toggleCatalogoProdutoRT(firestoreId, marcado) {
  if (marcado) { if (!catalogoSelecionado.includes(firestoreId)) catalogoSelecionado.push(firestoreId); }
  else { catalogoSelecionado = catalogoSelecionado.filter(id => id!==firestoreId); }
  fbSalvarConfig({ catalogoProdutos: catalogoSelecionado });
  mostrarToast(catalogoSelecionado.length ? "✅ Catálogo atualizado." : "Catálogo esvaziado.");
}

function linkCatalogoRT() {
  const slug = slugify(lojaConfigAtual.nome || "loja");
  return `${window.location.origin}${window.location.pathname}#/${slug}/${usuarioAtual.id}`;
}
function atualizarLinkCatalogoRT() {
  const el = document.getElementById("catalogoLinkInput");
  if (el) el.value = linkCatalogoRT();
}
function copiarLinkCatalogoRT() {
  const link = linkCatalogoRT();
  navigator.clipboard.writeText(link).then(() => mostrarToast("✅ Link copiado!")).catch(() => prompt("Copie o link:", link));
}

async function carregarPedidosRTIniciais() {
  const feed = document.getElementById("feedPedidosRT");
  if (!feed) return;
  feed.innerHTML = `<p style="color:var(--text3);font-size:13px;padding:8px 0">Carregando pedidos...</p>`;
  const { data, error } = await supabase.from("pedidos_rt").select("*").eq("loja_user_id", usuarioAtual.id).order("created_at", { ascending: false }).limit(50);
  if (error) {
    console.error("Erro ao carregar pedidos RT:", error);
    feed.innerHTML = `<p style="color:var(--red);font-size:13px;padding:8px 0">Erro ao carregar pedidos: ${error.message || "permissão negada"}</p>`;
    return;
  }
  pedidosRT = data || [];
  idsPedidosRTConhecidos = new Set(pedidosRT.map(p => String(p.id)));
  if (!data?.length) { feed.innerHTML = `<p class="catalogo-feed-vazio-msg" style="color:var(--text3);font-size:13px;padding:8px 0">Nenhum pedido encontrado. Compartilhe o link do catálogo com seus clientes.</p>`; iniciarAtualizacaoDiariaFeedRT(); return; }
  feed.innerHTML = data.map(renderPedidoRTCard).join("");
  atualizarStatusNotificacoesPedidos();
  iniciarAtualizacaoDiariaFeedRT();
}

function iniciarAtualizacaoDiariaFeedRT() {
  if (timerFeedPedidosRT) clearTimeout(timerFeedPedidosRT);
  const proximaVirada = new Date();
  proximaVirada.setHours(24, 0, 1, 0);
  timerFeedPedidosRT = setTimeout(() => {
    carregarPedidosRTIniciais();
  }, Math.max(1000, proximaVirada.getTime() - Date.now()));
}

function iniciarPollingPedidosRT() {
  if (timerPollingPedidosRT) clearInterval(timerPollingPedidosRT);
  timerPollingPedidosRT = setInterval(sincronizarPedidosRTPolling, 5000);
}

async function sincronizarPedidosRTPolling() {
  if (!usuarioAtual || !document.getElementById("page-atendimento")?.classList.contains("active")) return;
  const { data, error } = await supabase.from("pedidos_rt").select("*").eq("loja_user_id", usuarioAtual.id).order("created_at", { ascending: false }).limit(50);
  if (error || !data) return;
  const feed = document.getElementById("feedPedidosRT");
  data.reverse().forEach(pedido => {
    const id = String(pedido.id);
    if (idsPedidosRTConhecidos.has(id)) return;
    idsPedidosRTConhecidos.add(id);
    pedidosRT.push(normalizarPedidoRT(pedido));
    if (!feed) return;
    const vazio = feed.querySelector(".catalogo-feed-vazio-msg");
    if (vazio) feed.innerHTML = "";
    feed.insertAdjacentHTML("afterbegin", renderPedidoRTCard(pedido));
    mostrarToast("🔔 Novo pedido recebido!");
    mostrarNotificacaoPedido(pedido);
  });
}

function pedidoRTEhDeHoje(pedido) {
  const data = new Date(pedido.created_at);
  const agora = new Date();
  return data.getFullYear() === agora.getFullYear() && data.getMonth() === agora.getMonth() && data.getDate() === agora.getDate();
}

async function ativarNotificacoesPedidos() {
  if (notificacoesPedidosAtivas()) {
    localStorage.removeItem(chaveNotificacoesPedidos());
    audioPedidosLiberado = false;
    atualizarStatusNotificacoesPedidos();
    mostrarToast("Notificações de pedidos desativadas.");
    return;
  }
  localStorage.setItem(chaveNotificacoesPedidos(), "1");
  audioPedidosLiberado = true;
  try {
    audioContextPedidos = audioContextPedidos || new (window.AudioContext || window.webkitAudioContext)();
    await audioContextPedidos.resume();
  } catch {}
  if ("Notification" in window && Notification.permission === "default") {
    try { await Notification.requestPermission(); } catch {}
  }
  atualizarStatusNotificacoesPedidos();
  mostrarToast("✅ Notificações de pedidos ativadas.");
}

function atualizarStatusNotificacoesPedidos() {
  const botao = document.getElementById("btnAtivarNotificacoes");
  const status = document.getElementById("statusNotificacoesPedidos");
  if (!botao || !status) return;
  const permitido = !(("Notification" in window) && Notification.permission === "denied");
  const ativas = notificacoesPedidosAtivas();
  botao.textContent = ativas ? "🔕 Desativar notificações" : "🔔 Ativar notificações";
  botao.disabled = false;
  status.textContent = !("Notification" in window) ? "Este navegador não suporta notificações do aparelho." : Notification.permission === "denied" ? "Notificações bloqueadas. Libere-as nas configurações do navegador." : ativas ? "Você será avisado quando chegar um novo pedido." : "Permita o som e as notificações do aparelho para ser avisado.";
}

function tocarNotificacaoPedido() {
  if (!audioPedidosLiberado || !notificacoesPedidosAtivas()) return;
  try {
    audioContextPedidos = audioContextPedidos || new (window.AudioContext || window.webkitAudioContext)();
    const agora = audioContextPedidos.currentTime;
    [0, 0.16].forEach((atraso, indice) => {
      const oscilador = audioContextPedidos.createOscillator();
      const ganho = audioContextPedidos.createGain();
      oscilador.type = "sine";
      oscilador.frequency.value = indice ? 880 : 660;
      ganho.gain.setValueAtTime(0.0001, agora + atraso);
      ganho.gain.exponentialRampToValueAtTime(0.18, agora + atraso + 0.015);
      ganho.gain.exponentialRampToValueAtTime(0.0001, agora + atraso + 0.13);
      oscilador.connect(ganho).connect(audioContextPedidos.destination);
      oscilador.start(agora + atraso);
      oscilador.stop(agora + atraso + 0.14);
    });
  } catch {}
}

function mostrarNotificacaoPedido(pedido) {
  const cliente = pedido.cliente_nome || "Cliente";
  const total = `R$ ${fmt(pedido.total)}`;
  tocarNotificacaoPedido();
  if ("Notification" in window && Notification.permission === "granted") {
    const notificacao = new Notification("Novo pedido recebido", { body: `${cliente} · ${total}`, tag: `pedido-${pedido.id}`, renotify: true });
    notificacao.onclick = () => { window.focus(); navegarPara("atendimento"); notificacao.close(); };
  }
}

function subscribeRealtimeAtendimento() {
  if (canalPedidosRT) return; // já inscrito
  canalPedidosRT = supabase.channel(`pedidos_rt_${usuarioAtual.id}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "pedidos_rt", filter: `loja_user_id=eq.${usuarioAtual.id}` }, (payload) => {
      if (idsPedidosRTConhecidos.has(String(payload.new.id))) return;
      idsPedidosRTConhecidos.add(String(payload.new.id));
      pedidosRT.push(normalizarPedidoRT(payload.new));
      const feed = document.getElementById("feedPedidosRT");
      if (!feed) return;
      const vazio = feed.querySelector(".catalogo-feed-vazio-msg");
      if (vazio) feed.innerHTML = "";
      feed.insertAdjacentHTML("afterbegin", renderPedidoRTCard(payload.new));
      mostrarToast("🔔 Novo pedido recebido!");
      mostrarNotificacaoPedido(payload.new);
      if (document.getElementById("page-dashboard")?.classList.contains("active")) renderDashboard();
      if (document.getElementById("page-historico")?.classList.contains("active")) renderHistorico();
    })
    .subscribe(status => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") console.warn("Realtime de pedidos indisponível; usando sincronização automática.", status);
    });
}

function renderPedidoRTCard(p) {
  const itensTxt = (p.itens||[]).map(i => `${i.quantidade}x ${i.nome}`).join(", ");
  const dataHora = new Date(p.created_at).toLocaleString("pt-BR");
  const cancelado = p.status === "cancelado" || p.cancelada;
  const concluido = p.status === "atendido" && !cancelado;
  const pagTxt = p.pagamentos && Object.keys(p.pagamentos).length>1
    ? Object.entries(p.pagamentos).filter(([,v])=>v>0).map(([t,v])=>`${ICONE_PAGAMENTO[t]}: R$ ${fmt(v)}`).join(" + ")
    : (ICONE_PAGAMENTO[p.pagamento]||p.pagamento);
  return `<div class="pedido-rt-card ${concluido?"atendido":""} ${cancelado?"cancelado":""}" id="pedidoRT-${p.id}">
    <div class="pedido-rt-topo">
      <div class="pedido-rt-identidade"><span class="pedido-rt-cliente">👤 ${p.cliente_nome||p.clienteNome||"Cliente"}</span><span class="tag tag-origem-art">Atendimento ART</span>${cancelado?`<span class="tag tag-cancelada">Cancelado</span>`:concluido?`<span class="tag tag-concluido">Concluído</span>`:`<span class="tag tag-pendente">Pendente</span>`}</div>
      <span class="pedido-rt-data">${dataHora}</span>
    </div>
    <p class="pedido-rt-itens">${itensTxt}</p>
    <div class="pedido-rt-rodape">
      <span class="pedido-rt-total">R$ ${fmt(p.total)} · ${pagTxt}</span>
      <span class="pedido-rt-tel">📞 ${p.cliente_telefone||"—"}</span>
    </div>
    <div class="pedido-rt-acoes">
      ${p.cliente_telefone?`<button class="btn-ghost btn-sm" onclick="window.open('https://wa.me/${p.cliente_telefone.replace(/\\D/g,"")}','_blank')">💬 Chamar no WhatsApp</button>`:""}
      ${cancelado?`<span class="pedido-status-text cancelado">Pedido cancelado</span>`:concluido?`<span class="pedido-status-text concluido">✓ Pedido concluído</span>`:`<button class="btn-primary btn-sm" onclick="marcarPedidoRTAtendido('${p.id}')">✓ Marcar como concluído</button><button class="btn-invalidar btn-sm" onclick="cancelarPedidoRT('${p.id}')">Cancelar pedido</button>`}
    </div>
  </div>`;
}

async function marcarPedidoRTAtendido(id) {
  const { error } = await supabase.from("pedidos_rt").update({ status: "atendido" }).eq("id", id);
  if (error) { mostrarToast("Erro ao atualizar pedido.","erro"); return; }
  const pedido = pedidosRT.find(p => String(p.id) === String(id));
  if (pedido) { pedido.status = "atendido"; pedido.cancelada = false; }
  renderHistorico();
  if (document.getElementById("page-atendimento")?.classList.contains("active")) renderAtendimentoRT();
  mostrarToast("✅ Pedido marcado como atendido.");
}

async function cancelarPedidoRT(id) {
  const ok = await confirmar("Deseja marcar este pedido ART como cancelado?");
  if (!ok) return;
  const { error } = await supabase.from("pedidos_rt").update({ status: "cancelado" }).eq("id", id);
  if (error) { mostrarToast("Erro ao cancelar pedido.","erro"); return; }
  const pedido = pedidosRT.find(p => String(p.id) === String(id));
  if (pedido) { pedido.status = "cancelado"; pedido.cancelada = true; }
  if (document.getElementById("page-atendimento")?.classList.contains("active")) carregarPedidosRTIniciais();
  if (document.getElementById("page-dashboard")?.classList.contains("active")) renderDashboard();
  if (document.getElementById("page-historico")?.classList.contains("active")) renderHistorico();
  mostrarToast("✅ Pedido ART cancelado.");
}

/* ═════════════════════════════════════════
   CATÁLOGO PÚBLICO — tela do cliente (sem login)
═════════════════════════════════════════ */
let catalogoProdutosPublicos = [];
let carrinhoCatalogo = {};
let pagamentosCatalogo = ["dinheiro"];
let splitCatalogo = {};
let whatsappLojaPublico = "";
let cupomCatalogo = { codigo: "", percentual: 0 };
let cupomCatalogoAplicado = false;
let arrastoCarrinhoCatalogo = null;
let ignorarCliqueCarrinhoCatalogo = false;
let carrinhoCatalogoHistoricoAtivo = false;

document.addEventListener("click", e => {
  const wrap = document.getElementById("catalogoCarrinhoWrap");
  if (!wrap || wrap.style.display === "none") return;
  if (ignorarCliqueCarrinhoCatalogo) { ignorarCliqueCarrinhoCatalogo = false; return; }
  if (wrap.classList.contains("minimizado")) {
    if (wrap.contains(e.target)) abrirCarrinhoCatalogo();
    return;
  }
  if (!wrap.contains(e.target)) minimizarCarrinhoCatalogo();
});

document.addEventListener("pointerdown", e => {
  const wrap = document.getElementById("catalogoCarrinhoWrap");
  if (!wrap || wrap.style.display === "none" || wrap.classList.contains("minimizado") || !wrap.contains(e.target)) return;
  if (!e.target.closest("#catalogoCarrinhoHandle")) return;
  arrastoCarrinhoCatalogo = { inicio: e.clientY, atual: e.clientY, id: e.pointerId };
  try { e.target.setPointerCapture?.(e.pointerId); } catch {}
  wrap.classList.add("arrastando");
});

document.addEventListener("pointermove", e => {
  const wrap = document.getElementById("catalogoCarrinhoWrap");
  if (!arrastoCarrinhoCatalogo || !wrap) return;
  const deslocamento = Math.max(0, e.clientY - arrastoCarrinhoCatalogo.inicio);
  arrastoCarrinhoCatalogo.atual = e.clientY;
  wrap.style.setProperty("--cat-carrinho-arrasto", `${deslocamento}px`);
  if (deslocamento > 0) e.preventDefault();
});

document.addEventListener("pointerup", e => {
  const wrap = document.getElementById("catalogoCarrinhoWrap");
  if (!arrastoCarrinhoCatalogo || !wrap) return;
  const deslocamento = Math.max(0, arrastoCarrinhoCatalogo.atual - arrastoCarrinhoCatalogo.inicio);
  try { wrap.releasePointerCapture?.(arrastoCarrinhoCatalogo.id); } catch {}
  arrastoCarrinhoCatalogo = null;
  wrap.classList.remove("arrastando");
  wrap.style.removeProperty("--cat-carrinho-arrasto");
  if (deslocamento >= 80) {
    ignorarCliqueCarrinhoCatalogo = true;
    minimizarCarrinhoCatalogo();
  }
});

function minimizarCarrinhoCatalogo() {
  const wrap = document.getElementById("catalogoCarrinhoWrap");
  if (!wrap) return;
  wrap.classList.add("minimizado");
  atualizarResumoMinimizadoCatalogo();
  if (carrinhoCatalogoHistoricoAtivo) {
    carrinhoCatalogoHistoricoAtivo = false;
    history.back();
  }
}

function atualizarResumoMinimizadoCatalogo() {
  const resumo = document.getElementById("catalogoCarrinhoMinimizado");
  if (!resumo) return;
  const quantidade = Object.values(carrinhoCatalogo).reduce((s, i) => s + i.quantidade, 0);
  resumo.textContent = `🛒 ${quantidade} ite${quantidade === 1 ? "m" : "ns"} · R$ ${fmt(totalCatalogo())}`;
  resumo.setAttribute("aria-hidden", "false");
}

function abrirCarrinhoCatalogo() {
  const wrap = document.getElementById("catalogoCarrinhoWrap");
  if (!wrap) return;
  wrap.classList.remove("minimizado");
  wrap.style.removeProperty("--cat-carrinho-arrasto");
  document.getElementById("catalogoCarrinhoMinimizado")?.setAttribute("aria-hidden", "true");
  if (!carrinhoCatalogoHistoricoAtivo) {
    history.pushState({ catalogoCarrinho: true }, "", location.href);
    carrinhoCatalogoHistoricoAtivo = true;
  }
}

window.addEventListener("popstate", () => {
  const wrap = document.getElementById("catalogoCarrinhoWrap");
  if (!wrap || wrap.style.display === "none") return;
  carrinhoCatalogoHistoricoAtivo = false;
  if (!wrap.classList.contains("minimizado")) {
    minimizarCarrinhoCatalogo();
  }
});

document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  fecharModaisAbertos();
  const wrap = document.getElementById("catalogoCarrinhoWrap");
  if (wrap?.style.display !== "none" && !wrap.classList.contains("minimizado")) minimizarCarrinhoCatalogo();
});

async function iniciarModoCatalogo() {
  document.getElementById("authScreen")?.classList.add("hidden");
  document.getElementById("appShell")?.classList.add("hidden");
  document.getElementById("catalogoScreen")?.classList.remove("hidden");
  mostrarLoading("Carregando catálogo...");
  try {
    const { data: loja, error: errLoja } = await supabase.from("loja_publica").select("*").eq("user_id", LOJA_CATALOGO_ID).maybeSingle();
    if (errLoja || !loja) throw new Error("Loja não encontrada.");
    aplicarIdentidadeCatalogo(loja);
    whatsappLojaPublico = (loja.whatsapp || "").replace(/\D/g,"");
    cupomCatalogo = { codigo: (loja.cupom_codigo || "").trim().toUpperCase(), percentual: Math.min(100, Math.max(0, parseFloat(loja.cupom_percentual) || 0)) };
    const ids = loja.catalogo_produtos || [];
    if (!ids.length) { document.getElementById("catalogoListaProdutos").innerHTML = `<p class="catalogo-vazio">Nenhum produto disponível no momento.</p>`; return; }
    const { data, error } = await supabase.from("catalogo_publico").select("*").eq("user_id", LOJA_CATALOGO_ID).in("id", ids);
    if (error) throw error;
    catalogoProdutosPublicos = data || [];
    renderCatalogoProdutosPublico();
    renderBotoesPagamentoCatalogo();
  } catch(e) {
    console.error(e);
    document.getElementById("catalogoListaProdutos").innerHTML = `<p class="catalogo-vazio">Não foi possível carregar este catálogo. Verifique o link.</p>`;
  } finally {
    esconderLoading();
  }
}

function aplicarIdentidadeCatalogo(loja) {
  const scr = document.getElementById("catalogoScreen");
  const cor = loja.cor || "#00bf63";
  const fonte = LOJA_FONTES.find(f => f.id===loja.fonte) || LOJA_FONTES[0];
  scr.style.setProperty("--cat-cor", cor);
  scr.style.setProperty("--cat-fonte", fonte.css);
  document.getElementById("catalogoLojaNome").textContent = loja.nome || "Catálogo de produtos";
  const img = document.getElementById("catalogoLogoImg"), letra = document.getElementById("catalogoLogoLetra");
  if (loja.avatar_url) { img.src = loja.avatar_url; img.style.display = "block"; letra.style.display = "none"; }
  else { letra.textContent = (loja.nome || "L")[0].toUpperCase(); letra.style.display = "flex"; img.style.display = "none"; }
}

function renderCatalogoProdutosPublico() {
  const lista = document.getElementById("catalogoListaProdutos");
  if (!lista) return;
  lista.innerHTML = catalogoProdutosPublicos.map(p => `
    <div class="card-produto catalogo-produto-card">
      ${p.foto_url?`<img src="${p.foto_url}" alt="">`:""}
      <p class="prod-nome">${p.nome}</p>
      <p class="prod-preco">R$ ${fmt(p.preco)}</p>
      <div class="catalogo-qtd-row">
        <button class="btn-qtd sm" onclick="alterarQtdCatalogo('${p.id}',-1)">−</button>
        <span class="catalogo-qtd-val" id="catQtd-${p.id}">${carrinhoCatalogo[p.id]?.quantidade||0}</span>
        <button class="btn-qtd sm" onclick="alterarQtdCatalogo('${p.id}',1)">+</button>
      </div>
    </div>`).join("");
  renderCarrinhoCatalogo();
}

function alterarQtdCatalogo(id, delta) {
  const p = catalogoProdutosPublicos.find(x=>x.id===id); if (!p) return;
  const atual = carrinhoCatalogo[id]?.quantidade || 0;
  const nova = Math.max(0, atual+delta);
  if (nova===0) delete carrinhoCatalogo[id];
  else carrinhoCatalogo[id] = { nome:p.nome, preco:p.preco, quantidade:nova };
  const badge = document.getElementById(`catQtd-${id}`); if (badge) badge.textContent = nova;
  renderCarrinhoCatalogo();
}

function subtotalCatalogo() { return Object.values(carrinhoCatalogo).reduce((s,i)=>s+i.preco*i.quantidade,0); }
function descontoCatalogo() { return cupomCatalogoAplicado ? subtotalCatalogo() * (cupomCatalogo.percentual / 100) : 0; }
function totalCatalogo() { return Math.max(0, subtotalCatalogo() - descontoCatalogo()); }

function atualizarCupomCatalogo() {
  const input = document.getElementById("catalogoCupomInput");
  const status = document.getElementById("catalogoCupomStatus");
  const digitado = input?.value.trim().toUpperCase() || "";
  cupomCatalogoAplicado = Boolean(digitado && cupomCatalogo.codigo && digitado === cupomCatalogo.codigo && cupomCatalogo.percentual > 0);
  if (status) {
    status.textContent = !digitado ? "" : cupomCatalogoAplicado ? `✓ ${cupomCatalogo.percentual}% de desconto aplicado` : "Cupom inválido";
    status.className = `catalogo-cupom-status ${cupomCatalogoAplicado ? "valido" : "invalido"}`;
  }
  atualizarTotalCatalogo();
  if (document.getElementById("catalogoCarrinhoWrap")?.classList.contains("minimizado")) atualizarResumoMinimizadoCatalogo();
}

function renderCarrinhoCatalogo() {
  const wrap = document.getElementById("catalogoCarrinhoWrap");
  const itens = Object.values(carrinhoCatalogo);
  if (!wrap) return;
  if (!itens.length) { wrap.style.display="none"; wrap.classList.remove("minimizado"); carrinhoCatalogoHistoricoAtivo = false; return; }
  wrap.style.display="block";
  atualizarResumoMinimizadoCatalogo();
  if (!carrinhoCatalogoHistoricoAtivo && !wrap.classList.contains("minimizado")) abrirCarrinhoCatalogo();
  document.getElementById("catalogoCarrinhoItens").innerHTML = itens.map(i=>`<div class="carrinho-item-row"><span>${i.quantidade}x ${i.nome}</span><span>R$ ${fmt(i.preco*i.quantidade)}</span></div>`).join("");
  document.getElementById("catalogoTotalValor").textContent = fmt(totalCatalogo());
  const cupomDesconto = descontoCatalogo();
  const totalRow = document.querySelector(".catalogo-total-row");
  if (totalRow) totalRow.innerHTML = `<span>${cupomDesconto > 0 ? `Total <small class="catalogo-total-original">(R$ ${fmt(subtotalCatalogo())})</small>` : "Total"}</span><span>R$ <span id="catalogoTotalValor">${fmt(totalCatalogo())}</span></span>`;
  atualizarTotalCatalogo();
  if (wrap.classList.contains("minimizado")) atualizarResumoMinimizadoCatalogo();
}

function atualizarTotalCatalogo() {
  const total = totalCatalogo();
  const totalEl = document.getElementById("catalogoTotalValor");
  if (totalEl) totalEl.textContent = fmt(total);
  const totalRow = document.querySelector(".catalogo-total-row");
  if (totalRow) totalRow.innerHTML = `<span>${descontoCatalogo() > 0 ? `Total <small class="catalogo-total-original">(R$ ${fmt(subtotalCatalogo())})</small>` : "Total"}</span><span>R$ <span id="catalogoTotalValor">${fmt(total)}</span></span>`;
  renderSplitPagamentoCatalogo();
}

/* Pagamento múltiplo — reaproveita os mesmos helpers da aba Vendas (_renderSplitHTML/_atualizarResto/getSplitFinal) */
function togglePagamentoCatalogo(tipo) {
  const idx = pagamentosCatalogo.indexOf(tipo);
  if (idx===-1) { pagamentosCatalogo.push(tipo); }
  else { if (pagamentosCatalogo.length===1) { mostrarToast("Selecione ao menos uma forma de pagamento.","erro"); return; } pagamentosCatalogo.splice(idx,1); delete splitCatalogo[tipo]; }
  renderBotoesPagamentoCatalogo(); atualizarTotalCatalogo();
}
function renderBotoesPagamentoCatalogo() {
  ["dinheiro","cartao","pix"].forEach(t => document.getElementById(`catpag-${t}`)?.classList.toggle("ativo", pagamentosCatalogo.includes(t)));
}
function renderSplitPagamentoCatalogo() {
  const c = document.getElementById("catalogoPagamentoSplit"); if (!c) return;
  if (pagamentosCatalogo.length<=1) { c.classList.add("hidden"); c.innerHTML=""; splitCatalogo={}; return; }
  c.classList.remove("hidden");
  _renderSplitHTML(c, pagamentosCatalogo, splitCatalogo, totalCatalogo(), "onSplitInputCatalogo", "catSplitAviso");
  c.insertAdjacentHTML("beforeend", '<div id="catSplitResumo" class="catalogo-split-resumo"></div>');
  atualizarResumoPagamentoCatalogo();
}
function atualizarResumoPagamentoCatalogo() {
  const resumo = document.getElementById("catSplitResumo"); if (!resumo) return;
  const total = totalCatalogo();
  const pagamentos = getSplitFinal(pagamentosCatalogo, splitCatalogo, total);
  const soma = Object.values(pagamentos).reduce((valor, pagamento) => valor + pagamento, 0);
  resumo.innerHTML = `<strong>Total do pedido: R$ ${fmt(total)}</strong><span>${pagamentosCatalogo.map(tipo => `${ICONE_PAGAMENTO[tipo]}: R$ ${fmt(pagamentos[tipo] || 0)}`).join(" + ")}</span><small>Soma dos pagamentos: R$ ${fmt(soma)}</small>`;
}
function onSplitInputCatalogo(tipo) {
  splitCatalogo[tipo]=parseFloat(document.getElementById(`split-input-${tipo}`)?.value)||0;
  _atualizarResto(pagamentosCatalogo,splitCatalogo,totalCatalogo(),"catSplitAviso");
  atualizarResumoPagamentoCatalogo();
}

async function finalizarPedidoCatalogo() {
  const nome = document.getElementById("catalogoClienteNome").value.trim();
  const telefone = document.getElementById("catalogoClienteTelefone").value.trim();
  const itens = Object.values(carrinhoCatalogo);
  if (!itens.length) { mostrarToast("Adicione ao menos um produto.","erro"); return; }
  if (!nome || !telefone) { mostrarToast("Preencha nome e telefone.","erro"); return; }
  const total = totalCatalogo();
  const pagamentosFinal = getSplitFinal(pagamentosCatalogo, splitCatalogo, total);
  mostrarLoading("Enviando pedido...");
  const { error } = await supabase.rpc("criar_pedido_rt", {
    p_loja_user_id: LOJA_CATALOGO_ID,
    p_cliente_nome: nome,
    p_cliente_telefone: telefone,
    p_itens: itens.map(i=>({nome:i.nome,quantidade:i.quantidade,preco:i.preco})),
    p_total: total,
    p_pagamento: pagamentosCatalogo.join("+"),
    p_pagamentos: pagamentosFinal,
  });
  esconderLoading();
  if (error) {
    console.error("Erro ao enviar pedido RT:", error);
    mostrarToast(`Erro ao enviar pedido: ${error.message || "permissão negada"}`, "erro");
    return;
  }
  const itensTxt = itens.map(i=>`- ${i.quantidade}x ${i.nome} (R$ ${fmt(i.preco*i.quantidade)})`).join("\n");
  const pagsTxt = Object.entries(pagamentosFinal).filter(([,v])=>v>0).map(([t,v])=>pagamentosCatalogo.length>1?`${ICONE_PAGAMENTO[t]}: R$ ${fmt(v)}`:ICONE_PAGAMENTO[t]).join(" + ");
  const cupomTxt = cupomCatalogoAplicado ? `\nCupom: ${cupomCatalogo.codigo} (${cupomCatalogo.percentual}% de desconto)` : "";
  const msg = `Olá! Gostaria de fazer o seguinte pedido:\n\n${itensTxt}${cupomTxt}\n\n*Total: R$ ${fmt(total)}*\nForma de pagamento: ${pagsTxt}\n\nNome: ${nome}`;
  if (whatsappLojaPublico) window.location.href = `https://wa.me/${whatsappLojaPublico}?text=${encodeURIComponent(msg)}`;
  else mostrarToast("✅ Pedido enviado! A loja não configurou um WhatsApp.");
}

/* ─────────────────────────────────────────
   EXPOR FUNÇÕES PARA O HTML (ES Module scope)
───────────────────────────────────────── */
Object.assign(window, {
  // Auth
  login, registrar, logout, mostrarRegistro, voltarLogin, toggleSenha,
  // Navegação
  navegarPara,
  // Vendas
  togglePagamento, onSplitInput, setTipoDesconto, finalizarPedido,
  limparCarrinho, removerDoCarrinho, alterarQtd, definirQtd,
  selecionarCategoria, renderProdutos, atualizarTotal,
  // Produtos
  salvarProduto, editarProduto, excluirProduto, cancelarEdicao,
  atualizarNomeArquivo, removerFotoProduto, renderProdutosAdmin,
  // Clientes
  salvarCliente, editarCliente, excluirCliente, cancelarEdicaoCliente, renderClientes,
  // Formatadores
  formatarTelefone, formatarCpf,
  // Histórico
  setTipoHistorico, setFiltroHistorico, setFiltroDashboard, cancelarVenda, abrirComprovanteHistorico, abrirEditarVenda,
  abrirModalBaixoEstoque, fecharModalBaixoEstoque, editarProdutoDoDashboard,
  // Comprovante
  fecharComprovante, imprimirComprovante, baixarComprovantePDF,
  // Editar venda
  fecharEditarVenda, confirmarSenhaAdmin, editarItemQtd, removerItemEditar,
  setEditTipoDesconto, toggleEditPagamento, onEditSplitInput, salvarEdicaoVenda,
  // Relatórios
  setFiltroRelatorio, exportarCSV, exportarRelPDF, copiarPedido,
  // Configurações
  definirTema, trocarSenha, atualizarFotoPerfil, removerFotoPerfil,
  salvarNomeLoja, selecionarCorLoja, selecionarFonteLoja, atualizarPreviewLoja,
  resetarOrdemMenu, salvarWhatsappLoja, salvarCupomLoja, atualizarCupomCatalogo,
  // Atendimento RT (admin)
  toggleCatalogoProdutoRT, marcarTodosCatalogoRT, desmarcarTodosCatalogoRT, copiarLinkCatalogoRT, marcarPedidoRTAtendido, cancelarPedidoRT, ativarNotificacoesPedidos,
  // Catálogo público (cliente)
  alterarQtdCatalogo, togglePagamentoCatalogo, onSplitInputCatalogo, finalizarPedidoCatalogo,
});

function renderConfiguracoes() {
  if (!usuarioAtual) return;
  const avatarUrl = lojaConfigAtual._avatarUrl || "";
  const pi=document.getElementById("avatarPreviewImg"),pl=document.getElementById("avatarPreviewLetra");
  if(pi&&pl){if(avatarUrl){pi.src=avatarUrl;pi.style.display="block";pl.style.display="none";}else{pi.style.display="none";pl.style.display="block";pl.textContent=usuarioAtual.email[0].toUpperCase();}}
  const ie=document.getElementById("identityEmail"); if(ie)ie.textContent=usuarioAtual.email;
  const tema=document.documentElement.getAttribute("data-theme")||"light";
  document.getElementById("tema-claro")?.classList.toggle("ativo",tema==="light");
  document.getElementById("tema-escuro")?.classList.toggle("ativo",tema==="dark");
  ["senhaAtual","novaSenhaConfig","confirmarSenhaConfig"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
  const il=document.getElementById("nomeLoja");if(il)il.value=lojaConfigAtual.nome||"";
  const iw=document.getElementById("whatsappLoja");if(iw)iw.value=lojaConfigAtual.whatsapp||"";
  const ic=document.getElementById("cupomCodigoLoja");if(ic)ic.value=lojaConfigAtual.cupom_codigo||"";
  const ip=document.getElementById("cupomPercentualLoja");if(ip)ip.value=lojaConfigAtual.cupom_percentual||"";
  renderLojaConfigUI();renderMenuOrderList();
}

async function atualizarFotoPerfil(input) {
  if (!input.files[0]) return;
  mostrarLoading("Salvando foto...");
  try {
    const ext = input.files[0].name.split(".").pop();
    const path = `avatars/${usuarioAtual.id}.${ext}`;
    const { error } = await supabase.storage.from("fotos").upload(path, input.files[0], { upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("fotos").getPublicUrl(path);
    const url = urlData.publicUrl + "?t=" + Date.now(); // evita cache
    await fbSalvarConfig({ avatar_url: url });
    atualizarExibicaoAvatar(url, usuarioAtual.email[0].toUpperCase());
    const pi=document.getElementById("avatarPreviewImg"),pl=document.getElementById("avatarPreviewLetra");
    if(pi&&pl){pi.src=url;pi.style.display="block";pl.style.display="none";}
    mostrarToast("✅ Foto atualizada!");
  } catch(e) {
    console.error(e);
    mostrarToast("Erro ao salvar foto.","erro");
  } finally {
    esconderLoading();
  }
}
async function removerFotoPerfil(){
  const ok=await confirmar("Remover foto de perfil?");if(!ok)return;
  // Remove do Storage (tenta jpg e png)
  await supabase.storage.from("fotos").remove([`avatars/${usuarioAtual.id}.jpg`, `avatars/${usuarioAtual.id}.png`, `avatars/${usuarioAtual.id}.jpeg`, `avatars/${usuarioAtual.id}.webp`]);
  await fbSalvarConfig({ avatar_url: "" });
  const letra=usuarioAtual.email[0].toUpperCase();
  atualizarExibicaoAvatar(null, letra);
  const pi=document.getElementById("avatarPreviewImg"),pl=document.getElementById("avatarPreviewLetra");
  if(pi&&pl){pi.style.display="none";pl.style.display="block";pl.textContent=letra;}
  document.getElementById("fotoPerfilInput").value=""; mostrarToast("Foto removida.");
}
function atualizarExibicaoAvatar(b64,letra){
  const ai=document.getElementById("avatarImg"),al=document.getElementById("avatarLetra");
  if(b64&&ai&&al){ai.src=b64;ai.style.display="block";al.style.display="none";}else if(ai&&al){ai.style.display="none";al.style.display="block";al.textContent=letra;}
  const mi=document.getElementById("avatarImgMobile"),ml=document.getElementById("avatarLetraMobile");
  if(b64&&mi&&ml){mi.src=b64;mi.style.display="block";ml.style.display="none";}else if(mi&&ml){mi.style.display="none";ml.style.display="block";ml.textContent=letra;}
  const pi=document.getElementById("avatarPreviewImg"),pl=document.getElementById("avatarPreviewLetra");
  if(b64&&pi&&pl){pi.src=b64;pi.style.display="block";pl.style.display="none";}else if(pi&&pl){pi.style.display="none";pl.style.display="block";pl.textContent=letra;}
}
function definirTema(tema){document.documentElement.setAttribute("data-theme",tema);fbSalvarConfig({tema});document.getElementById("tema-claro")?.classList.toggle("ativo",tema==="light");document.getElementById("tema-escuro")?.classList.toggle("ativo",tema==="dark");}

async function trocarSenha(){
  const at=document.getElementById("senhaAtual").value,nv=document.getElementById("novaSenhaConfig").value,cf=document.getElementById("confirmarSenhaConfig").value;
  if(!at||!nv||!cf){mostrarToast("Preencha todos os campos.","erro");return;}
  if(nv.length<6){mostrarToast("Mínimo 6 caracteres.","erro");return;}
  if(nv!==cf){mostrarToast("Senhas não coincidem.","erro");return;}
  if(nv===at){mostrarToast("A nova senha deve ser diferente.","erro");return;}
  // Reautentica antes de trocar a senha
  const { error: reAuthErr } = await supabase.auth.signInWithPassword({
    email: usuarioAtual.email,
    password: at,
  });
  if (reAuthErr) { mostrarToast("Senha atual incorreta.","erro"); return; }
  const { error } = await supabase.auth.updateUser({ password: nv });
  if (error) { mostrarToast("Erro ao atualizar senha.","erro"); return; }
  ["senhaAtual","novaSenhaConfig","confirmarSenhaConfig"].forEach(id=>{const el=document.getElementById(id);if(el)el.value="";});
  mostrarToast("✅ Senha atualizada!");
}
