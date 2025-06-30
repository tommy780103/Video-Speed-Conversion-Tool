class VideoSpeedConverter {
    constructor() {
        this.ffmpeg = null;
        this.currentVideo = null;
        this.currentSpeed = 1.0;
        this.isProcessing = false;
        
        this.initializeElements();
        this.bindEvents();
        this.initializeFFmpeg();
    }

    initializeElements() {
        this.uploadArea = document.getElementById('uploadArea');
        this.videoInput = document.getElementById('videoInput');
        this.controlsSection = document.getElementById('controlsSection');
        this.previewVideo = document.getElementById('previewVideo');
        this.videoFileName = document.getElementById('videoFileName');
        this.videoDuration = document.getElementById('videoDuration');
        this.speedSlider = document.getElementById('speedSlider');
        this.speedValue = document.getElementById('speedValue');
        this.presetButtons = document.querySelectorAll('.preset-btn');
        this.previewBtn = document.getElementById('previewBtn');
        this.convertBtn = document.getElementById('convertBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.progressSection = document.getElementById('progressSection');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.progressPercent = document.getElementById('progressPercent');
    }

    bindEvents() {
        // クリックイベント
        this.uploadArea.addEventListener('click', () => {
            console.log('Upload area clicked');
            this.videoInput.click();
        });
        
        // ドラッグ&ドロップイベント
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.uploadArea.classList.add('drag-over');
            console.log('Drag over');
        });

        this.uploadArea.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.uploadArea.classList.add('drag-over');
        });

        this.uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // 子要素から出た場合は無視
            if (!this.uploadArea.contains(e.relatedTarget)) {
                this.uploadArea.classList.remove('drag-over');
                console.log('Drag leave');
            }
        });

        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.uploadArea.classList.remove('drag-over');
            console.log('File dropped');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                console.log('File detected:', files[0].name, files[0].type);
                this.handleVideoFile(files[0]);
            }
        });

        this.videoInput.addEventListener('change', (e) => {
            console.log('Input file changed');
            if (e.target.files.length > 0) {
                console.log('File selected:', e.target.files[0].name, e.target.files[0].type);
                this.handleVideoFile(e.target.files[0]);
            }
        });

        this.speedSlider.addEventListener('input', (e) => {
            this.currentSpeed = e.target.value / 100;
            this.updateSpeedDisplay();
            this.updateVideoPlaybackRate();
        });

        this.presetButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const speed = parseInt(e.target.dataset.speed);
                this.speedSlider.value = speed;
                this.currentSpeed = speed / 100;
                this.updateSpeedDisplay();
                this.updatePresetButtons(speed);
                this.updateVideoPlaybackRate();
            });
        });

        this.previewBtn.addEventListener('click', () => {
            if (this.previewVideo.paused) {
                this.previewVideo.play();
                this.previewBtn.textContent = '一時停止';
            } else {
                this.previewVideo.pause();
                this.previewBtn.textContent = 'プレビュー';
            }
        });
        this.convertBtn.addEventListener('click', () => this.convertVideo());
        this.resetBtn.addEventListener('click', () => this.resetTool());
    }

    async initializeFFmpeg() {
        try {
            console.log('Starting FFmpeg initialization...');
            
            // グローバル変数の存在確認と待機
            await this.waitForLibraries();
            
            const { FFmpeg } = window.FFmpegWASM || FFmpegWASM;
            const { toBlobURL } = window.FFmpegUtil || FFmpegUtil;
            
            if (!FFmpeg || !toBlobURL) {
                throw new Error('FFmpeg libraries not available');
            }
            
            this.ffmpeg = new FFmpeg();
            
            // 進歩的なエラーハンドリングで複数のCDNを試行
            const cdnUrls = [
                'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd',
                'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd'
            ];
            
            for (const baseURL of cdnUrls) {
                try {
                    console.log(`Trying CDN: ${baseURL}`);
                    await this.ffmpeg.load({
                        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                    });
                    
                    console.log('FFmpeg initialized successfully with:', baseURL);
                    return;
                } catch (error) {
                    console.warn(`Failed to load from ${baseURL}:`, error);
                    continue;
                }
            }
            
            throw new Error('All CDN attempts failed');
            
        } catch (error) {
            console.error('FFmpeg initialization failed:', error);
            this.showError(`FFmpegの初期化に失敗しました。\n詳細: ${error.message}\n\nインターネット接続を確認してページを再読み込みしてください。`);
        }
    }

    async waitForLibraries() {
        console.log('Waiting for libraries to load...');
        
        return new Promise((resolve) => {
            const checkLibraries = () => {
                const ffmpegLoaded = typeof window.FFmpegWASM !== 'undefined' || typeof FFmpegWASM !== 'undefined';
                const utilLoaded = typeof window.FFmpegUtil !== 'undefined' || typeof FFmpegUtil !== 'undefined';
                
                if (ffmpegLoaded && utilLoaded) {
                    console.log('All libraries loaded successfully');
                    resolve();
                } else {
                    console.log('Still waiting... FFmpeg:', ffmpegLoaded, 'Util:', utilLoaded);
                    setTimeout(checkLibraries, 200);
                }
            };
            
            checkLibraries();
        });
    }

    handleVideoFile(file) {
        console.log('Handling video file:', file.name, file.type, file.size);
        
        if (!file || !file.type) {
            this.showError('有効なファイルを選択してください。');
            return;
        }

        if (!file.type.startsWith('video/')) {
            this.showError('動画ファイルを選択してください。\n対応形式: MP4, AVI, MOV, WebM, MKV');
            return;
        }

        try {
            this.currentVideo = file;
            const url = URL.createObjectURL(file);
            
            this.previewVideo.src = url;
            this.videoFileName.textContent = file.name;
            
            this.previewVideo.addEventListener('loadedmetadata', () => {
                const duration = this.formatDuration(this.previewVideo.duration);
                this.videoDuration.textContent = `時間: ${duration}`;
                this.updateVideoPlaybackRate(); // 動画ロード時に現在のスピードを適用
                console.log('Video metadata loaded, duration:', this.previewVideo.duration);
            });

            this.previewVideo.addEventListener('error', (e) => {
                console.error('Video loading error:', e);
                this.showError('動画の読み込みに失敗しました。対応している形式か確認してください。');
            });

            // 動画の再生状態に応じてプレビューボタンのテキストを更新
            this.previewVideo.addEventListener('play', () => {
                this.previewBtn.textContent = '一時停止';
            });

            this.previewVideo.addEventListener('pause', () => {
                this.previewBtn.textContent = 'プレビュー';
            });

            this.previewVideo.addEventListener('ended', () => {
                this.previewBtn.textContent = 'プレビュー';
            });

            this.controlsSection.style.display = 'block';
            this.uploadArea.style.display = 'none';
            
            console.log('Video file loaded successfully');
        } catch (error) {
            console.error('Error handling video file:', error);
            this.showError('ファイルの処理中にエラーが発生しました。');
        }
    }

    updateSpeedDisplay() {
        this.speedValue.textContent = `${this.currentSpeed.toFixed(1)}x`;
        
        this.presetButtons.forEach(btn => {
            const btnSpeed = parseInt(btn.dataset.speed);
            btn.classList.toggle('active', btnSpeed === this.speedSlider.value);
        });
    }

    updateVideoPlaybackRate() {
        if (this.previewVideo && this.previewVideo.src) {
            this.previewVideo.playbackRate = this.currentSpeed;
            console.log('Video playback rate updated to:', this.currentSpeed);
        }
    }

    updatePresetButtons(activeSpeed) {
        this.presetButtons.forEach(btn => {
            const btnSpeed = parseInt(btn.dataset.speed);
            btn.classList.toggle('active', btnSpeed === activeSpeed);
        });
    }

    async convertVideo() {
        if (this.isProcessing || !this.currentVideo || !this.ffmpeg) {
            return;
        }

        this.isProcessing = true;
        this.showProgress();
        
        try {
            const inputName = 'input.mp4';
            const outputName = `output_${this.currentSpeed}x.mp4`;
            
            await this.ffmpeg.writeFile(inputName, await this.fetchFile(this.currentVideo));
            
            this.updateProgress('動画を変換中...', 25);
            
            await this.ffmpeg.exec([
                '-i', inputName,
                '-filter:v', `setpts=${1/this.currentSpeed}*PTS`,
                '-filter:a', `atempo=${this.currentSpeed}`,
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '23',
                outputName
            ]);

            this.updateProgress('変換完了、ダウンロード準備中...', 90);

            const data = await this.ffmpeg.readFile(outputName);
            const blob = new Blob([data.buffer], { type: 'video/mp4' });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.getFileNameWithoutExtension(this.currentVideo.name)}_${this.currentSpeed}x.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.updateProgress('ダウンロード完了！', 100);
            
            setTimeout(() => {
                this.hideProgress();
            }, 2000);

        } catch (error) {
            console.error('Conversion error:', error);
            this.showError('動画の変換中にエラーが発生しました。');
            this.hideProgress();
        } finally {
            this.isProcessing = false;
        }
    }

    async fetchFile(file) {
        const arrayBuffer = await file.arrayBuffer();
        return new Uint8Array(arrayBuffer);
    }

    showProgress() {
        this.progressSection.style.display = 'block';
        this.convertBtn.disabled = true;
        this.convertBtn.textContent = '変換中...';
    }

    hideProgress() {
        this.progressSection.style.display = 'none';
        this.convertBtn.disabled = false;
        this.convertBtn.textContent = '変換してダウンロード';
        this.updateProgress('', 0);
    }

    updateProgress(text, percent) {
        this.progressText.textContent = text;
        this.progressPercent.textContent = `${percent}%`;
        this.progressFill.style.width = `${percent}%`;
    }

    resetTool() {
        this.currentVideo = null;
        this.currentSpeed = 1.0;
        this.speedSlider.value = 100;
        this.updateSpeedDisplay();
        
        this.previewVideo.src = '';
        this.previewVideo.pause();
        this.previewBtn.textContent = 'プレビュー';
        this.videoFileName.textContent = '';
        this.videoDuration.textContent = '';
        
        this.controlsSection.style.display = 'none';
        this.uploadArea.style.display = 'block';
        this.hideProgress();
        
        this.videoInput.value = '';
    }

    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    getFileNameWithoutExtension(fileName) {
        return fileName.replace(/\.[^/.]+$/, '');
    }

    showError(message) {
        alert(message);
    }
}

// ページ読み込み完了後にアプリを初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing VideoSpeedConverter...');
    new VideoSpeedConverter();
});

// スクリプトエラーのグローバルハンドラー
window.addEventListener('error', (event) => {
    if (event.filename.includes('ffmpeg') || event.filename.includes('util')) {
        console.error('FFmpeg library loading error:', event.error);
        alert('FFmpegライブラリの読み込み中にエラーが発生しました。ページを再読み込みしてください。');
    }
});