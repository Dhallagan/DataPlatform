# GTM Terminal Atomic Roadmap

Objective: build the Bloomberg-style command center for GTM with trusted data, decisioning, and action loops.

## Atomic Plan

1. `A1` Foundation Data Surface (Completed)
- Create route shell, navigation, and data contracts.
- Source live metrics from `growth.gtm_pipeline_snapshot`.

2. `A2` Risk Radar (Completed)
- Surface trial conversion risk from `growth.signal_trial_conversion_risk_daily`.
- Rank by `signal_score` with reason codes and urgency context.

3. `A3` Action Queue (Completed)
- Display intervention queue from `growth.growth_task_queue`.
- Prioritize by `urgent/high/normal` and due time.

4. `A4` Campaign Market Board (Completed)
- Add channel/campaign performance from `growth.gtm_campaign_channel_performance`.
- Show revenue and ROAS leaders by month.

5. `A5` Operator Tape (Completed)
- Build a live event tape summarizing pipeline, risk, and queue signals.
- Keep feed explainable and tied to source data.

6. `A6` Explainability + Ownership (In Progress)
- Attach citations and ownership blocks at object/report level.
- Add per-widget freshness and query trace ids.

7. `A7` Action Execution Loop (Pending)
- Convert queue rows into direct play execution actions.
- Log outcomes and tie back to pipeline/win-rate impact.

8. `A8` Value Attribution (Pending)
- Measure incremental won revenue from recommended actions.
- Track precision@top-k and time-to-action improvements.
