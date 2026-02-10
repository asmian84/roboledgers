window.updateProgressBar = (current, total, fileName, stage, txnCount) => {
    const percent = Math.round((current / total) * 100);

    // Null-safe updates - prevent silent failures on first upload
    const fill = document.getElementById('progress-bar-fill');
    const title = document.getElementById('progress-title');
    const subtitle = document.getElementById('progress-subtitle');
    const fileCount = document.getElementById('progress-file-count');
    const txnCountEl = document.getElementById('progress-txn-count');

    if (fill) fill.style.width = `${percent}%`;
    if (title) title.textContent = stage;
    if (subtitle) subtitle.textContent = fileName;
    if (fileCount) fileCount.textContent = `${current} / ${total} files`;
    if (txnCountEl) txnCountEl.textContent = `${txnCount} transactions`;
};
