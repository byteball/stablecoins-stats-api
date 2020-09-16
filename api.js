const conf = require('ocore/conf.js');
const db = require('ocore/db.js');
const express = require('express')

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

async function initCaches(){
	await initAssetsCache();
	const rows = await db.query('SELECT DISTINCT base,quote FROM trades');
	for (var i=0; i < rows.length; i++){
		await refreshMarket(rows[i].base, rows[i].quote)
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
	return 10 ** (assocAssets[quote].decimals - assocAssets[base].decimals);
}

async function createTicker(base, quote){
	if (assocAssets[base] && assocAssets[quote]){

		const trading_pairs = assocAssets[base].symbol + getMarketNameSeparator() + assocAssets[quote].symbol
		const ticker = {
			trading_pairs,
			quote_symbol: assocAssets[quote].symbol,
			base_symbol: assocAssets[base].symbol,
			quote_id: quote,
			base_id: base,
		};

		assocTickersByAssets[base + "_" + quote] = ticker;
		assocTickersByMarketNames[trading_pairs] = ticker;

		const trades = [];
		assocTradesByAssets[base + "_" + quote] = trades;
		assocTradesByMarketNames[trading_pairs]= trades;
		return true;
	}
	else {
		delete assocTickersByAssets[base + "_" + quote]; // we remove from api any ticker that has lost a symbol
		return false;
	}
}

async function refreshMarket(base, quote){
	bRefreshing = true;
	await refreshAsset(base);
	await refreshAsset(quote);
	if (await createTicker(base, quote)){
		await refreshTrades(base, quote);
		await refreshTicker(base, quote);
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
			market_pair: ticker.base_symbol + getMarketNameSeparator() + ticker.quote_symbol,
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

	rows = await db.query("SELECT SUM(base_qty) AS base_volume FROM trades WHERE timestamp > date('now' ,'-1 days') AND quote=? AND base=?",[quote, base]);
			if (rows[0])
				ticker.base_volume = rows[0].base_volume  / 10 ** assocAssets[base].decimals;
			else
				ticker.base_volume = 0;
}

async function start(){
	
	const app = express();
	const server = require('http').Server(app);

	await initCaches();


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

	server.listen(conf.apiPort, () => {
		console.log(`== server started listening on ${conf.webServerPort} port`);
	});
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
exports.initCaches = initCaches;
exports.initAssetsCache = initAssetsCache;