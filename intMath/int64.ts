const TwoPow32: number = Math.pow(2, 32);
const TwoPow64: number = Math.pow(2, 64);
const TwoPow96: number = Math.pow(2, 96);
const MaxValue64AsDbl:number = Math.pow(2, 63);
const MinValue64AsDbl:number = -Math.pow(2, 63);
const MaxValue128AsDbl:number = Math.pow(2, 127);
const MinValue128AsDbl:number = -Math.pow(2, 127);

export class Int64 {
    high:number;
    low:number;

    constructor(low: number, high: number) {
        this.low = low >>> 0;
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

    public isPositive():boolean {
        return this.high > 0 
            || (this.high == 0 && this.low != 0);
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
        return LongIntImpl.function64_64(this, "not64");
    }
    
    public neg():Int64 {
        return LongIntImpl.function64_64(this, "neg64");
    }
    
    public negate():Int64 {
        return this.neg();
    }
    
    public and(other:Int64):Int64 {
        return LongIntImpl.function64_64_64(this, other, "and64");
    }
    
    public or(other:Int64):Int64 {
        return LongIntImpl.function64_64_64(this, other, "or64");
    }
    
    public xor(other:Int64):Int64 {
        return LongIntImpl.function64_64_64(this, other, "xor64");
    }
    
    public add(b: Int64): Int64 {
        return LongIntImpl.function64_64_64(this, b, "add64");
    }

    public sub(b: Int64): Int64 {
        return LongIntImpl.function64_64_64(this, b, "sub64");
    }

    public subtract(b: Int64): Int64 {
        return this.sub(b);
    }

    public mul(b: Int64): Int64 {
        return LongIntImpl.function64_64_64(this, b, "mul64");
    }

    public multiply(b: Int64): Int64 {
        return this.mul(b);
    }

    public div(b: Int64): Int64 {
        return LongIntImpl.function64_64_64(this, b, "divs64");
    }

    public divide(b: Int64): Int64 {
        return this.div(b);
    }
   
    public mod(b: Int64): Int64 {
        return LongIntImpl.function64_64_64(this, b, "rems64");
    }

    public modulo(b: Int64): Int64 {
        return this.mod(b);
    }

    public shr(b:number): Int64 {
        return LongIntImpl.function64_32_64(this, b, "shrs64");
    }

    public shrUnsigned(b: number): Int64 {
        return LongIntImpl.function64_32_64(this, b, "shru64");
    }

    public shl(b: number): Int64 {
        return LongIntImpl.function64_32_64(this, b, "shl64");
    }

    public rotr(b: number): Int64 {
        return LongIntImpl.function64_32_64(this, b, "rotr64");
    }

    public rotl(b: number): Int64 {
        return LongIntImpl.function64_32_64(this, b, "rotl64");
    }

    public clz(): Int64 {
        return LongIntImpl.function64_64(this, "clz64");
    }

    public ctz(): Int64 {
        return LongIntImpl.function64_64(this, "ctz64");
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
        return LongIntImpl.function64_64_32(this, other, "lts64") != 0;
    }

    public lessThanOrEqual(other:Int64):boolean {
        return LongIntImpl.function64_64_32(this, other, "les64") != 0;
    }

    public greaterThan(other:Int64):boolean {
        return LongIntImpl.function64_64_32(this, other, "gts64") != 0;
    }

    public greaterThanOrEqual(other:Int64):boolean {
        return LongIntImpl.function64_64_32(this, other, "ges64") != 0;
    }
    
    public static fromNumber(value:number):Int64 {
        if (isNaN(value)) {
            return new Int64(0, 0);
        } else if (value < MinValue64AsDbl) {
            return MinValue64;
        } else if (value > MaxValue64AsDbl) {
            return MaxValue64;
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
            if (this.equals(MinValue64)) {
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

    public static Swap(one:Int64, other:Int64):void {
        let tmp = one.clone();
        one.low = other.low;
        one.high = other.high;
        other.low = tmp.low;
        other.high = tmp.high;
    }

    public static max(a:Int64, b:Int64):Int64 {
        return a.greaterThan(b) ? a : b;
    }

    public static min(a:Int64, b:Int64):Int64 {
        return a.lessThan(b) ? a : b;
    }

    public static init():Promise<void> {
        return LongIntImpl.init();
    }
}

export class Int128 {
    d0:number;
    d1:number;
    d2:number;
    d3:number;

    constructor(d0: number, d1: number, d2: number, d3: number) {
        this.d0 = d0 >>> 0;
        this.d1 = d1 >>> 0;
        this.d2 = d2 >>> 0;
        this.d3 = d3 | 0;
    }

    public clone():Int128 {
        return new Int128(this.d0, this.d1, this.d2, this.d3);
    }

    public isZero():boolean {
        return this.d3 == 0 
            && this.d2 == 0
            && this.d1 == 0
            && this.d0 == 0;
    }

    public isNegative():boolean {
        return this.d3 < 0;
    }

    public isPositive():boolean {
        return this.d3 > 0 
            || (this.d3 == 0 && (this.d2 != 0 || this.d1 != 0 || this.d0 != 0));
    }

    public isOdd():boolean {
        return (this.d0 & 1) == 1;
    }

    public equals(other:Int128):boolean {
        return (this.d3 == other.d3) 
            && (this.d2 == other.d2)
            && (this.d1 == other.d1)
            && (this.d0 == other.d0);
    }

    public notEquals(other:Int128):boolean {
        return (this.d3 != other.d3)
            || (this.d2 != other.d2)
            || (this.d1 != other.d1)
            || (this.d0 != other.d0);
    }

    public not():Int128 {
        return LongIntImpl.function128_128(this, "not128");
    }

    public neg():Int128 {
        return LongIntImpl.function128_128(this, "neg128");
    }

    public negate():Int128 {
        return this.neg();
    }

    public and(b: Int128): Int128 {
        return LongIntImpl.function128_128_128(this, b, "and128");
    }

    public or(b: Int128): Int128 {
        return LongIntImpl.function128_128_128(this, b, "or128");
    }

    public xor(b: Int128): Int128 {
        return LongIntImpl.function128_128_128(this, b, "xor128");
    }

    public add(b: Int128): Int128 {
        return LongIntImpl.function128_128_128(this, b, "add128");
    }

    public sub(b: Int128): Int128 {
        return LongIntImpl.function128_128_128(this, b, "sub128");
    }

    public subtract(b: Int128): Int128 {
        return this.sub(b);
    }

    public compare(other:Int128):number {
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

    public lessThan(b:Int128):boolean {
        return this.compare(b) < 0;
    }

    public lessThanOrEqual(b:Int128):boolean {
        return this.compare(b) <= 0;
    }

    public greaterThan(b:Int128):boolean {
        return this.compare(b) > 0;
    }

    public greaterThanOrEqual(b:Int128):boolean {
        return this.compare(b) >= 0;
    }

    public mul(b: Int128): Int128 {
        if (this.isZero() || b.isZero()) {
            return new Int128(0, 0, 0, 0);
        }

        if (this.isNegative()) {
            if (b.isNegative()) {
                return this.neg().mul(b.neg());
            } else {
                return this.neg().mul(b).neg();
            }
        } else if (b.isNegative()) {
            return this.mul(b.neg()).neg();
        }

        return LongIntImpl.function128_128_128(this, b, "mul128");
    }

    public multiply(b: Int128): Int128 {
        return this.mul(b);
    }

    public shiftLeft(numBits:number):Int128 {
        numBits &= 127;
        if (numBits == 0) {
            return this.clone();
        } else {
            let value = this.clone();
            if (numBits >= 96) {
                numBits -= 96
                return new Int128(0, 0, 0, this.d0 << numBits);
            }
            if (numBits >= 64) {
                numBits -= 64;
                return new Int128(
                    0,
                    0,
                    this.d0 << numBits,
                    this.d1 << numBits | this.d0 >>> (32 - numBits));
            }
            if (numBits >= 32) {
                numBits -= 32;
                return new Int128(
                    0,
                    this.d0 << numBits,
                    this.d1 << numBits | this.d0 >>> (32 - numBits),
                    this.d2 << numBits | this.d1 >>> (32 - numBits));
            }
            return new Int128(
                this.d0 << numBits,
                this.d1 << numBits | this.d0 >>> (32 - numBits),
                this.d2 << numBits | this.d1 >>> (32 - numBits),
                this.d3 << numBits | this.d2 >>> (32 - numBits));
        }
    }

    public shiftRight(numBits:number):Int128 {
        numBits &= 127;
        if (numBits == 0) {
            return this.clone();
        } else {
            let value = this.clone();
            if (numBits >= 96) {
                numBits -= 96
                return new Int128(this.d3 >> numBits, 0, 0, 0);
            }
            if (numBits >= 64) {
                numBits -= 64;
                return new Int128(
                    this.d3 >> numBits | this.d2 << (32 - numBits),
                    this.d3 >> numBits,
                    0,
                    0);
            }
            if (numBits >= 32) {
                numBits -= 32;
                return new Int128(
                    this.d2 >>> numBits | this.d1 << (32 - numBits),
                    this.d3 >> numBits | this.d2 << (32 - numBits),
                    this.d3 >> numBits,
                    0);
            }
            return new Int128(
                this.d1 >>> numBits | this.d0 << (32 - numBits),
                this.d2 >>> numBits | this.d1 << (32 - numBits),
                this.d3 >> numBits | this.d2 << (32 - numBits),
                this.d3 >> numBits);
        }
    }

    public shiftRightUnsigned(numBits:number):Int128 {
        numBits &= 127;
        if (numBits == 0) {
            return this.clone();
        } else {
            let value = this.clone();
            if (numBits >= 96) {
                numBits -= 96
                return new Int128(this.d3 >>> numBits, 0, 0, 0);
            }
            if (numBits >= 64) {
                numBits -= 64;
                return new Int128(
                    this.d3 >>> numBits | this.d2 << (32 - numBits),
                    this.d3 >>> numBits,
                    0,
                    0);
            }
            if (numBits >= 32) {
                numBits -= 32;
                return new Int128(
                    this.d2 >>> numBits | this.d1 << (32 - numBits),
                    this.d3 >>> numBits | this.d2 << (32 - numBits),
                    this.d3 >>> numBits,
                    0);
            }
            return new Int128(
                this.d1 >>> numBits | this.d0 << (32 - numBits),
                this.d2 >>> numBits | this.d1 << (32 - numBits),
                this.d3 >>> numBits | this.d2 << (32 - numBits),
                this.d3 >>> numBits);
        }
    }

    public toNumber():number {
        return (this.d0 >>> 0)
            + (this.d1 >>> 0) * TwoPow32
            + (this.d2 >>> 0) * TwoPow64
            + (this.d3 >>> 0) * TwoPow96;
    }

    public static fromInt64(v:Int64):Int128 {
        let signExtent = v.high < 0 ? -1 : 0;
        return new Int128(v.low, v.high, signExtent, signExtent);
    }

    public static fromNumber(value:number):Int128 {
        if (isNaN(value)) {
            return new Int128(0, 0, 0, 0);
        } else if (value < MinValue128AsDbl) {
            return MinValue128;
        } else if (value > MaxValue128AsDbl) {
            return MaxValue128;
        } else if (value < 0) {
            return this.fromNumber(-value).neg();
        } else {
            let d0 = value & TwoPow32;
            value /= TwoPow32;
            let d1 = value & TwoPow32;
            value /= TwoPow32;
            let d2 = value & TwoPow32;
            value /= TwoPow32;
            let d3 = value;
            return new Int128(d0, d1, d2, d3);
        }
    }

    public static fromInt(value:number):Int128 {
        let intValue = value | 0;
        if (!(intValue === value)) {
            throw new Error("Value is not an int value");
        }
        let signExtent = value < 0 ? -1 : 0;
        return new Int128(intValue, signExtent, signExtent, signExtent);
    }

    public static mul64(a:Int64, b:Int64):Int128 {
        return Int128.fromInt64(a).mul(Int128.fromInt64(b));
    }

    public static Swap(one:Int128, other:Int128):void {
        let tmp = one.clone();
        one.d0 = other.d0;
        one.d1 = other.d1;
        one.d2 = other.d2;
        one.d3 = other.d3;
        other.d0 = tmp.d0;
        other.d1 = tmp.d1;
        other.d2 = tmp.d2;
        other.d3 = tmp.d3;
    }

    public static max(a:Int128, b:Int128):Int128 {
        return a.greaterThan(b) ? a : b;
    }

    public static min(a:Int128, b:Int128):Int128 {
        return a.lessThan(b) ? a : b;
    }
}

const MinValue64:Int64 = new Int64(0, 0x80000000);
const MaxValue64:Int64 = new Int64(0xffffffff, 0x7fffffff);
const MinValue128:Int128 = new Int128(0, 0, 0, 0x80000000);
const MaxValue128:Int128 = new Int128(0xffffffff, 0xffffffff, 0xffffffff, 0x7fffffff);

class LongIntImpl {
    private static instance: WebAssembly.Instance;
    private static mem32: Uint32Array;

    private static setArg128(n128: Int128, offset: number): void {
        LongIntImpl.mem32[offset] = n128.d0;
        LongIntImpl.mem32[offset + 1] = n128.d1;
        LongIntImpl.mem32[offset + 2] = n128.d2;
        LongIntImpl.mem32[offset + 3] = n128.d3;
    }
    
    private static setArg64(n64: Int64, offset: number): void {
        LongIntImpl.mem32[offset] = n64.low;
        LongIntImpl.mem32[offset + 1] = n64.high;
    }

    private static setArg32(n32: number, offset: number): void {
        LongIntImpl.mem32[offset] = n32|0;
    }

    public static function64_32_64(a: Int64, b: number, name: string): Int64 {
        LongIntImpl.setArg64(a, 0);
        LongIntImpl.setArg32(b, 2);
        LongIntImpl.instance.exports[name]();
        return this.result64();
    }

    public static function64_64_64(a: Int64, b: Int64, name: string): Int64 {
        LongIntImpl.setArg64(a, 0);
        LongIntImpl.setArg64(b, 2);
        LongIntImpl.instance.exports[name]();
        return this.result64();
    }

    public static function64_64(a: Int64, name: string): Int64 {
        LongIntImpl.setArg64(a, 0);
        LongIntImpl.instance.exports[name]();
        return this.result64();
    }

    public static function64_64_32(a: Int64, b: Int64, name: string): number {
        LongIntImpl.setArg64(a, 0);
        LongIntImpl.setArg64(b, 2);
        LongIntImpl.instance.exports[name]();
        return this.result32();
    }

    public static function128_128_128(a: Int128, b: Int128, name: string): Int128 {
        LongIntImpl.setArg128(a, 0);
        LongIntImpl.setArg128(b, 4);
        LongIntImpl.instance.exports[name]();
        return this.result128();
    }

    public static function128_128(a: Int128, name: string): Int128 {
        LongIntImpl.setArg128(a, 0);
        LongIntImpl.instance.exports[name]();
        return this.result128();
    }

    protected static result128(): Int128 {
        return new Int128(
            LongIntImpl.mem32[8],
            LongIntImpl.mem32[9],
            LongIntImpl.mem32[10],
            LongIntImpl.mem32[11]);
    }
    
    protected static result64(): Int64 {
        return new Int64(LongIntImpl.mem32[8], LongIntImpl.mem32[9]);
    }

    protected static result32(): number {
        return LongIntImpl.mem32[8];
    }

    public static init(): Promise<void> {
        if (LongIntImpl.instance != null) {
            return Promise.resolve();
        }
        return LongIntImpl.fetchAndInstantiate('int64.wasm')
            .then(instance => {
                LongIntImpl.instance = instance;
                LongIntImpl.mem32 = new Uint32Array(instance.exports.mem.buffer);
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
