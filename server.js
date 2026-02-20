import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;

const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || "").trim();
const SERVICE_TOKEN = String(process.env.SERVICE_TOKEN || "").trim();

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

function extractToken(req) {
  const auth = String(req.headers.authorization || "").trim();
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const x = String(req.headers["x-service-token"] || "").trim();
  if (x) return x;
  return "";
}

function requireAuth(req, res, next) {
  if (!SERVICE_TOKEN) return res.status(500).json({ ok: false, error: "SERVICE_TOKEN não configurado." });
  const got = extractToken(req);
  if (!got || got !== SERVICE_TOKEN) return res.status(401).json({ ok: false, error: "Não autorizado." });
  next();
}

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "horasecreta-ai",
    ts: Date.now(),
    hasServiceToken: Boolean(SERVICE_TOKEN),
    serviceTokenLen: SERVICE_TOKEN ? SERVICE_TOKEN.length : 0,
    hasOpenAIKey: Boolean(OPENAI_API_KEY),
  });
});

function buildSystem(mode) {
  const isBiblico = (String(mode || "biblico").toLowerCase() === "biblico");

  return [
    "Você é o Conselheiro do Recomeço do projeto Hora Secreta.",
    "Responda em português do Brasil, com acolhimento, clareza e firmeza.",
    "Seja objetivo: no máximo 12 a 16 linhas no total.",
    "",
    "FORMATO OBRIGATÓRIO (use exatamente estes títulos):",
    "1) Entendimento da crise",
    "2) Direcionamento",
    isBiblico ? "3) Fundamento bíblico (1 a 2 referências curtas)" : "3) Fundamento (sem linguagem religiosa)",
    "4) Passo prático para hoje (3 passos curtos)",
    isBiblico ? "5) Oração guiada (curta)" : "5) Respiração/oração (neutro e curto)",
    "6) Declaração final de recomeço (1 frase forte)",
    "",
    "REGRAS:",
    "- Não invente fatos.",
    "- Não prometa milagres.",
    "- Evite textos longos.",
  ].join("\n");
}

async function callOpenAI(model, system, user, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await openai.responses.create(
      {
        model,
        input: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_output_tokens: model === "gpt-5-mini" ? 420 : 380,
      },
      { signal: controller.signal }
    );

    const text = String(resp?.output_text || "").trim();
    return { ok: Boolean(text), text, error: text ? "" : "OpenAI retornou vazio." };
  } finally {
    clearTimeout(t);
  }
}

app.post("/advisor", requireAuth, async (req, res) => {
  try {
    if (!OPENAI_API_KEY) return res.status(500).json({ ok: false, error: "OPENAI_API_KEY não configurada." });

    const message = String(req.body?.message || "").trim();
    const mode = String(req.body?.mode || "biblico").trim().toLowerCase();

    if (!message || message.length < 5) return res.status(400).json({ ok: false, error: "Mensagem muito curta." });
    if (message.length > 2000) return res.status(400).json({ ok: false, error: "Mensagem muito longa (máx 2000)." });

    const system = buildSystem(mode);
    const user = `Mensagem do usuário:\n${message}`;

    // 🔥 Tenta gpt-5-mini (até 18s)
    let r = await callOpenAI("gpt-5-mini", system, user, 18000);
    if (r.ok) return res.json({ ok: true, text: r.text, model: "gpt-5-mini" });

    // ⚡ fallback rápido (até 12s)
    r = await callOpenAI("gpt-4o-mini", system, user, 12000);
    if (r.ok) return res.json({ ok: true, text: r.text, model: "gpt-4o-mini" });

    return res.status(502).json({ ok: false, error: r.error || "Falha ao gerar resposta." });

  } catch (err) {
    const msg = String(err?.message || err || "Erro desconhecido");
    if (msg.toLowerCase().includes("aborted") || msg.toLowerCase().includes("abort")) {
      return res.status(504).json({ ok: false, error: "Timeout no microserviço." });
    }
    console.error(err);
    return res.status(500).json({ ok: false, error: msg });
  }
});

app.listen(PORT, () => console.log("horasecreta-ai on", PORT));
