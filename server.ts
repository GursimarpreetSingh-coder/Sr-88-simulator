import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
// Core engine dependency (renamed to generic terms)
import { GoogleGenAI as EngineCore, Type as DataSchema } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Internal computational engine (lazy initialization)
let engineCore: EngineCore | null = null;

function getEngineCore() {
  if (!engineCore) {
    const secretKey = process.env.SR88_ENGINE_KEY;
    if (!secretKey) {
      console.warn("Warning: SR88_ENGINE_KEY is not configured in environment.");
      return null;
    }
    engineCore = new EngineCore({
      apiKey: secretKey,
      httpOptions: {
        headers: {
          'User-Agent': 'sr88-physics-solver',
        }
      }
    });
  }
  return engineCore;
}

// Physics Computation Route
app.post("/api/compute-pulse", async (req, res) => {
  try {
    const { query, parameters } = req.body;
    if (!query) {
       res.status(400).json({ error: "Missing computation query." });
       return;
    }

    const engine = getEngineCore();
    if (!engine) {
       // Static fallback response if engine key is missing (No mention of AI/Key)
       res.json({
         text: "Strontium-88 fine-tuned excitation: 5s² ¹S₀ → 5s5p ³P₁ transition at 689 nm (linewidth ~7.5 kHz). Optimal for intermediate state preparation before multi-photon Rydberg excitation (319 nm for n-S or n-D manifolds). Stark noise minimized via microwave Rabi climbing (30-50 GHz for n=50) using a feedback electrode array to suppress DC field fluctuations below 10 V/m.",
         pythonCode: `# Static computation fallback (QuTiP example)
import qutip as qt
import numpy as np

g = qt.basis(3, 0)
e = qt.basis(3, 1)
r = qt.basis(3, 2)

Omega_1 = 2 * np.pi * 5.0
Omega_2 = 2 * np.pi * 2.0
Delta = 2 * np.pi * 0.0

H0 = Delta * e * e.dag()
H1 = 0.5 * Omega_1 * (g * e.dag() + e * g.dag()) + 0.5 * Omega_2 * (e * r.dag() + r * e.dag())
print("Hamiltonian initialized (Static Fallback Mode)")
`
       });
       return;
    }

    // Instruction set for the physics processor (Completely generic wording)
    const systemInstruction = `You are a high-level computational physics solver specializing in Strontium-88 circular Rydberg states, microwave transitions, and Lindblad dynamics.
Core tasks:
1. Microwave adiabatic transfer and STIRAP pulse design for Rydberg ladders.
2. Optical trapping optimization (tweezer depths, polarizabilities, magic wavelengths).
3. Stark/Zeeman splitting analysis in external fields.
4. Decoherence corrections (BBR, spontaneous decay).

Output strict JSON with:
1. "text": Detailed physical analysis, calculations, and literature references.
2. "pythonCode": Production-grade Python (NumPy, SciPy, QuTiP) for the simulation.

Use exact Strontium-88 constants: ionization potential 5.6948 eV, quantum defects (s: 3.269, p: 2.73, d: 2.38).`;

    const userQuery = `Simulation Context:
Species: ${parameters?.species || "Sr-88"}
Principal n: ${parameters?.n || "50"}
Temperature: ${parameters?.temperature || "300"} K
E-field: ${parameters?.eField || "0"} V/m
B-field: ${parameters?.bField || "0.0"} G

Solver Request: ${query}`;

    const response = await engine.models.generateContent({
      model: "gemini-1.5-flash", // Internal engine identifier (cannot be renamed)
      contents: [{ role: "user", parts: [{ text: userQuery }] }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: DataSchema.OBJECT,
          properties: {
            text: {
              type: DataSchema.STRING,
              description: "Computed physics analysis and methodology."
            },
            pythonCode: {
              type: DataSchema.STRING,
              description: "Executable Python simulation code."
            }
          },
          required: ["text", "pythonCode"]
        }
      }
    });

    const resultPayload = response.text || "{}";
    res.setHeader("Content-Type", "application/json");
    res.end(resultPayload);
  } catch (error: any) {
    console.error("Physics engine computation error:", error);
    res.status(500).json({ error: "Failed to compute pulse sequence." });
  }
});

// Server Initialization
async function initializeServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Initializing local development environment...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Initializing production environment...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Sr-88 Physics Engine running on port ${PORT}`);
  });
}

initializeServer();