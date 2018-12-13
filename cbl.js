/*
 * CBL-js
 * CAPTCHA Breaking Library in JavaScript
 * https://github.com/skotz/cbl-js
 * Copyright (c) 2015 Scott Clayton
 */
 
var CBL = function (options) {

    var defaults = {
        preprocess: function() { warn("You should define a preprocess method!"); },   
        model_file: "",
        model_string: mexitel_model,
        model_loaded: function() { },
        training_complete: function() { },
        blob_min_pixels: 1,
        blob_max_pixels: 99999,
        pattern_width: 20,
        pattern_height: 20,
        pattern_maintain_ratio: false,
        pattern_auto_rotate: false,
        incorrect_segment_char: "\\",
        blob_debug: "",
        blob_console_debug: false,
        allow_console_log: false,
        allow_console_warn: true,
        perceptive_colorspace: false,
        character_set: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    };

    options = options || {};
    for (var opt in defaults) {
        if (defaults.hasOwnProperty(opt) && !options.hasOwnProperty(opt)) {
            options[opt] = defaults[opt];
        }
    }

    var obj = {
        
        /***********************************************\
        | General Methods                               |
        \***********************************************/
        
        // Load an image and attempt to solve it based on trained model
        solve : function (el) {
            return obj.train(el, true);
        },
        
        done : function (resultHandler) {
            addQueue(function () {
                resultHandler(doneResult);
                runQueue();
            });
        },
        
        // Load an image and attempt to solve it based on trained model
        train : function (el, solving) {
            if (typeof solving === 'undefined') {
                solving = false;
            }
            addQueue(function() {
                var image;
                var needSetSrc = false;
                if (document.getElementById(el) != null) {
                    image = document.getElementById(el);
                } else {
                    image = document.createElement("img");
                    needSetSrc = true;
                }
                var afterLoad = function() {
                    var solution = "";
                    var canvas = document.createElement('canvas');
                    canvas.width = image.width;
                    canvas.height = image.height;
                    canvas.getContext('2d').drawImage(image, 0, 0);  
                    
                    // Run user-specified image preprocessing
                    var cblImage = new cbl_image(canvas);
                    options.preprocess(cblImage);
                    
                    // Run segmentation
                    var blobs = cblImage.segmentBlobs(options.blob_min_pixels, 
                                                      options.blob_max_pixels, 
                                                      options.pattern_width, 
                                                      options.pattern_height, 
                                                      options.blob_debug);
                    
                    // FOR TRAINING
                    // Set up a list of patterns for a human to classify
                    if (!solving) {
                        for (var i = 0; i < blobs.length; i++) {
                            var imgUrl = blobs[i].toDataURL();
                            var blobPattern = blobToPattern(blobs[i]);
                            pendingPatterns.push({
                                imgSrc: imgUrl,
                                pattern: blobPattern,
                                imgId: patternElementID,
                                txtId: humanSolutionElementID,
                                self: obj,
                                onComplete: options.training_complete
                            });
                        }
                        
                        // Load first pattern
                        if (!currentlyTraining) {
                            obj.loadNextPattern();
                        }
                        currentlyTraining = true;
                    }
                    
                    // FOR SOLVING
                    // Solve an image buy comparing each blob against our model of learned patterns
                    else {
                        for (var i = 0; i < blobs.length; i++) {
                            solution += findBestMatch(blobToPattern(blobs[i]));
                        }
                        log("Solution = " + solution);
                    }

                    doneResult = solution;
                    runQueue();
                };
                if (image.complete && !needSetSrc) {
                    afterLoad();
                }
                else {
                    image.onload = afterLoad;
                    
                    // Set the source AFTER setting the onload
                    if (needSetSrc) {
                        image.src = el;
                    }
                }              
            });
            return this;
        },
        
        // Load the next pattern pending human classification
        loadNextPattern: function() {
            var nextPattern = pendingPatterns.pop();
            if (nextPattern) {
                log("Loading a pattern for human classification.");
                openClassifierDialog();
                document.getElementById(nextPattern.imgId).src = nextPattern.imgSrc;
                document.getElementById(nextPattern.txtId).focus();
                document.getElementById(nextPattern.txtId).onkeyup = function(event) {
                    var typedLetter = document.getElementById(nextPattern.txtId).value;
                    if ((options.character_set.indexOf(typedLetter) > -1 && typedLetter.length) || typedLetter == options.incorrect_segment_char) {
                        if (typedLetter != options.incorrect_segment_char) {                            
                            model.push({
                                pattern: nextPattern.pattern,
                                solution: document.getElementById(nextPattern.txtId).value
                            });
                            log("Added \"" + document.getElementById(nextPattern.txtId).value + "\" pattern to model!");
                        } else {
                            log("Did not add bad segment to model.");
                        }
                        document.getElementById(nextPattern.txtId).value = "";
                        
                        // Load the next pattern
                        if (pendingPatterns.length) {
                            nextPattern.self.loadNextPattern();
                        }
                        else {
                            currentlyTraining = false;
                            document.getElementById(nextPattern.txtId).onkeyup = function () { };
                            if (typeof nextPattern.onComplete === 'function') {
                                nextPattern.onComplete();
                                closeClassifierDialog();
                            }
                        }
                    }
                    else {
                        document.getElementById(nextPattern.txtId).value = "";
                    }
                };
            } 
        },
        
        // Load a model by deserializing a model string
        loadModelString: function (modelString) {
            modelString = LZString.decompressFromBase64(modelString);
            model = new Array();
            var patterns = modelString.replace(/\[/g, "").split("]");
            for (var i = 0; i < patterns.length; i++) {
                var parts = patterns[i].split("=");
                if (parts.length == 2) {
                    var p = parts[1];
                    var s = parts[0];
                    model.push({
                        pattern: p,
                        solution: s
                    });
                }
            }
            if (!model.length) {
                warn("No patterns to load in provided model.");    
            }
            else {
                log("Model loaded with " + model.length + " patterns!");
                options.model_loaded();
            }
        },
        
        // Load a model from a file on the server
        loadModel: function (url) {
            try {
                var xhr = new XMLHttpRequest();
                xhr.open("GET", url, true);
                xhr.send();
                xhr.onreadystatechange = function() {
                    if (xhr.readyState == 4 && xhr.status == 200 && xhr.responseText) {
                        obj.loadModelString(xhr.responseText);    
                    }
                }
            }
            catch (err) {
                warn("Could not load model from \"" + url + "\"! (" + err.message + ")");
            }
        },
        
        // Serialize the model
        serializeModel: function () {
            var str = "";
            for (var i = 0; i < model.length; i++) {
                str += "[" + model[i].solution + "=" + model[i].pattern + "]";
            }
            str = LZString.compressToBase64(str);
            return str;
        },
        
        // Save the model to a file
        saveModel: function () {
            var str = obj.serializeModel();
            location.href = "data:application/octet-stream," + encodeURIComponent(str);
        },
        
        // Debug stuff about the model
        debugModel: function () {
            for (var i = 0; i < model.length; i++) {
                log(model[i].solution + " pattern length = " + model[i].pattern.split(".").length);
            }
        },
        
        // Sort the model by pattern solution alphabetically
        sortModel: function() {
            model = model.sort(function(a, b) { return a.solution.localeCompare(b.solution); });
        },
        
        // Output the model as images to an element for debugging
        visualizeModel: function (elementId) {
            for (var m = 0; m < model.length; m++) {
                var pattern = document.createElement('canvas');
                pattern.width = options.pattern_width;
                pattern.height = options.pattern_height;
                var pctx = pattern.getContext('2d').getImageData(0, 0, options.pattern_width, options.pattern_height);
                
                var patternValues = model[m].pattern.split('.');
                
                for (var x = 0; x < options.pattern_width; x++) {
                    for (var y = 0; y < options.pattern_height; y++) {
                        var i = x * 4 + y * 4 * options.pattern_width;
                        var p = y + x * options.pattern_width;
                        pctx.data[i] = patternValues[p];
                        pctx.data[i + 1] = patternValues[p];
                        pctx.data[i + 2] = patternValues[p];
                        pctx.data[i + 3] = 255;
                    }
                }
                
                pattern.getContext('2d').putImageData(pctx, 0, 0); 
                
                var test = document.createElement("img");
                test.src = pattern.toDataURL();
                document.getElementById(elementId).appendChild(test);
            }
        },
        
        // Condense the model by combining patterns with the same solution
        condenseModel: function () {
            var newModel = new Array();
            var oldCount = model.length;
            for (var i = 0; i < model.length; i++) {
                var patternArray = model[i].pattern.split(".");
                var found = false;
                for (var j = 0; j < newModel.length; j++) {
                    // These two patterns have the same solution, so combine the patterns
                    if (newModel[j].solution == model[i].solution) {
                        for (var x = 0; x < newModel[j].tempArray.length; x++) {
                            newModel[j].tempArray[x] = parseInt(newModel[j].tempArray[x]) + parseInt(patternArray[x]);
                        }
                        newModel[j].tempCount++;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    newModel.push({
                        pattern: model[i].pattern,
                        solution: model[i].solution,
                        tempArray: patternArray,
                        tempCount: 1
                    });
                }
            }
            // Normalize the patterns
            for (var i = 0; i < newModel.length; i++) {
                for (var x = 0; x < newModel[i].tempArray.length; x++) {
                    newModel[i].tempArray[x] = Math.round(newModel[i].tempArray[x] / newModel[i].tempCount);
                }
                newModel[i].pattern = newModel[i].tempArray.join(".");
            }
            model = newModel;
            log("Condensed model from " + oldCount + " patterns to " + model.length + " patterns!");
            return this;
        }
    };
    
    var cbl_image = function (canvas) {
        var obj = {
            /***********************************************\
            | Image Manipulation Methods                    |
            \***********************************************/
            
            // Fills each distinct region in the image with a different random color
            colorRegions: function (tolerance, ignoreWhite) {
                if (typeof ignoreWhite === 'undefined') {
                    ignoreWhite = false;
                }
                var exclusions = new Array();
                var image = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
                for (var x = 0; x < image.width; x++) {
                    for (var y = 0; y < image.height; y++) {
                        var i = x * 4 + y * 4 * image.width;
                        if (!arrayContains(exclusions, i)) {
                            obj.floodfill(x, y, getRandomColor(), tolerance, image, exclusions, ignoreWhite);
                        }
                    }
                }
                canvas.getContext('2d').putImageData(image, 0, 0);  
                return this;
            },
        
            // Display an image in an image tag
            display: function (el) {         
                document.getElementById(el).src = canvas.toDataURL();      
                return this;
            },
            
            // Displays the canvas as an image in another element
            debugImage: function (debugElement) {
                var test = document.createElement("img");
                test.src = canvas.toDataURL();
                document.getElementById(debugElement).appendChild(test);
                return this;
            },
            
            // Flood fill a given color into a region starting at a certain point
            floodfill: function (x, y, fillcolor, tolerance, image, exclusions, ignoreWhite) {
                var internalImage = false;
                if (typeof image === 'undefined') {
                    internalImage = true;
                    image = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
                }
                var data = image.data;
                var length = data.length;
                var Q = [];
                var i = (x + y * image.width) * 4;
                var e = i, w = i, me, mw, w2 = image.width * 4;
                var targetcolor = [data[i], data[i + 1], data[i + 2], data[i + 3]];
                var targettotal = data[i] + data[i + 1] + data[i + 2] + data[i + 3];

                if (!pixelCompare(i, targetcolor, targettotal, fillcolor, data, length, tolerance)) { 
                    return false; 
                }
                Q.push(i);
                while (Q.length) {
                    i = Q.pop();
                    if (typeof exclusions !== 'undefined') {
                        if (arrayContains(exclusions, i)) {
                            continue;
                        }
                    }
                    if (pixelCompareAndSet(i, targetcolor, targettotal, fillcolor, data, length, tolerance, exclusions, ignoreWhite)) {
                        e = i;
                        w = i;
                        mw = (i / w2) * w2; 
                        me = mw + w2;
                                            
                        while (mw < (w -= 4) && pixelCompareAndSet(w, targetcolor, targettotal, fillcolor, data, length, tolerance, exclusions, ignoreWhite));
                        while (me > (e += 4) && pixelCompareAndSet(e, targetcolor, targettotal, fillcolor, data, length, tolerance, exclusions, ignoreWhite));
                        
                        for (var j = w; j < e; j += 4) {
                            if (j - w2 >= 0 && pixelCompare(j - w2, targetcolor, targettotal, fillcolor, data, length, tolerance)) {
                                Q.push(j - w2);
                            }
                            if (j + w2 < length && pixelCompare(j + w2, targetcolor, targettotal, fillcolor, data, length, tolerance)) {
                                Q.push(j + w2);
                            }
                        } 			
                    }
                }
                if (internalImage) {
                    canvas.getContext('2d').putImageData(image, 0, 0);  
                }
            },
            
            // Blur the image
            blur : function (iterations) {
                var amount = 1;
                var ctx = canvas.getContext('2d');
                ctx.globalAlpha = 0.3;
                
                if (typeof iterations === 'undefined') {
                    iterations = 8;
                }

                for (var i = 1; i <= iterations; i++) {
                    ctx.drawImage(canvas, amount, 0, canvas.width - amount, canvas.height, 0, 0, canvas.width - amount, canvas.height);
                    ctx.drawImage(canvas, 0, amount, canvas.width, canvas.height - amount, 0, 0, canvas.width, canvas.height - amount);
                }
            },
            
            // Convert the image to grayscale        
            grayscale : function () { 
                var image = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);        
                for (var x = 0; x < image.width; x++) {
                    for (var y = 0; y < image.height; y++) {
                        var i = x * 4 + y * 4 * image.width;
                        var brightness = 0.34 * image.data[i] + 0.5 * image.data[i + 1] + 0.16 * image.data[i + 2];
                        image.data[i] = brightness;
                        image.data[i + 1] = brightness;
                        image.data[i + 2] = brightness;
                        image.data[i + 3] = 255;
                    }
                }
                canvas.getContext('2d').putImageData(image, 0, 0);
                return this;
            },
            
            // Change all semi-gray colors to white       
            removeGray : function (tolerance) { 
                var image = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);        
                for (var x = 0; x < image.width; x++) {
                    for (var y = 0; y < image.height; y++) {
                        var i = x * 4 + y * 4 * image.width;
                        var diff = Math.max(Math.abs(image.data[i] - image.data[i + 1]), 
                            Math.abs(image.data[i + 1] - image.data[i + 2]),
                            Math.abs(image.data[i + 2] - image.data[i]));
                        if (diff < tolerance) {
                            image.data[i] = 255;
                            image.data[i + 1] = 255;
                            image.data[i + 2] = 255;
                            image.data[i + 3] = 255;                            
                        }
                    }
                }
                canvas.getContext('2d').putImageData(image, 0, 0);
                return this;
            },
            
            // Convert the image to black and white given a grayshale threshold        
            binarize : function (threshold) {
                var image = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
                for (var x = 0; x < image.width; x++) {
                    for (var y = 0; y < image.height; y++) {
                        var i = x * 4 + y * 4 * image.width;
                        var brightness = 0.34 * image.data[i] + 0.5 * image.data[i + 1] + 0.16 * image.data[i + 2];
                        image.data[i] = brightness >= threshold ? 255 : 0;
                        image.data[i + 1] = brightness >= threshold ? 255 : 0;
                        image.data[i + 2] = brightness >= threshold ? 255 : 0;
                        image.data[i + 3] = 255;
                    }
                }
                canvas.getContext('2d').putImageData(image, 0, 0);
                return this;
            },
       
            opaque : function () {
                var image = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
                for (var x = 0; x < image.width; x++) {
                    for (var y = 0; y < image.height; y++) {
                        var i = x * 4 + y * 4 * image.width;

                        var opacity = image.data[i + 3] / 255.0;
                        image.data[i] = image.data[i] * opacity + 255 * (1 - opacity);
                        image.data[i + 1] = image.data[i + 1] * opacity + 255 * (1 - opacity);
                        image.data[i + 2] = image.data[i + 2] * opacity + 255 * (1 - opacity);
                        image.data[i + 3] = 255;
                    }
                }
                canvas.getContext('2d').putImageData(image, 0, 0);
                return this;
            },
                
            /***********************************************\
            | Image Segmentation Methods                    |
            \***********************************************/
            
            // Cut the image into separate blobs where each distinct color is a blob
            segmentBlobs : function (minPixels, maxPixels, segmentWidth, segmentHeight, debugElement) {
                if (typeof minPixels === 'undefined') {
                    minPixels = 1;
                }
                if (typeof maxPixels === 'undefined') {
                    maxPixels = 100000;
                }
                if (typeof segmentWidth === 'undefined') {
                    segmentWidth = 20;
                }
                if (typeof segmentHeight === 'undefined') {
                    segmentHeight = 20;
                }
                
                var image = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);    
                var toColor = function (d, i) { return d[i] * 255 * 255 + d[i + 1] * 256 + d[i + 2]; };
                
                // Find distinct colors
                var colors = new Array();
                for (var x = 0; x < image.width; x++) {
                    for (var y = 0; y < image.height; y++) {
                        var i = x * 4 + y * 4 * image.width;
                        var rgb = toColor(image.data, i);
                        if (!arrayContains(colors, rgb)) {
                            colors.push(rgb);
                        }
                    }
                }
                
                // Create blobs   
                var blobs = new Array();
                for (var c = 0; c < colors.length; c++) {
                    var blob = document.createElement('canvas');
                    blob.width = image.width;
                    blob.height = image.height;
                    var blobContext = blob.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
                    var blobData = blobContext.data;
                    var pixels = 0;
                    var leftmost = image.width;
                    var rightmost = 0;
                    var topmost = image.height;
                    var bottommost = 0;
                    
                    for (var x = 0; x < image.width; x++) {
                        for (var y = 0; y < image.height; y++) {
                            var i = x * 4 + y * 4 * image.width;
                            var rgb = toColor(image.data, i);
                            if (rgb == colors[c]) {
                                blobData[i] = 0;
                                blobData[i + 1] = 0;
                                blobData[i + 2] = 0;
                                blobData[i + 3] = 255;
                                
                                pixels++;
                                
                                if (x < leftmost) {
                                    leftmost = x;
                                }
                                if (x > rightmost) {
                                    rightmost = x;
                                }
                                if (y < topmost) {
                                    topmost = y;
                                }
                                if (y > bottommost) {
                                    bottommost = y;
                                }
                            } else {
                                blobData[i] = 255;
                                blobData[i + 1] = 255;
                                blobData[i + 2] = 255;
                                blobData[i + 3] = 255;
                            }
                        }
                    }
                    
                    // Only save blobs of a certain size
                    if (pixels >= minPixels && pixels <= maxPixels) {                        
                        // Scale, crop, and resize blobs
                        blob.width = segmentWidth;
                        blob.height = segmentHeight;
                        blob.getContext('2d').putImageData(blobContext, -leftmost, -topmost, leftmost, topmost, segmentWidth, segmentHeight);
                        if (options.pattern_maintain_ratio) {
                            var dWidth = rightmost - leftmost;
                            var dHeight = bottommost - topmost;
                            if (dWidth / segmentWidth > dHeight / segmentHeight) {
                                // Scale width
                                blob.getContext('2d').drawImage(blob, 0, 0, segmentWidth * segmentWidth / (rightmost - leftmost + 1), segmentHeight * segmentHeight / (rightmost - leftmost + 1));
                            }
                            else {
                                // Scale height
                                blob.getContext('2d').drawImage(blob, 0, 0, segmentWidth * segmentWidth / (bottommost - topmost + 1), segmentHeight * segmentHeight / (bottommost - topmost + 1));
                            }
                        }
                        else {
                            // Stretch the image
                            blob.getContext('2d').drawImage(blob, 0, 0, segmentWidth * segmentWidth / (rightmost - leftmost + 1), segmentHeight * segmentHeight / (bottommost - topmost + 1));
                        }

                        // Rotate the blobs using a histogram to minimize the width of non-white pixels
                        if (options.pattern_auto_rotate) {
                            blob = obj.histogramRotate(blob);
                        }
                        
                        blobs.push(blob);

                        // Debugging help
                        if (typeof debugElement !== 'undefined' && debugElement.length) {
                            if (options.blob_console_debug) {
                                log("Blob size = " + pixels);
                            }
                            var test = document.createElement("img");
                            test.src = blob.toDataURL();
                            // test.border = 1;
                            document.getElementById(debugElement).appendChild(test);
                        }
                    }
                }
                
                return blobs;
            },
            
            histogramRotate : function (blob) {
                var initial = new Image();
                initial.src = blob.toDataURL();
                
                var range = 90;
                var resolution = 5;
                var best = blob;
                var bestWidth = blob.width;
                for (var degrees = -range / 2; degrees <= range / 2; degrees += resolution) {
                    var test = document.createElement('canvas');
                    var testctx = test.getContext('2d');
                    test.width = blob.width;
                    test.height = blob.height;
                    testctx.save();
                    testctx.translate(blob.width / 2, blob.height / 2);
                    testctx.rotate(degrees * Math.PI/180);
                    testctx.drawImage(initial, -initial.width / 2, -initial.width / 2);
                    testctx.restore();
                    var testImage = testctx.getImageData(0, 0, test.width, test.height)
                    
                    // Check width of non-white pixels
                    var testWidth = 0;
                    for (var x = 0; x < testImage.width; x++) {
                        for (var y = 0; y < testImage.height; y++) {
                            var i = x * 4 + y * 4 * testImage.width;
                            if (testImage.data[i] != 255 && testImage.data[i + 3] != 0) {
                                //  Found a non-white pixel in this column
                                testWidth++;
                                break;
                            }
                            
                            // testImage.data[i] = testImage.data[i + 3] = 255;
                            // testImage.data[i + 1] = testImage.data[i + 2] = 0;
                        }
                    }
                    
                    testctx.putImageData(testImage, 0, 0);
                    
                    // Minimize the number of non-white columns
                    if (testWidth < bestWidth) {
                        bestWidth = testWidth;
                        best = test;
                    }
                    
                    // var test2 = document.createElement("img");
                    // test2.src = test.toDataURL();
                    // document.getElementById("debugPreprocessed").appendChild(test2);                        
                }
                return best;
            }
        };
        return obj;
    };
    
    /***********************************************\
    | Private Variables and Helper Methods          |
    \***********************************************/
    
    var model = new Array();
    var pendingPatterns = new Array();
    var currentlyTraining = false;
    
    var processQueue = new Array();
    var processBusy = false;
    var doneResult = "";
    
    // Add a method to the process queue and run the first item if nothing's already running
    var addQueue = function (action) {
        processQueue.push(action);
        if (!processBusy) {
            runQueue();            
        }
    };
    
    // Run the next process in the queue if one is not already running
    var runQueue = function () {
        if (processQueue.length) {
            processBusy = true;
            processQueue.shift()();
        } else {
            processBusy = false;
        }
    };
    
    // Find the best match for a pattern in the current model
    var findBestMatch = function (pattern) {
        var best = 4000000000;
        var solution = "?";
        for (var i = 0; i < model.length; i++) {
            var test = getPatternDifference(model[i].pattern, pattern);
            if (test < best) {
                best = test;
                solution = model[i].solution;
            }
        }
        return solution;
    };
    
    // Convert a blob to a pattern object
    var blobToPattern = function (blob) {
        var pattern = new Array();
        var image = blob.getContext('2d').getImageData(0, 0, blob.width, blob.height);
        for (var x = 0; x < image.width; x++) {
            for (var y = 0; y < image.height; y++) {
                var i = x * 4 + y * 4 * image.width;
                var brightness = Math.round(0.34 * image.data[i] + 0.5 * image.data[i + 1] + 0.16 * image.data[i + 2]);
                if (image.data[i + 3] < 255) {
                    brightness = 255;
                }
                pattern.push(brightness);
            }
        }
        return pattern.join('.');
    };
    
    // Get a value indicating how different two patterns are using the root mean square distance formula
    var getPatternDifference = function (p1, p2) {
        var pattern1 = p1.split('.');
        var pattern2 = p2.split('.');
        var diff = 0;
        for (var i = 0; i < pattern1.length; i++) {
            diff += (pattern1[i] - pattern2[i]) * (pattern1[i] - pattern2[i]);
        }
        return Math.sqrt(diff / pattern1.length);
    };
    
    // Compare two pixels
    var pixelCompare = function (i, targetcolor, targettotal, fillcolor, data, length, tolerance) {
        // Out of bounds?
        if (i < 0 || i >= length) {
            return false; 
        }
        
        var cNew = dataToColor(targetcolor, 0);
        var cOld = dataToColor(data, i);
        var cFill = fillcolor;
        
        // Already filled?
        if (colorCompareMaxRGB(cNew, cFill) == 0) {
            return false;
        }
        else if (colorCompareMaxRGB(cNew, cOld) == 0) {
            return true;
        }
        
        // Compare colors
        if (options.perceptive_colorspace) {
            // LAB comparison
            if (colorComparePerceptive(cNew, cOld) <= tolerance) {
                return true; 
            }          
        }
        else {
            // RGB comparison
            if (colorCompareMaxRGB(cNew, cOld) <= tolerance) {
                return true; 
            }            
        }
        
        // No match
        return false; 
    };

    // Compare two pixels and set the value if within set rules
    var pixelCompareAndSet = function (i, targetcolor, targettotal, fillcolor, data, length, tolerance, exclusions, ignoreWhite) {
        if (pixelCompare(i, targetcolor, targettotal, fillcolor, data, length, tolerance)) {
            if (typeof exclusions !== 'undefined') {
                if (arrayContains(exclusions, i)) {
                    return false;
                }
            }
            
            if (!(ignoreWhite && data[i] == 255 && data[i + 1] == 255 && data[i + 2] == 255)) {
                data[i] = fillcolor.r;
                data[i + 1] = fillcolor.g;
                data[i + 2] = fillcolor.b;
                data[i + 3] = fillcolor.a;
            }
            
            if (typeof exclusions !== 'undefined') {
                exclusions.push(i);
            }
            return true;
        }
        return false;
    };
    
    var dataToColor = function (data, i) {
        return { 
            r: data[i], 
            g: data[i + 1], 
            b: data[i + 2] 
        };
    };
    
    // Measure the difference between two colors in the RGB colorspace
    var colorCompareMaxRGB = function (color1, color2) {
        return Math.max(Math.abs(color1.r - color2.r), Math.abs(color1.g - color2.g), Math.abs(color1.g - color2.g));
    };
    
    // Measure the difference between two colors in the RGB colorspace using Root Mean Square
    var colorCompareMaxRGB = function (color1, color2) {
        return Math.sqrt((Math.pow(color1.r - color2.r, 2), Math.pow(color1.g - color2.g, 2), Math.pow(color1.g - color2.g, 2))/3);
    };
    
    // Measure the difference between two colors as measured by the human eye.
    // The "just noticeable difference" (JND) is about 2.3.
    var colorComparePerceptive = function (color1, color2) {
        // Measure the difference between two colors in the LAB colorspace (a perceptive colorspace)
        var eDelta = function (color1, color2) {
            var a = toLAB(toXYZ(color1));
            var b = toLAB(toXYZ(color2));
            return Math.sqrt(Math.pow(a.l - b.l, 2) + Math.pow(a.a - b.a, 2) + Math.pow(a.b - b.b, 2));
        };
               
        // Convert a color in the RGB colorspace to the XYZ colorspace
        var toXYZ = function (c) {
            var xR = c.r / 255.0;
            var xG = c.g / 255.0;
            var xB = c.b / 255.0;

            xR = xR > 0.04045 ? Math.pow((xR + 0.055) / 1.055, 2.4) : (xR / 12.92);
            xG = xG > 0.04045 ? Math.pow((xG + 0.055) / 1.055, 2.4) : (xG / 12.92);
            xB = xB > 0.04045 ? Math.pow((xB + 0.055) / 1.055, 2.4) : (xB / 12.92);
            
            xR = xR * 100;
            xG = xG * 100;
            xB = xB * 100;

            return {
                x: xR * 0.4124 + xG * 0.3576 + xB * 0.1805,
                y: xR * 0.2126 + xG * 0.7152 + xB * 0.0722,
                z: xR * 0.0193 + xG * 0.1192 + xB * 0.9505
            };
        };

        // Convert a color in the XYZ colorspace to the LAB colorspace
        var toLAB = function (c) {
            var xX = c.x / 95.047;
            var xY = c.y / 100.000;
            var xZ = c.z / 108.883;

            xX = xX > 0.008856 ? Math.pow(xX, 1.0 / 3) : (7.787 * xX) + (16.0 / 116);
            xY = xY > 0.008856 ? Math.pow(xY, 1.0 / 3) : (7.787 * xY) + (16.0 / 116);
            xZ = xZ > 0.008856 ? Math.pow(xZ, 1.0 / 3) : (7.787 * xZ) + (16.0 / 116);
            
            return {
                l: (116 * xY) - 16,
                a: 500 * (xX - xY),
                b: 200 * (xY - xZ)               
            };
        };
        
        // Perform the comparison
        return eDelta(color1, color2);
    };
    
    var arrayContains = function (arr, obj) {
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] === obj) {
                return true;
            }
        }
        return false;
    };
    
    var toColor = function (r, g, b) {
        return {r: r, g: g, b: b, a: 255};
    };
    
    var getRandomColor = function () {
        var r = Math.round(Math.random() * 200) + 55;
        var g;
        var b;
        while ((g = Math.round(Math.random() * 200) + 55) == r);
        while ((b = Math.round(Math.random() * 200) + 55) == r || b == g);
        return toColor(r, g, b);
    };

    var patternElementID = "cbl-pattern";
    var humanSolutionElementID = "cbl-solution";
    
    var closeClassifierDialog = function () {  
        document.getElementById("cbl-trainer").style.display = "none";
    };
    
    var openClassifierDialog = function () {     
        if (document.getElementById("cbl-trainer") != null) {
            document.getElementById("cbl-trainer").style.display = "flex";
        }
        else {    
            var appendHtml = function (el, str) {
                var div = document.createElement('div');
                div.innerHTML = str;
                while (div.children.length > 0) {
                    el.appendChild(div.children[0]);
                }
            };
            
            appendHtml(document.body,
                '<div id="cbl-trainer">' +
                '    <div id="cbl-trainer-dialog">' +
                '        <span id="cbl-close" onclick="">&cross;</span>' +
                '        <h1>CBL-js Pattern Classifier</h1>' +
                '        <p>Identify the character in the image below by typing it into the textbox.</p>' +
                '        <p>Type <span class="cbl-discard">' + options.incorrect_segment_char + '</span> to discard a pattern if the image was not segmented properly.</p>' +
                '        <div class="cbl-row">' +
                '            <div class="cbl-cell-50 cbl-right">' +
                '                <img id="' + patternElementID + '" />' +
                '            </div>' +
                '            <div class="cbl-cell-50">' +
                '                <input id="' + humanSolutionElementID + '" type="text" />' +
                '            </div>' +
                '        </div>' +
                '    </div>' +
                '    <small><a href="https://github.com/skotz/cbl-js" target="_blank">CBL-js &copy; Scott Clayton</a></small>' +
                '</div>');
                
            document.getElementById("cbl-close").addEventListener("click", function(e) {
                closeClassifierDialog();
                e.preventDefault();
            });
        }
    };
    
    var log = function (message) {
        if (options.allow_console_log) {
            console.log("CBL: " + message);
        }  
    };
    
    var warn = function (message) {
        if (options.allow_console_warn) {
            console.warn("CBL: " + message);
        }
    };
        
    // ZIP compression from https://github.com/pieroxy/lz-string
    var LZString=function(){function o(o,r){if(!t[o]){t[o]={};for(var n=0;n<o.length;n++)t[o][o.charAt(n)]=n}return t[o][r]}var r=String.fromCharCode,n="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$",t={},i={compressToBase64:function(o){if(null==o)return"";var r=i._compress(o,6,function(o){return n.charAt(o)});switch(r.length%4){default:case 0:return r;case 1:return r+"===";case 2:return r+"==";case 3:return r+"="}},decompressFromBase64:function(r){return null==r?"":""==r?null:i._decompress(r.length,32,function(e){return o(n,r.charAt(e))})},compressToUTF16:function(o){return null==o?"":i._compress(o,15,function(o){return r(o+32)})+" "},decompressFromUTF16:function(o){return null==o?"":""==o?null:i._decompress(o.length,16384,function(r){return o.charCodeAt(r)-32})},compressToUint8Array:function(o){for(var r=i.compress(o),n=new Uint8Array(2*r.length),e=0,t=r.length;t>e;e++){var s=r.charCodeAt(e);n[2*e]=s>>>8,n[2*e+1]=s%256}return n},decompressFromUint8Array:function(o){if(null===o||void 0===o)return i.decompress(o);for(var n=new Array(o.length/2),e=0,t=n.length;t>e;e++)n[e]=256*o[2*e]+o[2*e+1];var s=[];return n.forEach(function(o){s.push(r(o))}),i.decompress(s.join(""))},compressToEncodedURIComponent:function(o){return null==o?"":i._compress(o,6,function(o){return e.charAt(o)})},decompressFromEncodedURIComponent:function(r){return null==r?"":""==r?null:(r=r.replace(/ /g,"+"),i._decompress(r.length,32,function(n){return o(e,r.charAt(n))}))},compress:function(o){return i._compress(o,16,function(o){return r(o)})},_compress:function(o,r,n){if(null==o)return"";var e,t,i,s={},p={},u="",c="",a="",l=2,f=3,h=2,d=[],m=0,v=0;for(i=0;i<o.length;i+=1)if(u=o.charAt(i),Object.prototype.hasOwnProperty.call(s,u)||(s[u]=f++,p[u]=!0),c=a+u,Object.prototype.hasOwnProperty.call(s,c))a=c;else{if(Object.prototype.hasOwnProperty.call(p,a)){if(a.charCodeAt(0)<256){for(e=0;h>e;e++)m<<=1,v==r-1?(v=0,d.push(n(m)),m=0):v++;for(t=a.charCodeAt(0),e=0;8>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}else{for(t=1,e=0;h>e;e++)m=m<<1|t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t=0;for(t=a.charCodeAt(0),e=0;16>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}l--,0==l&&(l=Math.pow(2,h),h++),delete p[a]}else for(t=s[a],e=0;h>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;l--,0==l&&(l=Math.pow(2,h),h++),s[c]=f++,a=String(u)}if(""!==a){if(Object.prototype.hasOwnProperty.call(p,a)){if(a.charCodeAt(0)<256){for(e=0;h>e;e++)m<<=1,v==r-1?(v=0,d.push(n(m)),m=0):v++;for(t=a.charCodeAt(0),e=0;8>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}else{for(t=1,e=0;h>e;e++)m=m<<1|t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t=0;for(t=a.charCodeAt(0),e=0;16>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1}l--,0==l&&(l=Math.pow(2,h),h++),delete p[a]}else for(t=s[a],e=0;h>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;l--,0==l&&(l=Math.pow(2,h),h++)}for(t=2,e=0;h>e;e++)m=m<<1|1&t,v==r-1?(v=0,d.push(n(m)),m=0):v++,t>>=1;for(;;){if(m<<=1,v==r-1){d.push(n(m));break}v++}return d.join("")},decompress:function(o){return null==o?"":""==o?null:i._decompress(o.length,32768,function(r){return o.charCodeAt(r)})},_decompress:function(o,n,e){var t,i,s,p,u,c,a,l,f=[],h=4,d=4,m=3,v="",w=[],A={val:e(0),position:n,index:1};for(i=0;3>i;i+=1)f[i]=i;for(p=0,c=Math.pow(2,2),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;switch(t=p){case 0:for(p=0,c=Math.pow(2,8),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;l=r(p);break;case 1:for(p=0,c=Math.pow(2,16),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;l=r(p);break;case 2:return""}for(f[3]=l,s=l,w.push(l);;){if(A.index>o)return"";for(p=0,c=Math.pow(2,m),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;switch(l=p){case 0:for(p=0,c=Math.pow(2,8),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;f[d++]=r(p),l=d-1,h--;break;case 1:for(p=0,c=Math.pow(2,16),a=1;a!=c;)u=A.val&A.position,A.position>>=1,0==A.position&&(A.position=n,A.val=e(A.index++)),p|=(u>0?1:0)*a,a<<=1;f[d++]=r(p),l=d-1,h--;break;case 2:return w.join("")}if(0==h&&(h=Math.pow(2,m),m++),f[l])v=f[l];else{if(l!==d)return null;v=s+s.charAt(0)}w.push(v),f[d++]=s+v.charAt(0),h--,s=v,0==h&&(h=Math.pow(2,m),m++)}}};return i}();"function"==typeof define&&define.amd?define(function(){return LZString}):"undefined"!=typeof module&&null!=module&&(module.exports=LZString);
    
    // Load the model
    if (options.model_file.length) {
        obj.loadModel(options.model_file);
    } else if (options.model_string.length) {
        obj.loadModelString(options.model_string);
    }
    
    return obj;

};

var mexitel_model = "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";