/**
 * @see https://prettier.io/docs/configuration
 * @type {import("prettier").Config}
 */
const config = {
  // objectWrap: 'collapse',
  printWidth: 150,
  singleQuote: true,
  overrides: [
    {
      files: 'scripts/package.mjs',
      options: { trailingComma: 'all' },
    },
  ],
};
export default config;
