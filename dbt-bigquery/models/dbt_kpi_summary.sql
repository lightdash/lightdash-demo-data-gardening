with

orders_daily as (
  select
    date(timestamp_add(
      order_date,
      interval timestamp_diff(current_timestamp(), timestamp '2025-02-13 00:00:00', second) second
    ))                          as snapshot_date,
    count(distinct order_id)    as orders_count,
    sum(basket_total)           as revenue
  from {{ ref('orders') }}
  group by 1
),

support_daily as (
  select
    date(timestamp_add(
      request_date,
      interval timestamp_diff(current_timestamp(), timestamp '2025-02-13 00:00:00', second) second
    ))                          as snapshot_date,
    count(request_id)           as support_requests_count
  from {{ ref('support_requests') }}
  group by 1
),

users_daily as (
  select
    date(timestamp_add(
      created_date,
      interval timestamp_diff(current_timestamp(), timestamp '2025-02-13 00:00:00', second) second
    ))                          as snapshot_date,
    count(distinct user_id)     as new_users_count
  from {{ ref('users') }}
  group by 1
)

select
  o.snapshot_date,
  o.orders_count,
  o.revenue,
  coalesce(s.support_requests_count, 0)  as support_requests_count,
  coalesce(u.new_users_count, 0)          as new_users_count

from orders_daily     o
left join support_daily  s on o.snapshot_date = s.snapshot_date
left join users_daily    u on o.snapshot_date = u.snapshot_date
