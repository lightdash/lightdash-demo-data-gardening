import random
from ast import literal_eval

import numpy as np
import pandas as pd


def main():
    
    # read data from synth
    df_orders = pd.read_json('synth_output_data/orders.json')
    df_products = pd.read_json('synth_output_data/products.json')
    df_partners = pd.read_json('synth_output_data/partners.json')
    df_users = pd.read_json('synth_output_data/users.json')
    df_support_requests= pd.read_json('synth_output_data/support_requests.json')
    df_orders_random = pd.read_json('synth_output_data/orders_random.json')
    df_support_requests_random = pd.read_json('synth_output_data/support_requests_random.json')

    # merge orders with users
    df_orders_users = pd.merge(df_orders, df_users, on="user_id", how="left")

    # remove orders created by users before they existed
    df_orders_users_cut = df_orders_users.loc[df_orders_users['created_date']<df_orders_users['timestamp']]

    # bulk up orders with more random orders to make up for lost orders in previous step
    df_orders_random_users = pd.merge(df_orders_random, df_users, on="user_id", how="left")
    df_orders_concat = pd.concat([df_orders_users_cut, df_orders_random_users], axis=0)
    df_orders_concat = df_orders_concat.drop(['order_id'], axis=1)
    df_orders_concat = df_orders_concat.reset_index(drop=True)
    df_orders_concat = df_orders_concat.reset_index()
    df_orders_concat = df_orders_concat.rename({'index': 'order_id'}, axis=1)
    df_orders_concat['order_id'] = df_orders_concat['order_id']+1

    # again, remove orders created by users before they existed and also before 2022-06-01
    df_orders_concat_cut = df_orders_concat.loc[df_orders_concat['created_date']<df_orders_concat['timestamp']]
    df_orders_concat_cut = df_orders_concat_cut.loc[df_orders_concat_cut['timestamp']<'2022-06-01']
    df_orders_concat_cut = df_orders_concat_cut.sort_values('timestamp')
    df_orders_concat_cut = df_orders_concat_cut.drop('order_id', axis=1)
    df_orders_concat_cut = df_orders_concat_cut.reset_index(drop=True)
    df_orders_concat_cut = df_orders_concat_cut.reset_index()
    df_orders_concat_cut = df_orders_concat_cut.rename({'index': 'order_id'}, axis=1)
    df_orders_concat_cut['order_id'] = df_orders_concat_cut['order_id']+1
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
            print(f'unpopular product: {i}')
            df_orders['ordered_product_skus'] = df_orders['ordered_product_skus'].apply(lambda x: product_manipulation(x))
            
    # drop unnecessary cols
    to_drop = [
        'browser',
        'created_date',
        'email',
        'shipping_address',
    ]
    df_orders.drop(to_drop, inplace=True, axis=1)

    # generate basket df by exploding orders on skus
    df_baskets = df_orders.explode('ordered_product_skus')[['order_id', 'ordered_product_skus']]
    df_baskets.reset_index(inplace=True, drop=True)
    df_baskets.reset_index(inplace=True)
    df_baskets = df_baskets.rename({'index': 'basket_item_id'}, axis=1)
    df_baskets['basket_item_id']+=1

    # merge baskets with product data
    df_baskets = df_baskets.merge(
        df_products,
        left_on='ordered_product_skus',
        right_on='sku',
        how='left'
    )
    df_baskets = df_baskets.drop(columns=['price_currency', 'product_name', 'sku'], axis=1)

    # calculate basket totals and merge back into baskets
    df_baskets_totals = df_baskets.groupby('order_id').sum('price_amount')
    df_baskets_totals.reset_index(inplace=True)
    df_baskets_totals.drop(columns=['basket_item_id'], axis=1, inplace=True)
    df_baskets_totals.rename({'price_amount': 'basket_total'}, inplace=True, axis=1)
    df_baskets = df_baskets.merge(df_baskets_totals, on='order_id', how='left')

    # create basket totals lookup and drop unncessary cols
    df_order_basket_totals = df_baskets.drop_duplicates('order_id', keep='first')
    to_drop = [
        'basket_item_id',
        'ordered_product_skus',
        'price_amount',
    ]
    df_order_basket_totals = df_order_basket_totals.drop(columns=to_drop, axis=1)
    df_order_basket_totals.reset_index(drop=True, inplace=True)

    # merge basket totals back to orders
    df_orders = df_orders.merge(df_order_basket_totals, how='left', on='order_id')

    # calculate profit per order based on commission per partner
    df_orders = df_orders.merge(df_partners, on='partner_id', how='left')
    df_orders['profit'] = df_orders['basket_total'] * df_orders['partner_commission']
    df_orders.drop(columns=['partner_name', 'partner_commission'], axis=1, inplace=True)

    # merge requests with orders
    df_orders_support_requests = pd.merge(df_support_requests, df_orders, how='left', on='order_id')

    # remove requests that happened before their corresponding order
    df_orders_support_requests = df_orders_support_requests.loc[df_orders_support_requests['timestamp_x']>df_orders_support_requests['timestamp_y']]
    df_orders_support_requests.rename({'timestamp_x': 'timestamp'}, axis=1, inplace=True)

    # remove unnecessary cols
    to_drop = [
        'currency',
        'ordered_product_skus',
        'partner_id',
        'referrer',
        'timestamp_y',
        'user_id'
    ]
    df_orders_support_requests.drop(to_drop, inplace=True, axis=1)

    # add on more random requests to bulk out after previous filtering
    df_orders_support_requests_concat = pd.concat([df_orders_support_requests, df_support_requests_random])

    # again, merge with orders
    df_orders_support_requests_concat_merge = pd.merge(df_orders_support_requests_concat, df_orders_concat_cut, how='left', on='order_id')

    # again, remove requests that happened before their corresponding order
    df_orders_support_requests_concat_merge_cut = df_orders_support_requests_concat_merge.loc[df_orders_support_requests_concat_merge['timestamp_x']>df_orders_support_requests_concat_merge['timestamp_y']]
    df_orders_support_requests_concat_merge_cut = df_orders_support_requests_concat_merge_cut.rename({'timestamp_x': 'timestamp'}, axis=1)

    # drop unnecessary cols and reset index
    to_drop = [
        'currency',
        'ordered_product_skus',
        'partner_id',
        'referrer',
        'timestamp_y',
        'user_id',
        'browser',
        'created_date',
        'email',
        'shipping_address',
        'basket_total',
        'profit'
    ]
    df_orders_support_requests_concat_merge_cut.drop(to_drop, inplace=True, axis=1)
    df_orders_support_requests_concat_merge_cut.reset_index(drop=True, inplace=True)
    df_support_requests = df_orders_support_requests_concat_merge_cut.copy()

    # save to csv
    df_orders.to_csv('transformed_data/orders.csv', index=False)
    df_baskets.to_csv('transformed_data/baskets.csv', index=False)
    df_products.to_csv('transformed_data/products.csv', index=False)
    df_partners.to_csv('transformed_data/partners.csv', index=False)
    df_users.to_csv('transformed_data/users.csv', index=False)
    df_support_requests.to_csv('transformed_data/support_requests.csv', index=False)
    

if __name__ == "__main__":
   main()
