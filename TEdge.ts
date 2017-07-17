import {EdgeSide, PolyType} from "./Enums";
import {IntPoint} from "./IntPoint";

export class TEdge {
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
