# -*- coding: utf-8 -*-
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
        """
        Builds the Rydberg Stark and Zeeman Hamiltonian in the |n, l, m> basis.
        Couples delta_l = +-1 states using dynamic radial dipole elements.
        
        Args:
            n: principal quantum number
            m: projection quantum number
            e_field_v_m: Electric field along z axis in V/m
            b_field_gauss: Magnetic field along z axis in Gauss
            
        Returns:
            H_mhz: Hamiltonian matrix (2D numpy array) in MHz
            basis_l: list of l-values matching the matrix row index
        """
        abs_m = abs(m)
        basis_l = list(range(abs_m, n))
        dim = len(basis_l)
        H = np.zeros((dim, dim), dtype=float)

        # 1 Gauss = 1e-4 Tesla
        b_tesla = b_field_gauss * 1e-4
        # Zeeman shift delta_E = m * mu_B * B / h (using g_L = 1 for singlet Rydberg states)
        zeeman_mhz = (BOHR_MAGNETON * b_tesla * m) / (H_PLANCK * 1e6)

        # Diagonal Elements: Atomic Energies (from defects) + Constant Zeeman shift
        # Note: Zeeman shift is identical for all states inside this m-conserving manifold!
        for i, l in enumerate(basis_l):
            l_char = self._get_l_char(l)
            energy_hz = self.atom.get_energy(n, l_char) / H_PLANCK
            H[i, i] = (energy_hz / 1e6) + zeeman_mhz

        # Off-Diagonal Elements: Stark Dipole Couplings
        # H_stark = -e * E * z, where z = r * cos(theta)
        for i in range(dim - 1):
            l = basis_l[i]
            next_l = basis_l[i + 1]
            
            # Selection rules: l -> l+1
            if next_l == l + 1:
                # 1. Angular matrix element: <l, m| cos(theta) | l+1, m>
                angular_term = np.sqrt(
                    (next_l**2 - m**2) / ((2 * l + 1) * (2 * next_l + 1))
                )
                
                # 2. Radial matrix element coupling: <n, l+1| r | n, l>
                # Hydrogenic exact radial matrix factor within same n manifold:
                # <n, l| r | n, l-1> = 1.5 * n * sqrt(n^2 - l^2) * a_0
                radial_term = 1.5 * n * np.sqrt(n**2 - next_l**2) * BOHR_RADIUS
                
                # Coupling coefficient in Joules
                coupling_j = -E_CHARGE * e_field_v_m * radial_term * angular_term
                coupling_mhz = coupling_j / (H_PLANCK * 1e6)
                
                H[i, i + 1] = coupling_mhz
                H[i + 1, i] = coupling_mhz # Hermiticity

        return H, basis_l

    def diagonalize(self, n: int, m: int, e_field_v_m: float, b_field_gauss: float) -> tuple:
        """
        Diagonalizes the Stark-Zeeman Hamiltonian.
        Returns sorted eigenvalues and eigenvectors.
        """
        H, basis_l = self.build_hamiltonian_mhz(n, m, e_field_v_m, b_field_gauss)
        eigenvalues, eigenvectors = np.linalg.eigh(H)
        return eigenvalues, eigenvectors, basis_l

    def generate_stark_map(self, n: int, m: int, e_fields: np.ndarray, b_field_gauss: float) -> np.ndarray:
        """
        Sweeps electric field values and returns 2D array of eigenvalues for Stark plotting.
        Rows: e_field sweeps, Columns: Eigenenergy values in MHz
        """
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
        return 'G' # fallback to hydrogenic
