# Thyme to Shine — pure Lightdash YAML project

A dbt-free version of the semantic layer in `../dbt-bigquery`. There is no
`dbt_project.yml`, no manifest and no `dbt run` step: each model carries its
transformation SQL inline in `sql_from`, reading the raw seed tables in
`lightdash-healthcare-demo.lightdash_gardening_demo` directly.

```
lightdash.config.yml        warehouse type, project parameters, spotlight categories
lightdash/models/*.yml      the four explores
lightdash/charts/           31 charts copied from Thyme to Shine Market
lightdash/dashboards/       4 dashboards copied from Thyme to Shine Market
lightdash/chart-types/      custom chart type used by one of those dashboards
lightdash/apps/             the Revenue forecaster data app
```

## Commands

```bash
lightdash compile --project-dir . --no-warehouse-credentials
lightdash lint --path ./lightdash
lightdash start-preview --name "Thyme to Shine Lightdash YAML" \
  --project-dir . --no-warehouse-credentials --skip-copy-content -y
```

Model names are unchanged (`dbt_orders`, `dbt_baskets`, `dbt_users`,
`dbt_support_requests`) so every field ID matches the dbt project and existing
charts and dashboards work without edits.

## Differences from the dbt project

- `sum_distinct` is not a metric type in pure Lightdash YAML. `dbt_orders`
  is one row per order, so `sum_distinct_basket_total` is defined as a plain
  `sum` and returns the same values.
- `dbt_orders_no_preagg` is not converted. It exists only to A/B pre-aggregate
  behaviour against `dbt_orders` and has no table in BigQuery.
- No `primary_key` is declared on any model, matching the dbt project.
  Declaring one enables fan-out deduplication, which changes joined metric
  values on the support-requests explore.
