import * as fs from "fs";
import * as readline from "readline";
import * as c from "./clipper";
import {Int64} from "./intMath/int64";

// First, checks if it isn't implemented yet.
if (!String.prototype.format) {
    String.prototype.format = function() {
        let args = arguments;
        return this.replace(/{(\d+)}/g, function(match, number) { 
            return typeof args[number] != 'undefined'
                ? args[number]
                : match
            ;});
    };
}

function parseWrl(content:string[]):c.Paths {
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
        let poly = new Array<c.IntPoint>(numVertices);
        for (let vertIdx = 0; vertIdx < numVertices; vertIdx++) {
            let line = content[lineIdx++].split(',');
            let x = Number.parseFloat(line[0]);
            let y = Number.parseFloat(line[1]);
            poly[vertIdx] = new c.IntPoint(
                Int64.fromRoundNumber(x),
                Int64.fromRoundNumber(y));
        }
        result[polyIdx] = poly;
    }
    return result;
}

function readWrlFile(fileName:string):Promise<c.Paths> {
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
    .then(content => parseWrl(content));
}

function main(argv:string[]):void {
    Int64.init().then(() => {
        let subjPromise = readWrlFile(argv[2]);
        let clipPromise = readWrlFile(argv[3]);
        return Promise.all([subjPromise, clipPromise]).then(values => {
            let ct = c.ClipType.ctIntersection;
            let clipper = new c.Clipper();
            clipper.AddPaths(values[0], c.PolyType.ptSubject, true);
            clipper.AddPaths(values[1], c.PolyType.ptClip, true);
            let solution = new Array<c.Path>();
            clipper.Execute(ct, solution, c.PolyFillType.pftEvenOdd);
            
            console.log(`Subject has ${values[0].length} polys`);
            console.log(`Clip has ${values[1].length} polys`);
            console.log(`Solution has ${solution.length} polys`);
            let idx = 0;
            for (let p of solution) {
                console.log(`Poly (${idx++}`);
                for (let pt of p) {
                    console.log(`  ${pt.x.toNumber()}, ${pt.y.toNumber()}`);
                }
            }
        });
    })
    .then(() => console.log("done"), (reason) => console.log(`fail: ${reason}`));
}

main(process.argv);
