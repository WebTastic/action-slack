# Project conventions

## Versioning

Always bump the version after any change that affects runtime behavior or the built output:

1. Update `"version"` in `package.json` following semver — patch for fixes, minor for features, major for breaking changes.
2. Run `npm run release` to regenerate `dist/index.js` (CI's `uncommitted.yml` fails otherwise).
3. Tag the resulting commit `vX.Y.Z` and move the major tag (`vX`) to it so `uses: 8398a7/action-slack@vX` resolves to the latest release.
