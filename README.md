# 0xtrades.info [![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/vsergeev/0xtrades.info/blob/master/LICENSE)

A real-time trade viewer for the [0x protocol](href="https://0xproject.com/").

Visit it at http://0xtrades.info

## Debugging

This app takes the following URL search parameters as debug options:

* `debug`: Enable debug logging
* `provider`: Select web3 provider, choice of `current`, `localhost`, `infura`

## File Structure

* [`docs/`](docs/) - Website
    * [`css/`](docs/css)
        * [`app.css`](docs/css/app.css) - Website stylesheet
    * [`js/`](docs/js)
        * [`app/`](docs/js/app) - Application
            * [`constants.js`](docs/js/app/constants.js) - Constants
            * [`model.js`](docs/js/app/model.js) - Model
            * [`view.js`](docs/js/app/view.js) - View
            * [`panels.js`](docs/js/app/panels.js) - View Panels
            * [`app.js`](docs/js/app/app.js) - Controller and Top-level
    * [`index.html`](docs/index.html) - Website layout
* [`LICENSE`](LICENSE) - MIT License
* [`README.md`](README.md) - This README

## LICENSE

0xtrades.info is MIT licensed. See the included [LICENSE](LICENSE) file.

