function clamp(x, min_value, max_value) {
	return Math.min(max_value, Math.max(min_value, x));
}

class Point2D {
	constructor(x, y) {
		this.x = x;
		this.y = y;
	}
}

class BBox2D {
	constructor(startx, starty, width, height) {
		this.bmin = new Point2D(startx, starty);
		this.bmax = new Point2D(this.bmin.x + width, this.bmin.y + height);
	}

	// return width of the box
	get width() {
		return this.bmax.x - this.bmin.x;
	}

	// return height of the box
	get height() {
		return this.bmax.y - this.bmin.y;
	}

	// return area of bounding box
	get area() {
		return (this.bmax.x - this.bmin.x) * (this.bmax.y - this.bmin.y);
	}

	set(startx, starty, width, height) {
		this.bmin.x = startx;
		this.bmin.y = starty;
		this.bmax.x = this.bmin.x + width;
		this.bmax.y = this.bmin.y + height;
	}

	isEmpty() {
		return (this.bmin.x >= this.bmax.y || this.bmin.y >= this.bmax.y);
	}

	// returns true if the point (x,y) is inside the bounding box.  Edges of the box
	// are treated as part of the box. 
	inside(x, y) {
		if (x >= this.bmin.x && x <= this.bmax.x &&
			y >= this.bmin.y && y <= this.bmax.y)
			return true;
		else
			return false;
	}

	// create a new bbox that is a scaled version of this one. scaling given by (sx,sy)
	scale(sx, sy) {
		var minx = this.bmin.x * sx;
		var miny = this.bmin.y * sy;
		var maxx = this.bmax.x * sx;
		var maxy = this.bmax.y * sy;
		return new BBox2D(minx, miny, maxx-minx, maxy-miny)
	}

	// converts an array of four extreme points to a bbox
	static extreme_points_to_bbox(pts) {

		// pts[0] = left extreme
		// pts[1] = top extreme
		// pts[2] = right extreme
		// pts[3] = bottom extreme

		var startx = pts[0].x;
		var starty = pts[1].y;
		var endx = pts[2].x;
		var endy = pts[3].y;

		var b = new BBox2D(startx, starty, endx - startx, endy - starty);
		return b;
	}

	// converts an array of two points to a bbox.  The code makes no assumptions about
	// which point in the array is which corner of the bbox. 
	static two_points_to_bbox(pts) {

		var startx = Math.min(pts[0].x, pts[1].x);
		var starty = Math.min(pts[0].y, pts[1].y);
		var endx = Math.max(pts[0].x, pts[1].x);
		var endy = Math.max(pts[0].y, pts[1].y);

		var b = new BBox2D(startx, starty, endx - startx, endy - starty);
		return b;
	}

	// Returns true if this is a valid set of extreme points, false otherwise.
	//
	// To be valid, the first point should be the leftmost point, the second point
	// should be the uppermost one, the third point should be the rightmost,
	// and the fourth point should be bottommost.
	static validate_extreme_points(pts) {

		if (pts[0].x > pts[1].x ||
			pts[0].x > pts[2].x ||
			pts[0].x > pts[3].x)
			return false;
		if (pts[1].y > pts[1].y ||
			pts[1].y > pts[2].y ||
			pts[1].y > pts[3].y)
			return false;
		if (pts[2].x < pts[1].x ||
			pts[2].x < pts[2].x ||
			pts[2].x < pts[3].x)
			return false;
		if (pts[3].y < pts[1].y ||
			pts[3].y < pts[2].y ||
			pts[3].y < pts[3].y)
			return false;

		return true;
	}
}