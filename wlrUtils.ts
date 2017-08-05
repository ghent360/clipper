import * as fs from "fs";
import * as readline from "readline";
import * as c from "./clipper_flt";
import {Int64} from "./intMath/int64";

function parseWlr(content:string[]):c.Paths {
    let i = Number.parseInt(content[0]);
    if (i != 1) {
        throw new Error(`"First digit should be 1, got ${i}`);
    }
    let numPolys = Number.parseInt(content[1]);
    if (numPolys <= 0) {
        throw new Error(`Invalid number of polygons ${numPolys}`)
    }
    let lineIdx = 2;
    let result = new Array<c.Path>(numPolys);
    for (let polyIdx = 0; polyIdx < numPolys; polyIdx++) {
        let numVertices = Number.parseInt(content[lineIdx++]);
        if (numVertices <= 0) {
            throw new Error(`Invalid number of vertices ${numVertices}`);
        }
        let poly = new Array<c.Point>(numVertices);
        for (let vertIdx = 0; vertIdx < numVertices; vertIdx++) {
            let line = content[lineIdx++].split(',');
            let x = Number.parseFloat(line[0]);
            let y = Number.parseFloat(line[1]);
            poly[vertIdx] = new c.Point(x, y);
        }
        result[polyIdx] = poly;
    }
    return result;
}

export function readWlrFile(fileName:string):Promise<c.Paths> {
    return new Promise((resolve, reject) => {
        try {
            fs.readFile(fileName, (err, buffer) => {
                if (err) reject(err);
                else resolve(buffer);
            });
        } catch (err) {
            reject(err);
        }
    })
    .then(buffer => buffer.toString().split('\n'))
    .then(content => parseWlr(content));
}

export function writeWlr(stream:fs.WriteStream, paths:c.Paths):void {
    stream.write("1\n");
    stream.write(`${paths.length}\n`);
    for (let path of paths) {
        stream.write(`${path.length}\n`);
        for (let pt of path) {
            stream.write(`${pt.x},${pt.y}\n`);
        }
    }
}

export function writeWlrFile(fileName:string, paths:c.Paths):void {
    let stream = fs.createWriteStream(fileName);
    writeWlr(stream, paths);
    stream.end();
}

function ptIdx(pt:c.Point):string {
    return pt.x + ":" + pt.y;
}

function idxPt(idx:string):c.Point {
    let s = idx.split(':');
    return new c.Point(
        Number.parseFloat(s[0]),
        Number.parseFloat(s[1])
    );
}

function ptIdxRound(pt:c.Point):string {
    return Math.round(pt.x) + ":" + Math.round(pt.y);
}

export function diffPath(a:c.Path, b:c.Path):void {
    let firstPath = new Array<Boolean>();
    let firstPathRnd = new Array<Boolean>();
    for (let pt of a) {
        let idx = ptIdx(pt);
        let idxRnd = ptIdxRound(pt);
        firstPath[idx] = true;
        firstPathRnd[idxRnd] = true;
    }
    for (let pt of b) {
        let idx = ptIdx(pt);
        let idxRnd = ptIdxRound(pt);
        if (firstPath[idx] == undefined) {
            console.log(`First is missing ${pt.x}, ${pt.y}`);
            if (firstPathRnd[idxRnd] != undefined) {
                console.log(`  but has ${Math.round(pt.x)}, ${Math.round(pt.y)}`);
            }
        } else {
            firstPath[idx] = false;
        }
        if (firstPathRnd[idxRnd] != undefined) {
            firstPathRnd[idxRnd] = false;
        }
    }
    for (let idx in firstPath) {
        if (firstPath[idx]) {
            let pt = idxPt(idx);
            let idxRnd = ptIdxRound(pt);
            console.log(`Second is missing ${pt.x}, ${pt.y}`);
            if (firstPathRnd[idxRnd] == false) {
                console.log(`  but has ${Math.round(pt.x)}, ${Math.round(pt.y)}`);
            }
        }
    }
}