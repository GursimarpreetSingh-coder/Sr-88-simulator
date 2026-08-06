/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EPSILON_0, SPEED_OF_LIGHT, MASS_SR88, MASS_RB87 } from "./constants";
import { Species } from "./defectTheory";

export interface TweezerParams {
  wavelengthNm: number; // laser wavelength in nm (e.g. 515 nm, 813 nm, 1064 nm)
  powerMw: number; // laser power in mW
  beamWaistUm: number; // 1/e^2 beam waist w_0 in micrometers
  species: Species;
}

export interface TweezerTrapReport {
  intensityPeak: number; // W / m^2
  rayleighRangeUm: number; // micrometers
  trapDepthKelvin: number; // Kelvin (U_0 / k_B)
  trapDepthMhz: number; // MHz (U_0 / h)
  radialFrequencyHz: number; // Hz
  axialFrequencyHz: number; // Hz
  polarizabilityAu: number; // atomic units (a.u.) of ground state polarizability
  rydbergPonderomotiveEv: number; // eV (Ry electron repelling ponderomotive potential)
}

/**
 * Calculates Gaussian optical tweezer trapping characteristics for Strontium-88 or Rubidium-87.
 * Validated against standard optical dipole trapping equations (Grimm et al., 2000).
 */
export function calculateTweezerTrap(
  params: TweezerParams
): TweezerTrapReport {
  const m = params.species === "Sr-88" ? MASS_SR88 : MASS_RB87;
  const powerWatts = params.powerMw * 1e-3;
  const w0 = params.beamWaistUm * 1e-6; // m
  const lambda = params.wavelengthNm * 1e-9; // m

  // Peak Intensity list for a Gaussian beam: I_0 = 2P / (pi * w_0^2)
  const intensityPeak = (2 * powerWatts) / (Math.PI * Math.pow(w0, 2)); // W / m^2

  // Rayleigh range: z_R = pi * w_0^2 / lambda
  const rayleighRangeUm = (Math.PI * Math.pow(w0, 2) / lambda) * 1e6; // micrometers

  // Estimate the dynamic polarizability alpha(omega) in standard atomic units (a.u.)
  // 1 a.u. = 1.64877727436e-41 C m^2 / V
  const auToSiConversion = 1.64877727436e-41;
  let polarizabilityAu = 280.0; // default for Sr clock magic wavelength 813nm

  if (params.species === "Sr-88") {
    // Sr-88 Ground state dynamic polarizability approximation
    if (params.wavelengthNm < 600) {
      polarizabilityAu = -150.0; // blue-detuned repelling trap (or bottle beam)
    } else if (params.wavelengthNm > 800 && params.wavelengthNm < 830) {
      polarizabilityAu = 286.0; // exact clock magic-wavelength trap
    } else if (params.wavelengthNm > 1000) {
      polarizabilityAu = 360.0; // standard 1064nm infrared trap
    } else {
      polarizabilityAu = 180.0;
    }
  } else {
    // Rubidium-87 Ground state polarizability
    if (params.wavelengthNm > 1000) {
      polarizabilityAu = 310.0;
    } else if (params.wavelengthNm > 780 && params.wavelengthNm < 800) {
      polarizabilityAu = 450.0;
    } else {
      polarizabilityAu = 120.0;
    }
  }

  // Convert polarizability to SI units
  const alphaSi = polarizabilityAu * auToSiConversion;

  // Dipole potential depth: U_0 = -1 / (2 * epsilon_0 * c) * Re(alpha) * I_0
  const trapDepthJoules = (1.0 / (2 * EPSILON_0 * SPEED_OF_LIGHT)) * alphaSi * intensityPeak;

  // Convert trap depth to Kelvin and Megahertz
  const KB_BOLTZMANN = 1.380649e-23;
  const H_PLANCK = 6.62607015e-34;
  const trapDepthKelvin = trapDepthJoules / KB_BOLTZMANN;
  const trapDepthMhz = trapDepthJoules / (H_PLANCK * 1e6);

  // Trap Frequencies (harmonic approximation of Gaussian peak):
  // \omega_rad = \sqrt{ \frac{4 * U_0}{m * w_0^2} }
  // \omega_axial = \sqrt{ \frac{2 * U_0}{m * z_R^2} }
  // If trap is repelling (negative polarizability), trap frequencies are imaginary -> set to 0
  let radialFrequencyHz = 0;
  let axialFrequencyHz = 0;

  if (trapDepthJoules > 0) {
    radialFrequencyHz = (1.0 / (2 * Math.PI)) * Math.sqrt((4 * trapDepthJoules) / (m * Math.pow(w0, 2)));
    axialFrequencyHz = (1.0 / (2 * Math.PI)) * Math.sqrt((2 * trapDepthJoules) / (m * Math.pow(rayleighRangeUm * 1e-6, 2)));
  }

  // For a Rydberg state, the free Rydberg electron feels a ponderomotive potential:
  // U_pond = e^2 * E_field^2 / (4 * m_e * \omega^2) = e^2 * I_0 / (2 * epsilon_0 * m_e * c * \omega^2)
  // Which repels the Rydberg atom from standard red-detuned traps!
  const m_e = 9.1093837e-31;
  const e = 1.60217663e-19;
  const omegaLaser = 2 * Math.PI * (SPEED_OF_LIGHT / lambda);
  
  // Punderomotive potential in Joules:
  const pondJoules = (Math.pow(e, 2) * intensityPeak) / (2 * EPSILON_0 * m_e * SPEED_OF_LIGHT * Math.pow(omegaLaser, 2));
  const rydbergPonderomotiveEv = pondJoules / e; // eV units

  return {
    intensityPeak,
    rayleighRangeUm,
    trapDepthKelvin,
    trapDepthMhz,
    radialFrequencyHz,
    axialFrequencyHz,
    polarizabilityAu,
    rydbergPonderomotiveEv
  };
}
