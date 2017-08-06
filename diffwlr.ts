import * as fs from "fs";
import * as wlr from "./wlrUtils";

function main(argv:string[]):void {
    let subjPromise = wlr.readWlrFile(argv[2]);
    let clipPromise = wlr.readWlrFile(argv[3]);
    Promise.all([subjPromise, clipPromise]).then(values => {
        let s1 = values[0];
        let s2 = values[1];
        if (s1.length != s2.length) {
            console.log(`Solution 1 has ${s1.length} polygons, solution2 has ${s2.length}`);
        }
        for (let idx = 0; idx < s1.length; idx++) {
            console.log(`Comparing polygon ${idx}`);
            wlr.diffPath(s1[idx], s2[idx]);
        }
    });
}

main(process.argv);
