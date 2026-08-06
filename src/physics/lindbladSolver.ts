/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Lindblad Master Equation Solver for 5-Level Rydberg System (Complex Density Matrix)
// Basis:
// |0> = |g>  (Ground configuration, Sr-88 5s2 1S0)
// |1> = |e>  (Intermediate path, Sr-88 5s5p 3P1, narrow 7.5 kHz line)
// |2> = |r>  (Rydberg target state, e.g. 5sns/snd low-l, lifetime ~ 100 us)
// |3> = |c>  (Circular Rydberg state, l = n-1, m = n-1, lifetime ~ 30-100 ms)
// |4> = |L>  (Thermal & radiative leakage state / background reservoir)

export interface MasterEquationParams {
  omega1: number; // Rabi frequency 1 (g -> e) in MHz
  omega2: number; // Rabi frequency 2 (e -> r) in MHz
  omegaMw: number; // Microwave circularization Rabi (r -> c) in MHz
  detuning1: number; // Detuning 1 in MHz
  detuning2: number; // Detuning 2 in MHz
  detuningMw: number; // Microwave Rabi detuning in MHz
  
  // Decays:
  gammaE: number; // Spontaneous decay rate |e> -> |g> (MHz)
  gammaR: number; // Spontaneous decay rate |r> -> |g> / loss (MHz)
  gammaC_sp: number; // Circular radiative decay rate |c> -> loss (MHz)
  gammaC_stim: number; // Circular BBR stimulated emission rate |c> -> loss (MHz)
  gammaC_abs: number; // Circular BBR thermal absorption rate |c> -> loss (MHz)

  // Pure Dephasings (linewidths, Phase noise):
  dephasingLaser1: number; // Pure dephasing of Laser 1 (MHz)
  dephasingLaser2: number; // Pure dephasing of Laser 2 (MHz)
  dephasingMw: number; // Pure dephasing of microwave (MHz)

  // Pulse shape:
  pulseType: "square" | "gaussian" | "stirap" | "adiabatic_chirp";
  tMaxUs: number; // Max simulation time in microseconds
  steps: number; // Number of integration steps
}

export interface MasterSimulationPoint {
  timeUs: number;
  rho00: number; // Population state |g>
  rho11: number; // Population state |e>
  rho22: number; // Population state |r>
  rho33: number; // Population state |c>
  rho44: number; // Leakage pool population
  purity: number; // Tr(rho^2) - quantum coherence indicator
  entropy: number; // -Tr(rho ln(rho)) - Von Neumann entropy
}

// Represent complex numbers as pairs of floats: [real, imag]
type Complex = [number, number];

// Matrix helper utilities
function cZero(): Complex { return [0, 0]; }
function cAdd(a: Complex, b: Complex): Complex { return [a[0] + b[0], a[1] + b[1]]; }
function cSub(a: Complex, b: Complex): Complex { return [a[0] - b[0], a[1] - b[1]]; }
function cMul(a: Complex, b: Complex): Complex { return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]]; }
function cScale(a: Complex, s: number): Complex { return [a[0] * s, a[1] * s]; }
function cConj(a: Complex): Complex { return [a[0], -a[1]]; }

/**
 * Solves the master equation using RK4 (Fourth-Order Runge-Kutta).
 * Automatically computes state purity, entropy, and population tracking.
 */
export function simulateLindbladDynamics(
  params: MasterEquationParams
): MasterSimulationPoint[] {
  const steps = params.steps;
  const dt = params.tMaxUs / steps; // us
  
  // 5x5 Density Matrix: representation as double-array of Complex tuples [real, imag]
  let rho: Complex[][] = Array.from({ length: 5 }, () => 
    Array.from({ length: 5 }, () => [0, 0])
  );
  
  // Initial condition: Atom is 100% in Ground state |g>
  rho[0][0] = [1.0, 0.0];

  const results: MasterSimulationPoint[] = [];

  for (let step = 0; step <= steps; step++) {
    const t = step * dt; // time in microseconds

    // Compute populations and trace characteristics
    const p0 = rho[0][0][0];
    const p1 = rho[1][1][0];
    const p2 = rho[2][2][0];
    const p3 = rho[3][3][0];
    const p4 = rho[4][4][0];

    // Compute Purity: Tr(rho^2)
    let purity = 0;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const val = rho[r][c];
        purity += val[0] * val[0] + val[1] * val[1];
      }
    }

    // Compute Von Neumann Entropy: -Sum(lambda_i * ln(lambda_i))
    // Formulate a robust diagonalizable 5x5 algorithm or approximate it using direct diagonal elements
    // for high efficiency in real-time interactive plots:
    let entropy = 0;
    [p0, p1, p2, p3, p4].forEach((p) => {
      const pClamp = Math.max(p, 1e-15);
      entropy -= pClamp * Math.log(pClamp);
    });

    results.push({
      timeUs: t,
      rho00: Math.max(0, Math.min(1, p0)),
      rho11: Math.max(0, Math.min(1, p1)),
      rho22: Math.max(0, Math.min(1, p2)),
      rho33: Math.max(0, Math.min(1, p3)),
      rho44: Math.max(0, Math.min(1, p4)),
      purity: Math.max(0, Math.min(1, purity)),
      entropy: Math.max(0, entropy),
    });

    if (step === steps) break;

    // Run custom RK4 step:
    // k1 = dRho(t, rho)
    const k1 = computeDRho(t, rho, params);
    
    // k2 = dRho(t + dt/2, rho + dt/2 * k1)
    const temp1 = applyStep(rho, k1, dt * 0.5);
    const k2 = computeDRho(t + dt * 0.5, temp1, params);

    // k3 = dRho(t + dt/2, rho + dt/2 * k2)
    const temp2 = applyStep(rho, k2, dt * 0.5);
    const k3 = computeDRho(t + dt * 0.5, temp2, params);

    // k4 = dRho(t + dt, rho + dt * k3)
    const temp3 = applyStep(rho, k3, dt);
    const k4 = computeDRho(t + dt, temp3, params);

    // Final update: rho_next = rho + (dt/6) * (k1 + 2*k2 + 2*k3 + k4)
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const integrated = (k1[r][c][0] + 2 * k2[r][c][0] + 2 * k3[r][c][0] + k4[r][c][0]) / 6.0;
        const integratedImag = (k1[r][c][1] + 2 * k2[r][c][1] + 2 * k3[r][c][1] + k4[r][c][1]) / 6.0;
        rho[r][c][0] += integrated * dt;
        rho[r][c][1] += integratedImag * dt;
      }
    }

    // Force strict Hermiticity & trace preservation of physical density matrix
    normalizeDensityMatrix(rho);
  }

  return results;
}

function applyStep(rho: Complex[][], k: Complex[][], stepFactor: number): Complex[][] {
  const result: Complex[][] = Array.from({ length: 5 }, () => 
    Array.from({ length: 5 }, () => [0, 0])
  );
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      result[r][c][0] = rho[r][c][0] + k[r][c][0] * stepFactor;
      result[r][c][1] = rho[r][c][1] + k[r][c][1] * stepFactor;
    }
  }
  return result;
}

function normalizeDensityMatrix(rho: Complex[][]) {
  // Enforce Hermiticity: rho_ij = conj(rho_ji)
  for (let r = 0; r < 5; r++) {
    for (let c = r + 1; c < 5; c++) {
      rho[c][r] = [rho[r][c][0], -rho[r][c][1]];
    }
  }
  // Clamp Diagonal parts to positive reals
  let sumTrace = 0;
  for (let i = 0; i < 5; i++) {
    rho[i][i][0] = Math.max(0, rho[i][i][0]);
    rho[i][i][1] = 0; // Pure Real diagonal
    sumTrace += rho[i][i][0];
  }
  // Enforce Tr(rho) == 1
  if (sumTrace > 0) {
    for (let i = 0; i < 5; i++) {
      rho[i][i][0] /= sumTrace;
    }
  }
}

/**
 * Computes the derivative d_rho/d_t according to Lindblad formulation.
 * d_rho/d_t = -i[H, rho] + Sum( L_k * rho * L_k^dagger - 0.5 * {L_k^dagger * L_k, rho} )
 * Values in Hamiltonian and collapse operators converted to angular MHz (multiply by 2pi)
 */
function computeDRho(
  tUs: number,
  rho: Complex[][],
  params: MasterEquationParams
): Complex[][] {
  const drho: Complex[][] = Array.from({ length: 5 }, () => 
    Array.from({ length: 5 }, () => [0, 0])
  );

  // Time-dependent Pulse Shapes (converted to angular microsecond parameters)
  let f1 = 1.0;
  let f2 = 1.0;
  let fmw = 1.0;

  const tMax = params.tMaxUs;
  if (params.pulseType === "gaussian") {
    // Gaussian pulses centered at 50%
    const mu = tMax * 0.5;
    const sigma = tMax * 0.15;
    const shape = Math.exp(-Math.pow(tUs - mu, 2) / (2 * Math.pow(sigma, 2)));
    f1 = shape;
    f2 = shape;
    fmw = shape;
  } else if (params.pulseType === "stirap") {
    // Counter-intuitive pulse sequence: Stokes/microwave pulse first, then Pump/excitation pulse!
    // Stokes/MW peak around 35%, Pump peak around 65%
    const sigma = tMax * 0.12;
    const tPump = tMax * 0.58;
    const tStokes = tMax * 0.42;
    f1 = Math.exp(-Math.pow(tUs - tPump, 2) / (2 * Math.pow(sigma, 2))); // Excitation step
    f2 = Math.exp(-Math.pow(tUs - tStokes, 2) / (2 * Math.pow(sigma, 2))); // Rydberg path
    fmw = f2; // Stokes step drives transfer to circular state
  } else if (params.pulseType === "adiabatic_chirp") {
    // Adiabatic sweep with slightly chirped parameters
    f1 = 1.0;
    f2 = 1.0;
    const sweepRange = tMax * 0.8;
    fmw = tUs > (tMax - sweepRange) * 0.5 && tUs < tMax - (tMax - sweepRange) * 0.5 ? 1.0 : 0.0;
  }

  // Active Rabi elements (units: MHz angular frequency -> Multiply by 2pi)
  const o1 = 2 * Math.PI * params.omega1 * f1;
  const o2 = 2 * Math.PI * params.omega2 * f2;
  const om = 2 * Math.PI * params.omegaMw * fmw;

  // Detunings (MHz angular frequency)
  const d1 = 2 * Math.PI * params.detuning1;
  const d2 = 2 * Math.PI * params.detuning2;
  let dm = 2 * Math.PI * params.detuningMw;

  // If chirp, detuning sweeps linearly through zero!
  if (params.pulseType === "adiabatic_chirp") {
    // Sweep microwave detuning from -15 MHz to +15 MHz
    const normalizedProgress = (tUs - tMax * 0.5) / (tMax * 0.5); // -1 to +1
    dm = 2 * Math.PI * (params.detuningMw + normalizedProgress * 15.0);
  }

  // Hamiltonian matrix in rotating wave approximation (RWA)
  // Basis: |0>=|g>, |1>=|e>, |2>=|r>, |3>=|c>, |4>=|L> (Leakage-uncoupled)
  // H is hermitian
  const H: Complex[][] = Array.from({ length: 5 }, () => 
    Array.from({ length: 5 }, () => [0, 0])
  );

  // Diagonal Detunings
  H[1][1] = [d1, 0];
  H[2][2] = [d1 + d2, 0];
  H[3][3] = [d1 + d2 + dm, 0];
  H[4][4] = [0, 0]; // Loss state, no coherent field couplings

  // Off-Diagonal couplings (Rabi terms)
  // 0.5 * Omega couplings
  H[0][1] = [o1 * 0.5, 0];
  H[1][0] = [o1 * 0.5, 0];

  H[1][2] = [o2 * 0.5, 0];
  H[2][1] = [o2 * 0.5, 0];

  H[2][3] = [om * 0.5, 0];
  H[3][2] = [om * 0.5, 0];

  // --- COHERENT TERM: -i [H, rho] = -i (H*rho - rho*H) ---
  // Let's compute H * rho:
  const H_rho: Complex[][] = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => [0,0]));
  const rho_H: Complex[][] = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => [0,0]));

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      let sumH: Complex = [0, 0];
      let sumR: Complex = [0, 0];
      for (let k = 0; k < 5; k++) {
        sumH = cAdd(sumH, cMul(H[r][k], rho[k][c]));
        sumR = cAdd(sumR, cMul(rho[r][k], H[k][c]));
      }
      H_rho[r][c] = sumH;
      rho_H[r][c] = sumR;
    }
  }

  // Composes -i (H_rho - rho_H)
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const diff = cSub(H_rho[r][c], rho_H[r][c]);
      // -i * (x + iy) = y - ix
      drho[r][c][0] = diff[1];
      drho[r][c][1] = -diff[0];
    }
  }

  // --- LINDBLAD COLLAPSE OPERATORS (DAMPING & CONSERVATION TERM) ---
  // To avoid heavy generic matrix expansions, we map the Lindblad terms directly for maximum efficiency:
  // Decays:
  const gE = 2 * Math.PI * params.gammaE;       // e -> g
  const gR = 2 * Math.PI * params.gammaR;       // r -> g/loss
  const gC_sp = 2 * Math.PI * params.gammaC_sp; // c -> loss (Spontaneous circular decay)
  const gC_stim = 2 * Math.PI * params.gammaC_stim; // c -> loss (BBR stimulated loss)
  const gC_abs = 2 * Math.PI * params.gammaC_abs;   // c -> loss (BBR absorption loss)

  // Coherent dephasings:
  const dep1 = 2 * Math.PI * params.dephasingLaser1;
  const dep2 = 2 * Math.PI * params.dephasingLaser2;
  const depM = 2 * Math.PI * params.dephasingMw;

  // 1. Spontaneous Intermediate Decay |e> -> |g> (collapse operator L_e = sqrt(gE) * |g><e|)
  // adds rate to ground: + gE * rho_11
  drho[0][0][0] += gE * rho[1][1][0];
  // subtracts rate from intermediate diagonal: - gE * rho_11
  drho[1][1][0] -= gE * rho[1][1][0];
  // coherences:
  for (let i = 0; i < 5; i++) {
    if (i !== 1) {
      drho[1][i][0] -= 0.5 * gE * rho[1][i][0];
      drho[1][i][1] -= 0.5 * gE * rho[1][i][1];
      drho[i][1][0] -= 0.5 * gE * rho[i][1][0];
      drho[i][1][1] -= 0.5 * gE * rho[i][1][1];
    }
  }

  // 2. Rydberg Transition spontaneous loss |r> -> |g> / reservoir (collapse L_r = sqrt(gR) * |g><r|)
  // For safety, let's dump Rydberg decay half to ground state and half to leakage reservoir!
  drho[0][0][0] += 0.5 * gR * rho[2][2][0];
  drho[4][4][0] += 0.5 * gR * rho[2][2][0];
  drho[2][2][0] -= gR * rho[2][2][0];
  for (let i = 0; i < 5; i++) {
    if (i !== 2) {
      drho[2][i][0] -= 0.5 * gR * rho[2][i][0];
      drho[2][i][1] -= 0.5 * gR * rho[2][i][1];
      drho[i][2][0] -= 0.5 * gR * rho[i][2][0];
      drho[i][2][1] -= 0.5 * gR * rho[i][2][1];
    }
  }

  // 3. Circular Spontaneous & BBR Decay channels (L_c = sqrt(gC) * |L><c|)
  // Adds leakage population to Reservoir State |4>
  const totalC_loss = gC_sp + gC_stim + gC_abs;
  drho[4][4][0] += totalC_loss * rho[3][3][0];
  drho[3][3][0] -= totalC_loss * rho[3][3][0];
  for (let i = 0; i < 5; i++) {
    if (i !== 3) {
      drho[3][i][0] -= 0.5 * totalC_loss * rho[3][i][0];
      drho[3][i][1] -= 0.5 * totalC_loss * rho[3][i][1];
      drho[i][3][0] -= 0.5 * totalC_loss * rho[i][3][0];
      drho[i][3][1] -= 0.5 * totalC_loss * rho[i][3][1];
    }
  }

  // Pure Dephasings (diagonal dephasing projection channels)
  // Term on off-diagonals: -dep * rho_ij
  // A clean and robust mapping:
  // Laser 1 dephasing couples Ground |0> and Intermediate |1>
  drho[0][1][0] -= dep1 * rho[0][1][0];
  drho[0][1][1] -= dep1 * rho[0][1][1];
  drho[1][0][0] -= dep1 * rho[1][0][0];
  drho[1][0][1] -= dep1 * rho[1][0][1];

  // Laser 2 dephasing couples Rydberg |2> to other states
  for (let i = 0; i < 5; i++) {
    if (i !== 2) {
      drho[2][i][0] -= dep2 * rho[2][i][0];
      drho[2][i][1] -= dep2 * rho[2][i][1];
      drho[i][2][0] -= dep2 * rho[i][2][0];
      drho[i][2][1] -= dep2 * rho[i][2][1];
    }
  }

  // Microwave dephasing couples Circular |3> to other states
  for (let i = 0; i < 5; i++) {
    if (i !== 3) {
      drho[3][i][0] -= depM * rho[3][i][0];
      drho[3][i][1] -= depM * rho[3][i][1];
      drho[i][3][0] -= depM * rho[i][3][0];
      drho[i][3][1] -= depM * rho[i][3][1];
    }
  }

  return drho;
}
