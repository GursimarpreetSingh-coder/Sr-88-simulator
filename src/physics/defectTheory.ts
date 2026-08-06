/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  RYDBERG_CONSTANT_HZ,
  SPEED_OF_LIGHT,
  H_BAR,
  KB_BOLTZMANN,
  BOHR_RADIUS,
  E_CHARGE,
  EPSILON_0,
  H_PLANCK
} from "./constants";

export interface StateDefect {
  delta0: number;
  delta2: number;
}

// Published Quantum Defects for Strontium-88 (Singlet series)
// Reference: Vaillant et al., J. Phys. B 45, 135004 (2012)
export const SR88_DEFECTS: Record<string, StateDefect> = {
  S: { delta0: 3.26896, delta2: -0.138 },
  P: { delta0: 2.72950, delta2: -0.070 },
  D: { delta0: 2.38072, delta2: -1.630 },
  F: { delta0: 0.08900, delta2: 0.000 },
};

// Published Quantum Defects for Rubidium-87
// Reference: Li et al., Phys. Rev. A 67, 052502 (2003)
export const RB87_DEFECTS: Record<string, StateDefect> = {
  S: { delta0: 3.13118, delta2: 0.1784 },
  P: { delta0: 2.64167, delta2: 0.295 },
  D: { delta0: 1.34809, delta2: -0.6028 },
  F: { delta0: 0.01630, delta2: 0.000 },
};

export type Species = "Sr-88" | "Rb-87";

/**
 * Calculates the Rydberg energy (in eV and Joules) and frequency detuning.
 * Uses species-specific mass adjustments for Ryd_inf if exact reduction factor is desired,
 * here we use high-accuracy standard defects.
 * E = - R_inf / (n - delta)^2
 */
export function getRydbergEnergy(
  species: Species,
  n: number,
  lLetter: string
): { energyEv: number; energyHz: number; defect: number } {
  const defects = species === "Sr-88" ? SR88_DEFECTS : RB87_DEFECTS;
  const lUpper = lLetter.toUpperCase();

  // Circular or high-l states have delta ~= 0
  let delta0 = 0;
  let delta2 = 0;

  if (defects[lUpper]) {
    delta0 = defects[lUpper].delta0;
    delta2 = defects[lUpper].delta2;
  }

  // Self-consistent effective defect computation
  // delta_n = delta0 + delta2 / (n - delta0)^2
  let defect = delta0;
  if (n - delta0 > 0) {
    defect = delta0 + delta2 / Math.pow(n - delta0, 2);
  }

  // For circular state, force defect to be exactly 0
  const isCircular = lUpper === "CIRCULAR" || (lUpper === "G" && n === 5) || n - 1 === lToLNum(lLetter);
  if (isCircular) {
    defect = 0;
  }

  const nEff = n - defect;
  if (nEff <= 0) {
    return { energyEv: 0, energyHz: 0, defect: 0 };
  }

  // Energy relative to ionization potential (negative value)
  const Ry_eV = 13.605693; // eV
  const energyEv = -Ry_eV / Math.pow(nEff, 2);
  const energyHz = -RYDBERG_CONSTANT_HZ / Math.pow(nEff, 2);

  return { energyEv, energyHz, defect };
}

/**
 * Maps L alphabetical letters to numerical values.
 */
export function lToLNum(lLetter: string): number {
  const map: Record<string, number> = { S: 0, P: 1, D: 2, F: 3, G: 4, H: 5, I: 6 };
  return map[lLetter.toUpperCase()] !== undefined ? map[lLetter.toUpperCase()] : 0;
}

/**
 * Maps L numerical values to alphabetical letters.
 */
export function lNumToLetter(lNum: number): string {
  const letters = ["S", "P", "D", "F", "G", "H", "I", "J", "K", "L", "M", "N"];
  return letters[lNum] || `l=${lNum}`;
}

/**
 * Circular State Lifetime Engine:
 * Computes spontaneous decay rates at T=0K and blackbody absorption/stimulated-emission rates.
 * Model conforms to Kleppner (1981) and Haroche (1992) quantum optics equations.
 * Units: Frequency in Hz, rates in 1/s.
 */
export interface CircularLifetimeDetails {
  transitionFreqSpontaneous: number; // Hz (n -> n-1 circular transition)
  transitionFreqAbsorption: number; // Hz (n -> n+1 circular transition)
  rateSpontaneous: number; // 1/s
  rateStimulatedSpontaneous: number; // 1/s
  rateAbsorption: number; // 1/s
  nThermalSpontaneous: number; // Mean photon occupation number (n -> n-1)
  nThermalAbsorption: number; // Mean photon occupation number (n -> n+1)
  totalLifetimeMs: number; // ms
  radiativeLifetimeMs: number; // ms (0 Kelvin spontaneous emission only)
}

export function computeCircularLifetime(
  n: number,
  temperatureKelvin: number
): CircularLifetimeDetails {
  // Spontaneous Circular transition n -> n-1 frequency (Hz)
  const freqN_Nminus1 = RYDBERG_CONSTANT_HZ * (1 / Math.pow(n - 1, 2) - 1 / Math.pow(n, 2));
  // Spontaneous Circular transition n+1 -> n frequency (Hz) for absorption
  const freqNplus1_N = RYDBERG_CONSTANT_HZ * (1 / Math.pow(n, 2) - 1 / Math.pow(n + 1, 2));

  // Spontaneous decay rate at 0K (circular state l = n-1, m = n-1)
  // \Gamma_{sp}(n \to n-1) = \frac{4 \omega^3 |d|^2}{3 \hbar c^3 (4\pi \epsilon_0)}
  // For Circular-Circular, |d|^2 = e^2 a_0^2 \cdot \frac{n^2 (2n-1)^{2n-2}}{(2n)^{2n}} \approx e^2 a_0^2 \frac{n^4}{2 e}
  const omegaSpont = 2 * Math.PI * freqN_Nminus1;
  const angularPreFactor = (4 * Math.pow(omegaSpont, 3) * Math.pow(E_CHARGE, 2) * Math.pow(BOHR_RADIUS, 2)) / 
                           (3 * H_BAR * Math.pow(SPEED_OF_LIGHT, 3) * (4 * Math.PI * EPSILON_0));
  
  // Radial matrix element scaling: I_n^{n-1} = n^2 * \frac{(2n-1)^{n-1} * \sqrt{2n-1}}{(2n)^n}
  // Let's compute this value extremely carefully (using log storage to prevent JavaScript overflow)
  const logNumerator = (n - 1) * Math.log(2 * n - 1) + 0.5 * Math.log(2 * n - 1);
  const logDenominator = n * Math.log(2 * n);
  const radialSquare = Math.pow(n, 4) * Math.exp(2 * (logNumerator - logDenominator));
  
  // Spontaneous transition rate (1/s)
  const rateSpontaneous = angularPreFactor * radialSquare;

  // Spontaneous emission rate from n+1 to n (for absorption calculation)
  const omegaAbs = 2 * Math.PI * freqNplus1_N;
  const angularPreFactorNplus1 = (4 * Math.pow(omegaAbs, 3) * Math.pow(E_CHARGE, 2) * Math.pow(BOHR_RADIUS, 2)) / 
                                 (3 * H_BAR * Math.pow(SPEED_OF_LIGHT, 3) * (4 * Math.PI * EPSILON_0));
  const np1 = n + 1;
  const logNumeratorAb = (np1 - 1) * Math.log(2 * np1 - 1) + 0.5 * Math.log(2 * np1 - 1);
  const logDenominatorAb = np1 * Math.log(2 * np1);
  const radialSquareNplus1 = Math.pow(np1, 4) * Math.exp(2 * (logNumeratorAb - logDenominatorAb));
  const rateSpontaneousNplus1 = angularPreFactorNplus1 * radialSquareNplus1;

  // Thermal photon occupation: n_th = 1 / (exp(h f / k_B T) - 1)
  let nThermalSpontaneous = 0;
  let nThermalAbsorption = 0;

  if (temperatureKelvin > 0.05) {
    const exponentSpont = (H_PLANCK * freqN_Nminus1) / (KB_BOLTZMANN * temperatureKelvin);
    nThermalSpontaneous = 1 / (Math.exp(exponentSpont) - 1);

    const exponentAbs = (H_PLANCK * freqNplus1_N) / (KB_BOLTZMANN * temperatureKelvin);
    nThermalAbsorption = 1 / (Math.exp(exponentAbs) - 1);
  }

  // Stimulated spontaneous decay: \Gamma_stim = \Gamma_sp * n_th
  const rateStimulatedSpontaneous = rateSpontaneous * nThermalSpontaneous;

  // Blackbody absorption rate from n to n+1
  // In circular state, transition absorption can only drive l=n-1 -> l'=n and m=n-1 -> m'=n
  // The rate is \Gamma_abs = \Gamma_{n+1\to n}^{sp} \cdot n_th (omega_abs) \cdot (2l_{final}+1)/(2l_{initial}+1)
  // For circular state absorption l_i = n-1, l_f = n, so (2(n)+1)/(2(n-1)+1) = (2n+1)/(2n-1)
  const statisticalFactor = (2 * n + 1) / (2 * n - 1);
  const rateAbsorption = rateSpontaneousNplus1 * nThermalAbsorption * statisticalFactor;

  // Total rate combines spontaneous (which always occurs) + stimulated spont + absorption
  const totalRate = rateSpontaneous + rateStimulatedSpontaneous + rateAbsorption;
  const totalLifetimeMs = 1000 / totalRate;
  const radiativeLifetimeMs = 1000 / rateSpontaneous;

  return {
    transitionFreqSpontaneous: freqN_Nminus1,
    transitionFreqAbsorption: freqNplus1_N,
    rateSpontaneous,
    rateStimulatedSpontaneous,
    rateAbsorption,
    nThermalSpontaneous,
    nThermalAbsorption,
    totalLifetimeMs,
    radiativeLifetimeMs
  };
}
