select 
  cast(orders.order_id as string) as order_id,
  orders.order_date,
  cast(orders.partner_id as string) as partner_id,
  partners.partner_name,
  partners.partner_logo,
  partners.partner_commission,
  orders.currency,
  orders.basket_total,
  orders.profit,
  orders.referrer,
  cast(orders.user_id as string) as user_id,
  users.email,
  users.created_date as user_created_date,
  users.browser,
  json_extract_scalar(shipping_address, '$.city') as shipping_city,
  json_extract_scalar(shipping_address, '$.country') as shipping_country

from {{ ref('orders') }} as orders

  left join {{ ref('users') }} as users 
    on cast(orders.user_id as string) = cast(users.user_id as string)

  left join {{ ref('partners') }} as partners
    on cast(orders.partner_id as string) = cast(partners.partner_id as string)