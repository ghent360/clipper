import * as assert from "assert";
import {Int64, Int128} from "../int64/int64";

const tabu:Int64[] = [
    Int64.fromInt(0),
    Int64.fromInt(1),
    Int64.fromInt(2),
    Int64.fromInt(3),
    Int64.fromInt(4),
    Int64.fromInt(5),
    Int64.fromInt(6),
    Int64.fromInt(7),
    Int64.fromInt(8),
    Int64.fromInt(9),
    Int64.fromInt(10),
    Int64.fromInt(11),
    Int64.fromInt(12),
    Int64.fromInt(13),
    Int64.fromInt(14),
    Int64.fromInt(15),
    Int64.fromInt(16),
    Int64.fromInt(1000),
    Int64.fromInt(2003),
    Int64.fromInt(32765),
    Int64.fromInt(32766),
    Int64.fromInt(32767),
    Int64.fromInt(32768),
    Int64.fromInt(32769),
    Int64.fromInt(32760),
    Int64.fromInt(65533),
    Int64.fromInt(65534),
    Int64.fromInt(65535),
    Int64.fromInt(65536),
    Int64.fromInt(65537),
    Int64.fromInt(65538),
    Int64.fromInt(0x7ffffffe),
    Int64.fromInt(0x7fffffff),
    Int64.fromNumber(0x80000000),
    Int64.fromNumber(0x80000001),
    new Int64(0, 0x70000000),
    new Int64(0x80000000, 0x70000000),
    new Int64(0x80000001, 0x70000000),
    new Int64(0xffffffff, 0x7fffffff),
    new Int64(0x8fffffff, 0x7fffffff),
    new Int64(0x8ffffff1, 0x7fffffff),
    new Int64(0, 0x7fffffff),
    new Int64(0x80000000, 0x7fffffff),
    new Int64(0x00000001, 0x7fffffff),
];

const ZERO:Int64 = new Int64(0, 0);

function dump(a:number[], msg:string):void {
    let r:string = "";

    for (let idx = a.length - 1; idx >= 0; idx--)
    {
        r += a[idx].toString(16) + ",";
    }
    console.log(msg, r);
}

function divTest() {
    let n = tabu.length;
    for (let i = 0; i < n; i++)
        for (let j = 1;j< n; j++) {
            let uu = tabu[i];
            let vu = tabu[j];
            let qu = uu.divide(vu);
            let ru = uu.subtract(qu.multiply(vu));
            if (qu.greaterThan(uu) || ru.greaterThanOrEqual(vu)) {
                console.log("Error %d/%d, got %d rem %d", 
                    uu.toNumber(), vu.toNumber(), qu.toNumber(), ru.toNumber());
            }
        }
}

describe("Int64 tests", () => {
    it("load asm code", () => Int64.init());
    it('Zero test', () => {
        assert.equal(ZERO.low, 0);
        assert.equal(ZERO.high, 0);
    });
    it('Add test', () => {
        assert.deepEqual(ZERO.add(ZERO), ZERO);
        let one = Int64.fromInt(1);
        assert.deepEqual(one.add(one.negate()), ZERO);
        let five = Int64.fromInt(5);
        let two = Int64.fromInt(2);
        let three = Int64.fromInt(3);
        assert.deepEqual(five.add(two.negate()), three); // 5 + (-2) = 3
        assert.deepEqual(five.negate().add(two), three.negate()); // -5 + 2 = -3
        assert.deepEqual(
            new Int64(0xfffffffe, 0xffffffff).add(five), three);
    });
    it('Compare test', () => {
        let one = Int64.fromInt(1);
        assert.ok(ZERO.equals(ZERO));
        assert.ok(one.equals(one));
        assert.ok(one.notEquals(ZERO));
        let five = Int64.fromInt(5);
        let two = Int64.fromInt(2);
        assert.ok(five.greaterThan(ZERO));
        assert.ok(five.greaterThan(two));
        assert.ok(five.greaterThan(two.negate()));
        assert.ok(five.negate().lessThan(two));
        assert.ok(five.negate().lessThan(ZERO));
        assert.ok(five.negate().negate().equals(five));
    });
    it('Multiply test', () => {
        assert.deepEqual(ZERO.multiply(ZERO), ZERO);
        let one = Int64.fromInt(1);
        assert.deepEqual(one.multiply(one.negate()), one.negate());
        let five = Int64.fromInt(5);
        let twoThousand = Int64.fromInt(2000);
        let tenThousand = Int64.fromInt(10000);
        assert.deepEqual(five.multiply(twoThousand), tenThousand);
        assert.deepEqual(five.negate().multiply(twoThousand), tenThousand.negate());
        assert.deepEqual(five.multiply(twoThousand.negate()), tenThousand.negate());
        assert.deepEqual(five.negate().multiply(twoThousand.negate()), tenThousand);
        let tst = new Int64(0x49FFFFE9, 0x16140148);
        assert.deepEqual(tst.multiply(tst), new Int64(0xB4000211, 0xBDCBC502));
    });
    it('Shift test', () => {
        let xA5 = new Int64(0xa5a5a5a5, 0xa5a5a5a5);
        assert.deepEqual(xA5.shrUnsigned(1), new Int64(0xd2d2d2d2, 0x52d2d2d2));
        assert.deepEqual(
            new Int64(0, 1).shrUnsigned(1), new Int64(0x80000000, 0));
        assert.deepEqual(
            new Int64(0, 0x12345678).shrUnsigned(32), new Int64(0x12345678, 0));
        assert.deepEqual(
            new Int64(0, 1).shrUnsigned(16), new Int64(0x10000, 0));
        assert.deepEqual(
            new Int64(0, 0x12345678).shr(32), new Int64(0x12345678, 0));
        assert.deepEqual(
            new Int64(0, 1).shr(16), new Int64(0x10000, 0));
        assert.deepEqual(
            Int64.fromInt(-100).shr(2), Int64.fromInt(-25));
        assert.deepEqual(xA5.shl(1), new Int64(0x4b4b4b4a, 0x4b4b4b4b));
        assert.deepEqual(
            new Int64(0x12345678, 0).shl(32), new Int64(0, 0x12345678));
        assert.deepEqual(
            new Int64(0x12345678, 0).shl(16), new Int64(0x56780000, 0x1234));
    });
    it('Division tests', () => {
        let one = Int64.fromInt(1);
        let tst = new Int64(0x49FFFFE9, 0x16140148);
        let divisor = new Int64(0x945A00D1, 0x05);
        assert.deepEqual(ZERO.divide(one), ZERO);

        assert.deepEqual(one.divide(one.negate()), one.negate());
        let five = Int64.fromInt(5);
        let twoThousand = Int64.fromInt(2000);
        let tenThousand = Int64.fromInt(10000);
        assert.deepEqual(tenThousand.divide(twoThousand), five);
        assert.deepEqual(tenThousand.negate().divide(twoThousand), five.negate());
        assert.deepEqual(tenThousand.divide(twoThousand.negate()), five.negate());
        assert.deepEqual(tenThousand.negate().divide(twoThousand.negate()), five);
        assert.deepEqual(tst.divide(divisor), new Int64(0x03F4FEC5, 0));
        assert.deepEqual(tst.modulo(divisor), new Int64(0x99BA0114, 0));
        divTest();
    });
});

function dmp128(r:Int128, name:string): void {
    console.log("%s(%s, %s, %s, %s)", 
        name,
        (r.d0 >>> 0).toString(16), 
        (r.d1 >>> 0).toString(16), 
        (r.d2 >>> 0).toString(16), 
        (r.d3 >>> 0).toString(16));
}

describe("Int128 tests", () => {
    it("load asm code", () => Int64.init());
    it("Add test", () => {
        let one = new Int128(1, 0, 0, 0);
        let carryTest = new Int128(0xffffffff, 0xffffffff, 0xff, 0);
        let r = one.add(carryTest);
        dmp128(one, 'one');
        dmp128(carryTest, 'carryTest');
        dmp128(r, 'r');
    });
});