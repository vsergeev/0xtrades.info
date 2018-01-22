/*
 * 0xtrades.info
 * https://github.com/vsergeev/0xtrades.info
 *
 * Copyright (c) 2017-2018 Ivan (Vanya) A. Sergeev
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

import * as bootstrap from 'bootstrap';

import * as Web3 from 'web3';
import {Web3Provider} from '0x.js';

import * as Logger from "./logger";
import * as Model from "./model";
import * as View from "./view";
import * as Controller from "./controller";
import * as Constants from "./constants";

/******************************************************************************/
/* Injected Web3 */
/******************************************************************************/

/* Declare the potential existence of an injected web3 */
declare global {
    interface Window {
        web3: Web3 | undefined;
    }
}

/******************************************************************************/
/* Provider Engine Wrapper */
/******************************************************************************/

import * as Web3ProviderEngine from "web3-provider-engine";
import * as FilterSubprovider from "web3-provider-engine/subproviders/filters";
import * as FetchSubprovider from "web3-provider-engine/subproviders/fetch";

interface ZeroClientProviderOptions {
    getAccounts?: (error: any, accounts?: Array<string>) => void
    rpcUrl?: string;
}

function ZeroClientProvider(opts?: ZeroClientProviderOptions) {
  opts = opts || {rpcUrl: undefined};

  const engine = new Web3ProviderEngine();

  const filterSubprovider = new FilterSubprovider();
  engine.addProvider(filterSubprovider);

  const fetchSubprovider = new FetchSubprovider({rpcUrl: opts.rpcUrl});
  engine.addProvider(fetchSubprovider);

  engine.start();

  return engine;
}

/******************************************************************************/
/* Top-level */
/******************************************************************************/

/*** Parameters ***/

let params: URLSearchParams = new URLSearchParams(window.location.search);

/* Look up debug mode, currency, web3 provider */
let paramDebug: boolean = params.has("debug");
let paramCurrency: string = params.get("cur") || Constants.FIAT_CURRENCY_DEFAULT;
let paramProvider: string = params.get("provider") || (typeof window.web3 !== 'undefined') ? 'current' : 'infura';

/*** Logging ***/

if (paramDebug)
    Logger.enable();
else
    Logger.disable();

/* Log parameters */
Logger.log('[App] Parameter debug: ' + paramDebug);
Logger.log('[App] Parameter cur: ' + paramDebug);
Logger.log('[App] Parameter provider:' + paramProvider);

/*** Currency ***/

let fiatCurrencyInfo: Constants.CurrencyInfo;

fiatCurrencyInfo = Constants.FIAT_CURRENCY_MAP[paramCurrency] || Constants.FIAT_CURRENCY_MAP[Constants.FIAT_CURRENCY_DEFAULT];

/*** Web3 ***/

let web3: Web3;

if (paramProvider == 'current')
    web3 = new Web3(window.web3!.currentProvider);
else if (paramProvider  == 'localhost')
    web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
else
    web3 = new Web3(ZeroClientProvider({getAccounts: (cb) => { cb(null, []); }, rpcUrl: Constants.INFURA_API_URL}));

/*** MVC ***/

let model = new Model.Model(web3, fiatCurrencyInfo);
let view = new View.View(web3, fiatCurrencyInfo);
let controller = new Controller.Controller(model, view);

controller.init();
