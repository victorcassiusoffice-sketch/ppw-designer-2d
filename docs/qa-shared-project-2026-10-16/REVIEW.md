# Shared-project desktop and phone review —16October2026

Screenshots are actual headless Chromium captures of the built app, not generated mockups. Viewports:1280×900 and390×844. Local URL: http://127.0.0.1:5173/demo?view=2d&panel=shared&pitch=1 .

Thirty captures cover owner, architect, engineer, supplier, contractor and client stations; component editing/saving; moisture inputs and calculation; local/import evidence; surface scenarios; pilot acknowledgements; history; connection choice and return to the build. The local report records zero console/page errors, API-write attempts and horizontal overflow.

A separate26-image working-view suite verifies main2D/main3D/Services2D/Services3D filters, camera retention, visibility isolation, and unchanged canonical geometry. See ../qa-working-views-2026-10-16/report.json .

Visual issues found and fixed during review:
- Selected tabs became pale on hover while retaining white text. Active hover now retains contrast.
- A new section retained the previous section's scroll position. Tab/role/project changes reset the content scroll.
- Phone view had no direct discipline-view shortcut. The shortcut is now visible.
- Long service-product names were clipped without a readable alternative. The selected material label now wraps.

No blocking layout defects were observed in the tested final flows. Long engineering forms scroll inside the workspace; mobile navigation intentionally scrolls horizontally. Technical explanations remain English, although core tabs/locale controls use existing language preferences. Full live account/migration behavior is not established by these local screenshots; the backend was separately tested using actual isolated PostgreSQL.

The first screenshot-script attempt expected the word“indicated”, while the engine correctly displayed“possible” condensation. The assertion was corrected to the actual qualified status; no scientific threshold was loosened.
