function download(text, filename) {
  var json = JSON.stringify(text);
  var a = document.createElement("a");
  var file = new Blob([json], {type: 'text/plain'});
  a.href = URL.createObjectURL(file);
  a.download = filename;
  a.click();
}
