/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Species } from "../physics/defectTheory";
import { Bot, HelpCircle, Send, Check, Copy, RefreshCw, FileCode } from "lucide-react";

interface GeminiCopilotProps {
  species: Species;
  n: number;
}

const PRESETS = [
  {
    id: "optimize-stirap",
    label: "Optimize 300K STIRAP",
    prompt: "Show me a STIRAP sequence optimization strategy for n=50 Strontium-88 to circular states when subject to 300 K blackbody stimulated decay.",
  },
  {
    id: "stark-fields",
    label: "Adiabatic Stark climbing",
    prompt: "Provide an electric field sweeping sequence that drives microwave adiabatic ladder climbing. How do we tune electric fields to cross specific m-states?",
  },
  {
    id: "magic-traps",
    label: "Magic Tweezer trapping",
    prompt: "Compare Sr-88 and Rb-87 dynamic polarizabilities and magic trapping wavelengths. Explain how we avoid trap-induced Rydberg dephasing in detail.",
  },
  {
    id: "blockade-qutip",
    label: "Blockade QuTiP Solver",
    prompt: "Write a high-performance QuTiP script in python that solves multi-atom cooperative blockade with a 2-photon Rabi drive of 2.2 MHz.",
  },
];

export default function GeminiCopilot({ species, n }: GeminiCopilotProps) {
  const [messages, setMessages] = useState<Array<{ sender: "user" | "copilot"; text: string; code?: string }>>([
    {
      sender: "copilot",
      text: "Welcome to the **AMO Quantum Copilot**. I am a specialized AI agent configured with physical quantum defect parameters for Strontium-88 and Rubidium-87, as well as Lindblad and Stark spectroscopy mechanics. Ask me detailed questions on circular Rydberg preparation, microwave ladder climbing, magic trapping wavelengths, or van der Waals interactions.",
    },
  ]);
  const [inputText, setInputText] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [scopied, setScopied] = useState<boolean>(false);

  // Send request to full-stack Express backend
  const handleQuery = async (queryText: string) => {
    if (!queryText.trim() || loading) return;

    setLoading(true);
    setMessages((prev) => [...prev, { sender: "user", text: queryText }]);

    try {
      const response = await fetch("/api/quantum-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: queryText,
          context: {
            species,
            n,
            temperature: 300, // typical room temp
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to communicate with physics copilot service.");
      }

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        {
          sender: "copilot",
          text: data.text || "No physical commentary returned.",
          code: data.pythonCode || undefined,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "copilot",
          text: `**Error:** Unable to compile copilot response. Stack: ${err?.message || err}. Ensure your server is active and the Gemini API key is configured.`,
        },
      ]);
    } finally {
      setLoading(false);
      setInputText("");
    }
  };

  const handleCopyCode = (codeText: string) => {
    navigator.clipboard.writeText(codeText);
    setScopied(true);
    setTimeout(() => setScopied(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="gemini-copilot-container">
      {/* Side panel presets */}
      <div className="lg:col-span-4 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-slate-800 mb-4 flex items-center gap-2">
            <Bot className="h-5 w-5 text-indigo-500" /> Theory Assistant
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed mb-6">
            The Quantum Copilot invokes server-side LLMs specializing in advanced AMO research. Click any preset suggestion to run instant multi-photon excitation simulations and generate executable Python control scripts:
          </p>

          <div className="space-y-2.5">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                id={`btn-preset-${p.id}`}
                onClick={() => handleQuery(p.prompt)}
                disabled={loading}
                className="w-full text-left p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all text-xs font-semibold text-slate-700 flex items-start gap-2.5 cursor-pointer disabled:opacity-50"
              >
                <HelpCircle className="h-4.5 w-4.5 text-indigo-400 shrink-0 mt-0.5" />
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-50 pt-5 mt-6 text-xs text-slate-400">
          <p className="leading-relaxed">
            The copilot dynamically reads the simulation's current state (active species, orbit level n and environment noise) to contextualize academic and engineering recommendations.
          </p>
        </div>
      </div>

      {/* Main chat interface */}
      <div className="lg:col-span-8 bg-white border border-slate-100 rounded-2xl shadow-sm flex flex-col h-[560px] overflow-hidden" id="copilot-chat-box">
        {/* Chat header */}
        <div className="px-6 py-4 border-b border-slate-5 border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
            <span className="font-semibold text-slate-800 text-sm">Active AMO Copilot Session</span>
          </div>
          {loading && (
            <span className="text-xs text-indigo-600 font-mono font-medium flex items-center gap-1.5 bg-indigo-50 px-2.5 py-1 rounded-full">
              <RefreshCw className="h-3 w-3 animate-spin" /> Solving Dynamics...
            </span>
          )}
        </div>

        {/* Message logs */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-3 max-w-[85%] ${m.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}
            >
              {/* Profile icon */}
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs shrink-0 ${
                m.sender === "user" ? "bg-slate-900 text-white font-bold" : "bg-indigo-600 text-white"
              }`}>
                {m.sender === "user" ? "U" : <Bot className="h-4.5 w-4.5" />}
              </div>

              {/* Message bubble */}
              <div className={`rounded-2xl p-4 text-xs leading-relaxed ${
                m.sender === "user"
                  ? "bg-slate-950 text-white"
                  : "bg-slate-50 border border-slate-100 text-slate-700"
              }`}>
                {/* Paragraph spacing for textual responses */}
                <p className="whitespace-pre-line text-slate-600 font-sans leading-relaxed selection:bg-indigo-200">
                  {m.text}
                </p>

                {/* Optional code block return */}
                {m.code && (
                  <div className="mt-4 border border-slate-800 bg-slate-950 rounded-xl overflow-hidden text-slate-300">
                    <div className="flex justify-between items-center bg-slate-900 px-4 py-1.5 border-b border-slate-800 text-[10px] font-mono">
                      <span className="flex items-center gap-1 text-slate-400">
                        <FileCode className="h-3.5 w-3.5 text-indigo-400" /> generated_simulation.py
                      </span>
                      <button
                        onClick={() => handleCopyCode(m.code!)}
                        className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        {scopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                    <pre className="p-3 overflow-x-auto text-[10px] font-mono leading-normal bg-slate-950/40">
                      <code>{m.code}</code>
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input box */}
        <div className="p-4 border-t border-slate-5 border-slate-100 bg-slate-50">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleQuery(inputText);
            }}
            className="flex gap-2"
          >
            <input
              id="input-copilot-text"
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask for STIRAP control configurations or atom trapping frequencies..."
              disabled={loading}
              className="flex-1 bg-white border border-slate-150 px-4 py-2.5 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400"
            />
            <button
              id="btn-copilot-submit"
              type="submit"
              disabled={loading || !inputText.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 flex items-center justify-center transition-all disabled:opacity-50 cursor-pointer"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
