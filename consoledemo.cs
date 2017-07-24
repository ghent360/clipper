import * as c from "./clipper";
import * as fs from "fs";

// First, checks if it isn't implemented yet.
if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) { 
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}

class Color {
    readonly R:number;
    readonly G:number;
    readonly B:number;

    constructor(r:number, g:number, b:number) {
        this.R = r;
        this.G = g;
        this.B = b;
    }

    public static get AntiqueWhite():Color {
        return new Color(227, 227, 227);
    }

    public static get Black():Color {
        return new Color(0, 0, 0);
    }
}

class ColorTranslator {
    public static ToHtml(v:Color):string {
        return "#000000";
    }
}

//a very simple class that builds an SVG file with any number of 
//polygons of the specified formats ...
class StyleInfo {
    public pft:c.PolyFillType;
    public brushClr:Color;
    public penClr:Color;
    public penWidth:number;
    public dashArray:number[];
    public showCoords:boolean;

    public Clone():StyleInfo {
        let si = new StyleInfo();
        si.pft = this.pft;
        si.brushClr = this.brushClr;
        si.dashArray = this.dashArray;
        si.penClr = this.penClr;
        si.penWidth = this.penWidth;
        si.showCoords = this.showCoords;
        return si;
    }

    constructor() {
        this.pft = c.PolyFillType.pftNonZero;
        this.brushClr = Color.AntiqueWhite;
        this.dashArray = null;
        this.penClr = Color.Black;
        this.penWidth = 0.8;
        this.showCoords = false;
    }
}

class PolyInfo {
    public polygons:c.Paths;
    public si:StyleInfo;
}

const svg_header:string = "<?xml version=\"1.0\" standalone=\"no\"?>\n" +
    "<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.0//EN\"\n" +
    "\"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\">\n\n" +
    "<svg width=\"{0}px\" height=\"{1}px\" viewBox=\"0 0 {2} {3}\" " +
    "version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\">\n\n";
const svg_path_format:string = "\"\n style=\"fill:{0};" +
    " fill-opacity:{1}; fill-rule:{2}; stroke:{3};" +
    " stroke-opacity:{4}; stroke-width:{5};\"/>\n\n";

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

    public SaveToFile(filename:string, scale:number = 1.0, margin:number = 10):boolean {
        if (scale == 0) {
            scale = 1.0;
        }
        if (margin < 0) {
            margin = 0;
        }
        
        //calculate the bounding rect ...
        let i = 0, j = 0;
        while (i < this.PolyInfoList.length) {
            j = 0;
            while (j < this.PolyInfoList[i].polygons.length
                && this.PolyInfoList[i].polygons[j].length == 0) {
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
        let rec = new c.IntRect();
        rec.left = this.PolyInfoList[i].polygons[j][0].x;
        rec.right = rec.left;
        rec.top = this.PolyInfoList[0].polygons[j][0].y;
        rec.bottom = rec.top;

        for ( ; i < this.PolyInfoList.length; i++ ) {
            for (let pg of this.PolyInfoList[i].polygons) {
                for (let pt of pg) {
                    if (pt.x.lessThan(rec.left)) {
                        rec.left = pt.x;
                    } else if (pt.x.greaterThan(rec.right)) {
                        rec.right = pt.x;
                    }
                    if (pt.y.lessThan(rec.top)) {
                        rec.top = pt.y;
                    } else if (pt.y.greaterThan(rec.bottom)) {
                        rec.bottom = pt.y;
                    }
                }
            }
        }

        rec.left = rec.left.mul(scale);
        rec.top = rec.top.mul(scale);
        rec.right = rec.right.mul(scale);
        rec.bottom = rec.bottom.mul(scale);
        let offsetX = rec.left.neg().add(margin);
        let offsetY = rec.top.neg().add(margin);

        let writer = fs.createWriteStream(filename);
        writer.write(svg_header.format(
            rec.right.sub(rec.left).toNumber() + margin * 2,
            rec.bottom.sub(rec.top).toNumber() + margin * 2,
            rec.right.sub(rec.left).toNumber() + margin * 2,
            rec.bottom.sub(rec.top).toNumber() + margin * 2));

        for (let pi of this.PolyInfoList) {
            writer.write(" <path d=\"");
            for (let p of pi.polygons) {
                if (p.length < 3) {
                    continue;
                }
                writer.write(String.format(" M {0} {1}",
                    p[0].x.toNumber() * scale + offsetX.toNumber(),
                    p[0].y.toNumber() * scale + offsetY.toNumber()));
                for (let k = 1; k < p.length; k++) {
                    writer.write(String.format(" L {0} {1}",
                        p[k].x.toNumber() * scale + offsetX.toNumber(),
                        p[k].y.toNumber() * scale + offsetY.toNumber()));
                }
                writer.write(" z");
            }

            writer.write(String.format(svg_path_format, ColorTranslator.ToHtml(pi.si.brushClr),
                0,
                (pi.si.pft == c.PolyFillType.pftEvenOdd ? "evenodd" : "nonzero"),
                ColorTranslator.ToHtml(pi.si.penClr),
                0,
                pi.si.penWidth));

            if (pi.si.showCoords) {
                writer.write("<g font-family=\"Verdana\" font-size=\"11\" fill=\"black\">\n\n");
                for (let p of pi.polygons) {
                    for (let pt of p) {
                        let x = pt.x;
                        let y = pt.y;
                        writer.write(String.format(
                            "<text x=\"{0}\" y=\"{1}\">{2},{3}</text>\n",
                            x.mul(scale).add(offsetX).toInt(),
                            y.mul(scale).add(offsetY).toInt(),
                            x.toNumber(),
                            y.toNumber()));

                    }
                    writer.write("\n");
                }
                writer.write("</g>\n");
            }
        }
        writer.write("</svg>\n");
        writer.close();
        return true;
    }
}

////////////////////////////////////////////////

function LoadFromFile(
    filename:string,
    ppg:c.Paths,
    dec_places:number,
    xOffset:number = 0,
    yOffset:number = 0):boolean {
    let scaling = Math.pow(10, dec_places);

    ppg.length = 0;
    if (!fs.existsSync(filename)) {
        return false;
    }
    let sr = fs.readFileSync(filename).toString().split('\n');

    let line = sr[0];
    let polyCnt:number;
    let vertCnt:number;
    if (!Int32.TryParse(line, out polyCnt) || polyCnt < 0) return false;
    //ppg.Capacity = polyCnt;
    for (int i = 0; i < polyCnt; i++)
    {
        if ((line = sr.ReadLine()) == null) return false;
        if (!Int32.TryParse(line, out vertCnt) || vertCnt < 0) return false;
        Path pg = new Path(vertCnt);
        ppg.Add(pg);
        if (scaling > 0.999 & scaling < 1.001)
            for (int j = 0; j < vertCnt; j++)
            {
                Int64 x, y;
                if ((line = sr.ReadLine()) == null) return false;
                char[] delimiters = new char[] { ',', ' ' };
                string[] vals = line.Split(delimiters);
                if (vals.Length < 2) return false;
                if (!Int64.TryParse(vals[0], out x)) return false;
                if (!Int64.TryParse(vals[1], out y))
                    if (vals.Length < 2 || !Int64.TryParse(vals[2], out y)) return false;
                x = x + xOffset;
                y = y + yOffset;
                pg.Add(new IntPoint(x, y));
            }
        else
            for (int j = 0; j < vertCnt; j++)
            {
                double x, y;
                if ((line = sr.ReadLine()) == null) return false;
                char[] delimiters = new char[] { ',', ' ' };
                string[] vals = line.Split(delimiters);
                if (vals.Length < 2) return false;
                if (!double.TryParse(vals[0], out x)) return false;
                if (!double.TryParse(vals[1], out y))
                    if (vals.Length < 2 || !double.TryParse(vals[2], out y)) return false;
                x = x * scaling + xOffset;
                y = y * scaling + yOffset;
                pg.Add(new IntPoint((Int64)Math.Round(x), (Int64)Math.Round(y)));
            }
    }
    return true;
}

////////////////////////////////////////////////
static void SaveToFile(string filename, Paths ppg, int dec_places)
{
    double scaling = Math.Pow(10, dec_places);
    StreamWriter writer = new StreamWriter(filename);
    if (writer == null) return;
    writer.Write("{0}\r\n", ppg.Count);
    foreach (Path pg in ppg)
    {
        writer.Write("{0}\r\n", pg.Count);
        foreach (IntPoint ip in pg)
            writer.Write("{0:0.####}, {1:0.####}\r\n", (double)ip.X / scaling, (double)ip.Y / scaling);
    }
    writer.Close();
}

////////////////////////////////////////////////

function OutputFileFormat()
{
    console.log("The expected (text) file format is ...");
    console.log("Polygon Count");
    console.log("First polygon vertex count");
    console.log("first X, Y coordinate of first polygon");
    console.log("second X, Y coordinate of first polygon");
    console.log("etc.");
    console.log("Second polygon vertex count (if there is one)");
    console.log("first X, Y coordinate of second polygon");
    console.log("second X, Y coordinate of second polygon");
    console.log("etc.");
}

////////////////////////////////////////////////

static Path IntsToPolygon(int[] ints)
{
    int len1 = ints.Length /2;
    Path result = new Path(len1);
    for (int i = 0; i < len1; i++)
        result.Add(new IntPoint(ints[i * 2], ints[i * 2 +1]));
    return result;
}

////////////////////////////////////////////////

static Path MakeRandomPolygon(Random r,  int maxWidth, int maxHeight, int edgeCount, Int64 scale = 1)
{
    Path result = new Path(edgeCount);
    for (int i = 0; i < edgeCount; i++)
    {
        result.Add(new IntPoint(r.Next(maxWidth)*scale, r.Next(maxHeight)*scale));
    }
    return result;
}
////////////////////////////////////////////////

static void Main(string[] args)
{
    ////quick test with random polygons ...
    //Paths ss = new Paths(1), cc = new Paths(1), sss = new Paths();
    //Random r = new Random((int)DateTime.Now.Ticks);
    //int scale = 1000000000; //tests 128bit math
    //ss.Add(MakeRandomPolygon(r, 400, 350, 9, scale));
    //cc.Add(MakeRandomPolygon(r, 400, 350, 9, scale));
    //Clipper cpr = new Clipper();
    //cpr.AddPaths(ss, PolyType.ptSubject, true);
    //cpr.AddPaths(cc, PolyType.ptClip, true);
    //cpr.Execute(ClipType.ctUnion, sss, PolyFillType.pftNonZero, PolyFillType.pftNonZero);
    //sss = Clipper.OffsetPolygons(sss, -5.0 * scale, JoinType.jtMiter, 4);
    //SVGBuilder svg1 = new SVGBuilder();
    //svg1.style.brushClr = Color.FromArgb(0x20, 0, 0, 0x9c);
    //svg1.style.penClr = Color.FromArgb(0xd3, 0xd3, 0xda);
    //svg1.AddPaths(ss);
    //svg1.style.brushClr = Color.FromArgb(0x20, 0x9c, 0, 0);
    //svg1.style.penClr = Color.FromArgb(0xff, 0xa0, 0x7a);
    //svg1.AddPaths(cc);
    //svg1.style.brushClr = Color.FromArgb(0xAA, 0x80, 0xff, 0x9c);
    //svg1.style.penClr = Color.FromArgb(0, 0x33, 0);
    //svg1.AddPaths(sss);
    //svg1.SaveToFile("solution.svg", 1.0 / scale);
    //return;

    if (args.Length < 5)
    {
        string appname = System.Environment.GetCommandLineArgs()[0];
        appname = System.IO.Path.GetFileName(appname);
        console.log("");
        console.log("Usage:");
        console.log("  {0} CLIPTYPE s_file c_file INPUT_DEC_PLACES SVG_SCALE [S_FILL, C_FILL]", appname);
        console.log("  where ...");
        console.log("  CLIPTYPE = INTERSECTION|UNION|DIFFERENCE|XOR");
        console.log("  FILLMODE = NONZERO|EVENODD");
        console.log("  INPUT_DEC_PLACES = signific. decimal places for subject & clip coords.");
        console.log("  SVG_SCALE = scale of SVG image as power of 10. (Fractions are accepted.)");
        console.log("  both S_FILL and C_FILL are optional. The default is EVENODD.");
        console.log("Example:");
        console.log("  Intersect polygons, rnd to 4 dec places, SVG is 1/100 normal size ...");
        console.log("  {0} INTERSECTION subj.txt clip.txt 0 0 NONZERO NONZERO", appname);
        return;
    }

    ClipType ct;
    switch (args[0].ToUpper())
    {
        case "INTERSECTION": ct = ClipType.ctIntersection; break;
        case "UNION": ct = ClipType.ctUnion; break;
        case "DIFFERENCE": ct = ClipType.ctDifference; break;
        case "XOR": ct = ClipType.ctXor; break;
        default: console.log("Error: invalid operation - {0}", args[0]); return;
    }

    string subjFilename = args[1];
    string clipFilename = args[2];
    if (!File.Exists(subjFilename))
    {
        console.log("Error: file - {0} - does not exist.", subjFilename);
        return;
    }
    if (!File.Exists(clipFilename))
    {
        console.log("Error: file - {0} - does not exist.", clipFilename);
        return;
    }

    int decimal_places = 0;
    if (!Int32.TryParse(args[3], out decimal_places))
    {
        console.log("Error: invalid number of decimal places - {0}", args[3]);
        return;
    }
    if (decimal_places > 8) decimal_places = 8;
    else if (decimal_places < 0) decimal_places = 0;

    double svg_scale = 0;
    if (!double.TryParse(args[4], out svg_scale))
    {
        console.log("Error: invalid value for SVG_SCALE - {0}", args[4]);
        return;
    }
    if (svg_scale < -18) svg_scale = -18;
    else if (svg_scale > 18) svg_scale = 18;
    svg_scale = Math.Pow(10, svg_scale - decimal_places);//nb: also compensate for decimal places


    PolyFillType pftSubj = PolyFillType.pftEvenOdd;
    PolyFillType pftClip = PolyFillType.pftEvenOdd;
    if (args.Length > 6)
    {
        switch (args[5].ToUpper())
        {
            case "EVENODD": pftSubj = PolyFillType.pftEvenOdd; break;
            case "NONZERO": pftSubj = PolyFillType.pftNonZero; break;
            default: console.log("Error: invalid cliptype - {0}", args[5]); return;
        }
        switch (args[6].ToUpper())
        {
            case "EVENODD": pftClip = PolyFillType.pftEvenOdd; break;
            case "NONZERO": pftClip = PolyFillType.pftNonZero; break;
            default: console.log("Error: invalid cliptype - {0}", args[6]); return;
        }
    }

    Paths subjs = new Paths();
    Paths clips = new Paths();
    if (!LoadFromFile(subjFilename, subjs, decimal_places))
    {
        console.log("Error processing subject polygons file - {0} ", subjFilename);
        OutputFileFormat();
        return;
    }
    if (!LoadFromFile(clipFilename, clips, decimal_places))
    {
        console.log("Error processing clip polygons file - {0} ", clipFilename);
        OutputFileFormat();
        return;
    }

    console.log("wait ...");
    Clipper cp = new Clipper();
    cp.AddPaths(subjs, PolyType.ptSubject, true);
    cp.AddPaths(clips, PolyType.ptClip, true);

    Paths solution = new Paths();
    //Paths solution = new Paths();
    if (cp.Execute(ct, solution, pftSubj, pftClip))
    {
        SaveToFile("solution.txt", solution, decimal_places);

        //solution = Clipper.OffsetPolygons(solution, -4, JoinType.jtRound);

        SVGBuilder svg = new SVGBuilder();
        svg.style.brushClr = Color.FromArgb(0x20, 0, 0, 0x9c);
        svg.style.penClr = Color.FromArgb(0xd3, 0xd3, 0xda);
        svg.AddPaths(subjs);
        svg.style.brushClr = Color.FromArgb(0x20, 0x9c, 0, 0);
        svg.style.penClr = Color.FromArgb(0xff, 0xa0, 0x7a);
        svg.AddPaths(clips);
        svg.style.brushClr = Color.FromArgb(0xAA, 0x80, 0xff, 0x9c);
        svg.style.penClr = Color.FromArgb(0, 0x33, 0);
        svg.AddPaths(solution);
        svg.SaveToFile("solution.svg", svg_scale);

        console.log("finished!");
    }
    else
    {
        console.log("failed!");
    }
}
