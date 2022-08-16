module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: ["eslint:recommended"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  rules: {
    semi: ["error", "always"],
    eqeqeq: ["error", "always"],
    "no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
      },
    ],
  },
};
