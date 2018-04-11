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

import {BigNumber} from '@0xproject/utils';
import * as moment from 'moment';

import * as $ from "jquery";
import { Chart } from 'chart.js';
/* quick hack to add missing tooltips field to chart datasets */
interface ChartDataSetsTooltips extends Chart.ChartDataSets { tooltips?: any[]; }

import * as Logger from "./logger";
import * as View from "./view";
import * as Model from "./model";
import * as Constants from "./constants";
import {Trade, Statistics, PortalOrder, OrderInfo} from "./structs";

/******************************************************************************/
/* Panel Base Class */
/******************************************************************************/

export abstract class Panel {
    static IdCounter: number = 0;

    protected _id: number;
    protected _title: String;
    protected _dom: JQuery<HTMLElement> | null;
    protected _root: JQuery<HTMLElement> | null;
    protected _view: View.View;

    constructor(view: View.View) {
        this._id = Panel.IdCounter++;
        this._title = "";
        this._view = view;
    }

    public create(root: JQuery<HTMLElement>) {
        /* Create skeleton DOM with panel header, controls, and content div */
        let dom = $(`
            <div class="row panel-header">
                <span class="anchor" id="panel-${this._id}"></span>
                <div class="panel-controls-wrapper">
                    <div class="panel-controls">
                        <a class="panel-change" href="#"><i class="icon-pencil"></i></a>
                        <a class="panel-header-link" href="#panel-${this._id}"><i class="icon-link"></i></a>
                        <a class="panel-close" href="#"><i class="icon-cancel"></i></a>
                    </div>
                </div>
                <h3>${this._title}</h3>
            </div>
            <div class="panel-content">
            </div>
        `);

        /* Associate callback for change button */
        dom.find(".panel-change")
           .click((e) => {
               e.preventDefault();
               this._view.panelChange(this);
           });

        /* Associate callback for close button */
        dom.find(".panel-close")
           .click((e) => {
               e.preventDefault();
               this._view.panelRemove(this, true);
           });

        root.append(dom);

        this._dom = dom;
        this._root = root;
    }

    public destroy() {
        if (this._dom)
            this._dom.remove();

        this._dom = null;
        this._root = null;
    }

    public getRoot(): JQuery<HTMLElement> {
        return this._root!;
    }

    /* Event handlers */

    public abstract handleStatisticsUpdated(statistics: Statistics, priceVolumeHistory: Model.PriceVolumeHistory): void;

    public abstract handleNewTrade(index: number, trade: Trade, tradeHistory: Trade[]): void;
}

export type PanelType = new (view: View.View, ...args: any[]) => Panel;

/******************************************************************************/
/* EmptyPanel */
/******************************************************************************/

export class EmptyPanel extends Panel {
    constructor(view: View.View) {
        super(view);
        this._title = "Empty Panel";
    }

    public create(root: JQuery<HTMLElement>) {
        super.create(root);

        let elem = $(`
            <div class="row empty-panel-select">
                <div class="dropdown-center">
                    <button class="btn btn-default btn-sm dropdown-toggle" type="button" data-toggle="dropdown" aria-haspopup="true">
                        Select...<span class="caret"></span>
                    </button>
                    <ul class="dropdown-menu"></ul>
                </div>
            </div>
        `);

        for (let panel of PanelList) {
            elem.find('ul').append(
                $("<li></li>")
                    .append($("<a></a>")
                              .text(panel[0])
                              .attr('href', '#')
                              .click((e) => {
                                  e.preventDefault();
                                  this.handleSelect(panel[1]);
                              }))
            );
        }

        this._root!.find('.panel-content').append(elem);
    }

    public handleSelect(cls: PanelType) {
        let root = this._root!;

        this._view.panelRemove(this, false);

        this._view.panelRefresh(this._view.panelCreate(root, cls));
    }

    /* Event handlers */

    public handleStatisticsUpdated(statistics: Statistics, priceVolumeHistory: Model.PriceVolumeHistory) { }

    public handleNewTrade(index: number, trade: Trade, tradeHistory: Trade[]) { }
}

/******************************************************************************/
/* VolumeStatisticsPanel */
/******************************************************************************/

export class VolumeStatisticsPanel extends Panel {
    constructor(view: View.View) {
        super(view);
        this._title = "Volume (24 hr)";
    }

    public create(root: JQuery<HTMLElement>) {
        super.create(root);

        let elem = $(`
            <div class="row">
                <table class="table table-condensed table-sm volume-statistics">
                    <tbody>
                    </tbody>
                </table>
            </div>
        `);

        this._root!.find('.panel-content').append(elem);
    }

    /* Event handlers */

    public handleStatisticsUpdated(statistics: Statistics, priceVolumeHistory: Model.PriceVolumeHistory) {
        /* Clear current volumes */
        this._root!.find("tr").remove();

        /* Aggregate fiat volume */
        if (statistics.volume.totalVolumeFiat.gt(0)) {
            let elem = $('<tr></tr>')
                         .append($('<th></th>')
                                   .text("Aggregate Volume"))
                         .append($('<td></td>')
                                   .text(this._view.formatPrice(statistics.volume.totalVolumeFiat)));

            this._root!.find("tbody").first().append(elem);
        }

        /* ZRX Fees */
        let totalRelayFees = statistics.fees.totalFees.toFixed(6);
        if (statistics.fees.totalFeesFiat)
            totalRelayFees += " (" + this._view.formatPrice(statistics.fees.totalFeesFiat) + ")";

        let elem = $('<tr></tr>')
                     .append($('<th></th>')
                               .append(this._view.formatTokenLink(Constants.ZEROEX_TOKEN_ADDRESS))
                               .append($("<span></span>")
                                         .text(" Relay Fees")))
                               .append($('<td></td>')
                                         .text(totalRelayFees));

        this._root!.find("tbody").first().append(elem);

        /* Token Volumes */
        let tokens = Object.keys(statistics.volume.tokens);

        /* Filter tokens by existence in registry */
        tokens = tokens.filter((token) => Constants.ZEROEX_TOKEN_INFOS[token] != undefined);

        /* Sort tokens by fiat volume */
        tokens.sort((a, b) => Number(statistics.volume.tokens[a].volumeFiat.lt(statistics.volume.tokens[b].volumeFiat)) - 0.5);

        for (let token of tokens) {
            let volume = statistics.volume.tokens[token].volume.toFixed(6);
            if (statistics.volume.tokens[token].volumeFiat.gt(0))
                volume += " (" + this._view.formatPrice(statistics.volume.tokens[token].volumeFiat) + ")";

            let elem = $('<tr></tr>')
                         .append($('<th></th>')
                                   .append(this._view.formatTokenWebsiteLink(token)))
                         .append($('<td></td>')
                                   .text(volume));
            this._root!.find("tbody").first().append(elem);
        }
    }

    public handleNewTrade(index: number, trade: Trade, tradeHistory: Trade[]) { }
}

/******************************************************************************/
/* RecentTradesPanel */
/******************************************************************************/

export class RecentTradesPanel extends Panel {
    private _tradeMoreInfos: { [key: string]: JQuery<HTMLElement> };
    private _timeLocal: boolean;
    private _priceInverted: boolean;
    private _initialized: boolean;

    constructor(view: View.View) {
        super(view);
        this._title = "Recent Trades";

        this._tradeMoreInfos = {};
    }

    public create(root: JQuery<HTMLElement>) {
        super.create(root);

        let elem = $(`
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

        elem.find('i.time-switch').click(() => { this._handleTimeSwitch(); });
        elem.find('i.price-invert').click(() => { this._handlePriceInvert(); });
        elem.find('button').click(() => { this._handleFetchMore(); });

        this._root!.find('.panel-content').append(elem);

        this._timeLocal = true;
        this._priceInverted = false;
        this._initialized = false;
    }

    private _addNewTrade(index: number, trade: Trade) {
        /* Format timestamp */
        let date = new Date(trade.timestamp*1000);
        let timestamp = $("<span></span>")
                          .append($("<span></span>")
                                    .toggle(!this._timeLocal)
                                    .addClass("time-utc")
                                    .text(this._view.formatDateTime(date, false)))
                          .append($("<span></span>")
                                    .toggle(this._timeLocal)
                                    .addClass("time-local")
                                    .text(this._view.formatDateTime(date, true)));

        /* Add relative time tooltip */
        timestamp.tooltip({title: () => moment(trade.timestamp*1000).fromNow(), placement: "right"});

        /* Format trade string */
        let swap = $("<span></span>")
                     .append($(trade.makerNormalized ? "<span></span>" : "<i></i>").text(trade.makerVolume.toDigits(6) + " "))
                     .append(this._view.formatTokenLink(trade.makerToken))
                     .append($("<span></span>").text(" ↔ "))
                     .append($(trade.takerNormalized ? "<span></span>" : "<i></i>").text(trade.takerVolume.toDigits(6) + " "))
                     .append(this._view.formatTokenLink(trade.takerToken));

        /* Prefer WETH in the numerator for non-inverted price */
        let price1, price2;

        if (Constants.ZEROEX_TOKEN_INFOS[trade.makerToken] && Constants.ZEROEX_TOKEN_INFOS[trade.makerToken].symbol == "WETH") {
            price1 = trade.mtPrice ? trade.mtPrice : null;
            price2 = trade.tmPrice ? trade.tmPrice : null;
        } else if (Constants.ZEROEX_TOKEN_INFOS[trade.takerToken] && Constants.ZEROEX_TOKEN_INFOS[trade.takerToken].symbol == "WETH") {
            price1 = trade.tmPrice ? trade.tmPrice : null;
            price2 = trade.mtPrice ? trade.mtPrice : null;
        } else {
            price1 = trade.mtPrice ? trade.mtPrice : null;
            price2 = trade.tmPrice ? trade.tmPrice : null;
        }

        /* Format price */
        let price = $("<span></span>")
                      .append($("<span></span>")
                                .toggle(!this._priceInverted)
                                .addClass("price1")
                                .text(price1 ? price1.toDigits(8).toString() : "Unknown"))
                      .append($("<span></span>")
                                .toggle(this._priceInverted)
                                .addClass("price2")
                                .text(price2 ? price2.toDigits(8).toString() : "Unknown"));

        /* Create row for trade list */
        let elem = $('<tr></tr>')
                     .addClass('trade')
                     .append($('<td></td>')            /* Expand */
                               .append($("<i></i>").addClass("icon-right-dir").addClass("more-info"))
                               .append($("<i></i>").addClass("icon-down-dir").addClass("more-info").toggle(false)))
                     .append($('<td></td>')            /* Time */
                               .append(timestamp))
                     .append($('<td></td>')            /* Transaction ID */
                               .append(this._view.formatTxidLink(trade.txid, this._view.formatHex(trade.txid, 8))))
                     .append($('<td></td>')            /* Trade */
                               .addClass('overflow')
                               .append(swap))
                     .append($('<td></td>')            /* Price */
                               .append(price))
                     .append($('<td></td>')            /* Relay */
                               .append(this._view.formatRelayLink(trade.feeAddress)))
                     .append($('<td></td>')            /* Maker Fee */
                               .addClass('overflow-sm')
                               .text(trade.makerFee.toDigits(6) + " ZRX"))
                     .append($('<td></td>')            /* Taker Fee */
                               .addClass('overflow-sm')
                               .text(trade.takerFee.toDigits(6) + " ZRX"));

        elem.find(".more-info").click(() => { this._handleClick(elem, trade); });

        /* Add to trade list */
        if (this._root!.find("table.recent-trades tbody").children().length == 0)
            this._root!.find("table.recent-trades tbody").append(elem);
        else if (index == 0)
            this._root!.find("table.recent-trades tbody tr.trade").eq(0).before(elem);
        else
            this._root!.find("table.recent-trades tbody tr.trade").eq(index-1).after(elem);
    }

    /* Event handlers */

    public handleStatisticsUpdated(statistics: Statistics, priceVolumeHistory: Model.PriceVolumeHistory) { }

    public handleNewTrade(index: number, trade: Trade, tradeHistory: Trade[]) {
        if (!this._initialized) {
            for (let i = 0; i < tradeHistory.length; i++)
                this._addNewTrade(i, tradeHistory[i]);

            this._root!.find("button.recent-trades-fetch-more").prop('disabled', false);

            this._initialized = true;
        } else {
            this._addNewTrade(index, trade);
        }
    }

    private _handleClick(dom: JQuery<HTMLElement>, trade: Trade) {
        dom.find(".more-info").toggle();

        if (this._tradeMoreInfos[trade.txid + trade.orderHash]) {
            this._tradeMoreInfos[trade.txid + trade.orderHash].toggle();
        } else {
            let table = $(`
                <table class="table table-responsive table-condensed table-sm borderless trade-more-info">
                    <tbody>
                        <tr><th>Transaction ID</th><td></td></tr>
                        <tr><th>Block Number</th><td></td></tr>
                        <tr><th>Timestamp</th><td></td></tr>
                        <tr><th>Maker Address</th><td></td></tr>
                        <tr><th>Taker Address</th><td></td></tr>
                        <tr><th>Fee Address</th><td></td></tr>
                        <tr><th>Relay</th><td></td></tr>
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
            table.find('td').eq(0).append(this._view.formatTxidLink(trade.txid, trade.txid));
            /* Block number */
            table.find('td').eq(1).append(this._view.formatBlockNumberLink(trade.blockNumber));
            /* Timestamp */
            table.find('td').eq(2).text((new Date(trade.timestamp*1000)).toUTCString());
            /* Maker Address */
            table.find('td').eq(3).append(this._view.formatAddressLink(trade.makerAddress, trade.makerAddress));
            /* Taker Address */
            table.find('td').eq(4).append(this._view.formatAddressLink(trade.takerAddress, trade.takerAddress));
            /* Fee Address */
            table.find('td').eq(5).append(this._view.formatAddressLink(trade.feeAddress, trade.feeAddress));
            /* Relay */
            table.find('td').eq(6).append(this._view.formatRelayLink(trade.relayAddress));
            /* Maker Volume/Token */
            table.find('td').eq(7).append($("<span></span>")
                                            .append($(trade.makerNormalized ? "<span></span>" : "<i></i>")
                                                      .text(trade.makerVolume + " "))
                                            .append(this._view.formatTokenLink(trade.makerToken, 64)));
            /* Taker Volume/Token */
            table.find('td').eq(8).append($("<span></span>")
                                            .append($(trade.takerNormalized ? "<span></span>" : "<i></i>")
                                                      .text(trade.takerVolume + " "))
                                            .append(this._view.formatTokenLink(trade.takerToken, 64)));
            /* Maker Fee */
            table.find('td').eq(9).text(trade.makerFee + " ZRX");
            /* Taker Fee */
            table.find('td').eq(10).text(trade.takerFee + " ZRX");
            /* Order Hash */
            table.find('td').eq(13).text(trade.orderHash);

            /* Fetch the order information */
            this.fetchOrder(table, trade);

            let elem = $('<tr></tr>')
                         .append($('<td></td>'))
                         .append($('<td></td>')
                                   .attr('colspan', 7)
                                   .append(table));

            dom.after(elem);

            this._tradeMoreInfos[trade.txid + trade.orderHash] = elem;
        }
    }

    private async fetchOrder(dom: JQuery<HTMLElement>, trade: Trade) {
        /* Fetch the order */
        let orderInfo = await this._view.handleFetchOrder(trade);

        if (orderInfo.transaction) {
            /* Render Gas */
            let gasUsed = orderInfo.transaction.gas.toString();
            let gasPrice = this._view.formatWei(orderInfo.transaction.gasPrice, 'gwei').toString();
            let gasEth = this._view.formatWei(orderInfo.transaction.gasPrice.mul(orderInfo.transaction.gas), 'ether').toString();
            dom.find('td').eq(11).text(gasUsed);
            dom.find('td').eq(12).text(gasEth + " ETH");
        }

        /* Render an error */
        if (orderInfo.error) {
            let elem = $('<b></b>').addClass('text-danger').text("Error: " + orderInfo.error);
            dom.find('td').eq(14).append(elem);
            return;
        }

        /* Render JSON */
        let elem = $('<div></div').append($('<pre></pre>').addClass('mono order-json').text(JSON.stringify(orderInfo.order, null, 2)));

        /* Add error if the order has been filled or show remaining taker amount */
        if (orderInfo.takerAmountRemaining!.eq(0)) {
            elem.append($('<div></div>').append($('<b></b>').addClass('text-danger').text("This order has already been filled.")));
        } else {
            elem.append($('<div></div>').append($('<b></b>')
                                                  .addClass('text-info')
                                                  .text("Remaining taker amount: ")
                                                  .append($(orderInfo.takerAmountRemainingNormalized ? "<span></span>" : "<i></i>")
                                                            .text(orderInfo.takerAmountRemaining + " "))
                                                  .append(this._view.formatToken(trade.takerToken, 64))
                                                  .append('.')));
        }

        /* Add warning if the order does not have an open taker */
        if (!orderInfo.isOpenTaker)
            elem.append($('<div></div>').append($('<b></b>').addClass('text-danger').text("Warning: this order has a specified taker.")));

        /* Add error if the order is expired or show expiration time */
        let expirationDate = new Date(parseInt(orderInfo.order!.expiration)*1000);
        if (orderInfo.isExpired) {
            elem.append($('<div></div>').append($('<b></b>').addClass('text-danger').text("This order expired on " + expirationDate.toUTCString() + ".")));
        } else {
            if (!isNaN(Number(expirationDate)))
                elem.append($('<div></div>').append($('<b></b>').addClass('text-info').text("This order expires on " + expirationDate.toUTCString() + ".")));
        }

        /* Add fill order button */
        elem.append($('<div></div>')
                      .addClass('fill-order')
                      .append($('<a></a>')
                                .attr('href', Constants.ZEROEX_PORTAL_URL + "/fill?order=" + encodeURIComponent(JSON.stringify(orderInfo.order)))
                                .attr('target', '_blank')
                                .addClass('btn btn-sm btn-info')
                                .toggleClass('disabled', orderInfo.takerAmountRemaining!.eq(0) || orderInfo.isExpired!)
                                .text('Fill Order')));

        dom.find('td').eq(14).append(elem);
    }

    private _handlePriceInvert() {
        this._priceInverted = !this._priceInverted;
        this._root!.find('.price1').toggle()
        this._root!.find('.price2').toggle()
    }

    private _handleTimeSwitch() {
        this._timeLocal = !this._timeLocal;
        this._root!.find('.time-utc').toggle()
        this._root!.find('.time-local').toggle()
    }

    private _handleFetchMore() {
        this._view.handleFetchMore(Constants.BLOCK_FETCH_COUNT);
    }
}

/******************************************************************************/
/* TokenVolumeChartPanel */
/******************************************************************************/

export class TokenVolumeChartPanel extends Panel {
    private _chart: Chart;

    constructor(view: View.View) {
        super(view);
        this._title = "Token Volume (24 hr)";
    }

    public create(root: JQuery<HTMLElement>) {
        super.create(root);

        let elem = $(`
            <div class="row canvas-wrapper text-center">
                <canvas width="400" height="400"></canvas>
            </div>
        `);

        this._root!.find(".panel-content").append(elem);

        let chartConfig: Chart.ChartConfiguration = {
            type: 'bar',
            options: {
                responsive: true,
                tooltips: {callbacks: {label: Constants.CHART_DEFAULT_TOOLTIP_CALLBACK}},
                legend: {display: false},
                scales: {
                    yAxes: [{ticks: <Chart.LinearTickOptions>{beginAtZero: true, callback: (value, index, values) => { this._view.formatPriceUnits(value); }}}],
                    xAxes: [{ticks: {autoSkip: false}}],
                },
            },
            data: { datasets: [<ChartDataSetsTooltips>{ backgroundColor: Constants.CHART_DEFAULT_COLORS, tooltips: [] }] }
        };
        this._chart = new Chart((elem.find('canvas')[0] as HTMLCanvasElement).getContext("2d")!, chartConfig);
    }

    /* Event handlers */

    public handleStatisticsUpdated(statistics: Statistics, priceVolumeHistory: Model.PriceVolumeHistory) {
        /* Token Volumes */
        let tokens = Object.keys(statistics.volume.tokens);

        /* Filter tokens by existence in registry */
        tokens = tokens.filter((token) => Constants.ZEROEX_TOKEN_INFOS[token] != undefined);

        /* Sort tokens by fiat volume */
        tokens.sort((a, b) => Number(statistics.volume.tokens[a].volumeFiat.lt(statistics.volume.tokens[b].volumeFiat)) - 0.5);

        /* Keep top 10 */
        tokens.splice(10);

        let tokenNames = [];
        let tokenVolumes = []
        let tokenVolumesFormatted = [];

        for (let token of tokens) {
            tokenNames.push(Constants.ZEROEX_TOKEN_INFOS[token].symbol);
            tokenVolumes.push(statistics.volume.tokens[token].volumeFiat.toNumber());
            tokenVolumesFormatted.push(this._view.formatPrice(statistics.volume.tokens[token].volumeFiat));
        }

        this._chart.data.labels = tokenNames;
        this._chart.data.datasets![0].data = tokenVolumes;
        (this._chart.data.datasets![0] as ChartDataSetsTooltips).tooltips = tokenVolumesFormatted;
        this._chart.update();
    }

    public handleNewTrade(index: number, trade: Trade, tradeHistory: Trade[]) { }
}

/******************************************************************************/
/* TokenOccurrenceChartPanel */
/******************************************************************************/

export class TokenOccurrenceChartPanel extends Panel {
    private _chart: Chart;

    constructor(view: View.View) {
        super(view);
        this._title = "Token Occurrence (24 hr)";
    }

    public create(root: JQuery<HTMLElement>) {
        super.create(root);

        let elem = $(`
            <div class="row canvas-wrapper text-center">
                <canvas width="400" height="400"></canvas>
            </div>
        `);

        this._root!.find(".panel-content").append(elem);

        let chartConfig: Chart.ChartConfiguration = {
            type: 'bar',
            options: {
                responsive: true,
                tooltips: {callbacks: {label: Constants.CHART_DEFAULT_TOOLTIP_CALLBACK}},
                legend: {display: false},
                scales: {
                    yAxes: [{ticks: <Chart.LinearTickOptions>{beginAtZero: true}, scaleLabel: {display: true, labelString: 'Trades'}}]
                },
            },
            data: { datasets: [<ChartDataSetsTooltips>{ backgroundColor: Constants.CHART_DEFAULT_COLORS, tooltips: [] }] }
        };

        this._chart = new Chart((elem.find('canvas')[0] as HTMLCanvasElement).getContext('2d')!, chartConfig);
    }

    /* Event handlers */

    public handleStatisticsUpdated(statistics: Statistics, priceVolumeHistory: Model.PriceVolumeHistory) {
        let tokens = Object.keys(statistics.volume.tokens);

        /* Count unknown tokens */
        let unknownCount = tokens.reduce(
            (acc, token) => acc + Number(Constants.ZEROEX_TOKEN_INFOS[token] == undefined && statistics.volume.tokens[token].count),
            0
        );

        /* Filter unknown tokens */
        tokens = tokens.filter((token) => Constants.ZEROEX_TOKEN_INFOS[token] != undefined);

        /* Sort tokens by count */
        tokens.sort((a, b) => statistics.volume.tokens[b].count - statistics.volume.tokens[a].count);

        let tokenNames = [];
        let tokenCounts = [];

        for (let token of tokens) {
            tokenNames.push(Constants.ZEROEX_TOKEN_INFOS[token].symbol);
            tokenCounts.push(statistics.volume.tokens[token].count);
        }

        if (unknownCount > 0) {
            tokenNames.push('Unknown');
            tokenCounts.push(unknownCount);
        }

        this._chart.data.labels = tokenNames;
        this._chart.data.datasets![0].data = tokenCounts;
        this._chart.update();

    }

    public handleNewTrade(index: number, trade: Trade, tradeHistory: Trade[]) { }
}

/******************************************************************************/
/* TokenPairsChartPanel */
/******************************************************************************/

export class TokenPairsChartPanel extends Panel {
    private _chart: Chart;

    constructor(view: View.View) {
        super(view);
        this._title = "Token Pairs (24 hr)";
    }

    public create(root: JQuery<HTMLElement>) {
        super.create(root);

        let elem = $(`
            <div class="row canvas-wrapper text-center">
                <canvas width="400" height="400"></canvas>
            </div>
        `);

        this._root!.find(".panel-content").append(elem);

        let chartConfig: Chart.ChartConfiguration = {
            type: 'bar',
            options: {
                responsive: true,
                tooltips: {callbacks: {label: Constants.CHART_DEFAULT_TOOLTIP_CALLBACK}},
                legend: {display: false},
                scales: {
                    yAxes: [{ticks: <Chart.LinearTickOptions>{beginAtZero: true, callback: (v: number) => ((v % 1) == 0) ? v : null}, scaleLabel: {display: true, labelString: 'Trades'}}],
                    xAxes: [{ticks: {autoSkip: false}}],
                },
            },
            data: { datasets: [<ChartDataSetsTooltips>{ backgroundColor: Constants.CHART_DEFAULT_COLORS, tooltips: [] }] }
        };

        this._chart = new Chart((elem.find('canvas')[0] as HTMLCanvasElement).getContext('2d')!, chartConfig);
    }

    /* Event handlers */

    public handleStatisticsUpdated(statistics: Statistics, priceVolumeHistory: Model.PriceVolumeHistory) {
    }

    public handleNewTrade(index: number, trade: Trade, tradeHistory: Trade[]) {
        let tokenPairCounts: { [key: string]: number } = {};

        let currentTimestamp = Math.round((new Date()).getTime() / 1000);
        let cutoffTimestamp = currentTimestamp - Constants.STATISTICS_TIME_WINDOW;

        for (let trade of tradeHistory) {
            if (trade.timestamp < cutoffTimestamp)
                break;

            if (trade.makerNormalized && trade.takerNormalized) {
                let symbols = [Constants.ZEROEX_TOKEN_INFOS[trade.makerToken].symbol,
                               Constants.ZEROEX_TOKEN_INFOS[trade.takerToken].symbol];
                let pair;

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

        let pairNames = Object.keys(tokenPairCounts);

        /* Sort pair names by count */
        pairNames.sort((a, b) => tokenPairCounts[b] - tokenPairCounts[a]);

        /* Keep top 10 */
        pairNames.splice(10);

        /* Assemble counts */
        let pairCounts = [];
        for (let pairName of pairNames)
            pairCounts.push(tokenPairCounts[pairName]);

        this._chart.data.labels = pairNames;
        this._chart.data.datasets![0].data = pairCounts;
        this._chart.update();
    }
}

///******************************************************************************/
///* FeeFeelessChartPanel */
///******************************************************************************/

export class FeeFeelessChartPanel extends Panel {
    private _chart: Chart;

    constructor(view: View.View) {
        super(view);
        this._title = "Fee vs. Fee-less Trades (24 hr)";
    }

    public create(root: JQuery<HTMLElement>) {
        super.create(root);

        let elem = $(`
            <div class="row canvas-wrapper text-center">
                <canvas width="400" height="400"></canvas>
            </div>
        `);

        this._root!.find(".panel-content").append(elem);

        let chartConfig: Chart.ChartConfiguration = {
            type: 'bar',
            options: {
                responsive: true,
                tooltips: {callbacks: {label: Constants.CHART_DEFAULT_TOOLTIP_CALLBACK}},
                legend: {display: false},
                scales: {
                    yAxes: [{ticks: <Chart.LinearTickOptions>{beginAtZero: true, callback: (v: number) => ((v % 1) == 0) ? v : null}, scaleLabel: {display: true, labelString: 'Trades'}}],
                    xAxes: [{barPercentage: 0.35}],
                },
            },
            data: { datasets: [<ChartDataSetsTooltips>{ backgroundColor: Constants.CHART_DEFAULT_COLORS, tooltips: [] }] }
        };

        this._chart = new Chart((elem.find('canvas')[0] as HTMLCanvasElement).getContext('2d')!, chartConfig);
    }

    /* Event handlers */

    public handleStatisticsUpdated(statistics: Statistics, priceVolumeHistory: Model.PriceVolumeHistory) {
        this._chart.data.labels = ["Fee", "Fee-less"];
        this._chart.data.datasets![0].data = [statistics.fees.feeCount, statistics.fees.feelessCount];
        this._chart.update();
    }

    public handleNewTrade(index: number, trade: Trade, tradeHistory: Trade[]) { }
}

/******************************************************************************/
/* RelayFeeChartPanel */
/******************************************************************************/

export class RelayFeeChartPanel extends Panel {
    private _chart: Chart;

    constructor(view: View.View) {
        super(view);
        this._title = "Relay Fees (24 hr)";
    }

    public create(root: JQuery<HTMLElement>) {
        super.create(root);

        let elem = $(`
            <div class="row canvas-wrapper text-center">
                <canvas width="400" height="400"></canvas>
            </div>
        `);

        this._root!.find(".panel-content").append(elem);

        let chartConfig: Chart.ChartConfiguration = {
            type: 'bar',
            options: {
                responsive: true,
                tooltips: {callbacks: {label: Constants.CHART_DEFAULT_TOOLTIP_CALLBACK}},
                legend: {display: false},
                scales: {
                    yAxes: [{ticks: <Chart.LinearTickOptions>{beginAtZero: true}, scaleLabel: {display: true, labelString: 'Fees (ZRX)'}}],
                    xAxes: [{barPercentage: 0.35}],
                },
            },
            data: { datasets: [<ChartDataSetsTooltips>{ backgroundColor: Constants.CHART_DEFAULT_COLORS, tooltips: [] }] }
        };

        this._chart = new Chart((elem.find('canvas')[0] as HTMLCanvasElement).getContext('2d')!, chartConfig);
    }

    /* Event handlers */

    public handleStatisticsUpdated(statistics: Statistics, priceVolumeHistory: Model.PriceVolumeHistory) {
        let relayAddresses = Object.keys(statistics.fees.relays);

        /* Sort relays by address */
        relayAddresses.sort();

        let relayNames = [];
        let relayFees = [];
        let relayFeesFormatted = [];

        for (let relayAddress of relayAddresses) {
            if ((new BigNumber(relayAddress, 16)).eq(0))
                continue;

            relayNames.push(this._view.formatRelay(relayAddress));
            relayFees.push(statistics.fees.relays[relayAddress].toNumber());

            let formattedFee = statistics.fees.relays[relayAddress].toDigits(6) + " ZRX"
            if (statistics.fees.zrxPrice)
                formattedFee += " (" + this._view.formatPrice(statistics.fees.relays[relayAddress].mul(statistics.fees.zrxPrice)) + ")";

            relayFeesFormatted.push(formattedFee);
        }

        this._chart.data.labels = relayNames;
        this._chart.data.datasets![0].data = relayFees;
        (this._chart.data.datasets![0] as ChartDataSetsTooltips).tooltips = relayFeesFormatted;
        this._chart.update();
    }

    public handleNewTrade(index: number, trade: Trade, tradeHistory: Trade[]) { }
}

/******************************************************************************/
/* RelayTradesChartPanel */
/******************************************************************************/

export class RelayTradesChartPanel extends Panel {
    private _chart: Chart;

    constructor(view: View.View) {
        super(view);
        this._title = "Relay Trades (24 hr)";
    }

    public create(root: JQuery<HTMLElement>) {
        super.create(root);

        let elem = $(`
            <div class="row canvas-wrapper text-center">
                <canvas width="400" height="400"></canvas>
            </div>
        `);

        this._root!.find(".panel-content").append(elem);

        let chartConfig: Chart.ChartConfiguration = {
            type: 'bar',
            options: {
                responsive: true,
                tooltips: {callbacks: {label: Constants.CHART_DEFAULT_TOOLTIP_CALLBACK}},
                legend: {display: false},
                scales: {
                    yAxes: [{ticks: <Chart.LinearTickOptions>{beginAtZero: true, callback: (v: number) => ((v % 1) == 0) ? v : null}, scaleLabel: {display: true, labelString: 'Trades'}}],
                    xAxes: [{barPercentage: 0.35}],
                },
            },
            data: { datasets: [<ChartDataSetsTooltips>{ backgroundColor: Constants.CHART_DEFAULT_COLORS, tooltips: [] }] }
        };
        this._chart = new Chart((elem.find('canvas')[0] as HTMLCanvasElement).getContext('2d')!, chartConfig);
    }

    /* Event handlers */

    public handleStatisticsUpdated(statistics: Statistics, priceVolumeHistory: Model.PriceVolumeHistory) {
        let relayAddresses = Object.keys(statistics.counts.relays);

        /* Sort relays by address */
        relayAddresses.sort();

        let relayNames = [];
        let relayTradeCounts = [];

        for (let relayAddress of relayAddresses) {
            if ((new BigNumber(relayAddress, 16)).eq(0))
                continue;

            relayNames.push(this._view.formatRelay(relayAddress));
            relayTradeCounts.push(statistics.counts.relays[relayAddress]);
        }

        this._chart.data.labels = relayNames;
        this._chart.data.datasets![0].data = relayTradeCounts;
        this._chart.update();
    }

    public handleNewTrade(index: number, trade: Trade, tradeHistory: Trade[]) { }
}

/******************************************************************************/
/* PriceChartPanel */
/******************************************************************************/

export class PriceChartPanel extends Panel {
    private _chart: Chart;
    private _tokenPair: string;

    constructor(view: View.View) {
        super(view);
        this._title = "Price Chart (24 hr)";
    }

    public create(root: JQuery<HTMLElement>) {
        super.create(root);

        let elem = $(`
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

        this._root!.find(".panel-content").append(elem);

        let chartConfig: Chart.ChartConfiguration = {
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
                    { borderDash: [5, 5], borderColor: Constants.CHART_DEFAULT_COLORS[0], fill: false, },
                ]
            }
        };

        this._chart = new Chart((this._root!.find("canvas")[0] as HTMLCanvasElement).getContext("2d")!, chartConfig);

        this.handleSelectTokenPair(Constants.PRICE_CHART_DEFAULT_PAIR);
    }

    /* Event handlers */

    public handleStatisticsUpdated(statistics: Statistics, priceVolumeHistory: Model.PriceVolumeHistory) {
        /* Update token pair list */

        this._root!.find('li').remove();

        let tokens = priceVolumeHistory.getTokens();

        for (let token of tokens) {
            this._root!.find('ul').append(
                $("<li></li>")
                  .append($("<a></a>")
                            .text(token)
                            .attr('href', '#')
                            .click((e) => {
                                e.preventDefault();
                                this.handleSelectTokenPair(token);
                                this._view.panelRefresh(this);
                            }))
            );
        }

        /* Update data */
        let currentTimestamp = moment();
        (this._chart as any).options.scales.xAxes[0].time.min = currentTimestamp.clone().subtract(Constants.STATISTICS_TIME_WINDOW, 's');
        (this._chart as any).options.scales.xAxes[0].time.max = currentTimestamp;
        this._chart.data.datasets![0].data = priceVolumeHistory.getPriceData(this._tokenPair);
        this._chart.update();
    }

    public handleNewTrade(index: number, trade: Trade, tradeHistory: Trade[]) { }

    private handleSelectTokenPair(tokenPair: string) {
        this._tokenPair = tokenPair;

        /* Update selected token pair */
        this._root!.find("span.price-chart-pair-text").text(this._tokenPair);
    }
}

/******************************************************************************/
/* List of all available panels */
/******************************************************************************/

export let PanelList: [string, PanelType][] = [
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
