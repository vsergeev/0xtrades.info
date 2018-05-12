# Client

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
$ npm run build
```

Serve the client locally:

```
$ npm run serve
```

## File Structure

* [`src/`](src) - Sources
    * [`constants.ts`](src/constants.ts) - Constants
    * [`structs.ts`](src/structs.ts) - Structures
    * [`model.ts`](src/model.ts) - Model
    * [`view.ts`](src/view.ts) - View
    * [`controller.ts`](src/controller.ts) - Controller
    * [`panels.ts`](src/panels.ts) - View Panels
    * [`logger.ts`](src/logger.ts) - Logger
    * [`app.ts`](src/app.ts) - Top-level and Entry Point
    * [`web3-provider-engine.d.ts`](src/web3-provider-engine.d.ts) - web3-provider-engine type definitions
* [`../docs/`](../docs/) - Website
    * [`css/`](../docs/css)
        * [`app.css`](../docs/css/app.css) - Website stylesheet
    * [`js/`](docs/js)
        * [`bundle.js`](../docs/js/bundle.js) - Bundled JS application
    * [`index.html`](../docs/index.html) - Website layout
* [`LICENSE`](LICENSE) - MIT License
* [`README.md`](README.md) - This README

## LICENSE

0xtrades.info is MIT licensed. See the included [LICENSE](LICENSE) file.
