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

import * as Model from "./model";
import * as View from "./view";
import {Trade, Statistics, PortalOrder, OrderInfo} from "./structs";

/******************************************************************************/
/* Controller */
/******************************************************************************/

export class Controller implements Model.ModelEvents, View.ViewEvents {
    private _model: Model.Model;
    private _view: View.View;

    constructor(model: Model.Model, view: View.View) {
        this._model = model;
        this._view = view;

        this._model.bindCallbacks(this);
        this._view.bindCallbacks(this);
    }

    public async init() {
        await this._view.init();
        await this._model.init();
    }

    /* Model Events */

    public onConnected(error: Model.ModelError | null, networkId?: number): void {
        this._view.handleConnected(error, networkId);
    }

    public onFetching(count: number, done: boolean): void {
        this._view.handleFetching(count, done);
    }

    public onNewTrade(index: number, trade: Trade, tradeHistory: Trade[]): void {
        this._view.handleNewTrade(index, trade, tradeHistory);
    }

    public onStatisticsUpdated(statistics: Statistics, priceVolumeHistory: Model.PriceVolumeHistory): void {
        this._view.handleStatisticsUpdated(statistics, priceVolumeHistory);
    }

    /* View Events */

    public onFetchMore(count: number): void {
        this._model.fetchPastTrades(count);
    }

    public async onFetchOrder(trade: Trade): Promise<OrderInfo> {
        return await this._model.fetchOrder(trade);
    }
}
