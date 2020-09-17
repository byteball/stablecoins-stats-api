"use strict";
const path = require('path');
require('dotenv').config({ path: path.dirname(process.mainModule.paths[0]) + '/.env' });

exports.bServeAsHub = false;
exports.bLight = true;

exports.apiPort = process.env.testnet ? 4001 : 4000;

exports.hub = process.env.testnet ? 'obyte.org/bb-test' : 'obyte.org/bb';
exports.explorer_base_url = process.env.testnet ? 'https://testnetexplorer.obyte.org/#' : 'https://explorer.obyte.org/#';
exports.stablecoins_base_url = process.env.testnet ? 'https://stable.twoogi.ru/trade/' : 'https://explorer.obyte.org/#';

exports.curve_base_aa = process.env.testnet ? "ZQENBYPGFZM2DYFM3OJAONMXC7UOVD4W" : "ZQENBYPGFZM2DYFM3OJAONMXC7UOVD4W";
exports.deposit_base_aa = process.env.testnet ? "X7FWWFNENQP5VN77JTAZQ7DTCHZEYXEQ" : "X7FWWFNENQP5VN77JTAZQ7DTCHZEYXEQ";
exports.token_registry_aa_address = process.env.testnet ? "O6H6ZIFI57X3PLTYHOCVYPP5A553CYFQ" : "O6H6ZIFI57X3PLTYHOCVYPP5A553CYFQ";

console.log('finished server conf');
