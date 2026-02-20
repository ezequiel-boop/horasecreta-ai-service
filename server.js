import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/advisor", async (req, res) => {
  try {
    const { message } = req.body;

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content: "Você é o Conselheiro do Recomeço do Hora Secreta. Responda de forma espiritual, estruturada e pastoral."
        },
        {
          role: "user",
          content: message
        }
      ],
      max_output_tokens: 500
    });

    const text = response.output_text;

    res.json({ ok: true, text });

  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: "Erro na IA" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
