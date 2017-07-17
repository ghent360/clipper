import {DoublePoint} from "./DoublePoint";
import {JoinType, EndType} from "./Enums";

export class PolyNode {
    public parent:PolyNode = null;
    public polygon:DoublePoint[] = [];
    public index:number;
    public joinType:JoinType;
    public endType:EndType;
    public children:PolyNode[] = [];

    public isHole(): boolean {
        let result = true;
        let node = this.parent;
        while (node != null) {
            result = !result;
            node = node.parent;
        }
        return result;
    }

    public childCount():number {
        return this.children.length;
    }
    
    public get Contour():DoublePoint[] {
        return this.polygon;
    }

    addChild(child:PolyNode):void {
        child.parent = this;
        child.index = this.children.length;
        this.children.push(child);
    }

    public next():PolyNode {
        if (this.children.length > 0) {
            return this.children[0];
        }
        return this.nextSiblingUp();
    }

    public nextSiblingUp():PolyNode {
        if (this.parent == null) {
            return null;
        }
        if (this.index == this.parent.children.length - 1) {
            return this.parent.nextSiblingUp();
        }
        return this.parent.children[this.index + 1];
    }    
}