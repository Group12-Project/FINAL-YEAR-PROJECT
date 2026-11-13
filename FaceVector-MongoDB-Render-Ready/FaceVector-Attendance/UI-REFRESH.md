# FaceVector Professional UI Refresh

This update is a presentation-layer redesign. It adds `css/professional.css` to all existing HTML pages after the original stylesheets. Existing page IDs, form controls, navigation targets, scripts, camera handlers, recognition thresholds, API routes, role checks, and attendance logic were not intentionally changed.

## What changed
- Modern responsive layout, typography, navigation, cards, statistic tiles, tables, forms, buttons, and portal login/dashboard surfaces.
- More polished camera preview frame and status labels.
- Refined AI Assistant chat window styling while preserving its existing chat, search, website navigation, voice input/output, and security view.
- Mobile spacing and navigation improvements, focus visibility, and reduced-motion support.
- Existing light/dark and accent theme controls remain available.

## Hardware and deployment checks
- Camera and GPS require browser permission. Use `https://` in production or `http://localhost` for local development; plain remote HTTP generally cannot access camera/geolocation.
- Face recognition models are fetched from the configured CDN. A network connection is required unless the model assets are hosted locally.
- Camera hardware, GPS accuracy, MongoDB-backed role workflows, and real multi-person recognition must be validated on the target device/campus. A successful unit test is not proof of camera hardware operation or recognition accuracy.

## Verification performed for this refresh
- `node scripts/check-project.js` — passed.
- `node --test tests/core.test.js tests/backend-core.test.js` — 20 tests passed.
- `node scripts/security-check.js` — completed with 4 existing third-party script SRI warnings; static lint is not a security guarantee.
- `python tests/e2e-assistant.py` — could not run because the Playwright Chromium browser binary is not installed in the execution environment.
