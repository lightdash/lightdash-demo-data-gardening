This dbt project uses a connection to BigQuery. The dbt .sql files are written using BigQuery syntax.

There are two profiles to target, each writing to a different GCP project.

`lightdash-analytics.lightdash_demo_gardening` is the dataset that powers the internal version of the demo site at analytics.lightdash.cloud

`lightdash-healthcare-demo.lightdash_gardening_demo` is the dataset that powers the customer facing demo site at demo.lightdash.com

To update either of these sites, you need to run a dbt command from the local CLI and use the appropriate target. See the readme at the root of this repo.