import {Int64} from "./intMath/int64";

export class IntRect {
    constructor(
        public left:Int64,
        public top:Int64,
        public right:Int64,
        public bottom:Int64) {
    }

    public static copy(other:IntRect):IntRect {
        return new IntRect(other.left, other.top, other.right, other.bottom);
    }
}