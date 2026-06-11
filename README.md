# Thyme Marketplace - data context layer

This repo contains metrics and context for querying our data warehouse. It's maintained by Lightdash and serves as our data brain.

## Lightdash managed

Lightdash manages this repository through automatic improvement. If you're assigned a pull request by Lightdash, you should review the change to our context layer and update. These can be surfaced through:

- Lightdash autopilot: detects gaps in our semantic layer based on data usage.
- Data team requests: the data team can manually request changes through slack agents or lightdash agents
- Manually: you can also work manually with this repository:

## How to work with this repository

This repository is pre-loaded with Lightdash Skills so you can use Claude Code or Codex locally. Changes can be submitted through [Pull Requests]()

## Structure

```
.                                # root
  ├── .skills/                   # skills to teach claude to lightdash
  └── dbt-bigquery               # dbt + lightdash project
      ├── models/                # lightdash models
      ├── data/                  # raw data
      └── tests/                 # quality tests
```