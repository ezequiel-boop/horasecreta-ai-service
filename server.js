import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

function getServiceToken() {
  // ✅ tenta ler de vários nomes (caso você tenha criado com nome diferente)
  const t =
    process.env.SERVICE_TOKEN ||
    process.env.HS_AI_TOKEN ||
    process.env.API_TOKEN ||
    "";
  return String(t || "").trim();
}

function extractToken(req) {
  // 1) Authorization: Bearer <token>
  const auth = String(req.headers.authorization || "").trim();
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  // 2) X-Service-Token: <token>
  const x = String(req.headers["x-service-token"] || "").trim();
  if (x) return x;

  return "";
}

function requireAuth(req, res, next) {
  const expected = getServiceToken();
  if (!expected) {
    return res.status(500).json({ ok: false, error: "SERVICE_TOKEN não configurado no servidor." });
  }

  const got = extractToken(req);

  if (!got) {
    return res.status(401).json({ ok: false, error: "Não autorizado." });
  }

  // comparação simples (ok para token). Se quiser constante no futuro, fazemos.
  if (got !== expected) {
    return res.status(401).json({ ok: false, error: "Não autorizado." });
  }

  next();
}

app.get("/health", (req, res) => {
  const expected = getServiceToken();
  res.json({
    ok: true,
    service: "horasecreta-ai",
    ts: Date.now(),
    hasServiceToken: Boolean(expected),
    serviceTokenLen: expected ? expected.length : 0,
    hasOpenAIKey: Boolean(String(process.env.OPENAI_API_KEY || "").trim()),
  });
});

// ✅ rota de diagnóstico SEM vazar token: mostra se o header está chegando e tamanho
app.get("/debug-auth", (req, res) => {
  const expected = getServiceToken();
  const got = extractToken(req);

  res.json({
    ok: true,
    hasAuthHeader: Boolean(req.headers.authorization),
    hasXServiceToken: Boolean(req.headers["x-service-token"]),
    gotLen: got ? got.length : 0,
    expectedLen: expected ? expected.length : 0,
    match: Boolean(got && expected && got === expected),
  });
});

// --------- SUA ROTA PRINCIPAL ----------
app.post("/advisor", requireAuth, async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();
    const mode = String(req.body?.mode || "biblico").trim();

    if (!message) {
      return res.status(400).json({ ok: false, error: "Mensagem vazia." });
    }

    // Aqui você chama a OpenAI (se já tiver implementado no seu projeto)
    // Exemplo: const text = await buildAdvisorReply(message, mode);
    // return res.json({ ok: true, text });

    return res.json({
      ok: true,
      text:
        `1) **Entendimento da crise**\n` +
        `Recebi sua mensagem (${mode}).\n\n` +
        `2) **Direcionamento**\n` +
        `...\n`,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "Erro interno no serviço." });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("horasecreta-ai on", port));
