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
};

Panel.prototype = {
  create: function (root) {
    /* Create skeleton DOM with header, header link, and close button */
    var dom = $(`
      <div class="row panel-header">
        <span class="anchor" id="panel-${this._id}"></span>
        <h3>${this._title}
          <a class="panel-header-link" href="#panel-${this._id}"><i class="icon-link"></i></a>
          <a class="panel-close" href="#"><i class="icon-link"></i></a>
        </h3>
      </div>
      <div class="row panel-content">
      </div>
    `);

    /* Associate callback for close button */
    dom.find(".panel-close")
      .on('click', {panel: this, view: this._view}, function (e) {
        e.preventDefault();
        e.data.view.panelRemove(e.data.panel);
      });

    this._dom = dom;

    root.append(dom);

    return root;
  },

  destroy: function () {
    if (this._dom) {
      this._dom.remove();
      this._dom = null;
    }
  },

  /* Initialization */

  initialize: function () {
    /* Implemented in derived classes */
  },

  /* Event handlers */

  handleStatisticsUpdatedEvent: function (feeStats, volumeStats, priceVolumeHistory) {
    /* Implemented in derived classes */
  },

  handleNewTradeEvent: function (trade) {
    /* Implemented in derived classes */
  },

  handleRefreshEvent: function () {
    /* Implemented in derived classes */
  },
};

/******************************************************************************/
/* EmptyPanel */
/******************************************************************************/

var EmptyPanel = function (view) {
  Panel.call(this, view);
  this._title = "Empty Panel";
};

EmptyPanel.prototype = Object.create(Panel.prototype);
EmptyPanel.prototype.constructor = EmptyPanel;

EmptyPanel.prototype.create = function (root) {
  Panel.prototype.create.call(this, root);

  this._root = root;

  var elem = $(`
    <div class="text-center">
      <button type="button" class="btn btn-sm btn-info">Split</button>
    </div>
  `).find('button').click(this.handleSplit.bind(this));

  root.find('.panel-content').append(elem);
};

EmptyPanel.prototype.handleSplit = function () {
  this._view.panelRemove(this);
  [panel1, panel2] = this._view.domSplitPanelRow(this._root);
  this._view.panelCreate(panel1, EmptyPanel);
  this._view.panelCreate(panel2, EmptyPanel);
};

EmptyPanel.prototype.handeSelect = function (choice) {
  this._view.panelRemove(this);
  this._view.panelCreate(this._root, EmptyPanel /* FIXME */);
};

/******************************************************************************/
/* VolumeStatisticsPanel */
/******************************************************************************/

/******************************************************************************/
/* RecentTradesPanel */
/******************************************************************************/

/******************************************************************************/
/* TokenVolumeChartPanel */
/******************************************************************************/

/******************************************************************************/
/* TokenOccurrenceChartPanel */
/******************************************************************************/

/******************************************************************************/
/* FeeFeelessChartPanel */
/******************************************************************************/

/******************************************************************************/
/* RelayFeeChartPanel */
/******************************************************************************/

/******************************************************************************/
/* PriceChartPanel */
/******************************************************************************/

