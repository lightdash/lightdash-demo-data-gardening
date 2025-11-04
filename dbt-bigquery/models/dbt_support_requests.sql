{{
  config(
    tags = ['lightdash']
  )
}}

select 
  cast(requests.request_id as string) as request_id,
  cast(requests.order_id as string) as order_id,
  requests.request_date,
  requests.reason,
  requests.feedback_rating,
  orders.order_date, 
  orders.basket_total,
  orders.profit,
  orders.referrer,
  cast(orders.partner_id as string) as partner_id,
  partners.partner_name,
  partners.partner_commission,
  cast(orders.user_id as string) as user_id,
  users.email,
  users.created_date,
  users.browser

from {{ ref('support_requests') }} as requests

  left join {{ ref('orders') }} as orders
    on requests.order_id = orders.order_id

  left join {{ ref('partners') }} as partners 
    on orders.partner_id = partners.partner_id

  left join {{ ref('users') }} as users
    on orders.user_id = users.user_id