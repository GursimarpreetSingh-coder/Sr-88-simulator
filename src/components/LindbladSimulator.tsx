/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useEffect, useRef } from "react";
import { Species, computeCircularLifetime } from "../physics/defectTheory";
import { simulateLindbladDynamics, MasterSimulationPoint, MasterEquationParams } from "../physics/lindbladSolver";
import { Activity, Play, Info, Settings, Wind } from "lucide-react";

interface LindbladSimulatorProps {
  species: Species;
  n: number;
  temperature: number;
}

export default function LindbladSimulator({ species, n, temperature }: LindbladSimulatorProps) {
  // Coherent Drive Controls (Rabi coupling amplitudes in MHz)
  const [omega1, setOmega1] = useState<number>(4.0);
  const [omega2, setOmega2] = useState<number>(2.5);
  const [omegaMw, setOmegaMw] = useState<number>(1.2);

  // Detunings (MHz)
  const [detuning1, setDetuning1] = useState<number>(0.0);
  const [detuningMw, setDetuningMw] = useState<number>(0.0);

  // Linewidths & Pure Phase Dephasis (MHz)
  const [dephasing1, setDephasing1] = useState<number>(0.02); // Laser 1
  const [dephasing2, setDephasing2] = useState<number>(0.01); // Laser 2
  const [dephasingMw, setDephasingMw] = useState<number>(0.005); // MW phase noise

  // Simulation settings
  const [pulseType, setPulseType] = useState<"square" | "gaussian" | "stirap" | "adiabatic_chirp">("stirap");
  const [tMax, setTMax] = useState<number>(10.0); // microseconds

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Active temperature-dependent decay elements from our core database
  const bbrReport = useMemo(() => computeCircularLifetime(n, temperature), [n, temperature]);

  // Compute final solver rates (convert SI Hz to MHz for master equation solver consistency!)
  const gammaE = 0.0075; // Intermediate 5s5p 3P1 narrow decay rate = 7.5 kHz = 0.0075 MHz
  const gammaR = 0.012;  // Rydberg s/d standard excitation radiative decay = 12 kHz = 0.012 MHz

  // Solver parameters
  const solverParams = useMemo<MasterEquationParams>(() => {
    return {
      omega1,
      omega2,
      omegaMw,
      detuning1,
      detuning2: 0.0,
      detuningMw,
      gammaE,
      gammaR,
      gammaC_sp: bbrReport.rateSpontaneous / 1e6,
      gammaC_stim: bbrReport.rateStimulatedSpontaneous / 1e6,
      gammaC_abs: bbrReport.rateAbsorption / 1e6,
      dephasingLaser1: dephasing1,
      dephasingLaser2: dephasing2,
      dephasingMw,
      pulseType,
      tMaxUs: tMax,
      steps: 400, // RK4 high resolution Steps
    };
  }, [
    omega1,
    omega2,
    omegaMw,
    detuning1,
    detuningMw,
    bbrReport,
    dephasing1,
    dephasing2,
    dephasingMw,
    pulseType,
    tMax,
  ]);

  // Execute RK4 simulation
  const simulationResults: MasterSimulationPoint[] = useMemo(() => {
    return simulateLindbladDynamics(solverParams);
  }, [solverParams]);

  // Final Target Circular State Prep Fidelity
  const finalFidelity = useMemo(() => {
    if (simulationResults.length === 0) return 0;
    return simulationResults[simulationResults.length - 1].rho33;
  }, [simulationResults]);

  // Draw simulation trajectories on HTML5 Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || simulationResults.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Padding margins
    const padL = 60;
    const padR = 150; // extra space for state legend
    const padY = 40;

    const plotW = width - padL - padR;
    const plotH = height - 2 * padY;

    // Grid coordinates
    const getX = (timeVal: number) => padL + (timeVal / tMax) * plotW;
    const getY = (popVal: number) => padY + plotH - popVal * plotH;

    // Grid line guides
    ctx.strokeStyle = "#f1f5f9";
    ctx.lineWidth = 1;

    // Horizontal populations divisions
    const ticksY = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0];
    ticksY.forEach((tick) => {
      const y = getY(tick);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();

      // Label Y
      ctx.fillStyle = "#64748b";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.fillText(tick.toFixed(1), padL - 10, y + 3);
    });

    // Vertical time divisions
    const ticksX = 5;
    for (let idx = 0; idx < ticksX; idx++) {
      const timeGridVal = (tMax * idx) / (ticksX - 1);
      const x = getX(timeGridVal);
      ctx.beginPath();
      ctx.moveTo(x, padY);
      ctx.lineTo(x, padY + plotH);
      ctx.stroke();

      // Label X
      ctx.fillStyle = "#64748b";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${timeGridVal.toFixed(1)} us`, x, padY + plotH + 18);
    }

    // Outer axes frame
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(padL, padY);
    ctx.lineTo(padL, padY + plotH);
    ctx.lineTo(padL + plotW, padY + plotH);
    ctx.stroke();

    // Population pathways line configurations:
    // [rho key, line color, label, bold linewidth]
    const stateLines: Array<[keyof MasterSimulationPoint, string, string, number]> = [
      ["rho00", "#3b82f6", "Ground |g⟩", 1.5],
      ["rho11", "#10b981", "Intermediate |e⟩", 1.5],
      ["rho22", "#f59e0b", "Rydberg |r⟩", 1.5],
      ["rho33", "#4f46e5", "Circular |c⟩ (Target)", 2.8], // Bolder indigo target circular path!
      ["rho44", "#ef4444", "BBR Leakage/Loss |L⟩", 1.2],
    ];

    stateLines.forEach(([key, color, label, strokeW]) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeW;

      simulationResults.forEach((point, idx) => {
        const time = point.timeUs;
        const val = point[key] as number;
        const cx = getX(time);
        const cy = getY(val);

        if (idx === 0) {
          ctx.moveTo(cx, cy);
        } else {
          ctx.lineTo(cx, cy);
        }
      });
      ctx.stroke();

      // Legend labeling at final grid point
      const lastPoint = simulationResults[simulationResults.length - 1];
      const finalVal = lastPoint[key] as number;
      ctx.fillStyle = color;
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`${label} (${(finalVal * 100).toFixed(1)}%)`, padL + plotW + 12, getY(finalVal) + 3);
    });

    // Purity Tr(rho^2) tracker (Dotted Grey Line)
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.5;
    simulationResults.forEach((p, idx) => {
      const cx = getX(p.timeUs);
      const cy = getY(p.purity);
      if (idx === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    });
    ctx.stroke();
    // Label purity
    const finalPur = simulationResults[simulationResults.length - 1].purity;
    ctx.fillStyle = "#64748b";
    ctx.font = "italic 11px monospace";
    ctx.fillText(`Purity Tr(ρ²): ${finalPur.toFixed(3)}`, padL + plotW + 12, getY(finalPur) - 10);
    ctx.setLineDash([]); // Reset line dashes

    // Plot Title Watermark
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 7.5px monospace";
    ctx.fillText("LINDBLAD MASTER EQUATION POPULATION TRAJECTORY DYNAMICS", padL + 10, padY - 12);

    // Dynamic Rabi Envelopes mini-visualization in top corner
    ctx.fillStyle = "rgba(241, 245, 249, 0.5)";
    ctx.fillRect(padL + plotW - 130, padY + 10, 120, 45);
    ctx.strokeStyle = "#e2e8f0";
    ctx.strokeRect(padL + plotW - 130, padY + 10, 120, 45);

    // Mini preview text
    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px monospace";
    ctx.fillText(`Pulse Shape: ${pulseType.toUpperCase()}`, padL + plotW - 125, padY + 22);

  }, [simulationResults, tMax, pulseType]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="lindblad-simulator-container">
      {/* Simulation options */}
      <div className="lg:col-span-5 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-slate-800 mb-6 flex items-center gap-2">
            <Settings className="h-5 w-5 text-indigo-500" /> Dynamics Control Unit
          </h3>

          {/* Pulse shape pick */}
          <div className="mb-5">
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
              Chamber Sweep Pulse Scheme
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                id="btn-pulse-stirap"
                onClick={() => setPulseType("stirap")}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                  pulseType === "stirap"
                    ? "bg-slate-900 border-slate-950 text-white shadow-sm"
                    : "bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100"
                }`}
              >
                STIRAP ( स्टोक्स First )
              </button>
              <button
                id="btn-pulse-adiabatic"
                onClick={() => setPulseType("adiabatic_chirp")}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                  pulseType === "adiabatic_chirp"
                    ? "bg-slate-900 border-slate-950 text-white shadow-sm"
                    : "bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100"
                }`}
              >
                Adiabatic Chirp
              </button>
              <button
                id="btn-pulse-gaussian"
                onClick={() => setPulseType("gaussian")}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                  pulseType === "gaussian"
                    ? "bg-slate-900 border-slate-950 text-white shadow-sm"
                    : "bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100"
                }`}
              >
                Gaussian Profile
              </button>
              <button
                id="btn-pulse-square"
                onClick={() => setPulseType("square")}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                  pulseType === "square"
                    ? "bg-slate-900 border-slate-950 text-white shadow-sm"
                    : "bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100"
                }`}
              >
                Square Block
              </button>
            </div>
          </div>

          <div className="border-t border-slate-50 pt-4 space-y-4">
            {/* Omega 1 */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-500">Laser 1 Rabi Ω₁:</span>
                <span className="font-mono text-slate-800">{omega1.toFixed(1)} MHz</span>
              </div>
              <input
                id="slider-omega1"
                type="range"
                min="0.5"
                max="10.0"
                step="0.5"
                value={omega1}
                onChange={(e) => setOmega1(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            {/* Omega 2 */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-500">Laser 2 Rabi Ω₂:</span>
                <span className="font-mono text-slate-800">{omega2.toFixed(1)} MHz</span>
              </div>
              <input
                id="slider-omega2"
                type="range"
                min="0.5"
                max="8.0"
                step="0.5"
                value={omega2}
                onChange={(e) => setOmega2(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            {/* Omega Mw */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-500">Microwave Rabi Ω_μw:</span>
                <span className="font-mono text-slate-800">{omegaMw.toFixed(2)} MHz</span>
              </div>
              <input
                id="slider-omegamw"
                type="range"
                min="0.1"
                max="4.0"
                step="0.1"
                value={omegaMw}
                onChange={(e) => setOmegaMw(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            {/* Phase Noise / Dephasings */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Laser Ph-Noise</span>
                <input
                  id="input-dephasing-laser"
                  type="number"
                  step="0.005"
                  value={dephasing1}
                  onChange={(e) => setDephasing1(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full px-2 py-1 text-xs font-mono border border-slate-100 rounded bg-slate-50"
                />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">MW Phase Noise</span>
                <input
                  id="input-dephasing-mw"
                  type="number"
                  step="0.001"
                  value={dephasingMw}
                  onChange={(e) => setDephasingMw(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full px-2 py-1 text-xs font-mono border border-slate-100 rounded bg-slate-50"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-50 pt-5 mt-4">
          <div className="flex items-center gap-3 text-xs bg-slate-50 border border-slate-100 p-3.5 rounded-xl">
            <Info className="h-4 w-4 shrink-0 text-indigo-500" />
            <span className="leading-relaxed text-slate-500">
               {pulseType === "stirap" 
                 ? "Counter-intuitive STIRAP: Stokes fields are active BEFORE the Ground laser pulses, bypassing intermediate level decays."
                 : "Adiabatic micro-chirp sweeps microwave detuning to drive adiabatic population climbing onto the circular state."
               }
            </span>
          </div>
        </div>
      </div>

      {/* Simulator canvas and feedback */}
      <div className="lg:col-span-7 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold tracking-tight text-slate-800 flex items-center gap-2">
              <Activity className="h-5 w-5 text-indigo-500" /> Dynamic Lindblad Trajectories
            </h3>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-bold uppercase">Preparation Fidelity</span>
              <span className="text-xl font-bold text-indigo-600 font-mono">{(finalFidelity * 100).toFixed(1)}%</span>
            </div>
          </div>

          <div className="relative w-full overflow-hidden flex justify-center bg-slate-50 border border-slate-100 rounded-xl p-2">
            <canvas
              id="lindblad-dynamics-canvas"
              ref={canvasRef}
              width={650}
              height={380}
              className="w-full h-auto aspect-[65/38] rounded-lg cursor-crosshair max-w-full block"
            />
          </div>
        </div>

        <div className="border-t border-slate-50 pt-3 mt-4 text-[11px] text-slate-400 flex items-center gap-2">
          <Wind className="h-4 w-4 text-emerald-500 shrink-0" />
          <span>Calculates the full 5x5 density matrix open dynamics including intermediate state <span className="font-semibold text-slate-600">3P1</span> spontaneous emission (7.5 kHz linewidth) and thermal BBR transitions.</span>
        </div>
      </div>
    </div>
  );
}
