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

var PRICE_API_URL = function (symbol, base) {
  return "https://min-api.cryptocompare.com/data/price?fsym=" + symbol + "&tsyms=" + base;
};

var INFURA_API_URL = "https://mainnet.infura.io/rdkuEWbeKAjSR9jZ6P1h";

var STATISTICS_TIME_WINDOW = 86400; /* 24 hours */

var BLOCK_FETCH_COUNT = STATISTICS_TIME_WINDOW/15;

var PRICE_UPDATE_TIMEOUT = 5*60*1000;

/******************************************************************************/
/* Helper Functions */
/******************************************************************************/

var normalizeTokenQuantity = function (token, quantity) {
  if (ZEROEX_TOKEN_INFOS[token]) {
    return quantity.div(10**ZEROEX_TOKEN_INFOS[token].decimals);
  } else {
    return quantity;
  }
};

/******************************************************************************/
/* Model */
/******************************************************************************/

var Model = function (web3) {
  /* web3 interface */
  this._web3 = web3;
  this._zeroEx = new ZeroEx.ZeroEx(web3.currentProvider);

  /* Network status */
  this._networkId = null;
  this._blockHeight = null;

  /* Model State */
  this._trades = [];
  this._tradesSeen = {};

  /* Blockchain state */
  this._oldestBlockFetched = null;
  this._blockTimestamps = {};

  /* Price state */
  this._zrxPrice = null;
  this._fiatCurrency = "USD";
  this._fiatSymbol = "$";

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

          self.connectedCallback(self._networkId, false);
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

                self.connectedCallback(self._networkId, true);

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
                /* Update ZRX price */
                self.updateZrxPrice();

                /* Subscribe to new fill logs */
                self._zeroEx.exchange.subscribeAsync("LogFill", {}, self.handleLogFillEvent.bind(self, null));

                /* Fetch past fill logs */
                self.fetchPastTrades(BLOCK_FETCH_COUNT);
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

        /* If we've already processed this trade, skipped it */
        if (this._tradesSeen[result.transactionHash + result.logIndex])
          return;

        var trade = {
          txid: result.transactionHash,
          blockNumber: web3.toDecimal(result.blockNumber),
          taker: result.args.taker,
          takerToken: result.args.takerToken,
          maker: result.args.maker,
          makerToken: result.args.makerToken,
          filledMakerTokenAmount: result.args.filledMakerTokenAmount,
          filledTakerTokenAmount: result.args.filledTakerTokenAmount,
          feeRecipient: result.args.feeRecipient,
          paidMakerFee: result.args.paidMakerFee,
          paidTakerFee: result.args.paidTakerFee,
          tokens: result.args.tokens,
          orderHash: result.args.orderHash,
        };

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

          self.newTradeCallback(trade);

          /* Update statistics */
          self.updateStatistics();
        });
    }
  },

  /* Statistics update */

  updateStatistics: function () {
    Logger.log('[Model] Updating statistics');

    var currentTimestamp = Math.round((new Date()).getTime() / 1000);
    var cutoffTimestamp = currentTimestamp - STATISTICS_TIME_WINDOW;

    var feeStats = {totalFees: new web3.BigNumber(0), relays: {}, feeCount: 0, feelessCount: 0};
    var volumeStats = {totalTrades: 0, tokens: {}};

    for (var i = 0; i < this._trades.length; i++) {
      if (this._trades[i].timestamp < cutoffTimestamp)
        break;

      /* Relay fee statistics */
      var relayFee = normalizeTokenQuantity(ZEROEX_TOKEN_ADDRESS, this._trades[i].paidMakerFee.add(this._trades[i].paidTakerFee));
      if (feeStats.relays[this._trades[i].feeRecipient] == undefined)
        feeStats.relays[this._trades[i].feeRecipient] = new web3.BigNumber(0);

      feeStats.relays[this._trades[i].feeRecipient] = feeStats.relays[this._trades[i].feeRecipient].add(relayFee);
      feeStats.totalFees = feeStats.totalFees.add(relayFee);

      if (!relayFee.eq(0))
        feeStats.feeCount += 1;
      else
        feeStats.feelessCount += 1;

      /* Token volume and count statistics */
      if (volumeStats.tokens[this._trades[i].makerToken] == undefined)
        volumeStats.tokens[this._trades[i].makerToken] = {volume: new web3.BigNumber(0), count: 0};
      if (volumeStats.tokens[this._trades[i].takerToken] == undefined)
        volumeStats.tokens[this._trades[i].takerToken] = {volume: new web3.BigNumber(0), count: 0};

      var makerVolume = normalizeTokenQuantity(this._trades[i].makerToken, this._trades[i].filledMakerTokenAmount);
      var takerVolume = normalizeTokenQuantity(this._trades[i].takerToken, this._trades[i].filledTakerTokenAmount);
      volumeStats.tokens[this._trades[i].makerToken].volume = volumeStats.tokens[this._trades[i].makerToken].volume.add(makerVolume);
      volumeStats.tokens[this._trades[i].takerToken].volume = volumeStats.tokens[this._trades[i].takerToken].volume.add(takerVolume);

      volumeStats.tokens[this._trades[i].makerToken].count += 1;
      volumeStats.tokens[this._trades[i].takerToken].count += 1;
      volumeStats.totalTrades += 1;
    }

    /* Compute relay fees in fiat currency, if available */
    if (this._zrxPrice != null) {
      feeStats.totalFeesFiat = feeStats.totalFees.mul(this._zrxPrice);
      feeStats.fiatCurrency = this._fiatCurrency;
      feeStats.fiatSymbol = this._fiatSymbol;
    } else {
      feeStats.totalFeesFiat = null;
    }

    this.statisticsUpdatedCallback(feeStats, volumeStats);
  },

  /* ZRX Price update */

  updateZrxPrice: function () {
    Logger.log('[Model] Fetching ZRX price');

    var endpoint = PRICE_API_URL('ZRX', this._fiatCurrency);

    var self = this;
    return $.getJSON(endpoint).then(function (price) {
      self._zrxPrice = price[self._fiatCurrency];

      Logger.log('[Model] Current ZRX Price: ' + self._zrxPrice);

      /* Update statistics */
      self.updateStatistics();

      setTimeout(self.updateZrxPrice.bind(self), PRICE_UPDATE_TIMEOUT);
    });
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

    var self = this;
    this._zeroEx.exchange.getLogsAsync("LogFill", {fromBlock: fromBlock, toBlock: toBlock}, {}).then(function (logs) {
      for (var i = 0; i < logs.length; i++) {
        self.handleLogFillEvent(null, logs[i]);
      }
    });

    this._oldestBlockFetched = fromBlock;
  },
};

/******************************************************************************/
/* View */
/******************************************************************************/

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

var View = function () {
  /* Network status */
  this._networkId = null;

  /* State */
  this._trades = [];

  /* Callbacks */
  this.fetchMoreCallback = null;
};

View.prototype = {
  init: function () {
    $('#fetch-button').click(this.handleFetchMore.bind(this));

    var chartColors = ['#1f77b4', '#aec7e8', '#ff7f0e', '#ffbb78', '#2ca02c', '#98df8a',
                       '#d62728', '#ff9896', '#9467bd', '#c5b0d5', '#8c564b', '#c49c94',
                       '#e377c2', '#f7b6d2', '#7f7f7f', '#c7c7c7', '#bcbd22', '#dbdb8d',
                       '#17becf', '#9edae5']

    var relayFeeChartConfig = {
      type: 'pie', options: {responsive: true}, data: { datasets: [{ backgroundColor: chartColors }] }
    };
    this._relayFeeChart = new Chart($("#relay-fee-chart")[0].getContext('2d'), relayFeeChartConfig);

    var feeChartConfig = {
      type: 'pie', options: {responsive: true}, data: { datasets: [{ backgroundColor: chartColors }] }
    };
    this._feeChart = new Chart($("#fee-chart")[0].getContext('2d'), feeChartConfig);

    var tokensChartConfig = {
      type: 'pie', options: {responsive: true}, data: { datasets: [{ backgroundColor: chartColors }] }
    };
    this._tokensChart = new Chart($("#tokens-chart")[0].getContext('2d'), tokensChartConfig);
  },

  /* Event update handlers */

  handleConnectedEvent: function (networkId, supported) {
    Logger.log('[View] Got Connected Event');
    Logger.log('[View] Network ID: ' + networkId + " Supported: " + supported);

    this._networkId = networkId;

    /* Update network name in status bar */
    var networkName = NETWORK_NAME[networkId] || ("Unknown (" + networkId + ")");

    if (supported) {
      $('#status-bar-network')
        .append($('<b></b>')
          .addClass('text-info')
          .html(this.formatAddressLink(ZEROEX_EXCHANGE_ADDRESS, networkName, true)));

      $('#fetch-button').prop('disabled', false);
    } else {
      $('#status-bar-network')
        .append($('<b></b>')
          .addClass('text-info')
          .text(networkName));

      this.showResultModal(false, "Unsupported network", "This network is unsupported.<br><br>Please switch to mainnet or Kovan.");
    }
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

    /* Normalize traded quantities */
    var makerQuantity = normalizeTokenQuantity(trade.makerToken, trade.filledMakerTokenAmount).toDigits(6);
    var takerQuantity = normalizeTokenQuantity(trade.takerToken, trade.filledTakerTokenAmount).toDigits(6);
    var makerToken = this.formatTokenLink(trade.makerToken);
    var takerToken = this.formatTokenLink(trade.takerToken);

    /* Format trade string */
    var swap = $("<span></span>")
                .append($("<span></span>").text(makerQuantity + " "))
                .append(makerToken)
                .append($("<span></span>").text(" ↔ "))
                .append($("<span></span>").text(takerQuantity + " "))
                .append(takerToken);

    /* Compute price */
    var price = "Unknown";
    if (ZEROEX_TOKEN_INFOS[trade.makerToken] != undefined && ZEROEX_TOKEN_INFOS[trade.takerToken] != undefined) {
      var price = makerQuantity.div(takerQuantity);
      price = price.toDigits(6);
    }

    /* Format maker and taker fees */
    var makerFee = normalizeTokenQuantity(ZEROEX_TOKEN_ADDRESS, trade.paidMakerFee).toDigits(6) + " ZRX";
    var takerFee = normalizeTokenQuantity(ZEROEX_TOKEN_ADDRESS, trade.paidTakerFee).toDigits(6) + " ZRX";

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
                          .text(price))
                .append($('<td></td>')      /* Relay Address */
                          .html(this.formatRelayLink(trade.feeRecipient)))
                .append($('<td></td>')      /* Maker Fee */
                          .addClass('overflow-sm')
                          .text(makerFee))
                .append($('<td></td>')      /* Taker Fee */
                          .addClass('overflow-sm')
                          .text(takerFee));

    /* Add to trade list */
    if (this._trades.length == 1)
      $('#trade-list').find("tbody").append(elem);
    else
      $('#trade-list').find("tr").eq(index).after(elem);
  },

  handleStatisticsUpdatedEvent: function (feeStats, volumeStats) {
    Logger.log('[View] Got Statistics Updated Event');
    Logger.log(feeStats);
    Logger.log(volumeStats);

    /* Clear current volumes */
    $('#volume').find("tr").remove();

    /* ZRX Fees */
    var fees_text = feeStats.totalFees.toFixed(6);
    if (feeStats.totalFeesFiat)
      fees_text += " (" + feeStats.fiatSymbol + feeStats.totalFeesFiat.toFixed(2) + " " + feeStats.fiatCurrency + ")";

    var elem = $('<tr></tr>')
                 .append($('<th></th>')
                            .append(this.formatTokenLink(ZEROEX_TOKEN_ADDRESS))
                            .append($("<span></span>")
                                      .text(" Relay Fees")))
                 .append($('<td></td>')
                           .text(fees_text));

    $('#volume').find("tbody").first().append(elem);

    /* Token Volumes */
    var tokens = Object.keys(volumeStats.tokens);
    var tokenNames = [];
    var tokenCounts = [];
    for (var i = 0; i < tokens.length; i++) {
      if (ZEROEX_TOKEN_INFOS[tokens[i]]) {
        var elem = $('<tr></tr>')
                     .append($('<th></th>')
                              .append(this.formatTokenLink(tokens[i])))
                     .append($('<td></td>')
                               .text(volumeStats.tokens[tokens[i]].volume.toFixed(6)));
        $('#volume').find("tbody").first().append(elem);

        tokenNames.push(ZEROEX_TOKEN_INFOS[tokens[i]].symbol);
        tokenCounts.push(volumeStats.tokens[tokens[i]].count);
      }
    }

    /* Token Popularity Chart */
    this._tokensChart.data.labels = tokenNames;
    this._tokensChart.data.datasets[0].data = tokenCounts;
    this._tokensChart.update();

    /* Relay Fee Chart */
    var relayAddresses = Object.keys(feeStats.relays);
    var relayNames = [];
    var relayFees = [];
    for (var i = 0; i < relayAddresses.length; i++) {
      if (web3.toDecimal(relayAddresses[i]) == 0)
        continue;

      relayNames.push(this.formatRelay(relayAddresses[i]));
      relayFees.push(feeStats.relays[relayAddresses[i]].toNumber());
    }

    this._relayFeeChart.data.labels = relayNames;
    this._relayFeeChart.data.datasets[0].data = relayFees;
    this._relayFeeChart.update();

    /* Fee vs Fee-less Chart */
    this._feeChart.data.labels = ["Fee", "Fee-less"];
    this._feeChart.data.datasets[0].data = [feeStats.feeCount, feeStats.feelessCount];
    this._feeChart.update();
  },

  /* Button handler */

  handleFetchMore: function () {
    this.fetchMoreCallback(BLOCK_FETCH_COUNT);
  },

  /* Formatting Helpers */

  formatDateTime: function (datetime) {
    var year = datetime.getUTCFullYear();
    var month = ((datetime.getUTCMonth()+1) < 10) ? ("0" + (datetime.getUTCMonth()+1)) : (datetime.getUTCMonth()+1);
    var day = (datetime.getUTCDate() < 10) ? ("0" + datetime.getUTCDate()) : datetime.getUTCDate();
    var hours = (datetime.getUTCHours() < 10) ? ("0" + datetime.getUTCHours()) : datetime.getUTCHours();
    var minutes = (datetime.getUTCMinutes() < 10) ? ("0" + datetime.getUTCMinutes()) : datetime.getUTCMinutes();
    var seconds = (datetime.getUTCSeconds() < 10) ? ("0" + datetime.getUTCSeconds()) : datetime.getUTCSeconds();

    return year + "/" + month + "/" + day + " " + hours + ":" + minutes + ":" + seconds + " UTC";
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
    if (typeof web3 !== 'undefined') {
      window.web3 = new Web3(web3.currentProvider);
    } else {
      var provider = new ZeroClientProvider({getAccounts: function (cb) { cb(null, []); }, rpcUrl: INFURA_API_URL});
      window.web3 = new Web3(provider);
    }

    App.model = new Model(window.web3);
    App.view = new View();
    App.controller = new Controller(App.model, App.view);

    App.controller.init();
  },
};

window.onload = function () {
  App.init();
}
