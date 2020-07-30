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

		// visualization
		this.row_filter_mask = null;
		this.row_sorting = null;
		this.last_hover_idx = -1;

		// color constants
		this.color_main_canvas = '#e0e0e0';
		this.color_lf_positive = '#67bf5c';
		this.color_lf_negative = '#ed665d';
		this.color_lf_abstain = '#a2a2a2';
		this.color_highlight_box_outline = 'rgba(0.0, 0.0, 0.0, 1.0)';

		// layout parameters
		this.display_el_width = 8;
		this.display_el_height = 8;
		this.display_col_sep = 8;

	}

	// true if the mouse is hovering over the canvas
	is_hovering() {
		return (this.cursorx >= 0 && this.cursory >= 0);
	}

	// Clamp the cursor to the image dimensions
	set_canvas_cursor_position(x,y) {
		this.cursorx = clamp(x, 0, this.main_canvas_el.width);
		this.cursory = clamp(y, 0, this.main_canvas_el.height);	
	}

	// Returns the index (in the visualizer) of the "cell" that is being hovered over.  
	// The top-left corner of the visualization is cell 0.
	// Keep in mind that because of row sorting, the cell is not necessarily the same 
	// as the row of the datapoint that is being hovered over.
	// To get the data row, use get_highilghted_viz_cell()  
	get_highlighted_viz_cell() {

		// first get the cursor's row
		var row = Math.floor(this.cursory / this.display_el_height);

		// then get the cursor's column
		var spaced_col_width = this.display_el_width*this.num_lf + this.display_col_sep;
		var col = Math.floor(this.cursorx / spaced_col_width);

		// compute index
		var rows_per_col = Math.floor(this.main_canvas_el.height / this.display_el_height);
		return col * rows_per_col + row;
	}

	// returns the index of the datapoint that is being hovered over
	get_highlighted_datapoint() {

		var viz_row_idx = this.get_highlighted_viz_cell();
		if (viz_row_idx < this.num_rows)
			return this.row_sorting[viz_row_idx];
		else
			return -1;
	}

	// Render the matrix part of the visualization and cache the results in an image.
	// Rendering many boxes can bge expensive, so the point of this caching is to avoid
	// having to draw all the visual elements of the visualization on every mouse move.
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
	
				var viz_row_idx = start_row + i;
				var row_idx = this.row_sorting[viz_row_idx];

				if (this.row_filter_mask[row_idx] == true) {
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

		// store off what was just rendered into an image
		this.cached_canvas_image = ctx.getImageData(0, 0, this.main_canvas_el.width, this.main_canvas_el.height);
	}

	// main rendering routine
	render() {

		var ctx = this.main_canvas_el.getContext('2d');

		ctx.fillStyle = this.color_main_canvas;
		ctx.fillRect(0, 0, this.main_canvas_el.width, this.main_canvas_el.height);

		// draw the cached image previously rendered
		ctx.putImageData(this.cached_canvas_image, 0, 0);

		// check to see if cursor is hovering over any datapoint row.
		// if so, highlight it
		if (this.is_hovering()) {

			var hover_idx = this.get_highlighted_viz_cell(); 
			var idx = this.get_highlighted_datapoint();

			// draw the highlight
			if (idx >= 0) {

				var rows_per_col = Math.floor(this.main_canvas_el.height / this.display_el_height);
				var row = hover_idx % rows_per_col;
				var col = Math.floor(hover_idx / rows_per_col);

				var spaced_col_width = this.display_el_width*this.num_lf + this.display_col_sep;

				ctx.lineWidth = 2;
				ctx.strokeStyle = this.color_highlight_box_outline;

				for (var i=0; i<this.num_lf; i++) {
					ctx.strokeRect(col*spaced_col_width + this.display_el_width*i, row*this.display_el_height,
				    		   this.display_el_width, this.display_el_height);
				}
			}
		}
	}

	// Updates the contents of the datapoint preview DIV.
	// Pretty print the LF and label model results and display the
	// source data (either a text string or an image)
	update_preview() {

		if (this.is_hovering()) {
			var idx = this.get_highlighted_datapoint();

			if (idx >= 0) {

				if (idx != this.last_hover_idx) {

					var str = "<p>Datapoint: " + idx + " of " + this.num_rows + "<p/>";

					var base = this.num_lf*idx;
					str += "<p>";
					str += "<div>LM score: "+ this.model_scores[idx].toPrecision(4) + "</div>"
					str += "<div>LF votes: ";
					for (var i=0;i<this.num_lf; i++) {
						str += this.data_matrix[base + i];
						if (i < this.num_lf-1)
							str += ", "; 
					}
					str += "</div>";
					str += "</p>";

					if (this.datapoint_type == LFViz.DATAPOINT_TYPE_TEXT)
						str += "<p>" + this.datapoints[idx] + "</p>";
					else if (this.datapoint_type == LFViz.DATAPOINT_TYPE_IMAGE)
						str += "<p><img src=\"" + this.datapoints[idx] + "\" width=\"" +
	                           this.preview_div_el.clientWidth + "\" /></p>";

	                this.last_hover_idx = idx;
                	this.preview_div_el.innerHTML = str;
            	}
			}
			
			else {
				this.preview_div_el.innerHTML = "";
			}
		}
	}

	// Update the input data for the visualizer.
	// Currently, updating the input data resets both the row filter mask and the row sorting
	set_data(num_rows, num_lf, matrix, model_scores, datapoint_type=LFViz.DATAPOINT_TYPE_NONE, datapoints=[]) {
		this.num_rows = num_rows;
		this.num_lf = num_lf;
		this.data_matrix = matrix;
		this.model_scores = model_scores;
		this.datapoint_type = datapoint_type;
		this.datapoints = datapoints;

		// reset the filter mask
		this.row_filter_mask = [];
		for (var i=0; i<num_rows; i++) {
			this.row_filter_mask.push(true); 
		}

		// reset the sorting
		this.row_sorting = [];
		for (var i=0; i<num_rows; i++) {
			this.row_sorting.push(i);
		}

		console.log("KLFViz: loading data (num rows=" + this.num_rows + ", num lf=" + this.num_lf + ")" +
		       	    " datapoint_type=" + this.datapoint_type);

		this.render_cached_viz();
		this.render();
	}

	// The visualization will permute the datapoint according to the indices in row_sorting
	set_row_sorting(row_sorting) {
		this.row_sorting = row_sorting;
		this.render_cached_viz();
		this.render();	
	}

	// The row filter mask determines which datapoints get shown in the visualization.
	// Datapoints that aren't included in the filter are not drawn.
	set_row_filter_mask(row_filter_mask) {
		this.row_filter_mask = row_filter_mask;
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
