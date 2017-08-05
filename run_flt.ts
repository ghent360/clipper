import * as fs from "fs";
import * as readline from "readline";
import * as c from "./clipper_flt";
import {Int64} from "./intMath/int64";
import {SVGBuilder} from "./svgbuilder";
import * as wlr from "./wlrUtils";

function main(argv:string[]):void {
    Int64.init().then(() => {
        let subjPromise = wlr.readWlrFile(argv[2]);
        let clipPromise = wlr.readWlrFile(argv[3]);
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
            wlr.writeWlrFile("solution.wlr", solution);
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
