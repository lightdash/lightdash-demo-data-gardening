SELECT
  req.request_id,
  req.order_id,
  req.request_date,
  req.reason,
  req.feedback_rating,
  ord.order_date,
  ord.basket_total::decimal AS basket_total,
  ord.profit::decimal AS profit,
  ord.referrer,
  ord.partner_id,
  prt.partner_name,
  prt.partner_commission,
  ord.user_id,
  usr.email,
  usr.created_date,
  usr.browser
FROM
  thyme.support_requests req
LEFT JOIN
  thyme.orders ord
ON
  req.order_id = ord.order_id
LEFT JOIN
  thyme.partners prt
ON
  ord.partner_id = prt.partner_id
LEFT JOIN
  thyme.users usr
ON
  ord.user_id = usr.user_id
ORDER BY
  CAST(request_id AS int) ASC