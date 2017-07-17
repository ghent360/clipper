import {IntPoint} from "./IntPoint";

export class DoublePoint {
    constructor(public x:number, public y:number) {}

    public equals(other:DoublePoint): boolean {
        return this.x == other.x && this.y == other.y;
    }

    public notEquals(other:DoublePoint): boolean {
        return this.x != other.x || this.y != other.y;
    }

    public static copy(p:DoublePoint):DoublePoint {
        return new DoublePoint(p.x, p.y);
    }

    public static fromIntPoint(p:IntPoint):DoublePoint {
        return new DoublePoint(p.x.toNumber(), p.y.toNumber());
    }
}