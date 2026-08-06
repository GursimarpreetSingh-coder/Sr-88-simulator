# -*- coding: utf-8 -*-
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
            return 0.0 # High-l states correspond to l_upper >= G, defect lies around 0
        series = self.defects[l_upper]
        return series.delta0 + series.delta2 / ((n - series.delta0) ** 2)

    def get_energy(self, n: int, l_char: str) -> float:
        """
        Returns atomic energy of state relative to the ionization threshhold.
        Unit: Joules.
        """
        defect = self.get_effective_defect(n, l_char)
        n_eff = n - defect
        return -H_PLANCK * RYDBERG_HZ / (n_eff ** 2)

    def get_energy_ev(self, n: int, l_char: str) -> float:
        """Returns atomic energy in eV."""
        return self.get_energy(n, l_char) / E_CHARGE

    def get_circular_lifetime_rates(self, n: int, temp_k: float) -> dict:
        """
        Computes accurate spontaneous and thermal decay/absorption transition rates for
        circular Rydberg state l = n-1, m = n-1. Incorporates Einstein coefficients for BBR.
        References:
            1. Haroche, Phys. Rev. A (1992)
            2. Gallagher, Rydberg Atoms (Cambridge, 1994)
        """
        # Spontaneous Circular Transition n -> n-1 circular dipole emission
        freq_spont = RYDBERG_HZ * (1.0 / ((n - 1) ** 2) - 1.0 / (n ** 2))
        omega_spont = 2 * np.pi * freq_spont

        # Pre-factor for dipole rate: 4 * omega^3 * e^2 * a_0^2 / (3 * h_bar * c^3 * 4*pi*epsilon_0)
        angular_factor = (4 * (omega_spont ** 3) * (E_CHARGE ** 2) * (BOHR_RADIUS ** 2)) / (
            3 * H_BAR * (SPEED_OF_LIGHT ** 3) * (4 * np.pi * EPSILON_0)
        )

        # High-accuracy numerical calculation of circular radial matrix factor:
        ln_num = (n - 1) * np.log(2 * n - 1) + 0.5 * np.log(2 * n - 1)
        ln_den = n * np.log(2 * n)
        radial_r2 = (n ** 4) * np.exp(2 * (ln_num - ln_den))

        # Radial decay probability
        rate_spont = angular_factor * radial_r2

        # Transition n -> n+1 excitation (BBR absorption)
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

        # Thermal occupation values (Plackian density)
        n_th_spont = 0.0
        n_th_abs = 0.0
        if temp_k > 0.02:
            n_th_spont = 1.0 / (np.exp((H_PLANCK * freq_spont) / (KB_BOLTZMANN * temp_k)) - 1.0)
            n_th_abs = 1.0 / (np.exp((H_PLANCK * freq_abs) / (KB_BOLTZMANN * temp_k)) - 1.0)

        rate_stimulated = rate_spont * n_th_spont
        statistical_factor = (2 * n + 1) / (2 * n - 1) # degeneracy adjustment
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
        }
