# Semantic layer — 14 models

Every model in this project is listed below, most-queried first. Read
only the model files you need — never the whole directory. To locate a
field whose model you do not know, Grep this directory for its name.
Mind the YAML shape: dimensions are `- name:` list entries under
`columns:`, but metrics are mapping keys under `meta.metrics:` — a
grep for `- name:` enumerates only dimensions, never metrics.
A `filters=` marker means the model declares model-level filters
(required/default/sql_filter) that affect every query against it —
read that model file before querying it.

name  file  dims/metrics  joins  [filters]  description
dbt_orders  dbt_orders.yml  dims=44 metrics=11  joins=-  This table contains information on all the confirmed orders and their status
dbt_baskets  dbt_baskets.yml  dims=33 metrics=5  joins=-  This table contains all the information on customer shopping baskets on our site. There is one basket per order
dbt_support_requests  dbt_support_requests.yml  dims=45 metrics=6  joins=dbt_orders  This table contains information on all the support requests we’ve received
dbt_users  dbt_users.yml  dims=22 metrics=4  joins=dbt_orders  This table contains information on all of our users and customers
monthly_partner_info  monthly_partner_info.yml  dims=5 metrics=0  joins=-
__preagg__dbt_support_requests__support_requests_daily  __preagg__dbt_support_requests__support_requests_daily.yml  dims=15 metrics=2  joins=-  This table contains information on all the support requests we’ve received
__preagg__dbt_users__users_daily_by_browser  __preagg__dbt_users__users_daily_by_browser.yml  dims=15 metrics=1  joins=-  This table contains information on all of our users and customers
dbt_orders_no_preagg  dbt_orders_no_preagg.yml  dims=44 metrics=7  joins=-  This table contains information on all the confirmed orders and their status
example  example.yml  dims=4 metrics=0  joins=-
example_charges  example_charges.yml  dims=13 metrics=0  joins=-
running_sum_example  running_sum_example.yml  dims=5 metrics=0  joins=-
running_total_example_2  running_total_example_2.yml  dims=5 metrics=0  joins=-
semi_additive_testing  semi_additive_testing.yml  dims=4 metrics=0  joins=-
spot_on_demo_table  spot_on_demo_table.yml  dims=9 metrics=0  joins=-
