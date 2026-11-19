with customers as (

  select
    user_id,
    email,
    created_date,
    browser,
    json_extract_scalar(shipping_address, '$.city') as shipping_city,
    json_extract_scalar(shipping_address, '$.country') as shipping_country

  from {{ ref('dbt_users') }}

),

order_totals as (

  select
    user_id,
    count(distinct order_id) as lifetime_orders,
    sum(basket_total) as lifetime_revenue,
    sum(profit) as lifetime_profit,
    min(order_date) as first_order_date,
    max(order_date) as last_order_date

  from {{ ref('dbt_orders') }}
  group by user_id

),

support_totals as (

  select
    user_id,
    count(distinct request_id) as support_tickets,
    count(feedback_rating) as rated_support_tickets,
    sum(feedback_rating) as support_rating_total

  from {{ ref('dbt_support_requests') }}
  group by user_id

)

select
  customers.user_id,
  customers.email,
  customers.created_date,
  customers.browser,
  customers.shipping_city,
  customers.shipping_country,
  coalesce(order_totals.lifetime_orders, 0) as lifetime_orders,
  coalesce(order_totals.lifetime_revenue, 0) as lifetime_revenue,
  coalesce(order_totals.lifetime_profit, 0) as lifetime_profit,
  order_totals.first_order_date,
  order_totals.last_order_date,
  coalesce(support_totals.support_tickets, 0) as support_tickets,
  coalesce(support_totals.rated_support_tickets, 0) as rated_support_tickets,
  coalesce(support_totals.support_rating_total, 0) as support_rating_total

from customers

  left join order_totals
    on customers.user_id = order_totals.user_id

  left join support_totals
    on customers.user_id = support_totals.user_id
