import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || ""; // token seu (obrigatório)

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

function getBearerToken(req) {
  const h = req.headers["authorization"] || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : "";
}

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "horasecreta-ai", ts: Date.now() });
});

app.post("/advisor", async (req, res) => {
  try {
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ ok: false, error: "OPENAI_API_KEY não configurada." });
    }
    if (!SERVICE_TOKEN) {
      return res.status(500).json({ ok: false, error: "SERVICE_TOKEN não configurado." });
    }

    // 🔐 Segurança: exige Bearer token
    const token = getBearerToken(req);
    if (token !== SERVICE_TOKEN) {
      return res.status(401).json({ ok: false, error: "Não autorizado." });
    }

    const message = String(req.body?.message ?? "").trim();
    const mode = String(req.body?.mode ?? "biblico").trim().toLowerCase();

    if (!message || message.length < 5) {
      return res.status(400).json({ ok: false, error: "Mensagem muito curta." });
    }
    if (message.length > 2000) {
      return res.status(400).json({ ok: false, error: "Mensagem muito longa (máx 2000)." });
    }

    const system = [
      "Você é o Conselheiro do Recomeço do projeto Hora Secreta.",
      "Responda em português (Brasil), com tom pastoral, respeitoso e prático.",
      "Formato fixo (com títulos numerados):",
      "1) Entendimento da crise",
      "2) Direcionamento",
      "3) Fundamento bíblico (1 a 2 referências, sem citar textos longos)",
      "4) Passo prático para hoje (3 passos curtos)",
      "5) Oração guiada (curta)",
      "6) Declaração final de recomeço (1 frase)",
      "Seja objetivo: no máximo 14 linhas no total.",
      "Nunca incentive atitudes perigosas.",
    ].join("\n");

    const userPrefix =
      mode === "biblico"
        ? "Modo: Bíblico.\n"
        : "Modo: Neutro (sem linguagem religiosa explícita, mas ainda acolhedor e prático).\n";

    // ⏱️ Timeout interno (pra não travar a requisição)
    const controller = new AbortController();
    const timeoutMs = 25000; // 25s
    const t = setTimeout(() => controller.abort(), timeoutMs);

    let resp;
    try {
      resp = await openai.responses.create(
        {
          model: "gpt-5-mini",
          input: [
            { role: "system", content: system },
            { role: "user", content: userPrefix + message },
          ],
          max_output_tokens: 420
        },
        { signal: controller.signal }
      );
    } finally {
      clearTimeout(t);
    }

    const text = (resp?.output_text || "").trim();

    if (!text) {
      return res.status(502).json({ ok: false, error: "OpenAI retornou vazio." });
    }

    return res.json({ ok: true, text });

  } catch (err) {
    const msg = String(err?.message || err || "Erro desconhecido");
    // AbortController timeout
    if (msg.toLowerCase().includes("aborted") || msg.toLowerCase().includes("abort")) {
      return res.status(504).json({ ok: false, error: "Timeout no microserviço." });
    }
    console.error(err);
    return res.status(500).json({ ok: false, error: msg });
  }
});

app.listen(PORT, () => {
  console.log(`horasecreta-ai-service on :${PORT}`);
});
