const TwoPow32: number = Math.pow(2, 32);
const MaxValueAsDbl:number = Math.pow(2, 63);
const MinValueAsDbl:number = -Math.pow(2, 63);

export class Int64 {
    high:number;
    low:number;

    constructor(low: number, high: number) {
        this.low = low | 0;
        this.high = high | 0;
    }

    public clone():Int64 {
        return new Int64(this.low, this.high);
    }

    public isZero():boolean {
        return this.high == 0 && this.low == 0;
    }

    public isNegative():boolean {
        return this.high < 0;
    }

    public isOdd():boolean {
        return (this.low & 1) == 1;
    }

    public equals(other:Int64):boolean {
        return (this.high == other.high) 
            && (this.low == other.low);
    }

    public notEquals(other:Int64):boolean {
        return (this.high != other.high)
            || (this.low != other.low);
    }

    public not():Int64 {
        return Int64Impl.function64_64(this, "not64");
    }
    
    public neg():Int64 {
        return Int64Impl.function64_64(this, "neg64");
    }
    
    public negate():Int64 {
        return this.neg();
    }
    
    public and(other:Int64):Int64 {
        return Int64Impl.function64_64_64(this, other, "and64");
    }
    
    public or(other:Int64):Int64 {
        return Int64Impl.function64_64_64(this, other, "or64");
    }
    
    public xor(other:Int64):Int64 {
        return Int64Impl.function64_64_64(this, other, "xor64");
    }
    
    public add(b: Int64): Int64 {
        return Int64Impl.function64_64_64(this, b, "add64");
    }

    public sub(b: Int64): Int64 {
        return Int64Impl.function64_64_64(this, b, "sub64");
    }

    public subtract(b: Int64): Int64 {
        return this.sub(b);
    }

    public mul(b: Int64): Int64 {
        return Int64Impl.function64_64_64(this, b, "mul64");
    }

    public multiply(b: Int64): Int64 {
        return this.mul(b);
    }

    public div(b: Int64): Int64 {
        return Int64Impl.function64_64_64(this, b, "divs64");
    }

    public divide(b: Int64): Int64 {
        return this.div(b);
    }
   
    public mod(b: Int64): Int64 {
        return Int64Impl.function64_64_64(this, b, "rems64");
    }

    public modulo(b: Int64): Int64 {
        return this.mod(b);
    }

    public shr(b:number): Int64 {
        return Int64Impl.function64_32_64(this, b, "shrs64");
    }

    public shrUnsigned(b: number): Int64 {
        return Int64Impl.function64_32_64(this, b, "shru64");
    }

    public shl(b: number): Int64 {
        return Int64Impl.function64_32_64(this, b, "shl64");
    }

    public rotr(b: number): Int64 {
        return Int64Impl.function64_32_64(this, b, "rotr64");
    }

    public rotl(b: number): Int64 {
        return Int64Impl.function64_32_64(this, b, "rotl64");
    }

    public clz(): Int64 {
        return Int64Impl.function64_64(this, "clz64");
    }

    public ctz(): Int64 {
        return Int64Impl.function64_64(this, "ctz64");
    }

    public compare(other:Int64):number {
        if (this.equals(other)) {
            return 0;
        }

        let aNeg = this.isNegative();
        let bNeg = other.isNegative();
        if (aNeg && !bNeg) {
            return -1;
        }
        if (!aNeg && bNeg) {
            return 1;
        }

        // at this point, the signs are the same, so subtraction will not overflow
        if (this.sub(other).isNegative()) {
            return -1;
        } else {
            return 1;
        }
    }
    
    public lessThan(other:Int64):boolean {
        return Int64Impl.function2_32(this, other, "lts64") != 0;
    }

    public lessThanOrEqual(other:Int64):boolean {
        return Int64Impl.function2_32(this, other, "les64") != 0;
    }

    public greaterThan(other:Int64):boolean {
        return Int64Impl.function2_32(this, other, "gts64") != 0;
    }

    public greaterThanOrEqual(other:Int64):boolean {
        return Int64Impl.function2_32(this, other, "ges64") != 0;
    }
    
    public static fromNumber(value:number):Int64 {
        if (isNaN(value)) {
            return new Int64(0, 0);
        } else if (value < MinValueAsDbl) {
            return MinValue;
        } else if (value > MaxValueAsDbl) {
            return MaxValue;
        } else if (value < 0) {
            return this.fromNumber(-value).neg();
        } else {
            return new Int64(
                (value % TwoPow32) | 0,
                (value / TwoPow32) | 0);
        }
    }

    public static fromInt(value:number):Int64 {
        let intValue = value | 0;
        if (!(intValue === value)) {
            throw new Error("Value is not an int value");
        }
        return new Int64(intValue, intValue < 0 ? -1 : 0);
    }

    private static fromString(str:string, radix:number = 10):Int64 {
        if (str.length == 0) {
            throw Error('number format error: empty string');
        }

        if (radix < 2 || 36 < radix) {
            throw Error('radix out of range: ' + radix);
        }

        if (str.charAt(0) == '-') {
            return Int64.fromString(str.substring(1), radix).neg();
        } else if (str.indexOf('-') >= 0) {
            throw Error('number format error: interior "-" character: ' + str);
        }

        // Do several (8) digits each time through the loop, so as to
        // minimize the calls to the very expensive emulated multiplication.
        let radixToPower = Int64.fromNumber(Math.pow(radix, 8));

        let result = new Int64(0, 0);
        for (let i = 0; i < str.length; i += 8) {
            let size = Math.min(8, str.length - i);
            let value = parseInt(str.substring(i, i + size), radix);
            if (size < 8) {
                let power = Int64.fromNumber(Math.pow(radix, size));
                result = result.mul(power).add(Int64.fromNumber(value));
            } else {
                result = result.mul(radixToPower);
                result = result.add(Int64.fromNumber(value));
            }
        }
        return result;
    }

    public toNumber(): number {
        return (this.low >>> 0) + this.high * TwoPow32;
    }

    public toInt():number {
        return this.low;
    }

    public toString(radix:number = 10):string {
        if (radix < 2 || 36 < radix) {
            throw Error('radix out of range: ' + radix);
        }

        if (this.isZero()) {
            return '0';
        }

        if (this.isNegative()) {
            if (this.equals(MinValue)) {
                // We need to change the Long value before it can be negated, so we remove
                // the bottom-most digit in this base and then recurse to do the rest.
                let radixLong = Int64.fromNumber(radix);
                let div = this.div(radixLong);
                let rem = div.mul(radixLong).sub(this);
                return div.toString(radix) + rem.toInt().toString(radix);
            } else {
                return '-' + this.neg().toString(radix);
            }
        }

        // Do several (6) digits each time through the loop, so as to
        // minimize the calls to the very expensive emulated div.
        let radixToPower = Int64.fromNumber(Math.pow(radix, 6));

        let rem = new Int64(this.low, this.high);
        let result = '';
        while (true) {
            let remDiv = rem.div(radixToPower);
            // The right shifting fixes negative values in the case when
            // intval >= 2^31; for more details see
            // https://github.com/google/closure-library/pull/498
            let intval = rem.sub(remDiv.mul(radixToPower)).toInt() >>> 0;
            let digits = intval.toString(radix);

            rem = remDiv;
            if (rem.isZero()) {
                return digits + result;
            } else {
                while (digits.length < 6) {
                    digits = '0' + digits;
                }
                result = '' + digits + result;
            }
        }
    }

    public static init():Promise<void> {
        return Int64Impl.init();
    }
}

const MinValue:Int64 = new Int64(0, 0x80000000);
const MaxValue:Int64 = new Int64(0xffffffff, 0x7fffffff);

class Int64Impl {
    private static instance: WebAssembly.Instance;
    private static mem32: Uint32Array;

    private static setArg64(n64: Int64, offset: number): void {
        Int64Impl.mem32[offset] = n64.low;
        Int64Impl.mem32[offset + 1] = n64.high;
    }

    private static setArg32(n32: number, offset: number): void {
        Int64Impl.mem32[offset] = n32|0;
    }

    public static function64_32_64(a: Int64, b: number, name: string): Int64 {
        Int64Impl.setArg64(a, 0);
        Int64Impl.setArg32(b, 2);
        Int64Impl.instance.exports[name]();
        return this.result64();
    }

    public static function64_64_64(a: Int64, b: Int64, name: string): Int64 {
        Int64Impl.setArg64(a, 0);
        Int64Impl.setArg64(b, 2);
        Int64Impl.instance.exports[name]();
        return this.result64();
    }

    public static function64_64(a: Int64, name: string): Int64 {
        Int64Impl.setArg64(a, 0);
        Int64Impl.instance.exports[name]();
        return this.result64();
    }

    protected static result64(): Int64 {
        return new Int64(Int64Impl.mem32[4], Int64Impl.mem32[5]);
    }

    public static function2_32(a: Int64, b: Int64, name: string): number {
        Int64Impl.setArg64(a, 0);
        Int64Impl.setArg64(b, 2);
        Int64Impl.instance.exports[name]();
        return this.result32();
    }

    protected static result32(): number {
        return Int64Impl.mem32[4];
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

    private static fetchAndInstantiate(url: string): Promise<WebAssembly.Instance> {
        if (typeof fetch === 'function') {
            return fetch(url)
                .then(response => response.arrayBuffer())
                .then(bytes => WebAssembly.instantiate(bytes, undefined))
                .then(results => results.instance);
        }
        let fs = require('fs');
        return new Promise((resolve, reject) => {
                try {
                    fs.readFile(url, (err, buffer) => {
                        if (err) reject(err);
                        else resolve(buffer);
                    });
                } catch (err) {
                    reject(err);
                }
            })
            .then(bytes => WebAssembly.instantiate(bytes, undefined))
            .then(results => results.instance);
    }
}
