const conf = require('ocore/conf.js');
const db = require('ocore/db.js');
const express = require('express')
const cors = require('cors');

const assocTickersByAssets = {};
const assocTickersByMarketNames = {};

const assocTradesByAssets = {};
const assocTradesByMarketNames = {};

var assocAssets = {};
var assocAssetsBySymbols = {};

const unifiedCryptoAssetIdsByAssets = {
	base: { 
		id: 1492,
		name: 'Obyte'
	}
}

var bRefreshing = false;

async function initMarkets(){
	await initAssetsCache();
	const rows = await db.query('SELECT DISTINCT base,quote FROM trades');
	for (var i=0; i < rows.length; i++){
		await refreshMarket(rows[i].base, rows[i].quote);
	}
}

async function initAssetsCache(){
	var rows = await db.query("SELECT * FROM bonded_assets LEFT JOIN supplies USING(asset)");
	assocAssets = {};
	rows.forEach(function(row){
		setAsset(row);
	});
}
function setAsset(row){
	if (!row)
		return;
	assocAssets[row.asset] = {
		symbol: row.symbol,
		decimals: row.decimals,
	};

	assocAssetsBySymbols[row.symbol] = {
		asset_id: row.asset,
		decimals: row.decimals,
		description: row.description,
		symbol: row.symbol,
	};

	if (row.supply)
		assocAssetsBySymbols[row.symbol].supply = row.supply / 10 ** row.decimals;
		
	if (unifiedCryptoAssetIdsByAssets[row.asset]){
		assocAssetsBySymbols[row.symbol].unified_cryptoasset_id = unifiedCryptoAssetIdsByAssets[row.asset].id;
		assocAssetsBySymbols[row.symbol].name = unifiedCryptoAssetIdsByAssets[row.asset].name;
	}
}

function getMarketNameSeparator(){
	return "-";
}

function getDecimalsPriceCoefficient(base, quote){
	return 10 ** (assocAssets[base].decimals - assocAssets[quote].decimals);
}

async function createTicker(base, quote){
	if (assocAssets[base] && assocAssets[quote]){

		const market_name = assocAssets[base].symbol + getMarketNameSeparator() + assocAssets[quote].symbol
		const ticker = {
			market_name,
			quote_symbol: assocAssets[quote].symbol,
			base_symbol: assocAssets[base].symbol,
			quote_id: quote,
			base_id: base,
		};

		assocTickersByAssets[base + "_" + quote] = ticker;
		assocTickersByMarketNames[market_name] = ticker;

		const trades = [];
		assocTradesByAssets[base + "_" + quote] = trades;
		assocTradesByMarketNames[market_name]= trades;
		return true;
	}
	else {
		delete assocTickersByAssets[base + "_" + quote]; // we remove from api any ticker that has lost a symbol
		return false;
	}
}


function computeAllGbPrices() {
	for (var symbol in assocAssetsBySymbols){
		delete assocAssetsBySymbols[symbol].last_gbyte_value;
	}
	assocAssetsBySymbols['GBYTE'].last_gbyte_value = 1;

	findGbPrices();

	function findGbPrices(passesLeft = 2){
		for (var symbol in assocAssetsBySymbols){
			if (assocAssetsBySymbols[symbol].last_gbyte_value)
				continue;	
			for (var market in assocTickersByMarketNames){
				const quote_gbyte_value = assocAssetsBySymbols[assocTickersByMarketNames[market].quote_symbol].last_gbyte_value;
				if (assocTickersByMarketNames[market].base_id == assocAssetsBySymbols[symbol].asset_id && quote_gbyte_value){
					assocAssetsBySymbols[symbol].last_gbyte_value = assocTickersByMarketNames[market].last_price * quote_gbyte_value;
					break;
				}
			}
		}
		if (passesLeft > 0)
			findGbPrices(passesLeft -1);
	}
}


async function refreshMarket(base, quote){
	bRefreshing = true;
	await refreshAsset(base);
	await refreshAsset(quote);
	if (await createTicker(base, quote)){
		await refreshTrades(base, quote);
		await refreshTicker(base, quote);
		await makeNextCandlesForMarket(base, quote);
		computeAllGbPrices(); // change for for this market could affect price of other assets so we recompute all prices
	} else 
		console.log("symbol missing");
	bRefreshing = false;
}

async function refreshAsset(asset){
	var rows = await db.query("SELECT * FROM bonded_assets LEFT JOIN supplies USING(asset) WHERE bonded_assets.asset=?", [asset]);
	setAsset(rows[0]);
}


async function refreshTrades(base, quote){
	const ticker = assocTickersByAssets[base + "_" + quote];
	if (!ticker)
		return console.log(base + "_" + quote + " not found in assocTickersByAssets")
	const trades = assocTradesByAssets[base + "_" + quote];

	trades.length = 0; // we clear array without deferencing it

	var rows = await db.query("SELECT quote_qty*1.0/base_qty AS price,base_qty AS base_volume,quote_qty AS quote_volume,timestamp,response_unit,indice,type,timestamp FROM trades \n\
	WHERE timestamp > date('now' ,'-1 days') AND quote=? AND base=? ORDER BY timestamp DESC",[quote, base]);
	rows.forEach(function(row){
		trades.push({
			market_name: ticker.base_symbol + getMarketNameSeparator() + ticker.quote_symbol,
			price: row.price * getDecimalsPriceCoefficient(base, quote),
			base_volume: row.base_volume / 10 ** assocAssets[base].decimals,
			quote_volume: row.quote_volume / 10 ** assocAssets[quote].decimals,
			time: row.timestamp,
			timestamp: (new Date(row.timestamp)).getTime(),
			trade_id: row.response_unit + '_' + row.indice,
			type: row.type,
			explorer: conf.explorer_base_url + row.response_unit
		});
	});

}


async function refreshTicker(base, quote){
	const ticker = assocTickersByAssets[base + "_" + quote];
	if (!ticker)
		return console.log(base + "_" + quote + " not found in assocTickersByAssets")

	var rows = await db.query("SELECT MIN(quote_qty*1.0/base_qty) AS low FROM trades WHERE timestamp > date('now' ,'-1 days') AND quote=? AND base=?",[quote, base]);
	if (rows[0])
		ticker.lowest_price_24h = rows[0].low * getDecimalsPriceCoefficient(base, quote);
	else
		delete ticker.lowest_price_24h;

	rows = await db.query("SELECT MAX(quote_qty*1.0/base_qty) AS high FROM trades WHERE timestamp > date('now' ,'-1 days') AND quote=? AND base=?",[quote, base]);
	if (rows[0])
		ticker.highest_price_24h = rows[0].high * getDecimalsPriceCoefficient(base, quote);
	else
		delete ticker.highest_price_24h * getDecimalsPriceCoefficient(base, quote);

	rows = await db.query("SELECT quote_qty*1.0/base_qty AS last_price FROM trades WHERE quote=? AND base=? ORDER BY timestamp DESC LIMIT 1",[quote, base]);
	if (rows[0])
		ticker.last_price = rows[0].last_price * getDecimalsPriceCoefficient(base, quote);

	rows = await db.query("SELECT SUM(quote_qty) AS quote_volume FROM trades WHERE timestamp > date('now' ,'-1 days') AND quote=? AND base=?",[quote, base]);
	if (rows[0])
		ticker.quote_volume = rows[0].quote_volume  / 10 ** assocAssets[quote].decimals;
	else
		ticker.quote_volume = 0;

	rows = await db.query("SELECT SUM(base_qty) AS base_volume FROM trades WHERE timestamp > date('now' ,'-1 days') AND quote=? AND base=?",[quote, base]);
		if (rows[0])
			ticker.base_volume = rows[0].base_volume  / 10 ** assocAssets[base].decimals;
		else
			ticker.base_volume = 0;

	rows = await db.query("SELECT timestamp FROM trades WHERE quote=? AND base=? ORDER BY timestamp ASC LIMIT 1",[quote, base]);
		if (rows[0])
			ticker.first_trade_date = rows[0].timestamp;
}


async function makeNextCandlesForMarket(base, quote){
	await makeNextHourlyCandlesForMarket(base, quote, true);
	await makeNextDailyCandlesForMarket(base, quote, true);
}

async function makeNextDailyCandlesForMarket(base, quote, bReplaceLastCandle){
	var last_start_timestamp,last_end_timestamp,next_end_timestamp;
	const candles = await db.query("SELECT start_timestamp AS last_start_timestamp, \n\
	strftime('%Y-%m-%dT%H:00:00.000Z', start_timestamp, '+24 hours') AS last_end_timestamp, \n\
	strftime('%Y-%m-%dT%H:00:00.000Z', start_timestamp, '+48 hours') AS next_end_timestamp \n\
	FROM daily_candles WHERE base=? AND quote=? ORDER BY start_timestamp DESC LIMIT 1", [base,quote]);

	if (candles[0]){
		last_start_timestamp = candles[0].last_start_timestamp;
		last_end_timestamp = candles[0].last_end_timestamp;
		next_end_timestamp = candles[0].next_end_timestamp;
	} else { // if no candle exists yet, we find the first candle time start
		const trades = await db.query("SELECT strftime('%Y-%m-%dT00:00:00.000Z',timestamp) AS last_start_timestamp, strftime('%Y-%m-%dT00:00:00.000Z', DATETIME(timestamp, '+24 hours')) AS last_end_timestamp\n\
		FROM trades WHERE base=? AND quote=? ORDER BY timestamp ASC LIMIT 1", [base, quote]);
		if (!trades[0])
			return console.log("no trade yet for " + base + " - " + quote);
		last_start_timestamp = trades[0].last_start_timestamp;
		last_end_timestamp = trades[0].last_end_timestamp;
	}

	if (last_end_timestamp > (new Date()).toISOString())
		return; // current candle not closed yet
	if (bReplaceLastCandle)
		await makeCandleForPair('daily_candles', last_start_timestamp, last_end_timestamp, base, quote);
	else
		await makeCandleForPair('daily_candles', last_end_timestamp, next_end_timestamp, base, quote);

	await makeNextDailyCandlesForMarket(base, quote);
}


async function makeNextHourlyCandlesForMarket(base, quote, bReplaceLastCandle){
	var last_start_timestamp,last_end_timestamp,next_end_timestamp;
	const candles = await db.query("SELECT start_timestamp AS last_start_timestamp, \n\
	strftime('%Y-%m-%dT%H:00:00.000Z', start_timestamp, '+1 hour') AS last_end_timestamp, \n\
	strftime('%Y-%m-%dT%H:00:00.000Z', start_timestamp, '+2 hours') AS next_end_timestamp \n\
	FROM hourly_candles WHERE base=? AND quote=? ORDER BY start_timestamp DESC LIMIT 1", [base,quote]);

	if (candles[0]){
		last_start_timestamp = candles[0].last_start_timestamp;
		last_end_timestamp = candles[0].last_end_timestamp;
		next_end_timestamp = candles[0].next_end_timestamp;
	} else { // if no candle exists yet, we find the first candle time start
		const trades = await db.query("SELECT strftime('%Y-%m-%dT%H:00:00.000Z',timestamp) AS last_start_timestamp, strftime('%Y-%m-%dT%H:00:00.000Z', DATETIME(timestamp, '+1 hour')) AS last_end_timestamp\n\
		FROM trades WHERE base=? AND quote=? ORDER BY timestamp ASC LIMIT 1", [base, quote]);
		if (!trades[0])
			return console.log("no trade yet for " + base + " - " + quote);
		last_start_timestamp = trades[0].last_start_timestamp;
		last_end_timestamp = trades[0].last_end_timestamp;
	}
	if (last_end_timestamp > (new Date()).toISOString())
		return; // current candle not closed yet
	if (bReplaceLastCandle)
		await makeCandleForPair('hourly_candles', last_start_timestamp, last_end_timestamp, base, quote);
	else
		await makeCandleForPair('hourly_candles', last_end_timestamp, next_end_timestamp, base, quote);

	await makeNextHourlyCandlesForMarket(base, quote);

}

async function makeCandleForPair(table_name, start_timestamp, end_timestamp, base, quote){
	var low, high, open_price, close_price;
	var quote_volume, base_volume = 0;

	var rows = await db.query("SELECT MIN(quote_qty*1.0/base_qty) AS low,MAX(quote_qty*1.0/base_qty) AS high,SUM(quote_qty) AS quote_volume,SUM(base_qty) AS base_volume \n\
	 FROM trades WHERE timestamp >=? AND timestamp <?  AND quote=? AND base=?",[start_timestamp, end_timestamp, quote, base]);

	if (rows[0] && rows[0].low){
		low = rows[0].low * getDecimalsPriceCoefficient(base, quote);
		high = rows[0].high * getDecimalsPriceCoefficient(base, quote);
		quote_volume = rows[0].quote_volume  / 10 ** assocAssets[quote].decimals;
		base_volume = rows[0].base_volume  / 10 ** assocAssets[base].decimals;

		rows = await db.query("SELECT quote_qty*1.0/base_qty AS open_price FROM trades WHERE timestamp >=? AND quote=? AND base=? \n\
		ORDER BY timestamp ASC LIMIT 1" ,[start_timestamp, quote, base]);

		open_price = rows[0].open_price * getDecimalsPriceCoefficient(base, quote);
		rows = await db.query("SELECT quote_qty*1.0/base_qty AS close_price FROM trades WHERE timestamp <? AND quote=? AND base=? \n\
		ORDER BY timestamp DESC LIMIT 1", [end_timestamp, quote, base]);
		close_price = rows[0].close_price * getDecimalsPriceCoefficient(base, quote);

	} else {
		rows = await db.query("SELECT close_price FROM " + table_name + " WHERE start_timestamp <? AND quote=? AND base=? ORDER BY start_timestamp DESC LIMIT 1",
		[start_timestamp, quote, base]);
		low = rows[0].close_price;
		high = rows[0].close_price;
		open_price = rows[0].close_price;
		close_price = rows[0].close_price;
		quote_volume = 0;
		base_volume = 0;
	}

	await db.query("REPLACE INTO " + table_name + " (base,quote,quote_qty,base_qty,highest_price,lowest_price,open_price,close_price,start_timestamp)\n\
	VALUES (?,?,?,?,?,?,?,?,?)",[ base, quote, quote_volume, base_volume, high, low, open_price, close_price,start_timestamp]);
}


async function start(){
	
	const app = express();
	const server = require('http').Server(app);
	app.use(cors());
	
	await initMarkets();

	app.get('/api/v1/assets', async function(request, response){
		await waitUntilRefreshFinished();
		return response.send(assocAssetsBySymbols);
	});

	app.get('/api/v1/summary', async function(request, response){
		await waitUntilRefreshFinished();
		const arrSummary = [];
		for(var key in assocTickersByMarketNames)
			arrSummary.push(assocTickersByMarketNames[key]);
		return response.send(arrSummary);
	});

	app.get('/api/v1/tickers', async function(request, response){
		await waitUntilRefreshFinished();
		return response.send(assocTickersByMarketNames);
	});

	app.get('/api/v1/ticker/:marketName', async function(request, response){
		const marketName = request.params.marketName;
		if (assocTickersByMarketNames[marketName]){
			await waitUntilRefreshFinished();
			return response.send(assocTickersByMarketNames[marketName]);
		}
		else
			return response.status(400).send('Unknown market');
	});

	app.get('/api/v1/trades/:marketName', async function(request, response){
		const marketName = request.params.marketName;
		if (assocTradesByMarketNames[marketName]){
			await waitUntilRefreshFinished();
			return response.send(assocTradesByMarketNames[marketName]);
		}
		else
			return response.status(400).send('Unknown market');
	});

	app.get('/api/v1/candles/:marketName', async function(request, response){
		const marketName = request.params.marketName;
		const period = request.query.period;
		const start_time = parseDateTime(request.query.start);
		const end_time = parseDateTime(request.query.end);

		if (!start_time)
			return response.status(400).send('start_time not valid');
		if (!end_time)
			return response.status(400).send('end_time not valid');

		if (period !== 'hourly' && period !== 'daily')
			return response.status(400).send('period must be "daily" or "hourly"');
		if (assocTickersByMarketNames[marketName]){
			await waitUntilRefreshFinished();

		const rows = await db.query("SELECT quote_qty AS quote_volume,base_qty AS base_volume,highest_price,lowest_price,open_price,close_price,start_timestamp\n\
		FROM " + period +"_candles WHERE start_timestamp>=? AND start_timestamp<? AND quote=? AND base=?", 
		[start_time.toISOString() , end_time.toISOString(), assocTickersByMarketNames[marketName].quote_id, assocTickersByMarketNames[marketName].base_id])
		return response.send(rows);
		}
		else
			return response.status(400).send('Unknown market');
	});

	server.listen(conf.apiPort, () => {
		console.log(`== server started listening on ${conf.webServerPort} port`);
	});
}

function parseDateTime(string){

	if (typeof string !== 'string')
		return null;
	var date = null;
	if (string.match(/^\d\d\d\d-\d\d-\d\d$/))
		date = new Date(Date.parse(string));
	else if (string.match(/^\d\d\d\d-\d\d-\d\d( |T)\d\d:\d\d:\d\dZ$/))
		date = new Date(Date.parse(string));
	else if (string.match(/^\d\d\d\d-\d\d-\d\d( |T)\d\d:\d\d:\d\d.\d\d\dZ$/))
		date = new Date(Date.parse(string));
	else if (string.match(/^\d+$/))
		date = new Date(parseInt(string) / 1000);
	return date;
}


function waitUntilRefreshFinished(){
	return new Promise(function(resolve){
		if (!bRefreshing)
			return resolve()
		else
			return setTimeout(function(){
				waitUntilRefreshFinished().then(resolve);
			}, 50);
	})
}


exports.start = start;
exports.refreshMarket = refreshMarket;
exports.initAssetsCache = initAssetsCache;