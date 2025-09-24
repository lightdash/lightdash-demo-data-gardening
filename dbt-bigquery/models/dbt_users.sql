SELECT 
  CAST(user_id AS STRING) AS user_id,
  email,
  -- Calculate days between current timestamp and 2025-02-12 (the max order_date in our dataset), then add those days to user created_date
  -- This ensures that the demo data always appears recent & uses dbt macros to ensure this works across data warehouses
  -- Note that this requires regular builds to keep the data fresh
  {{ dbt.dateadd("day", 
    dbt.datediff("'2025-02-12'", dbt.current_timestamp(), "day"), 
    "created_date") }} as created_date,
  browser,
  shipping_address
FROM {{ ref('users') }}
ORDER BY CAST(user_id AS int) ASC