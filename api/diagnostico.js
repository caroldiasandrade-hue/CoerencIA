export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { perfil, soc, bemestar } = req.body;

  const prompt = `Você é um especialista em saúde do trabalhador, com linguagem empática e acessível. Gere um relatório personalizado para este enfermeiro(a):

PERFIL: Setor: ${perfil?.setor||"não informado"}, Faixa etária: ${perfil?.idade||"-"}, Sexo: ${perfil?.sexo||"-"}, Categoria: ${perfil?.categoria||"-"}, Turno: ${perfil?.turno||"-"}, Tempo na profissão: ${perfil?.tempo_profissao||"-"}.

BEM-ESTAR (1=Muito ruim a 5=Muito boa): Alimentação: ${bemestar?.alimentacao}, Sono: ${bemestar?.sono}, Saúde mental: ${bemestar?.saude_mental}, Convívio familiar: ${bemestar?.convivio_familiar}, Rede de apoio: ${bemestar?.rede_apoio}, Lazer: ${bemestar?.lazer}, Atividade física: ${bemestar?.atividade_fisica}, Satisfação com a vida: ${bemestar?.satisfacao_vida}.

SOC-13: Compreensibilidade: ${soc?.compreensibilidade}/49, Maneabilidade: ${soc?.maneabilidade}/35, Significância: ${soc?.significancia}/7, Total: ${soc?.soc_total}/91 — ${soc?.classificacao}. Dimensão prioritária: ${soc?.dimensao_foco}.

Escreva um relatório com esta estrutura exata:

1. INTRODUÇÃO (2 frases acolhedoras e motivadoras)
2. SEUS RESULTADOS (interprete os escores em linguagem acessível, sem citar nomes técnicos de escalas)
3. PONTO DE ATENÇÃO (explique o impacto da dimensão "${soc?.dimensao_foco}" na vida desta pessoa)
4. ESTRATÉGIAS PRÁTICAS (exatamente 3 estratégias, cada uma com: Nome | Como fazer | Por que ajuda)
5. PRÓXIMO PASSO (1 frase encorajadora)

Escreva em português brasileiro. Seja caloroso, direto e prático. Máximo 450 palavras.`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-70b-versatile",
        max_tokens: 1000,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: "Você é um especialista em saúde do trabalhador que escreve relatórios personalizados em português brasileiro para enfermeiros, com linguagem empática, acessível e motivadora."
          },
          {
            role: "user",
            content: prompt
          }
        ],
      }),
    });

    const data = await response.json();
    const texto = data.choices?.[0]?.message?.content || "Diagnóstico não disponível.";
    res.status(200).json({ diagnostico: texto });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
