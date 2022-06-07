SELECT
  user_id,
  email,
  created_date,
  browser,
  shipping_address
FROM
  thyme.users
ORDER BY
  CAST(user_id AS int) ASC