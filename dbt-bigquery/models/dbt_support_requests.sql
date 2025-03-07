{{
  config(
    tags = ['lightdash']
  )
}}

SELECT 
  CASt(req.request_id AS STRING) AS request_id,
  CAST(req.order_id AS STRING) AS order_id,
  req.request_date,
  req.reason,
  req.feedback_rating,
  ord.order_date, 
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