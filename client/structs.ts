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

import BigNumber from 'bignumber.js';
import * as Web3 from 'web3';

/******************************************************************************/
/* Common Structures */
/******************************************************************************/

export interface Trade {
    txid: string;
    blockNumber: number;
    timestamp: number;
    takerAddress: string;
    makerAddress: string;
    feeAddress: string;
    takerToken: string;
    makerToken: string;
    makerVolume: BigNumber;
    takerVolume: BigNumber;
    makerFee: BigNumber;
    takerFee: BigNumber;
    orderHash: string;
    mtPrice: BigNumber | null;
    tmPrice: BigNumber | null;
    makerNormalized: boolean;
    takerNormalized: boolean;
    relayAddress: string;
}

export interface Statistics {
    fees: {
        totalFees: BigNumber;
        relays: { [key: string]: BigNumber };
        feeCount: number;
        feelessCount: number;
        totalFeesFiat: BigNumber | null;
        zrxPrice: BigNumber | null;
    };
    volume: {
        totalTrades: number;
        totalVolumeFiat: BigNumber;
        tokens: { [key: string]: {
            volume: BigNumber;
            volumeFiat: BigNumber;
            count: number;
        } };
    };
    counts: {
        relays: { [key: string]: number };
    };
}

export interface PortalOrder {
    maker: {
        address: string;
        token: {
            address: string;
            name: string | null;
            symbol: string | null;
            decimals: number | null;
        };
        amount: string;
        feeAmount: string;
    };
    taker: {
        address: string;
        token: {
            address: string;
            name: string | null;
            symbol: string | null;
            decimals: number | null;
        };
        amount: string;
        feeAmount: string;
    };
    expiration: string;
    feeRecipient: string;
    salt: string;
    exchangeContract: string;
    networkId: number;
    signature: {
        v: number;
        r: string;
        s: string;
        hash: string;
    };
}

export interface OrderInfo {
    error: string | null;
    order?: PortalOrder;
    isOpenTaker?: boolean;
    isExpired?: boolean;
    takerAmountRemaining?: BigNumber;
    takerAmountRemainingNormalized?: boolean;
    transaction?: Web3.Transaction;
}
