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

  /* Callbacks to model */
  this.fetchMoreCallback = null;
  this.getPriceVolumeHistoryCallback = null;
};

View.prototype = {
  init: function () {
    var searchParams = new URLSearchParams(window.location.search);
    for (var key in FIAT_CURRENCY_MAP) {
      var text = FIAT_CURRENCY_MAP[key].symbol + " " + key;
      searchParams.set('cur', key);
      $('#currency-dropdown-list').append($("<li></li>").append($("<a></a>").attr("href", "?" + searchParams.toString()).text(text)));
    }

    var root1, root2;

    this.panelCreate(this.domAddPanelRow(), VolumeStatisticsPanel);
    this.panelCreate(this.domAddPanelRow(), RecentTradesPanel);
    [root1, root2] = this.domSplitPanelRow(this.domAddPanelRow());
    this.panelCreate(root1, TokenVolumeChartPanel);
    this.panelCreate(root2, TokenOccurrenceChartPanel);
    [root1, root2] = this.domSplitPanelRow(this.domAddPanelRow());
    this.panelCreate(root1, FeeFeelessChartPanel);
    this.panelCreate(root2, RelayFeeChartPanel);
    this.panelCreate(this.domAddPanelRow(), PriceChartPanel);
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

  handleNewTradeEvent: function (index, trade, tradeHistory) {
    Logger.log('[View] Got New Trade Event at index ' + index);
    Logger.log(trade);
    Logger.log(tradeHistory);

    for (var i = 0; i < this._panels.length; i++)
      this._panels[i].handleNewTradeEvent(index, trade, tradeHistory);
  },

  handleStatisticsUpdatedEvent: function (statistics, priceVolumeHistory) {
    Logger.log('[View] Got Statistics Updated Event');
    Logger.log(statistics);
    Logger.log(priceVolumeHistory);

    for (var i = 0; i < this._panels.length; i++)
      this._panels[i].handleStatisticsUpdatedEvent(statistics, priceVolumeHistory);
  },

  /* Button handlers */

  handleAddPanelRow: function () {
    this.panelCreate(this.domAddPanelRow(), EmptyPanel);
  },

  /* Panel management */

  domAddPanelRow: function () {
    var root = $('<div></div>').addClass('panel');
    $('.container').first().append(root);
    return root;
  },

  domSplitPanelRow: function (root) {
    var root1 = $('<div></div>').addClass('panel');
    var root2 = $('<div></div>').addClass('panel');
    var row = $('<div></div>')
                .addClass('row')
                .append($('<div></div>')
                          .addClass('col-sm-6')
                          .append(root1))
                .append($('<div></div>')
                          .addClass('col-sm-6')
                          .append(root2));
    root.append(row);
    return [root1, root2];
  },

  panelCreate: function (dom, cls) {
    var panel = new cls(this);
    panel.create(dom);
    this._panels.push(panel);
  },

  panelRemove: function (panel) {
    panel.destroy();
    this._panels.splice(this._panels.indexOf(panel), 1);
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
