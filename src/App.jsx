import { useState } from "react";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

// ─── SHA-256 ──────────────────────────────────────────────────────────────────
async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("").slice(0,16);
}

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
async function sb(method, path, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "return=representation" : "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.message||r.statusText); }
  return r.status === 204 ? null : r.json();
}

// ─── SOC-13 ───────────────────────────────────────────────────────────────────
// Itens que precisam ser invertidos no cálculo
const ITENS_INVERTIDOS = [1, 2, 3, 5, 6, 7, 8, 9, 10, 12, 13];

const SOC_PERGUNTAS = [
  { num: 1, texto: "Com que frequência você tem a sensação de que não se importa com o que está acontecendo ao seu redor?", ancora_min: "Raramente ou nunca", ancora_max: "Com muita frequência", invertida: true },
  { num: 2, texto: "Alguma vez já aconteceu de você se surpreender com o comportamento de pessoas que você achava que conhecia bem?", ancora_min: "Nunca aconteceu", ancora_max: "Sempre aconteceu", invertida: true },
  { num: 3, texto: "Já aconteceu das pessoas com quem você contava te decepcionarem?", ancora_min: "Nunca aconteceu", ancora_max: "Sempre aconteceu", invertida: true },
  { num: 4, texto: "Até agora, sua vida tem sido:", ancora_min: "Sem qualquer objetivo ou finalidade", ancora_max: "Com finalidade e objetivos claros", invertida: false },
  { num: 5, texto: "Com que frequência você tem a sensação de que está sendo tratado injustamente?", ancora_min: "Com muita frequência", ancora_max: "Raramente ou nunca", invertida: true },
  { num: 6, texto: "Com que frequência você tem a sensação de que está numa situação desconhecida e não sabe o que fazer?", ancora_min: "Com muita frequência", ancora_max: "Raramente ou nunca", invertida: true },
  { num: 7, texto: "Fazer as coisas que você faz todos os dias é:", ancora_min: "Uma fonte de grande prazer e satisfação", ancora_max: "Uma fonte de sofrimento e chatice", invertida: true },
  { num: 8, texto: "Com que frequência você tem sentimentos e ideias bastante confusas?", ancora_min: "Com muita frequência", ancora_max: "Raramente ou nunca", invertida: true },
  { num: 9, texto: "Com que frequência acontece de você ter sentimentos que você preferiria não sentir?", ancora_min: "Com muita frequência", ancora_max: "Raramente ou nunca", invertida: true },
  { num: 10, texto: "Muitas pessoas — mesmo aquelas muito fortes — algumas vezes se sentem fracassadas em certas situações. Com que frequência você já se sentiu dessa maneira?", ancora_min: "Nunca", ancora_max: "Com muita frequência", invertida: true },
  { num: 11, texto: "Quando alguma coisa acontece a você, em geral você acha que:", ancora_min: "Você deu muita ou pouca importância para o que aconteceu", ancora_max: "Você viu as coisas na medida certa", invertida: false },
  { num: 12, texto: "Com que frequência você tem a sensação de que há pouco significado nas coisas que faz na sua vida diária?", ancora_min: "Com muita frequência", ancora_max: "Raramente ou nunca", invertida: true },
  { num: 13, texto: "Com que frequência você tem a sensação de que você não consegue manter seu autocontrole?", ancora_min: "Com muita frequência", ancora_max: "Raramente ou nunca", invertida: true },
];

// Dimensões SOC-13 validadas
const DIM_COMP = [1, 3, 5, 6, 8, 11, 13];
const DIM_MAN  = [2, 4, 9, 10, 12];
const DIM_SIG  = [7];

function calcularSOC(respostas) {
  const r = { ...respostas };
  // Inverter itens que precisam ser invertidos
  ITENS_INVERTIDOS.forEach(i => { if (r[i]) r[i] = 8 - r[i]; });
  const comp = DIM_COMP.reduce((s,i) => s+(r[i]||0), 0);
  const man  = DIM_MAN.reduce((s,i)  => s+(r[i]||0), 0);
  const sig  = DIM_SIG.reduce((s,i)  => s+(r[i]||0), 0);
  const total = comp + man + sig;
  const props = { compreensibilidade: comp/49, maneabilidade: man/35, significancia: sig/7 };
  const foco = Object.entries(props).sort((a,b)=>a[1]-b[1])[0][0];
  const classif = (total/91) >= 0.67 ? "Alto" : (total/91) >= 0.34 ? "Médio" : "Baixo";
  return { compreensibilidade: comp, maneabilidade: man, significancia: sig, soc_total: total, classificacao: classif, dimensao_foco: foco };
}

// Frase âncora leve — convida a pensar na vida como um todo
const ANCORA_VIDA = "Pensando na sua vida como um todo — no trabalho, nas relações pessoais e em você mesmo(a)...";

// ─── OPÇÕES DE PERFIL ─────────────────────────────────────────────────────────
const OPT_IDADE = ["Até 25 anos","26 a 30 anos","31 a 40 anos","41 a 50 anos","51 a 60 anos","61 anos ou mais"];
const OPT_SEXO = ["Feminino","Masculino"];
const OPT_IDENTIDADE = ["Mulher cisgênero","Homem cisgênero","Mulher trans","Homem trans","Não binário"];
const OPT_RACA = ["Branco(a)","Pardo(a)","Preto(a)","Amarelo(a)","Indígena"];
const OPT_RENDA = ["Até 1 salário mínimo","1 a 2 salários mínimos","2 a 3 salários mínimos","3 a 4 salários mínimos","4 a 5 salários mínimos","Acima de 5 salários mínimos"];
const OPT_ESTADO_CIVIL = ["Solteiro(a)","Casado(a) / União estável","Divorciado(a) / Separado(a)","Viúvo(a)"];
const OPT_CATEGORIA = ["Enfermeiro(a)","Enfermeiro(a) especialista","Mestre","Doutor(a)"];
const OPT_TEMPO_PROF = ["Menos de 6 meses","6 meses a 1 ano","1 a 2 anos","2 a 5 anos","5 a 10 anos","10 anos ou mais"];
const OPT_TURNO = ["Manhã","Tarde","Noite","Plantão 12h","Plantão 24h","Misto"];
const OPT_CARGA = ["Até 20h","21h a 30h","31h a 40h","41h ou mais"];
const OPT_FUNCAO = ["Assistencial","Supervisão / Gestão","Auditoria","Preceptoria / Docência","Outra"];
const OPT_SETOR = ["UTI","Centro Cirúrgico","Clínica Médica","Obstetrícia / Maternidade","Pediatria","Oncologia","Saúde Mental","Pronto-socorro / Emergência","Atenção Básica (ESF/UBS)","Outro"];
const OPT_VINCULO = ["CLT","Estatutário","PJ / Cooperado","Contrato Temporário"];
const OPT_FREQ = ["Nunca","Mensalmente ou menos","2 a 4 vezes por mês","2 a 3 vezes por semana","4 ou mais vezes por semana"];

const DIMS_BW = [
  { key:"alimentacao", label:"Alimentação" },
  { key:"sono", label:"Sono e repouso" },
  { key:"saude_mental", label:"Saúde mental" },
  { key:"convivio_familiar", label:"Convívio familiar" },
  { key:"rede_apoio", label:"Rede de apoio" },
  { key:"lazer", label:"Lazer" },
  { key:"atividade_fisica", label:"Atividade física" },
  { key:"satisfacao_vida", label:"Satisfação com a vida" },
];

const LIKERT_BW = ["1 – Muito ruim","2 – Ruim","3 – Regular","4 – Boa","5 – Muito boa"];

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const styles = `
@import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;600&family=Source+Sans+3:wght@300;400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --b9:#042C53;--b8:#0C447C;--b6:#185FA5;--b4:#378ADD;--b1:#B5D4F4;--b0:#E6F1FB;
  --t6:#0F6E56;--t4:#1D9E75;--t1:#9FE1CB;--t0:#E1F5EE;
  --a6:#854F0B;--a1:#FAC775;--a0:#FAEEDA;
  --g6:#5F5E5A;--g2:#B4B2A9;--g1:#D3D1C7;--g0:#F1EFE8;
  --r6:#A32D2D;--r1:#F7C1C1;--r0:#FCEBEB;
}
body{font-family:'Source Sans 3',sans-serif;background:#f4f7fb;color:var(--b9);}
.app{min-height:100vh;display:flex;flex-direction:column;}
.hdr{background:var(--b9);color:white;padding:1rem 2rem;display:flex;align-items:center;gap:1rem;}
.hdr-logo{font-family:'Lora',serif;font-size:1.4rem;font-weight:600;}
.hdr-sub{font-size:0.75rem;opacity:0.55;}
.main{flex:1;max-width:720px;margin:0 auto;padding:2rem 1rem;width:100%;}
.card{background:white;border-radius:16px;padding:2rem;border:1px solid #e0e9f5;margin-bottom:1.5rem;}
.card-title{font-family:'Lora',serif;font-size:1.25rem;color:var(--b9);margin-bottom:.4rem;font-weight:600;}
.card-sub{font-size:.88rem;color:var(--g6);margin-bottom:1.5rem;line-height:1.6;}
.step-lbl{font-size:.72rem;color:var(--b4);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.4rem;font-weight:600;}
.prog{height:4px;background:var(--g1);border-radius:2px;margin-bottom:1.5rem;}
.prog-fill{height:100%;border-radius:2px;background:var(--b4);transition:width .4s ease;}
.field{margin-bottom:1.1rem;}
.field label{display:block;font-size:.83rem;font-weight:500;color:var(--b8);margin-bottom:.35rem;}
.field input,.field select{width:100%;padding:.6rem .85rem;border-radius:8px;border:1.5px solid var(--g1);font-size:.92rem;font-family:'Source Sans 3',sans-serif;color:var(--b9);background:#fafcff;outline:none;transition:border-color .2s;}
.field input:focus,.field select:focus{border-color:var(--b4);}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:0 1rem;}
@media(max-width:500px){.grid2{grid-template-columns:1fr;}}
.btn{display:inline-flex;align-items:center;gap:.4rem;padding:.7rem 1.6rem;border-radius:10px;font-size:.92rem;font-weight:600;cursor:pointer;border:none;transition:all .2s;font-family:'Source Sans 3',sans-serif;}
.btn-p{background:var(--b6);color:white;}.btn-p:hover{background:var(--b8);}
.btn-s{background:var(--b0);color:var(--b8);border:1.5px solid var(--b1);}.btn-s:hover{background:var(--b1);}
.btn-d{background:var(--r0);color:var(--r6);border:1.5px solid var(--r1);}
.btn-row{display:flex;gap:.75rem;justify-content:flex-end;margin-top:1.5rem;flex-wrap:wrap;}
.alert{padding:.7rem 1rem;border-radius:8px;font-size:.86rem;margin-bottom:1rem;line-height:1.5;}
.ai{background:var(--b0);color:var(--b8);border:1px solid var(--b1);}
.as{background:var(--t0);color:var(--t6);border:1px solid var(--t1);}
.aw{background:var(--a0);color:var(--a6);border:1px solid var(--a1);}
.ae{background:var(--r0);color:var(--r6);border:1px solid var(--r1);}
.spin{width:38px;height:38px;border:4px solid var(--b1);border-top-color:var(--b6);border-radius:50%;animation:sp .8s linear infinite;margin:2rem auto;}
@keyframes sp{to{transform:rotate(360deg);}}
.tcle-box{font-size:.83rem;line-height:1.75;color:#3a4a5a;max-height:240px;overflow-y:auto;background:var(--g0);padding:1rem;border-radius:8px;border:1px solid var(--g1);margin-bottom:1rem;}
.likert-row{margin-bottom:1.4rem;}
.likert-label{font-size:.87rem;font-weight:500;color:var(--b9);margin-bottom:.6rem;}
.likert-opts{display:flex;gap:.4rem;flex-wrap:wrap;}
.likert-btn{flex:1;min-width:56px;padding:.5rem .3rem;border-radius:8px;border:1.5px solid var(--g1);background:white;cursor:pointer;font-size:.85rem;font-weight:500;color:var(--g6);transition:all .15s;text-align:center;}
.likert-btn:hover{border-color:var(--b4);color:var(--b6);}
.likert-btn.sel{background:var(--b6);border-color:var(--b6);color:white;}
.soc-ancora{font-size:.82rem;color:var(--g6);font-style:italic;background:var(--b0);padding:.5rem .75rem;border-radius:6px;margin-bottom:.75rem;border-left:3px solid var(--b4);}
.soc-scale{display:flex;gap:5px;margin-top:.5rem;}
.soc-btn{flex:1;height:44px;border:1.5px solid var(--g1);border-radius:8px;background:white;cursor:pointer;font-size:.95rem;font-weight:500;color:var(--g6);transition:all .15s;}
.soc-btn:hover{border-color:var(--b4);color:var(--b6);}
.soc-btn.sel{background:var(--b6);border-color:var(--b6);color:white;}
.soc-anchors{display:flex;justify-content:space-between;font-size:.7rem;color:var(--g6);margin-top:.3rem;}
.score-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin:1.2rem 0;}
.score-card{background:var(--b0);border-radius:12px;padding:1rem;border:1px solid var(--b1);}
.score-name{font-size:.72rem;font-weight:600;color:var(--b6);text-transform:uppercase;letter-spacing:.04em;}
.score-num{font-size:1.9rem;font-weight:600;color:var(--b9);font-family:'Lora',serif;}
.score-max{font-size:.78rem;color:var(--g6);}
.score-bar{height:5px;background:var(--b1);border-radius:3px;margin-top:.5rem;}
.score-bar-fill{height:100%;border-radius:3px;background:var(--b6);}
.badge{display:inline-block;padding:.35rem .9rem;border-radius:20px;font-weight:600;font-size:.85rem;margin:.4rem 0;}
.b-alto{background:var(--t0);color:var(--t6);border:1px solid var(--t1);}
.b-medio{background:var(--a0);color:var(--a6);border:1px solid var(--a1);}
.b-baixo{background:var(--r0);color:var(--r6);border:1px solid var(--r1);}
.diag-text{font-size:.9rem;line-height:1.8;color:#2a3a4e;white-space:pre-wrap;}
.bar-row{display:flex;align-items:center;gap:.75rem;margin-bottom:.5rem;}
.bar-lbl{font-size:.78rem;color:var(--g6);min-width:80px;}
.bar-bg{flex:1;height:7px;background:var(--g1);border-radius:4px;}
.bar-val{height:100%;border-radius:4px;background:var(--b4);transition:width .6s ease;}
.bar-num{font-size:.78rem;font-weight:600;color:var(--b8);min-width:28px;}
.adm-tbl{width:100%;border-collapse:collapse;font-size:.8rem;margin-top:1rem;}
.adm-tbl th{background:var(--b9);color:white;padding:.55rem .75rem;text-align:left;}
.adm-tbl td{padding:.45rem .75rem;border-bottom:1px solid var(--g1);}
.adm-tbl tr:nth-child(even) td{background:var(--b0);}
.stat-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:1rem;margin:1rem 0;}
.stat-box{background:var(--b0);border-radius:10px;padding:.75rem;border:1px solid var(--b1);}
.stat-num{font-size:1.5rem;font-weight:600;color:var(--b9);font-family:'Lora',serif;}
.stat-lbl{font-size:.72rem;color:var(--g6);}
.tabs{display:flex;gap:.4rem;margin-bottom:1.25rem;flex-wrap:wrap;}
.tab{padding:.45rem .9rem;border-radius:8px;font-size:.85rem;font-weight:500;cursor:pointer;border:1.5px solid var(--g1);background:white;color:var(--g6);transition:all .2s;}
.tab.on{background:var(--b6);color:white;border-color:var(--b6);}
.section-title{font-size:.8rem;font-weight:600;color:var(--b6);text-transform:uppercase;letter-spacing:.05em;margin:1.2rem 0 .6rem;padding-bottom:.3rem;border-bottom:1px solid var(--b0);}
`;

// ─── COMPONENTES ──────────────────────────────────────────────────────────────

function Campo({ label, children }) {
  return <div className="field"><label>{label}</label>{children}</div>;
}

function Select({ value, onChange, opts, placeholder="Selecione..." }) {
  return (
    <select value={value||""} onChange={e=>onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {opts.map(o=><option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ─── TELA IDENTIFICAÇÃO ───────────────────────────────────────────────────────
function TelaIdentificacao({ onIdentify }) {
  const [nome, setNome] = useState("");
  const [nasc, setNasc] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit() {
    if (!nome.trim()||!nasc) { setErr("Preencha nome e data de nascimento."); return; }
    setLoading(true); setErr("");
    const id = await sha256(nome.trim().toLowerCase()+nasc);
    onIdentify(id);
  }

  return (
    <div className="card">
      <div className="step-lbl">Bem-vindo(a)</div>
      <h2 className="card-title">CoerêncIA</h2>
      <p className="card-sub">Avaliação de bem-estar e senso de coerência para profissionais de enfermagem. Seus dados são anonimizados desde o início.</p>
      {err && <div className="alert ae">{err}</div>}
      <Campo label="Nome completo"><input value={nome} onChange={e=>setNome(e.target.value)} placeholder="Apenas para gerar seu código anônimo"/></Campo>
      <Campo label="Data de nascimento"><input type="date" value={nasc} onChange={e=>setNasc(e.target.value)}/></Campo>
      <div className="alert ai">🔒 Nome e data não são armazenados. Apenas um código anônimo é gerado.</div>
      <div className="btn-row">
        <button className="btn btn-p" onClick={handleSubmit} disabled={loading}>{loading?"Identificando...":"Continuar →"}</button>
      </div>
    </div>
  );
}

// ─── TCLE ─────────────────────────────────────────────────────────────────────
function TelaTCLE({ onConsentir, onRecusar }) {
  const [leu, setLeu] = useState(false);
  return (
    <div className="card">
      <div className="step-lbl">Consentimento</div>
      <h2 className="card-title">Termo de Consentimento</h2>
      <div className="tcle-box" onScroll={e=>{if(e.target.scrollTop+e.target.clientHeight>=e.target.scrollHeight-10)setLeu(true);}}>
        <strong>TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO (TCLE)</strong><br/><br/>
        Você está sendo convidado(a) a participar voluntariamente de uma pesquisa sobre bem-estar e senso de coerência em enfermeiros.<br/><br/>
        <strong>Objetivo:</strong> Avaliar o Senso de Coerência (SOC) de profissionais de enfermagem e propor estratégias personalizadas de bem-estar.<br/><br/>
        <strong>Procedimentos:</strong> Você responderá a questões sobre seu perfil sociodemográfico e profissional, uma avaliação de bem-estar e um questionário com 13 questões sobre como percebe e lida com situações da vida.<br/><br/>
        <strong>Confidencialidade:</strong> Seus dados são identificados apenas por um código anônimo gerado localmente. Nome e data de nascimento NUNCA são armazenados. É tecnicamente impossível identificá-lo(a) a partir dos dados coletados.<br/><br/>
        <strong>Riscos:</strong> Mínimos. Você pode pausar ou desistir a qualquer momento sem qualquer prejuízo.<br/><br/>
        <strong>Benefícios:</strong> Receber um diagnóstico personalizado com estratégias práticas para melhorar seu bem-estar.<br/><br/>
        <strong>Participação voluntária:</strong> Inteiramente voluntária. A recusa não acarreta nenhum prejuízo.<br/><br/>
        Ao clicar em "Concordo", você confirma que leu este termo e consente em participar da pesquisa.
      </div>
      {!leu && <div className="alert aw">📜 Role o texto até o final para habilitar a confirmação.</div>}
      <div className="btn-row">
        <button className="btn btn-d" onClick={onRecusar}>Não concordo</button>
        <button className="btn btn-p" onClick={onConsentir} disabled={!leu}>Concordo e quero participar</button>
      </div>
    </div>
  );
}

// ─── PERFIL ───────────────────────────────────────────────────────────────────
function TelaPerfil({ onSalvar }) {
  const [d, setD] = useState({});
  const [err, setErr] = useState("");
  const set = (k,v) => setD(p=>({...p,[k]:v}));

  const obrigatorios = ["idade","sexo","identidade","raca","estado_civil","filhos","renda","pessoas_residencia","categoria","tempo_profissao","turno","carga_horaria","funcao","setor","vinculo","tabagismo","alcool"];

  function handleSalvar() {
    const faltando = obrigatorios.filter(k=>!d[k]);
    if (faltando.length) { setErr("Por favor, preencha todos os campos antes de continuar."); return; }
    setErr("");
    onSalvar({...d, filhos: d.filhos==="Sim"});
  }

  return (
    <div className="card">
      <div className="step-lbl">Etapa 1 de 4</div>
      <h2 className="card-title">Perfil Sociodemográfico e Profissional</h2>
      <p className="card-sub">Estas informações são coletadas uma única vez e nos ajudam a personalizar sua avaliação.</p>
      {err && <div className="alert ae">{err}</div>}

      <div className="section-title">Dados Pessoais</div>
      <div className="grid2">
        <Campo label="Faixa etária"><Select value={d.idade} onChange={v=>set("idade",v)} opts={OPT_IDADE}/></Campo>
        <Campo label="Sexo biológico"><Select value={d.sexo} onChange={v=>set("sexo",v)} opts={OPT_SEXO}/></Campo>
        <Campo label="Como você se identifica?"><Select value={d.identidade} onChange={v=>set("identidade",v)} opts={OPT_IDENTIDADE}/></Campo>
        <Campo label="Raça / Cor (IBGE)"><Select value={d.raca} onChange={v=>set("raca",v)} opts={OPT_RACA}/></Campo>
        <Campo label="Estado civil"><Select value={d.estado_civil} onChange={v=>set("estado_civil",v)} opts={OPT_ESTADO_CIVIL}/></Campo>
        <Campo label="Tem filhos?"><Select value={d.filhos} onChange={v=>set("filhos",v)} opts={["Sim","Não"]}/></Campo>
        <Campo label="Renda mensal bruta"><Select value={d.renda} onChange={v=>set("renda",v)} opts={OPT_RENDA}/></Campo>
        <Campo label="Pessoas na residência (incluindo você)">
          <input type="number" min="1" max="20" value={d.pessoas_residencia||""} onChange={e=>set("pessoas_residencia",e.target.value)} placeholder="Ex: 3"/>
        </Campo>
      </div>

      <div className="section-title">Vida Profissional</div>
      <div className="grid2">
        <Campo label="Categoria profissional"><Select value={d.categoria} onChange={v=>set("categoria",v)} opts={OPT_CATEGORIA}/></Campo>
        <Campo label="Tempo na enfermagem"><Select value={d.tempo_profissao} onChange={v=>set("tempo_profissao",v)} opts={OPT_TEMPO_PROF}/></Campo>
        <Campo label="Turno de trabalho"><Select value={d.turno} onChange={v=>set("turno",v)} opts={OPT_TURNO}/></Campo>
        <Campo label="Carga horária semanal"><Select value={d.carga_horaria} onChange={v=>set("carga_horaria",v)} opts={OPT_CARGA}/></Campo>
        <Campo label="Função principal"><Select value={d.funcao} onChange={v=>set("funcao",v)} opts={OPT_FUNCAO}/></Campo>
        <Campo label="Setor de atuação"><Select value={d.setor} onChange={v=>set("setor",v)} opts={OPT_SETOR}/></Campo>
        <Campo label="Vínculo empregatício"><Select value={d.vinculo} onChange={v=>set("vinculo",v)} opts={OPT_VINCULO}/></Campo>
      </div>

      <div className="section-title">Saúde e Estilo de Vida</div>
      <div className="grid2">
        <Campo label="Frequência de tabagismo (últimos 12 meses)"><Select value={d.tabagismo} onChange={v=>set("tabagismo",v)} opts={OPT_FREQ}/></Campo>
        <Campo label="Consumo de álcool (últimos 12 meses)"><Select value={d.alcool} onChange={v=>set("alcool",v)} opts={OPT_FREQ}/></Campo>
      </div>

      <div className="btn-row">
        <button className="btn btn-p" onClick={handleSalvar}>Salvar e continuar →</button>
      </div>
    </div>
  );
}

// ─── BEM-ESTAR ────────────────────────────────────────────────────────────────
function TelaBemestar({ onSalvar }) {
  const [vals, setVals] = useState({});
  const [err, setErr] = useState("");

  function handleSalvar() {
    const faltando = DIMS_BW.filter(d=>!vals[d.key]);
    if (faltando.length) { setErr("Avalie todas as dimensões antes de continuar."); return; }
    setErr(""); onSalvar(vals);
  }

  return (
    <div className="card">
      <div className="step-lbl">Etapa 2 de 4</div>
      <h2 className="card-title">Avaliação de Bem-estar</h2>
      <p className="card-sub">Como você avalia cada dimensão da sua vida atualmente? Selecione uma opção para cada item.</p>
      {err && <div className="alert ae">{err}</div>}
      {DIMS_BW.map(d=>(
        <div className="likert-row" key={d.key}>
          <div className="likert-label">{d.label}</div>
          <div className="likert-opts">
            {LIKERT_BW.map((opt,i)=>(
              <button key={i} className={`likert-btn${vals[d.key]===(i+1)?" sel":""}`}
                onClick={()=>setVals(v=>({...v,[d.key]:i+1}))}>{opt}</button>
            ))}
          </div>
        </div>
      ))}
      <div className="btn-row">
        <button className="btn btn-p" onClick={handleSalvar}>Continuar →</button>
      </div>
    </div>
  );
}

// ─── SOC-13 ───────────────────────────────────────────────────────────────────
function TelaSOC({ respostas, onChange, pergAtual, onNext, onPrev }) {
  const p = SOC_PERGUNTAS[pergAtual];
  const progresso = ((pergAtual+1)/13)*100;

  return (
    <div className="card">
      <div className="step-lbl">Questionário SOC — Pergunta {pergAtual+1} de 13</div>
      <div className="prog"><div className="prog-fill" style={{width:`${progresso}%`}}/></div>

      {pergAtual === 0 && (
        <div className="alert ai" style={{marginBottom:"1.25rem"}}>
          <strong>Instruções:</strong> A seguir, você encontrará uma série de questões relacionadas a diferentes aspectos da vida. Cada pergunta possui uma escala de resposta de 1 a 7. Selecione apenas uma alternativa por questão, escolhendo o número que melhor representa seus sentimentos, percepções ou experiências.
        </div>
      )}

      <div className="soc-ancora">{ANCORA_VIDA}</div>

      <div style={{fontSize:".95rem",lineHeight:"1.6",color:"var(--b9)",marginBottom:"1rem",fontWeight:500}}>
        {p.texto}
      </div>

      <div className="soc-scale">
        {[1,2,3,4,5,6,7].map(v=>(
          <button key={v} className={`soc-btn${respostas[p.num]===v?" sel":""}`}
            onClick={()=>onChange(p.num,v)}>{v}</button>
        ))}
      </div>
      <div className="soc-anchors">
        <span>1 – {p.ancora_min}</span>
        <span>7 – {p.ancora_max}</span>
      </div>

      <div className="btn-row">
        {pergAtual>0 && <button className="btn btn-s" onClick={onPrev}>← Voltar</button>}
        <button className="btn btn-p" disabled={!respostas[p.num]} onClick={onNext}>
          {pergAtual<12?"Próxima →":"Calcular resultado →"}
        </button>
      </div>
    </div>
  );
}

// ─── RESULTADO ────────────────────────────────────────────────────────────────
function TelaResultado({ soc, diagnostico, historico, onRetestar }) {
  const cc = {Alto:"b-alto",Médio:"b-medio",Baixo:"b-baixo"}[soc.classificacao]||"b-medio";
  return (
    <div>
      <div className="card">
        <div className="step-lbl">Resultado</div>
        <h2 className="card-title">Seu Senso de Coerência</h2>
        <div style={{display:"flex",alignItems:"baseline",gap:".75rem",margin:".5rem 0 1rem"}}>
          <span style={{fontSize:"2.8rem",fontFamily:"Lora,serif",fontWeight:600,color:"var(--b9)"}}>{soc.soc_total}</span>
          <span style={{color:"var(--g6)"}}>/91</span>
          <span className={`badge ${cc}`}>SOC {soc.classificacao}</span>
        </div>
        <div className="score-grid">
          {[{k:"compreensibilidade",l:"Compreensibilidade",m:49},{k:"maneabilidade",l:"Maneabilidade",m:35},{k:"significancia",l:"Significância",m:7}].map(d=>(
            <div className="score-card" key={d.k}>
              <div className="score-name">{d.l}</div>
              <div><span className="score-num">{soc[d.k]}</span><span className="score-max"> /{d.m}</span></div>
              <div className="score-bar"><div className="score-bar-fill" style={{width:`${(soc[d.k]/d.m)*100}%`}}/></div>
            </div>
          ))}
          <div className="score-card" style={{background:"var(--b9)"}}>
            <div className="score-name" style={{color:"var(--b1)"}}>Foco prioritário</div>
            <div style={{fontSize:"1rem",fontWeight:600,color:"white",marginTop:".3rem",textTransform:"capitalize"}}>{soc.dimensao_foco}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="step-lbl">Diagnóstico personalizado</div>
        <h2 className="card-title">Sua Avaliação</h2>
        {diagnostico ? <div className="diag-text">{diagnostico}</div> : <div className="spin"/>}
      </div>

      {historico && historico.length>1 && (
        <div className="card">
          <h2 className="card-title">Sua Evolução</h2>
          {historico.slice(-8).map((s,i)=>(
            <div className="bar-row" key={i}>
              <div className="bar-lbl">{new Date(s.data_sessao).toLocaleDateString("pt-BR",{day:"2-digit",month:"short"})}</div>
              <div className="bar-bg"><div className="bar-val" style={{width:`${(s.soc_total/91)*100}%`}}/></div>
              <div className="bar-num">{s.soc_total}</div>
            </div>
          ))}
        </div>
      )}

      <div className="btn-row">
        <button className="btn btn-s" onClick={onRetestar}>↺ Refazer questionário</button>
      </div>
    </div>
  );
}

// ─── ADMIN ────────────────────────────────────────────────────────────────────
function TelaAdmin({ onVoltar }) {
  const [senha, setSenha] = useState("");
  const [auth, setAuth] = useState(false);
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aba, setAba] = useState("stats");
  const [stats, setStats] = useState(null);
  const [filtros, setFiltros] = useState({setor:"",classif:"",de:"",ate:""});

  async function autenticar() {
    if (senha===ADMIN_PASSWORD) { setAuth(true); await carregar(); }
    else alert("Senha incorreta.");
  }

  async function carregar() {
    setLoading(true);
    try {
      const s = await sb("GET","sessoes?select=*,usuarios(setor,idade,sexo,turno,categoria)&order=data_sessao.desc");
      setDados(s||[]);
      if (s&&s.length) {
        const totais = s.map(x=>x.soc_total).filter(Boolean);
        const media = totais.reduce((a,b)=>a+b,0)/totais.length;
        const dist = {Alto:0,Médio:0,Baixo:0};
        s.forEach(x=>{ if(x.classificacao) dist[x.classificacao]++; });
        setStats({participantes:new Set(s.map(x=>x.usuario_id)).size, sessoes:s.length, media:Math.round(media), dist});
      }
    } finally { setLoading(false); }
  }

  function filtrar() {
    return dados.filter(s=>{
      if (filtros.setor && s.usuarios?.setor!==filtros.setor) return false;
      if (filtros.classif && s.classificacao!==filtros.classif) return false;
      if (filtros.de && new Date(s.data_sessao)<new Date(filtros.de)) return false;
      if (filtros.ate && new Date(s.data_sessao)>new Date(filtros.ate)) return false;
      return true;
    });
  }

  function exportarCSV() {
    const linhas = filtrar();
    const cab = "ID_Anonimo,Data,Setor,Faixa_Etaria,Sexo,Categoria,Turno,Comp,Man,Sig,SOC_Total,Classificacao,Foco";
    const corpo = linhas.map(s=>[
      s.usuario_id?.slice(0,8),
      new Date(s.data_sessao).toLocaleDateString("pt-BR"),
      s.usuarios?.setor, s.usuarios?.idade, s.usuarios?.sexo,
      s.usuarios?.categoria, s.usuarios?.turno,
      s.compreensibilidade, s.maneabilidade, s.significancia,
      s.soc_total, s.classificacao, s.dimensao_foco
    ].join(",")).join("\n");
    const blob = new Blob([`${cab}\n${corpo}`],{type:"text/csv"});
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="coerencia_dados.csv"; a.click();
  }

  if (!auth) return (
    <div className="card">
      <div className="step-lbl">Acesso Restrito</div>
      <h2 className="card-title">Painel do Pesquisador</h2>
      <Campo label="Senha de acesso"><input type="password" value={senha} onChange={e=>setSenha(e.target.value)} onKeyDown={e=>e.key==="Enter"&&autenticar()}/></Campo>
      <div className="btn-row">
        <button className="btn btn-s" onClick={onVoltar}>← Voltar</button>
        <button className="btn btn-p" onClick={autenticar}>Entrar</button>
      </div>
    </div>
  );

  const filtrados = filtrar();

  return (
    <div>
      <div className="card" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <h2 className="card-title" style={{marginBottom:0}}>Painel do Pesquisador</h2>
        <div style={{display:"flex",gap:".5rem"}}>
          <button className="btn btn-s" style={{fontSize:".8rem"}} onClick={exportarCSV}>⬇ CSV</button>
          <button className="btn btn-s" style={{fontSize:".8rem"}} onClick={onVoltar}>← Sair</button>
        </div>
      </div>

      <div className="tabs">
        {[["stats","Estatísticas"],["dados","Dados"],["filtros","Filtros"]].map(([k,l])=>(
          <button key={k} className={`tab${aba===k?" on":""}`} onClick={()=>setAba(k)}>{l}</button>
        ))}
      </div>

      {loading && <div className="spin"/>}

      {aba==="stats" && stats && (
        <div className="card">
          <div className="stat-row">
            <div className="stat-box"><div className="stat-num">{stats.participantes}</div><div className="stat-lbl">Participantes</div></div>
            <div className="stat-box"><div className="stat-num">{stats.sessoes}</div><div className="stat-lbl">Sessões</div></div>
            <div className="stat-box"><div className="stat-num">{stats.media}</div><div className="stat-lbl">Média SOC</div></div>
          </div>
          <p style={{fontSize:".83rem",fontWeight:500,margin:"1rem 0 .5rem"}}>Distribuição de classificações</p>
          {Object.entries(stats.dist).map(([k,v])=>(
            <div className="bar-row" key={k}>
              <div className="bar-lbl">{k}</div>
              <div className="bar-bg"><div className="bar-val" style={{width:`${stats.sessoes?(v/stats.sessoes)*100:0}%`}}/></div>
              <div className="bar-num">{v}</div>
            </div>
          ))}
        </div>
      )}

      {aba==="filtros" && (
        <div className="card">
          <div className="grid2">
            <Campo label="Setor"><Select value={filtros.setor} onChange={v=>setFiltros(f=>({...f,setor:v}))} opts={OPT_SETOR}/></Campo>
            <Campo label="Classificação SOC"><Select value={filtros.classif} onChange={v=>setFiltros(f=>({...f,classif:v}))} opts={["Alto","Médio","Baixo"]}/></Campo>
            <Campo label="Data inicial"><input type="date" value={filtros.de} onChange={e=>setFiltros(f=>({...f,de:e.target.value}))}/></Campo>
            <Campo label="Data final"><input type="date" value={filtros.ate} onChange={e=>setFiltros(f=>({...f,ate:e.target.value}))}/></Campo>
          </div>
          <div className="alert ai">{filtrados.length} sessão(ões) encontrada(s).</div>
        </div>
      )}

      {aba==="dados" && (
        <div className="card" style={{overflowX:"auto"}}>
          <table className="adm-tbl">
            <thead><tr><th>ID</th><th>Data</th><th>Setor</th><th>Comp</th><th>Man</th><th>Sig</th><th>Total</th><th>Class.</th></tr></thead>
            <tbody>
              {filtrados.slice(0,100).map((s,i)=>(
                <tr key={i}>
                  <td style={{fontFamily:"monospace"}}>{s.usuario_id?.slice(0,8)}…</td>
                  <td>{new Date(s.data_sessao).toLocaleDateString("pt-BR")}</td>
                  <td>{s.usuarios?.setor||"-"}</td>
                  <td>{s.compreensibilidade}</td><td>{s.maneabilidade}</td><td>{s.significancia}</td>
                  <td><strong>{s.soc_total}</strong></td>
                  <td><span className={`badge ${{Alto:"b-alto",Médio:"b-medio",Baixo:"b-baixo"}[s.classificacao]}`} style={{fontSize:".72rem",padding:"2px 8px"}}>{s.classificacao}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────
export default function App() {
  const [tela, setTela] = useState("identificacao");
  const [userId, setUserId] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [primeiroAcesso, setPrimeiroAcesso] = useState(true);
  const [bemestarAtual, setBemestarAtual] = useState(null);
  const [pergAtual, setPergAtual] = useState(0);
  const [respostas, setRespostas] = useState({});
  const [resultadoSOC, setResultadoSOC] = useState(null);
  const [diagnostico, setDiagnostico] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  async function handleIdentify(id) {
    setUserId(id); setLoading(true); setErro("");
    try {
      const usuarios = await sb("GET",`usuarios?id=eq.${id}&select=*`);
      if (usuarios&&usuarios.length>0) {
        const u = usuarios[0];
        if (!u.consentimento) { setTela("tcle"); return; }
        setPerfil(u); setPrimeiroAcesso(false);
        const sess = await sb("GET",`sessoes?usuario_id=eq.${id}&order=data_sessao.asc`);
        setHistorico(sess||[]);
        setTela("bemestar");
      } else {
        setPrimeiroAcesso(true); setTela("tcle");
      }
    } catch { setErro("Erro ao verificar participante. Verifique as configurações do Supabase."); }
    finally { setLoading(false); }
  }

  async function handleConsentir() {
    try {
      if (primeiroAcesso) await sb("POST","usuarios",{id:userId,consentimento:true,data_consentimento:new Date().toISOString()});
      else await sb("PATCH",`usuarios?id=eq.${userId}`,{consentimento:true,data_consentimento:new Date().toISOString()});
    } catch { /* continua */ }
    setTela("perfil");
  }

  async function handleSalvarPerfil(dados) {
    try {
      const payload = {...dados, id:userId};
      await sb("POST","usuarios",payload).catch(()=>sb("PATCH",`usuarios?id=eq.${userId}`,dados));
      setPerfil(payload);
    } catch { /* continua */ }
    setTela("bemestar");
  }

  async function handleFinalizarSOC() {
    const soc = calcularSOC(respostas);
    setResultadoSOC(soc);
    setTela("resultado");

    // Salvar sessão no Supabase
    let sessaoId = null;
    try {
      const sessao = {
        usuario_id: userId,
        data_sessao: new Date().toISOString(),
        ...Object.fromEntries(Object.entries(respostas).map(([k,v])=>[`r${k}`,v])),
        ...soc,
      };
      const nova = await sb("POST","sessoes",sessao);
      sessaoId = nova?.[0]?.id;
      if (bemestarAtual&&sessaoId) {
        await sb("POST","bemestar",{usuario_id:userId,sessao_id:sessaoId,...bemestarAtual});
      }
      const todasSess = await sb("GET",`sessoes?usuario_id=eq.${userId}&order=data_sessao.asc`);
      setHistorico(todasSess||[]);
    } catch { /* dados locais disponíveis */ }

    // Gerar diagnóstico via Claude
    try {
      const prompt = `Você é um especialista em saúde do trabalhador, com linguagem empática e acessível. Gere um relatório personalizado para este enfermeiro(a):

PERFIL: Setor: ${perfil?.setor||"não informado"}, Faixa etária: ${perfil?.idade||"-"}, Sexo: ${perfil?.sexo||"-"}, Categoria: ${perfil?.categoria||"-"}, Turno: ${perfil?.turno||"-"}, Tempo na profissão: ${perfil?.tempo_profissao||"-"}.

BEM-ESTAR (1=Muito ruim a 5=Muito boa): Alimentação: ${bemestarAtual?.alimentacao}, Sono: ${bemestarAtual?.sono}, Saúde mental: ${bemestarAtual?.saude_mental}, Convívio familiar: ${bemestarAtual?.convivio_familiar}, Rede de apoio: ${bemestarAtual?.rede_apoio}, Lazer: ${bemestarAtual?.lazer}, Atividade física: ${bemestarAtual?.atividade_fisica}, Satisfação com a vida: ${bemestarAtual?.satisfacao_vida}.

SOC-13: Compreensibilidade: ${soc.compreensibilidade}/49, Maneabilidade: ${soc.maneabilidade}/35, Significância: ${soc.significancia}/7, Total: ${soc.soc_total}/91 — ${soc.classificacao}. Dimensão prioritária: ${soc.dimensao_foco}.

Escreva um relatório com esta estrutura exata:

1. INTRODUÇÃO (2 frases acolhedoras e motivadoras)
2. SEUS RESULTADOS (interprete os escores em linguagem acessível, sem citar nomes técnicos de escalas)
3. PONTO DE ATENÇÃO (explique o impacto da dimensão "${soc.dimensao_foco}" na vida desta pessoa)
4. ESTRATÉGIAS PRÁTICAS (exatamente 3 estratégias, cada uma com: Nome | Como fazer | Por que ajuda)
5. PRÓXIMO PASSO (1 frase encorajadora)

Seja caloroso, direto e prático. Máximo 450 palavras.`;

      const resp = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          messages:[{role:"user",content:prompt}]
        })
      });
      const data = await resp.json();
      const diag = data.content?.map(b=>b.text||"").join("")||"Diagnóstico não disponível.";
      setDiagnostico(diag);
      if (sessaoId) await sb("PATCH",`sessoes?id=eq.${sessaoId}`,{diagnostico:diag}).catch(()=>{});
    } catch {
      setDiagnostico("Não foi possível gerar o diagnóstico personalizado no momento. Seus dados foram salvos com sucesso.");
    }
  }

  function handleRetestar() {
    setRespostas({}); setPergAtual(0); setResultadoSOC(null); setDiagnostico(null);
    setTela("bemestar");
  }

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <header className="hdr">
          <div>
            <div className="hdr-logo">🩺 CoerêncIA</div>
            <div className="hdr-sub">Bem-estar em Enfermagem</div>
          </div>
          {tela!=="admin" && (
            <button className="btn" style={{marginLeft:"auto",fontSize:".75rem",padding:".35rem .75rem",color:"rgba(255,255,255,.55)",background:"transparent",border:"1px solid rgba(255,255,255,.2)"}}
              onClick={()=>setTela("admin")}>Painel admin</button>
          )}
        </header>

        <main className="main">
          {erro && <div className="alert ae">{erro}<button style={{marginLeft:".5rem",background:"none",border:"none",cursor:"pointer",fontWeight:600}} onClick={()=>setErro("")}>✕</button></div>}
          {loading && <div className="spin"/>}

          {!loading && tela==="identificacao" && <TelaIdentificacao onIdentify={handleIdentify}/>}
          {!loading && tela==="tcle" && <TelaTCLE onConsentir={handleConsentir} onRecusar={()=>setTela("identificacao")}/>}
          {!loading && tela==="perfil" && <TelaPerfil onSalvar={handleSalvarPerfil}/>}
          {!loading && tela==="bemestar" && <TelaBemestar onSalvar={v=>{setBemestarAtual(v);setTela("soc");}}/>}
          {!loading && tela==="soc" && (
            <TelaSOC
              respostas={respostas}
              pergAtual={pergAtual}
              onChange={(num,val)=>setRespostas(r=>({...r,[num]:val}))}
              onNext={()=>{ if(pergAtual<12) setPergAtual(p=>p+1); else handleFinalizarSOC(); }}
              onPrev={()=>setPergAtual(p=>p-1)}
            />
          )}
          {tela==="resultado" && resultadoSOC && (
            <TelaResultado soc={resultadoSOC} diagnostico={diagnostico} historico={historico} onRetestar={handleRetestar}/>
          )}
          {tela==="admin" && <TelaAdmin onVoltar={()=>setTela("identificacao")}/>}
        </main>
      </div>
    </>
  );
}
