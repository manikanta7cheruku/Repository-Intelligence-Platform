# MVP plan

Sole developer. Effort is in focused hours and is an estimate, not a commitment. Convert to calendar
dates using your weekly hours: weeks = hours / weekly hours.

## Phase summary

| Phase | Name | Est. hours | Calendar start | Calendar end | Gate or checkpoint |
|---|---|---|---|---|---|
| 0 | Foundation | 15 to 25 | (fill) | (fill) | Exit checklist |
| 1 | Engine and CLI | 120 to 160 | (fill) | (fill) | Gate P1-01, schema freeze P1-02 |
| 2 | Web platform | 100 to 140 | (fill) | (fill) | Gate P2-01 |
| 3 | Hardening and release | 60 to 80 | (fill) | (fill) | v0.1.0 and demo |
| Post | Academic documents | 30 to 50 | (fill) | (fill) | After Phase 3 exit |

Total engineering estimate: 295 to 405 hours. Example: at 20 hours per week that is about 15 to 20 weeks.
Add a 20 percent buffer for rework and learning. If the deadline is shorter, apply the cut list below.

## Cut list (apply in this order if time runs short)

1. Python analyzer (P1-16) and everything Python specific.
2. Repository comparison between two different repositories (keep same-repo history comparison).
3. Incremental CLI cache.
4. Rules page editor (keep read-only violations view and CLI rules).
5. Evolution page drift view (keep hotspots and churn).
6. Usability test size from 5 to 3 participants.
Never cut: safe acquisition, fixtures and accuracy evaluation, security acceptance, accessibility basics, coverage and limitation display.

## Weekly rhythm (suggested)

- Plan the week from the backlog (30 minutes). One main item and one small item.
- Daily: one session using the short session prompt in the workflow doc.
- End of week: update PROJECT_STATE, review the decision register, push, tag a checkpoint.

## Demo plan (Phase 3)

1. Three demo repositories chosen by day one of Phase 3: one small clean, one with known cycles, one mid-size real project.
2. Script: landing, submit, progress, overview, explorer drill-down, a finding with evidence, rules violation, export, CLI in CI with a failing exit code.
3. Fallback: a recorded video and pre-generated reports in case the free worker is asleep.
