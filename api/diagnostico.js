export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { perfil, soc, bemestar, socAnterior, isRetorno } = req.body;

  let prompt;

  if (isRetorno && socAnterior) {
    // PROMPT DO 2º MOMENTO — diagnóstico comparativo
    const delta = soc.soc_total - socAnterior.soc_total;
    const deltaComp = soc.compreensibilidade - (socAnterior.compreensibilidade || 0);
    const deltaMan  = soc.maneabilidade     - (socAnterior.maneabilidade     || 0);
    const deltaSig  = soc.significancia     - (socAnterior.significancia      || 0);
    const sinal = n => n > 0 ? `+${n}` : `${n}`;

    prompt = `Você é um especialista em saúde do trabalhador com linguagem empática e acessível. Gere um relatório comparativo de evolução para este enfermeiro(a) que concluiu um período de intervenção.

PERFIL: Setor: ${perfil?.setor||"não informado"}, Faixa etária: ${perfil?.idade||"-"}, Sexo: ${perfil?.sexo||"-"}, Turno: ${perfil?.turno||"-"}.

RESULTADOS — 1ª AVALIAÇÃO (pré-intervenção):
- Compreensibilidade: ${socAnterior.compreensibilidade}/49
- Maneabilidade: ${socAnterior.maneabilidade}/35
- Significância: ${socAnterior.significancia}/7
- SOC Total: ${socAnterior.soc_total}/91 — ${socAnterior.classificacao}

RESULTADOS — 2ª AVALIAÇÃO (pós-intervenção):
- Compreensibilidade: ${soc.compreensibilidade}/49 (${sinal(deltaComp)} pontos)
- Maneabilidade: ${soc.maneabilidade}/35 (${sinal(deltaMan)} pontos)
- Significância: ${soc.significancia}/7 (${sinal(deltaSig)} pontos)
- SOC Total: ${soc.soc_total}/91 — ${soc.classificacao} (${sinal(delta)} pontos)

Escreva um relatório comparativo com esta estrutura exata (sem usar nomes técnicos de escalas ou instrumentos):

1. EVOLUÇÃO GERAL
Interprete a mudança no escore total de forma clara e empática. Se houve melhora, celebre. Se ficou igual ou reduziu, normalize e encoraje sem minimizar.

2. DIMENSÃO A DIMENSÃO
Compare cada uma das três dimensões entre as duas avaliações. Destaque o que melhorou, o que se manteve e o que ainda merece atenção. Seja específico mas acessível.

3. MENSAGEM FINAL
Uma mensagem calorosa de encerramento reconhecendo o esforço de participar da pesquisa, lembrando que o autoconhecimento é um processo contínuo e que cada passo conta. Máximo 3 frases.

Seja direto, empático e objetivo. Máximo 350 palavras. Escreva em português brasileiro.`;

  } else {
    // PROMPT DO 1º MOMENTO — diagnóstico individual
    prompt = `Você é um especialista em saúde do trabalhador com linguagem empática e acessível. Gere um diagnóstico personalizado e breve para este enfermeiro(a):

PERFIL: Setor: ${perfil?.setor||"não informado"}, Faixa etária: ${perfil?.idade||"-"}, Sexo: ${perfil?.sexo||"-"}, Categoria: ${perfil?.categoria||"-"}, Turno: ${perfil?.turno||"-"}, Tempo na profissão: ${perfil?.tempo_profissao||"-"}.

BEM-ESTAR (1=Muito ruim, 5=Muito boa): Alimentação: ${bemestar?.alimentacao}, Sono: ${bemestar?.sono}, Saúde mental: ${bemestar?.saude_mental}, Convívio familiar: ${bemestar?.convivio_familiar}, Rede de apoio: ${bemestar?.rede_apoio}, Lazer: ${bemestar?.lazer}, Atividade física: ${bemestar?.atividade_fisica}, Satisfação com a vida: ${bemestar?.satisfacao_vida}.

SOC: Compreensibilidade: ${soc.compreensibilidade}/49, Maneabilidade: ${soc.maneabilidade}/35, Significância: ${soc.significancia}/7, Total: ${soc.soc_total}/91 — ${soc.classificacao}. Dimensão prioritária: ${soc.dimensao_foco}.

Escreva com esta estrutura exata (sem citar nomes de escalas ou instrumentos):

1. INTRODUÇÃO
2 frases acolhedoras e motivadoras personalizadas pelo setor e perfil.

2. SEUS RESULTADOS
Interprete os escores das três dimensões e o total em linguagem acessível. Seja específico mas breve.

3. PONTO DE ATENÇÃO
Explique de forma simples o impacto da dimensão "${soc.dimensao_foco}" na vida desta pessoa. 2-3 frases.

4. PRÓXIMO PASSO
1 frase encorajadora sobre praticar as estratégias sugeridas.

Seja caloroso, direto e objetivo. Máximo 300 palavras. Escreva em português brasileiro.`;
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 800,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: "Você é um especialista em saúde do trabalhador que escreve relatórios em português brasileiro com linguagem empática, acessível e motivadora. Nunca cite nomes técnicos de escalas ou instrumentos de pesquisa.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const texto = data.choices?.[0]?.message?.content || "Diagnóstico não disponível.";
    res.status(200).json({ diagnostico: texto });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
