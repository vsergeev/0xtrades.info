declare module "web3-provider-engine" {
    import * as Web3 from 'web3';

    namespace Web3ProviderEngine { }

    class Web3ProviderEngine implements Web3.Provider {
        addProvider(provider: any): void;
        start(): void;
        sendAsync(payload: any, callback: (error: any, response: any) => void): void;
    }

    export = Web3ProviderEngine;
}

declare module "web3-provider-engine/subproviders/filters" {
    namespace FilterSubprovider { }

    class FilterSubprovider {
        constructor(opts?: any);
    }

    export = FilterSubprovider;
}

declare module "web3-provider-engine/subproviders/fetch" {
    namespace FetchSubprovider { }

    class FetchSubprovider {
        constructor(opts?: any);
    }

    export = FetchSubprovider;
}
