export enum ClipType {
    ctIntersection,
    ctUnion,
    ctDifference,
    ctXor
};

export enum PolyType {
    ptSubject,
    ptClip
};
  
export enum JoinType { 
    jtSquare, 
    jtRound, 
    jtMiter
};

//By far the most widely used winding rules for polygon filling are
//EvenOdd & NonZero (GDI, GDI+, XLib, OpenGL, Cairo, AGG, Quartz, SVG, Gr32)
//Others rules include Positive, Negative and ABS_GTR_EQ_TWO (only in OpenGL)
//see http://glprogramming.com/red/chapter11.html
export enum PolyFillType {
    pftEvenOdd,
    pftNonZero,
    pftPositive,
    pftNegative
};

export enum EndType { 
    etClosedPolygon, 
    etClosedLine, 
    etOpenButt, 
    etOpenSquare, 
    etOpenRound 
};

export enum EdgeSide {
    esLeft,
    esRight
};

export enum Direction {
    dRightToLeft,
    dLeftToRight
};
