class DifferentialPrivacy {
  /**
   * Adds Laplace noise to a numeric value for differential privacy
   * @param value The true numeric value
   * @param epsilon The privacy parameter (smaller = more privacy)
   * @param sensitivity The sensitivity of the query (default = 1)
   * @returns The value with Laplace noise added
   */
  addLaplaceNoise(
    value: number,
    epsilon: number,
    sensitivity: number = 1
  ): number {
    const scale = sensitivity / epsilon;
    return value + this.generateLaplaceNoise(scale);
  }

  /**
   * Generates random noise following a Laplace distribution
   * @param scale The scale parameter of the Laplace distribution
   * @returns A random value from the Laplace distribution
   */
  private generateLaplaceNoise(scale: number): number {
    const u = Math.random() - 0.5;
    return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  }

  /**
   * Adds geometric noise to a count for discrete differential privacy
   * @param count The true count value
   * @param epsilon The privacy parameter (smaller = more privacy)
   * @returns The count with geometric noise added
   */
  addGeometricNoise(count: number, epsilon: number): number {
    const alpha = Math.exp(-epsilon);
    let noise = 0;
    const p = 1 - alpha;

    // Generate geometric noise
    while (true) {
      if (Math.random() < p) break;
      noise += 1;
    }

    // Randomly choose positive or negative noise
    if (Math.random() < 0.5) noise = -noise;

    return Math.max(0, count + noise);
  }

  /**
   * Implements the Exponential Mechanism for selecting from discrete options
   * @param options Array of possible options
   * @param utilityScores Array of utility scores for each option
   * @param epsilon Privacy parameter
   * @param sensitivity Sensitivity of the utility function
   * @returns Selected option
   */
  exponentialMechanism<T>(
    options: T[],
    utilityScores: number[],
    epsilon: number,
    sensitivity: number = 1
  ): T {
    if (options.length !== utilityScores.length) {
      throw new Error('Options and utility scores must have the same length');
    }

    const probabilities = utilityScores.map(score =>
      Math.exp((epsilon * score) / (2 * sensitivity))
    );
    const sumProb = probabilities.reduce((a, b) => a + b, 0);
    const normalizedProbs = probabilities.map(p => p / sumProb);

    let r = Math.random();
    let cumulativeProb = 0;
    
    for (let i = 0; i < options.length; i++) {
      cumulativeProb += normalizedProbs[i];
      if (r <= cumulativeProb) {
        return options[i];
      }
    }

    return options[options.length - 1];
  }

  /**
   * Implements randomized response for boolean values
   * @param value The true boolean value
   * @param epsilon Privacy parameter
   * @returns Randomized boolean value
   */
  randomizedResponse(value: boolean, epsilon: number): boolean {
    const p = Math.exp(epsilon) / (1 + Math.exp(epsilon));
    return Math.random() < (value ? p : 1 - p);
  }

  /**
   * Adds noise to a histogram while preserving consistency
   * @param histogram Object mapping categories to counts
   * @param epsilon Privacy parameter
   * @returns Noisy histogram with consistent counts
   */
  consistentHistogram(
    histogram: Record<string, number>,
    epsilon: number
  ): Record<string, number> {
    const noisy: Record<string, number> = {};
    let total = 0;

    // Add noise to each count
    for (const [category, count] of Object.entries(histogram)) {
      noisy[category] = Math.round(
        this.addLaplaceNoise(count, epsilon / 2)
      );
      total += noisy[category];
    }

    // Add noise to total
    const noisyTotal = Math.round(
      this.addLaplaceNoise(
        Object.values(histogram).reduce((a, b) => a + b, 0),
        epsilon / 2
      )
    );

    // Adjust counts to match noisy total while preserving non-negativity
    const adjustment = noisyTotal - total;
    const categories = Object.keys(noisy);
    
    if (adjustment > 0) {
      // Distribute positive adjustment
      for (let i = 0; i < adjustment; i++) {
        const category = categories[Math.floor(Math.random() * categories.length)];
        noisy[category]++;
      }
    } else if (adjustment < 0) {
      // Distribute negative adjustment while preserving non-negativity
      for (let i = 0; i > adjustment; i--) {
        const validCategories = categories.filter(c => noisy[c] > 0);
        if (validCategories.length === 0) break;
        const category = validCategories[Math.floor(Math.random() * validCategories.length)];
        noisy[category]--;
      }
    }

    return noisy;
  }

  /**
   * Implements the Gaussian Mechanism for adding noise
   * @param value The true numeric value
   * @param epsilon Privacy parameter
   * @param delta Failure probability
   * @param sensitivity Sensitivity of the query
   * @returns The value with Gaussian noise added
   */
  gaussianMechanism(
    value: number,
    epsilon: number,
    delta: number,
    sensitivity: number = 1
  ): number {
    const sigma = (sensitivity * Math.sqrt(2 * Math.log(1.25 / delta))) / epsilon;
    return value + this.generateGaussianNoise(sigma);
  }

  /**
   * Generates random noise following a Gaussian distribution
   * @param sigma Standard deviation
   * @returns A random value from the Gaussian distribution
   */
  private generateGaussianNoise(sigma: number): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    
    const multiplier = sigma * Math.sqrt(-2.0 * Math.log(u));
    return multiplier * Math.cos(2.0 * Math.PI * v);
  }
}

export const differentialPrivacy = new DifferentialPrivacy(); 