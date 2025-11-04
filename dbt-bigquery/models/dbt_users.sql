select 
  cast(user_id as string) as user_id,
  email,
  created_date,
  browser,
  shipping_address

from {{ ref('users') }}