# -*- coding: utf-8 -*-
"""
Quantum Control Pulse design: STIRAP configurations, Rabi sweeps, and microwave
adiabatic ladder climbing profiles for circular state preparation.
Part of the Research-Grade Rydberg AMO Simulation package.
"""

import numpy as np

class QuantumPulseDesigner:
    @staticmethod
    def get_square_pulses(t: float, pulse_type: str, t_max: float) -> float:
        """Returns standard flat square fields."""
        if 0.05 * t_max <= t <= 0.95 * t_max:
            return 1.0
        return 0.0

    @staticmethod
    def get_gaussian_pulses(t: float, pulse_type: str, t_max: float) -> float:
        """Gaussian shapes peaking simultaneously at 50% time."""
        mu = t_max * 0.5
        sigma = t_max * 0.15
        return np.exp(-((t - mu) ** 2) / (2 * (sigma ** 2)))

    @staticmethod
    def get_stirap_pulses(t: float, pulse_type: str, t_max: float) -> float:
        """
        Counter-intuitive dynamic STIRAP sequence: Stokes fields leading the Pump fields.
        In our 4-level excitation scheme, Stokes fields (Rydberg microwave & RF excitation)
        drive first, peaking at 42%, followed by the Pump fields (ground excitation), peaking at 58%.
        """
        sigma = t_max * 0.12
        t_pump = t_max * 0.58
        t_stokes = t_max * 0.42

        if pulse_type == "pump":
            return np.exp(-((t - t_pump) ** 2) / (2 * (sigma ** 2)))
        elif pulse_type in ["ryd", "stokes"]:
            return np.exp(-((t - t_stokes) ** 2) / (2 * (sigma ** 2)))
        return 0.0

    @staticmethod
    def get_chirped_pulses(t: float, pulse_type: str, t_max: float) -> float:
        """
        Calculates adiabatic passage with a chirped microwave field.
        Maintains flat square envelopes but introduces frequency chirps inside the solver.
        """
        sweep_range = t_max * 0.8
        active = (t_max - sweep_range) * 0.5 <= t <= t_max - (t_max - sweep_range) * 0.5
        return 1.0 if active else 0.0


def shape_field_pulse(t: float, pulse_name: str, config_type: str, t_max: float) -> float:
    """Convenience delegate for system pulse shape calculations."""
    if config_type == "square":
         return QuantumPulseDesigner.get_square_pulses(t, pulse_name, t_max)
    elif config_type == "gaussian":
         return QuantumPulseDesigner.get_gaussian_pulses(t, pulse_name, t_max)
    elif config_type == "stirap":
         return QuantumPulseDesigner.get_stirap_pulses(t, pulse_name, t_max)
    elif config_type == "adiabatic_chirp":
         return QuantumPulseDesigner.get_chirped_pulses(t, pulse_name, t_max)
    return 1.0
