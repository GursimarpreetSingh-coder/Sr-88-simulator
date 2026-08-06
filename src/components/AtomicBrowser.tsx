/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import { Species, getRydbergEnergy, lNumToLetter, computeCircularLifetime } from "../physics/defectTheory";
import { Thermometer, Zap, Layers, Activity } from "lucide-react";

interface AtomicBrowserProps {
  species: Species;
  setSpecies: (s: Species) => void;
  n: number;
  setN: (n: number) => void;
  temperature: number;
  setTemperature: (t: number) => void;
}

export default function AtomicBrowser({
  species,
  setSpecies,
  n,
  setN,
  temperature,
  setTemperature,
}: AtomicBrowserProps) {
  // Compute target level parameters
  const energyS = useMemo(() => getRydbergEnergy(species, n, "S"), [species, n]);
  const energyP = useMemo(() => getRydbergEnergy(species, n, "P"), [species, n]);
  const energyD = useMemo(() => getRydbergEnergy(species, n, "D"), [species, n]);
  const energyCircular = useMemo(() => getRydbergEnergy(species, n, "Circular"), [species, n]);

  // Compute circular state lifetimes
  const bbrReport = useMemo(() => computeCircularLifetime(n, temperature), [n, temperature]);

  // Generate Rydberg ladder points for visual block diagram
  const visualLevels = useMemo(() => {
    const list = [];
    const minN = Math.max(10, n - 4);
    const maxN = Math.min(100, n + 4);
    for (let currentN = minN; currentN <= maxN; currentN++) {
      list.push({
        nVal: currentN,
        energyEv: getRydbergEnergy(species, currentN, "Circular").energyEv,
      });
    }
    return list;
  }, [species, n]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="atomic-browser-container">
      {/* Configuration Header & Selection */}
      <div className="lg:col-span-4 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-slate-800 mb-6 flex items-center gap-2">
            <Zap className="h-5 w-5 text-indigo-500" /> Physical Cores Config
          </h3>

          {/* Species pick */}
          <div className="mb-5">
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Species Core</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                id="btn-species-sr88"
                onClick={() => setSpecies("Sr-88")}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  species === "Sr-88"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                Strontium-88 (Singlet)
              </button>
              <button
                id="btn-species-rb87"
                onClick={() => setSpecies("Rb-87")}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  species === "Rb-87"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                }`}
              >
                Rubidium-87
              </button>
            </div>
          </div>

          {/* Principal n Slider */}
          <div className="mb-5">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">
                Principal Orbit (n)
              </label>
              <span className="font-mono text-sm font-semibold text-slate-800">n = {n}</span>
            </div>
            <input
              id="input-n-slider"
              type="range"
              min="30"
              max="95"
              value={n}
              onChange={(e) => setN(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
              <span>n=30</span>
              <span>n=60</span>
              <span>n=95</span>
            </div>
          </div>

          {/* Temperature Slider */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">
                BBR Temperature
              </label>
              <span className="font-mono text-sm font-semibold text-slate-800">T = {temperature} K</span>
            </div>
            <input
              id="input-temp-slider"
              type="range"
              min="0"
              max="600"
              step="1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
              <span>0 K (Cryo)</span>
              <span>77 K (LN2)</span>
              <span>300 K (RT)</span>
              <span>600 K</span>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-50 pt-5 mt-4">
          <div className="flex items-center gap-3 text-xs text-slate-400 leading-relaxed">
            <Thermometer className="h-4 w-4 shrink-0 text-amber-500" />
            <span>
              Thermal blackbody environment induces dipole coupling transitions to adjacent orbits, limiting quantum coherence.
            </span>
          </div>
        </div>
      </div>

      {/* States & Defect Tables */}
      <div className="lg:col-span-4 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold tracking-tight text-slate-800 mb-4 flex items-center gap-2">
          <Layers className="h-5 w-5 text-indigo-500" /> Quantum Defects
        </h3>
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          Quantum Defect Theory (QDT) models core penetration of singlet valence electrons. Evaluated relative to ionization limit:
        </p>

        <div className="space-y-3">
          {/* S State */}
          <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div>
              <span className="font-mono text-xs font-semibold text-slate-500">5s{n}s ¹S₀</span>
              <p className="text-xs font-semibold text-slate-800">s-orbital</p>
            </div>
            <div className="text-right">
              <span className="font-mono text-sm text-slate-700">{energyS.energyEv.toFixed(5)} eV</span>
              <p className="text-[10px] font-mono text-slate-400">Defect δ: {energyS.defect.toFixed(4)}</p>
            </div>
          </div>

          {/* P State */}
          <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div>
              <span className="font-mono text-xs font-semibold text-slate-500">5s{n}p ¹P₁</span>
              <p className="text-xs font-semibold text-slate-800">p-orbital</p>
            </div>
            <div className="text-right">
              <span className="font-mono text-sm text-slate-700">{energyP.energyEv.toFixed(5)} eV</span>
              <p className="text-[10px] font-mono text-slate-400">Defect δ: {energyP.defect.toFixed(4)}</p>
            </div>
          </div>

          {/* D State */}
          <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div>
              <span className="font-mono text-xs font-semibold text-slate-500">5s{n}d ¹D₂</span>
              <p className="text-xs font-semibold text-slate-800">d-orbital</p>
            </div>
            <div className="text-right">
              <span className="font-mono text-sm text-slate-700">{energyD.energyEv.toFixed(5)} eV</span>
              <p className="text-[10px] font-mono text-slate-400">Defect δ: {energyD.defect.toFixed(4)}</p>
            </div>
          </div>

          {/* Circular State */}
          <div className="flex justify-between items-center p-3 rounded-xl bg-indigo-50/50 border border-indigo-100/50">
            <div>
              <span className="font-mono text-xs font-semibold text-indigo-600">|{n}, l={n - 1}, m={n - 1}⟩</span>
              <p className="text-xs font-semibold text-indigo-900">Circular Rydberg</p>
            </div>
            <div className="text-right">
              <span className="font-mono text-sm text-indigo-800 font-semibold">{energyCircular.energyEv.toFixed(5)} eV</span>
              <p className="text-[10px] font-mono text-indigo-500">Defect δ: 0.0000</p>
            </div>
          </div>
        </div>
      </div>

      {/* Thermic / Circular State Lifetimes */}
      <div className="lg:col-span-4 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-slate-800 mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-indigo-500" /> Circular State Lifetimes
          </h3>

          <div className="space-y-4 mb-4">
            <div className="pb-3 border-b border-slate-50">
              <span className="text-xs text-slate-400">0 K Spontaneous Radiative Limit</span>
              <div className="flex justify-between items-baseline mt-1">
                <span className="text-2xl font-bold tracking-tight text-slate-800">
                  {bbrReport.radiativeLifetimeMs.toFixed(1)} <span className="text-sm font-medium text-slate-500">ms</span>
                </span>
                <span className="font-mono text-xs text-indigo-500">~ n⁵ scaling</span>
              </div>
            </div>

            <div className="pb-3 border-b border-slate-50">
              <span className="text-xs text-slate-400">Effective Decaying Lifetime at {temperature} K</span>
              <div className="flex justify-between items-baseline mt-1">
                <span className="text-2xl font-bold tracking-tight text-indigo-600">
                  {bbrReport.totalLifetimeMs.toFixed(1)} <span className="text-sm font-medium text-indigo-500">ms</span>
                </span>
                {temperature === 0 ? (
                  <span className="text-xs text-emerald-500 font-semibold uppercase tracking-wider">Pure Radiative</span>
                ) : (
                  <span className="text-xs text-amber-500 font-semibold">BBR Dampened</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs mt-2">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-400 text-[10px] block mb-0.5">BBR Spontaneous Rate</span>
                <span className="font-mono font-medium text-slate-700">{bbrReport.rateStimulatedSpontaneous.toFixed(2)} Hz</span>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-400 text-[10px] block mb-0.5">BBR Absorption Rate</span>
                <span className="font-mono font-medium text-slate-700">{bbrReport.rateAbsorption.toFixed(2)} Hz</span>
              </div>
            </div>

            <div className="text-xs flex justify-between bg-indigo-50/20 px-3 py-2 rounded-lg border border-indigo-50 text-[11px] text-slate-500 font-mono">
              <span>n → n-1 (f_mw):</span>
              <span className="font-semibold">{(bbrReport.transitionFreqSpontaneous / 1e9).toFixed(3)} GHz</span>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-50 pt-4 text-xs text-slate-400 line-clamp-3 leading-relaxed">
          Circular state lifetimes scale as <span className="font-mono">n⁵</span> because high angular momentum dipole matrix elements <span className="font-mono">⟨n,n-1|r|n-1,n-2⟩</span> restrict decay paths to radiofrequency microwave emissions to adjacent states.
        </div>
      </div>
    </div>
  );
}
