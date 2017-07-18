import {Int64, Int128} from "./intMath/int64";

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

class PolyNode {
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

class PolyTree extends PolyNode {
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

class ClipperBase {
    m_MinimaList:LocalMinima;
    m_CurrentLM:LocalMinima;
    m_edges:TEdge[][] = [];
    m_Scanbeam:Scanbeam;
    m_PolyOuts:OutRec[];
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

    private TEdge ProcessBound(TEdge E, bool LeftBoundIsForward)
    {
      TEdge EStart, Result = E;
      TEdge Horz;

      if (Result.OutIdx == Skip)
      {
        //check if there are edges beyond the skip edge in the bound and if so
        //create another LocMin and calling ProcessBound once more ...
        E = Result;
        if (LeftBoundIsForward)
        {
          while (E.Top.Y == E.Next.Bot.Y) E = E.Next;
          while (E != Result && E.Dx == horizontal) E = E.Prev;
        }
        else
        {
          while (E.Top.Y == E.Prev.Bot.Y) E = E.Prev;
          while (E != Result && E.Dx == horizontal) E = E.Next;
        }
        if (E == Result)
        {
          if (LeftBoundIsForward) Result = E.Next;
          else Result = E.Prev;
        }
        else
        {
          //there are more edges in the bound beyond result starting with E
          if (LeftBoundIsForward)
            E = Result.Next;
          else
            E = Result.Prev;
          LocalMinima locMin = new LocalMinima();
          locMin.Next = null;
          locMin.Y = E.Bot.Y;
          locMin.LeftBound = null;
          locMin.RightBound = E;
          E.WindDelta = 0;
          Result = ProcessBound(E, LeftBoundIsForward);
          InsertLocalMinima(locMin);
        }
        return Result;
      }

      if (E.Dx == horizontal)
      {
        //We need to be careful with open paths because this may not be a
        //true local minima (ie E may be following a skip edge).
        //Also, consecutive horz. edges may start heading left before going right.
        if (LeftBoundIsForward) EStart = E.Prev;
        else EStart = E.Next;
        if (EStart.Dx == horizontal) //ie an adjoining horizontal skip edge
        {
        if (EStart.Bot.X != E.Bot.X && EStart.Top.X != E.Bot.X)
            ReverseHorizontal(E);
        }
        else if (EStart.Bot.X != E.Bot.X)
        ReverseHorizontal(E);
      }

      EStart = E;
      if (LeftBoundIsForward)
      {
        while (Result.Top.Y == Result.Next.Bot.Y && Result.Next.OutIdx != Skip)
          Result = Result.Next;
        if (Result.Dx == horizontal && Result.Next.OutIdx != Skip)
        {
          //nb: at the top of a bound, horizontals are added to the bound
          //only when the preceding edge attaches to the horizontal's left vertex
          //unless a Skip edge is encountered when that becomes the top divide
          Horz = Result;
          while (Horz.Prev.Dx == horizontal) Horz = Horz.Prev;
          if (Horz.Prev.Top.X > Result.Next.Top.X) Result = Horz.Prev;
        }
        while (E != Result)
        {
          E.NextInLML = E.Next;
          if (E.Dx == horizontal && E != EStart && E.Bot.X != E.Prev.Top.X) 
            ReverseHorizontal(E);
          E = E.Next;
        }
        if (E.Dx == horizontal && E != EStart && E.Bot.X != E.Prev.Top.X) 
          ReverseHorizontal(E);
        Result = Result.Next; //move to the edge just beyond current bound
      }
      else
      {
        while (Result.Top.Y == Result.Prev.Bot.Y && Result.Prev.OutIdx != Skip)
          Result = Result.Prev;
        if (Result.Dx == horizontal && Result.Prev.OutIdx != Skip)
        {
          Horz = Result;
          while (Horz.Next.Dx == horizontal) Horz = Horz.Next;
          if (Horz.Next.Top.X == Result.Prev.Top.X || 
              Horz.Next.Top.X > Result.Prev.Top.X) Result = Horz.Next;
        }

        while (E != Result)
        {
          E.NextInLML = E.Prev;
          if (E.Dx == horizontal && E != EStart && E.Bot.X != E.Next.Top.X) 
            ReverseHorizontal(E);
          E = E.Prev;
        }
        if (E.Dx == horizontal && E != EStart && E.Bot.X != E.Next.Top.X) 
          ReverseHorizontal(E);
        Result = Result.Prev; //move to the edge just beyond current bound
      }
      return Result;
    }
    //------------------------------------------------------------------------------


    public bool AddPath(Path pg, PolyType polyType, bool Closed)
    {
#if use_lines
      if (!Closed && polyType == PolyType.ptClip)
        throw new ClipperException("AddPath: Open paths must be subject.");
#else
      if (!Closed)
        throw new ClipperException("AddPath: Open paths have been disabled.");
#endif

      int highI = (int)pg.Count - 1;
      if (Closed) while (highI > 0 && (pg[highI] == pg[0])) --highI;
      while (highI > 0 && (pg[highI] == pg[highI - 1])) --highI;
      if ((Closed && highI < 2) || (!Closed && highI < 1)) return false;

      //create a new edge array ...
      List<TEdge> edges = new List<TEdge>(highI+1);
      for (int i = 0; i <= highI; i++) edges.Add(new TEdge());
          
      bool IsFlat = true;

      //1. Basic (first) edge initialization ...
      edges[1].Curr = pg[1];
      RangeTest(pg[0], ref m_UseFullRange);
      RangeTest(pg[highI], ref m_UseFullRange);
      InitEdge(edges[0], edges[1], edges[highI], pg[0]);
      InitEdge(edges[highI], edges[0], edges[highI - 1], pg[highI]);
      for (int i = highI - 1; i >= 1; --i)
      {
        RangeTest(pg[i], ref m_UseFullRange);
        InitEdge(edges[i], edges[i + 1], edges[i - 1], pg[i]);
      }
      TEdge eStart = edges[0];

      //2. Remove duplicate vertices, and (when closed) collinear edges ...
      TEdge E = eStart, eLoopStop = eStart;
      for (;;)
      {
        //nb: allows matching start and end points when not Closed ...
        if (E.Curr == E.Next.Curr && (Closed || E.Next != eStart))
        {
          if (E == E.Next) break;
          if (E == eStart) eStart = E.Next;
          E = RemoveEdge(E);
          eLoopStop = E;
          continue;
        }
        if (E.Prev == E.Next) 
          break; //only two vertices
        else if (Closed &&
          SlopesEqual(E.Prev.Curr, E.Curr, E.Next.Curr, m_UseFullRange) && 
          (!PreserveCollinear ||
          !Pt2IsBetweenPt1AndPt3(E.Prev.Curr, E.Curr, E.Next.Curr))) 
        {
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

      if ((!Closed && (E == E.Next)) || (Closed && (E.Prev == E.Next)))
        return false;

      if (!Closed)
      {
        m_HasOpenPaths = true;
        eStart.Prev.OutIdx = Skip;
      }

      //3. Do second stage of edge initialization ...
      E = eStart;
      do
      {
        InitEdge2(E, polyType);
        E = E.Next;
        if (IsFlat && E.Curr.Y != eStart.Curr.Y) IsFlat = false;
      }
      while (E != eStart);

      //4. Finally, add edge bounds to LocalMinima list ...

      //Totally flat paths must be handled differently when adding them
      //to LocalMinima list to avoid endless loops etc ...
      if (IsFlat) 
      {
        if (Closed) return false;
        E.Prev.OutIdx = Skip;
        LocalMinima locMin = new LocalMinima();
        locMin.Next = null;
        locMin.Y = E.Bot.Y;
        locMin.LeftBound = null;
        locMin.RightBound = E;
        locMin.RightBound.Side = EdgeSide.esRight;
        locMin.RightBound.WindDelta = 0;
        for ( ; ; )
        {
          if (E.Bot.X != E.Prev.Top.X) ReverseHorizontal(E);
          if (E.Next.OutIdx == Skip) break;
          E.NextInLML = E.Next;
          E = E.Next;
        }
        InsertLocalMinima(locMin);
        m_edges.Add(edges);
        return true;
      }

      m_edges.Add(edges);
      bool leftBoundIsForward;
      TEdge EMin = null;

      //workaround to avoid an endless loop in the while loop below when
      //open paths have matching start and end points ...
      if (E.Prev.Bot == E.Prev.Top) E = E.Next;

      for (;;)
      {
        E = FindNextLocMin(E);
        if (E == EMin) break;
        else if (EMin == null) EMin = E;

        //E and E.Prev now share a local minima (left aligned if horizontal).
        //Compare their slopes to find which starts which bound ...
        LocalMinima locMin = new LocalMinima();
        locMin.Next = null;
        locMin.Y = E.Bot.Y;
        if (E.Dx < E.Prev.Dx) 
        {
          locMin.LeftBound = E.Prev;
          locMin.RightBound = E;
          leftBoundIsForward = false; //Q.nextInLML = Q.prev
        } else
        {
          locMin.LeftBound = E;
          locMin.RightBound = E.Prev;
          leftBoundIsForward = true; //Q.nextInLML = Q.next
        }
        locMin.LeftBound.Side = EdgeSide.esLeft;
        locMin.RightBound.Side = EdgeSide.esRight;

        if (!Closed) locMin.LeftBound.WindDelta = 0;
        else if (locMin.LeftBound.Next == locMin.RightBound)
          locMin.LeftBound.WindDelta = -1;
        else locMin.LeftBound.WindDelta = 1;
        locMin.RightBound.WindDelta = -locMin.LeftBound.WindDelta;

        E = ProcessBound(locMin.LeftBound, leftBoundIsForward);
        if (E.OutIdx == Skip) E = ProcessBound(E, leftBoundIsForward);

        TEdge E2 = ProcessBound(locMin.RightBound, !leftBoundIsForward);
        if (E2.OutIdx == Skip) E2 = ProcessBound(E2, !leftBoundIsForward);

        if (locMin.LeftBound.OutIdx == Skip)
          locMin.LeftBound = null;
        else if (locMin.RightBound.OutIdx == Skip)
          locMin.RightBound = null;
        InsertLocalMinima(locMin);
        if (!leftBoundIsForward) E = E2;
      }
      return true;

    }
    //------------------------------------------------------------------------------

    public bool AddPaths(Paths ppg, PolyType polyType, bool closed)
    {
      bool result = false;
      for (int i = 0; i < ppg.Count; ++i)
        if (AddPath(ppg[i], polyType, closed)) result = true;
      return result;
    }
    //------------------------------------------------------------------------------

    bool Pt2IsBetweenPt1AndPt3(IntPoint pt1, IntPoint pt2, IntPoint pt3)
    {
      if ((pt1 == pt3) || (pt1 == pt2) || (pt3 == pt2)) return false;
      else if (pt1.X != pt3.X) return (pt2.X > pt1.X) == (pt2.X < pt3.X);
      else return (pt2.Y > pt1.Y) == (pt2.Y < pt3.Y);
    }
    //------------------------------------------------------------------------------

    TEdge RemoveEdge(TEdge e)
    {
      //removes e from double_linked_list (but without removing from memory)
      e.Prev.Next = e.Next;
      e.Next.Prev = e.Prev;
      TEdge result = e.Next;
      e.Prev = null; //flag as removed (see ClipperBase.Clear)
      return result;
    }
    //------------------------------------------------------------------------------

    //---------------------------------------------------------------------------

    private void InsertLocalMinima(LocalMinima newLm)
    {
      if( m_MinimaList == null )
      {
        m_MinimaList = newLm;
      }
      else if( newLm.Y >= m_MinimaList.Y )
      {
        newLm.Next = m_MinimaList;
        m_MinimaList = newLm;
      } else
      {
        LocalMinima tmpLm = m_MinimaList;
        while( tmpLm.Next != null  && ( newLm.Y < tmpLm.Next.Y ) )
          tmpLm = tmpLm.Next;
        newLm.Next = tmpLm.Next;
        tmpLm.Next = newLm;
      }
    }
    //------------------------------------------------------------------------------

    Boolean PopLocalMinima(cInt Y, out LocalMinima current)
    {
        current = m_CurrentLM;
        if (m_CurrentLM != null && m_CurrentLM.Y == Y)
        {
            m_CurrentLM = m_CurrentLM.Next;
            return true;
        }
        return false;
    }
    //------------------------------------------------------------------------------

    private void ReverseHorizontal(TEdge e)
    {
      //swap horizontal edges' top and bottom x's so they follow the natural
      //progression of the bounds - ie so their xbots will align with the
      //adjoining lower edge. [Helpful in the ProcessHorizontal() method.]
      Swap(ref e.Top.X, ref e.Bot.X);
#if use_xyz
      Swap(ref e.Top.Z, ref e.Bot.Z);
#endif
    }
    //------------------------------------------------------------------------------

    virtual void Reset()
    {
      m_CurrentLM = m_MinimaList;
      if (m_CurrentLM == null) return; //ie nothing to process

      //reset all edges ...
      m_Scanbeam = null;
      LocalMinima lm = m_MinimaList;
      while (lm != null)
      {
        InsertScanbeam(lm.Y);
        TEdge e = lm.LeftBound;
        if (e != null)
        {
          e.Curr = e.Bot;
          e.OutIdx = Unassigned;
        }
        e = lm.RightBound;
        if (e != null)
        {
          e.Curr = e.Bot;
          e.OutIdx = Unassigned;
        }
        lm = lm.Next;
      }
      m_ActiveEdges = null;
    }
    //------------------------------------------------------------------------------

    public static IntRect GetBounds(Paths paths)
    {
      int i = 0, cnt = paths.Count;
      while (i < cnt && paths[i].Count == 0) i++;
      if (i == cnt) return new IntRect(0,0,0,0);
      IntRect result = new IntRect();
      result.left = paths[i][0].X;
      result.right = result.left;
      result.top = paths[i][0].Y;
      result.bottom = result.top;
      for (; i < cnt; i++)
        for (int j = 0; j < paths[i].Count; j++)
        {
          if (paths[i][j].X < result.left) result.left = paths[i][j].X;
          else if (paths[i][j].X > result.right) result.right = paths[i][j].X;
          if (paths[i][j].Y < result.top) result.top = paths[i][j].Y;
          else if (paths[i][j].Y > result.bottom) result.bottom = paths[i][j].Y;
        }
      return result;
    }
    //------------------------------------------------------------------------------

    void InsertScanbeam(cInt Y)
    {
        //single-linked list: sorted descending, ignoring dups.
        if (m_Scanbeam == null)
        {
            m_Scanbeam = new Scanbeam();
            m_Scanbeam.Next = null;
            m_Scanbeam.Y = Y;
        }
        else if (Y > m_Scanbeam.Y)
        {
            Scanbeam newSb = new Scanbeam();
            newSb.Y = Y;
            newSb.Next = m_Scanbeam;
            m_Scanbeam = newSb;
        }
        else
        {
            Scanbeam sb2 = m_Scanbeam;
            while (sb2.Next != null && (Y <= sb2.Next.Y)) sb2 = sb2.Next;
            if (Y == sb2.Y) return; //ie ignores duplicates
            Scanbeam newSb = new Scanbeam();
            newSb.Y = Y;
            newSb.Next = sb2.Next;
            sb2.Next = newSb;
        }
    }
    //------------------------------------------------------------------------------

    Boolean PopScanbeam(out cInt Y)
    {
        if (m_Scanbeam == null)
        {
            Y = 0;
            return false;
        }
        Y = m_Scanbeam.Y;
        m_Scanbeam = m_Scanbeam.Next;
        return true;
    }
    //------------------------------------------------------------------------------

    Boolean LocalMinimaPending()
    {
        return (m_CurrentLM != null);
    }
    //------------------------------------------------------------------------------

    OutRec CreateOutRec()
    {
        OutRec result = new OutRec();
        result.Idx = Unassigned;
        result.IsHole = false;
        result.IsOpen = false;
        result.FirstLeft = null;
        result.Pts = null;
        result.BottomPt = null;
        result.PolyNode = null;
        m_PolyOuts.Add(result);
        result.Idx = m_PolyOuts.Count - 1;
        return result;
    }
    //------------------------------------------------------------------------------

    void DisposeOutRec(int index)
    {
        OutRec outRec = m_PolyOuts[index];
        outRec.Pts = null;
        outRec = null;
        m_PolyOuts[index] = null;
    }
    //------------------------------------------------------------------------------

    void UpdateEdgeIntoAEL(ref TEdge e)
    {
        if (e.NextInLML == null)
            throw new ClipperException("UpdateEdgeIntoAEL: invalid call");
        TEdge AelPrev = e.PrevInAEL;
        TEdge AelNext = e.NextInAEL;
        e.NextInLML.OutIdx = e.OutIdx;
        if (AelPrev != null)
            AelPrev.NextInAEL = e.NextInLML;
        else m_ActiveEdges = e.NextInLML;
        if (AelNext != null)
            AelNext.PrevInAEL = e.NextInLML;
        e.NextInLML.Side = e.Side;
        e.NextInLML.WindDelta = e.WindDelta;
        e.NextInLML.WindCnt = e.WindCnt;
        e.NextInLML.WindCnt2 = e.WindCnt2;
        e = e.NextInLML;
        e.Curr = e.Bot;
        e.PrevInAEL = AelPrev;
        e.NextInAEL = AelNext;
        if (!IsHorizontal(e)) InsertScanbeam(e.Top.Y);
    }
    //------------------------------------------------------------------------------

    void SwapPositionsInAEL(TEdge edge1, TEdge edge2)
    {
        //check that one or other edge hasn't already been removed from AEL ...
        if (edge1.NextInAEL == edge1.PrevInAEL ||
          edge2.NextInAEL == edge2.PrevInAEL) return;

        if (edge1.NextInAEL == edge2)
        {
            TEdge next = edge2.NextInAEL;
            if (next != null)
                next.PrevInAEL = edge1;
            TEdge prev = edge1.PrevInAEL;
            if (prev != null)
                prev.NextInAEL = edge2;
            edge2.PrevInAEL = prev;
            edge2.NextInAEL = edge1;
            edge1.PrevInAEL = edge2;
            edge1.NextInAEL = next;
        }
        else if (edge2.NextInAEL == edge1)
        {
            TEdge next = edge1.NextInAEL;
            if (next != null)
                next.PrevInAEL = edge2;
            TEdge prev = edge2.PrevInAEL;
            if (prev != null)
                prev.NextInAEL = edge1;
            edge1.PrevInAEL = prev;
            edge1.NextInAEL = edge2;
            edge2.PrevInAEL = edge1;
            edge2.NextInAEL = next;
        }
        else
        {
            TEdge next = edge1.NextInAEL;
            TEdge prev = edge1.PrevInAEL;
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
            m_ActiveEdges = edge1;
        else if (edge2.PrevInAEL == null)
            m_ActiveEdges = edge2;
    }
    //------------------------------------------------------------------------------

    void DeleteFromAEL(TEdge e)
    {
        TEdge AelPrev = e.PrevInAEL;
        TEdge AelNext = e.NextInAEL;
        if (AelPrev == null && AelNext == null && (e != m_ActiveEdges))
            return; //already deleted
        if (AelPrev != null)
            AelPrev.NextInAEL = AelNext;
        else m_ActiveEdges = AelNext;
        if (AelNext != null)
            AelNext.PrevInAEL = AelPrev;
        e.NextInAEL = null;
        e.PrevInAEL = null;
    }
    //------------------------------------------------------------------------------

} //end ClipperBase
