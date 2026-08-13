module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"],
    sourceType: "module",
  },
  ignorePatterns: [
    "/lib/**/*", // Ignore built files.
    "/generated/**/*", // Ignore generated files.
  ],
  plugins: [
    "@typescript-eslint",
    "import",
  ],
  rules: {
    "quotes": ["error", "double"],
    "import/no-unresolved": 0,
    "indent": ["error", 2],
    // The scaffold ships eslint-config-google, whose defaults don't match this repo: the app
    // side runs ~100-character lines and documents modules with prose comments explaining WHY
    // rather than @param tag lists. Kept consistent so functions/ doesn't read like a different
    // codebase.
    "max-len": ["error", {code: 100, ignoreUrls: true}],
    "require-jsdoc": "off",
    "valid-jsdoc": "off",
  },
};
