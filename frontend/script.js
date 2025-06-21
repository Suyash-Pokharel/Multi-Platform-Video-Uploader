const BACKEND_URL = "https://multi-platform-video-uploader.onrender.com";


    document.addEventListener("DOMContentLoaded", () => {
    const elements = {
        mainFlowContainer: document.getElementById("mainFlowContainer"),
        successSection: document.getElementById("successSection"),
        scheduleAnotherBtn: document.getElementById("scheduleAnotherBtn"),
        progressBarContainer: document.getElementById("progressBarContainer"),
        progressBar: document.getElementById("progressBar"),
        mainUploadSection: document.getElementById("mainUploadSection"),
        videoDropZone: document.getElementById("videoDropZone"),
        videoInput: document.getElementById("videoInput"),
        browseVideoBtn: document.getElementById("browseVideoBtn"),
        removeVideoBtn: document.getElementById("removeVideoBtn"),
        videoErrorMsg: document.getElementById("videoErrorMsgElement"),
        uploadStatus: document.getElementById("uploadStatus"),
        videoPreviewDiv: document.getElementById("videoPreview"),
        videoPreviewModal: document.getElementById("videoPreviewModal"),
        videoPreviewContainer: document.getElementById("videoPreviewContainer"),
        removePreviewVideoBtn: document.getElementById("removePreviewVideoBtn"),
        closePreviewModalBtn: document.getElementById("closePreviewModalBtn"),
        nextToConfigBtn: document.getElementById("nextToConfigBtn"),
        configModal: document.getElementById("configModal"),
        closeConfigModalBtn: document.getElementById("closeConfigModalBtn"),
        thumbnailDropZone: document.getElementById("thumbnailDropZone"),
        thumbnailInput: document.getElementById("thumbnailInput"),
        browseThumbnailBtn: document.getElementById("browseThumbnailBtn"),
        removeThumbBtn: document.getElementById("removeThumbBtn"),
        thumbnailPreviewDiv: document.getElementById("thumbnailPreview"),
        thumbErrorMsg: document.getElementById("thumbErrorMsgElement"),
        postForm: document.getElementById("postForm"),
        postTitleInput: document.getElementById("postTitle"),
        postDescriptionInput: document.getElementById("postDescription"),
        postTagsInput: document.getElementById("postTags"),
        scheduleTimeInput: document.getElementById("scheduleTime"),
        configSubmitStatus: document.getElementById("configSubmitStatus"),
        goToPlatformsBtn: document.getElementById("goToPlatformsBtn"),
        platformModal: document.getElementById("platformModal"),
        closePlatformModalBtn: document.getElementById("closePlatformModalBtn"),
        platformSelectionGrid: document.getElementById("platformSelectionGrid"),
        confirmPlatformsBtn: document.getElementById("confirmPlatformsBtn"),
        platformSubmitStatus: document.getElementById("platformSubmitStatus"),
        // New elements for enhancements
        generateThumbBtn: document.getElementById("generateThumbBtn"),
        titleError: document.getElementById("titleError"),
        descriptionError: document.getElementById("descriptionError"),
        scheduleError: document.getElementById("scheduleError"),
        restoreDraftBar: document.getElementById("restoreDraftBar"),
        restoreDraftBtn: document.getElementById("restoreDraftBtn"),
        dismissDraftBtn: document.getElementById("dismissDraftBtn"),
        // New confirm-remove-upload modal elements
        confirmRemoveModal: document.getElementById("confirmRemoveModal"),
        confirmRemoveBtn:   document.getElementById("confirmRemoveBtn"),
        cancelRemoveBtn:    document.getElementById("cancelRemoveBtn"),
    };

    let state = {
        currentVideoFile: null,
        currentThumbnailFile: null,
        videoPreviewElement: null,
        currentVideoObjectURL: null,
        currentThumbnailObjectURL: null,
        pendingFormData: null,
        selectedPlatforms: [],
        isSubmitting: false,
        uploadXhr: null, 
    };

    const DRAFT_STORAGE_KEY = "vidflow_draft_v1";

    function initializeApp() {
        setupEventListeners();
        setMinScheduleTime();

        // Set initial states for UI elements
        elements.videoPreviewModal.setAttribute("aria-hidden", "true");
        elements.configModal.setAttribute("aria-hidden", "true");
        elements.platformModal.setAttribute("aria-hidden", "true");
        elements.successSection.style.display = "none";
        elements.mainFlowContainer.style.display = "block";

        // Check for saved draft on page load
        checkForSavedDraft();
    }

    function setupEventListeners() {
        initDropZone(
        elements.videoDropZone,
        elements.videoInput,
        elements.browseVideoBtn,
        handleVideoFileSelect,
        elements.videoErrorMsg,
        "video"
        );
        initDropZone(
        elements.thumbnailDropZone,
        elements.thumbnailInput,
        elements.browseThumbnailBtn,
        handleThumbnailFileSelect,
        elements.thumbErrorMsg,
        "image"
                );
        // When clicking the ✕ on the drop‑zone or preview
        elements.removeVideoBtn.addEventListener("click", () => showModal(elements.confirmRemoveModal));
        elements.removePreviewVideoBtn.addEventListener("click", () => showModal(elements.confirmRemoveModal));

        // Modal buttons
        elements.confirmRemoveBtn.addEventListener("click", () => {
        // Abort and cleanup
        if (state.uploadXhr) state.uploadXhr.abort();
        clearVideoSelection();
        hideModal(elements.confirmRemoveModal);
        });
        elements.cancelRemoveBtn.addEventListener("click", () => {
        // Just close the modal, continue upload
        hideModal(elements.confirmRemoveModal);
        });

        elements.removeThumbBtn.addEventListener("click", clearThumbnailSelection);
        elements.nextToConfigBtn.addEventListener("click", showConfigModal);
        elements.goToPlatformsBtn.addEventListener("click", handleGoToPlatforms);
        elements.confirmPlatformsBtn.addEventListener(
        "click",
        handlePlatformConfirmation
        );
        elements.closePreviewModalBtn.addEventListener(
        "click",
        clearVideoSelection
        );
        elements.closeConfigModalBtn.addEventListener("click", () =>
        closeModal(elements.configModal)
        );
        elements.closePlatformModalBtn.addEventListener(
        "click",
        cancelPlatformSelection
        );
        elements.videoPreviewModal.addEventListener("click", handleModalBackdropClick);
        elements.configModal.addEventListener("click", handleModalBackdropClick);
        elements.platformModal.addEventListener("click", handleModalBackdropClick);

        // Close confirm-remove modal on outside click
        elements.confirmRemoveModal.addEventListener("click", (e) => {
        if (e.target === elements.confirmRemoveModal) hideModal(elements.confirmRemoveModal);
        });

        elements.postForm.addEventListener("submit", (e) => e.preventDefault());

        // This is your original, working tag formatter
        elements.postTagsInput.addEventListener("input", handleTagsInputFormatting);

        elements.platformSelectionGrid.addEventListener(
        "click",
        handlePlatformToggle
        );
        elements.scheduleAnotherBtn.addEventListener("click", resetApp);

        // --- Enhancement Listeners ---
        elements.generateThumbBtn.addEventListener(
        "click",
        handleGenerateThumbnail
        );
        elements.restoreDraftBtn.addEventListener("click", loadDraft);
        elements.dismissDraftBtn.addEventListener("click", () => {
        clearDraft();
        showRestoreBar(false);
        });

        // Listeners for inline validation on blur (when user clicks away)
        elements.postTitleInput.addEventListener("blur", () =>
        validateField(
            elements.postTitleInput,
            elements.titleError,
            "Title is required."
        )
        );
        elements.postDescriptionInput.addEventListener("blur", () =>
        validateField(
            elements.postDescriptionInput,
            elements.descriptionError,
            "Description is required."
        )
        );
        elements.scheduleTimeInput.addEventListener("blur", () =>
        validateField(
            elements.scheduleTimeInput,
            elements.scheduleError,
            "Schedule time is required."
        )
        );

        // Listeners for auto-saving drafts on input
        elements.postTitleInput.addEventListener("input", saveDraft);
        elements.postDescriptionInput.addEventListener("input", saveDraft);
        elements.postTagsInput.addEventListener("input", saveDraft);
    }

    // --- New Feature: Generate Thumbnail from Video ---
    function handleGenerateThumbnail() {
        if (!state.videoPreviewElement) return;
        const canvas = document.createElement("canvas");
        canvas.width = state.videoPreviewElement.videoWidth;
        canvas.height = state.videoPreviewElement.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(state.videoPreviewElement, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
        const thumbnailFile = new File([blob], "thumbnail.png", {
            type: "image/png",
        });
        handleThumbnailFileSelect(thumbnailFile);
        showConfigModal();
        }, "image/png");
    }

    // --- New Feature: Inline Field Validation ---
    function validateField(input, errorElement, message) {
        if (!input.value.trim()) {
        errorElement.classList.add("visible");
        input.classList.add("invalid");
        return false;
        } else {
        errorElement.classList.remove("visible");
        input.classList.remove("invalid");
        return true;
        }
    }

    // --- New Feature: Draft Management Functions ---
    function saveDraft() {
        if (!state.currentVideoFile) return;
        const draft = {
        title: elements.postTitleInput.value,
        description: elements.postDescriptionInput.value,
        tags: elements.postTagsInput.value,
        };
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    }

    function loadDraft() {
        const draftString = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (draftString) {
        const draft = JSON.parse(draftString);
        elements.postTitleInput.value = draft.title;
        elements.postDescriptionInput.value = draft.description;
        elements.postTagsInput.value = draft.tags;
        }
        showRestoreBar(false);
    }

    function clearDraft() {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
    }

    function checkForSavedDraft() {
        if (localStorage.getItem(DRAFT_STORAGE_KEY) && !state.currentVideoFile) {
        showRestoreBar(true);
        }
    }

    function showRestoreBar(show) {
        elements.restoreDraftBar.style.display = show ? "flex" : "none";
    }

    // --- Original Functions (Verified and Maintained) ---
    // (The following code is your original, working logic, with enhancements integrated)

    function initDropZone(
        dropZone,
        input,
        browseBtn,
        fileHandler,
        errorMsgElement,
        fileType
    ) {
        ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        if (eventName === "dragover" || eventName === "drop") {
            document.body.addEventListener(eventName, preventDefaults, false);
        }
        });
        ["dragenter", "dragover"].forEach((eventName) => {
        dropZone.addEventListener(
            eventName,
            () => {
            if (!dropZone.classList.contains("has-file"))
                dropZone.classList.add("active");
            },
            false
        );
        });
        ["dragleave", "drop"].forEach((eventName) => {
        dropZone.addEventListener(
            eventName,
            () => dropZone.classList.remove("active"),
            false
        );
        });
        dropZone.addEventListener(
        "drop",
        (e) => {
            if (dropZone.classList.contains("has-file")) return;
            const file = e.dataTransfer?.files[0];
            if (file) {
            input.files = e.dataTransfer.files;
            fileHandler(file);
            }
        },
        false
        );
        browseBtn.addEventListener("click", () => {
        if (dropZone.classList.contains("has-file")) return;
        input.click();
        });
        input.addEventListener("change", (e) => {
        if (dropZone.classList.contains("has-file")) return;
        const file = e.target.files?.[0];
        if (file) fileHandler(file);
        });
    }
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    async function handleVideoFileSelect(file) {
        clearError(
        elements.videoDropZone,
        elements.videoErrorMsg,
        elements.videoInput
        );
        safeRevokeObjectURL(state.currentVideoObjectURL);
        state.currentVideoObjectURL = URL.createObjectURL(file);
        try {
        state.currentVideoFile = file;
        elements.videoPreviewDiv.querySelector(".file-info").textContent = `${
            file.name
        } (${formatFileSize(file.size)})`;
        elements.videoDropZone.classList.add("has-file");
        showModal(elements.videoPreviewModal);
        showVideoPreviewElement(state.currentVideoObjectURL);
        } catch (error) {
        handleFileError(
            error,
            elements.videoDropZone,
            elements.videoErrorMsg,
            elements.videoInput,
            "video"
        );
        }
    }
    async function handleThumbnailFileSelect(file) {
        clearError(
        elements.thumbnailDropZone,
        elements.thumbErrorMsg,
        elements.thumbnailInput
        );
        safeRevokeObjectURL(state.currentThumbnailObjectURL);
        state.currentThumbnailObjectURL = URL.createObjectURL(file);
        try {
        state.currentThumbnailFile = file;
        elements.thumbnailPreviewDiv.style.backgroundImage = `url('${state.currentThumbnailObjectURL}')`;
        elements.thumbnailDropZone.classList.add("has-file");
        } catch (error) {
        handleFileError(
            error,
            elements.thumbnailDropZone,
            elements.thumbErrorMsg,
            elements.thumbnailInput,
            "thumbnail"
        );
        }
    }
    function handleFileError(
        error,
        dropZone,
        errorMsgElement,
        inputElement,
        fileType
    ) {
        console.error(`${fileType} handling error:`, error);
        showError(
        dropZone,
        errorMsgElement,
        inputElement,
        error.message || `Failed to process ${fileType}.`
        );
        if (fileType === "video") clearVideoSelection();
        else if (fileType === "thumbnail") clearThumbnailSelection();
    }
    function showModal(modalElement) {
        modalElement.setAttribute("aria-hidden", "false");
        modalElement.classList.add("open");
        const firstFocusable = modalElement.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
    }
    function closeModal(modalElement) {
        modalElement.setAttribute("aria-hidden", "true");
        modalElement.classList.remove("open");
    }    
    function hideModal(modal) {
        closeModal(modal);
    }
    function handleModalBackdropClick(e) {
        if (e.target === elements.videoPreviewModal) {
        clearVideoSelection();
        } else if (e.target === elements.configModal) {
        closeModal(elements.configModal);
        } else if (e.target === elements.platformModal) {
        cancelPlatformSelection();
        }
    }
    function showVideoPreviewElement(videoSrc) {
        elements.videoPreviewContainer.innerHTML = "";
        elements.removePreviewVideoBtn.style.display = "none";
        state.videoPreviewElement = document.createElement("video");
        state.videoPreviewElement.controls = true;
        state.videoPreviewElement.src = videoSrc;
        state.videoPreviewElement.preload = "metadata";
        state.videoPreviewElement.onloadedmetadata = () =>
        (elements.removePreviewVideoBtn.style.display = "flex");
        state.videoPreviewElement.onerror = () => {
        console.error("Error loading video in preview modal.");
        showStatusMessage(
            elements.uploadStatus,
            "Error loading file preview (might not be a video).",
            "error"
        );
        closeModal(elements.videoPreviewModal);
        clearVideoSelection();
        };
        elements.videoPreviewContainer.appendChild(state.videoPreviewElement);
    }

    function clearVideoSelection() {
        // 1) Hide progress UI and clear status
        elements.progressBarContainer.setAttribute("aria-hidden", "true");
        showStatusMessage(elements.uploadStatus, "", "info");

        // 2) Remove the video preview
        closeModal(elements.videoPreviewModal);
        state.currentVideoFile = null;
        safeRevokeObjectURL(state.currentVideoObjectURL);
        state.currentVideoObjectURL = null;
        elements.videoDropZone.classList.remove("has-file", "error", "active");
        elements.videoPreviewDiv.querySelector(".file-info").textContent = "";
        clearError(elements.videoDropZone, elements.videoErrorMsg, elements.videoInput);
        elements.videoInput.value = "";
        if (state.videoPreviewElement) {
            state.videoPreviewElement.remove();
            state.videoPreviewElement = null;
        }
        if (elements.removePreviewVideoBtn) {
            elements.removePreviewVideoBtn.style.display = "none";
        }
        
        // 3) ALSO remove the thumbnail preview
        clearThumbnailSelection();

        // 4) RESET upload state so nothing thinks an upload is running
        if (state.uploadXhr) {
            state.uploadXhr.abort();      // just in case
            state.uploadXhr = null;
        }
        state.isSubmitting = false;
        state.pendingFormData = null;
        toggleButtonState(elements.confirmPlatformsBtn, false);
        
        // 5) Clear any saved draft UI
        clearDraft();
        showRestoreBar(false);
    }

    function clearThumbnailSelection() {
        state.currentThumbnailFile = null;
        elements.thumbnailDropZone.classList.remove("has-file", "error", "active");
        elements.thumbnailPreviewDiv.style.backgroundImage = "none";
        clearError(
        elements.thumbnailDropZone,
        elements.thumbErrorMsg,
        elements.thumbnailInput
        );
        elements.thumbnailInput.value = "";
        safeRevokeObjectURL(state.currentThumbnailObjectURL);
        state.currentThumbnailObjectURL = null;
    }
    function showConfigModal() {
        if (!state.currentVideoFile) {
        showStatusMessage(
            elements.uploadStatus,
            "Please select a video file first.",
            "error"
        );
        return;
        }
        closeModal(elements.videoPreviewModal);
        setMinScheduleTime();
        showModal(elements.configModal);
    }

    function resetConfigFormUI() {
        elements.postForm.reset();
        clearThumbnailSelection();
        showStatusMessage(elements.configSubmitStatus, "", "info");
        elements.titleError.classList.remove("visible");
        elements.descriptionError.classList.remove("visible");
        elements.scheduleError.classList.remove("visible");
        elements.postTitleInput.classList.remove("invalid");
        elements.postDescriptionInput.classList.remove("invalid");
        elements.scheduleTimeInput.classList.remove("invalid");
    }

    function cancelPlatformSelection() {
        closeModal(elements.platformModal);
        state.pendingFormData = null;
        state.selectedPlatforms = [];
        elements.platformSelectionGrid
        .querySelectorAll(".platform-button.selected")
        .forEach((btn) => {
            btn.classList.remove("selected");
            btn.setAttribute("aria-pressed", "false");
        });
    }

    function handleGoToPlatforms() {
        // Use the inline validation function
        const isTitleValid = validateField(
        elements.postTitleInput,
        elements.titleError,
        "Title is required."
        );
        const isDescriptionValid = validateField(
        elements.postDescriptionInput,
        elements.descriptionError,
        "Description is required."
        );
        const isScheduleValid = validateField(
        elements.scheduleTimeInput,
        elements.scheduleError,
        "Schedule time is required."
        );
        if (!isTitleValid || !isDescriptionValid || !isScheduleValid) {
        showStatusMessage(
            elements.configSubmitStatus,
            "Please fill out all required fields.",
            "error"
        );
        return;
        }

        state.pendingFormData = createFormData();
        state.selectedPlatforms = [];
        elements.platformSelectionGrid
        .querySelectorAll(".platform-button.selected")
        .forEach((btn) => {
            btn.classList.remove("selected");
            btn.setAttribute("aria-pressed", "false");
        });
        closeModal(elements.configModal);
        showModal(elements.platformModal);
    }

    function handlePlatformToggle(e) {
        showStatusMessage(elements.platformSubmitStatus, "", "info");
        const button = e.target.closest(".platform-button");
        if (!button) return;
        const platform = button.dataset.platform;
        if (!platform) return;
        button.classList.toggle("selected");
        const isSelected = button.classList.contains("selected");
        button.setAttribute("aria-pressed", isSelected ? "true" : "false");
        if (isSelected) {
        if (!state.selectedPlatforms.includes(platform)) {
            state.selectedPlatforms.push(platform);
        }
        } else {
        state.selectedPlatforms = state.selectedPlatforms.filter(
            (p) => p !== platform
        );
        }
    }

    // 1) Only one handlePlatformConfirmation:
    function handlePlatformConfirmation() {
    if (state.isSubmitting) return;
    if (!state.pendingFormData) {
        showStatusMessage(
        elements.platformSubmitStatus,
        "Error: Form data missing. Please start over.",
        "error"
        );
        return;
    }
    if (state.selectedPlatforms.length === 0) {
        showStatusMessage(
        elements.platformSubmitStatus,
        "Please select at least one platform.",
        "error"
        );
        return;
    }

    // Attach platforms array and start upload
    state.pendingFormData.append(
        "platforms",
        JSON.stringify(state.selectedPlatforms)
    );
    state.isSubmitting = true;
    toggleButtonState(elements.confirmPlatformsBtn, true, "Uploading...");
    closeModal(elements.platformModal);

    elements.progressBarContainer.setAttribute("aria-hidden", "false");
    elements.progressBar.style.width = "0%";
    showStatusMessage(elements.uploadStatus, "Preparing to upload...", "info");

    uploadToServer(state.pendingFormData);
    }

    // 2) Only one uploadToServer helper:
    function uploadToServer(formData) {
    const xhr = new XMLHttpRequest();
    state.uploadXhr = xhr;
    xhr.open("POST", `${BACKEND_URL}/api/upload`, true);
    xhr.upload.onprogress = e => {
        if (e.lengthComputable) {
        const pct = Math.round(e.loaded / e.total * 100);
        elements.progressBar.style.width = pct + '%';
        showStatusMessage(elements.uploadStatus, `Uploading… ${pct}%`);
        }
    };
    xhr.onload = () => {
        if (xhr.status === 200) showSuccessScreen();
        else showStatusMessage(elements.uploadStatus, 'Upload failed.', 'error');
    };
    xhr.onerror = () =>
        showStatusMessage(elements.uploadStatus, 'Network error.', 'error');

    // Ensure the progress bar is visible
    elements.progressBarContainer.setAttribute('aria-hidden', 'false');
    xhr.send(formData);
    }

    function showSuccessScreen() {
        state.isSubmitting = false;
        state.uploadXhr = null;
        state.pendingFormData = null;
        toggleButtonState(elements.confirmPlatformsBtn, false);

        elements.mainFlowContainer.style.display = "none";
        elements.successSection.style.display = "block";
        elements.uploadStatus.textContent = "";
        elements.progressBarContainer.setAttribute("aria-hidden", "true");
        elements.progressBar.style.width = "0%";
        clearDraft();
        showRestoreBar(false);
    }

    function resetApp() {
        elements.successSection.style.display = "none";
        elements.mainFlowContainer.style.display = "block";
        clearVideoSelection();
        resetConfigFormUI();
        state.selectedPlatforms = [];
        state.pendingFormData = null;
        elements.platformSelectionGrid
        .querySelectorAll(".platform-button.selected")
        .forEach((btn) => {
            btn.classList.remove("selected");
            btn.setAttribute("aria-pressed", "false");
        });
        showStatusMessage(elements.uploadStatus, "", "info");
        showStatusMessage(elements.platformSubmitStatus, "", "info");
        state.isSubmitting = false;
        if (elements.confirmPlatformsBtn.disabled) {
        toggleButtonState(elements.confirmPlatformsBtn, false);
        }
    }

    function createFormData() {
        let finalTags = elements.postTagsInput.value.trim();
        // Your original logic for ensuring tags start with #
        if (finalTags) {
        finalTags = finalTags
            .split(" ")
            .filter(Boolean)
            .map((tag) => "#" + tag.replace(/^#+/, ""))
            .join(" ");
        }
        const formData = new FormData();
        formData.append(
        "video",
        state.currentVideoFile,
        state.currentVideoFile.name
        );
        if (state.currentThumbnailFile) {
        formData.append(
            "thumbnail",
            state.currentThumbnailFile,
            state.currentThumbnailFile.name
        );
        }
        formData.append("title", elements.postTitleInput.value.trim());
        formData.append("description", elements.postDescriptionInput.value.trim());
        formData.append("tags", finalTags);
        formData.append("scheduleTime", elements.scheduleTimeInput.value);
        return formData;
    }

    // --- THIS IS YOUR ORIGINAL, WORKING FUNCTION. IT IS NOW RESTORED. ---
    function handleTagsInputFormatting(e) {
        const input = e.target;
        const originalValue = input.value;
        const cursorPosition = input.selectionStart;
        let value = originalValue.replace(/\s{2,}/g, " ").trimStart();
        if (value && !value.startsWith("#")) {
        value = "#" + value;
        }
        const parts = value.split(" ");
        let processedValue = "";
        let trailingSpace = false;
        if (parts.length === 1 && parts[0] === "#") {
        processedValue = "#";
        } else if (parts.length > 0) {
        processedValue = parts
            .map((part, index) => {
            if (
                !part &&
                index === parts.length - 1 &&
                originalValue.endsWith(" ")
            ) {
                trailingSpace = true;
                return "";
            }
            if (!part) return "";
            return "#" + part.replace(/^#+/, "");
            })
            .filter(Boolean)
            .join(" ");
        }
        if (trailingSpace) {
        processedValue += " ";
        }
        if (input.value !== processedValue) {
        input.value = processedValue;
        try {
            const diff = processedValue.length - originalValue.length;
            const newCursorPos = Math.max(0, cursorPosition + diff);
            const finalCursorPos = Math.min(processedValue.length, newCursorPos);
            if (
            originalValue.charAt(cursorPosition - 1) !== "#" &&
            processedValue.charAt(cursorPosition + diff - 1) === "#"
            ) {
            input.setSelectionRange(finalCursorPos + 1, finalCursorPos + 1);
            } else {
            input.setSelectionRange(finalCursorPos, finalCursorPos);
            }
        } catch (ex) {
            console.warn("Cursor position issue", ex);
            input.setSelectionRange(processedValue.length, processedValue.length);
        }
        }
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
        const i = Math.max(0, Math.floor(Math.log(bytes) / Math.log(k)));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }
    function toggleButtonState(button, isLoading, loadingText = "Processing...") {
        const textElement = button.querySelector(".button-text");
        if (!button.dataset.originalText && textElement) {
        button.dataset.originalText = textElement.textContent.trim();
        }
        const originalText = button.dataset.originalText || "";
        button.disabled = isLoading;
        button.classList.toggle("is-loading", isLoading);
        if (textElement) {
        textElement.textContent = isLoading ? loadingText : originalText;
        }
    }
    function showError(dropZone, errorMsgElement, inputElement, message) {
        if (!dropZone || !errorMsgElement) return;
        dropZone.classList.add("error");
        errorMsgElement.textContent = message;
        inputElement?.setAttribute("aria-invalid", "true");
        inputElement?.setAttribute("aria-describedby", errorMsgElement.id);
    }
    function clearError(dropZone, errorMsgElement, inputElement) {
        if (!dropZone || !errorMsgElement) return;
        dropZone.classList.remove("error");
        errorMsgElement.textContent = "";
        inputElement?.removeAttribute("aria-invalid");
        inputElement?.removeAttribute("aria-describedby");
    }
    function showStatusMessage(element, message, type = "info") {
        if (!element) return;
        element.textContent = message;
        element.style.color =
        type === "error"
            ? "var(--error)"
            : type === "success"
            ? "var(--success)"
            : "var(--on-surface-secondary)";
        element.style.fontWeight =
        type === "error" || type === "success" ? "500" : "normal";
    }
    function setMinScheduleTime() {
        try {
            const now = new Date();
            now.setMinutes(now.getMinutes() + 1);
            const localDateTime = now.toISOString().slice(0, 16);
            elements.scheduleTimeInput.min = localDateTime;
        } catch (e) {
            console.error("Error setting min schedule time:", e);
        }
    }
    function safeRevokeObjectURL(url) {
        if (url && typeof url === "string" && url.startsWith("blob:")) {
        try {
            URL.revokeObjectURL(url);
        } catch (e) {
            console.warn("Failed to revoke ObjectURL:", url, e);
        }
        }
    }

    // Kick everything off
    initializeApp();
    });
