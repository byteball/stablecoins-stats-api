## Oswap-stats-api

This O<sub>byte</sub> light node explores the DAG and provides API endpoints giving information about trades happening with bonding curves assets.

Available publu

#### Installation

Install node.js 8+, clone the repository, then

`npm install`

By default the API is accessible at `http://localhost:4000` (`http://localhost:4001` for testnet). You may want to setup a reverse proxy like Nginx to make it accessible on a public url.

#### Run

`node start`


#### Endpoints


- */api/v1/assets*

Return all assets having their trades listed. It is to be noted that only assets having a symbol registered on [Obyte decentralized registry](https://github.com/byteball/token-registry-ui) will appear.

```json
{
  "GBYTE": {
    "asset_id": "base",
    "decimals": 9,
    "description": "Obyte DAG native currency",
    "symbol": "GBYTE",
    "unified_cryptoasset_id": 1492,
    "name": "Obyte",
    "last_gbyte_value": 1
  },
  "GRD": {
    "asset_id": "YtEVK0inFAj3cQ3CPkJl5Kb8Ax+VlI/dqcOb6GQP64k=",
    "decimals": 9,
    "description": "Token1 for bonded stablecoin (26XAPPPTTYRIOSYNCUV3NS2H57X5LZLJ)",
    "symbol": "GRD",
    "supply": 3.700131236,
    "last_gbyte_value": 1167.8807448416585
  },
  "IUSD": {
    "asset_id": "9V8nZuKfa8T3Hr1+40SXkkPeCS6w1+xkRFg4iqk9hws=",
    "decimals": 4,
    "description": "Token2 for bonded stablecoin (26XAPPPTTYRIOSYNCUV3NS2H57X5LZLJ)",
    "symbol": "IUSD",
    "supply": 24935.9422,
    "last_gbyte_value": 0.044061113346666674
  },
	...
}
```

---------------------------------------

- */api/v1/summary*

Return an array of all traded pairs with their characteristics and statistics for last 24 hours

```json
[{
    "market_name": "TEST_BN_3-TEST_BN_2",
    "quote_symbol": "TEST_BN_2",
    "base_symbol": "TEST_BN_3",
    "quote_id": "NVLMUHd2VmcWM1zbdSBkXbPDo2KsFgGPNOtTlvb1Ch0=",
    "base_id": "b+oglO8ho7P21hDv/MfeJSsX+aknNXNQD2KsbQ6Y94I=",
    "lowest_price_24h": 0,
    "highest_price_24h": 0,
    "last_price": 0.9998746017266991,
    "quote_volume": 0,
    "base_volume": 0,
    "first_trade_date": "2020-09-23T21:29:53.000Z"
  }, {
    "market_name": "BND_TN_STABLE-BND_TN_2",
    "quote_symbol": "BND_TN_2",
    "base_symbol": "BND_TN_STABLE",
    "quote_id": "Yj6o9ABAn2NtZkvPXzXQUuiq18yqMHiV1Qjc4Q2b2CE=",
    "base_id": "/0ErM0SqZL9tkJnCLwFwmMBZ5ah/JY02YrIg8z6C5AA=",
    "lowest_price_24h": 0.8909027484291233,
    "highest_price_24h": 0.9068299224112237,
    "last_price": 0.8909027484291233,
    "quote_volume": 2.02677942,
    "base_volume": 2.235536691,
    "first_trade_date": "2020-09-28T20:05:00.000Z"
  },
  ...
]
```

---------------------------------------

- */api/v1/tickers*

Return an associative array  of all tickers sorted by markets

```json
{
  "TEST_BN_3-TEST_BN_2": {
    "market_name": "TEST_BN_3-TEST_BN_2",
    "quote_symbol": "TEST_BN_2",
    "base_symbol": "TEST_BN_3",
    "quote_id": "NVLMUHd2VmcWM1zbdSBkXbPDo2KsFgGPNOtTlvb1Ch0=",
    "base_id": "b+oglO8ho7P21hDv/MfeJSsX+aknNXNQD2KsbQ6Y94I=",
    "lowest_price_24h": 0,
   "highest_price_24h": 0,
    "last_price": 0.9998746017266991,
    "quote_volume": 0,
    "base_volume": 0,
    "first_trade_date": "2020-09-23T21:29:53.000Z"
  },
  "BND_TN_STABLE-BND_TN_2": {
    "market_name": "BND_TN_STABLE-BND_TN_2",
    "quote_symbol": "BND_TN_2",
    "base_symbol": "BND_TN_STABLE",
    "quote_id": "Yj6o9ABAn2NtZkvPXzXQUuiq18yqMHiV1Qjc4Q2b2CE=",
    "base_id": "/0ErM0SqZL9tkJnCLwFwmMBZ5ah/JY02YrIg8z6C5AA=",
    "lowest_price_24h": 0.8909027484291233,
    "highest_price_24h": 0.9068299224112237,
    "last_price": 0.8909027484291233,
    "quote_volume": 2.02677942,
    "base_volume": 2.235536691,
    "first_trade_date": "2020-09-28T20:05:00.000Z"
  },
  ...
}
```

---------------------------------------

- */api/v1/ticker/<market_name>*

Return a ticker for a specific market

---------------------------------------

- */api/v1/trades/<market_name>*

Return an array of last 24h trades for a specific market

```json
[{
    "market_name": "BND_TN_STABLE-BND_TN_2",
    "price": 0.8909027484291233,
    "base_volume": 0.028529133,
    "quote_volume": 0.025416683,
    "time": "2020-09-16T14:30:06.000Z",
    "timestamp": 1600266606000,
    "trade_id": "fxJK8XWkqAmv+KnqczOfCC+L7wbjfLn1GoDynjJvLl8=_0",
    "type": "buy",
    "explorer": "https://testnetexplorer.obyte.org/#fxJK8XWkqAmv+KnqczOfCC+L7wbjfLn1GoDynjJvLl8="
  }, {
    "market_name": "BND_TN_STABLE-BND_TN_2",
    "price": 0.9068299224112237,
    "base_volume": 2.20548523,
    "quote_volume": 2,
    "time": "2020-09-16T11:07:49.000Z",
    "timestamp": 1600254469000,
    "trade_id": "KY6hlq1fLX1lEGyAa8fWOoEOqmz04iQEWiPzCLT43fk=_0",
    "type": "sell",
    "explorer": "https://testnetexplorer.obyte.org/#KY6hlq1fLX1lEGyAa8fWOoEOqmz04iQEWiPzCLT43fk="
  },
 ...
 ]
```
---------------------------------------

- */api/v1/candles/\<market_name\>?period=\<period\>&start=\<start\>&end=\<end\>*

Return an array of candlesticks for a time windows.

- **period**: `hourly` or `daily`
- **start**: unix timestamp (`1601013600`), ISO8601 date (`2020-09-25`) or ISO8601 datetime (`2020-09-25T06:00:00.000Z`)
- **end**: unix timestamp (`1601013600`), ISO8601 date (`2020-09-25`) or ISO8601 datetime (`2020-09-25T06:00:00.000Z`)


```json
[{
    "quote_volume": 0.3483240085253005,
    "base_volume": 0.014380741,
    "highest_price": 24.221561915710776,
    "lowest_price": 24.221561915710776,
    "open_price": 24.221561915710776,
    "close_price": 24.221561915710776,
    "start_timestamp": "2020-09-28T00:00:00.000Z"
}, {
    "quote_volume": 0,
    "base_volume": 0,
    "highest_price": 24.221561915710776,
    "lowest_price": 24.221561915710776,
    "open_price": 24.221561915710776,
    "close_price": 24.221561915710776,
    "start_timestamp": "2020-09-29T00:00:00.000Z"
}, {
    "quote_volume": 0.035434728,
    "base_volume": 0.0011,
    "highest_price": 32.215553,
    "lowest_price": 32.19175,
    "open_price": 32.215553,
    "close_price": 32.19175,
    "start_timestamp": "2020-09-30T00:00:00.000Z"
}]
```
