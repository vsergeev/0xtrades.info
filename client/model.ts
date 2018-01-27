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

import * as Web3 from 'web3';
import * as $ from "jquery";

import {Web3Wrapper} from '@0xproject/web3-wrapper';
import {
    ZeroEx,
    Web3Provider,
    ExchangeEvents,
    BlockParamLiteral,
    DecodedLogEvent,
    LogFillContractEventArgs,
    ExchangeContractEventArgs,
    LogWithDecodedArgs,
    Order
} from '0x.js';
import {BigNumber, promisify} from '@0xproject/utils';

import * as Logger from "./logger";
import * as Constants from "./constants";
import {Trade, Statistics, PortalOrder, OrderInfo} from "./structs";

/******************************************************************************/
/* Model */
/******************************************************************************/

export enum ModelError {
    GET_NETWORK_ID,
    GET_BLOCK_HEIGHT,
    UNSUPPORTED_NETWORK,
}

export interface ModelEvents {
    onConnected(error: ModelError | null, networkId?: number): void;
    onFetching(count: number, done: boolean): void;
    onNewTrade(index: number, trade: Trade, tradeHistory: Trade[]): void;
    onStatisticsUpdated(statistics: Statistics, priceVolumeHistory: PriceVolumeHistory): void;
}

export class Model {
    /* web3 interface */
    private _web3Wrapper: Web3Wrapper;
    private _web3: Web3;
    private _zeroEx: ZeroEx;

    /* Network Status */
    private _networkId: number;
    private _blockHeight: number;

    /* Trades State */
    private _trades: Trade[];
    private _tradesSeen: { [key: string]: boolean };
    private _initialFetchDone: boolean;

    /* Blockchain State */
    private _oldestBlockFetched: number;
    private _blockTimestamps: { [key: number]: number };

    /* Price State */
    private _tokenPrices: { [symbol: string]: number };
    private _fiatCurrencyInfo: Constants.CurrencyInfo;
    private _priceVolumeHistory: PriceVolumeHistory;

    /* Callbacks */
    private _callbacks: ModelEvents;

    constructor(web3: Web3, fiatCurrencyInfo: Constants.CurrencyInfo) {
        this._web3Wrapper = new Web3Wrapper(web3.currentProvider, {});
        this._web3 = web3;

        this._trades = [];
        this._tradesSeen = {};
        this._blockTimestamps = {};
        this._initialFetchDone = false;

        this._tokenPrices = {};
        this._fiatCurrencyInfo = fiatCurrencyInfo;
        this._priceVolumeHistory = new PriceVolumeHistory();
    }

    public async init() {
        /* Fetch the network id */
        try {
            this._networkId = await this._web3Wrapper.getNetworkIdAsync();
        } catch (err) {
            Logger.log('[Model] Error determining network version');
            Logger.error(err);

            this._callbacks.onConnected(ModelError.GET_NETWORK_ID);
        }

        Logger.log('[Model] Network ID: ' + this._networkId);

        /* Check if this network is supported */
        if (Constants.ZEROEX_GENESIS_BLOCK[this._networkId] === undefined) {
            Logger.log('[Model] Unsupported network id');
            this._callbacks.onConnected(ModelError.UNSUPPORTED_NETWORK, this._networkId);
            return;
        }

        /* Create our ZeroEx instance */
        this._zeroEx = new ZeroEx(this._web3Wrapper.getCurrentProvider(), {networkId: this._networkId});

        /* Set global exchange address */
        Constants.ZEROEX_EXCHANGE_ADDRESS! = this._zeroEx.exchange.getContractAddress();

        /* Determine block height */
        try {
            this._blockHeight = await this._web3Wrapper.getBlockNumberAsync();
        } catch (err) {
            Logger.log('[Model] Error determining block height');
            Logger.error(err);

            this._callbacks.onConnected(ModelError.GET_BLOCK_HEIGHT, this._networkId);
        }

        Logger.log('[Model] Block height: ' + this._blockHeight);

        /* Call connected callback successfully */
        this._callbacks.onConnected(null, this._networkId);

        /* Fetch token registry */
        try {
            let tokens = await this._zeroEx.tokenRegistry.getTokensAsync();

            for (let token of tokens) {
                if (token.symbol === "ZRX")
                    Constants.ZEROEX_TOKEN_ADDRESS! = token.address;

                if (!Constants.ZEROEX_TOKEN_INFOS[token.address]) {
                    Constants.ZEROEX_TOKEN_INFOS[token.address] = {
                        decimals: token.decimals,
                        name: token.name,
                        symbol: token.symbol,
                        website: null
                    };
                }
            }
        } catch (err) {
            Logger.log('[Model] Error fetching token registry');
            Logger.error(err);
        }

        /* Update all token prices */
        this._updatePrices();

        /* Subscribe to new fill logs */
        this._zeroEx.exchange.subscribe(ExchangeEvents.LogFill, {}, (err, decodedLog?) => { this._onLogFillEvent(err, decodedLog); });

        /* Fetch past fill logs */
        await this.fetchPastTradesDuration(Constants.STATISTICS_TIME_WINDOW);

        this._initialFetchDone = true;

        /* Call fetching callback with done */
        this._callbacks.onFetching(this._trades.length, true);

        /* Update statistics */
        this._updateStatistics();
    }

    public bindCallbacks(callbacks: ModelEvents) {
        this._callbacks = callbacks;
    }

    private static delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /* LogFill event handler */

    private async _onLogFillEvent(err: null | Error, decodedLog?: DecodedLogEvent<ExchangeContractEventArgs>) {
        if (err) {
            Logger.error('[Model] Got Log Fill event error:');
            Logger.error(err);
            return;
        }

        Logger.log('[Model] Got Log Fill event');

        let log = decodedLog as DecodedLogEvent<LogFillContractEventArgs>;

        /* If we've already processed this trade, skip it */
        if (this._tradesSeen[log.log.transactionHash + log.log.args.orderHash])
            return;

        let trade = <Trade>{};
        trade.txid = log.log.transactionHash;
        trade.blockNumber = log.log.blockNumber!;
        trade.takerAddress = log.log.args.taker;
        trade.makerAddress = log.log.args.maker;
        trade.relayAddress = log.log.args.feeRecipient;
        trade.takerToken = log.log.args.takerToken;
        trade.makerToken = log.log.args.makerToken;
        trade.makerVolume = log.log.args.filledMakerTokenAmount;
        trade.takerVolume = log.log.args.filledTakerTokenAmount;
        trade.makerFee = log.log.args.paidMakerFee;
        trade.takerFee = log.log.args.paidTakerFee;
        trade.orderHash = log.log.args.orderHash;
        trade.mtPrice = null;
        trade.tmPrice = null;
        trade.makerNormalized = false;
        trade.takerNormalized = false;

        /* Normalize traded volueme and fee quantities */
        [trade.makerVolume, trade.makerNormalized] = this._normalizeQuantity(trade.makerToken, trade.makerVolume);
        [trade.takerVolume, trade.takerNormalized] = this._normalizeQuantity(trade.takerToken, trade.takerVolume);
        [trade.makerFee, ] = this._normalizeQuantity(Constants.ZEROEX_TOKEN_ADDRESS, trade.makerFee);
        [trade.takerFee, ] = this._normalizeQuantity(Constants.ZEROEX_TOKEN_ADDRESS, trade.takerFee);

        /* Compute prices */
        if (trade.makerNormalized && trade.takerNormalized) {
            trade.mtPrice = trade.makerVolume.div(trade.takerVolume);
            trade.tmPrice = trade.takerVolume.div(trade.makerVolume);
        } else if (trade.makerVolume.eq(trade.takerVolume)) {
            /* Special case of equal maker/take quantities doesn't require token
             * decimals */
            trade.mtPrice = new BigNumber(1);
            trade.tmPrice = new BigNumber(1);
        }

        /* Mark this trade as seen */
        this._tradesSeen[log.log.transactionHash + log.log.args.orderHash] = true;

        /* Fetch timestamp associated with this block */
        let timestamp = await this._getBlockTimestamp(trade.blockNumber);

        trade.timestamp = timestamp;

        /* Insert it in the right position in our trades */
        let index;
        for (index = 0; index < this._trades.length; index++) {
            if (this._trades[index].timestamp < trade.timestamp)
                break;
        }
        this._trades.splice(index, 0, trade);

        /* Update our price history for this token pair */
        if (trade.makerNormalized && trade.takerNormalized) {
            this._priceVolumeHistory.insert(Constants.ZEROEX_TOKEN_INFOS[trade.makerToken].symbol,
                                            Constants.ZEROEX_TOKEN_INFOS[trade.takerToken].symbol,
                                            trade.timestamp,
                                            trade.mtPrice!.toNumber(), trade.tmPrice!.toNumber(),
                                            trade.makerVolume.toNumber(), trade.takerVolume.toNumber());
        }

        /* Call callback */
        this._callbacks.onNewTrade(index, trade, this._trades);

        /* Call fetching callback */
        if (!this._initialFetchDone)
            this._callbacks.onFetching(this._trades.length, false);

        /* Update statistics */
        this._updateStatistics();
    }

    /* Token Prices */

    private async _updatePrices() {
        Logger.log('[Model] Fetching token prices');

        /* Split symbols from token registry into two queries */
        let numSymbols = Object.keys(Constants.ZEROEX_TOKEN_INFOS).length;
        let querySymbols = [['ETH'], []];
        let count = 0;
        for (let key in Constants.ZEROEX_TOKEN_INFOS) {
            if (count < numSymbols/2)
                querySymbols[0].push(Constants.ZEROEX_TOKEN_INFOS[key].symbol);
            else
                querySymbols[1].push(Constants.ZEROEX_TOKEN_INFOS[key].symbol);

            count += 1;
        }

        let endpoints = [
            Constants.PRICE_API_URL(querySymbols[0], this._fiatCurrencyInfo.code),
            Constants.PRICE_API_URL(querySymbols[1], this._fiatCurrencyInfo.code)
        ];

        for (let endpoint of endpoints) {
            let prices;

            try {
                prices = await $.getJSON(endpoint);
            } catch (error) {
                Logger.error('[Model] Error fetching token prices:');
                Logger.error(error);

                Logger.log('[Model] Retrying in half update timeout');
                await Model.delay(Math.floor(Constants.PRICE_UPDATE_TIMEOUT/2));
                await this._updatePrices();
                return;
            }

            Logger.log('[Model] Got token prices');
            Logger.log(prices);

            /* Extract prices */
            for (let token in prices)
                this._tokenPrices[token] = prices[token][this._fiatCurrencyInfo.code];

            /* Map WETH to ETH */
            if (this._tokenPrices['ETH'])
                this._tokenPrices['WETH'] = this._tokenPrices['ETH'];
        }

        /* Update statistics */
        this._updateStatistics();

        await Model.delay(Constants.PRICE_UPDATE_TIMEOUT);
        await this._updatePrices();
    }

    /* Statistics */

    private _updateStatistics() {
        /* Hold off on updating statistics until we've fetched initial trades */
        if (!this._initialFetchDone)
            return;

        Logger.log('[Model] Updating statistics');

        let currentTimestamp = Math.round((new Date()).getTime() / 1000);
        let cutoffTimestamp = currentTimestamp - Constants.STATISTICS_TIME_WINDOW;

        let statistics = <Statistics>{fees: {}, volume: {}, counts: {}};
        statistics.fees.totalFees = new BigNumber(0);
        statistics.fees.relays = {};
        statistics.fees.feeCount = 0;
        statistics.fees.feelessCount = 0;
        statistics.fees.totalFeesFiat = null;
        statistics.fees.zrxPrice = null;
        statistics.volume.totalTrades = 0;
        statistics.volume.totalVolumeFiat = new BigNumber(0);
        statistics.volume.tokens = {};
        statistics.counts.relays = {};

        for (let trade of this._trades) {
            /* Process up to statistics time window trades */
            if (trade.timestamp < cutoffTimestamp)
                break;

            /*** Relay fee statistics ***/

            let relayAddress = trade.relayAddress;
            let relayFee = trade.makerFee.add(trade.takerFee);

            if (statistics.fees.relays[relayAddress] === undefined)
                statistics.fees.relays[relayAddress] = new BigNumber(0);

            /* Fee per relay and total relay fees */
            statistics.fees.relays[relayAddress] = statistics.fees.relays[relayAddress].add(relayFee);
            statistics.fees.totalFees = statistics.fees.totalFees.add(relayFee);

            /* Fee vs Feeless trade count */
            if (!relayFee.eq(0))
                statistics.fees.feeCount += 1;
            else
                statistics.fees.feelessCount += 1;

            /*** Trades per relay ***/

            if (statistics.counts.relays[relayAddress] === undefined)
                statistics.counts.relays[relayAddress] = 0;

            statistics.counts.relays[relayAddress] += 1;

            /*** Token volume and count statistics ***/

            let makerToken = trade.makerToken;
            let takerToken = trade.takerToken;
            let makerVolume = trade.makerVolume;
            let takerVolume = trade.takerVolume;
            let makerTokenSymbol = trade.makerNormalized ? Constants.ZEROEX_TOKEN_INFOS[makerToken].symbol : null;
            let takerTokenSymbol = trade.takerNormalized ? Constants.ZEROEX_TOKEN_INFOS[takerToken].symbol : null;

            if (statistics.volume.tokens[makerToken] === undefined)
                statistics.volume.tokens[makerToken] = {volume: new BigNumber(0), volumeFiat: new BigNumber(0), count: 0};
            if (statistics.volume.tokens[takerToken] === undefined)
                statistics.volume.tokens[takerToken] = {volume: new BigNumber(0), volumeFiat: new BigNumber(0), count: 0};

            /* Volume per token */
            statistics.volume.tokens[makerToken].volume = statistics.volume.tokens[makerToken].volume.add(makerVolume);
            statistics.volume.tokens[takerToken].volume = statistics.volume.tokens[takerToken].volume.add(takerVolume);

            /* Fiat volume per token */
            if (makerTokenSymbol && this._tokenPrices[makerTokenSymbol]) {
                let fiatMakerVolume = makerVolume.mul(this._tokenPrices[makerTokenSymbol]);
                statistics.volume.tokens[makerToken].volumeFiat = statistics.volume.tokens[makerToken].volumeFiat.add(fiatMakerVolume);
                statistics.volume.totalVolumeFiat = statistics.volume.totalVolumeFiat.add(fiatMakerVolume);
            }
            if (takerTokenSymbol && this._tokenPrices[takerTokenSymbol]) {
                let fiatTakerVolume = takerVolume.mul(this._tokenPrices[takerTokenSymbol]);
                statistics.volume.tokens[takerToken].volumeFiat = statistics.volume.tokens[takerToken].volumeFiat.add(fiatTakerVolume);
                statistics.volume.totalVolumeFiat = statistics.volume.totalVolumeFiat.add(fiatTakerVolume);
            }
            /* Trade count per token and total trades */
            statistics.volume.tokens[makerToken].count += 1;
            statistics.volume.tokens[takerToken].count += 1;
            statistics.volume.totalTrades += 1;
        }

        /* Compute relay fees in fiat currency, if available */
        let zrxPrice = this._tokenPrices['ZRX'];
        if (zrxPrice) {
            statistics.fees.totalFeesFiat = statistics.fees.totalFees.mul(zrxPrice);
            statistics.fees.zrxPrice = new BigNumber(zrxPrice);
        }

        /* Prune price/volume history */
        this._priceVolumeHistory.prune();

        /* Call view callback */
        this._callbacks.onStatisticsUpdated(statistics, this._priceVolumeHistory);
    }

    /* Token quantity normalization helper function */

    private _normalizeQuantity(token: string, quantity: BigNumber): [BigNumber, boolean] {
        if (Constants.ZEROEX_TOKEN_INFOS[token])
            return [quantity.div(Math.pow(10, Constants.ZEROEX_TOKEN_INFOS[token].decimals)), true];

        return [quantity, false];
    }

    /* Blockchain helper functions */

    private async _getBlockTimestamp(blockNumber: number): Promise<number> {
        if (this._blockTimestamps[blockNumber])
            return this._blockTimestamps[blockNumber];

        let block: Web3.BlockWithoutTransactionData | null = null;

        try {
            block = await this._web3Wrapper.getBlockAsync(blockNumber);
        } catch (error) {
            Logger.error("[Model] Error fetching block number " + blockNumber + ": " + error);
        }

        if (block) {
            Logger.log("[Model] Got block info for " + blockNumber);
            this._blockTimestamps[blockNumber] = block.timestamp;
            return block.timestamp;
        } else {
            Logger.log("[Model] Block info unavailable for " + blockNumber);
            Logger.log("[Model] Retrying in " + Constants.BLOCK_INFO_RETRY_TIMEOUT/1000 + " seconds");
            await Model.delay(Constants.BLOCK_INFO_RETRY_TIMEOUT);
            return await this._getBlockTimestamp(blockNumber);
        }
    }

    private async _getTransaction(txid : string): Promise<Web3.Transaction> {
        let tx: Web3.Transaction;

        try {
            tx = await promisify<Web3.Transaction>(this._web3.eth.getTransaction)(txid);
            Logger.log("[Model] Got transaction info for " + txid);
            return tx;
        } catch (error) {
            Logger.log("[Model] Transaction info unavailable for " + txid);
            Logger.log("[Model] Retrying in " + Constants.TRANSACTION_INFO_RETRY_TIMEOUT/1000 + " seconds");
            await Model.delay(Constants.TRANSACTION_INFO_RETRY_TIMEOUT);
            return await this._getTransaction(txid);
        }
    }

    /* Fetching operations */

    public async fetchPastTrades(count: number) {
        let fromBlock = this._oldestBlockFetched ? this._oldestBlockFetched - count : this._blockHeight - count;
        let toBlock = this._oldestBlockFetched ? this._oldestBlockFetched : BlockParamLiteral.Latest;

        Logger.log('[Model] Fetching ' + count + ' past logs from ' + fromBlock + ' to ' + toBlock);

        /* Clamp to 0x genesis block */
        if (fromBlock < Constants.ZEROEX_GENESIS_BLOCK[this._networkId])
            fromBlock = Constants.ZEROEX_GENESIS_BLOCK[this._networkId];

        this._oldestBlockFetched = fromBlock;

        let logs = await this._zeroEx.exchange.getLogsAsync(ExchangeEvents.LogFill, {fromBlock: fromBlock, toBlock: toBlock}, {});

        for (let log of logs)
            await this._onLogFillEvent(null, {isRemoved: false, log: log});
    }

    public async fetchPastTradesDuration(duration: number) {
        let currentTimestamp = Math.round((new Date()).getTime() / 1000);

        let oldestFetchedTimestamp = this._oldestBlockFetched ?
                                        await this._getBlockTimestamp(this._oldestBlockFetched) : currentTimestamp;

        if ((currentTimestamp - oldestFetchedTimestamp) < duration) {
            await this.fetchPastTrades(Constants.BLOCK_FETCH_COUNT);
            await this.fetchPastTradesDuration(duration);
        }
    }

    public async fetchOrder(trade: Trade): Promise<OrderInfo> {
        /* FIXME this all should really use an abi decoder */

        /* Look up the transaction */
        let transaction = await this._getTransaction(trade.txid);

        let methodId = transaction.input.substring(0, 10);

        /* Only support fillOrder() method for now */
        if (methodId != "0xbc61394a")
            return {error: "Unsupported fill method.", transaction: transaction};
        else if (transaction.input.length < 1034)
            return {error: "Unsupported fill method.", transaction: transaction};

        /* Extract 15 params from the input data */
        let params: string[] = [];
        for (let i = 10; i < 1034; i+= 64)
            params.push(transaction.input.substring(i, i+64));

        /* Form 0x.js order object */
        let order: Order = <Order>{};
        order.exchangeContractAddress = Constants.ZEROEX_EXCHANGE_ADDRESS;
        order.expirationUnixTimestampSec = new BigNumber(params[9], 16);
        order.feeRecipient = "0x" + params[4].substring(24);
        order.maker = "0x" + params[0].substring(24);
        order.makerFee = new BigNumber(params[7], 16);
        order.makerTokenAddress = "0x" + params[2].substring(24);
        order.makerTokenAmount = new BigNumber(params[5], 16);
        order.salt = new BigNumber(params[10], 16);
        order.taker = "0x" + params[1].substring(24);
        order.takerFee = new BigNumber(params[8], 16);
        order.takerTokenAddress = "0x" + params[3].substring(24);
        order.takerTokenAmount = new BigNumber(params[6], 16);

        /* Calculate order hash */
        let orderHash = ZeroEx.getOrderHashHex(order);

        /* Form 0x portal order object */
        let portalOrder = <PortalOrder>{maker: {token: {}}, taker: {token: {}}, signature: {}};
        portalOrder.maker.address = order.maker;
        portalOrder.maker.token.address = order.makerTokenAddress;
        portalOrder.maker.token.name = Constants.ZEROEX_TOKEN_INFOS[portalOrder.maker.token.address] ? Constants.ZEROEX_TOKEN_INFOS[portalOrder.maker.token.address].name : null;
        portalOrder.maker.token.symbol = Constants.ZEROEX_TOKEN_INFOS[portalOrder.maker.token.address] ? Constants.ZEROEX_TOKEN_INFOS[portalOrder.maker.token.address].symbol : null;
        portalOrder.maker.token.decimals = Constants.ZEROEX_TOKEN_INFOS[portalOrder.maker.token.address] ? Constants.ZEROEX_TOKEN_INFOS[portalOrder.maker.token.address].decimals : null;
        portalOrder.maker.amount = order.makerTokenAmount.toString();
        portalOrder.maker.feeAmount = order.makerFee.toString();
        portalOrder.taker.address = (new BigNumber(order.taker, 16)).eq(0) ? "" : order.taker;
        portalOrder.taker.token.address = order.takerTokenAddress;
        portalOrder.taker.token.name = Constants.ZEROEX_TOKEN_INFOS[portalOrder.taker.token.address] ? Constants.ZEROEX_TOKEN_INFOS[portalOrder.taker.token.address].name : null;
        portalOrder.taker.token.symbol = Constants.ZEROEX_TOKEN_INFOS[portalOrder.taker.token.address] ? Constants.ZEROEX_TOKEN_INFOS[portalOrder.taker.token.address].symbol : null;
        portalOrder.taker.token.decimals = Constants.ZEROEX_TOKEN_INFOS[portalOrder.taker.token.address] ? Constants.ZEROEX_TOKEN_INFOS[portalOrder.taker.token.address].decimals : null;
        portalOrder.taker.amount = order.takerTokenAmount.toString();
        portalOrder.taker.feeAmount = order.takerFee.toString();
        portalOrder.expiration = order.expirationUnixTimestampSec.toString();
        portalOrder.feeRecipient = order.feeRecipient;
        portalOrder.salt = order.salt.toString();
        portalOrder.signature.v = (new BigNumber(params[13], 16)).toNumber();
        portalOrder.signature.r = "0x" + params[14];
        portalOrder.signature.s = "0x" + params[15];
        portalOrder.signature.hash = orderHash;
        portalOrder.exchangeContract = order.exchangeContractAddress;
        portalOrder.networkId = this._networkId;

        /* Check order hash matches actual trade */
        if (portalOrder.signature.hash != trade.orderHash) {
            Logger.log("[Model] Order hash mismatch in fetch order.");
            Logger.log(params);
            Logger.log(trade);
            Logger.log(order);
            Logger.log(portalOrder);
            return {error: "Decoding order: Order hash mismatch."};
        }

        /* Lookup the filled amount */
        let filledAmount;
        try {
            filledAmount = await this._zeroEx.exchange.getUnavailableTakerAmountAsync(portalOrder.signature.hash);
        } catch (error) {
            return {error: error};
        }

        /* Calculate taker amount remaining */
        let isOpenTaker = portalOrder.taker.address.length == 0;
        let isExpired = order.expirationUnixTimestampSec.lt(Math.round((new Date()).getTime() / 1000));
        let [takerAmountRemaining, takerAmountRemainingNormalized] = this._normalizeQuantity(portalOrder.taker.token.address, order.takerTokenAmount.sub(filledAmount));

        return {
            error: null,
            order: portalOrder,
            isOpenTaker: isOpenTaker,
            isExpired: isExpired,
            takerAmountRemaining: takerAmountRemaining,
            takerAmountRemainingNormalized: takerAmountRemainingNormalized,
            transaction: transaction
        };
    }
}

/******************************************************************************/
/* Price/Volume History */
/******************************************************************************/

interface TimeSeriesElement {
    x: Date;
    y: number;
}

export class PriceVolumeHistory {
    private _tokens: string[];
    private _priceData: { [token: string]: { [token: string]: TimeSeriesElement[] } };
    private _volumeData: { [token: string]: { [token: string]: TimeSeriesElement[] } };
    private _timestamps: { [token: string]: { [token: string]: number[] } };

    constructor() {
        this._tokens = [];
        this._priceData = {};
        this._volumeData = {};
        this._timestamps = {};
    }

    /* Insert price/volume data for a token pair */
    public insert(maker: string, taker: string, timestamp: number, mtPrice: number, tmPrice: number, makerVolume: number, takerVolume: number) {
        /* Initialize data structures */
        this._initialize(maker, taker);
        this._initialize(taker, maker);

        /* Find index for this data */
        let index = 0;
        for (index = 0; index < this._timestamps[maker][taker].length; index++) {
            if (this._timestamps[maker][taker][index] > timestamp)
                break;
        }

        /* Create date object */
        let date = new Date(timestamp*1000);

        /* Save the timestamp and prices */
        this._timestamps[maker][taker].splice(index, 0, timestamp);
        this._timestamps[taker][maker].splice(index, 0, timestamp);
        this._priceData[maker][taker].splice(index, 0, {x: date, y: mtPrice});
        this._priceData[taker][maker].splice(index, 0, {x: date, y: tmPrice});
        this._volumeData[maker][taker].splice(index, 0, {x: date, y: takerVolume});
        this._volumeData[taker][maker].splice(index, 0, {x: date, y: makerVolume});
    }

    /* Get price data for a token pair */
    public getPriceData(tokenPair: string): TimeSeriesElement[] {
        let [quote, base] = tokenPair.split("/");

        if (this._priceData[base] && this._priceData[base][quote])
            return this._priceData[base][quote];

        return [];
    }

    /* Get volume data for a token pair */
    public getVolumeData(tokenPair: string): TimeSeriesElement[] {
        let [quote, base] = tokenPair.split("/");

        if (this._volumeData[base] && this._volumeData[base][quote])
            return this._volumeData[base][quote];

        return [];
    }

    /* Get token pairs */
    public getTokens() {
        return this._tokens;
    }

    /* Prune old data outside of statistics window */
    public prune() {
        let currentTimestamp = Math.round((new Date()).getTime() / 1000);
        let cutoffTimestamp = currentTimestamp - Constants.STATISTICS_TIME_WINDOW;

        let pruned = false;

        for (let maker in this._timestamps) {
            for (let taker in this._timestamps) {
                while (this._timestamps[maker][taker] && this._timestamps[maker][taker][0] < cutoffTimestamp) {
                    this._timestamps[maker][taker].shift();
                    this._timestamps[taker][maker].shift();
                    this._priceData[maker][taker].shift();
                    this._priceData[taker][maker].shift();
                    this._volumeData[maker][taker].shift();
                    this._volumeData[taker][maker].shift();

                    if (this._timestamps[maker][taker].length == 0) {
                        this._tokens.splice(this._tokens.indexOf(maker + "/" + taker), 1);
                        this._tokens.splice(this._tokens.indexOf(taker + "/" + maker), 1);
                    }

                    pruned = true;
                }
            }
        }

        return pruned;
    }

    /* Initialize state for maker/taker tokens a and b */
    private _initialize(a: string, b: string) {
        if (this._priceData[a] === undefined) {
            this._priceData[a] = {};
            this._volumeData[a] = {};
            this._timestamps[a] = {};
        }
        if (this._priceData[a][b] === undefined) {
            this._priceData[a][b] = [];
            this._volumeData[a][b] = [];
            this._timestamps[a][b] = [];
            this._tokens.push(a + "/" + b);
            this._tokens.sort();
        }
    }
}
