var gulp        = require("gulp"),
    browserify  = require("browserify"),
    tsc         = require("gulp-typescript"),
    sourcemaps  = require("gulp-sourcemaps"),
    runSequence = require("run-sequence"),
    mocha       = require("gulp-mocha"),
    istanbul    = require("gulp-istanbul");

var tsProject = tsc.createProject("tsconfig.json");

gulp.task("build-app", function() {
    return gulp.src([
            "**/**.ts"
        ])
        .pipe(tsc(tsProject))
        .js.pipe(gulp.dest("out/"));
});

gulp.task("bundle", function() {
    var libraryName = "clipper";
    var mainTsFilePath = "index.js";
    var outputFolder   = "out/";
    var outputFileName = libraryName + ".min.js";

    var bundler = browserify({
        debug: true,
        standalone : libraryName
    });

    return bundler.add(mainTsFilePath)
        .bundle()
        .pipe(source(outputFileName))
        .pipe(sourcemaps.init({ loadMaps: true }))
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest(outputFolder));
});
