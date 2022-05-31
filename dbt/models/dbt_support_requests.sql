SELECT
  req.request_id,
  req.order_id,
  req.request_date,
  req.reason,
  req.feedback_rating,
  ord.order_date,
  ROUND(ord.basket_total, 2) AS basket_total,
  ROUND(ord.profit, 2) AS profit,
  ord.referrer,
  ord.partner_id,
  prt.partner_name,
  prt.partner_commission,
  ord.user_id,
  usr.email,
  usr.created_date,
  usr.browser
FROM
  `lightdash-analytics.lightdash_demo_gardening.support_requests` req
LEFT JOIN
  `lightdash-analytics.lightdash_demo_gardening.orders` ord
ON
  req.order_id = ord.order_id
LEFT JOIN
  `lightdash-analytics.lightdash_demo_gardening.partners` prt
ON
  ord.partner_id = prt.partner_id
LEFT JOIN
  `lightdash-analytics.lightdash_demo_gardening.users` usr
ON
  ord.user_id = usr.user_id
ORDER BY
  CAST(request_id AS int) ASC