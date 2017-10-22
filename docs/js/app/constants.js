/*
 * 0xtrades.info
 * https://github.com/vsergeev/0xtrades.info
 *
 * Copyright (c) 2017 Ivan (Vanya) A. Sergeev
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

/******************************************************************************/
/* Constants */
/******************************************************************************/

var ZEROEX_GENESIS_BLOCK = {
  1: 4145578,
  42: 4145578,
};

var ZEROEX_RELAY_ADDRESSES = {
  1: {
    "0xa258b39954cef5cb142fd567a46cddb31a670124": "Radar Relay",
    "0xeb71bad396acaa128aeadbc7dbd59ca32263de01": "Kin Alpha",
    "0xc22d5b2951db72b44cfb8089bb8cd374a3c354ea": "OpenRelay",
  },
  42: {
    "0xa258b39954cef5cb142fd567a46cddb31a670124": "Radar Relay",
  },
};

/* Populated by model */
var ZEROEX_TOKEN_INFOS = {
    /* Pre-load some newer token infos */
    "0x8f8221afbb33998d8584a2b05749ba73c37a938a": {
      name: "Request",
      symbol: "REQ",
      decimals: 18,
    },
    "0xd4fa1460f537bb9085d22c7bccb5dd450ef28e3a": {
      name: "Populous Platform",
      symbol: "PPT",
      decimals: 8,
    },
    "0xab16e0d25c06cb376259cc18c1de4aca57605589": {
      name: "FinallyUsableCryptoKarma",
      symbol: "FUCK",
      decimals: 4,
    },
    "0x0e0989b1f9b8a38983c2ba8053269ca62ec9b195": {
      name: "Po.et",
      symbol: "POE",
      decimals: 8,
    },
    "0x8ae4bf2c33a8e667de34b54938b0ccd03eb8cc06": {
      name: "Patientory",
      symbol: "PTOY",
      decimals: 8,
    },
};

/* Populated by model */
var ZEROEX_EXCHANGE_ADDRESS = null;

/* Populated by model */
var ZEROEX_TOKEN_ADDRESS = null;

var NETWORK_NAME = {
  1: "Mainnet",
  3: "Ropsten",
  4: "Rinkeby",
  42: "Kovan",
};

var NETWORK_BLOCK_EXPLORER = {
  1: "https://etherscan.io",
  3: "https://ropsten.etherscan.io",
  4: "https://rinkeby.etherscan.io",
  42: "https://kovan.etherscan.io",
};

var PRICE_API_URL = function (symbols, base) {
  return "https://min-api.cryptocompare.com/data/pricemulti?fsyms=" + symbols.join(',') + "&tsyms=" + base;
};

var INFURA_API_URL = "https://mainnet.infura.io/rdkuEWbeKAjSR9jZ6P1h";

var STATISTICS_TIME_WINDOW = 86400; /* 24 hours */

var BLOCK_FETCH_COUNT = Math.ceil(STATISTICS_TIME_WINDOW/17);

var BLOCK_INFO_RETRY_TIMEOUT = 15*1000;

var PRICE_UPDATE_TIMEOUT = 5*60*1000;

var PRICE_CHART_DEFAULT_PAIR = "ZRX/WETH";

var CHART_DEFAULT_COLORS = ['#1f77b4', '#aec7e8', '#ff7f0e', '#ffbb78', '#2ca02c', '#98df8a',
                            '#d62728', '#ff9896', '#9467bd', '#c5b0d5', '#8c564b', '#c49c94',
                            '#e377c2', '#f7b6d2', '#7f7f7f', '#c7c7c7', '#bcbd22', '#dbdb8d',
                            '#17becf', '#9edae5'];

var CHART_DEFAULT_TOOLTIP_CALLBACK = function (item, data) {
  var label = data.labels[item.index];
  var value = data.datasets[item.datasetIndex].tooltips[item.index] || data.datasets[item.datasetIndex].data[item.index];
  return label + ": " + value;
};

/* From http://www.localeplanet.com/api/auto/currencymap.json */
var FIAT_CURRENCY_MAP = {
  "USD": {
    "symbol": "$",
    "symbol_native": "$",
    "decimal_digits": 2,
    "rounding": 0,
    "code": "USD"
  },
  "EUR": {
    "symbol": "€",
    "symbol_native": "€",
    "decimal_digits": 2,
    "rounding": 0,
    "code": "EUR"
  },
  "GBP": {
    "symbol": "£",
    "symbol_native": "£",
    "decimal_digits": 2,
    "rounding": 0,
    "code": "GBP"
  },
  "JPY": {
    "symbol": "¥",
    "symbol_native": "￥",
    "decimal_digits": 0,
    "rounding": 0,
    "code": "JPY"
  },
  "KRW": {
    "symbol": "₩",
    "symbol_native": "₩",
    "decimal_digits": 0,
    "rounding": 0,
    "code": "KRW"
  },
};

var FIAT_CURRENCY_DEFAULT = "USD";

/******************************************************************************/
/* Logger */
/******************************************************************************/

Logger = {
  enable: function () { Logger.log = Logger._log_console; },
  disable: function () { Logger.log = Logger._log_null; },

  _log_console: console.log.bind(window.console),
  _log_null: function (s) { },

  log: null,
  error: console.error.bind(window.console),
};
