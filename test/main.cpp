#ifdef _MSC_VER
#define _CRT_SECURE_NO_WARNINGS
#endif

#ifdef _DEBUG
#include <vld.h> //leak detection 
#endif

#include <cmath>
#include <ctime>
#include <cstdlib>
#include <cstdio>
#include <vector>
#include <iomanip>
#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <cfloat>

#ifdef _WIN32
#include <windows.h> //Windows exception handling
#endif

#include "clipper.hpp"          //http://sourceforge.net/projects/polyclipping/ (clipper)

#include <boost/foreach.hpp>    //http://www.boost.org/  
#include <boost/geometry.hpp>   //(boost geometry aka ggl)
#include <boost/geometry/geometries/point_xy.hpp>
#include <boost/geometry/geometries/polygon.hpp>
#include <boost/geometry/io/wkt/wkt.hpp>
#include <boost/geometry/multi/geometries/multi_polygon.hpp>

extern "C" {
#include "gpc\gpc.h"            //http://www.cs.man.ac.uk/~toby/alan/software/ (gpc)
}

#include "polybool\polybool.h"  //http://www.complex-a5.ru/polyboolean/index.html (polybool)
#include "polybool\pbio.h"

//---------------------------------------------------------------------------

using namespace std;
using namespace ClipperLib;
using namespace POLYBOOLEAN;
using namespace boost::geometry;

const double INT_SCALE = 1000;

struct Point
{
  double  x;
  double  y;
  Point(double _x = 0.0, double _y = 0.0): x(_x), y(_y) {}; 
};

typedef std::vector< Point > Poly;
typedef std::vector< Poly > Polys;

typedef model::d2::point_xy<double> ggl_point;
typedef model::ring< ggl_point > ggl_ring;
typedef model::polygon< ggl_point > ggl_polygon;
typedef model::multi_polygon< ggl_polygon > ggl_polygons;

enum bool_type {Intersection, Union, Difference, Xor};
//---------------------------------------------------------------------------
//---------------------------------------------------------------------------

string ColorToHtml(unsigned clr)
{
  stringstream ss;
  ss << '#' << hex << std::setfill('0') << setw(6) << (clr & 0xFFFFFF);
  return ss.str();
}
//------------------------------------------------------------------------------

float GetAlphaAsFrac(unsigned clr)
{
  return ((float)(clr >> 24) / 255);
}
//------------------------------------------------------------------------------

//a simple class to build SVG files that displays polygons
class SvgBase
{

  struct Rect
  {
    double left;
    double top;
    double right;
    double bottom;
    Rect(double l = 0, double t = 0, double r = 0, double b = 0): 
      left(l), top(t), right(r), bottom(b) {};
  };

  class StyleInfo
  {
  public:
    PolyFillType pft;
    unsigned brushClr;
    unsigned penClr;
    double penWidth;
    bool closePath;
    bool showCoords;
  };

  struct FontInfo
  {
  public:
    std::string family;
    int size;
    unsigned fillColor;
  };
  typedef std::vector<FontInfo> FontInfoList;

  class TextInfo
  {
  public:
    const std::string text;
    double  x;
    double  y;
    unsigned fontIdx;
    TextInfo(double  _x, double  _y, unsigned _fi, const std::string& _text): x(_x), y(_y), fontIdx(_fi),text(_text) {}
  };
  typedef std::vector<TextInfo> TextInfoList;

  class PolyInfo
  {
    public:
      Polys polygons;
      StyleInfo si;

      PolyInfo(Polys& p, StyleInfo style)
      {
        this->polygons = p;
        this->si = style;
      }
  };
  typedef std::vector<PolyInfo> PolyInfoList;

private:
  PolyInfoList polyInfos;
  FontInfoList fontInfos;
  TextInfoList textInfos;

  static const std::string svg_xml_start[];
  static const std::string path_end_poly[];
  static const std::string path_end_line[];

  void CheckFonts()
  {
    //if no font has been specified create a default font...
    if (!fontInfos.empty()) return;
    FontInfo fi;
    fi.family = "Verdana";
    fi.size = 15;
    fi.fillColor = 0xFF000000;
    fontInfos.push_back(fi);
  }

  void UpdateBounds(Polys& p)
  {
    Rect r = GetBounds(p);
    if (r.left < bounds.left) bounds.left = r.left;
    if (r.top < bounds.top) bounds.top = r.top;
    if (r.right > bounds.right) bounds.right = r.right;
    if (r.bottom > bounds.bottom) bounds.bottom = r.bottom;
  }
  //---------------------------------------------------------------------------

public:
  StyleInfo style;
  Rect bounds;

  SvgBase()
  {
    style.pft = pftNonZero;
    style.brushClr = 0xFFFFFFCC;
    style.penClr = 0xFF000000;
    style.penWidth = 0.8;
    style.closePath = true;
    style.showCoords = false;

    bounds.left = DBL_MAX;
    bounds.top = DBL_MAX;
    bounds.right = -DBL_MAX;
    bounds.bottom = -DBL_MAX;
  }

  Rect GetBounds(Polys& p)
  {
    Rect result(DBL_MAX, DBL_MAX, -DBL_MAX, -DBL_MAX);
    for (size_t i = 0; i < p.size(); i++)
      for (size_t j = 0; j < p[i].size(); j++)
      {
        if (p[i][j].x < result.left) result.left = p[i][j].x;
        if (p[i][j].x > result.right) result.right = p[i][j].x;
        if (p[i][j].y < result.top) result.top = p[i][j].y;
        if (p[i][j].y > result.bottom) result.bottom = p[i][j].y;
      }
    return result;
  }

  void AddPath(Polys& poly, unsigned brushClr, unsigned penClr, bool closed)
  {
    if (poly.size() == 0) return;
    CheckFonts();
    style.brushClr = brushClr;
    style.penClr = penClr;
    style.closePath = closed;
    PolyInfo pi = PolyInfo(poly, style);
    polyInfos.push_back(pi);
    UpdateBounds(poly);
  }
  //---------------------------------------------------------------------------

  void SetFont(std::string family, int size, unsigned fillColor)
  {
    FontInfo fi;
    fi.family = family;
    fi.size = size;
    fi.fillColor = fillColor;
    fontInfos.push_back(fi);
  }
  //---------------------------------------------------------------------------

  void AddText(double x, double y, const std::string& text)
  {
    CheckFonts();
    TextInfo ti = TextInfo(x, y, fontInfos.size() -1, text);
    textInfos.push_back(ti);
  }
  //---------------------------------------------------------------------------

  bool SaveToFile(const std::string filename, int width = 0, int height = 0, int margin = 10) const
  {
    if (margin < 0) margin = 0;
    double scale = 1.0;
    if (width > 0 && height > 0) 
      scale = 1.0 / max((bounds.right - bounds.left)/width, 
        (bounds.bottom-bounds.top)/height);
    ofstream file;
    file.open(filename);
    if (!file.is_open()) return false;
    file.setf(ios::fixed);
    file.precision(0);
    file << svg_xml_start[0] <<
      (int)((bounds.right - bounds.left) *scale + margin*2) << "px" << svg_xml_start[1] <<
      (int)((bounds.bottom-bounds.top) *scale + margin*2) << "px" << svg_xml_start[2] <<
      (int)((bounds.right - bounds.left) *scale + margin*2) << " " <<
      (int)((bounds.bottom-bounds.top) *scale + margin*2) << svg_xml_start[3];
    setlocale(LC_NUMERIC, "C");
    file.precision(1);

    for (PolyInfoList::size_type i = 0; i < polyInfos.size(); ++i)
    {
      file << " <path d=\"";
      for (Polygons::size_type j = 0; j < polyInfos[i].polygons.size(); ++j)
      {
        if (polyInfos[i].polygons[j].size() < 2) continue;
        file << " M " << ((double)(polyInfos[i].polygons[j][0].x-bounds.left) * scale + margin) <<
          " " << ((double)(polyInfos[i].polygons[j][0].y-bounds.top) * scale + margin);
        for (ClipperLib::Polygon::size_type k = 1; k < polyInfos[i].polygons[j].size(); ++k)
        {
          Point ip = polyInfos[i].polygons[j][k];
          double x = (ip.x - bounds.left) * scale + margin;
          double y = (ip.y - bounds.top) * scale + margin;
          file << " L " << x << " " << y;
        }
        if (polyInfos[i].si.closePath) file << " z";
      }
      if (polyInfos[i].si.closePath)
        file << 
          path_end_poly[0] << ColorToHtml(polyInfos[i].si.brushClr) <<
          path_end_poly[1] << GetAlphaAsFrac(polyInfos[i].si.brushClr) <<
          path_end_poly[2] << (polyInfos[i].si.pft == pftEvenOdd ? "evenodd" : "nonzero") <<
          path_end_poly[3] << ColorToHtml(polyInfos[i].si.penClr) <<
          path_end_poly[4] << GetAlphaAsFrac(polyInfos[i].si.penClr) <<
          path_end_poly[5] << polyInfos[i].si.penWidth << 
          path_end_poly[6];
      else
        file << 
          path_end_line[0] << ColorToHtml(polyInfos[i].si.penClr) <<
          path_end_line[1] << GetAlphaAsFrac(polyInfos[i].si.penClr) <<
          path_end_line[2] << polyInfos[i].si.penWidth << 
          path_end_line[3];

    }
    bool showCoords = false;
    for(size_t i = 0; i < polyInfos.size(); i++)
      if (polyInfos[i].si.showCoords) {showCoords = true; break;}

    if (!textInfos.empty() || showCoords) 
    {
      if (showCoords)
      {
        FontInfo fontInfo = fontInfos.front();
        file << "<g font-family=\"" << fontInfo.family << "\" font-size=\""<< 
          (int)ceil(scale * fontInfo.size) << "\" fill=\"" << ColorToHtml(fontInfo.fillColor) << "\">\n";
        for(size_t i = 0; i < polyInfos.size(); i++)
          if (polyInfos[i].si.showCoords)
          {
            for (Polygons::size_type j = 0; j < polyInfos[i].polygons.size(); ++j)
            {
              if (polyInfos[i].polygons[j].size() < 3) continue;
              for (ClipperLib::Polygon::size_type k = 0; k < polyInfos[i].polygons[j].size(); ++k)
              {
                Point ip = polyInfos[i].polygons[j][k];
                file << "  <text x=\"" << (int)((ip.x- bounds.left) * scale + margin) <<
                  "\" y=\"" << (int)((ip.y- bounds.top) * scale + margin) << "\">" <<
                  ip.x << ", " << ip.y << "</text>\n";
              }
            }
          }
        if (showCoords)  file << "</g>\n";
      }

      unsigned fi = INT_MAX;
      for (size_t i = 0; i < textInfos.size(); ++i)
      {
        TextInfo ti = textInfos[i];
        if (ti.fontIdx != fi)
        {
          if (fi != INT_MAX) file << "</g>\n";
          fi = ti.fontIdx;
          FontInfo fontInfo = fontInfos[fi];
          file << "<g font-family=\"" << fontInfo.family << "\" font-size=\""<< 
            (fontInfo.size* scale) << "\" fill=\"" << ColorToHtml(fontInfo.fillColor) << "\">\n";
        }
        file << "  <text x=\"" << (int)((ti.x- bounds.left) * scale + margin) <<
          "\" y=\"" << (int)((ti.y- bounds.top) * scale + margin) << "\">" <<
          ti.text << "</text>\n";
      }
      file << "</g>\n";
    }
    file << "</svg>\n";
    file.close();
    setlocale(LC_NUMERIC, "");
    return true;
  }
  //---------------------------------------------------------------------------

};
//------------------------------------------------------------------------------

const std::string SvgBase::svg_xml_start [] =
  {"<?xml version=\"1.0\" standalone=\"no\"?>\n"
   "<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.0//EN\"\n"
   "\"http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd\">\n\n"
   "<svg width=\"",
   "\" height=\"",
   "\" viewBox=\"0 0 ",
   "\" version=\"1.0\" xmlns=\"http://www.w3.org/2000/svg\">\n\n"
  };
const std::string SvgBase::path_end_poly [] =
  {"\"\n style=\"fill:",
   "; fill-opacity:",
   "; fill-rule:",
   "; stroke:",
   "; stroke-opacity:",
   "; stroke-width:",
   ";\"/>\n\n"
  };
const std::string SvgBase::path_end_line [] =
  {"\"\n style=\"fill:none; stroke:",
   "; stroke-opacity:",
   "; stroke-width:",
   ";\"/>\n\n"
  };

//------------------------------------------------------------------------------
//------------------------------------------------------------------------------

void SimpleSVG(const string filename, Polys& subj, Polys& clip, Polys& solution,
  int width = 1024, int height = 800)
{
  SvgBase svg;
  svg.style.pft = pftEvenOdd; 
  svg.AddPath(subj, 0x206666AC,0xCCD0D0DD, true);
  svg.AddPath(clip, 0x24666600, 0xCCDDDD80, true);
  svg.AddPath(solution, 0xFF99FF99, 0x40009900, true);
  //svg.SetFont("Verdana", 16, 0xFF0000AA);
  //svg.AddText(svg.bounds.left, svg.bounds.top + 20, "Clipper Benchmarks");
  //svg.SetFont("Verdana", 12, 0xFFAA0000);
  //svg.AddText(svg.bounds.left, svg.bounds.top + 36, "&#0169; Angus Johnson 2013");
  svg.SaveToFile(filename, width, height);
}
//------------------------------------------------------------------------------

inline long64 Round(double val)
{
  if ((val < 0)) return (long64)(val - 0.5); else return (long64)(val + 0.5);
}
//------------------------------------------------------------------------------

double Area(Poly& poly)
{
  int highI = poly.size() -1;
  if (highI < 2) return 0;
  double a;
  a = (poly[highI].x + poly[0].x) * (poly[0].y - poly[highI].y);
  for (int i = 1; i <= highI; ++i)
    a += (poly[i - 1].x + poly[i].x) * (poly[i].y - poly[i - 1].y);
  return a / 2;
}
//------------------------------------------------------------------------------

void Ellipse(Poly& p, double cx, double cy, double rx, double ry, int steps = 0)
{ 
  const double pi = 3.1415926535898, tolerance = 0.125;
  double r = (rx + ry)/2;
  if (steps <= 0) steps = int(pi / (acos(1 - tolerance / r)));
  if (steps < 3) steps = 3;
  p.resize(steps);
  double sn = sin(2 * pi / steps);
  double cs = cos(2 * pi / steps);
  Point pt = Point(1.0, 0);
  for (int i = 0; i < steps; i++)
  {
    p[i].x = cx + pt.x * rx;
    p[i].y = cy + pt.y * ry;
    //cross & dot products avoids repeat calls to sin() & cos() 
    pt = Point(pt.x * cs - sn * pt.y, pt.x * sn + pt.y * cs); 
  }
}
//------------------------------------------------------------------------------

void Star(Poly& p, double cx, double cy, double radius1, double radius2, 
  int count = 5, double offset_angle = 0.0)
{ 
  const double pi = 3.1415926535898;
  if (count <= 5) count = 5;
  count *= 2;
  p.resize(count);
  double sn = sin(2 * pi / count);
  double cs = cos(2 * pi / count);
  Point delta(1.0, 0);
  if (offset_angle != 0.0)
  {
    delta.x = cos(offset_angle / count);
    delta.y = sin(offset_angle / count);
  } 
  for (int i = 0; i < count; i++)
  {
    double r = (i % 2 == 0 ? radius1: radius2);
    p[i].x = cx + delta.x * r;
    p[i].y = cy + delta.y * r;
    //cross & dot products faster than repeat calls to sin() & cos() ...
    delta = Point(delta.x * cs - sn * delta.y, delta.x * sn + delta.y * cs); 
  }
}
//------------------------------------------------------------------------------

void MakeRandomPoly(Poly& poly, int width, int height, unsigned vertCnt)
{
  //stress_factor > 1 causes more frequent complex intersections with GPC crashes
  const int stress_factor = 10; 
  //make vertices a multiple of stress_factor ...
  poly.resize(vertCnt);
  int w = width / stress_factor, h = height / stress_factor;
  for (unsigned i = 0; i < vertCnt; ++i)
  {
    poly[i].x = (rand() % w) * stress_factor;
    poly[i].y = (rand() % h) * stress_factor;
  }
}
//---------------------------------------------------------------------------

bool LoadFromWlrFile(char *filename, Polys &pp) {
  FILE *f = fopen(filename, "r");
  if (!f) return false;
  int polyCnt, vertCnt, i, j;
  int X, Y;
  pp.clear();
  if ((fscanf(f, "%d", &i) == 1) &&
    (fscanf(f, "%d", &polyCnt) == 1) && (i == 1) && (polyCnt > 0)){
    pp.resize(polyCnt);
    for (i = 0; i < polyCnt; i++) {
      if (fscanf(f, "%d", &vertCnt) != 1) break;
      pp[i].resize(vertCnt);
      for (j = 0; j < vertCnt; j++){
        fscanf(f, "%d,%d", &X, &Y);
        pp[i][j].x = X; pp[i][j].y = Y;
      }
    }
  }
  fclose(f);
  return true;
}
//---------------------------------------------------------------------------

void gpc_clear_polygon(gpc_polygon& p)
{
  for (int i = 0; i < p.num_contours; ++i)
    if (p.contour[i].num_vertices > 0)
      delete [] p.contour[i].vertex;
  if (p.num_contours > 0)
  {
    delete [] p.contour;
    delete [] p.hole;
  }
  p.num_contours = 0;
  p.contour = 0;
  p.hole = 0;
}
//---------------------------------------------------------------------------

void LoadClipper(Polygons &p, Polys& polys)
{
  p.resize(polys.size());
  for (size_t i = 0; i < polys.size(); i++)
  {
    p[i].resize(polys[i].size());
    for (size_t j = 0; j < polys[i].size(); j++)
    {
      p[i][j].X = Round(polys[i][j].x *INT_SCALE);
      p[i][j].Y = Round(polys[i][j].y *INT_SCALE);
    };
  }
}
//---------------------------------------------------------------------------

void LoadPolyBool(PAREA** p, Polys& polys)
{
  for (size_t i = 0; i < polys.size(); i++)
  {
    PLINE2* pline = NULL;
    for (size_t j = 0; j < polys[i].size(); j++)
    {
      GRID2 g;
      g.x =  int(polys[i][j].x *INT_SCALE);
      g.y =  int(polys[i][j].y *INT_SCALE);
      PLINE2::Incl(&pline, g);
    }
    if(!pline) continue;
    pline->Prepare();
    PAREA::InclPline(p, pline);
  }
}
//---------------------------------------------------------------------------

void LoadGPC(gpc_polygon &p, Polys& polys)
{   
  gpc_clear_polygon(p); 
  p.num_contours = polys.size();
  p.hole = new int[p.num_contours];
  p.contour = new gpc_vertex_list[p.num_contours];
  for (int i = 0; i < p.num_contours; i++)
  {
    p.hole[i] = (Area(polys[i]) >= 0 ? 0 : 1); 
    size_t s = polys[i].size();
    p.contour[i].num_vertices = s;
    p.contour[i].vertex = new gpc_vertex [s];
    for (size_t j = 0; j < s; j++)
    {
      p.contour[i].vertex[j].x = polys[i][j].x;
      p.contour[i].vertex[j].y = polys[i][j].y;
    }
  }
}
//---------------------------------------------------------------------------

void LoadGGL(ggl_polygons &p, Polys& polys)
{   
  p.clear();
  if (polys.empty()) return;
  p.resize(polys.size());
  int cnt = -1;
  bool orientation;
  for (size_t i = 0; i < polys.size(); i++)
  {
    if (polys[i].empty()) continue;
    Poly& pg = polys[i]; 
    //get orientation of first polygon ...
    if (cnt < 0) orientation = Area(pg) >= 0;
    if (Area(pg) > 0 == orientation)
    {
      cnt++;
      ggl_ring& r = p[cnt].outer();
      r.resize(pg.size());
      for (size_t j = 0; j < pg.size(); j++)
        r[j] = ggl_point(pg[j].x,pg[j].y);
    }
    else
    {
      ggl_ring r;
      r.resize(pg.size());
      for (size_t j = 0; j < pg.size(); j++)
        r[j] = ggl_point(pg[j].x,pg[j].y);
      p[cnt].inners().push_back(r);
    }

  }
  cnt++;
  if (size_t(cnt) < p.size()) p.resize(cnt);
  for (int i = 0; i < cnt; i++)
    correct(p[i]);
}
//---------------------------------------------------------------------------

void UnloadClipper(Polys& polys, Polygons &p)
{
  polys.resize(p.size());
  for (size_t i = 0; i < p.size(); i++)
  {
    polys[i].resize(p[i].size());
    for (size_t j = 0; j < p[i].size(); j++)
    {
      polys[i][j].x = (double)p[i][j].X /INT_SCALE;
      polys[i][j].y = (double)p[i][j].Y /INT_SCALE;
    };
  }
}
//---------------------------------------------------------------------------

void UnloadPolyBool(Polys& polys, PAREA* p)
{
  //count the total number of contours ...
  size_t i = 0;
  PAREA* pa = p;  
  for(;;)
  {
    PLINE2* contour = pa->cntr;
    while (contour)
    {
      i++;
      contour = contour->next;
    }
    pa = pa->f;
    if (pa == p) break;
  }

  polys.resize(i);
  i = 0;
  for(;;)
  {
    PLINE2* contour = pa->cntr;
    while (contour)
    {
      polys[i].resize(contour->Count);
      if (contour->Count > 0) 
      {
        VNODE2 * h = contour->head;
        int j = 0;
        for(;;)
        {
          polys[i][j].x = (double)h->g.x /INT_SCALE;
          polys[i][j].y = (double)h->g.y /INT_SCALE;
          if (++j == contour->Count) break;
          h = h->next;
        }
      }
      contour = contour->next;
    }
    i++;
    pa = pa->f;
    if (pa == p) break;
  }
}
//---------------------------------------------------------------------------

void UnloadGPC(Polys& polys, gpc_polygon &p)
{
  polys.resize(p.num_contours);
  for (int i = 0; i < p.num_contours; i++)
  {
    gpc_vertex_list vs = p.contour[i];
    polys[i].resize(vs.num_vertices);
    for (int j = 0; j < vs.num_vertices; j++)
    {
      polys[i][j].x = vs.vertex[j].x;
      polys[i][j].y = vs.vertex[j].y;
    };
  }
}
//---------------------------------------------------------------------------

void UnloadGGL(Polys& polys, ggl_polygons &p)
{   
  int cc = 0;
  for (size_t i = 0; i < p.size(); i++)
    cc += 1 + p[i].inners().size();
  polys.resize(cc);
  cc = 0;
  for (size_t i = 0; i < p.size(); i++)
  {
    polys[cc].resize(p[i].outer().size());
    for (size_t j = 0; j < p[i].outer().size(); j++)
      polys[cc][j] = Point(p[i].outer()[j].x(), p[i].outer()[j].y());
    cc++;
    for (size_t k = 0; k < p[i].inners().size(); k++)
    {
      polys[cc].resize(p[i].inners()[k].size());
      for (size_t j = 0; j < p[i].inners()[k].size(); j++)
        polys[cc][j] = Point(p[i].inners()[k][j].x(), p[i].inners()[k][j].y());
      cc++;
    }
  }
}
//---------------------------------------------------------------------------

int CountVertices(Polys& p)
{
  int cnt = 0;
  for (size_t i = 0; i < p.size(); i++)
    for (size_t j = 0; j < p[i].size(); j++)
      cnt++;
  return cnt;
}
//---------------------------------------------------------------------------

double DoClipper(Polys& subj, Polys& clip, Polys& solution, bool_type bt = Intersection)
{
  Polygons clipper_subj, clipper_clip, clipper_solution;
  LoadClipper(clipper_subj, subj);
  LoadClipper(clipper_clip, clip);
  double elapsed = 0;

  ClipType op = ctIntersection;
  switch (bt)
  {
    case Union: op = ctUnion; break;
    case Difference: op = ctDifference; break;
    case Xor: op = ctXor; break;
    default: op = ctIntersection; break;
  }

  clock_t t = clock();
  Clipper cp;
  cp.AddPolygons(clipper_subj, ptSubject);
  cp.AddPolygons(clipper_clip, ptClip);
  if (cp.Execute(op, clipper_solution, pftEvenOdd, pftEvenOdd))
    elapsed = double(clock() - t) *1000 / CLOCKS_PER_SEC;

  UnloadClipper(solution, clipper_solution);
  return elapsed;
}
//---------------------------------------------------------------------------

double DoPolyBool(Polys& subj, Polys& clip, Polys& solution, bool_type bt = Intersection)
{
#ifdef _DEBUG
  return 0; //PolyBool code crashes when debugging
#endif
  PAREA *A = NULL, *B = NULL, *R = NULL;
  LoadPolyBool(&A, subj);
  LoadPolyBool(&B, clip);
  double elapsed = 0;

  PAREA::PBOPCODE op = PAREA::IS;
  switch (bt)
  {
    case Union: op = PAREA::UN; break;
    case Difference: op = PAREA::SB; break;
    case Xor: op = PAREA::XR; break;
    default: op = PAREA::IS; break;
  }

  clock_t t = clock();
  if (PAREA::Boolean(A, B, &R, op) == 0)
    elapsed = double(clock() - t) *1000 / CLOCKS_PER_SEC;
  if (R) UnloadPolyBool(solution, R);
  PAREA::Del(&A); PAREA::Del(&B); PAREA::Del(&R);
  return elapsed;
}
//---------------------------------------------------------------------------

double DoGPC(Polys& subj, Polys& clip, Polys& solution, bool_type bt = Intersection)
{
  gpc_polygon gpc_subj, gpc_clip, gpc_solution;
  gpc_subj.num_contours = 0;
  gpc_clip.num_contours = 0;
  gpc_solution.num_contours = 0;
  LoadGPC(gpc_subj, subj);
  LoadGPC(gpc_clip, clip);
  gpc_op op = GPC_INT;
  switch (bt)
  {
    case Union: op = GPC_UNION; break;
    case Difference: op = GPC_DIFF; break;
    case Xor: op = GPC_XOR; break;
    default: op = GPC_INT; break;
  }
  double elapsed = 0;
  clock_t t = clock();
#ifdef _WIN32
  //This Windows specific function adds Structured Exception Handling  
  //and prevents *most* GPC crashes ...
  __try
  {
    gpc_polygon_clip(op, &gpc_subj, &gpc_clip, &gpc_solution);
  }
  __except (EXCEPTION_EXECUTE_HANDLER) {return 0;}
#else
  gpc_polygon_clip(GPC_INT, subj, clip, sol);
#endif
  elapsed += double(clock() - t) *1000 / CLOCKS_PER_SEC;
  if (elapsed != elapsed) elapsed = 0; //test for NAN

  UnloadGPC(solution, gpc_solution);
  gpc_clear_polygon(gpc_subj); 
  gpc_clear_polygon(gpc_clip); 
  gpc_clear_polygon(gpc_solution);
  return elapsed;
}
//---------------------------------------------------------------------------

double DoGGL(Polys& subj, Polys& clip, Polys& solution, bool_type bt = Intersection)
{
  ggl_polygons ggl_subj, ggl_clip, ggl_solution;
  LoadGGL(ggl_subj, subj);
  LoadGGL(ggl_clip, clip);
  double elapsed = 0;
  clock_t t = clock();
  switch (bt)
  {
    case Union: union_(ggl_subj, ggl_clip, ggl_solution); break;
    case Difference: difference(ggl_subj, ggl_clip, ggl_solution); break;
    case Xor: sym_difference(ggl_subj, ggl_clip, ggl_solution); break;
    default: intersection(ggl_subj, ggl_clip, ggl_solution); 
  }
  elapsed = double(clock() - t) *1000 / CLOCKS_PER_SEC;

  UnloadGGL(solution, ggl_solution);
  ggl_subj.clear(); 
  ggl_clip.clear(); 
  ggl_solution.clear();
  return elapsed;
}
//---------------------------------------------------------------------------

int MakeShrinkingEllipses(Polys& p, int count, Point& center, Point& radius, double step)
{
  p.resize(count);
  int result = 0;
  for (int i = 0; i < count; i++)
  {
    if (i*step +1 >= radius.x || i*step +1 >= radius.y)
    {
      p.resize(i);
      break;
    }
    Ellipse(p[i], center.x ,center.y, radius.x - (i*step), radius.y - (i*step), 0);
    result += p[i].size();
    if(i % 2 != 0) reverse(p[i].begin(), p[i].end());
  }
  return result;
}
//---------------------------------------------------------------------------

int MakeShrinkingRects(Polys& p, int count, Point& center, Point& radius, double step)
{
  p.resize(count);
  for(int i = 0; i < count; i++)
  {
    if (i*step +1 >= radius.x || i*step +1 >= radius.y) break;
    p[i].resize(4);
    p[i][0] = Point(center.x - radius.x + (i*step), center.y - radius.y + (i*step));
    p[i][1] = Point(center.x + radius.x - (i*step), center.y - radius.y + (i*step));
    p[i][2] = Point(center.x + radius.x - (i*step), center.y + radius.y - (i*step));
    p[i][3] = Point(center.x - radius.x + (i*step), center.y + radius.y - (i*step));
    if(i % 2 != 0) reverse(p[i].begin(), p[i].end());
  }
  return count * 4;
}
//---------------------------------------------------------------------------

int MakeFanBlades(Polys& p, int blade_cnt, Point& center, Point& radius)
{
  const int inner_rad = 60;
  blade_cnt *= 2;
  if (blade_cnt < 8) blade_cnt = 8;
  if (radius.x < inner_rad +10) radius.x = inner_rad +10;
  if (radius.y < inner_rad +10) radius.y = inner_rad +10;
  p.resize(1);
  Poly &pg = p.back(), inner, outer;
  Ellipse(outer, center.x,center.y, radius.x, radius.y, blade_cnt);
  Ellipse(inner, center.x,center.y, inner_rad, inner_rad, blade_cnt);
  pg.resize(blade_cnt*2);
  for (int i = 0; i +1 < blade_cnt; i+=2)
  {
    pg[i*2]    = inner[i];
    pg[i*2 +1] = outer[i];
    pg[i*2 +2] = outer[i+1];
    pg[i*2 +3] = inner[i+1];
  }
  return blade_cnt *2;
}
//---------------------------------------------------------------------------

//int MakeFanBlades2(Polys& p, int blade_cnt, Point& center, Point& radius)
//{
//  blade_cnt *= 2;
//  if (blade_cnt < 8) blade_cnt = 8;
//  if (radius.x < 40) radius.x = 40;
//  if (radius.y < 40) radius.y = 40;
//  p.resize(1);
//  Poly &pg = p[0], inner, outer;
//  Ellipse(outer, center.x,center.y, radius.x, radius.y, blade_cnt);
//  pg.resize(blade_cnt*3/2);
//  int j = 0;
//  for (int i = 0; i +1 < blade_cnt; i+=2)
//  {
//    pg[j] = outer[i];
//    pg[j+1] = outer[i+1];
//    pg[j+2] = center;
//    j += 3;
//  }
//  return blade_cnt *3/2;
//}
//---------------------------------------------------------------------------

void StarTest()
{
  Polys subj(1), clip(1), sol;
  double elapsed = 0;
  cout << "\nStar Test:\n";

  Point center1 = Point(310,320);
  Star(subj[0], 325, 325, 300, 150, 250, 0.0);
  Star(clip[0], 325, 325, 300, 150, 250, 0.005);

  cout << "No. vertices in subject & clip polygons: " << CountVertices(subj) + CountVertices(clip) << '\n';
  elapsed = DoGPC(subj, clip, sol, Xor);
  cout << "GPC Time:      " << elapsed << " msecs\n";
  elapsed = DoPolyBool(subj, clip, sol, Xor);
  cout << "PolyBool Time: " << elapsed << " msecs\n";
  elapsed = DoClipper(subj, clip, sol, Xor);
  cout << "Clipper Time:  " << elapsed << " msecs\n";
  elapsed = DoGGL(subj, clip, sol, Xor);
  SimpleSVG("st_stars.svg", subj, clip, sol, 0, 0); //can do this after any of the above
  cout << "GGL Time:      " << elapsed << " msecs\n";
  cout << "Test finished. ('st_classic.svg' file created)\n\n";
}
//---------------------------------------------------------------------------

void ClassicTest()
{
  Polys subj, clip, sol;
  double elapsed = 0;

  cout << "\nClassic Test:\n";
  if (!LoadFromWlrFile("s.wlr", subj) || !LoadFromWlrFile("c.wlr", clip))
  {
    cout << "\nUnable to find or load 's.wlr' or 'c.wlr'.\n";
    cout << "Aborting test.\n";
    return;
  }

  cout << "No. vertices in subject & clip polygons: " << CountVertices(subj) + CountVertices(clip) << '\n';
  elapsed = DoGPC(subj, clip, sol);
  cout << "GPC Time:      " << elapsed << " msecs\n";
  elapsed = DoPolyBool(subj, clip, sol);
  cout << "PolyBool Time: " << elapsed << " msecs\n";
  elapsed = DoClipper(subj, clip, sol);
  cout << "Clipper Time:  " << elapsed << " msecs\n";
  elapsed = DoGGL(subj, clip, sol);
  cout << "GGL Time:      " << elapsed << " msecs\n";
  SimpleSVG("st_classic.svg", subj, clip, sol, 600, 600); //can do this after any of the above
  cout << "Test finished. ('st_classic.svg' file created)\n\n";
}
//---------------------------------------------------------------------------

void EllipseAndFanTest()
{
  Polys subj, clip, sol;
  double elapsed = 0;
  cout << "\nEllipses and Fan Test:\n";

  Point center1 = Point(310,320), center2 = Point(410,350);
  MakeShrinkingEllipses(subj, 80, center1, Point(290, 320), 5);
  MakeFanBlades(clip, 64, center2, Point(340,300));

  cout << "No. vertices in subject & clip polygons: " << CountVertices(subj) + CountVertices(clip) << '\n';
  elapsed = DoGPC(subj, clip, sol);
  cout << "GPC Time:      " << elapsed << " msecs\n";
  elapsed = DoPolyBool(subj, clip, sol);
  cout << "PolyBool Time: " << elapsed << " msecs\n";
  elapsed = DoClipper(subj, clip, sol);
  cout << "Clipper Time:  " << elapsed << " msecs\n";
  elapsed = DoGGL(subj, clip, sol);
  cout << "GGL Time:      " << elapsed << " msecs\n";

  SimpleSVG("st_ellipse_fan.svg", subj, clip, sol, 0, 0); //can do this after any of the above
  cout << "Test finished. ('st_ellipse_fan.svg' file created)\n\n";
}
//---------------------------------------------------------------------------

void EllipseAndRectTest()
{
  Polys subj, clip, sol;
  double elapsed = 0;
  cout << "\nEllipses and Rectangles Test:\n";

  Point center1 = Point(310,320), center2 = Point(410,350);
  MakeShrinkingEllipses(subj, 80, center1, Point(290, 320), 5);
  MakeShrinkingRects(clip, 80, center2, Point(340, 300), 5);

  cout << "No. vertices in subject & clip polygons: " << CountVertices(subj) + CountVertices(clip) << '\n';
  elapsed = DoGPC(subj, clip, sol);
  cout << "GPC Time:      " << elapsed << " msecs\n";
  elapsed = DoPolyBool(subj, clip, sol);
  cout << "PolyBool Time: " << elapsed << " msecs\n";
  elapsed = DoClipper(subj, clip, sol);
  cout << "Clipper Time:  " << elapsed << " msecs\n";
  elapsed = DoGGL(subj, clip, sol);
  cout << "GGL Time:      " << elapsed << " msecs\n";

  SimpleSVG("st_ellipse_rect.svg", subj, clip, sol, 0, 0); //can do this after any of the above
  cout << "Test finished. ('st_ellipse_rect.svg' file created)\n\n";
}
//---------------------------------------------------------------------------

void SelfIntersectTest()
{
  const unsigned VERT_COUNT = 100, LOOP_COUNT = 100;
  Polys subj(1), clip(1), sol;
  cout << "\nSelf-intersect Test:\n";
  cout << "Both subject and clip polygons have " << VERT_COUNT << " vertices.\n";
  cout << "This test is repeated " << LOOP_COUNT << " times using randomly generated coordinates ...\n";
  int errors_Clipper = 0, errors_GPC = 0;
  double elapsed_Clipper = 0, elapsed_GPC = 0, elapsed;
  for (unsigned i = 0; i < LOOP_COUNT; ++i)
  {
    MakeRandomPoly(subj[0], 600, 400, VERT_COUNT);
    MakeRandomPoly(clip[0], 600, 400, VERT_COUNT);

#ifndef _DEBUG //otherwise multiple crashes
    elapsed = DoGPC(subj, clip, sol);
    if (elapsed == 0) errors_GPC++;
    else elapsed_GPC += elapsed;
#endif

    elapsed = DoClipper(subj, clip, sol);
    if (elapsed == 0) errors_Clipper++;
    else elapsed_Clipper += elapsed;

    if (LOOP_COUNT >= 500 && i % 100 == 0) cout << (LOOP_COUNT - i)/100 << "."; //show something's happening
  }
  if (LOOP_COUNT >= 500) cout << "Done\n";
  cout << "GPC Time:      " << elapsed_GPC << " msecs. (Failed " << errors_GPC << " times)\n";
  cout << "PolyBool Time: N/A\n"; //PolyBool does not do boolean ops on self-intersecting polygons
  cout << "Clipper Time:  " << elapsed_Clipper << " msecs. (Failed " << errors_Clipper << " times)\n";
  cout << "GGL Time:      N/A\n"; //GGL does not do boolean ops on self-intersecting polygons
  SimpleSVG("st_complex.svg", subj, clip, sol, 0, 0); //to prove it works
  cout << "Test finished. ('st_complex.svg' file created)\n\n";
}
//---------------------------------------------------------------------------

#ifdef __BORLANDC__
int _tmain(int argc, _TCHAR* argv[])
#else
int main(int argc, char* argv[])
#endif
{
  srand ((unsigned)time(NULL));

  ClassicTest();
  EllipseAndFanTest();
  EllipseAndRectTest();
  StarTest();

  SelfIntersectTest();

  return 0;
}
//---------------------------------------------------------------------------
