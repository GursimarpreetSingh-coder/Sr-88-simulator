/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { H_BAR } from "./constants";

export interface RydbergInteractionReport {
  c6CoefficientHzM6: number; // m^6 Hz (or GHz um^6)
  blockadeRadiusUm: number; // micrometers
  interactionEnergyMhz: number; // MHz at current separation
  foersterDetuningMhz: number; // Megahertz (critical Förster defect)
  regime: "Blockade" | "Weak Interaction" | "Incoherent";
}

/**
 * Computes multi-atom Rydberg interaction coefficients and blockade radius.
 * Accounts for C6 scaling (scales as n^11 for van der Waals) and resonant C3 scaling (n^4)
 * for Strontium-88.
 */
export function calculateRydbergInteractions(
  n: number,
  laserRabiMhz: number, // laser Rabi frequency driving Rydberg transition
  atomSeparationUm: number // atomic distance in micrometers
): RydbergInteractionReport {
  // van der Waals C6 interaction scaling:
  // C_6 \approx C_{6_base} * (n^11) or normalized as (n/50)^11
  // For Sr-88 singlet S-states, C6 is approx -50 GHz um^6 for n=50
  // Reference: Vaillant, Multichannel Quantum Defect Theory (2012)
  const baseC6_GHz_Um6 = -48.2; // GHz um^6 at n=50
  
  // Power-law scaling: C6(n) = C6(50) * (n/50)^11
  const c6_GHz_Um6 = baseC6_GHz_Um6 * Math.pow(n / 50.0, 11);

  // Convert GHz um^6 to SI units (Hz m^6)
  // Hz m^6 = GHz um^6 * 1e9 (Hz/GHz) * (1e-6)^6 (m^6/um^6) = GHz um^6 * 1e-27
  const c6CoefficientHzM6 = c6_GHz_Um6 * 1e-27;

  // Rydberg Blockade Radius: R_b = ( |C_6| / (hbar * \Omega) )^(1/6)
  // Since laserRabi is in MHz, \Omega = 2 * pi * laserRabi_Mhz * 1e6 Hz
  const omegaAng = 2 * Math.PI * laserRabiMhz * 1e6; // rad / s
  
  // Convert C6 to angular frequency SI units (rad m^6 / s)
  const c6_angular = Math.abs(c6_GHz_Um6) * 1e9 * 2 * Math.PI * 1e-36; // m^6 rad/s (using um^6 conversion)
  
  const blockadeRadiusM = Math.pow(c6_angular / omegaAng, 1.0 / 6.0);
  const blockadeRadiusUm = blockadeRadiusM * 1e6; // micrometers

  // Interaction Energy at current atomic separation (V_vdw = C_6 / R^6)
  // V in MHz
  const interactionEnergyMhz = c6_GHz_Um6 / Math.pow(atomSeparationUm, 6);

  // Förster resonant Stark Tuning defect approximation:
  // energy gap of Stark-tuned levels 2 * nS -> (n)P + (n-1)P
  // scales roughly like 1 / n^3
  const foersterDetuningMhz = 12400.0 / Math.pow(n, 3); // MHz

  // Define regime of interactions
  let regime: "Blockade" | "Weak Interaction" | "Incoherent" = "Incoherent";
  if (atomSeparationUm < blockadeRadiusUm) {
    regime = "Blockade";
  } else if (Math.abs(interactionEnergyMhz) > 0.05 * laserRabiMhz) {
    regime = "Weak Interaction";
  }

  return {
    c6CoefficientHzM6,
    blockadeRadiusUm,
    interactionEnergyMhz,
    foersterDetuningMhz,
    regime
  };
}
