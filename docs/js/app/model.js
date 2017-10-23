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

    /* Configure web3's BigNumber to format large numbers (e.g. salts) in
     * decimal correctly */
    web3.BigNumber.config({EXPONENTIAL_AT: 100});

    /* Look up network id */
    self._web3.version.getNetwork(function (error, result) {
      if (error) {
        Logger.log('[Model] Error determining network version');
        Logger.error(error);

        self.connectedCallback(self._networkId, self._fiatCurrency, ERRORS.GET_NETWORK_ID)
      } else {
        self._networkId = result;

        Logger.log('[Model] Network ID: ' + self._networkId);

        if (ZEROEX_GENESIS_BLOCK[self._networkId] == undefined) {
          Logger.log('[Model] Unsupported network id');

          self.connectedCallback(self._networkId, self._fiatCurrency, ERRORS.UNSUPPORTED_NETWORK);
        } else {
          self._web3.eth.getBlockNumber(function (error, result) {
            if (error) {
              Logger.log('[Model] Error determining block height');
              Logger.error(error);

              self.connectedCallback(self._networkId, self._fiatCurrency, ERRORS.GET_BLOCK_HEIGHT);
            } else {
              self._blockHeight = result

              Logger.log('[Model] Block height: ' + self._blockHeight);

              /* Fetch exchange address */
              self._zeroEx.exchange.getContractAddressAsync().then(function (address) {
                ZEROEX_EXCHANGE_ADDRESS = address;

                self.connectedCallback(self._networkId, self._fiatCurrency, null);

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

  _getBlockTimestamp: function (blockNumber) {
    var self = this;

    return new Promise(function (resolve, reject) {
      if (self._blockTimestamps[blockNumber]) {
        resolve(self._blockTimestamps[blockNumber]);
      } else {
        self._web3.eth.getBlock(blockNumber, function (error, result) {
          if (error) {
            reject(error);
          } else {
            if (result) {
              self._blockTimestamps[blockNumber] = result.timestamp;
              resolve(result.timestamp);
            } else {
              /* Block information not available yet */
              resolve(null);
            }
          }
        });
      }
    });
  },

  getBlockTimestamp: function (blockNumber) {
    var self = this;

    return this._getBlockTimestamp(blockNumber).then(function (result) {
      if (result) {
        Logger.log("[Model] Got block info for " + blockNumber);
        return result;
      } else {
        Logger.log("[Model] Block info unavailable for " + blockNumber);
        Logger.log("[Model] Retrying in " + BLOCK_INFO_RETRY_TIMEOUT/1000 + " seconds");

        /* Retry after duration */
        return (new Promise(function (resolve) {
          setTimeout(resolve, BLOCK_INFO_RETRY_TIMEOUT);
        })).then(function () {
          return self.getBlockTimestamp(blockNumber);
        });
      }
    })
  },

  getTransaction: function (txid) {
    var self = this;

    return new Promise(function (resolve, reject) {
      self._web3.eth.getTransaction(txid, function (error, result) {
        if (error)
          reject(error)
        else
          resolve(result);
      });
    });
  },

  /* Blockchain event handlers */

  handleLogFillEvent: function (error, result) {
    if (error) {
        Logger.error(error);
    } else {
        Logger.log('[Model] Got Log Fill event');

        /* If we've already processed this trade, skip it */
        if (this._tradesSeen[result.transactionHash + result.args.orderHash])
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
        this._tradesSeen[result.transactionHash + result.args.orderHash] = true;

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
          self.newTradeCallback(index, trade, self._trades);

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

    var statistics = {
        'fees': {totalFees: new web3.BigNumber(0), relays: {}, feeCount: 0, feelessCount: 0},
        'volume': {totalTrades: 0, totalVolumeFiat: new web3.BigNumber(0), tokens: {}},
        'counts': {relays: {}},
    };

    for (var i = 0; i < this._trades.length; i++) {
      /* Process up to statistics time window trades */
      if (this._trades[i].timestamp < cutoffTimestamp)
        break;

      /*** Relay fee statistics ***/

      var relayAddress = this._trades[i].relayAddress;
      var relayFee = this._trades[i].makerFee.add(this._trades[i].takerFee);

      if (statistics['fees'].relays[relayAddress] == undefined)
        statistics['fees'].relays[relayAddress] = new web3.BigNumber(0);

      /* Fee per relay and total relay fees */
      statistics['fees'].relays[relayAddress] = statistics['fees'].relays[relayAddress].add(relayFee);
      statistics['fees'].totalFees = statistics['fees'].totalFees.add(relayFee);

      /* Fee vs Feeless trade count */
      if (!relayFee.eq(0))
        statistics['fees'].feeCount += 1;
      else
        statistics['fees'].feelessCount += 1;

      /*** Trades per relay ***/

      if (statistics['counts'].relays[relayAddress] == undefined)
        statistics['counts'].relays[relayAddress] = 0;

      statistics['counts'].relays[relayAddress] += 1;

      /*** Token volume and count statistics ***/

      var makerToken = this._trades[i].makerToken;
      var takerToken = this._trades[i].takerToken;
      var makerVolume = this._trades[i].makerVolume;
      var takerVolume = this._trades[i].takerVolume;
      var makerTokenSymbol = this._trades[i].makerNormalized ? ZEROEX_TOKEN_INFOS[makerToken].symbol : null;
      var takerTokenSymbol = this._trades[i].takerNormalized ? ZEROEX_TOKEN_INFOS[takerToken].symbol : null;

      if (statistics['volume'].tokens[makerToken] == undefined)
        statistics['volume'].tokens[makerToken] = {volume: new web3.BigNumber(0), volumeFiat: new web3.BigNumber(0), count: 0};
      if (statistics['volume'].tokens[takerToken] == undefined)
        statistics['volume'].tokens[takerToken] = {volume: new web3.BigNumber(0), volumeFiat: new web3.BigNumber(0), count: 0};

      /* Volume per token */
      statistics['volume'].tokens[makerToken].volume = statistics['volume'].tokens[makerToken].volume.add(makerVolume);
      statistics['volume'].tokens[takerToken].volume = statistics['volume'].tokens[takerToken].volume.add(takerVolume);

      /* Fiat volume per token */
      if (this._tokenPrices[makerTokenSymbol]) {
        var fiatMakerVolume = makerVolume.mul(this._tokenPrices[makerTokenSymbol]);
        statistics['volume'].tokens[makerToken].volumeFiat = statistics['volume'].tokens[makerToken].volumeFiat.add(fiatMakerVolume);
        statistics['volume'].totalVolumeFiat = statistics['volume'].totalVolumeFiat.add(fiatMakerVolume);
      }
      if (this._tokenPrices[takerTokenSymbol]) {
        var fiatTakerVolume = takerVolume.mul(this._tokenPrices[takerTokenSymbol]);
        statistics['volume'].tokens[takerToken].volumeFiat = statistics['volume'].tokens[takerToken].volumeFiat.add(fiatTakerVolume);
        statistics['volume'].totalVolumeFiat = statistics['volume'].totalVolumeFiat.add(fiatTakerVolume);
      }

      /* Trade count per token and total trades */
      statistics['volume'].tokens[makerToken].count += 1;
      statistics['volume'].tokens[takerToken].count += 1;
      statistics['volume'].totalTrades += 1;
    }

    /* Compute relay fees in fiat currency, if available */
    var zrxPrice = this._tokenPrices['ZRX'];
    statistics['fees'].totalFeesFiat = zrxPrice ? statistics['fees'].totalFees.mul(zrxPrice) : null;
    statistics['fees'].fiatCurrency = this._fiatCurrency;
    statistics['fees'].zrxPrice = zrxPrice;

    /* Prune price/volume history */
    this._priceVolumeHistory.prune();

    /* Call view callback */
    this.statisticsUpdatedCallback(statistics, this._priceVolumeHistory);
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

  fetchOrder: function (trade) {
    var self = this;
    return this.getTransaction(trade.txid).then(function (result) {
      /* FIXME this all should really use an abi decoder */

      var methodId = result.input.substring(0, 10);

      /* Only support fillOrder() method for now */
      if (methodId != "0xbc61394a")
        return {error: "Unsupported fill method."};
      else if (result.length < 1034)
        return {error: "Unsupported fill method."};

      /* Extract 15 params from the input data */
      var params = [];
      for (var i = 10; i < 1034; i+= 64)
        params.push(result.input.substring(i, i+64));

      /* Form 0x.js order object */
      var order = {};
      order.exchangeContractAddress = ZEROEX_EXCHANGE_ADDRESS;
      order.expirationUnixTimestampSec = web3.toBigNumber("0x" + params[9]);
      order.feeRecipient = "0x" + params[4].substring(24);
      order.maker = "0x" + params[0].substring(24);
      order.makerFee = web3.toBigNumber("0x" + params[7]);
      order.makerTokenAddress = "0x" + params[2].substring(24);
      order.makerTokenAmount = web3.toBigNumber("0x" + params[5]);
      order.salt = web3.toBigNumber("0x" + params[10]);
      order.taker = "0x" + params[1].substring(24);
      order.takerFee = web3.toBigNumber("0x" + params[8]);
      order.takerTokenAddress = "0x" + params[3].substring(24);
      order.takerTokenAmount = web3.toBigNumber("0x" + params[6]);

      /* Calculate order hash */
      var orderHash = ZeroEx.ZeroEx.getOrderHashHex(order);

      /* Form 0x portal order object */
      var portalOrder = {maker: {token: {}}, taker: {token: {}}, signature: {}};
      portalOrder.maker.address = order.maker;
      portalOrder.maker.token.address = order.makerTokenAddress;
      portalOrder.maker.token.name = ZEROEX_TOKEN_INFOS[portalOrder.maker.token.address] ? ZEROEX_TOKEN_INFOS[portalOrder.maker.token.address].name : null;
      portalOrder.maker.token.symbol = ZEROEX_TOKEN_INFOS[portalOrder.maker.token.address] ? ZEROEX_TOKEN_INFOS[portalOrder.maker.token.address].symbol : null;
      portalOrder.maker.token.decimals = ZEROEX_TOKEN_INFOS[portalOrder.maker.token.address] ? ZEROEX_TOKEN_INFOS[portalOrder.maker.token.address].decimals : null;
      portalOrder.maker.amount = order.makerTokenAmount.toString();
      portalOrder.maker.feeAmount = order.makerFee.toString();
      portalOrder.taker.address = (web3.toDecimal(order.taker) == 0) ? "" : order.taker;
      portalOrder.taker.token.address = order.takerTokenAddress;
      portalOrder.taker.token.name = ZEROEX_TOKEN_INFOS[portalOrder.taker.token.address] ? ZEROEX_TOKEN_INFOS[portalOrder.taker.token.address].name : null;
      portalOrder.taker.token.symbol = ZEROEX_TOKEN_INFOS[portalOrder.taker.token.address] ? ZEROEX_TOKEN_INFOS[portalOrder.taker.token.address].symbol : null;
      portalOrder.taker.token.decimals = ZEROEX_TOKEN_INFOS[portalOrder.taker.token.address] ? ZEROEX_TOKEN_INFOS[portalOrder.taker.token.address].decimals : null;
      portalOrder.taker.amount = order.takerTokenAmount.toString();
      portalOrder.taker.feeAmount = order.takerFee.toString();
      portalOrder.expiration = order.expirationUnixTimestampSec.toString();
      portalOrder.feeRecipient = order.feeRecipient;
      portalOrder.salt = order.salt.toString();
      portalOrder.signature.v = web3.toDecimal("0x" + params[13]);
      portalOrder.signature.r = "0x" + params[14];
      portalOrder.signature.s = "0x" + params[15];
      portalOrder.signature.hash = orderHash;
      portalOrder.exchangeContract = order.exchangeContractAddress;
      portalOrder.networkId = web3.toDecimal(self._networkId);

      /* Check order hash matches actual trade */
      if (portalOrder.signature.hash != trade.orderHash) {
        Logger.log("[Model] Order hash mismatch in fetch order.");
        Logger.log(params);
        Logger.log(trade);
        Logger.log(order);
        Logger.log(portalOrder);
        return {error: "Decoding order: Order hash mismatch."};
      }

      /* Calculate taker amount remaining */
      return self._zeroEx.exchange.getUnavailableTakerAmountAsync(portalOrder.signature.hash).then(function (result) {
        var isOpenTaker = portalOrder.taker.address.length == 0;
        var isExpired = order.expirationUnixTimestampSec.lt(Math.round((new Date()).getTime() / 1000));
        var [takerAmountRemaining, takerAmountRemainingNormalized] = self.normalizeQuantity(portalOrder.taker.token.address, order.takerTokenAmount.sub(result));

        return {
          order: portalOrder,
          isOpenTaker: isOpenTaker,
          isExpired: isExpired,
          takerAmountRemaining: takerAmountRemaining,
          takerAmountRemainingNormalized: takerAmountRemainingNormalized,
          error: null
        };
      });
    }).catch(function (error) {
      return {error: error};
    });
  },
};

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
    var [quote, base] = tokenPair.split("/");

    if (this._priceData[base] && this._priceData[base][quote])
      return this._priceData[base][quote];

    return [];
  },

  /* Get volume data for a token pair */
  getVolumeData: function (tokenPair) {
    var [quote, base] = tokenPair.split("/");

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

          if (this._timestamps[maker][taker].length == 0) {
            this.tokens.splice(this.tokens.indexOf(maker + "/" + taker), 1);
            this.tokens.splice(this.tokens.indexOf(taker + "/" + maker), 1);
          }

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
      this.tokens.push(a + "/" + b);
      this.tokens.sort();
    }
  },
};
