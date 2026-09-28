# Lectio feedback endpoint

The serverless function behind Lectio's in-app feedback. The app POSTs a bug
report or feature request here, and the function files it as a GitHub issue.
Users need no GitHub account, and the apps carry no secret: the GitHub token
lives only in this function's environment on Vercel.

## Who calls it

Every Lectio generation, at one fixed address:

**`https://lectio-opal.vercel.app/api/feedback`**

- the 1.x desktop app (`packages/desktop/app.js`) and mobile app
  (`packages/mobile/src/lib/feedback.ts`) in `masprime77/lectio`,
- the 2.x Swift app (`Lectio/Feedback/FeedbackClient.swift` in
  `Lectio-Study-Planner/lectio`),
- the website's feedback form (`feedback.html` in
  `Lectio-Study-Planner/lectio-webpage`), from a browser.

1.x builds are already installed and cannot be updated, so **the address and
the contract below must not change.** Keep the `lectio-opal` Vercel project and
its domain. If the domain ever has to move, the 2.x endpoint constant changes
in the same release and 1.x feedback stops working.

## Contract

Request, `POST` with `Content-Type: application/json`:

```json
{ "type": "bug", "title": "Crash on launch", "body": "What happened…", "version": "2.0.0 (1) on macOS" }
```

| Key | Type | Meaning |
|---|---|---|
| `type` | string | `"feature"` is labelled `enhancement`; anything else is labelled `bug` |
| `title` | string | Issue title, trimmed. Required |
| `body` | string | Issue body, trimmed. Required |
| `version` | string | Written into the footer as `_Lectio v<version>_`; `?` when absent |

Any other key is ignored.

A browser request from an origin in `ALLOWED_ORIGINS` (today only
`https://lectio-study-planner.github.io`, the website) gets CORS headers, and
its `OPTIONS` preflight gets a `204`. Every other origin, and the apps, which
send none, get neither, so their preflight falls through to the `405` below.

Responses:

| Status | Body | When |
|---|---|---|
| 200 | `{ "ok": true, "url": "<issue html_url>" }` | Issue filed |
| 400 | `{ "error": "Title and body are required" }` | Blank title or body |
| 405 | `{ "error": "Method not allowed" }` | Not a POST |
| 502 | `{ "error": "Failed to create issue" }` | GitHub refused the issue |

## Configuration

Set in the Vercel project under Settings ▸ Environment Variables (Production).
Environment variable changes take effect on the next deployment.

| Variable | Value |
|---|---|
| `GITHUB_TOKEN` | Fine-grained token, owner `Lectio-Study-Planner`, access to the target repository only, permission **Issues: Read and write** |
| `FEEDBACK_REPO` | `owner/name` of the repository issues go to. Defaults to `Lectio-Study-Planner/lectio` |

The target repository needs the `bug` and `enhancement` labels.

## Deploying

The `lectio-opal` Vercel project deploys `main` of this repository. Vercel
serves `api/feedback.js` as `/api/feedback`; there is no build step and no
dependencies.

The function has no authentication and no rate limit: anyone who knows the
address can file an issue.
