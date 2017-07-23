import {Int64, Int128} from "./intMath/int64";

type Path=Array<IntPoint>;
type Paths=Array<Array<IntPoint>>;

enum ClipType {
    ctIntersection,
    ctUnion,
    ctDifference,
    ctXor
};

enum PolyType {
    ptSubject,
    ptClip
};
  
enum JoinType { 
    jtSquare, 
    jtRound, 
    jtMiter
};

//By far the most widely used winding rules for polygon filling are
//EvenOdd & NonZero (GDI, GDI+, XLib, OpenGL, Cairo, AGG, Quartz, SVG, Gr32)
//Others rules include Positive, Negative and ABS_GTR_EQ_TWO (only in OpenGL)
//see http://glprogramming.com/red/chapter11.html
enum PolyFillType {
    pftEvenOdd,
    pftNonZero,
    pftPositive,
    pftNegative
};

enum EndType { 
    etClosedPolygon, 
    etClosedLine, 
    etOpenButt, 
    etOpenSquare, 
    etOpenRound 
};

enum EdgeSide {
    esLeft,
    esRight
};

enum Direction {
    dRightToLeft,
    dLeftToRight
};

class IntPoint {
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

    public static Swap(first:IntPoint, second:IntPoint):void {
        let tmpX = first.x.clone();
        let tmpY = first.y.clone();
        first.x = second.x;
        first.y = second.y;
        second.x = tmpX;
        second.y = tmpY;
    }
}

class DoublePoint {
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

class IntRect {
    public left:Int64;
    public top:Int64;
    public right:Int64;
    public bottom:Int64;

    public static Init(left:Int64, top:Int64, right:Int64, bottom:Int64):IntRect {
        let result = new IntRect();
        result.left = left.clone();
        result.top = top.clone();
        result.right = right.clone();
        result.bottom = bottom.clone();
        return result;
    }

    public static copy(other:IntRect):IntRect {
        return IntRect.Init(other.left, other.top, other.right, other.bottom);
    }
}

class PolyNode {
    public parent:PolyNode = null;
    public polygon:Path = new Path();
    public index:number;
    public joinType:JoinType;
    public endType:EndType;
    public children:Array<PolyNode> = new Array<PolyNode>();

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
    
    public get Contour():Path {
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

class PolyTree extends PolyNode {
    public allPolys:Array<PolyNode> = new Array<PolyNode>();

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

class TEdge {
    Bot:IntPoint;
    Curr:IntPoint; //current (updated for every new scanbeam)
    Top:IntPoint;
    Delta:IntPoint;
    Dx:number;
    PolyTyp:PolyType;
    Side:EdgeSide; //side only refers to current side of solution poly
    WindDelta:number; //1 or -1 depending on winding direction
    WindCnt:number;
    WindCnt2:number; //winding count of the opposite polytype
    OutIdx:number;
    Next:TEdge;
    Prev:TEdge;
    NextInLML:TEdge;
    NextInAEL:TEdge;
    PrevInAEL:TEdge;
    NextInSEL:TEdge;
    PrevInSEL:TEdge;
}

class IntersectNode {
    Edge1:TEdge;
    Edge2:TEdge;
    Pt:IntPoint;
}

function MyIntersectNodeSort(node1:IntersectNode, node2:IntersectNode):number {
    return node2.Pt.y.compare(node1.Pt.y);
}

class LocalMinima {
    Y:Int64;
    LeftBound:TEdge;
    RightBound:TEdge;
    Next:LocalMinima;
}

class Scanbeam {
    Y:Int64;
    Next:Scanbeam;
}

class Maxima {
    X:Int64;
    Next:Maxima;
    Prev:Maxima;
}

class OutPt {
    Idx:number;
    Pt:IntPoint;
    Next:OutPt;
    Prev:OutPt;
}

//OutRec: contains a path in the clipping solution. Edges in the AEL will
//carry a pointer to an OutRec when they are part of the clipping solution.
class OutRec {
    Idx:number;
    IsHole:boolean;
    IsOpen:boolean;
    FirstLeft:OutRec; //see comments in clipper.pas
    Pts:OutPt;
    BottomPt:OutPt;
    PolyNode:PolyNode;
}

class Join {
    OutPt1:OutPt;
    OutPt2:OutPt;
    OffPt:IntPoint;
}

const horizontal:number = -3.4E+38;
const Skip:number = -2;
const Unassigned:number = -1;
const tolerance:number = 1.0E-20;
const loRange = new Int64(0x3FFFFFFF, 0);
const hiRange = new Int64(0xFFFFFFFF, 0x3FFFFFFF); 
const ioReverseSolution:number = 1;
const ioStrictlySimple:number = 2;
const ioPreserveCollinear:number = 4;

function near_zero(val:number):boolean {
    return Math.abs(val) < tolerance;
}

function IsHorizontal(e:TEdge):boolean {
    return e.Delta.y.isZero();
}

function PointIsVertex(pt:IntPoint, pp:OutPt):boolean {
    let pp2 = pp;
    do {
        if (pp2.Pt.equals(pt)) {
            return true;
        }
        pp2 = pp2.Next;
    } while (pp2 != pp);
    return false;
}

function PointOnLineSegment(
    pt:IntPoint, 
    linePt1:IntPoint,
    linePt2:IntPoint,
    UseFullRange:boolean):boolean {

    if (UseFullRange) {
        return (pt.x.equals(linePt1.x) && pt.y.equals(linePt1.y))
         || (pt.x.equals(linePt2.x) && pt.y.equals(linePt2.y))
         || (pt.x.greaterThan(linePt1.x) == pt.x.lessThan(linePt2.x)
            && pt.y.greaterThan(linePt1.y) == pt.y.lessThan(linePt2.y)
            && Int128.mul64(pt.x.sub(linePt1.x), linePt2.y.sub(linePt1.y)).equals(
                    Int128.mul64(linePt2.x.sub(linePt1.x), pt.y.sub(linePt1.y))));
    }
    return (pt.x.equals(linePt1.x) && pt.y.equals(linePt1.y))
        || (pt.x.equals(linePt2.x) && pt.y.equals(linePt2.y))
        || (pt.x.greaterThan(linePt1.x) == pt.x.lessThan(linePt2.x)
            && pt.y.greaterThan(linePt1.y) == pt.y.lessThan(linePt2.y)
            && pt.x.sub(linePt1.x).mul(linePt2.y.sub(linePt1.y)).equals(
                linePt2.x.sub(linePt1.x).mul(pt.y.sub(linePt1.y))));
}

function PointOnPolygon(pt:IntPoint, pp:OutPt, UseFullRange:boolean):boolean {
    let pp2 = pp;
    do {
        if (PointOnLineSegment(pt, pp2.Pt, pp2.Next.Pt, UseFullRange)) {
            return true;
        }
        pp2 = pp2.Next;
    } while (pp2 != pp);
    return false;
}

function SlopesEqual2E(e1:TEdge, e2:TEdge, UseFullRange:boolean):boolean {
    if (UseFullRange) {
        return Int128.mul64(e1.Delta.y, e2.Delta.y).equals(
                    Int128.mul64(e1.Delta.x, e2.Delta.y));
    }
    return e1.Delta.y.mul(e2.Delta.x).equals(
        e1.Delta.x.mul(e2.Delta.y));
}

function SlopesEqual3P(
    pt1:IntPoint, pt2:IntPoint, pt3:IntPoint, UseFullRange:boolean):boolean {
    if (UseFullRange) {
        return Int128.mul64(pt1.y.sub(pt2.y), pt2.x.sub(pt3.x)).equals(
            Int128.mul64(pt1.x.sub(pt2.x), pt2.y.sub(pt3.y)));
    }
    return pt1.y.sub(pt2.y).mul(pt2.x.sub(pt3.x)).equals(
            pt1.x.sub(pt2.x).mul(pt2.y.sub(pt3.y)));
}

function SlopesEqual4P(
    pt1:IntPoint, pt2:IntPoint,
    pt3:IntPoint, pt4:IntPoint,
    UseFullRange:boolean): boolean {
    if (UseFullRange) {
        return Int128.mul64(pt1.y.sub(pt2.y), pt3.x.sub(pt4.x)).equals(
            Int128.mul64(pt1.x.sub(pt2.x), pt3.y.sub(pt4.y)));
    }
    return pt1.y.sub(pt2.y).mul(pt3.x.sub(pt4.x)).equals(
        pt1.x.sub(pt2.x).mul(pt3.y.sub(pt4.y)));
}

function RangeTest(Pt:IntPoint, useFullRange:boolean):boolean {
    if (useFullRange) {
        if (Pt.x.greaterThan(hiRange) 
            || Pt.y.greaterThan(hiRange)
            || Pt.x.neg().greaterThan(hiRange) 
            || Pt.y.neg().greaterThan(hiRange)) {
            throw new Error("Coordinate outside allowed range");
        }
        return true;
    } else if (Pt.x.greaterThan(loRange) 
            || Pt.y.greaterThan(loRange)
            || Pt.x.neg().greaterThan(loRange) 
            || Pt.y.neg().greaterThan(loRange)) {
        return RangeTest(Pt, true);
    }
    return false;
}

function SetDx(e:TEdge):void {
    e.Delta.x = e.Top.x.sub(e.Bot.x);
    e.Delta.y = e.Top.y.sub(e.Bot.y);
    if (e.Delta.y.isZero()) {
        e.Dx = horizontal;
    } else {
        e.Dx = e.Delta.x.div(e.Delta.y).toNumber();
    }
}

function InitEdge(
    e:TEdge, eNext:TEdge, ePrev:TEdge, pt:IntPoint):void {
    e.Next = eNext;
    e.Prev = ePrev;
    e.Curr = pt;
    e.OutIdx = Unassigned;
}

function InitEdge2(e:TEdge, polyType:PolyType):void {
    if (e.Curr.y.greaterThanOrEqual(e.Next.Curr.y)) {
        e.Bot = e.Curr;
        e.Top = e.Next.Curr;
    } else {
        e.Top = e.Curr;
        e.Bot = e.Next.Curr;
    }
    SetDx(e);
    e.PolyTyp = polyType;
}

function FindNextLocMin(e:TEdge):TEdge {
    let e2:TEdge;
    for (;;) {
        while (e.Bot !== e.Prev.Bot || e.Curr === e.Top) {
            e = e.Next;
        }
        if (e.Dx != horizontal && e.Prev.Dx != horizontal) {
            break;
        }
        while (e.Prev.Dx == horizontal) {
            e = e.Prev;
        }
        e2 = e;
        while (e.Dx == horizontal) {
            e = e.Next;
        }
        if (e.Top.y.equals(e.Prev.Bot.y)) {
            continue; //ie just an intermediate horz.
        }
        if (e2.Prev.Bot.x.lessThan(e.Bot.x)) {
            e = e2;
        }
        break;
    }
    return e;
}

function Pt2IsBetweenPt1AndPt3(pt1:IntPoint, pt2:IntPoint, pt3:IntPoint):boolean {
    if (pt1.equals(pt3) || pt1.equals(pt2) || pt3.equals(pt2)) {
        return false;
    }
    if (pt1.x.notEquals(pt3.x)) {
        return pt2.x.greaterThan(pt1.x) == pt2.x.lessThan(pt3.x);
    }
    return pt2.y.greaterThan(pt1.y) == pt2.y.lessThan(pt3.y);
}

function RemoveEdge(e:TEdge):TEdge {
    //removes e from double_linked_list (but without removing from memory)
    e.Prev.Next = e.Next;
    e.Next.Prev = e.Prev;
    let result = e.Next;
    e.Prev = null; //flag as removed (see ClipperBase.Clear)
    return result;
}

function ReverseHorizontal(e:TEdge):void {
    //swap horizontal edges' top and bottom x's so they follow the natural
    //progression of the bounds - ie so their xbots will align with the
    //adjoining lower edge. [Helpful in the ProcessHorizontal() method.]
    Int64.Swap(e.Top.x, e.Bot.x);
}

function TopX(edge:TEdge, currentY:Int64):Int64 {
    if (currentY.equals(edge.Top.y)) {
        return edge.Top.x;
    }
    return edge.Bot.x + Math.round(edge.Dx * currentY.sub(edge.Bot.y).toNumber());
}

function E2InsertsBeforeE1(e1:TEdge, e2:TEdge):boolean {
    if (e2.Curr.x.equals(e1.Curr.x)) {
        if (e2.Top.y.greaterThan(e1.Top.y)) {
            return e2.Top.x.lessThan(TopX(e1, e2.Top.y));
        }
        return e1.Top.x.greaterThan(TopX(e2, e1.Top.y));
    }
    return e2.Curr.x.lessThan(e1.Curr.x);
}

function HorzSegmentsOverlap(
    s1a:Int64, s1b:Int64, s2a:Int64, s2b:Int64):boolean {
    let seg1a = s1a.clone();
    let seg1b = s1b.clone();
    let seg2a = s2a.clone();
    let seg2b = s2b.clone();
    if (seg1a.greaterThan(seg1b)) Int64.Swap(seg1a, seg1b);
    if (seg2a.greaterThan(seg2b)) Int64.Swap(seg2a, seg2b);
    return seg1a.lessThan(seg2b) && seg2a.lessThan(seg1b);
}

function GetDx(pt1:IntPoint, pt2:IntPoint):number {
    if (pt1.y.equals(pt2.y)) {
        return horizontal;
    }
    return pt2.x.sub(pt1.x).div(pt2.y.sub(pt1.y)).toNumber();
}

function FirstIsBottomPt(btmPt1:OutPt, btmPt2:OutPt):boolean {
    let p = btmPt1.Prev;
    while (p.Pt.equals(btmPt1.Pt) && p != btmPt1) {
        p = p.Prev;
    }
    let dx1p = Math.Abs(GetDx(btmPt1.Pt, p.Pt));
    p = btmPt1.Next;
    while (p.Pt.equals(btmPt1.Pt) && p != btmPt1) {
        p = p.Next;
    }
    let dx1n = Math.Abs(GetDx(btmPt1.Pt, p.Pt));

    p = btmPt2.Prev;
    while (p.Pt.equals(btmPt2.Pt) && p != btmPt2) {
        p = p.Prev;
    }
    let dx2p = Math.Abs(GetDx(btmPt2.Pt, p.Pt));
    p = btmPt2.Next;
    while (p.Pt.equals(btmPt2.Pt) && p != btmPt2) {
        p = p.Next;
    }
    let dx2n = Math.Abs(GetDx(btmPt2.Pt, p.Pt));

    if (Math.Max(dx1p, dx1n) == Math.Max(dx2p, dx2n)
        && Math.Min(dx1p, dx1n) == Math.Min(dx2p, dx2n)) {
        return this.Area(btmPt1) > 0; //if otherwise identical use orientation
    }
    return (dx1p >= dx2p && dx1p >= dx2n) || (dx1n >= dx2p && dx1n >= dx2n);
}

function GetBottomPt(pp:OutPt):OutPt {
    let dups:OutPt = null;
    let p = pp.Next;
    while (p != pp) {
        if (p.Pt.y.greaterThan(pp.Pt.y)) {
            pp = p;
            dups = null;
        } else if (p.Pt.y.equals(pp.Pt.y)
            && p.Pt.x.lessThanOrEqual(pp.Pt.x)) {
            if (p.Pt.x.lessThan(pp.Pt.x)) {
                dups = null;
                pp = p;
            } else {
                if (p.Next != pp && p.Prev != pp) {
                    dups = p;
                }
            }
        }
        p = p.Next;
    }
    if (dups != null) {
        //there appears to be at least 2 vertices at bottomPt so ...
        while (dups != p) {
            if (!FirstIsBottomPt(p, dups)) {
                pp = dups;
            }
            dups = dups.Next;
            while (dups.Pt.notEquals(pp.Pt)) {
                dups = dups.Next;
            }
        }
    }
    return pp;
}

function GetLowermostRec(outRec1:OutRec, outRec2:OutRec):OutRec {
    //work out which polygon fragment has the correct hole state ...
    if (outRec1.BottomPt == null) {
        outRec1.BottomPt = GetBottomPt(outRec1.Pts);
    }
    if (outRec2.BottomPt == null) {
        outRec2.BottomPt = GetBottomPt(outRec2.Pts);
    }
    let bPt1 = outRec1.BottomPt;
    let bPt2 = outRec2.BottomPt;
    if (bPt1.Pt.y.greaterThan(bPt2.Pt.y)) {
        return outRec1;
    } else if (bPt1.Pt.y.lessThan(bPt2.Pt.y)) {
        return outRec2;
    } else if (bPt1.Pt.x.lessThan(bPt2.Pt.x)) {
        return outRec1;
    } else if (bPt1.Pt.x.greaterThan(bPt2.Pt.x)) {
        return outRec2;
    } else if (bPt1.Next == bPt1) {
        return outRec2;
    } else if (bPt2.Next == bPt2) {
        return outRec1;
    } else if (FirstIsBottomPt(bPt1, bPt2)) {
        return outRec1;
    }
    return outRec2;
}

function OutRec1RightOfOutRec2(outRec1:OutRec, outRec2:OutRec):boolean {
    do {
        outRec1 = outRec1.FirstLeft;
        if (outRec1 == outRec2) {
            return true;
        }
    } while (outRec1 != null);
    return false;
}

function ReversePolyPtLinks(pp:OutPt):void {
    if (pp == null) {
        return;
    }
    let pp1:OutPt;
    let pp2:OutPt;
    pp1 = pp;
    do {
        pp2 = pp1.Next;
        pp1.Next = pp1.Prev;
        pp1.Prev = pp2;
        pp1 = pp2;
    } while (pp1 != pp);
}

function SwapSides(edge1:TEdge, edge2:TEdge):void {
    let side = edge1.Side;
    edge1.Side = edge2.Side;
    edge2.Side = side;
}

function SwapPolyIndexes(edge1:TEdge, edge2:TEdge):void {
    let outIdx = edge1.OutIdx;
    edge1.OutIdx = edge2.OutIdx;
    edge2.OutIdx = outIdx;
}

function GetHorzDirection(HorzEdge:TEdge):{Dir:Direction, Left:Int64, Right:Int64} {
    if (HorzEdge.Bot.x.lessThan(HorzEdge.Top.x)){
        return {
            Left:HorzEdge.Bot.x,
            Right:HorzEdge.Top.x,
            Dir: Direction.dLeftToRight };
    } else {
        return {
            Left: HorzEdge.Top.x,
            Right: HorzEdge.Bot.x,
            Dir: Direction.dRightToLeft };
    }
}

function GetNextInAEL(e:TEdge, direction:Direction):TEdge {
    return direction == direction.dLeftToRight ? e.NextInAEL: e.PrevInAEL;
}

function IsMinima(e:TEdge):boolean {
    return e != null 
        && e.Prev.NextInLML != e
        && e.Next.NextInLML != e;
}

function IsMaxima(e:TEdge, y:number):boolean {
    return e != null 
        && e.Top.y.equals(Int64.fromNumber(y))
        && e.NextInLML == null;
}

function IsIntermediate(e:TEdge, y:number):boolean {
    return e.Top.y.equals(Int64.fromNumber(y))
        && e.NextInLML != null;
}

function GetMaximaPair(e:TEdge):TEdge {
    if (e.Next.Top.equals(e.Top) && e.Next.NextInLML == null) {
        return e.Next;
    } else if (e.Prev.Top.equals(e.Top) && e.Prev.NextInLML == null) {
        return e.Prev;
    }
    return null;
}

function GetMaximaPairEx(e:TEdge):TEdge {
    //as above but returns null if MaxPair isn't in AEL (unless it's horizontal)
    let result = GetMaximaPair(e);
    if (result == null 
        || result.OutIdx == Skip 
        || (result.NextInAEL == result.PrevInAEL && !IsHorizontal(result))) {
        return null;
    }
    return result;
}

class ClipperBase {
    m_MinimaList:LocalMinima;
    m_CurrentLM:LocalMinima;
    m_edges:Array<Array<TEdge>> = new Array<Array<TEdge>>();
    m_Scanbeam:Scanbeam;
    m_PolyOuts:Array<OutRec>;
    m_ActiveEdges:TEdge;
    m_UseFullRange:boolean;
    m_HasOpenPaths:boolean;
    PreserveCollinear:boolean;

    constructor() {
        this.m_MinimaList = null;
        this.m_CurrentLM = null;
        this.m_UseFullRange = false;
        this.m_HasOpenPaths = false;
    }

    public Clear():void {
        this.DisposeLocalMinimaList();
        this.m_edges.length = 0;
        this.m_UseFullRange = false;
        this.m_HasOpenPaths = false;
    }

    private DisposeLocalMinimaList():void {
        this.m_MinimaList = null;
        this.m_CurrentLM = null;
    }

    private InsertLocalMinima(newLm:LocalMinima):void {
        if ( this.m_MinimaList == null ) {
            this.m_MinimaList = newLm;
        }
        else if (newLm.Y >= this.m_MinimaList.Y ) {
            newLm.Next = this.m_MinimaList;
            this.m_MinimaList = newLm;
        } else {
            let tmpLm = this.m_MinimaList;
            while (tmpLm.Next != null && newLm.Y < tmpLm.Next.Y) {
                tmpLm = tmpLm.Next;
            }
            newLm.Next = tmpLm.Next;
            tmpLm.Next = newLm;
        }
    }

    PopLocalMinima(Y:Int64):LocalMinima {
        let current = this.m_CurrentLM;
        if (this.m_CurrentLM != null && this.m_CurrentLM.Y == Y)
        {
            this.m_CurrentLM = this.m_CurrentLM.Next;
            return current;
        }
        return null;
    }
    
    private ProcessBound(E:TEdge, LeftBoundIsForward:boolean):TEdge {
        let EStart:TEdge;
        let Result = E;
        let Horz:TEdge;

        if (Result.OutIdx == Skip) {
            //check if there are edges beyond the skip edge in the bound and if so
            //create another LocMin and calling ProcessBound once more ...
            E = Result;
            if (LeftBoundIsForward) {
                while (E.Top.y.equals(E.Next.Bot.y)) E = E.Next;
                while (E != Result && E.Dx == horizontal) E = E.Prev;
            } else {
                while (E.Top.y.equals(E.Prev.Bot.y)) E = E.Prev;
                while (E != Result && E.Dx == horizontal) E = E.Next;
            }
            if (E == Result) {
                Result = LeftBoundIsForward ? E.Next : E.Prev;
            } else {
                //there are more edges in the bound beyond result starting with E
                E = LeftBoundIsForward ? Result.Next : Result.Prev;
                let locMin = new LocalMinima();
                locMin.Next = null;
                locMin.Y = E.Bot.y;
                locMin.LeftBound = null;
                locMin.RightBound = E;
                E.WindDelta = 0;
                Result = this.ProcessBound(E, LeftBoundIsForward);
                this.InsertLocalMinima(locMin);
            }
            return Result;
        }

        if (E.Dx == horizontal) {
            //We need to be careful with open paths because this may not be a
            //true local minima (ie E may be following a skip edge).
            //Also, consecutive horz. edges may start heading left before going right.
            EStart = LeftBoundIsForward ? E.Prev : E.Next;
            if (EStart.Dx == horizontal) {//ie an adjoining horizontal skip edge
                if (EStart.Bot.x.notEquals(E.Bot.x) 
                    && EStart.Top.x .notEquals(E.Bot.x)) {
                    ReverseHorizontal(E);
                }
            } else if (EStart.Bot.x.notEquals(E.Bot.x)) {
                ReverseHorizontal(E);
            }
        }

        EStart = E;
        if (LeftBoundIsForward) {
            while (Result.Top.y.equals(Result.Next.Bot.y)
                && Result.Next.OutIdx != Skip) {
                Result = Result.Next;
            }

            if (Result.Dx == horizontal && Result.Next.OutIdx != Skip) {
                //nb: at the top of a bound, horizontals are added to the bound
                //only when the preceding edge attaches to the horizontal's left vertex
                //unless a Skip edge is encountered when that becomes the top divide
                Horz = Result;
                while (Horz.Prev.Dx == horizontal) Horz = Horz.Prev;
                if (Horz.Prev.Top.x.greaterThan(Result.Next.Top.x)) {
                    Result = Horz.Prev;
                }
            }

            while (E != Result) {
                E.NextInLML = E.Next;
                if (E.Dx == horizontal && E != EStart && E.Bot.x.notEquals(E.Prev.Top.x)) { 
                    ReverseHorizontal(E);
                }
                E = E.Next;
            }

            if (E.Dx == horizontal && E != EStart && E.Bot.x.notEquals(E.Prev.Top.x)) { 
                ReverseHorizontal(E);
            }
            Result = Result.Next; //move to the edge just beyond current bound
        } else {
            while (Result.Top.y.equals(Result.Prev.Bot.y)
                && Result.Prev.OutIdx != Skip) {
                Result = Result.Prev;
            }

            if (Result.Dx == horizontal && Result.Prev.OutIdx != Skip) {
                Horz = Result;
                while (Horz.Next.Dx == horizontal) Horz = Horz.Next;
                if (Horz.Next.Top.x.greaterThanOrEqual(Result.Prev.Top.x)) {
                    Result = Horz.Next;
                }
            }

            while (E != Result) {
                E.NextInLML = E.Prev;
                if (E.Dx == horizontal && E != EStart && E.Bot.x.notEquals(E.Next.Top.x)) {
                    ReverseHorizontal(E);
                }
                E = E.Prev;
            }

            if (E.Dx == horizontal && E != EStart && E.Bot.x.notEquals(E.Next.Top.x)) {
                ReverseHorizontal(E);
            }
            Result = Result.Prev; //move to the edge just beyond current bound
        }
        return Result;
    }

    private Reset():void {
        this.m_CurrentLM = this.m_MinimaList;
        if (this.m_CurrentLM == null) return; //ie nothing to process

        //reset all edges ...
        this.m_Scanbeam = null;
        let lm = this.m_MinimaList;
        while (lm != null) {
            this.InsertScanbeam(lm.Y);
            let e = lm.LeftBound;

            if (e != null) {
                e.Curr = e.Bot;
                e.OutIdx = Unassigned;
            }
            e = lm.RightBound;
            if (e != null) {
                e.Curr = e.Bot;
                e.OutIdx = Unassigned;
            }
            lm = lm.Next;
        }
        this.m_ActiveEdges = null;
    }

    InsertScanbeam(Y:Int64):void {
        //single-linked list: sorted descending, ignoring dups.
        if (this.m_Scanbeam == null) {
            this.m_Scanbeam = new Scanbeam();
            this.m_Scanbeam.Next = null;
            this.m_Scanbeam.Y = Y;
        } else if (Y > this.m_Scanbeam.Y) {
            let newSb = new Scanbeam();
            newSb.Y = Y;
            newSb.Next = this.m_Scanbeam;
            this.m_Scanbeam = newSb;
        } else {
            let sb2 = this.m_Scanbeam;
            while (sb2.Next != null && Y.lessThanOrEqual(sb2.Next.Y)) sb2 = sb2.Next;
            if (Y.equals(sb2.Y)) return; //ie ignores duplicates
            let newSb = new Scanbeam();
            newSb.Y = Y;
            newSb.Next = sb2.Next;
            sb2.Next = newSb;
        }
    }

    public static GetBounds(paths:Paths):IntRect
    {
        let i = 0;
        let cnt = paths.length;

        while (i < cnt && paths[i].length == 0) i++;
        let zero = Int64.fromInt(0);
        if (i == cnt) {
            return IntRect.Init(zero, zero, zero, zero);
        }
        let result = new IntRect();
        result.left = paths[i][0].x;
        result.right = result.left;
        result.top = paths[i][0].y;
        result.bottom = result.top;
        for (; i < cnt; i++) {
            for (let j = 0; j < paths[i].length; j++)
            {
                if (paths[i][j].x.lessThan(result.left)) result.left = paths[i][j].x;
                else if (paths[i][j].x.greaterThan(result.right)) result.right = paths[i][j].x;
                if (paths[i][j].y.lessThan(result.top)) result.top = paths[i][j].y;
                else if (paths[i][j].y.greaterThan(result.bottom)) result.bottom = paths[i][j].y;
            }
        }
        return result;
    }

    PopScanbeam():{Y:Int64, r:boolean} {
        if (this.m_Scanbeam == null) {
            return {Y:Int64.fromInt(0), r:false};
        }
        let Y = this.m_Scanbeam.Y;
        this.m_Scanbeam = this.m_Scanbeam.Next;
        return {Y:Y, r:false};
    }
    

    get LocalMinimaPending():boolean {
        return this.m_CurrentLM != null;
    }

    CreateOutRec():OutRec {
        let result = new OutRec();
        result.Idx = Unassigned;
        result.IsHole = false;
        result.IsOpen = false;
        result.FirstLeft = null;
        result.Pts = null;
        result.BottomPt = null;
        result.PolyNode = null;
        this.m_PolyOuts.push(result);
        result.Idx = this.m_PolyOuts.length - 1;
        return result;
    }

    DisposeOutRec(index:number):void {
        this.m_PolyOuts[index] = null;
    }

    UpdateEdgeIntoAEL(e:TEdge):TEdge {
        if (e.NextInLML == null) {
            throw new Error("UpdateEdgeIntoAEL: invalid call");
        }
        let AelPrev = e.PrevInAEL;
        let AelNext = e.NextInAEL;
        e.NextInLML.OutIdx = e.OutIdx;
        if (AelPrev != null) {
            AelPrev.NextInAEL = e.NextInLML;
        } else {
            this.m_ActiveEdges = e.NextInLML;
        }
        if (AelNext != null) {
            AelNext.PrevInAEL = e.NextInLML;
        }
        e.NextInLML.Side = e.Side;
        e.NextInLML.WindDelta = e.WindDelta;
        e.NextInLML.WindCnt = e.WindCnt;
        e.NextInLML.WindCnt2 = e.WindCnt2;
        e = e.NextInLML;
        e.Curr = e.Bot;
        e.PrevInAEL = AelPrev;
        e.NextInAEL = AelNext;
        if (!IsHorizontal(e)) {
            this.InsertScanbeam(e.Top.y);
        }
        return e;
    }

    SwapPositionsInAEL(edge1:TEdge, edge2:TEdge):void {
        //check that one or other edge hasn't already been removed from AEL ...
        if (edge1.NextInAEL == edge1.PrevInAEL
            || edge2.NextInAEL == edge2.PrevInAEL) return;

        if (edge1.NextInAEL == edge2) {
            let next = edge2.NextInAEL;
            if (next != null)
                next.PrevInAEL = edge1;
            let prev = edge1.PrevInAEL;
            if (prev != null)
                prev.NextInAEL = edge2;
            edge2.PrevInAEL = prev;
            edge2.NextInAEL = edge1;
            edge1.PrevInAEL = edge2;
            edge1.NextInAEL = next;
        } else if (edge2.NextInAEL == edge1) {
            let next = edge1.NextInAEL;
            if (next != null)
                next.PrevInAEL = edge2;
            let prev = edge2.PrevInAEL;
            if (prev != null)
                prev.NextInAEL = edge1;
            edge1.PrevInAEL = prev;
            edge1.NextInAEL = edge2;
            edge2.PrevInAEL = edge1;
            edge2.NextInAEL = next;
        } else {
            let next = edge1.NextInAEL;
            let prev = edge1.PrevInAEL;
            edge1.NextInAEL = edge2.NextInAEL;
            if (edge1.NextInAEL != null)
                edge1.NextInAEL.PrevInAEL = edge1;
            edge1.PrevInAEL = edge2.PrevInAEL;
            if (edge1.PrevInAEL != null)
                edge1.PrevInAEL.NextInAEL = edge1;
            edge2.NextInAEL = next;
            if (edge2.NextInAEL != null)
                edge2.NextInAEL.PrevInAEL = edge2;
            edge2.PrevInAEL = prev;
            if (edge2.PrevInAEL != null)
                edge2.PrevInAEL.NextInAEL = edge2;
        }

        if (edge1.PrevInAEL == null)
            this.m_ActiveEdges = edge1;
        else if (edge2.PrevInAEL == null)
            this.m_ActiveEdges = edge2;
    }

    DeleteFromAEL(e:TEdge):void {
        let AelPrev = e.PrevInAEL;
        let AelNext = e.NextInAEL;
        if (AelPrev == null && AelNext == null && e != this.m_ActiveEdges) {
            return; //already deleted
        }
        if (AelPrev != null) {
            AelPrev.NextInAEL = AelNext;
        } else {
            this.m_ActiveEdges = AelNext;
        }
        if (AelNext != null) {
            AelNext.PrevInAEL = AelPrev;
        }
        e.NextInAEL = null;
        e.PrevInAEL = null;
    }

    public AddPath(pg:Path, polyType:PolyType, Closed:boolean):boolean {
        if (!Closed && polyType == PolyType.ptClip)
            throw new Error("AddPath: Open paths must be subject.");

        let highI = pg.length - 1;
        if (Closed) {
            while (highI > 0 && (pg[highI] == pg[0])) {
                --highI;
            }
        }
        while (highI > 0 && (pg[highI] == pg[highI - 1])) {
            --highI;
        }
        if ((Closed && highI < 2) || (!Closed && highI < 1)) {
            return false;
        }

        //create a new edge array ...
        let edges:TEdge[] = new Array<TEdge>(highI+1);
        for (let i = 0; i <= highI; i++) {
            edges.push(new TEdge());
        }
            
        let IsFlat = true;

        //1. Basic (first) edge initialization ...
        edges[1].Curr = pg[1];
        this.m_UseFullRange = RangeTest(pg[0], this.m_UseFullRange);
        this.m_UseFullRange = RangeTest(pg[highI], this.m_UseFullRange);
        InitEdge(edges[0], edges[1], edges[highI], pg[0]);
        InitEdge(edges[highI], edges[0], edges[highI - 1], pg[highI]);
        for (let i = highI - 1; i >= 1; --i) {
            this.m_UseFullRange = RangeTest(pg[i], this.m_UseFullRange);
            InitEdge(edges[i], edges[i + 1], edges[i - 1], pg[i]);
        }
        let eStart = edges[0];

        //2. Remove duplicate vertices, and (when closed) collinear edges ...
        let E = eStart;
        let eLoopStop = eStart;
        for (;;) {
            //nb: allows matching start and end points when not Closed ...
            if (E.Curr == E.Next.Curr && (Closed || E.Next != eStart)) {
                if (E == E.Next) break;
                if (E == eStart) eStart = E.Next;
                E = RemoveEdge(E);
                eLoopStop = E;
                continue;
            }
            if (E.Prev == E.Next) {
                break; //only two vertices
            } else if (Closed 
                && SlopesEqual3P(E.Prev.Curr, E.Curr, E.Next.Curr, this.m_UseFullRange)
                && (!this.PreserveCollinear 
                    || !Pt2IsBetweenPt1AndPt3(E.Prev.Curr, E.Curr, E.Next.Curr))) {
                //Collinear edges are allowed for open paths but in closed paths
                //the default is to merge adjacent collinear edges into a single edge.
                //However, if the PreserveCollinear property is enabled, only overlapping
                //collinear edges (ie spikes) will be removed from closed paths.
                if (E == eStart) eStart = E.Next;
                E = RemoveEdge(E);
                E = E.Prev;
                eLoopStop = E;
                continue;
            }
            E = E.Next;
            if ((E == eLoopStop) || (!Closed && E.Next == eStart)) break;
        }

        if ((!Closed && (E == E.Next)) || (Closed && (E.Prev == E.Next))) {
            return false;
        }

        if (!Closed) {
            this.m_HasOpenPaths = true;
            eStart.Prev.OutIdx = Skip;
        }

        //3. Do second stage of edge initialization ...
        E = eStart;
        do {
            InitEdge2(E, polyType);
            E = E.Next;
            if (IsFlat && E.Curr.y.notEquals(eStart.Curr.y)) {
                IsFlat = false;
            }
        } while (E != eStart);

        //4. Finally, add edge bounds to LocalMinima list ...

        //Totally flat paths must be handled differently when adding them
        //to LocalMinima list to avoid endless loops etc ...
        if (IsFlat) {
            if (Closed) {
                return false;
            }
            E.Prev.OutIdx = Skip;
            let locMin = new LocalMinima();
            locMin.Next = null;
            locMin.Y = E.Bot.y;
            locMin.LeftBound = null;
            locMin.RightBound = E;
            locMin.RightBound.Side = EdgeSide.esRight;
            locMin.RightBound.WindDelta = 0;
            for ( ; ; ) {
                if (E.Bot.x.notEquals(E.Prev.Top.x)) ReverseHorizontal(E);
                if (E.Next.OutIdx == Skip) break;
                E.NextInLML = E.Next;
                E = E.Next;
            }
            this.InsertLocalMinima(locMin);
            this.m_edges.push(edges);
            return true;
        }

        this.m_edges.push(edges);
        let leftBoundIsForward:boolean;
        let EMin:TEdge = null;

        //workaround to avoid an endless loop in the while loop below when
        //open paths have matching start and end points ...
        if (E.Prev.Bot == E.Prev.Top) E = E.Next;

        for (;;) {
            E = FindNextLocMin(E);
            if (E == EMin) {
                break;
            }
            if (EMin == null) {
                EMin = E;
            }

            //E and E.Prev now share a local minima (left aligned if horizontal).
            //Compare their slopes to find which starts which bound ...
            let locMin = new LocalMinima();
            locMin.Next = null;
            locMin.Y = E.Bot.y;
            if (E.Dx < E.Prev.Dx) {
                locMin.LeftBound = E.Prev;
                locMin.RightBound = E;
                leftBoundIsForward = false; //Q.nextInLML = Q.prev
            } else {
                locMin.LeftBound = E;
                locMin.RightBound = E.Prev;
                leftBoundIsForward = true; //Q.nextInLML = Q.next
            }
            locMin.LeftBound.Side = EdgeSide.esLeft;
            locMin.RightBound.Side = EdgeSide.esRight;

            if (!Closed) {
                locMin.LeftBound.WindDelta = 0;
            } else if (locMin.LeftBound.Next == locMin.RightBound) {
                locMin.LeftBound.WindDelta = -1;
            } else {
                locMin.LeftBound.WindDelta = 1;
            }
            locMin.RightBound.WindDelta = -locMin.LeftBound.WindDelta;

            E = this.ProcessBound(locMin.LeftBound, leftBoundIsForward);
            if (E.OutIdx == Skip) {
                E = this.ProcessBound(E, leftBoundIsForward);
            }

            let E2 = this.ProcessBound(locMin.RightBound, !leftBoundIsForward);
            if (E2.OutIdx == Skip) {
                E2 = this.ProcessBound(E2, !leftBoundIsForward);
            }

            if (locMin.LeftBound.OutIdx == Skip) {
                locMin.LeftBound = null;
            } else if (locMin.RightBound.OutIdx == Skip) {
                locMin.RightBound = null;
            }
            this.InsertLocalMinima(locMin);
            if (!leftBoundIsForward) {
                E = E2;
            }
        }
        return true;
    }

    AddPaths(ppg:Paths, polyType:PolyType, closed:boolean):boolean {
        let result = false;
        for (let path of ppg) {
            if (this.AddPath(path, polyType, closed)) {
                result = true;
            }
        }
        return result;
    }
} //end ClipperBase

export class Clipper extends ClipperBase {
      //InitOptions that can be passed to the constructor ...
    m_ClipType:ClipType;
    m_Maxima:Maxima;
    m_SortedEdges:TEdge;
    m_IntersectList:Array<IntersectNode>;
    m_ExecuteLocked:boolean;
    m_ClipFillType:PolyFillType;
    m_SubjFillType:PolyFillType;
    m_Joins:Array<Join>;
    m_GhostJoins:Array<Join>;
    m_UsingPolyTree:boolean;

    ReverseSolution:boolean;      
    StrictlySimple:boolean;

    constructor(InitOptions:number = 0) {
        this.m_Scanbeam = null;
        this.m_Maxima = null;
        this.m_ActiveEdges = null;
        this.m_SortedEdges = null;
        this.m_IntersectList = new Array<IntersectNode>();
        this.m_ExecuteLocked = false;
        this.m_UsingPolyTree = false;
        this.m_PolyOuts = new Array<OutRec>();
        this.m_Joins = new Array<Join>();
        this.m_GhostJoins = new Array<Join>();
        this.ReverseSolution = (ioReverseSolution & InitOptions) != 0;
        this.StrictlySimple = (ioStrictlySimple & InitOptions) != 0;
        this.PreserveCollinear = (ioPreserveCollinear & InitOptions) != 0;
    }

    private InsertMaxima(X:Int64):void {
        //double-linked list: sorted ascending, ignoring dups.
        let newMax = new Maxima();
        newMax.X = X;
        if (this.m_Maxima == null) {
            this.m_Maxima = newMax;
            this.m_Maxima.Next = null;
            this.m_Maxima.Prev = null;
        } else if (X.lessThan(m_Maxima.X)) {
            newMax.Next = this.m_Maxima;
            newMax.Prev = null;
            this.m_Maxima = newMax;
        } else {
            let m = this.m_Maxima;
            while (m.Next != null && X.greaterThanOrEqual(m.Next.X)) {
                m = m.Next;
            }
            if (X.equals(m.X)) {
                return; //ie ignores duplicates (& CG to clean up newMax)
            }
            //insert newMax between m and m.Next ...
            newMax.Next = m.Next;
            newMax.Prev = m;
            if (m.Next != null) {
                m.Next.Prev = newMax;
            }
            m.Next = newMax;
        }
    }

    public Execute(clipType:ClipType, solution:Paths, 
        fillType:PolyFillType = PolyFillType.pftEvenOdd):boolean {
        return Execute(clipType, solution, fillType, fillType);
    }

    public Execute(clipType:ClipType, polytree:PolyTree,
        FillType:PolyFillType = PolyFillType.pftEvenOdd):boolean {
        return Execute(clipType, polytree, FillType, FillType);
    }

    public Execute(clipType:ClipType, solution:Paths,
        subjFillType:PolyFillType, clipFillType:PolyFillType):boolean {
        if (this.m_ExecuteLocked) {
          return false;
        }
        if (this.m_HasOpenPaths) {
            throw new Error("Error: PolyTree struct is needed for open path clipping.");
        }

        this.m_ExecuteLocked = true;
        solution.Clear();
        this.m_SubjFillType = subjFillType;
        this.m_ClipFillType = clipFillType;
        this.m_ClipType = clipType;
        this.m_UsingPolyTree = false;
        let succeeded:boolean;
        try {
            succeeded = ExecuteInternal();
            //build the return polygons ...
            if (succeeded) {
              BuildResult(solution);
            }
        } finally {
            DisposeAllPolyPts();
            this.m_ExecuteLocked = false;
        }
        return succeeded;
    }

    public Execute(clipType:ClipType, polytree:PolyTree,
        subjFillType:PolyFillType, clipFillType:PolyFillType):boolean {
        if (this.m_ExecuteLocked) {
            return false;
        }
        this.m_ExecuteLocked = true;
        this.m_SubjFillType = subjFillType;
        this.m_ClipFillType = clipFillType;
        this.m_ClipType = clipType;
        this.m_UsingPolyTree = true;
        let succeeded:boolean;
        try {
            succeeded = ExecuteInternal();
            //build the return polygons ...
            if (succeeded) {
                BuildResult2(polytree);
            }
        } finally {
            DisposeAllPolyPts();
            this.m_ExecuteLocked = false;
        }
        return succeeded;
    }

    FixHoleLinkage(outRec:OutRec):void {
        //skip if an outermost polygon or
        //already already points to the correct FirstLeft ...
        if (outRec.FirstLeft == null 
            || (outRec.IsHole != outRec.FirstLeft.IsHole
                && outRec.FirstLeft.Pts != null)) {
            return;
        }

        let orfl = outRec.FirstLeft;
        while (orfl != null
            && (orfl.IsHole == outRec.IsHole || orfl.Pts == null)) {
            orfl = orfl.FirstLeft;
        }
        outRec.FirstLeft = orfl;
    }

    private ExecuteInternal():boolean {
        try {
            Reset();
            this.m_SortedEdges = null;
            this.m_Maxima = null;

            let botY:Int64;
            let topY:Int64;

            let r = this.PopScanbeam();
            if (!r.r) {
                return false;
            }
            botY = r.Y;
            this.InsertLocalMinimaIntoAEL(botY);
            r = this.PopScanbeam();
            while (r.r || this.LocalMinimaPending()) {
                topY = r.Y;
                this.ProcessHorizontals();
                this.m_GhostJoins.Clear();
                if (!this.ProcessIntersections(topY)) {
                    return false;
                }
                this.ProcessEdgesAtTopOfScanbeam(topY);
                botY = topY;
                this.InsertLocalMinimaIntoAEL(botY);
                r = this.PopScanbeam();
            }

            //fix orientations ...
            for (outRec of this.m_PolyOuts) {
                if (outRec.Pts == null || outRec.IsOpen) {
                    continue;
                }
                if ((outRec.IsHole ^ ReverseSolution) == (this.Area(outRec) > 0)) {
                    this.ReversePolyPtLinks(outRec.Pts);
                }
            }

            this.JoinCommonEdges();

            for (outRec of this.m_PolyOuts) {
                if (outRec.Pts == null) {
                    continue;
                } else if (outRec.IsOpen) {
                    this.FixupOutPolyline(outRec);
                } else {
                    this.FixupOutPolygon(outRec);
                }
            }

            if (this.StrictlySimple) {
                this.DoSimplePolygons();
            }
            return true;
        } finally {
            this.m_Joins.length = 0;
            this.m_GhostJoins.length = 0;
        }
    }

    private DisposeAllPolyPts():void {
        for (let i = 0; i < this.m_PolyOuts.length; ++i) {
            this.DisposeOutRec(i);
        }
        m_PolyOuts.length = 0;
    }

    private AddJoin(Op1:OutPt, Op2:OutPt, OffPt:IntPoint):void {
        let j = new Join();
        j.OutPt1 = Op1;
        j.OutPt2 = Op2;
        j.OffPt = OffPt;
        this.m_Joins.push(j);
    }

    private AddGhostJoin(Op:OutPt, OffPt:IntPoint):void {
        let j = new Join();
        j.OutPt1 = Op;
        j.OffPt = OffPt;
        this.m_GhostJoins.push(j);
    }
  
    private InsertLocalMinimaIntoAEL(botY:Int64):void {
        let lm:LocalMinima;
        while ((lm = this.PopLocalMinima(botY)) != null) {
            let lb = lm.LeftBound;
            let rb = lm.RightBound;

            let Op1:OutPt = null;
            if (lb == null) {
                this.InsertEdgeIntoAEL(rb, null);
                this.SetWindingCount(rb);
                if (this.IsContributing(rb)) {
                    Op1 = this.AddOutPt(rb, rb.Bot);
                }
            } else if (rb == null) {
                this.InsertEdgeIntoAEL(lb, null);
                this.SetWindingCount(lb);
                if (this.IsContributing(lb)) {
                  Op1 = this.AddOutPt(lb, lb.Bot);
                }
                this.InsertScanbeam(lb.Top.Y);
            } else {
                this.InsertEdgeIntoAEL(lb, null);
                this.InsertEdgeIntoAEL(rb, lb);
                this.SetWindingCount(lb);
                this.rb.WindCnt = lb.WindCnt;
                this.rb.WindCnt2 = lb.WindCnt2;
                if (this.IsContributing(lb)) {
                    Op1 = this.AddLocalMinPoly(lb, rb, lb.Bot);
                }
                this.InsertScanbeam(lb.Top.Y);
            }

            if (rb != null) {
                if (IsHorizontal(rb)) {
                    if (rb.NextInLML != null) {
                        this.InsertScanbeam(rb.NextInLML.Top.Y);
                    }
                    this.AddEdgeToSEL(rb);
                } else {
                    this.InsertScanbeam(rb.Top.Y);
                }
            }

            if (lb == null || rb == null) {
                continue;
            }

            //if output polygons share an Edge with a horizontal rb, they'll need joining later ...
            if (Op1 != null
                && IsHorizontal(rb) 
                && this.m_GhostJoins.length > 0
                && rb.WindDelta != 0) {
                for (let i = 0; i < this.m_GhostJoins.length; i++) {
                    //if the horizontal Rb and a 'ghost' horizontal overlap, then convert
                    //the 'ghost' join to a real join ready for later ...
                    let j = this.m_GhostJoins[i];
                    if (HorzSegmentsOverlap(j.OutPt1.Pt.X, j.OffPt.X, rb.Bot.X, rb.Top.X)) {
                        this.AddJoin(j.OutPt1, Op1, j.OffPt);
                    }
                }
            }

            if (lb.OutIdx >= 0 
                && lb.PrevInAEL != null 
                && lb.PrevInAEL.Curr.X == lb.Bot.X
                && lb.PrevInAEL.OutIdx >= 0
                && SlopesEqual4P(lb.PrevInAEL.Curr, lb.PrevInAEL.Top, lb.Curr, lb.Top, m_UseFullRange)
                && lb.WindDelta != 0 
                && lb.PrevInAEL.WindDelta != 0) {
                let Op2 = this.AddOutPt(lb.PrevInAEL, lb.Bot);
                this.AddJoin(Op1, Op2, lb.Top);
            }

            if( lb.NextInAEL != rb ) {
                if (rb.OutIdx >= 0 
                    && rb.PrevInAEL.OutIdx >= 0 
                    && SlopesEqual4P(rb.PrevInAEL.Curr, rb.PrevInAEL.Top, rb.Curr, rb.Top, m_UseFullRange)
                    && rb.WindDelta != 0 
                    && rb.PrevInAEL.WindDelta != 0) {
                  let Op2 = this.AddOutPt(rb.PrevInAEL, rb.Bot);
                  this.AddJoin(Op1, Op2, rb.Top);
                }

                let e = lb.NextInAEL;
                if (e != null) {
                    while (e != rb) {
                        //nb: For calculating winding counts etc, IntersectEdges() assumes
                        //that param1 will be to the right of param2 ABOVE the intersection ...
                        this.IntersectEdges(rb, e, lb.Curr); //order important here
                        e = e.NextInAEL;
                    }
                }
            }
        }
    }

    private InsertEdgeIntoAEL(edge:TEdge, startEdge:TEdge):void {
        if (m_ActiveEdges == null) {
            edge.PrevInAEL = null;
            edge.NextInAEL = null;
            this.m_ActiveEdges = edge;
        } else if (startEdge == null 
            && this.E2InsertsBeforeE1(m_ActiveEdges, edge)) {
            edge.PrevInAEL = null;
            edge.NextInAEL = m_ActiveEdges;
            this.m_ActiveEdges.PrevInAEL = edge;
            this.m_ActiveEdges = edge;
        } else {
            if (startEdge == null) {
                startEdge = this.m_ActiveEdges;
            }
            while (startEdge.NextInAEL != null
                && !E2InsertsBeforeE1(startEdge.NextInAEL, edge)) {
                startEdge = startEdge.NextInAEL;
            }
            edge.NextInAEL = startEdge.NextInAEL;
            if (startEdge.NextInAEL != null) {
                startEdge.NextInAEL.PrevInAEL = edge;
            }
            edge.PrevInAEL = startEdge;
            startEdge.NextInAEL = edge;
        }
    }

    private IsEvenOddFillType(edge:TEdge):boolean {
        if (edge.PolyTyp == PolyType.ptSubject) {
            return this.m_SubjFillType == PolyFillType.pftEvenOdd;
        }
        return this.m_ClipFillType == PolyFillType.pftEvenOdd;
    }  

    private IsEvenOddAltFillType(edge:TEdge):boolean {
        if (edge.PolyTyp == PolyType.ptSubject) {
            return this.m_ClipFillType == PolyFillType.pftEvenOdd; 
        }
        return this.m_SubjFillType == PolyFillType.pftEvenOdd;
    }

    private IsContributing(edge:TEdge):boolean {
        let pft:PolyFillType;
        let pft2:PolyFillType;
        
        if (edge.PolyTyp == PolyType.ptSubject) {
            pft = this.m_SubjFillType;
            pft2 = this.m_ClipFillType;
        } else {
            pft = this.m_ClipFillType;
            pft2 = this.m_SubjFillType;
        }
        switch (pft) {
            case PolyFillType.pftEvenOdd:
                //return false if a subj line has been flagged as inside a subj polygon
                if (edge.WindDelta == 0 && edge.WindCnt != 1) {
                    return false;
                }
                break;
            case PolyFillType.pftNonZero:
                if (Math.Abs(edge.WindCnt) != 1) {
                    return false;
                }
                break;
            case PolyFillType.pftPositive:
                if (edge.WindCnt != 1) {
                    return false;
                }
                break;
            default: //PolyFillType.pftNegative
                if (edge.WindCnt != -1) {
                    return false;
                }
                break;
        }

        switch (m_ClipType) {
            case ClipType.ctIntersection:
                switch (pft2) {
                    case PolyFillType.pftEvenOdd:
                    case PolyFillType.pftNonZero:
                        return (edge.WindCnt2 != 0);
                    case PolyFillType.pftPositive:
                        return (edge.WindCnt2 > 0);
                    default:
                        return (edge.WindCnt2 < 0);
                }
                break;
          case ClipType.ctUnion:
                switch (pft2) {
                    case PolyFillType.pftEvenOdd:
                    case PolyFillType.pftNonZero:
                        return (edge.WindCnt2 == 0);
                    case PolyFillType.pftPositive:
                        return (edge.WindCnt2 <= 0);
                    default:
                        return (edge.WindCnt2 >= 0);
                }
                break;
          case ClipType.ctDifference:
              if (edge.PolyTyp == PolyType.ptSubject) {
                  switch (pft2) {
                      case PolyFillType.pftEvenOdd:
                      case PolyFillType.pftNonZero:
                          return (edge.WindCnt2 == 0);
                      case PolyFillType.pftPositive:
                          return (edge.WindCnt2 <= 0);
                      default:
                          return (edge.WindCnt2 >= 0);
                  }
              } else {
                  switch (pft2) {
                      case PolyFillType.pftEvenOdd:
                      case PolyFillType.pftNonZero:
                          return (edge.WindCnt2 != 0);
                      case PolyFillType.pftPositive:
                          return (edge.WindCnt2 > 0);
                      default:
                          return (edge.WindCnt2 < 0);
                  }
              }
              break;
          case ClipType.ctXor:
              if (edge.WindDelta == 0) {//XOr always contributing unless open
                  switch (pft2) {
                      case PolyFillType.pftEvenOdd:
                      case PolyFillType.pftNonZero:
                          return (edge.WindCnt2 == 0);
                      case PolyFillType.pftPositive:
                          return (edge.WindCnt2 <= 0);
                        default:
                        return (edge.WindCnt2 >= 0);
                  }
              }
              return true;
        }
        return true;
    }

    private SetWindingCount(edge:TEdge):void {
        let e = edge.PrevInAEL;
        //find the edge of the same polytype that immediately preceeds 'edge' in AEL
        while (e != null
            && (e.PolyTyp != edge.PolyTyp || e.WindDelta == 0)) {
              e = e.PrevInAEL;
        }
        if (e == null) {
            let pft:PolyFillType;
            pft = edge.PolyTyp == PolyType.ptSubject ? this.m_SubjFillType : this.m_ClipFillType;
            if (edge.WindDelta == 0) {
                edge.WindCnt = pft == PolyFillType.pftNegative ? -1 : 1;
            } else {
                edge.WindCnt = edge.WindDelta;
            }
            edge.WindCnt2 = 0;
            e = m_ActiveEdges; //ie get ready to calc WindCnt2
        } else if (edge.WindDelta == 0 && this.m_ClipType != ClipType.ctUnion) {
            edge.WindCnt = 1;
            edge.WindCnt2 = e.WindCnt2;
            e = e.NextInAEL; //ie get ready to calc WindCnt2
        } else if (this.IsEvenOddFillType(edge)) {
            //EvenOdd filling ...
            if (edge.WindDelta == 0) {
                //are we inside a subj polygon ...
                let Inside = true;
                let e2 = e.PrevInAEL;
                while (e2 != null) {
                    if (e2.PolyTyp == e.PolyTyp && e2.WindDelta != 0) {
                        Inside = !Inside;
                    }
                    e2 = e2.PrevInAEL;
                }
                edge.WindCnt = Inside ? 0 : 1;
            } else {
                edge.WindCnt = edge.WindDelta;
            }
            edge.WindCnt2 = e.WindCnt2;
            e = e.NextInAEL; //ie get ready to calc WindCnt2
        } else {
            //nonZero, Positive or Negative filling ...
            if (e.WindCnt * e.WindDelta < 0) {
                //prev edge is 'decreasing' WindCount (WC) toward zero
                //so we're outside the previous polygon ...
                if (Math.Abs(e.WindCnt) > 1) {
                    //outside prev poly but still inside another.
                    //when reversing direction of prev poly use the same WC 
                    if (e.WindDelta * edge.WindDelta < 0) {
                        edge.WindCnt = e.WindCnt;
                        //otherwise continue to 'decrease' WC ...
                    } else {
                        edge.WindCnt = e.WindCnt + edge.WindDelta;
                    }
                } else {
                    //now outside all polys of same polytype so set own WC ...
                    edge.WindCnt = (edge.WindDelta == 0 ? 1 : edge.WindDelta);
                }
            } else {
                //prev edge is 'increasing' WindCount (WC) away from zero
                //so we're inside the previous polygon ...
                if (edge.WindDelta == 0) {
                    edge.WindCnt = e.WindCnt < 0 ? e.WindCnt - 1 : e.WindCnt + 1;
                //if wind direction is reversing prev then use same WC
                } else if (e.WindDelta * edge.WindDelta < 0) {
                    edge.WindCnt = e.WindCnt;
                //otherwise add to WC ...
                } else {
                    edge.WindCnt = e.WindCnt + edge.WindDelta;
                }
            }
            edge.WindCnt2 = e.WindCnt2;
            e = e.NextInAEL; //ie get ready to calc WindCnt2
        }

        //update WindCnt2 ...
        if (this.IsEvenOddAltFillType(edge)) {
            //EvenOdd filling ...
            while (e != edge) {
                if (e.WindDelta != 0) {
                    edge.WindCnt2 = edge.WindCnt2 == 0 ? 1 : 0;
                }
                e = e.NextInAEL;
            }
        } else {
            //nonZero, Positive or Negative filling ...
            while (e != edge) {
                edge.WindCnt2 += e.WindDelta;
                e = e.NextInAEL;
            }
        }
    }

    private AddEdgeToSEL(edge:TEdge):void {
        //SEL pointers in PEdge are use to build transient lists of horizontal edges.
        //However, since we don't need to worry about processing order, all additions
        //are made to the front of the list ...
        if (m_SortedEdges == null) {
            m_SortedEdges = edge;
            edge.PrevInSEL = null;
            edge.NextInSEL = null;
        } else {
            edge.NextInSEL = m_SortedEdges;
            edge.PrevInSEL = null;
            m_SortedEdges.PrevInSEL = edge;
            m_SortedEdges = edge;
        }
    }

    PopEdgeFromSEL():TEdge {
        //Pop edge from front of SEL (ie SEL is a FILO list)
        if (this.m_SortedEdges == null) {
            return null;
        }
        let oldE = this.m_SortedEdges;
        this.m_SortedEdges = this.m_SortedEdges.NextInSEL;
        if (this.m_SortedEdges != null) {
            this.m_SortedEdges.PrevInSEL = null;
        }
        oldE.NextInSEL = null;
        oldE.PrevInSEL = null;
        return true;
    }
     
    private CopyAELToSEL():void {
        let e = this.m_ActiveEdges;
        this.m_SortedEdges = e;
        while (e != null) {
            e.PrevInSEL = e.PrevInAEL;
            e.NextInSEL = e.NextInAEL;
            e = e.NextInAEL;
        }
    }

    private SwapPositionsInSEL(edge1:TEdge, edge2:TEdge):void
    {
        if (edge1.NextInSEL == null && edge1.PrevInSEL == null) {
            return;
        }
        if (edge2.NextInSEL == null && edge2.PrevInSEL == null) {
            return;
        }

        if (edge1.NextInSEL == edge2) {
            let next = edge2.NextInSEL;
            if (next != null) {
                next.PrevInSEL = edge1;
            }
            let prev = edge1.PrevInSEL;
            if (prev != null) {
                prev.NextInSEL = edge2;
            }
            edge2.PrevInSEL = prev;
            edge2.NextInSEL = edge1;
            edge1.PrevInSEL = edge2;
            edge1.NextInSEL = next;
        } else if (edge2.NextInSEL == edge1) {
            let next = edge1.NextInSEL;
            if (next != null) {
                next.PrevInSEL = edge2;
            }
            let prev = edge2.PrevInSEL;
            if (prev != null) {
                prev.NextInSEL = edge1;
            }
            edge1.PrevInSEL = prev;
            edge1.NextInSEL = edge2;
            edge2.PrevInSEL = edge1;
            edge2.NextInSEL = next;
        } else {
            let next = edge1.NextInSEL;
            let prev = edge1.PrevInSEL;
            edge1.NextInSEL = edge2.NextInSEL;
            if (edge1.NextInSEL != null) {
                edge1.NextInSEL.PrevInSEL = edge1;
            }
            edge1.PrevInSEL = edge2.PrevInSEL;
            if (edge1.PrevInSEL != null) {
                edge1.PrevInSEL.NextInSEL = edge1;
            }
            edge2.NextInSEL = next;
            if (edge2.NextInSEL != null) {
                edge2.NextInSEL.PrevInSEL = edge2;
            }
            edge2.PrevInSEL = prev;
            if (edge2.PrevInSEL != null) {
                edge2.PrevInSEL.NextInSEL = edge2;
            }
        }

        if (edge1.PrevInSEL == null) {
            m_SortedEdges = edge1;
        } else if (edge2.PrevInSEL == null) {
            m_SortedEdges = edge2;
        }
    }

    private AddLocalMaxPoly(e1:TEdge, e2:TEdge, pt:IntPoint):void {
        this.AddOutPt(e1, pt);
        if (e2.WindDelta == 0) {
            this.AddOutPt(e2, pt);
        }
        if (e1.OutIdx == e2.OutIdx) {
            e1.OutIdx = Unassigned;
            e2.OutIdx = Unassigned;
        } else if (e1.OutIdx < e2.OutIdx) {
            this.AppendPolygon(e1, e2);
        } else {
            this.AppendPolygon(e2, e1);
        }
    }

    private AddLocalMinPoly(e1:TEdge, e2:TEdge, pt:IntPoint):OutPt {
        let result:OutPt;
        let e:TEdge;
        let prevE:TEdge;
        
        if (IsHorizontal(e2) || e1.Dx > e2.Dx) {
            result = this.AddOutPt(e1, pt);
            e2.OutIdx = e1.OutIdx;
            e1.Side = EdgeSide.esLeft;
            e2.Side = EdgeSide.esRight;
            e = e1;
            if (e.PrevInAEL == e2) {
                prevE = e2.PrevInAEL; 
            } else {
                prevE = e.PrevInAEL;
            }
        } else {
          result = this.AddOutPt(e2, pt);
          e1.OutIdx = e2.OutIdx;
          e1.Side = EdgeSide.esRight;
          e2.Side = EdgeSide.esLeft;
          e = e2;
          if (e.PrevInAEL == e1)
              prevE = e1.PrevInAEL;
          else
              prevE = e.PrevInAEL;
        }

        if (prevE != null 
            && prevE.OutIdx >= 0 
            && prevE.Top.y.lessThan(pt.y)
            && e.Top.y.lessThan(pt.y)) {
            let xPrev = TopX(prevE, pt.Y);
            let xE = TopX(e, pt.Y);
            if (xPrev.equals(xE)
                && e.WindDelta != 0
                && prevE.WindDelta != 0
                && SlopesEqual4P(
                    new IntPoint(xPrev, pt.Y), prevE.Top, new IntPoint(xE, pt.Y), e.Top, m_UseFullRange)) {
                let outPt = this.AddOutPt(prevE, pt);
                this.AddJoin(result, outPt, e.Top);
            }
        }
        return result;
    }
      

    private AddOutPt(e:TEdge, pt:IntPoint):OutPt {
        if (e.OutIdx < 0) {
            let outRec = CreateOutRec();
            outRec.IsOpen = (e.WindDelta == 0);
            let newOp = new OutPt();
            outRec.Pts = newOp;
            newOp.Idx = outRec.Idx;
            newOp.Pt = pt;
            newOp.Next = newOp;
            newOp.Prev = newOp;
            if (!outRec.IsOpen) {
                this.SetHoleState(e, outRec);
            }
            e.OutIdx = outRec.Idx; //nb: do this after SetZ !
            return newOp;
        } else {
            let outRec = this.m_PolyOuts[e.OutIdx];
            //OutRec.Pts is the 'Left-most' point & OutRec.Pts.Prev is the 'Right-most'
            let op = outRec.Pts;
            let ToFront = (e.Side == EdgeSide.esLeft);
            if (ToFront && pt.equals(op.Pt)) {
                return op;
            } else if (!ToFront && pt.equals(op.Prev.Pt)) {
                return op.Prev;
            }

            let newOp = new OutPt();
            newOp.Idx = outRec.Idx;
            newOp.Pt = pt;
            newOp.Next = op;
            newOp.Prev = op.Prev;
            newOp.Prev.Next = newOp;
            op.Prev = newOp;
            if (ToFront) {
                outRec.Pts = newOp;
            }
            return newOp;
        }
    }

    private GetLastOutPt(e:TEdge):OutPt {
        let outRec = this.m_PolyOuts[e.OutIdx];
        if (e.Side == EdgeSide.esLeft) {
            return outRec.Pts;
        }
        return outRec.Pts.Prev;
    }

    private SetHoleState(e:TEdge, outRec:OutRec):void {
        let e2 = e.PrevInAEL;
        let eTmp:TEdge = null;  
        while (e2 != null) {
            if (e2.OutIdx >= 0 && e2.WindDelta != 0) {
                if (eTmp == null) {
                    eTmp = e2;
                } else if (eTmp.OutIdx == e2.OutIdx) {
                    eTmp = null; //paired
                }
            }
            e2 = e2.PrevInAEL;
        }

        if (eTmp == null) {
            outRec.FirstLeft = null;
            outRec.IsHole = false;
        } else {
            outRec.FirstLeft = this.m_PolyOuts[eTmp.OutIdx];
            outRec.IsHole = !outRec.FirstLeft.IsHole;
        }
    }

    private GetOutRec(idx:number):OutRec {
        let outrec = this.m_PolyOuts[idx];
        while (outrec != this.m_PolyOuts[outrec.Idx]) {
            outrec = this.m_PolyOuts[outrec.Idx];
        }
        return outrec;
    }

    private AppendPolygon(e1:TEdge, e2:TEdge):void {
        let outRec1 = this.m_PolyOuts[e1.OutIdx];
        let outRec2 = this.m_PolyOuts[e2.OutIdx];

        let holeStateRec:OutRec;
        if (OutRec1RightOfOutRec2(outRec1, outRec2)) {
            holeStateRec = outRec2;
        } else if (OutRec1RightOfOutRec2(outRec2, outRec1)) {
            holeStateRec = outRec1;
        } else {
            holeStateRec = GetLowermostRec(outRec1, outRec2);
        }

        //get the start and ends of both output polygons and
        //join E2 poly onto E1 poly and delete pointers to E2 ...
        let p1_lft = outRec1.Pts;
        let p1_rt = p1_lft.Prev;
        let p2_lft = outRec2.Pts;
        let p2_rt = p2_lft.Prev;

        //join e2 poly onto e1 poly and delete pointers to e2 ...
        if (e1.Side == EdgeSide.esLeft) {
            if (e2.Side == EdgeSide.esLeft) {
                //z y x a b c
                ReversePolyPtLinks(p2_lft);
                p2_lft.Next = p1_lft;
                p1_lft.Prev = p2_lft;
                p1_rt.Next = p2_rt;
                p2_rt.Prev = p1_rt;
                outRec1.Pts = p2_rt;
            } else {
                //x y z a b c
                p2_rt.Next = p1_lft;
                p1_lft.Prev = p2_rt;
                p2_lft.Prev = p1_rt;
                p1_rt.Next = p2_lft;
                outRec1.Pts = p2_lft;
            }
        } else {
            if (e2.Side == EdgeSide.esRight) {
                //a b c z y x
                ReversePolyPtLinks(p2_lft);
                p1_rt.Next = p2_rt;
                p2_rt.Prev = p1_rt;
                p2_lft.Next = p1_lft;
                p1_lft.Prev = p2_lft;
            } else {
                //a b c x y z
                p1_rt.Next = p2_lft;
                p2_lft.Prev = p1_rt;
                p1_lft.Prev = p2_rt;
                p2_rt.Next = p1_lft;
            }
        }

        outRec1.BottomPt = null; 
        if (holeStateRec == outRec2) {
            if (outRec2.FirstLeft != outRec1) {
                outRec1.FirstLeft = outRec2.FirstLeft;
            }
            outRec1.IsHole = outRec2.IsHole;
        }
        outRec2.Pts = null;
        outRec2.BottomPt = null;

        outRec2.FirstLeft = outRec1;

        let OKIdx = e1.OutIdx;
        let ObsoleteIdx = e2.OutIdx;

        e1.OutIdx = Unassigned; //nb: safe because we only get here via AddLocalMaxPoly
        e2.OutIdx = Unassigned;

        let e = this.m_ActiveEdges;
        while (e != null) {
            if (e.OutIdx == ObsoleteIdx) {
                e.OutIdx = OKIdx;
                e.Side = e1.Side;
                break;
            }
            e = e.NextInAEL;
        }
        outRec2.Idx = outRec1.Idx;
    }

    private IntersectEdges(e1:TEdge, e2:TEdge, pt:IntPoint):void {
        //e1 will be to the left of e2 BELOW the intersection. Therefore e1 is before
        //e2 in AEL except when e1 is being inserted at the intersection point ...

        let e1Contributing = (e1.OutIdx >= 0);
        let e2Contributing = (e2.OutIdx >= 0);

        //if either edge is on an OPEN path ...
        if (e1.WindDelta == 0 || e2.WindDelta == 0) {
            //ignore subject-subject open path intersections UNLESS they
            //are both open paths, AND they are both 'contributing maximas' ...
            if (e1.WindDelta == 0 && e2.WindDelta == 0) {
                return;
                
            } else if (e1.PolyTyp == e2.PolyTyp
                && e1.WindDelta != e2.WindDelta 
                && this.m_ClipType == ClipType.ctUnion) {//if intersecting a subj line with a subj poly ...
                if (e1.WindDelta == 0) {
                    if (e2Contributing) {
                        this.AddOutPt(e1, pt);
                        if (e1Contributing) {
                            e1.OutIdx = Unassigned;
                        }
                    }
                } else {
                    if (e1Contributing) {
                        this.AddOutPt(e2, pt);
                        if (e2Contributing) {
                            e2.OutIdx = Unassigned;
                        }
                    }
                }
            } else if (e1.PolyTyp != e2.PolyTyp) {
                if (e1.WindDelta == 0 
                    && Math.Abs(e2.WindCnt) == 1 
                    && (this.m_ClipType != ClipType.ctUnion || e2.WindCnt2 == 0)) {
                    this.AddOutPt(e1, pt);
                    if (e1Contributing) {
                        e1.OutIdx = Unassigned;
                    }
                }
                else if (e2.WindDelta == 0
                    && Math.Abs(e1.WindCnt) == 1
                    && (this.m_ClipType != ClipType.ctUnion || e1.WindCnt2 == 0)) {
                    this.AddOutPt(e2, pt);
                    if (e2Contributing) {
                        e2.OutIdx = Unassigned;
                    }
                }
            }
            return;
        }

        //update winding counts...
        //assumes that e1 will be to the Right of e2 ABOVE the intersection
        if (e1.PolyTyp == e2.PolyTyp) {
            if (this.IsEvenOddFillType(e1)) {
                let oldE1WindCnt = e1.WindCnt;
                e1.WindCnt = e2.WindCnt;
                e2.WindCnt = oldE1WindCnt;
            } else {
                if (e1.WindCnt + e2.WindDelta == 0) {
                    e1.WindCnt = -e1.WindCnt;
                } else {
                    e1.WindCnt += e2.WindDelta;
                }
                if (e2.WindCnt - e1.WindDelta == 0) {
                    e2.WindCnt = -e2.WindCnt;
                } else {
                    e2.WindCnt -= e1.WindDelta;
                }
            }
        } else {
            if (!this.IsEvenOddFillType(e2)) {
                e1.WindCnt2 += e2.WindDelta;
            } else {
                e1.WindCnt2 = (e1.WindCnt2 == 0) ? 1 : 0;
            }
            if (!this.IsEvenOddFillType(e1)) {
                e2.WindCnt2 -= e1.WindDelta;
            } else {
                e2.WindCnt2 = (e2.WindCnt2 == 0) ? 1 : 0;
            }
        }

        let e1FillType:PolyFillType;
        let e2FillType:PolyFillType;
        let e1FillType2:PolyFillType;
        let e2FillType2:PolyFillType;

        if (e1.PolyTyp == PolyType.ptSubject) {
            e1FillType = m_SubjFillType;
            e1FillType2 = m_ClipFillType;
        } else {
            e1FillType = m_ClipFillType;
            e1FillType2 = m_SubjFillType;
        }
        if (e2.PolyTyp == PolyType.ptSubject) {
            e2FillType = m_SubjFillType;
            e2FillType2 = m_ClipFillType;
        } else {
            e2FillType = m_ClipFillType;
            e2FillType2 = m_SubjFillType;
        }

        let e1Wc:number;
        let e2Wc:number;
        switch (e1FillType) {
            case PolyFillType.pftPositive:
                e1Wc = e1.WindCnt;
                break;
            case PolyFillType.pftNegative:
                e1Wc = -e1.WindCnt;
                break;
            default:
                e1Wc = Math.Abs(e1.WindCnt);
                break;
        }
        switch (e2FillType) {
            case PolyFillType.pftPositive:
                e2Wc = e2.WindCnt;
                break;
            case PolyFillType.pftNegative:
                e2Wc = -e2.WindCnt;
                break;
            default:
                e2Wc = Math.Abs(e2.WindCnt);
                break;
        }

        if (e1Contributing && e2Contributing) {
            if ((e1Wc != 0 && e1Wc != 1)
                || (e2Wc != 0 && e2Wc != 1) 
                || (e1.PolyTyp != e2.PolyTyp && this.m_ClipType != ClipType.ctXor)) {
                this.AddLocalMaxPoly(e1, e2, pt);
            } else {
                this.AddOutPt(e1, pt);
                this.AddOutPt(e2, pt);
                SwapSides(e1, e2);
                SwapPolyIndexes(e1, e2);
            }
        } else if (e1Contributing) {
            if (e2Wc == 0 || e2Wc == 1) {
                this.AddOutPt(e1, pt);
                SwapSides(e1, e2);
                SwapPolyIndexes(e1, e2);
            }
        } else if (e2Contributing) {
            if (e1Wc == 0 || e1Wc == 1) {
                this.AddOutPt(e2, pt);
                SwapSides(e1, e2);
                SwapPolyIndexes(e1, e2);
            }
        } else if ((e1Wc == 0 || e1Wc == 1) && (e2Wc == 0 || e2Wc == 1)) {
            //neither edge is currently contributing ...
            let e1Wc2:Int64;
            let e2Wc2:Int64;
            switch (e1FillType2) {
                case PolyFillType.pftPositive:
                    e1Wc2 = e1.WindCnt2;
                    break;
                case PolyFillType.pftNegative:
                    e1Wc2 = -e1.WindCnt2;
                    break;
                default:
                    e1Wc2 = Math.Abs(e1.WindCnt2);
                    break;
            }
            switch (e2FillType2) {
                case PolyFillType.pftPositive:
                    e2Wc2 = e2.WindCnt2;
                    break;
                case PolyFillType.pftNegative:
                    e2Wc2 = -e2.WindCnt2;
                    break;
                default:
                    e2Wc2 = Math.Abs(e2.WindCnt2);
                    break;
            }

            if (e1.PolyTyp != e2.PolyTyp) {
                this.AddLocalMinPoly(e1, e2, pt);
            } else if (e1Wc == 1 && e2Wc == 1) {
                switch (this.m_ClipType) {
                  case ClipType.ctIntersection:
                        if (e1Wc2 > 0 && e2Wc2 > 0) {
                            this.AddLocalMinPoly(e1, e2, pt);
                        }
                        break;
                  case ClipType.ctUnion:
                        if (e1Wc2 <= 0 && e2Wc2 <= 0) {
                            this.AddLocalMinPoly(e1, e2, pt);
                        }
                        break;
                  case ClipType.ctDifference:
                        if ((e1.PolyTyp == PolyType.ptClip && e1Wc2 > 0 && e2Wc2 > 0)
                            || (e1.PolyTyp == PolyType.ptSubject && e1Wc2 <= 0 && e2Wc2 <= 0)) {
                            this.AddLocalMinPoly(e1, e2, pt);
                        }
                        break;
                  case ClipType.ctXor:
                        this.AddLocalMinPoly(e1, e2, pt);
                    break;
                }
            } else {
                SwapSides(e1, e2);
            }
        }
    }

    private DeleteFromSEL(e:TEdge):void {
        let SelPrev = e.PrevInSEL;
        let SelNext = e.NextInSEL;
        if (SelPrev == null && SelNext == null && (e != this.m_SortedEdges)) {
            return; //already deleted
        }
        if (SelPrev != null) {
            SelPrev.NextInSEL = SelNext;
        } else {
            this.m_SortedEdges = SelNext;
        }
        if (SelNext != null) {
            SelNext.PrevInSEL = SelPrev;
        }
        e.NextInSEL = null;
        e.PrevInSEL = null;
    }

    private ProcessHorizontals():void {
        let horzEdge:TEdge; //m_SortedEdges;
        while ((horzEdge = this.PopEdgeFromSEL()) != null) {
            this.ProcessHorizontal(horzEdge);
        }
    }

    private ProcessHorizontal(horzEdge:TEdge):void {
        let dir:Direction;
        let horzLeft:Int64;
        let horzRight:Int64;
        let IsOpen = horzEdge.WindDelta == 0;

        let r = GetHorzDirection(horzEdge);
        dir = r.Dir;
        horzLeft = r.Left;
        horzRight = r.Right;

        let eLastHorz = horzEdge;
        let eMaxPair:TEdge = null;
        while (eLastHorz.NextInLML != null 
            && IsHorizontal(eLastHorz.NextInLML)) {
            eLastHorz = eLastHorz.NextInLML;
        }
        if (eLastHorz.NextInLML == null) {
            eMaxPair = GetMaximaPair(eLastHorz);
        }

        let currMax = this.m_Maxima;
        if (currMax != null) {
            //get the first maxima in range (X) ...
            if (dir == Direction.dLeftToRight) {
                while (currMax != null && currMax.X.lessThan(horzEdge.Bot.x)) {
                    currMax = currMax.Next;
                }
                if (currMax != null && currMax.X.greaterThanOrEqual(eLastHorz.Top.x)) {
                    currMax = null;
                }
            } else {
                while (currMax.Next != null && currMax.Next.X.lessThan(horzEdge.Bot.x)) {
                    currMax = currMax.Next;
                }
                if (currMax.X.lessThanOrEqual(eLastHorz.Top.x)) {
                    currMax = null;
                }
            }
        }

        let op1:OutPt = null;
        for (;;) {//loop through consec. horizontal edges
            let IsLastHorz = (horzEdge == eLastHorz);
            let e = GetNextInAEL(horzEdge, dir);
            while(e != null) {
                //this code block inserts extra coords into horizontal edges (in output
                //polygons) whereever maxima touch these horizontal edges. This helps
                //'simplifying' polygons (ie if the Simplify property is set).
                if (currMax != null) {
                    if (dir == Direction.dLeftToRight) {
                        while (currMax != null && currMax.X.lessThan(e.Curr.x)) {
                            if (horzEdge.OutIdx >= 0 && !IsOpen) {
                                this.AddOutPt(horzEdge, new IntPoint(currMax.X, horzEdge.Bot.y));
                            }
                            currMax = currMax.Next;                  
                        }
                    } else {
                        while (currMax != null && currMax.X.greaterThan(e.Curr.x)) {
                            if (horzEdge.OutIdx >= 0 && !IsOpen) {
                                this.AddOutPt(horzEdge, new IntPoint(currMax.X, horzEdge.Bot.y));
                            }
                            currMax = currMax.Prev;
                        }
                    }
                }

                if ((dir == Direction.dLeftToRight && e.Curr.x.greaterThan(horzRight))
                    || (dir == Direction.dRightToLeft && e.Curr.x.lessThan(horzLeft))) {
                    break;
                }
                   
                //Also break if we've got to the end of an intermediate horizontal edge ...
                //nb: Smaller Dx's are to the right of larger Dx's ABOVE the horizontal.
                if (e.Curr.x.equals(horzEdge.Top.x)
                    && horzEdge.NextInLML != null
                    && e.Dx < horzEdge.NextInLML.Dx) {
                    break;
                }

                if (horzEdge.OutIdx >= 0 && !IsOpen) {//note: may be done multiple times
                    op1 = this.AddOutPt(horzEdge, e.Curr);
                    let eNextHorz = this.m_SortedEdges;
                    while (eNextHorz != null) {
                        if (eNextHorz.OutIdx >= 0 &&
                            HorzSegmentsOverlap(horzEdge.Bot.x, horzEdge.Top.x, eNextHorz.Bot.x, eNextHorz.Top.x)) {
                            let op2 = this.GetLastOutPt(eNextHorz);
                            this.AddJoin(op2, op1, eNextHorz.Top);
                        }
                        eNextHorz = eNextHorz.NextInSEL;
                    }
                    this.AddGhostJoin(op1, horzEdge.Bot);
                }

                //OK, so far we're still in range of the horizontal Edge  but make sure
                //we're at the last of consec. horizontals when matching with eMaxPair
                if (e == eMaxPair && IsLastHorz) {
                    if (horzEdge.OutIdx >= 0) {
                        this.AddLocalMaxPoly(horzEdge, eMaxPair, horzEdge.Top);
                    }
                    this.DeleteFromAEL(horzEdge);
                    this.DeleteFromAEL(eMaxPair);
                    return;
                }

                if (dir == Direction.dLeftToRight) {
                    let Pt = new IntPoint(e.Curr.x, horzEdge.Curr.y);
                    this.IntersectEdges(horzEdge, e, Pt);
                } else {
                    let Pt = new IntPoint(e.Curr.x, horzEdge.Curr.y);
                    this.IntersectEdges(e, horzEdge, Pt);
                }
                let eNext = GetNextInAEL(e, dir);
                this.SwapPositionsInAEL(horzEdge, e);
                e = eNext;
            } //end while(e != null)

            //Break out of loop if HorzEdge.NextInLML is not also horizontal ...
            if (horzEdge.NextInLML == null || !IsHorizontal(horzEdge.NextInLML)) {
                break;
            }

            horzEdge = this.UpdateEdgeIntoAEL(horzEdge);
            if (horzEdge.OutIdx >= 0) {
                this.AddOutPt(horzEdge, horzEdge.Bot);
            }
            r = GetHorzDirection(horzEdge);
            dir = r.Dir;
            horzLeft = r.Left;
            horzRight = r.Right;
        } //end for (;;)

        if (horzEdge.OutIdx >= 0 && op1 == null) {
            op1 = GetLastOutPt(horzEdge);
            let eNextHorz = this.m_SortedEdges;
            while (eNextHorz != null) {
                if (eNextHorz.OutIdx >= 0
                    && HorzSegmentsOverlap(horzEdge.Bot.x, horzEdge.Top.x, eNextHorz.Bot.x, eNextHorz.Top.x)) {
                    let op2 = this.GetLastOutPt(eNextHorz);
                    this.AddJoin(op2, op1, eNextHorz.Top);
                }
                eNextHorz = eNextHorz.NextInSEL;
            }
            this.AddGhostJoin(op1, horzEdge.Top);
        }

        if (horzEdge.NextInLML != null) {
            if(horzEdge.OutIdx >= 0) {
                op1 = AddOutPt( horzEdge, horzEdge.Top);

                horzEdge = this.UpdateEdgeIntoAEL(horzEdge);
                if (horzEdge.WindDelta == 0) {
                    return;
                }
                //nb: HorzEdge is no longer horizontal here
                let ePrev = horzEdge.PrevInAEL;
                let eNext = horzEdge.NextInAEL;
                if (ePrev != null
                    && ePrev.Curr.x.equals(horzEdge.Bot.x)
                    && ePrev.Curr.y.equals(horzEdge.Bot.y)
                    && ePrev.WindDelta != 0 
                    && ePrev.OutIdx >= 0
                    && ePrev.Curr.y.greaterThan(ePrev.Top.y)
                    && SlopesEqual(horzEdge, ePrev, this.m_UseFullRange)) {
                    let op2 = this.AddOutPt(ePrev, horzEdge.Bot);
                    this.AddJoin(op1, op2, horzEdge.Top);
                } else if (eNext != null
                    && eNext.Curr.x.equals(horzEdge.Bot.x)
                    && eNext.Curr.y.equals(horzEdge.Bot.y)
                    && eNext.WindDelta != 0
                    && eNext.OutIdx >= 0
                    && eNext.Curr.y.greaterThan(eNext.Top.y)
                    && SlopesEqual(horzEdge, eNext, this.m_UseFullRange)) {
                    let op2 = this.AddOutPt(eNext, horzEdge.Bot);
                    this.AddJoin(op1, op2, horzEdge.Top);
                }
            } else {
                horzEdge = this.UpdateEdgeIntoAEL(horzEdge); 
            }
        } else {
            if (horzEdge.OutIdx >= 0) {
                this.AddOutPt(horzEdge, horzEdge.Top);
            }
            this.DeleteFromAEL(horzEdge);
        }
    }

    private ProcessIntersections(topY:Int64):boolean {
        if (this.m_ActiveEdges == null) {
            return true;
        }
        try {
            this.BuildIntersectList(topY);
            if (this.m_IntersectList.length == 0) {
                return true;
            }
            if (this.m_IntersectList.length == 1
                || this.FixupIntersectionOrder()) {
                ProcessIntersectList();
            } else {
                return false;
            }
        } catch (e) {
          this.m_SortedEdges = null;
          this.m_IntersectList.length = 0;
          throw new Error("ProcessIntersections error");
        }
        this.m_SortedEdges = null;
        return true;
    }
      

      private void BuildIntersectList(cInt topY)
      {
        if ( m_ActiveEdges == null ) return;

        //prepare for sorting ...
        TEdge e = m_ActiveEdges;
        m_SortedEdges = e;
        while( e != null )
        {
          e.PrevInSEL = e.PrevInAEL;
          e.NextInSEL = e.NextInAEL;
          e.Curr.X = TopX( e, topY );
          e = e.NextInAEL;
        }

        //bubblesort ...
        bool isModified = true;
        while( isModified && m_SortedEdges != null )
        {
          isModified = false;
          e = m_SortedEdges;
          while( e.NextInSEL != null )
          {
            TEdge eNext = e.NextInSEL;
            IntPoint pt;
            if (e.Curr.X > eNext.Curr.X)
            {
                IntersectPoint(e, eNext, out pt);
                if (pt.Y < topY)
                  pt = new IntPoint(TopX(e, topY), topY);
                IntersectNode newNode = new IntersectNode();
                newNode.Edge1 = e;
                newNode.Edge2 = eNext;
                newNode.Pt = pt;
                m_IntersectList.Add(newNode);

                SwapPositionsInSEL(e, eNext);
                isModified = true;
            }
            else
              e = eNext;
          }
          if( e.PrevInSEL != null ) e.PrevInSEL.NextInSEL = null;
          else break;
        }
        m_SortedEdges = null;
      }
      

      private bool EdgesAdjacent(IntersectNode inode)
      {
        return (inode.Edge1.NextInSEL == inode.Edge2) ||
          (inode.Edge1.PrevInSEL == inode.Edge2);
      }
      

      private static int IntersectNodeSort(IntersectNode node1, IntersectNode node2)
      {
        //the following typecast is safe because the differences in Pt.Y will
        //be limited to the height of the scanbeam.
        return (int)(node2.Pt.Y - node1.Pt.Y); 
      }
      

      private bool FixupIntersectionOrder()
      {
        //pre-condition: intersections are sorted bottom-most first.
        //Now it's crucial that intersections are made only between adjacent edges,
        //so to ensure this the order of intersections may need adjusting ...
        m_IntersectList.Sort(m_IntersectNodeComparer);

        CopyAELToSEL();
        int cnt = m_IntersectList.Count;
        for (int i = 0; i < cnt; i++)
        {
          if (!EdgesAdjacent(m_IntersectList[i]))
          {
            int j = i + 1;
            while (j < cnt && !EdgesAdjacent(m_IntersectList[j])) j++;
            if (j == cnt) return false;

            IntersectNode tmp = m_IntersectList[i];
            m_IntersectList[i] = m_IntersectList[j];
            m_IntersectList[j] = tmp;

          }
          SwapPositionsInSEL(m_IntersectList[i].Edge1, m_IntersectList[i].Edge2);
        }
          return true;
      }
      

      private void ProcessIntersectList()
      {
        for (int i = 0; i < m_IntersectList.Count; i++)
        {
          IntersectNode iNode = m_IntersectList[i];
          {
            IntersectEdges(iNode.Edge1, iNode.Edge2, iNode.Pt);
            SwapPositionsInAEL(iNode.Edge1, iNode.Edge2);
          }
        }
        m_IntersectList.Clear();
      }
      

      internal static cInt Round(double value)
      {
          return value < 0 ? (cInt)(value - 0.5) : (cInt)(value + 0.5);
      }
      
      


      private void IntersectPoint(TEdge edge1, TEdge edge2, out IntPoint ip)
      {
        ip = new IntPoint();
        double b1, b2;
        //nb: with very large coordinate values, it's possible for SlopesEqual() to 
        //return false but for the edge.Dx value be equal due to double precision rounding.
        if (edge1.Dx == edge2.Dx)
        {
          ip.Y = edge1.Curr.Y;
          ip.X = TopX(edge1, ip.Y);
          return;
        }

        if (edge1.Delta.X == 0)
        {
            ip.X = edge1.Bot.X;
            if (IsHorizontal(edge2))
            {
                ip.Y = edge2.Bot.Y;
            }
            else
            {
                b2 = edge2.Bot.Y - (edge2.Bot.X / edge2.Dx);
                ip.Y = Round(ip.X / edge2.Dx + b2);
            }
        }
        else if (edge2.Delta.X == 0)
        {
            ip.X = edge2.Bot.X;
            if (IsHorizontal(edge1))
            {
                ip.Y = edge1.Bot.Y;
            }
            else
            {
                b1 = edge1.Bot.Y - (edge1.Bot.X / edge1.Dx);
                ip.Y = Round(ip.X / edge1.Dx + b1);
            }
        }
        else
        {
            b1 = edge1.Bot.X - edge1.Bot.Y * edge1.Dx;
            b2 = edge2.Bot.X - edge2.Bot.Y * edge2.Dx;
            double q = (b2 - b1) / (edge1.Dx - edge2.Dx);
            ip.Y = Round(q);
            if (Math.Abs(edge1.Dx) < Math.Abs(edge2.Dx))
                ip.X = Round(edge1.Dx * q + b1);
            else
                ip.X = Round(edge2.Dx * q + b2);
        }

        if (ip.Y < edge1.Top.Y || ip.Y < edge2.Top.Y)
        {
          if (edge1.Top.Y > edge2.Top.Y)
            ip.Y = edge1.Top.Y;
          else
            ip.Y = edge2.Top.Y;
          if (Math.Abs(edge1.Dx) < Math.Abs(edge2.Dx))
            ip.X = TopX(edge1, ip.Y);
          else
            ip.X = TopX(edge2, ip.Y);
        }
        //finally, don't allow 'ip' to be BELOW curr.Y (ie bottom of scanbeam) ...
        if (ip.Y > edge1.Curr.Y)
        {
          ip.Y = edge1.Curr.Y;
          //better to use the more vertical edge to derive X ...
          if (Math.Abs(edge1.Dx) > Math.Abs(edge2.Dx)) 
            ip.X = TopX(edge2, ip.Y);
          else 
            ip.X = TopX(edge1, ip.Y);
        }
      }
      

      private void ProcessEdgesAtTopOfScanbeam(cInt topY)
      {
        TEdge e = m_ActiveEdges;
        while(e != null)
        {
          //1. process maxima, treating them as if they're 'bent' horizontal edges,
          //   but exclude maxima with horizontal edges. nb: e can't be a horizontal.
          bool IsMaximaEdge = IsMaxima(e, topY);

          if(IsMaximaEdge)
          {
            TEdge eMaxPair = GetMaximaPairEx(e);
            IsMaximaEdge = (eMaxPair == null || !IsHorizontal(eMaxPair));
          }

          if(IsMaximaEdge)
          {
            if (StrictlySimple) InsertMaxima(e.Top.X);
            TEdge ePrev = e.PrevInAEL;
            DoMaxima(e);
            if( ePrev == null) e = m_ActiveEdges;
            else e = ePrev.NextInAEL;
          }
          else
          {
            //2. promote horizontal edges, otherwise update Curr.X and Curr.Y ...
            if (IsIntermediate(e, topY) && IsHorizontal(e.NextInLML))
            {
              UpdateEdgeIntoAEL(ref e);
              if (e.OutIdx >= 0)
                AddOutPt(e, e.Bot);
              AddEdgeToSEL(e);
            } 
            else
            {
              e.Curr.X = TopX( e, topY );
              e.Curr.Y = topY;
#if use_xyz
              if (e.Top.Y == topY) e.Curr.Z = e.Top.Z;
              else if (e.Bot.Y == topY) e.Curr.Z = e.Bot.Z;
              else e.Curr.Z = 0;
#endif
            }
            //When StrictlySimple and 'e' is being touched by another edge, then
            //make sure both edges have a vertex here ...
            if (StrictlySimple)
            {
              TEdge ePrev = e.PrevInAEL;
              if ((e.OutIdx >= 0) && (e.WindDelta != 0) && ePrev != null &&
                (ePrev.OutIdx >= 0) && (ePrev.Curr.X == e.Curr.X) &&
                (ePrev.WindDelta != 0))
              {
                IntPoint ip = new IntPoint(e.Curr);
#if use_xyz
                SetZ(ref ip, ePrev, e);
#endif
                OutPt op = AddOutPt(ePrev, ip);
                OutPt op2 = AddOutPt(e, ip);
                AddJoin(op, op2, ip); //StrictlySimple (type-3) join
              }
            }

            e = e.NextInAEL;
          }
        }

        //3. Process horizontals at the Top of the scanbeam ...
        ProcessHorizontals();
        m_Maxima = null;

        //4. Promote intermediate vertices ...
        e = m_ActiveEdges;
        while (e != null)
        {
          if(IsIntermediate(e, topY))
          {
            OutPt op = null;
            if( e.OutIdx >= 0 ) 
              op = AddOutPt(e, e.Top);
            UpdateEdgeIntoAEL(ref e);

            //if output polygons share an edge, they'll need joining later ...
            TEdge ePrev = e.PrevInAEL;
            TEdge eNext = e.NextInAEL;
            if (ePrev != null && ePrev.Curr.X == e.Bot.X &&
              ePrev.Curr.Y == e.Bot.Y && op != null &&
              ePrev.OutIdx >= 0 && ePrev.Curr.Y > ePrev.Top.Y &&
              SlopesEqual(e.Curr, e.Top, ePrev.Curr, ePrev.Top, m_UseFullRange) &&
              (e.WindDelta != 0) && (ePrev.WindDelta != 0))
            {
              OutPt op2 = AddOutPt(ePrev, e.Bot);
              AddJoin(op, op2, e.Top);
            }
            else if (eNext != null && eNext.Curr.X == e.Bot.X &&
              eNext.Curr.Y == e.Bot.Y && op != null &&
              eNext.OutIdx >= 0 && eNext.Curr.Y > eNext.Top.Y &&
              SlopesEqual(e.Curr, e.Top, eNext.Curr, eNext.Top, m_UseFullRange) &&
              (e.WindDelta != 0) && (eNext.WindDelta != 0))
            {
              OutPt op2 = AddOutPt(eNext, e.Bot);
              AddJoin(op, op2, e.Top);
            }
          }
          e = e.NextInAEL;
        }
      }
      

      private void DoMaxima(TEdge e)
      {
        TEdge eMaxPair = GetMaximaPairEx(e);
        if (eMaxPair == null)
        {
          if (e.OutIdx >= 0)
            AddOutPt(e, e.Top);
          DeleteFromAEL(e);
          return;
        }

        TEdge eNext = e.NextInAEL;
        while(eNext != null && eNext != eMaxPair)
        {
          IntersectEdges(e, eNext, e.Top);
          SwapPositionsInAEL(e, eNext);
          eNext = e.NextInAEL;
        }

        if(e.OutIdx == Unassigned && eMaxPair.OutIdx == Unassigned)
        {
          DeleteFromAEL(e);
          DeleteFromAEL(eMaxPair);
        }
        else if( e.OutIdx >= 0 && eMaxPair.OutIdx >= 0 )
        {
          if (e.OutIdx >= 0) AddLocalMaxPoly(e, eMaxPair, e.Top);
          DeleteFromAEL(e);
          DeleteFromAEL(eMaxPair);
        }
#if use_lines
        else if (e.WindDelta == 0)
        {
          if (e.OutIdx >= 0) 
          {
            AddOutPt(e, e.Top);
            e.OutIdx = Unassigned;
          }
          DeleteFromAEL(e);

          if (eMaxPair.OutIdx >= 0)
          {
            AddOutPt(eMaxPair, e.Top);
            eMaxPair.OutIdx = Unassigned;
          }
          DeleteFromAEL(eMaxPair);
        } 
#endif
        else throw new ClipperException("DoMaxima error");
      }
      

      public static void ReversePaths(Paths polys)
      {
        foreach (var poly in polys) { poly.Reverse(); }
      }
      

      public static bool Orientation(Path poly)
      {
          return Area(poly) >= 0;
      }
      

      private int PointCount(OutPt pts)
      {
          if (pts == null) return 0;
          int result = 0;
          OutPt p = pts;
          do
          {
              result++;
              p = p.Next;
          }
          while (p != pts);
          return result;
      }
      

      private void BuildResult(Paths polyg)
      {
          polyg.Clear();
          polyg.Capacity = m_PolyOuts.Count;
          for (int i = 0; i < m_PolyOuts.Count; i++)
          {
              OutRec outRec = m_PolyOuts[i];
              if (outRec.Pts == null) continue;
              OutPt p = outRec.Pts.Prev;
              int cnt = PointCount(p);
              if (cnt < 2) continue;
              Path pg = new Path(cnt);
              for (int j = 0; j < cnt; j++)
              {
                  pg.Add(p.Pt);
                  p = p.Prev;
              }
              polyg.Add(pg);
          }
      }
      

      private void BuildResult2(PolyTree polytree)
      {
          polytree.Clear();

          //add each output polygon/contour to polytree ...
          polytree.m_AllPolys.Capacity = m_PolyOuts.Count;
          for (int i = 0; i < m_PolyOuts.Count; i++)
          {
              OutRec outRec = m_PolyOuts[i];
              int cnt = PointCount(outRec.Pts);
              if ((outRec.IsOpen && cnt < 2) || 
                (!outRec.IsOpen && cnt < 3)) continue;
              FixHoleLinkage(outRec);
              PolyNode pn = new PolyNode();
              polytree.m_AllPolys.Add(pn);
              outRec.PolyNode = pn;
              pn.m_polygon.Capacity = cnt;
              OutPt op = outRec.Pts.Prev;
              for (int j = 0; j < cnt; j++)
              {
                  pn.m_polygon.Add(op.Pt);
                  op = op.Prev;
              }
          }

          //fixup PolyNode links etc ...
          polytree.m_Childs.Capacity = m_PolyOuts.Count;
          for (int i = 0; i < m_PolyOuts.Count; i++)
          {
              OutRec outRec = m_PolyOuts[i];
              if (outRec.PolyNode == null) continue;
              else if (outRec.IsOpen)
              {
                outRec.PolyNode.IsOpen = true;
                polytree.AddChild(outRec.PolyNode);
              }
              else if (outRec.FirstLeft != null && 
                outRec.FirstLeft.PolyNode != null)
                  outRec.FirstLeft.PolyNode.AddChild(outRec.PolyNode);
              else
                polytree.AddChild(outRec.PolyNode);
          }
      }
      

      private void FixupOutPolyline(OutRec outrec)
      {
        OutPt pp = outrec.Pts;
        OutPt lastPP = pp.Prev;
        while (pp != lastPP)
        {
            pp = pp.Next;
            if (pp.Pt == pp.Prev.Pt)
            {
                if (pp == lastPP) lastPP = pp.Prev;
                OutPt tmpPP = pp.Prev;
                tmpPP.Next = pp.Next;
                pp.Next.Prev = tmpPP;
                pp = tmpPP;
            }
        }
        if (pp == pp.Prev) outrec.Pts = null;
      }
      

      private void FixupOutPolygon(OutRec outRec)
      {
          //FixupOutPolygon() - removes duplicate points and simplifies consecutive
          //parallel edges by removing the middle vertex.
          OutPt lastOK = null;
          outRec.BottomPt = null;
          OutPt pp = outRec.Pts;
          bool preserveCol = PreserveCollinear || StrictlySimple;
          for (;;)
          {
              if (pp.Prev == pp || pp.Prev == pp.Next)
              {
                  outRec.Pts = null;
                  return;
              }
              //test for duplicate points and collinear edges ...
              if ((pp.Pt == pp.Next.Pt) || (pp.Pt == pp.Prev.Pt) ||
                (SlopesEqual(pp.Prev.Pt, pp.Pt, pp.Next.Pt, m_UseFullRange) &&
                (!preserveCol || !Pt2IsBetweenPt1AndPt3(pp.Prev.Pt, pp.Pt, pp.Next.Pt))))
              {
                  lastOK = null;
                  pp.Prev.Next = pp.Next;
                  pp.Next.Prev = pp.Prev;
                  pp = pp.Prev;
              }
              else if (pp == lastOK) break;
              else
              {
                  if (lastOK == null) lastOK = pp;
                  pp = pp.Next;
              }
          }
          outRec.Pts = pp;
      }
      

      OutPt DupOutPt(OutPt outPt, bool InsertAfter)
      {
        OutPt result = new OutPt();
        result.Pt = outPt.Pt;
        result.Idx = outPt.Idx;
        if (InsertAfter)
        {
          result.Next = outPt.Next;
          result.Prev = outPt;
          outPt.Next.Prev = result;
          outPt.Next = result;
        } 
        else
        {
          result.Prev = outPt.Prev;
          result.Next = outPt;
          outPt.Prev.Next = result;
          outPt.Prev = result;
        }
        return result;
      }
      

      bool GetOverlap(cInt a1, cInt a2, cInt b1, cInt b2, out cInt Left, out cInt Right)
      {
        if (a1 < a2)
        {
          if (b1 < b2) {Left = Math.Max(a1,b1); Right = Math.Min(a2,b2);}
          else {Left = Math.Max(a1,b2); Right = Math.Min(a2,b1);}
        } 
        else
        {
          if (b1 < b2) {Left = Math.Max(a2,b1); Right = Math.Min(a1,b2);}
          else { Left = Math.Max(a2, b2); Right = Math.Min(a1, b1); }
        }
        return Left < Right;
      }
      

      bool JoinHorz(OutPt op1, OutPt op1b, OutPt op2, OutPt op2b, 
        IntPoint Pt, bool DiscardLeft)
      {
        Direction Dir1 = (op1.Pt.X > op1b.Pt.X ? 
          Direction.dRightToLeft : Direction.dLeftToRight);
        Direction Dir2 = (op2.Pt.X > op2b.Pt.X ?
          Direction.dRightToLeft : Direction.dLeftToRight);
        if (Dir1 == Dir2) return false;

        //When DiscardLeft, we want Op1b to be on the Left of Op1, otherwise we
        //want Op1b to be on the Right. (And likewise with Op2 and Op2b.)
        //So, to facilitate this while inserting Op1b and Op2b ...
        //when DiscardLeft, make sure we're AT or RIGHT of Pt before adding Op1b,
        //otherwise make sure we're AT or LEFT of Pt. (Likewise with Op2b.)
        if (Dir1 == Direction.dLeftToRight) 
        {
          while (op1.Next.Pt.X <= Pt.X && 
            op1.Next.Pt.X >= op1.Pt.X && op1.Next.Pt.Y == Pt.Y)  
              op1 = op1.Next;
          if (DiscardLeft && (op1.Pt.X != Pt.X)) op1 = op1.Next;
          op1b = DupOutPt(op1, !DiscardLeft);
          if (op1b.Pt != Pt) 
          {
            op1 = op1b;
            op1.Pt = Pt;
            op1b = DupOutPt(op1, !DiscardLeft);
          }
        } 
        else
        {
          while (op1.Next.Pt.X >= Pt.X && 
            op1.Next.Pt.X <= op1.Pt.X && op1.Next.Pt.Y == Pt.Y) 
              op1 = op1.Next;
          if (!DiscardLeft && (op1.Pt.X != Pt.X)) op1 = op1.Next;
          op1b = DupOutPt(op1, DiscardLeft);
          if (op1b.Pt != Pt)
          {
            op1 = op1b;
            op1.Pt = Pt;
            op1b = DupOutPt(op1, DiscardLeft);
          }
        }

        if (Dir2 == Direction.dLeftToRight)
        {
          while (op2.Next.Pt.X <= Pt.X && 
            op2.Next.Pt.X >= op2.Pt.X && op2.Next.Pt.Y == Pt.Y)
              op2 = op2.Next;
          if (DiscardLeft && (op2.Pt.X != Pt.X)) op2 = op2.Next;
          op2b = DupOutPt(op2, !DiscardLeft);
          if (op2b.Pt != Pt)
          {
            op2 = op2b;
            op2.Pt = Pt;
            op2b = DupOutPt(op2, !DiscardLeft);
          };
        } else
        {
          while (op2.Next.Pt.X >= Pt.X && 
            op2.Next.Pt.X <= op2.Pt.X && op2.Next.Pt.Y == Pt.Y) 
              op2 = op2.Next;
          if (!DiscardLeft && (op2.Pt.X != Pt.X)) op2 = op2.Next;
          op2b = DupOutPt(op2, DiscardLeft);
          if (op2b.Pt != Pt)
          {
            op2 = op2b;
            op2.Pt = Pt;
            op2b = DupOutPt(op2, DiscardLeft);
          };
        };

        if ((Dir1 == Direction.dLeftToRight) == DiscardLeft)
        {
          op1.Prev = op2;
          op2.Next = op1;
          op1b.Next = op2b;
          op2b.Prev = op1b;
        }
        else
        {
          op1.Next = op2;
          op2.Prev = op1;
          op1b.Prev = op2b;
          op2b.Next = op1b;
        }
        return true;
      }
      

      private bool JoinPoints(Join j, OutRec outRec1, OutRec outRec2)
      {
        OutPt op1 = j.OutPt1, op1b;
        OutPt op2 = j.OutPt2, op2b;

        //There are 3 kinds of joins for output polygons ...
        //1. Horizontal joins where Join.OutPt1 & Join.OutPt2 are vertices anywhere
        //along (horizontal) collinear edges (& Join.OffPt is on the same horizontal).
        //2. Non-horizontal joins where Join.OutPt1 & Join.OutPt2 are at the same
        //location at the Bottom of the overlapping segment (& Join.OffPt is above).
        //3. StrictlySimple joins where edges touch but are not collinear and where
        //Join.OutPt1, Join.OutPt2 & Join.OffPt all share the same point.
        bool isHorizontal = (j.OutPt1.Pt.Y == j.OffPt.Y);

        if (isHorizontal && (j.OffPt == j.OutPt1.Pt) && (j.OffPt == j.OutPt2.Pt))
        {          
          //Strictly Simple join ...
          if (outRec1 != outRec2) return false;
          op1b = j.OutPt1.Next;
          while (op1b != op1 && (op1b.Pt == j.OffPt)) 
            op1b = op1b.Next;
          bool reverse1 = (op1b.Pt.Y > j.OffPt.Y);
          op2b = j.OutPt2.Next;
          while (op2b != op2 && (op2b.Pt == j.OffPt)) 
            op2b = op2b.Next;
          bool reverse2 = (op2b.Pt.Y > j.OffPt.Y);
          if (reverse1 == reverse2) return false;
          if (reverse1)
          {
            op1b = DupOutPt(op1, false);
            op2b = DupOutPt(op2, true);
            op1.Prev = op2;
            op2.Next = op1;
            op1b.Next = op2b;
            op2b.Prev = op1b;
            j.OutPt1 = op1;
            j.OutPt2 = op1b;
            return true;
          } else
          {
            op1b = DupOutPt(op1, true);
            op2b = DupOutPt(op2, false);
            op1.Next = op2;
            op2.Prev = op1;
            op1b.Prev = op2b;
            op2b.Next = op1b;
            j.OutPt1 = op1;
            j.OutPt2 = op1b;
            return true;
          }
        } 
        else if (isHorizontal)
        {
          //treat horizontal joins differently to non-horizontal joins since with
          //them we're not yet sure where the overlapping is. OutPt1.Pt & OutPt2.Pt
          //may be anywhere along the horizontal edge.
          op1b = op1;
          while (op1.Prev.Pt.Y == op1.Pt.Y && op1.Prev != op1b && op1.Prev != op2)
            op1 = op1.Prev;
          while (op1b.Next.Pt.Y == op1b.Pt.Y && op1b.Next != op1 && op1b.Next != op2)
            op1b = op1b.Next;
          if (op1b.Next == op1 || op1b.Next == op2) return false; //a flat 'polygon'

          op2b = op2;
          while (op2.Prev.Pt.Y == op2.Pt.Y && op2.Prev != op2b && op2.Prev != op1b)
            op2 = op2.Prev;
          while (op2b.Next.Pt.Y == op2b.Pt.Y && op2b.Next != op2 && op2b.Next != op1)
            op2b = op2b.Next;
          if (op2b.Next == op2 || op2b.Next == op1) return false; //a flat 'polygon'

          cInt Left, Right;
          //Op1 -. Op1b & Op2 -. Op2b are the extremites of the horizontal edges
          if (!GetOverlap(op1.Pt.X, op1b.Pt.X, op2.Pt.X, op2b.Pt.X, out Left, out Right))
            return false;

          //DiscardLeftSide: when overlapping edges are joined, a spike will created
          //which needs to be cleaned up. However, we don't want Op1 or Op2 caught up
          //on the discard Side as either may still be needed for other joins ...
          IntPoint Pt;
          bool DiscardLeftSide;
          if (op1.Pt.X >= Left && op1.Pt.X <= Right) 
          {
            Pt = op1.Pt; DiscardLeftSide = (op1.Pt.X > op1b.Pt.X);
          } 
          else if (op2.Pt.X >= Left&& op2.Pt.X <= Right) 
          {
            Pt = op2.Pt; DiscardLeftSide = (op2.Pt.X > op2b.Pt.X);
          } 
          else if (op1b.Pt.X >= Left && op1b.Pt.X <= Right)
          {
            Pt = op1b.Pt; DiscardLeftSide = op1b.Pt.X > op1.Pt.X;
          } 
          else
          {
            Pt = op2b.Pt; DiscardLeftSide = (op2b.Pt.X > op2.Pt.X);
          }
          j.OutPt1 = op1;
          j.OutPt2 = op2;
          return JoinHorz(op1, op1b, op2, op2b, Pt, DiscardLeftSide);
        } else
        {
          //nb: For non-horizontal joins ...
          //    1. Jr.OutPt1.Pt.Y == Jr.OutPt2.Pt.Y
          //    2. Jr.OutPt1.Pt > Jr.OffPt.Y

          //make sure the polygons are correctly oriented ...
          op1b = op1.Next;
          while ((op1b.Pt == op1.Pt) && (op1b != op1)) op1b = op1b.Next;
          bool Reverse1 = ((op1b.Pt.Y > op1.Pt.Y) ||
            !SlopesEqual(op1.Pt, op1b.Pt, j.OffPt, m_UseFullRange));
          if (Reverse1)
          {
            op1b = op1.Prev;
            while ((op1b.Pt == op1.Pt) && (op1b != op1)) op1b = op1b.Prev;
            if ((op1b.Pt.Y > op1.Pt.Y) ||
              !SlopesEqual(op1.Pt, op1b.Pt, j.OffPt, m_UseFullRange)) return false;
          };
          op2b = op2.Next;
          while ((op2b.Pt == op2.Pt) && (op2b != op2)) op2b = op2b.Next;
          bool Reverse2 = ((op2b.Pt.Y > op2.Pt.Y) ||
            !SlopesEqual(op2.Pt, op2b.Pt, j.OffPt, m_UseFullRange));
          if (Reverse2)
          {
            op2b = op2.Prev;
            while ((op2b.Pt == op2.Pt) && (op2b != op2)) op2b = op2b.Prev;
            if ((op2b.Pt.Y > op2.Pt.Y) ||
              !SlopesEqual(op2.Pt, op2b.Pt, j.OffPt, m_UseFullRange)) return false;
          }

          if ((op1b == op1) || (op2b == op2) || (op1b == op2b) ||
            ((outRec1 == outRec2) && (Reverse1 == Reverse2))) return false;

          if (Reverse1)
          {
            op1b = DupOutPt(op1, false);
            op2b = DupOutPt(op2, true);
            op1.Prev = op2;
            op2.Next = op1;
            op1b.Next = op2b;
            op2b.Prev = op1b;
            j.OutPt1 = op1;
            j.OutPt2 = op1b;
            return true;
          } else
          {
            op1b = DupOutPt(op1, true);
            op2b = DupOutPt(op2, false);
            op1.Next = op2;
            op2.Prev = op1;
            op1b.Prev = op2b;
            op2b.Next = op1b;
            j.OutPt1 = op1;
            j.OutPt2 = op1b;
            return true;
          }
        }
      }
      //----------------------------------------------------------------------

      public static int PointInPolygon(IntPoint pt, Path path)
      {
        //returns 0 if false, +1 if true, -1 if pt ON polygon boundary
        //See "The Point in Polygon Problem for Arbitrary Polygons" by Hormann & Agathos
        //http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.88.5498&rep=rep1&type=pdf
        int result = 0, cnt = path.Count;
        if (cnt < 3) return 0;
        IntPoint ip = path[0];
        for (int i = 1; i <= cnt; ++i)
        {
          IntPoint ipNext = (i == cnt ? path[0] : path[i]);
          if (ipNext.Y == pt.Y)
          {
            if ((ipNext.X == pt.X) || (ip.Y == pt.Y &&
              ((ipNext.X > pt.X) == (ip.X < pt.X)))) return -1;
          }
          if ((ip.Y < pt.Y) != (ipNext.Y < pt.Y))
          {
            if (ip.X >= pt.X)
            {
              if (ipNext.X > pt.X) result = 1 - result;
              else
              {
                double d = (double)(ip.X - pt.X) * (ipNext.Y - pt.Y) -
                  (double)(ipNext.X - pt.X) * (ip.Y - pt.Y);
                if (d == 0) return -1;
                else if ((d > 0) == (ipNext.Y > ip.Y)) result = 1 - result;
              }
            }
            else
            {
              if (ipNext.X > pt.X)
              {
                double d = (double)(ip.X - pt.X) * (ipNext.Y - pt.Y) -
                  (double)(ipNext.X - pt.X) * (ip.Y - pt.Y);
                if (d == 0) return -1;
                else if ((d > 0) == (ipNext.Y > ip.Y)) result = 1 - result;
              }
            }
          }
          ip = ipNext;
        }
        return result;
      }
      

      //See "The Point in Polygon Problem for Arbitrary Polygons" by Hormann & Agathos
      //http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.88.5498&rep=rep1&type=pdf
      private static int PointInPolygon(IntPoint pt, OutPt op)
      {
        //returns 0 if false, +1 if true, -1 if pt ON polygon boundary
        int result = 0;
        OutPt startOp = op;
        cInt ptx = pt.X, pty = pt.Y;
        cInt poly0x = op.Pt.X, poly0y = op.Pt.Y;
        do
        {
          op = op.Next;
          cInt poly1x = op.Pt.X, poly1y = op.Pt.Y;

          if (poly1y == pty)
          {
            if ((poly1x == ptx) || (poly0y == pty &&
              ((poly1x > ptx) == (poly0x < ptx)))) return -1;
          }
          if ((poly0y < pty) != (poly1y < pty))
          {
            if (poly0x >= ptx)
            {
              if (poly1x > ptx) result = 1 - result;
              else
              {
                double d = (double)(poly0x - ptx) * (poly1y - pty) -
                  (double)(poly1x - ptx) * (poly0y - pty);
                if (d == 0) return -1;
                if ((d > 0) == (poly1y > poly0y)) result = 1 - result;
              }
            }
            else
            {
              if (poly1x > ptx)
              {
                double d = (double)(poly0x - ptx) * (poly1y - pty) -
                  (double)(poly1x - ptx) * (poly0y - pty);
                if (d == 0) return -1;
                if ((d > 0) == (poly1y > poly0y)) result = 1 - result;
              }
            }
          }
          poly0x = poly1x; poly0y = poly1y;
        } while (startOp != op);
        return result;
      }
      

      private static bool Poly2ContainsPoly1(OutPt outPt1, OutPt outPt2)
      {
        OutPt op = outPt1;
        do
        {
          //nb: PointInPolygon returns 0 if false, +1 if true, -1 if pt on polygon
          int res = PointInPolygon(op.Pt, outPt2);
          if (res >= 0) return res > 0;
          op = op.Next;
        }
        while (op != outPt1);
        return true;
      }
      //----------------------------------------------------------------------

      private void FixupFirstLefts1(OutRec OldOutRec, OutRec NewOutRec)
      { 
        foreach (OutRec outRec in m_PolyOuts)
        {
          OutRec firstLeft = ParseFirstLeft(outRec.FirstLeft);
          if (outRec.Pts != null && firstLeft == OldOutRec)
          {
            if (Poly2ContainsPoly1(outRec.Pts, NewOutRec.Pts))
                outRec.FirstLeft = NewOutRec;
          }
        }
      }
      //----------------------------------------------------------------------

      private void FixupFirstLefts2(OutRec innerOutRec, OutRec outerOutRec)
      {
        //A polygon has split into two such that one is now the inner of the other.
        //It's possible that these polygons now wrap around other polygons, so check
        //every polygon that's also contained by OuterOutRec's FirstLeft container
        //(including nil) to see if they've become inner to the new inner polygon ...
        OutRec orfl = outerOutRec.FirstLeft;
        foreach (OutRec outRec in m_PolyOuts)
        {
          if (outRec.Pts == null || outRec == outerOutRec || outRec == innerOutRec) 
            continue;
          OutRec firstLeft = ParseFirstLeft(outRec.FirstLeft);
          if (firstLeft != orfl && firstLeft != innerOutRec && firstLeft != outerOutRec) 
            continue;
          if (Poly2ContainsPoly1(outRec.Pts, innerOutRec.Pts))
            outRec.FirstLeft = innerOutRec;
          else if (Poly2ContainsPoly1(outRec.Pts, outerOutRec.Pts))
            outRec.FirstLeft = outerOutRec;
          else if (outRec.FirstLeft == innerOutRec || outRec.FirstLeft == outerOutRec) 
            outRec.FirstLeft = orfl;
        }
      }
      //----------------------------------------------------------------------

      private void FixupFirstLefts3(OutRec OldOutRec, OutRec NewOutRec)
      {
        //same as FixupFirstLefts1 but doesn't call Poly2ContainsPoly1()
        foreach (OutRec outRec in m_PolyOuts)
        {
          OutRec firstLeft = ParseFirstLeft(outRec.FirstLeft);
          if (outRec.Pts != null && firstLeft == OldOutRec) 
            outRec.FirstLeft = NewOutRec;
        }
      }
      //----------------------------------------------------------------------

      private static OutRec ParseFirstLeft(OutRec FirstLeft)
      {
        while (FirstLeft != null && FirstLeft.Pts == null) 
          FirstLeft = FirstLeft.FirstLeft;
        return FirstLeft;
      }
      

    private void JoinCommonEdges()
      {
        for (int i = 0; i < m_Joins.Count; i++)
        {
          Join join = m_Joins[i];

          OutRec outRec1 = GetOutRec(join.OutPt1.Idx);
          OutRec outRec2 = GetOutRec(join.OutPt2.Idx);

          if (outRec1.Pts == null || outRec2.Pts == null) continue;
          if (outRec1.IsOpen || outRec2.IsOpen) continue;

          //get the polygon fragment with the correct hole state (FirstLeft)
          //before calling JoinPoints() ...
          OutRec holeStateRec;
          if (outRec1 == outRec2) holeStateRec = outRec1;
          else if (OutRec1RightOfOutRec2(outRec1, outRec2)) holeStateRec = outRec2;
          else if (OutRec1RightOfOutRec2(outRec2, outRec1)) holeStateRec = outRec1;
          else holeStateRec = GetLowermostRec(outRec1, outRec2);

          if (!JoinPoints(join, outRec1, outRec2)) continue;

          if (outRec1 == outRec2)
          {
            //instead of joining two polygons, we've just created a new one by
            //splitting one polygon into two.
            outRec1.Pts = join.OutPt1;
            outRec1.BottomPt = null;
            outRec2 = CreateOutRec();
            outRec2.Pts = join.OutPt2;

            //update all OutRec2.Pts Idx's ...
            UpdateOutPtIdxs(outRec2);

            if (Poly2ContainsPoly1(outRec2.Pts, outRec1.Pts))
            {
              //outRec1 contains outRec2 ...
              outRec2.IsHole = !outRec1.IsHole;
              outRec2.FirstLeft = outRec1;

              if (m_UsingPolyTree) FixupFirstLefts2(outRec2, outRec1);

              if ((outRec2.IsHole ^ ReverseSolution) == (Area(outRec2) > 0))
                ReversePolyPtLinks(outRec2.Pts);

            }
            else if (Poly2ContainsPoly1(outRec1.Pts, outRec2.Pts))
            {
              //outRec2 contains outRec1 ...
              outRec2.IsHole = outRec1.IsHole;
              outRec1.IsHole = !outRec2.IsHole;
              outRec2.FirstLeft = outRec1.FirstLeft;
              outRec1.FirstLeft = outRec2;

              if (m_UsingPolyTree) FixupFirstLefts2(outRec1, outRec2);

              if ((outRec1.IsHole ^ ReverseSolution) == (Area(outRec1) > 0))
                ReversePolyPtLinks(outRec1.Pts);
            }
            else
            {
              //the 2 polygons are completely separate ...
              outRec2.IsHole = outRec1.IsHole;
              outRec2.FirstLeft = outRec1.FirstLeft;

              //fixup FirstLeft pointers that may need reassigning to OutRec2
              if (m_UsingPolyTree) FixupFirstLefts1(outRec1, outRec2);
            }
     
          } else
          {
            //joined 2 polygons together ...

            outRec2.Pts = null;
            outRec2.BottomPt = null;
            outRec2.Idx = outRec1.Idx;

            outRec1.IsHole = holeStateRec.IsHole;
            if (holeStateRec == outRec2) 
              outRec1.FirstLeft = outRec2.FirstLeft;
            outRec2.FirstLeft = outRec1;

            //fixup FirstLeft pointers that may need reassigning to OutRec1
            if (m_UsingPolyTree) FixupFirstLefts3(outRec2, outRec1);
          }
        }
      }
      

      private void UpdateOutPtIdxs(OutRec outrec)
      {  
        OutPt op = outrec.Pts;
        do
        {
          op.Idx = outrec.Idx;
          op = op.Prev;
        }
        while(op != outrec.Pts);
      }
      

      private void DoSimplePolygons()
      {
        int i = 0;
        while (i < m_PolyOuts.Count) 
        {
          OutRec outrec = m_PolyOuts[i++];
          OutPt op = outrec.Pts;
          if (op == null || outrec.IsOpen) continue;
          do //for each Pt in Polygon until duplicate found do ...
          {
            OutPt op2 = op.Next;
            while (op2 != outrec.Pts) 
            {
              if ((op.Pt == op2.Pt) && op2.Next != op && op2.Prev != op) 
              {
                //split the polygon into two ...
                OutPt op3 = op.Prev;
                OutPt op4 = op2.Prev;
                op.Prev = op4;
                op4.Next = op;
                op2.Prev = op3;
                op3.Next = op2;

                outrec.Pts = op;
                OutRec outrec2 = CreateOutRec();
                outrec2.Pts = op2;
                UpdateOutPtIdxs(outrec2);
                if (Poly2ContainsPoly1(outrec2.Pts, outrec.Pts))
                {
                  //OutRec2 is contained by OutRec1 ...
                  outrec2.IsHole = !outrec.IsHole;
                  outrec2.FirstLeft = outrec;
                  if (m_UsingPolyTree) FixupFirstLefts2(outrec2, outrec);
                }
                else
                  if (Poly2ContainsPoly1(outrec.Pts, outrec2.Pts))
                {
                  //OutRec1 is contained by OutRec2 ...
                  outrec2.IsHole = outrec.IsHole;
                  outrec.IsHole = !outrec2.IsHole;
                  outrec2.FirstLeft = outrec.FirstLeft;
                  outrec.FirstLeft = outrec2;
                  if (m_UsingPolyTree) FixupFirstLefts2(outrec, outrec2);
                }
                  else
                {
                  //the 2 polygons are separate ...
                  outrec2.IsHole = outrec.IsHole;
                  outrec2.FirstLeft = outrec.FirstLeft;
                  if (m_UsingPolyTree) FixupFirstLefts1(outrec, outrec2);
                }
                op2 = op; //ie get ready for the next iteration
              }
              op2 = op2.Next;
            }
            op = op.Next;
          }
          while (op != outrec.Pts);
        }
      }
      

      public static double Area(Path poly)
      {
        int cnt = (int)poly.Count;
        if (cnt < 3) return 0;
        double a = 0;
        for (int i = 0, j = cnt - 1; i < cnt; ++i)
        {
          a += ((double)poly[j].X + poly[i].X) * ((double)poly[j].Y - poly[i].Y);
          j = i;
        }
        return -a * 0.5;
      }
      

      internal double Area(OutRec outRec)
      {
        return Area(outRec.Pts);
      }
      

      internal double Area(OutPt op)
      {
        OutPt opFirst = op;
        if (op == null) return 0;
        double a = 0;
        do {
          a = a + (double)(op.Prev.Pt.X + op.Pt.X) * (double)(op.Prev.Pt.Y - op.Pt.Y);
          op = op.Next;
        } while (op != opFirst);
        return a * 0.5;
      }

      
      // SimplifyPolygon functions ...
      // Convert self-intersecting polygons into simple polygons
      

      public static Paths SimplifyPolygon(Path poly, 
            PolyFillType fillType = PolyFillType.pftEvenOdd)
      {
          Paths result = new Paths();
          Clipper c = new Clipper();
          c.StrictlySimple = true;
          c.AddPath(poly, PolyType.ptSubject, true);
          c.Execute(ClipType.ctUnion, result, fillType, fillType);
          return result;
      }
      

      public static Paths SimplifyPolygons(Paths polys,
          PolyFillType fillType = PolyFillType.pftEvenOdd)
      {
          Paths result = new Paths();
          Clipper c = new Clipper();
          c.StrictlySimple = true;
          c.AddPaths(polys, PolyType.ptSubject, true);
          c.Execute(ClipType.ctUnion, result, fillType, fillType);
          return result;
      }
      

      private static double DistanceSqrd(IntPoint pt1, IntPoint pt2)
      {
        double dx = ((double)pt1.X - pt2.X);
        double dy = ((double)pt1.Y - pt2.Y);
        return (dx*dx + dy*dy);
      }
      

      private static double DistanceFromLineSqrd(IntPoint pt, IntPoint ln1, IntPoint ln2)
      {
        //The equation of a line in general form (Ax + By + C = 0)
        //given 2 points (x¹,y¹) & (x²,y²) is ...
        //(y¹ - y²)x + (x² - x¹)y + (y² - y¹)x¹ - (x² - x¹)y¹ = 0
        //A = (y¹ - y²); B = (x² - x¹); C = (y² - y¹)x¹ - (x² - x¹)y¹
        //perpendicular distance of point (x³,y³) = (Ax³ + By³ + C)/Sqrt(A² + B²)
        //see http://en.wikipedia.org/wiki/Perpendicular_distance
        double A = ln1.Y - ln2.Y;
        double B = ln2.X - ln1.X;
        double C = A * ln1.X  + B * ln1.Y;
        C = A * pt.X + B * pt.Y - C;
        return (C * C) / (A * A + B * B);
      }
      //---------------------------------------------------------------------------

      private static bool SlopesNearCollinear(IntPoint pt1, 
          IntPoint pt2, IntPoint pt3, double distSqrd)
      {
        //this function is more accurate when the point that's GEOMETRICALLY 
        //between the other 2 points is the one that's tested for distance.  
        //nb: with 'spikes', either pt1 or pt3 is geometrically between the other pts                    
        if (Math.Abs(pt1.X - pt2.X) > Math.Abs(pt1.Y - pt2.Y))
	      {
          if ((pt1.X > pt2.X) == (pt1.X < pt3.X))
            return DistanceFromLineSqrd(pt1, pt2, pt3) < distSqrd;
          else if ((pt2.X > pt1.X) == (pt2.X < pt3.X))
            return DistanceFromLineSqrd(pt2, pt1, pt3) < distSqrd;
		      else
	          return DistanceFromLineSqrd(pt3, pt1, pt2) < distSqrd;
	      }
	      else
	      {
          if ((pt1.Y > pt2.Y) == (pt1.Y < pt3.Y))
            return DistanceFromLineSqrd(pt1, pt2, pt3) < distSqrd;
          else if ((pt2.Y > pt1.Y) == (pt2.Y < pt3.Y))
            return DistanceFromLineSqrd(pt2, pt1, pt3) < distSqrd;
		      else
            return DistanceFromLineSqrd(pt3, pt1, pt2) < distSqrd;
	      }
      }
      

      private static bool PointsAreClose(IntPoint pt1, IntPoint pt2, double distSqrd)
      {
          double dx = (double)pt1.X - pt2.X;
          double dy = (double)pt1.Y - pt2.Y;
          return ((dx * dx) + (dy * dy) <= distSqrd);
      }
      

      private static OutPt ExcludeOp(OutPt op)
      {
        OutPt result = op.Prev;
        result.Next = op.Next;
        op.Next.Prev = result;
        result.Idx = 0;
        return result;
      }
      

      public static Path CleanPolygon(Path path, double distance = 1.415)
      {
        //distance = proximity in units/pixels below which vertices will be stripped. 
        //Default ~= sqrt(2) so when adjacent vertices or semi-adjacent vertices have 
        //both x & y coords within 1 unit, then the second vertex will be stripped.

        int cnt = path.Count;

        if (cnt == 0) return new Path();

        OutPt [] outPts = new OutPt[cnt];
        for (int i = 0; i < cnt; ++i) outPts[i] = new OutPt();

        for (int i = 0; i < cnt; ++i)
        {
          outPts[i].Pt = path[i];
          outPts[i].Next = outPts[(i + 1) % cnt];
          outPts[i].Next.Prev = outPts[i];
          outPts[i].Idx = 0;
        }

        double distSqrd = distance * distance;
        OutPt op = outPts[0];
        while (op.Idx == 0 && op.Next != op.Prev)
        {
          if (PointsAreClose(op.Pt, op.Prev.Pt, distSqrd))
          {
            op = ExcludeOp(op);
            cnt--;
          }
          else if (PointsAreClose(op.Prev.Pt, op.Next.Pt, distSqrd))
          {
            ExcludeOp(op.Next);
            op = ExcludeOp(op);
            cnt -= 2;
          }
          else if (SlopesNearCollinear(op.Prev.Pt, op.Pt, op.Next.Pt, distSqrd))
          {
            op = ExcludeOp(op);
            cnt--;
          }
          else
          {
            op.Idx = 1;
            op = op.Next;
          }
        }

        if (cnt < 3) cnt = 0;
        Path result = new Path(cnt);
        for (int i = 0; i < cnt; ++i)
        {
          result.Add(op.Pt);
          op = op.Next;
        }
        outPts = null;
        return result;
      }
      

      public static Paths CleanPolygons(Paths polys,
          double distance = 1.415)
      {
        Paths result = new Paths(polys.Count);
        for (int i = 0; i < polys.Count; i++)
          result.Add(CleanPolygon(polys[i], distance));
        return result;
      }
      

      internal static Paths Minkowski(Path pattern, Path path, bool IsSum, bool IsClosed)
      {
        int delta = (IsClosed ? 1 : 0);
        int polyCnt = pattern.Count;
        int pathCnt = path.Count;
        Paths result = new Paths(pathCnt);
        if (IsSum)
          for (int i = 0; i < pathCnt; i++)
          {
            Path p = new Path(polyCnt);
            foreach (IntPoint ip in pattern)
              p.Add(new IntPoint(path[i].X + ip.X, path[i].Y + ip.Y));
            result.Add(p);
          }
        else
          for (int i = 0; i < pathCnt; i++)
          {
            Path p = new Path(polyCnt);
            foreach (IntPoint ip in pattern)
              p.Add(new IntPoint(path[i].X - ip.X, path[i].Y - ip.Y));
            result.Add(p);
          }

        Paths quads = new Paths((pathCnt + delta) * (polyCnt + 1));
        for (int i = 0; i < pathCnt - 1 + delta; i++)
          for (int j = 0; j < polyCnt; j++)
          {
            Path quad = new Path(4);
            quad.Add(result[i % pathCnt][j % polyCnt]);
            quad.Add(result[(i + 1) % pathCnt][j % polyCnt]);
            quad.Add(result[(i + 1) % pathCnt][(j + 1) % polyCnt]);
            quad.Add(result[i % pathCnt][(j + 1) % polyCnt]);
            if (!Orientation(quad)) quad.Reverse();
            quads.Add(quad);
          }
        return quads;
      }
      

      public static Paths MinkowskiSum(Path pattern, Path path, bool pathIsClosed)
      {
        Paths paths = Minkowski(pattern, path, true, pathIsClosed);
        Clipper c = new Clipper();
        c.AddPaths(paths, PolyType.ptSubject, true);
        c.Execute(ClipType.ctUnion, paths, PolyFillType.pftNonZero, PolyFillType.pftNonZero);
        return paths;
      }
      

      private static Path TranslatePath(Path path, IntPoint delta) 
      {
        Path outPath = new Path(path.Count);
        for (int i = 0; i < path.Count; i++)
          outPath.Add(new IntPoint(path[i].X + delta.X, path[i].Y + delta.Y));
        return outPath;
      }
      

      public static Paths MinkowskiSum(Path pattern, Paths paths, bool pathIsClosed)
      {
        Paths solution = new Paths();
        Clipper c = new Clipper();
        for (int i = 0; i < paths.Count; ++i)
        {
          Paths tmp = Minkowski(pattern, paths[i], true, pathIsClosed);
          c.AddPaths(tmp, PolyType.ptSubject, true);
          if (pathIsClosed)
          {
            Path path = TranslatePath(paths[i], pattern[0]);
            c.AddPath(path, PolyType.ptClip, true);
          }
        }
        c.Execute(ClipType.ctUnion, solution, 
          PolyFillType.pftNonZero, PolyFillType.pftNonZero);
        return solution;
      }
      

      public static Paths MinkowskiDiff(Path poly1, Path poly2)
      {
        Paths paths = Minkowski(poly1, poly2, false, true);
        Clipper c = new Clipper();
        c.AddPaths(paths, PolyType.ptSubject, true);
        c.Execute(ClipType.ctUnion, paths, PolyFillType.pftNonZero, PolyFillType.pftNonZero);
        return paths;
      }
      

      internal enum NodeType { ntAny, ntOpen, ntClosed };

      public static Paths PolyTreeToPaths(PolyTree polytree)
      {

        Paths result = new Paths();
        result.Capacity = polytree.Total;
        AddPolyNodeToPaths(polytree, NodeType.ntAny, result);
        return result;
      }
      

      internal static void AddPolyNodeToPaths(PolyNode polynode, NodeType nt, Paths paths)
      {
        bool match = true;
        switch (nt)
        {
          case NodeType.ntOpen: return;
          case NodeType.ntClosed: match = !polynode.IsOpen; break;
          default: break;
        }

        if (polynode.m_polygon.Count > 0 && match)
          paths.Add(polynode.m_polygon);
        foreach (PolyNode pn in polynode.Childs)
          AddPolyNodeToPaths(pn, nt, paths);
      }
      

      public static Paths OpenPathsFromPolyTree(PolyTree polytree)
      {
        Paths result = new Paths();
        result.Capacity = polytree.ChildCount;
        for (int i = 0; i < polytree.ChildCount; i++)
          if (polytree.Childs[i].IsOpen)
            result.Add(polytree.Childs[i].m_polygon);
        return result;
      }
      

      public static Paths ClosedPathsFromPolyTree(PolyTree polytree)
      {
        Paths result = new Paths();
        result.Capacity = polytree.Total;
        AddPolyNodeToPaths(polytree, NodeType.ntClosed, result);
        return result;
      }
      

} //end Clipper

export class ClipperOffset {
    private Paths m_destPolys;
    private Path m_srcPoly;
    private Path m_destPoly;
    private List<DoublePoint> m_normals = new List<DoublePoint>();
    private double m_delta, m_sinA, m_sin, m_cos;
    private double m_miterLim, m_StepsPerRad;

    private IntPoint m_lowest;
    private PolyNode m_polyNodes = new PolyNode();

    public double ArcTolerance { get; set; }
    public double MiterLimit { get; set; }

    private const double two_pi = Math.PI * 2;
    private const double def_arc_tolerance = 0.25;

    public ClipperOffset(
      double miterLimit = 2.0, double arcTolerance = def_arc_tolerance)
    {
      MiterLimit = miterLimit;
      ArcTolerance = arcTolerance;
      m_lowest.X = -1;
    }
    

    public void Clear()
    {
      m_polyNodes.Childs.Clear();
      m_lowest.X = -1;
    }
    

    internal static cInt Round(double value)
    {
      return value < 0 ? (cInt)(value - 0.5) : (cInt)(value + 0.5);
    }
    

    public void AddPath(Path path, JoinType joinType, EndType endType)
    {
      int highI = path.Count - 1;
      if (highI < 0) return;
      PolyNode newNode = new PolyNode();
      newNode.m_jointype = joinType;
      newNode.m_endtype = endType;

      //strip duplicate points from path and also get index to the lowest point ...
      if (endType == EndType.etClosedLine || endType == EndType.etClosedPolygon)
        while (highI > 0 && path[0] == path[highI]) highI--;
      newNode.m_polygon.Capacity = highI + 1;
      newNode.m_polygon.Add(path[0]);
      int j = 0, k = 0;
      for (int i = 1; i <= highI; i++)
        if (newNode.m_polygon[j] != path[i])
        {
          j++;
          newNode.m_polygon.Add(path[i]);
          if (path[i].Y > newNode.m_polygon[k].Y ||
            (path[i].Y == newNode.m_polygon[k].Y &&
            path[i].X < newNode.m_polygon[k].X)) k = j;
        }
      if (endType == EndType.etClosedPolygon && j < 2) return;

      m_polyNodes.AddChild(newNode);

      //if this path's lowest pt is lower than all the others then update m_lowest
      if (endType != EndType.etClosedPolygon) return;
      if (m_lowest.X < 0)
        m_lowest = new IntPoint(m_polyNodes.ChildCount - 1, k);
      else
      {
        IntPoint ip = m_polyNodes.Childs[(int)m_lowest.X].m_polygon[(int)m_lowest.Y];
        if (newNode.m_polygon[k].Y > ip.Y ||
          (newNode.m_polygon[k].Y == ip.Y &&
          newNode.m_polygon[k].X < ip.X))
          m_lowest = new IntPoint(m_polyNodes.ChildCount - 1, k);
      }
    }
    

    public void AddPaths(Paths paths, JoinType joinType, EndType endType)
    {
      foreach (Path p in paths)
        AddPath(p, joinType, endType);
    }
    

    private void FixOrientations()
    {
      //fixup orientations of all closed paths if the orientation of the
      //closed path with the lowermost vertex is wrong ...
      if (m_lowest.X >= 0 && 
        !Clipper.Orientation(m_polyNodes.Childs[(int)m_lowest.X].m_polygon))
      {
        for (int i = 0; i < m_polyNodes.ChildCount; i++)
        {
          PolyNode node = m_polyNodes.Childs[i];
          if (node.m_endtype == EndType.etClosedPolygon ||
            (node.m_endtype == EndType.etClosedLine && 
            Clipper.Orientation(node.m_polygon)))
            node.m_polygon.Reverse();
        }
      }
      else
      {
        for (int i = 0; i < m_polyNodes.ChildCount; i++)
        {
          PolyNode node = m_polyNodes.Childs[i];
          if (node.m_endtype == EndType.etClosedLine &&
            !Clipper.Orientation(node.m_polygon))
          node.m_polygon.Reverse();
        }
      }
    }
    

    internal static DoublePoint GetUnitNormal(IntPoint pt1, IntPoint pt2)
    {
      double dx = (pt2.X - pt1.X);
      double dy = (pt2.Y - pt1.Y);
      if ((dx == 0) && (dy == 0)) return new DoublePoint();

      double f = 1 * 1.0 / Math.Sqrt(dx * dx + dy * dy);
      dx *= f;
      dy *= f;

      return new DoublePoint(dy, -dx);
    }
    

    private void DoOffset(double delta)
    {
      m_destPolys = new Paths();
      m_delta = delta;

      //if Zero offset, just copy any CLOSED polygons to m_p and return ...
      if (ClipperBase.near_zero(delta)) 
      {
        m_destPolys.Capacity = m_polyNodes.ChildCount;
        for (int i = 0; i < m_polyNodes.ChildCount; i++)
        {
          PolyNode node = m_polyNodes.Childs[i];
          if (node.m_endtype == EndType.etClosedPolygon)
            m_destPolys.Add(node.m_polygon);
        }
        return;
      }

      //see offset_triginometry3.svg in the documentation folder ...
      if (MiterLimit > 2) m_miterLim = 2 / (MiterLimit * MiterLimit);
      else m_miterLim = 0.5;

      double y;
      if (ArcTolerance <= 0.0) 
        y = def_arc_tolerance;
      else if (ArcTolerance > Math.Abs(delta) * def_arc_tolerance)
        y = Math.Abs(delta) * def_arc_tolerance;
      else 
        y = ArcTolerance;
      //see offset_triginometry2.svg in the documentation folder ...
      double steps = Math.PI / Math.Acos(1 - y / Math.Abs(delta));
      m_sin = Math.Sin(two_pi / steps);
      m_cos = Math.Cos(two_pi / steps);
      m_StepsPerRad = steps / two_pi;
      if (delta < 0.0) m_sin = -m_sin;

      m_destPolys.Capacity = m_polyNodes.ChildCount * 2;
      for (int i = 0; i < m_polyNodes.ChildCount; i++)
      {
        PolyNode node = m_polyNodes.Childs[i];
        m_srcPoly = node.m_polygon;

        int len = m_srcPoly.Count;

        if (len == 0 || (delta <= 0 && (len < 3 || 
          node.m_endtype != EndType.etClosedPolygon)))
            continue;

        m_destPoly = new Path();

        if (len == 1)
        {
          if (node.m_jointype == JoinType.jtRound)
          {
            double X = 1.0, Y = 0.0;
            for (int j = 1; j <= steps; j++)
            {
              m_destPoly.Add(new IntPoint(
                Round(m_srcPoly[0].X + X * delta),
                Round(m_srcPoly[0].Y + Y * delta)));
              double X2 = X;
              X = X * m_cos - m_sin * Y;
              Y = X2 * m_sin + Y * m_cos;
            }
          }
          else
          {
            double X = -1.0, Y = -1.0;
            for (int j = 0; j < 4; ++j)
            {
              m_destPoly.Add(new IntPoint(
                Round(m_srcPoly[0].X + X * delta),
                Round(m_srcPoly[0].Y + Y * delta)));
              if (X < 0) X = 1;
              else if (Y < 0) Y = 1;
              else X = -1;
            }
          }
          m_destPolys.Add(m_destPoly);
          continue;
        }

        //build m_normals ...
        m_normals.Clear();
        m_normals.Capacity = len;
        for (int j = 0; j < len - 1; j++)
          m_normals.Add(GetUnitNormal(m_srcPoly[j], m_srcPoly[j + 1]));
        if (node.m_endtype == EndType.etClosedLine || 
          node.m_endtype == EndType.etClosedPolygon)
          m_normals.Add(GetUnitNormal(m_srcPoly[len - 1], m_srcPoly[0]));
        else
          m_normals.Add(new DoublePoint(m_normals[len - 2]));

        if (node.m_endtype == EndType.etClosedPolygon)
        {
          int k = len - 1;
          for (int j = 0; j < len; j++)
            OffsetPoint(j, ref k, node.m_jointype);
          m_destPolys.Add(m_destPoly);
        }
        else if (node.m_endtype == EndType.etClosedLine)
        {
          int k = len - 1;
          for (int j = 0; j < len; j++)
            OffsetPoint(j, ref k, node.m_jointype);
          m_destPolys.Add(m_destPoly);
          m_destPoly = new Path();
          //re-build m_normals ...
          DoublePoint n = m_normals[len - 1];
          for (int j = len - 1; j > 0; j--)
            m_normals[j] = new DoublePoint(-m_normals[j - 1].X, -m_normals[j - 1].Y);
          m_normals[0] = new DoublePoint(-n.X, -n.Y);
          k = 0;
          for (int j = len - 1; j >= 0; j--)
            OffsetPoint(j, ref k, node.m_jointype);
          m_destPolys.Add(m_destPoly);
        }
        else
        {
          int k = 0;
          for (int j = 1; j < len - 1; ++j)
            OffsetPoint(j, ref k, node.m_jointype);

          IntPoint pt1;
          if (node.m_endtype == EndType.etOpenButt)
          {
            int j = len - 1;
            pt1 = new IntPoint((cInt)Round(m_srcPoly[j].X + m_normals[j].X *
              delta), (cInt)Round(m_srcPoly[j].Y + m_normals[j].Y * delta));
            m_destPoly.Add(pt1);
            pt1 = new IntPoint((cInt)Round(m_srcPoly[j].X - m_normals[j].X *
              delta), (cInt)Round(m_srcPoly[j].Y - m_normals[j].Y * delta));
            m_destPoly.Add(pt1);
          }
          else
          {
            int j = len - 1;
            k = len - 2;
            m_sinA = 0;
            m_normals[j] = new DoublePoint(-m_normals[j].X, -m_normals[j].Y);
            if (node.m_endtype == EndType.etOpenSquare)
              DoSquare(j, k);
            else
              DoRound(j, k);
          }

          //re-build m_normals ...
          for (int j = len - 1; j > 0; j--)
            m_normals[j] = new DoublePoint(-m_normals[j - 1].X, -m_normals[j - 1].Y);

          m_normals[0] = new DoublePoint(-m_normals[1].X, -m_normals[1].Y);

          k = len - 1;
          for (int j = k - 1; j > 0; --j)
            OffsetPoint(j, ref k, node.m_jointype);

          if (node.m_endtype == EndType.etOpenButt)
          {
            pt1 = new IntPoint((cInt)Round(m_srcPoly[0].X - m_normals[0].X * delta),
              (cInt)Round(m_srcPoly[0].Y - m_normals[0].Y * delta));
            m_destPoly.Add(pt1);
            pt1 = new IntPoint((cInt)Round(m_srcPoly[0].X + m_normals[0].X * delta),
              (cInt)Round(m_srcPoly[0].Y + m_normals[0].Y * delta));
            m_destPoly.Add(pt1);
          }
          else
          {
            k = 1;
            m_sinA = 0;
            if (node.m_endtype == EndType.etOpenSquare)
              DoSquare(0, 1);
            else
              DoRound(0, 1);
          }
          m_destPolys.Add(m_destPoly);
        }
      }
    }
    

    public void Execute(ref Paths solution, double delta)
    {
      solution.Clear();
      FixOrientations();
      DoOffset(delta);
      //now clean up 'corners' ...
      Clipper clpr = new Clipper();
      clpr.AddPaths(m_destPolys, PolyType.ptSubject, true);
      if (delta > 0)
      {
        clpr.Execute(ClipType.ctUnion, solution,
          PolyFillType.pftPositive, PolyFillType.pftPositive);
      }
      else
      {
        IntRect r = Clipper.GetBounds(m_destPolys);
        Path outer = new Path(4);

        outer.Add(new IntPoint(r.left - 10, r.bottom + 10));
        outer.Add(new IntPoint(r.right + 10, r.bottom + 10));
        outer.Add(new IntPoint(r.right + 10, r.top - 10));
        outer.Add(new IntPoint(r.left - 10, r.top - 10));

        clpr.AddPath(outer, PolyType.ptSubject, true);
        clpr.ReverseSolution = true;
        clpr.Execute(ClipType.ctUnion, solution, PolyFillType.pftNegative, PolyFillType.pftNegative);
        if (solution.Count > 0) solution.RemoveAt(0);
      }
    }
    

    public void Execute(ref PolyTree solution, double delta)
    {
      solution.Clear();
      FixOrientations();
      DoOffset(delta);

      //now clean up 'corners' ...
      Clipper clpr = new Clipper();
      clpr.AddPaths(m_destPolys, PolyType.ptSubject, true);
      if (delta > 0)
      {
        clpr.Execute(ClipType.ctUnion, solution,
          PolyFillType.pftPositive, PolyFillType.pftPositive);
      }
      else
      {
        IntRect r = Clipper.GetBounds(m_destPolys);
        Path outer = new Path(4);

        outer.Add(new IntPoint(r.left - 10, r.bottom + 10));
        outer.Add(new IntPoint(r.right + 10, r.bottom + 10));
        outer.Add(new IntPoint(r.right + 10, r.top - 10));
        outer.Add(new IntPoint(r.left - 10, r.top - 10));

        clpr.AddPath(outer, PolyType.ptSubject, true);
        clpr.ReverseSolution = true;
        clpr.Execute(ClipType.ctUnion, solution, PolyFillType.pftNegative, PolyFillType.pftNegative);
        //remove the outer PolyNode rectangle ...
        if (solution.ChildCount == 1 && solution.Childs[0].ChildCount > 0)
        {
          PolyNode outerNode = solution.Childs[0];
          solution.Childs.Capacity = outerNode.ChildCount;
          solution.Childs[0] = outerNode.Childs[0];
          solution.Childs[0].m_Parent = solution;
          for (int i = 1; i < outerNode.ChildCount; i++)
            solution.AddChild(outerNode.Childs[i]);
        }
        else
          solution.Clear();
      }
    }
    

    void OffsetPoint(int j, ref int k, JoinType jointype)
    {
      //cross product ...
      m_sinA = (m_normals[k].X * m_normals[j].Y - m_normals[j].X * m_normals[k].Y);

      if (Math.Abs(m_sinA * m_delta) < 1.0) 
      {
        //dot product ...
        double cosA = (m_normals[k].X * m_normals[j].X + m_normals[j].Y * m_normals[k].Y); 
        if (cosA > 0) // angle ==> 0 degrees
        {
          m_destPoly.Add(new IntPoint(Round(m_srcPoly[j].X + m_normals[k].X * m_delta),
            Round(m_srcPoly[j].Y + m_normals[k].Y * m_delta)));
          return; 
        }
        //else angle ==> 180 degrees   
      }
      else if (m_sinA > 1.0) m_sinA = 1.0;
      else if (m_sinA < -1.0) m_sinA = -1.0;
      
      if (m_sinA * m_delta < 0)
      {
        m_destPoly.Add(new IntPoint(Round(m_srcPoly[j].X + m_normals[k].X * m_delta),
          Round(m_srcPoly[j].Y + m_normals[k].Y * m_delta)));
        m_destPoly.Add(m_srcPoly[j]);
        m_destPoly.Add(new IntPoint(Round(m_srcPoly[j].X + m_normals[j].X * m_delta),
          Round(m_srcPoly[j].Y + m_normals[j].Y * m_delta)));
      }
      else
        switch (jointype)
        {
          case JoinType.jtMiter:
            {
              double r = 1 + (m_normals[j].X * m_normals[k].X +
                m_normals[j].Y * m_normals[k].Y);
              if (r >= m_miterLim) DoMiter(j, k, r); else DoSquare(j, k);
              break;
            }
          case JoinType.jtSquare: DoSquare(j, k); break;
          case JoinType.jtRound: DoRound(j, k); break;
        }
      k = j;
    }
    

    internal void DoSquare(int j, int k)
    {
      double dx = Math.Tan(Math.Atan2(m_sinA,
          m_normals[k].X * m_normals[j].X + m_normals[k].Y * m_normals[j].Y) / 4);
      m_destPoly.Add(new IntPoint(
          Round(m_srcPoly[j].X + m_delta * (m_normals[k].X - m_normals[k].Y * dx)),
          Round(m_srcPoly[j].Y + m_delta * (m_normals[k].Y + m_normals[k].X * dx))));
      m_destPoly.Add(new IntPoint(
          Round(m_srcPoly[j].X + m_delta * (m_normals[j].X + m_normals[j].Y * dx)),
          Round(m_srcPoly[j].Y + m_delta * (m_normals[j].Y - m_normals[j].X * dx))));
    }
    

    internal void DoMiter(int j, int k, double r)
    {
      double q = m_delta / r;
      m_destPoly.Add(new IntPoint(Round(m_srcPoly[j].X + (m_normals[k].X + m_normals[j].X) * q),
          Round(m_srcPoly[j].Y + (m_normals[k].Y + m_normals[j].Y) * q)));
    }
    

    internal void DoRound(int j, int k)
    {
      double a = Math.Atan2(m_sinA,
      m_normals[k].X * m_normals[j].X + m_normals[k].Y * m_normals[j].Y);
      int steps = Math.Max((int)Round(m_StepsPerRad * Math.Abs(a)),1);

      double X = m_normals[k].X, Y = m_normals[k].Y, X2;
      for (int i = 0; i < steps; ++i)
      {
        m_destPoly.Add(new IntPoint(
            Round(m_srcPoly[j].X + X * m_delta),
            Round(m_srcPoly[j].Y + Y * m_delta)));
        X2 = X;
        X = X * m_cos - m_sin * Y;
        Y = X2 * m_sin + Y * m_cos;
      }
      m_destPoly.Add(new IntPoint(
      Round(m_srcPoly[j].X + m_normals[j].X * m_delta),
      Round(m_srcPoly[j].Y + m_normals[j].Y * m_delta)));
    }
    
} // end ClipperOffset