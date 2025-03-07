SELECT 
  CAST(user_id AS STRING) AS user_id,
  email,
  created_date,
  browser,
  shipping_address
FROM {{ ref('users') }}
ORDER BY CAST(user_id AS int) ASC