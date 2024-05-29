import random
from ast import literal_eval
import csv
import numpy as np
import pandas as pd
from datetime import datetime
import sys


def main():

    # get an arg from command line to override default dbt folder
    # -p or --path and default to dbt
    dbt_folder = "dbt"
    if len(sys.argv) > 1:
        if sys.argv[1] in ["-p", "--path"]:
            dbt_folder = sys.argv[2]

    # read data from synth
    df_orders = pd.read_json("synth_output_data/orders.json")
    df_products = pd.read_json("synth_output_data/products.json")
    df_partners = pd.read_json("synth_output_data/partners.json")
    df_users = pd.read_json("synth_output_data/users.json")
    df_support_requests = pd.read_json("synth_output_data/support_requests.json")
    df_orders_random = pd.read_json("synth_output_data/orders_random.json")
    df_support_requests_random = pd.read_json(
        "synth_output_data/support_requests_random.json"
    )

    # get the current date of the system
    current_date = datetime.today().date()
    formatted_date = current_date.strftime("%Y-%m-%d")

    # merge orders with users
    df_orders_users = pd.merge(df_orders, df_users, on="user_id", how="left")

    # remove orders created by users before they existed
    df_orders_users_cut = df_orders_users.loc[
        df_orders_users["created_date"] < df_orders_users["order_date"]
    ]

    # bulk up orders with more random orders to make up for lost orders in previous step
    df_orders_random_users = pd.merge(
        df_orders_random, df_users, on="user_id", how="left"
    )
    df_orders_concat = pd.concat([df_orders_users_cut, df_orders_random_users], axis=0)
    df_orders_concat = df_orders_concat.drop(["order_id"], axis=1)
    df_orders_concat = df_orders_concat.reset_index(drop=True)
    df_orders_concat = df_orders_concat.reset_index()
    df_orders_concat = df_orders_concat.rename({"index": "order_id"}, axis=1)
    df_orders_concat["order_id"] = df_orders_concat["order_id"] + 1

    # again, remove orders created by users before they existed and also before the current date
    df_orders_concat_cut = df_orders_concat.loc[
        df_orders_concat["created_date"] < df_orders_concat["order_date"]
    ]
    df_orders_concat_cut = df_orders_concat_cut.loc[
        df_orders_concat_cut["order_date"] < formatted_date
    ]
    df_orders_concat_cut = df_orders_concat_cut.sort_values("order_date")
    df_orders_concat_cut = df_orders_concat_cut.drop("order_id", axis=1)
    df_orders_concat_cut = df_orders_concat_cut.reset_index(drop=True)
    df_orders_concat_cut = df_orders_concat_cut.reset_index()
    df_orders_concat_cut = df_orders_concat_cut.rename({"index": "order_id"}, axis=1)
    df_orders_concat_cut["order_id"] = df_orders_concat_cut["order_id"] + 1
    df_orders = df_orders_concat_cut.copy()

    # make some products more popular than others
    def product_manipulation(x):
        if i in x:
            if random.randint(0, 10) > 2:
                if len(x) > 1:
                    x.remove(i)
        return x

    for i in range(1, 43):
        if random.randint(0, 10) > 3:
            print(f"unpopular product: {i}")
            df_orders["ordered_product_skus"] = df_orders["ordered_product_skus"].apply(
                lambda x: product_manipulation(x)
            )

    # drop unnecessary cols
    to_drop = [
        "browser",
        "created_date",
        "email",
        "shipping_address",
    ]
    df_orders.drop(to_drop, inplace=True, axis=1)

    # generate basket df by exploding orders on skus
    df_baskets = df_orders.explode("ordered_product_skus")[
        ["order_id", "ordered_product_skus"]
    ]
    df_baskets.reset_index(inplace=True, drop=True)
    df_baskets.reset_index(inplace=True)
    df_baskets = df_baskets.rename({"index": "basket_item_id"}, axis=1)
    df_baskets["basket_item_id"] += 1

    # merge baskets with product data
    df_baskets = df_baskets.merge(
        df_products, left_on="ordered_product_skus", right_on="sku", how="left"
    )
    df_baskets = df_baskets.drop(
        columns=["price_currency", "product_name", "sku"], axis=1
    )

    # calculate basket totals and merge back into baskets
    df_baskets_totals = df_baskets.groupby("order_id").sum("price_amount")
    df_baskets_totals.reset_index(inplace=True)
    df_baskets_totals.drop(columns=["basket_item_id"], axis=1, inplace=True)
    df_baskets_totals.rename({"price_amount": "basket_total"}, inplace=True, axis=1)
    df_baskets = df_baskets.merge(df_baskets_totals, on="order_id", how="left")

    # create basket totals lookup and drop unncessary cols
    df_order_basket_totals = df_baskets.drop_duplicates("order_id", keep="first")
    to_drop = [
        "basket_item_id",
        "ordered_product_skus",
        "price_amount",
    ]
    df_order_basket_totals = df_order_basket_totals.drop(columns=to_drop, axis=1)
    df_order_basket_totals.reset_index(drop=True, inplace=True)

    # merge basket totals back to orders
    df_orders = df_orders.merge(df_order_basket_totals, how="left", on="order_id")

    # calculate profit per order based on commission per partner
    df_orders = df_orders.merge(df_partners, on="partner_id", how="left")
    df_orders["profit"] = df_orders["basket_total"] * df_orders["partner_commission"]
    df_orders.drop(columns=["partner_name", "partner_commission"], axis=1, inplace=True)

    # merge requests with orders
    df_orders_support_requests = pd.merge(
        df_support_requests, df_orders, how="left", on="order_id"
    )

    # remove requests that happened before their corresponding order
    df_orders_support_requests = df_orders_support_requests.loc[
        df_orders_support_requests["request_date"]
        > df_orders_support_requests["order_date"]
    ]

    # remove unnecessary cols
    to_drop = [
        "currency",
        "ordered_product_skus",
        "partner_id",
        "referrer",
        "order_date",
        "user_id",
    ]
    df_orders_support_requests.drop(to_drop, inplace=True, axis=1)

    # add on more random requests to bulk out after previous filtering
    df_orders_support_requests_concat = pd.concat(
        [df_orders_support_requests, df_support_requests_random]
    )

    # again, merge with orders
    df_orders_support_requests_concat_merge = pd.merge(
        df_orders_support_requests_concat,
        df_orders_concat_cut,
        how="left",
        on="order_id",
    )

    # again, remove requests that happened before their corresponding order
    df_orders_support_requests_concat_merge_cut = (
        df_orders_support_requests_concat_merge.loc[
            df_orders_support_requests_concat_merge["request_date"]
            > df_orders_support_requests_concat_merge["order_date"]
        ]
    )

    # sort by timestamp ascending, and correct request IDs
    df_orders_support_requests_concat_merge_cut = (
        df_orders_support_requests_concat_merge_cut.sort_values("request_date")
    )
    df_orders_support_requests_concat_merge_cut = (
        df_orders_support_requests_concat_merge_cut.drop("request_id", axis=1)
    )
    df_orders_support_requests_concat_merge_cut = (
        df_orders_support_requests_concat_merge_cut.reset_index(drop=True)
    )
    df_orders_support_requests_concat_merge_cut = (
        df_orders_support_requests_concat_merge_cut.reset_index()
    )
    df_orders_support_requests_concat_merge_cut = (
        df_orders_support_requests_concat_merge_cut.rename(
            {"index": "request_id"}, axis=1
        )
    )
    df_orders_support_requests_concat_merge_cut["request_id"] += 1

    # remove everything after end of may
    df_orders_support_requests_concat_merge_cut = (
        df_orders_support_requests_concat_merge_cut.loc[
            df_orders_support_requests_concat_merge_cut["request_date"] < formatted_date
        ]
    )

    # drop unnecessary cols and reset index
    to_drop = [
        "currency",
        "ordered_product_skus",
        "partner_id",
        "referrer",
        "order_date",
        "user_id",
        "browser",
        "created_date",
        "email",
        "shipping_address",
        "basket_total",
        "profit",
    ]
    df_orders_support_requests_concat_merge_cut.drop(to_drop, inplace=True, axis=1)
    df_orders_support_requests_concat_merge_cut.reset_index(drop=True, inplace=True)
    df_support_requests = df_orders_support_requests_concat_merge_cut.copy()

    # remove names with quotes in from users table to make things easier later...
    def remove_quote_names(x):
        for field in x.keys():
            if field in ["city", "country", "street_name"]:
                if "'" in x[field]:
                    print(
                        'replacing: "{value_old}" with "{value_new}"'.format(
                            value_old=x[field], value_new=x[field].replace("'", "")
                        )
                    )
                    x[field] = x[field].replace("'", "")
        return x

    df_users["shipping_address"] = df_users["shipping_address"].apply(
        lambda x: remove_quote_names(x)
    )

    # convert to a json string representation
    def escape_string(x):
        x = str(x)
        x = x.replace("'", '"')
        return x

    df_users["shipping_address"] = df_users["shipping_address"].apply(
        lambda x: escape_string(x)
    )

    # order cols and sort records appropriately
    df_orders = df_orders[
        [
            "order_id",
            "order_date",
            "user_id",
            "partner_id",
            "ordered_product_skus",
            "currency",
            "basket_total",
            "profit",
            "referrer",
        ]
    ].copy()

    df_baskets = df_baskets[
        [
            "order_id",
            "basket_item_id",
            "ordered_product_skus",
            "price_amount",
            "basket_total",
        ]
    ].copy()

    df_products = df_products[
        ["sku", "product_name", "price_amount", "price_currency"]
    ].copy()

    df_partners = df_partners[
        ["partner_id", "partner_name", "partner_commission"]
    ].copy()

    df_users = df_users[
        ["user_id", "email", "created_date", "browser", "shipping_address"]
    ].copy()

    df_support_requests = df_support_requests[
        ["request_id", "order_id", "request_date", "reason", "feedback_rating"]
    ].copy()

    # save to csv
    df_orders.to_csv(f"{dbt_folder}/seeds/orders.csv", index=False)
    df_baskets.to_csv(f"{dbt_folder}/seeds/baskets.csv", index=False)
    df_products.to_csv(f"{dbt_folder}/seeds/products.csv", index=False)
    df_partners.to_csv(f"{dbt_folder}/seeds/partners.csv", index=False)
    df_users.to_csv(f"{dbt_folder}/seeds/users.csv", index=False, quoting=csv.QUOTE_ALL)
    df_support_requests.to_csv(f"{dbt_folder}/seeds/support_requests.csv", index=False)


if __name__ == "__main__":
    main()
