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
/* Panel Base Class */
/******************************************************************************/

var PanelCounter = 0;

var Panel = function (view) {
  this._view = view;
  this._id = PanelCounter++;
  this._title = null;
  this._dom = null;
  this._root = null;
};

Panel.prototype = {
  create: function (root) {
    /* Create skeleton DOM with panel header, controls, and content div */
    var dom = $(`
      <div class="row panel-header">
        <span class="anchor" id="panel-${this._id}"></span>
        <div class="panel-controls-wrapper">
          <div class="panel-controls">
            <a class="panel-header-link" href="#panel-${this._id}"><i class="icon-link"></i></a>
            <a class="panel-close" href="#"><i class="icon-cancel"></i></a>
          </div>
        </div>
        <h3>${this._title}</h3>
      </div>
      <div class="panel-content">
      </div>
    `);

    /* Associate callback for close button */
    dom.find(".panel-close")
      .on('click', {panel: this, view: this._view}, function (e) {
        e.preventDefault();
        e.data.view.panelRemove(e.data.panel, true);
      });

    root.append(dom);

    this._dom = dom;
    this._root = root;
  },

  destroy: function () {
    this._dom.remove();
    this._dom = null;
    this._root = null;
    this._view = null;
  },

  /* Event handlers */

  handleStatisticsUpdatedEvent: function (statistics, priceVolumeHistory) {
    /* Implemented in derived classes */
  },

  handleNewTradeEvent: function (index, trade, tradeHistory) {
    /* Implemented in derived classes */
  },
};

var derive = function (base, prototype) {
  return Object.assign(Object.create(base.prototype), prototype);
}

/******************************************************************************/
/* EmptyPanel */
/******************************************************************************/

var EmptyPanel = function (view) {
  Panel.call(this, view);
  this._title = "Empty Panel";
};

EmptyPanel.prototype = derive(Panel, {
  constructor: EmptyPanel,

  create: function (root) {
    Panel.prototype.create.call(this, root);

    var elem = $(`
      <div class="row empty-panel-select">
        <div class="dropdown-center">
          <button class="btn btn-default btn-sm dropdown-toggle" type="button" data-toggle="dropdown" aria-haspopup="true">
            Select...<span class="caret"></span>
          </button>
          <ul class="dropdown-menu"></ul>
        </div>
      </div>
    `);

    var self = this;
    for (var i = 0; i < PanelList.length; i++) {
      elem.find('ul').append(
        $("<li></li>")
          .append($("<a></a>")
                    .text(PanelList[i][0])
                    .attr('href', '#')
                    .on('click', {cls: PanelList[i][1]}, function (e) {
                      e.preventDefault();
                      self.handleSelect(e.data.cls);
                    }))
      );
    }

    this._root.find('.panel-content').append(elem);
  },

  handleSelect: function (cls) {
    var root = this._root;
    var view = this._view;

    this._view.panelRemove(this);

    view.panelRefresh(view.panelCreate(root, cls));
  },
});

/******************************************************************************/
/* VolumeStatisticsPanel */
/******************************************************************************/

var VolumeStatisticsPanel = function (view) {
  Panel.call(this, view);
  this._title = "Volume (24 hr)";
};

VolumeStatisticsPanel.prototype = derive(Panel, {
  constructor: VolumeStatisticsPanel,

  create: function (root) {
    Panel.prototype.create.call(this, root);

    var elem = $(`
      <div class="row">
        <table class="table table-condensed table-sm volume-statistics">
          <tbody>
          </tbody>
        </table>
      </div>
    `);

    this._root.find('.panel-content').append(elem);
  },

  handleStatisticsUpdatedEvent: function (statistics, priceVolumeHistory) {
    /* Clear current volumes */
    this._root.find("tr").remove();

    /* Aggregate fiat volume */
    if (statistics['volume'].totalVolumeFiat.gt(0)) {
      var elem = $('<tr></tr>')
                   .append($('<th></th>')
                              .text("Aggregate Volume"))
                   .append($('<td></td>')
                              .text(this._view.formatPrice(statistics['volume'].totalVolumeFiat)));
      this._root.find("tbody").first().append(elem);
    }

    /* ZRX Fees */
    var totalRelayFees = statistics['fees'].totalFees.toFixed(6);
    if (statistics['fees'].totalFeesFiat)
      totalRelayFees += " (" + this._view.formatPrice(statistics['fees'].totalFeesFiat) + ")";

    var elem = $('<tr></tr>')
                 .append($('<th></th>')
                            .append(this._view.formatTokenLink(ZEROEX_TOKEN_ADDRESS))
                            .append($("<span></span>")
                                      .text(" Relay Fees")))
                 .append($('<td></td>')
                           .text(totalRelayFees));
    this._root.find("tbody").first().append(elem);

    /* Token Volumes */
    var tokens = Object.keys(statistics['volume'].tokens);

    /* Filter tokens by existence in registry */
    tokens = tokens.filter(function (token) { return ZEROEX_TOKEN_INFOS[token] != undefined; });

    /* Sort tokens by fiat volume */
    tokens.sort(function (a, b) {
        return statistics['volume'].tokens[a].volumeFiat.lt(statistics['volume'].tokens[b].volumeFiat) - 0.5;
    });

    for (var i = 0; i < tokens.length; i++) {
      var volume = statistics['volume'].tokens[tokens[i]].volume.toFixed(6);
      if (statistics['volume'].tokens[tokens[i]].volumeFiat.gt(0))
        volume += " (" + this._view.formatPrice(statistics['volume'].tokens[tokens[i]].volumeFiat) + ")";

      var elem = $('<tr></tr>')
                   .append($('<th></th>')
                            .append(this._view.formatTokenLink(tokens[i])))
                   .append($('<td></td>')
                             .text(volume));
      this._root.find("tbody").first().append(elem);
    }
  },
});

/******************************************************************************/
/* RecentTradesPanel */
/******************************************************************************/

var RecentTradesPanel = function (view) {
  Panel.call(this, view);
  this._title = "Recent Trades";

  this._tradeMoreInfos = {};
};

RecentTradesPanel.prototype = derive(Panel, {
  constructor: RecentTradesPanel,

  create: function (root) {
    Panel.prototype.create.call(this, root);

    var elem = $(`
      <div class="row">
        <table class="table table-responsive table-condensed table-sm recent-trades">
          <thead>
            <tr>
              <th></th>
              <th>Time (<span class="time-utc" style="display:none">UTC</span><span class="time-local">Local</span><i class="icon-exchange time-switch"></i>)</th>
              <th>Txid</th>
              <th>Trade</th>
              <th>Price (<i class="icon-exchange price-invert"></i>)</th>
              <th>Relay</th>
              <th>Maker Fee</th>
              <th>Taker Fee</th>
            </tr>
          </thead>
          <tbody>
          </tbody>
        </table>
      </div>
      <div class="row">
        <div class="text-center">
          <button type="button" class="btn btn-sm btn-info recent-trades-fetch-more" disabled>Fetch more...</button>
        </div>
      </div>
    `);

    elem.find('i.time-switch').click(this.handleTimeSwitch.bind(this));
    elem.find('i.price-invert').click(this.handlePriceInvert.bind(this));
    elem.find('button').click(this.handleFetchMore.bind(this));

    this._root.find('.panel-content').append(elem);

    this._timeLocal = true;
    this._priceInverted = false;
    this._initialized = false;
  },

  handleNewTradeEvent: function (index, trade, tradeHistory) {
    if (!this._initialized) {
      for (var i = 0; i < tradeHistory.length; i++)
        this.addNewTrade(i, tradeHistory[i]);

      this._root.find("button.recent-trades-fetch-more").prop('disabled', false);

      this._initialized = true;
    } else {
      this.addNewTrade(index, trade);
    }
  },

  addNewTrade: function (index, trade) {
    /* Format timestamp */
    var timestamp = new Date(trade.timestamp*1000);
    var timestamp = $("<span></span>")
                      .append($("<span></span>")
                                .toggle(!this._timeLocal)
                                .addClass("time-utc")
                                .text(this._view.formatDateTime(timestamp, false)))
                      .append($("<span></span>")
                                .toggle(this._timeLocal)
                                .addClass("time-local")
                                .text(this._view.formatDateTime(timestamp, true)));

    /* Add relative time tooltip */
    timestamp.tooltip({title: function () { return moment(trade.timestamp*1000).fromNow() }, placement: "right"});

    /* Format trade string */
    var swap = $("<span></span>")
                .append($(trade.makerNormalized ? "<span></span>" : "<i></i>").text(trade.makerVolume.toDigits(6) + " "))
                .append(this._view.formatTokenLink(trade.makerToken))
                .append($("<span></span>").text(" ↔ "))
                .append($(trade.takerNormalized ? "<span></span>" : "<i></i>").text(trade.takerVolume.toDigits(6) + " "))
                .append(this._view.formatTokenLink(trade.takerToken));

    /* Prefer WETH in the numerator for non-inverted price */
    if (ZEROEX_TOKEN_INFOS[trade.makerToken] && ZEROEX_TOKEN_INFOS[trade.makerToken].symbol == "WETH") {
      var price1 = trade.mtPrice ? trade.mtPrice : null;
      var price2 = trade.tmPrice ? trade.tmPrice : null;
    } else if (ZEROEX_TOKEN_INFOS[trade.takerToken] && ZEROEX_TOKEN_INFOS[trade.takerToken].symbol == "WETH") {
      var price1 = trade.tmPrice ? trade.tmPrice : null;
      var price2 = trade.mtPrice ? trade.mtPrice : null;
    } else {
      var price1 = trade.mtPrice ? trade.mtPrice : null;
      var price2 = trade.tmPrice ? trade.tmPrice : null;
    }

    /* Format price */
    var price = $("<span></span>")
                  .append($("<span></span>")
                            .toggle(!this._priceInverted)
                            .addClass("price1")
                            .text(price1 ? price1.toDigits(8) : "Unknown"))
                  .append($("<span></span>")
                            .toggle(this._priceInverted)
                            .addClass("price2")
                            .text(price2 ? price2.toDigits(8) : "Unknown"));

    /* Create row for trade list */
    var elem = $('<tr></tr>')
                .addClass('trade')
                .append($('<td></td>')      /* Expand */
                          .append($("<i></i>").addClass("icon-right-dir").addClass("more-info"))
                          .append($("<i></i>").addClass("icon-down-dir").addClass("more-info").toggle(false)))
                .append($('<td></td>')      /* Time */
                          .html(timestamp))
                .append($('<td></td>')      /* Transaction ID */
                          .html(this._view.formatTxidLink(trade.txid, this._view.formatHex(trade.txid, 8))))
                .append($('<td></td>')      /* Trade */
                          .addClass('overflow')
                          .html(swap))
                .append($('<td></td>')      /* Price */
                          .html(price))
                .append($('<td></td>')      /* Relay Address */
                          .html(this._view.formatRelayLink(trade.relayAddress)))
                .append($('<td></td>')      /* Maker Fee */
                          .addClass('overflow-sm')
                          .text(trade.makerFee.toDigits(6) + " ZRX"))
                .append($('<td></td>')      /* Taker Fee */
                          .addClass('overflow-sm')
                          .text(trade.takerFee.toDigits(6) + " ZRX"));

    elem.find(".more-info").click(this.handleClick.bind(this, elem, trade));

    /* Add to trade list */
    if (this._root.find("table.recent-trades tbody").children().length == 0)
      this._root.find("table.recent-trades tbody").append(elem);
    else if (index == 0)
      this._root.find("table.recent-trades tbody tr.trade").eq(0).before(elem);
    else
      this._root.find("table.recent-trades tbody tr.trade").eq(index-1).after(elem);
  },

  handleClick: function (dom, trade) {
    dom.find(".more-info").toggle();

    if (this._tradeMoreInfos[trade.txid + trade.orderHash]) {
      this._tradeMoreInfos[trade.txid + trade.orderHash].toggle();
    } else {
      var table = $(`
        <table class="table table-responsive table-condensed table-sm borderless trade-more-info">
          <tbody>
            <tr><th>Transaction ID</th><td></td></tr>
            <tr><th>Block Number</th><td></td></tr>
            <tr><th>Timestamp</th><td></td></tr>
            <tr><th>Maker Address</th><td></td></tr>
            <tr><th>Taker Address</th><td></td></tr>
            <tr><th>Relay Address</th><td></td></tr>
            <tr><th>Maker Amount</th><td></td></tr>
            <tr><th>Taker Amount</th><td></td></tr>
            <tr><th>Maker Fee</th><td></td></tr>
            <tr><th>Taker Fee</th><td></td></tr>
            <tr><th>Gas Used</th><td></td></tr>
            <tr><th>Tx Fee</th><td></td></tr>
            <tr><th>Order Hash</th><td></td></tr>
            <tr><th>Order JSON</th><td></td></tr>
          </tbody>
        </table>
      `);

      /* Transaction ID */
      table.find('td').eq(0).html(this._view.formatTxidLink(trade.txid, trade.txid));
      /* Block number */
      table.find('td').eq(1).html(this._view.formatBlockNumberLink(trade.blockNumber));
      /* Timestamp */
      table.find('td').eq(2).text((new Date(trade.timestamp*1000)).toUTCString());
      /* Maker Address */
      table.find('td').eq(3).html(this._view.formatAddressLink(trade.makerAddress, trade.makerAddress));
      /* Taker Address */
      table.find('td').eq(4).html(this._view.formatAddressLink(trade.takerAddress, trade.takerAddress));
      /* Relay Address */
      table.find('td').eq(5).html(this._view.formatRelayLink(trade.relayAddress, 64));
      /* Maker Volume/Token */
      table.find('td').eq(6).html($("<span></span>")
                                    .append($(trade.makerNormalized ? "<span></span>" : "<i></i>")
                                              .text(trade.makerVolume + " "))
                                    .append(this._view.formatTokenLink(trade.makerToken, 64)));
      /* Taker Volume/Token */
      table.find('td').eq(7).html($("<span></span>")
                                    .append($(trade.takerNormalized ? "<span></span>" : "<i></i>")
                                              .text(trade.takerVolume + " "))
                                    .append(this._view.formatTokenLink(trade.takerToken, 64)));
      /* Maker Fee */
      table.find('td').eq(8).text(trade.makerFee + " ZRX");
      /* Taker Fee */
      table.find('td').eq(9).text(trade.takerFee + " ZRX");
      /* Order Hash */
      table.find('td').eq(12).text(trade.orderHash);

      /* Fetch the order information */
      this.fetchOrder(table, trade);

      var elem = $('<tr></tr>')
                  .append($('<td></td>'))
                  .append($('<td></td>')
                            .attr('colspan', 7)
                            .append(table));

      dom.after(elem);
      this._tradeMoreInfos[trade.txid + trade.orderHash] = elem;
    }
  },

  fetchOrder: function (dom, trade) {
    var self = this;
    this._view.fetchOrderCallback(trade).then(function (result) {
      if (result.transaction) {
        /* Render Gas */
        var gasUsed = result.transaction.gas.toString();
        var gasPrice = web3.fromWei(result.transaction.gasPrice.toString(), 'gwei').toString();
        var gasEth = web3.fromWei(result.transaction.gasPrice.mul(result.transaction.gas), 'ether').toString();
        dom.find('td').eq(10).text(gasUsed);
        dom.find('td').eq(11).text(gasEth + " ETH");
      }

      /* Render an error */
      if (result.error) {
        var elem = $('<b></b>').addClass('text-danger').text("Error: " + result.error);
        dom.find('td').eq(13).html(elem);
        return;
      }

      /* Render JSON */
      var elem = $('<div></div').append($('<pre></pre>').addClass('mono order-json').text(JSON.stringify(result.order, null, 2)));

      /* Add error if the order has been filled or show remaining taker amount */
      if (result.takerAmountRemaining.eq(0)) {
        elem.append($('<div></div>').append($('<b></b>').addClass('text-danger').text("This order has already been filled.")));
      } else {
        elem.append($('<div></div>').append($('<b></b>')
                                              .addClass('text-info')
                                              .text("Remaining taker amount: ")
                                              .append($(result.takerAmountRemainingNormalized ? "<span></span>" : "<i></i>")
                                                        .text(result.takerAmountRemaining + " "))
                                              .append(self._view.formatToken(trade.takerToken, 64))
                                              .append('.')));
      }

      /* Add warning if the order does not have an open taker */
      if (!result.isOpenTaker)
        elem.append($('<div></div>').append($('<b></b>').addClass('text-danger').text("Warning: this order has a specified taker.")));

      /* Add error if the order is expired or show expiration time */
      var expirationDate = new Date(parseInt(result.order.expiration)*1000);
      if (result.isExpired) {
        elem.append($('<div></div>').append($('<b></b>').addClass('text-danger').text("This order expired on " + expirationDate.toUTCString() + ".")));
      } else {
        if (!isNaN(expirationDate))
          elem.append($('<div></div>').append($('<b></b>').addClass('text-info').text("This order expires on " + expirationDate.toUTCString() + ".")));
      }

      /* Add fill order button */
      elem.append($('<div></div>')
                    .addClass('fill-order')
                    .append($('<a></a>')
                              .attr('href', ZEROEX_PORTAL_URL + "/fill?order=" + encodeURIComponent(JSON.stringify(result.order)))
                              .attr('target', '_blank')
                              .addClass('btn btn-sm btn-info')
                              .toggleClass('disabled', result.takerAmountRemaining.eq(0) || result.isExpired)
                              .text('Fill Order')));

      dom.find('td').eq(13).html(elem);
    });
  },

  handlePriceInvert: function () {
    this._priceInverted = !this._priceInverted;
    this._root.find('.price1').toggle()
    this._root.find('.price2').toggle()
  },

  handleTimeSwitch: function () {
    this._timeLocal = !this._timeLocal;
    this._root.find('.time-utc').toggle()
    this._root.find('.time-local').toggle()
  },

  handleFetchMore: function () {
    this._view.fetchMoreCallback(BLOCK_FETCH_COUNT);
  },
});

/******************************************************************************/
/* TokenVolumeChartPanel */
/******************************************************************************/

var TokenVolumeChartPanel = function (view) {
  Panel.call(this, view);
  this._title = "Token Volume (24 hr)";
};

TokenVolumeChartPanel.prototype = derive(Panel, {
  constructor: TokenVolumeChartPanel,

  create: function (root) {
    Panel.prototype.create.call(this, root);

    var elem = $(`
      <div class="row canvas-wrapper text-center">
        <canvas width="400" height="400"></canvas>
      </div>
    `);

    this._root.find(".panel-content").append(elem);

    var chartConfig = {
      type: 'bar',
      options: {
        responsive: true,
        tooltips: {callbacks: {label: CHART_DEFAULT_TOOLTIP_CALLBACK}},
        legend: {display: false},
        scales: {yAxes: [{ticks: {callback: this._view.formatPriceUnits.bind(this._view)}}]},
      },
      data: { datasets: [{ backgroundColor: CHART_DEFAULT_COLORS, tooltips: [] }] }
    };
    this._chart = new Chart(elem.find('canvas')[0].getContext('2d'), chartConfig);
  },

  handleStatisticsUpdatedEvent: function (statistics, priceVolumeHistory) {
    /* Token Volumes */
    var tokens = Object.keys(statistics['volume'].tokens);

    /* Filter tokens by existence in registry */
    tokens = tokens.filter(function (token) { return ZEROEX_TOKEN_INFOS[token] != undefined; });

    /* Sort tokens by fiat volume */
    tokens.sort(function (a, b) {
        return statistics['volume'].tokens[a].volumeFiat.lt(statistics['volume'].tokens[b].volumeFiat) - 0.5;
    });

    var tokenNames = [];
    var tokenVolumes = []
    var tokenVolumesFormatted = [];

    for (var i = 0; i < tokens.length; i++) {
      tokenNames.push(ZEROEX_TOKEN_INFOS[tokens[i]].symbol);
      tokenVolumes.push(statistics['volume'].tokens[tokens[i]].volumeFiat.toNumber());
      tokenVolumesFormatted.push(this._view.formatPrice(statistics['volume'].tokens[tokens[i]].volumeFiat));
    }

    this._chart.data.labels = tokenNames;
    this._chart.data.datasets[0].data = tokenVolumes;
    this._chart.data.datasets[0].tooltips = tokenVolumesFormatted;
    this._chart.update();
  },
});

/******************************************************************************/
/* TokenOccurrenceChartPanel */
/******************************************************************************/

var TokenOccurrenceChartPanel = function (view) {
  Panel.call(this, view);
  this._title = "Token Occurrence (24 hr)";
};

TokenOccurrenceChartPanel.prototype = derive(Panel, {
  constructor: TokenOccurrenceChartPanel,

  create: function (root) {
    Panel.prototype.create.call(this, root);

    var elem = $(`
      <div class="row canvas-wrapper text-center">
        <canvas width="400" height="400"></canvas>
      </div>
    `);

    this._root.find(".panel-content").append(elem);

    var chartConfig = {
      type: 'bar',
      options: {responsive: true, tooltips: {callbacks: {label: CHART_DEFAULT_TOOLTIP_CALLBACK}}, legend: {display: false}},
      data: { datasets: [{ backgroundColor: CHART_DEFAULT_COLORS, tooltips: [] }] }
    };
    this._chart = new Chart(elem.find('canvas')[0].getContext('2d'), chartConfig);
  },

  handleStatisticsUpdatedEvent: function (statistics, priceVolumeHistory) {
    var tokens = Object.keys(statistics['volume'].tokens);

    /* Sort tokens by address */
    tokens.sort();

    var tokenNames = [];
    var tokenCounts = [];
    var unknownCount = 0;

    for (var i = 0; i < tokens.length; i++) {
      if (ZEROEX_TOKEN_INFOS[tokens[i]]) {
        tokenNames.push(ZEROEX_TOKEN_INFOS[tokens[i]].symbol);
        tokenCounts.push(statistics['volume'].tokens[tokens[i]].count);
      } else {
        unknownCount += 1;
      }
    }

    tokenNames.push('Unknown');
    tokenCounts.push(unknownCount);

    this._chart.data.labels = tokenNames;
    this._chart.data.datasets[0].data = tokenCounts;
    this._chart.update();
  },
});

/******************************************************************************/
/* TokenPairsChartPanel */
/******************************************************************************/

var TokenPairsChartPanel = function (view) {
  Panel.call(this, view);
  this._title = "Token Pairs (24 hr)";
};

TokenPairsChartPanel.prototype = derive(Panel, {
  constructor: TokenPairsChartPanel,

  create: function (root) {
    Panel.prototype.create.call(this, root);

    var elem = $(`
      <div class="row canvas-wrapper text-center">
        <canvas width="400" height="400"></canvas>
      </div>
    `);

    this._root.find(".panel-content").append(elem);

    var chartConfig = {
      type: 'bar',
      options: {responsive: true, tooltips: {callbacks: {label: CHART_DEFAULT_TOOLTIP_CALLBACK}}, legend: {display: false}},
      data: { datasets: [{ backgroundColor: CHART_DEFAULT_COLORS, tooltips: [] }] }
    };
    this._chart = new Chart(elem.find('canvas')[0].getContext('2d'), chartConfig);
  },

  handleNewTradeEvent: function (index, trade, tradeHistory) {
    var tokenPairCounts = {};

    for (var i = 0; i < tradeHistory.length; i++) {
      if (tradeHistory[i].makerNormalized && tradeHistory[i].takerNormalized) {
        var symbols = [ZEROEX_TOKEN_INFOS[tradeHistory[i].makerToken].symbol,
                       ZEROEX_TOKEN_INFOS[tradeHistory[i].takerToken].symbol];
        var pair;

        /* Assemble pair, preferring WETH as base currency */
        if (symbols[0] == "WETH")
          pair = symbols[1] + "/" + symbols[0];
        else if (symbols[1] == "WETH")
          pair = symbols[0] + "/" + symbols[1];
        else if (symbols[0] < symbols[1])
          pair = symbols[0] + "/" + symbols[1];
        else
          pair = symbols[1] + "/" + symbols[0];

        if (tokenPairCounts[pair])
          tokenPairCounts[pair] += 1;
        else
          tokenPairCounts[pair] = 1;
      }
    }

    var pairNames = Object.keys(tokenPairCounts);

    /* Sort pair names by count */
    var foo = pairNames.sort(function (a, b) {
      return tokenPairCounts[b] - tokenPairCounts[a];
    });

    var pairCounts = [];

    for (var i = 0; i < pairNames.length; i++) {
      pairCounts.push(tokenPairCounts[pairNames[i]]);
    }

    this._chart.data.labels = pairNames;
    this._chart.data.datasets[0].data = pairCounts;
    this._chart.update();
  },
});

/******************************************************************************/
/* FeeFeelessChartPanel */
/******************************************************************************/

var FeeFeelessChartPanel = function (view) {
  Panel.call(this, view);
  this._title = "Fee vs. Fee-less Trades (24 hr)";
};

FeeFeelessChartPanel.prototype = derive(Panel, {
  constructor: FeeFeelessChartPanel,

  create: function (root) {
    Panel.prototype.create.call(this, root);

    var elem = $(`
      <div class="row canvas-wrapper text-center">
        <canvas width="400" height="400"></canvas>
      </div>
    `);

    this._root.find(".panel-content").append(elem);

    var chartConfig = {
      type: 'bar',
      options: {responsive: true, tooltips: {callbacks: {label: CHART_DEFAULT_TOOLTIP_CALLBACK}}, legend: {display: false}},
      data: { datasets: [{ backgroundColor: CHART_DEFAULT_COLORS, tooltips: [] }] }
    };
    this._chart = new Chart(elem.find('canvas')[0].getContext('2d'), chartConfig);
  },

  handleStatisticsUpdatedEvent: function (statistics, priceVolumeHistory) {
    this._chart.data.labels = ["Fee", "Fee-less"];
    this._chart.data.datasets[0].data = [statistics['fees'].feeCount, statistics['fees'].feelessCount];
    this._chart.update();
  },
});

/******************************************************************************/
/* RelayFeeChartPanel */
/******************************************************************************/

var RelayFeeChartPanel = function (view) {
  Panel.call(this, view);
  this._title = "Relay Fees (24 hr)";
};

RelayFeeChartPanel.prototype = derive(Panel, {
  constructor: RelayFeeChartPanel,

  create: function (root) {
    Panel.prototype.create.call(this, root);

    var elem = $(`
      <div class="row canvas-wrapper text-center">
        <canvas width="400" height="400"></canvas>
      </div>
    `);

    this._root.find(".panel-content").append(elem);

    var chartConfig = {
      type: 'bar',
      options: {
        responsive: true,
        tooltips: {callbacks: {label: CHART_DEFAULT_TOOLTIP_CALLBACK}},
        legend: {display: false},
        scales: {yAxes: [{ticks: {beginAtZero: true}}]},
      },
      data: { datasets: [{ backgroundColor: CHART_DEFAULT_COLORS, tooltips: [] }] }
    };
    this._chart = new Chart(elem.find('canvas')[0].getContext('2d'), chartConfig);
  },

  handleStatisticsUpdatedEvent: function (statistics, priceVolumeHistory) {
    var relayAddresses = Object.keys(statistics['fees'].relays);

    /* Sort relays by address */
    relayAddresses.sort();

    var relayNames = [];
    var relayFees = [];
    var relayFeesFormatted = [];

    for (var i = 0; i < relayAddresses.length; i++) {
      if (web3.toDecimal(relayAddresses[i]) == 0)
        continue;

      relayNames.push(this._view.formatRelay(relayAddresses[i]));
      relayFees.push(statistics['fees'].relays[relayAddresses[i]].toNumber());

      var formattedFee = statistics['fees'].relays[relayAddresses[i]].toDigits(6) + " ZRX"
      if (statistics['fees'].zrxPrice)
        formattedFee += " (" + this._view.formatPrice(statistics['fees'].relays[relayAddresses[i]].mul(statistics['fees'].zrxPrice)) + ")";

      relayFeesFormatted.push(formattedFee);
    }

    this._chart.data.labels = relayNames;
    this._chart.data.datasets[0].data = relayFees;
    this._chart.data.datasets[0].tooltips = relayFeesFormatted;
    this._chart.update();
  },
});

/******************************************************************************/
/* RelayTradesChartPanel */
/******************************************************************************/

var RelayTradesChartPanel = function (view) {
  Panel.call(this, view);
  this._title = "Relay Trades (24 hr)";
};

RelayTradesChartPanel.prototype = derive(Panel, {
  constructor: RelayTradesChartPanel,

  create: function (root) {
    Panel.prototype.create.call(this, root);

    var elem = $(`
      <div class="row canvas-wrapper text-center">
        <canvas width="400" height="400"></canvas>
      </div>
    `);

    this._root.find(".panel-content").append(elem);

    var chartConfig = {
      type: 'bar',
      options: {
        responsive: true,
        tooltips: {callbacks: {label: CHART_DEFAULT_TOOLTIP_CALLBACK}},
        legend: {display: false},
        scales: {yAxes: [{ticks: {beginAtZero: true}}]},
      },
      data: { datasets: [{ backgroundColor: CHART_DEFAULT_COLORS, tooltips: [] }] }
    };
    this._chart = new Chart(elem.find('canvas')[0].getContext('2d'), chartConfig);
  },

  handleStatisticsUpdatedEvent: function (statistics, priceVolumeHistory) {
    var relayAddresses = Object.keys(statistics['counts'].relays);

    /* Sort relays by address */
    relayAddresses.sort();

    var relayNames = [];
    var relayTradeCounts = [];

    for (var i = 0; i < relayAddresses.length; i++) {
      if (web3.toDecimal(relayAddresses[i]) == 0)
        continue;

      relayNames.push(this._view.formatRelay(relayAddresses[i]));
      relayTradeCounts.push(statistics['counts'].relays[relayAddresses[i]]);
    }

    this._chart.data.labels = relayNames;
    this._chart.data.datasets[0].data = relayTradeCounts;
    this._chart.update();
  },
});

/******************************************************************************/
/* PriceChartPanel */
/******************************************************************************/

var PriceChartPanel = function (view) {
  Panel.call(this, view);
  this._title = "Price Chart (24 hr)";
};

PriceChartPanel.prototype = derive(Panel, {
  constructor: PriceChartPanel,

  create: function (root) {
    Panel.prototype.create.call(this, root);

    var elem = $(`
      <div class="row">
        <div class="dropdown-center">
          <button class="btn btn-default btn-sm dropdown-toggle" type="button" data-toggle="dropdown" aria-haspopup="true">
            <span class="price-chart-pair-text"></span>
            <span class="caret"></span>
          </button>
          <ul class="dropdown-menu" aria-labelledby="price-chart-pair-${this._id}"></ul>
        </div>
      </div>
      <div class="row canvas-wrapper text-center">
        <canvas width="800" height="400"></canvas>
      </div>
    `);

    this._root.find(".panel-content").append(elem);

    var chartConfig = {
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
          { borderDash: [5, 5], borderColor: CHART_DEFAULT_COLORS[0], fill: false, },
        ]
      }
    };
    this._chart = new Chart(this._root.find("canvas")[0].getContext('2d'), chartConfig);

    this.handleSelectTokenPair(PRICE_CHART_DEFAULT_PAIR);
  },

  handleStatisticsUpdatedEvent: function (statistics, priceVolumeHistory) {
    /* Update token pair list */
    var self = this;
    this._root.find('li').remove();
    for (var j = 0; j < priceVolumeHistory.tokens.length; j++) {
      this._root.find('ul').append(
        $("<li></li>")
          .append($("<a></a>")
                    .text(priceVolumeHistory.tokens[j])
                    .attr('href', '#')
                    .on('click', {pair: priceVolumeHistory.tokens[j]}, function (e) {
                      e.preventDefault();
                      self.handleSelectTokenPair(e.data.pair);
                      self._view.panelRefresh(self);
                    }))
      );
    }

    /* Update data */
    var currentTimestamp = moment();
    this._chart.options.scales.xAxes[0].time.min = currentTimestamp.clone().subtract(STATISTICS_TIME_WINDOW, 's');
    this._chart.options.scales.xAxes[0].time.max = currentTimestamp;
    this._chart.data.datasets[0].data = priceVolumeHistory.getPriceData(this._tokenPair);
    this._chart.update();
  },

  handleSelectTokenPair: function (tokenPair) {
    this._tokenPair = tokenPair;

    /* Update selected token pair */
    this._root.find("span.price-chart-pair-text").text(this._tokenPair);
  },
});

/******************************************************************************/
/* List of all available panels */
/******************************************************************************/

PanelList = [
  ["Volume", VolumeStatisticsPanel],
  ["Recent Trades", RecentTradesPanel],
  ["Token Volume Chart", TokenVolumeChartPanel],
  ["Token Occurrence Chart", TokenOccurrenceChartPanel],
  ["Token Pairs Chart", TokenPairsChartPanel],
  ["Fee vs. Feeless Chart", FeeFeelessChartPanel],
  ["Relay Fee Chart", RelayFeeChartPanel],
  ["Relay Trades Chart", RelayTradesChartPanel],
  ["Price Chart", PriceChartPanel],
];
