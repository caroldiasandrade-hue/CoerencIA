import { useState, useEffect, useCallback } from "react";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
// Substitua pelos seus dados do Supabase
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

// ─── SUPABASE SQL (execute no Supabase Dashboard → SQL Editor) ───────────────
/*
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  setor TEXT,
  idade INTEGER,
  genero TEXT,
  formacao TEXT,
  pos_graduacao TEXT,
  tempo_profissao INTEGER,
  tempo_instituicao INTEGER,
  turno TEXT,
  carga_horaria INTEGER,
  vinculo TEXT,
  cargo TEXT,
  estado_civil TEXT,
  filhos BOOLEAN,
  consentimento BOOLEAN DEFAULT FALSE,
  data_consentimento TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id TEXT REFERENCES usuarios(id),
  data_sessao TIMESTAMPTZ DEFAULT NOW(),
  r1 INTEGER, r2 INTEGER, r3 INTEGER, r4 INTEGER, r5 INTEGER,
  r6 INTEGER, r7 INTEGER, r8 INTEGER, r9 INTEGER, r10 INTEGER,
  r11 INTEGER, r12 INTEGER, r13 INTEGER,
  compreensibilidade INTEGER,
  maneabilidade INTEGER,
  significancia INTEGER,
  soc_total INTEGER,
  classificacao TEXT,
  dimensao_foco TEXT,
  diagnostico TEXT
);

CREATE TABLE IF NOT EXISTS bemestar (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id TEXT REFERENCES usuarios(id),
  sessao_id UUID REFERENCES sessoes(id),
  data_avaliacao TIMESTAMPTZ DEFAULT NOW(),
  fisico INTEGER,
  emocional INTEGER,
  social INTEGER,
  espiritual INTEGER,
  intelectual INTEGER,
  ocupacional INTEGER,
  ambiental INTEGER,
  financeiro INTEGER
);
*/

// ─── SHA-256 HASH ─────────────────────────────────────────────────────────────
async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

// ─── SUPABASE CLIENT (sem biblioteca externa) ─────────────────────────────────
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
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message || r.statusText);
  }
  return r.status === 204 ? null : r.json();
}

// ─── SOC-13 CONFIG ────────────────────────────────────────────────────────────
const ITENS_INVERTIDOS = [1, 4, 5, 6, 7, 11];
const DIMENSOES = {
  compreensibilidade: [1, 3, 5, 6, 8, 11, 13],
  maneabilidade: [2, 4, 9, 10, 12],
  significancia: [7],
};

const SETORES = {
  uti: "UTI",
  emergencia: "Emergência",
  clinica: "Clínica Médica",
  cirurgica: "Clínica Cirúrgica",
  pediatria: "Pediatria",
  oncologia: "Oncologia",
  psiquiatria: "Psiquiatria",
  obstetricia: "Obstetrícia",
  atencao_basica: "Atenção Básica",
  outro: "Outro",
};

const CENARIOS = {
  uti: [
    "Você está no plantão na UTI quando surgem múltiplos alarmes simultâneos.",
    "Um familiar questiona agressivamente as decisões da equipe sobre o paciente.",
    "Você precisou tomar uma decisão rápida sem conseguir contato com o médico.",
    "Após um óbito inesperado, você continua o plantão com a equipe abalada.",
    "A escala de trabalho foi alterada de última hora sem consulta à equipe.",
    "Você percebe que um colega cometeu um erro que pode afetar o paciente.",
    "Ao final de um plantão exaustivo, você sente que fez a diferença.",
    "Recursos essenciais estão em falta e você precisa improvisar com segurança.",
    "Você recebeu uma crítica do médico diante de outros profissionais.",
    "A instituição implantou um novo protocolo sem treinamento adequado.",
    "Após semanas intensas, você avalia seu bem-estar e energia.",
    "Você está envolvido num conflito entre dois colegas de plantão.",
    "Refletindo sobre sua trajetória, você pondera o significado do seu trabalho.",
  ],
  emergencia: [
    "Você atende um politraumatizado em massa com recursos limitados.",
    "Um paciente em crise psiquiátrica agride verbalmente a equipe.",
    "Você precisa priorizar atendimentos com a emergência lotada.",
    "Um paciente grave aguarda há horas sem leito disponível.",
    "Você discorda do protocolo adotado para triagem naquele dia.",
    "Um colega não segue as normas de biossegurança repetidamente.",
    "Após salvar uma vida, você sente que vale a pena continuar.",
    "Faltam materiais básicos no meio de um atendimento de emergência.",
    "Você recebe uma reclamação formal por uma decisão que considerou correta.",
    "O sistema de registros travou durante um momento crítico de atendimento.",
    "Você avalia seu nível de estresse após um mês de plantões intensos.",
    "Dois colegas discutem publicamente e você precisa mediar a situação.",
    "Você reflete sobre o impacto do seu trabalho na vida das pessoas.",
  ],
  generico: [
    "Você enfrenta uma situação complexa e desafiadora no trabalho.",
    "Um colega questiona suas decisões diante de outros membros da equipe.",
    "Você precisou tomar uma decisão importante sem apoio suficiente.",
    "Após uma situação difícil, você continua trabalhando com a equipe.",
    "Uma mudança foi imposta sem consulta aos profissionais envolvidos.",
    "Você identificou uma falha que pode comprometer a qualidade do serviço.",
    "Ao final de um período difícil, você sente que contribuiu positivamente.",
    "Você precisou trabalhar sem os recursos necessários para a tarefa.",
    "Você recebeu uma avaliação negativa que considerou injusta.",
    "Um novo processo foi implantado sem treinamento ou explicação prévia.",
    "Você avalia seu bem-estar geral após semanas de trabalho intenso.",
    "Existe um conflito interpessoal que afeta o clima da equipe.",
    "Você reflete sobre o sentido e propósito do seu trabalho.",
  ],
};

const PERGUNTAS_SOC = [
  "Quando você faz algo que lhe dá uma sensação de bem-estar, isso é quase certo que vai continuar assim?",
  "Quando você precisa fazer algo que depende da cooperação de outras pessoas, você tem certeza que vai funcionar?",
  "Quando você pensa nos problemas que provavelmente vai ter que enfrentar em aspectos importantes de sua vida, você tem a sensação de que vai sempre ser difícil ou fácil de se resolver?",
  "Você tem a sensação de não saber o que vai acontecer a seguir?",
  "Muitas pessoas – mesmo as de forte personalidade – às vezes se sentem perdedoras em certas situações. Com que frequência você se sentiu assim no passado?",
  "Quando algo aconteceu no passado, você geralmente achou que avaliou mal a situação ou superestimou ou subestimou a sua importância?",
  "Com que frequência você tem a sensação de que as coisas que você faz no seu dia-a-dia têm pouco sentido?",
  "Com que frequência você tem sentimentos que não tem certeza se consegue mantê-los sob controle?",
  "Você tem sentimentos e ideias muito misturadas e confusas?",
  "Quando algo aconteceu, a sua reação usual foi ver o lado positivo e negativo das coisas?",
  "Com que frequência você tem a sensação de que as coisas que acontecem em sua vida diária são difíceis de compreender?",
  "Com que frequência você tem a sensação de que não faz sentido tentar se esforçar nas coisas que você faz diariamente?",
  "Com que frequência você tem sentimentos que não tem certeza se consegue mantê-los sob controle?",
];

const ETAPAS_SOC = [
  { titulo: "Compreendendo o Mundo", itens: [1, 2, 3, 4], descricao: "Como você percebe e interpreta os acontecimentos ao seu redor" },
  { titulo: "Seus Recursos", itens: [5, 6, 7, 8], descricao: "Como você avalia sua capacidade de lidar com desafios" },
  { titulo: "Controle e Clareza", itens: [9, 10, 11, 12], descricao: "Sua sensação de controle sobre sua vida e emoções" },
  { titulo: "Propósito e Sentido", itens: [13], descricao: "O significado que você encontra no que faz" },
];

const ANCORAS = {
  normal: { min: "Nunca", max: "Sempre" },
  invertida: { min: "Sempre", max: "Nunca" },
  dificuldade: { min: "Muito fácil", max: "Muito difícil" },
  controle: { min: "Sempre sob controle", max: "Totalmente fora de controle" },
};

function getAncoras(idx) {
  if ([3, 9, 10, 11, 12].includes(idx)) return ANCORAS.dificuldade;
  if ([4, 8, 13].includes(idx)) return ANCORAS.controle;
  return ANCHORS_INVERTIDOS(idx) ? ANCORAS.invertida : ANCORAS.normal;
}
function ANCHORS_INVERTIDOS(idx) {
  return ITENS_INVERTIDOS.includes(idx);
}

// ─── CÁLCULO SOC ──────────────────────────────────────────────────────────────
function calcularSOC(respostas) {
  const r = { ...respostas };
  ITENS_INVERTIDOS.forEach(i => { if (r[i]) r[i] = 8 - r[i]; });

  const comp = [1, 3, 5, 6, 8, 11, 13].reduce((s, i) => s + (r[i] || 0), 0);
  const man = [2, 4, 9, 10, 12].reduce((s, i) => s + (r[i] || 0), 0);
  const sig = [7].reduce((s, i) => s + (r[i] || 0), 0);
  const total = comp + man + sig;

  const propComp = comp / 49;
  const propMan = man / 35;
  const propSig = sig / 7;

  const props = { compreensibilidade: propComp, maneabilidade: propMan, significancia: propSig };
  const foco = Object.entries(props).sort((a, b) => a[1] - b[1])[0][0];

  const propTotal = total / 91;
  const classif = propTotal >= 0.67 ? "Alto" : propTotal >= 0.34 ? "Médio" : "Baixo";

  return { compreensibilidade: comp, maneabilidade: man, significancia: sig, soc_total: total, classificacao: classif, dimensao_foco: foco };
}

// ─── CLAUDE API ───────────────────────────────────────────────────────────────
async function gerarDiagnostico(perfil, soc, bemestar) {
  const prompt = `Você é um especialista em saúde do trabalhador e bem-estar de enfermeiros, com linguagem empática e acessível. Gere um relatório personalizado para este profissional:

PERFIL: Setor: ${SETORES[perfil.setor] || perfil.setor}, ${perfil.idade} anos, ${perfil.genero === "f" ? "feminino" : "masculino"}, ${perfil.tempo_profissao} anos de profissão, turno: ${perfil.turno}.

ESCORES SOC-13:
- Compreensibilidade: ${soc.compreensibilidade}/49 (${Math.round((soc.compreensibilidade / 49) * 100)}%)
- Maneabilidade: ${soc.maneabilidade}/35 (${Math.round((soc.maneabilidade / 35) * 100)}%)
- Significância: ${soc.significancia}/7 (${Math.round((soc.significancia / 7) * 100)}%)
- SOC Total: ${soc.soc_total}/91 — Classificação: ${soc.classificacao}
- Dimensão prioritária para intervenção: ${soc.dimensao_foco}

BEM-ESTAR (1-10): Físico: ${bemestar.fisico}, Emocional: ${bemestar.emocional}, Social: ${bemestar.social}, Espiritual: ${bemestar.espiritual}, Intelectual: ${bemestar.intelectual}, Ocupacional: ${bemestar.ocupacional}, Ambiental: ${bemestar.ambiental}, Financeiro: ${bemestar.financeiro}.

Escreva um relatório com EXATAMENTE esta estrutura (sem usar jargões acadêmicos, sem citar autores ou escalas pelo nome técnico):

1. INTRODUÇÃO (2-3 frases empáticas e motivadoras, personalizadas pelo setor e perfil)
2. SEUS RESULTADOS (interprete os 3 escores e o total em linguagem acessível)
3. FOCO PRIORITÁRIO (explique o impacto da dimensão "${soc.dimensao_foco}" no dia a dia deste profissional)
4. ESTRATÉGIAS PRÁTICAS (3 estratégias no formato: Nome | Foco | Como fazer | Por que funciona | Limitação)
5. PRÓXIMO PASSO (1 frase encorajando reteste após praticar as estratégias)

Seja caloroso, direto e prático. Máximo 500 palavras.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await response.json();
  return data.content?.map(b => b.text || "").join("") || "Diagnóstico não disponível.";
}

// ─── COMPONENTES UI ───────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=Source+Sans+3:wght@300;400;500;600&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --blue-900: #042C53; --blue-800: #0C447C; --blue-600: #185FA5;
    --blue-400: #378ADD; --blue-100: #B5D4F4; --blue-50: #E6F1FB;
    --teal-600: #0F6E56; --teal-400: #1D9E75; --teal-100: #9FE1CB; --teal-50: #E1F5EE;
    --amber-600: #854F0B; --amber-400: #BA7517; --amber-100: #FAC775; --amber-50: #FAEEDA;
    --gray-600: #5F5E5A; --gray-200: #B4B2A9; --gray-100: #D3D1C7; --gray-50: #F1EFE8;
    --red-600: #A32D2D; --red-100: #F7C1C1; --red-50: #FCEBEB;
  }

  body { font-family: 'Source Sans 3', sans-serif; background: #f4f7fb; color: var(--blue-900); }

  .app { min-height: 100vh; display: flex; flex-direction: column; }

  .header {
    background: var(--blue-900); color: white; padding: 1rem 2rem;
    display: flex; align-items: center; gap: 1rem;
  }
  .header-logo { font-family: 'Lora', serif; font-size: 1.5rem; font-weight: 600; }
  .header-sub { font-size: 0.8rem; opacity: 0.6; }

  .main { flex: 1; max-width: 760px; margin: 0 auto; padding: 2rem 1rem; width: 100%; }

  .card {
    background: white; border-radius: 16px; padding: 2rem;
    border: 1px solid #e0e9f5; margin-bottom: 1.5rem;
  }

  .card-title {
    font-family: 'Lora', serif; font-size: 1.3rem; color: var(--blue-900);
    margin-bottom: 0.5rem; font-weight: 600;
  }
  .card-sub { font-size: 0.9rem; color: var(--gray-600); margin-bottom: 1.5rem; }

  .progress-bar {
    height: 4px; background: var(--gray-100); border-radius: 2px; margin-bottom: 1.5rem;
  }
  .progress-fill {
    height: 100%; border-radius: 2px; background: var(--blue-400);
    transition: width 0.4s ease;
  }

  .step-label {
    font-size: 0.75rem; color: var(--gray-600); margin-bottom: 0.5rem;
    text-transform: uppercase; letter-spacing: 0.05em;
  }

  .field { margin-bottom: 1.2rem; }
  .field label {
    display: block; font-size: 0.85rem; font-weight: 500;
    color: var(--blue-800); margin-bottom: 0.4rem;
  }
  .field input, .field select {
    width: 100%; padding: 0.65rem 0.9rem; border-radius: 8px;
    border: 1.5px solid var(--gray-100); font-size: 0.95rem;
    font-family: 'Source Sans 3', sans-serif; color: var(--blue-900);
    background: #fafcff; transition: border-color 0.2s;
    outline: none;
  }
  .field input:focus, .field select:focus { border-color: var(--blue-400); }

  .fields-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 1rem; }
  @media (max-width: 500px) { .fields-grid { grid-template-columns: 1fr; } }

  .btn {
    display: inline-flex; align-items: center; gap: 0.5rem;
    padding: 0.75rem 1.75rem; border-radius: 10px; font-size: 0.95rem;
    font-weight: 600; cursor: pointer; border: none; transition: all 0.2s;
    font-family: 'Source Sans 3', sans-serif;
  }
  .btn-primary { background: var(--blue-600); color: white; }
  .btn-primary:hover { background: var(--blue-800); }
  .btn-secondary { background: var(--blue-50); color: var(--blue-800); border: 1.5px solid var(--blue-100); }
  .btn-secondary:hover { background: var(--blue-100); }
  .btn-danger { background: var(--red-50); color: var(--red-600); border: 1.5px solid var(--red-100); }
  .btn-row { display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem; flex-wrap: wrap; }

  .slider-item { margin-bottom: 1.5rem; }
  .slider-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.5rem; }
  .slider-label { font-size: 0.85rem; font-weight: 500; color: var(--blue-900); }
  .slider-val {
    font-size: 1.2rem; font-weight: 600; color: var(--blue-600);
    min-width: 2rem; text-align: right;
  }
  .slider-anchors { display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--gray-600); margin-top: 0.3rem; }

  input[type=range] {
    width: 100%; accent-color: var(--blue-600); cursor: pointer; height: 4px;
  }

  .question-block { margin-bottom: 2rem; }
  .question-num {
    font-size: 0.75rem; font-weight: 600; color: var(--blue-400);
    letter-spacing: 0.05em; margin-bottom: 0.4rem;
    text-transform: uppercase;
  }
  .question-text { font-size: 0.95rem; color: var(--blue-900); margin-bottom: 0.5rem; line-height: 1.5; }
  .question-cenario {
    font-size: 0.82rem; color: var(--gray-600); font-style: italic;
    background: var(--gray-50); padding: 0.5rem 0.75rem; border-radius: 6px;
    margin-bottom: 0.75rem; border-left: 3px solid var(--blue-100);
  }

  .soc-scale {
    display: flex; gap: 6px; flex-wrap: wrap; margin-top: 0.5rem;
  }
  .soc-btn {
    flex: 1; min-width: 36px; height: 44px;
    border: 2px solid var(--gray-100); border-radius: 8px;
    background: white; cursor: pointer; font-size: 0.95rem; font-weight: 500;
    color: var(--gray-600); transition: all 0.15s;
  }
  .soc-btn:hover { border-color: var(--blue-400); color: var(--blue-600); }
  .soc-btn.selected { background: var(--blue-600); border-color: var(--blue-600); color: white; }

  .scale-labels { display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--gray-600); margin-top: 0.35rem; }

  .score-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin: 1.5rem 0; }
  @media (max-width: 480px) { .score-grid { grid-template-columns: 1fr; } }
  .score-card {
    background: var(--blue-50); border-radius: 12px; padding: 1rem;
    border: 1px solid var(--blue-100);
  }
  .score-name { font-size: 0.75rem; font-weight: 600; color: var(--blue-600); text-transform: uppercase; letter-spacing: 0.04em; }
  .score-num { font-size: 2rem; font-weight: 600; color: var(--blue-900); font-family: 'Lora', serif; }
  .score-max { font-size: 0.8rem; color: var(--gray-600); }
  .score-bar { height: 6px; background: var(--blue-100); border-radius: 3px; margin-top: 0.5rem; }
  .score-bar-fill { height: 100%; border-radius: 3px; background: var(--blue-600); }

  .classif-badge {
    display: inline-block; padding: 0.4rem 1rem; border-radius: 20px;
    font-weight: 600; font-size: 0.9rem; margin: 0.5rem 0;
  }
  .classif-alto { background: var(--teal-50); color: var(--teal-600); border: 1px solid var(--teal-100); }
  .classif-medio { background: var(--amber-50); color: var(--amber-600); border: 1px solid var(--amber-100); }
  .classif-baixo { background: var(--red-50); color: var(--red-600); border: 1px solid var(--red-100); }

  .diagnostico-text {
    font-size: 0.92rem; line-height: 1.75; color: #2a3a4e;
    white-space: pre-wrap;
  }

  .chart-container { margin: 1rem 0; }
  .chart-bar-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
  .chart-label { font-size: 0.8rem; color: var(--gray-600); min-width: 90px; }
  .chart-bar-bg { flex: 1; height: 8px; background: var(--gray-100); border-radius: 4px; }
  .chart-bar-val { height: 100%; border-radius: 4px; background: var(--blue-400); transition: width 0.6s ease; }
  .chart-num { font-size: 0.8rem; font-weight: 600; color: var(--blue-800); min-width: 30px; }

  .history-item {
    border: 1px solid var(--gray-100); border-radius: 12px; padding: 1rem;
    margin-bottom: 0.75rem; background: #fafcff;
  }
  .history-date { font-size: 0.78rem; color: var(--gray-600); }
  .history-total { font-size: 1.3rem; font-weight: 600; color: var(--blue-900); font-family: 'Lora', serif; }

  .tcle-text {
    font-size: 0.85rem; line-height: 1.7; color: #3a4a5a;
    max-height: 260px; overflow-y: auto; background: var(--gray-50);
    padding: 1rem; border-radius: 8px; border: 1px solid var(--gray-100);
    margin-bottom: 1rem;
  }

  .alert {
    padding: 0.75rem 1rem; border-radius: 8px; font-size: 0.88rem;
    margin-bottom: 1rem;
  }
  .alert-info { background: var(--blue-50); color: var(--blue-800); border: 1px solid var(--blue-100); }
  .alert-success { background: var(--teal-50); color: var(--teal-600); border: 1px solid var(--teal-100); }
  .alert-warn { background: var(--amber-50); color: var(--amber-600); border: 1px solid var(--amber-100); }
  .alert-err { background: var(--red-50); color: var(--red-600); border: 1px solid var(--red-100); }

  .spinner {
    width: 40px; height: 40px; border: 4px solid var(--blue-100);
    border-top-color: var(--blue-600); border-radius: 50%;
    animation: spin 0.8s linear infinite; margin: 2rem auto;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .admin-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; margin-top: 1rem; }
  .admin-table th { background: var(--blue-900); color: white; padding: 0.6rem 0.8rem; text-align: left; }
  .admin-table td { padding: 0.5rem 0.8rem; border-bottom: 1px solid var(--gray-100); }
  .admin-table tr:nth-child(even) td { background: var(--blue-50); }

  .stat-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 1rem; margin: 1rem 0; }
  .stat-box { background: var(--blue-50); border-radius: 10px; padding: 0.75rem; border: 1px solid var(--blue-100); }
  .stat-num { font-size: 1.6rem; font-weight: 600; color: var(--blue-900); font-family: 'Lora', serif; }
  .stat-lbl { font-size: 0.75rem; color: var(--gray-600); }

  .nav-tabs { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
  .nav-tab {
    padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.88rem; font-weight: 500;
    cursor: pointer; border: 1.5px solid var(--gray-100); background: white;
    color: var(--gray-600); transition: all 0.2s;
  }
  .nav-tab.active { background: var(--blue-600); color: white; border-color: var(--blue-600); }
`;

// ─── TELAS ────────────────────────────────────────────────────────────────────
function TelaIdentificacao({ onIdentify }) {
  const [nome, setNome] = useState("");
  const [nasc, setNasc] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit() {
    if (!nome.trim() || !nasc) { setErr("Preencha nome e data de nascimento."); return; }
    setLoading(true); setErr("");
    const id = await sha256(nome.trim().toLowerCase() + nasc);
    onIdentify(id);
  }

  return (
    <div className="card">
      <div className="step-label">Bem-vindo</div>
      <h2 className="card-title">CoerêncIA</h2>
      <p className="card-sub">Avaliação de bem-estar e senso de coerência para profissionais de enfermagem. Seus dados são anonimizados desde o início.</p>
      {err && <div className="alert alert-err">{err}</div>}
      <div className="field">
        <label>Nome completo</label>
        <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Apenas para gerar seu código anônimo" />
      </div>
      <div className="field">
        <label>Data de nascimento</label>
        <input type="date" value={nasc} onChange={e => setNasc(e.target.value)} />
      </div>
      <div className="alert alert-info">🔒 Nome e data não são armazenados. Apenas um código anônimo é gerado.</div>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
          {loading ? "Identificando..." : "Continuar →"}
        </button>
      </div>
    </div>
  );
}

function TelaTCLE({ onConsentir, onRecusar }) {
  const [leu, setLeu] = useState(false);

  return (
    <div className="card">
      <div className="step-label">Consentimento</div>
      <h2 className="card-title">Termo de Consentimento</h2>
      <div className="tcle-text" onScroll={e => { if (e.target.scrollTop + e.target.clientHeight >= e.target.scrollHeight - 10) setLeu(true); }}>
        <strong>TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO (TCLE)</strong><br /><br />
        Você está sendo convidado(a) a participar voluntariamente de uma pesquisa sobre bem-estar e senso de coerência em enfermeiros.<br /><br />
        <strong>Objetivo:</strong> Avaliar o Senso de Coerência (SOC) de profissionais de enfermagem e propor estratégias personalizadas de bem-estar.<br /><br />
        <strong>Procedimentos:</strong> Você responderá a um questionário com 13 questões sobre como percebe e lida com situações de vida e trabalho, além de uma avaliação de bem-estar.<br /><br />
        <strong>Confidencialidade:</strong> Seus dados são identificados apenas por um código anônimo gerado localmente. Nome e data de nascimento NUNCA são armazenados. É tecnicamente impossível identificá-lo(a) a partir dos dados coletados.<br /><br />
        <strong>Riscos:</strong> Mínimos. As perguntas abordam situações cotidianas de trabalho. Você pode pausar ou desistir a qualquer momento.<br /><br />
        <strong>Benefícios:</strong> Receber um diagnóstico personalizado com estratégias práticas para melhorar seu bem-estar no trabalho.<br /><br />
        <strong>Participação voluntária:</strong> Sua participação é inteiramente voluntária. A recusa não acarreta nenhum prejuízo.<br /><br />
        <strong>Contato:</strong> Em caso de dúvidas, entre em contato com o pesquisador responsável.<br /><br />
        Ao clicar em "Concordo", você confirma que leu este termo, compreendeu seu conteúdo e consente em participar da pesquisa.
      </div>
      {!leu && <div className="alert alert-warn">📜 Role o texto acima até o final para habilitar a confirmação.</div>}
      <div className="btn-row">
        <button className="btn btn-danger" onClick={onRecusar}>Não concordo</button>
        <button className="btn btn-primary" onClick={onConsentir} disabled={!leu}>Concordo e quero participar</button>
      </div>
    </div>
  );
}

const CAMPOS_PERFIL = [
  { key: "setor", label: "Setor de atuação", type: "select", opts: Object.entries(SETORES).map(([v, l]) => ({ v, l })) },
  { key: "idade", label: "Idade (anos)", type: "number", min: 18, max: 80 },
  { key: "genero", label: "Gênero", type: "select", opts: [{ v: "f", l: "Feminino" }, { v: "m", l: "Masculino" }, { v: "outro", l: "Outro/Prefiro não informar" }] },
  { key: "formacao", label: "Formação", type: "select", opts: [{ v: "tecnico", l: "Técnico de Enfermagem" }, { v: "graduacao", l: "Graduação em Enfermagem" }, { v: "especialista", l: "Especialista" }, { v: "mestre", l: "Mestre" }, { v: "doutor", l: "Doutor" }] },
  { key: "pos_graduacao", label: "Pós-graduação?", type: "select", opts: [{ v: "sim", l: "Sim" }, { v: "nao", l: "Não" }] },
  { key: "tempo_profissao", label: "Anos na profissão", type: "number", min: 0, max: 50 },
  { key: "tempo_instituicao", label: "Anos na instituição", type: "number", min: 0, max: 50 },
  { key: "turno", label: "Turno de trabalho", type: "select", opts: [{ v: "manha", l: "Manhã" }, { v: "tarde", l: "Tarde" }, { v: "noite", l: "Noite" }, { v: "plantao12", l: "Plantão 12h" }, { v: "plantao24", l: "Plantão 24h" }] },
  { key: "carga_horaria", label: "Carga horária semanal (h)", type: "number", min: 10, max: 80 },
  { key: "vinculo", label: "Vínculo empregatício", type: "select", opts: [{ v: "clt", l: "CLT" }, { v: "estatutario", l: "Estatutário" }, { v: "pj", l: "PJ/Cooperado" }, { v: "temporario", l: "Contrato Temporário" }] },
  { key: "cargo", label: "Cargo", type: "select", opts: [{ v: "tecnico", l: "Técnico de Enfermagem" }, { v: "enfermeiro", l: "Enfermeiro Assistencial" }, { v: "coordenador", l: "Coordenador/Líder" }, { v: "gerente", l: "Gerente/Supervisor" }] },
  { key: "estado_civil", label: "Estado civil", type: "select", opts: [{ v: "solteiro", l: "Solteiro(a)" }, { v: "casado", l: "Casado(a)/União Estável" }, { v: "divorciado", l: "Divorciado(a)" }, { v: "viuvo", l: "Viúvo(a)" }] },
  { key: "filhos", label: "Tem filhos?", type: "select", opts: [{ v: "true", l: "Sim" }, { v: "false", l: "Não" }] },
];

function TelaPerfil({ onSalvar }) {
  const [dados, setDados] = useState({});
  const [err, setErr] = useState("");

  function set(k, v) { setDados(d => ({ ...d, [k]: v })); }

  function handleSalvar() {
    const faltando = CAMPOS_PERFIL.filter(c => !dados[c.key]);
    if (faltando.length) { setErr(`Preencha: ${faltando.map(c => c.label).join(", ")}`); return; }
    setErr("");
    onSalvar({ ...dados, filhos: dados.filhos === "true" });
  }

  return (
    <div className="card">
      <div className="step-label">Etapa 1 de 4</div>
      <h2 className="card-title">Seu Perfil</h2>
      <p className="card-sub">Estas informações são coletadas uma única vez e nos ajudam a personalizar sua avaliação.</p>
      {err && <div className="alert alert-err">{err}</div>}
      <div className="fields-grid">
        {CAMPOS_PERFIL.map(c => (
          <div className="field" key={c.key}>
            <label>{c.label}</label>
            {c.type === "select" ? (
              <select value={dados[c.key] || ""} onChange={e => set(c.key, e.target.value)}>
                <option value="">Selecione...</option>
                {c.opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            ) : (
              <input type="number" min={c.min} max={c.max} value={dados[c.key] || ""} onChange={e => set(c.key, e.target.value)} />
            )}
          </div>
        ))}
      </div>
      <div className="btn-row">
        <button className="btn btn-primary" onClick={handleSalvar}>Salvar e continuar →</button>
      </div>
    </div>
  );
}

const DIMS_BW = [
  { key: "fisico", label: "Físico", desc: "Energia, sono, alimentação, atividade física" },
  { key: "emocional", label: "Emocional", desc: "Como você está se sentindo emocionalmente" },
  { key: "social", label: "Social", desc: "Relações com colegas, família, amigos" },
  { key: "espiritual", label: "Espiritual", desc: "Propósito, crenças, sentido de vida" },
  { key: "intelectual", label: "Intelectual", desc: "Aprendizado, criatividade, estimulação mental" },
  { key: "ocupacional", label: "Ocupacional", desc: "Satisfação com o trabalho e carreira" },
  { key: "ambiental", label: "Ambiental", desc: "Ambiente de trabalho e vida" },
  { key: "financeiro", label: "Financeiro", desc: "Segurança e tranquilidade financeira" },
];

function TelaBemestar({ anterior, onSalvar }) {
  const [vals, setVals] = useState(Object.fromEntries(DIMS_BW.map(d => [d.key, 5])));

  return (
    <div className="card">
      <div className="step-label">Etapa 2 de 4</div>
      <h2 className="card-title">Avaliação de Bem-estar</h2>
      <p className="card-sub">Como você está se sentindo hoje em cada dimensão? (1 = muito mal, 10 = excelente)</p>
      {anterior && (
        <div className="alert alert-info">
          📊 Na sua última sessão: {DIMS_BW.map(d => `${d.label}: ${anterior[d.key]}`).join(" · ")}
        </div>
      )}
      {DIMS_BW.map(d => (
        <div className="slider-item" key={d.key}>
          <div className="slider-header">
            <span className="slider-label">{d.label} <span style={{ fontWeight: 300, color: "var(--gray-600)", fontSize: "0.8rem" }}>— {d.desc}</span></span>
            <span className="slider-val">{vals[d.key]}</span>
          </div>
          <input type="range" min="1" max="10" step="1" value={vals[d.key]}
            onChange={e => setVals(v => ({ ...v, [d.key]: Number(e.target.value) }))} />
          <div className="slider-anchors"><span>1 — Muito mal</span><span>10 — Excelente</span></div>
        </div>
      ))}
      <div className="btn-row">
        <button className="btn btn-primary" onClick={() => onSalvar(vals)}>Continuar →</button>
      </div>
    </div>
  );
}

function TelaSOC({ setor, etapa, respostas, onChange, onNext, onPrev, totalEtapas }) {
  const et = ETAPAS_SOC[etapa];
  const cenarios = CENARIOS[setor] || CENARIOS.generico;
  const progresso = ((etapa + 1) / totalEtapas) * 100;

  return (
    <div className="card">
      <div className="step-label">Questionário — Etapa {etapa + 1} de {totalEtapas}</div>
      <div className="progress-bar"><div className="progress-fill" style={{ width: `${progresso}%` }} /></div>
      <h2 className="card-title">{et.titulo}</h2>
      <p className="card-sub">{et.descricao}</p>

      {et.itens.map(num => {
        const cenario = cenarios[num - 1];
        const anc = getAncoras(num);
        return (
          <div className="question-block" key={num}>
            <div className="question-num">Questão {num}</div>
            {cenario && <div className="question-cenario">💭 {cenario}</div>}
            <div className="question-text">{PERGUNTAS_SOC[num - 1]}</div>
            <div className="soc-scale">
              {[1, 2, 3, 4, 5, 6, 7].map(v => (
                <button key={v} className={`soc-btn ${respostas[num] === v ? "selected" : ""}`}
                  onClick={() => onChange(num, v)}>{v}</button>
              ))}
            </div>
            <div className="scale-labels"><span>{anc.min}</span><span>{anc.max}</span></div>
          </div>
        );
      })}

      <div className="btn-row">
        {etapa > 0 && <button className="btn btn-secondary" onClick={onPrev}>← Voltar</button>}
        <button className="btn btn-primary"
          disabled={et.itens.some(n => !respostas[n])}
          onClick={onNext}>
          {etapa < totalEtapas - 1 ? "Próxima etapa →" : "Calcular resultado →"}
        </button>
      </div>
    </div>
  );
}

function TelaResultado({ soc, diagnostico, historico, onRetestar, perfil }) {
  const classifClass = { Alto: "alto", Médio: "medio", Baixo: "baixo" }[soc.classificacao] || "medio";

  return (
    <div>
      <div className="card">
        <div className="step-label">Resultado</div>
        <h2 className="card-title">Seu SOC Total</h2>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", margin: "0.5rem 0 1rem" }}>
          <span style={{ fontSize: "3rem", fontFamily: "Lora, serif", fontWeight: 600, color: "var(--blue-900)" }}>{soc.soc_total}</span>
          <span style={{ color: "var(--gray-600)", fontSize: "1rem" }}>/91</span>
          <span className={`classif-badge classif-${classifClass}`}>SOC {soc.classificacao}</span>
        </div>
        <div className="score-grid">
          {[
            { key: "compreensibilidade", label: "Compreensibilidade", max: 49 },
            { key: "maneabilidade", label: "Maneabilidade", max: 35 },
            { key: "significancia", label: "Significância", max: 7 },
          ].map(d => (
            <div className="score-card" key={d.key}>
              <div className="score-name">{d.label}</div>
              <div><span className="score-num">{soc[d.key]}</span> <span className="score-max">/{d.max}</span></div>
              <div className="score-bar"><div className="score-bar-fill" style={{ width: `${(soc[d.key] / d.max) * 100}%` }} /></div>
            </div>
          ))}
          <div className="score-card" style={{ background: "var(--blue-900)" }}>
            <div className="score-name" style={{ color: "var(--blue-100)" }}>Foco prioritário</div>
            <div style={{ fontSize: "1rem", fontWeight: 600, color: "white", marginTop: "0.3rem", textTransform: "capitalize" }}>{soc.dimensao_foco}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="step-label">Diagnóstico personalizado</div>
        <h2 className="card-title">Sua Avaliação</h2>
        {diagnostico ? (
          <div className="diagnostico-text">{diagnostico}</div>
        ) : (
          <div className="spinner" />
        )}
      </div>

      {historico && historico.length > 1 && (
        <div className="card">
          <h2 className="card-title">Sua Evolução</h2>
          <p className="card-sub">SOC Total ao longo das sessões</p>
          {historico.slice(-8).map((s, i) => (
            <div className="chart-bar-row" key={i}>
              <div className="chart-label">{new Date(s.data_sessao).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</div>
              <div className="chart-bar-bg">
                <div className="chart-bar-val" style={{ width: `${(s.soc_total / 91) * 100}%` }} />
              </div>
              <div className="chart-num">{s.soc_total}</div>
            </div>
          ))}
        </div>
      )}

      <div className="btn-row">
        <button className="btn btn-secondary" onClick={onRetestar}>↺ Refazer questionário</button>
      </div>
    </div>
  );
}

function TelaAdmin({ onVoltar }) {
  const [senha, setSenha] = useState("");
  const [autenticado, setAutenticado] = useState(false);
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtros, setFiltros] = useState({ setor: "", classif: "", de: "", ate: "" });
  const [stats, setStats] = useState(null);
  const [aba, setAba] = useState("stats");

  async function autenticar() {
    if (senha === ADMIN_PASSWORD) {
      setAutenticado(true);
      await carregarDados();
    }
  }

  async function carregarDados() {
    setLoading(true);
    try {
      const sessoes = await sb("GET", `sessoes?select=*,usuarios(setor,idade,genero,turno)&order=data_sessao.desc`);
      setDados(sessoes || []);
      if (sessoes && sessoes.length) {
        const totais = sessoes.map(s => s.soc_total).filter(Boolean);
        const media = totais.reduce((a, b) => a + b, 0) / totais.length;
        const dist = { Alto: 0, Médio: 0, Baixo: 0 };
        sessoes.forEach(s => { if (s.classificacao) dist[s.classificacao]++; });
        setStats({ participantes: new Set(sessoes.map(s => s.usuario_id)).size, sessoes: sessoes.length, media: Math.round(media), dist });
      }
    } finally { setLoading(false); }
  }

  function filtrar() {
    return dados.filter(s => {
      if (filtros.setor && s.usuarios?.setor !== filtros.setor) return false;
      if (filtros.classif && s.classificacao !== filtros.classif) return false;
      if (filtros.de && new Date(s.data_sessao) < new Date(filtros.de)) return false;
      if (filtros.ate && new Date(s.data_sessao) > new Date(filtros.ate)) return false;
      return true;
    });
  }

  function exportarCSV() {
    const linhas = filtrar();
    const cabecalho = "ID_Anonimo,Data,Setor,Idade,Genero,Turno,Comp,Man,Sig,SOC_Total,Classificacao,Foco";
    const corpo = linhas.map(s =>
      [s.usuario_id?.slice(0, 8), new Date(s.data_sessao).toLocaleDateString("pt-BR"),
       s.usuarios?.setor, s.usuarios?.idade, s.usuarios?.genero, s.usuarios?.turno,
       s.compreensibilidade, s.maneabilidade, s.significancia, s.soc_total,
       s.classificacao, s.dimensao_foco].join(",")
    ).join("\n");
    const blob = new Blob([`${cabecalho}\n${corpo}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "coerencia_dados.csv"; a.click();
  }

  if (!autenticado) return (
    <div className="card">
      <div className="step-label">Acesso Restrito</div>
      <h2 className="card-title">Painel Administrativo</h2>
      <p className="card-sub">Acesso exclusivo para o pesquisador responsável.</p>
      <div className="field">
        <label>Senha</label>
        <input type="password" value={senha} onChange={e => setSenha(e.target.value)}
          onKeyDown={e => e.key === "Enter" && autenticar()} />
      </div>
      <div className="btn-row">
        <button className="btn btn-secondary" onClick={onVoltar}>← Voltar</button>
        <button className="btn btn-primary" onClick={autenticar}>Entrar</button>
      </div>
    </div>
  );

  const filtrados = filtrar();

  return (
    <div>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 className="card-title" style={{ marginBottom: 0 }}>Painel do Pesquisador</h2>
          <button className="btn btn-secondary" onClick={onVoltar} style={{ fontSize: "0.82rem" }}>← Sair</button>
        </div>
      </div>

      <div className="nav-tabs">
        {[["stats", "Estatísticas"], ["dados", "Dados"], ["filtros", "Filtros"]].map(([k, l]) => (
          <button key={k} className={`nav-tab ${aba === k ? "active" : ""}`} onClick={() => setAba(k)}>{l}</button>
        ))}
        <button className="btn btn-secondary" style={{ marginLeft: "auto" }} onClick={exportarCSV}>⬇ Exportar CSV</button>
      </div>

      {loading && <div className="spinner" />}

      {aba === "stats" && stats && (
        <div className="card">
          <div className="stat-row">
            <div className="stat-box"><div className="stat-num">{stats.participantes}</div><div className="stat-lbl">Participantes</div></div>
            <div className="stat-box"><div className="stat-num">{stats.sessoes}</div><div className="stat-lbl">Sessões</div></div>
            <div className="stat-box"><div className="stat-num">{stats.media}</div><div className="stat-lbl">Média SOC Total</div></div>
          </div>
          <p style={{ fontSize: "0.85rem", fontWeight: 500, margin: "1rem 0 0.5rem" }}>Distribuição de classificações</p>
          {Object.entries(stats.dist).map(([k, v]) => (
            <div className="chart-bar-row" key={k}>
              <div className="chart-label">{k}</div>
              <div className="chart-bar-bg"><div className="chart-bar-val" style={{ width: `${stats.sessoes ? (v / stats.sessoes) * 100 : 0}%` }} /></div>
              <div className="chart-num">{v}</div>
            </div>
          ))}
        </div>
      )}

      {aba === "filtros" && (
        <div className="card">
          <div className="fields-grid">
            <div className="field">
              <label>Setor</label>
              <select value={filtros.setor} onChange={e => setFiltros(f => ({ ...f, setor: e.target.value }))}>
                <option value="">Todos</option>
                {Object.entries(SETORES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Classificação SOC</label>
              <select value={filtros.classif} onChange={e => setFiltros(f => ({ ...f, classif: e.target.value }))}>
                <option value="">Todas</option>
                {["Alto", "Médio", "Baixo"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Data inicial</label>
              <input type="date" value={filtros.de} onChange={e => setFiltros(f => ({ ...f, de: e.target.value }))} />
            </div>
            <div className="field">
              <label>Data final</label>
              <input type="date" value={filtros.ate} onChange={e => setFiltros(f => ({ ...f, ate: e.target.value }))} />
            </div>
          </div>
          <div className="alert alert-info">{filtrados.length} sessão(ões) encontrada(s) com os filtros atuais.</div>
        </div>
      )}

      {aba === "dados" && (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th><th>Data</th><th>Setor</th><th>Comp</th>
                <th>Man</th><th>Sig</th><th>Total</th><th>Class.</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.slice(0, 100).map((s, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: "monospace" }}>{s.usuario_id?.slice(0, 8)}…</td>
                  <td>{new Date(s.data_sessao).toLocaleDateString("pt-BR")}</td>
                  <td>{SETORES[s.usuarios?.setor] || s.usuarios?.setor || "-"}</td>
                  <td>{s.compreensibilidade}</td>
                  <td>{s.maneabilidade}</td>
                  <td>{s.significancia}</td>
                  <td><strong>{s.soc_total}</strong></td>
                  <td><span className={`classif-badge classif-${{ Alto: "alto", Médio: "medio", Baixo: "baixo" }[s.classificacao]}`} style={{ fontSize: "0.75rem", padding: "2px 8px" }}>{s.classificacao}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtrados.length > 100 && <p style={{ fontSize: "0.8rem", color: "var(--gray-600)", marginTop: "0.5rem" }}>Exibindo 100 de {filtrados.length}. Use Exportar CSV para ver todos.</p>}
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
  const [bemestarAnterior, setBemestarAnterior] = useState(null);
  const [bemestarAtual, setBemestarAtual] = useState(null);
  const [etapaSOC, setEtapaSOC] = useState(0);
  const [respostas, setRespostas] = useState({});
  const [resultadoSOC, setResultadoSOC] = useState(null);
  const [diagnostico, setDiagnostico] = useState(null);
  const [historicoSessoes, setHistoricoSessoes] = useState([]);
  const [sessaoAtualId, setSessaoAtualId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  async function handleIdentify(id) {
    setUserId(id);
    setLoading(true);
    setErro("");
    try {
      const usuarios = await sb("GET", `usuarios?id=eq.${id}&select=*`);
      if (usuarios && usuarios.length > 0) {
        const u = usuarios[0];
        if (!u.consentimento) { setTela("tcle"); return; }
        setPerfil(u);
        setPrimeiroAcesso(false);
        const sessoes = await sb("GET", `sessoes?usuario_id=eq.${id}&order=data_sessao.desc`);
        setHistoricoSessoes(sessoes || []);
        const bws = await sb("GET", `bemestar?usuario_id=eq.${id}&order=data_avaliacao.desc&limit=1`);
        if (bws && bws.length) setBemestarAnterior(bws[0]);
        setTela("bemestar");
      } else {
        setPrimeiroAcesso(true);
        setTela("tcle");
      }
    } catch (e) {
      setErro("Erro ao verificar participante. Verifique as configurações do Supabase.");
    } finally { setLoading(false); }
  }

  async function handleConsentir() {
    try {
      if (primeiroAcesso) {
        await sb("POST", "usuarios", { id: userId, consentimento: true, data_consentimento: new Date().toISOString() });
      } else {
        await sb("PATCH", `usuarios?id=eq.${userId}`, { consentimento: true, data_consentimento: new Date().toISOString() });
      }
      setTela("perfil");
    } catch (e) {
      if (!primeiroAcesso) setTela("perfil");
      else setErro("Erro ao registrar consentimento.");
    }
  }

  async function handleSalvarPerfil(dados) {
    try {
      const payload = { ...dados, id: userId };
      await sb("POST", "usuarios", payload).catch(() =>
        sb("PATCH", `usuarios?id=eq.${userId}`, dados)
      );
      setPerfil({ ...payload });
      setTela("bemestar");
    } catch (e) {
      setErro("Erro ao salvar perfil. Verifique o Supabase.");
    }
  }

  async function handleSalvarBemestar(vals) {
    setBemestarAtual(vals);
    setTela("soc");
  }

  function handleSOCChange(num, val) {
    setRespostas(r => ({ ...r, [num]: val }));
  }

  async function handleFinalizarSOC() {
    const soc = calcularSOC(respostas);
    setResultadoSOC(soc);
    setTela("resultado");

    const sessao = {
      usuario_id: userId,
      data_sessao: new Date().toISOString(),
      ...Object.fromEntries(Object.entries(respostas).map(([k, v]) => [`r${k}`, v])),
      ...soc,
    };

    try {
      const novasSessoes = await sb("POST", "sessoes", sessao);
      const sessaoId = novasSessoes?.[0]?.id;
      setSessaoAtualId(sessaoId);

      if (bemestarAtual && sessaoId) {
        await sb("POST", "bemestar", { usuario_id: userId, sessao_id: sessaoId, ...bemestarAtual });
      }

      const todasSessoes = await sb("GET", `sessoes?usuario_id=eq.${userId}&order=data_sessao.asc`);
      setHistoricoSessoes(todasSessoes || []);
    } catch (e) { /* dados locais já disponíveis */ }

    const diag = await gerarDiagnostico(perfil || {}, soc, bemestarAtual || {});
    setDiagnostico(diag);

    if (sessaoAtualId) {
      try { await sb("PATCH", `sessoes?id=eq.${sessaoAtualId}`, { diagnostico: diag }); } catch { }
    }
  }

  function handleRetestar() {
    setRespostas({});
    setEtapaSOC(0);
    setResultadoSOC(null);
    setDiagnostico(null);
    setTela("bemestar");
  }

  const progresso = {
    identificacao: 0, tcle: 10, perfil: 20, bemestar: 40,
    soc: 55 + etapaSOC * 10, resultado: 100,
  }[tela] || 0;

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <header className="header">
          <div>
            <div className="header-logo">🩺 CoerêncIA</div>
            <div className="header-sub">Bem-estar em Enfermagem</div>
          </div>
          {tela !== "admin" && (
            <button className="btn" style={{ marginLeft: "auto", fontSize: "0.78rem", padding: "0.4rem 0.8rem", color: "rgba(255,255,255,0.6)", background: "transparent", border: "1px solid rgba(255,255,255,0.2)" }}
              onClick={() => setTela("admin")}>Painel admin</button>
          )}
        </header>

        <main className="main">
          {tela !== "identificacao" && tela !== "admin" && (
            <div style={{ marginBottom: "1rem" }}>
              <div className="progress-bar" style={{ marginBottom: "0.25rem" }}>
                <div className="progress-fill" style={{ width: `${progresso}%` }} />
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--gray-600)", textAlign: "right" }}>{progresso}% completo</div>
            </div>
          )}

          {erro && <div className="alert alert-err">{erro} <button style={{ marginLeft: "0.5rem", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }} onClick={() => setErro("")}>✕</button></div>}
          {loading && <div className="spinner" />}

          {!loading && tela === "identificacao" && <TelaIdentificacao onIdentify={handleIdentify} />}
          {!loading && tela === "tcle" && <TelaTCLE onConsentir={handleConsentir} onRecusar={() => setTela("identificacao")} />}
          {!loading && tela === "perfil" && <TelaPerfil onSalvar={handleSalvarPerfil} />}
          {!loading && tela === "bemestar" && <TelaBemestar anterior={bemestarAnterior} onSalvar={handleSalvarBemestar} />}
          {!loading && tela === "soc" && (
            <TelaSOC
              setor={perfil?.setor || "generico"}
              etapa={etapaSOC}
              respostas={respostas}
              onChange={handleSOCChange}
              totalEtapas={ETAPAS_SOC.length}
              onNext={() => {
                if (etapaSOC < ETAPAS_SOC.length - 1) setEtapaSOC(e => e + 1);
                else handleFinalizarSOC();
              }}
              onPrev={() => setEtapaSOC(e => e - 1)}
            />
          )}
          {tela === "resultado" && resultadoSOC && (
            <TelaResultado
              soc={resultadoSOC}
              diagnostico={diagnostico}
              historico={historicoSessoes}
              onRetestar={handleRetestar}
              perfil={perfil}
            />
          )}
          {tela === "admin" && <TelaAdmin onVoltar={() => setTela("identificacao")} />}
        </main>
      </div>
    </>
  );
}
