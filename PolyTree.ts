import {PolyNode} from "./PolyNode";

export class PolyTree extends PolyNode {
    public allPolys:PolyNode[] = [];

    public clear():void {
        this.allPolys.length = 0;
        this.children.length = 0;
    }

    public first():PolyNode {
        if (this.children.length > 0) {
            return this.children[0];
        }
        return null;
    }

    public get Total():number {
        let result = this.allPolys.length;
        //with negative offsets, ignore the hidden outer polygon ...
        if (result > 0 && this.children[0] != this.allPolys[0]) {
            result--;
        }
        return result;        
    }
}