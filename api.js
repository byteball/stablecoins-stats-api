const conf = require('ocore/conf.js');
const db = require('ocore/db.js');
const express = require('express')

var symbolsByAssets = {};

const assocTickersByAssets = {};
const assocTickersByMarketNames = {};

const assocTradesByAssets = {};
const assocTradesByMarketNames = {};

var bRefreshing = false;

async function initCaches(){
	await initSymbolsCache();
	const rows = await db.query('SELECT DISTINCT base,quote FROM trades');
	for (var i=0; i < rows.length; i++){
		await refreshMarket(rows[i].base, rows[i].quote)
	}
}

async function initSymbolsCache(){
	var rows = await db.query("SELECT * FROM symbols");
	symbolsByAssets = {};
	rows.forEach(function(row){
		symbolsByAssets[row.asset] = row;
	});
}

function getMarketNameSeparator(){
	return "-";
}

function getDecimalsPriceCoefficient(ticker){
	return 10 ** (ticker.quote_decimals - ticker.base_decimals);
}

async function createTicker(base, quote){
	if (symbolsByAssets[base] && symbolsByAssets[quote]){
		const ticker = {
			quote: symbolsByAssets[quote],
			base: symbolsByAssets[base],
			quote_decimals: symbolsByAssets[quote].decimals,
			base_decimals: symbolsByAssets[base].decimals,
		};

		assocTickersByAssets[base + "_" + quote] = ticker;
		assocTickersByMarketNames[symbolsByAssets[base].symbol + getMarketNameSeparator() + symbolsByAssets[quote].symbol] = ticker;

		const trades = [];
		assocTradesByAssets[base + "_" + quote] = trades;
		assocTradesByMarketNames[symbolsByAssets[base].symbol + getMarketNameSeparator() + symbolsByAssets[quote].symbol]= trades;
		return true;
	}
	else {
		delete assocTickersByAssets[base + "_" + quote]; // we remove from api any ticker that has lost a symbol
		return false;
	}


}

async function refreshMarket(base, quote){
	bRefreshing = true;
	if (await createTicker(base, quote)){
		await refreshTrades(base, quote);
		await refreshTicker(base, quote);
	} else 
		console.log("symbol missing");
	bRefreshing = false;
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
			market_pair: ticker.base.symbol + getMarketNameSeparator() + ticker.quote.symbol,
			price: row.price * getDecimalsPriceCoefficient(ticker),
			base_volume: row.base_volume / 10 ** ticker.base_decimals,
			quote_volume: row.quote_volume / 10 ** ticker.quote_decimals,
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

	var rows = await db.query("SELECT MIN(quote_qty*1.0/base_qty) AS low24hr FROM trades WHERE timestamp > date('now' ,'-1 days') AND quote=? AND base=?",[quote, base]);
	if (rows[0])
		ticker.low24hr = rows[0].low24hr * getDecimalsPriceCoefficient(ticker);
	else
		delete ticker.low24hr;

	rows = await db.query("SELECT MAX(quote_qty*1.0/base_qty) AS high24hr FROM trades WHERE timestamp > date('now' ,'-1 days') AND quote=? AND base=?",[quote, base]);
	if (rows[0])
		ticker.high24hr = rows[0].high24hr * getDecimalsPriceCoefficient(ticker);
	else
		delete ticker.high24hr * getDecimalsPriceCoefficient(ticker);

	rows = await db.query("SELECT quote_qty*1.0/base_qty AS last FROM trades WHERE quote=? AND base=? ORDER BY timestamp DESC LIMIT 1",[quote, base]);
	if (rows[0])
		ticker.last = rows[0].last * getDecimalsPriceCoefficient(ticker);

	rows = await db.query("SELECT SUM(quote_qty) AS quote_volume FROM trades WHERE timestamp > date('now' ,'-1 days') AND quote=? AND base=?",[quote, base]);
	if (rows[0])
		ticker.quote_volume = rows[0].quote_volume  / 10 ** ticker.quote_decimals;
	else
		ticker.quote_volume = 0;

	rows = await db.query("SELECT SUM(base_qty) AS base_volume FROM trades WHERE timestamp > date('now' ,'-1 days') AND quote=? AND base=?",[quote, base]);
		if (rows[0])
			ticker.base_volume = rows[0].base_volume  / 10 ** ticker.base_decimals;
		else
			ticker.base_volume = 0;

}

async function start(){
	
	const app = express();
	const server = require('http').Server(app);

	await initCaches();

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
				waitUntilRefreshFinished.then(resolve);
			}, 50);
	})
}


exports.start = start;
exports.refreshMarket = refreshMarket;
exports.initCaches = initCaches;
exports.initSymbolsCache = initSymbolsCache;