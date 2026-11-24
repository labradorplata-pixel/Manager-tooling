# Manager tooling

Small, practical tools for independent creator managers. Each tool takes one repetitive job off a manager's plate while the manager keeps the judgment calls: approving pitches, sending emails, negotiating and owning the relationship.

## What's here

| Path | What it is | Status |
|---|---|---|
| `templates/creator-profile.md` | One profile per creator: content pillars, past brands, upcoming content, rates, metrics. Every tool reads from it. | v0 |
| `tools/monthly-report/` | Turns a month of platform exports into a month-over-month report with flagged changes and an experiment log. | Planned |
| `tools/outreach-run/` | Weekly brand outreach for one creator: find brands, skip recent contacts, find two contacts each, draft emails for approval, update the tracker. | Planned |

## Principles

- **Human in the loop.** Tools draft and organize; the manager approves and sends.
- **Creator first.** Everything starts from the creator's profile and pillars, not from a brand's checklist.
- **Borrow before building.** Use existing connectors and open-source pieces (Gmail, Trello, Hunter, platform exports) and only write the glue.
- **One creator per folder.** Copy the template to `creators/<handle>/profile.md`. Keep real creator data out of public places.

## Using the creator profile

1. Copy `templates/creator-profile.md` to `creators/<handle>/profile.md`.
2. Fill in what you know; leave the rest blank.
3. Update the "Coming up" and "Experiments" sections at your weekly content call.
