import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK lazily to avoid crashes if API key is not yet set
let aiClient: GoogleGenAI | null = null;
function getGenAI() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not defined. Gemini client will not be initialized.");
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'sr88-simulator',
        }
      }
    });
  }
  return aiClient;
}

// REST API for Quantum Pulse & Physics Optimization
app.post("/api/quantum-copilot", async (req, res) => {
  try {
    const { prompt, context } = req.body;
    if (!prompt) {
       res.status(400).json({ error: "Missing prompt parameter." });
       return;
    }

    const ai = getGenAI();
    if (!ai) {
       res.json({
         text: "The Gemini API Key is missing. Please set GEMINI_API_KEY in your environment variables.\n\nHere is a default high-quality response:\n\nFor Strontium-88 fine-tuned excitation, the 5s² ¹S₀ → 5s5p ³P₁ transition is situated at 689 nm, with a very narrow linewidth (~7.5 kHz) which is perfect for ultra-precise intermediate state preparation before multi-photon Rydberg excitation (e.g. at 319 nm to target Rydberg n-S or n-D manifolds). To minimize Stark noise during circular state microwave Rabi climbing (transitions around 30-50 GHz for n=50), consider utilizing a secondary feedback electrode array designed to zero out background DC field fluctuations down to < 10 V/m.",
         pythonCode: `# Mock optimized transition script (QuTiP example)
import qutip as qt
import numpy as np

# Ground |g>, Intermediate |e>, Rydberg |r>
g = qt.basis(3, 0)
e = qt.basis(3, 1)
r = qt.basis(3, 2)

# Hamiltonian parameters (in MHz)
Omega_1 = 2 * np.pi * 5.0  # 1st step Rabi
Omega_2 = 2 * np.pi * 2.0  # 2nd step Rabi
Delta = 2 * np.pi * 0.0    # Intermediate detuning

H0 = Delta * e * e.dag()
H1 = 0.5 * Omega_1 * (g * e.dag() + e * g.dag()) + 0.5 * Omega_2 * (e * r.dag() + r * e.dag())
print("Pulse Hamiltonian initialized successfully (No API Key Mode)")
`
       });
       return;
    }

    const systemInstruction = `You are an elite, senior Atomic, Molecular, and Optical (AMO) physicist and scientific software architect specializing in Strontium-88 circular Rydberg state engineering, microwave circularization, and open systems dynamics.
Your goal is to assist researchers in:
1. Designing microwave adiabatic transfer and STIRAP pulse schemes to climb Rydberg state ladders (e.g., from low-l s-state or d-state through p-states up to the circular state l = n-1, m = n-1).
2. Optimizing trapping parameters (optical tweezer depths, trapping frequencies, polarizabilities, and magic wavelengths).
3. Analyzing Stark and Zeeman splittings or avoided crossings in electric and magnetic fields.
4. Correcting decoherence channels in Lindblad master equation solvers (BBR, spontaneous decay, phase noise).

Respond in JSON format with two keys:
1. "text": Detailed, high-grade physical analysis, calculations, design formulations, reference literature citations (Kleppner, Haroche, Raimond, Browaeys, etc.), and step-by-step guidance.
2. "pythonCode": Working, production-ready, highly-commented Python code using NumPy, SciPy, or QuTiP that implements the discussed control pulse or physical simulation.

Be chemically and physically rigorous. Use Strontium-88 parameters precisely (e.g., singlet 5s² ¹S₀ vs triplet 5s5p ³P₁, ionization potential 5.6948 eV, quantum defects: s-series defect ~3.269, p-series ~2.73, d-series ~2.38). Keep text highly professional, objective, academic, and detailed.`;

    const userPrompt = `Context settings of active simulation:
Species: ${context?.species || "Strontium-88"}
Current Rydberg State level n: ${context?.n || "50"}
BBR Temperature: ${context?.temperature || "300"} K
Electric Field (V/m): ${context?.eField || "0"}
Magnetic Field (G): ${context?.bField || "0.0"}

Researcher query: ${prompt}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: {
              type: Type.STRING,
              description: "Rigorous physical analysis, references, and explanations of pulse sequences or setups."
            },
            pythonCode: {
              type: Type.STRING,
              description: "Complete, production-ready python script utilizing NumPy, SciPy, or QuTiP solving the requested AMO problem."
            }
          },
          required: ["text", "pythonCode"]
        }
      }
    });

    const textOutput = response.text || "{}";
    res.setHeader("Content-Type", "application/json");
    res.end(textOutput);
  } catch (error: any) {
    console.error("Error in quantum-copilot API:", error);
    res.status(500).json({ error: error?.message || "Internal server error" });
  }
});

// Configure Vite or Serve SPA
async function initializeServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite live parsing...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Strontium Rydberg master server running on port ${PORT}`);
  });
}

initializeServer();
