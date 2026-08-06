# -*- coding: utf-8 -*-
"""
Calculates Optical Tweezer trapping conditions, AC Stark polarizabilities, and 
long-range multi-atom Rydberg van der Waals (C6) and Dipole-Dipole (C3) interactions.
Part of the Research-Grade Rydberg AMO Simulation package.
"""

import numpy as np
from .atomic import EPSILON_0, SPEED_OF_LIGHT, AtomModel

class TrappingInteractionEngine:
    def __init__(self, atom_model: AtomModel):
        self.atom = atom_model

    def calculate_tweezer_trap(self, power_mw: float, waist_um: float, wavelength_nm: float) -> dict:
        """
        Calculates trapping properties of a red-detuned focused Gaussian laser tweezer.
        Accounts for dynamic polarizability of the ground state and the destructive free-electron
        ponderomotive potential repelling Rydberg states.
        """
        power_watts = power_mw * 1e-3
        w0 = waist_um * 1e-6
        lam = wavelength_nm * 1e-9

        # Peak intensity I_0 = 2P / (pi * w_0^2)
        i0 = (2.0 * power_watts) / (np.pi * w0**2)

        # Rayleigh range z_R = pi * w0^2 / lambda
        z_R = np.pi * w0**2 / lam

        # Convert polarizability from standard Atomic Units (a.u.) to SI:
        # 1 a.u. = 1.64877727436e-41 C m^2 / V
        au_to_si = 1.64877727436e-41
        
        # Approximate dynamic polarizability based on species & wavelength
        if self.atom.species == "Sr-88":
            if abs(wavelength_nm - 813.4) < 5:
                # Strontium-88 Clock magic wavelength
                polar_au = 286.0
            elif wavelength_nm > 1000:
                # Infrared 1064nm dipole trap
                polar_au = 360.0
            else:
                polar_au = 180.0
        else:
            # Rubidium-87 polarizabilities
            if wavelength_nm > 1000:
                polar_au = 311.0
            elif abs(wavelength_nm - 780.2) < 10:
                polar_au = 450.0
            else:
                polar_au = 120.0

        alpha_si = polar_au * au_to_si

        # Dipole potential depth: U_0 = Re(alpha) * I_0 / (2 * epsilon_0 * c)
        u0_joules = (1.0 / (2.0 * EPSILON_0 * SPEED_OF_LIGHT)) * alpha_si * i0

        # Convert potential to Kelvin and MHz
        u0_kelvin = u0_joules / 1.380649e-23
        u0_mhz = u0_joules / (6.62607015e-34 * 1e6)

        # Trap frequencies (harmonic approximation):
        m = self.atom.mass
        omega_rad = 0.0
        omega_axial = 0.0
        if u0_joules > 0:
            omega_rad = np.sqrt(4.0 * u0_joules / (m * w0**2))
            omega_axial = np.sqrt(2.0 * u0_joules / (m * z_R**2))

        # Ponderomotive potential felt by the Rydberg electron:
        # U_pond = e^2 * I_0 / (2 * epsilon_0 * m_e * c * omega_laser^2)
        m_e = 9.1093837e-31
        e = 1.60217663e-19
        omega_laser = 2 * np.pi * SPEED_OF_LIGHT / lam
        u_pond_joules = (e**2 * i0) / (2.0 * EPSILON_0 * m_e * SPEED_OF_LIGHT * omega_laser**2)
        u_pond_ev = u_pond_joules / e

        return {
            "intensity_peak_w_m2": i0,
            "rayleigh_range_um": z_R * 1e6,
            "polarizability_au": polar_au,
            "trap_depth_kelvin": u0_kelvin,
            "trap_depth_mhz": u0_mhz,
            "radial_freq_hz": omega_rad / (2 * np.pi),
            "axial_freq_hz": omega_axial / (2 * np.pi),
            "ponderomotive_barrier_ev": u_pond_ev
        }

    def calculate_interactions(self, n: int, drive_rabi_mhz: float, separation_um: float) -> dict:
        """
        Calculates van der Waals interaction coefficient C6 and corresponding Rydberg blockade radius.
        
        V(R) = C6 / R^6.
        Blockade radius is defined where energy shift matches Rabi excitation width: C6 / Rb^6 = h_bar * Omega.
        """
        # C6 scales with n^11. For singlet S states of Strontium, C6(n=50) ~ -48.2 GHz um^6
        base_c6_ghz_um6 = -48.2
        c6_ghz_um6 = base_c6_ghz_um6 * np.pow(n / 50.0, 11)

        # Convert C6 to SI terms: Hz m^6 (GHz um^6 * 1e-27)
        c6_hz_m6 = c6_ghz_um6 * 1e-27

        # Convert Rabi drive to angular frequency (rad / s)
        omega_ang = 2 * np.pi * drive_rabi_mhz * 1e6

        # Convert C6 to angular terms (rad m^6 / s)
        c6_angular = np.abs(c6_ghz_um6) * 1e9 * 2 * np.pi * 1e-36 # m^6 rad/s

        blockade_radius_m = (c6_angular / omega_ang) ** (1.0 / 6.0)
        blockade_radius_um = blockade_radius_m * 1e6

        # Interaction energy shifted at active separation
        interaction_mhz = c6_ghz_um6 / (separation_um ** 6)

        # Förster energy defect scaling 2*nS -> nP + (n-1)P
        foerster_defect_mhz = 12400.0 / (n ** 3)

        return {
            "c6_ghz_um6": c6_ghz_um6,
            "c6_hz_m6": c6_hz_m6,
            "blockade_radius_um": blockade_radius_um,
            "interaction_energy_mhz": interaction_mhz,
            "foerster_defect_mhz": foerster_defect_mhz,
            "blockaded": separation_um < blockade_radius_um
        }
