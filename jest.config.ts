import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: "./",
});

// Add any custom config to be passed to Jest
const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  testMatch: [
    "<rootDir>/test/**/*.test.js",
    "<rootDir>/test/**/*.test.ts",
    "<rootDir>/test/**/*.test.jsx",
    "<rootDir>/test/**/*.test.tsx",
  ],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    // the MCP SDK ships ESM-only builds jest cannot parse; the stores
    // import app/mcp/actions transitively, so stub it for all tests
    "mcp/actions$": "<rootDir>/test/__mocks__/mcp-actions.ts",
    "^@/(.*)$": "<rootDir>/$1",
  },
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  injectGlobals: true,
};

// next/jest hardcodes transformIgnorePatterns to skip all of node_modules,
// but nanoid ships ESM-only and must be transpiled for jest to load
// modules that import it (app/utils.ts, the stores)
export default async () => {
  const jestConfig = await createJestConfig(config)();
  jestConfig.transformIgnorePatterns = (
    jestConfig.transformIgnorePatterns ?? []
  ).map((pattern) =>
    pattern === "/node_modules/"
      ? "/node_modules/(?!(nanoid|lodash-es)/)"
      : pattern,
  );
  return jestConfig;
};
