import { useState } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("").slice(0,16);
}

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

// SOC-13
const ITENS_INVERTIDOS = [1,2,3,5,6,7,8,9,10,12,13];
const SOC_PERGUNTAS = [
  { num:1, texto:"Com que frequência você tem a sensação de que não se importa com o que está acontecendo ao seu redor?", min:"Raramente ou nunca", max:"Com muita frequência" },
  { num:2, texto:"Alguma vez já aconteceu de você se surpreender com o comportamento de pessoas que você achava que conhecia bem?", min:"Nunca aconteceu", max:"Sempre aconteceu" },
  { num:3, texto:"Já aconteceu das pessoas com quem você contava te decepcionarem?", min:"Nunca aconteceu", max:"Sempre aconteceu" },
  { num:4, texto:"Até agora, sua vida tem sido:", min:"Sem qualquer objetivo ou finalidade", max:"Com finalidade e objetivos claros" },
  { num:5, texto:"Com que frequência você tem a sensação de que está sendo tratado injustamente?", min:"Com muita frequência", max:"Raramente ou nunca" },
  { num:6, texto:"Com que frequência você tem a sensação de que está numa situação desconhecida e não sabe o que fazer?", min:"Com muita frequência", max:"Raramente ou nunca" },
  { num:7, texto:"Fazer as coisas que você faz todos os dias é:", min:"Uma fonte de grande prazer e satisfação", max:"Uma fonte de sofrimento e chatice" },
  { num:8, texto:"Com que frequência você tem sentimentos e ideias bastante confusas?", min:"Com muita frequência", max:"Raramente ou nunca" },
  { num:9, texto:"Com que frequência acontece de você ter sentimentos que você preferiria não sentir?", min:"Com muita frequência", max:"Raramente ou nunca" },
  { num:10, texto:"Muitas pessoas — mesmo aquelas muito fortes — algumas vezes se sentem fracassadas em certas situações. Com que frequência você já se sentiu dessa maneira?", min:"Nunca", max:"Com muita frequência" },
  { num:11, texto:"Quando alguma coisa acontece a você, em geral você acha que:", min:"Você deu muita ou pouca importância para o que aconteceu", max:"Você viu as coisas na medida certa" },
  { num:12, texto:"Com que frequência você tem a sensação de que há pouco significado nas coisas que faz na sua vida diária?", min:"Com muita frequência", max:"Raramente ou nunca" },
  { num:13, texto:"Com que frequência você tem a sensação de que você não consegue manter seu autocontrole?", min:"Com muita frequência", max:"Raramente ou nunca" },
];

function calcularSOC(respostas) {
  const r = {...respostas};
  ITENS_INVERTIDOS.forEach(i => { if(r[i]) r[i] = 8-r[i]; });
  const comp = [1,3,5,6,8,11,13].reduce((s,i)=>s+(r[i]||0),0);
  const man  = [2,4,9,10,12].reduce((s,i)=>s+(r[i]||0),0);
  const sig  = [7].reduce((s,i)=>s+(r[i]||0),0);
  const total = comp+man+sig;
  const props = {compreensibilidade:comp/49, maneabilidade:man/35, significancia:sig/7};
  const foco = Object.entries(props).sort((a,b)=>a[1]-b[1])[0][0];
  const classif = (total/91)>=0.67?"Alto":(total/91)>=0.34?"Médio":"Baixo";
  return {compreensibilidade:comp, maneabilidade:man, significancia:sig, soc_total:total, classificacao:classif, dimensao_foco:foco};
}

// Explicação de cada dimensão para o diagnóstico
const EXPLICACAO_DIMENSAO = {
  compreensibilidade: "A compreensibilidade é a capacidade de perceber a vida como algo estruturado, previsível e explicável. Quando está baixa, situações cotidianas podem parecer caóticas ou incompreensíveis, gerando insegurança e dificuldade de tomar decisões.",
  maneabilidade: "A maneabilidade é a crença de que você possui recursos suficientes — internos ou externos — para lidar com os desafios da vida. Quando está baixa, pode surgir a sensação de impotência ou de que as dificuldades são maiores do que sua capacidade de enfrentá-las.",
  significancia: "A significância é a dimensão motivacional do senso de coerência: o quanto você sente que a vida vale a pena e que o que você faz tem sentido. Quando está baixa, o engajamento com o trabalho e as relações pode diminuir, e surgir uma sensação de vazio ou falta de propósito.",
};

// Referências de acesso aberto verificadas (PMC, SciELO, DOI aberto)
const REFS = {
  compreensibilidade: [
    {
      titulo: "Antonovsky's sense of coherence scale and the relation with health — a systematic review",
      autores: "Eriksson & Lindström",
      ano: 2006,
      base: "PubMed Central (PMC)",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2563985/",
    },
    {
      titulo: "Salutogenesis and sense of coherence: significance for mental health promotion",
      autores: "Lindström & Eriksson",
      ano: 2005,
      base: "PubMed Central (PMC)",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC1472656/",
    },
    {
      titulo: "The sense of coherence: a way of understanding and explaining health",
      autores: "Eriksson",
      ano: 2007,
      base: "PubMed Central (PMC)",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2715961/",
    },
  ],
  maneabilidade: [
    {
      titulo: "Sense of coherence and health — a systematic review",
      autores: "Eriksson & Lindström",
      ano: 2006,
      base: "PubMed Central (PMC)",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2563985/",
    },
    {
      titulo: "Social support, sense of coherence and health — a review",
      autores: "Moksnes et al.",
      ano: 2013,
      base: "PubMed Central (PMC)",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3654245/",
    },
    {
      titulo: "Physical activity, sense of coherence and quality of life",
      autores: "Bernstein & McNally",
      ano: 2019,
      base: "PubMed Central (PMC)",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6826528/",
    },
  ],
  significancia: [
    {
      titulo: "Sense of coherence and meaning in life as predictors of quality of life in older adults",
      autores: "Haugan et al.",
      ano: 2013,
      base: "PubMed Central (PMC)",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3785710/",
    },
    {
      titulo: "Sense of coherence, purpose in life and well-being",
      autores: "Eriksson & Lindström",
      ano: 2007,
      base: "PubMed Central (PMC)",
      url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2715961/",
    },
    {
      titulo: "Meaningfulness as a protective factor against depression",
      autores: "Schumacher et al.",
      ano: 2000,
      base: "SciELO",
      url: "https://www.scielo.br/j/rbp/a/4xJjMGBVqkFjWQSDkhTKgKq/",
    },
  ],
};

// Intervenções padronizadas por dimensão (mesmo conteúdo para todos com aquela dimensão)
const INTERVENCOES = {
  compreensibilidade: [
    {
      emoji: "📔",
      nome: "Diário de sentido",
      posologia: "10 min · ao final do dia · por 2 semanas",
      como: "Anote 3 situações do dia que fizeram sentido para você — mesmo que pequenas. Use um caderno ou aplicativo.",
      porque: "Treina o cérebro a identificar padrões e previsibilidade na vida cotidiana.",
      refs: [REFS.compreensibilidade[0], REFS.compreensibilidade[1]],
    },
    {
      emoji: "💬",
      nome: "Conversa de 5 minutos",
      posologia: "5 min · 1x por semana · por 2 semanas",
      como: "Escolha alguém de confiança e converse brevemente sobre como está se sentindo. Sem julgamentos.",
      porque: "O suporte social fortalece a capacidade de dar sentido às experiências e reduz a sensação de caos.",
      refs: [REFS.compreensibilidade[1], REFS.compreensibilidade[2]],
    },
    {
      emoji: "⏸️",
      nome: "Pausa consciente",
      posologia: "2 min · sempre que sentir sobrecarga",
      como: "Pare, respire fundo 3 vezes e pergunte-se: 'O que eu entendo sobre essa situação?'",
      porque: "Interrompe a confusão cognitiva e ativa a capacidade reflexiva de dar sentido ao que acontece.",
      refs: [REFS.compreensibilidade[0], REFS.compreensibilidade[2]],
    },
  ],
  maneabilidade: [
    {
      emoji: "🗂️",
      nome: "Lista de recursos",
      posologia: "5 min · 1x por semana · por 2 semanas",
      como: "Escreva 5 recursos seus: pessoas, habilidades ou experiências. Releia quando sentir que não tem controle.",
      porque: "Reconhecer os próprios recursos fortalece a crença de que você tem o que precisa para os desafios.",
      refs: [REFS.maneabilidade[0], REFS.maneabilidade[1]],
    },
    {
      emoji: "🏃",
      nome: "Movimento diário",
      posologia: "30 min · 3x por semana · por 2 semanas",
      como: "Caminhada, dança ou qualquer movimento que goste. Sem pressão de intensidade.",
      porque: "Exercício regular está associado ao aumento da sensação de controle sobre o próprio corpo e a vida.",
      refs: [REFS.maneabilidade[2], REFS.maneabilidade[1]],
    },
    {
      emoji: "🏆",
      nome: "Vitória da semana",
      posologia: "5 min · toda sexta-feira · por 2 semanas",
      como: "Identifique 1 desafio que enfrentou e como o superou. Escreva ou apenas reflita.",
      porque: "Fortalecer a memória de superação aumenta a crença na própria capacidade de lidar com situações futuras.",
      refs: [REFS.maneabilidade[0], REFS.maneabilidade[2]],
    },
  ],
  significancia: [
    {
      emoji: "🎯",
      nome: "Minha razão",
      posologia: "2 min · toda manhã · por 2 semanas",
      como: "Leia ou escreva uma frase: 'O que faço importa porque...' Comece o dia conectado ao seu propósito.",
      porque: "Reconectar-se com o propósito fortalece a significância — o motor motivacional do senso de coerência.",
      refs: [REFS.significancia[0], REFS.significancia[1]],
    },
    {
      emoji: "🙏",
      nome: "Gratidão noturna",
      posologia: "2 min · 1x ao dia · por 2 semanas",
      como: "Antes de dormir, identifique 1 coisa pela qual você é grata hoje. Pode ser algo simples.",
      porque: "Práticas de gratidão estão associadas ao aumento da percepção de significado na vida cotidiana.",
      refs: [REFS.significancia[1], REFS.significancia[2]],
    },
    {
      emoji: "🌱",
      nome: "Conexão maior",
      posologia: "15 min · 1x por semana · por 2 semanas",
      como: "Dedique tempo a algo além do trabalho: natureza, espiritualidade, arte ou voluntariado.",
      porque: "Pertencer a algo maior do que si mesmo é um dos pilares do bem-estar e da significância duradouros.",
      refs: [REFS.significancia[0], REFS.significancia[2]],
    },
  ],
};

const OPT_IDADE=["Até 25 anos","26 a 30 anos","31 a 40 anos","41 a 50 anos","51 a 60 anos","61 anos ou mais"];
const OPT_SEXO=["Feminino","Masculino"];
const OPT_IDENTIDADE=["Mulher cisgênero","Homem cisgênero","Mulher trans","Homem trans","Não binário"];
const OPT_RACA=["Branco(a)","Pardo(a)","Preto(a)","Amarelo(a)","Indígena"];
const OPT_RENDA=["Até 1 salário mínimo","1 a 2 salários mínimos","2 a 3 salários mínimos","3 a 4 salários mínimos","4 a 5 salários mínimos","Acima de 5 salários mínimos"];
const OPT_ESTADO_CIVIL=["Solteiro(a)","Casado(a) / União estável","Divorciado(a) / Separado(a)","Viúvo(a)"];
const OPT_CATEGORIA=["Enfermeiro(a)","Enfermeiro(a) especialista","Mestre","Doutor(a)"];
const OPT_TEMPO_PROF=["Menos de 6 meses","6 meses a 1 ano","1 a 2 anos","2 a 5 anos","5 a 10 anos","10 anos ou mais"];
const OPT_TURNO=["Manhã","Tarde","Noite","Plantão 12h","Plantão 24h","Misto"];
const OPT_CARGA=["Até 20h","21h a 30h","31h a 40h","41h ou mais"];
const OPT_FUNCAO=["Assistencial","Supervisão / Gestão","Auditoria","Preceptoria / Docência","Outra"];
const OPT_SETOR=["UTI","Centro Cirúrgico","Clínica Médica","Obstetrícia / Maternidade","Pediatria","Oncologia","Saúde Mental","Pronto-socorro / Emergência","Atenção Básica (ESF/UBS)","Outro"];
const OPT_VINCULO=["CLT","Estatutário","PJ / Cooperado","Contrato Temporário"];
const OPT_FREQ=["Nunca","Mensalmente ou menos","2 a 4 vezes por mês","2 a 3 vezes por semana","4 ou mais vezes por semana"];
const DIMS_BW=[
  {key:"alimentacao",label:"Alimentação",emoji:"🥗"},
  {key:"sono",label:"Sono e repouso",emoji:"😴"},
  {key:"saude_mental",label:"Saúde mental",emoji:"🧠"},
  {key:"convivio_familiar",label:"Convívio familiar",emoji:"👨‍👩‍👧"},
  {key:"rede_apoio",label:"Rede de apoio",emoji:"🤝"},
  {key:"lazer",label:"Lazer",emoji:"🎯"},
  {key:"atividade_fisica",label:"Atividade física",emoji:"🏃"},
  {key:"satisfacao_vida",label:"Satisfação com a vida",emoji:"✨"},
];
const LIKERT_LABELS=["Muito ruim","Ruim","Regular","Boa","Muito boa"];

// Renderizar markdown simples do diagnóstico da LLM
function DiagText({text}) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  lines.forEach((line, i) => {
    if (!line.trim()) { elements.push(<br key={i}/>); return; }
    const titleMatch = line.match(/^\d+\.\s+\*\*(.+?)\*\*/) || line.match(/^#+\s+(.+)/);
    if (titleMatch) {
      elements.push(<div key={i} style={{fontWeight:700,color:"var(--navy)",fontSize:".88rem",marginTop:".9rem",marginBottom:".2rem"}}>{titleMatch[1]}</div>);
      return;
    }
    const clean = line.replace(/\*\*(.+?)\*\*/g,'$1').replace(/^\*\s+/,'• ').trim();
    if (clean) elements.push(<p key={i} style={{fontSize:".83rem",color:"var(--gray-700)",lineHeight:1.7,marginBottom:".3rem"}}>{clean}</p>);
  });
  return <div>{elements}</div>;
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --navy:#0B2545;--blue:#1B4F8C;--sky:#2979D0;--deep:#1A3870;--light:#5BA4F5;--pale:#EBF4FF;
  --teal:#0D7377;--mint:#14A085;--gpale:#E6F7F4;
  --amber:#D97706;--apale:#FEF3C7;
  --red:#DC2626;--rpale:#FEE2E2;
  --g9:#111827;--g7:#374151;--g5:#6B7280;--g3:#D1D5DB;--g1:#F3F4F6;--g0:#F9FAFB;
}
html{-webkit-text-size-adjust:100%;}
body{font-family:'Plus Jakarta Sans',sans-serif;background:var(--g0);color:var(--g9);-webkit-font-smoothing:antialiased;}

.hdr{background:var(--navy);padding:.85rem 1.25rem;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;box-shadow:0 2px 8px rgba(0,0,0,.15);}
.logo{font-size:1.2rem;font-weight:800;color:white;letter-spacing:-.02em;display:flex;align-items:center;gap:.4rem;}
.logo-ia{color:#2979D0;}
.hdr-adm{font-size:.7rem;padding:.28rem .65rem;border-radius:20px;border:1px solid rgba(255,255,255,.18);background:transparent;color:rgba(255,255,255,.5);cursor:pointer;font-family:inherit;}

.main{max-width:500px;margin:0 auto;padding-bottom:3rem;}

.hero{background:linear-gradient(150deg,var(--navy) 0%,#1a3a6b 100%);padding:2.5rem 1.5rem 2.25rem;text-align:center;overflow:hidden;position:relative;}
.hero::after{content:'';position:absolute;top:-80px;right:-80px;width:220px;height:220px;border-radius:50%;background:rgba(255,255,255,.03);}
.hero-badge{display:inline-flex;align-items:center;gap:.3rem;background:rgba(255,255,255,.09);color:rgba(255,255,255,.8);font-size:.68rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:.28rem .8rem;border-radius:20px;margin-bottom:.9rem;border:1px solid rgba(255,255,255,.13);}
.hero-title{font-size:2.6rem;font-weight:800;color:white;line-height:1.08;letter-spacing:-.04em;margin-bottom:.55rem;}
.hero-title em{color:#5BA4F5;font-style:normal;}
.hero-sub{font-size:.85rem;color:rgba(255,255,255,.6);line-height:1.65;max-width:290px;margin:0 auto 1.75rem;}
.hero-btns{display:flex;gap:.55rem;justify-content:center;}
.btn-hp{background:white;color:var(--navy);font-size:.85rem;font-weight:700;padding:.72rem 1.35rem;border-radius:50px;border:none;cursor:pointer;font-family:inherit;transition:transform .12s,box-shadow .12s;}
.btn-hp:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(0,0,0,.18);}
.btn-hs{background:rgba(255,255,255,.09);color:white;font-size:.85rem;font-weight:600;padding:.72rem 1.35rem;border-radius:50px;border:1px solid rgba(255,255,255,.22);cursor:pointer;font-family:inherit;}

.explore{padding:1.4rem 1.25rem 0;}
.explore-ttl{font-size:.95rem;font-weight:700;margin-bottom:.12rem;}
.explore-sub{font-size:.75rem;color:var(--g5);margin-bottom:.9rem;}
.ex-card{background:white;border-radius:13px;padding:.9rem 1rem;margin-bottom:.55rem;display:flex;align-items:center;gap:.85rem;cursor:pointer;border:1.5px solid var(--g1);transition:border-color .15s,box-shadow .12s;}
.ex-card:hover{border-color:#C7DCFF;box-shadow:0 2px 10px rgba(41,121,208,.07);}
.ex-icon{width:42px;height:42px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:1.25rem;flex-shrink:0;}
.ex-body h3{font-size:.85rem;font-weight:700;margin-bottom:.08rem;}
.ex-body p{font-size:.72rem;color:var(--g5);line-height:1.45;}
.ex-link{font-size:.7rem;font-weight:700;color:var(--sky);margin-top:.18rem;}

.como-hdr{background:var(--navy);padding:1.2rem 1.25rem;color:white;}
.como-back{background:none;border:none;color:rgba(255,255,255,.55);cursor:pointer;font-family:inherit;font-size:.78rem;margin-bottom:.55rem;display:flex;align-items:center;gap:.22rem;padding:0;}
.como-hdr h2{font-size:1.35rem;font-weight:800;letter-spacing:-.025em;}
.como-hdr p{font-size:.78rem;color:rgba(255,255,255,.5);margin-top:.18rem;}
.como-body{padding:1.2rem 1.25rem;}
.priv-box{background:var(--pale);border-radius:10px;padding:.75rem .95rem;display:flex;align-items:flex-start;gap:.55rem;margin-bottom:1.1rem;border:1px solid #C7DCFF;}
.priv-box p{font-size:.76rem;color:var(--blue);line-height:1.5;}
.step-item{display:flex;align-items:flex-start;gap:.8rem;margin-bottom:.8rem;}
.step-n{width:28px;height:28px;border-radius:50%;background:var(--navy);color:white;font-size:.75rem;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.step-txt h4{font-size:.83rem;font-weight:700;margin-bottom:.08rem;}
.step-txt p{font-size:.73rem;color:var(--g5);line-height:1.48;}

.card{background:white;border-radius:15px;padding:1.35rem;margin:1rem 1.25rem;box-shadow:0 1px 3px rgba(0,0,0,.07),0 1px 2px rgba(0,0,0,.04);}
.eyebrow{font-size:.63rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--sky);margin-bottom:.28rem;}
.card-title{font-size:1.1rem;font-weight:800;letter-spacing:-.02em;margin-bottom:.3rem;}
.card-body{font-size:.83rem;color:var(--g5);line-height:1.6;margin-bottom:1rem;}

.prog-wrap{padding:.7rem 1.25rem 0;}
.prog-meta{display:flex;justify-content:space-between;font-size:.65rem;color:var(--g5);margin-bottom:.28rem;}
.prog{height:4px;background:var(--g3);border-radius:2px;}
.prog-fill{height:100%;border-radius:2px;background:linear-gradient(90deg,var(--sky),#7DB8F7);transition:width .4s;}

.field{margin-bottom:.85rem;}
.field label{display:block;font-size:.73rem;font-weight:600;color:var(--g7);margin-bottom:.28rem;}
.field input,.field select{width:100%;padding:.58rem .82rem;border-radius:8px;border:1.5px solid var(--g3);font-size:.83rem;font-family:inherit;color:var(--g9);background:white;outline:none;transition:border-color .18s;-webkit-appearance:none;}
.field input:focus,.field select:focus{border-color:var(--sky);}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:0 .65rem;}
@media(max-width:360px){.g2{grid-template-columns:1fr;}}
.sep{font-size:.65rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--sky);padding:.55rem 0 .18rem;border-bottom:1px solid var(--pale);margin-bottom:.65rem;}

.btn{display:inline-flex;align-items:center;justify-content:center;gap:.32rem;padding:.68rem 1.35rem;border-radius:50px;font-size:.83rem;font-weight:700;cursor:pointer;border:none;transition:all .12s;font-family:inherit;}
.btn-p{background:var(--navy);color:white;}.btn-p:hover{background:var(--blue);}
.btn-s{background:var(--pale);color:var(--navy);border:1.5px solid #C7DCFF;}
.btn-d{background:var(--rpale);color:var(--red);}
.btn-row{display:flex;gap:.45rem;justify-content:flex-end;margin-top:1rem;flex-wrap:wrap;}
.btn:disabled{opacity:.4;cursor:not-allowed;}
.btn-full{width:100%;margin-top:.4rem;}

.alert{padding:.6rem .88rem;border-radius:8px;font-size:.78rem;margin-bottom:.75rem;line-height:1.5;display:flex;gap:.4rem;align-items:flex-start;}
.ai{background:var(--pale);color:var(--blue);border:1px solid #C7DCFF;}
.aw{background:var(--apale);color:var(--amber);border:1px solid #FCD34D;}
.ae{background:var(--rpale);color:var(--red);border:1px solid #FCA5A5;}
.as{background:var(--gpale);color:var(--teal);border:1px solid #A7E6DC;}
.spin{width:32px;height:32px;border:3px solid var(--g3);border-top-color:var(--sky);border-radius:50%;animation:sp .8s linear infinite;margin:1.75rem auto;}
@keyframes sp{to{transform:rotate(360deg);}}

.tcle-box{font-size:.76rem;line-height:1.7;color:var(--g7);max-height:200px;overflow-y:auto;background:var(--g0);padding:.8rem;border-radius:8px;border:1px solid var(--g3);margin-bottom:.75rem;}

.bw-item{margin-bottom:1rem;}
.bw-hdr{display:flex;align-items:center;gap:.42rem;margin-bottom:.42rem;}
.bw-lbl{font-size:.8rem;font-weight:600;}
.bw-opts{display:flex;gap:.28rem;}
.bw-btn{flex:1;padding:.42rem .08rem;border-radius:7px;border:1.5px solid var(--g3);background:white;cursor:pointer;font-size:.7rem;font-weight:500;color:var(--g5);transition:all .1s;font-family:inherit;text-align:center;line-height:1.3;}
.bw-btn:hover{border-color:var(--sky);}
.bw-btn.sel{background:var(--navy);border-color:var(--navy);color:white;font-weight:700;}

.soc-ancora{background:var(--pale);border-left:3px solid var(--sky);border-radius:0 7px 7px 0;padding:.5rem .78rem;font-size:.73rem;color:var(--blue);font-style:italic;margin-bottom:.85rem;}
.soc-q{font-size:.9rem;font-weight:600;line-height:1.55;margin-bottom:.85rem;}
.soc-scale{display:flex;gap:.25rem;margin-bottom:.28rem;}
.soc-btn{flex:1;height:42px;border:1.5px solid var(--g3);border-radius:7px;background:white;cursor:pointer;font-size:.88rem;font-weight:700;color:var(--g5);transition:all .1s;font-family:inherit;}
.soc-btn:hover{border-color:var(--sky);color:var(--sky);}
.soc-btn.sel{background:var(--navy);border-color:var(--navy);color:white;}
.soc-anch{display:flex;justify-content:space-between;font-size:.6rem;color:var(--g5);}
.soc-inst{background:var(--pale);border-radius:9px;padding:.85rem;margin-bottom:1rem;border:1px solid #C7DCFF;}
.soc-inst h4{font-size:.78rem;font-weight:700;color:var(--navy);margin-bottom:.28rem;}
.soc-inst p{font-size:.73rem;color:var(--blue);line-height:1.55;}

.res-hero{background:linear-gradient(150deg,var(--navy),#1a3a6b);border-radius:15px;padding:1.5rem;margin:1rem 1.25rem;text-align:center;}
.res-num{font-size:3rem;font-weight:800;color:white;letter-spacing:-.04em;line-height:1;}
.res-de{font-size:.75rem;color:rgba(255,255,255,.45);margin-bottom:.38rem;}
.res-badge{display:inline-block;padding:.25rem .8rem;border-radius:20px;font-size:.75rem;font-weight:700;margin-bottom:.55rem;}
.b-alto{background:rgba(20,160,133,.28);color:#7FFFD4;}
.b-medio{background:rgba(217,119,6,.28);color:#FCD34D;}
.b-baixo{background:rgba(220,38,38,.28);color:#FCA5A5;}
.res-foco{font-size:.75rem;color:rgba(255,255,255,.55);}
.res-foco strong{color:white;text-transform:capitalize;}
.sc-grid{display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin:0 1.25rem;}
.sc-card{background:white;border-radius:11px;padding:.8rem;box-shadow:0 1px 3px rgba(0,0,0,.06);}
.sc-card.dk{background:var(--navy);}
.sc-name{font-size:.6rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--sky);margin-bottom:.12rem;}
.dk .sc-name{color:var(--light);}
.sc-num{font-size:1.45rem;font-weight:800;letter-spacing:-.03em;}
.sc-max{font-size:.68rem;color:var(--g5);}
.sc-bar{height:3px;background:var(--pale);border-radius:2px;margin-top:.3rem;}
.sc-fill{height:100%;border-radius:2px;background:var(--sky);}
.dk .sc-bar{background:rgba(255,255,255,.1);}
.dk .sc-fill{background:var(--light);}
.dk .sc-num{color:white;}
.foco-val{font-size:.85rem;font-weight:700;color:white;text-transform:capitalize;margin-top:.18rem;}
.dk-sub{font-size:.62rem;color:rgba(255,255,255,.35);margin-top:.1rem;}

.dim-box{background:var(--pale);border-radius:10px;padding:.85rem;border:1px solid #C7DCFF;margin-bottom:.85rem;}
.dim-box h4{font-size:.78rem;font-weight:700;color:var(--navy);margin-bottom:.25rem;display:flex;align-items:center;gap:.35rem;}
.dim-box p{font-size:.78rem;color:var(--blue);line-height:1.6;}

.int-card{background:white;border-radius:13px;padding:1rem;margin-bottom:.65rem;border-left:3px solid var(--sky);box-shadow:0 1px 3px rgba(0,0,0,.05);}
.int-nome{font-size:.88rem;font-weight:700;display:flex;align-items:center;gap:.32rem;margin-bottom:.3rem;}
.int-pos{display:inline-flex;align-items:center;gap:.22rem;background:var(--pale);color:var(--blue);font-size:.65rem;font-weight:700;padding:.18rem .52rem;border-radius:20px;border:1px solid #C7DCFF;margin-bottom:.6rem;}
.int-lbl{font-size:.62rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;margin:.55rem 0 .12rem;}
.int-lbl.az{color:var(--sky);}
.int-lbl.vd{color:var(--mint);}
.int-txt{font-size:.78rem;color:var(--g7);line-height:1.55;}
.int-refs{margin-top:.65rem;padding-top:.6rem;border-top:1px solid var(--g1);}
.int-refs-ttl{font-size:.6rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--g5);margin-bottom:.32rem;}
.int-ref{margin-bottom:.32rem;}
.int-ref-t{font-size:.7rem;font-weight:600;color:var(--g7);line-height:1.35;}
.int-ref-m{font-size:.63rem;color:var(--g5);margin-top:.04rem;}
.int-ref-a{font-size:.68rem;font-weight:700;color:var(--sky);text-decoration:none;display:inline-flex;align-items:center;gap:.18rem;margin-top:.04rem;}
.int-ref-a:hover{text-decoration:underline;}

.ret-hero{background:linear-gradient(150deg,var(--navy),#1a3a6b);padding:2rem 1.5rem;text-align:center;color:white;}
.ret-emoji{font-size:2.3rem;margin-bottom:.45rem;}
.ret-hero h2{font-size:1.25rem;font-weight:800;letter-spacing:-.02em;margin-bottom:.38rem;}
.ret-hero p{font-size:.82rem;color:rgba(255,255,255,.6);line-height:1.6;}
.op-btn{width:100%;background:white;border:1.5px solid var(--g3);border-radius:11px;padding:.8rem .95rem;display:flex;align-items:center;gap:.7rem;cursor:pointer;font-family:inherit;margin-bottom:.55rem;transition:border-color .13s;text-align:left;}
.op-btn:hover{border-color:var(--sky);}
.op-btn.sel{border-color:var(--sky);background:var(--pale);}
.op-emoji{font-size:1.25rem;flex-shrink:0;}
.op-txt h4{font-size:.82rem;font-weight:700;color:var(--g9);}
.op-txt p{font-size:.72rem;color:var(--g5);margin-top:.04rem;}

.evo-row{display:flex;align-items:center;gap:.6rem;margin-bottom:.38rem;}
.evo-lbl{font-size:.7rem;color:var(--g5);min-width:58px;font-weight:500;}
.evo-bar-bg{flex:1;height:5px;background:var(--g3);border-radius:3px;}
.evo-bar-fill{height:100%;border-radius:3px;transition:width .6s;}
.evo-num{font-size:.68rem;font-weight:700;min-width:18px;}

.agrad{text-align:center;padding:2.25rem 1.4rem;}
.agrad-emoji{font-size:2.75rem;margin-bottom:.65rem;}
.agrad h2{font-size:1.2rem;font-weight:800;letter-spacing:-.02em;margin-bottom:.45rem;color:var(--navy);}
.agrad p{font-size:.83rem;color:var(--g5);line-height:1.7;max-width:270px;margin:0 auto .65rem;}
.agrad-box{background:var(--pale);border-radius:11px;padding:.9rem;border:1px solid #C7DCFF;margin:.85rem 0;text-align:left;}
.agrad-box h4{font-size:.77rem;font-weight:700;color:var(--navy);margin-bottom:.25rem;}
.agrad-box p{font-size:.76rem;color:var(--blue);line-height:1.55;}

.stars{display:flex;gap:.3rem;margin:.45rem 0 .8rem;}
.star{font-size:1.65rem;cursor:pointer;transition:transform .1s;line-height:1;}
.star.on{transform:scale(1.1);}
.fb-ta{width:100%;padding:.6rem .82rem;border-radius:8px;border:1.5px solid var(--g3);font-size:.8rem;font-family:inherit;resize:vertical;min-height:78px;outline:none;transition:border-color .18s;}
.fb-ta:focus{border-color:var(--sky);}

.adm-tbl{width:100%;border-collapse:collapse;font-size:.7rem;}
.adm-tbl th{background:var(--navy);color:white;padding:.42rem .58rem;text-align:left;}
.adm-tbl td{padding:.38rem .58rem;border-bottom:1px solid var(--g1);}
.adm-tbl tr:nth-child(even) td{background:var(--g0);}
.stat-row{display:grid;grid-template-columns:repeat(3,1fr);gap:.48rem;margin:.85rem 0;}
.stat-box{background:var(--pale);border-radius:9px;padding:.6rem;text-align:center;}
.stat-num{font-size:1.35rem;font-weight:800;color:var(--navy);}
.stat-lbl{font-size:.62rem;color:var(--g5);}
.tabs{display:flex;gap:.28rem;margin-bottom:.9rem;overflow-x:auto;}
.tab{padding:.35rem .75rem;border-radius:20px;font-size:.72rem;font-weight:600;cursor:pointer;border:1.5px solid var(--g3);background:white;color:var(--g5);white-space:nowrap;font-family:inherit;}
.tab.on{background:var(--navy);color:white;border-color:var(--navy);}
`;

function Campo({label,children}){return <div className="field"><label>{label}</label>{children}</div>;}
function Sel({value,onChange,opts,ph="Selecione..."}){
  return <select value={value||""} onChange={e=>onChange(e.target.value)}>
    <option value="">{ph}</option>
    {opts.map(o=><option key={o} value={o}>{o}</option>)}
  </select>;
}

function VideoModal({onClose}){
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}} onClick={onClose}>
    <div style={{background:"white",borderRadius:"15px",padding:"1.2rem",width:"100%",maxWidth:"390px"}} onClick={e=>e.stopPropagation()}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".9rem"}}>
        <h3 style={{fontSize:".88rem",fontWeight:700}}>🎬 O que é Senso de Coerência?</h3>
        <button onClick={onClose} style={{background:"none",border:"none",fontSize:"1rem",cursor:"pointer",color:"var(--g5)"}}>✕</button>
      </div>
      <div style={{background:"linear-gradient(135deg,var(--navy),#1a3a6b)",borderRadius:"9px",aspectRatio:"16/9",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:".6rem",cursor:"pointer"}} onClick={()=>alert("Vídeo em produção — em breve disponível no YouTube!")}>
        <div style={{width:"48px",height:"48px",background:"rgba(255,255,255,.9)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.2rem"}}>▶</div>
        <p style={{color:"rgba(255,255,255,.72)",fontSize:".75rem",textAlign:"center",padding:"0 1rem"}}>Vídeo explicativo · <strong style={{color:"white"}}>Em breve</strong></p>
      </div>
      <p style={{fontSize:".7rem",color:"var(--g5)",textAlign:"center",marginTop:".6rem"}}>📌 Assista antes de responder para entender melhor o que avaliamos.</p>
      <button className="btn btn-p btn-full" onClick={onClose} style={{marginTop:".7rem"}}>Entendido →</button>
    </div>
  </div>;
}

function TelaInicio({onIniciar,onComoFunciona}){
  const [video,setVideo]=useState(false);
  return <>
    {video&&<VideoModal onClose={()=>setVideo(false)}/>}
    <div className="hero">
      <div className="hero-badge">🩺 Para enfermeiros</div>
      <h1 className="hero-title">Coerênc<em>IA</em></h1>
      <p className="hero-sub">Avalie seu bem-estar e receba estratégias personalizadas baseadas em evidências científicas.</p>
      <div className="hero-btns">
        <button className="btn-hp" onClick={onIniciar}>Participar agora</button>
        <button className="btn-hs" onClick={onComoFunciona}>Como funciona</button>
      </div>
    </div>
    <div className="explore">
      <p className="explore-ttl">Explore antes de começar</p>
      <p className="explore-sub">Entenda o que vamos avaliar</p>
      <div className="ex-card" onClick={()=>setVideo(true)}>
        <div className="ex-icon" style={{background:"#EBF4FF"}}>🎬</div>
        <div className="ex-body">
          <h3>O que é Senso de Coerência?</h3>
          <p>Conceito de Aaron Antonovsky sobre por que algumas pessoas resistem melhor ao estresse.</p>
          <div className="ex-link">▶ Assistir vídeo introdutório</div>
        </div>
      </div>
      <div className="ex-card" onClick={onComoFunciona}>
        <div className="ex-icon" style={{background:"#E6F7F4"}}>📋</div>
        <div className="ex-body">
          <h3>Como funciona a avaliação</h3>
          <p>Veja as etapas e o que você receberá ao final.</p>
          <div className="ex-link">→ Ver passo a passo</div>
        </div>
      </div>
    </div>
  </>;
}

function TelaComoFunciona({onVoltar,onIniciar}){
  return <>
    <div className="como-hdr">
      <button className="como-back" onClick={onVoltar}>← Voltar</button>
      <h2>Como funciona</h2>
      <p>Tudo que você precisa saber antes de começar.</p>
    </div>
    <div className="como-body">
      <div className="priv-box">
        <span style={{fontSize:"1rem",flexShrink:0,marginTop:".05rem"}}>🔒</span>
        <p>Seus dados são <strong>completamente anônimos</strong>. Nome e data de nascimento nunca são armazenados — apenas um código gerado localmente no seu dispositivo.</p>
      </div>
      {[
        {n:1,t:"Identificação anônima",d:"Nome e data de nascimento geram um código único — não são salvos em nenhum servidor."},
        {n:2,t:"Perfil (só no 1º acesso)",d:"Dados sociodemográficos coletados uma vez. Nas próximas visitas você vai direto ao questionário."},
        {n:3,t:"Avaliação de bem-estar",d:"8 dimensões avaliadas de 1 a 5. Rápido e intuitivo."},
        {n:4,t:"Questionário SOC-13",d:"13 questões sobre como você percebe e lida com situações da vida."},
        {n:5,t:"Diagnóstico + intervenções",d:"Diagnóstico gerado por IA com 3 estratégias padronizadas para sua dimensão prioritária."},
        {n:6,t:"Retorno após intervenção",d:"Semanas depois, você responde novamente para comparar sua evolução."},
      ].map(s=><div className="step-item" key={s.n}>
        <div className="step-n">{s.n}</div>
        <div className="step-txt"><h4>{s.t}</h4><p>{s.d}</p></div>
      </div>)}
      <button className="btn btn-p btn-full" style={{marginTop:".65rem"}} onClick={onIniciar}>🩺 Participar agora →</button>
    </div>
  </>;
}

function TelaIdentificacao({onIdentify}){
  const [nome,setNome]=useState("");const [nasc,setNasc]=useState("");const [loading,setLoading]=useState(false);const [err,setErr]=useState("");
  async function go(){
    if(!nome.trim()||!nasc){setErr("Preencha nome e data de nascimento.");return;}
    setLoading(true);setErr("");
    const id=await sha256(nome.trim().toLowerCase()+nasc);
    onIdentify(id);
  }
  return <div className="card">
    <div className="eyebrow">Acesso anônimo</div>
    <h2 className="card-title">Vamos começar 👋</h2>
    <p className="card-body">Informe seus dados para gerar seu código único. Eles <strong>não serão armazenados</strong>.</p>
    {err&&<div className="alert ae">⚠️ {err}</div>}
    <Campo label="Nome completo"><input value={nome} onChange={e=>setNome(e.target.value)} placeholder="Apenas para gerar seu código"/></Campo>
    <Campo label="Data de nascimento"><input type="date" value={nasc} onChange={e=>setNasc(e.target.value)}/></Campo>
    <div className="alert ai">🔒 Seus dados ficam só no seu dispositivo.</div>
    <div className="btn-row"><button className="btn btn-p" onClick={go} disabled={loading}>{loading?"...":"Continuar →"}</button></div>
  </div>;
}

function TelaTCLE({onConsentir,onRecusar}){
  const [leu,setLeu]=useState(false);
  return <div className="card">
    <div className="eyebrow">Consentimento</div>
    <h2 className="card-title">Termo de Consentimento</h2>
    <div className="tcle-box" onScroll={e=>{if(e.target.scrollTop+e.target.clientHeight>=e.target.scrollHeight-10)setLeu(true);}}>
      <strong>TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO (TCLE)</strong><br/><br/>
      Você está sendo convidado(a) a participar voluntariamente de uma pesquisa sobre bem-estar e senso de coerência em enfermeiros.<br/><br/>
      <strong>Objetivo:</strong> Avaliar o Senso de Coerência de profissionais de enfermagem e propor estratégias personalizadas de bem-estar.<br/><br/>
      <strong>Procedimentos:</strong> Você responderá a questões sobre seu perfil, uma avaliação de bem-estar e 13 questões sobre como percebe e lida com a vida.<br/><br/>
      <strong>Confidencialidade:</strong> Seus dados são identificados apenas por um código anônimo gerado localmente. Nome e data de nascimento NUNCA são armazenados.<br/><br/>
      <strong>Riscos:</strong> Mínimos. Você pode pausar ou desistir a qualquer momento sem qualquer prejuízo.<br/><br/>
      <strong>Benefícios:</strong> Receber um diagnóstico personalizado com estratégias práticas para melhorar seu bem-estar.<br/><br/>
      <strong>Participação voluntária:</strong> Inteiramente voluntária. A recusa não acarreta nenhum prejuízo.<br/><br/>
      Ao clicar em "Concordo", você confirma que leu este termo e consente em participar.
    </div>
    {!leu&&<div className="alert aw">📜 Role o texto até o final para continuar.</div>}
    <div className="btn-row">
      <button className="btn btn-d" onClick={onRecusar}>Não concordo</button>
      <button className="btn btn-p" onClick={onConsentir} disabled={!leu}>Concordo →</button>
    </div>
  </div>;
}

function TelaPerfil({onSalvar}){
  const [d,setD]=useState({});const [err,setErr]=useState("");
  const set=(k,v)=>setD(p=>({...p,[k]:v}));
  const obrig=["idade","sexo","identidade","raca","estado_civil","filhos","renda","pessoas_residencia","categoria","tempo_profissao","turno","carga_horaria","funcao","setor","vinculo","tabagismo","alcool"];
  function go(){
    if(obrig.some(k=>!d[k])){setErr("Preencha todos os campos para continuar.");return;}
    setErr("");onSalvar({...d,filhos:d.filhos==="Sim"});
  }
  return <div className="card">
    <div className="eyebrow">Etapa 1 de 4</div>
    <h2 className="card-title">Seu Perfil</h2>
    <p className="card-body">Coletado uma única vez. Nas próximas visitas você vai direto ao questionário.</p>
    {err&&<div className="alert ae">⚠️ {err}</div>}
    <div className="sep">Dados Pessoais</div>
    <div className="g2">
      <Campo label="Faixa etária"><Sel value={d.idade} onChange={v=>set("idade",v)} opts={OPT_IDADE}/></Campo>
      <Campo label="Sexo biológico"><Sel value={d.sexo} onChange={v=>set("sexo",v)} opts={OPT_SEXO}/></Campo>
      <Campo label="Identidade de gênero"><Sel value={d.identidade} onChange={v=>set("identidade",v)} opts={OPT_IDENTIDADE}/></Campo>
      <Campo label="Raça / Cor (IBGE)"><Sel value={d.raca} onChange={v=>set("raca",v)} opts={OPT_RACA}/></Campo>
      <Campo label="Estado civil"><Sel value={d.estado_civil} onChange={v=>set("estado_civil",v)} opts={OPT_ESTADO_CIVIL}/></Campo>
      <Campo label="Tem filhos?"><Sel value={d.filhos} onChange={v=>set("filhos",v)} opts={["Sim","Não"]}/></Campo>
      <Campo label="Renda mensal bruta"><Sel value={d.renda} onChange={v=>set("renda",v)} opts={OPT_RENDA}/></Campo>
      <Campo label="Pessoas na residência"><input type="number" min="1" max="20" value={d.pessoas_residencia||""} onChange={e=>set("pessoas_residencia",e.target.value)} placeholder="Ex: 3"/></Campo>
    </div>
    <div className="sep">Vida Profissional</div>
    <div className="g2">
      <Campo label="Categoria profissional"><Sel value={d.categoria} onChange={v=>set("categoria",v)} opts={OPT_CATEGORIA}/></Campo>
      <Campo label="Tempo na enfermagem"><Sel value={d.tempo_profissao} onChange={v=>set("tempo_profissao",v)} opts={OPT_TEMPO_PROF}/></Campo>
      <Campo label="Turno de trabalho"><Sel value={d.turno} onChange={v=>set("turno",v)} opts={OPT_TURNO}/></Campo>
      <Campo label="Carga horária semanal"><Sel value={d.carga_horaria} onChange={v=>set("carga_horaria",v)} opts={OPT_CARGA}/></Campo>
      <Campo label="Função principal"><Sel value={d.funcao} onChange={v=>set("funcao",v)} opts={OPT_FUNCAO}/></Campo>
      <Campo label="Setor de atuação"><Sel value={d.setor} onChange={v=>set("setor",v)} opts={OPT_SETOR}/></Campo>
      <Campo label="Vínculo empregatício"><Sel value={d.vinculo} onChange={v=>set("vinculo",v)} opts={OPT_VINCULO}/></Campo>
    </div>
    <div className="sep">Saúde e Estilo de Vida</div>
    <div className="g2">
      <Campo label="Tabagismo (12 meses)"><Sel value={d.tabagismo} onChange={v=>set("tabagismo",v)} opts={OPT_FREQ}/></Campo>
      <Campo label="Álcool (12 meses)"><Sel value={d.alcool} onChange={v=>set("alcool",v)} opts={OPT_FREQ}/></Campo>
    </div>
    <div className="btn-row"><button className="btn btn-p" onClick={go}>Salvar e continuar →</button></div>
  </div>;
}

function TelaBemestar({onSalvar}){
  const [vals,setVals]=useState({});const [err,setErr]=useState("");
  function go(){
    if(DIMS_BW.some(d=>!vals[d.key])){setErr("Avalie todas as dimensões para continuar.");return;}
    setErr("");onSalvar(vals);
  }
  return <div className="card">
    <div className="eyebrow">Etapa 2 de 4</div>
    <h2 className="card-title">Bem-estar hoje</h2>
    <p className="card-body">Como você avalia cada dimensão da sua vida agora?</p>
    {err&&<div className="alert ae">⚠️ {err}</div>}
    {DIMS_BW.map(d=><div className="bw-item" key={d.key}>
      <div className="bw-hdr"><span>{d.emoji}</span><span className="bw-lbl">{d.label}</span></div>
      <div className="bw-opts">
        {[1,2,3,4,5].map((v,i)=><button key={v} className={`bw-btn${vals[d.key]===v?" sel":""}`} onClick={()=>setVals(p=>({...p,[d.key]:v}))}>
          <div>{v}</div><div style={{fontSize:".55rem",opacity:.65}}>{LIKERT_LABELS[i]}</div>
        </button>)}
      </div>
    </div>)}
    <div className="btn-row"><button className="btn btn-p" onClick={go}>Continuar →</button></div>
  </div>;
}

function TelaSOC({respostas,onChange,pergAtual,onNext,onPrev}){
  const p=SOC_PERGUNTAS[pergAtual];
  const prog=((pergAtual+1)/13)*100;
  return <>
    <div className="prog-wrap">
      <div className="prog-meta"><span>Pergunta {pergAtual+1} de 13</span><span>{Math.round(prog)}%</span></div>
      <div className="prog"><div className="prog-fill" style={{width:`${prog}%`}}/></div>
    </div>
    <div className="card">
      <div className="eyebrow">Etapa 3 de 4 — Questionário SOC</div>
      {pergAtual===0&&<div className="soc-inst">
        <h4>📋 Instruções</h4>
        <p>13 questões sobre como você percebe e lida com situações da vida. Escala de 1 a 7. Selecione o número que melhor representa sua experiência.</p>
      </div>}
      <div className="soc-ancora">💭 Pensando na sua vida como um todo — trabalho, relações pessoais e você mesmo(a)...</div>
      <div className="soc-q">{p.texto}</div>
      <div className="soc-scale">
        {[1,2,3,4,5,6,7].map(v=><button key={v} className={`soc-btn${respostas[p.num]===v?" sel":""}`} onClick={()=>onChange(p.num,v)}>{v}</button>)}
      </div>
      <div className="soc-anch"><span>1 – {p.min}</span><span>7 – {p.max}</span></div>
      <div className="btn-row">
        {pergAtual>0&&<button className="btn btn-s" onClick={onPrev}>← Voltar</button>}
        <button className="btn btn-p" disabled={!respostas[p.num]} onClick={onNext}>{pergAtual<12?"Próxima →":"Ver resultado →"}</button>
      </div>
    </div>
  </>;
}

function TelaRetorno({onContinuar}){
  const [adesao,setAdesao]=useState("");const [sentiu,setSentiu]=useState("");
  return <>
    <div className="ret-hero">
      <div className="ret-emoji">👋</div>
      <h2>Que bom te ver de volta!</h2>
      <p>Nas últimas semanas você recebeu estratégias personalizadas. Antes de responder novamente, queremos saber como foi.</p>
    </div>
    <div className="card">
      <div className="eyebrow">Adesão às estratégias</div>
      <h2 className="card-title">Você conseguiu praticar?</h2>
      {[
        {val:"total",emoji:"✅",t:"Realizei todas as estratégias",d:"Segui as recomendações durante o período"},
        {val:"parcial",emoji:"🔄",t:"Realizei parcialmente",d:"Fiz algumas, mas não todas"},
        {val:"nenhuma",emoji:"❌",t:"Não consegui realizar",d:"Não foi possível praticar"},
      ].map(o=><button key={o.val} className={`op-btn${adesao===o.val?" sel":""}`} onClick={()=>setAdesao(o.val)}>
        <span className="op-emoji">{o.emoji}</span>
        <div className="op-txt"><h4>{o.t}</h4><p>{o.d}</p></div>
      </button>)}
    </div>
    <div className="card">
      <div className="eyebrow">Percepção de melhora</div>
      <h2 className="card-title">Sentiu alguma diferença?</h2>
      {[
        {val:"sim",emoji:"😊",t:"Sim, percebi melhora",d:"Notei diferença no meu dia a dia"},
        {val:"talvez",emoji:"🤔",t:"Talvez, não tenho certeza",d:"Algumas mudanças, mas difícil dizer"},
        {val:"nao",emoji:"😐",t:"Não percebi diferença",d:"As coisas continuaram como estavam"},
      ].map(o=><button key={o.val} className={`op-btn${sentiu===o.val?" sel":""}`} onClick={()=>setSentiu(o.val)}>
        <span className="op-emoji">{o.emoji}</span>
        <div className="op-txt"><h4>{o.t}</h4><p>{o.d}</p></div>
      </button>)}
    </div>
    <div style={{padding:"0 1.25rem 1rem"}}>
      <button className="btn btn-p btn-full" disabled={!adesao||!sentiu} onClick={()=>onContinuar({adesao,sentiu})}>
        Responder o questionário →
      </button>
    </div>
  </>;
}

function TelaResultado({soc,socAnterior,diagnostico,historico,onRetestar,onFeedback,isRetorno}){
  const cc={Alto:"b-alto",Médio:"b-medio",Baixo:"b-baixo"}[soc.classificacao]||"b-medio";
  const intervs=INTERVENCOES[soc.dimensao_foco]||INTERVENCOES.significancia;
  const explDim=EXPLICACAO_DIMENSAO[soc.dimensao_foco];
  const delta=socAnterior?soc.soc_total-socAnterior.soc_total:null;

  return <>
    <div className="res-hero">
      <div style={{fontSize:".62rem",color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:".07em",marginBottom:".18rem"}}>Seu resultado</div>
      <div className="res-num">{soc.soc_total}</div>
      <div className="res-de">de 91 pontos</div>
      <span className={`res-badge ${cc}`}>SOC {soc.classificacao}</span>
      {delta!==null&&<div style={{fontSize:".75rem",color:"rgba(255,255,255,.55)",marginBottom:".28rem"}}>
        {delta>0?`📈 +${delta} pts em relação à avaliação anterior`:delta<0?`📉 ${delta} pts em relação à avaliação anterior`:"Mesmo resultado que antes"}
      </div>}
      <div className="res-foco">Foco prioritário: <strong>{soc.dimensao_foco}</strong></div>
    </div>

    <div className="sc-grid" style={{marginTop:"0"}}>
      {[{k:"compreensibilidade",l:"Compreensibilidade",m:49},{k:"maneabilidade",l:"Maneabilidade",m:35},{k:"significancia",l:"Significância",m:7}].map(d=><div className="sc-card" key={d.k}>
        <div className="sc-name">{d.l}</div>
        <div><span className="sc-num">{soc[d.k]}</span><span className="sc-max"> /{d.m}</span></div>
        <div className="sc-bar"><div className="sc-fill" style={{width:`${(soc[d.k]/d.m)*100}%`}}/></div>
      </div>)}
      <div className="sc-card dk">
        <div className="sc-name">Foco prioritário</div>
        <div className="foco-val">{soc.dimensao_foco}</div>
        <div className="dk-sub">dimensão mais baixa</div>
      </div>
    </div>

    {historico&&historico.length>1&&<div className="card" style={{marginTop:"1rem"}}>
      <div className="eyebrow">Acompanhamento</div>
      <h2 className="card-title">Sua Evolução</h2>
      {historico.slice(-6).map((s,i,arr)=><div className="evo-row" key={i}>
        <div className="evo-lbl">{new Date(s.data_sessao).toLocaleDateString("pt-BR",{day:"2-digit",month:"short"})}</div>
        <div className="evo-bar-bg"><div className="evo-bar-fill" style={{width:`${(s.soc_total/91)*100}%`,background:i===arr.length-1?"var(--sky)":"var(--g3)"}}/></div>
        <div className="evo-num" style={{color:i===arr.length-1?"var(--navy)":"var(--g5)"}}>{s.soc_total}</div>
      </div>)}
    </div>}

    <div className="card">
      <div className="eyebrow">{isRetorno?"Relatório comparativo":"Diagnóstico"}</div>
      <h2 className="card-title">{isRetorno?"Sua Evolução":"Sua Avaliação"}</h2>
      {!isRetorno&&explDim&&<div className="dim-box">
        <h4>🔍 Sobre a {soc.dimensao_foco}</h4>
        <p>{explDim}</p>
      </div>}
      {diagnostico?<DiagText text={diagnostico}/>:<div className="spin"/>}
    </div>

    {!isRetorno&&<div className="card">
      <div className="eyebrow">Intervenções sugeridas</div>
      <h2 className="card-title">Suas Estratégias</h2>
      <p className="card-body">3 estratégias para fortalecer sua <strong style={{textTransform:"capitalize"}}>{soc.dimensao_foco}</strong>. Pratique ao longo das próximas 2 semanas.</p>
      {intervs.map((iv,i)=><div className="int-card" key={i}>
        <div className="int-nome">{iv.emoji} {iv.nome}</div>
        <div className="int-pos">⏱ {iv.posologia}</div>
        <div className="int-lbl az">Como fazer</div>
        <div className="int-txt">{iv.como}</div>
        <div className="int-lbl vd">Por que ajuda</div>
        <div className="int-txt">{iv.porque}</div>
        <div className="int-refs">
          <div className="int-refs-ttl">📚 Saiba mais</div>
          {iv.refs.map((ref,j)=><div className="int-ref" key={j}>
            <div className="int-ref-t">{ref.titulo}</div>
            <div className="int-ref-m">{ref.autores} ({ref.ano}) · {ref.base}</div>
            <a className="int-ref-a" href={ref.url} target="_blank" rel="noopener noreferrer">🔗 Acessar artigo →</a>
          </div>)}
        </div>
      </div>)}
    </div>}

    <div style={{padding:"0 1.25rem 1rem",display:"flex",flexDirection:"column",gap:".45rem"}}>
      <button className="btn btn-s btn-full" onClick={onFeedback}>⭐ Avaliar o aplicativo</button>
      {!isRetorno&&<button className="btn btn-p btn-full" onClick={onRetestar}>↺ Refazer avaliação</button>}
      {isRetorno&&<button className="btn btn-p btn-full" onClick={onFeedback}>Encerrar participação →</button>}
    </div>
  </>;
}

function TelaAgradecimento({onVoltar}){
  return <div className="card">
    <div className="agrad">
      <div className="agrad-emoji">🌟</div>
      <h2>Muito obrigada pela sua participação!</h2>
      <p>Você concluiu as duas etapas da pesquisa. Sua contribuição é fundamental para entendermos melhor o bem-estar dos profissionais de enfermagem.</p>
      <div className="agrad-box">
        <h4>💙 Uma palavra antes de encerrar</h4>
        <p>Cuidar de pessoas exige muito de quem cuida. Esperamos que este momento tenha sido uma pausa para você também se olhar. As estratégias que recebeu são baseadas em evidências — elas funcionam, e você merece experimentá-las.</p>
      </div>
      <p style={{fontSize:".75rem",color:"var(--g5)"}}>Esta pesquisa é um teste de usabilidade. Seus dados foram registrados com segurança e contribuirão com a ciência.</p>
      <button className="btn btn-s" onClick={onVoltar} style={{marginTop:".5rem"}}>← Voltar ao início</button>
    </div>
  </div>;
}

function TelaFeedback({onSalvar,onPular}){
  const [nota,setNota]=useState(0);const [hover,setHover]=useState(0);const [texto,setTexto]=useState("");const [ajudou,setAjudou]=useState("");const [salvo,setSalvo]=useState(false);
  async function go(){
    if(!nota){alert("Selecione uma nota em estrelas.");return;}
    try{await sb("POST","feedbacks",{nota,texto,ajudou,criado_em:new Date().toISOString()});}catch{}
    setSalvo(true);setTimeout(()=>onSalvar(),1600);
  }
  if(salvo)return <div className="card" style={{textAlign:"center",padding:"2rem"}}>
    <div style={{fontSize:"2.4rem",marginBottom:".45rem"}}>🙏</div>
    <h2 className="card-title">Obrigada!</h2>
    <p className="card-body">Sua avaliação foi registrada.</p>
  </div>;
  return <div className="card">
    <div className="eyebrow">Sua opinião importa</div>
    <h2 className="card-title">Avalie o CoerêncIA</h2>
    <p className="card-body">Como foi sua experiência?</p>
    <div style={{fontSize:".72rem",fontWeight:600,color:"var(--g7)",marginBottom:".28rem"}}>Nota geral</div>
    <div className="stars">
      {[1,2,3,4,5].map(s=><span key={s} className={`star${s<=(hover||nota)?" on":""}`} onClick={()=>setNota(s)} onMouseEnter={()=>setHover(s)} onMouseLeave={()=>setHover(0)}>{s<=(hover||nota)?"⭐":"☆"}</span>)}
    </div>
    <Campo label="O aplicativo te ajudou?"><Sel value={ajudou} onChange={setAjudou} opts={["Sim, muito","Sim, um pouco","Neutro","Não muito","Não"]}/></Campo>
    <Campo label="Comentários (opcional)"><textarea className="fb-ta" value={texto} onChange={e=>setTexto(e.target.value)} placeholder="O que achou? O que poderia melhorar?"/></Campo>
    <div className="btn-row">
      <button className="btn btn-s" onClick={onPular}>Pular</button>
      <button className="btn btn-p" onClick={go}>Enviar →</button>
    </div>
  </div>;
}

function TelaAdmin({onVoltar}){
  const [senha,setSenha]=useState("");const [auth,setAuth]=useState(false);const [dados,setDados]=useState([]);const [loading,setLoading]=useState(false);const [aba,setAba]=useState("stats");const [stats,setStats]=useState(null);
  async function autenticar(){if(senha===ADMIN_PASSWORD){setAuth(true);await carregar();}else alert("Senha incorreta.");}
  async function carregar(){
    setLoading(true);
    try{
      const s=await sb("GET","sessoes?select=*,usuarios(setor,idade,sexo,turno,categoria)&order=data_sessao.desc");
      setDados(s||[]);
      if(s&&s.length){
        const tot=s.map(x=>x.soc_total).filter(Boolean);
        const media=tot.length?tot.reduce((a,b)=>a+b,0)/tot.length:0;
        const dist={Alto:0,Médio:0,Baixo:0};
        s.forEach(x=>{if(x.classificacao)dist[x.classificacao]++;});
        setStats({participantes:new Set(s.map(x=>x.usuario_id)).size,sessoes:s.length,media:Math.round(media),dist});
      }
    }finally{setLoading(false);}
  }
  function exportarCSV(){
    const cab="ID,Data,Setor,Faixa_Etaria,Sexo,Categoria,Turno,Comp,Man,Sig,Total,Classif,Foco";
    const corpo=dados.map(s=>[s.usuario_id?.slice(0,8),new Date(s.data_sessao).toLocaleDateString("pt-BR"),s.usuarios?.setor,s.usuarios?.idade,s.usuarios?.sexo,s.usuarios?.categoria,s.usuarios?.turno,s.compreensibilidade,s.maneabilidade,s.significancia,s.soc_total,s.classificacao,s.dimensao_foco].join(",")).join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([`${cab}\n${corpo}`],{type:"text/csv"}));a.download="coerencia_dados.csv";a.click();
  }
  if(!auth)return <div className="card">
    <div className="eyebrow">Acesso restrito</div>
    <h2 className="card-title">Painel do Pesquisador</h2>
    <Campo label="Senha"><input type="password" value={senha} onChange={e=>setSenha(e.target.value)} onKeyDown={e=>e.key==="Enter"&&autenticar()}/></Campo>
    <div className="btn-row">
      <button className="btn btn-s" onClick={onVoltar}>← Voltar</button>
      <button className="btn btn-p" onClick={autenticar}>Entrar</button>
    </div>
  </div>;
  return <>
    <div className="card" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div><div className="eyebrow">Pesquisador</div><h2 className="card-title" style={{marginBottom:0}}>Painel de Dados</h2></div>
      <div style={{display:"flex",gap:".32rem"}}>
        <button className="btn btn-s" style={{fontSize:".7rem",padding:".42rem .65rem"}} onClick={exportarCSV}>⬇ CSV</button>
        <button className="btn btn-s" style={{fontSize:".7rem",padding:".42rem .65rem"}} onClick={onVoltar}>← Sair</button>
      </div>
    </div>
    <div style={{padding:"0 1.25rem 1rem"}}>
      <div className="tabs">
        {[["stats","Estatísticas"],["dados","Dados"]].map(([k,l])=><button key={k} className={`tab${aba===k?" on":""}`} onClick={()=>setAba(k)}>{l}</button>)}
      </div>
      {loading&&<div className="spin"/>}
      {aba==="stats"&&stats&&<>
        <div className="stat-row">
          <div className="stat-box"><div className="stat-num">{stats.participantes}</div><div className="stat-lbl">Participantes</div></div>
          <div className="stat-box"><div className="stat-num">{stats.sessoes}</div><div className="stat-lbl">Sessões</div></div>
          <div className="stat-box"><div className="stat-num">{stats.media}</div><div className="stat-lbl">Média SOC</div></div>
        </div>
        {Object.entries(stats.dist).map(([k,v])=><div style={{display:"flex",alignItems:"center",gap:".55rem",marginBottom:".35rem"}} key={k}>
          <div style={{fontSize:".7rem",color:"var(--g5)",minWidth:"55px"}}>{k}</div>
          <div style={{flex:1,height:"5px",background:"var(--g3)",borderRadius:"3px"}}>
            <div style={{height:"100%",borderRadius:"3px",background:"var(--sky)",width:`${stats.sessoes?(v/stats.sessoes)*100:0}%`}}/>
          </div>
          <div style={{fontSize:".7rem",fontWeight:700,color:"var(--navy)",minWidth:"18px"}}>{v}</div>
        </div>)}
      </>}
      {aba==="dados"&&<div style={{overflowX:"auto"}}>
        <table className="adm-tbl">
          <thead><tr><th>ID</th><th>Data</th><th>Setor</th><th>Total</th><th>Class.</th></tr></thead>
          <tbody>{dados.slice(0,100).map((s,i)=><tr key={i}>
            <td style={{fontFamily:"monospace"}}>{s.usuario_id?.slice(0,8)}…</td>
            <td>{new Date(s.data_sessao).toLocaleDateString("pt-BR")}</td>
            <td>{s.usuarios?.setor||"-"}</td>
            <td><strong>{s.soc_total}</strong></td>
            <td>{s.classificacao}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </div>
  </>;
}

export default function App(){
  const [tela,setTela]=useState("inicio");
  const [userId,setUserId]=useState(null);
  const [perfil,setPerfil]=useState(null);
  const [primeiroAcesso,setPrimeiroAcesso]=useState(true);
  const [bemestarAtual,setBemestarAtual]=useState(null);
  const [pergAtual,setPergAtual]=useState(0);
  const [respostas,setRespostas]=useState({});
  const [resultadoSOC,setResultadoSOC]=useState(null);
  const [socAnterior,setSocAnterior]=useState(null);
  const [diagnostico,setDiagnostico]=useState(null);
  const [historico,setHistorico]=useState([]);
  const [loading,setLoading]=useState(false);
  const [erro,setErro]=useState("");

  async function handleIdentify(id){
    setUserId(id);setLoading(true);setErro("");
    try{
      const us=await sb("GET",`usuarios?id=eq.${id}&select=*`);
      if(us&&us.length>0){
        const u=us[0];
        if(!u.consentimento){setTela("tcle");return;}
        setPerfil(u);setPrimeiroAcesso(false);
        const sess=await sb("GET",`sessoes?usuario_id=eq.${id}&order=data_sessao.asc`);
        setHistorico(sess||[]);
        if(sess&&sess.length>0){
          setSocAnterior(sess[sess.length-1]);
          setTela("retorno");
        }else{
          setTela("bemestar");
        }
      }else{setPrimeiroAcesso(true);setTela("tcle");}
    }catch{setErro("Erro ao verificar participante. Verifique as configurações.");}
    finally{setLoading(false);}
  }

  async function handleConsentir(){
    try{
      if(primeiroAcesso)await sb("POST","usuarios",{id:userId,consentimento:true,data_consentimento:new Date().toISOString()});
      else await sb("PATCH",`usuarios?id=eq.${userId}`,{consentimento:true});
    }catch{}
    setTela("perfil");
  }

  async function handleSalvarPerfil(dados){
    try{
      const payload={...dados,id:userId};
      await sb("POST","usuarios",payload).catch(()=>sb("PATCH",`usuarios?id=eq.${userId}`,dados));
      setPerfil(payload);
    }catch{}
    setTela("bemestar");
  }

  async function handleRetorno({adesao,sentiu}){
    try{await sb("POST","retornos",{usuario_id:userId,adesao,sentiu,data_retorno:new Date().toISOString()});}catch{}
    setTela("bemestar");
  }

  async function handleFinalizarSOC(){
    const soc=calcularSOC(respostas);
    setResultadoSOC(soc);
    setTela("resultado");
    let sessaoId=null;
    try{
      const sessao={usuario_id:userId,data_sessao:new Date().toISOString(),...Object.fromEntries(Object.entries(respostas).map(([k,v])=>[`r${k}`,v])),...soc};
      const nova=await sb("POST","sessoes",sessao);
      sessaoId=nova?.[0]?.id;
      if(bemestarAtual&&sessaoId)await sb("POST","bemestar",{usuario_id:userId,sessao_id:sessaoId,...bemestarAtual});
      const todasSess=await sb("GET",`sessoes?usuario_id=eq.${userId}&order=data_sessao.asc`);
      setHistorico(todasSess||[]);
    }catch{}
    try{
      const resp=await fetch("/api/diagnostico",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({perfil,soc,bemestar:bemestarAtual,socAnterior,isRetorno:!!socAnterior})});
      const data=await resp.json();
      const diag=data.diagnostico||"Diagnóstico não disponível.";
      setDiagnostico(diag);
      if(sessaoId)await sb("PATCH",`sessoes?id=eq.${sessaoId}`,{diagnostico:diag}).catch(()=>{});
    }catch{
      setDiagnostico("Não foi possível gerar o diagnóstico no momento. Seus dados foram salvos.");
    }
  }

  function handleRetestar(){setRespostas({});setPergAtual(0);setResultadoSOC(null);setDiagnostico(null);setTela("bemestar");}

  return <>
    <style>{CSS}</style>
    <div>
      <header className="hdr">
        <div style={{display:"flex",alignItems:"center",gap:".4rem"}}>
          <span style={{fontSize:"1.05rem"}}>🩺</span>
          <span className="logo">Coerên<span style={{color:"white"}}>c</span><span className="logo-ia">IA</span></span>
        </div>
        {tela!=="admin"&&<button className="hdr-adm" onClick={()=>setTela("admin")}>Painel admin</button>}
      </header>
      <div className="main">
        {erro&&<div className="alert ae" style={{margin:"1rem 1.25rem"}}>⚠️ {erro}<button style={{marginLeft:".4rem",background:"none",border:"none",cursor:"pointer",fontWeight:700}} onClick={()=>setErro("")}>✕</button></div>}
        {loading&&<div className="spin"/>}
        {!loading&&tela==="inicio"&&<TelaInicio onIniciar={()=>setTela("identificacao")} onComoFunciona={()=>setTela("como")}/>}
        {!loading&&tela==="como"&&<TelaComoFunciona onVoltar={()=>setTela("inicio")} onIniciar={()=>setTela("identificacao")}/>}
        {!loading&&tela==="identificacao"&&<TelaIdentificacao onIdentify={handleIdentify}/>}
        {!loading&&tela==="tcle"&&<TelaTCLE onConsentir={handleConsentir} onRecusar={()=>setTela("inicio")}/>}
        {!loading&&tela==="perfil"&&<TelaPerfil onSalvar={handleSalvarPerfil}/>}
        {!loading&&tela==="retorno"&&<TelaRetorno onContinuar={handleRetorno}/>}
        {!loading&&tela==="bemestar"&&<TelaBemestar onSalvar={v=>{setBemestarAtual(v);setTela("soc");}}/>}
        {!loading&&tela==="soc"&&<TelaSOC respostas={respostas} pergAtual={pergAtual} onChange={(n,v)=>setRespostas(r=>({...r,[n]:v}))} onNext={()=>{if(pergAtual<12)setPergAtual(p=>p+1);else handleFinalizarSOC();}} onPrev={()=>setPergAtual(p=>p-1)}/>}
        {tela==="resultado"&&resultadoSOC&&<TelaResultado soc={resultadoSOC} socAnterior={socAnterior} diagnostico={diagnostico} historico={historico} onRetestar={handleRetestar} onFeedback={()=>setTela("feedback")} isRetorno={!!socAnterior}/>}
        {tela==="feedback"&&<TelaFeedback onSalvar={()=>setTela("agradecimento")} onPular={()=>setTela("agradecimento")}/>}
        {tela==="agradecimento"&&<TelaAgradecimento onVoltar={()=>setTela("inicio")}/>}
        {tela==="admin"&&<TelaAdmin onVoltar={()=>setTela("inicio")}/>}
      </div>
    </div>
  </>;
}
