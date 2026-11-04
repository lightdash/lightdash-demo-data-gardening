This dbt project uses a connection to BigQuery. The dbt .sql files are written using BigQuery syntax.

There are two profiles to target, each writing to a different GCP project.

`lightdash-analytics.lightdash_demo_gardening` is the dataset that powers the internal version of the demo site at analytics.lightdash.cloud

`lightdash-healthcare-demo.lightdash_gardening_demo` is the dataset that powers the customer facing demo site at demo.lightdash.com

To update either of these sites, you need to run a dbt command from the local CLI and use the appropriate target. See the readme at the root of this repo.

## Rainbow sandbox

`lightdash-healthcare-demo.rainbow_thyme` is a sandbox for testing BigQuery behaviour on Rainbow preview environments. The `rainbow` target adds what the demo datasets lack:

- Partitioned tables: `dbt_orders` and `dbt_baskets` by day on a `DATETIME`, `dbt_support_requests` by month. `dbt_orders` is also clustered.
- `dbt_deliveries`, built only on this target: local `DATETIME`s, a UTC `TIMESTAMP` partition column, `TIME` and `DATE` columns in one table.
- Unpartitioned tables (`dbt_users`, `dbt_orders_no_preagg`, seeds) to compare against.

The service account `rainbow-thyme@lightdash-healthcare-demo.iam.gserviceaccount.com` runs queries and owns this dataset only.

```bash
export RAINBOW_BQ_KEYFILE=/path/to/service-account-rainbow-thyme.json
dbt build --profiles-dir profiles/rainbow

# connect a preview env to it
lightdash login https://<env>.lightdash.rainbowmachine.dev
lightdash deploy --create "Thyme to Shine" --profiles-dir profiles/rainbow
```

Raw data ends in February 2025; Lightdash dimensions shift it to the current date at query time.
