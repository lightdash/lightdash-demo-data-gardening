SELECT
  request_id,
  order_id,
  request_date,
  reason,
  feedback_rating
FROM
  `lightdash-analytics.lightdash_demo_gardening.support_requests`
ORDER BY
  CAST(request_id AS int) ASC