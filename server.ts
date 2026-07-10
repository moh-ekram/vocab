import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Gemini Client
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API Route for generating fixed example sentences
  app.post("/api/sentences", async (req, res) => {
    try {
      const { word, meaning } = req.body;
      if (!word) {
        return res.status(400).json({ error: "Word is required" });
      }

      // Check if API key is present
      if (!process.env.GEMINI_API_KEY) {
        return res.json({
          sentences: [
            `Please configure your **GEMINI_API_KEY** under Settings to see real example sentences with the word **${word}**.`,
            `The word **${word}** means "${meaning || ''}" in Bengali.`
          ]
        });
      }

      const prompt = `You are an expert English teacher. Write exactly 2 clear, simple, and natural English example sentences for the vocabulary word "${word}" (which means "${meaning || ''}" in Bengali).
The sentences should help a Bengali-speaking student understand how to use this word in daily conversation or academic contexts.
In each sentence, the word "${word}" (or its inflected forms like plural, past tense, third-person singular, etc. e.g. if the word is "Abound", you can use "abounded", "abounding", "abounds" or "abound") MUST be enclosed in double asterisks so it appears bolded in markdown, e.g., "**${word}**".

Return the response in JSON format matching this schema:
{
  "sentences": ["sentence 1", "sentence 2"]
}
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const responseText = response.text || "{}";
      const result = JSON.parse(responseText.trim());

      res.json({
        sentences: result.sentences || [
          `This is an example sentence featuring the word **${word}**.`
        ]
      });
    } catch (error: any) {
      console.error("Error generating sentences with Gemini:", error);
      res.status(500).json({ error: error.message || "Failed to generate sentences" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
