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
  this._trades = [];
  this._priceInverted = false;
  this._priceCharts = [];
  this._panels = [];

  /* Callbacks */
  this.fetchMoreCallback = null;
  this.getPriceVolumeHistoryCallback = null;
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

  handleAddPanelRow: function () {
    this.panelCreate(this.domAddPanelRow(), EmptyPanel);
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

  /* Panel management */

  domAddPanelRow: function () {
    var panel = $('<div></div>').addClass('panel');
    $('.row').last().after(row);
    return panel;
  },

  domSplitPanelRow: function (dom) {
    var panel1 = $('<div></div>').addClass('panel');
    var panel2 = $('<div></div>').addClass('panel');
    var row = $('<div></div>')
                .addClass('row')
                .append($('<div></div>')
                          .addClass('col-sm-6')
                          .append(panel1))
                .append($('<div></div>')
                          .addClass('col-sm-6')
                          .append(panel2));
    dom.append(row);
    return [panel1, panel2];
  },

  panelCreate: function (dom, cls) {
    var panel = new cls(this);
    panel.create(dom);
    panel.initialize();
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
