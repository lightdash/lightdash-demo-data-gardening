{{
  config(
    tags = ['lightdash']
  )
}}

SELECT 
  CAST(req.request_id AS STRING) AS request_id,
  CAST(req.order_id AS STRING) AS order_id,
  -- Calculate days between current timestamp and 2025-02-12 (the max order_date in our dataset), then add those days to urequest_date
  -- This ensures that the demo data always appears recent & uses dbt macros to ensure this works across data warehouses
  -- Note that this requires regular builds to keep the data fresh
  {{ dbt.dateadd("day", 
    dbt.datediff("'2025-02-12'", dbt.current_timestamp(), "day"), 
    "req.request_date") }} as request_date,
  req.reason,
  req.feedback_rating,
  {{ dbt.dateadd("day", 
    dbt.datediff("'2025-02-12'", dbt.current_timestamp(), "day"), 
    "ord.order_date") }} as order_date,
  ord.basket_total,
  ord.profit,
  ord.referrer,
  CAST(ord.partner_id AS STRING) AS partner_id,
  prt.partner_name,
  prt.partner_commission,
  CAST(ord.user_id AS STRING) AS user_id,
  usr.email,
  usr.created_date,
  usr.browser
FROM {{ ref('support_requests') }} req
  LEFT JOIN {{ ref('orders') }} ord ON req.order_id = ord.order_id
  LEFT JOIN {{ ref('partners') }} prt ON ord.partner_id = prt.partner_id
  LEFT JOIN {{ ref('users') }} usr ON ord.user_id = usr.user_id
ORDER BY CAST(request_id AS int) ASC