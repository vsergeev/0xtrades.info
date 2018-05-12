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
import * as Web3 from 'web3';
import * as $ from "jquery";
import "bootstrap";

import * as Logger from "./logger";
import * as Model from "./model";
import * as Constants from "./constants";
import * as Panels from "./panels";
import {Trade, Statistics, PortalOrder, OrderInfo} from "./structs";

/******************************************************************************/
/* View */
/******************************************************************************/

export interface ViewEvents {
    onFetchMore(count: number): void;
    onFetchOrder(trade: Trade): Promise<OrderInfo>;
}

export class View {
    /* web3 interface */
    private _web3: Web3;

    /* Network status / Configuration */
    private _networkId: number;
    private _fiatCurrencyInfo: Constants.CurrencyInfo;

    /* Callbacks */
    private _callbacks: ViewEvents;

    /* Panels */
    private _panels: Panels.Panel[];

    /* Last event state */
    private _lastNewTradeEvent: [number, Trade, Trade[]];
    private _lastStatisticsUpdatedEvent: [Statistics, Model.PriceVolumeHistory];

    constructor(web3: Web3, fiatCurrencyInfo: Constants.CurrencyInfo) {
        this._web3 = web3;
        this._networkId = 0;
        this._fiatCurrencyInfo = fiatCurrencyInfo;
        this._panels = [];
    }

    public async init() {
        /* Absorb current URL parameters as a template */
        let searchParams = new URLSearchParams(window.location.search);

        /* Populate currency drop down setting */
        for (let key in Constants.FIAT_CURRENCY_MAP) {
            let text = Constants.FIAT_CURRENCY_MAP[key].symbol + " " + key;
            searchParams.set('cur', key);
            $('#currency-dropdown-list').append($("<li></li>").append($("<a></a>").attr("href", "?" + searchParams.toString()).text(text)));
        }

        /* Update selected currency text */
        $('#currency-dropdown-text').text(this._fiatCurrencyInfo.symbol + " " + this._fiatCurrencyInfo.code);

        $('#add-panel-row-button').click(() => { this.handleAddPanelRow(); });
        $('#add-split-panel-row-button').click(() => {this.handleAddSplitPanelRow(); });

        let root1, root2;

        [root1, root2] = this.domAddSplitPanelRow();
        this.panelCreate(root1, Panels.VolumeStatisticsPanel);
        this.panelCreate(root2, Panels.TokenVolumeChartPanel);
        this.panelCreate(this.domAddPanelRow(), Panels.RecentTradesPanel);
        [root1, root2] = this.domAddSplitPanelRow();
        this.panelCreate(root1, Panels.FeeFeelessChartPanel);
        this.panelCreate(root2, Panels.TokenPairsChartPanel);
        [root1, root2] = this.domAddSplitPanelRow();
        this.panelCreate(root1, Panels.RelayFeeChartPanel);
        this.panelCreate(root2, Panels.RelayTradesChartPanel);
        this.panelCreate(this.domAddPanelRow(), Panels.PriceChartPanel);
    }

    public bindCallbacks(callbacks: ViewEvents) {
        this._callbacks = callbacks;
    }

    /* Event update handlers */

    public handleConnected(error: Model.ModelError | null, networkId?: number) {
        Logger.log('[View] Got Connected Event');
        Logger.log('[View] Network ID: ' + networkId + ' Error: ' + error);

        let networkName: string;

        if (networkId) {
            this._networkId = networkId;
            networkName = Constants.NETWORK_NAME[this._networkId] || ("Unknown (" + this._networkId + ")");
        } else {
            networkName = "None";
        }

        if (error === null) {
            $('#status-bar-network')
                .append($('<b></b>')
                    .append(this.formatAddressLink(Constants.ZEROEX_EXCHANGE_ADDRESS, networkName, true)));

            $('#loading-modal').modal('show');
        } else if (error === Model.ModelError.UNSUPPORTED_NETWORK) {
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
    }

    public handleFetching(count: number, done: boolean) {
        if (!done)
            $('#loading-modal .progress-bar').text(count);
        else
            $('#loading-modal').modal('hide');
    }

    public handleNewTrade(index: number, trade: Trade, tradeHistory: Trade[]) {
        Logger.log('[View] Got New Trade Event at index ' + index);
        Logger.log(trade);
        Logger.log(tradeHistory);

        for (let panel of this._panels)
            panel.handleNewTrade(index, trade, tradeHistory);

        this._lastNewTradeEvent = [index, trade, tradeHistory];
    }

    public handleStatisticsUpdated(statistics: Statistics, priceVolumeHistory: Model.PriceVolumeHistory) {
        Logger.log('[View] Got Statistics Updated Event');
        Logger.log(statistics);
        Logger.log(priceVolumeHistory);

        for (let panel of this._panels)
            panel.handleStatisticsUpdated(statistics, priceVolumeHistory);

        /* Update ZRX price in status bar */
        if (statistics.fees.zrxPrice)
            $('#status-bar-zrx-price-text').text(this.formatPrice(statistics.fees.zrxPrice));

        this._lastStatisticsUpdatedEvent = [statistics, priceVolumeHistory];
    }

    public handleFetchMore(count: number) {
        this._callbacks.onFetchMore(count);
    }

    public async handleFetchOrder(trade: Trade): Promise<OrderInfo> {
        return await this._callbacks.onFetchOrder(trade);
    }

    /* Button handlers */

    public handleAddPanelRow() {
        this.panelCreate(this.domAddPanelRow(), Panels.EmptyPanel);
    }

    public handleAddSplitPanelRow() {
        let [root1, root2] = this.domAddSplitPanelRow();
        this.panelCreate(root1, Panels.EmptyPanel);
        this.panelCreate(root2, Panels.EmptyPanel);
    }

    /* Panel management */

    public domAddPanelRow(): JQuery<HTMLElement> {
        let root = $('<div></div>').addClass('panel-row');
        $('#end-of-container').before(root);
        return root;
    }

    public domAddSplitPanelRow(): [JQuery<HTMLElement>, JQuery<HTMLElement>] {
        let root1 = $('<div></div>').addClass('col-sm-6 panel-col');
        let root2 = $('<div></div>').addClass('col-sm-6 panel-col');
        let row = $('<div></div>').addClass('row')
                                  .append(root1)
                                  .append(root2);
        $('#end-of-container').before(row);
        return [root1, root2];
    }

    public panelCreate(dom: JQuery<HTMLElement>, cls: Panels.PanelType, ...args: any[]): Panels.Panel {
        let panel = new cls(this, ...args);

        panel.create(dom);

        this._panels.push(panel);

        return panel;
    }

    public panelChange(panel: Panels.Panel) {
        let root = panel.getRoot();

        this.panelRemove(panel, false);

        this.panelCreate(root, Panels.EmptyPanel);
    }

    public panelRemove(panel: Panels.Panel, prune: boolean) {
        let root = panel.getRoot();

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
    }

    public panelRefresh(panel: Panels.Panel) {
        panel.handleNewTrade(this._lastNewTradeEvent[0], this._lastNewTradeEvent[1], this._lastNewTradeEvent[2]);
        panel.handleStatisticsUpdated(this._lastStatisticsUpdatedEvent[0], this._lastStatisticsUpdatedEvent[1]);
    }

    /* Formatting Helpers */

    public formatDateTime(datetime: Date, local: boolean): string {
        let year, month, day, hours, minutes, seconds;

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
    }

    public formatPrice(price: BigNumber): string {
        if (this._fiatCurrencyInfo) {
            let priceString = price.toNumber().toLocaleString(undefined, {minimumFractionDigits: this._fiatCurrencyInfo.decimal_digits});
            return this._fiatCurrencyInfo.symbol + priceString + " " + this._fiatCurrencyInfo.code;
        }

        return price.toString();
    }

    public formatPriceUnits(price: BigNumber): string {
        if (this._fiatCurrencyInfo)
            return this._fiatCurrencyInfo.symbol + price.toFixed(this._fiatCurrencyInfo.decimal_digits);

        return price.toString();
    }

    public formatHex(hex: string, digits = 6): string {
        if (digits >= 64)
            return hex;

        return hex.substring(0, 2+digits) + "...";
    }

    public formatRelay(address: string, digits?: number): string {
        if (Constants.ZEROEX_RELAY_ADDRESSES[this._networkId][address]) {
            return Constants.ZEROEX_RELAY_ADDRESSES[this._networkId][address].name;
        } else {
            return this.formatHex(address, digits);
        }
    }

    public formatToken(address: string, digits?: number): string {
        if (Constants.ZEROEX_TOKEN_INFOS[address]) {
            return Constants.ZEROEX_TOKEN_INFOS[address].symbol;
        } else {
            return this.formatHex(address, digits);
        }
    }

    public formatTokenLink(address: string, digits?: number): JQuery<HTMLElement> | string {
        if (Constants.ZEROEX_TOKEN_INFOS[address]) {
            return this.formatAddressLink(address, Constants.ZEROEX_TOKEN_INFOS[address].symbol);
        } else {
            return this.formatAddressLink(address, this.formatHex(address, digits));
        }
    }

    public formatTokenWebsiteLink(address: string, digits?: number): JQuery<HTMLElement> | string {
        if (Constants.ZEROEX_TOKEN_INFOS[address] && Constants.ZEROEX_TOKEN_INFOS[address].website) {
            let elem = $('<a></a>')
                                 .attr('href', Constants.ZEROEX_TOKEN_INFOS[address].website)
                                 .attr('target', '_blank')
                                 .text(Constants.ZEROEX_TOKEN_INFOS[address].symbol);

            elem = elem.append($('<i></i>').addClass('icon-globe'));

            return elem;
        } else {
            return this.formatTokenLink(address, digits);
        }
    }

    public formatRelayLink(address: string, digits?: number): JQuery<HTMLElement> | string {
        if (Constants.ZEROEX_RELAY_ADDRESSES[this._networkId][address]) {
            let elem = $('<a></a>')
                                 .attr('href', Constants.ZEROEX_RELAY_ADDRESSES[this._networkId][address].website)
                                 .attr('target', '_blank')
                                 .text(Constants.ZEROEX_RELAY_ADDRESSES[this._networkId][address].name);

            return elem;
        } else if (!(new BigNumber(address, 16)).eq(0)) {
            return this.formatTokenAddressLink(Constants.ZEROEX_TOKEN_ADDRESS, address, this.formatHex(address, digits));
        } else {
            return $("<span></span>").text("None");
        }
    }

    public formatTxidLink(txid: string, text: string, showLinkIcon = false): JQuery<HTMLElement> | string {
        let baseUrl = Constants.NETWORK_BLOCK_EXPLORER[this._networkId];

        if (baseUrl) {
            let elem = $('<a></a>')
                                 .attr('href', baseUrl + "/tx/" + txid)
                                 .attr('target', '_blank')
                                 .text(text);

            if (showLinkIcon)
                elem = elem.append($('<i></i>').addClass('icon-link-ext'));

            return elem;
        } else {
            return text;
        }
    }

    public formatTokenAddressLink(token: string, address: string, text: string, showLinkIcon = false): JQuery<HTMLElement> | string {
        let baseUrl = Constants.NETWORK_BLOCK_EXPLORER[this._networkId];

        if (baseUrl) {
            let elem = $('<a></a>')
                                 .attr('href', baseUrl + "/token/" + token + "/?a=" + address)
                                 .attr('target', '_blank')
                                 .text(text);

            if (showLinkIcon)
                elem = elem.append($('<i></i>').addClass('icon-link-ext'));

            return elem;
        } else {
            return text;
        }
    }

    public formatAddressLink(address: string, text: string, showLinkIcon = false): JQuery<HTMLElement> | string {
        let baseUrl = Constants.NETWORK_BLOCK_EXPLORER[this._networkId];

        if (baseUrl) {
            let elem = $('<a></a>')
                                 .attr('href', baseUrl + "/address/" + address)
                                 .attr('target', '_blank')
                                 .text(text);

            if (showLinkIcon)
                elem = elem.append($('<i></i>').addClass('icon-link-ext'));

            return elem;
        } else {
            return text;
        }
    }

    public formatBlockNumberLink(blockNumber: number, showLinkIcon = false) {
        let baseUrl = Constants.NETWORK_BLOCK_EXPLORER[this._networkId];

        if (baseUrl) {
            let elem = $('<a></a>')
                                 .attr('href', baseUrl + "/block/" + blockNumber)
                                 .attr('target', '_blank')
                                 .text(blockNumber);

            if (showLinkIcon)
                elem = elem.append($('<i></i>').addClass('icon-link-ext'));

            return elem;
        } else {
            return blockNumber.toString();
        }
    }

    public formatWei(value: BigNumber, unit: Web3.Unit): BigNumber {
        return this._web3.fromWei(value, unit);
    }

    /* Success/failure Modal */

    public showResultModal(success: boolean, heading: string, body: string): void {
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
    }
}
