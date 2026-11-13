# FaceVector Attendance — UI fixes and verification

## Changes
- Replaced the short navigation list with grouped dropdown options for all 17 HTML pages.
- Added the same dropdown navigation and colour/theme controls to all staff, admin, guard and monitoring portal pages.
- Kept the current page selected in the dropdown and validated the destination against the page allowlist before navigation.
- Applied the Space Grotesk typography system consistently across all pages, including portal pages, with matching font weights and responsive sizing.
- Updated portal Content Security Policy allowances for the declared Leaflet assets and OpenStreetMap map tiles where needed.
- Expanded the project checker so it verifies shared navigation, theme controls and fonts on all pages.

## Checks run
- Project structure and local-reference check: passed.
- JavaScript syntax checks: passed.
- Core and backend unit tests: 20 passed, 0 failed.
- Security static lint: passed with 4 existing third-party-script Subresource Integrity warnings for the Face API and Leaflet CDN scripts.

A full interactive browser pass could not be run in this execution environment because Chromium navigation was blocked by the environment's administrator policy. Features that require a configured backend, database, camera permission, GPS permission or HTTPS still need to be tested in the user's deployment environment.
