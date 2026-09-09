/**
 * ACPC Choice Filling & Merit Predictor Pro
 * Modern Client-Side Controller & State Engine
 */

// Global State
let isLiveSearchActive = false;
let currentSearchResults = [];
let preferenceList = [];
let comparisonList = [];
let currentPage = 1;
const pageSize = 20;
let activeCityFilter = "";
let marksDebounceTimer = null;

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    loadSavedPreferences();
    setupEventListeners();
});

// ==========================================
// 1. THEME ENGINE
// ==========================================
function initTheme() {
    const savedTheme = localStorage.getItem("acpc_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("acpc_theme", nextTheme);
    updateThemeIcon(nextTheme);
}

function updateThemeIcon(theme) {
    const icon = document.getElementById("theme-icon");
    if (icon) {
        icon.innerText = theme === "dark" ? "🌙" : "☀️";
    }
}

// ==========================================
// 2. RANK & PERCENTILE ENGINE
// ==========================================
function setRankMode(mode) {
    document.getElementById("manual-rank-section").style.display = mode === "manual" ? "block" : "none";
    document.getElementById("calc-pr-section").style.display = mode === "pr" ? "block" : "none";
    document.getElementById("calc-marks-section").style.display = mode === "marks" ? "block" : "none";

    document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
    const map = { manual: "tab-manual", pr: "tab-pr", marks: "tab-marks" };
    if (map[mode]) document.getElementById(map[mode]).classList.add("active");
}

function onDirectRankInput() {
    const rankVal = parseFloat(document.getElementById("rank").value) || 0;
    const rankDisplay = document.getElementById("calculated-rank-display");
    const prDisplay = document.getElementById("merit-pr-display");
    const breakdownDisplay = document.getElementById("calc-breakdown-display");

    if (rankVal > 0) {
        rankDisplay.innerText = rankVal.toLocaleString();
        prDisplay.innerText = "Direct Entry";
        breakdownDisplay.innerText = `Official / Target Rank #${rankVal}`;
        if (isLiveSearchActive) fetchResults();
    } else {
        rankDisplay.innerText = "—";
        prDisplay.innerText = "— %";
        breakdownDisplay.innerText = "Enter rank or marks above";
    }
}

function calculateByPR() {
    const pcm = parseFloat(document.getElementById("pcm-pr").value) || 0;
    const gujcet = parseFloat(document.getElementById("gujcet-pr").value) || 0;

    if (pcm > 0 && gujcet > 0) {
        const meritPR = (pcm * 0.5) + (gujcet * 0.5);
        let estRank = Math.round((100 - meritPR) * 400);
        if (estRank < 1) estRank = 1;

        document.getElementById("calculated-rank-display").innerText = estRank.toLocaleString();
        document.getElementById("merit-pr-display").innerText = meritPR.toFixed(2) + " %";
        document.getElementById("calc-breakdown-display").innerText = `PCM: ${pcm}% (50%) + GUJCET: ${gujcet}% (50%)`;
        document.getElementById("rank").value = estRank;

        if (isLiveSearchActive) fetchResults();
    }
}

function calculateByMarks() {
    clearTimeout(marksDebounceTimer);
    marksDebounceTimer = setTimeout(() => {
        const pcm = parseFloat(document.getElementById("pcm-mark").value) || 0;
        const gujcet = parseFloat(document.getElementById("gujcet-mark").value) || 0;

        if (pcm > 0 && gujcet > 0) {
            fetch("/api/calculate_rank", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pcm, gujcet, mode: "marks" })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.rank > 0) {
                        document.getElementById("calculated-rank-display").innerText = data.rank.toLocaleString();
                        document.getElementById("merit-pr-display").innerText = data.merit_pr.toFixed(2) + " %";
                        document.getElementById("calc-breakdown-display").innerText = `PCM PR: ${data.pcm_pr} | GUJCET PR: ${data.gujcet_pr}`;
                        document.getElementById("rank").value = data.rank;

                        if (isLiveSearchActive) fetchResults();
                    }
                })
                .catch(err => console.error("Marks rank error:", err));
        }
    }, 300);
}

// ==========================================
// 3. DROPDOWN & FILTER HELPERS
// ==========================================
function toggleDropdown(id) {
    document.querySelectorAll(".dropdown-menu").forEach(menu => {
        if (menu.id !== id) menu.classList.remove("show");
    });
    const target = document.getElementById(id);
    if (target) target.classList.toggle("show");
}

window.onclick = function (event) {
    if (!event.target.closest(".custom-dropdown")) {
        document.querySelectorAll(".dropdown-menu").forEach(menu => menu.classList.remove("show"));
    }
};

function filterDropdownList(inputElem, containerId) {
    const filterText = inputElem.value.toLowerCase();
    const container = document.getElementById(containerId);
    const items = container.querySelectorAll(".dropdown-item");

    items.forEach(item => {
        const text = item.innerText.toLowerCase();
        item.style.display = text.includes(filterText) ? "flex" : "none";
    });
}

function getCheckedValues(className) {
    let values = [];
    document.querySelectorAll("." + className + ":checked").forEach(cb => {
        if (cb.value !== "ALL") values.push(cb.value);
    });
    return values.length > 0 ? values : ["ALL"];
}

function updateDropdownTriggerLabel(cbClass, labelId, defaultText) {
    const checked = document.querySelectorAll("." + cbClass + ":checked");
    const labelElem = document.getElementById(labelId);
    if (!labelElem) return;

    if (checked.length === 0 || (checked.length === 1 && checked[0].value === "ALL")) {
        labelElem.innerText = defaultText;
    } else {
        labelElem.innerText = `${checked.length} Selected`;
    }
}

function selectAllInDropdown(cbClass, labelId, defaultText) {
    document.querySelectorAll("." + cbClass).forEach(cb => cb.checked = true);
    updateDropdownTriggerLabel(cbClass, labelId, defaultText);
    if (isLiveSearchActive) fetchResults();
}

function clearAllInDropdown(cbClass, labelId, defaultText) {
    document.querySelectorAll("." + cbClass).forEach(cb => cb.checked = false);
    const allCb = document.querySelector("." + cbClass + "[value='ALL']");
    if (allCb) allCb.checked = true;
    updateDropdownTriggerLabel(cbClass, labelId, defaultText);
    if (isLiveSearchActive) fetchResults();
}

function setCityFilter(city) {
    activeCityFilter = city;
    document.getElementById("city").value = city;
    document.querySelectorAll(".city-chip").forEach(chip => {
        if (city && chip.innerText.toLowerCase().includes(city.toLowerCase())) {
            chip.classList.add("active");
        } else {
            chip.classList.remove("active");
        }
    });
    if (isLiveSearchActive) fetchResults();
}

// ==========================================
// 4. SEARCH & PREDICTION ENGINE
// ==========================================
function startLiveSearch() {
    const rank = document.getElementById("rank").value;
    if (!rank || parseFloat(rank) <= 0) {
        showToast("⚠️ Please enter or calculate your Merit Rank first!", "warning");
        document.getElementById("rank").focus();
        return;
    }

    isLiveSearchActive = true;
    currentPage = 1;
    fetchResults();

    const btn = document.getElementById("search-btn");
    btn.innerHTML = `<span class="pulse-dot"></span> ⚡ Live Auto-Update Active`;
    btn.style.background = "linear-gradient(135deg, #3b82f6, #1d4ed8)";

    document.getElementById("results-container").scrollIntoView({ behavior: "smooth" });
}

function setupEventListeners() {
    document.querySelectorAll("input, select").forEach(el => {
        el.addEventListener("change", () => {
            if (isLiveSearchActive) {
                currentPage = 1;
                fetchResults();
            }
        });
        if (el.type === "text" || el.type === "number") {
            el.addEventListener("input", () => {
                if (isLiveSearchActive && el.id === "city") {
                    currentPage = 1;
                    fetchResults();
                }
            });
        }
    });

    // Auto-update dropdown labels on click
    document.querySelectorAll(".inst-cb").forEach(cb => {
        cb.addEventListener("change", () => updateDropdownTriggerLabel("inst-cb", "inst-label", "All Institutes (127+)"));
    });
    document.querySelectorAll(".branch-cb").forEach(cb => {
        cb.addEventListener("change", () => updateDropdownTriggerLabel("branch-cb", "branch-label", "All Branches (126+)"));
    });
    document.querySelectorAll(".type-cb").forEach(cb => {
        cb.addEventListener("change", () => updateDropdownTriggerLabel("type-cb", "type-label", "All Types"));
    });
    document.querySelectorAll(".board-cb").forEach(cb => {
        cb.addEventListener("change", () => updateDropdownTriggerLabel("board-cb", "board-label", "GUJCET & All Boards"));
    });
}

function fetchResults() {
    const rank = parseFloat(document.getElementById("rank").value) || 0;
    const container = document.getElementById("results-container");

    if (rank <= 0) {
        container.style.display = "none";
        return;
    }

    const payload = {
        rank: rank,
        category: getCheckedValues("category-cb"),
        board: getCheckedValues("board-cb"),
        inst_type: getCheckedValues("type-cb"),
        branch: getCheckedValues("branch-cb"),
        inst_name: getCheckedValues("inst-cb"),
        city: document.getElementById("city").value,
        chance_filter: document.getElementById("chance-filter").value,
        sort_by: document.getElementById("sort-by").value,
    };

    // Update active filter status bar
    document.getElementById("active-rank-tag").innerText = `Rank: #${rank.toLocaleString()}`;
    const cats = payload.category.join(", ");
    document.getElementById("active-cat-tag").innerText = `Categories: ${cats}`;

    fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
        .then(res => res.json())
        .then(resData => {
            if (resData.success) {
                currentSearchResults = resData.data || [];
                renderSearchTable();
            }
        })
        .catch(err => console.error("Error fetching predictions:", err));
}

function renderSearchTable() {
    const container = document.getElementById("results-container");
    container.style.display = "block";

    const tbody = document.getElementById("results-table-body");
    const countBadge = document.getElementById("count");
    const paginationContainer = document.getElementById("pagination-container");

    const totalResults = currentSearchResults.length;
    countBadge.innerText = `${totalResults} Options Available`;

    if (totalResults === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
                    🔍 No colleges found matching your exact filter criteria.<br>
                    <small>Try broadening your branch, category, or city selection.</small>
                </td>
            </tr>
        `;
        paginationContainer.style.display = "none";
        return;
    }

    paginationContainer.style.display = "flex";
    const totalPages = Math.ceil(totalResults / pageSize);
    if (currentPage > totalPages) currentPage = totalPages;

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalResults);

    document.getElementById("page-start").innerText = startIndex + 1;
    document.getElementById("page-end").innerText = endIndex;
    document.getElementById("page-total").innerText = totalResults;
    document.getElementById("current-page-num").innerText = `Page ${currentPage} of ${totalPages}`;

    document.getElementById("btn-prev-page").disabled = currentPage === 1;
    document.getElementById("btn-next-page").disabled = currentPage === totalPages;

    const pageData = currentSearchResults.slice(startIndex, endIndex);

    let html = "";
    pageData.forEach(college => {
        const isAdded = preferenceList.some(c =>
            c.Inst_Name === college.Inst_Name &&
            c.Course_name === college.Course_name &&
            c.Category === college.Category
        );

        const isCompared = comparisonList.some(c =>
            c.Inst_Name === college.Inst_Name &&
            c.Course_name === college.Course_name &&
            c.Category === college.Category
        );

        const colEncoded = encodeURIComponent(JSON.stringify(college));

        // Trend Badge
        let trendHtml = `<span class="trend-badge trend-new">New (2025)</span>`;
        if (college.Closing_Rank_2024) {
            if (college.Trend === "TOUGHER") {
                const diff = Math.abs(Math.round(college.Cutoff_Diff));
                trendHtml = `<span class="trend-badge trend-tougher" title="Closing rank dropped by ${diff} (Tougher)">${college.Closing_Rank_2024.toLocaleString()} (↑ ${diff})</span>`;
            } else if (college.Trend === "EASIER") {
                const diff = Math.abs(Math.round(college.Cutoff_Diff));
                trendHtml = `<span class="trend-badge trend-easier" title="Closing rank rose by ${diff} (Easier)">${college.Closing_Rank_2024.toLocaleString()} (↓ ${diff})</span>`;
            } else {
                trendHtml = `<span class="trend-badge trend-stable">${college.Closing_Rank_2024.toLocaleString()} (Stable)</span>`;
            }
        }

        // Chance Badge
        let chanceClass = "chance-target";
        let chanceIcon = "🟡";
        if (college.Chance === "SAFE") {
            chanceClass = "chance-safe";
            chanceIcon = "🟢";
        } else if (college.Chance === "DREAM") {
            chanceClass = "chance-dream";
            chanceIcon = "🔴";
        }
        const chanceHtml = `
            <span class="chance-pill ${chanceClass}">
                ${chanceIcon} ${college.Chance} (${college.Chance_Score}%)
            </span>
        `;

        html += `
            <tr>
                <td>
                    <div style="font-weight: 700;">${college.Inst_Name}</div>
                    <span class="type-badge">${college.Inst_Type || 'SFI'}</span>
                    <span class="board-tag">${college.Board || 'GUJCET'}</span>
                </td>
                <td>
                    <div style="font-weight: 600;">${college.Course_name}</div>
                </td>
                <td><span class="cat-badge">${college.Category}</span></td>
                <td><span class="rank-text">${Number(college.Closing_Rank).toLocaleString()}</span></td>
                <td>${trendHtml}</td>
                <td>${chanceHtml}</td>
                <td>
                    <div class="row-actions">
                        <button class="btn-action" onclick="openCollegeDetails('${encodeURIComponent(college.Inst_Name)}', '${encodeURIComponent(college.Course_name)}')" title="View All Category Cutoffs">
                            ℹ️ Details
                        </button>
                        <button class="btn-action ${isCompared ? 'btn-action-add' : ''}" onclick="toggleCompareItem('${colEncoded}')" title="Compare side-by-side">
                            ${isCompared ? '✓ Compared' : '⚖️ Compare'}
                        </button>
                        <button class="btn-action btn-action-add" onclick="addToPreference('${colEncoded}')" ${isAdded ? 'disabled style="opacity:0.6;"' : ''}>
                            ${isAdded ? '✓ Added' : '➕ Add'}
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function changePage(delta) {
    currentPage += delta;
    renderSearchTable();
    document.getElementById("results-container").scrollIntoView({ behavior: "smooth" });
}

// ==========================================
// 5. CHOICE FILLING PRIORITY LIST BUILDER
// ==========================================
function loadSavedPreferences() {
    try {
        const saved = localStorage.getItem("acpc_preferences");
        if (saved) {
            preferenceList = JSON.parse(saved);
            renderPreferenceTable();
        }
    } catch (e) {
        console.warn("Could not parse saved choices:", e);
    }
}

function savePreferencesToStorage() {
    try {
        localStorage.setItem("acpc_preferences", JSON.stringify(preferenceList));
    } catch (e) {
        console.warn("Could not save choices to localStorage:", e);
    }
}

function addToPreference(colDataStr) {
    const college = JSON.parse(decodeURIComponent(colDataStr));
    const exists = preferenceList.some(c =>
        c.Inst_Name === college.Inst_Name &&
        c.Course_name === college.Course_name &&
        c.Category === college.Category
    );

    if (exists) {
        showToast("ℹ️ College already in your choice filling list", "info");
        return;
    }

    preferenceList.push(college);
    // Sort initially by Closing_Rank (standard recommended strategy)
    preferenceList.sort((a, b) => a.Closing_Rank - b.Closing_Rank);

    savePreferencesToStorage();
    renderPreferenceTable();
    renderSearchTable();
    showToast(`✅ Added ${college.Course_name} (${college.Inst_Name.substring(0, 20)}...) to priority list!`, "success");
}

function renderPreferenceTable() {
    const section = document.getElementById("preference-section");
    const tbody = document.getElementById("pref-table-body");
    const userRank = document.getElementById("rank").value || "—";
    document.getElementById("pdf-student-rank").innerText = userRank;

    const navChoiceBtn = document.getElementById("nav-choice-count");
    const navCountVal = document.getElementById("nav-count-val");

    if (preferenceList.length === 0) {
        section.style.display = "none";
        navChoiceBtn.style.display = "none";
        return;
    }

    section.style.display = "block";
    navChoiceBtn.style.display = "flex";
    navCountVal.innerText = preferenceList.length;

    // Update Choice Audit Safety
    updateChoiceHealthAudit();

    let html = "";
    preferenceList.forEach((college, index) => {
        html += `
            <tr>
                <td class="pref-index">${index + 1}</td>
                <td>
                    <div style="font-weight: 700;">${college.Inst_Name}</div>
                </td>
                <td>
                    <div style="font-weight: 600;">${college.Course_name}</div>
                </td>
                <td><span class="type-badge">${college.Inst_Type || 'SFI'}</span></td>
                <td><span class="cat-badge">${college.Category}</span></td>
                <td><span class="rank-text">${Number(college.Closing_Rank).toLocaleString()}</span></td>
                <td class="hide-on-pdf">
                    <div class="reorder-btns">
                        <button class="btn-reorder" onclick="moveRow(${index}, -1)" title="Move Up">↑</button>
                        <button class="btn-reorder" onclick="moveRow(${index}, 1)" title="Move Down">↓</button>
                        <button class="btn-reorder" onclick="moveToTop(${index})" title="Move to Top">⇈</button>
                        <button class="btn-reorder" onclick="moveToBottom(${index})" title="Move to Bottom">⇊</button>
                        <button class="btn-reorder btn-reorder-del" onclick="deleteRow(${index})" title="Remove">✕</button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function updateChoiceHealthAudit() {
    let dreamCount = 0;
    let targetCount = 0;
    let safeCount = 0;

    preferenceList.forEach(c => {
        if (c.Chance === "SAFE") safeCount++;
        else if (c.Chance === "DREAM") dreamCount++;
        else targetCount++;
    });

    const total = preferenceList.length;
    const dreamPct = total ? (dreamCount / total) * 100 : 0;
    const targetPct = total ? (targetCount / total) * 100 : 0;
    const safePct = total ? (safeCount / total) * 100 : 0;

    document.getElementById("bar-dream").style.width = `${dreamPct}%`;
    document.getElementById("bar-target").style.width = `${targetPct}%`;
    document.getElementById("bar-safe").style.width = `${safePct}%`;

    document.getElementById("count-dream").innerText = dreamCount;
    document.getElementById("count-target").innerText = targetCount;
    document.getElementById("count-safe").innerText = safeCount;

    const ratingElem = document.getElementById("audit-rating");
    if (safeCount >= 3 && targetCount >= 3) {
        ratingElem.innerText = "🌟 Excellent Balanced Strategy";
        ratingElem.style.color = "var(--success)";
    } else if (safeCount === 0) {
        ratingElem.innerText = "⚠️ High Risk: Add 3-5 Safe choices!";
        ratingElem.style.color = "var(--danger)";
    } else {
        ratingElem.innerText = "Good Strategy";
        ratingElem.style.color = "var(--warning)";
    }
}

function moveRow(index, delta) {
    if (index + delta < 0 || index + delta >= preferenceList.length) return;
    const temp = preferenceList[index];
    preferenceList[index] = preferenceList[index + delta];
    preferenceList[index + delta] = temp;
    savePreferencesToStorage();
    renderPreferenceTable();
}

function moveToTop(index) {
    if (index === 0) return;
    const item = preferenceList.splice(index, 1)[0];
    preferenceList.unshift(item);
    savePreferencesToStorage();
    renderPreferenceTable();
}

function moveToBottom(index) {
    if (index === preferenceList.length - 1) return;
    const item = preferenceList.splice(index, 1)[0];
    preferenceList.push(item);
    savePreferencesToStorage();
    renderPreferenceTable();
}

function deleteRow(index) {
    preferenceList.splice(index, 1);
    savePreferencesToStorage();
    renderPreferenceTable();
    renderSearchTable();
    showToast("Choice removed from priority list", "info");
}

function clearAllChoices() {
    if (confirm("Are you sure you want to reset your choice filling priority list?")) {
        preferenceList = [];
        savePreferencesToStorage();
        renderPreferenceTable();
        renderSearchTable();
        showToast("Choice filling list reset", "info");
    }
}

// ==========================================
// 6. EXPORT SUITE (PDF, CSV, CLIPBOARD)
// ==========================================
function downloadPDF() {
    window.scrollTo(0, 0);
    const userRank = document.getElementById("rank").value || "N/A";
    document.getElementById("pdf-student-rank").innerText = userRank;

    const element = document.getElementById("pdf-content");
    const hideElements = document.querySelectorAll(".hide-on-pdf");
    hideElements.forEach(el => el.style.display = "none");

    const opt = {
        margin: [0.3, 0.3, 0.3, 0.3],
        filename: `ACPC_Choice_Filling_Rank_${userRank}_2025.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
        jsPDF: { unit: "in", format: "a4", orientation: "landscape" }
    };

    showToast("📄 Generating official PDF document...", "info");

    setTimeout(() => {
        html2pdf().set(opt).from(element).save().then(() => {
            hideElements.forEach(el => el.style.display = "");
            showToast("✅ PDF downloaded successfully!", "success");
        });
    }, 400);
}

function downloadChoicesCSV() {
    if (preferenceList.length === 0) return;
    let csv = "Preference_No,Institute_Name,Course_Name,Type,Board,Category,2025_Closing_Rank\n";
    preferenceList.forEach((c, idx) => {
        const cleanInst = `"${c.Inst_Name.replace(/"/g, '""')}"`;
        const cleanCourse = `"${c.Course_name.replace(/"/g, '""')}"`;
        csv += `${idx + 1},${cleanInst},${cleanCourse},${c.Inst_Type || ''},${c.Board || ''},${c.Category},${c.Closing_Rank}\n`;
    });

    downloadCSVFile(csv, `ACPC_Choice_Filling_Priority_List_${document.getElementById("rank").value || 'Rank'}.csv`);
    showToast("📊 Choice list exported as CSV!", "success");
}

function exportSearchResultsCSV() {
    if (currentSearchResults.length === 0) return;
    let csv = "Institute_Name,Course_Name,Type,Board,Category,2025_Closing_Rank,2024_Closing_Rank,Trend,Admission_Chance\n";
    currentSearchResults.forEach(c => {
        const cleanInst = `"${c.Inst_Name.replace(/"/g, '""')}"`;
        const cleanCourse = `"${c.Course_name.replace(/"/g, '""')}"`;
        csv += `${cleanInst},${cleanCourse},${c.Inst_Type || ''},${c.Board || ''},${c.Category},${c.Closing_Rank},${c.Closing_Rank_2024 || ''},${c.Trend || ''},${c.Chance || ''}\n`;
    });

    downloadCSVFile(csv, `ACPC_Filtered_Colleges_${document.getElementById("rank").value || 'Search'}.csv`);
    showToast("📊 Filtered colleges exported as CSV!", "success");
}

function downloadCSVFile(csvContent, filename) {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function copyChoicesToClipboard() {
    if (preferenceList.length === 0) return;
    let text = `ACPC CHOICE FILLING PRIORITY LIST (Merit Rank: ${document.getElementById("rank").value || '—'})\n\n`;
    preferenceList.forEach((c, idx) => {
        text += `${idx + 1}. ${c.Inst_Name} | ${c.Course_name} | ${c.Category} (Closing: ${c.Closing_Rank})\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
        showToast("📋 Choice list copied to clipboard!", "success");
    }).catch(() => {
        showToast("Could not copy text automatically", "warning");
    });
}

// ==========================================
// 7. COLLEGE COMPARISON & DETAILS MODALS
// ==========================================
function toggleCompareItem(colDataStr) {
    const college = JSON.parse(decodeURIComponent(colDataStr));
    const idx = comparisonList.findIndex(c =>
        c.Inst_Name === college.Inst_Name &&
        c.Course_name === college.Course_name &&
        c.Category === college.Category
    );

    if (idx >= 0) {
        comparisonList.splice(idx, 1);
        showToast("College removed from comparison tray", "info");
    } else {
        if (comparisonList.length >= 3) {
            showToast("⚠️ You can compare up to 3 colleges at a time", "warning");
            return;
        }
        comparisonList.push(college);
        showToast("Added to comparison tray", "success");
    }

    updateComparisonTray();
    renderSearchTable();
}

function updateComparisonTray() {
    const tray = document.getElementById("comparison-tray");
    const countElem = document.getElementById("compare-count");
    if (comparisonList.length > 0) {
        tray.style.display = "block";
        countElem.innerText = comparisonList.length;
    } else {
        tray.style.display = "none";
    }
}

function clearComparisonTray() {
    comparisonList = [];
    updateComparisonTray();
    renderSearchTable();
}

function openComparisonModal() {
    if (comparisonList.length === 0) return;
    const body = document.getElementById("compare-modal-body");

    let gridHtml = `<div class="comparison-grid">`;
    comparisonList.forEach((c, idx) => {
        gridHtml += `
            <div class="compare-card">
                <div class="compare-title">Option ${idx + 1}: ${c.Inst_Name}</div>
                <div class="compare-item">
                    <span class="compare-label">Branch</span>
                    <strong>${c.Course_name}</strong>
                </div>
                <div class="compare-item">
                    <span class="compare-label">Type</span>
                    <span class="type-badge">${c.Inst_Type || 'SFI'}</span>
                </div>
                <div class="compare-item">
                    <span class="compare-label">Board / Quota</span>
                    <span>${c.Board || 'GUJCET'}</span>
                </div>
                <div class="compare-item">
                    <span class="compare-label">Category</span>
                    <span>${c.Category}</span>
                </div>
                <div class="compare-item">
                    <span class="compare-label">2025 Closing Rank</span>
                    <strong class="rank-text">${Number(c.Closing_Rank).toLocaleString()}</strong>
                </div>
                <div class="compare-item">
                    <span class="compare-label">2024 Closing Rank</span>
                    <span>${c.Closing_Rank_2024 ? Number(c.Closing_Rank_2024).toLocaleString() : 'N/A'}</span>
                </div>
                <div class="compare-item">
                    <span class="compare-label">Admission Chance</span>
                    <span class="chance-pill ${c.Chance === 'SAFE' ? 'chance-safe' : (c.Chance === 'DREAM' ? 'chance-dream' : 'chance-target')}">${c.Chance}</span>
                </div>
            </div>
        `;
    });
    gridHtml += `</div>`;
    body.innerHTML = gridHtml;

    document.getElementById("compare-modal").style.display = "flex";
}

function openCollegeDetails(instNameEnc, courseNameEnc) {
    const instName = decodeURIComponent(instNameEnc);
    const courseName = decodeURIComponent(courseNameEnc);

    document.getElementById("details-modal-title").innerText = instName;
    document.getElementById("details-modal-subtitle").innerText = courseName;
    const body = document.getElementById("details-modal-body");
    body.innerHTML = "<p style='text-align:center; padding: 20px;'>Loading category cutoffs...</p>";

    document.getElementById("details-modal").style.display = "flex";

    fetch("/api/college_details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inst_name: instName, course_name: courseName })
    })
        .then(res => res.json())
        .then(resData => {
            if (resData.success && resData.data.length > 0) {
                let tableHtml = `
                    <div class="table-responsive">
                        <table class="pro-table">
                            <thead>
                                <tr>
                                    <th>Category</th>
                                    <th>Board</th>
                                    <th>2025 Cutoff</th>
                                    <th>2024 Cutoff</th>
                                    <th>Shift Trend</th>
                                </tr>
                            </thead>
                            <tbody>
                `;
                resData.data.forEach(row => {
                    tableHtml += `
                        <tr>
                            <td><span class="cat-badge">${row.Category}</span></td>
                            <td>${row.Board || 'GUJCET'}</td>
                            <td><strong class="rank-text">${Number(row.Closing_Rank).toLocaleString()}</strong></td>
                            <td>${row.Closing_Rank_2024 ? Number(row.Closing_Rank_2024).toLocaleString() : '—'}</td>
                            <td><span class="trend-badge ${row.Trend === 'TOUGHER' ? 'trend-tougher' : (row.Trend === 'EASIER' ? 'trend-easier' : 'trend-stable')}">${row.Trend || 'STABLE'}</span></td>
                        </tr>
                    `;
                });
                tableHtml += `</tbody></table></div>`;
                body.innerHTML = tableHtml;
            } else {
                body.innerHTML = "<p style='text-align:center; padding: 20px;'>No additional category records available.</p>";
            }
        })
        .catch(() => {
            body.innerHTML = "<p style='text-align:center; color: var(--danger); padding: 20px;'>Error fetching details.</p>";
        });
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = "none";
}

function closeModalOnBackdrop(event, modalId) {
    if (event.target.id === modalId) {
        closeModal(modalId);
    }
}

// ==========================================
// 8. TOAST NOTIFICATIONS
// ==========================================
function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(40px)";
        setTimeout(() => toast.remove(), 250);
    }, 3200);
}
