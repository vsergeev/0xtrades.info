# 0xtrades.info [![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/vsergeev/0xtrades.info/blob/master/LICENSE)

A real-time trade viewer for the [0x protocol](href="https://0xproject.com/").

Visit it at http://0xtrades.info

## Debugging

This app takes the following URL search parameters as debug options:

* `debug`: Enable debug logging
* `provider`: Select web3 provider, choice of `current`, `localhost`, `infura`

## Building

Install dependencies:

```
$ npm install
```

Bundle the JS application:

```
$ webpack
```

Serve the client locally:

```
$ browser-sync start -s docs -f docs
```

## File Structure

* [`client/`](client) - Application
    * [`constants.ts`](client/constants.ts) - Constants
    * [`structs.ts`](client/structs.ts) - Structures
    * [`model.ts`](client/model.ts) - Model
    * [`view.ts`](client/view.ts) - View
    * [`controller.ts`](client/controller.ts) - Controller
    * [`panels.ts`](client/panels.ts) - View Panels
    * [`logger.ts`](client/logger.ts) - Logger
    * [`app.ts`](client/app.ts) - Top-level and Entry Point
    * [`web3-provider-engine.d.ts`](client/web3-provider-engine.d.ts) - web3-provider-engine type definitions
* [`docs/`](docs/) - Website
    * [`css/`](docs/css)
        * [`app.css`](docs/css/app.css) - Website stylesheet
    * [`js/`](docs/js)
        * [`bundle.js`](docs/js/bundle.js) - Bundled JS application
    * [`index.html`](docs/index.html) - Website layout
* [`LICENSE`](LICENSE) - MIT License
* [`README.md`](README.md) - This README

## LICENSE

0xtrades.info is MIT licensed. See the included [LICENSE](LICENSE) file.
