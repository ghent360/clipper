Polygon clipping library (clipper 6.4.2)
========================================

This project is a translation to typescript of the excellent polygon clipping library by Angus Johnson.

I used the C# code as a basis of the translation. I used version 6.4.2 from http://www.angusj.com. The original code was released under the boost V1 license, this port carries the same license. I claim copyright for the translation.

The original code was written using mostly 64-bit integer math and some 128-bit integer math. There were a few floating point operations. Since JavaScript/TypeScript does not support int64 or int128 operations, I wrote a small helper library in WebAssembly (int64.wasm). The ported code is clipper.ts and a simple command line program to run the algorythm is implemented in run_int.ts.

I also converted the code to use the native JavaScript/TypeScript number type, which is floating point. This code is located in clipper_flt.ts and a simple command line program to run the algorythm is implemented in run_flt.ts.

The input and output for the sample programs are .WLR files. I added a few sample files in the test folder. WLR file is ASCII test with the following format:
  * Line 1 contains the number "1"
  * Line 2 contains number of polygons
  * For each polygon the next line contains number of point in the polygon, followed by each point on a single line X coordinate then comma, then the Y coordinate

The output would be written as WLR file as well as SVG file.
I also wrote a tool to diff WLR files diffwlr.ts and a simple web page to load WLR files and compare them visually (html/polydiff.html and polydiff.ts).