import * as wlr from "./wlrUtils";
import * as SVG from "svg.js";

let gSubj:wlr.Paths;
let gClip:wlr.Paths;
let gWidth = 1000;
let gHeight = 1000;
let gMargin = 10;
let gDraw = SVG('drawing').size(gWidth, gHeight);
let gScale = 0.01;
let gOffsetX = 0;
let gOffsetY = 0;

function readSingleFile(e:Event, cb:(poly:wlr.Paths)=>void):void {
    var file = (<HTMLInputElement>e.target).files[0];
    if (!file) {
        return;
    }
    var reader = new FileReader();
    reader.onload = (e:ProgressEvent) => {
        perseWrl((<FileReader>e.target).result, cb);
    };
    reader.readAsText(file);
}

function perseWrl(stream: string, cb:(poly:wlr.Paths)=>void):void {
    let content = stream.split('\n');
    cb(wlr.parseWlr(content));
}

function drawPath(path:wlr.Path, color:string):void {
    let coords = new Array<number>();
    for (let pt of path) {
        coords.push(Math.trunc((pt.x + gOffsetX) * gScale + gMargin));
        coords.push(Math.trunc((pt.y + gOffsetY) * gScale + gMargin));
    }
    gDraw.polygon(coords).fill({opacity:0}).stroke({color:color, width:1});
}

function drawPaths(paths:wlr.Paths, color:string):void {
    for (let path of paths) {
        drawPath(path, color);
    }
}

function firstPt(paths:wlr.Paths):wlr.Point {
    return paths[0][0];
}

class BBox {
    left:number;
    right:number;
    top:number;
    bottom:number;

    constructor(pt:wlr.Point) {
        this.left = this.right = pt.x;
        this.top = this.bottom = pt.y;
    }

    public visit(pt:wlr.Point):void {
        if (this.left > pt.x) {
            this.left = pt.x;
        } else if (this.right < pt.x) {
            this.right = pt.x;
        }
        if (this.top > pt.y) {
            this.top = pt.y;
        } else if (this.bottom < pt.y) {
            this.bottom = pt.y;
        }
    }

    public consider(paths:wlr.Paths):void {
        for (let path of paths) {
            for (let pt of path) {
                this.visit(pt);
            }
        }
    }
}

function diff():void {
    if (gClip == undefined || gSubj == undefined) {
        return;
    }
    let bbox = new BBox(firstPt(gSubj));
    bbox.consider(gSubj);
    bbox.consider(gClip);
    let scalex = (gWidth - gMargin * 2) / (bbox.right - bbox.left);
    let scaley = (gHeight - gMargin * 2) / (bbox.bottom - bbox.top);
    gScale = Math.min(scalex, scaley);
    gOffsetX = -bbox.left;
    gOffsetY = -bbox.top;
    gDraw.clear();
    drawPaths(gSubj, "#E00000");
    drawPaths(gClip, "#00A000");
}

document.getElementById('subj-input')
    .addEventListener('change', e => readSingleFile(e, p => {
        gSubj = p;
        diff();
    }), false);
document.getElementById('clip-input')
    .addEventListener('change', e => readSingleFile(e, p => {
        gClip = p;
        diff();
    }), false);

