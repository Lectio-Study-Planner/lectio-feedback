// Files in-app feedback from Lectio as a GitHub issue, so the user needs no
// GitHub account and the apps carry no secret: the token lives only in this
// function's environment.
//
// Called by every Lectio generation — the 1.x desktop and mobile apps and the
// 2.x Swift app — at https://lectio-opal.vercel.app/api/feedback. The request
// and response shapes below are a contract with apps already in users' hands;
// do not rename a key or change a status.
//
//   request:  POST { type: 'bug' | 'feature', title, body, version }
//   success:  200 { ok: true, url }   (the new issue's html_url)
//   rejected: 400 / 405 / 502 { error }
//
// Moved unchanged from masprime77/lectio `api/feedback.js`, except that the
// target repository now comes from FEEDBACK_REPO.

const DEFAULT_REPO = 'Lectio-Study-Planner/lectio';

export default async function handler(req, res) {
  // POST only.
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, title, body, version } = req.body;

  // Basic validation.
  if (!title?.trim() || !body?.trim()) {
    return res.status(400).json({ error: 'Title and body are required' });
  }

  const label = type === 'feature' ? 'enhancement' : 'bug';
  const fullBody = `${body.trim()}\n\n---\n_Lectio v${version || '?'}_`;
  const repo = process.env.FEEDBACK_REPO || DEFAULT_REPO;

  const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      title: title.trim(),
      body: fullBody,
      labels: [label],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('GitHub API error:', err);
    return res.status(502).json({ error: 'Failed to create issue' });
  }

  const issue = await response.json();
  return res.status(200).json({ ok: true, url: issue.html_url });
}
