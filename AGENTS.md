# AGENTS.md

Whiskey Scan Demo: an Expo (React Native) app for iOS and Android, run with a development build (`expo-dev-client`). There is no web target.

## Scripts

| Script | What it does |
| --- | --- |
| `npm start` | Start Metro for the dev client (`expo start`). |
| `npm run lint` | ESLint over `app`, `src`, and `scripts`. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run check` | Lint + typecheck. Must exit 0 before a task is done. |
| `npm test` | Jest (`jest-expo`). |
| `npm run test:coverage` | Jest with coverage; global threshold 80%. |

CI (`.github/workflows/pr-check.yml`) runs `npm ci`, `npm run check`, and `npm test` on every pull request.

## Expo

- Read the `expo` major in `package.json` and use the matching docs (`https://docs.expo.dev/versions/v<major>.0.0/`); Expo APIs change every SDK.
- Add packages with `npx expo install <package>` so versions match the SDK.
- Native code changes need a new dev build: `npm run ios` / `npm run android`. Never hand-edit generated `ios/` or `android/`.

## Layout

- `app/`: Expo Router routes only; each file re-exports a screen.
- `src/screens/` → `src/components/<feature>/` → `src/ui-components/`; `src/lib/` holds non-UI logic; `src/hooks/` shared hooks.
- `modules/`: local Expo native modules. `scripts/`: Node build scripts.

Conventions live in `.cursor/rules/`.
