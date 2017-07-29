import * as c from "./clipper";
import * as fs from "fs";

function toString2(n:number):string {
    return ((n >>> 4) & 0xf).toString(16) +
        (n & 0xf).toString(16);
}

function ColorToHtml(clr:number):string {
    let ss:string;
    ss = '#' + toString2((clr >>> 16) & 0xff)
        + toString2((clr >>> 8) & 0xff)
        + toString2(clr & 0xff);
    return ss;
}

//------------------------------------------------------------------------------

function GetAlphaAsFrac(clr:number):number {
    return ((clr >>> 24) & 0xff) / 255;
}

//a very simple class that builds an SVG file with any number of 
//polygons of the specified formats ...
class StyleInfo {
    public pft:c.PolyFillType;
    public brushClr:number;
    public penClr:number;
    public penWidth:number;
    public showCoords:boolean;

    public Clone():StyleInfo {
        let si = new StyleInfo();
        si.pft = this.pft;
        si.brushClr = this.brushClr;
        si.penClr = this.penClr;
        si.penWidth = this.penWidth;
        si.showCoords = this.showCoords;
        return si;
    }

    constructor() {
        this.pft = c.PolyFillType.pftNonZero;
        this.brushClr = 0xFFFFFFCC;
        this.penClr = 0xFF000000;
        this.penWidth = 0.8;
        this.showCoords = false;
    }
}

class PolyInfo {
    public polygons:c.Paths;
    public si:StyleInfo;
}

const svg_header:string[] = [
    "<?xml version=\"1.0\" standalone=\"no\"?>\n" +
    "<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.0//EN\"\n" +
    "\"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\">\n\n" +
    "<svg width=\"",
    "\" height=\"",
    "\" viewBox=\"0 0 ",
    "\" version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\">\n\n"];

const poly_end:string[] = [
    "\"\n style=\"fill:",
    "; fill-opacity:",
    "; fill-rule:",
    "; stroke:",
    "; stroke-opacity:",
    "; stroke-width:",
    ";\"/>\n\n"];

class SVGBuilder {
    public style:StyleInfo;
    private PolyInfoList:Array<PolyInfo>;

    constructor() {
        this.PolyInfoList = new Array<PolyInfo>();
        this.style = new StyleInfo();
    }

    public AddPaths(poly:c.Paths):void {
        if (poly.length == 0) {
            return;
        }
        let pi = new PolyInfo();
        pi.polygons = poly;
        pi.si = this.style.Clone();
        this.PolyInfoList.push(pi);
    }

    public SaveToSVG(file:fs.WriteStream, scale:number = 1.0, margin:number = 10):boolean {
        //calculate the bounding rect ...
        let i = 0;
        let j:number;
        while (i < this.PolyInfoList.length) {
            j = 0;
            while (j < this.PolyInfoList[i].polygons.length &&
                this.PolyInfoList[i].polygons[j].length == 0) {
                j++;
            }
            if (j < this.PolyInfoList[i].polygons.length) {
                break;
            }
            i++;
        }
        if (i == this.PolyInfoList.length) {
            return false;
        }

        let left = this.PolyInfoList[i].polygons[j][0].x;
        let right = left;
        let top = this.PolyInfoList[i].polygons[j][0].y;
        let bottom = top;
        for ( ; i < this.PolyInfoList.length; ++i) {
            for (let j = 0; j < this.PolyInfoList[i].polygons.length; ++j) {
                for (let k = 0; k < this.PolyInfoList[i].polygons[j].length; ++k) {
                    let ip = this.PolyInfoList[i].polygons[j][k];
                    if (ip.x.lessThan(left)) {
                        left = ip.x;
                    } else if (ip.x.greaterThan(right)) {
                        right = ip.x;
                    }
                    if (ip.y.lessThan(top)) {
                        top = ip.y;
                    } else if (ip.y.greaterThan(bottom)) {
                        bottom = ip.y;
                    }
                }
            }
        }

        if (scale == 0) {
            scale = 1.0;
        }
        if (margin < 0) {
            margin = 0;
        }
        let _left = left.toNumber() * scale;
        let _top = top.toNumber() * scale;
        let _right = right.toNumber() * scale;
        let _bottom = bottom.toNumber() * scale;
        let offsetX = -_left + margin;
        let offsetY = -_top + margin;
        let rec = new c.IntRect(left, top, right, bottom);

        file.write(svg_header[0]);
        file.write((_right - _left + margin*2).toString());
        file.write("px");
        file.write(svg_header[1]);
        file.write((_bottom - _top + margin*2).toString());
        file.write("px");
        file.write(svg_header[2]);
        file.write((_right - _left + margin*2).toString());
        file.write(" ");
        file.write((_bottom - _top + margin*2).toString());
        file.write(svg_header[3]);

        for (let i = 0; i < this.PolyInfoList.length; ++i) {
            file.write(" <path d=\"");
            for (let j = 0; j < this.PolyInfoList[i].polygons.length; ++j) {
                if (this.PolyInfoList[i].polygons[j].length < 3) {
                    continue;
                }
                file.write(" M ");
                file.write( 
                    (this.PolyInfoList[i].polygons[j][0].x.toNumber() * scale + offsetX).toString());
                file.write(" ");
                file.write(
                    (this.PolyInfoList[i].polygons[j][0].x.toNumber() * scale + offsetY).toString());
                for (let k = 1; k < this.PolyInfoList[i].polygons[j].length; ++k) {
                    let ip = this.PolyInfoList[i].polygons[j][k];
                    let x = ip.x.toNumber() * scale;
                    let y = ip.y.toNumber() * scale;
                    file.write(" L ");
                    file.write((x + offsetX).toString());
                    file.write(" ");
                    file.write((y + offsetY).toString());
                }
                file.write(" z");
            }
            file.write(poly_end[0]);
            file.write(ColorToHtml(this.PolyInfoList[i].si.brushClr));
            file.write(poly_end[1]);
            file.write(GetAlphaAsFrac(this.PolyInfoList[i].si.brushClr).toString());
            file.write(poly_end[2]);
            file.write(
                (this.PolyInfoList[i].si.pft == c.PolyFillType.pftEvenOdd ? "evenodd" : "nonzero"));
            file.write(poly_end[3]);
            file.write(ColorToHtml(this.PolyInfoList[i].si.penClr));
            file.write(poly_end[4]);
            file.write(GetAlphaAsFrac(this.PolyInfoList[i].si.penClr).toString());
            file.write(poly_end[5]);
            file.write(this.PolyInfoList[i].si.penWidth.toString());
            file.write(poly_end[6]);

            if (this.PolyInfoList[i].si.showCoords) {
                file.write("<g font-family=\"Verdana\" font-size=\"11\" fill=\"black\">\n\n");
                for (let j = 0; j < this.PolyInfoList[i].polygons.length; ++j) {
                    if (this.PolyInfoList[i].polygons[j].length < 3) {
                        continue;
                    }
                    for (let k = 0; k < this.PolyInfoList[i].polygons[j].length; ++k) {
                        let ip = this.PolyInfoList[i].polygons[j][k];
                        file.write("<text x=\"");
                        file.write(Math.trunc(ip.x.toNumber() * scale + offsetX).toString());
                        file.write("\" y=\"");
                        file.write(Math.trunc(ip.y.toNumber() * scale + offsetY).toString());
                        file.write("\">");
                        file.write(ip.x.toNumber().toString());
                        file.write(",");
                        file.write(ip.y.toNumber().toString());
                        file.write("</text>\n\n");
                    }
                }
                file.write("</g>\n");
            }
        }
        file.write("</svg>\n");
        file.end();
    }
}
