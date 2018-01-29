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

/******************************************************************************/
/* Constants */
/******************************************************************************/

export const ZEROEX_GENESIS_BLOCK: { [networkId: number]: number } = {
    1: 4145578,
    42: 4145578,
};

export interface RelayInfo {
    name: string;
    website: string | null;
}

export const ZEROEX_RELAY_ADDRESSES: { [networkId: number] : { [address: string]: RelayInfo } } = {
    1: {
        "0xa258b39954cef5cb142fd567a46cddb31a670124": {
            name: "Radar Relay",
            website: "https://radarrelay.com",
        },
        "0xeb71bad396acaa128aeadbc7dbd59ca32263de01": {
            name: "IDT Exchange",
            website: "https://www.idtexchange.com",
        },
        "0xc22d5b2951db72b44cfb8089bb8cd374a3c354ea": {
            name: "OpenRelay",
            website: "https://openrelay.xyz",
        },
        "0x173a2467cece1f752eb8416e337d0f0b58cad795": {
            name: "ERC dEX",
            website: "https://ercdex.com",
        },
    },
    42: {
        "0xa258b39954cef5cb142fd567a46cddb31a670124": {
            name: "Radar Relay",
            website: "https://radarrelay.com",
        },
    },
};

export interface TokenInfo {
    name: string;
    symbol: string;
    decimals: number;
    website: string | null;
}

/* Populated by model */
export let ZEROEX_TOKEN_INFOS: { [address: string]: TokenInfo } = {
    /* Token infos from the registry */
    "0xe41d2489571d322189246dafa5ebde1f4699f498": {
        "name": "0x Protocol Token",
        "symbol": "ZRX",
        "decimals": 18,
        "website": "https://0xproject.com",
    },
    "0x2956356cd2a2bf3202f771f50d3d14a367b48070": {
        "name": "Wrapped Ether (deprecated)",
        "symbol": "WETH",
        "decimals": 18,
        "website": "https://weth.io",
    },
    "0xe94327d07fc17907b4db788e5adf2ed424addff6": {
        "name": "Augur Reputation Token",
        "symbol": "REP",
        "decimals": 18,
        "website": "https://augur.net",
    },
    "0xe0b7927c4af23765cb51314a0e0521a9645f0e2a": {
        "name": "Digix DAO Token",
        "symbol": "DGD",
        "decimals": 9,
        "website": "https://digix.global",
    },
    "0xfa05a73ffe78ef8f1a739473e462c54bae6567d9": {
        "name": "Lunyr",
        "symbol": "LUN",
        "decimals": 18,
        "website": "https://lunyr.com",
    },
    "0xc66ea802717bfb9833400264dd12c2bceaa34a6d": {
        "name": "MakerDAO",
        "symbol": "MKR",
        "decimals": 18,
        "website": "https://makerdao.com",
    },
    "0xbeb9ef514a379b997e0798fdcc901ee474b6d9a1": {
        "name": "Melon Token",
        "symbol": "MLN",
        "decimals": 18,
        "website": "https://melonport.com",
    },
    "0x9a642d6b3368ddc662ca244badf32cda716005bc": {
        "name": "Qtum",
        "symbol": "QTUM",
        "decimals": 18,
        "website": "https://qtum.org",
    },
    "0xd26114cd6ee289accf82350c8d8487fedb8a0c07": {
        "name": "OmiseGO",
        "symbol": "OMG",
        "decimals": 18,
        "website": "https://omisego.network",
    },
    "0xb97048628db6b661d4c2aa833e95dbe1a905b280": {
        "name": "TenXPay",
        "symbol": "PAY",
        "decimals": 18,
        "website": "https://www.tenx.tech",
    },
    "0x86fa049857e0209aa7d9e616f7eb3b3b78ecfdb0": {
        "name": "Eos",
        "symbol": "EOS",
        "decimals": 18,
        "website": "https://eos.io",
    },
    "0x888666ca69e0f178ded6d75b5726cee99a87d698": {
        "name": "Iconomi",
        "symbol": "ICN",
        "decimals": 18,
        "website": "https://www.iconomi.net",
    },
    "0x744d70fdbe2ba4cf95131626614a1763df805b9e": {
        "name": "StatusNetwork",
        "symbol": "SNT",
        "decimals": 18,
        "website": "https://status.im",
    },
    "0x6810e776880c02933d47db1b9fc05908e5386b96": {
        "name": "Gnosis",
        "symbol": "GNO",
        "decimals": 18,
        "website": "https://gnosis.pm",
    },
    "0x0d8775f648430679a709e98d2b0cb6250d2887ef": {
        "name": "Basic Attention Token",
        "symbol": "BAT",
        "decimals": 18,
        "website": "https://basicattentiontoken.org",
    },
    "0xb64ef51c888972c908cfacf59b47c1afbc0ab8ac": {
        "name": "Storj",
        "symbol": "STORJ",
        "decimals": 8,
        "website": "https://storj.io",
    },
    "0x1f573d6fb3f13d689ff844b4ce37794d79a7ff1c": {
        "name": "Bancor",
        "symbol": "BNT",
        "decimals": 18,
        "website": "https://bancor.network",
    },
    "0x960b236a07cf122663c4303350609a66a7b288c0": {
        "name": "Aragon",
        "symbol": "ANT",
        "decimals": 18,
        "website": "https://aragon.one",
    },
    "0x0abdace70d3790235af448c88547603b945604ea": {
        "name": "district0x",
        "symbol": "DNT",
        "decimals": 18,
        "website": "https://district0x.io",
    },
    "0xaec2e87e0a235266d9c5adc9deb4b2e29b54d009": {
        "name": "SingularDTV",
        "symbol": "SNGLS",
        "decimals": 0,
        "website": "https://singulardtv.com",
    },
    "0x419d0d8bdd9af5e606ae2232ed285aff190e711b": {
        "name": "FunFair",
        "symbol": "FUN",
        "decimals": 8,
        "website": "https://funfair.io",
    },
    "0xaf30d2a7e90d7dc361c8c4585e9bb7d2f6f15bc7": {
        "name": "FirstBlood",
        "symbol": "1ST",
        "decimals": 18,
        "website": "https://firstblood.io",
    },
    "0x08711d3b02c8758f2fb3ab4e80228418a7f8e39c": {
        "name": "Edgeless",
        "symbol": "EDG",
        "decimals": 0,
        "website": "https://edgeless.io",
    },
    "0x5af2be193a6abca9c8817001f45744777db30756": {
        "name": "Bitquence",
        "symbol": "BQX",
        "decimals": 8,
        "website": "https://www.ethos.io",
    },
    "0x607f4c5bb672230e8672085532f7e901544a7375": {
        "name": "iExec",
        "symbol": "RLC",
        "decimals": 9,
        "website": "https://iex.ec",
    },
    "0x667088b212ce3d06a1b553a7221e1fd19000d9af": {
        "name": "Wings",
        "symbol": "WINGS",
        "decimals": 18,
        "website": "https://wings.ai",
    },
    "0x41e5560054824ea6b0732e656e3ad64e20e94e45": {
        "name": "Civic",
        "symbol": "CVC",
        "decimals": 8,
        "website": "https://www.civic.com",
    },
    "0xb63b606ac810a52cca15e44bb630fd42d8d1d83d": {
        "name": "Monaco",
        "symbol": "MCO",
        "decimals": 8,
        "website": "https://mona.co",
    },
    "0xf433089366899d83a9f26a773d59ec7ecf30355e": {
        "name": "Metal",
        "symbol": "MTL",
        "decimals": 8,
        "website": "https://www.metalpay.com",
    },
    "0x12fef5e57bf45873cd9b62e9dbd7bfb99e32d73e": {
        "name": "Cofoundit",
        "symbol": "CFI",
        "decimals": 18,
        "website": "https://cofound.it/en",
    },
    "0xaaaf91d9b90df800df4f55c205fd6989c977e73a": {
        "name": "Monolith TKN",
        "symbol": "TKN",
        "decimals": 8,
        "website": "https://tokencard.io",
    },
    "0xe7775a6e9bcf904eb39da2b68c5efb4f9360e08c": {
        "name": "Token-as-a-Service",
        "symbol": "TAAS",
        "decimals": 6,
        "website": "https://taas.fund",
    },
    "0x2e071d2966aa7d8decb1005885ba1977d6038a65": {
        "name": "DICE",
        "symbol": "ROL",
        "decimals": 16,
        "website": null,
    },
    "0xcb94be6f13a1182e4a4b6140cb7bf2025d28e41b": {
        "name": "Trustcoin",
        "symbol": "TRST",
        "decimals": 6,
        "website": "https://www.wetrust.io",
    },
    "0x1776e1f26f98b1a5df9cd347953a26dd3cb46671": {
        "name": "Numeraire",
        "symbol": "NMR",
        "decimals": 18,
        "website": "https://numer.ai",
    },
    "0x7c5a0ce9267ed19b22f8cae653f198e3e8daf098": {
        "name": "Santiment Network Token",
        "symbol": "SAN",
        "decimals": 18,
        "website": "https://www.santiment.net",
    },
    "0xdd974d5c2e2928dea5f71b9825b8b646686bd200": {
        "name": "Kyber Network Crystal",
        "symbol": "KNC",
        "decimals": 18,
        "website": "https://kyber.network",
    },
    "0x01afc37f4f85babc47c0e2d0eababc7fb49793c8": {
        "name": "Wrapped Golem Network Token",
        "symbol": "WGNT",
        "decimals": 18,
        "website": null,
    },
    "0xd0d6d6c5fe4a677d343cc433536bb717bae167dd": {
        "name": "adToken",
        "symbol": "ADT",
        "decimals": 9,
        "website": "https://adtoken.com",
    },
    "0xab16e0d25c06cb376259cc18c1de4aca57605589": {
        "name": "FinallyUsableCryptoKarma",
        "symbol": "FUCK",
        "decimals": 4,
        "website": "https://fucktoken.com",
    },
    "0x701c244b988a513c945973defa05de933b23fe1d": {
        "name": "openANX",
        "symbol": "OAX",
        "decimals": 18,
        "website": "https://www.openanx.org",
    },
    "0x514910771af9ca656af840dff83e8264ecf986ca": {
        "name": "ChainLink",
        "symbol": "LINK",
        "decimals": 18,
        "website": "https://link.smartcontract.com",
    },
    "0x8f8221afbb33998d8584a2b05749ba73c37a938a": {
        "name": "Request Network",
        "symbol": "REQ",
        "decimals": 18,
        "website": "https://request.network",
    },
    "0x27054b13b1b798b345b591a4d22e6562d47ea75a": {
        "name": "AirSwap",
        "symbol": "AST",
        "decimals": 4,
        "website": "https://www.airswap.io",
    },
    "0xf0ee6b27b759c9893ce4f094b49ad28fd15a23e4": {
        "name": "Enigma",
        "symbol": "ENG",
        "decimals": 8,
        "website": "https://enigma.co",
    },
    "0x818fc6c2ec5986bc6e2cbf00939d90556ab12ce5": {
        "name": "Kin",
        "symbol": "KIN",
        "decimals": 18,
        "website": "https://kin.kik.com",
    },
    "0x27dce1ec4d3f72c3e457cc50354f1f975ddef488": {
        "name": "AirToken",
        "symbol": "AIR",
        "decimals": 8,
        "website": "https://www.airtoken.com",
    },
    "0x12480e24eb5bec1a9d4369cab6a80cad3c0a377a": {
        "name": "Substratum",
        "symbol": "SUB",
        "decimals": 2,
        "website": "https://substratum.net",
    },
    "0xb7cb1c96db6b22b0d3d9536e0108d062bd488f74": {
        "name": "Walton",
        "symbol": "WTC",
        "decimals": 18,
        "website": "https://www.waltonchain.org",
    },
    "0x4156d3342d5c385a87d264f90653733592000581": {
        "name": "Salt",
        "symbol": "SALT",
        "decimals": 8,
        "website": "https://www.saltlending.com",
    },

    /* Token infos not yet in the registry */
    "0xd4fa1460f537bb9085d22c7bccb5dd450ef28e3a": {
        "name": "Populous Platform",
        "symbol": "PPT",
        "decimals": 8,
        "website": "https://populous.co",
    },
    "0x0e0989b1f9b8a38983c2ba8053269ca62ec9b195": {
        "name": "Po.et",
        "symbol": "POE",
        "decimals": 8,
        "website": "https://po.et",
    },
    "0x8ae4bf2c33a8e667de34b54938b0ccd03eb8cc06": {
        "name": "Patientory",
        "symbol": "PTOY",
        "decimals": 8,
        "website": "https://www.patientory.com",
    },
    "0x0f5d2fb29fb7d3cfee444a200298f468908cc942": {
        "name": "Decentraland MANA",
        "symbol": "MANA",
        "decimals": 18,
        "website": "https://decentraland.org",
    },
    "0xea38eaa3c86c8f9b751533ba2e562deb9acded40": {
        "name": "Fuel Token",
        "symbol": "FUEL",
        "decimals": 18,
        "website": "https://etherparty.io",
    },
    "0xf970b8e36e23f7fc3fd752eea86f8be8d83375a6": {
        "name": "Ripio Credit Network Token",
        "symbol": "RCN",
        "decimals": 18,
        "website": "https://ripiocredit.network",
    },
    "0x386467f1f3ddbe832448650418311a479eecfc57": {
        "name": "Embers",
        "symbol": "EMB",
        "decimals": 0,
        "website": null,
    },
    "0x814964b1bceaf24e26296d031eadf134a2ca4105": {
        "name": "Newbium",
        "symbol": "NEWB",
        "decimals": 0,
        "website": "http://newbium.com",
    },
    "0x2fd41f516fac94ed08e156f489f56ca3a80b04d0": {
        "name": "eBTC",
        "symbol": "EBTC",
        "decimals": 8,
        "website": "https://ebitcoin.org",
    },
    "0x99ea4db9ee77acd40b119bd1dc4e33e1c070b80d": {
        "name": "Quantstamp Token",
        "symbol": "QSP",
        "decimals": 18,
        "website": "https://quantstamp.com",
    },
    "0x56ba2ee7890461f463f7be02aac3099f6d5811a8": {
        "name": "BlockCAT Token",
        "symbol": "CAT",
        "decimals": 18,
        "website": "https://www.catcoins.org",
    },
    "0x24692791bc444c5cd0b81e3cbcaba4b04acd1f3b": {
        "name": "UnikoinGold",
        "symbol": "UKG",
        "decimals": 18,
        "website": "https://unikoingold.com",
    },
    "0xea1f346faf023f974eb5adaf088bbcdf02d761f4": {
        "name": "Blocktix Token",
        "symbol": "TIX",
        "decimals": 18,
        "website": "https://blocktix.io",
    },
    "0xd2d6158683aee4cc838067727209a0aaf4359de3": {
        "name": "Bounty0x Token",
        "symbol": "BNTY",
        "decimals": 18,
        "website": "https://bounty0x.io",
    },
    "0x672a1ad4f667fb18a333af13667aa0af1f5b5bdd": {
        "name": "Verify Token",
        "symbol": "CRED",
        "decimals": 18,
        "website": "https://verify.as",
    },
    "0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359": {
        "name": "Dai Stablecoin v1.0",
        "symbol": "DAI",
        "decimals": 18,
        "website": "https://makerdao.com",
    },
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": {
        "name": "Wrapped Ether",
        "symbol": "WETH",
        "decimals": 18,
        "website": "https://weth.io",
    },
    "0xf7b098298f7c69fc14610bf71d5e02c60792894c": {
        "name": "Guppy",
        "symbol": "GUP",
        "decimals": 3,
        "website": "https://matchpool.co/guppy",
    },
    "0xc997d07b0bc607b6d1bcb6fb9d4a5579c466c3e5": {
        "name": "Flip",
        "symbol": "FLIP",
        "decimals": 0,
        "website": "http://www.etherflip.co",
    },
    "0x255aa6df07540cb5d3d297f0d0d4d84cb52bc8e6": {
        "name": "Raiden Token",
        "symbol": "RDN",
        "decimals": 18,
        "website": "https://raiden.network",
    },
    "0x42d6622dece394b54999fbd73d108123806f6a18": {
        "name": "SpankChain",
        "symbol": "SPANK",
        "decimals": 18,
        "website": "https://spankchain.com",
    },
    "0xc27a2f05fa577a83ba0fdb4c38443c0718356501": {
        "name": "Lamden Tau",
        "symbol": "TAU",
        "decimals": 18,
        "website": "https://www.lamden.io",
    },
    "0x107c4504cd79c5d2696ea0030a8dd4e92601b82e": {
        "name": "Bloom Token",
        "symbol": "BLT",
        "decimals": 18,
        "website": "https://hellobloom.io",
    },
    "0xb45a50545beeab73f38f31e5973768c421805e5e": {
        "name": "Trackr",
        "symbol": "TKR",
        "decimals": 18,
        "website": "https://www.trackr.im",
    },
    "0x0af44e2784637218dd1d32a322d44e603a8f0c6a": {
        "name": "Matryx Token",
        "symbol": "MTX",
        "decimals": 18,
        "website": "https://matryx.ai",
    },
    "0x3d1ba9be9f66b8ee101911bc36d3fb562eac2244": {
        "name": "Rivet",
        "symbol": "RVT",
        "decimals": 18,
        "website": "https://rivetzintl.com",
    },
    "0x4ceda7906a5ed2179785cd3a40a69ee8bc99c466": {
        "name": "AION",
        "symbol": "AION",
        "decimals": 8,
        "website": "https://aion.network",
    },
    "0xd0a4b8946cb52f0661273bfbc6fd0e0c75fc6433": {
        "name": "STORM",
        "symbol": "STORM",
        "decimals": 18,
        "website": "https://stormtoken.com",
    },
    "0x340d2bde5eb28c1eed91b2f790723e3b160613b7": {
        "name": "BLOCKv Token",
        "symbol": "VEE",
        "decimals": 18,
        "website": "https://blockv.io",
    },
    "0x9af839687f6c94542ac5ece2e317daae355493a1": {
        "name": "Hydro Protocol Token",
        "symbol": "HOT",
        "decimals": 18,
        "website": "https://thehydrofoundation.com",
    },
    "0x595832f8fc6bf59c85c527fec3740a1b7a361269": {
        "name": "PowerLedger",
        "symbol": "POWR",
        "decimals": 6,
        "website": "https://powerledger.io",
    },
    "0x39bb259f66e1c59d5abef88375979b4d20d98022": {
        "name": "Wax Token",
        "symbol": "WAX",
        "decimals": 8,
        "website": "https://wax.io",
    },
    "0xffe8196bc259e8dedc544d935786aa4709ec3e64": {
        "name": "Hedge Token",
        "symbol": "HDG",
        "decimals": 18,
        "website": "https://hedge-crypto.com",
    },
    "0x52a7cb918c11a16958be40cba7e31e32a499a465": {
        "name": "fidentiaX",
        "symbol": "FDX",
        "decimals": 18,
        "website": "https://www.fidentiax.com",
    },
    "0x0cf0ee63788a0849fe5297f3407f701e122cc023": {
        "name": "Steamr DATAcoin",
        "symbol": "DATA",
        "decimals": 18,
        "website": "https://www.streamr.com",
    },
    "0x5ca9a71b1d01849c0a95490cc00559717fcf0d1d": {
        "name": "Aeternity",
        "symbol": "AE",
        "decimals": 18,
        "website": "https://www.aeternity.com",
    },
    "0xe2e6d4be086c6938b53b22144855eef674281639": {
        "name": "Link Platform",
        "symbol": "LNK",
        "decimals": 18,
        "website": "https://ethereum.link",
    },
    "0x12b19d3e2ccc14da04fae33e63652ce469b3f2fd": {
        "name": "GRID Token",
        "symbol": "GRID",
        "decimals": 12,
        "website": "https://gridplus.io",
    },
    "0xfec0cf7fe078a500abf15f1284958f22049c2c7e": {
        "name": "Maecenas ART Token",
        "symbol": "ART",
        "decimals": 18,
        "website": "https://www.maecenas.co",
    },
    "0xbf2179859fc6d5bee9bf9158632dc51678a4100e": {
        "name": "ELF Token",
        "symbol": "ELF",
        "decimals": 18,
        "website": "https://aelf.io",
    },
    "0x80fb784b7ed66730e8b1dbd9820afd29931aab03": {
        "name": "EthLend Token",
        "symbol": "LEND",
        "decimals": 18,
        "website": "https://ethlend.io",
    },
    "0xc438b4c0dfbb1593be6dee03bbd1a84bb3aa6213": {
        "name": "Ethereum Qchain Token",
        "symbol": "EQC",
        "decimals": 8,
        "website": "https://qchain.co",
    },
    "0xf6b55acbbc49f4524aa48d19281a9a77c54de10f": {
        "name": "WOLK Token",
        "symbol": "WLK",
        "decimals": 18,
        "website": "https://www.wolk.com",
    },
    "0xac3211a5025414af2866ff09c23fc18bc97e79b1": {
        "name": "DOVU",
        "symbol": "DOV",
        "decimals": 18,
        "website": "https://dovu.io",
    },
};

/* Populated by model */
export let ZEROEX_EXCHANGE_ADDRESS: string;

/* Populated by model */
export let ZEROEX_TOKEN_ADDRESS: string;

export const NETWORK_NAME: { [networkId: number]: string } = {
    1: "Mainnet",
    3: "Ropsten",
    4: "Rinkeby",
    42: "Kovan",
};

export const NETWORK_BLOCK_EXPLORER : { [networkId: number]: string }= {
    1: "https://etherscan.io",
    3: "https://ropsten.etherscan.io",
    4: "https://rinkeby.etherscan.io",
    42: "https://kovan.etherscan.io",
};

export const PRICE_API_URL = function (symbols: string[], base: string): string {
    return "https://min-api.cryptocompare.com/data/pricemulti?fsyms=" + symbols.join(',') + "&tsyms=" + base;
};

export const INFURA_API_URL: string = "https://mainnet.infura.io/rdkuEWbeKAjSR9jZ6P1h";

export const ZEROEX_PORTAL_URL: string = "https://0xproject.com/portal";

export const STATISTICS_TIME_WINDOW: number = 86400; /* 24 hours */

export const BLOCK_FETCH_COUNT: number = Math.ceil(STATISTICS_TIME_WINDOW/17);

export const BLOCK_INFO_RETRY_TIMEOUT: number = 15*1000;

export const TRANSACTION_INFO_RETRY_TIMEOUT: number = 15*1000;

export const PRICE_UPDATE_TIMEOUT: number = 5*60*1000;

export const PRICE_CHART_DEFAULT_PAIR: string = "ZRX/WETH";

export const CHART_DEFAULT_COLORS: Array<string> = [
    '#1f77b4', '#aec7e8', '#ff7f0e', '#ffbb78', '#2ca02c', '#98df8a',
    '#d62728', '#ff9896', '#9467bd', '#c5b0d5', '#8c564b', '#c49c94',
    '#e377c2', '#f7b6d2', '#7f7f7f', '#c7c7c7', '#bcbd22', '#dbdb8d',
    '#17becf', '#9edae5'
];

export const CHART_DEFAULT_TOOLTIP_CALLBACK = function (item: any, data: any): string {
    let label = data.labels[item.index];
    let value = data.datasets[item.datasetIndex].tooltips[item.index] || data.datasets[item.datasetIndex].data[item.index];
    return label + ": " + value;
};

export interface CurrencyInfo {
    symbol: string;
    symbol_native: string;
    decimal_digits: number;
    rounding: number;
    code: string;
}

/* From http://www.localeplanet.com/api/auto/currencymap.json */
export const FIAT_CURRENCY_MAP: { [key: string]: CurrencyInfo } = {
    "USD": {
        "symbol": "$",
        "symbol_native": "$",
        "decimal_digits": 2,
        "rounding": 0,
        "code": "USD"
    },
    "EUR": {
        "symbol": "€",
        "symbol_native": "€",
        "decimal_digits": 2,
        "rounding": 0,
        "code": "EUR"
    },
    "GBP": {
        "symbol": "£",
        "symbol_native": "£",
        "decimal_digits": 2,
        "rounding": 0,
        "code": "GBP"
    },
    "JPY": {
        "symbol": "¥",
        "symbol_native": "￥",
        "decimal_digits": 0,
        "rounding": 0,
        "code": "JPY"
    },
    "KRW": {
        "symbol": "₩",
        "symbol_native": "₩",
        "decimal_digits": 0,
        "rounding": 0,
        "code": "KRW"
    },
};

export const FIAT_CURRENCY_DEFAULT: string = "USD";
