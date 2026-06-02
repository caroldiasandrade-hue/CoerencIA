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
  const props = {compreensibilidade:comp/49,maneabilidade:man/35,significancia:sig/7};
  const foco = Object.entries(props).sort((a,b)=>a[1]-b[1])[0][0];
  const classif = (total/91)>=0.67?"Alto":(total/91)>=0.34?"Médio":"Baixo";
  return {compreensibilidade:comp,maneabilidade:man,significancia:sig,soc_total:total,classificacao:classif,dimensao_foco:foco};
}

// Referências científicas por dimensão
const REFERENCIAS = {
  compreensibilidade: [
    { titulo: "Sense of coherence and psychological well-being: A systematic review", autores: "Eriksson & Lindström", ano: 2006, base: "PubMed/MEDLINE", url: "https://pubmed.ncbi.nlm.nih.gov/16849436/" },
    { titulo: "The validity of Antonovsky's sense of coherence measure in a cross-cultural study", autores: "Lundberg & Nyström Peck", ano: 1994, base: "Web of Science", url: "https://www.webofscience.com/wos/woscc/full-record/WOS:A1994NR03900006" },
    { titulo: "Salutogenesis and sense of coherence: significance for mental health promotion", autores: "Lindström & Eriksson", ano: 2005, base: "Scopus", url: "https://www.scopus.com/record/display.uri?eid=2-s2.0-22944476963" },
  ],
  maneabilidade: [
    { titulo: "Sense of coherence and social support: a randomized controlled trial", autores: "Vastamäki et al.", ano: 2011, base: "PubMed/MEDLINE", url: "https://pubmed.ncbi.nlm.nih.gov/21491233/" },
    { titulo: "Coping, sense of coherence and the meaning of religious practices", autores: "Pargament et al.", ano: 1992, base: "EMBASE", url: "https://www.embase.com/search/results?query=sense+of+coherence+coping" },
    { titulo: "Sense of coherence as a mediator between social support and mental health", autores: "Feldt et al.", ano: 2000, base: "Scopus", url: "https://www.scopus.com/record/display.uri?eid=2-s2.0-0033755062" },
  ],
  significancia: [
    { titulo: "Meaningfulness as a mediator of sense of coherence and well-being", autores: "Braun-Lewensohn & Sagy", ano: 2010, base: "Web of Science", url: "https://www.webofscience.com/wos/woscc/full-record/WOS:000279876800005" },
    { titulo: "Sense of coherence and purpose in life as predictors of psychological well-being", autores: "Zika & Chamberlain", ano: 1992, base: "PubMed/MEDLINE", url: "https://pubmed.ncbi.nlm.nih.gov/1593658/" },
    { titulo: "The relationship between sense of coherence and quality of life", autores: "Eriksson & Lindström", ano: 2007, base: "CINAHL", url: "https://www.ebsco.com/products/research-databases/cinahl" },
  ],
};

const INTERVENCOES = {
  compreensibilidade: [
    { nome: "Diário de sentido", como: "Reserve 10 minutos ao final do dia para registrar 3 situações que fizeram sentido para você — mesmo que pequenas. Use um caderno físico ou aplicativo de notas.", porque: "Treina o cérebro a perceber padrões e previsibilidade na vida cotidiana, fortalecendo a sensação de que o mundo é compreensível.", refs: REFERENCIAS.compreensibilidade.slice(0,2) },
    { nome: "Conversa de 5 minutos", como: "Escolha uma pessoa de confiança e, uma vez por semana, converse por 5 minutos sobre como está se sentindo. Sem julgamentos.", porque: "O suporte social fortalece diretamente a capacidade de dar sentido às experiências e reduz a sensação de caos.", refs: REFERENCIAS.compreensibilidade.slice(1,3) },
    { nome: "Pausa consciente", como: "Quando sentir sobrecarga, pare por 2 minutos, respire fundo 3 vezes e se pergunte: 'O que eu entendo sobre essa situação?'", porque: "Interrompe o ciclo de confusão cognitiva e ativa a capacidade reflexiva de dar sentido ao que acontece.", refs: REFERENCIAS.compreensibilidade },
  ],
  maneabilidade: [
    { nome: "Lista de recursos", como: "Escreva 5 recursos que você tem disponíveis: pessoas, habilidades, experiências ou ferramentas. Revise essa lista quando sentir que não tem controle.", porque: "Reconhecer os próprios recursos fortalece a sensação de maneabilidade — a crença de que você tem o que precisa para lidar com os desafios.", refs: REFERENCIAS.maneabilidade.slice(0,2) },
    { nome: "Atividade física regular", como: "Faça 30 minutos de caminhada, 3 vezes por semana. Não precisa ser intensa — o ritmo constante já é suficiente.", porque: "Exercício físico regular está associado ao aumento da sensação de controle sobre o próprio corpo e vida.", refs: REFERENCIAS.maneabilidade.slice(1,3) },
    { nome: "Celebração de pequenas vitórias", como: "Ao final de cada semana, identifique 1 desafio que você enfrentou e como o superou. Reconheça isso como evidência da sua capacidade.", porque: "Fortalecer a memória de superação aumenta a crença na própria capacidade de lidar com situações futuras.", refs: REFERENCIAS.maneabilidade },
  ],
  significancia: [
    { nome: "Conexão com o propósito", como: "Escreva uma frase que responda: 'Por que o que faço importa?' Leia essa frase ao iniciar o dia de trabalho.", porque: "Reconectar-se com o propósito fortalece a dimensão de significância — o motor emocional do senso de coerência.", refs: REFERENCIAS.significancia.slice(0,2) },
    { nome: "Ato de gratidão", como: "Antes de dormir, identifique 1 coisa pela qual você é grato hoje. Pode ser algo simples — um café, uma conversa, um momento de silêncio.", porque: "Práticas de gratidão estão associadas ao aumento da percepção de significado na vida cotidiana.", refs: REFERENCIAS.significancia.slice(1,3) },
    { nome: "Conexão com algo maior", como: "Dedique 15 minutos semanais a uma atividade que te conecte com algo além do trabalho: natureza, espiritualidade, arte ou voluntariado.", porque: "A sensação de pertencer a algo maior do que si mesmo é um dos pilares da significância e do bem-estar duradouro.", refs: REFERENCIAS.significancia },
  ],
};

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
  {key:"alimentacao",label:"Alimentação",emoji:"🥗"},
  {key:"sono",label:"Sono e repouso",emoji:"😴"},
  {key:"saude_mental",label:"Saúde mental",emoji:"🧠"},
  {key:"convivio_familiar",label:"Convívio familiar",emoji:"👨‍👩‍👧"},
  {key:"rede_apoio",label:"Rede de apoio",emoji:"🤝"},
  {key:"lazer",label:"Lazer",emoji:"🎯"},
  {key:"atividade_fisica",label:"Atividade física",emoji:"🏃"},
  {key:"satisfacao_vida",label:"Satisfação com a vida",emoji:"✨"},
];
const LIKERT_BW = ["1","2","3","4","5"];
const LIKERT_LABELS = ["Muito ruim","Ruim","Regular","Boa","Muito boa"];

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --navy:#0B2545;--blue:#1B4F8C;--sky:#2979D0;--light:#5BA4F5;--pale:#EBF4FF;--white:#FFFFFF;
  --teal:#0D7377;--mint:#14A085;--green-pale:#E6F7F4;
  --amber:#D97706;--amber-pale:#FEF3C7;
  --red:#DC2626;--red-pale:#FEE2E2;
  --gray-900:#111827;--gray-700:#374151;--gray-500:#6B7280;--gray-300:#D1D5DB;--gray-100:#F3F4F6;--gray-50:#F9FAFB;
  --radius-sm:8px;--radius:12px;--radius-lg:20px;--radius-xl:28px;
  --shadow:0 1px 3px rgba(0,0,0,.1),0 1px 2px rgba(0,0,0,.06);
  --shadow-md:0 4px 6px rgba(0,0,0,.07),0 2px 4px rgba(0,0,0,.06);
  --shadow-lg:0 10px 15px rgba(0,0,0,.1),0 4px 6px rgba(0,0,0,.05);
}
html{-webkit-text-size-adjust:100%;}
body{font-family:'Plus Jakarta Sans',sans-serif;background:var(--gray-50);color:var(--gray-900);min-height:100vh;-webkit-font-smoothing:antialiased;}

/* HEADER */
.hdr{background:var(--navy);padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;}
.hdr-brand{display:flex;align-items:center;gap:.6rem;}
.hdr-icon{font-size:1.4rem;}
.hdr-name{font-size:1rem;font-weight:800;color:white;letter-spacing:-.02em;}
.hdr-name span{color:var(--light);}
.hdr-btn{font-size:.72rem;padding:.35rem .75rem;border-radius:20px;border:1px solid rgba(255,255,255,.2);background:transparent;color:rgba(255,255,255,.6);cursor:pointer;font-family:inherit;transition:all .2s;}
.hdr-btn:hover{background:rgba(255,255,255,.1);color:white;}

/* HERO */
.hero{background:linear-gradient(135deg,var(--navy) 0%,var(--blue) 100%);padding:3rem 1.5rem 2rem;text-align:center;position:relative;overflow:hidden;}
.hero::before{content:'';position:absolute;top:-60px;right:-60px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,.04);}
.hero::after{content:'';position:absolute;bottom:-40px;left:-40px;width:150px;height:150px;border-radius:50%;background:rgba(255,255,255,.03);}
.hero-badge{display:inline-block;background:rgba(255,255,255,.12);color:rgba(255,255,255,.9);font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:.35rem .9rem;border-radius:20px;margin-bottom:1rem;}
.hero-title{font-size:2.2rem;font-weight:800;color:white;line-height:1.15;letter-spacing:-.03em;margin-bottom:.75rem;}
.hero-title span{color:var(--light);}
.hero-sub{font-size:.95rem;color:rgba(255,255,255,.7);line-height:1.6;max-width:320px;margin:0 auto 2rem;}
.hero-btns{display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap;}
.btn-hero-p{background:white;color:var(--navy);font-size:.9rem;font-weight:700;padding:.8rem 1.6rem;border-radius:var(--radius-xl);border:none;cursor:pointer;font-family:inherit;transition:all .2s;display:flex;align-items:center;gap:.4rem;}
.btn-hero-p:hover{transform:translateY(-1px);box-shadow:var(--shadow-lg);}
.btn-hero-s{background:transparent;color:white;font-size:.9rem;font-weight:600;padding:.8rem 1.6rem;border-radius:var(--radius-xl);border:2px solid rgba(255,255,255,.3);cursor:pointer;font-family:inherit;transition:all .2s;}
.btn-hero-s:hover{background:rgba(255,255,255,.1);}

/* COMO FUNCIONA */
.como{padding:2rem 1.25rem;}
.como-title{font-size:1.5rem;font-weight:800;letter-spacing:-.02em;margin-bottom:.25rem;}
.como-sub{font-size:.88rem;color:var(--gray-500);margin-bottom:1.5rem;}
.como-steps{display:flex;flex-direction:column;gap:.75rem;}
.step-card{background:white;border-radius:var(--radius);padding:1rem 1.1rem;display:flex;align-items:flex-start;gap:.9rem;box-shadow:var(--shadow);}
.step-num{width:32px;height:32px;border-radius:50%;background:var(--navy);color:white;font-size:.85rem;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;}
.step-text h4{font-size:.88rem;font-weight:700;margin-bottom:.2rem;}
.step-text p{font-size:.8rem;color:var(--gray-500);line-height:1.5;}

/* CARDS DE SEÇÃO */
.section-cards{padding:0 1.25rem 2rem;}
.sec-card{background:white;border-radius:var(--radius-lg);padding:1.25rem;margin-bottom:.75rem;box-shadow:var(--shadow);display:flex;align-items:flex-start;gap:1rem;cursor:pointer;transition:all .2s;border:2px solid transparent;}
.sec-card:hover{border-color:var(--pale);box-shadow:var(--shadow-md);}
.sec-card-icon{width:48px;height:48px;border-radius:var(--radius);display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0;}
.sec-card-body h3{font-size:.95rem;font-weight:700;margin-bottom:.2rem;}
.sec-card-body p{font-size:.8rem;color:var(--gray-500);line-height:1.5;margin-bottom:.4rem;}
.sec-card-link{font-size:.78rem;font-weight:600;color:var(--sky);display:flex;align-items:center;gap:.25rem;}

/* MAIN CONTAINER */
.main{max-width:480px;margin:0 auto;padding-bottom:2rem;}

/* CARDS GENÉRICOS */
.card{background:white;border-radius:var(--radius-lg);padding:1.5rem;margin:1rem 1.25rem;box-shadow:var(--shadow);}
.card-eyebrow{font-size:.68rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--sky);margin-bottom:.4rem;}
.card-title{font-size:1.2rem;font-weight:800;letter-spacing:-.02em;margin-bottom:.4rem;}
.card-body{font-size:.88rem;color:var(--gray-500);line-height:1.65;margin-bottom:1.25rem;}

/* PROGRESS */
.prog-wrap{padding:0 1.25rem;margin-bottom:-.25rem;}
.prog-label{font-size:.7rem;color:var(--gray-500);display:flex;justify-content:space-between;margin-bottom:.3rem;}
.prog{height:4px;background:var(--gray-200);border-radius:2px;}
.prog-fill{height:100%;border-radius:2px;background:linear-gradient(90deg,var(--sky),var(--light));transition:width .4s ease;}

/* CAMPOS */
.field{margin-bottom:1rem;}
.field label{display:block;font-size:.78rem;font-weight:600;color:var(--gray-700);margin-bottom:.35rem;}
.field input,.field select{width:100%;padding:.65rem .9rem;border-radius:var(--radius-sm);border:1.5px solid var(--gray-300);font-size:.88rem;font-family:inherit;color:var(--gray-900);background:white;outline:none;transition:border-color .2s,box-shadow .2s;-webkit-appearance:none;}
.field input:focus,.field select:focus{border-color:var(--sky);box-shadow:0 0 0 3px rgba(41,121,208,.1);}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:0 .75rem;}
@media(max-width:380px){.grid2{grid-template-columns:1fr;}}
.section-sep{font-size:.7rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--sky);padding:.75rem 0 .25rem;border-bottom:1px solid var(--pale);margin-bottom:.75rem;}

/* BOTÕES */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;padding:.75rem 1.5rem;border-radius:var(--radius-xl);font-size:.88rem;font-weight:700;cursor:pointer;border:none;transition:all .2s;font-family:inherit;letter-spacing:-.01em;}
.btn-p{background:var(--navy);color:white;}.btn-p:hover{background:var(--blue);}
.btn-s{background:var(--pale);color:var(--navy);border:1.5px solid #C7DCFF;}.btn-s:hover{background:#D9EAFF;}
.btn-d{background:var(--red-pale);color:var(--red);}
.btn-row{display:flex;gap:.6rem;justify-content:flex-end;margin-top:1.25rem;flex-wrap:wrap;}
.btn:disabled{opacity:.5;cursor:not-allowed;}

/* ALERTAS */
.alert{padding:.7rem 1rem;border-radius:var(--radius-sm);font-size:.82rem;margin-bottom:.9rem;line-height:1.5;display:flex;gap:.5rem;align-items:flex-start;}
.ai{background:var(--pale);color:var(--blue);border:1px solid #C7DCFF;}
.as{background:var(--green-pale);color:var(--teal);border:1px solid #A7E6DC;}
.aw{background:var(--amber-pale);color:var(--amber);border:1px solid #FCD34D;}
.ae{background:var(--red-pale);color:var(--red);border:1px solid #FCA5A5;}

/* SPIN */
.spin{width:36px;height:36px;border:3px solid var(--gray-200);border-top-color:var(--sky);border-radius:50%;animation:sp .8s linear infinite;margin:2rem auto;}
@keyframes sp{to{transform:rotate(360deg);}}

/* TCLE */
.tcle-box{font-size:.8rem;line-height:1.75;color:var(--gray-700);max-height:220px;overflow-y:auto;background:var(--gray-50);padding:.9rem;border-radius:var(--radius-sm);border:1px solid var(--gray-300);margin-bottom:.9rem;}

/* LIKERT BEM-ESTAR */
.bw-item{margin-bottom:1.25rem;}
.bw-header{display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem;}
.bw-emoji{font-size:1.1rem;}
.bw-label{font-size:.85rem;font-weight:600;}
.bw-opts{display:flex;gap:.35rem;}
.bw-btn{flex:1;padding:.55rem .1rem;border-radius:var(--radius-sm);border:1.5px solid var(--gray-300);background:white;cursor:pointer;font-size:.78rem;font-weight:500;color:var(--gray-500);transition:all .15s;font-family:inherit;text-align:center;line-height:1.3;}
.bw-btn:hover{border-color:var(--sky);color:var(--sky);}
.bw-btn.sel{background:var(--navy);border-color:var(--navy);color:white;font-weight:700;}
.bw-scale-labels{display:flex;justify-content:space-between;font-size:.65rem;color:var(--gray-400);margin-top:.25rem;}

/* SOC */
.soc-ancora{background:var(--pale);border-left:3px solid var(--sky);border-radius:0 var(--radius-sm) var(--radius-sm) 0;padding:.6rem .85rem;font-size:.78rem;color:var(--blue);font-style:italic;margin-bottom:1rem;}
.soc-pergunta{font-size:.95rem;font-weight:600;line-height:1.55;color:var(--gray-900);margin-bottom:1rem;}
.soc-scale{display:flex;gap:.3rem;margin-bottom:.3rem;}
.soc-btn{flex:1;height:46px;border:1.5px solid var(--gray-300);border-radius:var(--radius-sm);background:white;cursor:pointer;font-size:.95rem;font-weight:700;color:var(--gray-500);transition:all .15s;font-family:inherit;}
.soc-btn:hover{border-color:var(--sky);color:var(--sky);}
.soc-btn.sel{background:var(--navy);border-color:var(--navy);color:white;}
.soc-anchors{display:flex;justify-content:space-between;font-size:.65rem;color:var(--gray-400);}
.soc-instrucoes{background:var(--pale);border-radius:var(--radius);padding:1rem;margin-bottom:1.25rem;border:1px solid #C7DCFF;}
.soc-instrucoes h4{font-size:.82rem;font-weight:700;color:var(--navy);margin-bottom:.35rem;}
.soc-instrucoes p{font-size:.78rem;color:var(--blue);line-height:1.55;}

/* VIDEO */
.video-modal{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:200;display:flex;align-items:center;justify-content:center;padding:1rem;}
.video-box{background:white;border-radius:var(--radius-lg);padding:1.25rem;width:100%;max-width:420px;}
.video-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;}
.video-header h3{font-size:.95rem;font-weight:700;}
.video-close{background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--gray-500);}
.video-placeholder{background:linear-gradient(135deg,var(--navy),var(--blue));border-radius:var(--radius);aspect-ratio:16/9;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.75rem;cursor:pointer;transition:opacity .2s;}
.video-placeholder:hover{opacity:.9;}
.video-play{width:56px;height:56px;background:rgba(255,255,255,.9);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.5rem;}
.video-placeholder-text{color:rgba(255,255,255,.8);font-size:.8rem;text-align:center;padding:0 1rem;}
.video-note{font-size:.75rem;color:var(--gray-500);margin-top:.75rem;text-align:center;}

/* RESULTADO */
.resultado-hero{background:linear-gradient(135deg,var(--navy),var(--blue));border-radius:var(--radius-lg);padding:1.5rem;margin:1rem 1.25rem;color:white;text-align:center;}
.resultado-num{font-size:3.5rem;font-weight:800;letter-spacing:-.04em;line-height:1;}
.resultado-max{font-size:.9rem;opacity:.6;margin-bottom:.5rem;}
.resultado-badge{display:inline-block;padding:.3rem .9rem;border-radius:20px;font-size:.8rem;font-weight:700;margin-bottom:1rem;}
.badge-alto{background:rgba(20,160,133,.25);color:#7FFFD4;}
.badge-medio{background:rgba(217,119,6,.25);color:#FCD34D;}
.badge-baixo{background:rgba(220,38,38,.25);color:#FCA5A5;}
.score-grid{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin:1rem 1.25rem;}
.score-card{background:white;border-radius:var(--radius);padding:.9rem;box-shadow:var(--shadow);}
.score-card.dark{background:var(--navy);color:white;}
.score-name{font-size:.65rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--sky);margin-bottom:.2rem;}
.score-card.dark .score-name{color:var(--light);}
.score-num{font-size:1.6rem;font-weight:800;letter-spacing:-.03em;}
.score-max{font-size:.75rem;color:var(--gray-400);}
.score-bar{height:4px;background:var(--pale);border-radius:2px;margin-top:.4rem;}
.score-fill{height:100%;border-radius:2px;background:var(--sky);}
.score-card.dark .score-bar{background:rgba(255,255,255,.15);}
.score-card.dark .score-fill{background:var(--light);}
.foco-label{font-size:.88rem;font-weight:700;color:white;margin-top:.25rem;text-transform:capitalize;}

/* INTERVENÇÕES */
.intervencao-card{background:white;border-radius:var(--radius-lg);padding:1.25rem;margin-bottom:.75rem;box-shadow:var(--shadow);border-left:4px solid var(--sky);}
.int-nome{font-size:.95rem;font-weight:700;margin-bottom:.3rem;display:flex;align-items:center;gap:.4rem;}
.int-como-label{font-size:.7rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--sky);margin:.75rem 0 .25rem;}
.int-como{font-size:.82rem;color:var(--gray-700);line-height:1.6;}
.int-porque-label{font-size:.7rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--mint);margin:.6rem 0 .25rem;}
.int-porque{font-size:.82rem;color:var(--gray-700);line-height:1.6;}
.int-refs{margin-top:.85rem;padding-top:.75rem;border-top:1px solid var(--gray-100);}
.int-refs-title{font-size:.7rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--gray-400);margin-bottom:.4rem;display:flex;align-items:center;gap:.3rem;}
.int-ref{display:flex;flex-direction:column;gap:.05rem;margin-bottom:.4rem;}
.int-ref-titulo{font-size:.75rem;font-weight:600;color:var(--gray-700);line-height:1.4;}
.int-ref-meta{font-size:.68rem;color:var(--gray-400);}
.int-ref-link{font-size:.72rem;font-weight:600;color:var(--sky);text-decoration:none;display:inline-flex;align-items:center;gap:.2rem;margin-top:.1rem;}
.int-ref-link:hover{text-decoration:underline;}

/* DIAGNÓSTICO */
.diag-text{font-size:.85rem;line-height:1.8;color:var(--gray-700);white-space:pre-wrap;}

/* EVOLUÇÃO */
.bar-row{display:flex;align-items:center;gap:.6rem;margin-bottom:.4rem;}
.bar-lbl{font-size:.72rem;color:var(--gray-500);min-width:70px;}
.bar-bg{flex:1;height:6px;background:var(--gray-200);border-radius:3px;}
.bar-val{height:100%;border-radius:3px;background:linear-gradient(90deg,var(--sky),var(--light));transition:width .6s;}
.bar-num{font-size:.72rem;font-weight:700;color:var(--navy);min-width:24px;}

/* FEEDBACK */
.stars{display:flex;gap:.4rem;margin-bottom:1rem;}
.star{font-size:1.8rem;cursor:pointer;transition:transform .1s;}
.star:hover,.star.on{transform:scale(1.15);}
.feedback-textarea{width:100%;padding:.7rem .9rem;border-radius:var(--radius-sm);border:1.5px solid var(--gray-300);font-size:.85rem;font-family:inherit;resize:vertical;min-height:90px;outline:none;transition:border-color .2s;}
.feedback-textarea:focus{border-color:var(--sky);}

/* ADMIN */
.adm-tbl{width:100%;border-collapse:collapse;font-size:.75rem;}
.adm-tbl th{background:var(--navy);color:white;padding:.5rem .6rem;text-align:left;}
.adm-tbl td{padding:.4rem .6rem;border-bottom:1px solid var(--gray-100);}
.adm-tbl tr:nth-child(even) td{background:var(--gray-50);}
.stat-row{display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem;margin:1rem 0;}
.stat-box{background:var(--pale);border-radius:var(--radius);padding:.75rem;text-align:center;}
.stat-num{font-size:1.5rem;font-weight:800;color:var(--navy);}
.stat-lbl{font-size:.68rem;color:var(--gray-500);}
.tabs{display:flex;gap:.35rem;margin-bottom:1rem;overflow-x:auto;padding-bottom:.25rem;}
.tab{padding:.4rem .85rem;border-radius:20px;font-size:.78rem;font-weight:600;cursor:pointer;border:1.5px solid var(--gray-300);background:white;color:var(--gray-500);white-space:nowrap;font-family:inherit;transition:all .2s;}
.tab.on{background:var(--navy);color:white;border-color:var(--navy);}
`;

// COMPONENTES BASE
function Campo({label,children}){return <div className="field"><label>{label}</label>{children}</div>;}
function Sel({value,onChange,opts,ph="Selecione..."}){
  return <select value={value||""} onChange={e=>onChange(e.target.value)}>
    <option value="">{ph}</option>
    {opts.map(o=><option key={o} value={o}>{o}</option>)}
  </select>;
}

// MODAL DE VÍDEO
function VideoModal({onClose}){
  return <div className="video-modal" onClick={onClose}>
    <div className="video-box" onClick={e=>e.stopPropagation()}>
      <div className="video-header">
        <h3>🎬 O que é o Senso de Coerência?</h3>
        <button className="video-close" onClick={onClose}>✕</button>
      </div>
      <div className="video-placeholder" onClick={()=>alert("Em breve! O vídeo será adicionado quando estiver disponível no YouTube.")}>
        <div className="video-play">▶</div>
        <div className="video-placeholder-text">
          <strong>Vídeo explicativo</strong><br/>
          Em breve — produção em andamento
        </div>
      </div>
      <p className="video-note">📌 Assista antes de responder para entender melhor o que estamos avaliando.</p>
      <div className="btn-row">
        <button className="btn btn-p" onClick={onClose} style={{width:"100%",marginTop:".5rem"}}>Entendido, vamos começar →</button>
      </div>
    </div>
  </div>;
}

// TELA INICIAL
function TelaInicio({onIniciar,onComoFunciona}){
  const [video,setVideo] = useState(false);
  return <>
    {video && <VideoModal onClose={()=>setVideo(false)}/>}
    <div className="hero">
      <div className="hero-badge">Para enfermeiros</div>
      <h1 className="hero-title">Coerên<span>CIA</span></h1>
      <p className="hero-sub">Avalie seu bem-estar e descubra estratégias personalizadas baseadas em evidências para fortalecer seu senso de coerência.</p>
      <div className="hero-btns">
        <button className="btn-hero-p" onClick={onIniciar}>🩺 Participar agora</button>
        <button className="btn-hero-s" onClick={onComoFunciona}>Como funciona</button>
      </div>
    </div>
    <div className="section-cards">
      <div style={{padding:"1.5rem 0 .75rem"}}>
        <h2 style={{fontSize:"1.1rem",fontWeight:800,letterSpacing:"-.02em",marginBottom:".1rem"}}>Explore antes de começar</h2>
        <p style={{fontSize:".8rem",color:"var(--gray-500)"}}>Entenda o que vamos avaliar</p>
      </div>
      <div className="sec-card" onClick={()=>setVideo(true)}>
        <div className="sec-card-icon" style={{background:"#EBF4FF"}}>🎬</div>
        <div className="sec-card-body">
          <h3>O que é Senso de Coerência?</h3>
          <p>Conceito desenvolvido por Aaron Antonovsky que explica por que algumas pessoas resistem melhor ao estresse.</p>
          <span className="sec-card-link">▶ Assistir vídeo introdutório</span>
        </div>
      </div>
      <div className="sec-card" onClick={onComoFunciona}>
        <div className="sec-card-icon" style={{background:"#E6F7F4"}}>📋</div>
        <div className="sec-card-body">
          <h3>Como funciona a avaliação</h3>
          <p>Entenda as etapas, o que será avaliado e o que você vai receber ao final.</p>
          <span className="sec-card-link">→ Ver passo a passo</span>
        </div>
      </div>
    </div>
  </>;
}

// COMO FUNCIONA
function TelaComoFunciona({onVoltar,onIniciar}){
  return <>
    <div style={{background:":var(--navy)",padding:"1.25rem",background:"var(--navy)"}}>
      <button onClick={onVoltar} style={{background:"none",border:"none",color:"rgba(255,255,255,.7)",cursor:"pointer",fontSize:".82rem",display:"flex",alignItems:"center",gap:".3rem",fontFamily:"inherit",marginBottom:".75rem"}}>← Voltar</button>
      <h2 style={{fontSize:"1.5rem",fontWeight:800,color:"white",letterSpacing:"-.03em"}}>Como funciona</h2>
      <p style={{fontSize:".85rem",color:"rgba(255,255,255,.65)",marginTop:".25rem"}}>Tudo que você precisa saber antes de começar.</p>
    </div>
    <div style={{padding:"1.25rem"}}>
      <div className="alert ai" style={{marginBottom:"1.25rem"}}>
        🔒 Seus dados são <strong>completamente anônimos</strong>. Nome e data de nascimento nunca são armazenados — apenas um código gerado localmente.
      </div>
      <div className="como-steps">
        {[
          {n:1,t:"Identifique-se anonimamente",d:"Informe nome e data de nascimento apenas para gerar seu código único. Esses dados não são salvos em nenhum servidor."},
          {n:2,t:"Preencha seu perfil",d:"Dados sociodemográficos e profissionais coletados uma única vez para personalizar sua avaliação."},
          {n:3,t:"Avalie seu bem-estar",d:"8 dimensões do bem-estar avaliadas em escala de 1 a 5. Rápido e intuitivo."},
          {n:4,t:"Responda o questionário SOC-13",d:"13 questões sobre como você percebe e lida com situações da vida — apresentadas uma a uma."},
          {n:5,t:"Receba seu diagnóstico personalizado",d:"Gerado por Inteligência Artificial com base nos seus resultados, com estratégias práticas e referências científicas."},
          {n:6,t:"Acompanhe sua evolução",d:"Repita a avaliação em um segundo momento para ver como você evoluiu ao longo do tempo."},
        ].map(s=><div key={s.n} className="step-card">
          <div className="step-num">{s.n}</div>
          <div className="step-text"><h4>{s.t}</h4><p>{s.d}</p></div>
        </div>)}
      </div>
      <div style={{marginTop:"1.5rem"}}>
        <button className="btn btn-p" onClick={onIniciar} style={{width:"100%"}}>🩺 Participar agora →</button>
      </div>
    </div>
  </>;
}

// IDENTIFICAÇÃO
function TelaIdentificacao({onIdentify}){
  const [nome,setNome]=useState("");const [nasc,setNasc]=useState("");const [loading,setLoading]=useState(false);const [err,setErr]=useState("");
  async function go(){
    if(!nome.trim()||!nasc){setErr("Preencha nome e data de nascimento.");return;}
    setLoading(true);setErr("");
    const id=await sha256(nome.trim().toLowerCase()+nasc);
    onIdentify(id);
  }
  return <div className="card">
    <div className="card-eyebrow">Acesso anônimo</div>
    <h2 className="card-title">Vamos começar</h2>
    <p className="card-body">Informe seus dados para gerar seu código único. Eles <strong>não serão armazenados</strong>.</p>
    {err&&<div className="alert ae">⚠️ {err}</div>}
    <Campo label="Nome completo"><input value={nome} onChange={e=>setNome(e.target.value)} placeholder="Apenas para gerar seu código anônimo"/></Campo>
    <Campo label="Data de nascimento"><input type="date" value={nasc} onChange={e=>setNasc(e.target.value)}/></Campo>
    <div className="alert ai">🔒 Nome e data não são armazenados. Apenas um código de 16 caracteres é gerado localmente.</div>
    <div className="btn-row"><button className="btn btn-p" onClick={go} disabled={loading}>{loading?"Identificando...":"Continuar →"}</button></div>
  </div>;
}

// TCLE
function TelaTCLE({onConsentir,onRecusar}){
  const [leu,setLeu]=useState(false);
  return <div className="card">
    <div className="card-eyebrow">Consentimento</div>
    <h2 className="card-title">Termo de Consentimento</h2>
    <div className="tcle-box" onScroll={e=>{if(e.target.scrollTop+e.target.clientHeight>=e.target.scrollHeight-10)setLeu(true);}}>
      <strong>TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO (TCLE)</strong><br/><br/>
      Você está sendo convidado(a) a participar voluntariamente de uma pesquisa sobre bem-estar e senso de coerência em enfermeiros.<br/><br/>
      <strong>Objetivo:</strong> Avaliar o Senso de Coerência de profissionais de enfermagem e propor estratégias personalizadas de bem-estar.<br/><br/>
      <strong>Procedimentos:</strong> Você responderá a questões sobre seu perfil, uma avaliação de bem-estar e um questionário com 13 questões.<br/><br/>
      <strong>Confidencialidade:</strong> Seus dados são identificados apenas por um código anônimo gerado localmente. Nome e data de nascimento NUNCA são armazenados.<br/><br/>
      <strong>Riscos:</strong> Mínimos. Você pode pausar ou desistir a qualquer momento sem qualquer prejuízo.<br/><br/>
      <strong>Benefícios:</strong> Receber um diagnóstico personalizado com estratégias práticas para melhorar seu bem-estar.<br/><br/>
      <strong>Participação voluntária:</strong> Inteiramente voluntária. A recusa não acarreta nenhum prejuízo.<br/><br/>
      Ao clicar em "Concordo", você confirma que leu este termo e consente em participar da pesquisa.
    </div>
    {!leu&&<div className="alert aw">📜 Role o texto até o final para habilitar a confirmação.</div>}
    <div className="btn-row">
      <button className="btn btn-d" onClick={onRecusar}>Não concordo</button>
      <button className="btn btn-p" onClick={onConsentir} disabled={!leu}>Concordo →</button>
    </div>
  </div>;
}

// PERFIL
function TelaPerfil({onSalvar}){
  const [d,setD]=useState({});const [err,setErr]=useState("");
  const set=(k,v)=>setD(p=>({...p,[k]:v}));
  const obrig=["idade","sexo","identidade","raca","estado_civil","filhos","renda","pessoas_residencia","categoria","tempo_profissao","turno","carga_horaria","funcao","setor","vinculo","tabagismo","alcool"];
  function go(){
    if(obrig.some(k=>!d[k])){setErr("Por favor, preencha todos os campos antes de continuar.");return;}
    setErr("");onSalvar({...d,filhos:d.filhos==="Sim"});
  }
  return <div className="card">
    <div className="card-eyebrow">Etapa 1 de 4</div>
    <h2 className="card-title">Seu Perfil</h2>
    <p className="card-body">Coletado uma única vez para personalizar sua avaliação.</p>
    {err&&<div className="alert ae">⚠️ {err}</div>}
    <div className="section-sep">Dados Pessoais</div>
    <div className="grid2">
      <Campo label="Faixa etária"><Sel value={d.idade} onChange={v=>set("idade",v)} opts={OPT_IDADE}/></Campo>
      <Campo label="Sexo biológico"><Sel value={d.sexo} onChange={v=>set("sexo",v)} opts={OPT_SEXO}/></Campo>
      <Campo label="Como você se identifica?"><Sel value={d.identidade} onChange={v=>set("identidade",v)} opts={OPT_IDENTIDADE}/></Campo>
      <Campo label="Raça / Cor (IBGE)"><Sel value={d.raca} onChange={v=>set("raca",v)} opts={OPT_RACA}/></Campo>
      <Campo label="Estado civil"><Sel value={d.estado_civil} onChange={v=>set("estado_civil",v)} opts={OPT_ESTADO_CIVIL}/></Campo>
      <Campo label="Tem filhos?"><Sel value={d.filhos} onChange={v=>set("filhos",v)} opts={["Sim","Não"]}/></Campo>
      <Campo label="Renda mensal bruta"><Sel value={d.renda} onChange={v=>set("renda",v)} opts={OPT_RENDA}/></Campo>
      <Campo label="Pessoas na residência">
        <input type="number" min="1" max="20" value={d.pessoas_residencia||""} onChange={e=>set("pessoas_residencia",e.target.value)} placeholder="Ex: 3"/>
      </Campo>
    </div>
    <div className="section-sep">Vida Profissional</div>
    <div className="grid2">
      <Campo label="Categoria profissional"><Sel value={d.categoria} onChange={v=>set("categoria",v)} opts={OPT_CATEGORIA}/></Campo>
      <Campo label="Tempo na enfermagem"><Sel value={d.tempo_profissao} onChange={v=>set("tempo_profissao",v)} opts={OPT_TEMPO_PROF}/></Campo>
      <Campo label="Turno de trabalho"><Sel value={d.turno} onChange={v=>set("turno",v)} opts={OPT_TURNO}/></Campo>
      <Campo label="Carga horária semanal"><Sel value={d.carga_horaria} onChange={v=>set("carga_horaria",v)} opts={OPT_CARGA}/></Campo>
      <Campo label="Função principal"><Sel value={d.funcao} onChange={v=>set("funcao",v)} opts={OPT_FUNCAO}/></Campo>
      <Campo label="Setor de atuação"><Sel value={d.setor} onChange={v=>set("setor",v)} opts={OPT_SETOR}/></Campo>
      <Campo label="Vínculo empregatício"><Sel value={d.vinculo} onChange={v=>set("vinculo",v)} opts={OPT_VINCULO}/></Campo>
    </div>
    <div className="section-sep">Saúde e Estilo de Vida</div>
    <div className="grid2">
      <Campo label="Tabagismo (últimos 12 meses)"><Sel value={d.tabagismo} onChange={v=>set("tabagismo",v)} opts={OPT_FREQ}/></Campo>
      <Campo label="Consumo de álcool (últimos 12 meses)"><Sel value={d.alcool} onChange={v=>set("alcool",v)} opts={OPT_FREQ}/></Campo>
    </div>
    <div className="btn-row"><button className="btn btn-p" onClick={go}>Salvar e continuar →</button></div>
  </div>;
}

// BEM-ESTAR
function TelaBemestar({onSalvar}){
  const [vals,setVals]=useState({});const [err,setErr]=useState("");
  function go(){
    if(DIMS_BW.some(d=>!vals[d.key])){setErr("Avalie todas as dimensões antes de continuar.");return;}
    setErr("");onSalvar(vals);
  }
  return <div className="card">
    <div className="card-eyebrow">Etapa 2 de 4</div>
    <h2 className="card-title">Avaliação de Bem-estar</h2>
    <p className="card-body">Como você avalia cada dimensão da sua vida atualmente?</p>
    {err&&<div className="alert ae">⚠️ {err}</div>}
    {DIMS_BW.map(d=><div className="bw-item" key={d.key}>
      <div className="bw-header">
        <span className="bw-emoji">{d.emoji}</span>
        <span className="bw-label">{d.label}</span>
      </div>
      <div className="bw-opts">
        {LIKERT_BW.map((v,i)=><button key={v} className={`bw-btn${vals[d.key]===i+1?" sel":""}`} onClick={()=>setVals(p=>({...p,[d.key]:i+1}))}>
          <div>{v}</div>
          <div style={{fontSize:".6rem",opacity:.7}}>{LIKERT_LABELS[i]}</div>
        </button>)}
      </div>
    </div>)}
    <div className="btn-row"><button className="btn btn-p" onClick={go}>Continuar →</button></div>
  </div>;
}

// SOC-13
function TelaSOC({respostas,onChange,pergAtual,onNext,onPrev}){
  const p=SOC_PERGUNTAS[pergAtual];
  const prog=((pergAtual+1)/13)*100;
  return <>
    <div className="prog-wrap">
      <div className="prog-label"><span>Pergunta {pergAtual+1} de 13</span><span>{Math.round(prog)}%</span></div>
      <div className="prog"><div className="prog-fill" style={{width:`${prog}%`}}/></div>
    </div>
    <div className="card">
      <div className="card-eyebrow">Etapa 3 de 4 — Questionário SOC</div>
      {pergAtual===0&&<div className="soc-instrucoes">
        <h4>📋 Instruções</h4>
        <p>A seguir, você encontrará 13 questões relacionadas a diferentes aspectos da vida. Cada pergunta possui uma escala de 1 a 7. Selecione o número que melhor representa seus sentimentos, percepções ou experiências.</p>
      </div>}
      <div className="soc-ancora">💭 Pensando na sua vida como um todo — no trabalho, nas relações pessoais e em você mesmo(a)...</div>
      <div className="soc-pergunta">{p.texto}</div>
      <div className="soc-scale">
        {[1,2,3,4,5,6,7].map(v=><button key={v} className={`soc-btn${respostas[p.num]===v?" sel":""}`} onClick={()=>onChange(p.num,v)}>{v}</button>)}
      </div>
      <div className="soc-anchors"><span>1 – {p.min}</span><span>7 – {p.max}</span></div>
      <div className="btn-row">
        {pergAtual>0&&<button className="btn btn-s" onClick={onPrev}>← Voltar</button>}
        <button className="btn btn-p" disabled={!respostas[p.num]} onClick={onNext}>{pergAtual<12?"Próxima →":"Ver resultado →"}</button>
      </div>
    </div>
  </>;
}

// RESULTADO
function TelaResultado({soc,diagnostico,bemestar,historico,onRetestar,onFeedback}){
  const cc={Alto:"badge-alto",Médio:"badge-medio",Baixo:"badge-baixo"}[soc.classificacao]||"badge-medio";
  const intervs=INTERVENCOES[soc.dimensao_foco]||INTERVENCOES.significancia;
  const [expandido,setExpandido]=useState(null);
  return <>
    <div className="resultado-hero">
      <div style={{fontSize:".75rem",opacity:.6,marginBottom:".25rem",textTransform:"uppercase",letterSpacing:".06em"}}>Seu resultado</div>
      <div className="resultado-num">{soc.soc_total}</div>
      <div className="resultado-max">de 91 pontos</div>
      <span className={`resultado-badge ${cc}`}>SOC {soc.classificacao}</span>
      <div style={{fontSize:".78rem",opacity:.7}}>Foco prioritário: <strong style={{textTransform:"capitalize"}}>{soc.dimensao_foco}</strong></div>
    </div>

    <div className="score-grid">
      {[{k:"compreensibilidade",l:"Compreensibilidade",m:49},{k:"maneabilidade",l:"Maneabilidade",m:35},{k:"significancia",l:"Significância",m:7}].map(d=><div className="score-card" key={d.k}>
        <div className="score-name">{d.l}</div>
        <div><span className="score-num">{soc[d.k]}</span><span className="score-max"> /{d.m}</span></div>
        <div className="score-bar"><div className="score-fill" style={{width:`${(soc[d.k]/d.m)*100}%`}}/></div>
      </div>)}
      <div className="score-card dark">
        <div className="score-name">Foco prioritário</div>
        <div className="foco-label">{soc.dimensao_foco}</div>
        <div style={{fontSize:".7rem",opacity:.5,marginTop:".2rem"}}>Dimensão mais baixa</div>
      </div>
    </div>

    <div className="card">
      <div className="card-eyebrow">Diagnóstico personalizado</div>
      <h2 className="card-title">Sua Avaliação</h2>
      {diagnostico?<div className="diag-text">{diagnostico}</div>:<div className="spin"/>}
    </div>

    <div className="card">
      <div className="card-eyebrow">Estratégias para você</div>
      <h2 className="card-title">Intervenções Sugeridas</h2>
      <p className="card-body">Com base na sua dimensão prioritária ({soc.dimensao_foco}), estas estratégias são embasadas em evidências científicas.</p>
      {intervs.map((iv,i)=><div className="intervencao-card" key={i}>
        <div className="int-nome">💡 {iv.nome}</div>
        <div className="int-como-label">Como fazer</div>
        <div className="int-como">{iv.como}</div>
        <div className="int-porque-label">Por que ajuda</div>
        <div className="int-porque">{iv.porque}</div>
        <div className="int-refs">
          <div className="int-refs-title">📚 Saiba mais — Referências científicas</div>
          {iv.refs.map((ref,j)=><div className="int-ref" key={j}>
            <div className="int-ref-titulo">{ref.titulo}</div>
            <div className="int-ref-meta">{ref.autores} ({ref.ano}) · {ref.base}</div>
            <a className="int-ref-link" href={ref.url} target="_blank" rel="noopener noreferrer">🔗 Acessar artigo →</a>
          </div>)}
        </div>
        <button style={{background:"none",border:"none",color:"var(--sky)",fontSize:".75rem",fontWeight:600,cursor:"pointer",marginTop:".5rem",fontFamily:"inherit",padding:0}} onClick={()=>setExpandido(expandido===i?null:i)}>
          {expandido===i?"▲ Ocultar detalhes":"▼ Ver mais detalhes"}
        </button>
      </div>)}
    </div>

    {historico&&historico.length>1&&<div className="card">
      <div className="card-eyebrow">Acompanhamento</div>
      <h2 className="card-title">Sua Evolução</h2>
      {historico.slice(-8).map((s,i)=><div className="bar-row" key={i}>
        <div className="bar-lbl">{new Date(s.data_sessao).toLocaleDateString("pt-BR",{day:"2-digit",month:"short"})}</div>
        <div className="bar-bg"><div className="bar-val" style={{width:`${(s.soc_total/91)*100}%`}}/></div>
        <div className="bar-num">{s.soc_total}</div>
      </div>)}
    </div>}

    <div className="card">
      <div className="btn-row" style={{justifyContent:"stretch",flexDirection:"column"}}>
        <button className="btn btn-s" onClick={onFeedback} style={{width:"100%"}}>⭐ Avaliar o aplicativo</button>
        <button className="btn btn-p" onClick={onRetestar} style={{width:"100%"}}>↺ Refazer questionário</button>
      </div>
    </div>
  </>;
}

// FEEDBACK
function TelaFeedback({onSalvar,onPular}){
  const [nota,setNota]=useState(0);const [hover,setHover]=useState(0);const [texto,setTexto]=useState("");const [ajudou,setAjudou]=useState("");const [salvo,setSalvo]=useState(false);
  async function go(){
    if(!nota){alert("Por favor, selecione uma nota em estrelas.");return;}
    try{await sb("POST","feedbacks",{nota,texto,ajudou,criado_em:new Date().toISOString()});}catch{}
    setSalvo(true);
    setTimeout(onPular,2000);
  }
  if(salvo)return <div className="card" style={{textAlign:"center"}}>
    <div style={{fontSize:"3rem",marginBottom:".5rem"}}>🙏</div>
    <h2 className="card-title">Obrigada pelo feedback!</h2>
    <p className="card-body">Sua opinião é fundamental para melhorar este aplicativo.</p>
  </div>;
  return <div className="card">
    <div className="card-eyebrow">Sua opinião importa</div>
    <h2 className="card-title">Avalie o CoerêncIA</h2>
    <p className="card-body">Como foi sua experiência com o aplicativo?</p>
    <div style={{marginBottom:"1rem"}}>
      <div style={{fontSize:".78rem",fontWeight:600,color:"var(--gray-700)",marginBottom:".4rem"}}>Nota geral</div>
      <div className="stars">
        {[1,2,3,4,5].map(s=><span key={s} className={`star${s<=(hover||nota)?" on":""}`}
          onClick={()=>setNota(s)} onMouseEnter={()=>setHover(s)} onMouseLeave={()=>setHover(0)}>
          {s<=(hover||nota)?"⭐":"☆"}
        </span>)}
      </div>
    </div>
    <div className="field">
      <label>O aplicativo te ajudou de alguma forma?</label>
      <Sel value={ajudou} onChange={setAjudou} opts={["Sim, muito","Sim, um pouco","Neutro","Não muito","Não"]}/>
    </div>
    <div className="field">
      <label>Comentários e sugestões (opcional)</label>
      <textarea className="feedback-textarea" value={texto} onChange={e=>setTexto(e.target.value)} placeholder="Conte o que achou, o que poderia melhorar..."/>
    </div>
    <div className="btn-row">
      <button className="btn btn-s" onClick={onPular}>Pular</button>
      <button className="btn btn-p" onClick={go}>Enviar avaliação →</button>
    </div>
  </div>;
}

// ADMIN
function TelaAdmin({onVoltar}){
  const [senha,setSenha]=useState("");const [auth,setAuth]=useState(false);const [dados,setDados]=useState([]);const [loading,setLoading]=useState(false);const [aba,setAba]=useState("stats");const [stats,setStats]=useState(null);
  async function autenticar(){
    if(senha===ADMIN_PASSWORD){setAuth(true);await carregar();}else alert("Senha incorreta.");
  }
  async function carregar(){
    setLoading(true);
    try{
      const s=await sb("GET","sessoes?select=*,usuarios(setor,idade,sexo,turno,categoria)&order=data_sessao.desc");
      setDados(s||[]);
      if(s&&s.length){
        const totais=s.map(x=>x.soc_total).filter(Boolean);
        const media=totais.reduce((a,b)=>a+b,0)/totais.length;
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
    <div className="card-eyebrow">Acesso restrito</div>
    <h2 className="card-title">Painel do Pesquisador</h2>
    <Campo label="Senha"><input type="password" value={senha} onChange={e=>setSenha(e.target.value)} onKeyDown={e=>e.key==="Enter"&&autenticar()}/></Campo>
    <div className="btn-row">
      <button className="btn btn-s" onClick={onVoltar}>← Voltar</button>
      <button className="btn btn-p" onClick={autenticar}>Entrar</button>
    </div>
  </div>;
  return <>
    <div className="card" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:0}}>
      <div><div className="card-eyebrow">Pesquisador</div><h2 className="card-title" style={{marginBottom:0}}>Painel de Dados</h2></div>
      <div style={{display:"flex",gap:".4rem"}}>
        <button className="btn btn-s" style={{fontSize:".75rem",padding:".5rem .8rem"}} onClick={exportarCSV}>⬇ CSV</button>
        <button className="btn btn-s" style={{fontSize:".75rem",padding:".5rem .8rem"}} onClick={onVoltar}>← Sair</button>
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
        {Object.entries(stats.dist).map(([k,v])=><div className="bar-row" key={k}>
          <div className="bar-lbl">{k}</div>
          <div className="bar-bg"><div className="bar-val" style={{width:`${stats.sessoes?(v/stats.sessoes)*100:0}%`}}/></div>
          <div className="bar-num">{v}</div>
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

// APP PRINCIPAL
export default function App(){
  const [tela,setTela]=useState("inicio");
  const [userId,setUserId]=useState(null);
  const [perfil,setPerfil]=useState(null);
  const [primeiroAcesso,setPrimeiroAcesso]=useState(true);
  const [bemestarAtual,setBemestarAtual]=useState(null);
  const [pergAtual,setPergAtual]=useState(0);
  const [respostas,setRespostas]=useState({});
  const [resultadoSOC,setResultadoSOC]=useState(null);
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
        setTela("bemestar");
      }else{setPrimeiroAcesso(true);setTela("tcle");}
    }catch{setErro("Erro ao verificar participante. Verifique as configurações do Supabase.");}
    finally{setLoading(false);}
  }

  async function handleConsentir(){
    try{
      if(primeiroAcesso)await sb("POST","usuarios",{id:userId,consentimento:true,data_consentimento:new Date().toISOString()});
      else await sb("PATCH",`usuarios?id=eq.${userId}`,{consentimento:true,data_consentimento:new Date().toISOString()});
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
      const resp=await fetch("/api/diagnostico",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({perfil,soc,bemestar:bemestarAtual})});
      const data=await resp.json();
      const diag=data.diagnostico||"Diagnóstico não disponível.";
      setDiagnostico(diag);
      if(sessaoId)await sb("PATCH",`sessoes?id=eq.${sessaoId}`,{diagnostico:diag}).catch(()=>{});
    }catch{
      setDiagnostico("Não foi possível gerar o diagnóstico personalizado no momento. Seus dados foram salvos com sucesso.");
    }
  }

  function handleRetestar(){setRespostas({});setPergAtual(0);setResultadoSOC(null);setDiagnostico(null);setTela("bemestar");}

  const showHeader = !["inicio","como"].includes(tela);

  return <>
    <style>{CSS}</style>
    <div>
      <header className="hdr">
        <div className="hdr-brand">
          <span className="hdr-icon">🩺</span>
          <span className="hdr-name">Coerên<span>CIA</span></span>
        </div>
        {tela!=="admin"&&<button className="hdr-btn" onClick={()=>setTela("admin")}>Painel admin</button>}
      </header>

      <div className="main">
        {erro&&<div className="alert ae" style={{margin:"1rem 1.25rem"}}>⚠️ {erro}<button style={{marginLeft:".5rem",background:"none",border:"none",cursor:"pointer",fontWeight:700}} onClick={()=>setErro("")}>✕</button></div>}
        {loading&&<div className="spin"/>}

        {!loading&&tela==="inicio"&&<TelaInicio onIniciar={()=>setTela("identificacao")} onComoFunciona={()=>setTela("como")}/>}
        {!loading&&tela==="como"&&<TelaComoFunciona onVoltar={()=>setTela("inicio")} onIniciar={()=>setTela("identificacao")}/>}
        {!loading&&tela==="identificacao"&&<TelaIdentificacao onIdentify={handleIdentify}/>}
        {!loading&&tela==="tcle"&&<TelaTCLE onConsentir={handleConsentir} onRecusar={()=>setTela("inicio")}/>}
        {!loading&&tela==="perfil"&&<TelaPerfil onSalvar={handleSalvarPerfil}/>}
        {!loading&&tela==="bemestar"&&<TelaBemestar onSalvar={v=>{setBemestarAtual(v);setTela("soc");}}/>}
        {!loading&&tela==="soc"&&<TelaSOC respostas={respostas} pergAtual={pergAtual} onChange={(n,v)=>setRespostas(r=>({...r,[n]:v}))} onNext={()=>{if(pergAtual<12)setPergAtual(p=>p+1);else handleFinalizarSOC();}} onPrev={()=>setPergAtual(p=>p-1)}/>}
        {tela==="resultado"&&resultadoSOC&&<TelaResultado soc={resultadoSOC} diagnostico={diagnostico} bemestar={bemestarAtual} historico={historico} onRetestar={handleRetestar} onFeedback={()=>setTela("feedback")}/>}
        {tela==="feedback"&&<TelaFeedback onSalvar={()=>setTela("inicio")} onPular={()=>setTela("inicio")}/>}
        {tela==="admin"&&<TelaAdmin onVoltar={()=>setTela("inicio")}/>}
      </div>
    </div>
  </>;
}
