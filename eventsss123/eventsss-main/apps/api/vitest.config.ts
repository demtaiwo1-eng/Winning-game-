import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["tests/setup.ts"],
    environment: "node",
    // Only execute source tests. The TypeScript build writes compiled copies
    // beneath dist/, which must never be rediscovered as test suites.
    include: [
      "src/**/*.test.ts",
      "src/**/*.spec.ts",
      "tests/**/*.test.ts",
      "tests/**/*.spec.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
