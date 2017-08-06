import * as fs from "fs";
import * as wlr from "./wlrUtils";

function main(argv:string[]):void {
    let subjPromise = wlr.readWlrFile(argv[2]);
    let clipPromise = wlr.readWlrFile(argv[3]);
    Promise.all([subjPromise, clipPromise]).then(values => {
        wlr.diffPath(values[0][0], values[1][0]);
    });
}

main(process.argv);
