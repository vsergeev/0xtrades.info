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
  },
  42: {},
};

var ZEROEX_TOKEN_INFOS = {};

var ZEROEX_EXCHANGE_ADDRESS = null;

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

var PRICE_UPDATE_TIMEOUT = 5*60*1000;

var PRICE_CHART_DEFAULT_PAIR = "ZRX:WETH";

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
/* Price/Volume History */
/******************************************************************************/

var PriceVolumeHistory = function () {
  /* State */
  this.tokens = [];
  this._priceData = {};
  this._volumeData = {};
  this._timestamps = {};
};

PriceVolumeHistory.prototype = {
  /* Insert price data */
  insert: function (maker, taker, timestamp, mtPrice, tmPrice, makerVolume, takerVolume) {
    /* Initialize data structures */
    this._initialize(maker, taker);
    this._initialize(taker, maker);

    /* Find index for this data */
    var index = 0;
    for (index = 0; index < this._timestamps[maker][taker].length; index++) {
      if (this._timestamps[maker][taker][index] > timestamp)
        break;
    }

    /* Create date object */
    var date = new Date(timestamp*1000);

    /* Save the timestamp and prices */
    this._timestamps[maker][taker].splice(index, 0, timestamp);
    this._timestamps[taker][maker].splice(index, 0, timestamp);
    this._priceData[maker][taker].splice(index, 0, {x: date, y: mtPrice});
    this._priceData[taker][maker].splice(index, 0, {x: date, y: tmPrice});
    this._volumeData[maker][taker].splice(index, 0, {x: date, y: takerVolume});
    this._volumeData[taker][maker].splice(index, 0, {x: date, y: makerVolume});
  },

  /* Get price data for a token pair */
  getPriceData: function (tokenPair) {
    var [quote, base] = tokenPair.split(":");

    if (this._priceData[base] && this._priceData[base][quote])
      return this._priceData[base][quote];

    return [];
  },

  /* Get volume data for a token pair */
  getVolumeData: function (tokenPair) {
    var [quote, base] = tokenPair.split(":");

    if (this._volumeData[base] && this._volumeData[base][quote])
      return this._volumeData[base][quote];

    return [];
  },

  /* Prune old data outside of statistics window */
  prune: function () {
    var currentTimestamp = Math.round((new Date()).getTime() / 1000);
    var cutoffTimestamp = currentTimestamp - STATISTICS_TIME_WINDOW;

    var pruned = false;

    for (var maker in this._timestamps) {
      for (var taker in this._timestamps) {
        while (this._timestamps[maker][taker] && this._timestamps[maker][taker][0] < cutoffTimestamp) {
          this._timestamps[maker][taker].shift();
          this._timestamps[taker][maker].shift();
          this._priceData[maker][taker].shift();
          this._priceData[taker][maker].shift();
          this._volumeData[maker][taker].shift();
          this._volumeData[taker][maker].shift();
          pruned = true;
        }
      }
    }

    return pruned;
  },

  /* Initialize state for maker/taker tokens a and b */
  _initialize: function (a, b) {
    if (this._priceData[a] === undefined) {
      this._priceData[a] = {};
      this._volumeData[a] = {};
      this._timestamps[a] = {};
    }
    if (this._priceData[a][b] === undefined) {
      this._priceData[a][b] = [];
      this._volumeData[a][b] = [];
      this._timestamps[a][b] = [];
      this.tokens.push(a + ":" + b);
      this.tokens.sort();
    }
  },
};

/******************************************************************************/
/* Model */
/******************************************************************************/

var Model = function (web3, fiatCurrency) {
  /* web3 interface */
  this._web3 = web3;
  this._zeroEx = new ZeroEx.ZeroEx(web3.currentProvider);

  /* Network status */
  this._networkId = null;
  this._blockHeight = null;

  /* Model State */
  this._trades = [];
  this._tradesSeen = {};
  this._initialFetchDone = false;

  /* Blockchain state */
  this._oldestBlockFetched = null;
  this._blockTimestamps = {};

  /* Price state */
  this._tokenPrices = {};
  this._fiatCurrency = FIAT_CURRENCY_MAP[fiatCurrency] ? fiatCurrency : FIAT_CURRENCY_DEFAULT;
  this._priceVolumeHistory = new PriceVolumeHistory();

  /* Callbacks */
  this.connectedCallback = null;
  this.newTradeCallback = null;
  this.statisticsUpdatedCallback = null;
};

Model.prototype = {
  init: function () {
    var self = this;

    /* Look up network id */
    self._web3.version.getNetwork(function (error, result) {
      if (error) {
        Logger.log('[Model] Error determining network version');
        Logger.error(error);
      } else {
        self._networkId = result;

        Logger.log('[Model] Network ID: ' + self._networkId);

        if (ZEROEX_GENESIS_BLOCK[self._networkId] == undefined) {
          Logger.log('[Model] Unsupported network id');

          self.connectedCallback(self._networkId, self._fiatCurrency, false);
        } else {
          self._web3.eth.getBlockNumber(function (error, result) {
            if (error) {
              Logger.log('[Model] Error determining block height');
              Logger.error(error);
            } else {
              self._blockHeight = result

              Logger.log('[Model] Block height: ' + self._blockHeight);

              /* Fetch exchange address */
              self._zeroEx.exchange.getContractAddressAsync().then(function (address) {
                ZEROEX_EXCHANGE_ADDRESS = address;

                self.connectedCallback(self._networkId, self._fiatCurrency, true);

                /* Fetch token registry */
                return self._zeroEx.tokenRegistry.getTokensAsync();
              }).then(function (tokens) {
                for (var i = 0; i < tokens.length; i++) {
                  ZEROEX_TOKEN_INFOS[tokens[i].address] = {
                    decimals: tokens[i].decimals,
                    name: tokens[i].name,
                    symbol: tokens[i].symbol
                  };

                  if (tokens[i].symbol == "ZRX")
                    ZEROEX_TOKEN_ADDRESS = tokens[i].address;
                }
              }).then(function () {
                /* Update prices */
                self.updatePrices();

                /* Subscribe to new fill logs */
                self._zeroEx.exchange.subscribeAsync("LogFill", {}, self.handleLogFillEvent.bind(self, null));

                /* Fetch past fill logs */
                self.fetchPastTradesDuration(STATISTICS_TIME_WINDOW).then(function () {
                  self._initialFetchDone = true;

                  /* Now, update the statistics */
                  self.updateStatistics();
                });
              });
            }
          });
        }
      }
    });
  },

  /* Blockchain helper functions */

  getBlockTimestamp: function (blockNumber) {
    var self = this;

    return new Promise(function (resolve, reject) {
      if (self._blockTimestamps[blockNumber]) {
        resolve(self._blockTimestamps[blockNumber]);
      } else {
        self._web3.eth.getBlock(blockNumber, function (error, result) {
          if (error) {
            reject(error);
          } else {
            self._blockTimestamps[blockNumber] = result.timestamp;
            resolve(result.timestamp);
          }
        });
      }
    });
  },

  /* Blockchain event handlers */

  handleLogFillEvent: function (error, result) {
    if (error) {
        Logger.error(error);
    } else {
        Logger.log('[Model] Got Log Fill event');

        /* If we've already processed this trade, skip it */
        if (this._tradesSeen[result.transactionHash + result.logIndex])
          return;

        var trade = {
          txid: result.transactionHash,
          blockNumber: web3.toDecimal(result.blockNumber),
          takerAddress: result.args.taker,
          makerAddress: result.args.maker,
          relayAddress: result.args.feeRecipient,
          takerToken: result.args.takerToken,
          makerToken: result.args.makerToken,
          makerVolume: result.args.filledMakerTokenAmount,
          takerVolume: result.args.filledTakerTokenAmount,
          makerFee: result.args.paidMakerFee,
          takerFee: result.args.paidTakerFee,
          orderHash: result.args.orderHash,
          mtPrice: null,
          tmPrice: null,
          makerNormalized: false,
          takerNormalized: false,
        };

        /* Normalize traded volueme and fee quantities */
        [trade.makerVolume, trade.makerNormalized] = this.normalizeQuantity(trade.makerToken, trade.makerVolume);
        [trade.takerVolume, trade.takerNormalized] = this.normalizeQuantity(trade.takerToken, trade.takerVolume);
        [trade.makerFee, ] = this.normalizeQuantity(ZEROEX_TOKEN_ADDRESS, trade.makerFee);
        [trade.takerFee, ] = this.normalizeQuantity(ZEROEX_TOKEN_ADDRESS, trade.takerFee);

        /* Compute prices */
        if (trade.makerNormalized && trade.takerNormalized) {
          trade.mtPrice = trade.makerVolume.div(trade.takerVolume);
          trade.tmPrice = trade.takerVolume.div(trade.makerVolume);
        } else if (trade.makerVolume.eq(trade.takerVolume)) {
          /* Special case of equal maker/take quantities doesn't require token
           * decimals */
          trade.mtPrice = new web3.BigNumber(1);
          trade.tmPrice = new web3.BigNumber(1);
        }

        /* Mark this trade as seen */
        this._tradesSeen[result.transactionHash + result.logIndex] = true;

        /* Fetch timestamp associated with this block */
        var self = this;
        this.getBlockTimestamp(trade.blockNumber).then(function (result) {
          trade.timestamp = result;

          /* Insert it in the right position in our trades */
          var index = 0;
          for (index = 0; index < self._trades.length; index++) {
            if (self._trades[index].timestamp < trade.timestamp)
              break;
          }
          self._trades.splice(index, 0, trade);

          /* Update our price history for this token pair */
          if (trade.makerNormalized && trade.takerNormalized) {
            self._priceVolumeHistory.insert(ZEROEX_TOKEN_INFOS[trade.makerToken].symbol,
                                            ZEROEX_TOKEN_INFOS[trade.takerToken].symbol,
                                            trade.timestamp,
                                            trade.mtPrice.toNumber(), trade.tmPrice.toNumber(),
                                            trade.makerVolume.toNumber(), trade.takerVolume.toNumber());
          }

          /* Call view callback */
          self.newTradeCallback(trade);

          /* Update statistics */
          self.updateStatistics();
        });
    }
  },

  /* Statistics update */

  updateStatistics: function () {
    /* Hold off on updating statistics until we've fetched initial trades */
    if (!this._initialFetchDone)
      return;

    Logger.log('[Model] Updating statistics');

    var currentTimestamp = Math.round((new Date()).getTime() / 1000);
    var cutoffTimestamp = currentTimestamp - STATISTICS_TIME_WINDOW;

    var feeStats = {totalFees: new web3.BigNumber(0), relays: {}, feeCount: 0, feelessCount: 0};
    var volumeStats = {totalTrades: 0, totalVolumeFiat: new web3.BigNumber(0), tokens: {}};

    for (var i = 0; i < this._trades.length; i++) {
      /* Process up to statistics time window trades */
      if (this._trades[i].timestamp < cutoffTimestamp)
        break;

      /*** Relay fee statistics ***/

      var relayAddress = this._trades[i].relayAddress;
      var relayFee = this._trades[i].makerFee.add(this._trades[i].takerFee);

      if (feeStats.relays[relayAddress] == undefined)
        feeStats.relays[relayAddress] = new web3.BigNumber(0);

      /* Fee per relay and total relay fees */
      feeStats.relays[relayAddress] = feeStats.relays[relayAddress].add(relayFee);
      feeStats.totalFees = feeStats.totalFees.add(relayFee);

      /* Fee vs Feeless trade count */
      if (!relayFee.eq(0))
        feeStats.feeCount += 1;
      else
        feeStats.feelessCount += 1;

      /*** Token volume and count statistics ***/

      var makerToken = this._trades[i].makerToken;
      var takerToken = this._trades[i].takerToken;
      var makerVolume = this._trades[i].makerVolume;
      var takerVolume = this._trades[i].takerVolume;
      var makerTokenSymbol = this._trades[i].makerNormalized ? ZEROEX_TOKEN_INFOS[makerToken].symbol : null;
      var takerTokenSymbol = this._trades[i].takerNormalized ? ZEROEX_TOKEN_INFOS[takerToken].symbol : null;

      if (volumeStats.tokens[makerToken] == undefined)
        volumeStats.tokens[makerToken] = {volume: new web3.BigNumber(0), volumeFiat: new web3.BigNumber(0), count: 0};
      if (volumeStats.tokens[takerToken] == undefined)
        volumeStats.tokens[takerToken] = {volume: new web3.BigNumber(0), volumeFiat: new web3.BigNumber(0), count: 0};

      /* Volume per token */
      volumeStats.tokens[makerToken].volume = volumeStats.tokens[makerToken].volume.add(makerVolume);
      volumeStats.tokens[takerToken].volume = volumeStats.tokens[takerToken].volume.add(takerVolume);

      /* Fiat volume per token */
      if (this._tokenPrices[makerTokenSymbol]) {
        var fiatMakerVolume = makerVolume.mul(this._tokenPrices[makerTokenSymbol]);
        volumeStats.tokens[makerToken].volumeFiat = volumeStats.tokens[makerToken].volumeFiat.add(fiatMakerVolume);
        volumeStats.totalVolumeFiat = volumeStats.totalVolumeFiat.add(fiatMakerVolume);
      }
      if (this._tokenPrices[takerTokenSymbol]) {
        var fiatTakerVolume = takerVolume.mul(this._tokenPrices[takerTokenSymbol]);
        volumeStats.tokens[takerToken].volumeFiat = volumeStats.tokens[takerToken].volumeFiat.add(fiatTakerVolume);
        volumeStats.totalVolumeFiat = volumeStats.totalVolumeFiat.add(fiatTakerVolume);
      }

      /* Trade count per token and total trades */
      volumeStats.tokens[makerToken].count += 1;
      volumeStats.tokens[takerToken].count += 1;
      volumeStats.totalTrades += 1;
    }

    /* Compute relay fees in fiat currency, if available */
    var zrxPrice = this._tokenPrices['ZRX'];
    feeStats.totalFeesFiat = zrxPrice ? feeStats.totalFees.mul(zrxPrice) : null;
    feeStats.fiatCurrency = this._fiatCurrency;

    /* Prune price/volume history */
    this._priceVolumeHistory.prune();

    /* Call view callback */
    this.statisticsUpdatedCallback(feeStats, volumeStats, this._priceVolumeHistory);
  },

  /* Update fiat token prices */

  updatePrices: function () {
    Logger.log('[Model] Fetching token prices');

    /* Collect all symbols from token registry */
    var symbols = ['ETH'];
    for (var key in ZEROEX_TOKEN_INFOS)
      symbols.push(ZEROEX_TOKEN_INFOS[key].symbol);

    var endpoint = PRICE_API_URL(symbols, this._fiatCurrency);

    var self = this;
    return $.getJSON(endpoint).then(function (prices) {
      Logger.log('[Model] Got token prices');
      Logger.log(prices);

      /* Extract prices */
      for (var token in prices)
        self._tokenPrices[token] = prices[token][self._fiatCurrency];

      /* Map WETH to ETH */
      self._tokenPrices['WETH'] = self._tokenPrices['ETH'];

      /* Update statistics */
      self.updateStatistics();

      /* Set up next update */
      setTimeout(self.updatePrices.bind(self), PRICE_UPDATE_TIMEOUT);
    }).catch(function () {
      Logger.error('[Model] Error fetching token prices');

      Logger.log('[Model] Retrying in half update timeout');
      setTimeout(self.updatePrices.bind(self), Math.floor(PRICE_UPDATE_TIMEOUT/2));
    });
  },

  /* Token quantity normalization helper function */

  normalizeQuantity: function (token, quantity) {
    if (ZEROEX_TOKEN_INFOS[token])
      return [quantity.div(10**ZEROEX_TOKEN_INFOS[token].decimals), true];
    else
      return [quantity, false];
  },

  /* Operations */

  fetchPastTrades: function (count) {
    if (this._oldestBlockFetched) {
      var fromBlock = this._oldestBlockFetched - count;
      var toBlock = this._oldestBlockFetched;
    } else {
      var fromBlock = this._blockHeight - count;
      var toBlock = 'latest';
    }

    Logger.log('[Model] Fetching ' + count + ' past logs from ' + fromBlock + ' to ' + toBlock);

    if (fromBlock < ZEROEX_GENESIS_BLOCK[this._networkId])
      fromBlock = ZEROEX_GENESIS_BLOCK[this._networkId];

    this._oldestBlockFetched = fromBlock;

    var self = this;
    return this._zeroEx.exchange.getLogsAsync("LogFill", {fromBlock: fromBlock, toBlock: toBlock}, {}).then(function (logs) {
      for (var i = 0; i < logs.length; i++) {
        self.handleLogFillEvent(null, logs[i]);
      }
    });
  },

  fetchPastTradesDuration: function (duration) {
    var currentTimestamp = Math.round((new Date()).getTime() / 1000);

    var oldestBlockFetchedTimestamp;

    if (this._oldestBlockFetched) {
      oldestBlockFetchedTimestamp = this.getBlockTimestamp(this._oldestBlockFetched);
    } else {
      oldestBlockFetchedTimestamp = currentTimestamp;
    }

    var self = this;
    return Promise.resolve(oldestBlockFetchedTimestamp).then(function (timestamp) {
      if ((currentTimestamp - timestamp) < duration) {
        /* Fetch more */
        return self.fetchPastTrades(BLOCK_FETCH_COUNT).then(function () {
          return true;
        });
      } else {
        /* All done! */
        return false;
      }
    }).then(function (recheck) {
      if (recheck)
        return self.fetchPastTradesDuration(duration);
    });
  },

  getPriceVolumeHistory: function () {
    return this._priceVolumeHistory;
  },
};

/******************************************************************************/
/* View */
/******************************************************************************/

var View = function () {
  /* Network status */
  this._networkId = null;

  /* State */
  this._trades = [];
  this._priceInverted = false;
  this._priceCharts = [];

  /* Callbacks */
  this.fetchMoreCallback = null;
  this.getPriceVolumeHistoryCallback = null
};

View.prototype = {
  init: function () {
    $('#fetch-button').click(this.handleFetchMore.bind(this));
    $('#price-invert').click(this.handlePriceInvert.bind(this));
    $('#add-price-chart-button').click(this.handleAddPriceChart.bind(this));

    this._chartColors = ['#1f77b4', '#aec7e8', '#ff7f0e', '#ffbb78', '#2ca02c', '#98df8a',
                         '#d62728', '#ff9896', '#9467bd', '#c5b0d5', '#8c564b', '#c49c94',
                         '#e377c2', '#f7b6d2', '#7f7f7f', '#c7c7c7', '#bcbd22', '#dbdb8d',
                         '#17becf', '#9edae5']

    var tooltipLabelCallback = function (item, data) {
      var label = data.labels[item.index];
      var value = data.datasets[item.datasetIndex].tooltips[item.index] || data.datasets[item.datasetIndex].data[item.index];
      return label + ": " + value;
    }

    var relayFeeChartConfig = {
      type: 'pie',
      options: {responsive: true, tooltips: {callbacks: {label: tooltipLabelCallback}}},
      data: { datasets: [{ backgroundColor: this._chartColors, tooltips: [] }] }
    };
    this._relayFeeChart = new Chart($("#relay-fee-chart")[0].getContext('2d'), relayFeeChartConfig);

    var feeChartConfig = {
      type: 'pie',
      options: {responsive: true, tooltips: {callbacks: {label: tooltipLabelCallback}}},
      data: { datasets: [{ backgroundColor: this._chartColors, tooltips: [] }] }
    };
    this._feeChart = new Chart($("#fee-chart")[0].getContext('2d'), feeChartConfig);

    var tokensChartConfig = {
      type: 'pie',
      options: {responsive: true, tooltips: {callbacks: {label: tooltipLabelCallback}}},
      data: { datasets: [{ backgroundColor: this._chartColors, tooltips: [] }] }
    };
    this._tokensChart = new Chart($("#tokens-chart")[0].getContext('2d'), tokensChartConfig);

    var tokensVolumeChartConfig = {
      type: 'pie',
      options: {responsive: true, tooltips: {callbacks: {label: tooltipLabelCallback}}},
      data: { datasets: [{ backgroundColor: this._chartColors, tooltips: [] }] }
    };
    this._tokensVolumeChart = new Chart($("#tokens-volume-chart")[0].getContext('2d'), tokensVolumeChartConfig);

    var searchParams = new URLSearchParams(window.location.search);
    for (var key in FIAT_CURRENCY_MAP) {
      var text = FIAT_CURRENCY_MAP[key].symbol + " " + key;
      searchParams.set('cur', key);
      $('#currency-dropdown-list').append($("<li></li>").append($("<a></a>").attr("href", "?" + searchParams.toString()).text(text)));
    }

    /* Enable first price chart */
    this.enablePriceChart(0);
  },

  /* Event update handlers */

  handleConnectedEvent: function (networkId, fiatCurrency, supported) {
    Logger.log('[View] Got Connected Event');
    Logger.log('[View] Network ID: ' + networkId + ' Currency: ' + fiatCurrency + ' Supported: ' + supported);

    this._networkId = networkId;

    /* Update network name in status bar */
    var networkName = NETWORK_NAME[networkId] || ("Unknown (" + networkId + ")");

    if (supported) {
      $('#status-bar-network')
        .append($('<b></b>')
          .addClass('text-info')
          .html(this.formatAddressLink(ZEROEX_EXCHANGE_ADDRESS, networkName, true)));

      $('#fetch-button').prop('disabled', false);
      $('#add-price-chart-button').prop('disabled', false);
    } else {
      $('#status-bar-network')
        .append($('<b></b>')
          .addClass('text-info')
          .text(networkName));

      this.showResultModal(false, "Unsupported network", "This network is unsupported.<br><br>Please switch to Mainnet or Kovan.");
    }

    /* Update selected currency text */
    $('#currency-dropdown-text').text(FIAT_CURRENCY_MAP[fiatCurrency].symbol + " " + fiatCurrency);
  },

  handleNewTradeEvent: function (trade) {
    Logger.log('[View] Got New Trade Event');
    Logger.log(trade);

    /* Insert it in the right position in our trades */
    var index = 0;
    for (index = 0; index < this._trades.length; index++) {
      if (this._trades[index] < trade.timestamp)
        break;
    }
    this._trades.splice(index, 0, trade.timestamp);

    /* Format time stamp */
    var timestamp = this.formatDateTime(new Date(trade.timestamp*1000));

    /* Format trade string */
    var swap = $("<span></span>")
                .append($(trade.makerNormalized ? "<span></span>" : "<i></i>").text(trade.makerVolume.toDigits(6) + " "))
                .append(this.formatTokenLink(trade.makerToken))
                .append($("<span></span>").text(" ↔ "))
                .append($(trade.takerNormalized ? "<span></span>" : "<i></i>").text(trade.takerVolume.toDigits(6) + " "))
                .append(this.formatTokenLink(trade.takerToken));

    /* Format price */
    var price = $("<span></span>")
                  .append($("<span></span>")
                            .toggle(!this._priceInverted)
                            .addClass("m_t")
                            .text(trade.mtPrice ? trade.mtPrice.toDigits(6) : "Unknown"))
                  .append($("<span></span>")
                            .toggle(this._priceInverted)
                            .addClass("t_m")
                            .text(trade.tmPrice ? trade.tmPrice.toDigits(6) : "Unknown"));

    /* Create row for trade list */
    var elem = $('<tr></tr>')
                .append($('<td></td>')      /* Time */
                          .text(timestamp))
                .append($('<td></td>')      /* Transaction ID */
                          .html(this.formatTxidLink(trade.txid, this.formatHex(trade.txid, 8))))
                .append($('<td></td>')      /* Trade */
                          .addClass('overflow')
                          .html(swap))
                .append($('<td></td>')      /* Price */
                          .html(price))
                .append($('<td></td>')      /* Relay Address */
                          .html(this.formatRelayLink(trade.relayAddress)))
                .append($('<td></td>')      /* Maker Fee */
                          .addClass('overflow-sm')
                          .text(trade.makerFee.toDigits(6) + " ZRX"))
                .append($('<td></td>')      /* Taker Fee */
                          .addClass('overflow-sm')
                          .text(trade.takerFee.toDigits(6) + " ZRX"));

    /* Add to trade list */
    if (this._trades.length == 1)
      $('#trade-list').find("tbody").append(elem);
    else
      $('#trade-list').find("tr").eq(index).after(elem);
  },

  handleStatisticsUpdatedEvent: function (feeStats, volumeStats, priceVolumeHistory) {
    Logger.log('[View] Got Statistics Updated Event');
    Logger.log(feeStats);
    Logger.log(volumeStats);
    Logger.log(priceVolumeHistory);

    /* Clear current volumes */
    $('#volume').find("tr").remove();

    /* Look up currency information */
    var currencyInfo = FIAT_CURRENCY_MAP[feeStats.fiatCurrency];

    /* Aggregate fiat volume */
    if (volumeStats.totalVolumeFiat.gt(0)) {
      var elem = $('<tr></tr>')
                   .append($('<th></th>')
                              .text("Aggregate Volume"))
                   .append($('<td></td>')
                              .text(this.formatPrice(volumeStats.totalVolumeFiat, currencyInfo)));
      $('#volume').find("tbody").first().append(elem);
    }

    /* ZRX Fees */
    var totalRelayFees = feeStats.totalFees.toFixed(6);
    if (feeStats.totalFeesFiat)
      totalRelayFees += " (" + this.formatPrice(feeStats.totalFeesFiat, currencyInfo) + ")";

    var elem = $('<tr></tr>')
                 .append($('<th></th>')
                            .append(this.formatTokenLink(ZEROEX_TOKEN_ADDRESS))
                            .append($("<span></span>")
                                      .text(" Relay Fees")))
                 .append($('<td></td>')
                           .text(totalRelayFees));

    $('#volume').find("tbody").first().append(elem);

    /* Token Volumes */
    var tokens = Object.keys(volumeStats.tokens);
    var tokenNames = [];
    var tokenCounts = [];
    for (var i = 0; i < tokens.length; i++) {
      if (ZEROEX_TOKEN_INFOS[tokens[i]]) {
        var volume = volumeStats.tokens[tokens[i]].volume.toFixed(6);
        if (volumeStats.tokens[tokens[i]].volumeFiat.gt(0))
          volume += " (" + this.formatPrice(volumeStats.tokens[tokens[i]].volumeFiat, currencyInfo) + ")";

        var elem = $('<tr></tr>')
                     .append($('<th></th>')
                              .append(this.formatTokenLink(tokens[i])))
                     .append($('<td></td>')
                               .text(volume));
        $('#volume').find("tbody").first().append(elem);

        tokenNames.push(ZEROEX_TOKEN_INFOS[tokens[i]].symbol);
        tokenCounts.push(volumeStats.tokens[tokens[i]].count);
      }
    }

    /* Token Popularity Chart */
    this._tokensChart.data.labels = tokenNames;
    this._tokensChart.data.datasets[0].data = tokenCounts;
    this._tokensChart.update();

    /* Token Fiat Volume Chart */
    var tokenNames = [];
    var tokenVolumes = []
    var tokenVolumesFormatted = [];
    for (var i = 0; i < tokens.length; i++) {
      if (ZEROEX_TOKEN_INFOS[tokens[i]] && volumeStats.tokens[tokens[i]].volumeFiat.gt(0)) {
        tokenNames.push(ZEROEX_TOKEN_INFOS[tokens[i]].symbol);
        tokenVolumes.push(volumeStats.tokens[tokens[i]].volumeFiat.toNumber());
        tokenVolumesFormatted.push(this.formatPrice(volumeStats.tokens[tokens[i]].volumeFiat, currencyInfo));
      }
    }

    this._tokensVolumeChart.data.labels = tokenNames;
    this._tokensVolumeChart.data.datasets[0].data = tokenVolumes;
    this._tokensVolumeChart.data.datasets[0].tooltips = tokenVolumesFormatted;
    this._tokensVolumeChart.update();

    /* Relay Fee Chart */
    var relayAddresses = Object.keys(feeStats.relays);
    var relayNames = [];
    var relayFees = [];
    var relayFeesFormatted = [];
    for (var i = 0; i < relayAddresses.length; i++) {
      if (web3.toDecimal(relayAddresses[i]) == 0)
        continue;

      relayNames.push(this.formatRelay(relayAddresses[i]));
      relayFees.push(feeStats.relays[relayAddresses[i]].toNumber());
      relayFeesFormatted.push(feeStats.relays[relayAddresses[i]].toDigits(6) + " ZRX");
    }

    this._relayFeeChart.data.labels = relayNames;
    this._relayFeeChart.data.datasets[0].data = relayFees;
    this._relayFeeChart.data.datasets[0].tooltips = relayFeesFormatted;
    this._relayFeeChart.update();

    /* Fee vs Fee-less Chart */
    this._feeChart.data.labels = ["Fee", "Fee-less"];
    this._feeChart.data.datasets[0].data = [feeStats.feeCount, feeStats.feelessCount];
    this._feeChart.update();

    /* Update price charts */
    for (var i = 0; i < this._priceCharts.length; i++)
      this.updatePriceChart(i);
  },

  updatePriceChart: function (index) {
    var priceVolumeHistory = this.getPriceVolumeHistoryCallback();

    /* Update selected token pair */
    $('#price-chart-pair-text-' + index).text(this._priceCharts[index].tokenPair);

    /* Update token pair list */
    var self = this;
    $('#price-chart-pair-list-' + index).find("li").remove();
    for (var j = 0; j < priceVolumeHistory.tokens.length; j++) {
      $('#price-chart-pair-list-' + index).append(
        $("<li></li>")
          .append($("<a></a>")
                    .text(priceVolumeHistory.tokens[j])
                    .attr('href', '#')
                    .on('click', {index: index, pair: priceVolumeHistory.tokens[j]}, function (e) {
                      e.preventDefault();
                      self.handleSelectPriceChartTokenPair(e.data.index, e.data.pair);
                    }))
      );
    }

    /* Update data */
    var currentTimestamp = moment();
    this._priceCharts[index].chart.options.scales.xAxes[0].time.min = currentTimestamp.clone().subtract(STATISTICS_TIME_WINDOW, 's');
    this._priceCharts[index].chart.options.scales.xAxes[0].time.max = currentTimestamp;
    this._priceCharts[index].chart.data.datasets[0].data = priceVolumeHistory.getPriceData(this._priceCharts[index].tokenPair);
    this._priceCharts[index].chart.update();
  },

  /* Button handlers */

  handleFetchMore: function () {
    this.fetchMoreCallback(BLOCK_FETCH_COUNT);
  },

  handlePriceInvert: function () {
    this._priceInverted = !this._priceInverted;
    $('.t_m').toggle()
    $('.m_t').toggle()
  },

  handleAddPriceChart: function () {
    var index = this.addPriceChartToDom();
    this.enablePriceChart(index);
    this.updatePriceChart(index);
  },

  handleSelectPriceChartTokenPair: function (index, tokenPair) {
    this._priceCharts[index].tokenPair = tokenPair;
    this.updatePriceChart(index);
  },

  /* Price charts */

  addPriceChartToDom: function () {
    var index = this._priceCharts.length;

    var elem = `
      <div class="row">
        <span class="anchor" id="price-chart-24hr-${index}"></span>
        <h3>Price Chart (24 hr)<a class="header-link" href="#price-chart-24hr-${index}"><i class="icon-link"></i></a></h3>
      </div>
      <div class="row">
        <div class="dropdown-center">
          <button class="btn btn-default btn-sm dropdown-toggle" type="button" id="price-chart-pair-${index}" data-toggle="dropdown" aria-haspopup="true">
            <span id="price-chart-pair-text-${index}"></span>
            <span class="caret"></span>
          </button>
          <ul id="price-chart-pair-list-${index}" class="dropdown-menu" aria-labelledby="price-chart-pair-${index}"></ul>
        </div>
      </div>
      <div class="row canvas-wrapper text-center">
        <canvas class="text-center" id="price-chart-${index}" width="800" height="400"></canvas>
      </div>
    `;

    $('.row').eq(-1).before(elem);

    return index;
  },

  enablePriceChart: function (index) {
    var priceChartConfig = {
      type: 'line',
      options: {
        responsive: true,
        legend: { display: false },
        scales: {
          xAxes: [
            { type: 'time', time: { unit: 'minute' }, ticks: { autoSkip: true, maxTicksLimit: 30 }, },
          ],
        }
      },
      data: {
        datasets: [
          { borderDash: [5, 5], borderColor: this._chartColors[0], fill: false, },
        ]
      }
    };
    var priceChart = new Chart($("#price-chart-" + index)[0].getContext('2d'), priceChartConfig);

    this._priceCharts.push({index: index, tokenPair: PRICE_CHART_DEFAULT_PAIR, chart: priceChart});
  },

  /* Formatting Helpers */

  formatDateTime: function (datetime) {
    var year = datetime.getUTCFullYear();
    var month = ((datetime.getUTCMonth()+1) < 10) ? ("0" + (datetime.getUTCMonth()+1)) : (datetime.getUTCMonth()+1);
    var day = (datetime.getUTCDate() < 10) ? ("0" + datetime.getUTCDate()) : datetime.getUTCDate();
    var hours = (datetime.getUTCHours() < 10) ? ("0" + datetime.getUTCHours()) : datetime.getUTCHours();
    var minutes = (datetime.getUTCMinutes() < 10) ? ("0" + datetime.getUTCMinutes()) : datetime.getUTCMinutes();
    var seconds = (datetime.getUTCSeconds() < 10) ? ("0" + datetime.getUTCSeconds()) : datetime.getUTCSeconds();

    return year + "/" + month + "/" + day + " " + hours + ":" + minutes + ":" + seconds;
  },

  formatPrice: function (price, currencyInfo) {
    return currencyInfo.symbol + price.toFixed(currencyInfo.decimal_digits) + " " + currencyInfo.code;
  },

  formatHex: function (hex, digits) {
    digits = digits || 6;
    return hex.substring(0, 2+digits) + "...";
  },

  formatRelay: function (address) {
    if (ZEROEX_RELAY_ADDRESSES[this._networkId][address]) {
      return ZEROEX_RELAY_ADDRESSES[this._networkId][address];
    } else {
      return this.formatHex(address);
    }
  },

  formatTokenLink: function (address) {
    if (ZEROEX_TOKEN_INFOS[address]) {
      return this.formatAddressLink(address, ZEROEX_TOKEN_INFOS[address].symbol);
    } else {
      return this.formatAddressLink(address, this.formatHex(address));
    }
  },

  formatRelayLink: function (address) {
    if (ZEROEX_RELAY_ADDRESSES[this._networkId][address]) {
      return this.formatAddressLink(address, ZEROEX_RELAY_ADDRESSES[this._networkId][address]);
    } else if (web3.toDecimal(address) == 0) {
      return $("<span></span>").text("None");
    } else {
      return this.formatAddressLink(address, this.formatHex(address));
    }
  },

  formatTxidLink: function (txid, text, showLinkIcon) {
    var baseUrl = NETWORK_BLOCK_EXPLORER[this._networkId];

    if (baseUrl) {
      var elem = $('<a></a>')
                 .attr('href', baseUrl + "/tx/" + txid)
                 .attr('target', '_blank')
                 .text(text);

      if (showLinkIcon)
        elem = elem.append($('<i></i>').addClass('icon-link-ext'));

      return elem;
    } else {
      return text;
    }
  },

  formatAddressLink: function (address, text, showLinkIcon) {
    var baseUrl = NETWORK_BLOCK_EXPLORER[this._networkId];

    if (baseUrl) {
      var elem = $('<a></a>')
                 .attr('href', baseUrl + "/address/" + address)
                 .attr('target', '_blank')
                 .text(text);

      if (showLinkIcon)
        elem = elem.append($('<i></i>').addClass('icon-link-ext'));

      return elem;
    } else {
      return text;
    }
  },

  /* Success/failure Modal */

  showResultModal: function (success, heading, body) {
    if (success) {
      $('#result-modal .modal-title').text(heading)
                                     .removeClass('text-danger')
                                     .addClass('text-info');
    } else {
      $('#result-modal .modal-title').text(heading)
                                     .removeClass('text-info')
                                     .addClass('text-danger');
    }

    $('#result-modal .modal-body').html(body);

    $('#result-modal').modal();
  },
};

/******************************************************************************/
/* Controller */
/******************************************************************************/

var Controller = function (model, view) {
  this.model = model;
  this.view = view;
};

Controller.prototype = {
  init: function () {
    /* Bind model -> view */
    this.model.connectedCallback = this.view.handleConnectedEvent.bind(this.view);
    this.model.newTradeCallback = this.view.handleNewTradeEvent.bind(this.view);
    this.model.statisticsUpdatedCallback = this.view.handleStatisticsUpdatedEvent.bind(this.view);

    /* Bind view -> model */
    this.view.fetchMoreCallback = this.model.fetchPastTrades.bind(this.model);
    this.view.getPriceVolumeHistoryCallback = this.model.getPriceVolumeHistory.bind(this.model);

    /* Initialize view */
    this.view.init();

    /* Initialize model */
    this.model.init();
  },
};

/******************************************************************************/
/* Top-level */
/******************************************************************************/

Logger = {
  enabled: false,

  log: function (s) {
    if (Logger.enabled && console)
      console.log(s);
  },

  error: function (s) {
    console.error(s);
  },
};

App = {
  model: null,
  view: null,
  controller: null,

  init: function () {
    var params = (new URLSearchParams(window.location.search));
    /* Supported parameters:
         debug
         provider: current, localhost, infura
         cur: USD, EUR, etc.
     */

    /* Enable logging in debug mode */
    if (params.has("debug"))
      Logger.enabled = true;

    /* Look up currency */
    var currency = params.get("cur");

    /* Look up provider */
    var provider = params.get("provider");

    if (!provider)
      provider = (typeof web3 !== 'undefined') ? 'current' : 'infura';

    Logger.log('[App] Using web3 provider ' + provider);
    if (provider == 'current')
      window.web3 = new Web3(web3.currentProvider);
    else if (provider == 'localhost')
      window.web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
    else if (provider == 'infura')
      window.web3 = new Web3(new ZeroClientProvider({getAccounts: function (cb) { cb(null, []); }, rpcUrl: INFURA_API_URL}));

    App.model = new Model(window.web3, currency);
    App.view = new View();
    App.controller = new Controller(App.model, App.view);

    App.controller.init();
  },
};

window.onload = function () {
  App.init();
}
