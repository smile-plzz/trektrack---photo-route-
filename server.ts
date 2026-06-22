import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Route for Gemini
  app.post("/api/trek-narrative", async (req, res) => {
    try {
      const { photos } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API Key not configured" });
      }

      const genAI = new GoogleGenAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      // Build a prompt based on trek data
      const trekStats = photos.map((p: any) => ({
        name: p.name,
        lat: p.location?.lat,
        lng: p.location?.lng,
        alt: p.location?.alt,
        time: p.location?.timestamp,
        camera: p.camera?.model
      }));

      const prompt = `
        You are a world-class Expedition Director and Topographic Analyst. 
        I am providing you with a dataset of photos from a trek, including GPS coordinates, altitudes, timestamps, and camera metadata:
        ${JSON.stringify(trekStats, null, 2)}

        Analyze this journey with extreme precision.
        
        Return your response in this EXACT JSON format (no other text):
        {
          "narrative": "A compelling 2-paragraph tactical log of the journey...",
          "milestones": [
            {"label": "Highest Point", "value": "Altitude in meters", "icon": "Mountain"},
            {"label": "Steepest Push", "value": "Description of the hardest segment", "icon": "Activity"},
            {"label": "Primary Gear", "value": "Make and model of the main camera", "icon": "Camera"}
          ],
          "expertInsights": [
            "Expert tip 1 regarding gear or terrain",
            "Expert tip 2 regarding timing or weather",
            "Expert tip 3 regarding photography"
          ]
        }
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text();
      // Remove any markdown code blocks if the model included them
      text = text.replace(/```json|```/g, "");
      res.json(JSON.parse(text));
    } catch (error: any) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: error.message });
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
