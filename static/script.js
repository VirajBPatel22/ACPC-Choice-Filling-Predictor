let isLiveSearchActive = false;
let preferenceList = [];
let currentSearchResults = [];

function toggleDropdown(id) {
    document.querySelectorAll('.multi-select-options').forEach(el => {
        if (el.id !== id) el.classList.remove('show');
    });
    document.getElementById(id).classList.toggle('show');
}

window.onclick = function (event) {
    if (!event.target.closest('.form-group')) {
        document.querySelectorAll('.multi-select-options').forEach(el => el.classList.remove('show'));
    }
};

function getCheckedValues(className) {
    let values = [];
    document.querySelectorAll('.' + className + ':checked').forEach(cb => {
        if (cb.value !== 'ALL') values.push(cb.value);
    });
    return values.length > 0 ? values : ['ALL'];
}

function startLiveSearch() {
    const rank = document.getElementById('rank').value;
    if (!rank) { alert("Please enter your Merit Rank first!"); return; }
    isLiveSearchActive = true;
    fetchResults();
    const btn = document.getElementById('search-btn');
    btn.disabled = true;
    btn.innerHTML = "⚡ Live Auto-Update Active";
}

function fetchResults() {
    const rank = document.getElementById('rank').value;
    const container = document.getElementById('results-container');
    if (!rank) { container.style.display = 'none'; return; }

    const requestData = {
        rank: rank,
        category: getCheckedValues('category-cb'),
        board: getCheckedValues('board-cb'),
        inst_type: getCheckedValues('type-cb'),
        branch: getCheckedValues('branch-cb'),
        inst_name: getCheckedValues('inst-cb'),
        city: document.getElementById('city').value
    };

    fetch('/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
    })
        .then(response => response.json())
        .then(data => {
            if (data.error) return;
            currentSearchResults = data;
            renderSearchTable();
        })
        .catch(error => console.error("Error fetching data:", error));
}

function renderSearchTable() {
    const container = document.getElementById('results-container');
    container.style.display = 'block';

    let tableHtml = "";
    let visibleCount = 0;

    currentSearchResults.forEach(college => {
        const isExist = preferenceList.some(c =>
            c.Inst_Name === college.Inst_Name &&
            c.Course_name === college.Course_name &&
            c.Category === college.Category
        );

        if (!isExist) {
            visibleCount++;
            const colData = encodeURIComponent(JSON.stringify(college));
            tableHtml += `
                <tr>
                    <td>${college.Inst_Name}</td>
                    <td>${college.Course_name}</td>
                    <td><span class="type-badge">${college.Inst_Type}</span></td>
                    <td>${college.Board}</td>
                    <td><span class="cat-tag">${college.Category}</span></td>
                    <td><span class="rank-val">${college.Closing_Rank}</span></td>
                    <td>
                        <button class="action-btn btn-add" onclick="addToPreference('${colData}')">➕ Add</button>
                    </td>
                </tr>
            `;
        }
    });

    document.getElementById('count').innerText = visibleCount;
    document.getElementById('results-table-body').innerHTML = tableHtml;
}

document.querySelectorAll('input, select').forEach(element => {
    element.addEventListener('change', () => { if (isLiveSearchActive) fetchResults(); });
    element.addEventListener('input', () => {
        if (isLiveSearchActive && element.type !== 'checkbox') fetchResults();
    });
});

function addToPreference(colDataStr) {
    const college = JSON.parse(decodeURIComponent(colDataStr));
    preferenceList.push(college);
    preferenceList.sort((a, b) => a.Closing_Rank - b.Closing_Rank);
    renderPreferenceTable();
    renderSearchTable();
}

function renderPreferenceTable() {
    const tbody = document.getElementById('pref-table-body');
    const section = document.getElementById('preference-section');

    if (preferenceList.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    let html = "";
    preferenceList.forEach((college, index) => {
        html += `
            <tr>
                <td class="pref-num">${index + 1}</td>
                <td>${college.Inst_Name}</td>
                <td>${college.Course_name}</td>
                <td><span class="type-badge">${college.Inst_Type}</span></td>
                <td><span class="cat-tag">${college.Category}</span></td>
                <td><span class="rank-val">${college.Closing_Rank}</span></td>
                <td class="hide-on-pdf">
                    <button class="action-btn btn-up"   onclick="moveRow(${index}, -1)" title="Move Up">⬆️</button>
                    <button class="action-btn btn-down" onclick="moveRow(${index},  1)" title="Move Down">⬇️</button>
                    <button class="action-btn btn-del"  onclick="deleteRow(${index})"  title="Delete">✕</button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

function moveRow(index, direction) {
    if (index + direction < 0 || index + direction >= preferenceList.length) return;
    const temp = preferenceList[index];
    preferenceList[index] = preferenceList[index + direction];
    preferenceList[index + direction] = temp;
    renderPreferenceTable();
}

function deleteRow(index) {
    preferenceList.splice(index, 1);
    renderPreferenceTable();
    renderSearchTable();
}

function setRankMode(mode) {
    document.getElementById('manual-rank-section').style.display = mode === 'manual' ? 'block' : 'none';
    document.getElementById('calc-pr-section').style.display    = mode === 'pr'     ? 'block' : 'none';
    document.getElementById('calc-marks-section').style.display = mode === 'marks'  ? 'block' : 'none';

    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    const map = { manual: 'btn-know-rank', pr: 'btn-calc-pr', marks: 'btn-calc-marks' };
    document.getElementById(map[mode]).classList.add('active');
}

function calculateByPR() {
    const pcm   = parseFloat(document.getElementById('pcm-pr').value)   || 0;
    const gujcet = parseFloat(document.getElementById('gujcet-pr').value) || 0;

    if (pcm > 0 && gujcet > 0) {
        const meritPR = (pcm * 0.5) + (gujcet * 0.5);
        let estRank = Math.round((100 - meritPR) * 400);
        if (estRank < 1) estRank = 1;
        document.getElementById('calculated-rank-display-pr').innerText = estRank;
        document.getElementById('rank').value = estRank;
        if (isLiveSearchActive) fetchResults();
    }
}

function calculateByMarks() {
    const pcm    = parseFloat(document.getElementById('pcm-mark').value)    || 0;
    const gujcet = parseFloat(document.getElementById('gujcet-mark').value) || 0;

    if (pcm > 0 && gujcet > 0) {
        fetch('/calculate_rank', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pcm, gujcet })
        })
            .then(res => res.json())
            .then(data => {
                if (data.rank > 0) {
                    document.getElementById('pr-display-marks').innerText =
                        `PCM PR: ${data.pcm_pr}  |  GUJCET PR: ${data.gujcet_pr}`;
                    document.getElementById('calculated-rank-display-marks').innerText = data.rank;
                    document.getElementById('rank').value = data.rank;
                    if (isLiveSearchActive) fetchResults();
                }
            })
            .catch(() => {});
    }
}

function downloadPDF() {
    window.scrollTo(0, 0);
    const userRank = document.getElementById('rank').value;
    document.getElementById('pdf-student-rank').innerText = userRank;

    const element      = document.getElementById('pdf-content');
    const hideElements = document.querySelectorAll('.hide-on-pdf');
    hideElements.forEach(el => el.style.display = 'none');

    const prefScroll = document.getElementById('pref-scroll-container');
    prefScroll.style.maxHeight = 'none';
    prefScroll.style.overflow  = 'visible';

    const opt = {
        margin:     0.3,
        filename:   `ACPC_Choice_Filling_Rank_${userRank}.pdf`,
        image:      { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, scrollY: 0 },
        jsPDF:      { unit: 'in', format: 'a4', orientation: 'landscape' }
    };

    setTimeout(() => {
        html2pdf().set(opt).from(element).save().then(() => {
            hideElements.forEach(el => el.style.display = '');
            prefScroll.style.maxHeight = '380px';
            prefScroll.style.overflowY = 'auto';
        });
    }, 300);
}