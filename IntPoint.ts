import {Int64} from "./intMath/int64";

export class IntPoint {
    constructor(public x:Int64, public y:Int64) {
    }

    public equals(other:IntPoint): boolean {
        return this.x.equals(other.x)
            && this.y.equals(other.y);
    }

    public notEquals(other:IntPoint): boolean {
        return this.x.notEquals(other.x)
            || this.y.notEquals(other.y);
    }

    public static fromDoubles(x:number, y:number):IntPoint {
        return new IntPoint(Int64.fromNumber(x), Int64.fromNumber(y));
    }

    public static copy(other:IntPoint):IntPoint {
        return new IntPoint(other.x, other.y);
    }
}