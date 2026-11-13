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
| `title` | string | Issue title, trimmed, cut to 200 characters. Required |
| `body` | string | Issue body, trimmed, cut to 10,000 characters. Required |
| `version` | string | Written into the footer as `_Lectio v<version>_` on one line, cut to 100 characters; `?` when absent |

Any other key is ignored, and so is a key whose value is not a string. An
`@name` in the title or body gets a zero-width space after the `@`, so a report
cannot notify anyone on GitHub; an `@` inside a word, as in an email address,
is left alone.

A browser request from an origin in `ALLOWED_ORIGINS` (the website,
`https://lectio.mateoarenas.dev`, and its old address,
`https://lectio-study-planner.github.io`, which now redirects there) gets CORS
headers, and its `OPTIONS` preflight gets a `204`. Every other origin, and the
apps, which send none, get neither, so their preflight falls through to the
`405` below.

Responses:

| Status | Body | When |
|---|---|---|
| 200 | `{ "ok": true, "url": "<issue html_url>" }` | Issue filed |
| 400 | `{ "error": "Title and body are required" }` | Blank, missing or non-string title or body, or no JSON body at all |
| 405 | `{ "error": "Method not allowed" }` | Not a POST |
| 429 | `{ "error": "Too many reports. Please try again later." }` | More than 5 reports from one address in 10 minutes |
| 502 | `{ "error": "Failed to create issue" }` | GitHub refused the issue, or could not be reached |

Every app treats any non-2xx as "could not send", so 429 needed no app change.

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

The function has no authentication: anyone who knows the address can file an
issue. Its own rate limit counts per warm instance, so it stops a burst from
one address but not a flood spread over instances. Add the real limit in the
Vercel project under Firewall ▸ Rules: a rate-limit rule on path
`/api/feedback`, for example 10 requests per 10 minutes per IP, with action
Deny (429).
