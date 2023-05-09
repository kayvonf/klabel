
// this file depends on:
//   -- kmath.js
//   -- kutils.js

/*
	TODO list:
	* add support for per-frame categorial annotations (currently only supports binary)
	* improve selection mechanism for boxes/points
	* detect invalid extreme points as early as possible (before end of box)
	* more intuitive handling of zoom view:
	     -- don't draw annotations that fall outside the view (or clip boxes to view)
	     -- don't allow creating of annotations outside the current view

	LICENSES OF THINGS I USED:
	* This is the "click1" sound:
	  https://www.zapsplat.com/music/metal-impact-small-plate-disc-hit-vibrate-and-resonate-2/
*/

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
		this.value = value;
	}
}

class PointAnnotation extends Annotation {
	constructor(pt, note) {
		super(Annotation.ANNOTATION_MODE_POINT);
		this.pt = pt;
    this.note = note;
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
  // Note: when loading image from server, `source_url` is a
  // random blob created with `URL.createObjectURL`. Therefore,
  // we incorporate the `name` field to allow for sorting!

	constructor(source_url, name="") {
		this.source_url = source_url;
    this.name = name === "" ? source_url : name;
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

    this.cursor = new Point2D(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);

		// state for UI related to zooming
		this.zoom_key_down = false;
		this.zoom_corner_points = [];

		// this structure holds the annotation data
		this.current_frame_index = 0;
		this.frames = [];

		// annotation state
		this.annotation_mode = Annotation.ANNOTATION_MODE_EXTREME_POINTS_BBOX;
		this.in_progress_points = [];

		// audio
		this.audio_click_sound = null;
		this.audio_box_done_sound = null;

		// colors
		this.color_main_canvas =                  '#202020';
		this.color_cursor_lines =                 'rgba(  0, 255, 255, 0.5)';
		this.color_in_progress_box_outline =      'rgba(255, 255, 255, 0.75)';
		this.color_box_outline =                  'rgba(255, 200,   0, 0.75)';
		this.color_selected_box_outline =         'rgba(255, 200, 100, 1.0)';
		this.color_selected_box_fill =            'rgba(255, 200, 150, 0.2)';
		this.color_extreme_point_fill =           '#ffff00';
		this.color_point_fill =                   '#ffff00';
		this.color_selected_point_fill =          '#ff0000';
		this.color_per_frame_annotation_outline = 'rgba(255,  50,  50, 0.5)';
		this.color_zoom_box_outline =             'rgba(255,   0,   0, 1.0)';
		this.color_zoom_box_fill =                'rgba(255,   0,   0, 0.3)';

		// display settings
		this.visible_image_region = new BBox2D(0.0, 0.0, 1.0, 1.0);
		this.letterbox_image = true;  // if false, stretch image to fill canvas
		this.play_audio = false;
		this.show_extreme_points = true;
		this.extreme_point_radius = 3;
	}

	// Clamp the cursor to the image dimensions so that clicks,
	// and (resulting bounding boxes) are always within the image
	set_canvas_cursor_position(x, y) {
    this.cursor = new Point2D(
      clamp(x, 0, this.main_canvas_el.width),
      clamp(y, 0, this.main_canvas_el.height))
	}

	get_current_frame() {
		return this.frames[this.current_frame_index];
	}

	clamp_to_visible_region(pt) {
    let x = clamp(pt.x, this.visible_image_region.bmin.x, this.visible_image_region.bmax.x);
    let y = clamp(pt.y, this.visible_image_region.bmin.y, this.visible_image_region.bmax.y);
    return new Point2D(x, y);
	}

	// convert point in canvas pixel coordinates to normalized [0,1]^2 image space coordinates
	canvas_to_image(pt) {

		// visible region of the image in the image's pixel space
		var cur_frame = this.get_current_frame();
		var visible_box = this.visible_image_region.scale(cur_frame.source_image.width, cur_frame.source_image.height);

    // region on canvas where image is displayed
		var display_box = this.compute_display_box();

		// normalized coords in display box
    var px = (pt.x - display_box.bmin.x) / display_box.width;
    var py = (pt.y - display_box.bmin.y) / display_box.height;

		// pixel space coordinate: scale using visible_box info
    var image_pixel_x = visible_box.bmin.x + px * visible_box.width;
    var image_pixel_y = visible_box.bmin.y + py * visible_box.height;

		// normalized image space coordinates 
		var norm_x = clamp(image_pixel_x / cur_frame.source_image.width, 0.0, 1.0);
		var norm_y = clamp(image_pixel_y / cur_frame.source_image.height, 0.0, 1.0);

		return new Point2D(norm_x, norm_y);
	}

	// convert point in normalized [0,1]^2 image space coordinates to canvas pixel coordinates
	image_to_canvas(pt) {
		
		// visible region of the image in the image's pixel space
		var cur_frame = this.get_current_frame();
		var visible_box = this.visible_image_region.scale(cur_frame.source_image.width, cur_frame.source_image.height);

    // region on canvas where image is displayed
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

	// true if the mouse is hovering over the canvas
	is_hovering() {
		return (this.cursor.x >= 0 && this.cursor.y >= 0);
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

	// returns index of selected annotation, which is determined by mouse position
	get_selected_annotation() {

		var selected = -1;

		if (!this.is_hovering())
			return selected;

		var image_cursor_pt = this.canvas_to_image(this.cursor);

		var cur_frame = this.get_current_frame();

		// select the smallest (area) annotation the cursor is within
		var smallest_area = Number.MAX_VALUE;
		for (var i=0; i<cur_frame.data.annotations.length; i++) {
			
      if (cur_frame.data.annotations[i].type == Annotation.ANNOTATION_MODE_POINT) {

        var p = cur_frame.data.annotations[i].pt;
        var d = (image_cursor_pt.x - p.x)**2 + (image_cursor_pt.y - p.y)**2;

        if (d < (0.01)**2) { // 0.01 away
					selected = i;
					smallest_area = 0.0;
				}

			} else if (cur_frame.data.annotations[i].type == Annotation.ANNOTATION_MODE_TWO_POINTS_BBOX ||
					   cur_frame.data.annotations[i].type == Annotation.ANNOTATION_MODE_EXTREME_POINTS_BBOX) {

				if (cur_frame.data.annotations[i].bbox.inside(image_cursor_pt) &&
					cur_frame.data.annotations[i].bbox.area < smallest_area) {
					selected = i;
					smallest_area = cur_frame.data.annotations[i].bbox.area;
				}
			}
		}

		return selected;			
	}

	clear_in_progress_points() {
		this.in_progress_points = [];
	}

	clear_zoom_corner_points() {
		this.zoom_corner_points = [];
	}

	delete_annotation() {

		var cur_frame = this.get_current_frame();
		var selected = this.get_selected_annotation();

    if (selected != -1) {
      cur_frame.data.annotations.splice(selected, 1);

      if (cur_frame.data.annotations.length == 0) {
        localStorage.removeItem(cur_frame.data.name);
      }

			console.log(`KLabeler: Deleted ${selected}`);
     }

		this.render();
	}

  set_annotation_note(note) {

		var cur_frame = this.get_current_frame();
    var selected = this.get_selected_annotation();

    if (selected != -1) {
      if (cur_frame.data.annotations[selected].type == Annotation.ANNOTATION_MODE_POINT) {
        cur_frame.data.annotations[selected].note = note;
      }
    }
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
		if (this.in_progress_points.length == 0) {

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
		var display_height = this.main_canvas_el.height;

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

	draw_inprogress_extreme_points_bbox(ctx, canvas_in_progress_points, canvas_cursor_pt) {

		// draw lines between the points we've locked down
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
			ctx.lineTo(canvas_in_progress_points[i].x, canvas_in_progress_points[i].y);
		}

		// now draw lines to the tentative point
		if (this.is_hovering()) {
			if (canvas_in_progress_points.length == 1) {
				ctx.lineTo(canvas_in_progress_points[0].x, canvas_cursor_pt.y);		
				ctx.lineTo(canvas_cursor_pt.x, canvas_cursor_pt.y);
			} else if (canvas_in_progress_points.length == 2) {
				ctx.lineTo(canvas_cursor_pt.x, canvas_in_progress_points[1].y);
				ctx.lineTo(canvas_cursor_pt.x, canvas_cursor_pt.y);
			} else if (canvas_in_progress_points.length == 3) {
				ctx.lineTo(canvas_in_progress_points[2].x, canvas_cursor_pt.y);
				// extrapolation of rest of box
				ctx.lineTo(canvas_in_progress_points[0].x, canvas_cursor_pt.y);
				ctx.lineTo(canvas_in_progress_points[0].x, canvas_in_progress_points[0].y);
			}
		}
		ctx.stroke();

		// draw dots at all the extreme points that have been specified so far
		var full_circle_angle = 2 * Math.PI;
		ctx.fillStyle = this.color_extreme_point_fill;
		for (var i=0; i<canvas_in_progress_points.length; i++) {
      ctx.beginPath();
      ctx.arc(canvas_in_progress_points[i].x, canvas_in_progress_points[i].y, this.extreme_point_radius, 0, full_circle_angle, false);
      ctx.fill();
		}	
	}

	draw_inprogress_two_points_bbox(ctx, canvas_in_progress_points, canvas_cursor_pt) {

		var pts = [];
		pts.push(canvas_in_progress_points[0]);
		pts.push(canvas_cursor_pt);

		var box = BBox2D.two_points_to_bbox(pts);
		ctx.strokeRect(box.bmin.x, box.bmin.y, box.width, box.height);
	}

	draw_inprogress_zoom_bbox(ctx, canvas_zoom_corner_points, canvas_cursor_pt) {

		var pts = [];
		pts.push(canvas_zoom_corner_points[0]);
		pts.push(canvas_cursor_pt);

		var box = BBox2D.two_points_to_bbox(pts);

		//console.log("Drawing zoom box: " + box.to_string())

		ctx.fillStyle = this.color_zoom_box_fill;
		ctx.fillRect(box.bmin.x, box.bmin.y, box.width, box.height);

		ctx.lineWidth = 2;
		ctx.strokeStyle = this.color_zoom_box_outline;
		ctx.strokeRect(box.bmin.x, box.bmin.y, box.width, box.height);
	}

	render() {

		var ctx = this.main_canvas_el.getContext('2d');

		ctx.fillStyle = this.color_main_canvas;
		ctx.fillRect(0, 0, this.main_canvas_el.width, this.main_canvas_el.height);

		var cur_frame = this.get_current_frame();

		//
		// draw the image being labeled
		//

		if (cur_frame.image_load_complete) {

			var visible_box = this.visible_image_region.scale(cur_frame.source_image.width, cur_frame.source_image.height);
			var display_box = this.compute_display_box();

			ctx.drawImage(cur_frame.source_image,
				visible_box.bmin.x, visible_box.bmin.y, visible_box.width, visible_box.height,
				display_box.bmin.x, display_box.bmin.y, display_box.width, display_box.height);
		}

		var image_cursor_pt = this.clamp_to_visible_region(this.canvas_to_image(this.cursor));
		var canvas_cursor_pt = this.image_to_canvas(image_cursor_pt);

		//
		// draw guidelines that move with the mouse cursor
		//

		if (this.is_hovering()) {
			ctx.lineWidth = 1;
			ctx.strokeStyle = this.color_cursor_lines;

			ctx.beginPath();
			ctx.moveTo(canvas_cursor_pt.x, 0);
			ctx.lineTo(canvas_cursor_pt.x, this.main_canvas_el.height);
			ctx.stroke();

			ctx.beginPath();
			ctx.moveTo(0, canvas_cursor_pt.y);
			ctx.lineTo(this.main_canvas_el.width, canvas_cursor_pt.y);
			ctx.stroke();
		}

		//
		// draw existing annotations.  These annotations may be bounding boxes, points,
		// or an annotation on the whole frame 
		//

		var selected = this.get_selected_annotation();

		for (var ann_index=0; ann_index<cur_frame.data.annotations.length; ann_index++) {

			var ann = cur_frame.data.annotations[ann_index];
			var is_selected = (selected == ann_index);

			// draw a point annotation
      if (ann.type == Annotation.ANNOTATION_MODE_POINT) {

				// do not render points that lie outside the visible region (when zoomed)
				if (!this.visible_image_region.inside(ann.pt))
					continue;

				var full_circle_angle = 2 * Math.PI;
				var canvas_pt = this.image_to_canvas(ann.pt);

				if (is_selected) {
					ctx.fillStyle = this.color_selected_point_fill;
				} else {
					if (ann.note == 'center') {
						ctx.fillStyle = '#00ff00';
					} else if (ann.note == 'left') {
						ctx.fillStyle = '#ffff00';
					} else if (ann.note == 'right') {
						ctx.fillStyle = '#ff00ff';
					}
					// ctx.fillStyle = this.color_point_fill;						
				}

		ctx.font = "20px Georgia";
        ctx.fillText(ann.note, canvas_pt.x, canvas_pt.y - 20);

        ctx.beginPath();
        ctx.arc(canvas_pt.x, canvas_pt.y, this.extreme_point_radius, 0, full_circle_angle, false);
        ctx.fill();


		    // draw bounding box annotation
			} else if (ann.type == Annotation.ANNOTATION_MODE_TWO_POINTS_BBOX ||
	   				   ann.type == Annotation.ANNOTATION_MODE_EXTREME_POINTS_BBOX)  {

				// clip the bbox to the visible region of the image (if zoomed)
				var visible_ann_box = ann.bbox.intersect(this.visible_image_region);

				// if the annotation bbox doesn't overlap the visible region,
				// there's nothing to draw 
				if (!visible_ann_box.is_empty()) {

					// transform to canvas space
					var canvas_min = this.image_to_canvas(visible_ann_box.bmin);
					var canvas_max = this.image_to_canvas(visible_ann_box.bmax);
					var canvas_width = canvas_max.x - canvas_min.x;
					var canvas_height = canvas_max.y - canvas_min.y; 

					// highlight the selected box
					if (is_selected) {
						ctx.lineWidth = 3;
						ctx.strokeStyle = this.color_selected_box_outline;
						ctx.fillStyle = this.color_selected_box_fill;
						ctx.fillRect(canvas_min.x, canvas_min.y, canvas_width, canvas_height);
					} else {
						ctx.lineWidth = 2;
						ctx.strokeStyle = this.color_box_outline;
					}

					ctx.strokeRect(canvas_min.x, canvas_min.y, canvas_width, canvas_height);
				}

				// if this is a box created from extreme points, draw dots indicating all the extreme points
				if (this.show_extreme_points && ann.type == Annotation.ANNOTATION_MODE_EXTREME_POINTS_BBOX)  {
					var full_circle_angle = 2 * Math.PI;
					ctx.fillStyle = this.color_extreme_point_fill;
					for (var i=0; i<4; i++) {

						// do not render extreme points that lie outside the visible region (when zoomed)
						if (!this.visible_image_region.inside(ann.extreme_points[i])) {
							continue;
						}

						var canvas_pt = this.image_to_canvas(ann.extreme_points[i]);
						ctx.beginPath();
	      				ctx.arc(canvas_pt.x, canvas_pt.y, this.extreme_point_radius, 0, full_circle_angle, false);
				        ctx.fill();
					}
				}	
			} else if (ann.type == Annotation.ANNOTATION_MODE_PER_FRAME) {
				// for now, let's just visualize a per-frame annotation as a highlight around the border
				ctx.lineWidth = 32;
				ctx.strokeStyle = this.color_per_frame_annotation_outline;
				ctx.strokeRect(0, 0, this.main_canvas_el.width, this.main_canvas_el.height);
			}
		}

		//
		// draw "in-progress" points (e.g., the current partial bounding box)
		//

		if (this.in_progress_points.length > 0) {

			// convert image-space points to canvas space for drawing on screen
			var canvas_in_progress_points = [];
			for (var i =0; i<this.in_progress_points.length; i++)
				canvas_in_progress_points[i] = this.image_to_canvas(this.in_progress_points[i]);

			ctx.lineWidth = 1;
			ctx.strokeStyle = this.color_in_progress_box_outline; 

			if (this.is_annotation_mode_extreme_points_bbox()) {
				this.draw_inprogress_extreme_points_bbox(ctx, canvas_in_progress_points, canvas_cursor_pt);
			} else if (this.is_annotation_mode_two_point_bbox()) {
				this.draw_inprogress_two_points_bbox(ctx, canvas_in_progress_points, canvas_cursor_pt);
			}
		}

		//
		// draw zoom box UI
		//

		if (this.zoom_corner_points.length > 0) {

			// convert image-space points to canvas space for drawing on screen
			var canvas_zoom_corner_points = [];
			for (var i=0; i<this.zoom_corner_points.length; i++)
				canvas_zoom_corner_points[i] = this.image_to_canvas(this.zoom_corner_points[i]);

			this.draw_inprogress_zoom_bbox(ctx, canvas_zoom_corner_points, canvas_cursor_pt);
		}

    this.save_annotation_to_local_storage();
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
    this.cursor = new Point2D(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);

		// NOTE(kayvonf):decision made to not clear at this time since mouse can
		// often leave the canvas as a result of user motion just to find the cursor.
		// this.clear_zoom_corner_points();
		// this.clear_in_progress_points();

		this.render();
	}

  handle_keydown = event => {
		//console.log("KeyDown: " + event.keyCode);

    // Left Arrow or A: increment position in frames
    if (event.keyCode == 37 || event.keyCode == 65) {
      if (this.current_frame_index > 0) {
        this.set_current_frame_num(this.current_frame_index-1);
      }

    // Right Arrow or D: decrement positions in frames
    } else if (event.keyCode == 39 || event.keyCode == 68) { 
      if (this.current_frame_index < this.frames.length-1) {
				this.set_current_frame_num(this.current_frame_index+1);
      }

    // ESC: cancel current action
		} else if (event.keyCode == 27) {  // ESC key
			this.clear_in_progress_points();
			this.clear_zoom_corner_points();
			this.render();

    // 'z': Zoom Mode
		} else if (event.keyCode == 90) {
			if (!this.zoom_key_down) {
				this.zoom_key_down = true;
				this.clear_zoom_corner_points();
				this.clear_in_progress_points();
			}
			this.render();

    // 'r': Reset zoom
		} else if (event.keyCode == 82) {
			this.visible_image_region = new BBox2D(0.0, 0.0, 1.0, 1.0);
			this.render();
		}
	}

  handle_keyup = event => {
		console.log("KeyUp: " + event.keyCode);

    // Spacebar: frame annotation
    if (event.keyCode == 32) {
			if (this.is_annotation_mode_per_frame()) {
				var cur_frame = this.get_current_frame();

        // ignore if image not loaded
        if (cur_frame.image_load_complete) {
					this.toggle_per_frame_annotation();
        }
			}

    // Delete/Backspace: delete selected annotation
		} else if (event.keyCode == 8) {
			this.delete_annotation();

    // 'z': Zoom Mode
		} else if (event.keyCode == 90) {
			this.zoom_key_down = false;
			this.clear_zoom_corner_points();
		}

    else {
      let note = "";
	  if ((event.keyCode - 48) === 1) note = "center";
      if ((event.keyCode - 48) === 2) note = "left";
      if ((event.keyCode - 48) === 3) note = "right";

      if (note !== "") {
        this.set_annotation_note(note);
      }
    }

		this.render();
	}

  handle_canvas_click = event => {

		var cur_frame = this.get_current_frame();

		// ignore mouse clicks if the image hasn't loaded yet
		if (!cur_frame.image_load_complete)
			return;

		this.set_canvas_cursor_position(event.offsetX, event.offsetY);
		var image_cursor_pt = this.clamp_to_visible_region(this.canvas_to_image(this.cursor));

		// if the user is holding down the "zoom mode key", treat the click as specifying a
		// zoom bounding box, not as defining an annotation.
		if (this.zoom_key_down) {

			this.zoom_corner_points.push(image_cursor_pt);

			if (this.zoom_corner_points.length == 2) {
				this.visible_image_region = BBox2D.two_points_to_bbox(this.zoom_corner_points);
				this.clear_zoom_corner_points(); 
				// console.log("Set visible region: (" + this.visible_image_region.bmin.x + ", " + this.visible_image_region.bmin.y + "), w=" + this.visible_image_region.width + ", h=" + this.visible_image_region.height);
			}

			this.render();
			return;
		}

		this.in_progress_points.push(image_cursor_pt);		
		console.log(`KLabeler: Click at ${this.cursor.to_string()}, image space=${image_cursor_pt.to_string()}, point ${this.in_progress_points.length}`);

		// this click completes a new per-frame annotation
		if (this.is_annotation_mode_per_frame()) {

			this.toggle_per_frame_annotation();
			this.clear_in_progress_points();

		// this click completes a new extreme point box annotation
		} else if (this.is_annotation_mode_extreme_points_bbox() && this.in_progress_points.length == 4) {

			// discard box if this set of four extreme points is not a valid set of extreme points
			if (!BBox2D.validate_extreme_points(this.in_progress_points)) {
				console.log("KLabeler: Points clicked are not valid extreme points. Discarding box.");
				this.clear_in_progress_points();
				this.render();
				return;
			}

			var new_annotation = new ExtremeBoxAnnnotation(this.in_progress_points);
			cur_frame.data.annotations.push(new_annotation);

			console.log(`KLabeler: New box: x=[${new_annotation.bbox.bmin.x}, ${new_annotation.bbox.bmax.x}], y=[${new_annotation.bbox.bmin.y}, ${new_annotation.bbox.bmax.y}]`);

			this.clear_in_progress_points();

		// this click completes a new corner point box annotation
		} else if (this.is_annotation_mode_two_point_bbox() && this.in_progress_points.length == 2) {

			// validate box by discarding empty boxes.
			if (this.in_progress_points[0].x == this.in_progress_points[1].x &&
				this.in_progress_points[0].y == this.in_progress_points[1].y) {
				alert("Empty bbox. Discarding box.");
				this.clear_in_progress_points();
				this.render();
				return;
			}

			var new_annotation = new TwoPointBoxAnnotation(this.in_progress_points);
			cur_frame.data.annotations.push(new_annotation);

			console.log(`KLabeler: New box: x=[${new_annotation.bbox.bmin.x}, ${new_annotation.bbox.bmax.x}], y=[${new_annotation.bbox.bmin.y}, ${new_annotation.bbox.bmax.y}]`);

			this.clear_in_progress_points();

		// this click completes a new point annotation
		} else if (this.is_annotation_mode_point()) {

			var new_annotation = new PointAnnotation(this.in_progress_points[0], "center");
			cur_frame.data.annotations.push(new_annotation);

			console.log(`KLabeler: New point: ${new_annotation.pt.to_string()}`);

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
		this.clear_zoom_corner_points();
		this.render();
	}

	set_annotation_mode(mode) {
		this.annotation_mode = mode;
		this.clear_in_progress_points();
		this.clear_zoom_corner_points();
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
		this.clear_in_progress_points();
		this.clear_zoom_corner_points();
		this.render();
	}

	get_current_frame_num() {
		return this.current_frame_index;
	}

	get_num_frames() {
		return this.frames.length;
	}

	set_current_frame_num(frame_num) {
    // Save previous annotation
    this.save_annotation_to_local_storage();

    // Move forward and reset
		this.current_frame_index = frame_num;
    this.load_annotation_from_local_storage();
		this.clear_in_progress_points();
		this.clear_zoom_corner_points();
		this.render();
		console.log(`KLabeler: set current frame num to ${this.current_frame_index}`);
	}

	make_image_load_handler(x) {
		return e => this.handle_image_load(x);
	}

	load_image_stack(image_dataset) {
		console.log(`KLabeler: loading set of ${image_dataset.length} images.`);

    // TODO(cristobal): memory is bogged, this doesn't work...
    for (var i = 0; i < this.frames.length; i++) {
      this.frames[i].source_image.remove();
      this.frames[i].source_image = null;
      this.frames[i].data = null;
      this.frames[i] = null;
    }

    // Sort dataset lexicographically by name
    image_dataset.sort((i, j) => i.name.localeCompare(j.name));

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
    this.load_annotation_from_local_storage();
		this.clear_in_progress_points();
		this.clear_zoom_corner_points();
		this.visible_image_region = new BBox2D(0.0, 0.0, 1.0, 1.0);
	}

	get_annotations() {
    return this.frames.map(f => ({"name": f.data.name, "annotations": f.data.annotations}));
	}
  
  load_annotation_from_local_storage() {
    var f = this.get_current_frame();
    var stored_annotations = localStorage.getItem(f.data.name);
    f.data.annotations = JSON.parse(stored_annotations) || [];
  }

  save_annotation_to_local_storage() {
    var f = this.get_current_frame();
    if (f.data.annotations.length > 0) {
      localStorage.setItem(f.data.name, JSON.stringify(f.data.annotations));
    }
  }

  save_annotations_to_local_storage() {
    this.frames.map(f => {
      if (f.data.annotations.length > 0) {
        localStorage.setItem(f.data.name, JSON.stringify(f.data.annotations));
      }
    });
  }

  persist_local_storage() {
    var d = new Date();
    var dt = `${d.getFullYear()}_${d.getMonth() + 1}_${d.getDate()}_${d.getHours()}_${d.getMinutes()}_${d.getSeconds()}`;
    download(localStorage, `klabeler_${dt}.json`);
  }

  	validate_annotations() {
		console.log("Validating annotations ... ")
		for (var i = 0; i < this.frames.length; i++) {
			var f = this.frames[i];
			var invalid = false; 
			if (f.data.annotations.length != 0) {
				if (f.data.annotations.length != 3)
					invalid = true;
				else {
					var notes = []
					for (var j = 0; j < 3; j++){
						notes.push(f.data.annotations[j].note)
					}
					if (!notes.includes('center') || !notes.includes('left') || !notes.includes('right'))
						invalid = true;
				}
			}
			if (invalid)
				console.log(f.data.name, f.data.annotations)
		} 
	}

	init(main_canvas_el) {

		console.log("Klabeler: initializing...");

		this.main_canvas_el = main_canvas_el;
		this.main_canvas_el.addEventListener("mousemove", this.handle_canvas_mousemove, false);
		this.main_canvas_el.addEventListener("click", this.handle_canvas_click, false);
		this.main_canvas_el.addEventListener("mouseover", this.handle_canvas_mouseover, false);
		this.main_canvas_el.addEventListener("mouseout", this.handle_canvas_mouseout, false);

    this.audio_click_sound = new Audio("../media/click_sound2.mp3");
    this.audio_box_done_sound = new Audio("../media/click_sound3.mp3");

		// make a dummy frame as a placeholdr until the application provides real data
		this.frames.push(new Frame(new ImageData));
		
		// FIXME(kayvonf): extract to helper function
		// reset the viewer sequence
		this.current_frame_index = 0;
		this.clear_in_progress_points();
		this.visible_image_region = new BBox2D(0.0, 0.0, 1.0, 1.0);

	}
}
