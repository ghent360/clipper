import * as fs from "fs";
import * as readline from "readline";
import * as c from "./clipper_flt";
import {Int64} from "./intMath/int64";
import {SVGBuilder} from "./svgbuilder";

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

function readWlrFile(fileName:string):Promise<c.Paths> {
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

function writeWlr(stream:fs.WriteStream, paths:c.Paths):void {
    stream.write("1\n");
    stream.write(`${paths.length}\n`);
    for (let path of paths) {
        stream.write(`${path.length}\n`);
        for (let pt of path) {
            stream.write(`${pt.x},${pt.y}\n`);
        }
    }
}

function writeWlrFile(fileName:string, paths:c.Paths):void {
    let stream = fs.createWriteStream(fileName);
    writeWlr(stream, paths);
    stream.end();
}

function main(argv:string[]):void {
    Int64.init().then(() => {
        let subjPromise = readWlrFile(argv[2]);
        let clipPromise = readWlrFile(argv[3]);
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
            writeWlrFile("solution.wlr", solution);
            let sb = new SVGBuilder();
            sb.Add(solution);
            let stream = fs.createWriteStream("solution.svg");
            sb.SaveToSVG(stream);
            stream.end();
        });
    })
    .then(() => console.log("done"), (reason) => console.log(`fail: ${reason}`));
}

main(process.argv);
