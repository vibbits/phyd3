var compressor = require('node-minify');

compressor.minify({
  compressor: 'gcc',
  input: 'js/phyd3.*.js',
  output: 'js/phyd3.min.js'
}).then(function(min) {
    compressor.minify({
      compressor: 'no-compress',
      input: 'js/*.min.js',
      output: 'dist/js/phyd3.min.js'
    });
});

compressor.minify({
  compressor: 'no-compress',
  input: 'css/**/*.css',
  output: 'dist/css/phyd3.css'
}).then(function(min) {
    compressor.minify({
      compressor: 'csso',
      input: 'dist/css/phyd3.css',
      output: 'dist/css/phyd3.min.css'
    });
});

