declare namespace jest {
  interface Mock<T = unknown, Y extends unknown[] = unknown[]> {
    (...args: Y): T;
    mockClear(): void;
    mockReset(): void;
    mockRestore(): void;
    mockImplementation(fn: (...args: Y) => T): this;
    mockImplementationOnce(fn: (...args: Y) => T): this;
    mockReturnValue(value: T): this;
    mockReturnValueOnce(value: T): this;
    mockResolvedValue(value: T): this;
    mockResolvedValueOnce(value: T): this;
    mockRejectedValue(value: T): this;
    mockRejectedValueOnce(value: T): this;
    getMockName(): string;
    mockName(name: string): this;
    mock: {
      calls: Y[];
      instances: T[];
      invocationCallOrder: number[];
      results: { type: "return" | "throw"; value: unknown }[];
    };
  }

  type Mocked<T> = {
    [P in keyof T]: T[P] extends (...args: unknown[]) => unknown
      ? Mock<ReturnType<T[P]>, Parameters<T[P]>>
      : T[P];
  } & T;

  function clearAllMocks(): void;
  function resetAllMocks(): void;
  function restoreAllMocks(): void;
  function spyOn<T extends {}, M extends keyof T>(
    object: T,
    method: M
  ): Mock<T[M], T[M] extends (...args: unknown[]) => unknown ? Parameters<T[M]> : unknown[]>;
  function mock(moduleName: string): void;
}

declare global {
  const jest: typeof jest;
  const describe: (name: string, fn: () => void) => void;
  const beforeEach: (fn: () => void | Promise<void>) => void;
  const afterEach: (fn: () => void | Promise<void>) => void;
  const it: (name: string, fn: () => void | Promise<void>) => void;
  const expect: {
    <T = unknown>(actual: T): {
      toBe(expected: T): void;
      toEqual(expected: T): void;
      toBeNull(): void;
      toBeDefined(): void;
      toBeUndefined(): void;
      toBeTruthy(): void;
      toBeFalsy(): void;
      toContain(expected: unknown): void;
      toThrow(error?: string | Error | RegExp): void;
      toBeInstanceOf(expected: unknown): void;
      toHaveLength(expected: number): void;
      toHaveProperty(keyPath: string | string[], value?: unknown): void;
      toMatch(expected: string | RegExp): void;
      toMatchObject(expected: object): void;
      toHaveBeenCalled(): void;
      toHaveBeenCalledTimes(expected: number): void;
      toHaveBeenCalledWith(...args: unknown[]): void;
      toHaveBeenLastCalledWith(...args: unknown[]): void;
      resolves: unknown;
      rejects: unknown;
    };
  };
}
