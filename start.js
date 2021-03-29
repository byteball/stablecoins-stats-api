const conf = require('ocore/conf.js');
const network = require('ocore/network.js');
const eventBus = require('ocore/event_bus.js');
const lightWallet = require('ocore/light_wallet.js');
const storage = require('ocore/storage.js');
const walletGeneral = require('ocore/wallet_general.js');
const objectHash = require('ocore/object_hash.js');
const sqlite_tables = require('./sqlite_tables.js');
const db = require('ocore/db.js');
const dag = require('aabot/dag.js');
const api = require('./api.js');

lightWallet.setLightVendorHost(conf.hub);

eventBus.once('connected', function(ws){
	network.initWitnessesIfNecessary(ws, start);
});

async function treatResponseFromDepositsAA(objResponse, objInfos){

	if (!objResponse.response_unit)
		return;
	const objTriggerUnit = await storage.readUnit(objResponse.trigger_unit);
	if (!objTriggerUnit)
		throw Error('trigger unit not found ' + objResponse.trigger_unit);
	const data = getTriggerUnitData(objTriggerUnit);

	const objResponseUnit = await getJointFromStorageOrHub(objResponse.response_unit);
	const depositAaAddress = objInfos.deposits_aa;
	const interest_asset = objInfos.asset_2;
	const stable_asset = objInfos.stable_asset;

	const stable_amount_from_aa =  getAmountFromAa(objResponseUnit, depositAaAddress, stable_asset);

	const interest_amount_to_aa = getAmountToAa(objTriggerUnit, depositAaAddress, interest_asset);
	const interest_amount_from_aa =  getAmountFromAa(objResponseUnit, depositAaAddress, interest_asset);

	const timestamp = objResponseUnit ? new Date(objResponseUnit.timestamp * 1000).toISOString() : null;

	const depositAaVars = process.env.reprocess ? {} : await dag.readAAStateVars(depositAaAddress); // we don't refresh supply when reprocessing
	const supply = depositAaVars.supply;


	if (objResponse.response.responseVars && objResponse.response.responseVars.id){

		await db.query("REPLACE INTO trades (response_unit, base, quote, base_qty, quote_qty, type, timestamp) VALUES (?,?,?,?,?,?,?)", 
		[objResponse.response_unit, stable_asset, interest_asset, stable_amount_from_aa, interest_amount_to_aa, 'buy', timestamp]);
		await saveSupplyForAsset(stable_asset, supply); // only stable asset supply change, interest asset are only locked
		return api.refreshMarket(stable_asset, interest_asset);
	
	} 

	var stable_amount_to_aa = getAmountToAa(objTriggerUnit, depositAaAddress, stable_asset);

	if (stable_amount_to_aa > 0 && data.id){
		if (interest_amount_from_aa > 0){
			await db.query("REPLACE INTO trades (response_unit, base, quote, base_qty, quote_qty, type, timestamp) VALUES (?,?,?,?,?,?,?)", 
			[objResponse.response_unit, stable_asset,interest_asset, stable_amount_to_aa - stable_amount_from_aa, interest_amount_from_aa, 'sell', timestamp]);
			await saveSupplyForAsset(stable_asset, supply); 
			return api.refreshMarket(stable_asset, interest_asset);
		} 
	}

	if (data.commit_force_close && typeof data.id == "string" && !stable_amount_to_aa){
	//	const rows = await db.query("SELECT response_unit FROM aa_responses WHERE trigger_unit=? AND aa_address=?", [data.id, depositAaAddress])
	//	if (!rows[0])
	//		return console.log("deposit response unit not found")
	//	const depositResponseUnit = await await getJointFromStorageOrHub(rows[0].response_unit);
	//	if (!depositResponseUnit)
	//		throw Error('trigger unit not found ' + data.id);
	//	stable_amount_to_aa = getAmountFromAa(depositResponseUnit, depositAaAddress, stable_asset);  // the amount to AA is the same as the amount that was initially minted
		const curveAaVars = await dag.readAAStateVars(objInfos.curve_aa);
		const term = (objResponseUnit.timestamp - curveAaVars.rate_update_ts) / (360 * 24 * 3600); // in years
		const growth_factor = curveAaVars.growth_factor * (1 + curveAaVars.interest_rate) ** term;
		stable_amount_to_aa = Math.round(interest_amount_from_aa * growth_factor);
		await db.query("REPLACE INTO trades (response_unit, base, quote, base_qty, quote_qty, type, timestamp) VALUES (?,?,?,?,?,?,?)", 
		[objResponse.response_unit, stable_asset, interest_asset, stable_amount_to_aa , interest_amount_from_aa, 'sell', timestamp]);
		await saveSupplyForAsset(stable_asset, supply);
		return api.refreshMarket(stable_asset, interest_asset);
	}
	
}

async function treatResponseFromStableAA(objResponse, objInfos){

	if (!objResponse.response_unit)
		return;
	const objTriggerUnit = await storage.readUnit(objResponse.trigger_unit);
	if (!objTriggerUnit)
		throw Error('trigger unit not found ' + objResponse.trigger_unit);
	const data = getTriggerUnitData(objTriggerUnit);

	const objResponseUnit = await getJointFromStorageOrHub(objResponse.response_unit);
	const stableAaAddress = objResponse.aa_address;
	const interest_asset = objInfos.asset_2;
	const stable_asset = objInfos.stable_asset;

	const stable_amount_from_aa =  getAmountFromAa(objResponseUnit, stableAaAddress, stable_asset);

	const interest_amount_to_aa = getAmountToAa(objTriggerUnit, stableAaAddress, interest_asset);
	const interest_amount_from_aa =  getAmountFromAa(objResponseUnit, stableAaAddress, interest_asset);

	const timestamp = objResponseUnit ? new Date(objResponseUnit.timestamp * 1000).toISOString() : null;

	const stableAaVars = process.env.reprocess ? {} : await dag.readAAStateVars(stableAaAddress); // we don't refresh supply when reprocessing
	const supply = stableAaVars.supply;

	// interest -> stable
	if (interest_amount_to_aa > 0 && stable_amount_from_aa > 0){

		await db.query("REPLACE INTO trades (response_unit, base, quote, base_qty, quote_qty, type, timestamp) VALUES (?,?,?,?,?,?,?)", 
		[objResponse.response_unit, stable_asset, interest_asset, stable_amount_from_aa, interest_amount_to_aa, 'buy', timestamp]);
		await saveSupplyForAsset(stable_asset, supply); // only stable asset supply changes, interest asset is only locked
		return api.refreshMarket(stable_asset, interest_asset);
	
	} 

	// stable -> interest
	var stable_amount_to_aa = getAmountToAa(objTriggerUnit, stableAaAddress, stable_asset);
	if (stable_amount_to_aa > 0 && interest_amount_from_aa > 0){
		if (interest_amount_from_aa > 0){
			await db.query("REPLACE INTO trades (response_unit, base, quote, base_qty, quote_qty, type, timestamp) VALUES (?,?,?,?,?,?,?)", 
			[objResponse.response_unit, stable_asset, interest_asset, stable_amount_to_aa, interest_amount_from_aa, 'sell', timestamp]);
			await saveSupplyForAsset(stable_asset, supply); 
			return api.refreshMarket(stable_asset, interest_asset);
		} 
	}

	
}

async function treatResponseFromCurveAA(objResponse, objInfos){

	if (!objResponse.response_unit)
		return console.log("no response");
	
	if (objResponse.response.responseVars && objResponse.response.responseVars.p2){

		const objTriggerUnit = await getJointFromStorageOrHub(objResponse.trigger_unit);
	
		const curveAaAddress = objInfos.address;
		const reserve_asset = objInfos.reserve_asset;
		const asset1 = objInfos.asset_1;
		const asset2 = objInfos.asset_2;

		const objResponseUnit = await getJointFromStorageOrHub(objResponse.response_unit);

		const timestamp = new Date(objResponseUnit.timestamp * 1000).toISOString();
		const reserve_added = getAmountToAa(objTriggerUnit, curveAaAddress, reserve_asset) - getAmountFromAa(objResponseUnit, curveAaAddress, reserve_asset); // can be negative
		const asset1_added = getAmountFromAa(objResponseUnit, curveAaAddress, asset1) - getAmountToAa(objTriggerUnit, curveAaAddress, asset1); // can be negative
		const asset2_added = getAmountFromAa(objResponseUnit, curveAaAddress, asset2) - getAmountToAa(objTriggerUnit, curveAaAddress, asset2); // can be negative
	
		const reserveTradedForAsset2 = asset1_added !== 0 ? (objResponse.response.responseVars.p2 * 10 ** (objInfos.reserve_decimals - objInfos.asset_2_decimals) * asset2_added) : reserve_added;
		const reserveTradedForAsset1 = reserve_added - reserveTradedForAsset2;

		const curveAaVars =  process.env.reprocess ? {} : await dag.readAAStateVars(curveAaAddress);
		const supply1 = curveAaVars.supply1;
		const supply2 = curveAaVars.supply2;

		if (asset1_added != 0){
			await db.query("REPLACE INTO trades (response_unit, base, quote, base_qty, quote_qty, type, timestamp) VALUES (?,?,?,?,?,?,?)", 
			[objResponse.response_unit, asset1, reserve_asset, Math.abs(asset1_added),  Math.abs(reserveTradedForAsset1), asset1_added > 0 ? 'buy' : 'sell', timestamp]);
			await saveSupplyForAsset(asset1, supply1);
			api.refreshMarket(asset1, reserve_asset);
		}
		if (asset2_added != 0){
			await db.query("REPLACE INTO trades (response_unit, base, quote, base_qty, quote_qty, type, indice, timestamp) VALUES (?,?,?,?,?,?,1,?)", 
			[objResponse.response_unit, asset2, reserve_asset, Math.abs(asset2_added),  Math.abs(reserveTradedForAsset2), asset2_added > 0 ? 'buy' : 'sell', timestamp]);
			await saveSupplyForAsset(asset2, supply2);
			api.refreshMarket(asset2, reserve_asset);
		}
	}

}


eventBus.on('aa_response', onAaResponse);

async function onAaResponse(objResponse){
	if(objResponse.response.error)
		return console.log('ignored response with error: ' + objResponse.response.error);
	const aa_address = objResponse.aa_address;

	var rows = await db.query("SELECT * FROM curve_aas WHERE address=?",[aa_address]);
	if (rows[0])
		return treatResponseFromCurveAA(objResponse, rows[0]);

	rows = await db.query("SELECT deposits_aas.address AS deposits_aa, curve_aa, * FROM deposits_aas \n\
	INNER JOIN curve_aas ON deposits_aas.curve_aa=curve_aas.address WHERE deposits_aas.address=?",[aa_address]);
	if (rows[0])
		return treatResponseFromDepositsAA(objResponse, rows[0]);

	rows = await db.query("SELECT stable_aas.address AS stable_aa, curve_aa, * FROM stable_aas \n\
	INNER JOIN curve_aas ON stable_aas.curve_aa=curve_aas.address WHERE stable_aas.address=?",[aa_address]);
	if (rows[0])
		return treatResponseFromStableAA(objResponse, rows[0]);

}


function getAmountFromAa(objResponseUnit, aa_address, asset = 'base'){
	if (!objResponseUnit)
		return 0;
	let amount = 0;
	objResponseUnit.messages.forEach(function (message){
		if (message.app !== 'payment')
			return;
		const payload = message.payload;
		if (asset == 'base' && payload.asset || asset != 'base' && asset !== payload.asset)
			return;
		payload.outputs.forEach(function (output){
			if (output.address !== aa_address) {
				amount += output.amount; 
			} 
		});
	});
	return amount;
}


function getAmountToAa(objTriggerUnit, aa_address, asset = 'base'){

	if (!objTriggerUnit)
		return 0;
	let amount = 0;
	objTriggerUnit.messages.forEach(function (message){
		if (message.app !== 'payment')
			return;
		const payload = message.payload;
		if (asset == 'base' && payload.asset || asset != 'base' && asset !== payload.asset)
			return;
		payload.outputs.forEach(function (output){
			if (output.address === aa_address) {
				amount += output.amount; // in case there are several outputs
			}
		});
	});
	return amount;
}

function getTriggerUnitData(objTriggerUnit){
	for (var i=0; i < objTriggerUnit.messages.length; i++)
	if (objTriggerUnit.messages[i].app === 'data') // AA considers only the first data message
		return objTriggerUnit.messages[i].payload;
	return {};
}

function replaceConsoleLog(){
	var clog = console.log;
	console.log = function(){
		Array.prototype.unshift.call(arguments, new Date().toISOString()+':');
		clog.apply(null, arguments);
	}
}


async function start(){
	replaceConsoleLog();
	await sqlite_tables.create();
	await lookForExistingStablecoins();
	
	if (process.env.reprocess){
		await reprocessTrades();
		console.log("All trades reprocessed");
		process.exit();
	}
	addLightWatchedAas();
	api.start();
	lightWallet.refreshLightClientHistory();
	eventBus.on('connected', addLightWatchedAas)
}

async function reprocessTrades(){
	const rows = await db.query("SELECT response,trigger_unit,response_unit,aa_address FROM aa_responses ORDER BY aa_response_id ASC; ");
	for (var i=0; i<rows.length; i++){
		rows[i].response = JSON.parse(rows[i].response);
		console.log('reprocess ' + rows[i].trigger_unit);
		await onAaResponse(rows[i]);
	}
}

async function addLightWatchedAas(){
	conf.curve_base_aas.forEach(function(curve_base_aa){
		network.addLightWatchedAa(curve_base_aa, null, console.log);
	});
	network.addLightWatchedAa(conf.deposit_base_aa, null, console.log);
	network.addLightWatchedAa(conf.stable_base_aa, null, console.log);
	network.addLightWatchedAa(conf.token_registry_aa_address, null, console.log);
}

async function lookForExistingStablecoins(){
	await discoverCurveAas();
	await discoverDepositAas();
	await discoverStableAas();
}


async function discoverDepositAas() {
	const arrResponse = await dag.getAAsByBaseAAs(conf.deposit_base_aa);
	const allAaAddresses = arrResponse.map(obj => obj.address);
	const rows = await db.query("SELECT address FROM deposits_aas WHERE address IN("+ allAaAddresses.map(db.escape).join(',')+")");
	const knownAaAddresses = rows.map(obj => obj.address);
	const newDepositAas = arrResponse.filter(obj => !knownAaAddresses.includes(obj.address))
	await Promise.all(newDepositAas.map(saveAndwatchDepositsAa));
}

async function saveAndwatchDepositsAa(objAa){
	await saveDepositsAa(objAa);
	walletGeneral.addWatchedAddress(objAa.address);
}


async function saveDepositsAa(objAa) {
	const depositsAaAddress = objAa.address;
	const curveAaAddress = objAa.definition[1].params.curve_aa;
	const vars = await dag.readAAStateVars(depositsAaAddress);
	const asset = vars['asset'];
	if (!asset)
		throw Error(`no asset on deposit AA ${depositsAaAddress}`);
	await db.query("INSERT " + db.getIgnore() + " INTO deposits_aas (address, stable_asset, curve_aa) VALUES (?,?,?)", [depositsAaAddress, asset, curveAaAddress]);
	await saveSymbolForAsset(asset);
}


async function discoverStableAas() {
	const arrResponse = await dag.getAAsByBaseAAs(conf.stable_base_aa);
	const allAaAddresses = arrResponse.map(obj => obj.address);
	const rows = await db.query("SELECT address FROM stable_aas WHERE address IN("+ allAaAddresses.map(db.escape).join(',')+")");
	const knownAaAddresses = rows.map(obj => obj.address);
	const newStableAas = arrResponse.filter(obj => !knownAaAddresses.includes(obj.address))
	await Promise.all(newStableAas.map(saveAndWatchStableAa));
}

async function saveAndWatchStableAa(objAa){
	await saveStableAa(objAa);
	walletGeneral.addWatchedAddress(objAa.address);
}


async function saveStableAa(objAa) {
	const stableAaAddress = objAa.address;
	const curveAaAddress = objAa.definition[1].params.curve_aa;
	const vars = await dag.readAAStateVars(stableAaAddress);
	const asset = vars['asset'];
	if (!asset) {
		console.log("no asset var for " + stableAaAddress + ", will retry");
		await wait(1000);
		return await saveStableAa(objAa);
	}
	await db.query("INSERT " + db.getIgnore() + " INTO stable_aas (address, stable_asset, curve_aa) VALUES (?,?,?)", [stableAaAddress, asset, curveAaAddress]);
	await saveSymbolForAsset(asset);
}



async function discoverCurveAas(){
	const arrResponse = await dag.getAAsByBaseAAs(conf.curve_base_aas);
	const allAaAddresses = arrResponse.map(obj => obj.address);
	const rows = await db.query("SELECT address FROM curve_aas WHERE address IN("+ allAaAddresses.map(db.escape).join(',')+")");
	const knownAaAddresses = rows.map(obj => obj.address);
	const newCurveAas = arrResponse.filter(obj => !knownAaAddresses.includes(obj.address))
	await Promise.all(newCurveAas.map(saveAndwatchCurveAa));
}

async function saveAndwatchCurveAa(objAa){
	await saveCurveAa(objAa);
	walletGeneral.addWatchedAddress(objAa.address);
}

async function saveSupplyForAsset(asset, supply){
	if (!supply)
		return console.log("unknown supply for " + asset);
	await db.query("REPLACE INTO supplies (supply,asset) VALUES (?,?)", [supply, asset]);
}


async function saveSymbolForAsset(asset){
	var symbol,decimals, description;
	if (asset !== 'base'){
		var registryVars = await getStateVarsForPrefixes(conf.token_registry_aa_address, [
			'a2s_' + asset, 
			'current_desc_' + asset
		]);
		const current_desc = registryVars['current_desc_' + asset];
		registryVars = Object.assign(registryVars, await getStateVarsForPrefixes(conf.token_registry_aa_address, ['decimals_' + current_desc, 'desc_' + current_desc]));
		symbol = registryVars['a2s_' + asset];
		decimals = registryVars['decimals_' + current_desc];
		description = registryVars['desc_' + current_desc];
		if (!symbol || typeof decimals !== "number"){
			console.log('asset ' + asset + ' not found in registry');
			symbol = asset;
			decimals = 0;
			description = "This asset isn't registered";
		}
	} else {
		symbol = 'GBYTE';
		decimals = 9;
		description = 'Obyte DAG native currency';
	};

	await db.query("REPLACE INTO bonded_assets (asset, symbol, decimals, description) VALUES (?,?,?,?)", [asset, symbol, decimals, description]);
}

async function refreshSymbols(){
	const rows = await db.query(`
		SELECT stable_asset AS asset FROM deposits_aas
		UNION
		SELECT stable_asset AS asset FROM stable_aas
		UNION
		SELECT DISTINCT reserve_asset AS asset FROM curve_aas
		UNION
		SELECT asset_1 AS asset FROM curve_aas
		UNION
		SELECT asset_2 AS asset FROM curve_aas
	`);
	for (var i=0; i < rows.length; i++)
		await saveSymbolForAsset(rows[i].asset);
	api.initMarkets();
}



async function saveCurveAa(objAa) {
	const curveAaAddress = objAa.address;
	const reserve_asset = objAa.definition[1].params.reserve_asset;
	const asset1Decimals = objAa.definition[1].params.decimals1;
	const asset2Decimals = objAa.definition[1].params.decimals2;
	const reserveDecimals = objAa.definition[1].params.reserve_asset_decimals;
	const curveAaVars = await dag.readAAStateVars(curveAaAddress);
	const asset1 = curveAaVars.asset1;
	const asset2 = curveAaVars.asset2;

	if (!asset1 || !asset2)
		throw Error(`no assets on curve AA ${curveAaAddress}`);
	await db.query("INSERT " + db.getIgnore() + " INTO curve_aas (address, asset_1, asset_2, reserve_asset, asset_1_decimals, asset_2_decimals,reserve_decimals) \n\
	VALUES (?,?,?,?,?,?,?)", 
	[curveAaAddress, asset1, asset2, reserve_asset, asset1Decimals, asset2Decimals, reserveDecimals]);
	await Promise.all([saveSymbolForAsset(reserve_asset), saveSymbolForAsset(asset1), saveSymbolForAsset(asset2)]);
}

function handleJustsaying(ws, subject, body) {
	switch (subject) {
		case 'light/aa_definition_saved':
			onAADefinition(body);
			break;

		case 'light/aa_response':
			if (body.aa_address == conf.token_registry_aa_address)
				refreshSymbols();
			break;
			
		case 'light/have_updates':
			lightWallet.refreshLightClientHistory();
			break;
	}
}

eventBus.on("message_for_light", handleJustsaying);

function onAADefinition(objUnit){

	for (var i=0; i<objUnit.messages.length; i++){
		var message = objUnit.messages[i];
		var payload = message.payload;
		if (message.app === 'definition' && payload.definition[1].base_aa){
			const base_aa = payload.definition[1].base_aa;
			if (base_aa == conf.deposit_base_aa)
				saveAndwatchDepositsAa({ address: objectHash.getChash160(payload.definition), definition: payload.definition });
			if (base_aa == conf.stable_base_aa)
				saveAndWatchStableAa({ address: objectHash.getChash160(payload.definition), definition: payload.definition });
			if (conf.curve_base_aas.indexOf(base_aa) > -1){
				const address = objectHash.getChash160(payload.definition);
				const definition = payload.definition;
				saveAndwatchCurveAa({ address, definition });
			}
		}
	}
}


function getStateVarsForPrefixes(aa_address, arrPrefixes){
	return new Promise(function(resolve){
		Promise.all(arrPrefixes.map((prefix)=>{
			return dag.readAAStateVars(aa_address, prefix)
		})).then((arrResults)=>{
			return resolve(Object.assign({}, ...arrResults));
		}).catch((error)=>{
			return resolve({});
		});
	});
}


function getJointFromStorageOrHub(unit){
	return new Promise(async (resolve, reject) => {

		var objUnit = await storage.readUnit(unit);
		if (objUnit)
			return resolve(objUnit);
		if (!conf.bLight)
			return reject(`unit not found: ${unit}`);
		const network = require('ocore/network.js');
		network.requestFromLightVendor('get_joint', unit,  function(ws, request, response){
			if (response.joint){
				resolve(response.joint.unit)
			} else {
				reject(`unit not found: ${unit}`);
			}
		});
	});
}

async function wait(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

process.on('unhandledRejection', up => { throw up });