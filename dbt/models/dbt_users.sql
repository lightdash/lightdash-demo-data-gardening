SELECT
  user_id,
  email,
  created_date,
  browser,
  shipping_address
FROM
  `lightdash-analytics.lightdash_demo_gardening.users`
ORDER BY
  CAST(user_id AS int) ASC