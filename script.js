/* ===================================================
   HubVendasPro — script.js (Supabase Edition)
   =================================================== */

/* ─── Supabase Config ─── */
const SUPABASE_URL = "https://rueultfdyaacsczhmqda.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1ZXVsdGZkeWFhY3NjemhtcWRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MDE4NzAsImV4cCI6MjA4ODE3Nzg3MH0.o9PiOMMhDAhaeMpsMuqSXcjLncWbraCbTLO3xQFaCYM";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ─── Estado global ─── */
let produtos  = [];
let historico = [];
let clientes  = [];
let gastos    = [];

let carrinho               = {};
let usuarioAtual           = null;
let editandoId             = null;
let editandoClienteId      = null;
let editandoGastoId        = null;
let pagamentosSelecionados = ["dinheiro"];
let splitPagamento         = {};
let tipoDesconto           = "pct";
let categoriaAtiva         = "todas";
let filtroHistorico        = "hoje";
let filtroRelatorio        = "hoje";
let vendaComprovanteAtual  = null;

let editarVendaIdx     = null;
let editarItens        = [];
let editarPagamentos   = ["dinheiro"];
let editarSplit        = {};
let editarTipoDesconto = "pct";

const ICONE_PAGAMENTO = { dinheiro: "💵 Dinheiro", cartao: "💳 Cartão", pix: "⚡ Pix" };
const MENU_PADRAO = [
  { id: "dashboard",     icon: "📊", label: "Dashboard",    bnav: "Dash"      },
  { id: "vendas",        icon: "🛒", label: "Vendas",       bnav: "Vendas"    },
  { id: "admin",         icon: "📦", label: "Produtos",     bnav: "Produtos"  },
  { id: "clientes",      icon: "👥", label: "Clientes",     bnav: "Clientes"  },
  { id: "gastos",        icon: "💸", label: "Gastos",       bnav: "Gastos"    },
  { id: "historico",     icon: "📋", label: "Histórico",    bnav: "Histórico" },
  { id: "relatorios",    icon: "📈", label: "Relatórios",   bnav: "Relatórios"},
  { id: "configuracoes", icon: "⚙️", label: "Configurações", bnav: "Config"   },
];

let lojaConfigAtual = {nome:"",cor:"#00bf63",fonte:"jakarta"};
let _menuOrdemLocal = [];

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
   AUTENTICAÇÃO SUPABASE
───────────────────────────────────────── */

async function login() {
  const email = document.getElementById("email")?.value?.trim();
  const senha = document.getElementById("senha")?.value;
  if (!email || !emailValido(email)) { mostrarToast("Email inválido.","erro"); return; }
  if (!senha || senha.length < 6) { mostrarToast("Senha deve ter no mínimo 6 caracteres.","erro"); return; }
  
  mostrarLoading("Entrando...");
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) throw error;
    usuarioAtual = data.user;
    document.getElementById("email").value = "";
    document.getElementById("senha").value = "";
    await carregarDadosUsuario();
    mostrarAppShell();
  } catch(e) {
    console.error("Erro ao fazer login:", e);
    mostrarToast(e.message || "Erro ao fazer login.","erro");
  } finally {
    esconderLoading();
  }
}

async function registrar() {
  const email = document.getElementById("novoEmail")?.value?.trim();
  const senha = document.getElementById("novaSenha")?.value;
  const confirmar = document.getElementById("confirmarSenha")?.value;
  
  if (!email || !emailValido(email)) { mostrarToast("Email inválido.","erro"); return; }
  if (!senha || senha.length < 6) { mostrarToast("Senha deve ter no mínimo 6 caracteres.","erro"); return; }
  if (senha !== confirmar) { mostrarToast("Senhas não conferem.","erro"); return; }
  
  mostrarLoading("Criando conta...");
  try {
    const { data, error } = await supabase.auth.signUp({ email, password: senha });
    if (error) throw error;
    mostrarToast("Conta criada com sucesso! Verifique seu email para confirmar.");
    voltarLogin();
  } catch(e) {
    console.error("Erro ao registrar:", e);
    mostrarToast(e.message || "Erro ao criar conta.","erro");
  } finally {
    esconderLoading();
  }
}

async function logout() {
  const ok = await confirmar("Deseja sair?");
  if (!ok) return;
  
  mostrarLoading("Saindo...");
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    usuarioAtual = null;
    produtos = [];
    historico = [];
    clientes = [];
    gastos = [];
    carrinho = {};
    mostrarAuthScreen();
  } catch(e) {
    console.error("Erro ao sair:", e);
    mostrarToast("Erro ao sair.","erro");
  } finally {
    esconderLoading();
  }
}

/* ─────────────────────────────────────────
   SUPABASE — CARREGAR DADOS DO USUÁRIO
───────────────────────────────────────── */

async function carregarDadosUsuario() {
  mostrarLoading("Sincronizando dados...");
  try {
    if (!usuarioAtual) return;
    
    // Carrega produtos
    const { data: prodData, error: prodError } = await supabase
      .from("products")
      .select("*")
      .eq("user_id", usuarioAtual.id);
    if (prodError) throw prodError;
    produtos = (prodData || []).map(p => ({
      id: p.sku_id,
      skuId: p.sku_id,
      nome: p.name,
      preco: parseFloat(p.price),
      categoria: p.category || "",
      fotoKey: p.photo_key || "",
      supabaseId: p.id
    }));

    // Carrega clientes
    const { data: cliData, error: cliError } = await supabase
      .from("clients")
      .select("*")
      .eq("user_id", usuarioAtual.id);
    if (cliError) throw cliError;
    clientes = (cliData || []).map(c => ({
      id: parseInt(c.id.slice(0, 8), 16) % 1000000,
      nome: c.name,
      telefone: c.phone || "",
      cpf: c.cpf || "",
      email: c.email || "",
      endereco: c.address || "",
      supabaseId: c.id
    }));

    // Carrega vendas
    const { data: salesData, error: salesError } = await supabase
      .from("sales")
      .select("*, sale_items(*)")
      .eq("user_id", usuarioAtual.id)
      .order("created_at", { ascending: false });
    if (salesError) throw salesError;
    historico = (salesData || []).map(s => ({
      id: parseInt(s.id.slice(0, 8), 16) % 1000000,
      itens: (s.sale_items || []).map(si => ({
        nome: si.product_name,
        skuId: si.product_sku_id,
        quantidade: si.quantity,
        preco: parseFloat(si.price)
      })),
      subtotal: parseFloat(s.subtotal),
      desconto: parseFloat(s.discount),
      total: parseFloat(s.total),
      pagamentos: s.payment_details || {},
      pagamento: s.payment_method,
      data: new Date(s.sale_date).toLocaleDateString("pt-BR"),
      hora: s.sale_time,
      cancelada: s.cancelled,
      clienteId: null,
      clienteNome: "",
      supabaseId: s.id
    }));

    // Carrega gastos
    const { data: gastosData, error: gastosError } = await supabase
      .from("gastos")
      .select("*")
      .eq("user_id", usuarioAtual.id);
    if (gastosError) throw gastosError;
    gastos = (gastosData || []).map(g => ({
      id: g.id,
      descricao: g.descricao,
      valor: parseFloat(g.valor),
      mes: g.mes,
      ano: g.ano,
      recorrente: g.recorrente,
      pago: g.pago,
      supabaseId: g.id
    }));

    // Carrega config
    const { data: cfgData, error: cfgError } = await supabase
      .from("user_configs")
      .select("*")
      .eq("user_id", usuarioAtual.id)
      .single();
    if (!cfgError && cfgData) {
      lojaConfigAtual = cfgData.store_config || {nome:"",cor:"#00bf63",fonte:"jakarta"};
      if (cfgData.theme) document.documentElement.setAttribute("data-theme", cfgData.theme);
      if (cfgData.menu_order) _menuOrdemLocal = cfgData.menu_order;
    }

    // Atualiza UI
    atualizarMenuNav();
    renderizarPagina("dashboard");
    document.getElementById("emailLogado").textContent = usuarioAtual.email;
    const letra = usuarioAtual.email[0].toUpperCase();
    document.getElementById("avatarLetra").textContent = letra;
    document.getElementById("avatarLetraMobile").textContent = letra;
    document.getElementById("sidebarLojaBadge").textContent = lojaConfigAtual.nome || "Minha Loja";
    document.getElementById("topbarLojaBadge").textContent = lojaConfigAtual.nome || "Minha Loja";

  } catch(e) {
    console.error("Erro ao carregar dados:", e);
    mostrarToast("Erro ao carregar dados. Verifique a conexão.","erro");
  } finally {
    esconderLoading();
  }
}

/* ─────────────────────────────────────────
   SUPABASE — SALVAR / ATUALIZAR / DELETAR
───────────────────────────────────────── */

// Produtos
async function sbSalvarProduto(produto) {
  try {
    if (produto.supabaseId) {
      const { error } = await supabase
        .from("products")
        .update({
          name: produto.nome,
          price: produto.preco,
          category: produto.categoria,
          photo_key: produto.fotoKey
        })
        .eq("id", produto.supabaseId);
      if (error) throw error;
      return produto.supabaseId;
    } else {
      const { data, error } = await supabase
        .from("products")
        .insert({
          user_id: usuarioAtual.id,
          sku_id: produto.skuId,
          name: produto.nome,
          price: produto.preco,
          category: produto.categoria,
          photo_key: produto.fotoKey
        })
        .select()
        .single();
      if (error) throw error;
      return data.id;
    }
  } catch(e) { 
    console.error("Erro ao salvar produto:", e);
    mostrarToast("Erro ao salvar produto.","erro"); 
    return null; 
  }
}

async function sbDeletarProduto(supabaseId) {
  try { 
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", supabaseId);
    if (error) throw error;
  } catch(e) { 
    console.error("Erro ao deletar produto:", e);
    mostrarToast("Erro ao deletar produto.","erro"); 
  }
}

// Vendas
async function sbSalvarVenda(venda) {
  try {
    const { data: saleData, error: saleError } = await supabase
      .from("sales")
      .insert({
        user_id: usuarioAtual.id,
        sale_date: new Date().toISOString().split('T')[0],
        sale_time: venda.hora,
        subtotal: venda.subtotal,
        discount: venda.desconto,
        total: venda.total,
        payment_method: venda.pagamento,
        payment_details: venda.pagamentos,
        cancelled: venda.cancelada,
        client_id: venda.clienteId ? null : null
      })
      .select()
      .single();
    if (saleError) throw saleError;

    // Salva itens da venda
    for (const item of venda.itens) {
      const { error: itemError } = await supabase
        .from("sale_items")
        .insert({
          sale_id: saleData.id,
          product_name: item.nome,
          product_sku_id: item.skuId,
          quantity: item.quantidade,
          price: item.preco
        });
      if (itemError) throw itemError;
    }

    return saleData.id;
  } catch(e) { 
    console.error("Erro ao salvar venda:", e);
    mostrarToast("Erro ao salvar venda.","erro"); 
    return null; 
  }
}

async function sbAtualizarVenda(supabaseId, dados) {
  try { 
    const { error } = await supabase
      .from("sales")
      .update(dados)
      .eq("id", supabaseId);
    if (error) throw error;
  } catch(e) { 
    console.error("Erro ao atualizar venda:", e);
    mostrarToast("Erro ao atualizar venda.","erro"); 
  }
}

// Clientes
async function sbSalvarCliente(cliente) {
  try {
    if (cliente.supabaseId) {
      const { error } = await supabase
        .from("clients")
        .update({
          name: cliente.nome,
          phone: cliente.telefone,
          cpf: cliente.cpf,
          email: cliente.email,
          address: cliente.endereco
        })
        .eq("id", cliente.supabaseId);
      if (error) throw error;
      return cliente.supabaseId;
    } else {
      const { data, error } = await supabase
        .from("clients")
        .insert({
          user_id: usuarioAtual.id,
          name: cliente.nome,
          phone: cliente.telefone,
          cpf: cliente.cpf,
          email: cliente.email,
          address: cliente.endereco
        })
        .select()
        .single();
      if (error) throw error;
      return data.id;
    }
  } catch(e) { 
    console.error("Erro ao salvar cliente:", e);
    mostrarToast("Erro ao salvar cliente.","erro"); 
    return null; 
  }
}

async function sbDeletarCliente(supabaseId) {
  try { 
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", supabaseId);
    if (error) throw error;
  } catch(e) { 
    console.error("Erro ao deletar cliente:", e);
    mostrarToast("Erro ao deletar cliente.","erro"); 
  }
}

// Gastos
async function sbSalvarGasto(gasto) {
  try {
    if (gasto.supabaseId) {
      const { error } = await supabase
        .from("gastos")
        .update({
          descricao: gasto.descricao,
          valor: gasto.valor,
          mes: gasto.mes,
          ano: gasto.ano,
          recorrente: gasto.recorrente,
          pago: gasto.pago
        })
        .eq("id", gasto.supabaseId);
      if (error) throw error;
      return gasto.supabaseId;
    } else {
      const { data, error } = await supabase
        .from("gastos")
        .insert({
          user_id: usuarioAtual.id,
          descricao: gasto.descricao,
          valor: gasto.valor,
          mes: gasto.mes,
          ano: gasto.ano,
          recorrente: gasto.recorrente,
          pago: gasto.pago
        })
        .select()
        .single();
      if (error) throw error;
      return data.id;
    }
  } catch(e) { 
    console.error("Erro ao salvar gasto:", e);
    mostrarToast("Erro ao salvar gasto.","erro"); 
    return null; 
  }
}

async function sbDeletarGasto(supabaseId) {
  try { 
    const { error } = await supabase
      .from("gastos")
      .delete()
      .eq("id", supabaseId);
    if (error) throw error;
  } catch(e) { 
    console.error("Erro ao deletar gasto:", e);
    mostrarToast("Erro ao deletar gasto.","erro"); 
  }
}

// Config geral
async function sbSalvarConfig(dados) {
  try { 
    const { error } = await supabase
      .from("user_configs")
      .upsert({
        user_id: usuarioAtual.id,
        ...dados
      });
    if (error) throw error;
  } catch(e) { 
    console.error("Erro ao salvar config:", e);
  }
}

/* ─────────────────────────────────────────
   SUPABASE STORAGE — IMAGENS
───────────────────────────────────────── */

const DB_NAME = "hvp_images";
let db_idb = null;

function abrirDB() {
  return new Promise((res, rej) => {
    if (db_idb) { res(db_idb); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("imagens")) {
        db.createObjectStore("imagens", { keyPath: "key" });
      }
    };
    req.onsuccess = () => { db_idb = req.result; res(db_idb); };
    req.onerror = () => rej(req.error);
  });
}

async function salvarImagem(file) {
  try {
    const key = `img_${Date.now()}_${Math.random().toString(36).substr(2,9)}`;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const db = await abrirDB();
      const tx = db.transaction("imagens", "readwrite");
      const store = tx.objectStore("imagens");
      store.put({ key, data: e.target.result });
    };
    reader.readAsDataURL(file);
    return key;
  } catch(e) {
    console.error("Erro ao salvar imagem:", e);
    return null;
  }
}

async function carregarImagem(key) {
  try {
    const db = await abrirDB();
    return new Promise((res, rej) => {
      const tx = db.transaction("imagens", "readonly");
      const store = tx.objectStore("imagens");
      const req = store.get(key);
      req.onsuccess = () => res(req.result?.data || null);
      req.onerror = () => rej(req.error);
    });
  } catch(e) {
    console.error("Erro ao carregar imagem:", e);
    return null;
  }
}

async function removerImagem(key) {
  try {
    const db = await abrirDB();
    return new Promise((res, rej) => {
      const tx = db.transaction("imagens", "readwrite");
      const store = tx.objectStore("imagens");
      const req = store.delete(key);
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    });
  } catch(e) {
    console.error("Erro ao remover imagem:", e);
  }
}

/* ─────────────────────────────────────────
   NAVEGAÇÃO E UI
───────────────────────────────────────── */

function mostrarAuthScreen() {
  document.getElementById("authScreen").classList.remove("hidden");
  document.getElementById("appShell").classList.add("hidden");
}

function mostrarAppShell() {
  document.getElementById("authScreen").classList.add("hidden");
  document.getElementById("appShell").classList.remove("hidden");
}

function mostrarRegistro() {
  document.getElementById("login").classList.add("hidden");
  document.getElementById("registro").classList.remove("hidden");
}

function voltarLogin() {
  document.getElementById("login").classList.remove("hidden");
  document.getElementById("registro").classList.add("hidden");
}

function toggleSenha(id, btn) {
  const input = document.getElementById(id);
  if (input.type === "password") {
    input.type = "text";
    btn.textContent = "🙈";
  } else {
    input.type = "password";
    btn.textContent = "👁";
  }
}

function atualizarMenuNav() {
  const nav = document.getElementById("sidebarNav");
  const bnav = document.getElementById("bottomNav");
  if (!nav || !bnav) return;
  
  const menu = _menuOrdemLocal.length > 0 
    ? MENU_PADRAO.filter(m => _menuOrdemLocal.includes(m.id))
    : MENU_PADRAO;
  
  nav.innerHTML = menu.map(m => 
    `<button class="nav-item" id="nav-${m.id}" onclick="navegarPara('${m.id}')">${m.icon} ${m.label}</button>`
  ).join("");
  
  bnav.innerHTML = menu.map(m => 
    `<button class="bnav-item" id="bnav-${m.id}" onclick="navegarPara('${m.id}')">${m.icon}<span>${m.bnav}</span></button>`
  ).join("");
}

function navegarPara(pagina) {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  document.getElementById(`page-${pagina}`)?.classList.remove("hidden");
  
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("ativo"));
  document.getElementById(`nav-${pagina}`)?.classList.add("ativo");
  
  document.querySelectorAll(".bnav-item").forEach(b => b.classList.remove("ativo"));
  document.getElementById(`bnav-${pagina}`)?.classList.add("ativo");
  
  if (pagina === "dashboard") renderDashboard();
  if (pagina === "vendas") { renderProdutos(); renderCarrinho(); }
  if (pagina === "admin") renderProdutosAdmin();
  if (pagina === "clientes") renderClientes();
  if (pagina === "gastos") renderGastos();
  if (pagina === "historico") renderHistorico();
  if (pagina === "relatorios") renderRelatorios();
  if (pagina === "configuracoes") renderConfiguracoes();
}

function renderizarPagina(pagina) {
  navegarPara(pagina);
}

/* ─────────────────────────────────────────
   DASHBOARD
───────────────────────────────────────── */

function renderDashboard() {
  const hoje = new Date();
  const semanaPassada = new Date(hoje);
  semanaPassada.setDate(semanaPassada.getDate() - 6);
  
  const vendas7dias = historico.filter(v => {
    const d = parseDDMMYYYY(v.data);
    return d >= semanaPassada && d <= hoje && !v.cancelada;
  });
  
  const totalVendas = vendas7dias.reduce((a, v) => a + v.total, 0);
  const totalItens = vendas7dias.reduce((a, v) => a + v.itens.reduce((b, i) => b + i.quantidade, 0), 0);
  
  const kpiGrid = document.getElementById("kpiGrid");
  if (kpiGrid) {
    kpiGrid.innerHTML = `
      <div class="kpi-card">
        <span class="kpi-icon">💰</span>
        <div class="kpi-content">
          <p class="kpi-label">Total de Vendas</p>
          <p class="kpi-value">R$ ${fmt(totalVendas)}</p>
        </div>
      </div>
      <div class="kpi-card">
        <span class="kpi-icon">📦</span>
        <div class="kpi-content">
          <p class="kpi-label">Itens Vendidos</p>
          <p class="kpi-value">${totalItens}</p>
        </div>
      </div>
      <div class="kpi-card">
        <span class="kpi-icon">👥</span>
        <div class="kpi-content">
          <p class="kpi-label">Clientes</p>
          <p class="kpi-value">${clientes.length}</p>
        </div>
      </div>
      <div class="kpi-card">
        <span class="kpi-icon">📊</span>
        <div class="kpi-content">
          <p class="kpi-label">Ticket Médio</p>
          <p class="kpi-value">R$ ${vendas7dias.length > 0 ? fmt(totalVendas / vendas7dias.length) : "0,00"}</p>
        </div>
      </div>
    `;
  }
  
  // Pagamentos
  const pagamentosMap = {};
  vendas7dias.forEach(v => {
    for (const [tipo, valor] of Object.entries(v.pagamentos || {})) {
      pagamentosMap[tipo] = (pagamentosMap[tipo] || 0) + valor;
    }
  });
  
  const dashPagamentos = document.getElementById("dashPagamentos");
  if (dashPagamentos) {
    dashPagamentos.innerHTML = Object.entries(pagamentosMap).map(([tipo, valor]) => 
      `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border2)">
        <span>${ICONE_PAGAMENTO[tipo] || tipo}</span>
        <span class="mono" style="font-weight:700">R$ ${fmt(valor)}</span>
      </div>`
    ).join("");
  }
  
  // Produtos mais vendidos
  const produtosVendidos = {};
  vendas7dias.forEach(v => {
    v.itens.forEach(i => {
      produtosVendidos[i.nome] = (produtosVendidos[i.nome] || 0) + i.quantidade;
    });
  });
  
  const topProdutos = document.getElementById("topProdutos");
  if (topProdutos) {
    const top = Object.entries(produtosVendidos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    topProdutos.innerHTML = top.map(([nome, qtd]) => 
      `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border2)">
        <span>${nome}</span>
        <span class="mono" style="font-weight:700">${qtd} un.</span>
      </div>`
    ).join("") || "<p style='color:var(--text3)'>Nenhuma venda registrada.</p>";
  }
}

/* ─────────────────────────────────────────
   PRODUTOS
───────────────────────────────────────── */

function proximoSkuId() {
  if (produtos.length === 0) return 1;
  return Math.max(...produtos.map(p => p.skuId || 0)) + 1;
}

function atualizarSugestoesCategorias() {
  const cats = [...new Set(produtos.map(p => p.categoria).filter(c => c))];
  const datalist = document.getElementById("categoriasSugestoes");
  if (datalist) {
    datalist.innerHTML = cats.map(c => `<option value="${c}">`).join("");
  }
}

function selecionarFoto() {
  const input = document.getElementById("fotoProduto");
  const preview = document.getElementById("fotoPrevisualizacao");
  const img = document.getElementById("fotoPreviewImg");
  const label = document.getElementById("fotoNomeArquivo");
  
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
      preview.style.display = "block";
      label.textContent = file.name;
    };
    reader.readAsDataURL(file);
  }
}

function removerFotoProduto() {
  document.getElementById("fotoProduto").value = "";
  document.getElementById("fotoPrevisualizacao").style.display = "none";
  document.getElementById("fotoNomeArquivo").textContent = "Escolher imagem...";
}

async function salvarProduto() {
  const nome = document.getElementById("nomeProduto")?.value?.trim();
  const preco = parseFloat(document.getElementById("precoProduto")?.value) || 0;
  const cat = document.getElementById("categoriaProduto")?.value?.trim() || "";
  
  if (!nome) { mostrarToast("Nome do produto é obrigatório.","erro"); return; }
  if (preco <= 0) { mostrarToast("Preço deve ser maior que zero.","erro"); return; }
  
  mostrarLoading("Salvando produto...");
  try {
    let fotoKey = "";
    const fotoProduto = document.getElementById("fotoProduto");
    if (fotoProduto.files && fotoProduto.files[0]) {
      fotoKey = await salvarImagem(fotoProduto.files[0]);
    }
    
    if (editandoId !== null) {
      const idx = produtos.findIndex(p => p.id === editandoId);
      if (idx !== -1) {
        produtos[idx].nome = nome;
        produtos[idx].preco = preco;
        produtos[idx].categoria = cat;
        if (fotoKey) produtos[idx].fotoKey = fotoKey;
        await sbSalvarProduto(produtos[idx]);
        editandoId = null;
      }
    } else {
      const novo = {
        id: Date.now(),
        skuId: proximoSkuId(),
        nome,
        preco,
        categoria: cat,
        fotoKey: fotoKey || ""
      };
      const sid = await sbSalvarProduto(novo);
      if (sid) { novo.supabaseId = sid; produtos.push(novo); }
    }
    
    limparCamposProduto();
    renderProdutosAdmin();
    atualizarSugestoesCategorias();
    document.getElementById("adminFormLabel").textContent = "Novo produto";
    document.getElementById("btnCancelarEdicao").style.display = "none";
    mostrarToast("Produto salvo com sucesso!");
  } catch(e) {
    console.error("Erro ao salvar produto:", e);
    mostrarToast("Erro ao salvar produto.","erro");
  } finally {
    esconderLoading();
  }
}

function editarProduto(id) {
  const p = produtos.find(p => p.id === id);
  if (!p) return;
  
  document.getElementById("nomeProduto").value = p.nome;
  document.getElementById("precoProduto").value = p.preco;
  document.getElementById("categoriaProduto").value = p.categoria || "";
  editandoId = id;
  document.getElementById("adminFormLabel").textContent = `Editando: ${p.nome}`;
  document.getElementById("btnCancelarEdicao").style.display = "inline-flex";
  document.querySelector(".section-card")?.scrollIntoView({behavior:"smooth"});
}

function cancelarEdicao() {
  editandoId = null;
  limparCamposProduto();
  document.getElementById("adminFormLabel").textContent = "Novo produto";
  document.getElementById("btnCancelarEdicao").style.display = "none";
}

async function excluirProduto(id) {
  const ok = await confirmar("Deseja excluir este produto?");
  if (!ok) return;
  
  const p = produtos.find(p => p.id === id);
  if (p?.fotoKey) await removerImagem(p.fotoKey);
  if (p?.supabaseId) await sbDeletarProduto(p.supabaseId);
  
  produtos = produtos.filter(p => p.id !== id);
  delete carrinho[id];
  atualizarTotal();
  renderProdutosAdmin();
  mostrarToast("Produto excluído.");
}

function limparCamposProduto() {
  document.getElementById("nomeProduto").value = "";
  document.getElementById("precoProduto").value = "";
  document.getElementById("categoriaProduto").value = "";
  removerFotoProduto();
}

function renderProdutos() {
  const busca = (document.getElementById("buscaProdutos")?.value || "").toLowerCase().trim();
  const filtrados = produtos.filter(p => {
    if (categoriaAtiva !== "todas" && p.categoria !== categoriaAtiva) return false;
    if (!busca) return true;
    return p.nome.toLowerCase().includes(busca);
  });
  
  const lista = document.getElementById("listaProdutos");
  if (!lista) return;
  
  if (!filtrados.length) {
    lista.innerHTML = `<div class="empty-state"><span>📦</span>${busca ? "Nenhum produto encontrado." : "Nenhum produto cadastrado ainda."}</div>`;
    return;
  }
  
  lista.innerHTML = filtrados.map(p => `
    <div class="produto-card" onclick="adicionarAoCarrinho(${p.id})">
      <div class="produto-img">${p.fotoKey ? "📷" : "📦"}</div>
      <p class="produto-nome">${p.nome}</p>
      <p class="produto-preco">R$ ${fmt(p.preco)}</p>
      <p class="produto-sku">#${String(p.skuId).padStart(4, "0")}</p>
    </div>
  `).join("");
  
  // Atualizar categorias
  const cats = ["todas", ...new Set(produtos.map(p => p.categoria).filter(c => c))];
  const catTabs = document.getElementById("categoriasTabs");
  if (catTabs) {
    catTabs.innerHTML = cats.map(c => 
      `<button class="categoria-tab ${c === categoriaAtiva ? "ativo" : ""}" onclick="setCategoria('${c}')">${c === "todas" ? "Todos" : c}</button>`
    ).join("");
  }
}

function renderProdutosAdmin() {
  const lista = document.getElementById("listaProdutosAdmin");
  if (!lista) return;
  
  if (!produtos.length) {
    lista.innerHTML = `<div class="empty-state"><span>📦</span>Nenhum produto cadastrado ainda.</div>`;
    return;
  }
  
  lista.innerHTML = produtos.map(p => `
    <div class="produto-admin-card">
      <div class="produto-admin-info">
        <p class="produto-admin-nome">#${String(p.skuId).padStart(4, "0")} ${p.nome}</p>
        <p class="produto-admin-cat">${p.categoria || "Sem categoria"}</p>
        <p class="produto-admin-preco">R$ ${fmt(p.preco)}</p>
      </div>
      <div class="acoes-admin">
        <button class="btn-sm btn-sm-edit" onclick="editarProduto(${p.id})">✏️ Editar</button>
        <button class="btn-sm btn-sm-del" onclick="excluirProduto(${p.id})">🗑</button>
      </div>
    </div>
  `).join("");
}

function setCategoria(cat) {
  categoriaAtiva = cat;
  renderProdutos();
}

function adicionarAoCarrinho(id) {
  carrinho[id] = (carrinho[id] || 0) + 1;
  atualizarTotal();
}

function alterarQtd(id, delta) {
  carrinho[id] = Math.max(0, (carrinho[id] || 0) + delta);
  atualizarTotal();
}

/* ─────────────────────────────────────────
   CLIENTES
───────────────────────────────────────── */

async function salvarCliente() {
  const nome = document.getElementById("clienteNome")?.value?.trim();
  const telefone = document.getElementById("clienteTelefone")?.value?.trim() || "";
  const cpf = document.getElementById("clienteCpf")?.value?.trim() || "";
  const email = document.getElementById("clienteEmail")?.value?.trim() || "";
  const endereco = document.getElementById("clienteEndereco")?.value?.trim() || "";
  
  if (!nome) { mostrarToast("Nome do cliente é obrigatório.","erro"); return; }
  
  mostrarLoading("Salvando cliente...");
  try {
    if (editandoClienteId !== null) {
      const idx = clientes.findIndex(c => c.id === editandoClienteId);
      if (idx !== -1) {
        clientes[idx].nome = nome;
        clientes[idx].telefone = telefone;
        clientes[idx].cpf = cpf;
        clientes[idx].email = email;
        clientes[idx].endereco = endereco;
        await sbSalvarCliente(clientes[idx]);
        editandoClienteId = null;
      }
    } else {
      const novo = {
        id: Date.now(),
        nome,
        telefone,
        cpf,
        email,
        endereco
      };
      const sid = await sbSalvarCliente(novo);
      if (sid) { novo.supabaseId = sid; clientes.push(novo); }
    }
    
    limparCamposCliente();
    renderClientes();
    popularSelectClientes();
    document.getElementById("clienteFormLabel").textContent = "Novo cliente";
    document.getElementById("btnCancelarCliente").style.display = "none";
    mostrarToast("Cliente salvo com sucesso!");
  } catch(e) {
    console.error("Erro ao salvar cliente:", e);
    mostrarToast("Erro ao salvar cliente.","erro");
  } finally {
    esconderLoading();
  }
}

function limparCamposCliente() {
  document.getElementById("clienteNome").value = "";
  document.getElementById("clienteTelefone").value = "";
  document.getElementById("clienteCpf").value = "";
  document.getElementById("clienteEmail").value = "";
  document.getElementById("clienteEndereco").value = "";
}

function editarCliente(id) {
  const c = clientes.find(c => c.id === id);
  if (!c) return;
  
  document.getElementById("clienteNome").value = c.nome;
  document.getElementById("clienteTelefone").value = c.telefone || "";
  document.getElementById("clienteCpf").value = c.cpf || "";
  document.getElementById("clienteEmail").value = c.email || "";
  document.getElementById("clienteEndereco").value = c.endereco || "";
  editandoClienteId = id;
  document.getElementById("clienteFormLabel").textContent = `Editando: ${c.nome || "cliente"}`;
  document.getElementById("btnCancelarCliente").style.display = "inline-flex";
  document.querySelector("#page-clientes .section-card")?.scrollIntoView({behavior:"smooth"});
}

function cancelarEdicaoCliente() {
  editandoClienteId = null;
  limparCamposCliente();
  document.getElementById("clienteFormLabel").textContent = "Novo cliente";
  document.getElementById("btnCancelarCliente").style.display = "none";
}

async function excluirCliente(id) {
  const ok = await confirmar("Deseja excluir este cliente?");
  if (!ok) return;
  
  const c = clientes.find(c => c.id === id);
  if (c?.supabaseId) await sbDeletarCliente(c.supabaseId);
  
  clientes = clientes.filter(c => c.id !== id);
  renderClientes();
  popularSelectClientes();
  mostrarToast("Cliente excluído.");
}

function renderClientes() {
  const lista = document.getElementById("listaClientes");
  if (!lista) return;
  
  const busca = (document.getElementById("buscaClientes")?.value || "").toLowerCase().trim();
  const filtrados = clientes.filter(c => {
    if (!busca) return true;
    return (c.nome || "").toLowerCase().includes(busca) ||
           (c.telefone || "").includes(busca) ||
           (c.cpf || "").includes(busca) ||
           (c.email || "").toLowerCase().includes(busca);
  });
  
  if (!filtrados.length) {
    lista.innerHTML = `<div class="empty-state"><span>👥</span>${busca ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}</div>`;
    return;
  }
  
  lista.innerHTML = filtrados.map(c => `
    <div class="cliente-card">
      <div class="cliente-avatar">${(c.nome || "?")[0].toUpperCase()}</div>
      <div class="cliente-info">
        <p class="cliente-nome">${c.nome || "<em>Sem nome</em>"}</p>
        <div class="cliente-detalhes">
          ${c.telefone ? `<span>📱 ${c.telefone}</span>` : ""}
          ${c.cpf ? `<span>🪪 ${c.cpf}</span>` : ""}
          ${c.email ? `<span>✉️ ${c.email}</span>` : ""}
          ${c.endereco ? `<span>📍 ${c.endereco}</span>` : ""}
        </div>
      </div>
      <div class="acoes-admin" style="flex-shrink:0">
        <button class="btn-sm btn-sm-edit" onclick="editarCliente(${c.id})">✏️ Editar</button>
        <button class="btn-sm btn-sm-del" onclick="excluirCliente(${c.id})">🗑</button>
      </div>
    </div>
  `).join("");
}

function popularSelectClientes() {
  const sel = document.getElementById("clienteSelecionado");
  if (!sel) return;
  
  const atual = sel.value;
  sel.innerHTML = `<option value="">— Venda sem cliente —</option>` +
    clientes.map(c => `<option value="${c.id}">${c.nome || "Cliente #" + c.id}${c.telefone ? " · " + c.telefone : ""}</option>`).join("");
  if (atual) sel.value = atual;
}

/* ─────────────────────────────────────────
   GASTOS
───────────────────────────────────────── */

async function salvarGasto() {
  const descricao = document.getElementById("gastoDescricao")?.value?.trim();
  const valor = parseFloat(document.getElementById("gastoValor")?.value) || 0;
  const mes = parseInt(document.getElementById("gastoMes")?.value) || new Date().getMonth() + 1;
  const ano = parseInt(document.getElementById("gastoAno")?.value) || new Date().getFullYear();
  const recorrente = document.getElementById("gastoRecorrente")?.checked || false;
  const pago = document.getElementById("gastoPago")?.checked || false;
  
  if (!descricao) { mostrarToast("Descrição do gasto é obrigatória.","erro"); return; }
  if (valor <= 0) { mostrarToast("Valor deve ser maior que zero.","erro"); return; }
  
  mostrarLoading("Salvando gasto...");
  try {
    if (editandoGastoId !== null) {
      const idx = gastos.findIndex(g => g.id === editandoGastoId);
      if (idx !== -1) {
        gastos[idx].descricao = descricao;
        gastos[idx].valor = valor;
        gastos[idx].mes = mes;
        gastos[idx].ano = ano;
        gastos[idx].recorrente = recorrente;
        gastos[idx].pago = pago;
        await sbSalvarGasto(gastos[idx]);
        editandoGastoId = null;
      }
    } else {
      const novo = {
        id: Date.now(),
        descricao,
        valor,
        mes,
        ano,
        recorrente,
        pago
      };
      const sid = await sbSalvarGasto(novo);
      if (sid) { novo.supabaseId = sid; gastos.push(novo); }
    }
    
    limparCamposGasto();
    renderGastos();
    document.getElementById("gastoFormLabel").textContent = "Novo gasto";
    document.getElementById("btnCancelarGasto").style.display = "none";
    mostrarToast("Gasto salvo com sucesso!");
  } catch(e) {
    console.error("Erro ao salvar gasto:", e);
    mostrarToast("Erro ao salvar gasto.","erro");
  } finally {
    esconderLoading();
  }
}

function limparCamposGasto() {
  document.getElementById("gastoDescricao").value = "";
  document.getElementById("gastoValor").value = "";
  document.getElementById("gastoMes").value = new Date().getMonth() + 1;
  document.getElementById("gastoAno").value = new Date().getFullYear();
  document.getElementById("gastoRecorrente").checked = false;
  document.getElementById("gastoPago").checked = false;
}

function editarGasto(id) {
  const g = gastos.find(g => g.id === id);
  if (!g) return;
  
  document.getElementById("gastoDescricao").value = g.descricao;
  document.getElementById("gastoValor").value = g.valor;
  document.getElementById("gastoMes").value = g.mes;
  document.getElementById("gastoAno").value = g.ano;
  document.getElementById("gastoRecorrente").checked = g.recorrente;
  document.getElementById("gastoPago").checked = g.pago;
  editandoGastoId = id;
  document.getElementById("gastoFormLabel").textContent = `Editando: ${g.descricao}`;
  document.getElementById("btnCancelarGasto").style.display = "inline-flex";
  document.querySelector("#page-gastos .section-card")?.scrollIntoView({behavior:"smooth"});
}

function cancelarEdicaoGasto() {
  editandoGastoId = null;
  limparCamposGasto();
  document.getElementById("gastoFormLabel").textContent = "Novo gasto";
  document.getElementById("btnCancelarGasto").style.display = "none";
}

async function excluirGasto(id) {
  const ok = await confirmar("Deseja excluir este gasto?");
  if (!ok) return;
  
  const g = gastos.find(g => g.id === id);
  if (g?.supabaseId) await sbDeletarGasto(g.supabaseId);
  
  gastos = gastos.filter(g => g.id !== id);
  renderGastos();
  mostrarToast("Gasto excluído.");
}

function renderGastos() {
  const lista = document.getElementById("listaGastos");
  if (!lista) return;
  
  if (!gastos.length) {
    lista.innerHTML = `<div class="empty-state"><span>💸</span>Nenhum gasto cadastrado ainda.</div>`;
    return;
  }
  
  lista.innerHTML = gastos.map(g => `
    <div class="gasto-card" style="border-left:4px solid ${g.pago ? "var(--green)" : "var(--red)"}">
      <div class="gasto-info">
        <p class="gasto-descricao">${g.descricao}</p>
        <p class="gasto-meta">${g.mes}/${g.ano} ${g.recorrente ? "🔄 Recorrente" : ""}</p>
      </div>
      <div class="gasto-valor">
        <p class="gasto-preco">R$ ${fmt(g.valor)}</p>
        <p class="gasto-status">${g.pago ? "✓ Pago" : "⏳ Pendente"}</p>
      </div>
      <div class="acoes-admin" style="flex-shrink:0">
        <button class="btn-sm btn-sm-edit" onclick="editarGasto(${g.id})">✏️</button>
        <button class="btn-sm btn-sm-del" onclick="excluirGasto(${g.id})">🗑</button>
      </div>
    </div>
  `).join("");
}

/* ─────────────────────────────────────────
   CARRINHO E CÁLCULOS
───────────────────────────────────────── */

function calcularDesconto(sub) {
  const v = parseFloat(document.getElementById("descontoInput")?.value) || 0;
  if (v <= 0) return 0;
  return tipoDesconto === "pct" ? Math.min(sub, sub * (v / 100)) : Math.min(sub, v);
}

function calcularSubtotal() {
  let t = 0;
  for (const id in carrinho) {
    const p = produtos.find(p => p.id === Number(id));
    if (p) t += p.preco * carrinho[id];
  }
  return t;
}

function calcularTotalFinal() {
  const s = calcularSubtotal();
  const d = calcularDesconto(s);
  return Math.max(0, s - d);
}

function atualizarTotal() {
  const sub = calcularSubtotal();
  const desc = calcularDesconto(sub);
  const total = Math.max(0, sub - desc);
  
  const el = document.getElementById("total");
  if (el) el.innerText = fmt(total);
  
  const prev = document.getElementById("descontoPreview");
  if (prev) {
    prev.textContent = desc > 0 ? `Subtotal R$ ${fmt(sub)}  –  Desconto R$ ${fmt(desc)}  =  R$ ${fmt(total)}` : "";
  }
  
  const resumo = document.getElementById("finalizarResumo");
  if (resumo) {
    const q = Object.values(carrinho).reduce((a, b) => a + b, 0);
    resumo.innerHTML = q > 0 ? `<strong>${q}</strong> ite${q > 1 ? "ns" : "m"} · Total: <strong>R$ ${fmt(total)}</strong>` : "";
  }
  
  renderCarrinho();
  if (pagamentosSelecionados.length > 1) renderSplitPagamento();
}

function renderCarrinho() {
  const card = document.getElementById("carrinhoCard");
  const itensEl = document.getElementById("carrinhoItens");
  const footerEl = document.getElementById("carrinhoFooter");
  
  if (!card || !itensEl || !footerEl) return;
  
  const itensCarrinho = Object.entries(carrinho).filter(([, q]) => q > 0);
  
  if (itensCarrinho.length === 0) {
    card.style.display = "none";
    return;
  }
  
  card.style.display = "block";
  const sub = calcularSubtotal();
  const desc = calcularDesconto(sub);
  const tot = Math.max(0, sub - desc);
  
  itensEl.innerHTML = itensCarrinho.map(([id, qtd]) => {
    const p = produtos.find(p => p.id === Number(id));
    if (!p) return "";
    return `<div class="carrinho-item">
      <span class="carrinho-item-nome">#${String(p.skuId).padStart(4, "0")} ${p.nome}</span>
      <div class="carrinho-item-ctrl">
        <button class="btn-qtd sm" onclick="alterarQtd(${p.id}, -1)">−</button>
        <span class="carrinho-item-qtd">${qtd}</span>
        <button class="btn-qtd sm" onclick="alterarQtd(${p.id}, +1)">+</button>
      </div>
      <span class="carrinho-item-preco">R$ ${fmt(p.preco * qtd)}</span>
      <button class="carrinho-item-del" onclick="removerDoCarrinho(${p.id})">✕</button>
    </div>`;
  }).join("");
  
  footerEl.innerHTML = `
    <div class="carrinho-subtotal-row"><span>Subtotal</span><span class="mono">R$ ${fmt(sub)}</span></div>
    ${desc > 0 ? `<div class="carrinho-subtotal-row desc"><span>Desconto</span><span class="mono red">− R$ ${fmt(desc)}</span></div>` : ""}
    <div class="carrinho-subtotal-row total-row"><span>Total</span><span class="mono green">R$ ${fmt(tot)}</span></div>`;
}

function removerDoCarrinho(id) {
  delete carrinho[id];
  atualizarTotal();
  renderProdutos();
}

function limparCarrinho() {
  carrinho = {};
  atualizarTotal();
  renderProdutos();
  document.getElementById("carrinhoCard").style.display = "none";
}

/* ─── Pagamento múltiplo ─── */

function togglePagamento(tipo) {
  const idx = pagamentosSelecionados.indexOf(tipo);
  if (idx === -1) {
    pagamentosSelecionados.push(tipo);
  } else {
    if (pagamentosSelecionados.length === 1) {
      mostrarToast("Selecione ao menos uma forma de pagamento.", "erro");
      return;
    }
    pagamentosSelecionados.splice(idx, 1);
    delete splitPagamento[tipo];
  }
  renderBotoesPagamento();
  renderSplitPagamento();
  atualizarTotal();
}

function renderBotoesPagamento() {
  ["dinheiro", "cartao", "pix"].forEach(t => {
    const b = document.getElementById(`pag-${t}`);
    if (b) b.classList.toggle("ativo", pagamentosSelecionados.includes(t));
  });
}

function renderSplitPagamento() {
  const c = document.getElementById("pagamentoSplit");
  if (!c) return;
  
  if (pagamentosSelecionados.length <= 1) {
    c.classList.add("hidden");
    c.innerHTML = "";
    splitPagamento = {};
    return;
  }
  
  c.classList.remove("hidden");
  _renderSplitHTML(c, pagamentosSelecionados, splitPagamento, calcularTotalFinal(), "onSplitInput", "splitAviso");
}

function onSplitInput(tipo) {
  splitPagamento[tipo] = parseFloat(document.getElementById(`split-input-${tipo}`)?.value) || 0;
  _atualizarResto(pagamentosSelecionados, splitPagamento, calcularTotalFinal(), "splitAviso");
}

function _renderSplitHTML(container, formas, splits, total, cbInput, cbAviso) {
  let html = `<p style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:6px;text-transform:uppercase;letter-spacing:.6px">Dividir valor (R$ ${fmt(total)})</p>`;
  
  formas.forEach((tipo, i) => {
    const isUlt = i === formas.length - 1;
    if (isUlt) {
      const soma = formas.filter((_, j) => j !== i).reduce((a, t) => a + (parseFloat(splits[t]) || 0), 0);
      const resto = Math.max(0, total - soma);
      html += `<div class="pagamento-split-row"><span class="pagamento-split-label">${ICONE_PAGAMENTO[tipo]}</span><span class="pagamento-split-resto" id="split-resto-${tipo}">R$ ${fmt(resto)} (restante)</span></div>`;
    } else {
      const v = splits[tipo] !== undefined ? splits[tipo] : "";
      html += `<div class="pagamento-split-row"><span class="pagamento-split-label">${ICONE_PAGAMENTO[tipo]}</span><input type="number" class="pagamento-split-input" min="0" step="0.01" id="split-input-${tipo}" value="${v}" placeholder="0,00" oninput="${cbInput}('${tipo}')"></div>`;
    }
  });
  
  html += `<div id="${cbAviso}" style="margin-top:4px"></div>`;
  container.innerHTML = html;
  _atualizarResto(formas, splits, total, cbAviso);
}

function _atualizarResto(formas, splits, total, avisoId) {
  const ultima = formas[formas.length - 1];
  const soma = formas.slice(0, -1).reduce((a, t) => a + (parseFloat(splits[t]) || 0), 0);
  const resto = Math.max(0, total - soma);
  
  const restoEl = document.getElementById(`split-resto-${ultima}`);
  if (restoEl) restoEl.textContent = `R$ ${fmt(resto)} (restante)`;
  
  const aviso = document.getElementById(avisoId);
  if (!aviso) return;
  
  aviso.innerHTML = soma > total + 0.005
    ? `<span class="pagamento-split-aviso">⚠️ A soma ultrapassa o total (R$ ${fmt(total)})</span>`
    : `<span class="pagamento-split-ok">✓ R$ ${fmt(soma)} + R$ ${fmt(total - soma)} = R$ ${fmt(total)}</span>`;
}

function getSplitFinal(formas, splits, total) {
  if (formas.length === 1) return { [formas[0]]: total };
  
  const ultima = formas[formas.length - 1];
  const res = {};
  let soma = 0;
  
  formas.slice(0, -1).forEach(t => {
    const v = parseFloat(splits[t]) || 0;
    res[t] = v;
    soma += v;
  });
  
  res[ultima] = Math.max(0, total - soma);
  return res;
}

function setTipoDesconto(tipo) {
  tipoDesconto = tipo;
  document.getElementById("desc-tipo-pct").classList.toggle("ativo", tipo === "pct");
  document.getElementById("desc-tipo-val").classList.toggle("ativo", tipo === "val");
  document.getElementById("descontoSufixo").textContent = tipo === "pct" ? "%" : "R$";
  atualizarTotal();
}

/* ─────────────────────────────────────────
   FINALIZAR PEDIDO
───────────────────────────────────────── */

async function finalizarPedido() {
  const itensIds = Object.keys(carrinho).filter(id => carrinho[id] > 0);
  if (!itensIds.length) {
    mostrarToast("Carrinho vazio!", "erro");
    return;
  }
  
  if (pagamentosSelecionados.length > 1) {
    const total = calcularTotalFinal();
    const soma = pagamentosSelecionados.slice(0, -1).reduce((a, t) => a + (parseFloat(splitPagamento[t]) || 0), 0);
    if (soma > total + 0.005) {
      mostrarToast("⚠️ A soma dos pagamentos ultrapassa o total.", "erro");
      return;
    }
  }
  
  const itens = itensIds.map(id => {
    const p = produtos.find(p => p.id === Number(id));
    return { nome: p.nome, skuId: p.skuId, quantidade: carrinho[id], preco: p.preco };
  });
  
  const sub = calcularSubtotal();
  const desc = calcularDesconto(sub);
  const total = Math.max(0, sub - desc);
  const pagamentos = getSplitFinal(pagamentosSelecionados, splitPagamento, total);
  const clienteId = document.getElementById("clienteSelecionado")?.value || "";
  const clienteNome = clienteId ? clientes.find(c => c.id === Number(clienteId))?.nome || "" : "";
  
  const venda = {
    id: Date.now(),
    itens,
    subtotal: sub,
    desconto: desc,
    total,
    pagamentos,
    pagamento: pagamentosSelecionados[0],
    data: hojeStr(),
    hora: agoraHora(),
    cancelada: false,
    clienteId: clienteId ? Number(clienteId) : null,
    clienteNome
  };
  
  mostrarLoading("Finalizando pedido...");
  try {
    const fid = await sbSalvarVenda(venda);
    if (fid) {
      venda.supabaseId = fid;
      historico.push(venda);
      
      // Reset
      carrinho = {};
      pagamentosSelecionados = ["dinheiro"];
      splitPagamento = {};
      tipoDesconto = "pct";
      
      ["descontoInput"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
      
      document.getElementById("descontoPreview").textContent = "";
      document.getElementById("total").innerText = "0,00";
      document.getElementById("clienteSelecionado").value = "";
      
      atualizarTotal();
      renderProdutos();
      mostrarToast("Pedido finalizado com sucesso!");
    }
  } catch(e) {
    console.error("Erro ao finalizar pedido:", e);
    mostrarToast("Erro ao finalizar pedido.", "erro");
  } finally {
    esconderLoading();
  }
}

/* ─────────────────────────────────────────
   HISTÓRICO
───────────────────────────────────────── */

function setFiltroHistorico(f) {
  filtroHistorico = f;
  document.querySelectorAll(".btn-filter").forEach(b => b.classList.remove("ativo"));
  document.getElementById(`filtro-${f}`)?.classList.add("ativo");
  
  const customDiv = document.getElementById("filtroCustom");
  if (customDiv) customDiv.style.display = f === "custom" ? "flex" : "none";
  
  renderHistorico();
}

function renderHistorico() {
  const lista = document.getElementById("listaHistorico");
  if (!lista) return;
  
  const intervaloFiltro = intervalo(filtroHistorico, "filtroDataInicio", "filtroDataFim");
  const filtrados = historico.filter(v => vendaNoIntervalo(v, intervaloFiltro) && !v.cancelada);
  
  if (!filtrados.length) {
    lista.innerHTML = `<div class="empty-state"><span>📋</span>Nenhuma venda encontrada neste período.</div>`;
    return;
  }
  
  lista.innerHTML = filtrados.map(v => `
    <div class="venda-card">
      <div class="venda-header">
        <p class="venda-data">${v.data} às ${v.hora}</p>
        <p class="venda-total">R$ ${fmt(v.total)}</p>
      </div>
      <p class="venda-cliente">${v.clienteNome || "Venda sem cliente"}</p>
      <p class="venda-itens">${v.itens.length} item${v.itens.length > 1 ? "ns" : ""}</p>
      <div class="acoes-admin">
        <button class="btn-sm btn-sm-view" onclick="verDetalhesVenda(${historico.indexOf(v)})">👁 Ver</button>
      </div>
    </div>
  `).join("");
}

function verDetalhesVenda(idx) {
  const v = historico[idx];
  if (!v) return;
  
  const detalhes = `
    <h3>Detalhes da Venda</h3>
    <p><strong>Data:</strong> ${v.data} às ${v.hora}</p>
    <p><strong>Cliente:</strong> ${v.clienteNome || "Sem cliente"}</p>
    <h4>Itens:</h4>
    <ul>
      ${v.itens.map(i => `<li>#${String(i.skuId).padStart(4, "0")} ${i.nome} - ${i.quantidade}x R$ ${fmt(i.preco)}</li>`).join("")}
    </ul>
    <p><strong>Subtotal:</strong> R$ ${fmt(v.subtotal)}</p>
    <p><strong>Desconto:</strong> R$ ${fmt(v.desconto)}</p>
    <p><strong>Total:</strong> R$ ${fmt(v.total)}</p>
    <p><strong>Pagamento:</strong> ${Object.entries(v.pagamentos || {}).map(([t, val]) => `${ICONE_PAGAMENTO[t] || t}: R$ ${fmt(val)}`).join(", ")}</p>
  `;
  
  alert(detalhes);
}

/* ─────────────────────────────────────────
   RELATÓRIOS
───────────────────────────────────────── */

function setFiltroRelatorio(f) {
  filtroRelatorio = f;
  document.querySelectorAll("#page-relatorios .btn-filter").forEach(b => b.classList.remove("ativo"));
  document.getElementById(`rel-${f}`)?.classList.add("ativo");
  
  const customDiv = document.getElementById("relCustom");
  if (customDiv) customDiv.style.display = f === "custom" ? "flex" : "none";
  
  renderRelatorios();
}

function renderRelatorios() {
  const intervaloFiltro = intervalo(filtroRelatorio, "relDataInicio", "relDataFim");
  const filtrados = historico.filter(v => vendaNoIntervalo(v, intervaloFiltro) && !v.cancelada);
  
  const totalVendas = filtrados.reduce((a, v) => a + v.total, 0);
  const totalItens = filtrados.reduce((a, v) => a + v.itens.reduce((b, i) => b + i.quantidade, 0), 0);
  const totalDesconto = filtrados.reduce((a, v) => a + v.desconto, 0);
  
  const pagamentosMap = {};
  filtrados.forEach(v => {
    for (const [tipo, valor] of Object.entries(v.pagamentos || {})) {
      pagamentosMap[tipo] = (pagamentosMap[tipo] || 0) + valor;
    }
  });
  
  const content = document.getElementById("relatoriosContent");
  if (!content) return;
  
  content.innerHTML = `
    <div class="section-card">
      <p class="section-label">Resumo do Período</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
        <div style="padding:12px;background:var(--surface2);border-radius:var(--radius-sm)">
          <p style="color:var(--text3);font-size:12px">Total de Vendas</p>
          <p style="font-size:24px;font-weight:700;color:var(--green)">R$ ${fmt(totalVendas)}</p>
        </div>
        <div style="padding:12px;background:var(--surface2);border-radius:var(--radius-sm)">
          <p style="color:var(--text3);font-size:12px">Itens Vendidos</p>
          <p style="font-size:24px;font-weight:700;color:var(--green)">${totalItens}</p>
        </div>
        <div style="padding:12px;background:var(--surface2);border-radius:var(--radius-sm)">
          <p style="color:var(--text3);font-size:12px">Desconto Total</p>
          <p style="font-size:24px;font-weight:700;color:var(--red)">R$ ${fmt(totalDesconto)}</p>
        </div>
        <div style="padding:12px;background:var(--surface2);border-radius:var(--radius-sm)">
          <p style="color:var(--text3);font-size:12px">Ticket Médio</p>
          <p style="font-size:24px;font-weight:700;color:var(--green)">R$ ${filtrados.length > 0 ? fmt(totalVendas / filtrados.length) : "0,00"}</p>
        </div>
      </div>
    </div>
    <div class="section-card">
      <p class="section-label">Formas de Pagamento</p>
      <div>
        ${Object.entries(pagamentosMap).map(([tipo, valor]) => `
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border2)">
            <span>${ICONE_PAGAMENTO[tipo] || tipo}</span>
            <span class="mono" style="font-weight:700">R$ ${fmt(valor)}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

/* ─────────────────────────────────────────
   CONFIGURAÇÕES
───────────────────────────────────────── */

function renderConfiguracoes() {
  document.getElementById("configNomeLoja").value = lojaConfigAtual.nome || "";
  document.getElementById("configCor").value = lojaConfigAtual.cor || "#00bf63";
  document.getElementById("configFonte").value = lojaConfigAtual.fonte || "jakarta";
  
  const tema = document.documentElement.getAttribute("data-theme") || "light";
  document.querySelectorAll("#page-configuracoes .btn-filter").forEach(b => b.classList.remove("ativo"));
  document.getElementById(`tema-${tema}`)?.classList.add("ativo");
}

async function salvarConfiguracao() {
  const nome = document.getElementById("configNomeLoja")?.value?.trim() || "";
  const cor = document.getElementById("configCor")?.value || "#00bf63";
  const fonte = document.getElementById("configFonte")?.value || "jakarta";
  
  lojaConfigAtual = { nome, cor, fonte };
  
  mostrarLoading("Salvando configurações...");
  try {
    await sbSalvarConfig({
      store_config: lojaConfigAtual,
      theme: document.documentElement.getAttribute("data-theme") || "light"
    });
    
    document.getElementById("sidebarLojaBadge").textContent = nome || "Minha Loja";
    document.getElementById("topbarLojaBadge").textContent = nome || "Minha Loja";
    
    mostrarToast("Configurações salvas com sucesso!");
  } catch(e) {
    console.error("Erro ao salvar configurações:", e);
    mostrarToast("Erro ao salvar configurações.", "erro");
  } finally {
    esconderLoading();
  }
}

function setTema(tema) {
  document.documentElement.setAttribute("data-theme", tema);
  document.querySelectorAll("#page-configuracoes .btn-filter").forEach(b => b.classList.remove("ativo"));
  document.getElementById(`tema-${tema}`)?.classList.add("ativo");
  
  sbSalvarConfig({ theme: tema });
}

function abrirModalMudarSenha() {
  document.getElementById("modalMudarSenha").classList.remove("hidden");
}

function fecharModalMudarSenha() {
  document.getElementById("modalMudarSenha").classList.add("hidden");
  document.getElementById("senhaAtual").value = "";
  document.getElementById("novaSenhaModal").value = "";
  document.getElementById("confirmarNovaSenhaModal").value = "";
}

async function mudarSenha() {
  const senhaAtual = document.getElementById("senhaAtual")?.value;
  const novaSenha = document.getElementById("novaSenhaModal")?.value;
  const confirmar = document.getElementById("confirmarNovaSenhaModal")?.value;
  
  if (!senhaAtual || !novaSenha || !confirmar) {
    mostrarToast("Preencha todos os campos.", "erro");
    return;
  }
  
  if (novaSenha !== confirmar) {
    mostrarToast("As novas senhas não conferem.", "erro");
    return;
  }
  
  if (novaSenha.length < 6) {
    mostrarToast("A nova senha deve ter no mínimo 6 caracteres.", "erro");
    return;
  }
  
  mostrarLoading("Alterando senha...");
  try {
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    if (error) throw error;
    
    mostrarToast("Senha alterada com sucesso!");
    fecharModalMudarSenha();
  } catch(e) {
    console.error("Erro ao alterar senha:", e);
    mostrarToast(e.message || "Erro ao alterar senha.", "erro");
  } finally {
    esconderLoading();
  }
}

/* ─────────────────────────────────────────
   INICIALIZAÇÃO
───────────────────────────────────────── */

window.addEventListener("load", async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      usuarioAtual = user;
      await carregarDadosUsuario();
      mostrarAppShell();
    } else {
      mostrarAuthScreen();
    }
  } catch(e) {
    console.error("Erro ao verificar autenticação:", e);
    mostrarAuthScreen();
  }
});
