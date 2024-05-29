# lightdash-demo-data-gardening

This repo consists of a synthetically generated dataset, along with the config for producing that dataset, and a working dbt project for the data. This data is intended to power a new project "Thyme to Shine Market" as part of the Lightdash demo.

# Pre-requisites

- [Synth](https://github.com/shuttle-hq/synth) for time-series synthetic data generation.
- [Python](https://www.python.org/) for some data transformation using `pandas` and `numpy`.
- [google-cloud-sdk](https://cloud.google.com/sdk/docs/install) for loading to bigquery.
- [dbt](https://docs.getdbt.com/dbt-cli/install/overview) for data transformations as config.

# User guide

## 1. Run the script to write the demo data to BigQuery

```bash
sh seed-bigquery.sh
```

This will:
1. use `synth` to generate all the base datasets using the synth configuration defined in `synth/`, with help from the lookups define in `lookup/`. Note that the final two commands are non-deterministic.
2. run some bespoke transformations (using Python `pandas` and `numpy`) on the data to improve its suitability for a demo. Note that this script is non-deterministic since it includes some randomness (e.g. to adjust product popularity).
3. load the datasets into bigquery under the dataset name `lightdash-analytics.lightdash_demo_gardening`.

## 2. Run dbt

This will run the dbt models and build tables in `lightdash-analytics.lightdash_demo_gardening`

```
cd dbt-bigquery
dbt run -m dbt_baskets dbt_orders dbt_support_requests dbt_users
```
