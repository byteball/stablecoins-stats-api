## Oswap-stats-api

This O<sub>byte</sub> light node explores the DAG and provides API endpoints giving information about trades happening with bonding curves assets.


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
    "name": "Obyte"
  },
  "TEST_BN_1": {
    "asset_id": "dIWcp7nIGoLUnBAIN+73+K0opvdZ61LqJVcaeMh1UlI=",
    "decimals": 9,
    "description": "Token1 for bonded stablecoin (Z2F2DQ2EOB3USLQZ7RYNPEPPEFHEP6KF)",
    "symbol": "TEST_BN_1",
    "supply": 0.364577996
  },
  "TEST_BN_2": {
    "asset_id": "NVLMUHd2VmcWM1zbdSBkXbPDo2KsFgGPNOtTlvb1Ch0=",
    "decimals": 9,
    "description": "Token2 for bonded stablecoin (Z2F2DQ2EOB3USLQZ7RYNPEPPEFHEP6KF)",
    "symbol": "TEST_BN_2"
	},
	...
}
```



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
    "base_volume": 0
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
    "base_volume": 2.235536691
  },
  ...
]
```



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
    "base_volume": 0
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
    "base_volume": 2.235536691
  },
  ...
}
```



- */api/v1/ticker/<market_name>*

Return a ticker for a specific market



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
