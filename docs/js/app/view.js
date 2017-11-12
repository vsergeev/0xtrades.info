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
/* View */
/******************************************************************************/

var View = function () {
  /* Network status */
  this._networkId = null;

  /* State */
  this._panels = [];
  this._currencyInfo = null;
  this._lastNewTradeEvent = [null, null, null];
  this._lastStatisticsUpdatedEvent = [null, null];

  /* Callbacks to model */
  this.fetchMoreCallback = null;
  this.fetchOrderCallback = null;
};

View.prototype = {
  init: function () {
    var searchParams = new URLSearchParams(window.location.search);
    for (var key in FIAT_CURRENCY_MAP) {
      var text = FIAT_CURRENCY_MAP[key].symbol + " " + key;
      searchParams.set('cur', key);
      $('#currency-dropdown-list').append($("<li></li>").append($("<a></a>").attr("href", "?" + searchParams.toString()).text(text)));
    }

    $('#add-panel-row-button').click(this.handleAddPanelRow.bind(this));
    $('#add-split-panel-row-button').click(this.handleAddSplitPanelRow.bind(this));

    var root1, root2;

    [root1, root2] = this.domAddSplitPanelRow();
    this.panelCreate(root1, VolumeStatisticsPanel);
    this.panelCreate(root2, TokenVolumeChartPanel);
    this.panelCreate(this.domAddPanelRow(), RecentTradesPanel);
    [root1, root2] = this.domAddSplitPanelRow();
    this.panelCreate(root1, FeeFeelessChartPanel);
    this.panelCreate(root2, TokenPairsChartPanel);
    [root1, root2] = this.domAddSplitPanelRow();
    this.panelCreate(root1, RelayFeeChartPanel);
    this.panelCreate(root2, RelayTradesChartPanel);
    this.panelCreate(this.domAddPanelRow(), PriceChartPanel);
  },

  /* Event update handlers */

  handleConnectedEvent: function (networkId, fiatCurrency, error) {
    Logger.log('[View] Got Connected Event');
    Logger.log('[View] Network ID: ' + networkId + ' Currency: ' + fiatCurrency + ' Error: ' + error);

    this._networkId = networkId;

    /* Update network name in status bar */
    var networkName = NETWORK_NAME[networkId] || ("Unknown (" + networkId + ")");

    if (error == null) {
      $('#status-bar-network')
        .append($('<b></b>')
          .html(this.formatAddressLink(ZEROEX_EXCHANGE_ADDRESS, networkName, true)));
    } else if (error == ERRORS.UNSUPPORTED_NETWORK) {
      $('#status-bar-network')
        .append($('<b></b>')
          .text(networkName));

      this.showResultModal(false, "Unsupported network", "This network is unsupported.<br><br>Please switch to Mainnet or Kovan.");
    } else if (error) {
      $('#status-bar-network')
        .append($('<b></b>')
          .text(networkName));

      this.showResultModal(false, "Error", "An unknown error occurred (code " + error + ").<br><br>Please try reloading the app.");
    }

    this._currencyInfo = FIAT_CURRENCY_MAP[fiatCurrency];

    /* Update selected currency text */
    $('#currency-dropdown-text').text(this._currencyInfo.symbol + " " + fiatCurrency);
  },

  handleNewTradeEvent: function (index, trade, tradeHistory) {
    Logger.log('[View] Got New Trade Event at index ' + index);
    Logger.log(trade);
    Logger.log(tradeHistory);

    for (var i = 0; i < this._panels.length; i++)
      this._panels[i].handleNewTradeEvent(index, trade, tradeHistory);

    this._lastNewTradeEvent = arguments;
  },

  handleStatisticsUpdatedEvent: function (statistics, priceVolumeHistory) {
    Logger.log('[View] Got Statistics Updated Event');
    Logger.log(statistics);
    Logger.log(priceVolumeHistory);

    for (var i = 0; i < this._panels.length; i++)
      this._panels[i].handleStatisticsUpdatedEvent(statistics, priceVolumeHistory);

    /* Update ZRX price in status bar */
    if (statistics['fees'].zrxPrice)
      $('#status-bar-zrx-price-text').text(this.formatPrice(statistics['fees'].zrxPrice));
    else
      $('#status-bar-zrx-price-text').text("N/A");

    this._lastStatisticsUpdatedEvent = arguments;
  },

  /* Button handlers */

  handleAddPanelRow: function () {
    this.panelCreate(this.domAddPanelRow(), EmptyPanel);
  },

  handleAddSplitPanelRow: function () {
    [root1, root2] = this.domAddSplitPanelRow();
    this.panelCreate(root1, EmptyPanel);
    this.panelCreate(root2, EmptyPanel);
  },

  /* Panel management */

  domAddPanelRow: function () {
    var root = $('<div></div>').addClass('panel-row');
    $('#end-of-container').before(root);
    return root;
  },

  domAddSplitPanelRow: function () {
    var root1 = $('<div></div>').addClass('col-sm-6 panel-col');
    var root2 = $('<div></div>').addClass('col-sm-6 panel-col');
    var row = $('<div></div>').addClass('row')
                .append(root1)
                .append(root2);
    $('#end-of-container').before(row);
    return [root1, root2];
  },

  panelCreate: function (dom, cls, args) {
    var panel = new cls(this, args);

    panel.create(dom);
    this._panels.push(panel);

    return panel;
  },

  panelRemove: function (panel, prune) {
    var root = panel._root;

    panel.destroy();
    this._panels.splice(this._panels.indexOf(panel), 1);

    /* Prune empty rows */
    if (prune) {
      if (root.hasClass('panel-row')) {
        root.remove();
      } else if (root.hasClass('panel-col')) {
        root = root.parent();

        if (root.find('.panel-header').length == 0)
          root.remove();
      }
    }
  },

  panelRefresh: function (panel) {
    panel.handleNewTradeEvent.apply(panel, this._lastNewTradeEvent);
    panel.handleStatisticsUpdatedEvent.apply(panel, this._lastStatisticsUpdatedEvent);
  },

  /* Formatting Helpers */

  formatDateTime: function (datetime, local) {
    var year, month, day, hours, minutes, seconds;

    if (local) {
      year = datetime.getFullYear();
      month = ((datetime.getMonth()+1) < 10) ? ("0" + (datetime.getMonth()+1)) : (datetime.getMonth()+1);
      day = (datetime.getDate() < 10) ? ("0" + datetime.getDate()) : datetime.getDate();
      hours = (datetime.getHours() < 10) ? ("0" + datetime.getHours()) : datetime.getHours();
      minutes = (datetime.getMinutes() < 10) ? ("0" + datetime.getMinutes()) : datetime.getMinutes();
      seconds = (datetime.getSeconds() < 10) ? ("0" + datetime.getSeconds()) : datetime.getSeconds();
    } else {
      year = datetime.getUTCFullYear();
      month = ((datetime.getUTCMonth()+1) < 10) ? ("0" + (datetime.getUTCMonth()+1)) : (datetime.getUTCMonth()+1);
      day = (datetime.getUTCDate() < 10) ? ("0" + datetime.getUTCDate()) : datetime.getUTCDate();
      hours = (datetime.getUTCHours() < 10) ? ("0" + datetime.getUTCHours()) : datetime.getUTCHours();
      minutes = (datetime.getUTCMinutes() < 10) ? ("0" + datetime.getUTCMinutes()) : datetime.getUTCMinutes();
      seconds = (datetime.getUTCSeconds() < 10) ? ("0" + datetime.getUTCSeconds()) : datetime.getUTCSeconds();
    }

    return year + "/" + month + "/" + day + " " + hours + ":" + minutes + ":" + seconds;
  },

  formatPrice: function (price) {
    if (this._currencyInfo)
      return this._currencyInfo.symbol + price.toFixed(this._currencyInfo.decimal_digits) + " " + this._currencyInfo.code;
    else
      return price;
  },

  formatHex: function (hex, digits) {
    digits = digits || 6;

    if (digits >= 64)
      return hex;
    else
      return hex.substring(0, 2+digits) + "...";
  },

  formatRelay: function (address, digits) {
    if (ZEROEX_RELAY_ADDRESSES[this._networkId][address]) {
      return ZEROEX_RELAY_ADDRESSES[this._networkId][address];
    } else {
      return this.formatHex(address, digits);
    }
  },

  formatToken: function (address, digits) {
    if (ZEROEX_TOKEN_INFOS[address]) {
      return ZEROEX_TOKEN_INFOS[address].symbol;
    } else {
      return this.formatHex(address, digits);
    }
  },

  formatTokenLink: function (address, digits) {
    if (ZEROEX_TOKEN_INFOS[address]) {
      return this.formatAddressLink(address, ZEROEX_TOKEN_INFOS[address].symbol);
    } else {
      return this.formatAddressLink(address, this.formatHex(address, digits));
    }
  },

  formatRelayLink: function (address, digits) {
    if (ZEROEX_RELAY_ADDRESSES[this._networkId][address]) {
      return this.formatTokenAddressLink(ZEROEX_TOKEN_ADDRESS, address, ZEROEX_RELAY_ADDRESSES[this._networkId][address]);
    } else if (web3.toDecimal(address) == 0) {
      return $("<span></span>").text("None");
    } else {
      return this.formatTokenAddressLink(ZEROEX_TOKEN_ADDRESS, address, this.formatHex(address, digits));
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

  formatTokenAddressLink: function (token, address, text, showLinkIcon) {
    var baseUrl = NETWORK_BLOCK_EXPLORER[this._networkId];

    if (baseUrl) {
      var elem = $('<a></a>')
                 .attr('href', baseUrl + "/token/" + token + "/?a=" + address)
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

  formatBlockNumberLink: function (number, showLinkIcon) {
    var baseUrl = NETWORK_BLOCK_EXPLORER[this._networkId];

    if (baseUrl) {
      var elem = $('<a></a>')
                 .attr('href', baseUrl + "/block/" + number)
                 .attr('target', '_blank')
                 .text(number);

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
