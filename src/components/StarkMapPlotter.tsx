/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useRef, useEffect } from "react";
import { Species } from "../physics/defectTheory";
import { generateStarkMap, StarkMapPoint, buildStarkZeemanHamiltonian } from "../physics/starkZeeman";
import { Sliders, RefreshCw, Layers, TrendingUp } from "lucide-react";

interface StarkMapPlotterProps {
  species: Species;
  n: number;
}

export default function StarkMapPlotter({ species, n }: StarkMapPlotterProps) {
  const [m, setM] = useState<number>(2); // projection quantum m (default 2)
  const [bField, setBField] = useState<number>(0.0); // Gauss
  const [maxEField, setMaxEField] = useState<number>(80.0); // max electric field in V/m

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Safely clamp m to prevent array problems (m must be < n)
  const safeM = useMemo(() => {
    const absM = Math.min(Math.abs(m), n - 1);
    return absM;
  }, [m, n]);

  // Number of coupled states in the conserved projection block
  const dim = n - safeM;

  // Generate Stark Map coordinates internally using the Jacobi diagonalizer
  const starkMapPoints: StarkMapPoint[] = useMemo(() => {
    const eFields: number[] = [];
    const steps = 60; // field grid resolution
    for (let idx = 0; idx <= steps; idx++) {
      eFields.push((maxEField / steps) * idx);
    }
    return generateStarkMap(species, n, safeM, eFields, bField);
  }, [species, n, safeM, maxEField, bField]);

  // Render Stark fan inside HTML5 Canvas with publication qualities
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || starkMapPoints.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Get styling dimensions
    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = "#fafafa";
    ctx.fillRect(0, 0, width, height);

    // Padding parameters
    const padLeft = 70;
    const padRight = 30;
    const padTop = 35;
    const padBottom = 50;

    const plotWidth = width - padLeft - padRight;
    const plotHeight = height - padTop - padBottom;

    // Evaluate bounds of energy values to center plot nicely
    let minEnergy = Infinity;
    let maxEnergy = -Infinity;

    starkMapPoints.forEach((point) => {
      for (let idx = 0; idx < dim; idx++) {
        const val = point[`val_${idx}`];
        if (val < minEnergy) minEnergy = val;
        if (val > maxEnergy) maxEnergy = val;
      }
    });

    // Add 5% headroom to top and bottom
    const energyRange = maxEnergy - minEnergy || 1;
    minEnergy -= 0.05 * energyRange;
    maxEnergy += 0.05 * energyRange;

    // Draw grid lines
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    // X-axis scale (V/m)
    const getX = (eField: number) => padLeft + (eField / maxEField) * plotWidth;
    // Y-axis scale (MHz)
    const getY = (energy: number) =>
      padBottom + plotHeight - ((energy - minEnergy) / (maxEnergy - minEnergy)) * plotHeight;

    // Draw horizontal grid lines (Energy divisions)
    const energyTicks = 5;
    for (let idx = 0; idx < energyTicks; idx++) {
      const energyGridVal = minEnergy + (energyRange * idx) / (energyTicks - 1);
      const yPos = getY(energyGridVal);
      
      ctx.beginPath();
      ctx.moveTo(padLeft, yPos);
      ctx.lineTo(width - padRight, yPos);
      ctx.stroke();

      // Labels on Y-axis
      ctx.setLineDash([]);
      ctx.fillStyle = "#64748b";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${energyGridVal.toFixed(1)}`, padLeft - 10, yPos + 3);
      ctx.setLineDash([3, 3]);
    }

    // Draw vertical grid lines (Electric field divisions)
    const fieldTicks = 5;
    for (let idx = 0; idx < fieldTicks; idx++) {
      const fieldGridVal = (maxEField * idx) / (fieldTicks - 1);
      const xPos = getX(fieldGridVal);

      ctx.beginPath();
      ctx.moveTo(xPos, padTop);
      ctx.lineTo(padTop + plotHeight + 15, xPos); // Wait, make vertical line coordinate exact
      ctx.moveTo(xPos, padTop);
      ctx.lineTo(xPos, height - padBottom);
      ctx.stroke();

      // Labels on X-axis
      ctx.setLineDash([]);
      ctx.fillStyle = "#64748b";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`${fieldGridVal.toFixed(0)}`, xPos, height - padBottom + 18);
      ctx.setLineDash([3, 3]);
    }

    ctx.setLineDash([]); // Reset line dashes for axes and lines

    // Draw Main plot axes
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop);
    ctx.lineTo(padLeft, height - padBottom);
    ctx.lineTo(width - padRight, height - padBottom);
    ctx.stroke();

    // Plot Lines representing each energy state
    // We color the circular/high-l states with a highlighted indigo shade, and low-l states in graphite
    for (let stateIdx = 0; stateIdx < dim; stateIdx++) {
      ctx.beginPath();
      ctx.lineWidth = stateIdx === dim - 1 ? 2.5 : 1.2; // circular target state is bolder
      ctx.strokeStyle = stateIdx === dim - 1 ? "#4f46e5" : "#334155"; // Indigo vs Charcoal

      starkMapPoints.forEach((point, gridIdx) => {
        const val = point[`val_${stateIdx}`];
        const x = getX(point.eField);
        const y = getY(val);

        if (gridIdx === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    }

    // Draw Axis Titles
    ctx.fillStyle = "#1e293b";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Electric Field F_z (V/m)", padLeft + plotWidth / 2, height - 12);

    // Y Axis header (Rotated text)
    ctx.save();
    ctx.translate(15, padTop + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Eigenenergy ν (MHz)", 0, 0);
    ctx.restore();

    // Chart title watermarks
    ctx.textAlign = "left";
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 9px monospace";
    ctx.fillText(`${species.toUpperCase()} RYDBERG STATE STARK SPECTROSCOPY`, padLeft + 15, padTop + 20);

  }, [starkMapPoints, dim, maxEField, species, safeM]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="stark-map-plotter-container">
      {/* Control panel */}
      <div className="lg:col-span-4 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-slate-800 mb-6 flex items-center gap-2">
            <Sliders className="h-5 w-5 text-indigo-500" /> Stark-Zeeman Config
          </h3>

          <p className="text-xs text-slate-500 leading-relaxed mb-6">
            Electric and magnetic fields couple orbital states of the same projection <span className="font-mono font-semibold text-indigo-600">m</span>. Real-time matrix diagonalization calculated via symmetric Jacobi algorithms in browser.
          </p>

          {/* Conserved m value */}
          <div className="mb-5">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">
                Magnetic Projection (m)
              </label>
              <span className="font-mono text-sm font-semibold text-slate-800">m = {safeM}</span>
            </div>
            <div className="flex gap-2">
              {[0, 1, 2, 3].map((val) => (
                <button
                  key={val}
                  id={`btn-m-value-${val}`}
                  onClick={() => setM(val)}
                  className={`flex-1 py-1 px-3 rounded-lg border text-xs font-mono font-semibold transition-all ${
                    safeM === val
                      ? "bg-slate-900 border-slate-950 text-white shadow-xs"
                      : "bg-slate-5    border-slate-100 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  m={val}
                </button>
              ))}
            </div>
          </div>

          {/* Magnetic Field slider */}
          <div className="mb-5">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">
                Magnetic Field B_z (Zeeman)
              </label>
              <span className="font-mono text-sm font-semibold text-slate-800">{bField.toFixed(1)} Gauss</span>
            </div>
            <input
              id="input-bfield-slider"
              type="range"
              min="0.0"
              max="20.0"
              step="0.5"
              value={bField}
              onChange={(e) => setBField(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
              <span>0 G (Shielded)</span>
              <span>10 G</span>
              <span>20 G</span>
            </div>
          </div>

          {/* Sweep Range slider */}
          <div className="mb-5">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">
                Electric Sweep Max (F_max)
              </label>
              <span className="font-mono text-sm font-semibold text-slate-800">{maxEField.toFixed(0)} V/m</span>
            </div>
            <input
              id="input-efield-slider"
              type="range"
              min="20"
              max="200"
              step="10"
              value={maxEField}
              onChange={(e) => setMaxEField(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
          </div>
        </div>

        <div className="border-t border-slate-50 pt-5 mt-4">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-xs">
            <span className="text-slate-400 text-[10px] uppercase font-bold block mb-2">Manifold Properties</span>
            <div className="space-y-1.5 text-slate-600 font-mono">
              <div className="flex justify-between">
                <span>Coupled States:</span>
                <span className="font-semibold text-slate-800">{dim}</span>
              </div>
              <div className="flex justify-between">
                <span>Zeeman Shift (target):</span>
                <span className="font-semibold text-indigo-600">{(safeM * 1.399 * bField).toFixed(2)} MHz</span>
              </div>
              <div className="flex justify-between">
                <span>Rostrant l-states:</span>
                <span className="font-semibold text-slate-800">l = {safeM} → {n - 1}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stark map canvas */}
      <div className="lg:col-span-8 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold tracking-tight text-slate-800 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-500" /> Spectroscopy Map
            </h3>
            <span className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full font-mono font-medium flex items-center gap-1.5">
              <RefreshCw className="h-3 w-3 animate-spin-slow" /> Real-time Solver
            </span>
          </div>

          <div className="relative w-full overflow-hidden flex justify-center bg-slate-50 border border-slate-100 rounded-xl p-2">
            <canvas
              id="stark-map-canvas"
              ref={canvasRef}
              width={700}
              height={440}
              className="w-full h-auto aspect-[70/44] rounded-lg cursor-crosshair max-w-full block"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4 text-[11px] text-slate-400 leading-relaxed border-t border-slate-50 pt-3">
          <span className="h-2 w-2 rounded-full bg-indigo-600 inline-block shrink-0" />
          <span>The highlighted line represents the target **Circular state** <span className="font-mono bg-slate-50 px-1 py-0.5 rounded text-indigo-600">l = n-1, m = n-1</span>. It resists quadratic stark decoherence significantly better than intermediate low-l Rydberg levels.</span>
        </div>
      </div>
    </div>
  );
}
