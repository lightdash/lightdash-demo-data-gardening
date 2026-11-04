-- Rainbow-only: mixes DATETIME, TIMESTAMP, TIME and DATE, partitioned on the UTC TIMESTAMP
{{
  config(
    enabled=(target.name == 'rainbow'),
    partition_by={'field': 'dispatched_at_utc', 'data_type': 'timestamp', 'granularity': 'day'},
    cluster_by=['partner_name', 'delivery_timezone']
  )
}}

with orders as (
  select
    cast(o.order_id as string) as order_id,
    cast(o.user_id as string) as user_id,
    p.partner_name,
    o.order_date,
    ['America/New_York', 'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'Australia/Sydney'][
      offset(mod(abs(farm_fingerprint(cast(o.user_id as string))), 5))
    ] as delivery_timezone,
    mod(abs(farm_fingerprint(cast(o.order_id as string))), 46) + 2 as dispatch_hours,
    mod(abs(farm_fingerprint(concat('d', cast(o.order_id as string)))), 72) + 6 as transit_hours
  from {{ ref('orders') }} as o
    left join {{ ref('partners') }} as p
      on cast(o.partner_id as string) = cast(p.partner_id as string)
)

select
  order_id,
  user_id,
  partner_name,
  delivery_timezone,
  -- order_date is wall-clock time in the customer's zone
  order_date as ordered_at_local,
  timestamp_add(timestamp(order_date, delivery_timezone), interval dispatch_hours hour) as dispatched_at_utc,
  datetime(
    timestamp_add(timestamp(order_date, delivery_timezone), interval dispatch_hours + transit_hours hour),
    delivery_timezone
  ) as delivered_at_local,
  time(9 + mod(dispatch_hours, 10), 0, 0) as delivery_window_start,
  time(11 + mod(dispatch_hours, 10), 0, 0) as delivery_window_end,
  date(order_date) as order_day
from orders
