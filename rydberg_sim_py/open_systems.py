# -*- coding: utf-8 -*-
"""
Open Quantum Systems dynamics solver for circular Rydberg state preparation.
Contains proper Lindblad Master Equation setup with complete collapse operators.
Integrates spontaneous decay, blackbody stimulated decay, and phase noise dephasing.

Utilizes QuTiP (Quantum Toolbox in Python) for physics dynamics.
Reference: Johansson et al., Comput. Phys. Commun. 183, 1760 (2012)
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
        """
        All rates are supplied in MHz.
        Basis representation:
        |0> = |g>  (Ground configuration, e.g. singlet)
        |1> = |e>  (Intermediate transition)
        |2> = |r>  (Rydberg state, e.g. low-l)
        |3> = |c>  (Target Circular Rydberg state)
        |4> = |L>  (Thermal/spontaneous leakage decay channel)
        """
        self.omega1 = omega1
        self.omega2 = omega2
        self.omega_mw = omega_mw
        self.detuning1 = detuning1
        self.detuning2 = detuning2
        self.detuning_mw = detuning_mw

        # Decays (MHz)
        self.g_e = gamma_e
        self.g_r = gamma_r
        # Circular state loss channels:
        self.g_c_sp = rates_circular["rate_spont_0k"] / 1e6
        self.g_c_stim = rates_circular["rate_stimulated_decay"] / 1e6
        self.g_c_abs = rates_circular["rate_absorption_loss"] / 1e6

        # Phase Noise Dephasings (MHz)
        self.dep1 = dephasing_laser1
        self.dep2 = dephasing_laser2
        self.dep_mw = dephasing_mw

    def build_qutip_system(self, pulse_shape_func=None, t_max=10.0) -> tuple:
        """
        Constructs QuTiP Qobj Hamiltonian and collapse list.
        Supports time-dependent pulse sweeps if pulse_shape_func is provided.
        """
        if not QUTIP_AVAILABLE:
            raise RuntimeError("QuTiP must be installed to compile this module's Qobj simulations.")

        # 5-level quantum basis states
        g = qt.basis(5, 0)
        e = qt.basis(5, 1)
        r = qt.basis(5, 2)
        c = qt.basis(5, 3)
        loss = qt.basis(5, 4)

        # Hamiltonian coherent transitions:
        # H0 Detuning terms (RWA frame)
        H0 = (
            2 * np.pi * self.detuning1 * e * e.dag() +
            2 * np.pi * (self.detuning1 + self.detuning2) * r * r.dag() +
            2 * np.pi * (self.detuning1 + self.detuning2 + self.detuning_mw) * c * c.dag()
        )

        # Rabi couplings
        H_rabi_g_e = np.pi * self.omega1 * (g * e.dag() + e * g.dag())
        H_rabi_e_r = np.pi * self.omega2 * (e * r.dag() + r * e.dag())
        H_rabi_r_c = np.pi * self.omega_mw * (r * c.dag() + c * r.dag())

        # If time-dependent, shape the fields
        if pulse_shape_func:
            # QuTiP Hamiltonian list with custom string or custom function shapes
            # Example: [H0, [H_rabi_g_e, f_pump], [H_rabi_e_r, f_ryd], [H_rabi_r_c, f_mw]]
            H_tot = [H0, [H_rabi_g_e, lambda t, args: pulse_shape_func(t, 'pump', t_max)],
                         [H_rabi_e_r, lambda t, args: pulse_shape_func(t, 'ryd', t_max)],
                         [H_rabi_r_c, lambda t, args: pulse_shape_func(t, 'stokes', t_max)]]
        else:
            H_tot = H0 + H_rabi_g_e + H_rabi_e_r + H_rabi_r_c

        # Collapse operator list (c_ops):
        c_ops = []

        # 1. Spontaneous Intermediate decay: L_e = sqrt(g_e) * |g><e|
        c_ops.append(np.sqrt(self.g_e) * (g * e.dag()))

        # 2. Spontaneous Rydberg decay: L_r = sqrt(0.5 * g_r) * |g><r| + sqrt(0.5 * g_r) * |loss><r|
        # (models cascade decay split between ground and intermediate level reservoirs)
        c_ops.append(np.sqrt(0.5 * self.g_r) * (g * r.dag()))
        c_ops.append(np.sqrt(0.5 * self.g_r) * (loss * r.dag()))

        # 3. Circular State decay channels (spontaneous, thermal stimulated emission and thermal absorption)
        g_c_total = self.g_c_sp + self.g_c_stim + self.g_c_abs
        c_ops.append(np.sqrt(g_c_total) * (loss * c.dag()))

        # 4. Phase Noise Pure Dephasings: L_deph = sqrt(2 * dep) * |state><state|
        c_ops.append(np.sqrt(2 * self.dep1) * (e * e.dag()))
        c_ops.append(np.sqrt(2 * self.dep2) * (r * r.dag()))
        c_ops.append(np.sqrt(2 * self.dep_mw) * (c * c.dag()))

        return H_tot, c_ops, g

    def run_simulation(self, times: np.ndarray, pulse_shape_func=None) -> dict:
        """
        Runs full Master Equation Solver and evaluates:
            1. Population in all levels
            2. State Purity Tr(rho^2)
            3. Von Neumann Entropy
        If QuTiP is unavailable, falls back to raw scipy-based RK4 density matrix propagation.
        """
        t_max = times[-1]
        
        if QUTIP_AVAILABLE:
            H, c_ops, g = self.build_qutip_system(pulse_shape_func, t_max)
            # Initial density matrix is pure ground state |g><g|
            initial_state = qt.ket2dm(g)
            
            # Execute QuTiP mesolve
            result = qt.mesolve(H, initial_state, times, c_ops=c_ops,
                                e_ops=[qt.projection(5, i, i) for i in range(5)])
            
            # Compute purity & entropy from full states:
            full_states = qt.mesolve(H, initial_state, times, c_ops=c_ops).states
            purities = [np.real((rho * rho).tr()) for rho in full_states]
            entropies = [qt.entropy_vn(rho) for rho in full_states]

            return {
                "times": times,
                "p_g": result.expect[0],
                "p_e": result.expect[1],
                "p_r": result.expect[2],
                "p_c": result.expect[3],
                "p_loss": result.expect[4],
                "purity": purities,
                "entropy": entropies,
                "engine": "QuTiP"
            }
        else:
            # High-fidelity custom RK4 integrator fallback in raw python/numpy (identical to JS)
            dt = times[1] - times[0]
            dim = 5
            rho = np.zeros((dim, dim), dtype=complex)
            rho[0, 0] = 1.0 + 0.0j

            p_g, p_e, p_r, p_c, p_loss = [], [], [], [], []
            purities, entropies = [], []

            for t in times:
                # Store records
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

                # Custom RK4 integration steps
                k1 = self._drho_dt(t, rho, pulse_shape_func, t_max)
                k2 = self._drho_dt(t + dt/2, rho + dt/2 * k1, pulse_shape_func, t_max)
                k3 = self._drho_dt(t + dt/2, rho + dt/2 * k2, pulse_shape_func, t_max)
                k4 = self._drho_dt(t + dt, rho + dt * k3, pulse_shape_func, t_max)

                rho += (dt / 6.0) * (k1 + 2*k2 + 2*k3 + k4)

                # Hermiticity + Trace recovery
                rho = 0.5 * (rho + rho.conj().T)
                tr = np.trace(rho)
                if tr > 0:
                    rho /= tr

            return {
                "times": times,
                "p_g": np.array(p_g),
                "p_e": np.array(p_e),
                "p_r": np.array(p_r),
                "p_c": np.array(p_c),
                "p_loss": np.array(p_loss),
                "purity": np.array(purities),
                "entropy": np.array(entropies),
                "engine": "SciPy-Manual"
            }

    def _drho_dt(self, t, rho, pulse_shape_func, t_max):
        # Companion function for custom NumPy solver
        dim = 5
        drho = np.zeros((dim, dim), dtype=complex)

        # Time dependent pulses
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

        # Hamiltonian Setup
        H = np.zeros((dim, dim), dtype=complex)
        H[1, 1] = d1
        H[2, 2] = d1 + d2
        H[3, 3] = d1 + d2 + dm

        H[0, 1] = o1 * 0.5; H[1, 0] = o1 * 0.5
        H[1, 2] = o2 * 0.5; H[2, 1] = o2 * 0.5
        H[2, 3] = om * 0.5; H[3, 2] = om * 0.5

        # Coherent -i[H, rho]
        drho = -1j * (H @ rho - rho @ H)

        # Decay terms
        # e -> g spontaneous
        drho[0, 0] += self.g_e * rho[1, 1]
        drho[1, 1] -= self.g_e * rho[1, 1]
        
        # r -> g spontaneous cascade
        drho[0, 0] += 0.5 * self.g_r * rho[2, 2]
        drho[4, 4] += 0.5 * self.g_r * rho[2, 2]
        drho[2, 2] -= self.g_r * rho[2, 2]

        # c -> loss spontaneous + BBR decay
        totalC = self.g_c_sp + self.g_c_stim + self.g_c_abs
        drho[4, 4] += totalC * rho[3, 3]
        drho[3, 3] -= totalC * rho[3, 3]

        # Coherence spontaneous lifetimes
        for i in range(dim):
            if i != 1: drho[1, i] -= 0.5 * self.g_e * rho[1, i]; drho[i, 1] -= 0.5 * self.g_e * rho[i, 1]
            if i != 2: drho[2, i] -= 0.5 * self.g_r * rho[2, i]; drho[i, 2] -= 0.5 * self.g_r * rho[i, 2]
            if i != 3: drho[3, i] -= 0.5 * totalC * rho[3, i]; drho[i, 3] -= 0.5 * totalC * rho[i, 3]

        # Dephasings
        drho[0, 1] -= self.dep1 * rho[0, 1]; drho[1, 0] -= self.dep1 * rho[1, 0]
        for i in range(dim):
            if i != 2: drho[2, i] -= self.dep2 * rho[2, i]; drho[i, 2] -= self.dep2 * rho[i, 2]
            if i != 3: drho[3, i] -= self.dep_mw * rho[3, i]; drho[i, 3] -= self.dep_mw * rho[i, 3]

        return drho
