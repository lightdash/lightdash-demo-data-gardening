# Thyme to Shine — Lightdash YAML project

The same semantic layer as `../dbt-bigquery`, defined in pure Lightdash YAML
instead of dbt metadata. Both projects read the **same physical tables**, so
they return identical numbers and can be demoed side by side.

## How the two projects relate

`dbt-bigquery` is the source of truth for the data:

```
seeds/*.csv  --dbt seed-->  raw tables  --dbt run-->  dbt_orders, dbt_baskets,
                                                     dbt_users,
                                                     dbt_support_requests
```

This project does not rebuild any of that. Each model points `sql_from` at the
table dbt already built, and defines dimensions, metrics, joins and parameters
on top of it:

```yaml
name: dbt_orders
sql_from: '`lightdash-healthcare-demo.lightdash_gardening_demo.dbt_orders`'
```

So `dbt build` in `../dbt-bigquery` refreshes the data for **both** Lightdash
projects at once. Nothing needs running here afterwards except a redeploy if
the YAML itself changed.

## Layout

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

## Known gaps

- **`sql_from` hardcodes the dataset.** BigQuery rejects an unqualified table
  name, and the internal and external demos live in different GCP projects
  *and* different datasets (`lightdash-analytics.lightdash_demo_gardening` vs
  `lightdash-healthcare-demo.lightdash_gardening_demo`). dbt handles this with
  profile targets; pure YAML has no equivalent, so switching environments means
  editing four `sql_from` lines. Currently pointed at the external demo.
- **`sum_distinct` is not a metric type in pure Lightdash YAML.** `dbt_orders`
  is one row per order, so `sum_distinct_basket_total` is defined as a plain
  `sum` and returns the same values.
- **`dbt_orders_no_preagg` is not converted.** It exists only to A/B
  pre-aggregate behaviour against `dbt_orders`.
- **No `primary_key` is declared**, matching the dbt project. Declaring one
  enables fan-out deduplication, which lowers joined metric values on the
  support-requests explore by roughly 3%. That is arguably a bug fix, but it
  would make the two projects disagree unless both are changed.
