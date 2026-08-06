/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Species } from "./physics/defectTheory";
import AtomicBrowser from "./components/AtomicBrowser";
import StarkMapPlotter from "./components/StarkMapPlotter";
import LindbladSimulator from "./components/LindbladSimulator";
import TweezerInteractionPanel from "./components/TweezerInteractionPanel";
import PythonExplorer from "./components/PythonExplorer";
import GeminiCopilot from "./components/GeminiCopilot";
import { Layers, Activity, ShieldAlert, BookOpen, Sparkles, FolderCode, Zap } from "lucide-react";

export default function App() {
  const [species, setSpecies] = useState<Species>("Sr-88");
  const [n, setN] = useState<number>(50); // initial orbit n=50 for reasonable visual structure
  const [temperature, setTemperature] = useState<number>(300.0); // Room Temp (300 K)
  const [currentTab, setCurrentTab] = useState<"atomic" | "stark" | "lindblad" | "tweezers" | "python" | "copilot">("atomic");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 flex flex-col justify-between" id="app-workspace">
      {/* Top Main Academic Navigation Header */}
      <header className="bg-white border-b border-slate-150 sticky top-0 z-50 shadow-xs" id="app-header">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Logo Title section */}
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-1 px-2.5 bg-indigo-600 text-white rounded-lg text-xs font-mono font-bold tracking-wider uppercase shrink-0">
                AMO Lab
              </span>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight leading-none" id="app-title">
                Strontium-88 Circular Rydberg Simulator
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Research-Grade Quantum Optics and Rydberg Open-System Dynamics Solver
            </p>
          </div>

          {/* Quick Watermark indicators */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 flex items-center gap-1.5 px-3">
              <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
              <span className="text-slate-500">Active Species:</span>
              <span className="font-bold text-slate-700">{species}</span>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 flex items-center gap-1.5 px-3">
              <span className="text-slate-500">Manifold:</span>
              <span className="font-bold text-indigo-600">n = {n}</span>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 flex items-center gap-1.5 px-3">
              <span className="text-slate-500">Thermic:</span>
              <span className="font-bold text-slate-700">{temperature} K</span>
            </div>
          </div>
        </div>

        {/* Tab switch Navigation bar */}
        <div className="max-w-7xl mx-auto px-6 border-t border-slate-50">
          <nav className="flex gap-1 overflow-x-auto py-2.5 shrink-0 scrollbar-none" id="app-navigation">
            {[
              { id: "atomic", label: "Atomic Structure", icon: Layers },
              { id: "stark", label: "Stark-Zeeman Spectroscopy", icon: Activity },
              { id: "lindblad", label: "Lindblad Dynamics", icon: ShieldAlert },
              { id: "tweezers", label: "Tweezers & Interactions", icon: BookOpen },
              { id: "python", label: "Python Library Suite", icon: FolderCode },
              { id: "copilot", label: "Quantum AI Copilot", icon: Sparkles },
            ].map((tab) => {
              const IconComp = tab.icon;
              return (
                <button
                  key={tab.id}
                  id={`tab-nav-${tab.id}`}
                  onClick={() => setCurrentTab(tab.id as any)}
                  className={`flex items-center gap-2 py-1.5 px-4 rounded-xl text-xs font-semibold tracking-tight transition-all shrink-0 cursor-pointer ${
                    currentTab === tab.id
                      ? "bg-indigo-50 text-indigo-700 font-bold border border-indigo-100"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  <IconComp className="h-4 w-4 shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Panel Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full" id="app-main-panel">
        {currentTab === "atomic" && (
          <AtomicBrowser
            species={species}
            setSpecies={setSpecies}
            n={n}
            setN={setN}
            temperature={temperature}
            setTemperature={setTemperature}
          />
        )}

        {currentTab === "stark" && (
          <StarkMapPlotter
            species={species}
            n={n}
          />
        )}

        {currentTab === "lindblad" && (
          <LindbladSimulator
            species={species}
            n={n}
            temperature={temperature}
          />
        )}

        {currentTab === "tweezers" && (
          <TweezerInteractionPanel
            species={species}
            n={n}
          />
        )}

        {currentTab === "python" && (
          <PythonExplorer />
        )}

        {currentTab === "copilot" && (
          <GeminiCopilot
            species={species}
            n={n}
          />
        )}
      </main>

      {/* Footer publication banner */}
      <footer className="bg-white border-t border-slate-150 py-6" id="app-footer">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between text-[11px] text-slate-400 gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-500 font-mono">AMO CIRCULAR SOLVER V1.0</span>
            <span>•</span>
            <span>Rigorous Physical Constants from SI CODATA & Quantum Defect benchmarks.</span>
          </div>
          <div className="text-right flex items-center gap-3">
             <span className="font-mono text-[9px] bg-slate-50 px-2 py-1 rounded border">H_BAR: 1.054e-34 J·s</span>
             <span className="font-mono text-[9px] bg-slate-50 px-2 py-1 rounded border">a_0: 0.529e-10 m</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
