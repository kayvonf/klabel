
/*
	TODO list:
	* add support for per-frame (rather than per instance) categorial annotations
	* UI for zooming (and unzooming)
	* improve selection mechanism for boxes/points
	* API for returning box/point data to client (including extreme points)
	* detect invalid extreme points as early as possible (before end of box)

	LICENSES OF THINGS I USED:
	* This is the "click1" sound:
	  https://www.zapsplat.com/music/metal-impact-small-plate-disc-hit-vibrate-and-resonate-2/
*/

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

class Annotation {
	static get ANNOTATION_MODE_PER_FRAME() { return 0; }
	static get ANNOTATION_MODE_POINT() { return 1; }
	static get ANNOTATION_MODE_TWO_POINTS_BBOX() { return 2; }
	static get ANNOTATION_MODE_EXTREME_POINTS_BBOX() { return 3; }
	constructor(type) {
		this.type = type;
	}
}

class PerFrameAnnotation extends Annotation {
	constructor(value) {
		super(Annotation.ANNOTATION_MODE_PER_FRAME);
		this.value;
	}
}

class PointAnnotation extends Annotation {
	constructor(pt) {
		super(Annotation.ANNOTATION_MODE_POINT);
		this.pt = pt;
	}
}

class TwoPointBoxAnnotation extends Annotation {
	constructor(corner_pts) {
		super(Annotation.ANNOTATION_MODE_TWO_POINTS_BBOX);
		this.bbox = BBox2D.two_points_to_bbox(corner_pts);
	}
}

class ExtremeBoxAnnnotation extends Annotation {
	constructor(extreme_points) {
		super(Annotation.ANNOTATION_MODE_EXTREME_POINTS_BBOX);
		this.bbox = BBox2D.extreme_points_to_bbox(extreme_points);
		this.extreme_points = extreme_points;
	}
}

class ImageData {
	constructor() {
		this.source_url = "";
		this.annotations = [];
	}
}

class Frame {
	constructor(image_data) {
		this.data = image_data;
		this.image_load_started = false;
		this.image_load_complete = false;
		this.source_image = new Image;
	}
}

class ImageLabeler {

	constructor() {

		this.main_canvas_el = null;

		this.cursorx = Number.MIN_SAFE_INTEGER;
		this.cursory = Number.MIN_SAFE_INTEGER;

		this.spaceKeyDown = false;
		this.shiftKeyDown = false;

		// this structure holds the annotation data
		this.current_frame_index = 0;
		this.frames = [];

		// annotation state
		this.annotation_mode = Annotation.ANNOTATION_MODE_EXTREME_POINTS_BBOX;
		this.inProgressPoints = [];

		// audio
		this.audio_click_sound = null;
		this.audio_box_done_sound = null;

		// colors
		this.color_main_canvas = '#202020';
		this.color_cursor_lines = 'rgba(0,255,255,0.5)';
		this.color_in_progress_box_outline = 'rgba(255,255,255,0.75)';
		this.color_box_outline = 'rgba(255,200,0,0.75)';
		this.color_selected_box_outline = 'rgba(255,200,100,1.0)';
		this.color_selected_box_fill = 'rgba(255,200,150,0.2)';
		this.color_extreme_point_fill = '#ffff00';
		this.color_point_fill = '#ffff00';
		this.color_selected_point_fill = '#ff0000';
		this.color_per_frame_annotation_outline = 'rgba(255,50,50,0.5)';

		// display settings
		this.visible_image_region = new BBox2D(0.0, 0.0, 1.0, 1.0);
		this.letterbox_image = true;  // if false, stretch image to fill canvas
		this.play_audio = false;
		this.show_extreme_points = true;
		this.extreme_point_radius = 3;
	}

	// Clamp the cursor to the image dimensions so that clicks,
	// and (resulting bounding boxes) are always within the image
	set_canvas_cursor_position(x,y) {
		this.cursorx = clamp(x, 0, this.main_canvas_el.width);
		this.cursory = clamp(y, 0, this.main_canvas_el.height);	
	}

	get_current_frame() {
		return this.frames[this.current_frame_index];
	}

	// convert point in canvas pixel coordinates to normalized [0,1]^2 image space coordinates
	canvas_to_image(pt) {

		var cur_frame = this.get_current_frame();

		var visible_box = this.visible_image_region.scale(cur_frame.source_image.width, cur_frame.source_image.height);
		var display_box = this.compute_display_box();

		// pixel space coordinates
		var image_pixel_x = visible_box.bmin.x + visible_box.width * (pt.x - display_box.bmin.x) / display_box.width;
		var image_pixel_y = visible_box.bmin.y + visible_box.height * (pt.y - display_box.bmin.y) / display_box.height;

		// normalized image space coordinates 
		var norm_x = clamp(image_pixel_x / cur_frame.source_image.width, 0.0, 1.0);
		var norm_y = clamp(image_pixel_y / cur_frame.source_image.height, 0.0, 1.0);

		return new Point2D(norm_x, norm_y);
	}

	// convert point in normalized [0,1]^2 image space coordinates to canvas pixel coordinates
	image_to_canvas(pt) {
		
		var cur_frame = this.get_current_frame();

		var visible_box = this.visible_image_region.scale(cur_frame.source_image.width, cur_frame.source_image.height);
		var display_box = this.compute_display_box();

		// pixel space coordinates of pt
		var image_pixel_x = pt.x * cur_frame.source_image.width;
		var image_pixel_y = pt.y * cur_frame.source_image.height;

		// convert into normalized coordinates in the visible region
		var visible_region_x = (image_pixel_x - visible_box.bmin.x) / visible_box.width;
		var visible_region_y = (image_pixel_y - visible_box.bmin.y) / visible_box.height;

		var display_x = display_box.bmin.x + visible_region_x * display_box.width;
		var display_y = display_box.bmin.y + visible_region_y * display_box.height;

		return new Point2D(display_x, display_y);
	}

	is_hovering() {
		return (this.cursorx >= 0 && this.cursory >= 0);
	}

	is_annotation_mode_per_frame() {
		return this.annotation_mode == Annotation.ANNOTATION_MODE_PER_FRAME;
	}

	is_annotation_mode_point() {
		return this.annotation_mode == Annotation.ANNOTATION_MODE_POINT;
	}

	is_annotation_mode_two_point_bbox() {
		return this.annotation_mode == Annotation.ANNOTATION_MODE_TWO_POINTS_BBOX;
	}

	is_annotation_mode_extreme_points_bbox() {
		return this.annotation_mode == Annotation.ANNOTATION_MODE_EXTREME_POINTS_BBOX;
	}

	// returns the index of the annotation that is the "selected annotation" given
	// the current mouse position
	get_selected_object() {

		var selected = -1;

		if (!this.is_hovering())
			return selected;

		var image_cursor_pt = this.canvas_to_image(new Point2D(this.cursorx, this.cursory));

		var cur_frame = this.get_current_frame();

		// select the smallest (area) annotation the cursor is within
		var smallest_area = Number.MAX_VALUE;
		for (var i=0; i<cur_frame.data.annotations.length; i++) {
			
			if (cur_frame.data.annotations[i].type == Annotation.ANNOTATION_MODE_POINT) {

				if (image_cursor_pt.x == cur_frame.data.annotations[i].x &&
					image_cursor_pt.y == cur_frame.data.annotations[i].y) {
					selected = i;
					smallest_area = 0.0;
				}

			} else if (cur_frame.data.annotations[i].type == Annotation.ANNOTATION_MODE_TWO_POINTS_BBOX ||
					   cur_frame.data.annotations[i].type == Annotation.ANNOTATION_MODE_EXTREME_POINTS_BBOX) {

				if (cur_frame.data.annotations[i].bbox.inside(image_cursor_pt.x, image_cursor_pt.y) &&
					cur_frame.data.annotations[i].bbox.area < smallest_area) {
					selected = i;
					smallest_area = cur_frame.data.annotations[i].bbox.area;
				}
			}
		}

		return selected;			
	}

	clear_in_progress_points() {
		this.inProgressPoints = [];
	}

	delete_box() {

		var cur_frame = this.get_current_frame();
		var selected = this.get_selected_object();

		if (selected != -1) {
			cur_frame.data.annotations.splice(selected, 1);
			console.log("KLabeler: Deleted box " + selected);
		}

		this.render();
	}

	toggle_per_frame_annotation() {

		var cur_frame = this.get_current_frame();

		// NOTE(kayvonf): this functionality only works for binary per-frame annotations.
		// In the future consider extending to any categorical per-frame annotation.

		// if a per-frame annotation exists, remove it
		for (var i=0; i<cur_frame.data.annotations.length; i++) {
			if (cur_frame.data.annotations[i].type == Annotation.ANNOTATION_MODE_PER_FRAME) {
				cur_frame.data.annotations.splice(i, 1);
				console.log("KLabeler: removed per-frame annotation");
				return;
			}
		}

		cur_frame.data.annotations.push(new PerFrameAnnotation(1));
		console.log("KLabeler: adding per-frame annotation");
	}

	play_click_audio() {

		// if there are no in progress points, then this must be the last click needed to
		// make an annotation play the sound corresponding to a finished annotation. 
		if (this.inProgressPoints.length == 0) {

			// stop other sounds
			this.audio_click_sound.pause();

			// play the end of box sound

			// if the sound is aready playing then the subsequent call to play() will do nothing
			// and the audio will keep playing from that point it is currently at.
			// (Or if the audio is paused, play() will resume from the paused point)
			// So I reset the playpack point of the sound to the start of the timeline so that
			// the sound plays again from the start.
			this.audio_box_done_sound.currentTime = 0.0;					
			this.audio_box_done_sound.play();

		} else {

			// stop other sounds
			this.audio_box_done_sound.pause();

			// play the click sound
			this.audio_click_sound.currentTime = 0.0;					
			this.audio_click_sound.play();
		}
	}

	// computes the canvas-space bounding box of the rendered image
	compute_display_box() {

		// visible region of the image in the image's pixel space

		var cur_frame = this.get_current_frame();
		var visible_box = this.visible_image_region.scale(cur_frame.source_image.width, cur_frame.source_image.height); 

		// by default: scale the image to fill the entire canvas
		var display_startx = 0;
		var display_starty = 0;
		var display_width = this.main_canvas_el.width;
		var display_height = this.main_canvas_el.height;;

		if (this.letterbox_image) {

			var aspect_canvas = this.main_canvas_el.height / this.main_canvas_el.width;
			var aspect_visible  = visible_box.height / visible_box.width;

			if (aspect_canvas >= aspect_visible) {
				// canvas is taller than the visible part of the image, so letterbox the top and bottom
				display_width = this.main_canvas_el.width;
				display_height = this.main_canvas_el.width * aspect_visible;
				display_startx = 0; 
				display_starty = (this.main_canvas_el.height - display_height) / 2;

			} else {
				// canvas is wider than the visible part of the image, so letterbox the left and right
				display_height = this.main_canvas_el.height;
				display_width = this.main_canvas_el.height / aspect_visible;
				display_startx = (this.main_canvas_el.width - display_width) / 2;
				display_starty = 0; 
			}
		}

		return new BBox2D(display_startx, display_starty, display_width, display_height);
	}

	draw_inprogress_extreme_points_bbox(ctx, canvas_in_progress_points) {

		// draw the points we've locked down
		ctx.beginPath();
		ctx.moveTo(canvas_in_progress_points[0].x, canvas_in_progress_points[0].y);
		for (var i=1; i<canvas_in_progress_points.length; i++) {
			var cornerx = 0;
			var cornery = 0;
			if (i == 1) {
				cornerx = canvas_in_progress_points[0].x;
				cornery = canvas_in_progress_points[1].y;
			} else if (i == 2) {
				cornerx = canvas_in_progress_points[2].x;
				cornery = canvas_in_progress_points[1].y;
			} else if (i == 3) {
				cornerx = canvas_in_progress_points[0].x;
				cornery = canvas_in_progress_points[3].y;
			}
			ctx.lineTo(cornerx, cornery);
		}

		// now draw the tentative point
		if (this.is_hovering()) {
			if (canvas_in_progress_points.length == 1) {
				ctx.lineTo(canvas_in_progress_points[0].x, this.cursory);		
				ctx.lineTo(this.cursorx, this.cursory);
			} else if (canvas_in_progress_points.length == 2) {
				ctx.lineTo(this.cursorx, canvas_in_progress_points[1].y);
				ctx.lineTo(this.cursorx, this.cursory);
			} else if (canvas_in_progress_points.length == 3) {
				ctx.lineTo(canvas_in_progress_points[2].x, this.cursory);
				// extrapolation of rest of box
				ctx.lineTo(canvas_in_progress_points[0].x, this.cursory);
				ctx.lineTo(canvas_in_progress_points[0].x, canvas_in_progress_points[0].y);
			}
		}
		ctx.stroke();

		// draw dots at all the extreme points
		var full_circle_angle = 2 * Math.PI;
		ctx.fillStyle = this.color_extreme_point_fill;
		for (var i=0; i<canvas_in_progress_points.length; i++) {
			ctx.beginPath();
				ctx.arc(canvas_in_progress_points[i].x, canvas_in_progress_points[i].y, this.extreme_point_radius, 0, full_circle_angle, false);
	        ctx.fill();
		}	
	}

	draw_inprogress_two_points_bbox(ctx, canvas_in_progress_points) {

		var pts = []
		pts.push(canvas_in_progress_points[0]);
		pts.push(new Point2D(this.cursorx, this.cursory));

		var box = BBox2D.two_points_to_bbox(pts);
		var w = box.bmax.x - box.bmin.x;
		var h = box.bmax.y - box.bmin.y;
		ctx.strokeRect(box.bmin.x, box.bmin.y, w, h);
	}

	render() {

		var ctx = this.main_canvas_el.getContext('2d');

		ctx.fillStyle = this.color_main_canvas;
		ctx.fillRect(0, 0, this.main_canvas_el.width, this.main_canvas_el.height);

		var cur_frame = this.get_current_frame();

		// draw the image to label

		if (cur_frame.image_load_complete) {

			var visible_box = this.visible_image_region.scale(cur_frame.source_image.width, cur_frame.source_image.height);
			var display_box = this.compute_display_box();

			ctx.drawImage(cur_frame.source_image,
				visible_box.bmin.x, visible_box.bmin.y, visible_box.width, visible_box.height,
				display_box.bmin.x, display_box.bmin.y, display_box.width, display_box.height);
		}

		// draw guidelines that move with the mouse cursor

		if (this.is_hovering()) {
			ctx.lineWidth = 1;
			ctx.strokeStyle = this.color_cursor_lines;

			ctx.beginPath();
			ctx.moveTo(this.cursorx, 0);
			ctx.lineTo(this.cursorx, this.main_canvas_el.height);
			ctx.stroke();

			ctx.beginPath();
			ctx.moveTo(0, this.cursory);
			ctx.lineTo(this.main_canvas_el.width, this.cursory);
			ctx.stroke();
		}

		// draw existing annotations.  These annotations may be bounding boxes or points 
		
		var selected = this.get_selected_object();

		for (var obj_id=0; obj_id<cur_frame.data.annotations.length; obj_id++) {

			var obj = cur_frame.data.annotations[obj_id];
			var selectedObj = (selected == obj_id);

			// draw a point annotation
			if (obj.type == Annotation.ANNOTATION_MODE_POINT) {

				var full_circle_angle = 2 * Math.PI;
				var canvas_pt = this.image_to_canvas(obj.pt);

				if (selectedObj) {
					ctx.fillStyle = this.color_selected_point_fill;
				} else {
					ctx.fillStyle = this.color_point_fill;						
				}
				ctx.beginPath();
  				ctx.arc(canvas_pt.x, canvas_pt.y, this.extreme_point_radius, 0, full_circle_angle, false);
		        ctx.fill();

		    // draw bounding box annotation
			} else if (obj.type == Annotation.ANNOTATION_MODE_TWO_POINTS_BBOX ||
	   				   obj.type == Annotation.ANNOTATION_MODE_EXTREME_POINTS_BBOX)  {

				// transform to canvas space
				var canvas_min = this.image_to_canvas(obj.bbox.bmin);
				var canvas_max = this.image_to_canvas(obj.bbox.bmax);
				var canvas_width = canvas_max.x - canvas_min.x;
				var canvas_height = canvas_max.y - canvas_min.y; 

				// highlight the selected box
				if (selectedObj) {
					ctx.lineWidth = 3;
					ctx.strokeStyle = this.color_selected_box_outline;
					ctx.fillStyle = this.color_selected_box_fill;
					ctx.fillRect(canvas_min.x, canvas_min.y, canvas_width, canvas_height);
				} else {
					ctx.lineWidth = 2;
					ctx.strokeStyle = this.color_box_outline;
				}

				ctx.strokeRect(canvas_min.x, canvas_min.y, canvas_width, canvas_height);

				// if this is a box created from extreme points, draw dots indicating all the extreme points
				if (this.show_extreme_points && obj.type == Annotation.ANNOTATION_MODE_EXTREME_POINTS_BBOX)  {
					var full_circle_angle = 2 * Math.PI;
					ctx.fillStyle = this.color_extreme_point_fill;
					for (var i=0; i<4; i++) {
						var canvas_pt = this.image_to_canvas(obj.extreme_points[i]);
						ctx.beginPath();
	      				ctx.arc(canvas_pt.x, canvas_pt.y, this.extreme_point_radius, 0, full_circle_angle, false);
				        ctx.fill();
					}
				}	
			} else if (obj.type == Annotation.ANNOTATION_MODE_PER_FRAME) {
				// for now, let's just visualize a per-frame annotation as a highlight around the border
				ctx.lineWidth = 32;
				ctx.strokeStyle = this.color_per_frame_annotation_outline;
				ctx.strokeRect(0, 0, this.main_canvas_el.width, this.main_canvas_el.height);
			}
		}

		// render "in-progress" points (the current partial bounding box)

		if (this.inProgressPoints.length > 0) {

			// convert image-space points to canvas space for drawing on screen
			var canvas_in_progress_points = [];
			for (var i =0; i<this.inProgressPoints.length; i++)
				canvas_in_progress_points[i] = this.image_to_canvas(this.inProgressPoints[i]);

			ctx.lineWidth = 1;
			ctx.strokeStyle = this.color_in_progress_box_outline; 

			if (this.is_annotation_mode_extreme_points_bbox()) {
				this.draw_inprogress_extreme_points_bbox(ctx, canvas_in_progress_points);
			} else if (this.is_annotation_mode_two_point_bbox()) {
				this.draw_inprogress_two_points_bbox(ctx, canvas_in_progress_points);
			}
		}

	}

	handle_image_load(image_index) {
		//console.log("KLabeler: Image " + image_index + " loaded.");

		this.frames[image_index].image_load_complete = true;
		this.render();
	}

	handle_canvas_mousemove = event => {
		this.set_canvas_cursor_position(event.offsetX, event.offsetY);
		this.render();
	}

	handle_canvas_mouseover = event => {
		this.set_canvas_cursor_position(event.offsetX, event.offsetY);		
		this.render();
	}

	handle_canvas_mouseout = event => {
		this.cursorx = Number.MIN_SAFE_INTEGER;
		this.cursory = Number.MIN_SAFE_INTEGER;
		this.render();
	}

	handle_keydown = event => {
		//console.log("KeyDown: " + event.keyCode);

		if (event.keyCode == 32) {          // space
			this.spaceKeyDown = true;
		} else if (event.keyCode == 16) {   // shift
			this.shiftKeyDown = true;
		} else if (event.keyCode == 37) {   // left arrow
			if (this.current_frame_index > 0)
				this.set_current_frame_num(this.current_frame_index-1);
		} else if (event.keyCode == 39) {   // right arrow
			if (this.current_frame_index < this.frames.length-1)
				this.set_current_frame_num(this.current_frame_index+1);
		}
	}

	handle_keyup = event => {
		//console.log("KeyUp: " + event.keyCode);

		if (event.keyCode == 32) {          // space
			this.spaceKeyDown = false;

			if (this.is_annotation_mode_per_frame()) {
				// ignore spacebar keypress if the image hasn't loaded yet
				var cur_frame = this.get_current_frame();
				if (cur_frame.image_load_complete)
					this.toggle_per_frame_annotation();
				this.render();
			}

		} else if (event.keyCode == 16) {   // shift
			this.shiftKeyDown = false;
		} else if (event.keyCode == 8) {    // delete
			this.delete_box();
		}
	}

	handle_canvas_click = event => {

		var cur_frame = this.get_current_frame();

		// ignore mouse clicks if the image hasn't loaded yet
		if (!cur_frame.image_load_complete)
			return;

		this.set_canvas_cursor_position(event.offsetX, event.offsetY);

		var image_pt = this.canvas_to_image(new Point2D(this.cursorx, this.cursory));
		this.inProgressPoints.push(image_pt);		
		console.log("KLabeler: Click at (" + this.cursorx + ", " + this.cursory + "), image space=(" + image_pt.x + ", " + image_pt.y + "), point " + this.inProgressPoints.length);

		// this click completes a new per-frame annotation
		if (this.is_annotation_mode_per_frame()) {

			this.toggle_per_frame_annotation();
			this.clear_in_progress_points();

		// this click completes a new extreme point box annotation
		} else if (this.is_annotation_mode_extreme_points_bbox() && this.inProgressPoints.length == 4) {

			// discard box if this set of four extreme points is not a valid set of extreme points
			if (!BBox2D.validate_extreme_points(this.inProgressPoints)) {
				console.log("KLabeler: Points clicked are not valid extreme points. Discarding box.");
				this.clear_in_progress_points();
				this.render();
				return;
			}

			var newAnnotation = new ExtremeBoxAnnnotation(this.inProgressPoints);
			cur_frame.data.annotations.push(newAnnotation);

			console.log("KLabeler: New box: x=[" + newAnnotation.bbox.bmin.x + ", " + newAnnotation.bbox.bmax.x + "], y=[" + newAnnotation.bbox.bmin.y + ", " + newAnnotation.bbox.bmax.y + "]");

			this.clear_in_progress_points();

		// this click completes a new corner point box annotation
		} else if (this.is_annotation_mode_two_point_bbox() && this.inProgressPoints.length == 2) {

			// validate box by discarding empty boxes.
			if (this.inProgressPoints[0].x == this.inProgressPoints[1].x &&
				this.inProgressPoints[0].y == this.inProgressPoints[1].y) {
				alert("Empty bbox. Discarding box.");
				this.clear_in_progress_points();
				this.render();
				return;
			}

			var newAnnotation = new TwoPointBoxAnnotation(this.inProgressPoints);
			cur_frame.data.annotations.push(newAnnotation);

			console.log("KLabeler: New box: x=[" + newAnnotation.bbox.bmin.x + ", " + newAnnotation.bbox.bmax.y + "], y=[" + newAnnotation.bbox.bmin.y + ", " + newAnnotation.bbox.bmax.y + "]");

			this.clear_in_progress_points();

		// this click completes a new point annotation
		} else if (this.is_annotation_mode_point()) {

			var newAnnotation = new PointAnnotation(this.inProgressPoints[0]);
			cur_frame.data.annotations.push(newAnnotation);

			console.log("KLabeler: New point: (" + newAnnotation.pt.x + ", " + newAnnotation.pt.y + ")");

			this.clear_in_progress_points();
		}

		this.render();

		if (this.play_audio)
			this.play_click_audio();
	}

	/////////////////////////////////////////////////////////////////////////////////////////////
	// The following methods constitute KLabeler's application-facing API
	// (called by driving applications)
	/////////////////////////////////////////////////////////////////////////////////////////////

	clear_boxes() {
		var cur_frame = this.get_current_frame();
		var num_annotations = cur_frame.data.annotations.length;

		cur_frame.data.annotations = [];
		this.clear_in_progress_points();
		this.render();
	}

	set_annotation_mode(mode) {
		this.annotation_mode = mode;
		this.render();
	}

	set_extreme_points_viz(status) {
		this.show_extreme_points = status;
		this.render();
	}

	set_play_audio(toggle) {
		this.play_audio = toggle;
	}

	set_letterbox(toggle) {
		this.letterbox_image = toggle;
		this.render();
	}

	get_current_frame_num() {
		return this.current_frame_index;
	}

	get_num_frames() {
		return this.frames.length;
	}

	set_current_frame_num(frame_num) {
		this.current_frame_index = frame_num;
		this.clear_in_progress_points();
		this.render();
		console.log("KLabeler: set current frame num to " + this.current_frame_index);
	}

	make_image_load_handler(x) {
		return event => {
			this.handle_image_load(x);
		}
	}

	load_image_stack(image_dataset) {
		console.log('KLabeler: loading set of ' + image_dataset.length + ' images.');

		this.frames = [];
		var image_index = 0;
		for (var img of image_dataset) {
			var frame = new Frame(img);

			// kick off the image load
			frame.image_load_started = true;
			frame.source_image.onload = this.make_image_load_handler(image_index);
			frame.source_image.src = frame.data.source_url;
			this.frames.push(frame);
			image_index++;
		}

		// FIXME(kayvonf): extract to helper function
		// reset the viewer sequence
		this.current_frame_index = 0;
		this.clear_in_progress_points();
		this.visible_image_region = new BBox2D(0.0, 0.0, 1.0, 1.0);
	}

	get_annotations() {
		var results = [];
		for (var i=0; i<this.frames.length; i++) {
			results.push(this.frames[i].data);
		}

		return results;
	}

	init(main_canvas_el) {

		console.log("Klabeler: initializing...");

		this.main_canvas_el = main_canvas_el;
		this.main_canvas_el.addEventListener("mousemove", this.handle_canvas_mousemove, false);
		this.main_canvas_el.addEventListener("click", this.handle_canvas_click, false);
		this.main_canvas_el.addEventListener("mouseover", this.handle_canvas_mouseover, false);
		this.main_canvas_el.addEventListener("mouseout", this.handle_canvas_mouseout, false);

		this.audio_click_sound = new Audio("media/click_sound2.mp3");
		this.audio_box_done_sound = new Audio("media/click_sound3.mp3");

		// make a dummy frame as a placeholdr until the application provides real data
		this.frames.push(new Frame(new ImageData));
		
		// FIXME(kayvonf): extract to helper function
		// reset the viewer sequence
		this.current_frame_index = 0;
		this.clear_in_progress_points();
		this.visible_image_region = new BBox2D(0.0, 0.0, 1.0, 1.0);

	}
}