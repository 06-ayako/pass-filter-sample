(function () {
    var $clickElem = document.getElementById('click-start');
    $clickElem.addEventListener('click', function () {
        $clickElem.remove();

        var onDOMContentLoaded = function () {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;

            try {
                // Create the instance of AudioContext
                var context = new AudioContext();
            } catch (error) {
                window.alert(error.message + " : Please use Chrome or Safari.");
                return;
            }

            /* music */

            // for the instance of AudioBufferSourceNode
            var source = null;
            // Create the instance of GainNode (for Master Volume)
            var gainL = context.createGain();
            var gainH = context.createGain();

            // Create the instance of BiquadFilterNode
            var filterL = context.createBiquadFilter();
            filterL.type = "lowpass";
            filterL.frequency.value = document.getElementById('range-filter-low').valueAsNumber;
            filterL.Q.value = 1;
            var filterH = context.createBiquadFilter();
            filterH.type = "highpass";
            filterH.frequency.value = document.getElementById('range-filter-high').valueAsNumber;
            filterH.Q.value = 1;

            // Trigger 'ended' event
            var trigger = function () {
                var event = document.createEvent('Event');
                event.initEvent('ended', true, true);

                if (source instanceof AudioBufferSourceNode) {
                    source.dispatchEvent(event);
                }
            };

            // This funciton is executed after getting ArrayBuffer of audio data
            var startAudio = function (arrayBuffer) {

                // The 2nd argument for decodeAudioData
                var successCallback = function (audioBuffer) {
                    // The 1st argument (audioBuffer) is the instance of AudioBuffer

                    // If there is previous AudioBufferSourceNode, program stops previous audio
                    if ((source instanceof AudioBufferSourceNode) && (source.buffer instanceof AudioBuffer)) {
                        // Execute onended event handler
                        trigger();
                        source = null;
                    }

                    // Create the instance of AudioBufferSourceNode
                    source = context.createBufferSource();
                    // Set the instance of AudioBuffer
                    source.buffer = audioBuffer;

                    // Set parameters
                    source.playbackRate.value = document.getElementById('range-playback-rate').valueAsNumber;
                    source.loop = document.querySelector('[type="checkbox"]').checked;

                    // GainNode (Master Volume) -> AudioDestinationNode (Output)
                    gainL.connect(context.destination);
                    gainH.connect(context.destination);

                    // Clear connection
                    source.disconnect(0);
                    filterL.disconnect(0);
                    filterH.disconnect(0);

                    if (document.getElementById('toggle-effect').checked) {
                        source.connect(filterL);
                        filterL.connect(gainL);
                        source.connect(filterH);
                        filterH.connect(gainH);
                    } else {
                        source.connect(gainL);
                    }

                    // Start audio
                    source.start(0);

                    // Set Callback
                    source.onended = function (event) {
                        // Remove event handler
                        source.onended = null;
                        document.onkeydown = null;

                        // Stop audio
                        source.stop(0);

                        console.log('STOP by "on' + event.type + '" event handler !!');

                        // Audio is not started !!
                        // It is necessary to create the instance of AudioBufferSourceNode again

                        // Cannot replay
                        // source.start(0);
                    };

                    // Stop audio
                    document.onkeydown = function (event) {
                        // Space ?
                        if (event.keyCode !== 32) {
                            return;
                        }

                        // Execute onended event handler
                        trigger();

                        return false;
                    };
                };

                // The 3rd argument for decodeAudioData
                var errorCallback = function (error) {
                    if (error instanceof Error) {
                        window.alert(error.message);
                    } else {
                        window.alert('Error : "decodeAudioData" method.');
                    }
                };

                // Create the instance of AudioBuffer (Asynchronously)
                context.decodeAudioData(arrayBuffer, successCallback, errorCallback);
            };

            /* File Uploader */

            document.getElementById('file-upload-audio').addEventListener('change', function (event) {
                var uploader = this;
                var progressArea = document.getElementById('progress-file-upload-audio');

                // Get the instance of File (extends Blob)
                var file = event.target.files[0];

                if (!(file instanceof File)) {
                    window.alert('Please upload file.');
                } else if (file.type.indexOf('audio') === -1) {
                    window.alert('Please upload audio file.');
                } else {
                    // Create the instance of FileReader
                    var reader = new FileReader();

                    reader.onprogress = function (event) {
                        if (event.lengthComputable && (event.total > 0)) {
                            var rate = Math.floor((event.loaded / event.total) * 100);
                            progressArea.textContent = rate + ' %';
                        }
                    };

                    reader.onerror = function () {
                        window.alert('FileReader Error : Error code is ' + reader.error.code);
                        uploader.value = '';
                    };

                    // Success read
                    reader.onload = function () {
                        var arrayBuffer = reader.result;  // Get ArrayBuffer

                        startAudio(arrayBuffer);

                        uploader.value = '';
                        progressArea.textContent = file.name;
                    };

                    // Read the instance of File
                    reader.readAsArrayBuffer(file);
                }
            }, false);


            /* microphone */
            var analyser = context.createAnalyser();
            analyser.smoothingTimeConstant = 0.65; //落ち着くまでの時間
            analyser.fftSize = 2048; //音域の数
            var bufferLength = analyser.frequencyBinCount;
            //↓の配列に音域ごとの大きさが入る
            var dataArray = new Uint8Array(bufferLength);
            analyser.getByteTimeDomainData(dataArray);

            var sourceEn = null;

            //マイクの音を拾う
            navigator.webkitGetUserMedia(
                { audio: true },
                function (stream) {
                    sourceEn = context.createMediaStreamSource(stream);
                    sourceEn.connect(analyser);
                    getAudio();
                },
                function (err) {
                    console.log(err);
                }
            );
            //dataArrayに音域情報を入れる。繰り返す
            function getAudio() {
                requestAnimationFrame(getAudio);
                analyser.getByteFrequencyData(dataArray);
                // console.log(dataArray);
            }

            var numberL = Array(100).fill(0);
            var numberH = Array(100).fill(0);

            // Control Master Volume filterL
            document.getElementById('button-volume-low').addEventListener('click',
                function volumeL() {
                    requestAnimationFrame(volumeL);
                    analyser.getByteFrequencyData(dataArray);
                    var sumL1 = dataArray.slice(0, 70).reduce(function (a, x) {
                        return a + x;
                    });
                    var averageL1 = sumL1 / bufferLength;

                    numberL.shift();
                    numberL.push(averageL1);

                    var sumL2 = numberL.reduce(function (a, x) {
                        return a + x;
                    });
                    var averageL2 = sumL2 / 100;
                    var systemL = averageL2 * 5;

                    if ((systemL >= 0) && (systemL <= 2)) {
                        gainL.gain.value = systemL;
                        document.getElementById('output-volume-low').textContent = Math.round(systemL * 10000) / 10000;
                    } else if (2 < systemL) {
                        gainL.gain.value = 2;
                        document.getElementById("output-volume-low").textContent = 2;
                    } else {
                        gainL.gain.value = 0;
                        document.getElementById("output-volume-low").textContent = 0;
                    }
                }, false);

            // Control Master Volume filterH
            document.getElementById('button-volume-high').addEventListener('click',
                function volumeH() {
                    requestAnimationFrame(volumeH);
                    analyser.getByteFrequencyData(dataArray);
                    var sumH1 = dataArray.slice(70, 1023).reduce(function (a, x) {
                        return a + x;
                    });
                    var averageH1 = sumH1 / bufferLength;

                    numberH.shift();
                    numberH.push(averageH1);

                    var sumH2 = numberH.reduce(function (a, x) {
                        return a + x;
                    });
                    var averageH2 = sumH2 / 100;
                    var systemH = averageH2 * 5;

                    if ((systemH >= 0) && (systemH <= 2)) {
                        gainH.gain.value = systemH;
                        document.getElementById('output-volume-high').textContent = Math.round(systemH * 10000) / 10000;
                    } else if (2 < systemH) {
                        gainH.gain.value = 2;
                        document.getElementById("output-volume-high").textContent = 2;
                    } else {
                        gainH.gain.value = 0;
                        document.getElementById("output-volume-high").textContent = 0;
                    }
                }, false);

            // Control playbackRate
            document.getElementById('range-playback-rate').addEventListener('input', function () {
                if (source instanceof AudioBufferSourceNode) {
                    var min = source.playbackRate.minValue || 0;
                    var max = source.playbackRate.maxValue || 1024;

                    if ((this.valueAsNumber >= min) && (this.valueAsNumber <= max)) {
                        source.playbackRate.value = this.valueAsNumber;
                    }
                }

                document.getElementById('output-playback-rate').textContent = this.value;
            }, false);

            // Toggle loop
            document.querySelector('[type="checkbox"]').addEventListener(EventWrapper.CLICK, function () {
                if (source instanceof AudioBufferSourceNode) {
                    source.loop = this.checked;
                }
            }, false);

            // Toggle Effect
            document.getElementById('toggle-effect').addEventListener(EventWrapper.CLICK, function () {
                if (!(source instanceof AudioBufferSourceNode)) {
                    return;
                }
                // Clear connection
                source.disconnect(0);
                filterL.disconnect(0);
                filterH.disconnect(0);

                if (this.checked) {
                    // AudioBufferSourceNode (Input) -> BiquadFilterNode (Low-Pass Filter) -> GainNode (Master Volume) (-> AudioDestinationNode (Output))
                    source.connect(filterL);
                    filterL.connect(gainL);
                    source.connect(filterH);
                    filterH.connect(gainH);
                } else {
                    // AudioBufferSourceNode (Input) -> GainNode (Master Volume) (-> AudioDestinationNode (Output))
                    source.connect(gainL);
                }
            }, false);

            // Control filterL frequency (cutoff)
            document.getElementById('range-filter-low').addEventListener('input', function () {
                filterL.frequency.value = this.valueAsNumber;
                document.getElementById('output-filter-low').textContent = this.value;
            }, false);

            // Control filterH frequency (cutoff)
            document.getElementById('range-filter-high').addEventListener('input', function () {
                filterH.frequency.value = this.valueAsNumber;
                document.getElementById('output-filter-high').textContent = this.value;
            }, false);

        };

        if ((document.readyState === 'interactive') || (document.readyState === 'complete')) {
            onDOMContentLoaded();
        } else {
            document.addEventListener('DOMContentLoaded', onDOMContentLoaded, true);
        }
    }, false);

})();


function EventWrapper() { }

(function () {
    var click = '';
    var start = '';
    var move = '';
    var end = '';

    // Touch Panel ?
    if (/iPhone|iPad|iPod|Android/.test(navigator.userAgent)) {
        click = 'click';
        start = 'touchstart';
        move = 'touchmove';
        end = 'touchend';
    } else {
        click = 'click';
        start = 'mousedown';
        move = 'mousemove';
        end = 'mouseup';
    }

    EventWrapper.CLICK = click;
    EventWrapper.START = start;
    EventWrapper.MOVE = move;
    EventWrapper.END = end;
})();
