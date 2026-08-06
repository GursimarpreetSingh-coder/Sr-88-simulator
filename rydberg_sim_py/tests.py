# -*- coding: utf-8 -*-
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
        """Physical rule: s-wave defects > p-wave > d-wave (orbital core penetration defect ordering)."""
        def_s = self.atom_sr.get_effective_defect(50, 'S')
        def_p = self.atom_sr.get_effective_defect(50, 'P')
        def_d = self.atom_sr.get_effective_defect(50, 'D')
        
        self.assertTrue(def_s > def_p)
        self.assertTrue(def_p > def_d)
        print(f"Defect Ordering Verified: s={def_s:.3f} > p={def_p:.3f} > d={def_d:.3f}")

    def test_spontaneous_lifetime_scaling(self):
        """Physical rule: n=50 circular radiative lifetime is ~30 ms, and scales roughly as ~n^5."""
        rates_50 = self.atom_sr.get_circular_lifetime_rates(50, 0.0)
        rates_60 = self.atom_sr.get_circular_lifetime_rates(60, 0.0)
        
        lifetime_50_ms = rates_50["radiative_lifetime_0k_ms"]
        lifetime_60_ms = rates_60["radiative_lifetime_0k_ms"]
        
        # lifetime should be ~30.5 ms for n=50
        self.assertAlmostEqual(lifetime_50_ms / 30.5, 1.0, delta=0.15)
        
        # Scaling exponent (log(tau60/tau50) / log(60/50)) should lie extremely close to 5.0
        exponent = np.log(lifetime_60_ms / lifetime_50_ms) / np.log(60.0 / 50.0)
        self.assertAlmostEqual(exponent, 5.0, delta=0.1)
        print(f"Radiative Lifetime Verified: n=50 is {lifetime_50_ms:.2f} ms; Scaling exponent n^{exponent:.3f} matches n^5 law.")

    def test_dynamics_conservation_and_positivity(self):
        """Open system rules: trace(rho) = 1, and populations (diagonal values) must be >= 0."""
        # Setup typical solver coefficients:
        rates = self.atom_sr.get_circular_lifetime_rates(50, 300.0) 
        times = np.linspace(0, 5e-6, 50) # short run
        
        engine = LindbladDynamicsEngine(
            omega1=4.0, omega2=2.0, omega_mw=1.0,
            detuning1=0.0, detuning2=0.0, detuning_mw=0.0,
            gamma_e=0.01, gamma_r=0.01, rates_circular=rates
        )
        
        data = engine.run_simulation(times)
        
        # Trace conservation check loop
        for idx in range(len(times)):
            tot_population = (
                data["p_g"][idx] + data["p_e"][idx] +
                data["p_r"][idx] + data["p_c"][idx] +
                data["p_loss"][idx]
            )
            self.assertAlmostEqual(tot_population, 1.0, places=5)
            
            # Positivity checks
            self.assertTrue(data["p_g"][idx] >= -1e-12)
            self.assertTrue(data["p_e"][idx] >= -1e-12)
            self.assertTrue(data["p_r"][idx] >= -1e-12)
            self.assertTrue(data["p_c"][idx] >= -1e-12)
            self.assertTrue(data["p_loss"][idx] >= -1e-12)
            
            # Purity limit Tr(rho^2) <= 1
            self.assertTrue(data["purity"][idx] <= 1.0001)

        print("Quantum Dynamics Conservation & Density Matrix Positivity Verified Successfully.")


if __name__ == '__main__':
    unittest.main()
