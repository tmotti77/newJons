import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Only the pure modules — anything needing a React Native runtime is
    // verified on device, not here.
    include: ["src/**/*.test.ts"]
  }
});
