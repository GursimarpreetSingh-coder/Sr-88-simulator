# -*- coding: utf-8 -*-
"""
High-Level Simulation coordinator and parameter sweep wrappers.
Part of the Research-Grade Rydberg AMO Simulation package.
Handles structured scans (e.g. Temperature sweeps) to study state preparation fidelity.
"""

import numpy as np
from .atomic import AtomModel
from .stark_zeeman import StarkZeemanEngine
from .open_systems import LindbladDynamicsEngine
from .control import shape_field_pulse

class SimulationCoordinator:
    def __init__(self, species: str = "Sr-88"):
        self.atom = AtomModel(species)
        self.stark_zeeman = StarkZeemanEngine(self.atom)

    def sweep_temperature_lifetimes(self, n: int, temperatures: list) -> dict:
        """
        Sweeps temperatures to evaluate spontaneous and blackbody stimulated lifetimes of 
        circular Rydberg state n.
        """
        results = {}
        for T in temperatures:
            rates = self.atom.get_circular_lifetime_rates(n, T)
            results[T] = rates
        return results

    def simulate_state_climb(self, n: int, T_kelvin: float, pulse_type: str = "stirap",
                             t_max_us: float = 10.0, steps: int = 400) -> dict:
        """
        Runs comprehensive master equation dynamics for a ladder-preparation scheme (|g> -> |e> -> |r> -> |c>).
        Uses proper temperature-dependent BBR excitation rates from our atomic model.
        """
        # 1. Fetch exact circular state decay properties under BBR
        rates_circ = self.atom.get_circular_lifetime_rates(n, T_kelvin)

        # 2. Setup standard typical experiment Rabi parameters (in MHz)
        omega1 = 4.0
        omega2 = 2.5
        omega_mw = 1.2
        
        # Ground -> intermediate linewidth (Sr-88 3P1 narrow decay is 7.5 kHz = 0.0075 MHz)
        gamma_e = 0.0075
        
        # Rydberg s/d state spontaneous decay is typically ~10 kHz (0.01 MHz) at n=50
        gamma_r = 0.01

        # 3. Compile Master Engine Solver
        times = np.linspace(0.0, t_max_us, steps)
        engine = LindbladDynamicsEngine(
            omega1=omega1, omega2=omega2, omega_mw=omega_mw,
            detuning1=0.0, detuning2=0.0, detuning_mw=0.0,
            gamma_e=gamma_e, gamma_r=gamma_r, rates_circular=rates_circ
        )

        pulse_lambda = lambda t, pulse_name, t_max: shape_field_pulse(t, pulse_name, pulse_type, t_max)
        simulation_data = engine.run_simulation(times, pulse_shape_func=pulse_lambda)

        return simulation_data
