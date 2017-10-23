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
/* Logger */
/******************************************************************************/

Logger = {
  enable: function () { Logger.log = Logger._log_console; },
  disable: function () { Logger.log = Logger._log_null; },

  _log_console: console.log.bind(window.console),
  _log_null: function (s) { },

  log: null,
  error: console.error.bind(window.console),
};

/******************************************************************************/
/* Controller */
/******************************************************************************/

var Controller = function (model, view) {
  this.model = model;
  this.view = view;
};

Controller.prototype = {
  init: function () {
    /* Bind model -> view */
    this.model.connectedCallback = this.view.handleConnectedEvent.bind(this.view);
    this.model.newTradeCallback = this.view.handleNewTradeEvent.bind(this.view);
    this.model.statisticsUpdatedCallback = this.view.handleStatisticsUpdatedEvent.bind(this.view);

    /* Bind view -> model */
    this.view.fetchMoreCallback = this.model.fetchPastTrades.bind(this.model);
    this.view.fetchOrderCallback = this.model.fetchOrder.bind(this.model);

    /* Initialize view */
    this.view.init();

    /* Initialize model */
    this.model.init();
  },
};

/******************************************************************************/
/* Top-level */
/******************************************************************************/

App = {
  model: null,
  view: null,
  controller: null,

  init: function () {
    var params = (new URLSearchParams(window.location.search));
    /* Supported parameters:
         debug
         provider: current, localhost, infura
         cur: USD, EUR, etc.
     */

    /* Enable logging in debug mode */
    if (params.has("debug"))
      Logger.enable();
    else
      Logger.disable();

    /* Look up currency */
    var currency = params.get("cur");

    /* Look up provider */
    var provider = params.get("provider");

    if (!provider)
      provider = (typeof web3 !== 'undefined') ? 'current' : 'infura';

    Logger.log('[App] Using web3 provider ' + provider);
    if (provider == 'current')
      window.web3 = new Web3(web3.currentProvider);
    else if (provider == 'localhost')
      window.web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
    else if (provider == 'infura')
      window.web3 = new Web3(new ZeroClientProvider({getAccounts: function (cb) { cb(null, []); }, rpcUrl: INFURA_API_URL}));

    App.model = new Model(window.web3, currency);
    App.view = new View();
    App.controller = new Controller(App.model, App.view);

    App.controller.init();
  },
};

window.onload = App.init;
