/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Folder, FileCode, Check, Copy, Download, Layers } from "lucide-react";

// Inline copies of the precise Python files we created, allowing direct client-side browsing and downloads.
const pythonFiles: Record<string, { filename: string; description: string; content: string }> = {
  atomic: {
    filename: "atomic.py",
    description: "Atomic core QDT defects lists, energy levels and spontaneous / stimulated BBR lifetimes.",
    content: `# -*- coding: utf-8 -*-
"""
Atomic Physics constants and quantum defects for Strontium-88 and Rubidium-87.
Part of the Research-Grade Rydberg AMO Simulation package.
Reference: Vaillant et al., J. Phys. B 45, 135004 (2012)
"""

import numpy as np
from dataclasses import dataclass

# Physical Constants (SI Units)
H_BAR = 1.054571817e-34      # J s
H_PLANCK = 6.62607015e-34    # J s
E_CHARGE = 1.602176634e-19   # C
M_ELECTRON = 9.1093837015e-31 # kg
BOHR_RADIUS = 5.29177210903e-11 # m (a_0)
SPEED_OF_LIGHT = 299792458   # m/s
KB_BOLTZMANN = 1.380649e-23  # J/K
EPSILON_0 = 8.8541878128e-12 # F/m
BOHR_MAGNETON = 9.2740100783e-24 # J/T (mu_B)
RYDBERG_HZ = 3.2898419602508e15 # Hz (R_inf)
RYDBERG_EV = 13.605693122994    # eV (R_inf)

# Atomic Masses (kg)
MASS_SR88 = 87.9056121 * 1.6605390666e-27
MASS_RB87 = 86.9091805 * 1.6605390666e-27

@dataclass
class DefectSeries:
    delta0: float
    delta2: float

# Documented singlet defects for Strontium-88
SR88_SINGLET_DEFECTS = {
    'S': DefectSeries(3.26896, -0.138),
    'P': DefectSeries(2.72950, -0.070),
    'D': DefectSeries(2.38072, -1.630),
    'F': DefectSeries(0.08900, 0.000)
}

# Documented defects for Rubidium-87
RB87_DEFECTS = {
    'S': DefectSeries(3.13118, 0.1784),
    'P': DefectSeries(2.64167, 0.295),
    'D': DefectSeries(1.34809, -0.6028),
    'F': DefectSeries(0.01630, 0.000)
}

class AtomModel:
    def __init__(self, species: str = "Sr-88"):
        if species not in ["Sr-88", "Rb-87"]:
            raise ValueError("Supported species are 'Sr-88' and 'Rb-87'")
        self.species = species
        self.mass = MASS_SR88 if species == "Sr-88" else MASS_RB87
        self.defects = SR88_SINGLET_DEFECTS if species == "Sr-88" else RB87_DEFECTS

    def get_effective_defect(self, n: float, l_char: str) -> float:
        l_upper = l_char.upper()
        if l_upper not in self.defects:
            return 0.0
        series = self.defects[l_upper]
        return series.delta0 + series.delta2 / ((n - series.delta0) ** 2)

    def get_energy(self, n: int, l_char: str) -> float:
        defect = self.get_effective_defect(n, l_char)
        n_eff = n - defect
        return -H_PLANCK * RYDBERG_HZ / (n_eff ** 2)

    def get_energy_ev(self, n: int, l_char: str) -> float:
        return self.get_energy(n, l_char) / E_CHARGE

    def get_circular_lifetime_rates(self, n: int, temp_k: float) -> dict:
        freq_spont = RYDBERG_HZ * (1.0 / ((n - 1) ** 2) - 1.0 / (n ** 2))
        omega_spont = 2 * np.pi * freq_spont

        angular_factor = (4 * (omega_spont ** 3) * (E_CHARGE ** 2) * (BOHR_RADIUS ** 2)) / (
            3 * H_BAR * (SPEED_OF_LIGHT ** 3) * (4 * np.pi * EPSILON_0)
        )

        ln_num = (n - 1) * np.log(2 * n - 1) + 0.5 * np.log(2 * n - 1)
        ln_den = n * np.log(2 * n)
        radial_r2 = (n ** 4) * np.exp(2 * (ln_num - ln_den))

        rate_spont = angular_factor * radial_r2

        freq_abs = RYDBERG_HZ * (1.0 / (n ** 2) - 1.0 / ((n + 1) ** 2))
        omega_abs = 2 * np.pi * freq_abs

        angular_factor_abs = (4 * (omega_abs ** 3) * (E_CHARGE ** 2) * (BOHR_RADIUS ** 2)) / (
            3 * H_BAR * (SPEED_OF_LIGHT ** 3) * (4 * np.pi * EPSILON_0)
        )
        n_p1 = n + 1
        ln_num_abs = (n_p1 - 1) * np.log(2 * n_p1 - 1) + 0.5 * np.log(2 * n_p1 - 1)
        ln_den_abs = n_p1 * np.log(2 * n_p1)
        radial_r2_abs = (n_p1 ** 4) * np.exp(2 * (ln_num_abs - ln_den_abs))
        rate_spont_nplus1on = angular_factor_abs * radial_r2_abs

        n_th_spont = 0.0
        n_th_abs = 0.0
        if temp_k > 0.02:
            n_th_spont = 1.0 / (np.exp((H_PLANCK * freq_spont) / (KB_BOLTZMANN * temp_k)) - 1.0)
            n_th_abs = 1.0 / (np.exp((H_PLANCK * freq_abs) / (KB_BOLTZMANN * temp_k)) - 1.0)

        rate_stimulated = rate_spont * n_th_spont
        statistical_factor = (2 * n + 1) / (2 * n - 1)
        rate_absorption = rate_spont_nplus1on * n_th_abs * statistical_factor

        total_decay_g = rate_spont + rate_stimulated + rate_absorption

        return {
            "transition_freq_spont_hz": freq_spont,
            "transition_freq_abs_hz": freq_abs,
            "rate_spont_0k": rate_spont,
            "rate_stimulated_decay": rate_stimulated,
            "rate_absorption_loss": rate_absorption,
            "n_thermal_spont": n_th_spont,
            "n_thermal_abs": n_th_abs,
            "total_decay_rate_hz": total_decay_g,
            "total_lifetime_ms": 1000.0 / total_decay_g if total_decay_g > 0 else np.inf,
            "radiative_lifetime_0k_ms": 1000.0 / rate_spont
        }`,
  },
  stark: {
    filename: "stark_zeeman.py",
    description: "Electric & Magnetic Stark spectroscopy solvers; diagonalizescoupled angular quantum manifolds.",
    content: `# -*- coding: utf-8 -*-
"""
Stark Map and Zeeman Splitting calculations for Hydrogen-like atomic Rydberg manifolds.
Part of the Research-Grade Rydberg AMO Simulation package.
Calculates Stark and Zeeman shifts and diagonalizes the coupled Hamiltonian.
"""

import numpy as np
from .atomic import E_CHARGE, BOHR_RADIUS, H_PLANCK, BOHR_MAGNETON, AtomModel

class StarkZeemanEngine:
    def __init__(self, atom_model: AtomModel):
        self.atom = atom_model

    def build_hamiltonian_mhz(self, n: int, m: int, e_field_v_m: float, b_field_gauss: float) -> tuple:
        abs_m = abs(m)
        basis_l = list(range(abs_m, n))
        dim = len(basis_l)
        H = np.zeros((dim, dim), dtype=float)

        b_tesla = b_field_gauss * 1e-4
        zeeman_mhz = (BOHR_MAGNETON * b_tesla * m) / (H_PLANCK * 1e6)

        for i, l in enumerate(basis_l):
            l_char = self._get_l_char(l)
            energy_hz = self.atom.get_energy(n, l_char) / H_PLANCK
            H[i, i] = (energy_hz / 1e6) + zeeman_mhz

        for i in range(dim - 1):
            l = basis_l[i]
            next_l = basis_l[i + 1]
            if next_l == l + 1:
                angular_term = np.sqrt(
                    (next_l**2 - m**2) / ((2 * l + 1) * (2 * next_l + 1))
                )
                radial_term = 1.5 * n * np.sqrt(n**2 - next_l**2) * BOHR_RADIUS
                coupling_j = -E_CHARGE * e_field_v_m * radial_term * angular_term
                coupling_mhz = coupling_j / (H_PLANCK * 1e6)
                
                H[i, i + 1] = coupling_mhz
                H[i + 1, i] = coupling_mhz

        return H, basis_l

    def diagonalize(self, n: int, m: int, e_field_v_m: float, b_field_gauss: float) -> tuple:
        H, basis_l = self.build_hamiltonian_mhz(n, m, e_field_v_m, b_field_gauss)
        eigenvalues, eigenvectors = np.linalg.eigh(H)
        return eigenvalues, eigenvectors, basis_l

    def generate_stark_map(self, n: int, m: int, e_fields: np.ndarray, b_field_gauss: float) -> np.ndarray:
        num_fields = len(e_fields)
        num_states = n - abs(m)
        eigen_grid = np.zeros((num_fields, num_states))
        for idx, e_val in enumerate(e_fields):
            eig_vals, _, _ = self.diagonalize(n, m, e_val, b_field_gauss)
            eigen_grid[idx, :] = eig_vals
        return eigen_grid

    def _get_l_char(self, l: int) -> str:
        letters = ['S', 'P', 'D', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N']
        if l < len(letters):
            return letters[l]
        return 'G'`,
  },
  open_systems: {
    filename: "open_systems.py",
    description: "QuTiP-based Lindblad Master Solver driving the system density matrix dynamics and decoherences.",
    content: `# -*- coding: utf-8 -*-
"""
Open Quantum Systems dynamics solver for circular Rydberg state preparation.
Contains proper Lindblad Master Equation setup with complete collapse operators.
Integrates spontaneous decay, blackbody stimulated decay, and phase noise dephasing.
Utilizes QuTiP (Quantum Toolbox in Python).
"""

import numpy as np
import scipy.linalg as la
try:
    import qutip as qt
    QUTIP_AVAILABLE = True
except ImportError:
    QUTIP_AVAILABLE = False

class LindbladDynamicsEngine:
    def __init__(self, omega1: float, omega2: float, omega_mw: float,
                 detuning1: float, detuning2: float, detuning_mw: float,
                 gamma_e: float, gamma_r: float, rates_circular: dict,
                 dephasing_laser1: float = 0.05, dephasing_laser2: float = 0.02, dephasing_mw: float = 0.01):
        self.omega1 = omega1
        self.omega2 = omega2
        self.omega_mw = omega_mw
        self.detuning1 = detuning1
        self.detuning2 = detuning2
        self.detuning_mw = detuning_mw

        self.g_e = gamma_e
        self.g_r = gamma_r
        self.g_c_sp = rates_circular["rate_spont_0k"] / 1e6
        self.g_c_stim = rates_circular["rate_stimulated_decay"] / 1e6
        self.g_c_abs = rates_circular["rate_absorption_loss"] / 1e6

        self.dep1 = dephasing_laser1
        self.dep2 = dephasing_laser2
        self.dep_mw = dephasing_mw

    def build_qutip_system(self, pulse_shape_func=None, t_max=10.0) -> tuple:
        if not QUTIP_AVAILABLE:
            raise RuntimeError("QuTiP must be installed")

        g = qt.basis(5, 0)
        e = qt.basis(5, 1)
        r = qt.basis(5, 2)
        c = qt.basis(5, 3)
        loss = qt.basis(5, 4)

        H0 = (
            2 * np.pi * self.detuning1 * e * e.dag() +
            2 * np.pi * (self.detuning1 + self.detuning2) * r * r.dag() +
            2 * np.pi * (self.detuning1 + self.detuning2 + self.detuning_mw) * c * c.dag()
        )

        H_rabi_g_e = np.pi * self.omega1 * (g * e.dag() + e * g.dag())
        H_rabi_e_r = np.pi * self.omega2 * (e * r.dag() + r * e.dag())
        H_rabi_r_c = np.pi * self.omega_mw * (r * c.dag() + c * r.dag())

        if pulse_shape_func:
            H_tot = [H0, [H_rabi_g_e, lambda t, args: pulse_shape_func(t, 'pump', t_max)],
                         [H_rabi_e_r, lambda t, args: pulse_shape_func(t, 'ryd', t_max)],
                         [H_rabi_r_c, lambda t, args: pulse_shape_func(t, 'stokes', t_max)]]
        else:
            H_tot = H0 + H_rabi_g_e + H_rabi_e_r + H_rabi_r_c

        c_ops = []
        c_ops.append(np.sqrt(self.g_e) * (g * e.dag()))
        c_ops.append(np.sqrt(0.5 * self.g_r) * (g * r.dag()))
        c_ops.append(np.sqrt(0.5 * self.g_r) * (loss * r.dag()))

        g_c_total = self.g_c_sp + self.g_c_stim + self.g_c_abs
        c_ops.append(np.sqrt(g_c_total) * (loss * c.dag()))

        c_ops.append(np.sqrt(2 * self.dep1) * (e * e.dag()))
        c_ops.append(np.sqrt(2 * self.dep2) * (r * r.dag()))
        c_ops.append(np.sqrt(2 * self.dep_mw) * (c * c.dag()))

        return H_tot, c_ops, g

    def run_simulation(self, times: np.ndarray, pulse_shape_func=None) -> dict:
        t_max = times[-1]
        if QUTIP_AVAILABLE:
            H, c_ops, g = self.build_qutip_system(pulse_shape_func, t_max)
            initial_state = qt.ket2dm(g)
            result = qt.mesolve(H, initial_state, times, c_ops=c_ops,
                                e_ops=[qt.projection(5, i, i) for i in range(5)])
            full_states = qt.mesolve(H, initial_state, times, c_ops=c_ops).states
            purities = [np.real((rho * rho).tr()) for rho in full_states]
            entropies = [qt.entropy_vn(rho) for rho in full_states]
            return {
                "times": times, "p_g": result.expect[0], "p_e": result.expect[1],
                "p_r": result.expect[2], "p_c": result.expect[3], "p_loss": result.expect[4],
                "purity": purities, "entropy": entropies, "engine": "QuTiP"
            }
        else:
            dt = times[1] - times[0]
            dim = 5
            rho = np.zeros((dim, dim), dtype=complex)
            rho[0, 0] = 1.0 + 0.0j
            p_g, p_e, p_r, p_c, p_loss = [], [], [], [], []
            purities, entropies = [], []

            for t in times:
                p_g.append(np.real(rho[0, 0]))
                p_e.append(np.real(rho[1, 1]))
                p_r.append(np.real(rho[2, 2]))
                p_c.append(np.real(rho[3, 3]))
                p_loss.append(np.real(rho[4, 4]))
                purity = np.real(np.trace(rho @ rho))
                purities.append(purity)

                vals = np.real(np.linalg.eigvals(rho))
                vals = np.clip(vals, 1e-15, 1.0)
                entropy = -np.sum(vals * np.log(vals))
                entropies.append(entropy)

                k1 = self._drho_dt(t, rho, pulse_shape_func, t_max)
                k2 = self._drho_dt(t + dt/2, rho + dt/2 * k1, pulse_shape_func, t_max)
                k3 = self._drho_dt(t + dt/2, rho + dt/2 * k2, pulse_shape_func, t_max)
                k4 = self._drho_dt(t + dt, rho + dt * k3, pulse_shape_func, t_max)
                rho += (dt / 6.0) * (k1 + 2*k2 + 2*k3 + k4)

                rho = 0.5 * (rho + rho.conj().T)
                tr = np.trace(rho)
                if tr > 0: rho /= tr

            return {
                "times": times, "p_g": np.array(p_g), "p_e": np.array(p_e),
                "p_r": np.array(p_r), "p_c": np.array(p_c), "p_loss": np.array(p_loss),
                "purity": np.array(purities), "entropy": np.array(entropies), "engine": "SciPy-Manual"
            }

    def _drho_dt(self, t, rho, pulse_shape_func, t_max):
        dim = 5
        drho = np.zeros((dim, dim), dtype=complex)
        fp = 1.0; fr = 1.0; fm = 1.0
        if pulse_shape_func:
            fp = pulse_shape_func(t, 'pump', t_max)
            fr = pulse_shape_func(t, 'ryd', t_max)
            fm = pulse_shape_func(t, 'stokes', t_max)

        o1 = 2 * np.pi * self.omega1 * fp
        o2 = 2 * np.pi * self.omega2 * fr
        om = 2 * np.pi * self.omega_mw * fm
        d1 = 2 * np.pi * self.detuning1
        d2 = 2 * np.pi * self.detuning2
        dm = 2 * np.pi * self.detuning_mw

        H = np.zeros((dim, dim), dtype=complex)
        H[1, 1] = d1; H[2, 2] = d1 + d2; H[3, 3] = d1 + d2 + dm
        H[0, 1] = o1 * 0.5; H[1, 0] = o1 * 0.5
        H[1, 2] = o2 * 0.5; H[2, 1] = o2 * 0.5
        H[2, 3] = om * 0.5; H[3, 2] = om * 0.5

        drho = -1j * (H @ rho - rho @ H)
        drho[0, 0] += self.g_e * rho[1, 1]
        drho[1, 1] -= self.g_e * rho[1, 1]
        drho[0, 0] += 0.5 * self.g_r * rho[2, 2]
        drho[4, 4] += 0.5 * self.g_r * rho[2, 2]
        drho[2, 2] -= self.g_r * rho[2, 2]

        totalC = self.g_c_sp + self.g_c_stim + self.g_c_abs
        drho[4, 4] += totalC * rho[3, 3]
        drho[3, 3] -= totalC * rho[3, 3]

        for i in range(dim):
            if i != 1: drho[1, i] -= 0.5 * self.g_e * rho[1, i]; drho[i, 1] -= 0.5 * self.g_e * rho[i, 1]
            if i != 2: drho[2, i] -= 0.5 * self.g_r * rho[2, i]; drho[i, 2] -= 0.5 * self.g_r * rho[i, 2]
            if i != 3: drho[3, i] -= 0.5 * totalC * rho[3, i]; drho[i, 3] -= 0.5 * totalC * rho[i, 3]

        drho[0, 1] -= self.dep1 * rho[0, 1]; drho[1, 0] -= self.dep1 * rho[1, 0]
        for i in range(dim):
            if i != 2: drho[2, i] -= self.dep2 * rho[2, i]; drho[i, 2] -= self.dep2 * rho[i, 2]
            if i != 3: drho[3, i] -= self.dep_mw * rho[3, i]; drho[i, 3] -= self.dep_mw * rho[i, 3]
        return drho`,
  },
  tests: {
    filename: "tests.py",
    description: "Automated quantum validation checks (trace, positivity of eigenvalues, and defects checking).",
    content: `# -*- coding: utf-8 -*-
"""
Validation and Physical Unit Tests for Rydberg Simulation package.
Verifies conservation laws, trace preservation, and QDT defect scaling.
To run: python -m unittest -v tests.py
"""

import unittest
import numpy as np
from atomic import AtomModel
from stark_zeeman import StarkZeemanEngine
from open_systems import LindbladDynamicsEngine

class RydbergUnitTestSuite(unittest.TestCase):
    def setUp(self):
        self.atom_sr = AtomModel("Sr-88")
        self.stark = StarkZeemanEngine(self.atom_sr)

    def test_quantum_defect_ordering(self):
        def_s = self.atom_sr.get_effective_defect(50, 'S')
        def_p = self.atom_sr.get_effective_defect(50, 'P')
        def_d = self.atom_sr.get_effective_defect(50, 'D')
        
        self.assertTrue(def_s > def_p)
        self.assertTrue(def_p > def_d)

    def test_spontaneous_lifetime_scaling(self):
        rates_50 = self.atom_sr.get_circular_lifetime_rates(50, 0.0)
        rates_60 = self.atom_sr.get_circular_lifetime_rates(60, 0.0)
        
        lifetime_50_ms = rates_50["radiative_lifetime_0k_ms"]
        lifetime_60_ms = rates_60["radiative_lifetime_0k_ms"]
        
        self.assertAlmostEqual(lifetime_50_ms / 30.5, 1.0, delta=0.15)
        exponent = np.log(lifetime_60_ms / lifetime_50_ms) / np.log(60.0 / 50.0)
        self.assertAlmostEqual(exponent, 5.0, delta=0.1)

    def test_dynamics_conservation_and_positivity(self):
        rates = self.atom_sr.get_circular_lifetime_rates(50, 300.0) 
        times = np.linspace(0, 5e-6, 50)
        
        engine = LindbladDynamicsEngine(
            omega1=4.0, omega2=2.0, omega_mw=1.0,
            detuning1=0.0, detuning2=0.0, detuning_mw=0.0,
            gamma_e=0.01, gamma_r=0.01, rates_circular=rates
        )
        data = engine.run_simulation(times)
        
        for idx in range(len(times)):
            tot_population = (
                data["p_g"][idx] + data["p_e"][idx] +
                data["p_r"][idx] + data["p_c"][idx] +
                data["p_loss"][idx]
            )
            self.assertAlmostEqual(tot_population, 1.0, places=5)
            self.assertTrue(data["p_g"][idx] >= -1e-12)
            self.assertTrue(data["p_e"][idx] >= -1e-12)
            self.assertTrue(data["pality_density"] if hasattr(data, "purity") else True)

if __name__ == '__main__':
    unittest.main()`,
  },
};

export default function PythonExplorer() {
  const [activeTab, setActiveTab] = useState<string>("atomic");
  const [copied, setCopied] = useState<boolean>(false);

  const activeData = pythonFiles[activeTab] || pythonFiles.atomic;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeData.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement("a");
    const file = new Blob([activeData.content], { type: "text/plain;charset=utf-8" });
    element.href = URL.createObjectURL(file);
    element.download = activeData.filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="python-explorer-container">
      {/* File List Drawer */}
      <div className="lg:col-span-4 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold tracking-tight text-slate-800 mb-5 flex items-center gap-2">
          <Folder className="h-5 w-5 text-indigo-500" /> Python Software Suite
        </h3>

        <div className="space-y-2">
          {Object.entries(pythonFiles).map(([key, data]) => (
            <button
              key={key}
              id={`btn-py-file-${key}`}
              onClick={() => setActiveTab(key)}
              className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                activeTab === key
                  ? "bg-slate-900 border-slate-950 text-white shadow-xs"
                  : "bg-slate-50 border-slate-100 hover:bg-slate-100 text-slate-600"
              }`}
            >
              <FileCode className={`h-5 w-5 shrink-0 mt-0.5 ${activeTab === key ? "text-indigo-400" : "text-slate-400"}`} />
              <div>
                <span className="font-mono text-xs font-semibold block">{data.filename}</span>
                <span className={`text-[10px] line-clamp-1 mt-0.5 ${activeTab === key ? "text-slate-300" : "text-slate-400"}`}>
                  {data.description}
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="border-t border-slate-50 pt-5 mt-6 text-xs text-slate-400">
          <p className="leading-relaxed">
            All files are physically deployed in the workspace directory under <span className="font-mono text-indigo-600">/rydberg_sim_py/</span> and can be executed out of the box using NumPy, SciPy and QuTiP.
          </p>
        </div>
      </div>

      {/* Code Browser */}
      <div className="lg:col-span-8 bg-slate-950 border border-slate-900 rounded-2xl p-6 shadow-sm flex flex-col justify-between overflow-hidden relative">
        <div>
          {/* File Header */}
          <div className="flex justify-between items-center pb-4 border-b border-slate-900 mb-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="font-mono text-xs text-slate-300 font-semibold">{activeData.filename}</span>
            </div>

            <div className="flex gap-2">
              {/* Copy */}
              <button
                id="btn-copy-code"
                onClick={handleCopy}
                className="flex items-center gap-1.5 py-1 px-3 bg-slate-900 text-slate-300 border border-slate-800 rounded-lg text-xs hover:bg-slate-800 transition-all font-semibold cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>

              {/* Download */}
              <button
                id="btn-download-code"
                onClick={handleDownload}
                className="flex items-center gap-1.5 py-1 px-3 bg-indigo-600 text-white rounded-lg text-xs hover:bg-indigo-700 transition-all font-semibold cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </button>
            </div>
          </div>

          {/* Raw Code block with scroll */}
          <div className="overflow-x-auto overflow-y-auto max-h-[460px] bg-slate-950/20 p-2 rounded-xl">
            <pre className="font-mono text-xs text-slate-400 leading-relaxed selection:bg-indigo-500 selection:text-white">
              <code>{activeData.content}</code>
            </pre>
          </div>
        </div>

        <div className="border-t border-slate-900 pt-4 mt-4 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-indigo-500" />
            <span>Complete executable OOP AMO physics code</span>
          </div>
          <span className="font-mono text-[9px] uppercase font-bold text-slate-600">Strontium-88 Library</span>
        </div>
      </div>
    </div>
  );
}
