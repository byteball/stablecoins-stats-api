const db = require('ocore/db.js');

exports.create = async function(){

	console.log("will create tables if not exist");


	await db.query("CREATE TABLE IF NOT EXISTS trades (\n\
		response_unit CHAR(44) NOT NULL, \n\
		indice INTEGER DEFAULT 0, \n\
		base CHAR(44) NOT NULL, \n\
		quote CHAR(44) NOT NULL, \n\
		quote_qty INTEGER NOT NULL, \n\
		base_qty INTEGER NOT NULL, \n\
		type VARCHAR(40), \n\
		timestamp TIMESTAMP NOT NULL, \n\
		UNIQUE (response_unit, indice)\n\
	)");
	await db.query("CREATE INDEX IF NOT EXISTS tradesByBaseQuoteAndTime ON trades(base,quote,timestamp)");
	await db.query("CREATE INDEX IF NOT EXISTS tradesByQuoteBaseAndTime ON trades(quote,base,timestamp)");

	await db.query("CREATE TABLE IF NOT EXISTS symbols (\n\
		asset CHAR(44) NOT NULL PRIMARY KEY, \n\
		symbol VARCHAR(40) NOT NULL, \n\
		decimals INTEGER NOT NULL, \n\
		description TEXT, \n\
		UNIQUE (symbol)\n\
	)");

	await db.query("CREATE TABLE IF NOT EXISTS deposits_aas (\n\
		address CHAR(32) NOT NULL PRIMARY KEY, \n\
		stable_asset CHAR(44) NOT NULL, \n\
		curve_aa CHAR(32) NOT NULL \n\
	)");

	await db.query("CREATE TABLE IF NOT EXISTS curve_aas (\n\
		address CHAR(32) NOT NULL PRIMARY KEY, \n\
		reserve_asset CHAR(44) NOT NULL, \n\
		asset_1 CHAR(44) NOT NULL, \n\
		asset_2 CHAR(44) NOT NULL \n\
	)");

}