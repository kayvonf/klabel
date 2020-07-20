// this file depends on:
//   -- kmath.js


class LFViz {

	static get DATAPOINT_TYPE_NONE() { return 0; }
	static get DATAPOINT_TYPE_TEXT() { return 1; }
	static get DATAPOINT_TYPE_IMAGE() { return 2; }

	constructor() {
		this.main_canvas_el = null;
		this.preview_main_el = null;
		this.cached_canvas_image = null;

		this.cursorx = Number.MIN_SAFE_INTEGER;
		this.cursory = Number.MIN_SAFE_INTEGER;

		// data
		this.num_rows = 0;
		this.num_lf = 0;
		this.data_matrix = null;
		this.datapoint_type = null;
		this.datapoints = null;
		this.highlight_mask = null;

		// color constants
		this.color_main_canvas = '#e0e0e0';
		this.color_lf_positive = '#67bf5c';
		this.color_lf_negative = '#ed665d';
		this.color_lf_abstain = '#a2a2a2';
		this.color_highlight_box_outline = 'rgba(255, 255, 255, 0.5)';

		// layout parameters
		this.display_el_width = 8;
		this.display_el_height = 8;
		this.display_col_sep = 8;

	}

	// true if the mouse is hovering over the canvas
	is_hovering() {
		return (this.cursorx >= 0 && this.cursory >= 0);
	}

	// Clamp the cursor to the image dimensions so that clicks,
	// and (resulting bounding boxes) are always within the image
	set_canvas_cursor_position(x,y) {
		this.cursorx = clamp(x, 0, this.main_canvas_el.width);
		this.cursory = clamp(y, 0, this.main_canvas_el.height);	
	}

	get_selected_datapoint() {

		// first get the cursor's row
		var row = Math.floor(this.cursory / this.display_el_height);

		// then get the cursor's column
		var spaced_col_width = this.display_el_width*this.num_lf + this.display_col_sep;
		var col = Math.floor(this.cursorx / spaced_col_width);

		// compute datapoint index
		var rows_per_col = Math.floor(this.main_canvas_el.height / this.display_el_height);
		return col * rows_per_col + row;
	}

	render_cached_viz() {

		var ctx = this.main_canvas_el.getContext('2d');

		ctx.fillStyle = this.color_main_canvas;
		ctx.fillRect(0, 0, this.main_canvas_el.width, this.main_canvas_el.height);

		var rows_per_col = Math.floor(this.main_canvas_el.height / this.display_el_height);
		var num_cols = Math.floor((this.num_rows + rows_per_col - 1) / rows_per_col); 

		for (var col=0; col<num_cols; col++) {

			var start_row = col * rows_per_col;
			var end_row = Math.min(start_row + rows_per_col, this.num_rows);
			var rows_in_this_col = end_row - start_row;

			// now draw a column of data points
			for (var i=0; i<rows_in_this_col; i++) {
	
				var row_idx = start_row + i;

				if (this.highlight_mask[row_idx] == true) {
					var start_y = i*this.display_el_height;
					for (var j=0; j<this.num_lf; j++) {
						var idx = row_idx * this.num_lf + j;

						var el_color = this.color_lf_abstain;
						if (this.data_matrix[idx] == 1)
							el_color = this.color_lf_positive;
						else if (this.data_matrix[idx] == -1)
							el_color = this.color_lf_negative;

						var start_x = col * (this.display_el_width * this.num_lf + this.display_col_sep) + j*this.display_el_width;
						ctx.fillStyle = el_color;
						ctx.fillRect(start_x, start_y, this.display_el_width, this.display_el_height);
					}
				}
			}
		}

		this.cached_canvas_image = ctx.getImageData(0, 0, this.main_canvas_el.width, this.main_canvas_el.height);
	}

	render() {

		var ctx = this.main_canvas_el.getContext('2d');

		ctx.fillStyle = this.color_main_canvas;
		ctx.fillRect(0, 0, this.main_canvas_el.width, this.main_canvas_el.height);

		// draw the cached image previously rendered
		ctx.putImageData(this.cached_canvas_image, 0, 0);

		// check to see if cursor is hovering over any datapoint row.
		// if so, highlight it
		if (this.is_hovering()) {

			var idx = this.get_selected_datapoint();
			var rows_per_col = Math.floor(this.main_canvas_el.height / this.display_el_height);
			var row = idx % rows_per_col;
			var col = Math.floor(idx / rows_per_col);

			// draw the highlight
			if (idx < this.num_rows) {

				var spaced_col_width = this.display_el_width*this.num_lf + this.display_col_sep;

				ctx.lineWidth = 2;
				ctx.strokeStyle = this.color_highlight_box_outline;

				for (var i=0; i<this.num_lf; i++) {
	
					//ctx.strokeRect(col*spaced_col_width, row*this.display_el_height,
				    //		   this.display_el_width*this.num_lf, this.display_el_height);
					ctx.strokeRect(col*spaced_col_width + this.display_el_width*i, row*this.display_el_height,
				    		   this.display_el_width, this.display_el_height);

				}
			}
		}
	}

	update_preview() {
		if (this.is_hovering()) {
			var idx = this.get_selected_datapoint();
			if (idx < this.num_rows) {
				var str = "<p>Datapoint: " + idx + " of " + this.num_rows + "<p/>";
				if (this.datapoint_type == LFViz.DATAPOINT_TYPE_TEXT)
					str += "<p>" + this.datapoints[idx] + "</p>";
				else if (this.datapoint_type == LFViz.DATAPOINT_TYPE_IMAGE)
					str += "<p><img src=\"" + this.datapoints[idx] + "\" width=\"" +
                           this.preview_div_el.clientWidth + "\" /></p>";

                this.preview_div_el.innerHTML = str;
			}
			else {
				this.preview_div_el.innerHTML = "";
			}
		}
	}

	load_data(num_rows, num_lf, matrix, datapoint_type=LFViz.DATAPOINT_TYPE_NONE, datapoints=[], highlight_mask=[]) {
		this.num_rows = num_rows;
		this.num_lf = num_lf;
		this.data_matrix = matrix;
		this.datapoint_type = datapoint_type;
		this.datapoints = datapoints;
		this.highlight_mask = highlight_mask;

		if (this.highlight_mask.length == 0) {
			this.highlight_mask = [];
			for (var i=0; i<num_rows; i++) {
				this.highlight_mask.push(true); 
			}
		}

		console.log("KLFViz: loading data (num rows=" + this.num_rows + ", num lf=" + this.num_lf + ")" +
		       	    " datapoint_type=" + this.datapoint_type);

		this.render_cached_viz();
		this.render();
	}

	set_highlight_mask(highlight_mask) {
		this.highlight_mask = highlight_mask;
		this.render_cached_viz();
		this.render();	
	}

	handle_canvas_mousemove = event => {
		this.set_canvas_cursor_position(event.offsetX, event.offsetY);
		this.render();
		this.update_preview();
	}

	handle_canvas_mouseover = event => {
		this.set_canvas_cursor_position(event.offsetX, event.offsetY);		
		this.render();
		this.update_preview();
	}

	handle_canvas_mouseout = event => {
		this.cursorx = Number.MIN_SAFE_INTEGER;
		this.cursory = Number.MIN_SAFE_INTEGER;
		this.render();
		this.update_preview();
	}

	init(main_canvas_el, preview_div_el) {

		console.log("KLFViz: initializing...");
		this.main_canvas_el = main_canvas_el;

		this.main_canvas_el.addEventListener("mousemove", this.handle_canvas_mousemove, false);
		this.main_canvas_el.addEventListener("mouseover", this.handle_canvas_mouseover, false);
		this.main_canvas_el.addEventListener("mouseout",  this.handle_canvas_mouseout,  false);

		this.preview_div_el = preview_div_el;

		this.render_cached_viz();
		this.render();
	}
}
