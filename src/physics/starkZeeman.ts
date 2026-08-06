/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BOHR_RADIUS, E_CHARGE, H_PLANCK, BOHR_MAGNETON } from "./constants";
import { getRydbergEnergy, Species } from "./defectTheory";

// Diagonalizes any small symmetric real matrix in JavaScript/TypeScript using the Jacobi Algorithm.
// This is numerically stable, fast, self-contained, and preserves physical eigenvectors.
export function diagonalizeJacobi(
  matrix: number[][]
): { eigenvalues: number[]; eigenvectors: number[][] } {
  const n = matrix.length;
  // Initialize eigenvalues to diagonal
  const d = new Array(n).fill(0);
  const v = Array.from({ length: n }, () => new Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    d[i] = matrix[i][i];
    v[i][i] = 1.0;
  }

  const maxIterations = 500;
  const tolerance = 1e-12;

  for (let iter = 0; iter < maxIterations; iter++) {
    let maxOffDiag = 0;
    let p = 0;
    let q = 0;

    // Find the largest off-diagonal element
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const val = Math.abs(matrix[i][j]);
        if (val > maxOffDiag) {
          maxOffDiag = val;
          p = i;
          q = j;
        }
      }
    }

    if (maxOffDiag < tolerance) {
      break; // Convergence reached
    }

    const apq = matrix[p][q];
    const app = d[p];
    const aqq = d[q];

    // Compute rotation angle (theta)
    const phi = 0.5 * (aqq - app) / apq;
    let t = 1.0 / (Math.abs(phi) + Math.sqrt(1.0 + phi * phi));
    if (phi < 0) t = -t;

    const c = 1.0 / Math.sqrt(1.0 + t * t);
    const s = t * c;
    const tau = s / (1.0 + c);

    // Update diagonal values
    d[p] = app - t * apq;
    d[q] = aqq + t * apq;

    matrix[p][q] = 0;

    // Update matrix elements elements coupling to rotational space
    for (let i = 0; i < n; i++) {
      if (i !== p && i !== q) {
        const aip = matrix[i][p];
        const aiq = matrix[i][q];
        matrix[i][p] = aip - s * (aiq + aip * tau);
        matrix[p][i] = matrix[i][p];
        matrix[i][q] = aiq + s * (aip - aiq * tau);
        matrix[q][i] = matrix[i][q];
      }
    }

    // Update eigenvectors
    for (let i = 0; i < n; i++) {
      const vip = v[i][p];
      const viq = v[i][q];
      v[i][p] = vip - s * (viq + vip * tau);
      v[i][q] = viq + s * (vip - viq * tau);
    }
  }

  // Sort by eigenvalue (ascending order)
  const indices = Array.from({ length: n }, (_, i) => i);
  indices.sort((a, b) => d[a] - d[b]);

  const sortedEigenvalues = indices.map((i) => d[i]);
  const sortedEigenvectors = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sortedEigenvectors[i][j] = v[i][indices[j]];
    }
  }

  return { eigenvalues: sortedEigenvalues, eigenvectors: sortedEigenvectors };
}

/**
 * Builds the Hamiltonian matrix in the basis |n, l, m> for a given local n and m.
 * Handles the Stark Effect via electric field Ey, and the Zeeman Effect via magnetic field bField.
 * Base energies calculated via Species defects.
 */
export function buildStarkZeemanHamiltonian(
  species: Species,
  n: number,
  m: number,
  electricFieldV_m: number, // V / m
  magneticFieldGauss: number // Gauss (1 Gauss = 1e-4 T)
): { hamiltonianMhz: number[][]; basisL: number[] } {
  const absM = Math.abs(m);
  // Basis: l ranges from |m| up to n-1
  const basisL: number[] = [];
  for (let l = absM; l <= n - 1; l++) {
    basisL.push(l);
  }

  const dim = basisL.length;
  const H = Array.from({ length: dim }, () => new Array(dim).fill(0));

  // MHz conversions:
  // E_Mhz = E_Hz / 1e6
  // Zeeman frequency factor: mu_B * B_tesla / h
  // 1 Gauss = 10^-4 Tesla
  const bTesla = magneticFieldGauss * 1e-4;
  const zeemanShiftMhz = (BOHR_MAGNETON * bTesla * m) / (H_PLANCK * 1e6); // g_L is exactly 1 for singlet orbital, and m_j projection is m

  for (let i = 0; i < dim; i++) {
    const lValue = basisL[i];
    // Diagonal element: Atomic Rydberg energy for the state (in MHz) + Zeeman shift
    const stateEnergyHz = getRydbergEnergy(species, n, lNumToLetter(lValue)).energyHz;
    const stateEnergyMhz = stateEnergyHz / 1e6;
    
    // Total diagonal energy
    H[i][i] = stateEnergyMhz + zeemanShiftMhz;

    // Off-diagonal Stark couplings: <l | -e * E * z | l+1>
    // Transition coupling is selection-rule constrained delta_l = 1
    if (i < dim - 1) {
      const nextLValue = basisL[i + 1];
      if (nextLValue === lValue + 1) {
        // Stark electric field perturbation amplitude:
        // H_Stark = -e * E_field * <n, l, m | z | n, l+1, m>
        // Angular matrix element: <l, m | cos(theta) | l+1, m> = sqrt( ((l+1)^2 - m^2) / ((2l+1)*(2l+3)) )
        const angularTerm = Math.sqrt(
          (Math.pow(nextLValue, 2) - Math.pow(m, 2)) /
          ((2 * lValue + 1) * (2 * nextLValue + 1))
        );

        // Radial matrix element inside same n manifold:
        // <n, l | r | n, l-1> = 1.5 * n * sqrt(n^2 - l^2) * a_0
        // Here, we couple lValue to nextLValue = lValue + 1 direction:
        // radial dipole is <n, l+1 | r | n, l> = 1.5 * n * sqrt(n^2 - (l+1)^2) * a_0
        const radialTermInstance = 1.5 * n * Math.sqrt(Math.pow(n, 2) - Math.pow(nextLValue, 2)) * BOHR_RADIUS;

        // Transition coupling in Joules
        const couplingJ = -E_CHARGE * electricFieldV_m * radialTermInstance * angularTerm;
        // Convert to MHz frequency
        const couplingMhz = couplingJ / (H_PLANCK * 1e6);

        H[i][i + 1] = couplingMhz;
        H[i + 1][i] = couplingMhz; // Hermiticity
      }
    }
  }

  return { hamiltonianMhz: H, basisL };
}

/**
 * Generate Stark Maps (Eigenvalues under varying electric field)
 * Return structure is suitable for responsive Recharts plots.
 */
export interface StarkMapPoint {
  eField: number;
  [stateIndex: string]: number; // Eigenenergy of state in MHz
}

export function generateStarkMap(
  species: Species,
  n: number,
  m: number,
  eFields: number[], // List of fields to sweep
  bFieldGauss: number
): StarkMapPoint[] {
  const points: StarkMapPoint[] = [];

  for (const eField of eFields) {
    const { hamiltonianMhz, basisL } = buildStarkZeemanHamiltonian(
      species,
      n,
      m,
      eField,
      bFieldGauss
    );
    
    // Diagonalize the matrix at this specific field point
    const { eigenvalues } = diagonalizeJacobi(hamiltonianMhz);

    const point: StarkMapPoint = { eField };
    eigenvalues.forEach((energy, idx) => {
      point[`val_${idx}`] = energy;
    });

    points.push(point);
  }

  return points;
}

function lNumToLetter(lNum: number): string {
  const letters = ["S", "P", "D", "F", "G", "H", "I", "J", "K", "L", "M"];
  return letters[lNum] || `l=${lNum}`;
}
