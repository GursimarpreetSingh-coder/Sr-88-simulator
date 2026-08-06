/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { Species } from "../physics/defectTheory";
import { calculateTweezerTrap } from "../physics/opticalTweezers";
import { calculateRydbergInteractions } from "../physics/interactions";
import { Crosshair, ShieldCheck, ZapOff, Minimize } from "lucide-react";

interface TweezerInteractionPanelProps {
  species: Species;
  n: number;
}

export default function TweezerInteractionPanel({ species, n }: TweezerInteractionPanelProps) {
  // Tweezer Parameters
  const [wavelength, setWavelength] = useState<number>(1064); // nm
  const [power, setPower] = useState<number>(3.5); // mW
  const [waist, setWaist] = useState<number>(1.2); // micrometers

  // Atomic interactions parameters
  const [separation, setSeparation] = useState<number>(6.5); // micrometers
  const [laserRabi, setLaserRabi] = useState<number>(2.0); // MHz

  // Trap Calculations
  const trapReport = useMemo(() => {
    return calculateTweezerTrap({
      wavelengthNm: wavelength,
      powerMw: power,
      beamWaistUm: waist,
      species,
    });
  }, [wavelength, power, waist, species]);

  // Rydberg interaction Calculations
  const interactionReport = useMemo(() => {
    return calculateRydbergInteractions(n, laserRabi, separation);
  }, [n, laserRabi, separation]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" id="tweezer-interaction-panel">
      {/* Laser Confinement Trap card */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-slate-800 mb-5 flex items-center gap-2">
            <Minimize className="h-5 w-5 text-indigo-500" /> Optical Tweezer Trapping
          </h3>

          <p className="text-xs text-slate-500 leading-relaxed mb-6">
            Focused Gaussian laser beams confine single ground atoms at potential minima. However, free Rydberg valence electrons suffer a ponderomotive repel velocity out of the trap, disrupting confinement during coherent excitation.
          </p>

          <div className="space-y-4 mb-6">
            {/* Wavelength Selectors */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Laser Wavelength
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[515, 813, 1064].map((lam) => (
                  <button
                    key={lam}
                    id={`btn-wave-${lam}`}
                    onClick={() => setWavelength(lam)}
                    className={`py-1.5 px-3 rounded-lg border text-xs font-mono font-bold transition-all ${
                      wavelength === lam
                        ? "bg-slate-900 border-slate-950 text-white shadow-xs"
                        : "bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {lam} nm {lam === 813 ? "(magic)" : ""}
                  </button>
                ))}
              </div>
            </div>

            {/* Laser power slider */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-500">Tweezer Laser Power:</span>
                <span className="font-mono text-slate-800">{power.toFixed(1)} mW</span>
              </div>
              <input
                id="slider-trap-power"
                type="range"
                min="0.5"
                max="12.0"
                step="0.5"
                value={power}
                onChange={(e) => setPower(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            {/* Beam Waist slider */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-500">Focused Beam Waist (w₀):</span>
                <span className="font-mono text-slate-800">{waist.toFixed(1)} μm</span>
              </div>
              <input
                id="slider-trap-waist"
                type="range"
                min="0.6"
                max="3.5"
                step="0.1"
                value={waist}
                onChange={(e) => setWaist(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
          </div>
        </div>

        {/* Trap Report statistics */}
        <div className="border-t border-slate-50 pt-5 space-y-3">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Confinement Matrix Report</span>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
              <span className="text-slate-400 text-[10px] block mb-0.5">Trap Potential Depth</span>
              <span className="font-mono text-sm font-bold text-slate-800">{trapReport.trapDepthKelvin.toFixed(2)} μK</span>
              <span className="text-[10px] text-slate-400 font-mono block mt-0.5">{trapReport.trapDepthMhz.toFixed(2)} MHz</span>
            </div>

            <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
              <span className="text-slate-400 text-[10px] block mb-0.5">Radial Trap frequency</span>
              <span className="font-mono text-sm font-bold text-slate-800">{(trapReport.radialFrequencyHz / 1e3).toFixed(1)} kHz</span>
              <span className="text-[10px] text-slate-400 font-mono block mt-0.5">Axial: {(trapReport.axialFrequencyHz / 1e3).toFixed(1)} kHz</span>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs p-3 rounded-xl bg-indigo-50/20 border border-indigo-50/50">
            <span className="text-slate-600">Rydberg Ponderomotive Push:</span>
            <span className="font-mono font-bold text-indigo-700">{(trapReport.rydbergPonderomotiveEv * 1e3).toFixed(1)} meV (Repel)</span>
          </div>
        </div>
      </div>

      {/* Atomic interaction van der Waals & blockade card */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-slate-800 mb-5 flex items-center gap-2">
            <Crosshair className="h-5 w-5 text-indigo-500" /> Multi-Atom Rydberg Interactions
          </h3>

          <p className="text-xs text-slate-500 leading-relaxed mb-6">
            Rydberg interactions scale incredibly strongly as <span className="font-mono font-semibold text-indigo-600">n¹¹</span> in the van der Waals regime, creating massive energy shifts that prevent adjacent atoms from being excited simultaneously (Rydberg Blockade).
          </p>

          <div className="space-y-4 mb-6">
            {/* Separation slider */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-500">Atomic Separation distance (R):</span>
                <span className="font-mono text-slate-800">{separation.toFixed(1)} μm</span>
              </div>
              <input
                id="slider-atom-separation"
                type="range"
                min="1.5"
                max="15.0"
                step="0.5"
                value={separation}
                onChange={(e) => setSeparation(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            {/* Rabi drive width slider */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-500">Excitation Rabi Drive width (Ω):</span>
                <span className="font-mono text-slate-800">{laserRabi.toFixed(1)} MHz</span>
              </div>
              <input
                id="slider-laser-rabi-mhz"
                type="range"
                min="0.2"
                max="8.0"
                step="0.2"
                value={laserRabi}
                onChange={(e) => setLaserRabi(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
          </div>
        </div>

        {/* Interaction stats */}
        <div className="border-t border-slate-50 pt-5 space-y-3">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Quantum Inter-Atomic coupling report</span>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
              <span className="text-slate-400 text-[10px] block mb-0.5">Interaction Energy V(R)</span>
              <span className={`font-mono text-sm font-bold ${interactionReport.interactionEnergyMhz > 0 ? "text-slate-800" : "text-amber-600"}`}>
                {Math.abs(interactionReport.interactionEnergyMhz).toFixed(2)} MHz
              </span>
              <span className="text-[10px] text-slate-400 font-mono block mt-0.5">C6: {interactionReport.c6CoefficientHzM6.toFixed(3)} GHz um⁶</span>
            </div>

            <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl justify-between flex flex-col">
              <div>
                <span className="text-slate-400 text-[10px] block mb-0.5">Rydberg Blockade Radius</span>
                <span className="font-mono text-sm font-bold text-indigo-600">{interactionReport.blockadeRadiusUm.toFixed(2)} μm</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono block mt-1">Förster Defect: {interactionReport.foersterDetuningMhz.toFixed(1)} MHz</span>
            </div>
          </div>

          <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
            interactionReport.regime === "Blockade"
              ? "bg-emerald-50/50 border-emerald-100 text-emerald-800"
              : "bg-amber-50/30 border-amber-100 text-amber-800"
          }`}>
             <div className="flex items-center gap-2 font-medium">
               {interactionReport.regime === "Blockade" ? (
                 <ShieldCheck className="h-5 w-5 text-emerald-500" />
               ) : (
                 <ZapOff className="h-5 w-5 text-amber-500" />
               )}
               <div>
                  <span className="block font-bold leading-none">{interactionReport.regime === "Blockade" ? "Rydberg Blockade Active" : "Weak Interactive Regime"}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{interactionReport.regime === "Blockade" ? "Adjacent excitation completely forbidden" : "Partial coherent interaction shifts"}</span>
               </div>
             </div>
             <span className="font-mono bg-white px-2 py-0.5 border rounded uppercase text-[9px] font-bold shadow-2xs">
               R = {separation.toFixed(1)} μm
             </span>
          </div>
        </div>
      </div>
    </div>
  );
}
