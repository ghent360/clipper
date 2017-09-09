import {IntPoint} from "../clipper";
import {Int64} from "intmath/intmath";
import * as assert from "assert";

describe("IntPoint tests", () => {
    it("fromXY test", () => {
        let v = IntPoint.fromXY(123, 456);
        assert.equal(v.x.toInt(), 123);
    })
})