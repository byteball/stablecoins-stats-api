"use strict";
const path = require('path');
require('dotenv').config({ path: path.dirname(process.mainModule.paths[0]) + '/.env' });

exports.bServeAsHub = false;
exports.bLight = true;
exports.bNoPassphrase = true;
exports.explicitStart = true;

exports.apiPort = process.env.testnet ? 4001 : 4000;

exports.hub = process.env.testnet ? 'obyte.org/bb-test' : 'obyte.org/bb';
exports.explorer_base_url = process.env.testnet ? 'https://testnetexplorer.obyte.org/#' : 'https://explorer.obyte.org/#';

exports.curve_base_aas = process.env.testnet ? 
["FCFYMFIOGS363RLDLEWIDBIIBU7M7BHP", "3RNNDX57C36E76JLG2KAQSIASAYVGAYG", "STA7KVV77IHZ3S34YAFZAIKUGPIK4EZ7"]
: 
["FCFYMFIOGS363RLDLEWIDBIIBU7M7BHP", "3RNNDX57C36E76JLG2KAQSIASAYVGAYG", "STA7KVV77IHZ3S34YAFZAIKUGPIK4EZ7"];
exports.deposit_base_aa = process.env.testnet ? "GEZGVY4T3LK6N4NJAKNHNQIVAI5OYHPC" : "GEZGVY4T3LK6N4NJAKNHNQIVAI5OYHPC";
exports.stable_base_aa = "YXPLX6Q3HBBSH2K5HLYM45W7P7HFSEIN";
exports.fund_base_aa = "5WOTEURNL2XGGKD2FGM5HEES4NKVCBCR";

exports.token_registry_aa_address = process.env.testnet ? "O6H6ZIFI57X3PLTYHOCVYPP5A553CYFQ" : "O6H6ZIFI57X3PLTYHOCVYPP5A553CYFQ";

console.log('finished server conf');