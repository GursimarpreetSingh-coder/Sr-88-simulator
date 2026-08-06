/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Fundamental Physical Constants (SI & Atomic Units)
// Reference: CODATA 2018 Recommended Values & Gallagher's Rydberg Atoms

export const H_BAR = 1.054571817e-34; // J s (Planck's constant / 2pi)
export const H_PLANCK = 6.62607015e-34; // J s
export const E_CHARGE = 1.602176634e-19; // C (Elementary charge)
export const M_ELECTRON = 9.1093837015e-31; // kg (Electron mass)
export const BOHR_RADIUS = 5.29177210903e-11; // m (a_0)
export const SPEED_OF_LIGHT = 299792458; // m/s (c)
export const KB_BOLTZMANN = 1.380649e-23; // J/K (Boltzmann constant)
export const EPSILON_0 = 8.8541878128e-12; // F/m (Vacuum permittivity)
export const BOHR_MAGNETON = 9.2740100783e-24; // J/T (mu_B)
export const RYDBERG_CONSTANT_HZ = 3.2898419602508e15; // Hz (R_inf in Hz)
export const RYDBERG_CONSTANT_EV = 13.605693122994; // eV (R_inf in eV)

// Species Mass
export const MASS_SR88 = 87.9056121 * 1.6605390666e-27; // kg (Strontium-88 mass)
export const MASS_RB87 = 86.9091805 * 1.6605390666e-27; // kg (Rubidium-87 mass)

/**
 * Converts frequency in Hz to energy in Joules.
 */
export function hzToJoules(freqHz: number): number {
  return H_PLANCK * freqHz;
}

/**
 * Converts Joules to eV.
 */
export function joulesToEv(joules: number): number {
  return joules / E_CHARGE;
}
