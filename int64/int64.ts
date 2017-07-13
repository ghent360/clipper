import "webassembly-js-api";

export class Int64 {
    public low: number;
    public high: number;
}

const TwoPow32: number = Math.pow(2, 32);

export class Int64Impl {
    private static instance: WebAssembly.Instance;
    private static mem32: Uint32Array;

    private static setArg(n64: Int64, offset: number): void {
        Int64Impl.mem32[offset] = n64.low;
        Int64Impl.mem32[offset + 1] = n64.high;
    }

    protected static function2(a: Int64, b: Int64, name: string): Int64 {
        Int64Impl.setArg(a, 0);
        Int64Impl.setArg(b, 2);
        Int64Impl.instance.exports[name]();
        return this.result();
    }

    protected static function1(a: Int64, name: string): Int64 {
        Int64Impl.setArg(a, 0);
        Int64Impl.instance.exports[name]();
        return this.result();
    }

    protected static result(): Int64 {
        return { low: Int64Impl.mem32[4], high: Int64Impl.mem32[5] };
    }

    public static add(a: Int64, b: Int64): Int64 {
        return Int64Impl.function2(a, b, "add64");
    }

    public static init(): Promise<void> {
        if (Int64Impl.instance != null) {
            return Promise.resolve();
        }
        return Int64Impl.fetchAndInstantiate('int64.wasm')
            .then(instance => {
                Int64Impl.instance = instance;
                Int64Impl.mem32 = new Uint32Array(instance.exports.mem.buffer);
                return;
            });
    }

    public static fromNumber(n: number): Int64 {
        return {
            low: (n >>> 0) & 0xffffffff,
            high: Math.floor(n / TwoPow32) & 0xffffffff
        };
    }

    public static toNumber(n64: Int64): number {
        return (n64.low >>> 0) + n64.high * TwoPow32;
    }

    private static fetchAndInstantiate(url: string): Promise<WebAssembly.Instance> {
        return fetch(url)
            .then(response => response.arrayBuffer())
            .then(bytes => WebAssembly.instantiate(bytes, undefined))
            .then(results => results.instance);
    }
}